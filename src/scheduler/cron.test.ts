import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import type { BrainRuntime } from "../agent/runner.js";
import type { LogSink } from "../logging/sink.js";
import { CronManager } from "./cron.js";

const noopBrain: BrainRuntime = {
  async handleMessage() {
    return "ok";
  },
  async spawnRoleSession() {},
  listSessions() {
    return [];
  },
};

const noopSink: LogSink = {
  async logAgentAction() {},
  async logCronRun() {},
  async logChannelMessage() {},
};

describe("CronManager", () => {
  it("persists definitions and reads them back", async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), "fahrenheit-cron-"));
    const jobsPath = path.join(base, "jobs.json");
    const runsPath = path.join(base, "runs.jsonl");
    const manager = new CronManager(noopBrain, noopSink, jobsPath, runsPath);

    await manager.addJob({
      id: "daily",
      schedule: "0 9 * * *",
      prompt: "check daily",
      sessionKey: "agent:ops:main",
      enabled: true,
    });

    const defs = await manager.listDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0]).toMatchObject({ id: "daily", sessionKey: "agent:ops:main" });
  });

  it("loads recent run history from jsonl", async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), "fahrenheit-cron-runs-"));
    const jobsPath = path.join(base, "jobs.json");
    const runsPath = path.join(base, "runs.jsonl");
    await writeFile(
      runsPath,
      `${JSON.stringify({ ts: 1, jobId: "a", status: "ok", detail: "ok", elapsedMs: 10 })}\n${JSON.stringify({ ts: 2, jobId: "b", status: "error", detail: "boom", elapsedMs: 20 })}\n`,
      "utf8",
    );
    const manager = new CronManager(noopBrain, noopSink, jobsPath, runsPath);

    const runs = await manager.listRuns(1);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ jobId: "b", status: "error" });
  });

  it("does not start disabled jobs when added", async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), "fahrenheit-cron-disabled-"));
    const manager = new CronManager(noopBrain, noopSink, path.join(base, "jobs.json"), path.join(base, "runs.jsonl"));

    await manager.addJob({
      id: "disabled",
      schedule: "* * * * *",
      prompt: "noop",
      sessionKey: "runtime:main",
      enabled: false,
    });

    expect(manager.listActiveJobIds()).toEqual([]);
  });

  it("updates cron definitions and toggles enabled state", async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), "fahrenheit-cron-update-"));
    const manager = new CronManager(noopBrain, noopSink, path.join(base, "jobs.json"), path.join(base, "runs.jsonl"));
    await manager.addJob({
      id: "ops",
      schedule: "0 * * * *",
      prompt: "first",
      sessionKey: "runtime:main",
      enabled: true,
    });

    await manager.updateJob("ops", { prompt: "second", enabled: false });
    const defs = await manager.listDefinitions();
    expect(defs[0]).toMatchObject({ id: "ops", prompt: "second", enabled: false });
    expect(manager.listActiveJobIds()).toEqual([]);

    await manager.setEnabled("ops", true);
    const updated = await manager.listDefinitions();
    expect(updated[0]).toMatchObject({ id: "ops", enabled: true });
    expect(manager.listActiveJobIds()).toContain("ops");
  });

  it("calls onRunComplete for executed jobs", async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), "fahrenheit-cron-observation-"));
    const runs: string[] = [];
    const manager = new CronManager(
      noopBrain,
      noopSink,
      path.join(base, "jobs.json"),
      path.join(base, "runs.jsonl"),
      async (run) => {
        runs.push(run.jobId);
      },
    );
    await manager.addJob({
      id: "tick",
      schedule: "* * * * * *",
      prompt: "capture observation",
      sessionKey: "runtime:main",
      enabled: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(runs.includes("tick")).toBe(true);
  });
});
