/**
 * TEAM COMMANDS — SHARED UTILITIES
 * ==================================
 * Purpose
 * - All types, constants, and pure utility functions shared across team-command domain modules.
 *
 * KEY CONCEPTS:
 * - No Commander command registration in this file — pure helpers only.
 * - SidecarStore type alias centralizes the store type reference.
 * - Convex HTTP helpers live in _convex.ts; this file stays synchronous/fs-only.
 *
 * MEMORY REFERENCES:
 * - MEM-0104
 * - MEM-0183
 * - MEM-0199
 */

import { execFile } from "node:child_process";
import { access, appendFile, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  AgentRole,
  BusinessConfigModel,
  CapabilitySlotModel,
  CompanyAgentModel,
  CompanyModel,
  createSidecarStore,
  HeartbeatProfileModel,
  OfficeObjectModel,
  ProjectAccountEventModel,
  ProjectAccountModel,
  ProjectResourceModel,
  ResourceEventModel,
  ResourceType,
  RoleSlotModel,
  SpawnPolicy,
} from "../sidecar-store.js";
import { buildNewTeamClusterObject } from "../team-cluster-placement.js";

export type { OutputMode } from "../cli-utils.js";
export { fail, formatOutput } from "../cli-utils.js";

// ─── Type Aliases ────────────────────────────────────────────────────────────

export type SidecarStore = ReturnType<typeof createSidecarStore>;

export type TeamRole = "builder" | "growth_marketer" | "pm";
export type BusinessTeamRole = "biz_pm" | "biz_executor";
export type BusinessType = "affiliate_marketing" | "content_creator" | "saas" | "custom";
export type CapabilityCategory = "measure" | "execute" | "distribute";
export type BusinessEquipMode = "replace_minimum" | "append_only";
export type ResourceKind = ResourceType;
export type ResourceEventKind = "refresh" | "consumption" | "adjustment";
export type BoardTaskStatus = "todo" | "in_progress" | "review" | "blocked" | "done";
export type BoardTaskPriority = "low" | "medium" | "high";
export type BoardActivityType =
  | "planning"
  | "research"
  | "executing"
  | "distributing"
  | "blocked"
  | "handoff"
  | "summary"
  | "status";
export type StatusReportState =
  | "running"
  | "ok"
  | "no_work"
  | "error"
  | "idle"
  | "planning"
  | "executing"
  | "blocked"
  | "done";
export type ConfigEntry = [string, string];
export type ShellName = "bash" | "zsh" | "fish";

export type OpenclawAgentEntry = Record<string, unknown> & { id: string };
export type TeamEventKind =
  | "heartbeat_config_updated"
  | "task_added"
  | "task_moved"
  | "task_updated"
  | "task_deleted"
  | "task_assigned"
  | "task_claimed"
  | "task_memory_set"
  | "task_memory_appended"
  | "task_blocked"
  | "task_done"
  | "task_reopened"
  | "task_reprioritized"
  | "status_reported"
  | "activity_logged";

export type TeamEventRecord = {
  id: string;
  ts: string;
  kind: TeamEventKind;
  teamId: string;
  projectId: string;
  agentId?: string;
  taskId?: string;
  label?: string;
  detail?: string;
  data?: Record<string, unknown>;
};

export interface TeamSummary {
  teamId: string;
  projectId: string;
  name: string;
  status: string;
  goal: string;
  kpis: string[];
  businessType?: string;
}

export type ResolvedCliActorContext = {
  actorKind: "agent" | "operator";
  actorRole: string;
  agentId?: string;
  teamId?: string;
  projectId?: string;
  companyAgent?: CompanyAgentModel;
};

export type TeamPermission =
  | "team.read"
  | "team.meta.write"
  | "team.kpi.write"
  | "team.business.write"
  | "team.resources.write"
  | "team.board.write"
  | "team.activity.write"
  | "team.heartbeat.write"
  | "team.archive";

// Re-export model types used across domain modules.
export type {
  AgentRole,
  BusinessConfigModel,
  CapabilitySlotModel,
  CompanyAgentModel,
  CompanyModel,
  HeartbeatProfileModel,
  OfficeObjectModel,
  ProjectResourceModel,
  ProjectAccountModel,
  ProjectAccountEventModel,
  ResourceEventModel,
  ResourceType,
  RoleSlotModel,
  SpawnPolicy,
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const PERMISSION_BY_ROLE: Record<string, TeamPermission[]> = {
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
  biz_pm: [
    "team.read",
    "team.meta.write",
    "team.kpi.write",
    "team.business.write",
    "team.board.write",
    "team.activity.write",
  ],
  pm: [
    "team.read",
    "team.meta.write",
    "team.kpi.write",
    "team.business.write",
    "team.board.write",
    "team.activity.write",
  ],
  biz_executor: ["team.read", "team.board.write", "team.activity.write"],
  builder: ["team.read", "team.board.write", "team.activity.write"],
  growth_marketer: ["team.read", "team.board.write", "team.activity.write"],
};

export const execFileAsync = promisify(execFile);

// ─── Permission helpers ───────────────────────────────────────────────────────

export function readActorRole(): string {
  return (process.env.SHELLCORP_ACTOR_ROLE?.trim().toLowerCase() || "operator").replace(
    /\s+/g,
    "_",
  );
}

export function readActorAgentId(): string | undefined {
  const direct = process.env.SHELLCORP_AGENT_ID?.trim();
  if (direct) return direct;
  const legacy = process.env.SHELLCORP_ACTOR_AGENT_ID?.trim();
  return legacy || undefined;
}

export function readActorTeamId(): string | undefined {
  const teamId = process.env.SHELLCORP_TEAM_ID?.trim();
  return teamId || undefined;
}

export function readActorProjectId(): string | undefined {
  const projectId = process.env.SHELLCORP_PROJECT_ID?.trim();
  return projectId || undefined;
}

export function renderShellExports(
  entries: Array<[string, string]>,
  shell: ShellName = "bash",
): string {
  if (shell === "fish") {
    return entries.map(([key, value]) => `set -gx ${key} ${JSON.stringify(value)};`).join("\n");
  }
  return entries.map(([key, value]) => `export ${key}=${JSON.stringify(value)}`).join("\n");
}

export function renderShellUnsets(keys: string[], shell: ShellName = "bash"): string {
  if (shell === "fish") {
    return keys.map((key) => `set -e ${key};`).join("\n");
  }
  return keys.map((key) => `unset ${key}`).join("\n");
}

export function resolveAllowedPermissions(): Set<TeamPermission> | "all" {
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

export function ensureCommandPermission(permission: TeamPermission): void {
  const allowed = resolveAllowedPermissions();
  if (allowed !== "all" && !allowed.has(permission)) {
    throw new Error(`permission_denied:${permission}:role=${readActorRole()}`);
  }
}

// ─── General utilities ────────────────────────────────────────────────────────

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function writeFileIfMissing(filePath: string, content: string): Promise<void> {
  try {
    await writeFile(filePath, content, { encoding: "utf-8", flag: "wx" });
  } catch (error) {
    const err = error as { code?: string };
    if (err.code !== "EEXIST") throw error;
  }
}

export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeKpis(values: string[]): string[] {
  const deduped = new Set<string>();
  for (const value of values) {
    const next = value.trim();
    if (next) deduped.add(next);
  }
  return [...deduped];
}

export function projectIdFromTeamId(teamId: string): string {
  const trimmed = teamId.trim();
  if (!trimmed.startsWith("team-")) throw new Error(`invalid_team_id: ${teamId}`);
  return trimmed.slice("team-".length);
}

export function teamIdFromProjectId(projectId: string): string {
  return `team-${projectId}`;
}

export function collectValue(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function parseRoles(raw: string): TeamRole[] {
  const parsed = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const out: TeamRole[] = [];
  for (const role of parsed) {
    if (role !== "builder" && role !== "growth_marketer" && role !== "pm") {
      throw new Error(`invalid_role: ${role}`);
    }
    out.push(role);
  }
  return [...new Set(out)];
}

export function layeredHeartbeatTemplate(roleName: string, projectName: string): string {
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
    '  - `export SHELLCORP_AGENT_ID="<agent-id>"`',
    '  - `export SHELLCORP_TEAM_ID="<team-id>"`',
    '  - `test -n "$SHELLCORP_CONVEX_SITE_URL" || test -n "$CONVEX_SITE_URL"`',
    "- Preferred command pattern:",
    '  shellcorp status --state planning "<your decision>"',
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

// ─── Parse / validate helpers ─────────────────────────────────────────────────

export function parseBusinessType(raw: string): BusinessType {
  if (
    raw === "affiliate_marketing" ||
    raw === "content_creator" ||
    raw === "saas" ||
    raw === "custom"
  ) {
    return raw;
  }
  throw new Error(`invalid_business_type: ${raw}`);
}

export function parseResourceKind(raw: string): ResourceKind {
  if (
    raw === "cash_budget" ||
    raw === "api_quota" ||
    raw === "distribution_slots" ||
    raw === "custom"
  )
    return raw;
  throw new Error(`invalid_resource_type: ${raw}`);
}

export function parseResourceEventKind(raw: string): ResourceEventKind {
  if (raw === "refresh" || raw === "consumption" || raw === "adjustment") return raw;
  throw new Error(`invalid_resource_event_kind: ${raw}`);
}

export function parseCapabilityCategory(raw: string): CapabilityCategory {
  if (raw === "measure" || raw === "execute" || raw === "distribute") return raw;
  throw new Error(`invalid_slot: ${raw}`);
}

export function parseRoleSlotRole(raw: string): Exclude<AgentRole, "ceo"> {
  if (
    raw === "builder" ||
    raw === "growth_marketer" ||
    raw === "pm" ||
    raw === "biz_pm" ||
    raw === "biz_executor"
  ) {
    return raw;
  }
  throw new Error(`invalid_role: ${raw}`);
}

export function parseBoardTaskStatus(raw: string): BoardTaskStatus {
  if (
    raw === "todo" ||
    raw === "in_progress" ||
    raw === "review" ||
    raw === "blocked" ||
    raw === "done"
  ) {
    return raw;
  }
  throw new Error(`invalid_board_status:${raw}`);
}

export function parseBoardTaskPriority(raw: string): BoardTaskPriority {
  if (raw === "low" || raw === "medium" || raw === "high") return raw;
  throw new Error(`invalid_board_priority:${raw}`);
}

export function parseBoardActivityType(raw: string): BoardActivityType {
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
  throw new Error(`invalid_activity_type:${raw}`);
}

export function parseStatusReportState(raw: string): StatusReportState {
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
  throw new Error(`invalid_status_state:${raw}`);
}

export function parseConfigJson(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("invalid_config_json_object");
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  } catch {
    throw new Error("invalid_config_json");
  }
}

export function collectConfigEntry(value: string, previous: ConfigEntry[]): ConfigEntry[] {
  const trimmed = value.trim();
  if (!trimmed) return previous;
  const splitIndex = trimmed.indexOf("=");
  if (splitIndex <= 0) throw new Error(`invalid_config_entry:${value}`);
  const key = trimmed.slice(0, splitIndex).trim();
  const entryValue = trimmed.slice(splitIndex + 1).trim();
  if (!key) throw new Error(`invalid_config_entry:${value}`);
  return [...previous, [key, entryValue]];
}

export function normalizeConfigEntries(entries: ConfigEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of entries) out[key] = value;
  return out;
}

export function parseSpawnPolicy(raw: string): SpawnPolicy {
  if (raw === "manual") return "manual";
  if (raw === "queue_pressure") return "queue_pressure";
  throw new Error(`invalid_spawn_policy: ${raw}`);
}

export function optionalBeatId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

// ─── Domain helpers ───────────────────────────────────────────────────────────

export function ensureProjectAccount(
  projectId: string,
  project: CompanyModel["projects"][number],
): ProjectAccountModel {
  const existing = (project as { account?: ProjectAccountModel }).account;
  if (existing?.id) return existing;
  const accountEvents =
    (project as { accountEvents?: ProjectAccountEventModel[] }).accountEvents ?? [];
  const derivedBalance =
    accountEvents.length > 0
      ? (accountEvents[accountEvents.length - 1]?.balanceAfterCents ?? 0)
      : (project.ledger ?? []).reduce(
          (total, entry) => total + (entry.type === "revenue" ? entry.amount : -entry.amount),
          0,
        );
  return {
    id: `${projectId}:account`,
    projectId,
    currency: "USD",
    balanceCents: derivedBalance,
    updatedAt: new Date().toISOString(),
  };
}

export function resolveProjectOrFail(
  company: CompanyModel,
  teamId: string,
): { projectId: string; project: CompanyModel["projects"][number] } {
  const projectId = projectIdFromTeamId(teamId);
  const project = company.projects.find((entry) => entry.id === projectId);
  if (!project) throw new Error(`team_not_found: ${teamId}`);
  return { projectId, project };
}

export function resolveTeamIdForAgent(company: CompanyModel, agentId: string): string {
  const agent = company.agents.find((entry) => entry.agentId === agentId);
  if (!agent) throw new Error(`agent_not_found:${agentId}`);
  const projectId = agent.projectId?.trim();
  if (!projectId) throw new Error(`agent_missing_project:${agentId}`);
  const project = company.projects.find((entry) => entry.id === projectId);
  if (!project) throw new Error(`agent_project_not_found:${agentId}:${projectId}`);
  return teamIdFromProjectId(projectId);
}

export function resolveCliActorContext(opts: {
  company: CompanyModel;
  explicitAgentId?: string;
  explicitTeamId?: string;
  allowOperator?: boolean;
}): ResolvedCliActorContext {
  const explicitAgentId = opts.explicitAgentId?.trim() || undefined;
  const explicitTeamId = opts.explicitTeamId?.trim() || undefined;
  const envAgentId = readActorAgentId();
  const envTeamId = readActorTeamId();
  const envProjectId = readActorProjectId();
  const agentId = explicitAgentId || envAgentId;
  const requestedTeamId = explicitTeamId || envTeamId;

  if (agentId) {
    const companyAgent = opts.company.agents.find((entry) => entry.agentId === agentId);
    if (!companyAgent) throw new Error(`agent_not_found:${agentId}`);
    const projectId = companyAgent.projectId?.trim();
    if (!projectId) throw new Error(`agent_missing_project:${agentId}`);
    const teamId = resolveTeamIdForAgent(opts.company, agentId);
    if (requestedTeamId && requestedTeamId !== teamId) {
      throw new Error(`actor_team_conflict:${agentId}:${teamId}:${requestedTeamId}`);
    }
    if (envProjectId && envProjectId !== projectId) {
      throw new Error(`actor_project_conflict:${agentId}:${projectId}:${envProjectId}`);
    }
    return {
      actorKind: "agent",
      actorRole: companyAgent.role,
      agentId,
      teamId,
      projectId,
      companyAgent,
    };
  }

  if (!opts.allowOperator) {
    throw new Error("missing_agent_identity:use_shellcorp_agent_login_or_--agent-id");
  }

  if (!requestedTeamId) {
    throw new Error("missing_team_id:use_--team-id_or_SHELLCORP_TEAM_ID");
  }
  const { projectId } = resolveProjectOrFail(opts.company, requestedTeamId);
  if (envProjectId && envProjectId !== projectId) {
    throw new Error(`actor_project_conflict:operator:${projectId}:${envProjectId}`);
  }
  return {
    actorKind: "operator",
    actorRole: readActorRole(),
    teamId: requestedTeamId,
    projectId,
  };
}

export function resolveStatusActivityType(rawState: string): BoardActivityType {
  if (
    rawState === "planning" ||
    rawState === "research" ||
    rawState === "executing" ||
    rawState === "distributing" ||
    rawState === "blocked" ||
    rawState === "handoff" ||
    rawState === "summary" ||
    rawState === "status"
  ) {
    return rawState;
  }
  if (rawState === "done" || rawState === "ok" || rawState === "no_work") return "summary";
  if (rawState === "running") return "executing";
  if (rawState === "error") return "blocked";
  if (rawState === "idle") return "status";
  throw new Error(`invalid_status_state:${rawState}`);
}

export function upsertTeamCluster(
  officeObjects: OfficeObjectModel[],
  input: { teamId: string; name: string; description: string },
): OfficeObjectModel[] {
  const existingIndex = officeObjects.findIndex(
    (object) => object.meshType === "team-cluster" && object.metadata?.teamId === input.teamId,
  );
  if (existingIndex === -1) {
    return [
      ...officeObjects,
      // MEM-0183 decision: new project-backed team clusters claim the next open office slot
      // on first creation, but later metadata updates preserve the existing anchor.
      buildNewTeamClusterObject({
        existingObjects: officeObjects,
        teamId: input.teamId,
        name: input.name,
        description: input.description,
      }),
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

export function removeTeamClusters(
  officeObjects: OfficeObjectModel[],
  input: { teamId: string },
): OfficeObjectModel[] {
  const trimmedTeamId = input.teamId.trim();
  if (!trimmedTeamId) return officeObjects;
  const legacyClusterId = `cluster-${trimmedTeamId}`;
  const currentClusterId = `team-cluster-${trimmedTeamId}`;
  return officeObjects.filter((object) => {
    if (object.meshType !== "team-cluster") return true;
    const metadataTeamId =
      object.metadata && typeof object.metadata.teamId === "string"
        ? object.metadata.teamId.trim()
        : "";
    if (metadataTeamId === trimmedTeamId) return false;
    if (object.id === legacyClusterId || object.identifier === legacyClusterId) return false;
    if (object.id === currentClusterId || object.identifier === currentClusterId) return false;
    return true;
  });
}

export function buildTeamSummaries(company: CompanyModel): TeamSummary[] {
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

export function ensureHeartbeatProfile(
  company: CompanyModel,
  projectId: string,
): { company: CompanyModel; profileId: string } {
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

export function defaultHeartbeatProfileForRole(role: TeamRole): string {
  if (role === "builder") return "hb-builder";
  if (role === "growth_marketer") return "hb-growth";
  return "hb-pm";
}

export function defaultHeartbeatProfileForBusinessRole(role: BusinessTeamRole): string {
  return role === "biz_pm" ? "hb-biz-pm" : "hb-biz-executor";
}

export function resolveAgentWorkspacePath(stateRoot: string, agentId: string): string {
  return path.join(stateRoot, `workspace-${agentId}`);
}

export function roleLabel(role: AgentRole): string {
  if (role === "biz_pm") return "Business PM";
  if (role === "biz_executor") return "Business Executor";
  if (role === "growth_marketer") return "Growth Marketer";
  return role[0].toUpperCase() + role.slice(1);
}

export function defaultBusinessConfig(type: BusinessType): BusinessConfigModel {
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

export function parseSkillList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function uniqueSkills(skills: string[]): string[] {
  return [...new Set(skills.map((entry) => entry.trim()).filter(Boolean))];
}

export function buildTeamBusinessSkillTargets(project: CompanyModel["projects"][number]): {
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
  const trackerSkills = uniqueSkills(
    (project.resources ?? []).map((resource) => resource.trackerSkillId),
  );
  const sharedCore = ["shellcorp-team-cli", "status-self-reporter"];
  const pmCore = ["shellcorp-kanban-ops", "ledger-manager", "experiment-runner"];
  return {
    pmSkills: uniqueSkills([...sharedCore, ...pmCore, ...slotSkills, ...trackerSkills]),
    executorSkills: uniqueSkills([...sharedCore, ...slotSkills]),
  };
}

export function applyAgentSkillsByMode(
  currentSkills: string[],
  targetSkills: string[],
  mode: BusinessEquipMode,
): string[] {
  if (mode === "append_only") return uniqueSkills([...currentSkills, ...targetSkills]);
  return uniqueSkills(targetSkills);
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(filePath: string): Promise<boolean> {
  try {
    const entries = await readdir(filePath);
    return Array.isArray(entries);
  } catch {
    return false;
  }
}

export async function resolveSkillSourceDirectory(
  skillsRoot: string,
  skillId: string,
): Promise<string | null> {
  const directPath = path.join(skillsRoot, skillId);
  if (
    (await isDirectory(directPath)) &&
    ((await pathExists(path.join(directPath, "SKILL.md"))) ||
      (await pathExists(path.join(directPath, "skill.md"))))
  ) {
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
    if (
      (await isDirectory(nestedPath)) &&
      ((await pathExists(path.join(nestedPath, "SKILL.md"))) ||
        (await pathExists(path.join(nestedPath, "skill.md"))))
    ) {
      return nestedPath;
    }
  }
  return null;
}

export async function resolveWorkspaceSkillsRoot(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), "skills"),
    path.resolve(process.cwd(), "..", "skills"),
    path.resolve(process.cwd(), "..", "..", "skills"),
  ];
  for (const candidate of new Set(candidates)) {
    if (await isDirectory(candidate)) return candidate;
  }
  return candidates[0];
}

export function tryResolveWorkspaceFromOpenclawConfig(
  openclawConfig: Record<string, unknown>,
  stateRoot: string,
  agentId: string,
): string {
  const agentsNode = asRecord(openclawConfig.agents);
  const list = Array.isArray(agentsNode.list) ? agentsNode.list : [];
  const match = list.find((entry) => asRecord(entry).id === agentId);
  const row = asRecord(match);
  const workspace = typeof row.workspace === "string" ? row.workspace.trim() : "";
  if (workspace) return workspace;
  return resolveAgentWorkspacePath(stateRoot, agentId);
}

export function collectVideoLikeStrings(value: unknown, out: Set<string>): void {
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

export function extractVideoRefsFromCommandOutput(stdout: string): string[] {
  const refs = new Set<string>();
  const regex =
    /(https?:\/\/[^\s"'`]+|\/[^\s"'`]+\.(?:mp4|mov|webm|mkv)|[^\s"'`]+\.(?:mp4|mov|webm|mkv))/gi;
  let match: RegExpExecArray | null = regex.exec(stdout);
  while (match) {
    refs.add(match[1]);
    match = regex.exec(stdout);
  }
  for (const line of stdout
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)) {
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

export async function runInfshVideoGeneration(
  model: string,
  prompt: string,
): Promise<{ refs: string[]; stdout: string; stderr: string }> {
  const input = JSON.stringify({ prompt });
  try {
    const result = await execFileAsync("infsh", ["app", "run", model, "--input", input, "--json"], {
      maxBuffer: 10 * 1024 * 1024,
    });
    const stdout = typeof result.stdout === "string" ? result.stdout : String(result.stdout ?? "");
    const stderr = typeof result.stderr === "string" ? result.stderr : String(result.stderr ?? "");
    return { refs: extractVideoRefsFromCommandOutput(stdout), stdout, stderr };
  } catch {
    const fallback = await execFileAsync("infsh", ["app", "run", model, "--input", input], {
      maxBuffer: 10 * 1024 * 1024,
    });
    const stdout =
      typeof fallback.stdout === "string" ? fallback.stdout : String(fallback.stdout ?? "");
    const stderr =
      typeof fallback.stderr === "string" ? fallback.stderr : String(fallback.stderr ?? "");
    return { refs: extractVideoRefsFromCommandOutput(stdout), stdout, stderr };
  }
}

export function defaultProjectResources(projectId: string): ProjectResourceModel[] {
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
      policy: {
        advisoryOnly: true,
        softLimit: 1500,
        hardLimit: 0,
        whenLow: "deprioritize_expensive_tasks",
      },
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

export function defaultResourceId(projectId: string, type: ResourceKind): string {
  if (type === "cash_budget") return `${projectId}:cash`;
  if (type === "api_quota") return `${projectId}:api`;
  if (type === "distribution_slots") return `${projectId}:distribution`;
  return `${projectId}:custom`;
}

export function ensureProjectResources(
  project: CompanyModel["projects"][number],
): CompanyModel["projects"][number] {
  if (Array.isArray(project.resources) && project.resources.length > 0) return project;
  return {
    ...project,
    resources: defaultProjectResources(project.id),
    resourceEvents: Array.isArray(project.resourceEvents) ? project.resourceEvents : [],
  };
}

export function ensureBusinessHeartbeatProfiles(company: CompanyModel): CompanyModel {
  const missingPm = !company.heartbeatProfiles.some((profile) => profile.id === "hb-biz-pm");
  const missingExecutor = !company.heartbeatProfiles.some(
    (profile) => profile.id === "hb-biz-executor",
  );
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

export function buildAutoAgents(
  projectId: string,
  slug: string,
  roles: TeamRole[],
): CompanyAgentModel[] {
  return roles.map((role) => ({
    agentId: `${slug}-${role.replace("_marketer", "")}`,
    role,
    projectId,
    heartbeatProfileId: defaultHeartbeatProfileForRole(role),
    isCeo: false,
    lifecycleState: "pending_spawn",
  }));
}

export function buildAutoRoleSlots(projectId: string, roles: TeamRole[]): RoleSlotModel[] {
  return roles.map((role) => ({
    projectId,
    role,
    desiredCount: 1,
    spawnPolicy: "queue_pressure",
  }));
}

export function buildBusinessRoleSlots(projectId: string): RoleSlotModel[] {
  return [
    { projectId, role: "biz_pm", desiredCount: 1, spawnPolicy: "queue_pressure" },
    { projectId, role: "biz_executor", desiredCount: 1, spawnPolicy: "queue_pressure" },
  ];
}

export function buildBusinessAgents(projectId: string, slug: string): CompanyAgentModel[] {
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

export async function copyBusinessHeartbeatTemplates(agentIds: string[]): Promise<void> {
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
      // best-effort copy
    }
  }
}

export async function upsertBusinessCronJobs(projectId: string, agentIds: string[]): Promise<void> {
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
    const payloadMessage =
      "Read HEARTBEAT.md and follow it exactly. End your response with HEARTBEAT_OK.";
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
      payload: { kind: "agentTurn", message: payloadMessage },
      delivery: { mode: "none" },
    });
  }

  await mkdir(cronDir, { recursive: true });
  await writeFile(cronPath, `${JSON.stringify([...existingById.values()], null, 2)}\n`, "utf-8");
}

export async function ensureWorkspaceWithBootstrap(opts: {
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
  await writeFileIfMissing(
    path.join(workspacePath, "IDENTITY.md"),
    `# IDENTITY\n\n- agentId: ${opts.agent.agentId}\n`,
  );
  await writeFileIfMissing(path.join(workspacePath, "USER.md"), "# USER\n");
  await writeFileIfMissing(path.join(workspacePath, "HEARTBEAT.md"), defaultHeartbeat);
}

export async function provisionOpenclawAgents(opts: {
  store: SidecarStore;
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
    await ensureWorkspaceWithBootstrap({ stateRoot, agent, projectName: opts.projectName });
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
    agents: { ...agentsNode, list: currentList },
  } as Record<string, unknown>;
  await opts.store.writeOpenclawConfig(nextConfig);
}

export async function deregisterOpenclawAgents(opts: {
  store: SidecarStore;
  agentIds: string[];
}): Promise<void> {
  if (opts.agentIds.length === 0) return;
  const stateRoot = resolveOpenclawStateRoot();
  const config = await opts.store.readOpenclawConfig();
  const agentsNode = asRecord(config.agents);
  const currentList = Array.isArray(agentsNode.list) ? [...agentsNode.list] : [];
  const configuredWorkspaceByAgentId = new Map<string, string>();
  for (const entry of currentList) {
    const row = asRecord(entry);
    const id = typeof row.id === "string" ? row.id.trim() : "";
    if (!id) continue;
    configuredWorkspaceByAgentId.set(
      id,
      tryResolveWorkspaceFromOpenclawConfig(config, stateRoot, id),
    );
  }
  const removeSet = new Set(opts.agentIds);
  const nextList = currentList.filter((entry) => {
    const id = asRecord(entry).id;
    return !(typeof id === "string" && removeSet.has(id));
  });
  const nextConfig = {
    ...config,
    agents: { ...agentsNode, list: nextList },
  } as Record<string, unknown>;
  await opts.store.writeOpenclawConfig(nextConfig);

  for (const agentId of opts.agentIds) {
    const workspacePath = configuredWorkspaceByAgentId.get(agentId) ?? "";
    const resolvedWorkspacePath = workspacePath ? path.resolve(workspacePath) : "";
    const relativeWorkspacePath = resolvedWorkspacePath
      ? path.relative(stateRoot, resolvedWorkspacePath)
      : "";
    const isManagedWorkspace =
      relativeWorkspacePath.length > 0 &&
      relativeWorkspacePath !== ".." &&
      !relativeWorkspacePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativeWorkspacePath);
    if (!isManagedWorkspace) continue;
    await rm(resolvedWorkspacePath, { recursive: true, force: true });
  }
}

export function runDoctor(company: CompanyModel): string[] {
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
    if (agent.projectId && !projectIds.has(agent.projectId))
      issues.push(`agent_project_missing:${agent.agentId}:${agent.projectId}`);
    if (!heartbeatIds.has(agent.heartbeatProfileId)) {
      issues.push(`agent_heartbeat_missing:${agent.agentId}:${agent.heartbeatProfileId}`);
    }
  }
  for (const slot of company.roleSlots) {
    if (!projectIds.has(slot.projectId))
      issues.push(`role_slot_project_missing:${slot.projectId}:${slot.role}`);
  }
  for (const project of company.projects) {
    const resourceIds = new Set<string>();
    const resources = project.resources ?? [];
    for (const resource of resources) {
      if (resourceIds.has(resource.id))
        issues.push(`duplicate_project_resource_id:${project.id}:${resource.id}`);
      resourceIds.add(resource.id);
      if (!resource.trackerSkillId.trim())
        issues.push(`resource_tracker_missing:${project.id}:${resource.id}`);
      if (resource.limit < 0)
        issues.push(`resource_limit_negative:${project.id}:${resource.id}:${resource.limit}`);
      if (resource.remaining > resource.limit) {
        issues.push(
          `resource_remaining_over_limit:${project.id}:${resource.id}:${resource.remaining}:${resource.limit}`,
        );
      }
    }
    for (const event of project.resourceEvents ?? []) {
      if (!resourceIds.has(event.resourceId)) {
        issues.push(
          `resource_event_missing_resource:${project.id}:${event.id}:${event.resourceId}`,
        );
      }
    }
  }
  return issues;
}

export function resourceAdvisories(
  resources: CompanyModel["projects"][number]["resources"],
): string {
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

export function resourcesSnapshot(
  resources: CompanyModel["projects"][number]["resources"],
): string {
  if (!resources || resources.length === 0) return "none";
  return resources
    .map((resource) => `${resource.name}=${resource.remaining}/${resource.limit} ${resource.unit}`)
    .join(" | ");
}

export function resolveOpenclawStateRoot(): string {
  return process.env.OPENCLAW_STATE_DIR?.trim()
    ? path.resolve(process.env.OPENCLAW_STATE_DIR.trim())
    : path.join(process.env.HOME || "", ".openclaw");
}

export function resolveOpenclawConfigPath(): string {
  return path.join(resolveOpenclawStateRoot(), "openclaw.json");
}

export function resolveProjectRuntimeRoot(projectId: string): string {
  return path.join(resolveOpenclawStateRoot(), "projects", projectId);
}

export function resolveProjectLogsDir(projectId: string): string {
  return path.join(resolveProjectRuntimeRoot(projectId), "logs");
}

export function resolveProjectOutputsDir(projectId: string): string {
  return path.join(resolveProjectRuntimeRoot(projectId), "outputs");
}

export function resolveProjectEventsLogPath(projectId: string): string {
  return path.join(resolveProjectLogsDir(projectId), "events.jsonl");
}

export async function appendTeamEventLog(input: {
  teamId: string;
  projectId: string;
  kind: TeamEventKind;
  agentId?: string;
  taskId?: string;
  label?: string;
  detail?: string;
  data?: Record<string, unknown>;
}): Promise<TeamEventRecord> {
  const record: TeamEventRecord = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    kind: input.kind,
    teamId: input.teamId,
    projectId: input.projectId,
    agentId: input.agentId?.trim() || undefined,
    taskId: input.taskId?.trim() || undefined,
    label: input.label?.trim() || undefined,
    detail: input.detail?.trim() || undefined,
    data: input.data,
  };
  const logPath = resolveProjectEventsLogPath(input.projectId);
  await mkdir(path.dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(record)}\n`, "utf-8");
  return record;
}

export async function readRecentTeamEvents(
  projectId: string,
  limit = 20,
): Promise<TeamEventRecord[]> {
  const logPath = resolveProjectEventsLogPath(projectId);
  try {
    const raw = await readFile(logPath, "utf-8");
    const rows = raw
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => JSON.parse(entry) as TeamEventRecord);
    return rows.slice(-limit);
  } catch {
    return [];
  }
}

// Re-export node helpers used by domain modules so they can import from one place.
export { path, mkdir, readFile, writeFile, cp };
