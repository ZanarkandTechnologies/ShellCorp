/**
 * TEAM CONFIG COMMANDS
 * ====================
 * Purpose
 * - Provide a small, inspectable CLI surface for team config and monitoring.
 *
 * KEY CONCEPTS:
 * - Team config should be easy to read as one object: goal, agents, role slots, heartbeat, and file-backed resources.
 * - Resources stay file-backed in this MVP so operators can edit and audit them without another database surface.
 *
 * USAGE:
 * - shellcorp team config show --team-id team-proj-alpha --json
 * - shellcorp team config resources init --team-id team-proj-alpha
 * - shellcorp team monitor --team-id team-proj-alpha --json
 *
 * MEMORY REFERENCES:
 * - MEM-0196
 * - MEM-0200
 * - MEM-0212
 * - MEM-0215
 */
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Command } from "commander";
import {
  ensureCommandPermission,
  formatOutput,
  asRecord,
  resolveOpenclawConfigPath,
  resolveProjectLogsDir,
  resolveProjectOutputsDir,
  resolveOpenclawStateRoot,
  resolveProjectOrFail,
  tryResolveWorkspaceFromOpenclawConfig,
  type CompanyAgentModel,
  type SidecarStore,
} from "./_shared.js";
import { getRecentTeamTimeline, type TeamTimelineEventRow } from "./_convex.js";

type CronJob = {
  id?: string;
  agentId?: string;
  name?: string;
  enabled?: boolean;
  schedule?: Record<string, unknown>;
};

type RuntimeAgentSnapshot = {
  agentId: string;
  role: string;
  workspacePath: string;
  heartbeatFilePath: string;
  openclawHeartbeatEvery: string | null;
  openclawAgentFound: boolean;
};

type MonitorRecentEvent = {
  kind: string;
  label?: string;
  detail?: string;
  occurredAt?: string;
  taskId?: string;
  agentId?: string;
  sourceType?: "agent_event" | "board_event";
};

function normalizeTimelineEventKind(row: TeamTimelineEventRow): string {
  if (row.sourceType === "board_event") {
    if (row.eventType === "task_created") return "task_added";
    return String(row.eventType ?? "board_event");
  }
  if (row.eventType === "status_report") return "status_reported";
  if (row.eventType === "activity_log") return "activity_logged";
  return String(row.eventType ?? row.activityType ?? "agent_event");
}

function mapTimelineRow(row: TeamTimelineEventRow): MonitorRecentEvent {
  return {
    kind: normalizeTimelineEventKind(row),
    label: typeof row.label === "string" ? row.label : undefined,
    detail: typeof row.detail === "string" ? row.detail : undefined,
    occurredAt:
      typeof row.occurredAt === "number" ? new Date(row.occurredAt).toISOString() : undefined,
    taskId: typeof row.taskId === "string" ? row.taskId : undefined,
    agentId:
      typeof row.agentId === "string"
        ? row.agentId
        : typeof row.actorAgentId === "string"
          ? row.actorAgentId
          : undefined,
    sourceType: row.sourceType,
  };
}

async function readRecentTeamActivity(projectId: string, teamId: string): Promise<MonitorRecentEvent[]> {
  const rows = await getRecentTeamTimeline({ projectId, teamId, limit: 20 });
  return rows.map(mapTimelineRow);
}

function resourcesMarkdownPath(store: SidecarStore, projectId: string): string {
  return path.join(path.dirname(store.companyPath), "projects", projectId, "RESOURCES.md");
}

async function readCronJobs(): Promise<CronJob[]> {
  const cronPath = path.join(resolveOpenclawStateRoot(), "cron", "jobs.json");
  try {
    const raw = await readFile(cronPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CronJob[]) : [];
  } catch {
    return [];
  }
}

async function readResourcesMarkdown(
  store: SidecarStore,
  projectId: string,
): Promise<{ path: string; exists: boolean; text: string }> {
  const filePath = resourcesMarkdownPath(store, projectId);
  try {
    const text = await readFile(filePath, "utf-8");
    return { path: filePath, exists: true, text };
  } catch {
    return { path: filePath, exists: false, text: "" };
  }
}

function defaultResourcesMarkdown(teamName: string, goal: string): string {
  return [
    `# Resources`,
    ``,
    `team: ${teamName}`,
    `goal: ${goal}`,
    `cash_budget_usd: `,
    `api_quota_notes: `,
    `distribution_slots: `,
    `constraints: `,
    `notes: `,
    ``,
  ].join("\n");
}

export async function buildTeamSnapshot(
  store: SidecarStore,
  teamId: string,
): Promise<Record<string, unknown>> {
  const company = await store.readCompanyModel();
  const { projectId, project } = resolveProjectOrFail(company, teamId);
  const agents = company.agents.filter((entry) => entry.projectId === projectId);
  const heartbeatProfileIds = [...new Set(agents.map((entry) => entry.heartbeatProfileId))];
  const heartbeatProfiles = company.heartbeatProfiles.filter((entry) =>
    heartbeatProfileIds.includes(entry.id),
  );
  const roleSlots = company.roleSlots.filter((entry) => entry.projectId === projectId);
  const resourcesMarkdown = await readResourcesMarkdown(store, projectId);
  const cronJobs = (await readCronJobs()).filter(
    (job) => typeof job.agentId === "string" && agents.some((entry) => entry.agentId === job.agentId),
  );
  const recentEvents = await readRecentTeamActivity(projectId, teamId);
  const openclawConfig = await store.readOpenclawConfig();
  const openclawAgents = Array.isArray(asRecord(openclawConfig.agents).list)
    ? (asRecord(openclawConfig.agents).list as Array<Record<string, unknown>>)
    : [];
  const runtimeAgents: RuntimeAgentSnapshot[] = agents.map((agent) => {
    const openclawAgent = openclawAgents.find((entry) => asRecord(entry).id === agent.agentId);
    const workspacePath = tryResolveWorkspaceFromOpenclawConfig(
      openclawConfig,
      resolveOpenclawStateRoot(),
      agent.agentId,
    );
    const heartbeat = asRecord(asRecord(openclawAgent).heartbeat);
    return {
      agentId: agent.agentId,
      role: agent.role,
      workspacePath,
      heartbeatFilePath: path.join(workspacePath, "HEARTBEAT.md"),
      openclawHeartbeatEvery:
        typeof heartbeat.every === "string" && heartbeat.every.trim() ? heartbeat.every.trim() : null,
      openclawAgentFound: Boolean(openclawAgent),
    };
  });

  return {
    ok: true,
    teamId,
    projectId,
    team: project,
    roleSlots,
    agents,
    heartbeatProfiles,
    resourcesMarkdown,
    cronJobs,
    runtime: {
      stateRoot: resolveOpenclawStateRoot(),
      openclawConfigPath: resolveOpenclawConfigPath(),
      logsDir: resolveProjectLogsDir(projectId),
      outputsDir: resolveProjectOutputsDir(projectId),
      recentEvents,
      agentWorkspaces: runtimeAgents,
    },
  };
}

export function registerTeamConfig(team: Command, store: SidecarStore): void {
  const config = team.command("config").description("Inspect and edit team configuration");

  config
    .command("show")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const payload = await buildTeamSnapshot(store, opts.teamId.trim());
      formatOutput(
        opts.json ? "json" : "text",
        payload,
        `${opts.teamId} | agents=${(payload.agents as CompanyAgentModel[]).length} | resources=${
          (payload.resourcesMarkdown as { exists: boolean }).exists ? "file" : "missing"
        }`,
      );
    });

  const resources = config
    .command("resources")
    .description("Manage the file-backed RESOURCES.md for a team");

  resources
    .command("init")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.business.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId.trim());
      const filePath = resourcesMarkdownPath(store, projectId);
      await mkdir(path.dirname(filePath), { recursive: true });
      const existing = await readResourcesMarkdown(store, projectId);
      if (!existing.exists) {
        await writeFile(filePath, defaultResourcesMarkdown(project.name, project.goal), "utf-8");
      }
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, path: filePath, created: !existing.exists },
        `${existing.exists ? "Reused" : "Created"} ${filePath}`,
      );
    });

  resources
    .command("get")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId.trim());
      const payload = await readResourcesMarkdown(store, projectId);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, ...payload },
        payload.exists ? payload.text : `${payload.path} does not exist`,
      );
    });

  resources
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--text <text>", "New markdown content")
    .option("--file <path>", "Read markdown content from a file path")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; text?: string; file?: string; json?: boolean }) => {
      ensureCommandPermission("team.business.write");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId.trim());
      const filePath = resourcesMarkdownPath(store, projectId);
      const nextText =
        opts.file?.trim() ? await readFile(path.resolve(opts.file.trim()), "utf-8") : opts.text ?? "";
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, nextText.endsWith("\n") ? nextText : `${nextText}\n`, "utf-8");
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, path: filePath },
        `Updated ${filePath}`,
      );
    });

  team
    .command("monitor")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const payload = await buildTeamSnapshot(store, opts.teamId.trim());
      formatOutput(
        opts.json ? "json" : "text",
        payload,
        `${opts.teamId} | agents=${(payload.agents as CompanyAgentModel[]).length} | cron=${
          (payload.cronJobs as CronJob[]).length
        } | heartbeatProfiles=${(payload.heartbeatProfiles as unknown[]).length}`,
      );
    });
}
