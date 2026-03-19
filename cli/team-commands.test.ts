import { access, chmod, mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerAgentCommands } from "./agent-commands.js";
import { registerDoctorCommands, registerTeamCommands } from "./team-commands/index.js";

const baseCompany = {
  version: 1,
  departments: [
    { id: "dept-ceo", name: "CEO Office", description: "", goal: "" },
    { id: "dept-products", name: "Product Studio", description: "", goal: "" },
  ],
  projects: [],
  agents: [
    {
      agentId: "main",
      role: "ceo",
      heartbeatProfileId: "hb-ceo",
      isCeo: true,
      lifecycleState: "active",
    },
  ],
  roleSlots: [],
  heartbeatProfiles: [
    {
      id: "hb-ceo",
      role: "ceo",
      cadenceMinutes: 15,
      teamDescription: "",
      productDetails: "",
      goal: "",
    },
    {
      id: "hb-builder",
      role: "builder",
      cadenceMinutes: 10,
      teamDescription: "",
      productDetails: "",
      goal: "",
    },
    {
      id: "hb-growth",
      role: "growth_marketer",
      cadenceMinutes: 20,
      teamDescription: "",
      productDetails: "",
      goal: "",
    },
    {
      id: "hb-pm",
      role: "pm",
      cadenceMinutes: 10,
      teamDescription: "",
      productDetails: "",
      goal: "",
    },
  ],
  tasks: [],
  channelBindings: [],
  federationPolicies: [],
  providerIndexProfiles: [],
};

type CompanySnapshot = {
  projects: Array<{
    id: string;
    name?: string;
    goal?: string;
    status: string;
    kpis: string[];
    businessConfig?: {
      type: string;
      slots: {
        measure: { skillId: string; category: string; config: Record<string, string> };
        execute: { skillId: string; category: string; config: Record<string, string> };
        distribute: { skillId: string; category: string; config: Record<string, string> };
      };
    };
    trackingContext?: string;
    account?: {
      id: string;
      projectId: string;
      currency: string;
      balanceCents: number;
      updatedAt: string;
    };
    accountEvents?: Array<{
      id: string;
      projectId: string;
      accountId: string;
      timestamp: string;
      type: "credit" | "debit";
      amountCents: number;
      source: string;
      note?: string;
      balanceAfterCents: number;
    }>;
    ledger?: unknown[];
    experiments?: unknown[];
    metricEvents?: unknown[];
    resources?: Array<{
      id: string;
      type: string;
      remaining: number;
      limit: number;
      reserved?: number;
    }>;
    resourceEvents?: Array<{
      id?: string;
      projectId?: string;
      resourceId: string;
      ts?: string;
      kind: string;
      delta?: number;
      remainingAfter: number;
      source?: string;
    }>;
  }>;
  roleSlots: Array<{ projectId: string; desiredCount: number; role?: string }>;
  heartbeatProfiles: Array<{
    id: string;
    goal: string;
    cadenceMinutes?: number;
    teamDescription?: string;
  }>;
  agents: Array<{
    agentId?: string;
    projectId?: string;
    heartbeatProfileId: string;
    role?: string;
  }>;
};

type MockBoardTask = {
  taskId: string;
  projectId: string;
  title: string;
  status: string;
  ownerAgentId?: string;
  priority: string;
  notes?: string;
  taskType?: string;
  approvalState?: string;
  linkedSessionKey?: string;
  createdTeamId?: string;
  createdProjectId?: string;
  createdAt: number;
  updatedAt: number;
};

async function setupStateDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "shellcorp-cli-test-"));
  await writeFile(
    path.join(dir, "company.json"),
    `${JSON.stringify(baseCompany, null, 2)}\n`,
    "utf-8",
  );
  await writeFile(path.join(dir, "office-objects.json"), "[]\n", "utf-8");
  await writeFile(
    path.join(dir, "openclaw.json"),
    `${JSON.stringify(
      {
        version: 1,
        agents: {
          list: [
            {
              id: "main",
              name: "Main",
              workspace: path.join(dir, "workspace"),
              agentDir: path.join(dir, "agents", "main", "agent"),
            },
          ],
        },
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  return dir;
}

async function runCommand(args: string[]): Promise<void> {
  const program = new Command();
  registerTeamCommands(program);
  registerAgentCommands(program);
  registerDoctorCommands(program);
  await program.parseAsync(args, { from: "user" });
}

async function readOpenclawAgentIds(stateDir: string): Promise<string[]> {
  const raw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
  const config = JSON.parse(raw) as {
    agents?: { list?: Array<{ id?: string }> };
  };
  return (config.agents?.list ?? []).map((entry) => entry.id ?? "").filter(Boolean);
}

async function readOfficeObjects(stateDir: string): Promise<
  Array<{
    id: string;
    meshType: string;
    position: [number, number, number];
    metadata?: Record<string, unknown>;
  }>
> {
  const raw = await readFile(path.join(stateDir, "office-objects.json"), "utf-8");
  return JSON.parse(raw) as Array<{
    id: string;
    meshType: string;
    position: [number, number, number];
    metadata?: Record<string, unknown>;
  }>;
}

function installBoardMock(): Map<string, MockBoardTask[]> {
  const boardTasks = new Map<string, MockBoardTask[]>();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const payload = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.endsWith("/board/command")) {
      const now = Date.now();
      if (payload.command === "task_add") {
        const rows = boardTasks.get(payload.projectId) ?? [];
        rows.push({
          taskId: payload.taskId,
          projectId: payload.projectId,
          title: payload.title,
          status: payload.status ?? "todo",
          ownerAgentId: payload.ownerAgentId,
          priority: payload.priority ?? "medium",
          notes: payload.notes ?? payload.detail,
          taskType: payload.taskType,
          approvalState: payload.approvalState,
          linkedSessionKey: payload.linkedSessionKey,
          createdTeamId: payload.createdTeamId,
          createdProjectId: payload.createdProjectId,
          createdAt: now,
          updatedAt: now,
        });
        boardTasks.set(payload.projectId, rows);
        return new Response(JSON.stringify({ ok: true, taskId: payload.taskId }), { status: 200 });
      }
      if (payload.command === "task_update") {
        const rows = boardTasks.get(payload.projectId) ?? [];
        const current = rows.find((row) => row.taskId === payload.taskId);
        if (!current) {
          return new Response(JSON.stringify({ ok: false, error: "task_not_found" }), {
            status: 404,
          });
        }
        if (typeof payload.title === "string") current.title = payload.title;
        if (typeof payload.status === "string") current.status = payload.status;
        if (typeof payload.notes === "string") current.notes = payload.notes;
        if (typeof payload.detail === "string") current.notes = payload.detail;
        if (typeof payload.approvalState === "string") current.approvalState = payload.approvalState;
        if (typeof payload.createdTeamId === "string") current.createdTeamId = payload.createdTeamId;
        if (typeof payload.createdProjectId === "string") current.createdProjectId = payload.createdProjectId;
        current.updatedAt = now;
        return new Response(JSON.stringify({ ok: true, taskId: payload.taskId }), { status: 200 });
      }
      if (payload.command === "task_move") {
        const rows = boardTasks.get(payload.projectId) ?? [];
        const current = rows.find((row) => row.taskId === payload.taskId);
        if (!current) {
          return new Response(JSON.stringify({ ok: false, error: "task_not_found" }), {
            status: 404,
          });
        }
        if (typeof payload.status === "string") current.status = payload.status;
        current.updatedAt = now;
        return new Response(JSON.stringify({ ok: true, taskId: payload.taskId }), { status: 200 });
      }
      if (payload.command === "task_assign") {
        const rows = boardTasks.get(payload.projectId) ?? [];
        const current = rows.find((row) => row.taskId === payload.taskId);
        if (!current) {
          return new Response(JSON.stringify({ ok: false, error: "task_not_found" }), {
            status: 404,
          });
        }
        if (typeof payload.ownerAgentId === "string") current.ownerAgentId = payload.ownerAgentId;
        current.updatedAt = now;
        return new Response(JSON.stringify({ ok: true, taskId: payload.taskId }), { status: 200 });
      }
    }
    if (url.endsWith("/board/query")) {
      const rows = boardTasks.get(payload.projectId) ?? [];
      return new Response(JSON.stringify({ ok: true, data: { tasks: rows } }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: false, error: "unknown_endpoint" }), {
      status: 404,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return boardTasks;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.OPENCLAW_STATE_DIR;
  delete process.env.SHELLCORP_CONVEX_SITE_URL;
  delete process.env.CONVEX_SITE_URL;
  delete process.env.SHELLCORP_ACTOR_ROLE;
  delete process.env.SHELLCORP_ALLOWED_PERMISSIONS;
  delete process.env.SHELLCORP_BOARD_OPERATOR_TOKEN;
  delete process.env.SHELLCORP_AGENT_ID;
  delete process.env.SHELLCORP_TEAM_ID;
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
    const afterCreateAgentIds = await readOpenclawAgentIds(stateDir);
    expect(afterCreateAgentIds).toContain("alpha-builder");
    expect(afterCreateAgentIds).toContain("alpha-pm");
    await access(path.join(stateDir, "workspace-alpha-builder", "AGENTS.md"));
    await access(path.join(stateDir, "workspace-alpha-builder", "SOUL.md"));
    await access(path.join(stateDir, "workspace-alpha-builder", "HEARTBEAT.md"));
    await access(path.join(stateDir, "agents", "alpha-builder", "sessions"));
    await access(path.join(stateDir, "workspace-alpha-pm", "AGENTS.md"));
    await access(path.join(stateDir, "workspace-alpha-pm", "SOUL.md"));
    await access(path.join(stateDir, "workspace-alpha-pm", "HEARTBEAT.md"));
    await access(path.join(stateDir, "agents", "alpha-pm", "sessions"));
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
    expect(
      finalModel.roleSlots
        .filter((entry) => entry.projectId === "proj-alpha")
        .every((entry) => entry.desiredCount === 0),
    ).toBe(true);
  });

  it("previews the ShellCorp dev preset without mutating state", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(["team", "preset", "dev", "--json"]);

    expect(logSpy).toHaveBeenCalled();
    const previewPayload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      mode?: string;
      presetId?: string;
      teamId?: string;
      marketerMode?: string;
      rolePlan?: { persistent?: string[]; elastic?: string[] };
      skillPlan?: Array<{ role?: string; targetSkills?: string[] }>;
    };
    expect(previewPayload.mode).toBe("preview");
    expect(previewPayload.presetId).toBe("shellcorp_dev_team");
    expect(previewPayload.teamId).toBe("team-proj-shellcorp-dev-team");
    expect(previewPayload.marketerMode).toBe("elastic");
    expect(previewPayload.rolePlan?.persistent).toEqual(["pm", "builder"]);
    expect(previewPayload.rolePlan?.elastic).toEqual(["growth_marketer"]);
    expect(
      previewPayload.skillPlan?.find((entry) => entry.role === "pm")?.targetSkills ?? [],
    ).toContain("shellcorp-competitor-feature-scout");

    const companyRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const company = JSON.parse(companyRaw) as CompanySnapshot;
    expect(company.projects).toHaveLength(0);
    expect(company.roleSlots).toHaveLength(0);
    const openclawAgentIds = await readOpenclawAgentIds(stateDir);
    expect(openclawAgentIds).toEqual(["main"]);
    logSpy.mockRestore();
  });

  it("applies the ShellCorp dev preset with PM/Dev core and previewable skills", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    await runCommand(["team", "preset", "dev", "--apply", "--with-cluster", "--json"]);

    const companyRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const company = JSON.parse(companyRaw) as CompanySnapshot & {
      heartbeatProfiles: Array<{
        id: string;
        goal: string;
        cadenceMinutes?: number;
        teamDescription?: string;
      }>;
    };
    const project = company.projects.find((entry) => entry.id === "proj-shellcorp-dev-team");
    expect(project?.name).toBe("ShellCorp Dev Team");
    expect(project?.goal).toContain("Continuously improve ShellCorp");
    expect(project?.kpis).toEqual([
      "feature-throughput",
      "review-throughput",
      "demo-readiness",
    ]);

    const roleSlots = company.roleSlots.filter((entry) => entry.projectId === "proj-shellcorp-dev-team");
    expect(roleSlots.find((entry) => entry.role === "pm")?.desiredCount).toBe(1);
    expect(roleSlots.find((entry) => entry.role === "builder")?.desiredCount).toBe(1);
    expect(roleSlots.find((entry) => entry.role === "growth_marketer")?.desiredCount).toBe(0);

    const teamAgents = company.agents.filter((entry) => entry.projectId === "proj-shellcorp-dev-team");
    expect(teamAgents.map((entry) => entry.role)).toEqual(["pm", "builder"]);
    expect(teamAgents.every((entry) => entry.heartbeatProfileId === "hb-team-proj-shellcorp-dev-team")).toBe(
      true,
    );
    const heartbeatProfile = company.heartbeatProfiles.find(
      (entry) => entry.id === "hb-team-proj-shellcorp-dev-team",
    );
    expect(heartbeatProfile?.cadenceMinutes).toBe(3);
    expect(heartbeatProfile?.teamDescription).toContain("Internal product team");

    const openclawRaw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
    const openclawConfig = JSON.parse(openclawRaw) as {
      agents?: {
        list?: Array<{ id?: string; skills?: string[]; heartbeat?: { every?: string } }>;
      };
    };
    const pmEntry = (openclawConfig.agents?.list ?? []).find(
      (entry) => entry.id === "shellcorp-dev-team-pm",
    );
    const builderEntry = (openclawConfig.agents?.list ?? []).find(
      (entry) => entry.id === "shellcorp-dev-team-builder",
    );
    expect(pmEntry?.skills).toContain("shellcorp-competitor-feature-scout");
    expect(pmEntry?.skills).toContain("create-team");
    expect(builderEntry?.skills).toEqual([
      "shellcorp-team-cli",
      "shellcorp-kanban-ops",
      "status-self-reporter",
    ]);
    expect(pmEntry?.heartbeat?.every).toBe("3m");
    expect(builderEntry?.heartbeat?.every).toBe("3m");

    await access(
      path.join(
        stateDir,
        "workspace-shellcorp-dev-team-pm",
        "skills",
        "shellcorp-competitor-feature-scout",
        "SKILL.md",
      ),
    );
    await access(
      path.join(
        stateDir,
        "workspace-shellcorp-dev-team-builder",
        "skills",
        "shellcorp-team-cli",
        "SKILL.md",
      ),
    );
    await access(path.join(stateDir, "workspace-shellcorp-dev-team-pm", "PRESET.md"));
    await access(path.join(stateDir, "workspace-shellcorp-dev-team-builder", "PRESET.md"));

    const officeObjects = await readOfficeObjects(stateDir);
    expect(
      officeObjects.some(
        (entry) =>
          entry.meshType === "team-cluster" && entry.metadata?.teamId === "team-proj-shellcorp-dev-team",
      ),
    ).toBe(true);
  });

  it("reapplies the ShellCorp dev preset additively without deleting extra agents", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand(["team", "preset", "dev", "--apply", "--json"]);

    const companyRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const company = JSON.parse(companyRaw) as CompanySnapshot;
    company.agents.push({
      agentId: "shellcorp-dev-team-extra",
      projectId: "proj-shellcorp-dev-team",
      heartbeatProfileId: "hb-pm",
      role: "builder",
    });
    await writeFile(path.join(stateDir, "company.json"), `${JSON.stringify(company, null, 2)}\n`, "utf-8");

    await runCommand([
      "team",
      "preset",
      "dev",
      "--team-id",
      "team-proj-shellcorp-dev-team",
      "--apply",
      "--json",
    ]);

    const refreshedRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const refreshed = JSON.parse(refreshedRaw) as CompanySnapshot;
    expect(
      refreshed.agents.some((entry) => entry.agentId === "shellcorp-dev-team-extra"),
    ).toBe(true);
  });

  it("shows team config and manages file-backed resources markdown", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_CONVEX_SITE_URL = "https://shellcorp.example";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        if (String(_input).endsWith("/board/query") && body.query === "timeline") {
          return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
        }
        throw new Error(`unexpected_fetch:${String(_input)}`);
      }),
    );

    await runCommand([
      "team",
      "create",
      "--name",
      "Config Team",
      "--description",
      "Config demo",
      "--goal",
      "Keep config simple",
      "--auto-roles",
      "pm,builder",
    ]);
    await runCommand([
      "team",
      "config",
      "resources",
      "init",
      "--team-id",
      "team-proj-config-team",
      "--json",
    ]);
    await runCommand([
      "team",
      "config",
      "resources",
      "set",
      "--team-id",
      "team-proj-config-team",
      "--text",
      "# Resources\n\ncash_budget_usd: 250\nnotes: operator editable\n",
      "--json",
    ]);
    await runCommand([
      "team",
      "config",
      "show",
      "--team-id",
      "team-proj-config-team",
      "--json",
    ]);

    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      team?: { name?: string };
      agents?: Array<{ agentId?: string }>;
      resourcesMarkdown?: { exists?: boolean; text?: string; path?: string };
      cronJobs?: unknown[];
    };
    expect(payload.team?.name).toBe("Config Team");
    expect(payload.agents?.map((entry) => entry.agentId)).toEqual([
      "config-team-pm",
      "config-team-builder",
    ]);
    expect(payload.resourcesMarkdown?.exists).toBe(true);
    expect(payload.resourcesMarkdown?.text).toContain("cash_budget_usd: 250");
    await access(payload.resourcesMarkdown?.path ?? "");
    expect(Array.isArray(payload.cronJobs)).toBe(true);
    logSpy.mockRestore();
  });

  it("updates agent config for skills and dedicated heartbeat profile", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Agent Team",
      "--description",
      "Agent config demo",
      "--goal",
      "Tune one agent",
      "--auto-roles",
      "pm,builder",
    ]);

    await runCommand([
      "agent",
      "config",
      "set-skills",
      "--agent-id",
      "agent-team-builder",
      "--skills",
      "shellcorp-team-cli,status-self-reporter",
      "--sync-workspace",
      "--json",
    ]);
    await runCommand([
      "agent",
      "config",
      "set-heartbeat",
      "--agent-id",
      "agent-team-builder",
      "--cadence-minutes",
      "2",
      "--goal",
      "Test builder loop",
      "--json",
    ]);

    const openclawRaw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
    const openclawConfig = JSON.parse(openclawRaw) as {
      agents?: { list?: Array<{ id?: string; skills?: string[] }> };
    };
    const builderEntry = (openclawConfig.agents?.list ?? []).find(
      (entry) => entry.id === "agent-team-builder",
    );
    expect(builderEntry?.skills).toEqual(["shellcorp-team-cli", "status-self-reporter"]);
    await access(
      path.join(
        stateDir,
        "workspace-agent-team-builder",
        "skills",
        "shellcorp-team-cli",
        "SKILL.md",
      ),
    );

    const companyRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const company = JSON.parse(companyRaw) as CompanySnapshot;
    const builderAgent = company.agents.find((entry) => entry.agentId === "agent-team-builder");
    expect(builderAgent?.heartbeatProfileId).toBe("hb-agent-agent-team-builder");
    const profile = company.heartbeatProfiles.find(
      (entry) => entry.id === "hb-agent-agent-team-builder",
    );
    expect(profile?.goal).toBe("Test builder loop");
    expect(profile?.cadenceMinutes).toBe(2);
  });

  it("enables test mode through the simplified team run surface", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Run Team",
      "--description",
      "Run config demo",
      "--goal",
      "Observe heartbeat quickly",
      "--auto-roles",
      "pm,builder",
    ]);
    await runCommand([
      "team",
      "run",
      "test-mode",
      "--team-id",
      "team-proj-run-team",
      "--cadence-minutes",
      "1",
      "--goal",
      "Fast demo loop",
      "--json",
    ]);

    const companyRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const company = JSON.parse(companyRaw) as CompanySnapshot;
    const heartbeat = company.heartbeatProfiles.find((entry) => entry.id === "hb-team-proj-run-team");
    expect(heartbeat?.cadenceMinutes).toBe(1);
    expect(heartbeat?.goal).toBe("Fast demo loop");
    expect(
      company.agents
        .filter((entry) => entry.projectId === "proj-run-team")
        .every((entry) => entry.heartbeatProfileId === "hb-team-proj-run-team"),
    ).toBe(true);
  });

  it("enables live mode through the simplified team run surface and syncs openclaw heartbeat cadence", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_CONVEX_SITE_URL = "https://shellcorp.example";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        if (String(_input).endsWith("/board/query") && body.query === "timeline") {
          return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
        }
        throw new Error(`unexpected_fetch:${String(_input)}`);
      }),
    );
    await runCommand([
      "team",
      "create",
      "--name",
      "Live Team",
      "--description",
      "Live config demo",
      "--goal",
      "Exercise the real heartbeat loop",
      "--auto-roles",
      "pm,builder",
    ]);
    await runCommand([
      "team",
      "run",
      "live",
      "--team-id",
      "team-proj-live-team",
      "--cadence-minutes",
      "1",
      "--goal",
      "Live demo loop",
      "--json",
    ]);

    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      heartbeatProfileId?: string;
      updatedOpenclawAgents?: number;
      runtime?: {
        openclawConfigPath?: string;
        agentWorkspaces?: Array<{ agentId?: string; openclawHeartbeatEvery?: string; heartbeatFilePath?: string }>;
      };
    };
    expect(payload.heartbeatProfileId).toBe("hb-team-proj-live-team");
    expect(payload.updatedOpenclawAgents).toBe(2);
    expect(payload.runtime?.openclawConfigPath).toBe(path.join(stateDir, "openclaw.json"));
    expect(
      payload.runtime?.agentWorkspaces?.every((entry) => entry.openclawHeartbeatEvery === "1m"),
    ).toBe(true);
    await access(payload.runtime?.agentWorkspaces?.[0]?.heartbeatFilePath ?? "");

    const companyRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const company = JSON.parse(companyRaw) as CompanySnapshot;
    const heartbeat = company.heartbeatProfiles.find((entry) => entry.id === "hb-team-proj-live-team");
    expect(heartbeat?.cadenceMinutes).toBe(1);
    expect(heartbeat?.goal).toBe("Live demo loop");

    const openclawRaw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
    const openclawConfig = JSON.parse(openclawRaw) as {
      agents?: { list?: Array<{ id?: string; heartbeat?: { every?: string } }> };
    };
    const liveEntries = (openclawConfig.agents?.list ?? []).filter((entry) =>
      entry.id === "live-team-pm" || entry.id === "live-team-builder",
    );
    expect(liveEntries).toHaveLength(2);
    expect(liveEntries.every((entry) => entry.heartbeat?.every === "1m")).toBe(true);
    logSpy.mockRestore();
  });

  it("includes runtime inspection paths in team monitor output", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_CONVEX_SITE_URL = "https://shellcorp.example";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        if (String(_input).endsWith("/board/query") && body.query === "timeline") {
          return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
        }
        throw new Error(`unexpected_fetch:${String(_input)}`);
      }),
    );
    await runCommand([
      "team",
      "create",
      "--name",
      "Monitor Team",
      "--description",
      "Monitor config demo",
      "--goal",
      "Inspect runtime files",
      "--auto-roles",
      "pm,builder",
    ]);
    await runCommand([
      "team",
      "monitor",
      "--team-id",
      "team-proj-monitor-team",
      "--json",
    ]);

    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      runtime?: {
        stateRoot?: string;
        openclawConfigPath?: string;
        logsDir?: string;
        outputsDir?: string;
        agentWorkspaces?: Array<{
          agentId?: string;
          workspacePath?: string;
          heartbeatFilePath?: string;
          openclawAgentFound?: boolean;
        }>;
      };
    };
    expect(payload.runtime?.stateRoot).toBe(stateDir);
    expect(payload.runtime?.openclawConfigPath).toBe(path.join(stateDir, "openclaw.json"));
    expect(payload.runtime?.logsDir).toBe(path.join(stateDir, "projects", "proj-monitor-team", "logs"));
    expect(payload.runtime?.outputsDir).toBe(
      path.join(stateDir, "projects", "proj-monitor-team", "outputs"),
    );
    expect(payload.runtime?.agentWorkspaces).toHaveLength(2);
    expect(payload.runtime?.agentWorkspaces?.every((entry) => entry.openclawAgentFound)).toBe(true);
    await access(payload.runtime?.agentWorkspaces?.[0]?.heartbeatFilePath ?? "");
    logSpy.mockRestore();
  });

  it("surfaces task and status activity through the Convex timeline exposed by monitor", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    process.env.SHELLCORP_CONVEX_SITE_URL = "https://shellcorp.example";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        if (String(_input).endsWith("/board/command")) {
          if (body.command === "task_add") {
            return new Response(JSON.stringify({ ok: true, taskId: "task-1" }), { status: 200 });
          }
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        if (String(_input).endsWith("/board/query")) {
          return new Response(
            JSON.stringify({
              ok: true,
              data: [
                {
                  sourceType: "board_event",
                  eventType: "task_created",
                  label: "Draft log UI",
                  detail: undefined,
                  taskId: "task-1",
                  actorAgentId: "main",
                  occurredAt: Date.now() - 1000,
                  projectId: "proj-event-team",
                  teamId: "team-proj-event-team",
                },
                {
                  sourceType: "agent_event",
                  eventType: "status_report",
                  label: "planning",
                  detail: "Reviewing task stream",
                  agentId: "event-team-builder",
                  occurredAt: Date.now(),
                  projectId: "proj-event-team",
                  teamId: "team-proj-event-team",
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (String(_input).endsWith("/status/report")) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        throw new Error(`unexpected_fetch:${String(_input)}`);
      }),
    );
    await runCommand([
      "team",
      "create",
      "--name",
      "Event Team",
      "--description",
      "Event logging demo",
      "--goal",
      "Track tasks and status",
      "--auto-roles",
      "builder",
    ]);
    await runCommand([
      "team",
      "board",
      "task",
      "add",
      "--team-id",
      "team-proj-event-team",
      "--title",
      "Draft log UI",
      "--actor-agent-id",
      "main",
    ]);
    await runCommand([
      "team",
      "status",
      "report",
      "--team-id",
      "team-proj-event-team",
      "--agent-id",
      "event-team-builder",
      "--state",
      "planning",
      "--status-text",
      "Reviewing task stream",
    ]);
    await runCommand([
      "team",
      "monitor",
      "--team-id",
      "team-proj-event-team",
      "--json",
    ]);

    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      runtime?: { recentEvents?: Array<{ kind?: string; label?: string; detail?: string }> };
    };
    expect(payload.runtime?.recentEvents?.some((entry) => entry.kind === "task_added")).toBe(true);
    expect(payload.runtime?.recentEvents?.some((entry) => entry.kind === "status_reported")).toBe(true);
    logSpy.mockRestore();
  });

  it("reads recent team monitor activity from Convex timeline rows only", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_CONVEX_SITE_URL = "https://shellcorp.example";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand([
      "team",
      "create",
      "--name",
      "Timeline Team",
      "--description",
      "Convex timeline demo",
      "--goal",
      "Prefer Convex recent events",
      "--auto-roles",
      "builder",
    ]);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        if (String(_input).endsWith("/board/query") && body.query === "timeline") {
          return new Response(
            JSON.stringify({
              ok: true,
              data: [
                {
                  sourceType: "agent_event",
                  eventType: "status_report",
                  label: "planning",
                  detail: "convex-recent-event",
                  agentId: "timeline-team-builder",
                  occurredAt: Date.now(),
                  projectId: "proj-timeline-team",
                  teamId: "team-proj-timeline-team",
                },
              ],
            }),
            { status: 200 },
          );
        }
        throw new Error(`unexpected_fetch:${String(_input)}`);
      }),
    );

    await runCommand([
      "team",
      "monitor",
      "--team-id",
      "team-proj-timeline-team",
      "--json",
    ]);

    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      runtime?: { recentEvents?: Array<{ kind?: string; detail?: string; label?: string }> };
    };
    expect(payload.runtime?.recentEvents?.[0]?.detail).toBe("convex-recent-event");
    logSpy.mockRestore();
  });

  it("resolves preset skill sources when the CLI runs from the cli workspace", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const originalCwd = process.cwd();
    process.chdir(path.join(originalCwd, "cli"));
    try {
      await runCommand(["team", "preset", "dev", "--apply", "--json"]);
    } finally {
      process.chdir(originalCwd);
    }

    const openclawRaw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
    const openclaw = JSON.parse(openclawRaw) as {
      agents?: { list?: Array<{ id?: string; workspace?: string }> };
    };
    const pmWorkspace =
      openclaw.agents?.list?.find((entry) => entry.id === "shellcorp-dev-team-pm")?.workspace ?? "";
    await access(path.join(pmWorkspace, "skills", "shellcorp-team-cli", "SKILL.md"));
    await access(path.join(pmWorkspace, "skills", "status-self-reporter", "SKILL.md"));
  });

  it("removes archived team clusters from office sidecar state", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await writeFile(
      path.join(stateDir, "office-objects.json"),
      `${JSON.stringify(
        [
          {
            id: "team-cluster-team-proj-alpha",
            identifier: "team-cluster-team-proj-alpha",
            meshType: "team-cluster",
            position: [0, 0, 8],
            rotation: [0, 0, 0],
            metadata: { teamId: "team-proj-alpha", name: "Alpha" },
          },
          {
            id: "cluster-team-proj-alpha",
            identifier: "cluster-team-proj-alpha",
            meshType: "team-cluster",
            position: [1, 0, 8],
            rotation: [0, 0, 0],
            metadata: { teamId: "team-proj-alpha" },
          },
          {
            id: "team-cluster-team-proj-beta",
            identifier: "team-cluster-team-proj-beta",
            meshType: "team-cluster",
            position: [2, 0, 8],
            rotation: [0, 0, 0],
            metadata: { teamId: "team-proj-beta", name: "Beta" },
          },
        ],
        null,
        2,
      )}\n`,
      "utf-8",
    );
    await runCommand([
      "team",
      "create",
      "--name",
      "Alpha",
      "--description",
      "Core team",
      "--goal",
      "Ship fast",
    ]);
    await runCommand([
      "team",
      "create",
      "--name",
      "Beta",
      "--description",
      "Second team",
      "--goal",
      "Stay active",
    ]);

    await runCommand(["team", "archive", "--team-id", "team-proj-alpha"]);

    const officeObjects = await readOfficeObjects(stateDir);
    expect(officeObjects.map((entry) => entry.id)).toEqual(["team-cluster-team-proj-beta"]);
  });

  it("supports explicit team show and KPI set/clear commands", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Omega",
      "--description",
      "Ops mission control",
      "--goal",
      "Stabilize automation",
    ]);
    await runCommand(["team", "show", "--team-id", "team-proj-omega", "--json"]);
    await runCommand([
      "team",
      "kpi",
      "set",
      "--team-id",
      "team-proj-omega",
      "--kpi",
      "conversion_rate",
      "--kpi",
      "net_profit",
    ]);
    await runCommand(["team", "kpi", "clear", "--team-id", "team-proj-omega"]);
    const finalRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const finalModel = JSON.parse(finalRaw) as CompanySnapshot;
    const project = finalModel.projects.find((entry) => entry.id === "proj-omega");
    expect(project?.kpis ?? []).toEqual([]);
  });

  it("auto-places new team clusters into distinct open slots", async () => {
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
      "--with-cluster",
    ]);
    await runCommand([
      "team",
      "create",
      "--name",
      "Beta",
      "--description",
      "Second team",
      "--goal",
      "Avoid overlap",
      "--with-cluster",
    ]);

    const teamClusters = (await readOfficeObjects(stateDir)).filter(
      (entry) => entry.meshType === "team-cluster",
    );
    expect(teamClusters).toHaveLength(2);
    expect(teamClusters[0]?.position).toEqual([0, 0, 0]);
    expect(teamClusters[1]?.position).toEqual([-5, 0, -5]);
  });

  it("stores task memory directly on board tasks and supports the review lane", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_CONVEX_SITE_URL = "http://127.0.0.1:3211";
    const boardTasks = installBoardMock();

    await runCommand([
      "team",
      "create",
      "--name",
      "Alpha",
      "--description",
      "Core team",
      "--goal",
      "Ship fast",
    ]);

    await runCommand([
      "team",
      "board",
      "task",
      "add",
      "--team-id",
      "team-proj-alpha",
      "--task-id",
      "task-plan",
      "--title",
      "Plan the first sprint",
    ]);

    await runCommand([
      "team",
      "board",
      "task",
      "memory",
      "set",
      "--team-id",
      "team-proj-alpha",
      "--task-id",
      "task-plan",
      "--text",
      "# Goal\nShip the first sprint plan",
    ]);

    await runCommand([
      "team",
      "board",
      "task",
      "memory",
      "append",
      "--team-id",
      "team-proj-alpha",
      "--task-id",
      "task-plan",
      "--text",
      "## Next Step\nMove this ticket into review for founder sign-off.",
    ]);

    await runCommand([
      "team",
      "board",
      "task",
      "move",
      "--team-id",
      "team-proj-alpha",
      "--task-id",
      "task-plan",
      "--status",
      "review",
    ]);

    const task = boardTasks.get("proj-alpha")?.find((entry) => entry.taskId === "task-plan");
    expect(task?.status).toBe("review");
    expect(task?.notes).toContain("# Goal");
    expect(task?.notes).toContain("## Next Step");
  });

  it("claims tasks for an agent and supports agent-scoped board views", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_CONVEX_SITE_URL = "http://127.0.0.1:3211";
    const boardTasks = installBoardMock();

    await runCommand([
      "team",
      "create",
      "--name",
      "Alpha",
      "--description",
      "Core team",
      "--goal",
      "Ship fast",
      "--auto-roles",
      "builder,pm",
    ]);

    await runCommand([
      "team",
      "board",
      "task",
      "add",
      "--team-id",
      "team-proj-alpha",
      "--task-id",
      "task-1",
      "--title",
      "Take the first ticket",
    ]);
    await runCommand([
      "team",
      "board",
      "task",
      "add",
      "--team-id",
      "team-proj-alpha",
      "--task-id",
      "task-2",
      "--title",
      "Other builder work",
      "--owner-agent-id",
      "other-builder",
    ]);
    await runCommand([
      "team",
      "board",
      "task",
      "claim",
      "--team-id",
      "team-proj-alpha",
      "--task-id",
      "task-1",
      "--agent-id",
      "alpha-builder",
      "--note",
      "Starting implementation after reading ticket memory.",
    ]);

    const task = boardTasks.get("proj-alpha")?.find((entry) => entry.taskId === "task-1");
    expect(task?.ownerAgentId).toBe("alpha-builder");
    expect(task?.status).toBe("in_progress");
    expect(task?.notes).toContain("Claimed by alpha-builder");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await runCommand([
      "team",
      "board",
      "task",
      "mine",
      "--team-id",
      "team-proj-alpha",
      "--agent-id",
      "alpha-builder",
      "--json",
    ]);
    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      tasks?: Array<{ taskId?: string }>;
    };
    expect(payload.tasks?.map((entry) => entry.taskId)).toEqual(["task-1"]);
  });

  it("removes the proposal command family from the CLI", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    await expect(runCommand(["team", "proposal", "list"])).rejects.toThrow(
      /process\.exit unexpectedly called with "1"/,
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
    const heartbeat = finalModel.heartbeatProfiles.find(
      (entry) => entry.id === "hb-team-proj-beta",
    );
    expect(heartbeat).toBeTruthy();
    expect(heartbeat?.goal).toBe("Reduce backlog");
    expect(
      finalModel.agents.some(
        (entry) =>
          entry.projectId === "proj-beta" && entry.heartbeatProfileId === "hb-team-proj-beta",
      ),
    ).toBe(true);
  });

  it("doctor reports broken references", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const broken = {
      ...baseCompany,
      agents: [
        ...baseCompany.agents,
        {
          agentId: "broken-agent",
          role: "pm",
          projectId: "proj-missing",
          heartbeatProfileId: "hb-missing",
          lifecycleState: "active",
        },
      ],
    };
    await writeFile(
      path.join(stateDir, "company.json"),
      `${JSON.stringify(broken, null, 2)}\n`,
      "utf-8",
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runCommand(["doctor", "team-data"]);
    expect(errorSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("doctor reports broken resource references", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "BrokenResource",
      "--description",
      "Broken resource team",
      "--goal",
      "Detect resource issues",
      "--business-type",
      "affiliate_marketing",
    ]);
    const raw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const model = JSON.parse(raw) as CompanySnapshot;
    const project = model.projects.find((entry) => entry.id === "proj-brokenresource");
    expect(project).toBeTruthy();
    project!.resourceEvents = [
      ...(project?.resourceEvents ?? []),
      {
        id: "bad-resource-event",
        projectId: "proj-brokenresource",
        resourceId: "proj-brokenresource:missing",
        ts: new Date().toISOString(),
        kind: "adjustment",
        delta: -10,
        remainingAfter: 0,
        source: "test",
      },
    ];
    await writeFile(
      path.join(stateDir, "company.json"),
      `${JSON.stringify(model, null, 2)}\n`,
      "utf-8",
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runCommand(["doctor", "team-data"]);
    expect(errorSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("creates business team and updates capability slot", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Affiliate",
      "--description",
      "Affiliate team",
      "--goal",
      "Reach $100 MRR",
      "--business-type",
      "affiliate_marketing",
    ]);
    await runCommand([
      "team",
      "business",
      "set",
      "--team-id",
      "team-proj-affiliate",
      "--slot",
      "measure",
      "--skill-id",
      "stripe-revenue",
      "--config-json",
      '{"apiKey":"sk_test"}',
    ]);
    await runCommand([
      "team",
      "business",
      "set-all",
      "--team-id",
      "team-proj-affiliate",
      "--business-type",
      "affiliate_marketing",
      "--measure-skill-id",
      "measure-v2",
      "--execute-skill-id",
      "execute-v2",
      "--distribute-skill-id",
      "distribute-v2",
    ]);

    const finalRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const finalModel = JSON.parse(finalRaw) as CompanySnapshot;
    const project = finalModel.projects.find((entry) => entry.id === "proj-affiliate");
    expect(project?.businessConfig?.type).toBe("affiliate_marketing");
    expect(project?.businessConfig?.slots.measure.skillId).toBe("measure-v2");
    expect(project?.businessConfig?.slots.execute.skillId).toBe("execute-v2");
    expect(project?.businessConfig?.slots.distribute.skillId).toBe("distribute-v2");
    expect(project?.ledger ?? []).toEqual([]);
    expect(project?.experiments ?? []).toEqual([]);
    expect(project?.metricEvents ?? []).toEqual([]);
    expect((project?.resources ?? []).length).toBeGreaterThan(0);
    expect(project?.resourceEvents ?? []).toEqual([]);
    const businessRoles = finalModel.roleSlots
      .filter((entry) => entry.projectId === "proj-affiliate")
      .map((entry) => entry.role);
    expect(businessRoles).toContain("biz_pm");
    expect(businessRoles).toContain("biz_executor");
    const businessAgentRoles = finalModel.agents
      .filter((entry) => entry.projectId === "proj-affiliate")
      .map((entry) => entry.role);
    expect(businessAgentRoles).toContain("biz_pm");
    expect(businessAgentRoles).toContain("biz_executor");
    const openclawAgentIds = await readOpenclawAgentIds(stateDir);
    expect(openclawAgentIds).toContain("affiliate-pm");
    expect(openclawAgentIds).toContain("affiliate-executor");

    const pmHeartbeat = await readFile(
      path.join(stateDir, "workspace-affiliate-pm", "HEARTBEAT.md"),
      "utf-8",
    );
    const executorHeartbeat = await readFile(
      path.join(stateDir, "workspace-affiliate-executor", "HEARTBEAT.md"),
      "utf-8",
    );
    expect(pmHeartbeat).toContain("You are the PM");
    expect(executorHeartbeat).toContain("You are the Executor");
    await access(path.join(stateDir, "workspace-affiliate-pm", "AGENTS.md"));
    await access(path.join(stateDir, "workspace-affiliate-pm", "SOUL.md"));
    await access(path.join(stateDir, "workspace-affiliate-executor", "AGENTS.md"));
    await access(path.join(stateDir, "workspace-affiliate-executor", "SOUL.md"));
    await access(path.join(stateDir, "agents", "affiliate-pm", "sessions"));
    await access(path.join(stateDir, "agents", "affiliate-executor", "sessions"));

    const cronRaw = await readFile(path.join(stateDir, "cron", "jobs.json"), "utf-8");
    const cronJobs = JSON.parse(cronRaw) as Array<{ id: string; agentId?: string }>;
    expect(
      cronJobs.some(
        (job) => job.id === "biz-heartbeat-proj-affiliate-pm" && job.agentId === "affiliate-pm",
      ),
    ).toBe(true);
    expect(
      cronJobs.some(
        (job) =>
          job.id === "biz-heartbeat-proj-affiliate-executor" &&
          job.agentId === "affiliate-executor",
      ),
    ).toBe(true);

    await runCommand([
      "team",
      "resources",
      "set",
      "--team-id",
      "team-proj-affiliate",
      "--type",
      "cash_budget",
      "--remaining",
      "4200",
      "--limit",
      "5000",
      "--source",
      "test",
    ]);
    await runCommand([
      "team",
      "resources",
      "refresh",
      "--team-id",
      "team-proj-affiliate",
      "--resource-id",
      "proj-affiliate:cash",
      "--remaining",
      "4100",
      "--source",
      "test-refresh",
    ]);
    await runCommand([
      "team",
      "resources",
      "reserve",
      "--team-id",
      "team-proj-affiliate",
      "--resource-id",
      "proj-affiliate:cash",
      "--amount",
      "300",
      "--source",
      "test-reserve",
    ]);
    await runCommand([
      "team",
      "resources",
      "release",
      "--team-id",
      "team-proj-affiliate",
      "--resource-id",
      "proj-affiliate:cash",
      "--amount",
      "100",
      "--source",
      "test-release",
    ]);

    const refreshedRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const refreshedModel = JSON.parse(refreshedRaw) as CompanySnapshot;
    const refreshedProject = refreshedModel.projects.find((entry) => entry.id === "proj-affiliate");
    const cashResource = (refreshedProject?.resources ?? []).find(
      (entry) => entry.id === "proj-affiliate:cash",
    );
    expect(cashResource?.remaining).toBe(4100);
    expect(cashResource?.reserved).toBe(200);
    expect(
      (refreshedProject?.resourceEvents ?? []).some(
        (entry) => entry.resourceId === "proj-affiliate:cash" && entry.kind === "refresh",
      ),
    ).toBe(true);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await runCommand(["team", "business", "get", "--team-id", "team-proj-affiliate", "--json"]);
    expect(logSpy).toHaveBeenCalled();
    await runCommand([
      "team",
      "business",
      "context",
      "set",
      "--team-id",
      "team-proj-affiliate",
      "--text",
      "We track CAC and conversion from short-form distribution.",
      "--json",
    ]);
    expect(logSpy).toHaveBeenCalled();
    await runCommand([
      "team",
      "business",
      "context",
      "get",
      "--team-id",
      "team-proj-affiliate",
      "--json",
    ]);
    expect(logSpy).toHaveBeenCalled();
    await runCommand(["team", "resources", "list", "--team-id", "team-proj-affiliate", "--json"]);
    expect(logSpy).toHaveBeenCalled();
    await runCommand([
      "team",
      "resources",
      "events",
      "--team-id",
      "team-proj-affiliate",
      "--limit",
      "3",
      "--json",
    ]);
    expect(logSpy).toHaveBeenCalled();
    await runCommand([
      "team",
      "heartbeat",
      "render",
      "--team-id",
      "team-proj-affiliate",
      "--role",
      "biz_pm",
      "--json",
    ]);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();

    await runCommand([
      "team",
      "resources",
      "remove",
      "--team-id",
      "team-proj-affiliate",
      "--resource-id",
      "proj-affiliate:distribution",
      "--source",
      "test-remove",
    ]);
    const removedRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const removedModel = JSON.parse(removedRaw) as CompanySnapshot;
    const removedProject = removedModel.projects.find((entry) => entry.id === "proj-affiliate");
    expect(
      (removedProject?.resources ?? []).some((entry) => entry.id === "proj-affiliate:distribution"),
    ).toBe(false);
    expect(removedProject?.trackingContext).toContain("CAC");
  });

  it("equips business skills into PM/executor agent config with replace_minimum mode", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Buffalos AI",
      "--description",
      "Affiliate demo team",
      "--goal",
      "Run affiliate loop",
      "--business-type",
      "affiliate_marketing",
    ]);
    await runCommand([
      "team",
      "business",
      "set-all",
      "--team-id",
      "team-proj-buffalos-ai",
      "--business-type",
      "affiliate_marketing",
      "--measure-skill-id",
      "amazon-affiliate-metrics",
      "--execute-skill-id",
      "video-generator",
      "--distribute-skill-id",
      "tiktok-poster",
    ]);
    await runCommand([
      "team",
      "business",
      "equip-skills",
      "--team-id",
      "team-proj-buffalos-ai",
      "--mode",
      "replace_minimum",
      "--json",
    ]);
    const openclawRaw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
    const openclawConfig = JSON.parse(openclawRaw) as {
      agents?: { list?: Array<{ id?: string; skills?: string[] }> };
    };
    const pm = (openclawConfig.agents?.list ?? []).find((entry) => entry.id === "buffalos-ai-pm");
    const executor = (openclawConfig.agents?.list ?? []).find(
      (entry) => entry.id === "buffalos-ai-executor",
    );
    expect(pm?.skills ?? []).toEqual(
      expect.arrayContaining([
        "amazon-affiliate-metrics",
        "video-generator",
        "tiktok-poster",
        "shellcorp-team-cli",
        "status-self-reporter",
        "shellcorp-kanban-ops",
      ]),
    );
    expect(executor?.skills ?? []).toEqual(
      expect.arrayContaining([
        "amazon-affiliate-metrics",
        "video-generator",
        "tiktok-poster",
        "shellcorp-team-cli",
      ]),
    );
  });

  it("supports dry-run and append_only equip mode without mutating unrelated skills", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Delta",
      "--description",
      "Affiliate demo team",
      "--goal",
      "Run affiliate loop",
      "--business-type",
      "affiliate_marketing",
    ]);
    const beforeRaw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
    const beforeConfig = JSON.parse(beforeRaw) as {
      version: number;
      agents?: {
        list?: Array<{ id?: string; skills?: string[]; workspace?: string; agentDir?: string }>;
      };
    };
    const nextList = (beforeConfig.agents?.list ?? []).map((entry) =>
      entry.id === "delta-executor" ? { ...entry, skills: ["custom-existing-skill"] } : entry,
    );
    await writeFile(
      path.join(stateDir, "openclaw.json"),
      `${JSON.stringify({ ...beforeConfig, agents: { ...(beforeConfig.agents ?? {}), list: nextList } }, null, 2)}\n`,
      "utf-8",
    );
    await runCommand([
      "team",
      "business",
      "equip-skills",
      "--team-id",
      "team-proj-delta",
      "--mode",
      "append_only",
      "--dry-run",
      "--json",
    ]);
    const afterDryRunRaw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
    const afterDryRunConfig = JSON.parse(afterDryRunRaw) as {
      agents?: { list?: Array<{ id?: string; skills?: string[] }> };
    };
    const afterDryRunExecutor = (afterDryRunConfig.agents?.list ?? []).find(
      (entry) => entry.id === "delta-executor",
    );
    expect(afterDryRunExecutor?.skills ?? []).toEqual(["custom-existing-skill"]);

    await runCommand([
      "team",
      "business",
      "equip-skills",
      "--team-id",
      "team-proj-delta",
      "--mode",
      "append_only",
      "--json",
    ]);
    const afterApplyRaw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
    const afterApplyConfig = JSON.parse(afterApplyRaw) as {
      agents?: { list?: Array<{ id?: string; skills?: string[] }> };
    };
    const afterApplyExecutor = (afterApplyConfig.agents?.list ?? []).find(
      (entry) => entry.id === "delta-executor",
    );
    expect(afterApplyExecutor?.skills ?? []).toEqual(
      expect.arrayContaining([
        "custom-existing-skill",
        "amazon-affiliate-metrics",
        "video-generator",
        "tiktok-poster",
      ]),
    );
  });

  it("syncs business skills into PM/executor workspace skills folders", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Buffalos AI",
      "--description",
      "Affiliate demo team",
      "--goal",
      "Run affiliate loop",
      "--business-type",
      "affiliate_marketing",
    ]);
    await runCommand([
      "team",
      "business",
      "set-all",
      "--team-id",
      "team-proj-buffalos-ai",
      "--business-type",
      "affiliate_marketing",
      "--measure-skill-id",
      "amazon-affiliate-metrics",
      "--execute-skill-id",
      "video-generator",
      "--distribute-skill-id",
      "tiktok-poster",
    ]);
    await runCommand([
      "team",
      "business",
      "sync-workspace-skills",
      "--team-id",
      "team-proj-buffalos-ai",
      "--json",
    ]);
    await access(
      path.join(
        stateDir,
        "workspace-buffalos-ai-pm",
        "skills",
        "amazon-affiliate-metrics",
        "SKILL.md",
      ),
    );
    await access(
      path.join(stateDir, "workspace-buffalos-ai-pm", "skills", "video-generator", "SKILL.md"),
    );
    await access(
      path.join(stateDir, "workspace-buffalos-ai-executor", "skills", "tiktok-poster", "SKILL.md"),
    );
    await access(path.join(process.cwd(), "skills", "execute", "video-generator", "SKILL.md"));
  });

  it("generates two lamp video artifacts in project-scoped workspace paths", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Buffalos AI",
      "--description",
      "Affiliate demo team",
      "--goal",
      "Run affiliate loop",
      "--business-type",
      "affiliate_marketing",
    ]);
    await runCommand([
      "team",
      "business",
      "generate-lamp-videos",
      "--team-id",
      "team-proj-buffalos-ai",
      "--count",
      "2",
      "--simulate",
      "--json",
    ]);
    const artefactDir = path.join(
      stateDir,
      "workspace-buffalos-ai-executor",
      "projects",
      "proj-buffalos-ai",
      "affiliate",
      "videos",
    );
    const names = await readdir(artefactDir);
    expect(names.filter((name) => name.endsWith(".mp4"))).toHaveLength(2);
    const companyRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const company = JSON.parse(companyRaw) as CompanySnapshot;
    const project = company.projects.find((entry) => entry.id === "proj-buffalos-ai");
    expect(project).toBeTruthy();
    expect(
      (project?.ledger ?? []).filter(
        (entry) => (entry as { source?: string }).source === "inference_sh",
      ).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      (project?.accountEvents ?? []).some(
        (entry) => entry.source === "inference_sh" && entry.type === "debit",
      ),
    ).toBe(true);
  });

  it("does not duplicate existing openclaw agent entries when IDs already exist", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const existingConfig = {
      version: 1,
      agents: {
        list: [
          {
            id: "main",
            workspace: path.join(stateDir, "workspace"),
            agentDir: path.join(stateDir, "agents", "main", "agent"),
          },
          {
            id: "affiliate-pm",
            workspace: path.join(stateDir, "workspace-affiliate-pm"),
            agentDir: path.join(stateDir, "agents", "affiliate-pm", "agent"),
          },
        ],
      },
    };
    await writeFile(
      path.join(stateDir, "openclaw.json"),
      `${JSON.stringify(existingConfig, null, 2)}\n`,
      "utf-8",
    );
    await runCommand([
      "team",
      "create",
      "--name",
      "Affiliate",
      "--description",
      "Affiliate team",
      "--goal",
      "Reach $100 MRR",
      "--business-type",
      "affiliate_marketing",
    ]);
    const ids = await readOpenclawAgentIds(stateDir);
    expect(ids.filter((id) => id === "affiliate-pm")).toHaveLength(1);
    expect(ids).toContain("affiliate-executor");
  });

  it("archives team and optionally deregisters openclaw agents", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Gamma",
      "--description",
      "Gamma team",
      "--goal",
      "Ship fast",
      "--auto-roles",
      "builder,pm",
    ]);
    let ids = await readOpenclawAgentIds(stateDir);
    expect(ids).toContain("gamma-builder");
    expect(ids).toContain("gamma-pm");
    await access(path.join(stateDir, "workspace-gamma-builder", "AGENTS.md"));
    await access(path.join(stateDir, "workspace-gamma-pm", "AGENTS.md"));
    await runCommand(["team", "archive", "--team-id", "team-proj-gamma", "--deregister-openclaw"]);
    ids = await readOpenclawAgentIds(stateDir);
    expect(ids).not.toContain("gamma-builder");
    expect(ids).not.toContain("gamma-pm");
    expect(ids).toContain("main");
    await expect(access(path.join(stateDir, "workspace-gamma-builder"))).rejects.toThrow();
    await expect(access(path.join(stateDir, "workspace-gamma-pm"))).rejects.toThrow();
  });

  it("removes configured workspace paths for archived agents during deregistration", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Delta",
      "--description",
      "Delta team",
      "--goal",
      "Ship fast",
      "--auto-roles",
      "builder",
    ]);

    const customWorkspacePath = path.join(stateDir, "workspace", "products", "delta-builder");
    await mkdir(customWorkspacePath, { recursive: true });
    await writeFile(path.join(customWorkspacePath, "AGENTS.md"), "# AGENTS\n", "utf-8");

    const openclawRaw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
    const openclawConfig = JSON.parse(openclawRaw) as {
      agents?: { list?: Array<{ id?: string; workspace?: string }> };
    };
    const nextList = (openclawConfig.agents?.list ?? []).map((entry) =>
      entry.id === "delta-builder" ? { ...entry, workspace: customWorkspacePath } : entry,
    );
    await writeFile(
      path.join(stateDir, "openclaw.json"),
      `${JSON.stringify({ ...openclawConfig, agents: { ...openclawConfig.agents, list: nextList } }, null, 2)}\n`,
      "utf-8",
    );

    await runCommand(["team", "archive", "--team-id", "team-proj-delta", "--deregister-openclaw"]);

    await expect(access(customWorkspacePath)).rejects.toThrow();
    await access(path.join(stateDir, "workspace-delta-builder"));
    await access(path.join(stateDir, "workspace"));
  });

  it("executes board and bot commands through Convex HTTP endpoints", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_CONVEX_SITE_URL = "https://example.convex.site";

    await runCommand([
      "team",
      "create",
      "--name",
      "Delta",
      "--description",
      "Delta team",
      "--goal",
      "Ship pipeline",
      "--business-type",
      "affiliate_marketing",
    ]);

    const commandPayloads: Array<Record<string, unknown>> = [];
    const queryPayloads: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const payload = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      if (url.endsWith("/board/command")) {
        commandPayloads.push(payload);
        if (payload.command === "task_add") {
          return new Response(JSON.stringify({ ok: true, duplicate: false, taskId: "task-1" }), {
            status: 200,
          });
        }
        return new Response(
          JSON.stringify({ ok: true, duplicate: false, taskId: payload.taskId ?? "task-1" }),
          { status: 200 },
        );
      }
      if (url.endsWith("/board/query")) {
        queryPayloads.push(payload);
        if (payload.query === "tasks") {
          return new Response(
            JSON.stringify({
              ok: true,
              data: {
                tasks: [
                  {
                    taskId: "task-1",
                    title: "Draft content",
                    status: "todo",
                    priority: "high",
                    ownerAgentId: "delta-executor",
                  },
                ],
              },
            }),
            { status: 200 },
          );
        }
        if (payload.query === "activity") {
          return new Response(
            JSON.stringify({
              ok: true,
              data: [
                {
                  agentId: "delta-executor",
                  activityType: "executing",
                  label: "Working task-1",
                  occurredAt: Date.now(),
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            ok: true,
            data: [
              {
                taskId: "task-1",
                title: "Draft content",
                status: "todo",
                priority: "high",
                ownerAgentId: "delta-executor",
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ ok: false, error: "unknown_endpoint" }), {
        status: 404,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await runCommand([
      "team",
      "board",
      "task",
      "add",
      "--team-id",
      "team-proj-delta",
      "--title",
      "Draft content",
      "--priority",
      "high",
      "--owner-agent-id",
      "delta-executor",
      "--linked-session-key",
      "agent:main:main",
      "--beat-id",
      "beat-delta-1",
    ]);
    await runCommand([
      "team",
      "board",
      "task",
      "update",
      "--team-id",
      "team-proj-delta",
      "--task-id",
      "task-1",
      "--title",
      "Draft launch copy",
      "--detail",
      "Updated via cli",
      "--created-team-id",
      "team-proj-delta-launch",
      "--created-project-id",
      "proj-delta-launch",
    ]);
    await runCommand(["team", "board", "task", "list", "--team-id", "team-proj-delta", "--json"]);
    await runCommand([
      "team",
      "bot",
      "log",
      "--team-id",
      "team-proj-delta",
      "--agent-id",
      "delta-executor",
      "--activity-type",
      "executing",
      "--label",
      "Working task-1",
      "--task-id",
      "task-1",
      "--beat-id",
      "beat-delta-1",
    ]);
    await runCommand([
      "team",
      "funds",
      "deposit",
      "--team-id",
      "team-proj-delta",
      "--amount",
      "500",
      "--source",
      "test-seed",
      "--beat-id",
      "beat-delta-1",
    ]);
    await runCommand([
      "team",
      "funds",
      "spend",
      "--team-id",
      "team-proj-delta",
      "--amount",
      "120",
      "--source",
      "test-api",
      "--beat-id",
      "beat-delta-1",
    ]);
    await runCommand(["team", "bot", "timeline", "--team-id", "team-proj-delta", "--json"]);
    await runCommand(["team", "bot", "next", "--team-id", "team-proj-delta", "--json"]);
    await runCommand([
      "team",
      "board",
      "task",
      "delete",
      "--team-id",
      "team-proj-delta",
      "--task-id",
      "task-1",
    ]);

    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/board/command"))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/board/query"))).toBe(true);
    expect(commandPayloads.some((payload) => payload.teamId === "team-proj-delta")).toBe(true);
    expect(commandPayloads.some((payload) => payload.beatId === "beat-delta-1")).toBe(true);
    expect(commandPayloads.some((payload) => payload.linkedSessionKey === "agent:main:main")).toBe(
      true,
    );
    expect(
      commandPayloads.some((payload) => payload.createdTeamId === "team-proj-delta-launch"),
    ).toBe(true);
    expect(
      commandPayloads.some(
        (payload) => payload.command === "activity_log" && payload.beatId === "beat-delta-1",
      ),
    ).toBe(true);
    expect(queryPayloads.some((payload) => payload.teamId === "team-proj-delta")).toBe(true);
  });

  it("resolves Convex site URL from persisted shellcorp sidecar config", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    delete process.env.SHELLCORP_CONVEX_SITE_URL;
    delete process.env.CONVEX_SITE_URL;

    await runCommand([
      "team",
      "create",
      "--name",
      "PersistedUrl",
      "--description",
      "Persisted URL team",
      "--goal",
      "Use saved convex url",
      "--auto-roles",
      "builder",
    ]);

    await writeFile(
      path.join(stateDir, "shellcorp.json"),
      `${JSON.stringify(
        {
          convex: { siteUrl: "https://persisted.convex.site" },
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const payload = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      if (url === "https://persisted.convex.site/board/query" && payload.query === "tasks") {
        return new Response(JSON.stringify({ ok: true, data: { tasks: [] } }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: false, error: "unknown_endpoint" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await runCommand(["team", "board", "task", "list", "--team-id", "team-proj-persistedurl", "--json"]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://persisted.convex.site/board/query",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("validates Convex site URL before board calls", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_CONVEX_SITE_URL = "127.0.0.1:3211";

    await runCommand([
      "team",
      "create",
      "--name",
      "InvalidUrl",
      "--description",
      "Invalid URL team",
      "--goal",
      "Test URL validation",
      "--business-type",
      "affiliate_marketing",
    ]);

    await expect(
      runCommand(["team", "board", "task", "list", "--team-id", "team-proj-invalidurl"]),
    ).rejects.toThrow("invalid_convex_site_url:127.0.0.1:3211");
  });

  it("reports actionable board query network errors", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_CONVEX_SITE_URL = "http://127.0.0.1:3211";

    await runCommand([
      "team",
      "create",
      "--name",
      "NetworkError",
      "--description",
      "Network team",
      "--goal",
      "Test fetch diagnostics",
      "--business-type",
      "affiliate_marketing",
    ]);

    const fetchMock = vi.fn(async () => {
      throw Object.assign(new Error("connect failed"), { cause: { code: "ECONNREFUSED" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runCommand(["team", "board", "task", "list", "--team-id", "team-proj-networkerror"]),
    ).rejects.toThrow(
      "board_query_request_failed:connection_refused:url=http://127.0.0.1:3211/board/query",
    );
  });

  it("reports explicit status via /status/report endpoint", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_CONVEX_SITE_URL = "https://example.convex.site";

    await runCommand([
      "team",
      "create",
      "--name",
      "StatusTeam",
      "--description",
      "Status team",
      "--goal",
      "Track progress",
      "--business-type",
      "affiliate_marketing",
    ]);

    const statusPayloads: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const payload = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      if (url.endsWith("/status/report")) {
        statusPayloads.push(payload);
        return new Response(JSON.stringify({ ok: true, duplicate: false }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: false, error: "unknown_endpoint" }), {
        status: 404,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await runCommand([
      "team",
      "status",
      "report",
      "--team-id",
      "team-proj-statusteam",
      "--agent-id",
      "status-executor",
      "--state",
      "executing",
      "--status-text",
      "Generating video variant",
      "--step-key",
      "step-123",
      "--skill-id",
      "video-generator",
      "--beat-id",
      "beat-status-1",
    ]);

    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/status/report"))).toBe(true);
    expect(statusPayloads).toHaveLength(1);
    expect(statusPayloads[0]).toMatchObject({
      teamId: "team-proj-statusteam",
      agentId: "status-executor",
      state: "executing",
      statusText: "Generating video variant",
      stepKey: "step-123",
      skillId: "video-generator",
      beatId: "beat-status-1",
    });
  });

  it("supports top-level status shortcut and routes via board activity_log", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_CONVEX_SITE_URL = "https://example.convex.site";
    process.env.SHELLCORP_AGENT_ID = "shortcut-executor";
    process.env.SHELLCORP_TEAM_ID = "team-proj-shortcut";

    await runCommand([
      "team",
      "create",
      "--name",
      "Shortcut",
      "--description",
      "Shortcut team",
      "--goal",
      "Track status",
      "--business-type",
      "affiliate_marketing",
    ]);

    const commandPayloads: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const payload = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      if (url.endsWith("/board/command")) {
        commandPayloads.push(payload);
        return new Response(
          JSON.stringify({ ok: true, duplicate: false, taskId: payload.taskId ?? "task-1" }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ ok: false, error: "unknown_endpoint" }), {
        status: 404,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await runCommand(["status", "--state", "planning", "Planning shortcut turn"]);

    expect(fetchMock).toHaveBeenCalled();
    expect(commandPayloads).toHaveLength(1);
    expect(commandPayloads[0]).toMatchObject({
      teamId: "team-proj-shortcut",
      command: "activity_log",
      actorAgentId: "shortcut-executor",
      activityType: "planning",
      label: "planning",
      detail: "Planning shortcut turn",
    });
  });

  it("lists and searches agents across team/runtime context", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand([
      "team",
      "create",
      "--name",
      "Alpha",
      "--description",
      "Alpha team",
      "--goal",
      "Ship fast",
      "--auto-roles",
      "builder,pm",
    ]);

    await runCommand(["agent", "list", "--team-id", "team-proj-alpha", "--json"]);
    const listPayload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      agents?: Array<{ agentId?: string; teamId?: string; openclawFound?: boolean }>;
    };
    expect(listPayload.agents?.map((entry) => entry.agentId)).toEqual(["alpha-builder", "alpha-pm"]);
    expect(listPayload.agents?.every((entry) => entry.teamId === "team-proj-alpha")).toBe(true);
    expect(listPayload.agents?.every((entry) => entry.openclawFound)).toBe(true);

    await runCommand(["agent", "search", "--query", "builder", "--json"]);
    const searchPayload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      agents?: Array<{ agentId?: string }>;
    };
    expect(searchPayload.agents?.map((entry) => entry.agentId)).toContain("alpha-builder");

    logSpy.mockRestore();
  });

  it("prints shell exports for agent login and resolves whoami from session env", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand([
      "team",
      "create",
      "--name",
      "Alpha",
      "--description",
      "Alpha team",
      "--goal",
      "Ship fast",
      "--auto-roles",
      "builder,pm",
    ]);

    await runCommand(["agent", "login", "--agent-id", "alpha-pm"]);
    const loginOutput = String(logSpy.mock.calls.at(-1)?.[0] ?? "");
    expect(loginOutput).toContain('export SHELLCORP_AGENT_ID="alpha-pm"');
    expect(loginOutput).toContain('export SHELLCORP_TEAM_ID="team-proj-alpha"');
    expect(loginOutput).toContain('export SHELLCORP_PROJECT_ID="proj-alpha"');
    expect(loginOutput).toContain('export SHELLCORP_ACTOR_ROLE="pm"');

    process.env.SHELLCORP_AGENT_ID = "alpha-pm";
    process.env.SHELLCORP_TEAM_ID = "team-proj-alpha";
    process.env.SHELLCORP_PROJECT_ID = "proj-alpha";
    process.env.SHELLCORP_ACTOR_ROLE = "pm";

    await runCommand(["whoami", "--json"]);
    const whoamiPayload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      actor?: { agentId?: string; teamId?: string; projectId?: string; actorRole?: string };
    };
    expect(whoamiPayload.actor).toMatchObject({
      agentId: "alpha-pm",
      teamId: "team-proj-alpha",
      projectId: "proj-alpha",
      actorRole: "pm",
    });

    logSpy.mockRestore();
  });

  it("uses logged-in agent env to attribute top-level status without explicit flags", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_CONVEX_SITE_URL = "https://example.convex.site";

    await runCommand([
      "team",
      "create",
      "--name",
      "Alpha",
      "--description",
      "Alpha team",
      "--goal",
      "Ship fast",
      "--auto-roles",
      "builder,pm",
    ]);

    process.env.SHELLCORP_AGENT_ID = "alpha-pm";
    process.env.SHELLCORP_TEAM_ID = "team-proj-alpha";
    process.env.SHELLCORP_PROJECT_ID = "proj-alpha";
    process.env.SHELLCORP_ACTOR_ROLE = "pm";

    const commandPayloads: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const payload = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      if (url.endsWith("/board/command")) {
        commandPayloads.push(payload);
        return new Response(JSON.stringify({ ok: true, duplicate: false }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: false, error: "unknown_endpoint" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await runCommand(["status", "--state", "planning", "Triaging backlog"]);

    expect(commandPayloads).toHaveLength(1);
    expect(commandPayloads[0]).toMatchObject({
      teamId: "team-proj-alpha",
      projectId: "proj-alpha",
      actorAgentId: "alpha-pm",
      activityType: "planning",
      detail: "Triaging backlog",
    });
  });

  it("fails fast when logged-in team env conflicts with the agent record", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    await runCommand([
      "team",
      "create",
      "--name",
      "Alpha",
      "--description",
      "Alpha team",
      "--goal",
      "Ship fast",
      "--auto-roles",
      "builder,pm",
    ]);

    process.env.SHELLCORP_AGENT_ID = "alpha-pm";
    process.env.SHELLCORP_TEAM_ID = "team-proj-wrong";
    process.env.SHELLCORP_PROJECT_ID = "proj-alpha";
    process.env.SHELLCORP_ACTOR_ROLE = "pm";

    await expect(runCommand(["whoami", "--json"])).rejects.toThrow(
      "actor_team_conflict:alpha-pm:team-proj-alpha:team-proj-wrong",
    );
  });

  it("sends coordination through openclaw agent and logs a handoff activity", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_CONVEX_SITE_URL = "https://example.convex.site";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand([
      "team",
      "create",
      "--name",
      "Alpha",
      "--description",
      "Alpha team",
      "--goal",
      "Ship fast",
      "--auto-roles",
      "builder,pm",
    ]);

    const binDir = await mkdtemp(path.join(os.tmpdir(), "shellcorp-openclaw-bin-"));
    const argsFile = path.join(binDir, "openclaw-args.txt");
    const openclawPath = path.join(binDir, "openclaw");
    await writeFile(
      openclawPath,
      `#!/bin/sh\nprintf '%s\n' "$@" > "${argsFile}"\nprintf 'coordination reply\\n'\n`,
      "utf-8",
    );
    await chmod(openclawPath, 0o755);
    const originalPath = process.env.PATH ?? "";
    process.env.PATH = `${binDir}${path.delimiter}${originalPath}`;

    const commandPayloads: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const payload = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      if (url.endsWith("/board/command")) {
        commandPayloads.push(payload);
        return new Response(JSON.stringify({ ok: true, duplicate: false }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: false, error: "unknown_endpoint" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await runCommand([
      "agent",
      "send",
      "--from",
      "alpha-pm",
      "--to",
      "alpha-builder",
      "--task-id",
      "task-42",
      "--message",
      "Need blocker update",
      "--json",
    ]);

    const execArgs = (await readFile(argsFile, "utf-8"))
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean);
    expect(execArgs).toEqual(["agent", "--agent", "alpha-builder", "--message", "Need blocker update", "--json"]);
    expect(
      commandPayloads.some(
        (payload) =>
          payload.command === "activity_log" &&
          payload.teamId === "team-proj-alpha" &&
          payload.actorAgentId === "alpha-pm" &&
          payload.activityType === "handoff" &&
          payload.label === "Coordination to alpha-builder" &&
          payload.skillId === "agent_coordination" &&
          payload.detail === "Need blocker update (task task-42)",
      ),
    ).toBe(true);

    const sendPayload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      fromAgentId?: string;
      toAgentId?: string;
      teamId?: string;
      openclaw?: { parsed?: unknown };
    };
    expect(sendPayload.fromAgentId).toBe("alpha-pm");
    expect(sendPayload.toAgentId).toBe("alpha-builder");
    expect(sendPayload.teamId).toBe("team-proj-alpha");
    expect(sendPayload.openclaw?.parsed).toBe("coordination reply");

    process.env.PATH = originalPath;
    logSpy.mockRestore();
  });

  it("enforces permission denials for restricted actor roles", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_ACTOR_ROLE = "operator";
    process.env.SHELLCORP_ALLOWED_PERMISSIONS = "team.read";
    await expect(
      runCommand([
        "team",
        "create",
        "--name",
        "DeniedTeam",
        "--description",
        "Should fail",
        "--goal",
        "N/A",
      ]),
    ).rejects.toThrow("permission_denied:team.meta.write:role=operator");
  });

  it("requires board-write permission before task memory updates", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_CONVEX_SITE_URL = "http://127.0.0.1:3211";
    installBoardMock();

    await runCommand([
      "team",
      "create",
      "--name",
      "Alpha",
      "--description",
      "Core team",
      "--goal",
      "Ship fast",
    ]);

    await runCommand([
      "team",
      "board",
      "task",
      "add",
      "--team-id",
      "team-proj-alpha",
      "--task-id",
      "task-1",
      "--title",
      "Plan work",
    ]);

    process.env.SHELLCORP_ACTOR_ROLE = "operator";
    process.env.SHELLCORP_ALLOWED_PERMISSIONS = "team.read";

    await expect(
      runCommand([
        "team",
        "board",
        "task",
        "memory",
        "append",
        "--team-id",
        "team-proj-alpha",
        "--task-id",
        "task-1",
        "--text",
        "Need approval before execution.",
      ]),
    ).rejects.toThrow("permission_denied:team.board.write:role=operator");
  });

  it("supports team funds deposit, spend, ledger, and balance", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Funds",
      "--description",
      "Funds team",
      "--goal",
      "Stay solvent",
      "--business-type",
      "affiliate_marketing",
    ]);
    await runCommand([
      "team",
      "funds",
      "deposit",
      "--team-id",
      "team-proj-funds",
      "--amount",
      "50000",
      "--source",
      "seed_capital",
      "--note",
      "initial funding",
    ]);
    await runCommand([
      "team",
      "funds",
      "spend",
      "--team-id",
      "team-proj-funds",
      "--amount",
      "1200",
      "--source",
      "openai_api",
      "--note",
      "batch run",
    ]);
    await runCommand(["team", "funds", "balance", "--team-id", "team-proj-funds", "--json"]);
    await runCommand([
      "team",
      "funds",
      "ledger",
      "--team-id",
      "team-proj-funds",
      "--limit",
      "5",
      "--json",
    ]);

    const finalRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const finalModel = JSON.parse(finalRaw) as CompanySnapshot;
    const project = finalModel.projects.find((entry) => entry.id === "proj-funds");
    expect(project?.account?.balanceCents).toBe(48800);
    expect((project?.accountEvents ?? []).length).toBe(2);
    expect((project?.accountEvents ?? [])[0]?.type).toBe("credit");
    expect((project?.accountEvents ?? [])[1]?.type).toBe("debit");
    expect((project?.ledger ?? []).length).toBe(2);
  });
});
