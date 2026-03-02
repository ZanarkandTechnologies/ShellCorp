/**
 * OPENCLAW ADAPTER
 * ================
 * Maps OpenClaw-backed HTTP surfaces into Shell Company UI contracts.
 */
import type {
  AgentMemoryEntry,
  AgentCardModel,
  ChatSendRequest,
  CompanyOfficeObjectModel,
  CompanyModel,
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
  TaskSyncState,
  UnifiedOfficeModel,
  MemoryItemModel,
  SessionRowModel,
  SessionTimelineModel,
  SkillItemModel,
  CompanyAgentModel,
  ChannelBindingModel,
  OfficeObjectSidecarModel,
  PendingApprovalModel,
  OfficeSettingsModel,
  MeshAssetModel,
} from "./openclaw-types";
import { buildGatewayHeaders } from "./gateway-config";

type Json = Record<string, unknown>;

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
      const ts = typeof event.ts === "number" ? event.ts : Date.now();
      const type = String(event.type ?? "status");
      const normalizedType: SessionTimelineModel["events"][number]["type"] =
        type === "message" || type === "tool" ? type : "status";
      const role = String(event.role ?? "system");
      const text = String(event.text ?? event.content ?? "");
      if (!text.trim()) return null;
      return {
        ts,
        type: normalizedType,
        role,
        text,
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

function toProject(entry: unknown): ProjectModel | null {
  const row = asRecord(entry);
  const id = String(row.id ?? "").trim();
  const departmentId = String(row.departmentId ?? "").trim();
  const name = String(row.name ?? "").trim();
  if (!id || !departmentId || !name) return null;
  const status = String(row.status ?? "active");
  return {
    id,
    departmentId,
    name,
    githubUrl: String(row.githubUrl ?? ""),
    status: status === "paused" || status === "archived" ? status : "active",
    goal: String(row.goal ?? ""),
    kpis: Array.isArray(row.kpis) ? row.kpis.filter((item): item is string => typeof item === "string") : [],
  };
}

function toCompanyAgent(entry: unknown): CompanyAgentModel | null {
  const row = asRecord(entry);
  const agentId = String(row.agentId ?? "").trim();
  const role = String(row.role ?? "");
  if (!agentId) return null;
  if (role !== "ceo" && role !== "builder" && role !== "growth_marketer" && role !== "pm") return null;
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
  if (role !== "builder" && role !== "growth_marketer" && role !== "pm") return null;
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
  if (role !== "ceo" && role !== "builder" && role !== "growth_marketer" && role !== "pm") return null;
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
  if (agentRole !== "ceo" && agentRole !== "builder" && agentRole !== "growth_marketer" && agentRole !== "pm") return null;
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
    private readonly gatewayUrl: string,
    private readonly stateUrl: string = gatewayUrl,
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
    try {
      const response = await fetch(`${this.gatewayUrl}/openclaw/gateway/method`, {
        method: "POST",
        headers: buildGatewayHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ method, params }),
      });
      if (!response.ok) {
        return { ok: false, payload: {}, error: `gateway_method_failed:${method}:${response.status}` };
      }
      const payload = (await response.json()) as Json;
      const ok = payload.ok === false ? false : true;
      return {
        ok,
        payload,
        error: typeof payload.error === "string" ? payload.error : undefined,
      };
    } catch {
      return { ok: false, payload: {}, error: `gateway_method_unreachable:${method}` };
    }
  }

  async listAgents(): Promise<AgentCardModel[]> {
    const payload = await this.readJson("/openclaw/agents");
    return normalizeArray(payload.agents, toAgent);
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

  async bootstrapNotionProfile(databaseId: string): Promise<{ ok: boolean; profile?: ProviderIndexProfile; error?: string }> {
    const normalizedDatabaseId = databaseId.trim();
    if (!normalizedDatabaseId) return { ok: false, error: "database_id_required" };
    const gatewayResult = await this.invokeGatewayMethod("notion-shell.profile.bootstrap", {
      databaseId: normalizedDatabaseId,
    });
    if (!gatewayResult.ok) return { ok: false, error: gatewayResult.error ?? "profile_bootstrap_failed" };
    const profile = gatewayResult.payload.profile && typeof gatewayResult.payload.profile === "object"
      ? (gatewayResult.payload.profile as Record<string, unknown>)
      : null;
    if (!profile) return { ok: false, error: "profile_payload_missing" };
    const hydrated = toProviderIndexProfile({
      projectId: String(profile.projectId ?? ""),
      provider: "notion",
      entityId: String(profile.entityId ?? normalizedDatabaseId),
      entityName: String(profile.entityName ?? normalizedDatabaseId),
      fieldMappings: Array.isArray(profile.fieldMappings) ? profile.fieldMappings : [],
      fetchCommandHints: ["notion-shell.tasks.list", "notion-shell.tasks.sync", "notion-shell.profile.bootstrap"],
    });
    if (!hydrated) return { ok: false, error: "profile_payload_invalid" };
    return { ok: true, profile: hydrated };
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

    if (writeProvider !== "internal" && policy.writeBackEnabled) {
      const methodName = writeProvider === "notion" ? "notion-shell.tasks.update" : "";
      if (methodName) {
        const gatewayResult = await this.invokeGatewayMethod(methodName, { taskId, updates });
        if (!gatewayResult.ok) {
          const failedTask: FederatedTaskModel = {
            ...current,
            syncState: "error",
            syncError: gatewayResult.error ?? "external_write_failed",
            updatedAt: Date.now(),
          };
          const failedTasks = company.tasks.map((task) => (task.id === taskId ? failedTask : task));
          await this.saveCompanyModel({ ...company, tasks: failedTasks });
          return { ok: false, task: failedTask, error: failedTask.syncError };
        }
      }
    }

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

    if (provider === "notion" || provider === undefined) {
      const gatewayResult = await this.invokeGatewayMethod("notion-shell.tasks.sync", { projectId });
      if (!gatewayResult.ok) {
        const failedTasks = nextTasks.map((task) =>
          task.projectId === projectId && (!provider || task.provider === provider)
            ? { ...task, syncState: "error" as const, syncError: gatewayResult.error ?? "sync_failed", updatedAt: Date.now() }
            : task,
        );
        await this.saveCompanyModel({ ...company, tasks: failedTasks });
        return { ok: false, error: gatewayResult.error ?? "sync_failed" };
      }
    }

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
