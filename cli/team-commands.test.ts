import { access, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerDoctorCommands, registerTeamCommands } from "./team-commands/index.js";

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
  projects: Array<{
    id: string;
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
    account?: { id: string; projectId: string; currency: string; balanceCents: number; updatedAt: string };
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
    resources?: Array<{ id: string; type: string; remaining: number; limit: number; reserved?: number }>;
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
  heartbeatProfiles: Array<{ id: string; goal: string }>;
  agents: Array<{ agentId?: string; projectId?: string; heartbeatProfileId: string; role?: string }>;
  teamProposals?: Array<{
    id: string;
    approvalStatus: string;
    executionStatus: string;
    createdTeamId?: string;
    createdProjectId?: string;
  }>;
};

async function setupStateDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "shellcorp-cli-test-"));
  await writeFile(path.join(dir, "company.json"), `${JSON.stringify(baseCompany, null, 2)}\n`, "utf-8");
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
    expect(finalModel.roleSlots.filter((entry) => entry.projectId === "proj-alpha").every((entry) => entry.desiredCount === 0)).toBe(
      true,
    );
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

  it("persists and executes team proposals through the CLI", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    await runCommand([
      "team",
      "proposal",
      "create",
      "--json-input",
      JSON.stringify({
        businessType: "affiliate_marketing",
        requestedBy: "founder",
        sourceAgentId: "main",
        ideaBrief: {
          focus: "affiliate content engine",
          targetCustomer: "home office shoppers",
          primaryGoal: "ship weekly revenue-producing content",
          constraints: "keep spend low and use proven channels",
        },
      }),
    ]);

    const afterCreateRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const afterCreate = JSON.parse(afterCreateRaw) as CompanySnapshot;
    const proposalId = afterCreate.teamProposals?.[0]?.id;
    expect(proposalId).toBeTruthy();

    await runCommand(["team", "proposal", "approve", "--proposal-id", proposalId!, "--note", "looks good"]);
    await runCommand(["team", "proposal", "execute", "--proposal-id", proposalId!]);

    const finalRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const finalModel = JSON.parse(finalRaw) as CompanySnapshot;
    const executed = finalModel.teamProposals?.find((entry) => entry.id === proposalId);
    expect(executed?.approvalStatus).toBe("approved");
    expect(executed?.executionStatus).toBe("created");
    expect(executed?.createdTeamId).toBe("team-proj-affiliate-content-engine-team");
    expect(finalModel.projects.some((entry) => entry.id === "proj-affiliate-content-engine-team")).toBe(true);

    const teamClusters = (await readOfficeObjects(stateDir)).filter(
      (entry) => entry.meshType === "team-cluster",
    );
    expect(teamClusters).toHaveLength(1);
    expect(teamClusters[0]?.metadata?.teamId).toBe("team-proj-affiliate-content-engine-team");
    expect(teamClusters[0]?.position).toEqual([0, 0, 0]);
  });

  it("proposal execution uses the next open cluster slot when one is already occupied", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    await runCommand([
      "team",
      "create",
      "--name",
      "Anchor Team",
      "--description",
      "Existing cluster",
      "--goal",
      "Occupy the first slot",
      "--with-cluster",
    ]);

    await runCommand([
      "team",
      "proposal",
      "create",
      "--json-input",
      JSON.stringify({
        businessType: "affiliate_marketing",
        requestedBy: "founder",
        sourceAgentId: "main",
        ideaBrief: {
          focus: "affiliate content engine",
          targetCustomer: "home office shoppers",
          primaryGoal: "ship weekly revenue-producing content",
          constraints: "keep spend low and use proven channels",
        },
      }),
    ]);

    const afterCreateRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const afterCreate = JSON.parse(afterCreateRaw) as CompanySnapshot;
    const proposalId = afterCreate.teamProposals?.[0]?.id;
    expect(proposalId).toBeTruthy();

    await runCommand(["team", "proposal", "approve", "--proposal-id", proposalId!, "--note", "looks good"]);
    await runCommand(["team", "proposal", "execute", "--proposal-id", proposalId!]);

    const clusterByTeamId = new Map(
      (await readOfficeObjects(stateDir))
        .filter((entry) => entry.meshType === "team-cluster")
        .map((entry) => [String(entry.metadata?.teamId ?? ""), entry.position] as const),
    );
    expect(clusterByTeamId.get("team-proj-anchor-team")).toEqual([0, 0, 0]);
    expect(clusterByTeamId.get("team-proj-affiliate-content-engine-team")).toEqual([-5, 0, -5]);
  });

  it("blocks proposal execution until founder approval is recorded", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    await runCommand([
      "team",
      "proposal",
      "create",
      "--json-input",
      JSON.stringify({
        businessType: "affiliate_marketing",
        requestedBy: "founder",
        sourceAgentId: "main",
        ideaBrief: {
          focus: "affiliate content engine",
          targetCustomer: "home office shoppers",
          primaryGoal: "ship weekly revenue-producing content",
          constraints: "keep spend low and use proven channels",
        },
      }),
    ]);

    const afterCreateRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const afterCreate = JSON.parse(afterCreateRaw) as CompanySnapshot;
    const proposalId = afterCreate.teamProposals?.[0]?.id;
    expect(proposalId).toBeTruthy();

    await expect(
      runCommand(["team", "proposal", "execute", "--proposal-id", proposalId!]),
    ).rejects.toThrow("proposal_not_approved");
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
      ...(project!.resourceEvents ?? []),
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
    await writeFile(path.join(stateDir, "company.json"), `${JSON.stringify(model, null, 2)}\n`, "utf-8");
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
      "{\"apiKey\":\"sk_test\"}",
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
    const businessRoles = finalModel.roleSlots.filter((entry) => entry.projectId === "proj-affiliate").map((entry) => entry.role);
    expect(businessRoles).toContain("biz_pm");
    expect(businessRoles).toContain("biz_executor");
    const businessAgentRoles = finalModel.agents.filter((entry) => entry.projectId === "proj-affiliate").map((entry) => entry.role);
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
    expect(cronJobs.some((job) => job.id === "biz-heartbeat-proj-affiliate-pm" && job.agentId === "affiliate-pm")).toBe(true);
    expect(cronJobs.some((job) => job.id === "biz-heartbeat-proj-affiliate-executor" && job.agentId === "affiliate-executor")).toBe(true);

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
    const cashResource = (refreshedProject?.resources ?? []).find((entry) => entry.id === "proj-affiliate:cash");
    expect(cashResource?.remaining).toBe(4100);
    expect(cashResource?.reserved).toBe(200);
    expect((refreshedProject?.resourceEvents ?? []).some((entry) => entry.resourceId === "proj-affiliate:cash" && entry.kind === "refresh")).toBe(true);

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
    await runCommand(["team", "business", "context", "get", "--team-id", "team-proj-affiliate", "--json"]);
    expect(logSpy).toHaveBeenCalled();
    await runCommand(["team", "resources", "list", "--team-id", "team-proj-affiliate", "--json"]);
    expect(logSpy).toHaveBeenCalled();
    await runCommand(["team", "resources", "events", "--team-id", "team-proj-affiliate", "--limit", "3", "--json"]);
    expect(logSpy).toHaveBeenCalled();
    await runCommand(["team", "heartbeat", "render", "--team-id", "team-proj-affiliate", "--role", "biz_pm", "--json"]);
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
    expect((removedProject?.resources ?? []).some((entry) => entry.id === "proj-affiliate:distribution")).toBe(false);
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
    const executor = (openclawConfig.agents?.list ?? []).find((entry) => entry.id === "buffalos-ai-executor");
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
      expect.arrayContaining(["amazon-affiliate-metrics", "video-generator", "tiktok-poster", "shellcorp-team-cli"]),
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
      agents?: { list?: Array<{ id?: string; skills?: string[]; workspace?: string; agentDir?: string }> };
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
    const afterDryRunExecutor = (afterDryRunConfig.agents?.list ?? []).find((entry) => entry.id === "delta-executor");
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
    const afterApplyExecutor = (afterApplyConfig.agents?.list ?? []).find((entry) => entry.id === "delta-executor");
    expect(afterApplyExecutor?.skills ?? []).toEqual(
      expect.arrayContaining(["custom-existing-skill", "amazon-affiliate-metrics", "video-generator", "tiktok-poster"]),
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
    await runCommand(["team", "business", "sync-workspace-skills", "--team-id", "team-proj-buffalos-ai", "--json"]);
    await access(path.join(stateDir, "workspace-buffalos-ai-pm", "skills", "amazon-affiliate-metrics", "SKILL.md"));
    await access(path.join(stateDir, "workspace-buffalos-ai-pm", "skills", "video-generator", "SKILL.md"));
    await access(path.join(stateDir, "workspace-buffalos-ai-executor", "skills", "tiktok-poster", "SKILL.md"));
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
    const artefactDir = path.join(stateDir, "workspace-buffalos-ai-executor", "projects", "proj-buffalos-ai", "affiliate", "videos");
    const names = await readdir(artefactDir);
    expect(names.filter((name) => name.endsWith(".mp4"))).toHaveLength(2);
    const companyRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const company = JSON.parse(companyRaw) as CompanySnapshot;
    const project = company.projects.find((entry) => entry.id === "proj-buffalos-ai");
    expect(project).toBeTruthy();
    expect((project?.ledger ?? []).filter((entry) => (entry as { source?: string }).source === "inference_sh").length).toBeGreaterThanOrEqual(2);
    expect((project?.accountEvents ?? []).some((entry) => entry.source === "inference_sh" && entry.type === "debit")).toBe(true);
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
    await writeFile(path.join(stateDir, "openclaw.json"), `${JSON.stringify(existingConfig, null, 2)}\n`, "utf-8");
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
    await runCommand(["team", "archive", "--team-id", "team-proj-gamma", "--deregister-openclaw"]);
    ids = await readOpenclawAgentIds(stateDir);
    expect(ids).not.toContain("gamma-builder");
    expect(ids).not.toContain("gamma-pm");
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
          return new Response(JSON.stringify({ ok: true, duplicate: false, taskId: "task-1" }), { status: 200 });
        }
        return new Response(JSON.stringify({ ok: true, duplicate: false, taskId: payload.taskId ?? "task-1" }), { status: 200 });
      }
      if (url.endsWith("/board/query")) {
        queryPayloads.push(payload);
        if (payload.query === "tasks") {
          return new Response(
            JSON.stringify({
              ok: true,
              data: { tasks: [{ taskId: "task-1", title: "Draft content", status: "todo", priority: "high", ownerAgentId: "delta-executor" }] },
            }),
            { status: 200 },
          );
        }
        if (payload.query === "activity") {
          return new Response(
            JSON.stringify({
              ok: true,
              data: [{ agentId: "delta-executor", activityType: "executing", label: "Working task-1", occurredAt: Date.now() }],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            ok: true,
            data: [{ taskId: "task-1", title: "Draft content", status: "todo", priority: "high", ownerAgentId: "delta-executor" }],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ ok: false, error: "unknown_endpoint" }), { status: 404 });
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
      "--task-type",
      "team_proposal",
      "--approval-state",
      "pending_review",
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
      "--approval-state",
      "approved",
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
    expect(commandPayloads.some((payload) => payload.taskType === "team_proposal")).toBe(true);
    expect(commandPayloads.some((payload) => payload.approvalState === "approved")).toBe(true);
    expect(commandPayloads.some((payload) => payload.linkedSessionKey === "agent:main:main")).toBe(true);
    expect(commandPayloads.some((payload) => payload.createdTeamId === "team-proj-delta-launch")).toBe(true);
    expect(commandPayloads.some((payload) => payload.command === "activity_log" && payload.beatId === "beat-delta-1")).toBe(true);
    expect(queryPayloads.some((payload) => payload.teamId === "team-proj-delta")).toBe(true);
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

    await expect(runCommand(["team", "board", "task", "list", "--team-id", "team-proj-invalidurl"])).rejects.toThrow(
      "invalid_convex_site_url:127.0.0.1:3211",
    );
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

    await expect(runCommand(["team", "board", "task", "list", "--team-id", "team-proj-networkerror"])).rejects.toThrow(
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
      return new Response(JSON.stringify({ ok: false, error: "unknown_endpoint" }), { status: 404 });
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
        return new Response(JSON.stringify({ ok: true, duplicate: false, taskId: payload.taskId ?? "task-1" }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: false, error: "unknown_endpoint" }), { status: 404 });
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

  it("requires business and board permissions before executing a proposal", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    await runCommand([
      "team",
      "proposal",
      "create",
      "--json-input",
      JSON.stringify({
        businessType: "affiliate_marketing",
        requestedBy: "founder",
        sourceAgentId: "main",
        ideaBrief: {
          focus: "affiliate content engine",
          targetCustomer: "home office shoppers",
          primaryGoal: "ship weekly revenue-producing content",
          constraints: "keep spend low and use proven channels",
        },
      }),
    ]);

    const afterCreateRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const afterCreate = JSON.parse(afterCreateRaw) as CompanySnapshot;
    const proposalId = afterCreate.teamProposals?.[0]?.id;
    expect(proposalId).toBeTruthy();

    await runCommand(["team", "proposal", "approve", "--proposal-id", proposalId!, "--note", "approved"]);

    process.env.SHELLCORP_ACTOR_ROLE = "operator";
    process.env.SHELLCORP_ALLOWED_PERMISSIONS = "team.meta.write";

    await expect(
      runCommand(["team", "proposal", "execute", "--proposal-id", proposalId!]),
    ).rejects.toThrow("permission_denied:team.business.write:role=operator");
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
    await runCommand(["team", "funds", "ledger", "--team-id", "team-proj-funds", "--limit", "5", "--json"]);

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
