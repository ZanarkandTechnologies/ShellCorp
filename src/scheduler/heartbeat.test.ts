import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import type { BrainRuntime } from "../agent/runner.js";
import type { LogSink } from "../logging/sink.js";
import { HeartbeatRunner } from "./heartbeat.js";

describe("HeartbeatRunner", () => {
  it("logs non-HEARTBEAT_OK responses", async () => {
    const calls: Array<{ sessionKey: string; message: string; correlationId?: string }> = [];
    const logs: Array<{ detail: string; correlationId?: string }> = [];
    const brain: BrainRuntime = {
      async handleMessage(sessionKey, message, options) {
        calls.push({ sessionKey, message, correlationId: options?.correlationId });
        return "action required";
      },
      async spawnRoleSession() {},
      listSessions() {
        return [];
      },
    };
    const sink: LogSink = {
      async logAgentAction() {},
      async logCronRun(entry) {
        logs.push({ detail: entry.detail, correlationId: entry.correlationId });
      },
      async logChannelMessage() {},
    };

    const workspace = await mkdtemp(path.join(os.tmpdir(), "fahrenheit-heartbeat-"));
    await writeFile(path.join(workspace, "HEARTBEAT.md"), "check systems", "utf8");

    const runner = new HeartbeatRunner(brain, sink, workspace, 30, "HEARTBEAT.md", "runtime:main");
    await runner.runOnce();

    expect(calls).toHaveLength(1);
    expect(calls[0].sessionKey).toBe("runtime:main");
    expect(calls[0].message).toContain("check systems");
    expect(calls[0].correlationId).toMatch(/^heartbeat:/);
    expect(logs).toHaveLength(1);
    expect(logs[0].detail).toContain("action required");
  });

  it("suppresses logs when HEARTBEAT_OK is returned", async () => {
    const logs: string[] = [];
    const brain: BrainRuntime = {
      async handleMessage() {
        return "HEARTBEAT_OK";
      },
      async spawnRoleSession() {},
      listSessions() {
        return [];
      },
    };
    const sink: LogSink = {
      async logAgentAction() {},
      async logCronRun(entry) {
        logs.push(entry.detail);
      },
      async logChannelMessage() {},
    };

    const workspace = await mkdtemp(path.join(os.tmpdir(), "fahrenheit-heartbeat-ok-"));
    await writeFile(path.join(workspace, "HEARTBEAT.md"), "ping", "utf8");

    const runner = new HeartbeatRunner(brain, sink, workspace, 30, "HEARTBEAT.md", "runtime:main");
    await runner.runOnce();
    expect(logs).toEqual([]);
  });
});
