/**
 * OPENCLAW ADAPTER
 * ================
 * Maps OpenClaw-backed HTTP surfaces into Shell Company UI contracts.
 */
import type {
  AgentCardModel,
  ChatSendRequest,
  CompanyModel,
  DepartmentModel,
  HeartbeatProfileModel,
  OpenClawConfigPreview,
  OpenClawConfigSnapshot,
  ProjectModel,
  ProjectWorkloadSummary,
  ReconciliationWarning,
  RoleSlotModel,
  TaskModel,
  UnifiedOfficeModel,
  MemoryItemModel,
  SessionRowModel,
  SessionTimelineModel,
  SkillItemModel,
  CompanyAgentModel,
  ChannelBindingModel,
} from "./openclaw-types";

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
      const role = String(event.role ?? "system");
      const text = String(event.text ?? event.content ?? "");
      if (!text.trim()) return null;
      return {
        ts,
        type: type === "message" || type === "tool" ? type : "status",
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

const COMPANY_STORAGE_KEY = "shellcorp.company-model.v1";
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

function toTask(entry: unknown): TaskModel | null {
  const row = asRecord(entry);
  const id = String(row.id ?? "").trim();
  const projectId = String(row.projectId ?? "").trim();
  const title = String(row.title ?? "").trim();
  if (!id || !projectId || !title) return null;
  const status = String(row.status ?? "todo");
  const priority = String(row.priority ?? "medium");
  return {
    id,
    projectId,
    title,
    status: status === "in_progress" || status === "blocked" || status === "done" ? status : "todo",
    ownerAgentId: typeof row.ownerAgentId === "string" ? row.ownerAgentId : undefined,
    priority: priority === "low" || priority === "high" ? priority : "medium",
  };
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

function normalizeCompanyModel(value: unknown): CompanyModel {
  const row = asRecord(value);
  const departments = normalizeArray(row.departments, toDepartment);
  const projects = normalizeArray(row.projects, toProject);
  const agents = normalizeArray(row.agents, toCompanyAgent);
  const roleSlots = normalizeArray(row.roleSlots, toRoleSlot);
  const tasks = normalizeArray(row.tasks, toTask);
  const heartbeatProfiles = normalizeArray(row.heartbeatProfiles, toHeartbeatProfile);
  const channelBindings = normalizeArray(row.channelBindings, toChannelBinding);
  const runtime = asRecord(row.heartbeatRuntime);
  return {
    version: Number(row.version ?? 1),
    departments: departments.length > 0 ? departments : DEFAULT_COMPANY_MODEL.departments,
    projects,
    agents: agents.length > 0 ? agents : DEFAULT_COMPANY_MODEL.agents,
    roleSlots,
    tasks,
    heartbeatProfiles: heartbeatProfiles.length > 0 ? heartbeatProfiles : DEFAULT_COMPANY_MODEL.heartbeatProfiles,
    channelBindings,
    heartbeatRuntime: {
      enabled: runtime.enabled !== false,
      pluginId: String(runtime.pluginId ?? DEFAULT_COMPANY_MODEL.heartbeatRuntime.pluginId),
      serviceId: String(runtime.serviceId ?? DEFAULT_COMPANY_MODEL.heartbeatRuntime.serviceId),
      cadenceMinutes: Math.max(1, Number(runtime.cadenceMinutes ?? DEFAULT_COMPANY_MODEL.heartbeatRuntime.cadenceMinutes)),
      notes: typeof runtime.notes === "string" ? runtime.notes : undefined,
    },
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

function buildReconciliationWarnings(company: CompanyModel, runtimeAgents: AgentCardModel[]): ReconciliationWarning[] {
  const warnings: ReconciliationWarning[] = [];
  const runtimeIds = new Set(runtimeAgents.map((agent) => agent.agentId));
  const metaIds = new Set(company.agents.map((agent) => agent.agentId));

  for (const metaAgent of company.agents) {
    if (metaAgent.lifecycleState === "active" && !runtimeIds.has(metaAgent.agentId)) {
      warnings.push({
        code: "missing_runtime_agent",
        message: `Expected active agent '${metaAgent.agentId}' is missing from OpenClaw runtime.`,
      });
    }
  }

  for (const runtimeAgent of runtimeAgents) {
    if (!metaIds.has(runtimeAgent.agentId)) {
      warnings.push({
        code: "unmapped_runtime_agent",
        message: `Runtime agent '${runtimeAgent.agentId}' has no sidecar mapping.`,
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

  return warnings;
}

export class OpenClawAdapter {
  constructor(private readonly baseUrl: string) {}

  private async readJson(path: string): Promise<Json> {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(`request_failed:${path}`);
    }
    return (await response.json()) as Json;
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
    const response = await fetch(`${this.baseUrl}/openclaw/chat/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
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

  async getConfigSnapshot(): Promise<OpenClawConfigSnapshot> {
    const payload = await this.readJson("/openclaw/config");
    const config = payload.config && typeof payload.config === "object" ? (payload.config as Record<string, unknown>) : {};
    return {
      stateVersion: typeof payload.stateVersion === "number" ? payload.stateVersion : undefined,
      config,
    };
  }

  async previewConfig(nextConfig: Record<string, unknown>): Promise<OpenClawConfigPreview> {
    const response = await fetch(`${this.baseUrl}/openclaw/config/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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
    const response = await fetch(`${this.baseUrl}/openclaw/config/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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
    const response = await fetch(`${this.baseUrl}/openclaw/config/rollback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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

  async getCompanyModel(): Promise<CompanyModel> {
    try {
      const payload = await this.readJson("/openclaw/company-model");
      return normalizeCompanyModel(payload.company ?? payload);
    } catch {
      // Fall through to static/local sources.
    }

    try {
      const response = await fetch("/company.json");
      if (response.ok) {
        const payload = (await response.json()) as unknown;
        return normalizeCompanyModel(payload);
      }
    } catch {
      // Fall through.
    }

    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(COMPANY_STORAGE_KEY);
        if (raw) {
          return normalizeCompanyModel(JSON.parse(raw));
        }
      } catch {
        // ignore parsing/storage errors
      }
    }

    return DEFAULT_COMPANY_MODEL;
  }

  async saveCompanyModel(input: CompanyModel): Promise<{ ok: boolean; company: CompanyModel; error?: string }> {
    const company = normalizeCompanyModel(input);
    let ok = false;
    let error: string | undefined;

    try {
      const response = await fetch(`${this.baseUrl}/openclaw/company-model`, {
        method: "POST",
        headers: { "content-type": "application/json" },
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

  async getUnifiedOfficeModel(): Promise<UnifiedOfficeModel> {
    const [runtimeAgents, memory, skills, company] = await Promise.all([
      this.listAgents().catch(() => []),
      this.listMemory().catch(() => []),
      this.listSkills().catch(() => []),
      this.getCompanyModel().catch(() => DEFAULT_COMPANY_MODEL),
    ]);
    const warnings = buildReconciliationWarnings(company, runtimeAgents);
    const workload = buildWorkload(company);
    return {
      company,
      runtimeAgents,
      memory,
      skills,
      warnings,
      workload,
    };
  }
}
