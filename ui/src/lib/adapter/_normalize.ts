/**
 * OPENCLAW ADAPTER NORMALIZE
 * ==========================
 * Pure normalization helpers extracted from the adapter class shell.
 *
 * MEMORY REFERENCES:
 * - MEM-0144
 */
import type {
  AgentLiveStatus,
  AgentMemoryEntry,
  AgentFileEntry,
  AgentIdentityResult,
  AgentsFilesGetResult,
  AgentsFilesListResult,
  AgentsFilesSetResult,
  AgentsListResult,
  AgentCardModel,
  ChannelAccountSnapshot,
  ChannelUiMetaEntry,
  ChannelsStatusSnapshot,
  ChatSendRequest,
  CompanyOfficeObjectModel,
  CompanyModel,
  CronJob,
  CronStatus,
  DepartmentModel,
  FederationProjectPolicy,
  FederatedTaskModel,
  HeartbeatProfileModel,
  OpenClawConfigPreview,
  OpenClawConfigSnapshot,
  ProviderIndexProfile,
  ProjectModel,
  ProjectArtefactEntry,
  ProjectArtefactGroup,
  ProjectArtefactIndexResult,
  ProjectWorkloadSummary,
  ReconciliationWarning,
  RoleSlotModel,
  SkillStatusEntry,
  SkillStatusReport,
  SkillStudioCatalogEntry,
  SkillStudioDetail,
  SkillStudioFileContent,
  SkillStudioFileEntry,
  SkillDemoCase,
  SkillDemoRunResult,
  SkillManifest,
  SkillManifestToolDependency,
  TaskSyncState,
  ToolCatalogEntry,
  ToolCatalogGroup,
  ToolCatalogProfile,
  ToolsCatalogResult,
  UnifiedOfficeModel,
  MemoryItemModel,
  SessionRowModel,
  SessionTimelineEvent,
  SessionTimelineModel,
  SessionUsageSnapshot,
  SessionUsageTotals,
  HeartbeatWindow,
  SkillItemModel,
  CompanyAgentModel,
  ChannelBindingModel,
  OfficeObjectSidecarModel,
  PendingApprovalModel,
  OfficeSettingsModel,
  MeshAssetModel,
  LedgerEntryModel,
  ProjectAccountModel,
  ProjectAccountEventModel,
  ExperimentModel,
  MetricEventModel,
  ProjectResourceModel,
  ResourceEventModel,
  CapabilitySlotModel,
  BusinessConfigModel,
  TeamBusinessSkillSyncResult,
} from "../openclaw-types";
import { normalizeOfficeDecorSettings } from "../office-decor";
import { getOfficeFootprintFromLayout, normalizeOfficeLayout } from "../office-layout";
import { DEFAULT_OFFICE_FOOTPRINT, normalizeOfficeFootprint } from "../office-footprint";

type Json = Record<string, unknown>;
const HEARTBEAT_START_PATTERN = /read\s+heartbeat\.md[\s\S]*current\s+time:/i;
const HEARTBEAT_OK_PATTERN = /\bHEARTBEAT_OK\b/i;
const HEARTBEAT_ERROR_PATTERN = /\b(error|failed|exception|timeout|circuit_open)\b/i;
const MAX_HEARTBEAT_BUBBLES = 3;

export function normalizeArray<T>(value: unknown, map: (entry: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(map).filter((entry): entry is T => entry !== null);
}

export function toAgent(entry: unknown): AgentCardModel | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const agentId = String(row.agentId ?? row.id ?? "").trim();
  if (!agentId) return null;
  const allow = Array.isArray((row.toolPolicy as Json | undefined)?.allow)
    ? ((row.toolPolicy as Json).allow as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];
  const deny = Array.isArray((row.toolPolicy as Json | undefined)?.deny)
    ? ((row.toolPolicy as Json).deny as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  return {
    agentId,
    displayName: String(row.displayName ?? row.name ?? agentId),
    workspacePath: String(row.workspacePath ?? row.workspace ?? ""),
    agentDir: String(row.agentDir ?? ""),
    sandboxMode: String(row.sandboxMode ?? "off"),
    toolPolicy: { allow, deny },
    sessionCount: Number(row.sessionCount ?? 0),
    lastUpdatedAt: typeof row.lastUpdatedAt === "number" ? row.lastUpdatedAt : undefined,
  };
}

export function toSession(agentId: string, entry: unknown): SessionRowModel | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const sessionKey = String(row.sessionKey ?? row.key ?? "").trim();
  if (!sessionKey) return null;
  return {
    agentId,
    sessionKey,
    sessionId: typeof row.sessionId === "string" ? row.sessionId : undefined,
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : undefined,
    channel: typeof row.channel === "string" ? row.channel : undefined,
    peerLabel: typeof row.peerLabel === "string" ? row.peerLabel : undefined,
    origin: typeof row.origin === "string" ? row.origin : undefined,
  };
}

export function toTimeline(
  agentId: string,
  sessionKey: string,
  payload: unknown,
): SessionTimelineModel {
  const row = payload && typeof payload === "object" ? (payload as Json) : {};
  const rawEvents = Array.isArray(row.events) ? row.events : [];
  const events = rawEvents
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const event = item as Json;
      const ts = typeof event.ts === "number" ? event.ts : 0;
      const type = String(event.type ?? "status");
      const normalizedType: SessionTimelineModel["events"][number]["type"] =
        type === "message" || type === "tool" ? type : "status";
      const role = String(event.role ?? "system");
      const text = String(event.text ?? event.content ?? "");
      if (!text.trim()) return null;
      const sourceRaw = String(event.source ?? "").trim();
      const source: SessionTimelineEvent["source"] =
        sourceRaw === "heartbeat" ||
        sourceRaw === "ui" ||
        sourceRaw === "operator" ||
        sourceRaw === "unknown"
          ? sourceRaw
          : undefined;
      const eventId = typeof event.eventId === "string" ? event.eventId : undefined;
      return {
        ts,
        type: normalizedType,
        role,
        text,
        source:
          source ??
          (HEARTBEAT_START_PATTERN.test(text) || HEARTBEAT_OK_PATTERN.test(text)
            ? "heartbeat"
            : undefined),
        eventId,
        raw: event,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const usageSummary =
    row.usageSummary && typeof row.usageSummary === "object"
      ? normalizeUsageSummary(row.usageSummary as Json)
      : undefined;

  return {
    agentId,
    sessionKey,
    tokenUsage:
      row.tokenUsage && typeof row.tokenUsage === "object"
        ? (row.tokenUsage as SessionTimelineModel["tokenUsage"])
        : usageSummary
          ? {
              inputTokens: usageSummary.sessionTotals.inputTokens,
              outputTokens: usageSummary.sessionTotals.outputTokens,
              totalTokens: usageSummary.sessionTotals.totalTokens,
              cacheReadTokens: usageSummary.sessionTotals.cacheReadTokens,
              cacheWriteTokens: usageSummary.sessionTotals.cacheWriteTokens,
              estimatedCostUsd: usageSummary.sessionTotals.estimatedCostUsd,
            }
          : undefined,
    usageSummary,
    events,
  };
}

function normalizeUsageNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeUsageTotals(entry: Json): SessionUsageTotals {
  return {
    inputTokens: Math.max(0, Math.round(normalizeUsageNumber(entry.inputTokens))),
    outputTokens: Math.max(0, Math.round(normalizeUsageNumber(entry.outputTokens))),
    cacheReadTokens: Math.max(0, Math.round(normalizeUsageNumber(entry.cacheReadTokens))),
    cacheWriteTokens: Math.max(0, Math.round(normalizeUsageNumber(entry.cacheWriteTokens))),
    totalTokens: Math.max(0, Math.round(normalizeUsageNumber(entry.totalTokens))),
    estimatedCostUsd: Math.max(0, normalizeUsageNumber(entry.estimatedCostUsd)),
    responseCount: Math.max(0, Math.round(normalizeUsageNumber(entry.responseCount))),
  };
}

function normalizeUsageSnapshot(entry: Json): SessionUsageSnapshot {
  return {
    ...normalizeUsageTotals(entry),
    provider: typeof entry.provider === "string" ? entry.provider : undefined,
    model: typeof entry.model === "string" ? entry.model : undefined,
    timestamp: typeof entry.timestamp === "number" ? entry.timestamp : undefined,
  };
}

function normalizeUsageSummary(entry: Json): SessionTimelineModel["usageSummary"] {
  const totalsRaw =
    entry.sessionTotals && typeof entry.sessionTotals === "object"
      ? (entry.sessionTotals as Json)
      : entry;
  const lastResponseRaw =
    entry.lastResponse && typeof entry.lastResponse === "object"
      ? (entry.lastResponse as Json)
      : null;
  const last24HoursRaw =
    entry.last24Hours && typeof entry.last24Hours === "object" ? (entry.last24Hours as Json) : null;
  const last7DaysRaw =
    entry.last7Days && typeof entry.last7Days === "object" ? (entry.last7Days as Json) : null;
  return {
    sessionTotals: normalizeUsageTotals(totalsRaw),
    ...(lastResponseRaw ? { lastResponse: normalizeUsageSnapshot(lastResponseRaw) } : {}),
    ...(last24HoursRaw ? { last24Hours: normalizeUsageTotals(last24HoursRaw) } : {}),
    ...(last7DaysRaw ? { last7Days: normalizeUsageTotals(last7DaysRaw) } : {}),
  };
}

export function scoreBubbleLabel(text: string): string[] {
  const labels = new Set<string>();
  const toolMatch = text.match(
    /\b(ReadFile|WriteFile|Edit|ApplyPatch|Shell|Bash|TodoWrite|AskQuestion|Subagent|SemanticSearch|WebSearch)\b/gi,
  );
  for (const hit of toolMatch ?? []) labels.add(hit);
  const skillMatch = text.match(/\b(skill|skills)\s*[:=]\s*([a-z0-9_-]+)/i);
  if (skillMatch?.[2]) labels.add(`skill:${skillMatch[2]}`);
  return [...labels];
}

export function isHeartbeatStartEvent(event: SessionTimelineEvent): boolean {
  return HEARTBEAT_START_PATTERN.test(event.text);
}

export function isOperatorLikeMessage(event: SessionTimelineEvent): boolean {
  if (event.source === "ui" || event.source === "operator") return true;
  return event.role === "user" && !isHeartbeatStartEvent(event);
}

export function finalizeHeartbeatWindow(
  draft: {
    beatId: string;
    sessionKey: string;
    startedAt: number;
    trigger: HeartbeatWindow["trigger"];
    status: HeartbeatWindow["status"];
    summary: string;
    eventCount: number;
    actionCount: number;
    bubbles: Map<string, number>;
  },
  endedAt?: number,
): HeartbeatWindow {
  const orderedBubbles = [...draft.bubbles.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_HEARTBEAT_BUBBLES)
    .map(([label, weight], index) => ({ id: `${draft.beatId}:${index}`, label, weight }));
  return {
    beatId: draft.beatId,
    sessionKey: draft.sessionKey,
    startedAt: draft.startedAt,
    endedAt,
    trigger: draft.trigger,
    status: draft.status,
    summary: draft.summary,
    skillBubbles: orderedBubbles,
    eventCount: draft.eventCount,
  };
}

export function parseHeartbeatWindows(
  events: SessionTimelineEvent[],
  sessionKey: string,
): HeartbeatWindow[] {
  const windows: HeartbeatWindow[] = [];
  const ordered = [...events].sort((a, b) => a.ts - b.ts);
  let counter = 0;
  let current: {
    beatId: string;
    sessionKey: string;
    startedAt: number;
    trigger: HeartbeatWindow["trigger"];
    status: HeartbeatWindow["status"];
    summary: string;
    eventCount: number;
    actionCount: number;
    bubbles: Map<string, number>;
  } | null = null;

  for (const event of ordered) {
    if (isHeartbeatStartEvent(event)) {
      if (current) {
        if (current.status === "running") {
          current.status = current.actionCount > 0 ? "ok" : "no_work";
          current.summary = current.actionCount > 0 ? "Heartbeat completed" : "No work detected";
        }
        windows.push(finalizeHeartbeatWindow(current, event.ts));
      }
      current = {
        beatId: `${sessionKey}:${event.ts}:${counter}`,
        sessionKey,
        startedAt: event.ts,
        trigger: "scheduled",
        status: "running",
        summary: "Heartbeat in progress",
        eventCount: 1,
        actionCount: 0,
        bubbles: new Map<string, number>(),
      };
      counter += 1;
      continue;
    }

    if (!current) continue;
    current.eventCount += 1;

    if (isOperatorLikeMessage(event)) continue;

    if (HEARTBEAT_OK_PATTERN.test(event.text)) {
      current.status = current.actionCount > 0 ? "ok" : "no_work";
      current.summary = current.actionCount > 0 ? "Heartbeat completed" : "HEARTBEAT_OK";
      windows.push(finalizeHeartbeatWindow(current, event.ts));
      current = null;
      continue;
    }

    if (HEARTBEAT_ERROR_PATTERN.test(event.text)) {
      current.status = "error";
      current.summary = event.text.slice(0, 120);
      windows.push(finalizeHeartbeatWindow(current, event.ts));
      current = null;
      continue;
    }

    const contributesAction = event.role === "assistant" || event.type === "tool";
    if (contributesAction) current.actionCount += 1;
    for (const label of scoreBubbleLabel(event.text)) {
      current.bubbles.set(label, (current.bubbles.get(label) ?? 0) + 1);
    }
  }

  if (current) {
    windows.push(finalizeHeartbeatWindow(current));
  }
  return windows;
}

export function deriveAgentLiveStatus(
  agentId: string,
  sessionKey: string | undefined,
  windows: HeartbeatWindow[],
): AgentLiveStatus {
  if (windows.length === 0) {
    return {
      agentId,
      sessionKey,
      state: "idle",
      statusText: "Idle",
      bubbles: [],
    };
  }
  const latest = windows[windows.length - 1];
  const statusText =
    latest.status === "running"
      ? "Heartbeat running"
      : latest.status === "ok"
        ? "Heartbeat complete"
        : latest.status === "no_work"
          ? "No work"
          : "Heartbeat error";
  return {
    agentId,
    sessionKey,
    state: latest.status,
    statusText,
    updatedAt: latest.endedAt ?? latest.startedAt,
    bubbles: latest.skillBubbles,
    latestHeartbeat: latest,
  };
}

export function toSkill(entry: unknown): SkillItemModel | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const name = String(row.name ?? "").trim();
  if (!name) return null;
  return {
    name,
    category: String(row.category ?? "general"),
    scope: row.scope === "agent" ? "agent" : "shared",
    sourcePath: String(row.sourcePath ?? ""),
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : undefined,
  };
}

export function toMemory(entry: unknown): MemoryItemModel | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const id = String(row.id ?? "").trim();
  const summary = String(row.summary ?? "").trim();
  if (!id || !summary) return null;
  return {
    id,
    agentId: String(row.agentId ?? "main"),
    summary,
    level: row.level === "warning" || row.level === "critical" ? row.level : "info",
    ts: typeof row.ts === "number" ? row.ts : Date.now(),
  };
}

export function toAgentFileEntry(entry: unknown): AgentFileEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const name = String(row.name ?? "").trim();
  const filePath = String(row.path ?? "").trim();
  if (!name || !filePath) return null;
  return {
    name,
    path: filePath,
    missing: row.missing === true,
    size: typeof row.size === "number" ? row.size : undefined,
    updatedAtMs: typeof row.updatedAtMs === "number" ? row.updatedAtMs : undefined,
    content: typeof row.content === "string" ? row.content : undefined,
  };
}

export function toAgentsFilesListResult(entry: unknown): AgentsFilesListResult | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const agentId = String(row.agentId ?? "").trim();
  const workspace = String(row.workspace ?? "").trim();
  if (!agentId || !workspace) return null;
  return {
    agentId,
    workspace,
    files: normalizeArray(row.files, toAgentFileEntry),
  };
}

export function toAgentsFilesGetResult(entry: unknown): AgentsFilesGetResult | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const agentId = String(row.agentId ?? "").trim();
  const workspace = String(row.workspace ?? "").trim();
  const file = toAgentFileEntry(row.file);
  if (!agentId || !workspace || !file) return null;
  return { agentId, workspace, file };
}

export function toAgentsFilesSetResult(entry: unknown): AgentsFilesSetResult | null {
  const parsed = toAgentsFilesGetResult(entry);
  if (!parsed) return null;
  return { ok: true, ...parsed };
}

export function toProjectArtefactIndex(
  projectId: string,
  groups: ProjectArtefactGroup[],
  fetchedAtMs: number = Date.now(),
): ProjectArtefactIndexResult {
  const files = groups
    .flatMap((group) => group.files)
    .sort((left, right) => {
      const tsDelta = (right.updatedAtMs ?? 0) - (left.updatedAtMs ?? 0);
      if (tsDelta !== 0) return tsDelta;
      return left.path.localeCompare(right.path);
    });
  return {
    projectId,
    groups,
    files,
    fetchedAtMs,
  };
}

export function toToolCatalogProfile(entry: unknown): ToolCatalogProfile | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const id = String(row.id ?? "");
  if (id !== "minimal" && id !== "coding" && id !== "messaging" && id !== "full") return null;
  return {
    id,
    label: String(row.label ?? id),
  };
}

export function toToolCatalogEntry(entry: unknown): ToolCatalogEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  const source = String(row.source ?? "core");
  const defaultProfiles = Array.isArray(row.defaultProfiles)
    ? row.defaultProfiles.filter(
        (value): value is "minimal" | "coding" | "messaging" | "full" =>
          value === "minimal" || value === "coding" || value === "messaging" || value === "full",
      )
    : [];
  return {
    id,
    label: String(row.label ?? id),
    description: String(row.description ?? ""),
    source: source === "plugin" ? "plugin" : "core",
    pluginId: typeof row.pluginId === "string" ? row.pluginId : undefined,
    optional: row.optional === true,
    defaultProfiles,
  };
}

export function toToolCatalogGroup(entry: unknown): ToolCatalogGroup | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  const source = String(row.source ?? "core");
  return {
    id,
    label: String(row.label ?? id),
    source: source === "plugin" ? "plugin" : "core",
    pluginId: typeof row.pluginId === "string" ? row.pluginId : undefined,
    tools: normalizeArray(row.tools, toToolCatalogEntry),
  };
}

export function toToolsCatalogResult(
  entry: unknown,
  fallbackAgentId: string,
): ToolsCatalogResult | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  return {
    agentId: String(row.agentId ?? fallbackAgentId),
    profiles: normalizeArray(row.profiles, toToolCatalogProfile),
    groups: normalizeArray(row.groups, toToolCatalogGroup),
  };
}

export function toChannelMetaEntry(entry: unknown): ChannelUiMetaEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  return {
    id,
    label: String(row.label ?? id),
    detailLabel: String(row.detailLabel ?? ""),
    systemImage: typeof row.systemImage === "string" ? row.systemImage : undefined,
  };
}

export function toChannelAccountSnapshot(entry: unknown): ChannelAccountSnapshot | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const accountId = String(row.accountId ?? "").trim();
  if (!accountId) return null;
  return {
    accountId,
    name: typeof row.name === "string" ? row.name : null,
    enabled: typeof row.enabled === "boolean" ? row.enabled : null,
    configured: typeof row.configured === "boolean" ? row.configured : null,
    linked: typeof row.linked === "boolean" ? row.linked : null,
    running: typeof row.running === "boolean" ? row.running : null,
    connected: typeof row.connected === "boolean" ? row.connected : null,
    reconnectAttempts: typeof row.reconnectAttempts === "number" ? row.reconnectAttempts : null,
    lastConnectedAt: typeof row.lastConnectedAt === "number" ? row.lastConnectedAt : null,
    lastError: typeof row.lastError === "string" ? row.lastError : null,
    lastStartAt: typeof row.lastStartAt === "number" ? row.lastStartAt : null,
    lastStopAt: typeof row.lastStopAt === "number" ? row.lastStopAt : null,
    lastInboundAt: typeof row.lastInboundAt === "number" ? row.lastInboundAt : null,
    lastOutboundAt: typeof row.lastOutboundAt === "number" ? row.lastOutboundAt : null,
    lastProbeAt: typeof row.lastProbeAt === "number" ? row.lastProbeAt : null,
    mode: typeof row.mode === "string" ? row.mode : null,
    dmPolicy: typeof row.dmPolicy === "string" ? row.dmPolicy : null,
    allowFrom: Array.isArray(row.allowFrom)
      ? row.allowFrom.filter((value): value is string => typeof value === "string")
      : null,
    tokenSource: typeof row.tokenSource === "string" ? row.tokenSource : null,
    botTokenSource: typeof row.botTokenSource === "string" ? row.botTokenSource : null,
    appTokenSource: typeof row.appTokenSource === "string" ? row.appTokenSource : null,
    credentialSource: typeof row.credentialSource === "string" ? row.credentialSource : null,
    audienceType: typeof row.audienceType === "string" ? row.audienceType : null,
    audience: typeof row.audience === "string" ? row.audience : null,
    webhookPath: typeof row.webhookPath === "string" ? row.webhookPath : null,
    webhookUrl: typeof row.webhookUrl === "string" ? row.webhookUrl : null,
    baseUrl: typeof row.baseUrl === "string" ? row.baseUrl : null,
    allowUnmentionedGroups:
      typeof row.allowUnmentionedGroups === "boolean" ? row.allowUnmentionedGroups : null,
    cliPath: typeof row.cliPath === "string" ? row.cliPath : null,
    dbPath: typeof row.dbPath === "string" ? row.dbPath : null,
    port: typeof row.port === "number" ? row.port : null,
    probe: row.probe,
    audit: row.audit,
    application: row.application,
  };
}

export function toChannelsStatusSnapshot(entry: unknown): ChannelsStatusSnapshot | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const channelAccountsRaw =
    row.channelAccounts && typeof row.channelAccounts === "object"
      ? (row.channelAccounts as Record<string, unknown>)
      : {};
  const channelAccounts: Record<string, ChannelAccountSnapshot[]> = {};
  for (const [channelId, accounts] of Object.entries(channelAccountsRaw)) {
    channelAccounts[channelId] = normalizeArray(accounts, toChannelAccountSnapshot);
  }
  const channelDefaultAccountIdRaw =
    row.channelDefaultAccountId && typeof row.channelDefaultAccountId === "object"
      ? (row.channelDefaultAccountId as Record<string, unknown>)
      : {};
  const channelDefaultAccountId = Object.fromEntries(
    Object.entries(channelDefaultAccountIdRaw).map(([key, value]) => [key, String(value ?? "")]),
  );
  return {
    ts: typeof row.ts === "number" ? row.ts : Date.now(),
    channelOrder: Array.isArray(row.channelOrder)
      ? row.channelOrder.filter((value): value is string => typeof value === "string")
      : [],
    channelLabels:
      row.channelLabels && typeof row.channelLabels === "object"
        ? Object.fromEntries(
            Object.entries(row.channelLabels as Record<string, unknown>).map(([key, value]) => [
              key,
              String(value ?? key),
            ]),
          )
        : {},
    channelDetailLabels:
      row.channelDetailLabels && typeof row.channelDetailLabels === "object"
        ? Object.fromEntries(
            Object.entries(row.channelDetailLabels as Record<string, unknown>).map(
              ([key, value]) => [key, String(value ?? "")],
            ),
          )
        : undefined,
    channelSystemImages:
      row.channelSystemImages && typeof row.channelSystemImages === "object"
        ? Object.fromEntries(
            Object.entries(row.channelSystemImages as Record<string, unknown>).map(
              ([key, value]) => [key, String(value ?? "")],
            ),
          )
        : undefined,
    channelMeta: normalizeArray(row.channelMeta, toChannelMetaEntry),
    channels:
      row.channels && typeof row.channels === "object"
        ? (row.channels as Record<string, unknown>)
        : {},
    channelAccounts,
    channelDefaultAccountId,
  };
}

export function toCronJob(entry: unknown): CronJob | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  const schedule: CronJob["schedule"] =
    row.schedule && typeof row.schedule === "object"
      ? (row.schedule as CronJob["schedule"])
      : { kind: "every", everyMs: 60000 };
  const payload: CronJob["payload"] =
    row.payload && typeof row.payload === "object"
      ? (row.payload as CronJob["payload"])
      : { kind: "systemEvent", text: "" };
  return {
    id,
    agentId: typeof row.agentId === "string" ? row.agentId : undefined,
    name: String(row.name ?? id),
    description: typeof row.description === "string" ? row.description : undefined,
    enabled: row.enabled !== false,
    deleteAfterRun: row.deleteAfterRun === true,
    createdAtMs: typeof row.createdAtMs === "number" ? row.createdAtMs : Date.now(),
    updatedAtMs: typeof row.updatedAtMs === "number" ? row.updatedAtMs : Date.now(),
    schedule,
    sessionTarget: row.sessionTarget === "isolated" ? "isolated" : "main",
    wakeMode: row.wakeMode === "now" ? "now" : "next-heartbeat",
    payload,
    delivery:
      row.delivery && typeof row.delivery === "object"
        ? (row.delivery as CronJob["delivery"])
        : undefined,
    state: row.state && typeof row.state === "object" ? (row.state as CronJob["state"]) : undefined,
  };
}

export function toCronStatus(entry: unknown): CronStatus | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  return {
    enabled: row.enabled === true,
    jobs: typeof row.jobs === "number" ? row.jobs : 0,
    nextWakeAtMs: typeof row.nextWakeAtMs === "number" ? row.nextWakeAtMs : null,
  };
}

export function toSkillStatusEntry(entry: unknown): SkillStatusEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const name = String(row.name ?? "").trim();
  if (!name) return null;
  const requirements =
    row.requirements && typeof row.requirements === "object" ? (row.requirements as Json) : {};
  const missing = row.missing && typeof row.missing === "object" ? (row.missing as Json) : {};
  return {
    name,
    description: String(row.description ?? ""),
    source: String(row.source ?? ""),
    filePath: String(row.filePath ?? ""),
    baseDir: String(row.baseDir ?? ""),
    skillKey: String(row.skillKey ?? name),
    bundled: row.bundled === true,
    primaryEnv: typeof row.primaryEnv === "string" ? row.primaryEnv : undefined,
    emoji: typeof row.emoji === "string" ? row.emoji : undefined,
    homepage: typeof row.homepage === "string" ? row.homepage : undefined,
    always: row.always === true,
    disabled: row.disabled === true,
    blockedByAllowlist: row.blockedByAllowlist === true,
    eligible: row.eligible !== false,
    requirements: {
      bins: Array.isArray(requirements.bins)
        ? requirements.bins.filter((value): value is string => typeof value === "string")
        : [],
      env: Array.isArray(requirements.env)
        ? requirements.env.filter((value): value is string => typeof value === "string")
        : [],
      config: Array.isArray(requirements.config)
        ? requirements.config.filter((value): value is string => typeof value === "string")
        : [],
      os: Array.isArray(requirements.os)
        ? requirements.os.filter((value): value is string => typeof value === "string")
        : [],
    },
    missing: {
      bins: Array.isArray(missing.bins)
        ? missing.bins.filter((value): value is string => typeof value === "string")
        : [],
      env: Array.isArray(missing.env)
        ? missing.env.filter((value): value is string => typeof value === "string")
        : [],
      config: Array.isArray(missing.config)
        ? missing.config.filter((value): value is string => typeof value === "string")
        : [],
      os: Array.isArray(missing.os)
        ? missing.os.filter((value): value is string => typeof value === "string")
        : [],
    },
    configChecks: Array.isArray(row.configChecks)
      ? row.configChecks
          .map((value) => {
            if (!value || typeof value !== "object") return null;
            const check = value as Json;
            const path = String(check.path ?? "").trim();
            if (!path) return null;
            return { path, satisfied: check.satisfied === true };
          })
          .filter((value): value is NonNullable<typeof value> => value !== null)
      : [],
    install: Array.isArray(row.install)
      ? row.install
          .map((value) => {
            if (!value || typeof value !== "object") return null;
            const install = value as Json;
            const id = String(install.id ?? "").trim();
            const kindRaw = String(install.kind ?? "");
            if (
              !id ||
              (kindRaw !== "brew" && kindRaw !== "node" && kindRaw !== "go" && kindRaw !== "uv")
            ) {
              return null;
            }
            const kind: "brew" | "node" | "go" | "uv" = kindRaw;
            return {
              id,
              kind,
              label: String(install.label ?? id),
              bins: Array.isArray(install.bins)
                ? install.bins.filter((item): item is string => typeof item === "string")
                : [],
            };
          })
          .filter((value): value is NonNullable<typeof value> => value !== null)
      : [],
  };
}

function toSkillManifestToolDependency(entry: unknown): SkillManifestToolDependency | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const type = String(row.type ?? "").trim();
  const value = String(row.value ?? "").trim();
  if (!type || !value) return null;
  return {
    type,
    value,
    description: typeof row.description === "string" ? row.description : undefined,
    transport: typeof row.transport === "string" ? row.transport : undefined,
    url: typeof row.url === "string" ? row.url : undefined,
  };
}

function toSkillManifest(entry: unknown): SkillManifest {
  const row = entry && typeof entry === "object" ? (entry as Json) : {};
  const interfaceRow =
    row.interface && typeof row.interface === "object" ? (row.interface as Json) : {};
  const policyRow = row.policy && typeof row.policy === "object" ? (row.policy as Json) : {};
  const dependenciesRow =
    row.dependencies && typeof row.dependencies === "object" ? (row.dependencies as Json) : {};
  const stateRow = row.state && typeof row.state === "object" ? (row.state as Json) : {};
  const pathsRow = row.paths && typeof row.paths === "object" ? (row.paths as Json) : {};
  const visualizationRow =
    row.visualization && typeof row.visualization === "object" ? (row.visualization as Json) : {};
  const demosRow = row.demos && typeof row.demos === "object" ? (row.demos as Json) : {};
  const labelsRow =
    demosRow.labels && typeof demosRow.labels === "object" ? (demosRow.labels as Json) : {};

  return {
    interface: {
      displayName: String(interfaceRow.displayName ?? ""),
      shortDescription: String(interfaceRow.shortDescription ?? ""),
      iconSmall: typeof interfaceRow.iconSmall === "string" ? interfaceRow.iconSmall : undefined,
      iconLarge: typeof interfaceRow.iconLarge === "string" ? interfaceRow.iconLarge : undefined,
      brandColor: typeof interfaceRow.brandColor === "string" ? interfaceRow.brandColor : undefined,
      defaultPrompt:
        typeof interfaceRow.defaultPrompt === "string" ? interfaceRow.defaultPrompt : undefined,
    },
    policy: {
      allowImplicitInvocation: policyRow.allowImplicitInvocation !== false,
    },
    dependencies: {
      tools: normalizeArray(dependenciesRow.tools, toSkillManifestToolDependency),
      skills: Array.isArray(dependenciesRow.skills)
        ? dependenciesRow.skills.filter((value): value is string => typeof value === "string")
        : [],
      docs: Array.isArray(dependenciesRow.docs)
        ? dependenciesRow.docs.filter((value): value is string => typeof value === "string")
        : [],
    },
    state: {
      mode:
        stateRow.mode === "agent_memory" ||
        stateRow.mode === "skill_memory" ||
        stateRow.mode === "stateless"
          ? stateRow.mode
          : "stateless",
      memoryFile: typeof stateRow.memoryFile === "string" ? stateRow.memoryFile : undefined,
    },
    paths: {
      read: Array.isArray(pathsRow.read)
        ? pathsRow.read.filter((value): value is string => typeof value === "string")
        : [],
      write: Array.isArray(pathsRow.write)
        ? pathsRow.write.filter((value): value is string => typeof value === "string")
        : [],
    },
    visualization: {
      mermaid: typeof visualizationRow.mermaid === "string" ? visualizationRow.mermaid : undefined,
    },
    references: Array.isArray(row.references)
      ? row.references.filter((value): value is string => typeof value === "string")
      : [],
    demos: {
      defaultCaseId:
        typeof demosRow.defaultCaseId === "string" ? demosRow.defaultCaseId : undefined,
      labels: Object.fromEntries(
        Object.entries(labelsRow).filter(([, value]) => typeof value === "string"),
      ) as Record<string, string>,
    },
  };
}

export function toSkillStudioCatalogEntry(entry: unknown): SkillStudioCatalogEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const skillId = String(row.skillId ?? "").trim();
  if (!skillId) return null;
  const runtimeStatus =
    row.runtimeStatus && typeof row.runtimeStatus === "object" ? (row.runtimeStatus as Json) : null;
  return {
    skillId,
    packageKey: String(row.packageKey ?? skillId),
    displayName: String(row.displayName ?? skillId),
    description: String(row.description ?? ""),
    category: String(row.category ?? "workflow"),
    scope: row.scope === "agent" ? "agent" : "shared",
    sourcePath: String(row.sourcePath ?? ""),
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : undefined,
    hasManifest: row.hasManifest === true,
    hasTests: row.hasTests === true,
    hasDiagram: row.hasDiagram === true,
    hasSkillMemory: row.hasSkillMemory === true,
    runtimeStatus: runtimeStatus
      ? {
          eligible: runtimeStatus.eligible !== false,
          blockedByAllowlist: runtimeStatus.blockedByAllowlist === true,
          disabled: runtimeStatus.disabled === true,
          source: typeof runtimeStatus.source === "string" ? runtimeStatus.source : "",
        }
      : undefined,
  };
}

export function toSkillStudioFileContent(entry: unknown): SkillStudioFileContent | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const filePath = String(row.path ?? "").trim();
  if (!filePath) return null;
  const kind =
    row.kind === "config" ||
    row.kind === "test" ||
    row.kind === "memory" ||
    row.kind === "fixture" ||
    row.kind === "asset" ||
    row.kind === "reference"
      ? row.kind
      : "skill";
  return {
    path: filePath,
    kind,
    isText: row.isText !== false,
    content: typeof row.content === "string" ? row.content : undefined,
    sizeBytes: typeof row.sizeBytes === "number" ? row.sizeBytes : undefined,
  };
}

function toSkillDemoCase(entry: unknown): SkillDemoCase | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  return {
    id,
    title: String(row.title ?? id),
    filePath: String(row.filePath ?? ""),
    stepCount: typeof row.stepCount === "number" ? row.stepCount : 0,
    relativePath: String(row.relativePath ?? ""),
  };
}

export function toSkillDemoRunResult(entry: unknown): SkillDemoRunResult | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const caseId = String(row.caseId ?? "").trim();
  if (!caseId) return null;
  return {
    caseId,
    caseName: String(row.caseName ?? caseId),
    passed: row.passed === true,
    durationMs: typeof row.durationMs === "number" ? row.durationMs : 0,
    stdout: String(row.stdout ?? ""),
    stderr: String(row.stderr ?? ""),
    filesChecked: Array.isArray(row.filesChecked)
      ? row.filesChecked.filter((value): value is string => typeof value === "string")
      : [],
    steps: Array.isArray(row.steps)
      ? row.steps
          .map((value) => {
            if (!value || typeof value !== "object") return null;
            const step = value as Json;
            return {
              run: Array.isArray(step.run)
                ? step.run.filter((item): item is string => typeof item === "string")
                : [],
              stdout: String(step.stdout ?? ""),
              stderr: String(step.stderr ?? ""),
              durationMs: typeof step.durationMs === "number" ? step.durationMs : 0,
              passed: step.passed === true,
              failures: Array.isArray(step.failures)
                ? step.failures.filter((item): item is string => typeof item === "string")
                : [],
            };
          })
          .filter((value): value is NonNullable<typeof value> => value !== null)
      : [],
  };
}

export function toSkillStudioDetail(entry: unknown): SkillStudioDetail | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const skillId = String(row.skillId ?? "").trim();
  if (!skillId) return null;
  return {
    skillId,
    packageKey: String(row.packageKey ?? skillId),
    displayName: String(row.displayName ?? skillId),
    description: String(row.description ?? ""),
    category: String(row.category ?? "workflow"),
    scope: row.scope === "agent" ? "agent" : "shared",
    sourcePath: String(row.sourcePath ?? ""),
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : undefined,
    manifest: toSkillManifest(row.manifest),
    manifestPath: String(row.manifestPath ?? ""),
    hasManifest: row.hasManifest === true,
    overviewMarkdown: String(row.overviewMarkdown ?? ""),
    mermaid: typeof row.mermaid === "string" ? row.mermaid : undefined,
    relatedSkills: Array.isArray(row.relatedSkills)
      ? row.relatedSkills.filter((value): value is string => typeof value === "string")
      : [],
    fileEntries: Array.isArray(row.fileEntries)
      ? row.fileEntries
          .map((value) => {
            if (!value || typeof value !== "object") return null;
            const file = value as Json;
            const filePath = String(file.path ?? "").trim();
            if (!filePath) return null;
            const kind =
              file.kind === "config" ||
              file.kind === "test" ||
              file.kind === "memory" ||
              file.kind === "fixture" ||
              file.kind === "asset" ||
              file.kind === "reference"
                ? file.kind
                : "skill";
            return {
              path: filePath,
              kind,
              isText: file.isText !== false,
            };
          })
          .filter((value): value is NonNullable<typeof value> => value !== null)
      : [],
    demoCases: normalizeArray(row.demoCases, toSkillDemoCase),
    runtimeStatus: toSkillStatusEntry(row.runtimeStatus),
    focusAgentId: typeof row.focusAgentId === "string" ? row.focusAgentId : undefined,
  };
}

export function toSkillStatusReport(entry: unknown): SkillStatusReport | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  return {
    workspaceDir: String(row.workspaceDir ?? ""),
    managedSkillsDir: String(row.managedSkillsDir ?? ""),
    skills: normalizeArray(row.skills, toSkillStatusEntry),
  };
}

export function toOfficeSettings(entry: unknown): OfficeSettingsModel {
  const row = entry && typeof entry === "object" ? (entry as Json) : {};
  const meshAssetDir =
    typeof row.meshAssetDir === "string" && row.meshAssetDir.trim() ? row.meshAssetDir.trim() : "";
  const viewProfile = row.viewProfile === "fixed_2_5d" ? "fixed_2_5d" : "free_orbit_3d";
  const orbitControlsEnabled = row.orbitControlsEnabled !== false;
  const cameraOrientation =
    row.cameraOrientation === "north_east" ||
    row.cameraOrientation === "north_west" ||
    row.cameraOrientation === "south_west"
      ? row.cameraOrientation
      : "south_east";
  const fallbackFootprint = normalizeOfficeFootprint(
    row.officeFootprint ?? DEFAULT_OFFICE_FOOTPRINT,
  );
  const officeLayout = normalizeOfficeLayout(row.officeLayout, fallbackFootprint);
  return {
    meshAssetDir,
    officeFootprint: getOfficeFootprintFromLayout(officeLayout),
    officeLayout,
    decor: normalizeOfficeDecorSettings(row.decor),
    viewProfile,
    orbitControlsEnabled,
    cameraOrientation,
  };
}

export function toMeshAsset(entry: unknown): MeshAssetModel | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const assetId = String(row.assetId ?? "").trim();
  const label = String(row.label ?? assetId).trim();
  const localPath = String(row.localPath ?? "").trim();
  const publicPath = String(row.publicPath ?? "").trim();
  const fileName = String(row.fileName ?? assetId).trim();
  if (!assetId || !localPath || !publicPath || !fileName) return null;
  return {
    assetId,
    label,
    localPath,
    publicPath,
    fileName,
    fileSizeBytes: Number(row.fileSizeBytes ?? 0),
    sourceType: row.sourceType === "downloaded" ? "downloaded" : "local",
    validated: row.validated !== false,
    addedAt: Number(row.addedAt ?? Date.now()),
    sourceUrl: typeof row.sourceUrl === "string" ? row.sourceUrl : undefined,
  };
}

export function toAgentMemoryEntry(agentId: string, entry: unknown): AgentMemoryEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  const sourcePath = String(row.sourcePath ?? "").trim();
  const lineNumber = typeof row.lineNumber === "number" ? row.lineNumber : Number.NaN;
  const rawText = String(row.rawText ?? "").trim();
  const text = String(row.text ?? row.rawText ?? "").trim();
  if (!sourcePath || !Number.isFinite(lineNumber) || !rawText || !text) return null;
  const type = String(row.type ?? "").trim();
  const normalizedType =
    type === "discovery" ||
    type === "decision" ||
    type === "problem" ||
    type === "solution" ||
    type === "pattern" ||
    type === "warning" ||
    type === "success" ||
    type === "refactor" ||
    type === "bugfix" ||
    type === "feature"
      ? type
      : undefined;
  return {
    id,
    agentId: String(row.agentId ?? agentId),
    source: {
      sourcePath,
      lineNumber,
    },
    rawText,
    text,
    ts:
      typeof row.ts === "number"
        ? row.ts
        : typeof row.timestamp === "number"
          ? row.timestamp
          : undefined,
    type: normalizedType,
    memId: typeof row.memId === "string" ? row.memId : undefined,
    tags: Array.isArray(row.tags)
      ? row.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : undefined,
  };
}

const VALID_ACTION_TYPES = new Set([
  "tool_call",
  "external_message",
  "deploy",
  "delete",
  "write",
  "config_change",
]);
const VALID_RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);

export function toPendingApproval(entry: unknown): PendingApprovalModel | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  const actionType = String(row.actionType ?? "tool_call");
  const riskLevel = String(row.riskLevel ?? "medium");
  return {
    id,
    agentId: String(row.agentId ?? "").trim(),
    actionType: VALID_ACTION_TYPES.has(actionType)
      ? (actionType as PendingApprovalModel["actionType"])
      : "tool_call",
    toolName: typeof row.toolName === "string" ? row.toolName : undefined,
    description: String(row.description ?? ""),
    riskLevel: VALID_RISK_LEVELS.has(riskLevel)
      ? (riskLevel as PendingApprovalModel["riskLevel"])
      : "medium",
    createdAt: typeof row.createdAt === "number" ? row.createdAt : Date.now(),
    context: typeof row.context === "string" ? row.context : undefined,
    status: row.status === "approved" || row.status === "rejected" ? row.status : "pending",
  };
}

export const COMPANY_STORAGE_KEY = "shellcorp.company-model.v1";
export const OFFICE_OBJECTS_STORAGE_KEY = "shellcorp.office-objects.v1";
export const CLUSTER_BOUNDARY_LIMIT = 17.5;
export const DEFAULT_COMPANY_MODEL: CompanyModel = {
  version: 1,
  departments: [
    {
      id: "dept-ceo",
      name: "CEO Office",
      description: "Executive control and personal operations.",
      goal: "Keep company direction aligned and profitable.",
    },
    {
      id: "dept-products",
      name: "Product Studio",
      description: "Project teams that build and grow products.",
      goal: "Ship and grow profitable products.",
    },
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
  tasks: [],
  federationPolicies: [],
  providerIndexProfiles: [],
  heartbeatProfiles: [
    {
      id: "hb-ceo",
      role: "ceo",
      cadenceMinutes: 15,
      teamDescription: "Executive command center",
      productDetails: "Cross-project strategy",
      goal: "Drive measurable progress toward company goals.",
    },
    {
      id: "hb-biz-pm",
      role: "biz_pm",
      cadenceMinutes: 5,
      teamDescription: "Business PM loop",
      productDetails: "Review KPIs and profitability, manage kanban",
      goal: "Keep business net-positive and execution focused.",
    },
    {
      id: "hb-biz-executor",
      role: "biz_executor",
      cadenceMinutes: 5,
      teamDescription: "Business execution loop",
      productDetails: "Execute highest-priority growth tasks",
      goal: "Produce measurable growth output every heartbeat.",
    },
  ],
  channelBindings: [],
  heartbeatRuntime: {
    enabled: true,
    pluginId: "shellcorp-heartbeat",
    serviceId: "company-heartbeat-loop",
    cadenceMinutes: 10,
    notes: "Run via OpenClaw plugin service/hooks.",
  },
};

export function asRecord(value: unknown): Json {
  return value && typeof value === "object" ? (value as Json) : {};
}

export function toDepartment(entry: unknown): DepartmentModel | null {
  const row = asRecord(entry);
  const id = String(row.id ?? "").trim();
  const name = String(row.name ?? "").trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    description: String(row.description ?? ""),
    goal: String(row.goal ?? ""),
  };
}

export function toCapabilitySlot(
  entry: unknown,
  fallbackCategory: "measure" | "execute" | "distribute",
): CapabilitySlotModel {
  const row = asRecord(entry);
  const skillId = String(row.skillId ?? "").trim();
  const categoryRaw = String(row.category ?? fallbackCategory);
  const category =
    categoryRaw === "measure" || categoryRaw === "execute" || categoryRaw === "distribute"
      ? categoryRaw
      : fallbackCategory;
  const configNode = asRecord(row.config);
  const config: Record<string, string> = {};
  for (const [key, value] of Object.entries(configNode)) {
    if (typeof value === "string") config[key] = value;
  }
  return {
    skillId: skillId || `${category}-skill`,
    category,
    config,
  };
}

export function toBusinessConfig(entry: unknown): BusinessConfigModel | undefined {
  const row = asRecord(entry);
  const type = String(row.type ?? "").trim();
  if (!type) return undefined;
  const slots = asRecord(row.slots);
  return {
    type,
    slots: {
      measure: toCapabilitySlot(slots.measure, "measure"),
      execute: toCapabilitySlot(slots.execute, "execute"),
      distribute: toCapabilitySlot(slots.distribute, "distribute"),
    },
  };
}

export function toLedgerEntry(projectId: string, entry: unknown): LedgerEntryModel | null {
  const row = asRecord(entry);
  const id = String(row.id ?? "").trim();
  const timestamp = String(row.timestamp ?? "").trim();
  const source = String(row.source ?? "").trim();
  const description = String(row.description ?? "").trim();
  if (!id || !timestamp || !source || !description) return null;
  const amount = Number(row.amount ?? 0);
  return {
    id,
    projectId: String(row.projectId ?? projectId),
    timestamp,
    type: row.type === "revenue" ? "revenue" : "cost",
    amount: Number.isFinite(amount) ? amount : 0,
    currency: String(row.currency ?? "USD"),
    source,
    description,
    experimentId: typeof row.experimentId === "string" ? row.experimentId : undefined,
  };
}

export function toProjectAccount(
  projectId: string,
  entry: unknown,
): ProjectAccountModel | undefined {
  const row = asRecord(entry);
  const id = String(row.id ?? "").trim();
  const updatedAt = String(row.updatedAt ?? "").trim();
  if (!id || !updatedAt) return undefined;
  const balanceCents = Number(row.balanceCents ?? 0);
  return {
    id,
    projectId: String(row.projectId ?? projectId),
    currency: String(row.currency ?? "USD"),
    balanceCents: Number.isFinite(balanceCents) ? Math.round(balanceCents) : 0,
    updatedAt,
  };
}

export function toProjectAccountEvent(
  projectId: string,
  entry: unknown,
): ProjectAccountEventModel | null {
  const row = asRecord(entry);
  const id = String(row.id ?? "").trim();
  const accountId = String(row.accountId ?? "").trim();
  const timestamp = String(row.timestamp ?? "").trim();
  const source = String(row.source ?? "").trim();
  if (!id || !accountId || !timestamp || !source) return null;
  const amountCents = Number(row.amountCents ?? 0);
  const balanceAfterCents = Number(row.balanceAfterCents ?? 0);
  return {
    id,
    projectId: String(row.projectId ?? projectId),
    accountId,
    timestamp,
    type: row.type === "credit" ? "credit" : "debit",
    amountCents: Number.isFinite(amountCents) ? Math.round(amountCents) : 0,
    source,
    note: typeof row.note === "string" ? row.note : undefined,
    balanceAfterCents: Number.isFinite(balanceAfterCents) ? Math.round(balanceAfterCents) : 0,
  };
}

export function toExperiment(projectId: string, entry: unknown): ExperimentModel | null {
  const row = asRecord(entry);
  const id = String(row.id ?? "").trim();
  const hypothesis = String(row.hypothesis ?? "").trim();
  const startedAt = String(row.startedAt ?? "").trim();
  if (!id || !hypothesis || !startedAt) return null;
  const statusRaw = String(row.status ?? "running");
  const status = statusRaw === "completed" || statusRaw === "failed" ? statusRaw : "running";
  const metricsBeforeNode = asRecord(row.metricsBefore);
  const metricsAfterNode = asRecord(row.metricsAfter);
  const metricsBefore: Record<string, number> = {};
  const metricsAfter: Record<string, number> = {};
  for (const [key, value] of Object.entries(metricsBeforeNode)) {
    if (typeof value === "number" && Number.isFinite(value)) metricsBefore[key] = value;
  }
  for (const [key, value] of Object.entries(metricsAfterNode)) {
    if (typeof value === "number" && Number.isFinite(value)) metricsAfter[key] = value;
  }
  return {
    id,
    projectId: String(row.projectId ?? projectId),
    hypothesis,
    status,
    startedAt,
    endedAt: typeof row.endedAt === "string" ? row.endedAt : undefined,
    results: typeof row.results === "string" ? row.results : undefined,
    metricsBefore: Object.keys(metricsBefore).length > 0 ? metricsBefore : undefined,
    metricsAfter: Object.keys(metricsAfter).length > 0 ? metricsAfter : undefined,
  };
}

export function toMetricEvent(projectId: string, entry: unknown): MetricEventModel | null {
  const row = asRecord(entry);
  const id = String(row.id ?? "").trim();
  const timestamp = String(row.timestamp ?? "").trim();
  const source = String(row.source ?? "").trim();
  if (!id || !timestamp || !source) return null;
  const metricsNode = asRecord(row.metrics);
  const metrics: Record<string, number> = {};
  for (const [key, value] of Object.entries(metricsNode)) {
    if (typeof value === "number" && Number.isFinite(value)) metrics[key] = value;
  }
  if (Object.keys(metrics).length === 0) return null;
  return {
    id,
    projectId: String(row.projectId ?? projectId),
    timestamp,
    source,
    metrics,
  };
}

export function toResourceType(
  entry: unknown,
): "cash_budget" | "api_quota" | "distribution_slots" | "custom" {
  if (
    entry === "cash_budget" ||
    entry === "api_quota" ||
    entry === "distribution_slots" ||
    entry === "custom"
  ) {
    return entry;
  }
  return "custom";
}

export function toResourceLowBehavior(
  entry: unknown,
): "warn" | "deprioritize_expensive_tasks" | "ask_pm_review" {
  if (entry === "deprioritize_expensive_tasks" || entry === "ask_pm_review") return entry;
  return "warn";
}

export function toResourceEventKind(entry: unknown): "refresh" | "consumption" | "adjustment" {
  if (entry === "refresh" || entry === "consumption") return entry;
  return "adjustment";
}

export function toProjectResource(projectId: string, entry: unknown): ProjectResourceModel | null {
  const row = asRecord(entry);
  const id = String(row.id ?? "").trim();
  const name = String(row.name ?? "").trim();
  const unit = String(row.unit ?? "").trim();
  const trackerSkillId = String(row.trackerSkillId ?? "").trim();
  if (!id || !name || !unit || !trackerSkillId) return null;
  const policy = asRecord(row.policy);
  const metadataNode = asRecord(row.metadata);
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadataNode)) {
    if (typeof value === "string") metadata[key] = value;
  }
  const remaining = Number(row.remaining ?? 0);
  const limit = Number(row.limit ?? 0);
  const reserved = Number(row.reserved ?? Number.NaN);
  const refreshCadenceMinutes = Number(row.refreshCadenceMinutes ?? Number.NaN);
  return {
    id,
    projectId: String(row.projectId ?? projectId),
    type: toResourceType(row.type),
    name,
    unit,
    remaining: Number.isFinite(remaining) ? remaining : 0,
    limit: Number.isFinite(limit) ? limit : 0,
    reserved: Number.isFinite(reserved) ? reserved : undefined,
    trackerSkillId,
    refreshCadenceMinutes: Number.isFinite(refreshCadenceMinutes)
      ? Math.max(1, Math.floor(refreshCadenceMinutes))
      : undefined,
    policy: {
      advisoryOnly: true,
      softLimit: Number.isFinite(Number(policy.softLimit)) ? Number(policy.softLimit) : undefined,
      hardLimit: Number.isFinite(Number(policy.hardLimit)) ? Number(policy.hardLimit) : undefined,
      whenLow: toResourceLowBehavior(policy.whenLow),
    },
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

export function toResourceEvent(projectId: string, entry: unknown): ResourceEventModel | null {
  const row = asRecord(entry);
  const id = String(row.id ?? "").trim();
  const resourceId = String(row.resourceId ?? "").trim();
  const ts = String(row.ts ?? "").trim();
  const source = String(row.source ?? "").trim();
  if (!id || !resourceId || !ts || !source) return null;
  const delta = Number(row.delta ?? 0);
  const remainingAfter = Number(row.remainingAfter ?? 0);
  return {
    id,
    projectId: String(row.projectId ?? projectId),
    resourceId,
    ts,
    kind: toResourceEventKind(row.kind),
    delta: Number.isFinite(delta) ? delta : 0,
    remainingAfter: Number.isFinite(remainingAfter) ? remainingAfter : 0,
    source,
    note: typeof row.note === "string" ? row.note : undefined,
  };
}

export function toProject(entry: unknown): ProjectModel | null {
  const row = asRecord(entry);
  const id = String(row.id ?? "").trim();
  const departmentId = String(row.departmentId ?? "").trim();
  const name = String(row.name ?? "").trim();
  if (!id || !departmentId || !name) return null;
  const status = String(row.status ?? "active");
  const ledger = normalizeArray(row.ledger, (item) => toLedgerEntry(id, item));
  const accountEvents = normalizeArray(row.accountEvents, (item) =>
    toProjectAccountEvent(id, item),
  );
  return {
    id,
    departmentId,
    name,
    githubUrl: String(row.githubUrl ?? ""),
    status: status === "paused" || status === "archived" ? status : "active",
    goal: String(row.goal ?? ""),
    kpis: Array.isArray(row.kpis)
      ? row.kpis.filter((item): item is string => typeof item === "string")
      : [],
    trackingContext: typeof row.trackingContext === "string" ? row.trackingContext : undefined,
    businessConfig: toBusinessConfig(row.businessConfig),
    account:
      toProjectAccount(id, row.account) ??
      (accountEvents.length > 0
        ? {
            id: `${id}:account`,
            projectId: id,
            currency: "USD",
            balanceCents: accountEvents[accountEvents.length - 1]?.balanceAfterCents ?? 0,
            updatedAt:
              accountEvents[accountEvents.length - 1]?.timestamp ?? new Date().toISOString(),
          }
        : undefined),
    accountEvents,
    ledger,
    experiments: normalizeArray(row.experiments, (item) => toExperiment(id, item)),
    metricEvents: normalizeArray(row.metricEvents, (item) => toMetricEvent(id, item)),
    resources: normalizeArray(row.resources, (item) => toProjectResource(id, item)),
    resourceEvents: normalizeArray(row.resourceEvents, (item) => toResourceEvent(id, item)),
  };
}

export function toCompanyAgent(entry: unknown): CompanyAgentModel | null {
  const row = asRecord(entry);
  const agentId = String(row.agentId ?? "").trim();
  const role = String(row.role ?? "");
  if (!agentId) return null;
  if (
    role !== "ceo" &&
    role !== "builder" &&
    role !== "growth_marketer" &&
    role !== "pm" &&
    role !== "biz_pm" &&
    role !== "biz_executor"
  )
    return null;
  const lifecycle = String(row.lifecycleState ?? "active");
  return {
    agentId,
    role,
    projectId:
      typeof row.projectId === "string" && row.projectId.trim() ? row.projectId : undefined,
    heartbeatProfileId: String(row.heartbeatProfileId ?? ""),
    isCeo: Boolean(row.isCeo),
    lifecycleState:
      lifecycle === "idle" || lifecycle === "pending_spawn" || lifecycle === "retired"
        ? lifecycle
        : "active",
  };
}

export function toRoleSlot(entry: unknown): RoleSlotModel | null {
  const row = asRecord(entry);
  const projectId = String(row.projectId ?? "").trim();
  const role = String(row.role ?? "");
  if (!projectId) return null;
  if (
    role !== "builder" &&
    role !== "growth_marketer" &&
    role !== "pm" &&
    role !== "biz_pm" &&
    role !== "biz_executor"
  )
    return null;
  const desiredCount = Number(row.desiredCount ?? 0);
  return {
    projectId,
    role,
    desiredCount: Number.isFinite(desiredCount) ? Math.max(0, Math.floor(desiredCount)) : 0,
    spawnPolicy: row.spawnPolicy === "manual" ? "manual" : "queue_pressure",
  };
}

export function toTask(entry: unknown): FederatedTaskModel | null {
  const row = asRecord(entry);
  const id = String(row.id ?? "").trim();
  const projectId = String(row.projectId ?? "").trim();
  const title = String(row.title ?? "").trim();
  if (!id || !projectId || !title) return null;
  const status = String(row.status ?? "todo");
  const priority = String(row.priority ?? "medium");
  const provider = String(row.provider ?? row.sourceProvider ?? "internal");
  const canonicalProvider = String(row.canonicalProvider ?? (provider || "internal"));
  const syncState = String(row.syncState ?? "healthy");
  const artefactPathRaw =
    typeof row.artefactPath === "string"
      ? row.artefactPath
      : typeof row.artifactPath === "string"
        ? row.artifactPath
        : "";
  const artefactPath = artefactPathRaw.trim() || undefined;
  return {
    id,
    projectId,
    title,
    status:
      status === "in_progress" || status === "review" || status === "blocked" || status === "done"
        ? status
        : "todo",
    ownerAgentId: typeof row.ownerAgentId === "string" ? row.ownerAgentId : undefined,
    priority: priority === "low" || priority === "high" ? priority : "medium",
    provider:
      provider === "notion" || provider === "vibe" || provider === "linear" ? provider : "internal",
    canonicalProvider:
      canonicalProvider === "notion" ||
      canonicalProvider === "vibe" ||
      canonicalProvider === "linear"
        ? canonicalProvider
        : "internal",
    providerUrl:
      typeof row.providerUrl === "string" && row.providerUrl.trim() ? row.providerUrl : undefined,
    artefactPath,
    syncState:
      syncState === "pending" || syncState === "conflict" || syncState === "error"
        ? (syncState as TaskSyncState)
        : "healthy",
    syncError:
      typeof row.syncError === "string" && row.syncError.trim() ? row.syncError : undefined,
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : Date.now(),
  };
}

export function toFederationPolicy(entry: unknown): FederationProjectPolicy | null {
  const row = asRecord(entry);
  const projectId = String(row.projectId ?? "").trim();
  if (!projectId) return null;
  const canonicalProvider = String(row.canonicalProvider ?? "internal");
  const mirrors = Array.isArray(row.mirrors)
    ? row.mirrors
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(
          (value) =>
            value === "internal" || value === "notion" || value === "vibe" || value === "linear",
        )
    : [];
  const conflictPolicy = String(row.conflictPolicy ?? "canonical_wins");
  return {
    projectId,
    canonicalProvider:
      canonicalProvider === "notion" ||
      canonicalProvider === "vibe" ||
      canonicalProvider === "linear"
        ? canonicalProvider
        : "internal",
    mirrors,
    writeBackEnabled: row.writeBackEnabled === true,
    conflictPolicy: conflictPolicy === "newest_wins" ? "newest_wins" : "canonical_wins",
  };
}

export function hashSchemaVersion(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }
  return `schema-${Math.abs(hash)}`;
}

export function toProviderIndexProfile(entry: unknown): ProviderIndexProfile | null {
  const row = asRecord(entry);
  const projectId = String(row.projectId ?? "").trim();
  const provider = String(row.provider ?? "notion");
  const entityId = String(row.entityId ?? "").trim();
  if (!projectId || !entityId) return null;
  const fields = Array.isArray(row.fieldMappings)
    ? row.fieldMappings
        .map((field) => {
          const value = asRecord(field);
          const name = String(value.name ?? "").trim();
          const type = String(value.type ?? "").trim();
          if (!name || !type) return null;
          return {
            name,
            type,
            description: typeof value.description === "string" ? value.description : undefined,
            options: Array.isArray(value.options)
              ? value.options.filter((item): item is string => typeof item === "string")
              : undefined,
          };
        })
        .filter((value): value is NonNullable<typeof value> => value !== null)
    : [];
  const schemaPayload = JSON.stringify({
    provider,
    entityId,
    fields: fields.map((field) => ({ name: field.name, type: field.type })),
  });
  return {
    profileId: String(row.profileId ?? `${projectId}:${provider}:${entityId}`),
    projectId,
    provider:
      provider === "internal" || provider === "vibe" || provider === "linear" ? provider : "notion",
    entityId,
    entityName: String(row.entityName ?? entityId),
    toolNamingPrefix: typeof row.toolNamingPrefix === "string" ? row.toolNamingPrefix : undefined,
    fetchCommandHints: Array.isArray(row.fetchCommandHints)
      ? row.fetchCommandHints.filter((item): item is string => typeof item === "string")
      : [],
    fieldMappings: fields,
    schemaVersion: String(row.schemaVersion ?? hashSchemaVersion(schemaPayload)),
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : Date.now(),
  };
}

export function resolveCanonicalWriteProvider(
  policy: FederationProjectPolicy | null,
  fallback: FederatedTaskModel["provider"],
): FederatedTaskModel["provider"] {
  if (!policy) return fallback;
  return policy.canonicalProvider;
}

export function toHeartbeatProfile(entry: unknown): HeartbeatProfileModel | null {
  const row = asRecord(entry);
  const id = String(row.id ?? "").trim();
  const role = String(row.role ?? "");
  if (!id) return null;
  if (
    role !== "ceo" &&
    role !== "builder" &&
    role !== "growth_marketer" &&
    role !== "pm" &&
    role !== "biz_pm" &&
    role !== "biz_executor"
  )
    return null;
  const cadenceMinutes = Number(row.cadenceMinutes ?? 10);
  return {
    id,
    role,
    cadenceMinutes: Number.isFinite(cadenceMinutes) ? Math.max(1, Math.floor(cadenceMinutes)) : 10,
    teamDescription: String(row.teamDescription ?? ""),
    productDetails: String(row.productDetails ?? ""),
    goal: String(row.goal ?? ""),
  };
}

export function toChannelBinding(entry: unknown): ChannelBindingModel | null {
  const row = asRecord(entry);
  const platform = String(row.platform ?? "");
  const externalChannelId = String(row.externalChannelId ?? "").trim();
  const projectId = String(row.projectId ?? "").trim();
  const agentRole = String(row.agentRole ?? "");
  if (!externalChannelId || !projectId) return null;
  if (platform !== "slack" && platform !== "discord") return null;
  if (
    agentRole !== "ceo" &&
    agentRole !== "builder" &&
    agentRole !== "growth_marketer" &&
    agentRole !== "pm" &&
    agentRole !== "biz_pm" &&
    agentRole !== "biz_executor"
  ) {
    return null;
  }
  return {
    platform,
    externalChannelId,
    projectId,
    agentRole,
    agentIdOverride: typeof row.agentIdOverride === "string" ? row.agentIdOverride : undefined,
    routingMode: row.routingMode === "override_agent" ? "override_agent" : "default_pm",
  };
}

export function toOfficeObject(entry: unknown): CompanyOfficeObjectModel | null {
  const row = asRecord(entry);
  const id = String(row.id ?? "").trim();
  const meshType = String(row.meshType ?? "");
  if (!id) return null;
  if (
    meshType !== "team-cluster" &&
    meshType !== "plant" &&
    meshType !== "couch" &&
    meshType !== "bookshelf" &&
    meshType !== "pantry" &&
    meshType !== "glass-wall" &&
    meshType !== "custom-mesh" &&
    meshType !== "wall-art"
  ) {
    return null;
  }
  const positionInput = Array.isArray(row.position) ? row.position : [];
  if (positionInput.length !== 3 || positionInput.some((value) => typeof value !== "number"))
    return null;
  const px = Number(positionInput[0]);
  const py = Number(positionInput[1]);
  const pz = Number(positionInput[2]);
  if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) return null;
  const rotationInput = Array.isArray(row.rotation) ? row.rotation : undefined;
  const scaleInput = Array.isArray(row.scale) ? row.scale : undefined;
  return {
    id,
    meshType,
    position: [px, py, pz],
    rotation:
      rotationInput &&
      rotationInput.length === 3 &&
      rotationInput.every((value) => typeof value === "number")
        ? [Number(rotationInput[0]), Number(rotationInput[1]), Number(rotationInput[2])]
        : undefined,
    scale:
      scaleInput &&
      scaleInput.length === 3 &&
      scaleInput.every((value) => typeof value === "number")
        ? [Number(scaleInput[0]), Number(scaleInput[1]), Number(scaleInput[2])]
        : undefined,
    projectId: typeof row.projectId === "string" ? row.projectId : undefined,
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : undefined,
  };
}

export function toOfficeObjectSidecar(entry: unknown): OfficeObjectSidecarModel | null {
  const row = asRecord(entry);
  const id = String(row.id ?? row._id ?? row.identifier ?? "").trim();
  const identifier = String(row.identifier ?? id).trim();
  const meshType = String(row.meshType ?? "");
  if (!id || !identifier) return null;
  if (
    meshType !== "team-cluster" &&
    meshType !== "plant" &&
    meshType !== "couch" &&
    meshType !== "bookshelf" &&
    meshType !== "pantry" &&
    meshType !== "glass-wall" &&
    meshType !== "custom-mesh" &&
    meshType !== "wall-art"
  ) {
    return null;
  }
  const positionInput = Array.isArray(row.position) ? row.position : [];
  if (positionInput.length !== 3 || positionInput.some((value) => typeof value !== "number"))
    return null;
  const px = Number(positionInput[0]);
  const py = Number(positionInput[1]);
  const pz = Number(positionInput[2]);
  if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) return null;
  const rotationInput = Array.isArray(row.rotation) ? row.rotation : undefined;
  const scaleInput = Array.isArray(row.scale) ? row.scale : undefined;
  return {
    id,
    identifier,
    meshType,
    position: [px, py, pz],
    rotation:
      rotationInput &&
      rotationInput.length === 3 &&
      rotationInput.every((value) => typeof value === "number")
        ? [Number(rotationInput[0]), Number(rotationInput[1]), Number(rotationInput[2])]
        : undefined,
    scale:
      scaleInput &&
      scaleInput.length === 3 &&
      scaleInput.every((value) => typeof value === "number")
        ? [Number(scaleInput[0]), Number(scaleInput[1]), Number(scaleInput[2])]
        : undefined,
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : undefined,
  };
}

export function toCanonicalOfficeObjectId(id: string): string {
  const trimmed = id.trim();
  return trimmed.startsWith("office-") ? trimmed.slice("office-".length) : trimmed;
}

export function normalizeCompanyModel(value: unknown): CompanyModel {
  const row = asRecord(value);
  const departments = normalizeArray(row.departments, toDepartment);
  const projects = normalizeArray(row.projects, toProject);
  const agents = normalizeArray(row.agents, toCompanyAgent);
  const roleSlots = normalizeArray(row.roleSlots, toRoleSlot);
  const tasks = normalizeArray(row.tasks, toTask);
  const federationPolicies = normalizeArray(row.federationPolicies, toFederationPolicy);
  const providerIndexProfiles = normalizeArray(row.providerIndexProfiles, toProviderIndexProfile);
  const heartbeatProfiles = normalizeArray(row.heartbeatProfiles, toHeartbeatProfile);
  const channelBindings = normalizeArray(row.channelBindings, toChannelBinding);
  const officeObjects = normalizeArray(row.officeObjects, toOfficeObject);
  const runtime = asRecord(row.heartbeatRuntime);
  return {
    version: Number(row.version ?? 1),
    departments: departments.length > 0 ? departments : DEFAULT_COMPANY_MODEL.departments,
    projects,
    agents: agents.length > 0 ? agents : DEFAULT_COMPANY_MODEL.agents,
    roleSlots,
    tasks,
    federationPolicies,
    providerIndexProfiles,
    heartbeatProfiles:
      heartbeatProfiles.length > 0 ? heartbeatProfiles : DEFAULT_COMPANY_MODEL.heartbeatProfiles,
    channelBindings,
    heartbeatRuntime: {
      enabled: runtime.enabled !== false,
      pluginId: String(runtime.pluginId ?? DEFAULT_COMPANY_MODEL.heartbeatRuntime.pluginId),
      serviceId: String(runtime.serviceId ?? DEFAULT_COMPANY_MODEL.heartbeatRuntime.serviceId),
      cadenceMinutes: Math.max(
        1,
        Number(runtime.cadenceMinutes ?? DEFAULT_COMPANY_MODEL.heartbeatRuntime.cadenceMinutes),
      ),
      notes: typeof runtime.notes === "string" ? runtime.notes : undefined,
    },
    officeObjects,
  };
}

export function buildWorkload(company: CompanyModel): ProjectWorkloadSummary[] {
  return company.projects.map((project) => {
    const tasks = company.tasks.filter((task) => task.projectId === project.id);
    const openTickets = tasks.filter((task) => task.status !== "done").length;
    const closedTickets = tasks.filter((task) => task.status === "done").length;
    const ratio = closedTickets === 0 ? openTickets : openTickets / closedTickets;
    const queuePressure = ratio > 2 ? "high" : ratio > 1 ? "medium" : "low";
    return { projectId: project.id, openTickets, closedTickets, queuePressure };
  });
}

export function buildReconciliationWarnings(
  company: CompanyModel,
  runtimeAgents: AgentCardModel[],
  configuredAgents: AgentCardModel[],
): ReconciliationWarning[] {
  const warnings: ReconciliationWarning[] = [];
  const runtimeIds = new Set(runtimeAgents.map((agent) => agent.agentId));
  const configuredIds = new Set(configuredAgents.map((agent) => agent.agentId));
  const metaIds = new Set(company.agents.map((agent) => agent.agentId));

  for (const metaAgent of company.agents) {
    if (
      metaAgent.lifecycleState === "active" &&
      configuredIds.has(metaAgent.agentId) &&
      !runtimeIds.has(metaAgent.agentId)
    ) {
      warnings.push({
        code: "missing_runtime_agent",
        message: `Expected active agent '${metaAgent.agentId}' is missing from OpenClaw runtime.`,
      });
    }
  }

  for (const runtimeAgent of runtimeAgents) {
    if (!metaIds.has(runtimeAgent.agentId)) {
      warnings.push({
        code: "runtime_not_in_sidecar",
        message: `Runtime agent '${runtimeAgent.agentId}' has no sidecar mapping.`,
      });
    }
  }

  for (const configuredAgent of configuredAgents) {
    if (!runtimeIds.has(configuredAgent.agentId)) {
      warnings.push({
        code: "configured_agent_not_running",
        message: `Configured agent '${configuredAgent.agentId}' exists in openclaw.json but is not currently running.`,
      });
    }
  }

  for (const slot of company.roleSlots) {
    const activeCount = company.agents.filter(
      (agent) =>
        agent.projectId === slot.projectId &&
        agent.role === slot.role &&
        agent.lifecycleState === "active",
    ).length;
    if (activeCount < slot.desiredCount) {
      warnings.push({
        code: "role_slot_deficit",
        message: `Project '${slot.projectId}' has ${activeCount}/${slot.desiredCount} active '${slot.role}' agents.`,
      });
    }
  }

  for (const binding of company.channelBindings) {
    const targetAgent =
      binding.agentIdOverride ||
      company.agents.find(
        (agent) =>
          agent.projectId === binding.projectId &&
          agent.role === binding.agentRole &&
          agent.lifecycleState === "active",
      )?.agentId;
    if (!targetAgent) {
      warnings.push({
        code: "channel_binding_missing_target",
        message: `Channel '${binding.platform}:${binding.externalChannelId}' has no active target agent.`,
      });
    }
  }

  for (const companyAgent of company.agents) {
    if (!configuredIds.has(companyAgent.agentId)) {
      warnings.push({
        code: "sidecar_not_in_config",
        message: `Company sidecar agent '${companyAgent.agentId}' is not present in openclaw.json agents.list.`,
      });
    }
  }

  return warnings;
}

export function parseConfiguredAgentsFromConfig(
  snapshot: OpenClawConfigSnapshot | null,
): AgentCardModel[] {
  if (!snapshot) return [];
  const root = asRecord(snapshot.config);
  const agentsNode = asRecord(root.agents);
  const list = Array.isArray(agentsNode.list) ? agentsNode.list : [];
  return normalizeArray(list, (entry) => {
    const row = asRecord(entry);
    const id = String(row.id ?? row.agentId ?? "").trim();
    if (!id) return null;
    const sandbox = asRecord(row.sandbox);
    const tools = asRecord(row.tools);
    return {
      agentId: id,
      displayName: String(row.name ?? row.displayName ?? id),
      workspacePath: String(row.workspace ?? row.workspacePath ?? ""),
      agentDir: String(row.agentDir ?? ""),
      sandboxMode: String(sandbox.mode ?? "off"),
      toolPolicy: {
        allow: Array.isArray(tools.allow)
          ? tools.allow.filter((item): item is string => typeof item === "string")
          : [],
        deny: Array.isArray(tools.deny)
          ? tools.deny.filter((item): item is string => typeof item === "string")
          : [],
      },
      sessionCount: 0,
    };
  });
}
