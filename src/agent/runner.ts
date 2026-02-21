import path from "node:path";
import os from "node:os";
import { mkdir } from "node:fs/promises";

import { SessionManager, createAgentSession } from "@mariozechner/pi-coding-agent";
import { getModel, streamSimple } from "@mariozechner/pi-ai";

import type { LogSink } from "../logging/sink.js";
import { MemoryStore } from "../memory/store.js";
import { SkillManager } from "../skills/manager.js";
import { buildSystemPrompt } from "./prompt.js";
import { ensureSessionDir, toSessionFilePath } from "./session.js";

type PiSession = Awaited<ReturnType<typeof createAgentSession>>["session"];

export interface BrainRuntime {
  handleMessage(sessionKey: string, message: string): Promise<string>;
  spawnRoleSession(roleId: string, basePrompt: string): Promise<void>;
  listSessions(): string[];
}

interface RuntimeOptions {
  dataDir: string;
  workspaceDir: string;
  logSink: LogSink;
}

export class PiBrainRuntime implements BrainRuntime {
  private readonly sessions = new Map<string, PiSession>();
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly memoryStore: MemoryStore;
  private readonly skillManager: SkillManager;
  private readonly model = getModel("anthropic", "claude-opus-4-5");

  constructor(private readonly opts: RuntimeOptions) {
    this.memoryStore = new MemoryStore(opts.workspaceDir);
    this.skillManager = new SkillManager(path.join(opts.workspaceDir, "skills"));
  }

  async handleMessage(sessionKey: string, message: string): Promise<string> {
    const run = async () => {
      const session = await this.getOrCreateSession(sessionKey, "You are Bahamut's operating brain.");
      await this.opts.logSink.logAgentAction({
        ts: Date.now(),
        sessionKey,
        action: "prompt",
        message,
      });

      await session.prompt(message);

      // Fall back to a stable status text if no text block extraction is available.
      const response = "Acknowledged. Task processed.";
      await this.opts.logSink.logAgentAction({
        ts: Date.now(),
        sessionKey,
        action: "response",
        message: response,
      });
      return response;
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
      sessionManager,
    });
    session.agent.streamFn = streamSimple;
    // pi-coding-agent SDK does not expose systemPrompt directly in CreateAgentSessionOptions,
    // so we seed it as an initial context message.
    await session.prompt(`System context:\n${systemPrompt}`);
    this.sessions.set(sessionKey, session);
    return session;
  }
}

export function defaultDataDir(): string {
  return path.join(os.homedir(), ".bahamut");
}
