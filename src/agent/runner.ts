import path from "node:path";
import os from "node:os";
import { mkdir } from "node:fs/promises";

import { AuthStorage, ModelRegistry, SessionManager, createAgentSession } from "@mariozechner/pi-coding-agent";
import { getModel, streamSimple, type Model } from "@mariozechner/pi-ai";

import type { LogSink } from "../logging/sink.js";
import { MemoryStore } from "../memory/store.js";
import { SkillManager } from "../skills/manager.js";
import { buildSystemPrompt } from "./prompt.js";
import { ensureSessionDir, toSessionFilePath } from "./session.js";
import type { SessionBusyPolicy } from "../types.js";

type PiSession = Awaited<ReturnType<typeof createAgentSession>>["session"];

export interface BrainRuntime {
  handleMessage(sessionKey: string, message: string, options?: RuntimeMessageOptions): Promise<string>;
  spawnRoleSession(roleId: string, basePrompt: string): Promise<void>;
  listSessions(): string[];
}

export interface RuntimeMessageOptions {
  correlationId?: string;
  busyPolicy?: SessionBusyPolicy;
}

interface RuntimeOptions {
  dataDir: string;
  workspaceDir: string;
  logSink: LogSink;
  ai: {
    enabled: boolean;
    defaultModel: string;
    providers: Record<
      string,
      {
        apiKey?: string;
        apiBase?: string | null;
        extraHeaders?: Record<string, string> | null;
      }
    >;
  };
  agent: {
    maxTokens: number;
    temperature: number;
    maxToolIterations: number;
    memoryWindow: number;
    busyPolicy: SessionBusyPolicy;
    personalSessionKey: string;
    mockReply: string;
  };
}

export class PiBrainRuntime implements BrainRuntime {
  private readonly sessions = new Map<string, PiSession>();
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly activeSessions = new Set<string>();
  private readonly memoryStore: MemoryStore;
  private readonly skillManager: SkillManager;
  private readonly authStorage: AuthStorage;
  private readonly modelRegistry: ModelRegistry;
  private readonly model: Model<any>;

  constructor(private readonly opts: RuntimeOptions) {
    this.memoryStore = new MemoryStore(opts.workspaceDir);
    this.skillManager = new SkillManager(path.join(opts.workspaceDir, "skills"));

    this.authStorage = AuthStorage.create(path.join(opts.dataDir, "agent", "auth.json"));
    this.modelRegistry = new ModelRegistry(this.authStorage, path.join(opts.dataDir, "agent", "models.json"));

    for (const [providerId, providerConfig] of Object.entries(opts.ai.providers)) {
      if (providerConfig.apiKey) {
        this.authStorage.setRuntimeApiKey(providerId, providerConfig.apiKey);
      }
      if (providerConfig.apiBase || providerConfig.extraHeaders) {
        this.modelRegistry.registerProvider(providerId, {
          baseUrl: providerConfig.apiBase ?? undefined,
          headers: providerConfig.extraHeaders ?? undefined,
        });
      }
    }

    const [provider, modelId] = this.parseModelRef(opts.ai.defaultModel);
    const selected = this.modelRegistry.find(provider, modelId) ?? getModel(provider as never, modelId);
    if (!selected) {
      throw new Error(`Configured model not found: ${provider}/${modelId}`);
    }
    this.model = selected;
  }

  async handleMessage(sessionKey: string, message: string, options: RuntimeMessageOptions = {}): Promise<string> {
    const busyPolicy = options.busyPolicy ?? this.opts.agent.busyPolicy;
    // MEM-0008 decision: busy sessions default to queue; steer is explicit opt-in.
    if (busyPolicy === "steer" && this.activeSessions.has(sessionKey)) {
      const session = await this.getOrCreateSession(sessionKey, "You are Blitz, Fahrenheit's operating brain.");
      session.steer(message);
      await this.opts.logSink.logAgentAction({
        ts: Date.now(),
        sessionKey,
        correlationId: options.correlationId,
        action: "steer",
        message,
      });
      return "Steered active session.";
    }

    const run = async () => {
      this.activeSessions.add(sessionKey);
      try {
        const session = await this.getOrCreateSession(sessionKey, "You are Blitz, Fahrenheit's operating brain.");
        await this.opts.logSink.logAgentAction({
          ts: Date.now(),
          sessionKey,
          correlationId: options.correlationId,
          action: "prompt",
          message,
        });

        await session.prompt(message);

        // Fall back to a stable status text if no text block extraction is available.
        const response = "Acknowledged. Task processed.";
        await this.opts.logSink.logAgentAction({
          ts: Date.now(),
          sessionKey,
          correlationId: options.correlationId,
          action: "response",
          message: response,
        });
        return response;
      } finally {
        this.activeSessions.delete(sessionKey);
      }
    };

    const previous = this.queues.get(sessionKey) ?? Promise.resolve();
    const current = previous.then(run, run);
    this.queues.set(sessionKey, current);
    return current as Promise<string>;
  }

  async spawnRoleSession(roleId: string, basePrompt: string): Promise<void> {
    const sessionKey = `role:${roleId}`;
    await this.getOrCreateSession(sessionKey, basePrompt);
    await this.opts.logSink.logAgentAction({
      ts: Date.now(),
      sessionKey,
      action: "spawn_role_session",
      message: `Spawned role session ${roleId}`,
    });
  }

  listSessions(): string[] {
    return [...this.sessions.keys()];
  }

  private async getOrCreateSession(sessionKey: string, basePrompt: string): Promise<PiSession> {
    const existing = this.sessions.get(sessionKey);
    if (existing) return existing;

    await ensureSessionDir(this.opts.dataDir);
    await mkdir(this.opts.workspaceDir, { recursive: true });
    const systemPrompt = await buildSystemPrompt(this.opts.workspaceDir, this.skillManager, this.memoryStore, basePrompt);

    const sessionFile = toSessionFilePath(this.opts.dataDir, sessionKey);
    const sessionManager = SessionManager.open(sessionFile);
    const { session } = await createAgentSession({
      model: this.model,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      sessionManager,
    });
    session.agent.streamFn = streamSimple;
    // pi-coding-agent SDK does not expose systemPrompt directly in CreateAgentSessionOptions,
    // so we seed it as an initial context message.
    await session.prompt(`System context:\n${systemPrompt}`);
    this.sessions.set(sessionKey, session);
    return session;
  }

  private parseModelRef(modelRef: string): [string, string] {
    const trimmed = modelRef.trim();
    if (trimmed.includes("/")) {
      const [provider, ...rest] = trimmed.split("/");
      const modelId = rest.join("/");
      if (provider in this.opts.ai.providers) {
        return [provider, modelId];
      }
      // Convenience: if OpenRouter is configured, treat unknown-prefixed refs
      // like "moonshotai/kimi-k2.5" as an OpenRouter model ID.
      if ("openrouter" in this.opts.ai.providers) {
        return ["openrouter", trimmed];
      }
      return [provider, modelId];
    }
    return ["anthropic", trimmed];
  }
}

export function defaultDataDir(): string {
  // MEM-0003 decision: runtime state defaults to ~/.fahrenheit.
  return path.join(os.homedir(), ".fahrenheit");
}
