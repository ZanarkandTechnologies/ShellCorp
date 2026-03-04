import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerOfficeCommands } from "./office-commands.js";

const baseCompany = {
  version: 1,
  departments: [
    { id: "dept-ceo", name: "CEO Office", description: "", goal: "" },
    { id: "dept-products", name: "Product Studio", description: "", goal: "" },
  ],
  projects: [{ id: "proj-alpha", departmentId: "dept-products", name: "Alpha", githubUrl: "", status: "active", goal: "Ship", kpis: [] }],
  agents: [{ agentId: "alpha-pm", role: "pm", projectId: "proj-alpha", heartbeatProfileId: "hb-pm", isCeo: false, lifecycleState: "active" }],
  roleSlots: [],
  heartbeatProfiles: [{ id: "hb-pm", role: "pm", cadenceMinutes: 10, teamDescription: "", productDetails: "", goal: "" }],
  tasks: [],
  channelBindings: [],
  federationPolicies: [],
  providerIndexProfiles: [],
};

interface Snapshot {
  officeStylePreset?: string;
}

async function setupStateDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "shellcorp-office-cli-test-"));
  await writeFile(path.join(dir, "company.json"), `${JSON.stringify(baseCompany, null, 2)}\n`, "utf-8");
  await writeFile(path.join(dir, "office-objects.json"), "[]\n", "utf-8");
  return dir;
}

async function runCommand(args: string[]): Promise<void> {
  const program = new Command();
  registerOfficeCommands(program);
  await program.parseAsync(args, { from: "user" });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.OPENCLAW_STATE_DIR;
  process.exitCode = undefined;
});

describe("office CLI", () => {
  it("adds, moves, and removes objects", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    await runCommand(["office", "add", "plant", "--id", "plant-a", "--position", "-10,0,-10"]);
    await runCommand(["office", "move", "plant-a", "--position", "0,0,0"]);
    await runCommand(["office", "remove", "plant-a"]);

    const raw = await readFile(path.join(stateDir, "office-objects.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual([]);
  });

  it("sets and reads office theme", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(["office", "theme", "set", "cozy"]);
    await runCommand(["office", "theme"]);

    const raw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const company = JSON.parse(raw) as Snapshot;
    expect(company.officeStylePreset).toBe("cozy");
    expect(logSpy).toHaveBeenCalledWith("Current office theme: cozy");
  });

  it("writes a meshy spec via office generate", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    await runCommand(["office", "generate", "small", "cactus", "desk", "plant", "--style", "low-poly", "--type", "prop"]);

    const assetDir = path.join(stateDir, "assets", "mesh");
    const files = await readdir(assetDir);
    const specFile = files.find((name) => name.endsWith(".md") && name !== "INDEX.md");
    expect(specFile).toBeTruthy();
    const specRaw = await readFile(path.join(assetDir, specFile as string), "utf-8");
    expect(specRaw).toContain("# small cactus desk plant");
    expect(specRaw).toContain("- style: low-poly");
    expect(specRaw).toContain("- asset_type: prop");
  });

  it("prints json output for office list", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand(["office", "add", "plant", "--id", "plant-a", "--position", "-10,0,-10"]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(["office", "list", "--json"]);
    const payload = String(logSpy.mock.calls.at(-1)?.[0] ?? "");
    expect(payload).toContain("\"objects\"");
    expect(payload).toContain("\"plant-a\"");
  });
});

