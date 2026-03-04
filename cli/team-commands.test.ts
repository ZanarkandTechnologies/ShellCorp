import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerDoctorCommands, registerTeamCommands } from "./team-commands.js";

const baseCompany = {
  version: 1,
  departments: [
    { id: "dept-ceo", name: "CEO Office", description: "", goal: "" },
    { id: "dept-products", name: "Product Studio", description: "", goal: "" },
  ],
  projects: [],
  agents: [{ agentId: "main", role: "ceo", heartbeatProfileId: "hb-ceo", isCeo: true, lifecycleState: "active" }],
  roleSlots: [],
  heartbeatProfiles: [
    { id: "hb-ceo", role: "ceo", cadenceMinutes: 15, teamDescription: "", productDetails: "", goal: "" },
    { id: "hb-builder", role: "builder", cadenceMinutes: 10, teamDescription: "", productDetails: "", goal: "" },
    { id: "hb-growth", role: "growth_marketer", cadenceMinutes: 20, teamDescription: "", productDetails: "", goal: "" },
    { id: "hb-pm", role: "pm", cadenceMinutes: 10, teamDescription: "", productDetails: "", goal: "" },
  ],
  tasks: [],
  channelBindings: [],
  federationPolicies: [],
  providerIndexProfiles: [],
};

type CompanySnapshot = {
  projects: Array<{ id: string; status: string; kpis: string[] }>;
  roleSlots: Array<{ projectId: string; desiredCount: number }>;
  heartbeatProfiles: Array<{ id: string; goal: string }>;
  agents: Array<{ projectId?: string; heartbeatProfileId: string }>;
};

async function setupStateDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "shellcorp-cli-test-"));
  await writeFile(path.join(dir, "company.json"), `${JSON.stringify(baseCompany, null, 2)}\n`, "utf-8");
  await writeFile(path.join(dir, "office-objects.json"), "[]\n", "utf-8");
  return dir;
}

async function runCommand(args: string[]): Promise<void> {
  const program = new Command();
  registerTeamCommands(program);
  registerDoctorCommands(program);
  await program.parseAsync(args, { from: "user" });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.OPENCLAW_STATE_DIR;
  process.exitCode = undefined;
});

describe("team CLI", () => {
  it("creates, updates, and archives a team", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Alpha",
      "--description",
      "Core team",
      "--goal",
      "Ship fast",
      "--kpi",
      "weekly_shipped_tickets",
      "--auto-roles",
      "builder,pm",
    ]);
    await runCommand([
      "team",
      "update",
      "--team-id",
      "team-proj-alpha",
      "--kpi-add",
      "weekly_shipped_tickets",
      "--kpi-add",
      "closed_vs_open_ticket_ratio",
      "--kpi-remove",
      "weekly_shipped_tickets",
    ]);
    await runCommand(["team", "archive", "--team-id", "team-proj-alpha"]);

    const finalRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const finalModel = JSON.parse(finalRaw) as CompanySnapshot;
    const project = finalModel.projects.find((entry) => entry.id === "proj-alpha");
    expect(project).toBeTruthy();
    expect(project?.status).toBe("archived");
    expect(project?.kpis).toEqual(["weekly_shipped_tickets", "closed_vs_open_ticket_ratio"]);
    expect(finalModel.roleSlots.filter((entry) => entry.projectId === "proj-alpha").every((entry) => entry.desiredCount === 0)).toBe(
      true,
    );
  });

  it("sets team heartbeat profile and remaps agents", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Beta",
      "--description",
      "Operations",
      "--goal",
      "Run ops",
      "--auto-roles",
      "builder",
    ]);

    await runCommand([
      "team",
      "heartbeat",
      "set",
      "--team-id",
      "team-proj-beta",
      "--cadence-minutes",
      "15",
      "--goal",
      "Reduce backlog",
      "--team-description",
      "Ops team",
    ]);

    const finalRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const finalModel = JSON.parse(finalRaw) as CompanySnapshot;
    const heartbeat = finalModel.heartbeatProfiles.find((entry) => entry.id === "hb-team-proj-beta");
    expect(heartbeat).toBeTruthy();
    expect(heartbeat?.goal).toBe("Reduce backlog");
    expect(finalModel.agents.some((entry) => entry.projectId === "proj-beta" && entry.heartbeatProfileId === "hb-team-proj-beta")).toBe(
      true,
    );
  });

  it("doctor reports broken references", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const broken = {
      ...baseCompany,
      agents: [
        ...baseCompany.agents,
        { agentId: "broken-agent", role: "pm", projectId: "proj-missing", heartbeatProfileId: "hb-missing", lifecycleState: "active" },
      ],
    };
    await writeFile(path.join(stateDir, "company.json"), `${JSON.stringify(broken, null, 2)}\n`, "utf-8");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runCommand(["doctor", "team-data"]);
    expect(errorSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});

