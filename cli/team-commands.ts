/**
 * TEAM COMMANDS
 * =============
 * Purpose
 * - Implement team lifecycle commands for ShellCorp CEO operations.
 *
 * KEY CONCEPTS:
 * - Team ID maps to project ID as `team-<projectId>`.
 * - Team metadata mutates company sidecar and optional office cluster metadata.
 *
 * USAGE:
 * - shellcorp team create --name "Alpha" --description "..." --goal "..."
 * - shellcorp doctor team-data
 *
 * MEMORY REFERENCES:
 * - MEM-0104
 */
import { Command } from "commander";
import path from "node:path";
import { execFile } from "node:child_process";
import { watch } from "node:fs";
import { access, cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import {
  createSidecarStore,
  type AgentRole,
  type BusinessConfigModel,
  type CapabilitySlotModel,
  type CompanyAgentModel,
  type CompanyModel,
  type HeartbeatProfileModel,
  type OfficeObjectModel,
  type ProjectResourceModel,
  type ProjectAccountModel,
  type ProjectAccountEventModel,
  type ResourceEventModel,
  type ResourceType,
  type RoleSlotModel,
  type SpawnPolicy,
} from "./sidecar-store.js";

type OutputMode = "text" | "json";
type TeamRole = "builder" | "growth_marketer" | "pm";
type BusinessTeamRole = "biz_pm" | "biz_executor";
type BusinessType = "affiliate_marketing" | "content_creator" | "saas" | "custom";
type CapabilityCategory = "measure" | "execute" | "distribute";
type BusinessEquipMode = "replace_minimum" | "append_only";
type ResourceKind = ResourceType;
type ResourceEventKind = "refresh" | "consumption" | "adjustment";
type BoardTaskStatus = "todo" | "in_progress" | "blocked" | "done";
type BoardTaskPriority = "low" | "medium" | "high";
type BoardActivityType = "planning" | "research" | "executing" | "distributing" | "blocked" | "handoff" | "summary" | "status";
type StatusReportState = "running" | "ok" | "no_work" | "error" | "idle" | "planning" | "executing" | "blocked" | "done";
type ConfigEntry = [string, string];
const execFileAsync = promisify(execFile);

interface TeamSummary {
  teamId: string;
  projectId: string;
  name: string;
  status: string;
  goal: string;
  kpis: string[];
  businessType?: string;
}

type TeamPermission =
  | "team.read"
  | "team.meta.write"
  | "team.kpi.write"
  | "team.business.write"
  | "team.resources.write"
  | "team.board.write"
  | "team.activity.write"
  | "team.heartbeat.write"
  | "team.archive";

const PERMISSION_BY_ROLE: Record<string, TeamPermission[]> = {
  operator: [
    "team.read",
    "team.meta.write",
    "team.kpi.write",
    "team.business.write",
    "team.resources.write",
    "team.board.write",
    "team.activity.write",
    "team.heartbeat.write",
    "team.archive",
  ],
  biz_pm: ["team.read", "team.meta.write", "team.kpi.write", "team.business.write", "team.board.write", "team.activity.write"],
  pm: ["team.read", "team.meta.write", "team.kpi.write", "team.business.write", "team.board.write", "team.activity.write"],
  biz_executor: ["team.read", "team.board.write", "team.activity.write"],
  builder: ["team.read", "team.board.write", "team.activity.write"],
  growth_marketer: ["team.read", "team.board.write", "team.activity.write"],
};

function readActorRole(): string {
  return (process.env.SHELLCORP_ACTOR_ROLE?.trim().toLowerCase() || "operator").replace(/\s+/g, "_");
}

function resolveAllowedPermissions(): Set<TeamPermission> | "all" {
  const raw = process.env.SHELLCORP_ALLOWED_PERMISSIONS?.trim();
  if (raw) {
    const tokens = raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (tokens.includes("*")) return "all";
    return new Set(tokens as TeamPermission[]);
  }
  const role = readActorRole();
  const defaults = PERMISSION_BY_ROLE[role] ?? PERMISSION_BY_ROLE.operator;
  return new Set(defaults);
}

function ensureCommandPermission(permission: TeamPermission): void {
  const allowed = resolveAllowedPermissions();
  if (allowed !== "all" && !allowed.has(permission)) {
    fail(`permission_denied:${permission}:role=${readActorRole()}`);
  }
}

type OpenclawAgentEntry = Record<string, unknown> & {
  id: string;
};

function fail(message: string): never {
  throw new Error(message);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function writeFileIfMissing(filePath: string, content: string): Promise<void> {
  try {
    await writeFile(filePath, content, {
      encoding: "utf-8",
      flag: "wx",
    });
  } catch (error) {
    const err = error as { code?: string };
    if (err.code !== "EEXIST") throw error;
  }
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeKpis(values: string[]): string[] {
  const deduped = new Set<string>();
  for (const value of values) {
    const next = value.trim();
    if (next) deduped.add(next);
  }
  return [...deduped];
}

function projectIdFromTeamId(teamId: string): string {
  const trimmed = teamId.trim();
  if (!trimmed.startsWith("team-")) fail(`invalid_team_id: ${teamId}`);
  return trimmed.slice("team-".length);
}

function teamIdFromProjectId(projectId: string): string {
  return `team-${projectId}`;
}

function collectValue(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseRoles(raw: string): TeamRole[] {
  const parsed = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const out: TeamRole[] = [];
  for (const role of parsed) {
    if (role !== "builder" && role !== "growth_marketer" && role !== "pm") {
      fail(`invalid_role: ${role}`);
    }
    out.push(role);
  }
  return [...new Set(out)];
}

function layeredHeartbeatTemplate(roleName: string, projectName: string): string {
  return [
    `You are the ${roleName} for the project "${projectName}".`,
    "",
    "Heartbeat protocol (context-first, then decision):",
    "",
    "1) Topmost context (strategic):",
    "- Fetch business goal, business KPIs, and active projects.",
    "- Understand what success looks like before choosing work.",
    "",
    "2) Long-term context:",
    "- Fetch memory/history, prior decisions, prior experiments, and recurring blockers.",
    "- Fetch external context tools when available (Notion or other connected sources).",
    "",
    "3) Short-term context:",
    "- Fetch the common board state (todo, in_progress, blocked, done).",
    "- Fetch your assigned tasks and immediate dependencies.",
    "",
    "4) Decide next action:",
    "- Choose one action only:",
    "  - add/adjust a todo on the common board, or",
    "  - execute the highest-value ticket.",
    "- In testing mode, it is okay to mock execution if tools are unavailable.",
    "",
    "5) Status reporting:",
    "- Status reporting is REQUIRED (do not skip).",
    "- Always emit `planning` at turn start and `done` at turn end.",
    "- Emit `executing` when work starts and `blocked` whenever blocked.",
    "- If status report fails, retry once; if still failing, output `STATUS: MOCK_STATUS(report_failed)`.",
    "- Preflight checks:",
    "  - `command -v shellcorp`",
    "  - `export SHELLCORP_AGENT_ID=\"<agent-id>\"`",
    "  - `export SHELLCORP_TEAM_ID=\"<team-id>\"`",
    "  - `test -n \"$SHELLCORP_CONVEX_SITE_URL\" || test -n \"$CONVEX_SITE_URL\"`",
    "- Preferred command pattern:",
    "  shellcorp status --state planning \"<your decision>\"",
    "- `status` writes both live status and timeline context in one call.",
    "- If tools are unavailable, output a clear MOCK_STATUS line instead.",
    "",
    "Output format:",
    "- TOP_CONTEXT: <one line>",
    "- LONG_CONTEXT: <one line>",
    "- SHORT_CONTEXT: <one line>",
    "- DECISION: <one line>",
    "- BOARD_ACTION: <what you would add/update on common board>",
    "- STATUS: <status tool result or MOCK_STATUS>",
    "- HEARTBEAT_OK",
    "",
  ].join("\n");
}

function parseBusinessType(raw: string): BusinessType {
  if (raw === "affiliate_marketing" || raw === "content_creator" || raw === "saas" || raw === "custom") {
    return raw;
  }
  fail(`invalid_business_type: ${raw}`);
}

function parseResourceKind(raw: string): ResourceKind {
  if (raw === "cash_budget" || raw === "api_quota" || raw === "distribution_slots" || raw === "custom") return raw;
  fail(`invalid_resource_type: ${raw}`);
}

function parseResourceEventKind(raw: string): ResourceEventKind {
  if (raw === "refresh" || raw === "consumption" || raw === "adjustment") return raw;
  fail(`invalid_resource_event_kind: ${raw}`);
}

function parseCapabilityCategory(raw: string): CapabilityCategory {
  if (raw === "measure" || raw === "execute" || raw === "distribute") return raw;
  fail(`invalid_slot: ${raw}`);
}

function parseRoleSlotRole(raw: string): Exclude<AgentRole, "ceo"> {
  if (raw === "builder" || raw === "growth_marketer" || raw === "pm" || raw === "biz_pm" || raw === "biz_executor") {
    return raw;
  }
  fail(`invalid_role: ${raw}`);
}

function parseBoardTaskStatus(raw: string): BoardTaskStatus {
  if (raw === "todo" || raw === "in_progress" || raw === "blocked" || raw === "done") return raw;
  fail(`invalid_board_status:${raw}`);
}

function parseBoardTaskPriority(raw: string): BoardTaskPriority {
  if (raw === "low" || raw === "medium" || raw === "high") return raw;
  fail(`invalid_board_priority:${raw}`);
}

function parseBoardActivityType(raw: string): BoardActivityType {
  if (
    raw === "planning" ||
    raw === "research" ||
    raw === "executing" ||
    raw === "distributing" ||
    raw === "blocked" ||
    raw === "handoff" ||
    raw === "summary" ||
    raw === "status"
  ) {
    return raw;
  }
  fail(`invalid_activity_type:${raw}`);
}

function parseStatusReportState(raw: string): StatusReportState {
  if (
    raw === "running" ||
    raw === "ok" ||
    raw === "no_work" ||
    raw === "error" ||
    raw === "idle" ||
    raw === "planning" ||
    raw === "executing" ||
    raw === "blocked" ||
    raw === "done"
  ) {
    return raw;
  }
  fail(`invalid_status_state:${raw}`);
}

function parseConfigJson(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail("invalid_config_json_object");
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  } catch {
    fail("invalid_config_json");
  }
}

function collectConfigEntry(value: string, previous: ConfigEntry[]): ConfigEntry[] {
  const trimmed = value.trim();
  if (!trimmed) return previous;
  const splitIndex = trimmed.indexOf("=");
  if (splitIndex <= 0) fail(`invalid_config_entry:${value}`);
  const key = trimmed.slice(0, splitIndex).trim();
  const entryValue = trimmed.slice(splitIndex + 1).trim();
  if (!key) fail(`invalid_config_entry:${value}`);
  return [...previous, [key, entryValue]];
}

function normalizeConfigEntries(entries: ConfigEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of entries) out[key] = value;
  return out;
}

function parseSpawnPolicy(raw: string): SpawnPolicy {
  if (raw === "manual") return "manual";
  if (raw === "queue_pressure") return "queue_pressure";
  fail(`invalid_spawn_policy: ${raw}`);
}

function ensureProjectAccount(projectId: string, project: CompanyModel["projects"][number]): ProjectAccountModel {
  const existing = (project as { account?: ProjectAccountModel }).account;
  if (existing && existing.id) return existing;
  const accountEvents = (project as { accountEvents?: ProjectAccountEventModel[] }).accountEvents ?? [];
  const derivedBalance =
    accountEvents.length > 0
      ? accountEvents[accountEvents.length - 1]?.balanceAfterCents ?? 0
      : (project.ledger ?? []).reduce((total, entry) => total + (entry.type === "revenue" ? entry.amount : -entry.amount), 0);
  return {
    id: `${projectId}:account`,
    projectId,
    currency: "USD",
    balanceCents: derivedBalance,
    updatedAt: new Date().toISOString(),
  };
}

function resolveProjectOrFail(company: CompanyModel, teamId: string) {
  const projectId = projectIdFromTeamId(teamId);
  const project = company.projects.find((entry) => entry.id === projectId);
  if (!project) fail(`team_not_found: ${teamId}`);
  return { projectId, project };
}

function resolveTeamIdForAgent(company: CompanyModel, agentId: string): string {
  const agent = company.agents.find((entry) => entry.agentId === agentId);
  if (!agent) fail(`agent_not_found:${agentId}`);
  const projectId = agent.projectId?.trim();
  if (!projectId) fail(`agent_missing_project:${agentId}`);
  const project = company.projects.find((entry) => entry.id === projectId);
  if (!project) fail(`agent_project_not_found:${agentId}:${projectId}`);
  return teamIdFromProjectId(projectId);
}

function resolveStatusActivityType(rawState: string): BoardActivityType {
  if (rawState === "planning" || rawState === "research" || rawState === "executing" || rawState === "distributing" || rawState === "blocked" || rawState === "handoff" || rawState === "summary" || rawState === "status") {
    return rawState;
  }
  if (rawState === "done" || rawState === "ok" || rawState === "no_work") return "summary";
  if (rawState === "running") return "executing";
  if (rawState === "error") return "blocked";
  if (rawState === "idle") return "status";
  fail(`invalid_status_state:${rawState}`);
}

function upsertTeamCluster(
  officeObjects: OfficeObjectModel[],
  input: { teamId: string; name: string; description: string },
): OfficeObjectModel[] {
  const existingIndex = officeObjects.findIndex(
    (object) => object.meshType === "team-cluster" && object.metadata?.teamId === input.teamId,
  );
  if (existingIndex === -1) {
    return [
      ...officeObjects,
      {
        id: `team-cluster-${input.teamId}`,
        identifier: `team-cluster-${input.teamId}`,
        meshType: "team-cluster",
        position: [0, 0, 8],
        rotation: [0, 0, 0],
        metadata: {
          teamId: input.teamId,
          name: input.name,
          description: input.description,
          services: [],
        },
      },
    ];
  }
  const next = [...officeObjects];
  const existing = next[existingIndex];
  next[existingIndex] = {
    ...existing,
    metadata: {
      ...(existing.metadata ?? {}),
      teamId: input.teamId,
      name: input.name,
      description: input.description,
    },
  };
  return next;
}

function formatOutput<T>(mode: OutputMode, payload: T, text: string): void {
  // When piping output (e.g. to `head`/`jq`), downstream may close early.
  // Avoid crashing the CLI on broken pipe.
  const safeLog = (value: string): void => {
    try {
      console.log(value);
    } catch (error) {
      // Best-effort: ignore EPIPE.
      if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPIPE") {
        return;
      }
      throw error;
    }
  };

  if (mode === "json") {
    safeLog(JSON.stringify(payload, null, 2));
    return;
  }
  safeLog(text);
}

function buildTeamSummaries(company: CompanyModel): TeamSummary[] {
  return company.projects.map((project) => ({
    teamId: teamIdFromProjectId(project.id),
    projectId: project.id,
    name: project.name,
    status: project.status,
    goal: project.goal,
    kpis: project.kpis,
    ...(project.businessConfig ? { businessType: project.businessConfig.type } : {}),
  }));
}

function ensureHeartbeatProfile(company: CompanyModel, projectId: string): { company: CompanyModel; profileId: string } {
  const profileId = `hb-team-${projectId}`;
  const existing = company.heartbeatProfiles.find((entry) => entry.id === profileId);
  if (existing) return { company, profileId };
  const fallback = company.heartbeatProfiles.find((entry) => entry.id === "hb-pm");
  const profile: HeartbeatProfileModel = {
    id: profileId,
    role: "pm",
    cadenceMinutes: fallback?.cadenceMinutes ?? 10,
    teamDescription: fallback?.teamDescription ?? "",
    productDetails: fallback?.productDetails ?? "",
    goal: fallback?.goal ?? "",
  };
  return {
    company: { ...company, heartbeatProfiles: [...company.heartbeatProfiles, profile] },
    profileId,
  };
}

function defaultHeartbeatProfileForRole(role: TeamRole): string {
  if (role === "builder") return "hb-builder";
  if (role === "growth_marketer") return "hb-growth";
  return "hb-pm";
}

function defaultHeartbeatProfileForBusinessRole(role: BusinessTeamRole): string {
  return role === "biz_pm" ? "hb-biz-pm" : "hb-biz-executor";
}

function resolveAgentWorkspacePath(stateRoot: string, agentId: string): string {
  return path.join(stateRoot, `workspace-${agentId}`);
}

function roleLabel(role: AgentRole): string {
  if (role === "biz_pm") return "Business PM";
  if (role === "biz_executor") return "Business Executor";
  if (role === "growth_marketer") return "Growth Marketer";
  return role[0].toUpperCase() + role.slice(1);
}

function defaultBusinessConfig(type: BusinessType): BusinessConfigModel {
  return {
    type,
    slots: {
      measure: {
        skillId: "amazon-affiliate-metrics",
        category: "measure",
        config: type === "affiliate_marketing" ? { platform: "amazon_associates" } : {},
      },
      execute: {
        skillId: "video-generator",
        category: "execute",
        config: {},
      },
      distribute: {
        skillId: "tiktok-poster",
        category: "distribute",
        config: {},
      },
    },
  };
}

function parseSkillList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function uniqueSkills(skills: string[]): string[] {
  return [...new Set(skills.map((entry) => entry.trim()).filter(Boolean))];
}

function buildTeamBusinessSkillTargets(project: CompanyModel["projects"][number]): {
  pmSkills: string[];
  executorSkills: string[];
} {
  const slotSkills = project.businessConfig
    ? uniqueSkills([
        ...parseSkillList(project.businessConfig.slots.measure.skillId),
        ...parseSkillList(project.businessConfig.slots.execute.skillId),
        ...parseSkillList(project.businessConfig.slots.distribute.skillId),
      ])
    : [];
  const trackerSkills = uniqueSkills((project.resources ?? []).map((resource) => resource.trackerSkillId));
  const sharedCore = ["shellcorp-team-cli", "status-self-reporter"];
  const pmCore = ["shellcorp-kanban-ops", "ledger-manager", "experiment-runner"];
  return {
    pmSkills: uniqueSkills([...sharedCore, ...pmCore, ...slotSkills, ...trackerSkills]),
    executorSkills: uniqueSkills([...sharedCore, ...slotSkills]),
  };
}

function applyAgentSkillsByMode(currentSkills: string[], targetSkills: string[], mode: BusinessEquipMode): string[] {
  if (mode === "append_only") return uniqueSkills([...currentSkills, ...targetSkills]);
  return uniqueSkills(targetSkills);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    const entries = await readdir(filePath);
    return Array.isArray(entries);
  } catch {
    return false;
  }
}

async function resolveSkillSourceDirectory(skillsRoot: string, skillId: string): Promise<string | null> {
  const directPath = path.join(skillsRoot, skillId);
  if ((await isDirectory(directPath)) && ((await pathExists(path.join(directPath, "SKILL.md"))) || (await pathExists(path.join(directPath, "skill.md"))))) {
    return directPath;
  }
  let categories: string[] = [];
  try {
    categories = await readdir(skillsRoot);
  } catch {
    return null;
  }
  for (const category of categories) {
    const nestedPath = path.join(skillsRoot, category, skillId);
    if ((await isDirectory(nestedPath)) && ((await pathExists(path.join(nestedPath, "SKILL.md"))) || (await pathExists(path.join(nestedPath, "skill.md"))))) {
      return nestedPath;
    }
  }
  return null;
}

function tryResolveWorkspaceFromOpenclawConfig(openclawConfig: Record<string, unknown>, stateRoot: string, agentId: string): string {
  const agentsNode = asRecord(openclawConfig.agents);
  const list = Array.isArray(agentsNode.list) ? agentsNode.list : [];
  const match = list.find((entry) => asRecord(entry).id === agentId);
  const row = asRecord(match);
  const workspace = typeof row.workspace === "string" ? row.workspace.trim() : "";
  if (workspace) return workspace;
  return resolveAgentWorkspacePath(stateRoot, agentId);
}

function collectVideoLikeStrings(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (/^https?:\/\/\S+/i.test(trimmed) || /\.(mp4|mov|webm|mkv)(\?.*)?$/i.test(trimmed)) {
      out.add(trimmed);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectVideoLikeStrings(entry, out);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const entry of Object.values(value as Record<string, unknown>)) {
    collectVideoLikeStrings(entry, out);
  }
}

function extractVideoRefsFromCommandOutput(stdout: string): string[] {
  const refs = new Set<string>();
  const regex = /(https?:\/\/[^\s"'`]+|\/[^\s"'`]+\.(?:mp4|mov|webm|mkv)|[^\s"'`]+\.(?:mp4|mov|webm|mkv))/gi;
  let match: RegExpExecArray | null = regex.exec(stdout);
  while (match) {
    refs.add(match[1]);
    match = regex.exec(stdout);
  }
  for (const line of stdout.split("\n").map((entry) => entry.trim()).filter(Boolean)) {
    if (!line.startsWith("{") && !line.startsWith("[")) continue;
    try {
      const parsed = JSON.parse(line) as unknown;
      collectVideoLikeStrings(parsed, refs);
    } catch {
      // Ignore non-JSON lines.
    }
  }
  try {
    const parsed = JSON.parse(stdout) as unknown;
    collectVideoLikeStrings(parsed, refs);
  } catch {
    // Ignore non-JSON stdout blobs.
  }
  return [...refs];
}

async function runInfshVideoGeneration(model: string, prompt: string): Promise<{ refs: string[]; stdout: string; stderr: string }> {
  const input = JSON.stringify({ prompt });
  try {
    const result = await execFileAsync("infsh", ["app", "run", model, "--input", input, "--json"], { maxBuffer: 10 * 1024 * 1024 });
    const stdout = typeof result.stdout === "string" ? result.stdout : String(result.stdout ?? "");
    const stderr = typeof result.stderr === "string" ? result.stderr : String(result.stderr ?? "");
    return { refs: extractVideoRefsFromCommandOutput(stdout), stdout, stderr };
  } catch {
    const fallback = await execFileAsync("infsh", ["app", "run", model, "--input", input], { maxBuffer: 10 * 1024 * 1024 });
    const stdout = typeof fallback.stdout === "string" ? fallback.stdout : String(fallback.stdout ?? "");
    const stderr = typeof fallback.stderr === "string" ? fallback.stderr : String(fallback.stderr ?? "");
    return { refs: extractVideoRefsFromCommandOutput(stdout), stdout, stderr };
  }
}

function defaultProjectResources(projectId: string): ProjectResourceModel[] {
  return [
    {
      id: `${projectId}:cash`,
      projectId,
      type: "cash_budget",
      name: "Cash Budget",
      unit: "usd_cents",
      remaining: 5000,
      limit: 5000,
      reserved: 0,
      trackerSkillId: "resource-cash-tracker",
      refreshCadenceMinutes: 15,
      policy: { advisoryOnly: true, softLimit: 1500, hardLimit: 0, whenLow: "deprioritize_expensive_tasks" },
      metadata: { currency: "USD" },
    },
    {
      id: `${projectId}:api`,
      projectId,
      type: "api_quota",
      name: "API Quota",
      unit: "requests",
      remaining: 1000,
      limit: 1000,
      reserved: 0,
      trackerSkillId: "resource-api-quota-tracker",
      refreshCadenceMinutes: 15,
      policy: { advisoryOnly: true, softLimit: 200, hardLimit: 0, whenLow: "warn" },
    },
    {
      id: `${projectId}:distribution`,
      projectId,
      type: "distribution_slots",
      name: "Distribution Slots",
      unit: "posts_per_day",
      remaining: 10,
      limit: 10,
      reserved: 0,
      trackerSkillId: "resource-distribution-tracker",
      refreshCadenceMinutes: 60,
      policy: { advisoryOnly: true, softLimit: 2, hardLimit: 0, whenLow: "ask_pm_review" },
      metadata: { platform: "tiktok" },
    },
  ];
}

function defaultResourceId(projectId: string, type: ResourceKind): string {
  if (type === "cash_budget") return `${projectId}:cash`;
  if (type === "api_quota") return `${projectId}:api`;
  if (type === "distribution_slots") return `${projectId}:distribution`;
  return `${projectId}:custom`;
}

function ensureProjectResources(project: CompanyModel["projects"][number]): CompanyModel["projects"][number] {
  if (Array.isArray(project.resources) && project.resources.length > 0) return project;
  return {
    ...project,
    resources: defaultProjectResources(project.id),
    resourceEvents: Array.isArray(project.resourceEvents) ? project.resourceEvents : [],
  };
}

function ensureBusinessHeartbeatProfiles(company: CompanyModel): CompanyModel {
  const missingPm = !company.heartbeatProfiles.some((profile) => profile.id === "hb-biz-pm");
  const missingExecutor = !company.heartbeatProfiles.some((profile) => profile.id === "hb-biz-executor");
  if (!missingPm && !missingExecutor) return company;
  const nextProfiles = [...company.heartbeatProfiles];
  if (missingPm) {
    nextProfiles.push({
      id: "hb-biz-pm",
      role: "biz_pm",
      cadenceMinutes: 5,
      teamDescription: "Business PM loop",
      productDetails: "Review KPIs, manage kanban, track profitability",
      goal: "Keep business net-positive with clear executor tasks",
    });
  }
  if (missingExecutor) {
    nextProfiles.push({
      id: "hb-biz-executor",
      role: "biz_executor",
      cadenceMinutes: 5,
      teamDescription: "Business execution loop",
      productDetails: "Execute highest-value tasks, distribute outputs, report metrics",
      goal: "Deliver measurable growth output every heartbeat",
    });
  }
  return { ...company, heartbeatProfiles: nextProfiles };
}

function buildAutoAgents(projectId: string, slug: string, roles: TeamRole[]): CompanyAgentModel[] {
  return roles.map((role) => ({
    agentId: `${slug}-${role.replace("_marketer", "")}`,
    role,
    projectId,
    heartbeatProfileId: defaultHeartbeatProfileForRole(role),
    isCeo: false,
    lifecycleState: "pending_spawn",
  }));
}

function buildAutoRoleSlots(projectId: string, roles: TeamRole[]): RoleSlotModel[] {
  return roles.map((role) => ({
    projectId,
    role,
    desiredCount: 1,
    spawnPolicy: "queue_pressure",
  }));
}

function buildBusinessRoleSlots(projectId: string): RoleSlotModel[] {
  return [
    {
      projectId,
      role: "biz_pm",
      desiredCount: 1,
      spawnPolicy: "queue_pressure",
    },
    {
      projectId,
      role: "biz_executor",
      desiredCount: 1,
      spawnPolicy: "queue_pressure",
    },
  ];
}

function buildBusinessAgents(projectId: string, slug: string): CompanyAgentModel[] {
  return [
    {
      agentId: `${slug}-pm`,
      role: "biz_pm",
      projectId,
      heartbeatProfileId: defaultHeartbeatProfileForBusinessRole("biz_pm"),
      isCeo: false,
      lifecycleState: "pending_spawn",
    },
    {
      agentId: `${slug}-executor`,
      role: "biz_executor",
      projectId,
      heartbeatProfileId: defaultHeartbeatProfileForBusinessRole("biz_executor"),
      isCeo: false,
      lifecycleState: "pending_spawn",
    },
  ];
}

async function copyBusinessHeartbeatTemplates(agentIds: string[]): Promise<void> {
  const stateRoot = process.env.OPENCLAW_STATE_DIR?.trim()
    ? path.resolve(process.env.OPENCLAW_STATE_DIR.trim())
    : path.join(process.env.HOME || "", ".openclaw");
  const templatesRoot = path.resolve(process.cwd(), "templates", "workspace");
  const pmTemplatePath = path.join(templatesRoot, "HEARTBEAT-biz-pm.md");
  const executorTemplatePath = path.join(templatesRoot, "HEARTBEAT-biz-executor.md");
  let pmTemplate: string | null = null;
  let executorTemplate: string | null = null;
  try {
    pmTemplate = await readFile(pmTemplatePath, "utf-8");
    executorTemplate = await readFile(executorTemplatePath, "utf-8");
  } catch {
    return;
  }
  for (const agentId of agentIds) {
    const workspacePath = resolveAgentWorkspacePath(stateRoot, agentId);
    const isPm = /-pm$/.test(agentId);
    const template = isPm ? pmTemplate : executorTemplate;
    if (!template) continue;
    try {
      await mkdir(workspacePath, { recursive: true });
      await writeFile(path.join(workspacePath, "HEARTBEAT.md"), template, "utf-8");
    } catch {
      // best-effort copy; creation should not fail because of filesystem template write
    }
  }
}

async function upsertBusinessCronJobs(projectId: string, agentIds: string[]): Promise<void> {
  const stateRoot = process.env.OPENCLAW_STATE_DIR?.trim()
    ? path.resolve(process.env.OPENCLAW_STATE_DIR.trim())
    : path.join(process.env.HOME || "", ".openclaw");
  const cronDir = path.join(stateRoot, "cron");
  const cronPath = path.join(cronDir, "jobs.json");
  let currentJobs: unknown[] = [];
  try {
    const raw = await readFile(cronPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) currentJobs = parsed;
  } catch {
    currentJobs = [];
  }

  const existingById = new Map<string, Record<string, unknown>>();
  for (const row of currentJobs) {
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id : "";
    if (!id) continue;
    existingById.set(id, obj);
  }

  const now = Date.now();
  for (const agentId of agentIds) {
    const isPm = /-pm$/.test(agentId);
    const jobId = `biz-heartbeat-${projectId}-${isPm ? "pm" : "executor"}`;
    const payloadMessage = "Read HEARTBEAT.md and follow it exactly. End your response with HEARTBEAT_OK.";
    existingById.set(jobId, {
      id: jobId,
      agentId,
      name: `Business heartbeat (${isPm ? "PM" : "Executor"}) ${projectId}`,
      enabled: true,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: { kind: "every", everyMs: 180000 },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: {
        kind: "agentTurn",
        message: payloadMessage,
      },
      delivery: {
        mode: "none",
      },
    });
  }

  await mkdir(cronDir, { recursive: true });
  await writeFile(cronPath, `${JSON.stringify([...existingById.values()], null, 2)}\n`, "utf-8");
}

async function ensureWorkspaceWithBootstrap(opts: {
  stateRoot: string;
  agent: CompanyAgentModel;
  projectName: string;
}): Promise<void> {
  const workspacePath = resolveAgentWorkspacePath(opts.stateRoot, opts.agent.agentId);
  await mkdir(workspacePath, { recursive: true });
  const templatesRoot = path.resolve(process.cwd(), "templates", "workspace");
  const defaultAgents = `# AGENTS\n\nRole: ${roleLabel(opts.agent.role)}\nProject: ${opts.projectName}\n\n- Follow HEARTBEAT.md for current operating loop.\n- Keep actions reversible and explicit.\n`;
  const defaultSoul = `# SOUL\n\nYou are the ${roleLabel(opts.agent.role)} for project "${opts.projectName}".\nAct with clarity, speed, and measurable outcomes.\n`;
  const defaultHeartbeat = layeredHeartbeatTemplate(roleLabel(opts.agent.role), opts.projectName);

  const agentsTemplatePath =
    opts.agent.role === "biz_pm"
      ? path.join(templatesRoot, "AGENTS-biz-pm.md")
      : opts.agent.role === "biz_executor"
        ? path.join(templatesRoot, "AGENTS-biz-executor.md")
        : "";
  const soulTemplatePath =
    opts.agent.role === "biz_pm"
      ? path.join(templatesRoot, "SOUL-biz-pm.md")
      : opts.agent.role === "biz_executor"
        ? path.join(templatesRoot, "SOUL-biz-executor.md")
        : "";

  let agentsTemplate = defaultAgents;
  if (agentsTemplatePath) {
    try {
      agentsTemplate = await readFile(agentsTemplatePath, "utf-8");
    } catch {
      agentsTemplate = defaultAgents;
    }
  }

  let soulTemplate = defaultSoul;
  if (soulTemplatePath) {
    try {
      soulTemplate = await readFile(soulTemplatePath, "utf-8");
    } catch {
      soulTemplate = defaultSoul;
    }
  }

  await writeFileIfMissing(path.join(workspacePath, "AGENTS.md"), agentsTemplate);
  await writeFileIfMissing(path.join(workspacePath, "SOUL.md"), soulTemplate);
  await writeFileIfMissing(path.join(workspacePath, "TOOLS.md"), "# TOOLS\n");
  await writeFileIfMissing(path.join(workspacePath, "IDENTITY.md"), `# IDENTITY\n\n- agentId: ${opts.agent.agentId}\n`);
  await writeFileIfMissing(path.join(workspacePath, "USER.md"), "# USER\n");
  await writeFileIfMissing(path.join(workspacePath, "HEARTBEAT.md"), defaultHeartbeat);
}

async function provisionOpenclawAgents(opts: {
  store: ReturnType<typeof createSidecarStore>;
  agents: CompanyAgentModel[];
  projectName: string;
}): Promise<void> {
  if (opts.agents.length === 0) return;
  const stateRoot = process.env.OPENCLAW_STATE_DIR?.trim()
    ? path.resolve(process.env.OPENCLAW_STATE_DIR.trim())
    : path.join(process.env.HOME || "", ".openclaw");
  const config = await opts.store.readOpenclawConfig();
  const agentsNode = asRecord(config.agents);
  const currentList = Array.isArray(agentsNode.list) ? [...agentsNode.list] : [];
  const existingIds = new Set(
    currentList
      .map((entry) => asRecord(entry).id)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  );

  for (const agent of opts.agents) {
    await ensureWorkspaceWithBootstrap({
      stateRoot,
      agent,
      projectName: opts.projectName,
    });
    await mkdir(path.join(stateRoot, "agents", agent.agentId, "sessions"), { recursive: true });
    if (existingIds.has(agent.agentId)) continue;
    const entry: OpenclawAgentEntry = {
      id: agent.agentId,
      name: `${opts.projectName} ${roleLabel(agent.role)}`,
      workspace: resolveAgentWorkspacePath(stateRoot, agent.agentId),
      agentDir: path.join(stateRoot, "agents", agent.agentId, "agent"),
    };
    currentList.push(entry);
    existingIds.add(agent.agentId);
  }

  const nextConfig = {
    ...config,
    agents: {
      ...agentsNode,
      list: currentList,
    },
  } as Record<string, unknown>;
  await opts.store.writeOpenclawConfig(nextConfig);
}

async function deregisterOpenclawAgents(opts: {
  store: ReturnType<typeof createSidecarStore>;
  agentIds: string[];
}): Promise<void> {
  if (opts.agentIds.length === 0) return;
  const config = await opts.store.readOpenclawConfig();
  const agentsNode = asRecord(config.agents);
  const currentList = Array.isArray(agentsNode.list) ? [...agentsNode.list] : [];
  const removeSet = new Set(opts.agentIds);
  const nextList = currentList.filter((entry) => {
    const id = asRecord(entry).id;
    return !(typeof id === "string" && removeSet.has(id));
  });
  const nextConfig = {
    ...config,
    agents: {
      ...agentsNode,
      list: nextList,
    },
  } as Record<string, unknown>;
  await opts.store.writeOpenclawConfig(nextConfig);
}

function runDoctor(company: CompanyModel): string[] {
  const issues: string[] = [];
  const projectIds = new Set(company.projects.map((project) => project.id));
  const heartbeatIds = new Set(company.heartbeatProfiles.map((profile) => profile.id));
  const seenProjects = new Set<string>();
  for (const project of company.projects) {
    if (seenProjects.has(project.id)) issues.push(`duplicate_project_id:${project.id}`);
    seenProjects.add(project.id);
  }
  const seenAgents = new Set<string>();
  for (const agent of company.agents) {
    if (seenAgents.has(agent.agentId)) issues.push(`duplicate_agent_id:${agent.agentId}`);
    seenAgents.add(agent.agentId);
    if (agent.projectId && !projectIds.has(agent.projectId)) issues.push(`agent_project_missing:${agent.agentId}:${agent.projectId}`);
    if (!heartbeatIds.has(agent.heartbeatProfileId)) {
      issues.push(`agent_heartbeat_missing:${agent.agentId}:${agent.heartbeatProfileId}`);
    }
  }
  for (const slot of company.roleSlots) {
    if (!projectIds.has(slot.projectId)) issues.push(`role_slot_project_missing:${slot.projectId}:${slot.role}`);
  }
  for (const project of company.projects) {
    const resourceIds = new Set<string>();
    const resources = project.resources ?? [];
    for (const resource of resources) {
      if (resourceIds.has(resource.id)) issues.push(`duplicate_project_resource_id:${project.id}:${resource.id}`);
      resourceIds.add(resource.id);
      if (!resource.trackerSkillId.trim()) issues.push(`resource_tracker_missing:${project.id}:${resource.id}`);
      if (resource.limit < 0) issues.push(`resource_limit_negative:${project.id}:${resource.id}:${resource.limit}`);
      if (resource.remaining > resource.limit) {
        issues.push(`resource_remaining_over_limit:${project.id}:${resource.id}:${resource.remaining}:${resource.limit}`);
      }
    }
    for (const event of project.resourceEvents ?? []) {
      if (!resourceIds.has(event.resourceId)) {
        issues.push(`resource_event_missing_resource:${project.id}:${event.id}:${event.resourceId}`);
      }
    }
  }
  return issues;
}

function resourceAdvisories(resources: CompanyModel["projects"][number]["resources"]): string {
  if (!resources || resources.length === 0) return "none";
  const notes: string[] = [];
  for (const resource of resources) {
    const softLimit = resource.policy.softLimit;
    const hardLimit = resource.policy.hardLimit;
    if (typeof hardLimit === "number" && resource.remaining <= hardLimit) {
      notes.push(`${resource.name}: hard-limit reached -> ${resource.policy.whenLow}`);
      continue;
    }
    if (typeof softLimit === "number" && resource.remaining <= softLimit) {
      notes.push(`${resource.name}: low -> ${resource.policy.whenLow}`);
    }
  }
  return notes.length > 0 ? notes.join("; ") : "none";
}

function resourcesSnapshot(resources: CompanyModel["projects"][number]["resources"]): string {
  if (!resources || resources.length === 0) return "none";
  return resources
    .map((resource) => `${resource.name}=${resource.remaining}/${resource.limit} ${resource.unit}`)
    .join(" | ");
}

async function renderBusinessHeartbeatTemplate(opts: {
  role: "biz_pm" | "biz_executor";
  project: CompanyModel["projects"][number];
}): Promise<string> {
  const templatePath = path.resolve(
    process.cwd(),
    "templates",
    "workspace",
    opts.role === "biz_pm" ? "HEARTBEAT-biz-pm.md" : "HEARTBEAT-biz-executor.md",
  );
  const template = await readFile(templatePath, "utf-8");
  const project = opts.project;
  const revenue = (project.ledger ?? [])
    .filter((entry) => entry.type === "revenue")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const costs = (project.ledger ?? [])
    .filter((entry) => entry.type === "cost")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const profit = revenue - costs;
  const experimentsSummary =
    project.experiments && project.experiments.length > 0
      ? project.experiments
          .slice(-3)
          .map((entry) => `${entry.hypothesis} (${entry.status})`)
          .join("; ")
      : "none";
  const recentMetrics =
    project.metricEvents && project.metricEvents.length > 0
      ? JSON.stringify(project.metricEvents[project.metricEvents.length - 1]?.metrics ?? {})
      : "none";
  const boardSnapshot = await readBoardSnapshot(project.id);
  const replaceMap: Record<string, string> = {
    "{projectName}": project.name,
    "{businessType}": project.businessConfig?.type ?? "custom",
    "{projectGoal}": project.goal,
    "{totalRevenue}": String(revenue),
    "{totalCosts}": String(costs),
    "{profit}": String(profit),
    "{experimentsSummary}": experimentsSummary,
    "{recentMetrics}": recentMetrics,
    "{openTasks}": String(boardSnapshot.openTasks),
    "{inProgressTasks}": String(boardSnapshot.inProgressTasks),
    "{blockedTasks}": String(boardSnapshot.blockedTasks),
    "{resourcesSnapshot}": resourcesSnapshot(project.resources ?? []),
    "{resourceAdvisories}": resourceAdvisories(project.resources ?? []),
    "{measureSkillId}": project.businessConfig?.slots.measure.skillId ?? "not-set",
    "{executeSkillId}": project.businessConfig?.slots.execute.skillId ?? "not-set",
    "{distributeSkillId}": project.businessConfig?.slots.distribute.skillId ?? "not-set",
    "{measureConfig}": JSON.stringify(project.businessConfig?.slots.measure.config ?? {}),
    "{executeConfig}": JSON.stringify(project.businessConfig?.slots.execute.config ?? {}),
    "{distributeConfig}": JSON.stringify(project.businessConfig?.slots.distribute.config ?? {}),
    "{tasksList}": boardSnapshot.tasksList,
  };
  let rendered = template;
  for (const [needle, value] of Object.entries(replaceMap)) {
    rendered = rendered.split(needle).join(value);
  }
  return rendered;
}

function resolveOpenclawStateRoot(): string {
  return process.env.OPENCLAW_STATE_DIR?.trim() ? path.resolve(process.env.OPENCLAW_STATE_DIR.trim()) : path.join(process.env.HOME || "", ".openclaw");
}

async function writeTeamHeartbeatFiles(opts: {
  store: ReturnType<typeof createSidecarStore>;
  project: CompanyModel["projects"][number];
  agents: CompanyAgentModel[];
}): Promise<number> {
  const stateRoot = resolveOpenclawStateRoot();
  let written = 0;
  for (const agent of opts.agents) {
    const workspacePath = resolveAgentWorkspacePath(stateRoot, agent.agentId);
    const role = agent.role;
    const heartbeatContent =
      role === "biz_pm"
        ? await renderBusinessHeartbeatTemplate({ role: "biz_pm", project: opts.project })
        : role === "biz_executor"
          ? await renderBusinessHeartbeatTemplate({ role: "biz_executor", project: opts.project })
          : layeredHeartbeatTemplate(roleLabel(role), opts.project.name);
    await mkdir(workspacePath, { recursive: true });
    await writeFile(path.join(workspacePath, "HEARTBEAT.md"), heartbeatContent, "utf-8");
    written += 1;
  }
  return written;
}

async function syncTeamHeartbeatFiles(opts: {
  store: ReturnType<typeof createSidecarStore>;
  teamId?: string;
}): Promise<{ teamsTouched: number; heartbeatFilesWritten: number; teamsSkipped: number }> {
  const company = await opts.store.readCompanyModel();
  const targetProjects = opts.teamId ? [resolveProjectOrFail(company, opts.teamId).project] : company.projects;
  let teamsTouched = 0;
  let teamsSkipped = 0;
  let heartbeatFilesWritten = 0;
  for (const project of targetProjects) {
    const teamAgents = company.agents.filter((agent) => agent.projectId === project.id);
    if (teamAgents.length === 0) {
      teamsSkipped += 1;
      continue;
    }
    heartbeatFilesWritten += await writeTeamHeartbeatFiles({
      store: opts.store,
      project,
      agents: teamAgents,
    });
    teamsTouched += 1;
  }
  return { teamsTouched, heartbeatFilesWritten, teamsSkipped };
}

async function ensureOpenclawHeartbeatScaffold(opts: {
  store: ReturnType<typeof createSidecarStore>;
  agentIds: string[];
}): Promise<number> {
  const config = await opts.store.readOpenclawConfig();
  const agentsNode = asRecord(config.agents);
  const defaultsNode = asRecord(agentsNode.defaults);
  const defaultsHeartbeatNode = asRecord(defaultsNode.heartbeat);
  const list = Array.isArray(agentsNode.list) ? [...agentsNode.list] : [];
  const targetAgentIds = new Set(opts.agentIds);
  let touched = 0;
  const nextList = list.map((entry) => {
    const row = asRecord(entry);
    const id = typeof row.id === "string" ? row.id : "";
    if (!id || !targetAgentIds.has(id)) return row;
    const heartbeat = asRecord(row.heartbeat);
    touched += 1;
    return {
      ...row,
      heartbeat: {
        ...heartbeat,
        every: "3m",
      },
    };
  });

  const hooksNode = asRecord(config.hooks);
  const internalHooksNode = asRecord(hooksNode.internal);
  const hookEntriesNode = asRecord(internalHooksNode.entries);
  const shellcorpStatusNode = asRecord(hookEntriesNode["shellcorp-status"]);

  const nextConfig = {
    ...config,
    hooks: {
      ...hooksNode,
      internal: {
        ...internalHooksNode,
        enabled: true,
        entries: {
          ...hookEntriesNode,
          "shellcorp-status": {
            ...shellcorpStatusNode,
            enabled: true,
          },
        },
      },
    },
    agents: {
      ...agentsNode,
      defaults: {
        ...defaultsNode,
        heartbeat: {
          ...defaultsHeartbeatNode,
          every: "3m",
          includeReasoning: true,
          target: "last",
          prompt: "Read HEARTBEAT.md and follow it exactly. End your response with HEARTBEAT_OK.",
        },
      },
      list: nextList,
    },
  } as Record<string, unknown>;
  await opts.store.writeOpenclawConfig(nextConfig);
  return touched;
}

function resolveConvexSiteUrl(): string {
  const raw = process.env.SHELLCORP_CONVEX_SITE_URL?.trim() || process.env.CONVEX_SITE_URL?.trim() || "";
  if (!raw) {
    fail("missing_convex_site_url:set SHELLCORP_CONVEX_SITE_URL");
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    fail(`invalid_convex_site_url:${raw}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    fail(`invalid_convex_site_url_protocol:${parsed.protocol}`);
  }
  return parsed.href.replace(/\/+$/, "");
}

function classifyFetchFailure(error: unknown): string {
  const maybeRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  };
  const errorRecord = maybeRecord(error);
  const causeRecord = maybeRecord(errorRecord?.cause);
  const code = (causeRecord?.code ?? errorRecord?.code ?? "") as string;
  if (code === "ECONNREFUSED") return "connection_refused";
  if (code === "ENOTFOUND") return "dns_not_found";
  if (code === "EAI_AGAIN") return "dns_lookup_failed";
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") return "timeout";
  if (code.startsWith("ERR_TLS_") || code === "DEPTH_ZERO_SELF_SIGNED_CERT" || code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
    return "tls_error";
  }
  return "fetch_failed";
}

async function postConvexJson(pathname: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const baseUrl = resolveConvexSiteUrl();
  const endpoint = `${baseUrl}${pathname}`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-shellcorp-actor-role": readActorRole(),
  };
  const token = process.env.SHELLCORP_BOARD_OPERATOR_TOKEN?.trim();
  if (token) headers["x-shellcorp-board-token"] = token;
  const allowed = process.env.SHELLCORP_ALLOWED_PERMISSIONS?.trim();
  if (allowed) headers["x-shellcorp-allowed-permissions"] = allowed;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (error) {
    fail(`convex_http_request_failed:${classifyFetchFailure(error)}:url=${endpoint}`);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    fail(`convex_http_invalid_response:url=${endpoint}`);
  }
  if (!response.ok) {
    const responseRecord = body as Record<string, unknown>;
    const errorCode = typeof responseRecord.error === "string" ? responseRecord.error : `http_${response.status}`;
    fail(`convex_http_request_rejected:${errorCode}:url=${endpoint}`);
  }
  return body as Record<string, unknown>;
}

async function postBoardCommand(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const normalizedPayload = { ...payload };
  if (typeof normalizedPayload.teamId !== "string" && typeof normalizedPayload.projectId === "string") {
    normalizedPayload.teamId = teamIdFromProjectId(normalizedPayload.projectId);
  }
  let body: Record<string, unknown>;
  try {
    body = await postConvexJson("/board/command", normalizedPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(message.replace("convex_http_", "board_command_"));
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) fail("board_command_invalid_response");
  return body;
}

async function postBoardQuery(payload: Record<string, unknown>): Promise<unknown> {
  const normalizedPayload = { ...payload };
  if (typeof normalizedPayload.teamId !== "string" && typeof normalizedPayload.projectId === "string") {
    normalizedPayload.teamId = teamIdFromProjectId(normalizedPayload.projectId);
  }
  let body: Record<string, unknown>;
  try {
    body = await postConvexJson("/board/query", normalizedPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(message.replace("convex_http_", "board_query_"));
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) fail("board_query_invalid_response");
  const data = body.data;
  return data;
}

async function postStatusReport(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    return await postConvexJson("/status/report", payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(message.replace("convex_http_", "status_report_"));
  }
}

function optionalBeatId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

async function tryLogCliActivity(payload: {
  projectId: string;
  teamId: string;
  actorAgentId?: string;
  activityType: BoardActivityType;
  label: string;
  detail?: string;
  source?: string;
  beatId?: string;
}): Promise<void> {
  const actorAgentId = payload.actorAgentId?.trim() || process.env.SHELLCORP_ACTOR_AGENT_ID?.trim() || "agent-unknown";
  try {
    await postBoardCommand({
      projectId: payload.projectId,
      teamId: payload.teamId,
      command: "activity_log",
      actorType: "agent",
      actorAgentId,
      activityType: payload.activityType,
      label: payload.label,
      detail: payload.detail,
      beatId: optionalBeatId(payload.beatId),
      stepKey: `cli-log-${actorAgentId}-${Date.now()}`,
      status: "planning",
      skillId: payload.source?.trim() || "shellcorp_cli",
    });
  } catch {
    // Fire-and-forget sink: CLI sidecar mutations must still succeed even if Convex logging is unavailable.
  }
}

async function readBoardSnapshot(projectId: string): Promise<{
  openTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  tasksList: string;
}> {
  try {
    const data = await postBoardQuery({
      projectId,
      query: "tasks",
    });
    const rows = Array.isArray((data as { tasks?: unknown[] })?.tasks) ? ((data as { tasks: unknown[] }).tasks as unknown[]) : [];
    const safeRows = rows.filter((row) => row && typeof row === "object" && !Array.isArray(row)) as Array<{
      taskId?: string;
      title?: string;
      status?: string;
      priority?: string;
      ownerAgentId?: string;
    }>;
    const openTasks = safeRows.filter((row) => row.status === "todo").length;
    const inProgressTasks = safeRows.filter((row) => row.status === "in_progress").length;
    const blockedTasks = safeRows.filter((row) => row.status === "blocked").length;
    const tasksList = JSON.stringify(
      safeRows.slice(0, 12).map((row) => ({
        taskId: row.taskId ?? "",
        title: row.title ?? "",
        status: row.status ?? "todo",
        priority: row.priority ?? "medium",
        ownerAgentId: row.ownerAgentId ?? "",
      })),
    );
    return { openTasks, inProgressTasks, blockedTasks, tasksList };
  } catch {
    return { openTasks: 0, inProgressTasks: 0, blockedTasks: 0, tasksList: "[]" };
  }
}

export function registerTeamCommands(program: Command): void {
  const store = createSidecarStore();

  program
    .command("status")
    .description("Report agent status with auto-resolved team/agent context")
    .argument("<statusText>", "Operator-readable status text")
    .option("--state <state>", "planning|research|executing|distributing|blocked|handoff|summary|status (legacy values supported)", "status")
    .option("--agent-id <agentId>", "Optional agent id override")
    .option("--team-id <teamId>", "Optional team id override (team-*)")
    .option("--label <label>", "Optional activity label override")
    .option("--task-id <taskId>", "Optional task id context")
    .option("--skill-id <skillId>", "Optional skill id context")
    .option("--step-key <stepKey>", "Optional idempotency key")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (
        statusText: string,
        opts: {
          state: string;
          agentId?: string;
          teamId?: string;
          label?: string;
          taskId?: string;
          skillId?: string;
          stepKey?: string;
          beatId?: string;
          json?: boolean;
        },
      ) => {
        ensureCommandPermission("team.activity.write");
        const company = await store.readCompanyModel();
        const detail = statusText.trim();
        if (!detail) fail("invalid_status_text");

        const agentId =
          opts.agentId?.trim() || process.env.SHELLCORP_AGENT_ID?.trim() || process.env.SHELLCORP_ACTOR_AGENT_ID?.trim();
        if (!agentId) fail("missing_agent_id:use_--agent-id_or_SHELLCORP_AGENT_ID");

        const teamId = opts.teamId?.trim() || process.env.SHELLCORP_TEAM_ID?.trim() || resolveTeamIdForAgent(company, agentId);
        const { projectId } = resolveProjectOrFail(company, teamId);
        const activityType = resolveStatusActivityType(opts.state.trim());
        const label =
          opts.label?.trim() ||
          (activityType === "planning" || activityType === "executing" || activityType === "blocked" ? activityType : "status");
        const stepKey = opts.stepKey?.trim() || `status-${agentId}-${Date.now()}`;

        const result = await postBoardCommand({
          teamId,
          projectId,
          command: "activity_log",
          actorType: "agent",
          actorAgentId: agentId,
          activityType,
          label,
          detail,
          taskId: opts.taskId?.trim() || undefined,
          skillId: opts.skillId?.trim() || undefined,
          stepKey,
          beatId: optionalBeatId(opts.beatId),
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId, projectId, agentId, activityType, label, statusText: detail, stepKey, result },
          `Reported status for ${agentId} (${activityType})`,
        );
      },
    );

  const team = program.command("team").description("Manage team entities mapped to company projects");

  team
    .command("list")
    .option("--json", "Output JSON", false)
    .action(async (opts: { json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const summaries = buildTeamSummaries(company);
      if (opts.json) {
        console.log(JSON.stringify({ teams: summaries }, null, 2));
        return;
      }
      if (summaries.length === 0) {
        console.log("No teams found.");
        return;
      }
      const lines = summaries.map((entry) => `${entry.teamId} | ${entry.name} | ${entry.status} | KPIs=${entry.kpis.length}`);
      console.log(lines.join("\n"));
    });

  team
    .command("show")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const payload = {
        ok: true,
        teamId: opts.teamId,
        projectId,
        project,
        roleSlots: company.roleSlots.filter((entry) => entry.projectId === projectId),
        agents: company.agents.filter((entry) => entry.projectId === projectId),
      };
      formatOutput(
        opts.json ? "json" : "text",
        payload,
        `${opts.teamId} | ${project.name} | goal=${project.goal} | kpis=${project.kpis.length} | status=${project.status}`,
      );
    });

  team
    .command("create")
    .requiredOption("--name <name>", "Team display name")
    .requiredOption("--description <description>", "Team description")
    .requiredOption("--goal <goal>", "Team goal")
    .option("--kpi <kpi>", "KPI identifier (repeatable)", collectValue, [] as string[])
    .option("--team-id <teamId>", "Override team id (team-*)")
    .option("--auto-roles <roles>", "Comma-separated role list (builder,pm,growth_marketer)")
    .option("--business-type <type>", "affiliate_marketing|content_creator|saas|custom")
    .option("--with-cluster", "Create/update team-cluster metadata in office-objects sidecar", false)
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        name: string;
        description: string;
        goal: string;
        kpi: string[];
        teamId?: string;
        autoRoles?: string;
        businessType?: string;
        withCluster?: boolean;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.meta.write");
        const businessType = opts.businessType?.trim() ? parseBusinessType(opts.businessType.trim()) : undefined;
        let company = await store.readCompanyModel();
        if (businessType) {
          company = ensureBusinessHeartbeatProfiles(company);
        }
        const slug = toSlug(opts.name) || `${Date.now()}`;
        const teamId = opts.teamId?.trim() || `team-proj-${slug}`;
        const projectId = projectIdFromTeamId(teamId);
        if (company.projects.some((entry) => entry.id === projectId)) {
          fail(`team_exists:${teamId}`);
        }
        const kpis = normalizeKpis(opts.kpi);
        const project = {
          id: projectId,
          departmentId: company.departments[1]?.id ?? company.departments[0]?.id ?? "dept-products",
          name: opts.name.trim(),
          githubUrl: "",
          status: "active" as const,
          goal: opts.goal.trim(),
          kpis,
          ...(businessType ? { businessConfig: defaultBusinessConfig(businessType) } : {}),
          account: {
            id: `${projectId}:account`,
            projectId,
            currency: "USD",
            balanceCents: 0,
            updatedAt: new Date().toISOString(),
          },
          accountEvents: [],
          ledger: [],
          experiments: [],
          metricEvents: [],
          resources: businessType ? defaultProjectResources(projectId) : [],
          resourceEvents: [],
        };
        let nextCompany: CompanyModel = {
          ...company,
          projects: [...company.projects, project],
        };
        let createdAgents: CompanyAgentModel[] = [];
        if (businessType) {
          const businessAgents = buildBusinessAgents(projectId, toSlug(project.name) || slug);
          createdAgents = businessAgents;
          nextCompany = {
            ...nextCompany,
            roleSlots: [...nextCompany.roleSlots, ...buildBusinessRoleSlots(projectId)],
            agents: [...nextCompany.agents, ...businessAgents],
          };
          await copyBusinessHeartbeatTemplates(businessAgents.map((agent) => agent.agentId));
          await upsertBusinessCronJobs(projectId, businessAgents.map((agent) => agent.agentId));
        } else if (opts.autoRoles?.trim()) {
          const roles = parseRoles(opts.autoRoles);
          createdAgents = buildAutoAgents(projectId, toSlug(project.name) || slug, roles);
          nextCompany = {
            ...nextCompany,
            roleSlots: [...nextCompany.roleSlots, ...buildAutoRoleSlots(projectId, roles)],
            agents: [...nextCompany.agents, ...createdAgents],
          };
        }
        await store.writeCompanyModel(nextCompany);
        await provisionOpenclawAgents({
          store,
          agents: createdAgents,
          projectName: project.name,
        });
        if (opts.withCluster) {
          const officeObjects = await store.readOfficeObjects();
          const nextObjects = upsertTeamCluster(officeObjects, {
            teamId,
            name: project.name,
            description: opts.description.trim(),
          });
          await store.writeOfficeObjects(nextObjects);
        }
        formatOutput(opts.json ? "json" : "text", { ok: true, teamId, projectId }, `Created ${teamId} -> ${projectId}`);
      },
    );

  team
    .command("update")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--name <name>", "New name")
    .option("--description <description>", "New description (stored in team cluster metadata if present)")
    .option("--goal <goal>", "New team goal")
    .option("--kpi-add <kpi>", "Add KPI (repeatable)", collectValue, [] as string[])
    .option("--kpi-remove <kpi>", "Remove KPI (repeatable)", collectValue, [] as string[])
    .option("--kpi-set <kpi>", "Replace KPI set (repeatable)", collectValue, [] as string[])
    .option("--clear-kpis", "Clear all KPIs before apply", false)
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        name?: string;
        description?: string;
        goal?: string;
        kpiAdd: string[];
        kpiRemove: string[];
        kpiSet: string[];
        clearKpis?: boolean;
        json?: boolean;
      }) => {
        const touchesMeta = Boolean(opts.name?.trim() || opts.description?.trim() || opts.goal?.trim());
        const touchesKpi = opts.kpiAdd.length > 0 || opts.kpiRemove.length > 0 || opts.kpiSet.length > 0 || opts.clearKpis === true;
        if (touchesMeta) ensureCommandPermission("team.meta.write");
        if (touchesKpi) ensureCommandPermission("team.kpi.write");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const removeSet = new Set(normalizeKpis(opts.kpiRemove));
        const addKpis = normalizeKpis(opts.kpiAdd);
        const setKpis = normalizeKpis(opts.kpiSet);
        const baseKpis = setKpis.length > 0 ? setKpis : opts.clearKpis ? [] : project.kpis;
        const nextKpis = normalizeKpis([...baseKpis.filter((item) => !removeSet.has(item)), ...addKpis]);
        const nextProject = {
          ...project,
          name: opts.name?.trim() ? opts.name.trim() : project.name,
          goal: opts.goal?.trim() ? opts.goal.trim() : project.goal,
          kpis: nextKpis,
        };
        const nextCompany: CompanyModel = {
          ...company,
          projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
        };
        await store.writeCompanyModel(nextCompany);

        if (opts.description?.trim()) {
          const officeObjects = await store.readOfficeObjects();
          const nextObjects = upsertTeamCluster(officeObjects, {
            teamId: opts.teamId.trim(),
            name: nextProject.name,
            description: opts.description.trim(),
          });
          await store.writeOfficeObjects(nextObjects);
        }
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, kpis: nextKpis },
          `Updated ${opts.teamId}`,
        );
      },
    );

  team
    .command("archive")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--deregister-openclaw", "Remove archived team agents from openclaw.json agents.list", false)
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; deregisterOpenclaw?: boolean; json?: boolean }) => {
      ensureCommandPermission("team.archive");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const archivedAgentIds = company.agents.filter((agent) => agent.projectId === projectId).map((agent) => agent.agentId);
      const nextCompany: CompanyModel = {
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...project,
                status: "archived",
              }
            : entry,
        ),
        roleSlots: company.roleSlots.map((slot) =>
          slot.projectId === projectId
            ? {
                ...slot,
                desiredCount: 0,
              }
            : slot,
        ),
        agents: company.agents.map((agent) =>
          agent.projectId === projectId
            ? {
                ...agent,
                lifecycleState: "retired",
              }
            : agent,
        ),
      };
      await store.writeCompanyModel(nextCompany);
      if (opts.deregisterOpenclaw) {
        await deregisterOpenclawAgents({
          store,
          agentIds: archivedAgentIds,
        });
      }
      formatOutput(opts.json ? "json" : "text", { ok: true, teamId: opts.teamId }, `Archived ${opts.teamId}`);
    });

  const kpi = team.command("kpi").description("Manage team KPI set");
  kpi
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--kpi <kpi>", "KPI identifier (repeatable)", collectValue, [] as string[])
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; kpi: string[]; json?: boolean }) => {
      ensureCommandPermission("team.kpi.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const nextKpis = normalizeKpis(opts.kpi);
      const nextCompany: CompanyModel = {
        ...company,
        projects: company.projects.map((entry) => (entry.id === projectId ? { ...project, kpis: nextKpis } : entry)),
      };
      await store.writeCompanyModel(nextCompany);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, kpis: nextKpis },
        `Set ${nextKpis.length} KPI(s) for ${opts.teamId}`,
      );
    });
  kpi
    .command("clear")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.kpi.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const nextCompany: CompanyModel = {
        ...company,
        projects: company.projects.map((entry) => (entry.id === projectId ? { ...project, kpis: [] } : entry)),
      };
      await store.writeCompanyModel(nextCompany);
      formatOutput(opts.json ? "json" : "text", { ok: true, teamId: opts.teamId, projectId, kpis: [] }, `Cleared KPIs for ${opts.teamId}`);
    });

  const roleSlot = team.command("role-slot").description("Manage team role slots");
  roleSlot
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--role <role>", "Role: builder|pm|growth_marketer|biz_pm|biz_executor")
    .requiredOption("--desired-count <count>", "Desired count", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 0) fail(`invalid_desired_count:${value}`);
      return parsed;
    })
    .option("--spawn-policy <policy>", "queue_pressure|manual", "queue_pressure")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        role: string;
        desiredCount: number;
        spawnPolicy: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.meta.write");
        const company = await store.readCompanyModel();
        const projectId = projectIdFromTeamId(opts.teamId);
        if (!company.projects.some((entry) => entry.id === projectId)) fail(`team_not_found:${opts.teamId}`);
        const role = parseRoleSlotRole(opts.role);
        const spawnPolicy = parseSpawnPolicy(opts.spawnPolicy);
        const nextRoleSlots = company.roleSlots.filter((slot) => !(slot.projectId === projectId && slot.role === role));
        nextRoleSlots.push({
          projectId,
          role,
          desiredCount: opts.desiredCount,
          spawnPolicy,
        });
        await store.writeCompanyModel({
          ...company,
          roleSlots: nextRoleSlots,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, role, desiredCount: opts.desiredCount, spawnPolicy },
          `Role slot updated for ${opts.teamId} (${role})`,
        );
      },
    );

  const business = team.command("business").description("Manage business configuration for a team");
  business
    .command("get")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const payload = {
        ok: true,
        teamId: opts.teamId,
        projectId,
        businessConfig: project.businessConfig ?? null,
        trackingContext: project.trackingContext ?? "",
      };
      formatOutput(
        opts.json ? "json" : "text",
        payload,
        project.businessConfig
          ? `${opts.teamId} | type=${project.businessConfig.type} | measure=${project.businessConfig.slots.measure.skillId} | execute=${project.businessConfig.slots.execute.skillId} | distribute=${project.businessConfig.slots.distribute.skillId}`
          : `${opts.teamId} has no business config`,
      );
    });
  const businessContext = business.command("context").description("Manage freeform business tracking context");
  businessContext
    .command("get")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const text = project.trackingContext ?? "";
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, trackingContext: text },
        text ? text : `${opts.teamId} has no tracking context`,
      );
    });
  businessContext
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--text <text>", "Tracking context text")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; text: string; json?: boolean }) => {
      ensureCommandPermission("team.business.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const nextText = opts.text.trim();
      const nextProject = nextText
        ? { ...project, trackingContext: nextText }
        : (() => {
            const { trackingContext: _trackingContext, ...rest } = project;
            return rest;
          })();
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, trackingContext: nextText },
        `Updated business tracking context for ${opts.teamId}`,
      );
    });
  business
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--slot <slot>", "Capability slot: measure|execute|distribute")
    .requiredOption("--skill-id <skillId>", "Skill identifier for selected slot")
    .option("--business-type <type>", "affiliate_marketing|content_creator|saas|custom")
    .option("--config-json <json>", "JSON object for slot config")
    .option("--config <entry>", "Config key=value (repeatable)", collectConfigEntry, [] as ConfigEntry[])
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        slot: string;
        skillId: string;
        businessType?: string;
        configJson?: string;
        config: ConfigEntry[];
        json?: boolean;
      }) => {
        ensureCommandPermission("team.business.write");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const slot = parseCapabilityCategory(opts.slot);
        const skillId = opts.skillId.trim();
        if (!skillId) fail("invalid_skill_id");
        const baseConfig = opts.configJson?.trim() ? parseConfigJson(opts.configJson.trim()) : {};
        const extraConfig = normalizeConfigEntries(opts.config);
        const mergedConfig = { ...baseConfig, ...extraConfig };
        const currentBusinessConfig =
          project.businessConfig ??
          defaultBusinessConfig(opts.businessType?.trim() ? parseBusinessType(opts.businessType.trim()) : "custom");
        const nextType = opts.businessType?.trim() ? parseBusinessType(opts.businessType.trim()) : currentBusinessConfig.type;
        const nextBusinessConfig: BusinessConfigModel = {
          type: nextType,
          slots: {
            measure: { ...currentBusinessConfig.slots.measure },
            execute: { ...currentBusinessConfig.slots.execute },
            distribute: { ...currentBusinessConfig.slots.distribute },
          },
        };
        const existingSlot = nextBusinessConfig.slots[slot];
        nextBusinessConfig.slots[slot] = {
          skillId,
          category: slot,
          config: Object.keys(mergedConfig).length > 0 ? mergedConfig : existingSlot.config,
        } satisfies CapabilitySlotModel;
        const nextProject = {
          ...project,
          businessConfig: nextBusinessConfig,
          account: project.account ?? ensureProjectAccount(projectId, project),
          accountEvents: project.accountEvents ?? [],
          ledger: project.ledger ?? [],
          experiments: project.experiments ?? [],
          metricEvents: project.metricEvents ?? [],
          resources: project.resources ?? defaultProjectResources(projectId),
          resourceEvents: project.resourceEvents ?? [],
        };
        const nextCompany: CompanyModel = {
          ...company,
          projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
        };
        await store.writeCompanyModel(nextCompany);
        formatOutput(
          opts.json ? "json" : "text",
          {
            ok: true,
            teamId: opts.teamId,
            projectId,
            businessType: nextBusinessConfig.type,
            slot,
            skillId,
            config: nextBusinessConfig.slots[slot].config,
          },
          `Updated business slot '${slot}' for ${opts.teamId}`,
        );
      },
    );
  business
    .command("set-all")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--business-type <type>", "affiliate_marketing|content_creator|saas|custom")
    .requiredOption("--measure-skill-id <skillId>", "Measure slot skill id")
    .requiredOption("--execute-skill-id <skillId>", "Execute slot skill id")
    .requiredOption("--distribute-skill-id <skillId>", "Distribute slot skill id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        businessType: string;
        measureSkillId: string;
        executeSkillId: string;
        distributeSkillId: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.business.write");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const nextType = parseBusinessType(opts.businessType.trim());
        const nextBusinessConfig: BusinessConfigModel = {
          type: nextType,
          slots: {
            measure: { category: "measure", skillId: opts.measureSkillId.trim(), config: project.businessConfig?.slots.measure.config ?? {} },
            execute: { category: "execute", skillId: opts.executeSkillId.trim(), config: project.businessConfig?.slots.execute.config ?? {} },
            distribute: { category: "distribute", skillId: opts.distributeSkillId.trim(), config: project.businessConfig?.slots.distribute.config ?? {} },
          },
        };
        const nextProject = {
          ...project,
          businessConfig: nextBusinessConfig,
          account: project.account ?? ensureProjectAccount(projectId, project),
          accountEvents: project.accountEvents ?? [],
          resources: project.resources ?? defaultProjectResources(projectId),
          resourceEvents: project.resourceEvents ?? [],
          ledger: project.ledger ?? [],
          experiments: project.experiments ?? [],
          metricEvents: project.metricEvents ?? [],
        };
        await store.writeCompanyModel({
          ...company,
          projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, businessConfig: nextBusinessConfig },
          `Updated all business slots for ${opts.teamId}`,
        );
      },
    );
  business
    .command("equip-skills")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--mode <mode>", "replace_minimum|append_only", "replace_minimum")
    .option("--dry-run", "Preview without writing openclaw.json", false)
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        mode: string;
        dryRun?: boolean;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.business.write");
        const mode = opts.mode.trim() as BusinessEquipMode;
        if (mode !== "replace_minimum" && mode !== "append_only") {
          fail(`invalid_mode:${opts.mode}`);
        }
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const pmAgent = company.agents.find((entry) => entry.projectId === projectId && entry.role === "biz_pm");
        const executorAgent = company.agents.find((entry) => entry.projectId === projectId && entry.role === "biz_executor");
        if (!pmAgent || !executorAgent) {
          fail(`business_agents_missing:${opts.teamId}`);
        }
        const targets = buildTeamBusinessSkillTargets(project);
        const targetByAgentId = new Map<string, string[]>([
          [pmAgent.agentId, targets.pmSkills],
          [executorAgent.agentId, targets.executorSkills],
        ]);

        const openclawConfig = await store.readOpenclawConfig();
        const agentsNode = asRecord(openclawConfig.agents);
        const currentList = Array.isArray(agentsNode.list) ? [...agentsNode.list] : [];
        const touchedAgents: string[] = [];
        const missingAgents: string[] = [];
        const preview: Array<{
          agentId: string;
          role: BusinessTeamRole;
          mode: BusinessEquipMode;
          beforeSkills: string[];
          afterSkills: string[];
        }> = [];
        const nextList = currentList.map((entry) => {
          const row = asRecord(entry);
          const id = typeof row.id === "string" ? row.id.trim() : "";
          if (!id || !targetByAgentId.has(id)) return row;
          const targetSkills = targetByAgentId.get(id) ?? [];
          const existingSkills = Array.isArray(row.skills)
            ? row.skills.filter((item): item is string => typeof item === "string")
            : [];
          const nextSkills = applyAgentSkillsByMode(existingSkills, targetSkills, mode);
          touchedAgents.push(id);
          preview.push({
            agentId: id,
            role: id === pmAgent.agentId ? "biz_pm" : "biz_executor",
            mode,
            beforeSkills: existingSkills,
            afterSkills: nextSkills,
          });
          return {
            ...row,
            skills: nextSkills,
          };
        });
        for (const agentId of [pmAgent.agentId, executorAgent.agentId]) {
          if (!touchedAgents.includes(agentId)) missingAgents.push(agentId);
        }
        if (!opts.dryRun) {
          const nextConfig = {
            ...openclawConfig,
            agents: {
              ...agentsNode,
              list: nextList,
            },
          } as Record<string, unknown>;
          await store.writeOpenclawConfig(nextConfig);
        }
        const payload = {
          ok: true,
          teamId: opts.teamId,
          projectId,
          mode,
          dryRun: Boolean(opts.dryRun),
          touchedAgents,
          missingAgents,
          preview,
        };
        formatOutput(
          opts.json ? "json" : "text",
          payload,
          `Equipped skills for ${opts.teamId}: touched=${touchedAgents.length} missing=${missingAgents.length} dryRun=${opts.dryRun ? "yes" : "no"}`,
        );
      },
    );
  business
    .command("sync-workspace-skills")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--dry-run", "Preview workspace sync without writing files", false)
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; dryRun?: boolean; json?: boolean }) => {
      ensureCommandPermission("team.business.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const pmAgent = company.agents.find((entry) => entry.projectId === projectId && entry.role === "biz_pm");
      const executorAgent = company.agents.find((entry) => entry.projectId === projectId && entry.role === "biz_executor");
      if (!pmAgent || !executorAgent) fail(`business_agents_missing:${opts.teamId}`);
      const targets = buildTeamBusinessSkillTargets(project);
      const targetByAgentId = new Map<string, string[]>([
        [pmAgent.agentId, targets.pmSkills],
        [executorAgent.agentId, targets.executorSkills],
      ]);
      const stateRoot = resolveOpenclawStateRoot();
      const openclawConfig = await store.readOpenclawConfig();
      const skillsRoot = path.resolve(process.cwd(), "skills");
      const rows: Array<{
        agentId: string;
        role: BusinessTeamRole;
        workspacePath: string;
        targetSkills: string[];
        copiedSkills: string[];
        unchangedSkills: string[];
        missingSourceSkills: string[];
        staleWorkspaceSkills: string[];
      }> = [];
      const missingAgents: string[] = [];
      for (const [agentId, targetSkills] of targetByAgentId.entries()) {
        const workspacePath = tryResolveWorkspaceFromOpenclawConfig(openclawConfig, stateRoot, agentId);
        const hasWorkspace = await pathExists(workspacePath);
        const existingSkillDirs = hasWorkspace ? await readdir(path.join(workspacePath, "skills")).catch(() => [] as string[]) : [];
        if (!hasWorkspace) missingAgents.push(agentId);
        const copiedSkills: string[] = [];
        const unchangedSkills: string[] = [];
        const missingSourceSkills: string[] = [];
        for (const skillId of targetSkills) {
          const sourcePath = await resolveSkillSourceDirectory(skillsRoot, skillId);
          if (!sourcePath) {
            missingSourceSkills.push(skillId);
            continue;
          }
          const destinationPath = path.join(workspacePath, "skills", skillId);
          const alreadyPresent = await pathExists(destinationPath);
          if (alreadyPresent) unchangedSkills.push(skillId);
          else copiedSkills.push(skillId);
          if (!opts.dryRun) {
            await mkdir(path.dirname(destinationPath), { recursive: true });
            await cp(sourcePath, destinationPath, { recursive: true, force: true });
          }
        }
        const staleWorkspaceSkills = existingSkillDirs.filter((skillId) => !targetSkills.includes(skillId));
        rows.push({
          agentId,
          role: agentId === pmAgent.agentId ? "biz_pm" : "biz_executor",
          workspacePath,
          targetSkills,
          copiedSkills,
          unchangedSkills,
          missingSourceSkills,
          staleWorkspaceSkills,
        });
      }
      const payload = {
        ok: true,
        teamId: opts.teamId,
        projectId,
        dryRun: Boolean(opts.dryRun),
        missingAgents,
        rows,
      };
      formatOutput(
        opts.json ? "json" : "text",
        payload,
        `Synced workspace skills for ${opts.teamId}: copied=${rows.reduce((sum, row) => sum + row.copiedSkills.length, 0)} dryRun=${opts.dryRun ? "yes" : "no"}`,
      );
    });

  const resources = team.command("resources").description("Manage advisory resources for a team");
  resources
    .command("list")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const rows = project.resources ?? [];
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, resources: rows },
        rows.length === 0
          ? `${opts.teamId} has no resources`
          : rows
              .map((entry) => `${entry.id} | ${entry.type} | ${entry.remaining}/${entry.limit} ${entry.unit}`)
              .join("\n"),
      );
    });
  resources
    .command("events")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--limit <limit>", "Max events to show", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) fail(`invalid_limit:${value}`);
      return parsed;
    }, 20)
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; limit: number; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const rows = (project.resourceEvents ?? []).slice().reverse().slice(0, opts.limit);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, events: rows },
        rows.length === 0
          ? `${opts.teamId} has no resource events`
          : rows
              .map((entry) => `${entry.ts} | ${entry.kind} | ${entry.resourceId} | delta=${entry.delta} | after=${entry.remainingAfter}`)
              .join("\n"),
      );
    });
  resources
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--type <type>", "cash_budget|api_quota|distribution_slots|custom")
    .option("--resource-id <resourceId>", "Resource id override")
    .option("--name <name>", "Display name")
    .option("--unit <unit>", "Unit label")
    .requiredOption("--remaining <value>", "Remaining amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_remaining:${value}`);
      return parsed;
    })
    .requiredOption("--limit <value>", "Limit amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_limit:${value}`);
      return parsed;
    })
    .option("--reserved <value>", "Reserved amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_reserved:${value}`);
      return parsed;
    })
    .option("--tracker-skill-id <skillId>", "Resource tracker skill id")
    .option("--refresh-cadence-minutes <minutes>", "Refresh cadence in minutes", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) fail(`invalid_refresh_cadence:${value}`);
      return parsed;
    })
    .option("--soft-limit <value>", "Soft limit", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_soft_limit:${value}`);
      return parsed;
    })
    .option("--hard-limit <value>", "Hard limit", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_hard_limit:${value}`);
      return parsed;
    })
    .option("--when-low <mode>", "warn|deprioritize_expensive_tasks|ask_pm_review", "warn")
    .option("--event-kind <kind>", "refresh|consumption|adjustment", "adjustment")
    .option("--source <source>", "Event source", "team.resources.set")
    .option("--note <note>", "Event note")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        type: string;
        resourceId?: string;
        name?: string;
        unit?: string;
        remaining: number;
        limit: number;
        reserved?: number;
        trackerSkillId?: string;
        refreshCadenceMinutes?: number;
        softLimit?: number;
        hardLimit?: number;
        whenLow: string;
        eventKind: string;
        source: string;
        note?: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.resources.write");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const type = parseResourceKind(opts.type);
        const resourceId = opts.resourceId?.trim() || defaultResourceId(projectId, type);
        const existingResources = project.resources ?? defaultProjectResources(projectId);
        const existing = existingResources.find((entry) => entry.id === resourceId);
        const trackerSkillId =
          opts.trackerSkillId?.trim() ||
          existing?.trackerSkillId ||
          (type === "cash_budget"
            ? "resource-cash-tracker"
            : type === "api_quota"
              ? "resource-api-quota-tracker"
              : type === "distribution_slots"
                ? "resource-distribution-tracker"
                : "resource-custom-tracker");
        const nextResource: ProjectResourceModel = {
          id: resourceId,
          projectId,
          type,
          name: opts.name?.trim() || existing?.name || type,
          unit: opts.unit?.trim() || existing?.unit || (type === "cash_budget" ? "usd_cents" : "units"),
          remaining: opts.remaining,
          limit: opts.limit,
          ...(typeof opts.reserved === "number" ? { reserved: opts.reserved } : existing?.reserved !== undefined ? { reserved: existing.reserved } : {}),
          trackerSkillId,
          ...(typeof opts.refreshCadenceMinutes === "number"
            ? { refreshCadenceMinutes: opts.refreshCadenceMinutes }
            : existing?.refreshCadenceMinutes !== undefined
              ? { refreshCadenceMinutes: existing.refreshCadenceMinutes }
              : {}),
          policy: {
            advisoryOnly: true,
            ...(typeof opts.softLimit === "number" ? { softLimit: opts.softLimit } : existing?.policy.softLimit !== undefined ? { softLimit: existing.policy.softLimit } : {}),
            ...(typeof opts.hardLimit === "number" ? { hardLimit: opts.hardLimit } : existing?.policy.hardLimit !== undefined ? { hardLimit: existing.policy.hardLimit } : {}),
            whenLow:
              opts.whenLow === "deprioritize_expensive_tasks" || opts.whenLow === "ask_pm_review" ? opts.whenLow : "warn",
          },
          ...(existing?.metadata ? { metadata: existing.metadata } : {}),
        };
        const nextResources = existingResources.filter((entry) => entry.id !== resourceId);
        nextResources.push(nextResource);
        const prevRemaining = existing?.remaining ?? 0;
        const event: ResourceEventModel = {
          id: `resource-event-${projectId}-${Date.now()}`,
          projectId,
          resourceId,
          ts: new Date().toISOString(),
          kind: parseResourceEventKind(opts.eventKind),
          delta: nextResource.remaining - prevRemaining,
          remainingAfter: nextResource.remaining,
          source: opts.source,
          ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
        };
        const nextProject = {
          ...project,
          account: project.account ?? ensureProjectAccount(projectId, project),
          accountEvents: project.accountEvents ?? [],
          resources: nextResources,
          resourceEvents: [...(project.resourceEvents ?? []), event],
          ledger: project.ledger ?? [],
          experiments: project.experiments ?? [],
          metricEvents: project.metricEvents ?? [],
        };
        await store.writeCompanyModel({
          ...company,
          projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
        });
        await tryLogCliActivity({
          projectId,
          teamId: opts.teamId.trim(),
          activityType: "status",
          label: `resource_set:${resourceId}`,
          detail: `remaining=${nextResource.remaining} limit=${nextResource.limit}`,
          source: opts.source,
          beatId: opts.beatId,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, resourceId, remaining: nextResource.remaining, limit: nextResource.limit },
          `Updated resource '${resourceId}' for ${opts.teamId}`,
        );
      },
    );
  resources
    .command("refresh")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--resource-id <resourceId>", "Resource id")
    .requiredOption("--remaining <value>", "Remaining amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_remaining:${value}`);
      return parsed;
    })
    .option("--source <source>", "Event source", "resource_tracker")
    .option("--note <note>", "Event note")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; resourceId: string; remaining: number; source: string; note?: string; beatId?: string; json?: boolean }) => {
      ensureCommandPermission("team.resources.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const existingResources = project.resources ?? defaultProjectResources(projectId);
      const current = existingResources.find((entry) => entry.id === opts.resourceId.trim());
      if (!current) fail(`resource_not_found:${opts.resourceId}`);
      const nextResources = existingResources.map((entry) =>
        entry.id === current.id
          ? {
              ...entry,
              remaining: opts.remaining,
            }
          : entry,
      );
      const event: ResourceEventModel = {
        id: `resource-event-${projectId}-${Date.now()}`,
        projectId,
        resourceId: current.id,
        ts: new Date().toISOString(),
        kind: "refresh",
        delta: opts.remaining - current.remaining,
        remainingAfter: opts.remaining,
        source: opts.source,
        ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
      };
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...entry,
                resources: nextResources,
                resourceEvents: [...(entry.resourceEvents ?? []), event],
              }
            : entry,
        ),
      });
      await tryLogCliActivity({
        projectId,
        teamId: opts.teamId.trim(),
        activityType: "status",
        label: `resource_refresh:${current.id}`,
        detail: `remaining=${opts.remaining}`,
        source: opts.source,
        beatId: opts.beatId,
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, resourceId: current.id, remaining: opts.remaining },
        `Refreshed resource '${current.id}' for ${opts.teamId}`,
      );
    });
  resources
    .command("remove")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--resource-id <resourceId>", "Resource id")
    .option("--source <source>", "Event source", "team.resources.remove")
    .option("--note <note>", "Event note")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; resourceId: string; source: string; note?: string; beatId?: string; json?: boolean }) => {
      ensureCommandPermission("team.resources.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const resourceId = opts.resourceId.trim();
      const existing = (project.resources ?? []).find((entry) => entry.id === resourceId);
      if (!existing) fail(`resource_not_found:${opts.resourceId}`);
      const event: ResourceEventModel = {
        id: `resource-event-${projectId}-${Date.now()}`,
        projectId,
        resourceId,
        ts: new Date().toISOString(),
        kind: "adjustment",
        delta: -existing.remaining,
        remainingAfter: 0,
        source: opts.source,
        ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
      };
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...entry,
                resources: (entry.resources ?? []).filter((row) => row.id !== resourceId),
                resourceEvents: [...(entry.resourceEvents ?? []), event],
              }
            : entry,
        ),
      });
      await tryLogCliActivity({
        projectId,
        teamId: opts.teamId.trim(),
        activityType: "status",
        label: `resource_remove:${resourceId}`,
        detail: `removed_remaining=${existing.remaining}`,
        source: opts.source,
        beatId: opts.beatId,
      });
      formatOutput(opts.json ? "json" : "text", { ok: true, teamId: opts.teamId, resourceId }, `Removed resource '${resourceId}'`);
    });
  resources
    .command("reserve")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--resource-id <resourceId>", "Resource id")
    .requiredOption("--amount <amount>", "Reserve amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) fail(`invalid_amount:${value}`);
      return parsed;
    })
    .option("--source <source>", "Event source", "team.resources.reserve")
    .option("--note <note>", "Event note")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; resourceId: string; amount: number; source: string; note?: string; beatId?: string; json?: boolean }) => {
      ensureCommandPermission("team.resources.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const resources = project.resources ?? [];
      const current = resources.find((entry) => entry.id === opts.resourceId.trim());
      if (!current) fail(`resource_not_found:${opts.resourceId}`);
      const currentReserved = current.reserved ?? 0;
      const nextReserved = currentReserved + opts.amount;
      const nextResources = resources.map((entry) =>
        entry.id === current.id
          ? {
              ...entry,
              reserved: nextReserved,
            }
          : entry,
      );
      const event: ResourceEventModel = {
        id: `resource-event-${projectId}-${Date.now()}`,
        projectId,
        resourceId: current.id,
        ts: new Date().toISOString(),
        kind: "adjustment",
        delta: -opts.amount,
        remainingAfter: current.remaining,
        source: opts.source,
        ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
      };
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...entry,
                resources: nextResources,
                resourceEvents: [...(entry.resourceEvents ?? []), event],
              }
            : entry,
        ),
      });
      await tryLogCliActivity({
        projectId,
        teamId: opts.teamId.trim(),
        activityType: "executing",
        label: `resource_reserve:${current.id}`,
        detail: `amount=${opts.amount} reserved=${nextReserved}`,
        source: opts.source,
        beatId: opts.beatId,
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, resourceId: current.id, reserved: nextReserved },
        `Reserved ${opts.amount} on '${current.id}' (reserved=${nextReserved})`,
      );
    });
  resources
    .command("release")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--resource-id <resourceId>", "Resource id")
    .requiredOption("--amount <amount>", "Release amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) fail(`invalid_amount:${value}`);
      return parsed;
    })
    .option("--source <source>", "Event source", "team.resources.release")
    .option("--note <note>", "Event note")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; resourceId: string; amount: number; source: string; note?: string; beatId?: string; json?: boolean }) => {
      ensureCommandPermission("team.resources.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const resources = project.resources ?? [];
      const current = resources.find((entry) => entry.id === opts.resourceId.trim());
      if (!current) fail(`resource_not_found:${opts.resourceId}`);
      const currentReserved = current.reserved ?? 0;
      const nextReserved = Math.max(0, currentReserved - opts.amount);
      const nextResources = resources.map((entry) =>
        entry.id === current.id
          ? {
              ...entry,
              reserved: nextReserved,
            }
          : entry,
      );
      const event: ResourceEventModel = {
        id: `resource-event-${projectId}-${Date.now()}`,
        projectId,
        resourceId: current.id,
        ts: new Date().toISOString(),
        kind: "adjustment",
        delta: opts.amount,
        remainingAfter: current.remaining,
        source: opts.source,
        ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
      };
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...entry,
                resources: nextResources,
                resourceEvents: [...(entry.resourceEvents ?? []), event],
              }
            : entry,
        ),
      });
      await tryLogCliActivity({
        projectId,
        teamId: opts.teamId.trim(),
        activityType: "executing",
        label: `resource_release:${current.id}`,
        detail: `amount=${opts.amount} reserved=${nextReserved}`,
        source: opts.source,
        beatId: opts.beatId,
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, resourceId: current.id, reserved: nextReserved },
        `Released ${opts.amount} on '${current.id}' (reserved=${nextReserved})`,
      );
    });
  resources
    .command("seed-demo")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.resources.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const resources = project.resources && project.resources.length > 0 ? project.resources : defaultProjectResources(projectId);
      const now = new Date().toISOString();
      const events: ResourceEventModel[] = resources.map((resource) => ({
        id: `resource-event-${resource.id}-${Date.now()}`,
        projectId,
        resourceId: resource.id,
        ts: now,
        kind: "refresh",
        delta: 0,
        remainingAfter: resource.remaining,
        source: "team.resources.seed-demo",
        note: "Seed snapshot",
      }));
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...ensureProjectResources(entry),
                resourceEvents: [...(entry.resourceEvents ?? []), ...events],
              }
            : entry,
        ),
      });
      formatOutput(opts.json ? "json" : "text", { ok: true, teamId: opts.teamId, projectId }, `Seeded resource demo data for ${opts.teamId}`);
    });
  business
    .command("seed-demo")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.business.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const now = Date.now();
      const iso = (value: number): string => new Date(value).toISOString();
      const teamAgents = company.agents.filter((entry) => entry.projectId === projectId);
      const pmAgentId =
        teamAgents.find((entry) => entry.role === "biz_pm")?.agentId ??
        `${toSlug(project.name) || "team"}-pm`;
      const executorAgentId =
        teamAgents.find((entry) => entry.role === "biz_executor")?.agentId ??
        `${toSlug(project.name) || "team"}-executor`;
      const artefactVideoPath = `workspace-${executorAgentId}/artifacts/affiliate/veo-demo-v1.mp4`;
      const artefactCaptionPath = `workspace-${executorAgentId}/artifacts/affiliate/caption-demo-v1.txt`;
      const nextProject = {
        ...project,
        ledger: [
          ...(project.ledger ?? []),
          {
            id: `ledger-rev-${now}`,
            projectId,
            timestamp: iso(now - 60 * 60 * 1000),
            type: "revenue" as const,
            amount: 1234,
            currency: "USD",
            source: "amazon_associates",
            description: "Demo affiliate commission",
          },
          {
            id: `ledger-cost-${now}`,
            projectId,
            timestamp: iso(now - 45 * 60 * 1000),
            type: "cost" as const,
            amount: 219,
            currency: "USD",
            source: "openai_api",
            description: "Demo generation cost",
          },
        ],
        experiments: [
          ...(project.experiments ?? []),
          {
            id: `exp-${now}`,
            projectId,
            hypothesis: "Short hooks increase click-through rate",
            status: "completed" as const,
            startedAt: iso(now - 3 * 60 * 60 * 1000),
            endedAt: iso(now - 30 * 60 * 1000),
            results: "Variant B outperformed control by 24%",
            metricsBefore: { clicks: 42 },
            metricsAfter: { clicks: 52 },
          },
        ],
        metricEvents: [
          ...(project.metricEvents ?? []),
          {
            id: `metric-${now}`,
            projectId,
            timestamp: iso(now - 15 * 60 * 1000),
            source: "amazon_associates",
            metrics: {
              clicks: 240,
              ordered_items: 3,
              shipped_items: 2,
              conversion_rate: 1.25,
              revenue_cents: 1234,
              commission_cents: 876,
            },
          },
        ],
      };
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
      });
      const seededBoardTasks = [
        {
          taskId: `seed-${projectId}-research`,
          title: "Research trending AI affiliate products",
          status: "done" as BoardTaskStatus,
          priority: "high" as BoardTaskPriority,
          ownerAgentId: executorAgentId,
          detail: "Seeded demo task for SC11 pipeline: research complete with product shortlist.",
        },
        {
          taskId: `seed-${projectId}-create-content`,
          title: "Create affiliate short video (veo demo)",
          status: "in_progress" as BoardTaskStatus,
          priority: "high" as BoardTaskPriority,
          ownerAgentId: executorAgentId,
          detail: `Artifact path: ${artefactVideoPath}`,
        },
        {
          taskId: `seed-${projectId}-distribute`,
          title: "Distribute TikTok + Instagram post",
          status: "todo" as BoardTaskStatus,
          priority: "medium" as BoardTaskPriority,
          ownerAgentId: executorAgentId,
          detail: `Caption artifact: ${artefactCaptionPath}`,
        },
        {
          taskId: `seed-${projectId}-measure`,
          title: "Measure Amazon Associates results",
          status: "todo" as BoardTaskStatus,
          priority: "medium" as BoardTaskPriority,
          ownerAgentId: pmAgentId,
          detail: "Record clicks, ordered_items, shipped_items, conversion_rate, revenue_cents, commission_cents.",
        },
      ];
      let boardSeeded = false;
      for (const task of seededBoardTasks) {
        try {
          await postBoardCommand({
            projectId,
            command: "task_add",
            taskId: task.taskId,
            title: task.title,
            ownerAgentId: task.ownerAgentId,
            priority: task.priority,
            status: task.status,
            actorType: "operator",
            actorAgentId: "seed-demo",
            detail: task.detail,
          });
          boardSeeded = true;
        } catch {
          // Optional in seed path: still keep sidecar business demo data even without Convex.
        }
      }
      await tryLogCliActivity({
        projectId,
        teamId: opts.teamId.trim(),
        actorAgentId: pmAgentId,
        activityType: "planning",
        label: "seed_demo_planning",
        detail: "PM seeded affiliate marketing demo narrative.",
        source: "team.business.seed-demo",
      });
      await tryLogCliActivity({
        projectId,
        teamId: opts.teamId.trim(),
        actorAgentId: executorAgentId,
        activityType: "research",
        label: "seed_demo_research",
        detail: "Research task seeded with affiliate shortlist.",
        source: "team.business.seed-demo",
      });
      await tryLogCliActivity({
        projectId,
        teamId: opts.teamId.trim(),
        actorAgentId: executorAgentId,
        activityType: "executing",
        label: "seed_demo_video_generated",
        detail: `Generated demo artifact at ${artefactVideoPath} via infsh CLI simulation.`,
        source: "team.business.seed-demo",
      });
      await tryLogCliActivity({
        projectId,
        teamId: opts.teamId.trim(),
        actorAgentId: executorAgentId,
        activityType: "distributing",
        label: "seed_demo_distribution_ready",
        detail: `Distribution task prepared with caption artifact ${artefactCaptionPath}.`,
        source: "team.business.seed-demo",
      });
      formatOutput(
        opts.json ? "json" : "text",
        {
          ok: true,
          teamId: opts.teamId,
          projectId,
          boardSeeded,
          seededTasks: seededBoardTasks.map((task) => ({ taskId: task.taskId, status: task.status })),
          seededArtifacts: [artefactVideoPath, artefactCaptionPath],
        },
        `Seeded demo business data for ${opts.teamId} (board=${boardSeeded ? "yes" : "no"})`,
      );
    });
  business
    .command("generate-lamp-videos")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--count <count>", "Number of videos to generate", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10) fail(`invalid_count:${value}`);
      return parsed;
    }, 2)
    .option("--model <model>", "infsh model id", "google/veo-3-1-fast")
    .option("--spend-per-video-cents <amount>", "Ledger spend per video", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 0) fail(`invalid_spend_per_video_cents:${value}`);
      return parsed;
    }, 120)
    .option("--simulate", "Create deterministic local artifacts without running infsh", false)
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        count: number;
        model: string;
        spendPerVideoCents: number;
        simulate?: boolean;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.business.write");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const executorAgent =
          company.agents.find((entry) => entry.projectId === projectId && entry.role === "biz_executor") ??
          company.agents.find((entry) => entry.projectId === projectId);
        if (!executorAgent) fail(`team_executor_missing:${opts.teamId}`);
        const stateRoot = resolveOpenclawStateRoot();
        const openclawConfig = await store.readOpenclawConfig();
        const workspacePath = tryResolveWorkspaceFromOpenclawConfig(openclawConfig, stateRoot, executorAgent.agentId);
        const videoDir = path.join(workspacePath, "projects", projectId, "affiliate", "videos");
        await mkdir(videoDir, { recursive: true });
        const createdArtifacts: Array<{
          index: number;
          videoPath: string;
          captionPath: string;
          metadataPath: string;
          sourceRef?: string;
          prompt: string;
        }> = [];
        for (let index = 0; index < opts.count; index += 1) {
          const variant = index + 1;
          const prompt = `Create a vertical UGC ad video for a modern desk lamp. Variant ${variant}. Include: hook in first 2 seconds, clear benefit, and CTA to buy via affiliate link.`;
          const stamp = Date.now() + index;
          const baseName = `lamp-sell-v${variant}-${stamp}`;
          const videoPath = path.join(videoDir, `${baseName}.mp4`);
          const captionPath = path.join(videoDir, `${baseName}.caption.txt`);
          const metadataPath = path.join(videoDir, `${baseName}.json`);
          let sourceRef = "";
          if (opts.simulate) {
            await writeFile(videoPath, "SIMULATED_MP4_BINARY_PLACEHOLDER\n", "utf-8");
            sourceRef = "simulated://local-video";
          } else {
            const generation = await runInfshVideoGeneration(opts.model.trim(), prompt);
            const preferredRef = generation.refs.find((ref) => /\.mp4(\?.*)?$/i.test(ref)) ?? generation.refs[0] ?? "";
            if (!preferredRef) {
              fail(`infsh_video_ref_missing:variant=${variant}:stdout=${generation.stdout.slice(0, 200)}`);
            }
            sourceRef = preferredRef;
            if (/^https?:\/\//i.test(preferredRef)) {
              const response = await fetch(preferredRef);
              if (!response.ok) fail(`video_download_failed:${response.status}:${preferredRef}`);
              const bytes = Buffer.from(await response.arrayBuffer());
              await writeFile(videoPath, bytes);
            } else {
              const resolvedRef = preferredRef.startsWith("/") ? preferredRef : path.resolve(preferredRef);
              if (!(await pathExists(resolvedRef))) fail(`video_path_not_found:${preferredRef}`);
              await cp(resolvedRef, videoPath, { force: true });
            }
          }
          const caption = [
            "Brighten your desk setup with this minimalist LED lamp.",
            "Tap the affiliate link for today's best deal.",
            "#desksetup #homedecor #lighting #affiliate",
          ].join("\n");
          await writeFile(captionPath, `${caption}\n`, "utf-8");
          await writeFile(
            metadataPath,
            `${JSON.stringify(
              {
                projectId,
                teamId: opts.teamId,
                agentId: executorAgent.agentId,
                model: opts.model.trim(),
                prompt,
                sourceRef,
                createdAt: new Date(stamp).toISOString(),
              },
              null,
              2,
            )}\n`,
            "utf-8",
          );
          const relativeVideoPath = `workspace-${executorAgent.agentId}/projects/${projectId}/affiliate/videos/${path.basename(videoPath)}`;
          const relativeCaptionPath = `workspace-${executorAgent.agentId}/projects/${projectId}/affiliate/videos/${path.basename(captionPath)}`;
          const taskId = `lamp-${projectId}-${variant}`;
          try {
            await postBoardCommand({
              projectId,
              command: "task_add",
              taskId,
              title: `Create lamp promo video variant ${variant}`,
              ownerAgentId: executorAgent.agentId,
              priority: "high",
              status: "done",
              actorType: "operator",
              actorAgentId: "video-generator",
              detail: `Artifact path: ${relativeVideoPath}\nCaption path: ${relativeCaptionPath}`,
            });
          } catch {
            // Optional board write for local demo mode.
          }
          await tryLogCliActivity({
            projectId,
            teamId: opts.teamId.trim(),
            actorAgentId: executorAgent.agentId,
            activityType: "executing",
            label: "lamp_video_generated",
            detail: `Generated lamp video variant ${variant} at ${relativeVideoPath}`,
            source: "team.business.generate-lamp-videos",
          });
          createdArtifacts.push({
            index: variant,
            videoPath: relativeVideoPath,
            captionPath: relativeCaptionPath,
            metadataPath: `workspace-${executorAgent.agentId}/projects/${projectId}/affiliate/videos/${path.basename(metadataPath)}`,
            sourceRef,
            prompt,
          });
        }
        const totalSpend = opts.count * opts.spendPerVideoCents;
        const account = ensureProjectAccount(projectId, project);
        const nowIso = new Date().toISOString();
        const updatedBalance = Math.max(0, account.balanceCents - totalSpend);
        const accountEvent: ProjectAccountEventModel = {
          id: `acct-${projectId}-${Date.now()}`,
          projectId,
          accountId: account.id,
          timestamp: nowIso,
          type: "debit",
          amountCents: totalSpend,
          source: "inference_sh",
          note: `Generated ${opts.count} lamp videos via ${opts.model.trim()}`,
          balanceAfterCents: updatedBalance,
        };
        const ledgerEntries = createdArtifacts.map((artifact) => ({
          id: `ledger-lamp-${projectId}-${artifact.index}-${Date.now() + artifact.index}`,
          projectId,
          timestamp: nowIso,
          type: "cost" as const,
          amount: opts.spendPerVideoCents,
          currency: "USD",
          source: "inference_sh",
          description: `Lamp video variant ${artifact.index} generation`,
        }));
        const nextProject = {
          ...project,
          account: {
            ...account,
            balanceCents: updatedBalance,
            updatedAt: nowIso,
          },
          accountEvents: [...(project.accountEvents ?? []), accountEvent],
          ledger: [...(project.ledger ?? []), ...ledgerEntries],
        };
        await store.writeCompanyModel({
          ...company,
          projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
        });
        const payload = {
          ok: true,
          teamId: opts.teamId,
          projectId,
          model: opts.model.trim(),
          count: opts.count,
          simulated: Boolean(opts.simulate),
          totalSpendCents: totalSpend,
          artifacts: createdArtifacts,
        };
        formatOutput(
          opts.json ? "json" : "text",
          payload,
          `Generated ${createdArtifacts.length} lamp videos for ${opts.teamId} (${opts.simulate ? "simulated" : "infsh"})`,
        );
      },
    );

  const funds = team.command("funds").description("Manage team account funding and spend ledger");
  funds
    .command("balance")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const account = ensureProjectAccount(projectId, project);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, account },
        `${opts.teamId} | balance=${account.balanceCents} ${account.currency.toLowerCase()}_cents`,
      );
    });

  funds
    .command("deposit")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--amount <amount>", "Amount in cents")
    .requiredOption("--source <source>", "Funding source")
    .option("--note <note>", "Optional note")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; amount: string; source: string; note?: string; beatId?: string; json?: boolean }) => {
      ensureCommandPermission("team.business.write");
      const amount = Number(opts.amount);
      if (!Number.isFinite(amount) || amount <= 0) fail("invalid_amount_cents");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const account = ensureProjectAccount(projectId, project);
      const nextBalance = account.balanceCents + Math.round(amount);
      const nowIso = new Date().toISOString();
      const accountEvent: ProjectAccountEventModel = {
        id: `acct-event-${projectId}-${Date.now()}`,
        projectId,
        accountId: account.id,
        timestamp: nowIso,
        type: "credit",
        amountCents: Math.round(amount),
        source: opts.source.trim(),
        ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
        balanceAfterCents: nextBalance,
      };
      const ledgerEntry = {
        id: `ledger-revenue-${projectId}-${Date.now()}`,
        projectId,
        timestamp: nowIso,
        type: "revenue" as const,
        amount: Math.round(amount),
        currency: account.currency,
        source: opts.source.trim(),
        description: opts.note?.trim() || "Funds deposit",
      };
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...entry,
                account: {
                  ...account,
                  balanceCents: nextBalance,
                  updatedAt: nowIso,
                },
                accountEvents: [...(entry.accountEvents ?? []), accountEvent],
                ledger: [...(entry.ledger ?? []), ledgerEntry],
              }
            : entry,
        ),
      });
      await tryLogCliActivity({
        projectId,
        teamId: opts.teamId.trim(),
        activityType: "status",
        label: `funds_deposit:${Math.round(amount)}`,
        detail: `source=${opts.source.trim()} balance=${nextBalance}`,
        source: "team.funds.deposit",
        beatId: opts.beatId,
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, balanceCents: nextBalance, event: accountEvent },
        `Deposited ${Math.round(amount)} cents for ${opts.teamId}`,
      );
    });

  funds
    .command("spend")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--amount <amount>", "Amount in cents")
    .requiredOption("--source <source>", "Spend source")
    .option("--note <note>", "Optional note")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; amount: string; source: string; note?: string; beatId?: string; json?: boolean }) => {
      ensureCommandPermission("team.business.write");
      const amount = Number(opts.amount);
      if (!Number.isFinite(amount) || amount <= 0) fail("invalid_amount_cents");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const account = ensureProjectAccount(projectId, project);
      const roundedAmount = Math.round(amount);
      if (account.balanceCents < roundedAmount) fail("insufficient_funds");
      const nextBalance = account.balanceCents - roundedAmount;
      const nowIso = new Date().toISOString();
      const accountEvent: ProjectAccountEventModel = {
        id: `acct-event-${projectId}-${Date.now()}`,
        projectId,
        accountId: account.id,
        timestamp: nowIso,
        type: "debit",
        amountCents: roundedAmount,
        source: opts.source.trim(),
        ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
        balanceAfterCents: nextBalance,
      };
      const ledgerEntry = {
        id: `ledger-cost-${projectId}-${Date.now()}`,
        projectId,
        timestamp: nowIso,
        type: "cost" as const,
        amount: roundedAmount,
        currency: account.currency,
        source: opts.source.trim(),
        description: opts.note?.trim() || "Team spend",
      };
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...entry,
                account: {
                  ...account,
                  balanceCents: nextBalance,
                  updatedAt: nowIso,
                },
                accountEvents: [...(entry.accountEvents ?? []), accountEvent],
                ledger: [...(entry.ledger ?? []), ledgerEntry],
              }
            : entry,
        ),
      });
      await tryLogCliActivity({
        projectId,
        teamId: opts.teamId.trim(),
        activityType: "executing",
        label: `funds_spend:${roundedAmount}`,
        detail: `source=${opts.source.trim()} balance=${nextBalance}`,
        source: "team.funds.spend",
        beatId: opts.beatId,
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, balanceCents: nextBalance, event: accountEvent },
        `Recorded spend ${roundedAmount} cents for ${opts.teamId}`,
      );
    });

  funds
    .command("ledger")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--limit <limit>", "Limit entries", "20")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; limit: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const limit = Number.isFinite(Number(opts.limit)) ? Math.max(1, Math.min(200, Math.floor(Number(opts.limit)))) : 20;
      const rows = [...(project.accountEvents ?? [])]
        .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
        .slice(0, limit);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, count: rows.length, rows },
        rows
          .map((row) => `${row.timestamp} | ${row.type.toUpperCase()} | ${row.amountCents} usd_cents | source=${row.source}`)
          .join("\n") || `${opts.teamId} has no account events`,
      );
    });

  const board = team.command("board").description("Manage Convex-backed team board tasks");
  const boardTask = board.command("task").description("Task lifecycle commands");
  boardTask
    .command("add")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--title <title>", "Task title")
    .option("--task-id <taskId>", "Task id override")
    .option("--owner-agent-id <agentId>", "Assigned agent id")
    .option("--priority <priority>", "low|medium|high", "medium")
    .option("--status <status>", "todo|in_progress|blocked|done", "todo")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--detail <detail>", "Optional detail")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        title: string;
        taskId?: string;
        ownerAgentId?: string;
        priority: string;
        status: string;
        actorAgentId: string;
        beatId?: string;
        detail?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.board.write");
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const result = await postBoardCommand({
          projectId,
          command: "task_add",
          taskId: opts.taskId?.trim() || undefined,
          title: opts.title.trim(),
          ownerAgentId: opts.ownerAgentId?.trim() || undefined,
          priority: parseBoardTaskPriority(opts.priority),
          status: parseBoardTaskStatus(opts.status),
          actorType: "operator",
          actorAgentId: opts.actorAgentId.trim(),
          beatId: optionalBeatId(opts.beatId),
          detail: opts.detail?.trim() || undefined,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, result },
          `Added task ${(result.taskId as string | undefined) ?? "unknown"} for ${opts.teamId}`,
        );
      },
    );
  boardTask
    .command("move")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .requiredOption("--status <status>", "todo|in_progress|blocked|done")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--detail <detail>", "Optional detail")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; taskId: string; status: string; actorAgentId: string; beatId?: string; detail?: string; json?: boolean }) => {
      ensureCommandPermission("team.board.write");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId);
      const result = await postBoardCommand({
        projectId,
        command: "task_move",
        taskId: opts.taskId.trim(),
        status: parseBoardTaskStatus(opts.status),
        actorType: "operator",
        actorAgentId: opts.actorAgentId.trim(),
        beatId: optionalBeatId(opts.beatId),
        detail: opts.detail?.trim() || undefined,
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, result },
        `Moved task ${opts.taskId} to ${opts.status}`,
      );
    });
  boardTask
    .command("update")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .option("--title <title>", "Updated task title")
    .option("--detail <detail>", "Updated task detail/notes")
    .option("--due-at <timestamp>", "Due timestamp (ms epoch)", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) fail(`invalid_due_at:${value}`);
      return parsed;
    })
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        taskId: string;
        title?: string;
        detail?: string;
        dueAt?: number;
        actorAgentId: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.board.write");
        if (!opts.title?.trim() && !opts.detail?.trim() && typeof opts.dueAt !== "number") {
          fail("task_update_requires_change:title|detail|due-at");
        }
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const result = await postBoardCommand({
          projectId,
          command: "task_update",
          taskId: opts.taskId.trim(),
          title: opts.title?.trim() || undefined,
          detail: opts.detail?.trim() || undefined,
          dueAt: opts.dueAt,
          actorType: "operator",
          actorAgentId: opts.actorAgentId.trim(),
          beatId: optionalBeatId(opts.beatId),
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, result },
          `Updated task ${opts.taskId}`,
        );
      },
    );
  boardTask
    .command("delete")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; taskId: string; actorAgentId: string; beatId?: string; json?: boolean }) => {
      ensureCommandPermission("team.board.write");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId);
      const result = await postBoardCommand({
        projectId,
        command: "task_delete",
        taskId: opts.taskId.trim(),
        actorType: "operator",
        actorAgentId: opts.actorAgentId.trim(),
        beatId: optionalBeatId(opts.beatId),
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, result },
        `Deleted task ${opts.taskId}`,
      );
    });
  boardTask
    .command("assign")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .requiredOption("--owner-agent-id <agentId>", "Owner agent id")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; taskId: string; ownerAgentId: string; actorAgentId: string; beatId?: string; json?: boolean }) => {
      ensureCommandPermission("team.board.write");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId);
      const result = await postBoardCommand({
        projectId,
        command: "task_assign",
        taskId: opts.taskId.trim(),
        ownerAgentId: opts.ownerAgentId.trim(),
        actorType: "operator",
        actorAgentId: opts.actorAgentId.trim(),
        beatId: optionalBeatId(opts.beatId),
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, result },
        `Assigned task ${opts.taskId} to ${opts.ownerAgentId}`,
      );
    });
  boardTask
    .command("block")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .option("--reason <reason>", "Block reason")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; taskId: string; reason?: string; actorAgentId: string; beatId?: string; json?: boolean }) => {
      ensureCommandPermission("team.board.write");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId);
      const result = await postBoardCommand({
        projectId,
        command: "task_block",
        taskId: opts.taskId.trim(),
        actorType: "operator",
        actorAgentId: opts.actorAgentId.trim(),
        beatId: optionalBeatId(opts.beatId),
        detail: opts.reason?.trim() || undefined,
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, result },
        `Blocked task ${opts.taskId}`,
      );
    });
  boardTask
    .command("done")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .option("--note <note>", "Completion note")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; taskId: string; note?: string; actorAgentId: string; beatId?: string; json?: boolean }) => {
      ensureCommandPermission("team.board.write");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId);
      const result = await postBoardCommand({
        projectId,
        command: "task_done",
        taskId: opts.taskId.trim(),
        actorType: "operator",
        actorAgentId: opts.actorAgentId.trim(),
        beatId: optionalBeatId(opts.beatId),
        detail: opts.note?.trim() || undefined,
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, result },
        `Marked task ${opts.taskId} done`,
      );
    });
  boardTask
    .command("reopen")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .option("--note <note>", "Reopen note")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; taskId: string; note?: string; actorAgentId: string; beatId?: string; json?: boolean }) => {
      ensureCommandPermission("team.board.write");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId);
      const result = await postBoardCommand({
        projectId,
        command: "task_reopen",
        taskId: opts.taskId.trim(),
        actorType: "operator",
        actorAgentId: opts.actorAgentId.trim(),
        beatId: optionalBeatId(opts.beatId),
        detail: opts.note?.trim() || undefined,
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, result },
        `Reopened task ${opts.taskId}`,
      );
    });
  boardTask
    .command("reprioritize")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .requiredOption("--priority <priority>", "low|medium|high")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; taskId: string; priority: string; actorAgentId: string; beatId?: string; json?: boolean }) => {
      ensureCommandPermission("team.board.write");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId);
      const result = await postBoardCommand({
        projectId,
        command: "task_reprioritize",
        taskId: opts.taskId.trim(),
        priority: parseBoardTaskPriority(opts.priority),
        actorType: "operator",
        actorAgentId: opts.actorAgentId.trim(),
        beatId: optionalBeatId(opts.beatId),
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, result },
        `Reprioritized task ${opts.taskId} to ${opts.priority}`,
      );
    });
  boardTask
    .command("list")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--status <status>", "todo|in_progress|blocked|done")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; status?: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId);
      const data = await postBoardQuery({
        projectId,
        query: "tasks",
      });
      const tasks = Array.isArray((data as { tasks?: unknown[] })?.tasks) ? ((data as { tasks: unknown[] }).tasks as unknown[]) : [];
      const filtered =
        opts.status?.trim() && tasks.length > 0
          ? tasks.filter((entry) => {
              if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
              return (entry as { status?: string }).status === parseBoardTaskStatus(opts.status!.trim());
            })
          : tasks;
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, tasks: filtered },
        filtered.length === 0
          ? `${opts.teamId} has no board tasks`
          : filtered
              .map((row) => {
                const task = row as { taskId?: string; status?: string; priority?: string; title?: string; ownerAgentId?: string };
                return `${task.taskId ?? "unknown"} | ${task.status ?? "todo"} | ${task.priority ?? "medium"} | ${task.ownerAgentId ?? "unassigned"} | ${task.title ?? ""}`;
              })
              .join("\n"),
      );
    });

  const status = team.command("status").description("Manage explicit agent status reports");
  status
    .command("report")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--agent-id <agentId>", "Agent id")
    .requiredOption("--state <state>", "running|ok|no_work|error|idle|planning|executing|blocked|done")
    .requiredOption("--status-text <text>", "Current status detail")
    .option("--step-key <stepKey>", "Idempotency key")
    .option("--skill-id <skillId>", "Optional related skill id")
    .option("--session-key <sessionKey>", "Optional OpenClaw session key")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--source <source>", "Optional source label", "shellcorp_cli")
    .option("--occurred-at <epochMs>", "Optional occurred timestamp", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 0) fail(`invalid_occurred_at:${value}`);
      return parsed;
    })
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        agentId: string;
        state: string;
        statusText: string;
        stepKey?: string;
        skillId?: string;
        sessionKey?: string;
        beatId?: string;
        source?: string;
        occurredAt?: number;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.activity.write");
        const company = await store.readCompanyModel();
        resolveProjectOrFail(company, opts.teamId);
        const agentId = opts.agentId.trim();
        const state = parseStatusReportState(opts.state.trim());
        const statusText = opts.statusText.trim();
        if (!agentId) fail("invalid_agent_id");
        if (!statusText) fail("invalid_status_text");
        const stepKey = opts.stepKey?.trim() || `status-${agentId}-${Date.now()}`;
        const result = await postStatusReport({
          teamId: opts.teamId.trim(),
          agentId,
          state,
          statusText,
          stepKey,
          skillId: opts.skillId?.trim() || undefined,
          sessionKey: opts.sessionKey?.trim() || undefined,
          beatId: optionalBeatId(opts.beatId),
          source: opts.source?.trim() || "shellcorp_cli",
          occurredAt: opts.occurredAt,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, agentId, state, statusText, stepKey, result },
          `Reported status for ${agentId} (${state})`,
        );
      },
    );

  const bot = team.command("bot").description("Manage team command-bot activity logs");
  bot
    .command("log")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--agent-id <agentId>", "Agent id")
    .requiredOption("--activity-type <type>", "planning|research|executing|distributing|blocked|handoff|summary|status")
    .requiredOption("--label <label>", "Activity label")
    .option("--detail <detail>", "Activity detail")
    .option("--task-id <taskId>", "Task id context")
    .option("--skill-id <skillId>", "Skill id context")
    .option("--state <state>", "Optional task state context")
    .option("--step-key <stepKey>", "Idempotency key")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        agentId: string;
        activityType: string;
        label: string;
        detail?: string;
        taskId?: string;
        skillId?: string;
        state?: string;
        stepKey?: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.activity.write");
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const result = await postBoardCommand({
          projectId,
          command: "activity_log",
          actorType: "agent",
          actorAgentId: opts.agentId.trim(),
          activityType: parseBoardActivityType(opts.activityType),
          label: opts.label.trim(),
          detail: opts.detail?.trim() || undefined,
          taskId: opts.taskId?.trim() || undefined,
          skillId: opts.skillId?.trim() || undefined,
          status: opts.state?.trim() || undefined,
          stepKey: opts.stepKey?.trim() || undefined,
          beatId: optionalBeatId(opts.beatId),
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, result },
          `Logged activity for ${opts.agentId} (${opts.activityType})`,
        );
      },
    );
  bot
    .command("timeline")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--agent-id <agentId>", "Filter agent")
    .option("--limit <limit>", "Max rows", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) fail(`invalid_limit:${value}`);
      return parsed;
    }, 20)
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; agentId?: string; limit: number; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId);
      const data = await postBoardQuery({
        projectId,
        query: "activity",
        agentId: opts.agentId?.trim() || undefined,
        limit: opts.limit,
      });
      const rows = Array.isArray(data) ? data : [];
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, events: rows },
        rows.length === 0
          ? `${opts.teamId} has no activity events`
          : rows
              .map((row) => {
                const event = row as { occurredAt?: number; agentId?: string; activityType?: string; label?: string; taskId?: string };
                const at = typeof event.occurredAt === "number" ? new Date(event.occurredAt).toISOString() : "unknown-time";
                return `${at} | ${event.agentId ?? "unknown-agent"} | ${event.activityType ?? "status"} | ${event.label ?? ""} | ${event.taskId ?? "-"}`;
              })
              .join("\n"),
      );
    });
  bot
    .command("next")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--agent-id <agentId>", "Agent id for personalized ranking")
    .option("--limit <limit>", "Max rows", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) fail(`invalid_limit:${value}`);
      return parsed;
    }, 5)
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; agentId?: string; limit: number; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId);
      const rows = await postBoardQuery({
        projectId,
        query: "next",
        agentId: opts.agentId?.trim() || undefined,
        limit: opts.limit,
      });
      const list = Array.isArray(rows) ? rows : [];
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, candidates: list },
        list.length === 0
          ? `${opts.teamId} has no next candidates`
          : list
              .map((row) => {
                const candidate = row as { taskId?: string; priority?: string; status?: string; title?: string; ownerAgentId?: string };
                return `${candidate.taskId ?? "unknown"} | ${candidate.priority ?? "medium"} | ${candidate.status ?? "todo"} | ${candidate.ownerAgentId ?? "unassigned"} | ${candidate.title ?? ""}`;
              })
              .join("\n"),
      );
    });

  const heartbeat = team.command("heartbeat").description("Manage team heartbeat profile");
  heartbeat
    .command("render")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--role <role>", "Role: biz_pm|biz_executor")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; role: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      if (opts.role !== "biz_pm" && opts.role !== "biz_executor") fail(`invalid_role:${opts.role}`);
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const rendered = await renderBusinessHeartbeatTemplate({ role: opts.role, project });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, role: opts.role, rendered },
        rendered,
      );
    });
  heartbeat
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--cadence-minutes <minutes>", "Heartbeat cadence in minutes", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) fail(`invalid_cadence_minutes:${value}`);
      return parsed;
    })
    .requiredOption("--goal <goal>", "Heartbeat goal")
    .option("--team-description <text>", "Team description")
    .option("--product-details <text>", "Product details")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        cadenceMinutes: number;
        goal: string;
        teamDescription?: string;
        productDetails?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.heartbeat.write");
        const company = await store.readCompanyModel();
        const projectId = projectIdFromTeamId(opts.teamId);
        if (!company.projects.some((entry) => entry.id === projectId)) fail(`team_not_found:${opts.teamId}`);
        const withProfile = ensureHeartbeatProfile(company, projectId);
        const nextProfiles = withProfile.company.heartbeatProfiles.map((profile) =>
          profile.id === withProfile.profileId
            ? {
                ...profile,
                cadenceMinutes: opts.cadenceMinutes,
                goal: opts.goal.trim(),
                teamDescription: opts.teamDescription?.trim() || profile.teamDescription,
                productDetails: opts.productDetails?.trim() || profile.productDetails,
              }
            : profile,
        );
        const nextAgents = withProfile.company.agents.map((agent) =>
          agent.projectId === projectId
            ? {
                ...agent,
                heartbeatProfileId: withProfile.profileId,
              }
            : agent,
        );
        await store.writeCompanyModel({
          ...withProfile.company,
          heartbeatProfiles: nextProfiles,
          agents: nextAgents,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, heartbeatProfileId: withProfile.profileId },
          `Heartbeat updated for ${opts.teamId}`,
        );
      },
    );
  heartbeat
    .command("sync")
    .description("Hot-swap HEARTBEAT.md files from workspace templates")
    .option("--team-id <teamId>", "Optional team id (team-*). Defaults to all teams.")
    .option("--watch", "Watch template files and re-sync on changes", false)
    .option("--json", "Output JSON (non-watch mode only)", false)
    .action(async (opts: { teamId?: string; watch?: boolean; json?: boolean }) => {
      ensureCommandPermission("team.heartbeat.write");
      if (opts.watch && opts.json) {
        fail("invalid_options:--watch cannot be used with --json");
      }
      const runSync = async (): Promise<{ teamsTouched: number; heartbeatFilesWritten: number; teamsSkipped: number }> => {
        return syncTeamHeartbeatFiles({ store, teamId: opts.teamId?.trim() || undefined });
      };
      const firstResult = await runSync();
      if (!opts.watch) {
        formatOutput(
          opts.json ? "json" : "text",
          {
            ok: true,
            mode: "oneshot",
            teamId: opts.teamId?.trim() || null,
            ...firstResult,
          },
          `Heartbeat sync completed (${firstResult.heartbeatFilesWritten} file(s) across ${firstResult.teamsTouched} team(s))`,
        );
        return;
      }

      const templatesDir = path.resolve(process.cwd(), "templates", "workspace");
      console.log(
        `Heartbeat watch active in ${templatesDir}. Initial sync wrote ${firstResult.heartbeatFilesWritten} file(s) across ${firstResult.teamsTouched} team(s).`,
      );
      let syncInFlight = false;
      let syncQueued = false;
      const triggerSync = async (reason: string): Promise<void> => {
        if (syncInFlight) {
          syncQueued = true;
          return;
        }
        syncInFlight = true;
        try {
          let nextReason = reason;
          do {
            syncQueued = false;
            const result = await runSync();
            console.log(
              `Heartbeat sync (${nextReason}) wrote ${result.heartbeatFilesWritten} file(s) across ${result.teamsTouched} team(s)`,
            );
            nextReason = "queued-change";
          } while (syncQueued);
        } catch (error) {
          fail(`heartbeat_sync_failed:${error instanceof Error ? error.message : String(error)}`);
        } finally {
          syncInFlight = false;
        }
      };

      const watcher = watch(templatesDir, { persistent: true }, (eventType, filename) => {
        if (!filename) return;
        const file = filename.toString();
        if (!/^HEARTBEAT-biz-(pm|executor)\.md$/.test(file)) return;
        void triggerSync(`${eventType}:${file}`);
      });

      const shutdown = (): void => {
        watcher.close();
        console.log("Heartbeat watch stopped.");
        process.exit(0);
      };
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
      await new Promise<void>(() => {});
    });
  heartbeat
    .command("bootstrap")
    .description("Write layered HEARTBEAT.md files and scaffold OpenClaw heartbeat config")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.heartbeat.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const teamAgents = company.agents.filter((agent) => agent.projectId === projectId);
      if (teamAgents.length === 0) {
        fail(`team_has_no_agents:${opts.teamId}`);
      }
      const written = await writeTeamHeartbeatFiles({
        store,
        project,
        agents: teamAgents,
      });
      const configUpdatedAgents = await ensureOpenclawHeartbeatScaffold({
        store,
        agentIds: teamAgents.map((agent) => agent.agentId),
      });
      formatOutput(
        opts.json ? "json" : "text",
        {
          ok: true,
          teamId: opts.teamId,
          projectId,
          writtenHeartbeatFiles: written,
          updatedOpenclawAgents: configUpdatedAgents,
          notes: [
            "Restart OpenClaw gateway after bootstrap to apply config.",
            "Heartbeats now use layered context protocol and status-first reporting.",
          ],
        },
        `Heartbeat bootstrap completed for ${opts.teamId} (${written} workspace file(s), ${configUpdatedAgents} config agent(s))`,
      );
    });
}

export function registerDoctorCommands(program: Command): void {
  const store = createSidecarStore();
  const doctor = program.command("doctor").description("Validate sidecar data contracts");
  doctor
    .command("team-data")
    .option("--json", "Output JSON", false)
    .action(async (opts: { json?: boolean }) => {
      const company = await store.readCompanyModel();
      const issues = runDoctor(company);
      if (opts.json) {
        console.log(JSON.stringify({ ok: issues.length === 0, issues }, null, 2));
      } else if (issues.length === 0) {
        console.log("team-data: ok");
      } else {
        console.error("team-data: invalid");
        for (const issue of issues) console.error(`- ${issue}`);
      }
      if (issues.length > 0) {
        process.exitCode = 1;
      }
    });
}

