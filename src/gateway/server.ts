import path from "node:path";
import os from "node:os";
import { mkdir, writeFile } from "node:fs/promises";

import { loadConfig } from "../config/loader.js";
import type { BahamutConfig } from "../config/schema.js";
import { FileLogSink } from "../logging/file-sink.js";
import { ConsoleLogSink } from "../logging/console-sink.js";
import { ConvexLogSink } from "../logging/convex-sink.js";
import type { LogSink } from "../logging/sink.js";
import { PiBrainRuntime, defaultDataDir } from "../agent/runner.js";
import { GatewayRouter } from "./router.js";
import { TelegramChannel } from "../channels/telegram.js";
import { DiscordChannel } from "../channels/discord.js";
import { SlackChannel } from "../channels/slack.js";
import { WhatsAppChannel } from "../channels/whatsapp.js";
import type { BaseChannel } from "../channels/base.js";
import { CronManager } from "../scheduler/cron.js";
import { HeartbeatRunner } from "../scheduler/heartbeat.js";
import { defaultRoles } from "../agent/roles.js";

async function ensureWorkspaceTemplate(workspaceDir: string): Promise<void> {
  await mkdir(path.join(workspaceDir, "skills"), { recursive: true });
  const defaults: Record<string, string> = {
    "AGENTS.md": "Bahamut brain session.",
    "SOUL.md": "Operate safely and decisively.",
    "TOOLS.md": "Use bash and file tools carefully.",
    "HEARTBEAT.md": "Review current workload and update memory. Return HEARTBEAT_OK when no action is needed.",
    "HISTORY.md": "",
    "MEMORY.md": "",
  };
  await Promise.all(
    Object.entries(defaults).map(([name, content]) =>
      writeFile(path.join(workspaceDir, name), content, { encoding: "utf8", flag: "a" }),
    ),
  );
}

function createLogSink(config: BahamutConfig): LogSink {
  if (config.logSink === "console") return new ConsoleLogSink();
  if (config.logSink === "convex") return new ConvexLogSink();
  return new FileLogSink();
}

export class GatewayServer {
  private channels: BaseChannel[] = [];
  private cronManager: CronManager | null = null;
  private heartbeat: HeartbeatRunner | null = null;
  private runtime: PiBrainRuntime | null = null;
  private config: BahamutConfig | null = null;

  async start(configPath?: string): Promise<void> {
    this.config = await loadConfig(configPath);
    const workspaceDir = path.resolve(this.config.workspaceDir);
    await ensureWorkspaceTemplate(workspaceDir);
    const dataDir = path.join(os.homedir(), ".bahamut");
    const logSink = createLogSink(this.config);

    this.runtime = new PiBrainRuntime({
      dataDir: this.config.dataDir || defaultDataDir(),
      workspaceDir,
      logSink,
    });

    // Spawn default role sessions for baseline multi-session support.
    for (const role of defaultRoles) {
      if (role.id !== this.config.brainAgentId) {
        await this.runtime.spawnRoleSession(role.id, role.systemPrompt);
      }
    }

    const router = new GatewayRouter(this.config, this.runtime, logSink);
    this.channels = this.buildChannels(this.config);
    for (const channel of this.channels) {
      channel.setInboundHandler(async (envelope) => {
        const outbound = await router.handleInbound(envelope);
        if (outbound) {
          await channel.send(outbound);
        }
      });
      await channel.start();
    }

    this.cronManager = new CronManager(this.runtime, logSink);
    await this.cronManager.loadAndStart();

    this.heartbeat = new HeartbeatRunner(
      this.runtime,
      logSink,
      workspaceDir,
      this.config.heartbeat.intervalMinutes,
      "brain:main",
    );
    if (this.config.heartbeat.enabled) this.heartbeat.start();
  }

  async stop(): Promise<void> {
    this.heartbeat?.stop();
    for (const channel of this.channels) {
      await channel.stop();
    }
    this.channels = [];
  }

  getStatus(): Record<string, unknown> {
    return {
      channels: this.channels.map((c) => c.id),
      sessions: this.runtime?.listSessions() ?? [],
      cronJobs: this.cronManager?.listActiveJobIds() ?? [],
      configLoaded: Boolean(this.config),
    };
  }

  private buildChannels(config: BahamutConfig): BaseChannel[] {
    const channels: BaseChannel[] = [];
    if (config.channels.telegram.enabled && config.channels.telegram.botToken) {
      channels.push(new TelegramChannel(config.channels.telegram.botToken));
    }
    if (config.channels.discord.enabled) channels.push(new DiscordChannel());
    if (config.channels.slack.enabled) channels.push(new SlackChannel());
    if (config.channels.whatsapp.enabled) channels.push(new WhatsAppChannel());
    return channels;
  }
}
