/**
 * OPENCLAW ADAPTER
 * ================
 * Maps OpenClaw-backed HTTP surfaces into Shell Company UI contracts.
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
  ProjectWorkloadSummary,
  ReconciliationWarning,
  RoleSlotModel,
  SkillStatusEntry,
  SkillStatusReport,
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
} from "./openclaw-types";
import { buildGatewayHeaders } from "./gateway-config";
import type { GatewayWsClient } from "./gateway-ws-client";
import type { BusinessBuilderResourceDraft } from "./business-builder";
import { toProjectResources } from "./business-builder";

type Json = Record<string, unknown>;
const HEARTBEAT_START_PATTERN = /read\s+heartbeat\.md[\s\S]*current\s+time:/i;
const HEARTBEAT_OK_PATTERN = /\bHEARTBEAT_OK\b/i;
const HEARTBEAT_ERROR_PATTERN = /\b(error|failed|exception|timeout|circuit_open)\b/i;
const MAX_HEARTBEAT_BUBBLES = 3;

function normalizeArray<T>(value: unknown, map: (entry: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(map).filter((entry): entry is T => entry !== null);
}

function toAgent(entry: unknown): AgentCardModel | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const agentId = String(row.agentId ?? row.id ?? "").trim();
  if (!agentId) return null;
  const allow = Array.isArray((row.toolPolicy as Json | undefined)?.allow)
    ? ((row.toolPolicy as Json).allow as unknown[]).filter((v): v is string => typeof v === "string")
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

function toSession(agentId: string, entry: unknown): SessionRowModel | null {
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

function toTimeline(agentId: string, sessionKey: string, payload: unknown): SessionTimelineModel {
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
        sourceRaw === "heartbeat" || sourceRaw === "ui" || sourceRaw === "operator" || sourceRaw === "unknown"
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

  return {
    agentId,
    sessionKey,
    tokenUsage: row.tokenUsage && typeof row.tokenUsage === "object" ? (row.tokenUsage as SessionTimelineModel["tokenUsage"]) : undefined,
    events,
  };
}

function scoreBubbleLabel(text: string): string[] {
  const labels = new Set<string>();
  const toolMatch = text.match(/\b(ReadFile|WriteFile|Edit|ApplyPatch|Shell|Bash|TodoWrite|AskQuestion|Subagent|SemanticSearch|WebSearch)\b/gi);
  for (const hit of toolMatch ?? []) labels.add(hit);
  const skillMatch = text.match(/\b(skill|skills)\s*[:=]\s*([a-z0-9_-]+)/i);
  if (skillMatch?.[2]) labels.add(`skill:${skillMatch[2]}`);
  return [...labels];
}

function isHeartbeatStartEvent(event: SessionTimelineEvent): boolean {
  return HEARTBEAT_START_PATTERN.test(event.text);
}

function isOperatorLikeMessage(event: SessionTimelineEvent): boolean {
  if (event.source === "ui" || event.source === "operator") return true;
  return event.role === "user" && !isHeartbeatStartEvent(event);
}

function finalizeHeartbeatWindow(
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

export function parseHeartbeatWindows(events: SessionTimelineEvent[], sessionKey: string): HeartbeatWindow[] {
  const windows: HeartbeatWindow[] = [];
  const ordered = [...events].sort((a, b) => a.ts - b.ts);
  let counter = 0;
  let current:
    | {
        beatId: string;
        sessionKey: string;
        startedAt: number;
        trigger: HeartbeatWindow["trigger"];
        status: HeartbeatWindow["status"];
        summary: string;
        eventCount: number;
        actionCount: number;
        bubbles: Map<string, number>;
      }
    | null = null;

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

function toSkill(entry: unknown): SkillItemModel | null {
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

function toMemory(entry: unknown): MemoryItemModel | null {
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

function toAgentFileEntry(entry: unknown): AgentFileEntry | null {
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

function toAgentsFilesListResult(entry: unknown): AgentsFilesListResult | null {
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

function toAgentsFilesGetResult(entry: unknown): AgentsFilesGetResult | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const agentId = String(row.agentId ?? "").trim();
  const workspace = String(row.workspace ?? "").trim();
  const file = toAgentFileEntry(row.file);
  if (!agentId || !workspace || !file) return null;
  return { agentId, workspace, file };
}

function toAgentsFilesSetResult(entry: unknown): AgentsFilesSetResult | null {
  const parsed = toAgentsFilesGetResult(entry);
  if (!parsed) return null;
  return { ok: true, ...parsed };
}

function toToolCatalogProfile(entry: unknown): ToolCatalogProfile | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const id = String(row.id ?? "");
  if (id !== "minimal" && id !== "coding" && id !== "messaging" && id !== "full") return null;
  return {
    id,
    label: String(row.label ?? id),
  };
}

function toToolCatalogEntry(entry: unknown): ToolCatalogEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  const source = String(row.source ?? "core");
  const defaultProfiles = Array.isArray(row.defaultProfiles)
    ? row.defaultProfiles.filter((value): value is "minimal" | "coding" | "messaging" | "full" =>
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

function toToolCatalogGroup(entry: unknown): ToolCatalogGroup | null {
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

function toToolsCatalogResult(entry: unknown, fallbackAgentId: string): ToolsCatalogResult | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  return {
    agentId: String(row.agentId ?? fallbackAgentId),
    profiles: normalizeArray(row.profiles, toToolCatalogProfile),
    groups: normalizeArray(row.groups, toToolCatalogGroup),
  };
}

function toChannelMetaEntry(entry: unknown): ChannelUiMetaEntry | null {
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

function toChannelAccountSnapshot(entry: unknown): ChannelAccountSnapshot | null {
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
    allowFrom: Array.isArray(row.allowFrom) ? row.allowFrom.filter((value): value is string => typeof value === "string") : null,
    tokenSource: typeof row.tokenSource === "string" ? row.tokenSource : null,
    botTokenSource: typeof row.botTokenSource === "string" ? row.botTokenSource : null,
    appTokenSource: typeof row.appTokenSource === "string" ? row.appTokenSource : null,
    credentialSource: typeof row.credentialSource === "string" ? row.credentialSource : null,
    audienceType: typeof row.audienceType === "string" ? row.audienceType : null,
    audience: typeof row.audience === "string" ? row.audience : null,
    webhookPath: typeof row.webhookPath === "string" ? row.webhookPath : null,
    webhookUrl: typeof row.webhookUrl === "string" ? row.webhookUrl : null,
    baseUrl: typeof row.baseUrl === "string" ? row.baseUrl : null,
    allowUnmentionedGroups: typeof row.allowUnmentionedGroups === "boolean" ? row.allowUnmentionedGroups : null,
    cliPath: typeof row.cliPath === "string" ? row.cliPath : null,
    dbPath: typeof row.dbPath === "string" ? row.dbPath : null,
    port: typeof row.port === "number" ? row.port : null,
    probe: row.probe,
    audit: row.audit,
    application: row.application,
  };
}

function toChannelsStatusSnapshot(entry: unknown): ChannelsStatusSnapshot | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const channelAccountsRaw = row.channelAccounts && typeof row.channelAccounts === "object"
    ? (row.channelAccounts as Record<string, unknown>)
    : {};
  const channelAccounts: Record<string, ChannelAccountSnapshot[]> = {};
  for (const [channelId, accounts] of Object.entries(channelAccountsRaw)) {
    channelAccounts[channelId] = normalizeArray(accounts, toChannelAccountSnapshot);
  }
  const channelDefaultAccountIdRaw = row.channelDefaultAccountId && typeof row.channelDefaultAccountId === "object"
    ? (row.channelDefaultAccountId as Record<string, unknown>)
    : {};
  const channelDefaultAccountId = Object.fromEntries(
    Object.entries(channelDefaultAccountIdRaw).map(([key, value]) => [key, String(value ?? "")]),
  );
  return {
    ts: typeof row.ts === "number" ? row.ts : Date.now(),
    channelOrder: Array.isArray(row.channelOrder) ? row.channelOrder.filter((value): value is string => typeof value === "string") : [],
    channelLabels:
      row.channelLabels && typeof row.channelLabels === "object"
        ? Object.fromEntries(
            Object.entries(row.channelLabels as Record<string, unknown>).map(([key, value]) => [key, String(value ?? key)]),
          )
        : {},
    channelDetailLabels:
      row.channelDetailLabels && typeof row.channelDetailLabels === "object"
        ? Object.fromEntries(
            Object.entries(row.channelDetailLabels as Record<string, unknown>).map(([key, value]) => [key, String(value ?? "")]),
          )
        : undefined,
    channelSystemImages:
      row.channelSystemImages && typeof row.channelSystemImages === "object"
        ? Object.fromEntries(
            Object.entries(row.channelSystemImages as Record<string, unknown>).map(([key, value]) => [key, String(value ?? "")]),
          )
        : undefined,
    channelMeta: normalizeArray(row.channelMeta, toChannelMetaEntry),
    channels: row.channels && typeof row.channels === "object" ? (row.channels as Record<string, unknown>) : {},
    channelAccounts,
    channelDefaultAccountId,
  };
}

function toCronJob(entry: unknown): CronJob | null {
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
    delivery: row.delivery && typeof row.delivery === "object" ? (row.delivery as CronJob["delivery"]) : undefined,
    state: row.state && typeof row.state === "object" ? (row.state as CronJob["state"]) : undefined,
  };
}

function toCronStatus(entry: unknown): CronStatus | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  return {
    enabled: row.enabled === true,
    jobs: typeof row.jobs === "number" ? row.jobs : 0,
    nextWakeAtMs: typeof row.nextWakeAtMs === "number" ? row.nextWakeAtMs : null,
  };
}

function toSkillStatusEntry(entry: unknown): SkillStatusEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const name = String(row.name ?? "").trim();
  if (!name) return null;
  const requirements = row.requirements && typeof row.requirements === "object" ? (row.requirements as Json) : {};
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
      bins: Array.isArray(requirements.bins) ? requirements.bins.filter((value): value is string => typeof value === "string") : [],
      env: Array.isArray(requirements.env) ? requirements.env.filter((value): value is string => typeof value === "string") : [],
      config: Array.isArray(requirements.config) ? requirements.config.filter((value): value is string => typeof value === "string") : [],
      os: Array.isArray(requirements.os) ? requirements.os.filter((value): value is string => typeof value === "string") : [],
    },
    missing: {
      bins: Array.isArray(missing.bins) ? missing.bins.filter((value): value is string => typeof value === "string") : [],
      env: Array.isArray(missing.env) ? missing.env.filter((value): value is string => typeof value === "string") : [],
      config: Array.isArray(missing.config) ? missing.config.filter((value): value is string => typeof value === "string") : [],
      os: Array.isArray(missing.os) ? missing.os.filter((value): value is string => typeof value === "string") : [],
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
              bins: Array.isArray(install.bins) ? install.bins.filter((item): item is string => typeof item === "string") : [],
            };
          })
          .filter((value): value is NonNullable<typeof value> => value !== null)
      : [],
  };
}

function toSkillStatusReport(entry: unknown): SkillStatusReport | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  return {
    workspaceDir: String(row.workspaceDir ?? ""),
    managedSkillsDir: String(row.managedSkillsDir ?? ""),
    skills: normalizeArray(row.skills, toSkillStatusEntry),
  };
}

function toOfficeSettings(entry: unknown): OfficeSettingsModel {
  const row = entry && typeof entry === "object" ? (entry as Json) : {};
  const meshAssetDir =
    typeof row.meshAssetDir === "string" && row.meshAssetDir.trim() ? row.meshAssetDir.trim() : "";
  return { meshAssetDir };
}

function toMeshAsset(entry: unknown): MeshAssetModel | null {
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

function toAgentMemoryEntry(agentId: string, entry: unknown): AgentMemoryEntry | null {
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
    ts: typeof row.ts === "number" ? row.ts : typeof row.timestamp === "number" ? row.timestamp : undefined,
    type: normalizedType,
    memId: typeof row.memId === "string" ? row.memId : undefined,
    tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : [],
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : undefined,
  };
}

const VALID_ACTION_TYPES = new Set(["tool_call", "external_message", "deploy", "delete", "write", "config_change"]);
const VALID_RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);

function toPendingApproval(entry: unknown): PendingApprovalModel | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Json;
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  const actionType = String(row.actionType ?? "tool_call");
  const riskLevel = String(row.riskLevel ?? "medium");
  return {
    id,
    agentId: String(row.agentId ?? "").trim(),
    actionType: VALID_ACTION_TYPES.has(actionType) ? (actionType as PendingApprovalModel["actionType"]) : "tool_call",
    toolName: typeof row.toolName === "string" ? row.toolName : undefined,
    description: String(row.description ?? ""),
    riskLevel: VALID_RISK_LEVELS.has(riskLevel) ? (riskLevel as PendingApprovalModel["riskLevel"]) : "medium",
    createdAt: typeof row.createdAt === "number" ? row.createdAt : Date.now(),
    context: typeof row.context === "string" ? row.context : undefined,
    status: row.status === "approved" || row.status === "rejected" ? row.status : "pending",
  };
}

const COMPANY_STORAGE_KEY = "shellcorp.company-model.v1";
const OFFICE_OBJECTS_STORAGE_KEY = "shellcorp.office-objects.v1";
const CLUSTER_BOUNDARY_LIMIT = 17.5;
const DEFAULT_COMPANY_MODEL: CompanyModel = {
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
  agents: [{ agentId: "main", role: "ceo", heartbeatProfileId: "hb-ceo", isCeo: true, lifecycleState: "active" }],
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

function asRecord(value: unknown): Json {
  return value && typeof value === "object" ? (value as Json) : {};
}

function toDepartment(entry: unknown): DepartmentModel | null {
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

function toCapabilitySlot(
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

function toBusinessConfig(entry: unknown): BusinessConfigModel | undefined {
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

function toLedgerEntry(projectId: string, entry: unknown): LedgerEntryModel | null {
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

function toProjectAccount(projectId: string, entry: unknown): ProjectAccountModel | undefined {
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

function toProjectAccountEvent(projectId: string, entry: unknown): ProjectAccountEventModel | null {
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

function toExperiment(projectId: string, entry: unknown): ExperimentModel | null {
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

function toMetricEvent(projectId: string, entry: unknown): MetricEventModel | null {
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

function toResourceType(entry: unknown): "cash_budget" | "api_quota" | "distribution_slots" | "custom" {
  if (entry === "cash_budget" || entry === "api_quota" || entry === "distribution_slots" || entry === "custom") {
    return entry;
  }
  return "custom";
}

function toResourceLowBehavior(entry: unknown): "warn" | "deprioritize_expensive_tasks" | "ask_pm_review" {
  if (entry === "deprioritize_expensive_tasks" || entry === "ask_pm_review") return entry;
  return "warn";
}

function toResourceEventKind(entry: unknown): "refresh" | "consumption" | "adjustment" {
  if (entry === "refresh" || entry === "consumption") return entry;
  return "adjustment";
}

function toProjectResource(projectId: string, entry: unknown): ProjectResourceModel | null {
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
    refreshCadenceMinutes: Number.isFinite(refreshCadenceMinutes) ? Math.max(1, Math.floor(refreshCadenceMinutes)) : undefined,
    policy: {
      advisoryOnly: true,
      softLimit: Number.isFinite(Number(policy.softLimit)) ? Number(policy.softLimit) : undefined,
      hardLimit: Number.isFinite(Number(policy.hardLimit)) ? Number(policy.hardLimit) : undefined,
      whenLow: toResourceLowBehavior(policy.whenLow),
    },
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

function toResourceEvent(projectId: string, entry: unknown): ResourceEventModel | null {
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

function toProject(entry: unknown): ProjectModel | null {
  const row = asRecord(entry);
  const id = String(row.id ?? "").trim();
  const departmentId = String(row.departmentId ?? "").trim();
  const name = String(row.name ?? "").trim();
  if (!id || !departmentId || !name) return null;
  const status = String(row.status ?? "active");
  const ledger = normalizeArray(row.ledger, (item) => toLedgerEntry(id, item));
  const accountEvents = normalizeArray(row.accountEvents, (item) => toProjectAccountEvent(id, item));
  return {
    id,
    departmentId,
    name,
    githubUrl: String(row.githubUrl ?? ""),
    status: status === "paused" || status === "archived" ? status : "active",
    goal: String(row.goal ?? ""),
    kpis: Array.isArray(row.kpis) ? row.kpis.filter((item): item is string => typeof item === "string") : [],
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
            updatedAt: accountEvents[accountEvents.length - 1]?.timestamp ?? new Date().toISOString(),
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

function toCompanyAgent(entry: unknown): CompanyAgentModel | null {
  const row = asRecord(entry);
  const agentId = String(row.agentId ?? "").trim();
  const role = String(row.role ?? "");
  if (!agentId) return null;
  if (role !== "ceo" && role !== "builder" && role !== "growth_marketer" && role !== "pm" && role !== "biz_pm" && role !== "biz_executor") return null;
  const lifecycle = String(row.lifecycleState ?? "active");
  return {
    agentId,
    role,
    projectId: typeof row.projectId === "string" && row.projectId.trim() ? row.projectId : undefined,
    heartbeatProfileId: String(row.heartbeatProfileId ?? ""),
    isCeo: Boolean(row.isCeo),
    lifecycleState:
      lifecycle === "idle" || lifecycle === "pending_spawn" || lifecycle === "retired" ? lifecycle : "active",
  };
}

function toRoleSlot(entry: unknown): RoleSlotModel | null {
  const row = asRecord(entry);
  const projectId = String(row.projectId ?? "").trim();
  const role = String(row.role ?? "");
  if (!projectId) return null;
  if (role !== "builder" && role !== "growth_marketer" && role !== "pm" && role !== "biz_pm" && role !== "biz_executor") return null;
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
  return {
    id,
    projectId,
    title,
    status: status === "in_progress" || status === "blocked" || status === "done" ? status : "todo",
    ownerAgentId: typeof row.ownerAgentId === "string" ? row.ownerAgentId : undefined,
    priority: priority === "low" || priority === "high" ? priority : "medium",
    provider: provider === "notion" || provider === "vibe" || provider === "linear" ? provider : "internal",
    canonicalProvider:
      canonicalProvider === "notion" || canonicalProvider === "vibe" || canonicalProvider === "linear"
        ? canonicalProvider
        : "internal",
    providerUrl: typeof row.providerUrl === "string" && row.providerUrl.trim() ? row.providerUrl : undefined,
    syncState:
      syncState === "pending" || syncState === "conflict" || syncState === "error"
        ? (syncState as TaskSyncState)
        : "healthy",
    syncError: typeof row.syncError === "string" && row.syncError.trim() ? row.syncError : undefined,
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
        .filter((value) => value === "internal" || value === "notion" || value === "vibe" || value === "linear")
    : [];
  const conflictPolicy = String(row.conflictPolicy ?? "canonical_wins");
  return {
    projectId,
    canonicalProvider:
      canonicalProvider === "notion" || canonicalProvider === "vibe" || canonicalProvider === "linear"
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
    provider: provider === "internal" || provider === "vibe" || provider === "linear" ? provider : "notion",
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

function toHeartbeatProfile(entry: unknown): HeartbeatProfileModel | null {
  const row = asRecord(entry);
  const id = String(row.id ?? "").trim();
  const role = String(row.role ?? "");
  if (!id) return null;
  if (role !== "ceo" && role !== "builder" && role !== "growth_marketer" && role !== "pm" && role !== "biz_pm" && role !== "biz_executor") return null;
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

function toChannelBinding(entry: unknown): ChannelBindingModel | null {
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

function toOfficeObject(entry: unknown): CompanyOfficeObjectModel | null {
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
    meshType !== "custom-mesh"
  ) {
    return null;
  }
  const positionInput = Array.isArray(row.position) ? row.position : [];
  if (positionInput.length !== 3 || positionInput.some((value) => typeof value !== "number")) return null;
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
      rotationInput && rotationInput.length === 3 && rotationInput.every((value) => typeof value === "number")
        ? [Number(rotationInput[0]), Number(rotationInput[1]), Number(rotationInput[2])]
        : undefined,
    scale:
      scaleInput && scaleInput.length === 3 && scaleInput.every((value) => typeof value === "number")
        ? [Number(scaleInput[0]), Number(scaleInput[1]), Number(scaleInput[2])]
        : undefined,
    projectId: typeof row.projectId === "string" ? row.projectId : undefined,
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : undefined,
  };
}

function toOfficeObjectSidecar(entry: unknown): OfficeObjectSidecarModel | null {
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
    meshType !== "custom-mesh"
  ) {
    return null;
  }
  const positionInput = Array.isArray(row.position) ? row.position : [];
  if (positionInput.length !== 3 || positionInput.some((value) => typeof value !== "number")) return null;
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
      rotationInput && rotationInput.length === 3 && rotationInput.every((value) => typeof value === "number")
        ? [Number(rotationInput[0]), Number(rotationInput[1]), Number(rotationInput[2])]
        : undefined,
    scale:
      scaleInput && scaleInput.length === 3 && scaleInput.every((value) => typeof value === "number")
        ? [Number(scaleInput[0]), Number(scaleInput[1]), Number(scaleInput[2])]
        : undefined,
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : undefined,
  };
}

function toCanonicalOfficeObjectId(id: string): string {
  const trimmed = id.trim();
  return trimmed.startsWith("office-") ? trimmed.slice("office-".length) : trimmed;
}

function normalizeCompanyModel(value: unknown): CompanyModel {
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
    heartbeatProfiles: heartbeatProfiles.length > 0 ? heartbeatProfiles : DEFAULT_COMPANY_MODEL.heartbeatProfiles,
    channelBindings,
    heartbeatRuntime: {
      enabled: runtime.enabled !== false,
      pluginId: String(runtime.pluginId ?? DEFAULT_COMPANY_MODEL.heartbeatRuntime.pluginId),
      serviceId: String(runtime.serviceId ?? DEFAULT_COMPANY_MODEL.heartbeatRuntime.serviceId),
      cadenceMinutes: Math.max(1, Number(runtime.cadenceMinutes ?? DEFAULT_COMPANY_MODEL.heartbeatRuntime.cadenceMinutes)),
      notes: typeof runtime.notes === "string" ? runtime.notes : undefined,
    },
    officeObjects,
  };
}

function buildWorkload(company: CompanyModel): ProjectWorkloadSummary[] {
  return company.projects.map((project) => {
    const tasks = company.tasks.filter((task) => task.projectId === project.id);
    const openTickets = tasks.filter((task) => task.status !== "done").length;
    const closedTickets = tasks.filter((task) => task.status === "done").length;
    const ratio = closedTickets === 0 ? openTickets : openTickets / closedTickets;
    const queuePressure = ratio > 2 ? "high" : ratio > 1 ? "medium" : "low";
    return { projectId: project.id, openTickets, closedTickets, queuePressure };
  });
}

function buildReconciliationWarnings(
  company: CompanyModel,
  runtimeAgents: AgentCardModel[],
  configuredAgents: AgentCardModel[],
): ReconciliationWarning[] {
  const warnings: ReconciliationWarning[] = [];
  const runtimeIds = new Set(runtimeAgents.map((agent) => agent.agentId));
  const configuredIds = new Set(configuredAgents.map((agent) => agent.agentId));
  const metaIds = new Set(company.agents.map((agent) => agent.agentId));

  for (const metaAgent of company.agents) {
    if (metaAgent.lifecycleState === "active" && configuredIds.has(metaAgent.agentId) && !runtimeIds.has(metaAgent.agentId)) {
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
      (agent) => agent.projectId === slot.projectId && agent.role === slot.role && agent.lifecycleState === "active",
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
        (agent) => agent.projectId === binding.projectId && agent.role === binding.agentRole && agent.lifecycleState === "active",
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

function parseConfiguredAgentsFromConfig(snapshot: OpenClawConfigSnapshot | null): AgentCardModel[] {
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
        allow: Array.isArray(tools.allow) ? tools.allow.filter((item): item is string => typeof item === "string") : [],
        deny: Array.isArray(tools.deny) ? tools.deny.filter((item): item is string => typeof item === "string") : [],
      },
      sessionCount: 0,
    };
  });
}

export class OpenClawAdapter {
  constructor(
    gatewayUrl: string,
    private readonly stateUrl: string = gatewayUrl,
    private readonly wsClient?: GatewayWsClient,
  ) {}

  private async readJson(path: string): Promise<Json> {
    let response: Response;
    try {
      response = await fetch(`${this.stateUrl}${path}`, {
        headers: buildGatewayHeaders(),
      });
    } catch {
      throw new Error(`request_unreachable:${path}`);
    }
    if (!response.ok) {
      throw new Error(`request_failed:${path}:${response.status}`);
    }
    return (await response.json()) as Json;
  }

  private async invokeGatewayMethod(
    method: string,
    params: Record<string, unknown>,
  ): Promise<{ ok: boolean; payload: Json; error?: string }> {
    if (!this.wsClient?.connected) {
      return { ok: false, payload: {}, error: `gateway_not_connected:${method}` };
    }
    try {
      const payload = ((await this.wsClient.request(method, params)) ?? {}) as Json;
      return {
        ok: payload.ok !== false,
        payload,
        error: typeof payload.error === "string" ? payload.error : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        payload: {},
        error: error instanceof Error ? error.message : `gateway_method_failed:${method}`,
      };
    }
  }

  async listAgents(): Promise<AgentCardModel[]> {
    const payload = await this.readJson("/openclaw/agents");
    return normalizeArray(payload.agents, toAgent);
  }

  private buildAgentsListFallback(
    configSnapshot: OpenClawConfigSnapshot | null,
    runtimeAgents: AgentCardModel[],
  ): AgentsListResult {
    const configRoot = configSnapshot?.config ?? {};
    const agentsNode = configRoot.agents && typeof configRoot.agents === "object"
      ? (configRoot.agents as Record<string, unknown>)
      : {};
    const configList = Array.isArray(agentsNode.list) ? agentsNode.list : [];
    const configAgents = configList
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const row = entry as Record<string, unknown>;
        const id = String(row.id ?? row.agentId ?? "").trim();
        if (!id) return null;
        return {
          id,
          name: typeof row.name === "string" ? row.name : undefined,
          identity:
            row.identity && typeof row.identity === "object"
              ? {
                  name: typeof (row.identity as Record<string, unknown>).name === "string"
                    ? String((row.identity as Record<string, unknown>).name)
                    : undefined,
                  theme: typeof (row.identity as Record<string, unknown>).theme === "string"
                    ? String((row.identity as Record<string, unknown>).theme)
                    : undefined,
                  emoji: typeof (row.identity as Record<string, unknown>).emoji === "string"
                    ? String((row.identity as Record<string, unknown>).emoji)
                    : undefined,
                  avatar: typeof (row.identity as Record<string, unknown>).avatar === "string"
                    ? String((row.identity as Record<string, unknown>).avatar)
                    : undefined,
                  avatarUrl: typeof (row.identity as Record<string, unknown>).avatarUrl === "string"
                    ? String((row.identity as Record<string, unknown>).avatarUrl)
                    : undefined,
                }
              : undefined,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    const runtimeRows = runtimeAgents.map((agent) => ({
      id: agent.agentId,
      name: agent.displayName,
    }));
    const deduped = new Map<string, AgentsListResult["agents"][number]>();
    for (const row of [...configAgents, ...runtimeRows]) {
      deduped.set(row.id, { ...(deduped.get(row.id) ?? {}), ...row } as AgentsListResult["agents"][number]);
    }
    const defaultIdRaw = agentsNode.default;
    const defaultId = typeof defaultIdRaw === "string" && defaultIdRaw.trim() ? defaultIdRaw.trim() : "main";
    const mainKeyRaw = agentsNode.mainKey;
    const mainKey = typeof mainKeyRaw === "string" && mainKeyRaw.trim() ? mainKeyRaw.trim() : "main";
    const scopeRaw = agentsNode.scope;
    const scope = typeof scopeRaw === "string" && scopeRaw.trim() ? scopeRaw.trim() : "workspace";
    return {
      defaultId,
      mainKey,
      scope,
      agents: [...deduped.values()],
    };
  }

  async getAgentsList(): Promise<AgentsListResult> {
    const result = await this.invokeGatewayMethod("agents.list", {});
    if (result.ok) {
      const payload = result.payload;
      if (Array.isArray(payload.agents)) {
        const agents = payload.agents
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const row = entry as Json;
            const id = String(row.id ?? "").trim();
            if (!id) return null;
            const identity = row.identity && typeof row.identity === "object" ? (row.identity as Json) : {};
            return {
              id,
              name: typeof row.name === "string" ? row.name : undefined,
              identity: {
                name: typeof identity.name === "string" ? identity.name : undefined,
                theme: typeof identity.theme === "string" ? identity.theme : undefined,
                emoji: typeof identity.emoji === "string" ? identity.emoji : undefined,
                avatar: typeof identity.avatar === "string" ? identity.avatar : undefined,
                avatarUrl: typeof identity.avatarUrl === "string" ? identity.avatarUrl : undefined,
              },
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
        return {
          defaultId: typeof payload.defaultId === "string" ? payload.defaultId : "main",
          mainKey: typeof payload.mainKey === "string" ? payload.mainKey : "main",
          scope: typeof payload.scope === "string" ? payload.scope : "workspace",
          agents,
        };
      }
    }

    const [configSnapshot, runtimeAgents] = await Promise.all([
      this.getConfigSnapshot().catch(() => null),
      this.listAgents().catch(() => []),
    ]);
    return this.buildAgentsListFallback(configSnapshot, runtimeAgents);
  }

  async getAgentIdentity(agentId: string): Promise<AgentIdentityResult | null> {
    const result = await this.invokeGatewayMethod("agent.identity.get", { agentId });
    if (!result.ok) return null;
    const payload = result.payload;
    const responseAgentId = String(payload.agentId ?? agentId).trim();
    const name = String(payload.name ?? "").trim();
    if (!responseAgentId || !name) return null;
    return {
      agentId: responseAgentId,
      name,
      avatar: typeof payload.avatar === "string" ? payload.avatar : "",
      emoji: typeof payload.emoji === "string" ? payload.emoji : undefined,
    };
  }

  async listAgentFiles(agentId: string): Promise<AgentsFilesListResult> {
    const result = await this.invokeGatewayMethod("agents.files.list", { agentId });
    if (!result.ok) throw new Error(result.error ?? "agents_files_list_failed");
    const parsed = toAgentsFilesListResult(result.payload);
    if (!parsed) throw new Error("agents_files_list_invalid");
    return parsed;
  }

  async getAgentFile(agentId: string, name: string): Promise<AgentsFilesGetResult> {
    const result = await this.invokeGatewayMethod("agents.files.get", { agentId, name });
    if (!result.ok) throw new Error(result.error ?? "agents_files_get_failed");
    const parsed = toAgentsFilesGetResult(result.payload);
    if (!parsed) throw new Error("agents_files_get_invalid");
    return parsed;
  }

  async saveAgentFile(agentId: string, name: string, content: string): Promise<AgentsFilesSetResult> {
    const result = await this.invokeGatewayMethod("agents.files.set", { agentId, name, content });
    if (!result.ok) throw new Error(result.error ?? "agents_files_set_failed");
    const parsed = toAgentsFilesSetResult(result.payload);
    if (!parsed) throw new Error("agents_files_set_invalid");
    return parsed;
  }

  async getToolsCatalog(agentId: string): Promise<ToolsCatalogResult | null> {
    const result = await this.invokeGatewayMethod("tools.catalog", { agentId });
    if (!result.ok) return null;
    return toToolsCatalogResult(result.payload, agentId);
  }

  async getSkillsStatus(agentId: string): Promise<SkillStatusReport | null> {
    const result = await this.invokeGatewayMethod("skills.status", { agentId });
    if (!result.ok) return null;
    return toSkillStatusReport(result.payload);
  }

  async getChannelsStatus(): Promise<ChannelsStatusSnapshot | null> {
    const result = await this.invokeGatewayMethod("channels.status", {});
    if (!result.ok) return null;
    return toChannelsStatusSnapshot(result.payload);
  }

  async getCronStatus(): Promise<CronStatus | null> {
    const result = await this.invokeGatewayMethod("cron.status", {});
    if (!result.ok) return null;
    return toCronStatus(result.payload);
  }

  async listCronJobs(): Promise<CronJob[]> {
    const result = await this.invokeGatewayMethod("cron.list", {});
    if (!result.ok) return [];
    const payload = result.payload;
    if (Array.isArray(payload.jobs)) {
      return normalizeArray(payload.jobs, toCronJob);
    }
    return [];
  }

  async listSessions(agentId: string): Promise<SessionRowModel[]> {
    const payload = await this.readJson(`/openclaw/agents/${encodeURIComponent(agentId)}/sessions`);
    return normalizeArray(payload.sessions, (entry) => toSession(agentId, entry));
  }

  async getSessionTimeline(agentId: string, sessionKey: string, limit = 200): Promise<SessionTimelineModel> {
    const payload = await this.readJson(
      `/openclaw/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionKey)}/events?limit=${limit}`,
    );
    return toTimeline(agentId, sessionKey, payload.timeline ?? payload);
  }

  parseHeartbeatWindows(timeline: SessionTimelineModel): HeartbeatWindow[] {
    return parseHeartbeatWindows(timeline.events, timeline.sessionKey);
  }

  async getAgentLiveStatus(agentId: string): Promise<AgentLiveStatus> {
    const sessions = await this.listSessions(agentId);
    const sortedSessions = [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    const primarySession = sortedSessions[0];
    if (!primarySession) {
      return {
        agentId,
        state: "idle",
        statusText: "Idle",
        bubbles: [],
      };
    }
    const timeline = await this.getSessionTimeline(agentId, primarySession.sessionKey, 240);
    const windows = this.parseHeartbeatWindows(timeline);
    return deriveAgentLiveStatus(agentId, primarySession.sessionKey, windows);
  }

  async getAgentsLiveStatus(agentIds: string[]): Promise<Record<string, AgentLiveStatus>> {
    const uniqueIds = [...new Set(agentIds.filter((entry) => entry.trim().length > 0))];
    const rows = await Promise.all(
      uniqueIds.map(async (agentId) => {
        try {
          const status = await this.getAgentLiveStatus(agentId);
          return [agentId, status] as const;
        } catch {
          return [
            agentId,
            {
              agentId,
              state: "idle" as const,
              statusText: "Idle",
              bubbles: [],
            },
          ] as const;
        }
      }),
    );
    return Object.fromEntries(rows);
  }

  async sendMessage(input: ChatSendRequest): Promise<{ ok: boolean; eventId?: string; error?: string }> {
    let response: Response;
    try {
      response = await fetch(`${this.stateUrl}/openclaw/chat/send`, {
        method: "POST",
        headers: buildGatewayHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(input),
      });
    } catch {
      return { ok: false, error: "send_unreachable" };
    }
    if (!response.ok) {
      return { ok: false, error: `send_failed:${response.status}` };
    }
    const payload = (await response.json()) as Json;
    return {
      ok: Boolean(payload.ok ?? true),
      eventId: typeof payload.eventId === "string" ? payload.eventId : undefined,
      error: typeof payload.error === "string" ? payload.error : undefined,
    };
  }

  async listSkills(): Promise<SkillItemModel[]> {
    const payload = await this.readJson("/openclaw/skills");
    return normalizeArray(payload.skills, toSkill);
  }

  async listMemory(): Promise<MemoryItemModel[]> {
    const payload = await this.readJson("/openclaw/memory");
    return normalizeArray(payload.memory, toMemory);
  }

  async listAgentMemoryEntries(agentId: string): Promise<AgentMemoryEntry[]> {
    const payload = await this.readJson(`/openclaw/agents/${encodeURIComponent(agentId)}/memory-entries`);
    return normalizeArray(payload.entries, (entry) => toAgentMemoryEntry(agentId, entry));
  }

  async getConfigSnapshot(): Promise<OpenClawConfigSnapshot> {
    const payload = await this.readJson("/openclaw/config");
    const config = payload.config && typeof payload.config === "object" ? (payload.config as Record<string, unknown>) : {};
    return {
      stateVersion: typeof payload.stateVersion === "number" ? payload.stateVersion : undefined,
      config,
    };
  }

  async previewConfig(nextConfig: Record<string, unknown>): Promise<OpenClawConfigPreview> {
    const response = await fetch(`${this.stateUrl}/openclaw/config/preview`, {
      method: "POST",
      headers: buildGatewayHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ nextConfig }),
    });
    if (!response.ok) {
      return { summary: "preview endpoint unavailable", diffText: JSON.stringify(nextConfig, null, 2) };
    }
    const payload = (await response.json()) as Json;
    return {
      summary: String(payload.summary ?? "preview generated"),
      diffText: typeof payload.diffText === "string" ? payload.diffText : undefined,
    };
  }

  async applyConfig(nextConfig: Record<string, unknown>, confirm: boolean): Promise<{ ok: boolean; error?: string }> {
    const response = await fetch(`${this.stateUrl}/openclaw/config/apply`, {
      method: "POST",
      headers: buildGatewayHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ nextConfig, confirm }),
    });
    if (!response.ok) {
      return { ok: false, error: `apply_failed:${response.status}` };
    }
    const payload = (await response.json()) as Json;
    return {
      ok: Boolean(payload.ok ?? true),
      error: typeof payload.error === "string" ? payload.error : undefined,
    };
  }

  async rollbackConfig(): Promise<{ ok: boolean; error?: string }> {
    const response = await fetch(`${this.stateUrl}/openclaw/config/rollback`, {
      method: "POST",
      headers: buildGatewayHeaders({ "content-type": "application/json" }),
    });
    if (!response.ok) {
      return { ok: false, error: `rollback_failed:${response.status}` };
    }
    const payload = (await response.json()) as Json;
    return {
      ok: Boolean(payload.ok ?? true),
      error: typeof payload.error === "string" ? payload.error : undefined,
    };
  }

  private async getCompanyModelWithSource(): Promise<{ company: CompanyModel; source: "gateway" | "localStorage" | "default" }> {
    try {
      const payload = await this.readJson("/openclaw/company-model");
      return { company: normalizeCompanyModel(payload.company ?? payload), source: "gateway" };
    } catch {
      // Fall through to local sources.
    }

    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(COMPANY_STORAGE_KEY);
        if (raw) {
          return { company: normalizeCompanyModel(JSON.parse(raw)), source: "localStorage" };
        }
      } catch {
        // ignore parsing/storage errors
      }
    }

    return { company: DEFAULT_COMPANY_MODEL, source: "default" };
  }

  async getCompanyModel(): Promise<CompanyModel> {
    const result = await this.getCompanyModelWithSource();
    return result.company;
  }

  async saveCompanyModel(input: CompanyModel): Promise<{ ok: boolean; company: CompanyModel; error?: string }> {
    const company = normalizeCompanyModel(input);
    let ok = false;
    let error: string | undefined;

    try {
      const response = await fetch(`${this.stateUrl}/openclaw/company-model`, {
        method: "POST",
        headers: buildGatewayHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ company }),
      });
      if (response.ok) {
        ok = true;
      } else {
        error = `company_model_save_failed:${response.status}`;
      }
    } catch {
      error = "company_model_save_unavailable";
    }

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(company));
        ok = true;
      } catch {
        if (!ok) error = "company_model_local_persist_failed";
      }
    }

    return { ok, company, error };
  }

  async createProject(input: {
    departmentId: string;
    projectName: string;
    githubUrl: string;
    goal: string;
  }): Promise<{ ok: boolean; company: CompanyModel; error?: string }> {
    const company = await this.getCompanyModel();
    const slug = input.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const projectId = `proj-${slug || `project-${Date.now()}`}`;
    const baseAgentId = slug || `project-${Date.now()}`;
    const nextCompany: CompanyModel = {
      ...company,
      projects: [
        ...company.projects,
        {
          id: projectId,
          departmentId: input.departmentId,
          name: input.projectName.trim(),
          githubUrl: input.githubUrl.trim(),
          status: "active",
          goal: input.goal.trim(),
          kpis: ["open_vs_closed_ticket_ratio"],
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
          resources: [],
          resourceEvents: [],
        },
      ],
      agents: [
        ...company.agents,
        {
          agentId: `${baseAgentId}-builder`,
          role: "builder",
          projectId,
          heartbeatProfileId: "hb-builder",
          lifecycleState: "pending_spawn",
        },
        {
          agentId: `${baseAgentId}-growth`,
          role: "growth_marketer",
          projectId,
          heartbeatProfileId: "hb-growth",
          lifecycleState: "pending_spawn",
        },
        {
          agentId: `${baseAgentId}-pm`,
          role: "pm",
          projectId,
          heartbeatProfileId: "hb-pm",
          lifecycleState: "pending_spawn",
        },
      ],
      roleSlots: [
        ...company.roleSlots,
        { projectId, role: "builder", desiredCount: 1, spawnPolicy: "queue_pressure" },
        { projectId, role: "growth_marketer", desiredCount: 1, spawnPolicy: "queue_pressure" },
        { projectId, role: "pm", desiredCount: 1, spawnPolicy: "queue_pressure" },
      ],
    };
    return this.saveCompanyModel(nextCompany);
  }

  async createTeam(input: {
    name: string;
    description: string;
    goal: string;
    kpis: string[];
    autoRoles: Array<"builder" | "growth_marketer" | "pm">;
    registerOpenclawAgents: boolean;
    withCluster: boolean;
    businessType?: "affiliate_marketing" | "content_creator" | "saas" | "custom";
    capabilitySkills?: {
      measure: string;
      execute: string;
      distribute: string;
    };
  }): Promise<{ ok: boolean; teamId?: string; projectId?: string; createdAgents?: string[]; error?: string }> {
    try {
      const response = await fetch(`${this.stateUrl}/openclaw/team/create`, {
        method: "POST",
        headers: buildGatewayHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as Json;
      if (!response.ok || payload.ok === false) {
        return {
          ok: false,
          error: typeof payload.error === "string" ? payload.error : `team_create_failed:${response.status}`,
        };
      }
      return {
        ok: true,
        teamId: typeof payload.teamId === "string" ? payload.teamId : undefined,
        projectId: typeof payload.projectId === "string" ? payload.projectId : undefined,
        createdAgents: Array.isArray(payload.createdAgents)
          ? payload.createdAgents.filter((entry): entry is string => typeof entry === "string")
          : undefined,
      };
    } catch {
      return { ok: false, error: "team_create_unavailable" };
    }
  }

  async saveBusinessBuilderConfig(input: {
    projectId: string;
    businessType: "affiliate_marketing" | "content_creator" | "saas" | "custom";
    capabilitySkills: {
      measure: string;
      execute: string;
      distribute: string;
    };
    resources: BusinessBuilderResourceDraft[];
    trackingContext?: string;
    source?: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const company = await this.getCompanyModel();
    const project = company.projects.find((entry) => entry.id === input.projectId);
    if (!project) return { ok: false, error: "project_not_found" };
    const nextResources = toProjectResources(input.projectId, input.resources);
    const priorById = new Map((project.resources ?? []).map((resource) => [resource.id, resource]));
    const nowIso = new Date().toISOString();
    const nextEvents = [...(project.resourceEvents ?? [])];
    for (const resource of nextResources) {
      const previous = priorById.get(resource.id);
      if (!previous) continue;
      if (previous.remaining !== resource.remaining || previous.limit !== resource.limit || previous.reserved !== resource.reserved) {
        nextEvents.push({
          id: `resource-event-${input.projectId}-${resource.id}-${Date.now()}`,
          projectId: input.projectId,
          resourceId: resource.id,
          ts: nowIso,
          kind: "adjustment",
          delta: resource.remaining - previous.remaining,
          remainingAfter: resource.remaining,
          source: input.source ?? "ui.business_builder.save",
          note: "Business Builder save",
        });
      }
    }
    const nextCompany: CompanyModel = {
      ...company,
      projects: company.projects.map((entry) =>
        entry.id === input.projectId
          ? {
              ...entry,
              trackingContext: input.trackingContext?.trim() || undefined,
              businessConfig: {
                type: input.businessType,
                slots: {
                  measure: {
                    skillId: input.capabilitySkills.measure.trim() || "measure-skill",
                    category: "measure",
                    config: entry.businessConfig?.slots.measure.config ?? {},
                  },
                  execute: {
                    skillId: input.capabilitySkills.execute.trim() || "execute-skill",
                    category: "execute",
                    config: entry.businessConfig?.slots.execute.config ?? {},
                  },
                  distribute: {
                    skillId: input.capabilitySkills.distribute.trim() || "distribute-skill",
                    category: "distribute",
                    config: entry.businessConfig?.slots.distribute.config ?? {},
                  },
                },
              },
              resources: nextResources,
              resourceEvents: nextEvents,
            }
          : entry,
      ),
    };
    const saved = await this.saveCompanyModel(nextCompany);
    return { ok: saved.ok, error: saved.error };
  }

  async recordProjectAccountEvent(input: {
    projectId: string;
    type: "credit" | "debit";
    amountCents: number;
    source: string;
    note?: string;
    currency?: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const company = await this.getCompanyModel();
    const project = company.projects.find((entry) => entry.id === input.projectId);
    if (!project) return { ok: false, error: "project_not_found" };
    const amountCents = Math.max(0, Math.round(input.amountCents));
    if (amountCents <= 0) return { ok: false, error: "invalid_amount_cents" };
    const nowIso = new Date().toISOString();
    const accountId = project.account?.id ?? `${project.id}:account`;
    const currentBalance = project.account?.balanceCents ?? 0;
    const nextBalance = input.type === "credit" ? currentBalance + amountCents : currentBalance - amountCents;
    if (input.type === "debit" && nextBalance < 0) return { ok: false, error: "insufficient_balance" };

    const accountEvent = {
      id: `acct-event-${project.id}-${Date.now()}`,
      projectId: project.id,
      accountId,
      timestamp: nowIso,
      type: input.type,
      amountCents,
      source: input.source.trim() || "ui.ledger",
      note: input.note?.trim() || undefined,
      balanceAfterCents: nextBalance,
    };
    const ledgerEntry = {
      id: `ledger-${input.type === "credit" ? "rev" : "cost"}-${project.id}-${Date.now()}`,
      projectId: project.id,
      timestamp: nowIso,
      type: input.type === "credit" ? "revenue" : "cost",
      amount: amountCents,
      currency: input.currency?.trim() || project.account?.currency || "USD",
      source: input.source.trim() || "ui.ledger",
      description: input.note?.trim() || (input.type === "credit" ? "Account funding" : "Account spend"),
    };

    const nextCompany: CompanyModel = {
      ...company,
      projects: company.projects.map((entry) =>
        entry.id === input.projectId
          ? {
              ...entry,
              account: {
                id: accountId,
                projectId: entry.id,
                currency: ledgerEntry.currency,
                balanceCents: nextBalance,
                updatedAt: nowIso,
              },
              accountEvents: [...(entry.accountEvents ?? []), accountEvent],
              ledger: [...(entry.ledger ?? []), ledgerEntry],
            }
          : entry,
      ),
    };
    const saved = await this.saveCompanyModel(nextCompany);
    return { ok: saved.ok, error: saved.error };
  }

  async renderBusinessHeartbeatPreview(input: {
    teamId: string;
    role: "biz_pm" | "biz_executor";
  }): Promise<{ ok: boolean; rendered?: string; error?: string }> {
    try {
      const response = await fetch(`${this.stateUrl}/openclaw/team/heartbeat/render`, {
        method: "POST",
        headers: buildGatewayHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as Json;
      if (!response.ok || payload.ok === false) {
        return {
          ok: false,
          error: typeof payload.error === "string" ? payload.error : `heartbeat_render_failed:${response.status}`,
        };
      }
      return {
        ok: true,
        rendered: typeof payload.rendered === "string" ? payload.rendered : "",
      };
    } catch {
      return { ok: false, error: "heartbeat_render_unavailable" };
    }
  }

  async upsertChannelBinding(input: ChannelBindingModel): Promise<{ ok: boolean; company: CompanyModel; error?: string }> {
    const company = await this.getCompanyModel();
    const nextBindings = company.channelBindings.filter(
      (binding) => !(binding.platform === input.platform && binding.externalChannelId === input.externalChannelId),
    );
    nextBindings.push(input);
    return this.saveCompanyModel({ ...company, channelBindings: nextBindings });
  }

  async listFederatedTasks(input: { projectId?: string; provider?: FederatedTaskModel["provider"] } = {}): Promise<FederatedTaskModel[]> {
    const company = await this.getCompanyModel();
    return company.tasks.filter((task) => {
      if (input.projectId && task.projectId !== input.projectId) return false;
      if (input.provider && task.provider !== input.provider) return false;
      return true;
    });
  }

  async getFederationPolicy(projectId: string): Promise<FederationProjectPolicy> {
    const company = await this.getCompanyModel();
    const existing = company.federationPolicies.find((policy) => policy.projectId === projectId);
    if (existing) return existing;
    return {
      projectId,
      canonicalProvider: "internal",
      mirrors: [],
      writeBackEnabled: false,
      conflictPolicy: "canonical_wins",
    };
  }

  async upsertFederationPolicy(
    input: FederationProjectPolicy,
  ): Promise<{ ok: boolean; company: CompanyModel; error?: string }> {
    const company = await this.getCompanyModel();
    const nextPolicies = company.federationPolicies.filter((policy) => policy.projectId !== input.projectId);
    nextPolicies.push(input);
    return this.saveCompanyModel({ ...company, federationPolicies: nextPolicies });
  }

  async upsertProviderIndexProfile(
    input: ProviderIndexProfile,
  ): Promise<{ ok: boolean; company: CompanyModel; error?: string }> {
    const company = await this.getCompanyModel();
    const nextProfiles = company.providerIndexProfiles.filter((profile) => profile.profileId !== input.profileId);
    nextProfiles.push(input);
    return this.saveCompanyModel({ ...company, providerIndexProfiles: nextProfiles });
  }

  async updateFederatedTask(
    taskId: string,
    updates: Partial<Pick<FederatedTaskModel, "title" | "status" | "priority" | "ownerAgentId">>,
  ): Promise<{ ok: boolean; task?: FederatedTaskModel; error?: string }> {
    const company = await this.getCompanyModel();
    const current = company.tasks.find((task) => task.id === taskId);
    if (!current) return { ok: false, error: "task_not_found" };
    const policy = await this.getFederationPolicy(current.projectId);
    const writeProvider = resolveCanonicalWriteProvider(policy, current.canonicalProvider);

    const nextTask: FederatedTaskModel = {
      ...current,
      ...updates,
      canonicalProvider: writeProvider,
      syncState: "healthy",
      syncError: undefined,
      updatedAt: Date.now(),
    };
    const nextTasks = company.tasks.map((task) => (task.id === taskId ? nextTask : task));
    const saved = await this.saveCompanyModel({ ...company, tasks: nextTasks });
    return { ok: saved.ok, task: nextTask, error: saved.error };
  }

  async manualResync(projectId: string, provider?: FederatedTaskModel["provider"]): Promise<{ ok: boolean; error?: string }> {
    const company = await this.getCompanyModel();
    const nextTasks = company.tasks.map((task) => {
      if (task.projectId !== projectId) return task;
      if (provider && task.provider !== provider) return task;
      return { ...task, syncState: "pending" as const, syncError: undefined, updatedAt: Date.now() };
    });
    const initialSave = await this.saveCompanyModel({ ...company, tasks: nextTasks });
    if (!initialSave.ok) return { ok: false, error: initialSave.error };

    const reconciledTasks = nextTasks.map((task) => {
      if (task.projectId !== projectId) return task;
      if (provider && task.provider !== provider) return task;
      return { ...task, syncState: "healthy" as const, syncError: undefined, updatedAt: Date.now() };
    });
    const finalSave = await this.saveCompanyModel({ ...company, tasks: reconciledTasks });
    return { ok: finalSave.ok, error: finalSave.error };
  }

  async getOfficeObjects(): Promise<OfficeObjectSidecarModel[]> {
    try {
      const payload = await this.readJson("/openclaw/office-objects");
      const objects = normalizeArray(payload.objects ?? payload.officeObjects ?? payload, toOfficeObjectSidecar);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(OFFICE_OBJECTS_STORAGE_KEY, JSON.stringify(objects));
      }
      return objects;
    } catch {
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(OFFICE_OBJECTS_STORAGE_KEY);
          if (raw) {
            return normalizeArray(JSON.parse(raw), toOfficeObjectSidecar);
          }
        } catch {
          // ignore parsing/storage errors
        }
      }
      return [];
    }
  }

  async getOfficeSettings(): Promise<OfficeSettingsModel> {
    try {
      const payload = await this.readJson("/openclaw/office-settings");
      return toOfficeSettings(payload.settings ?? payload);
    } catch {
      return { meshAssetDir: "" };
    }
  }

  async saveOfficeSettings(settings: OfficeSettingsModel): Promise<{ ok: boolean; settings: OfficeSettingsModel; error?: string }> {
    const normalized = toOfficeSettings(settings);
    try {
      const response = await fetch(`${this.stateUrl}/openclaw/office-settings`, {
        method: "POST",
        headers: buildGatewayHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ settings: normalized }),
      });
      if (!response.ok) {
        return { ok: false, settings: normalized, error: `office_settings_save_failed:${response.status}` };
      }
      const payload = (await response.json()) as Json;
      return { ok: true, settings: toOfficeSettings(payload.settings ?? normalized) };
    } catch {
      return { ok: false, settings: normalized, error: "office_settings_save_unavailable" };
    }
  }

  async listMeshAssets(): Promise<{ assets: MeshAssetModel[]; meshAssetDir: string }> {
    try {
      const payload = await this.readJson("/openclaw/mesh-assets");
      return {
        assets: normalizeArray(payload.assets, toMeshAsset),
        meshAssetDir: String(payload.meshAssetDir ?? ""),
      };
    } catch {
      return { assets: [], meshAssetDir: "" };
    }
  }

  async downloadMeshAsset(input: { url: string; label?: string }): Promise<{ ok: boolean; asset?: MeshAssetModel; error?: string }> {
    try {
      const response = await fetch(`${this.stateUrl}/openclaw/mesh-assets/download`, {
        method: "POST",
        headers: buildGatewayHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        return { ok: false, error: `mesh_download_failed:${response.status}` };
      }
      const payload = (await response.json()) as Json;
      if (payload.ok === false) {
        return { ok: false, error: typeof payload.error === "string" ? payload.error : "mesh_download_failed" };
      }
      const asset = toMeshAsset(payload.asset);
      if (!asset) return { ok: false, error: "mesh_asset_invalid" };
      return { ok: true, asset };
    } catch {
      return { ok: false, error: "mesh_download_unavailable" };
    }
  }

  async saveOfficeObjects(objects: OfficeObjectSidecarModel[]): Promise<{ ok: boolean; objects: OfficeObjectSidecarModel[]; error?: string }> {
    const cleaned = normalizeArray(objects, toOfficeObjectSidecar);
    let ok = false;
    let error: string | undefined;
    let serverPersisted = false;
    try {
      const response = await fetch(`${this.stateUrl}/openclaw/office-objects`, {
        method: "POST",
        headers: buildGatewayHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ objects: cleaned }),
      });
      if (response.ok) {
        ok = true;
        serverPersisted = true;
      } else {
        error = `office_objects_save_failed:${response.status}`;
      }
    } catch {
      error = "office_objects_save_unavailable";
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(OFFICE_OBJECTS_STORAGE_KEY, JSON.stringify(cleaned));
        // Keep local cache warm, but do not report success unless server persisted.
        if (!serverPersisted) {
          ok = false;
        }
      } catch {
        if (serverPersisted) {
          ok = true;
        } else {
          error = "office_objects_local_persist_failed";
        }
      }
    }
    return { ok, objects: cleaned, error };
  }

  async upsertOfficeObject(object: OfficeObjectSidecarModel): Promise<{ ok: boolean; objects: OfficeObjectSidecarModel[]; error?: string }> {
    const current = await this.getOfficeObjects();
    const canonicalId = toCanonicalOfficeObjectId(object.id);
    const next = current.filter((item) => toCanonicalOfficeObjectId(item.id) !== canonicalId);
    next.push(object);
    return this.saveOfficeObjects(next);
  }

  async deleteOfficeObject(objectId: string): Promise<{ ok: boolean; objects: OfficeObjectSidecarModel[]; error?: string }> {
    const current = await this.getOfficeObjects();
    const canonicalId = toCanonicalOfficeObjectId(objectId);
    const next = current.filter((item) => toCanonicalOfficeObjectId(item.id) !== canonicalId);
    return this.saveOfficeObjects(next);
  }

  async getUnifiedOfficeModel(): Promise<UnifiedOfficeModel> {
    const [runtimeAgents, memory, skills, companyResult, configSnapshot, officeObjects] = await Promise.all([
      this.listAgents().catch(() => []),
      this.listMemory().catch(() => []),
      this.listSkills().catch(() => []),
      this.getCompanyModelWithSource().catch(() => ({ company: DEFAULT_COMPANY_MODEL, source: "default" as const })),
      this.getConfigSnapshot().catch(() => null),
      this.getOfficeObjects().catch(() => []),
    ]);
    const company = companyResult.company;
    const configuredAgents = parseConfiguredAgentsFromConfig(configSnapshot);
    const warnings = buildReconciliationWarnings(company, runtimeAgents, configuredAgents);
    const workload = buildWorkload(company);
    const seenOfficeIds = new Set<string>();
    const duplicateOfficeObjectIds: string[] = [];
    const invalidOfficeObjects: string[] = [];
    for (const object of officeObjects) {
      if (seenOfficeIds.has(object.id)) {
        duplicateOfficeObjectIds.push(object.id);
        invalidOfficeObjects.push(`${object.id}:duplicate_id`);
      } else {
        seenOfficeIds.add(object.id);
      }
      if (
        object.meshType === "team-cluster" &&
        (!object.metadata || typeof object.metadata.teamId !== "string" || !String(object.metadata.teamId).trim())
      ) {
        invalidOfficeObjects.push(`${object.id}:missing_team_cluster_metadata`);
      }
    }
    const outOfBoundsClusterObjectIds = officeObjects
      .filter((object) => object.meshType === "team-cluster")
      .filter(
        (object) =>
          object.position[0] < -CLUSTER_BOUNDARY_LIMIT ||
          object.position[0] > CLUSTER_BOUNDARY_LIMIT ||
          object.position[2] < -CLUSTER_BOUNDARY_LIMIT ||
          object.position[2] > CLUSTER_BOUNDARY_LIMIT,
      )
      .map((object) => object.id);
    const ceoAnchorMode = officeObjects.some((object) => object.meshType === "glass-wall") ? "glass-derived" : "fallback";
    const missingRuntimeAgentIds = configuredAgents
      .map((agent) => agent.agentId)
      .filter((agentId) => !runtimeAgents.some((runtimeAgent) => runtimeAgent.agentId === agentId));
    const unmappedRuntimeAgentIds = runtimeAgents
      .map((agent) => agent.agentId)
      .filter((agentId) => !company.agents.some((metaAgent) => metaAgent.agentId === agentId));
    return {
      company,
      runtimeAgents,
      configuredAgents,
      officeObjects,
      memory,
      skills,
      warnings,
      workload,
      diagnostics: {
        configAgentCount: configuredAgents.length,
        runtimeAgentCount: runtimeAgents.length,
        sidecarAgentCount: company.agents.length,
        missingRuntimeAgentIds,
        unmappedRuntimeAgentIds,
        invalidOfficeObjects,
        duplicateOfficeObjectIds,
        officeObjectCount: officeObjects.length,
        clampedClusterCount: outOfBoundsClusterObjectIds.length,
        outOfBoundsClusterObjectIds,
        ceoAnchorMode,
        source: companyResult.source,
      },
    };
  }

  async getPendingApprovals(): Promise<PendingApprovalModel[]> {
    try {
      const payload = await this.readJson("/openclaw/pending-approvals");
      return normalizeArray(payload.approvals, toPendingApproval);
    } catch {
      return [];
    }
  }

  async resolveApproval(id: string, decision: "approved" | "rejected"): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.stateUrl}/openclaw/pending-approvals/resolve`, {
        method: "POST",
        headers: buildGatewayHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ id, decision }),
      });
      const payload = (await response.json()) as Json;
      return { ok: payload.ok === true, error: typeof payload.error === "string" ? payload.error : undefined };
    } catch {
      return { ok: false, error: "resolve_request_failed" };
    }
  }
}
