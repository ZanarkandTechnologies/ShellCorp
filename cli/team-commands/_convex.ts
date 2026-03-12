/**
 * TEAM COMMANDS — CONVEX HTTP + HEARTBEAT RENDER
 * ================================================
 * Purpose
 * - Convex HTTP client helpers (board commands, status reports, board queries).
 * - Heartbeat file rendering and syncing from workspace templates.
 *
 * KEY CONCEPTS:
 * - All functions are async and rely on env vars for Convex endpoint resolution.
 * - Heartbeat render helpers call readBoardSnapshot to fill template variables.
 */
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  asRecord,
  readActorRole,
  teamIdFromProjectId,
  resolveProjectOrFail,
  resolveAgentWorkspacePath,
  resolveOpenclawStateRoot,
  layeredHeartbeatTemplate,
  roleLabel,
  resourceAdvisories,
  resourcesSnapshot,
  type BoardActivityType,
  type CompanyModel,
  type CompanyAgentModel,
  type SidecarStore,
} from "./_shared.js";

// ─── Convex HTTP helpers ─────────────────────────────────────────────────────

function resolveConvexSiteUrl(): string {
  const raw =
    process.env.SHELLCORP_CONVEX_SITE_URL?.trim() || process.env.CONVEX_SITE_URL?.trim() || "";
  if (!raw) {
    throw new Error("missing_convex_site_url:set SHELLCORP_CONVEX_SITE_URL");
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`invalid_convex_site_url:${raw}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`invalid_convex_site_url_protocol:${parsed.protocol}`);
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
  if (
    code.startsWith("ERR_TLS_") ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
  ) {
    return "tls_error";
  }
  return "fetch_failed";
}

export async function postConvexJson(
  pathname: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
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
    throw new Error(`convex_http_request_failed:${classifyFetchFailure(error)}:url=${endpoint}`);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(`convex_http_invalid_response:url=${endpoint}`);
  }
  if (!response.ok) {
    const responseRecord = body as Record<string, unknown>;
    const errorCode =
      typeof responseRecord.error === "string" ? responseRecord.error : `http_${response.status}`;
    throw new Error(`convex_http_request_rejected:${errorCode}:url=${endpoint}`);
  }
  return body as Record<string, unknown>;
}

export async function postBoardCommand(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const normalizedPayload = { ...payload };
  if (
    typeof normalizedPayload.teamId !== "string" &&
    typeof normalizedPayload.projectId === "string"
  ) {
    normalizedPayload.teamId = teamIdFromProjectId(normalizedPayload.projectId);
  }
  let body: Record<string, unknown>;
  try {
    body = await postConvexJson("/board/command", normalizedPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message.replace("convex_http_", "board_command_"));
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("board_command_invalid_response");
  return body;
}

export async function postBoardQuery(payload: Record<string, unknown>): Promise<unknown> {
  const normalizedPayload = { ...payload };
  if (
    typeof normalizedPayload.teamId !== "string" &&
    typeof normalizedPayload.projectId === "string"
  ) {
    normalizedPayload.teamId = teamIdFromProjectId(normalizedPayload.projectId);
  }
  let body: Record<string, unknown>;
  try {
    body = await postConvexJson("/board/query", normalizedPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message.replace("convex_http_", "board_query_"));
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("board_query_invalid_response");
  return body.data;
}

export async function postStatusReport(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    return await postConvexJson("/status/report", payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message.replace("convex_http_", "status_report_"));
  }
}

export async function tryLogCliActivity(payload: {
  projectId: string;
  teamId: string;
  actorAgentId?: string;
  activityType: BoardActivityType;
  label: string;
  detail?: string;
  source?: string;
  beatId?: string;
}): Promise<void> {
  const actorAgentId =
    payload.actorAgentId?.trim() || process.env.SHELLCORP_ACTOR_AGENT_ID?.trim() || "agent-unknown";
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
      beatId:
        payload.beatId?.trim() && payload.beatId.trim().length > 0
          ? payload.beatId.trim()
          : undefined,
      stepKey: `cli-log-${actorAgentId}-${Date.now()}`,
      status: "planning",
      skillId: payload.source?.trim() || "shellcorp_cli",
    });
  } catch {
    // Fire-and-forget sink: CLI sidecar mutations must still succeed even if Convex logging is unavailable.
  }
}

export async function readBoardSnapshot(projectId: string): Promise<{
  openTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  tasksList: string;
}> {
  try {
    const data = await postBoardQuery({ projectId, query: "tasks" });
    const rows = Array.isArray((data as { tasks?: unknown[] })?.tasks)
      ? ((data as { tasks: unknown[] }).tasks as unknown[])
      : [];
    const safeRows = rows.filter(
      (row) => row && typeof row === "object" && !Array.isArray(row),
    ) as Array<{
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

// ─── Heartbeat render helpers ─────────────────────────────────────────────────

export async function renderBusinessHeartbeatTemplate(opts: {
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

export async function writeTeamHeartbeatFiles(opts: {
  store: SidecarStore;
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

export async function syncTeamHeartbeatFiles(opts: {
  store: SidecarStore;
  teamId?: string;
}): Promise<{ teamsTouched: number; heartbeatFilesWritten: number; teamsSkipped: number }> {
  const company = await opts.store.readCompanyModel();
  const targetProjects = opts.teamId
    ? [resolveProjectOrFail(company, opts.teamId).project]
    : company.projects;
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

export async function ensureOpenclawHeartbeatScaffold(opts: {
  store: SidecarStore;
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
    return { ...row, heartbeat: { ...heartbeat, every: "3m" } };
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
          "shellcorp-status": { ...shellcorpStatusNode, enabled: true },
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
