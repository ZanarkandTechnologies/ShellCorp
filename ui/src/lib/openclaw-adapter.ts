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
  SkillDemoRunResult,
  SkillManifest,
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
  TeamBusinessSkillSyncResult,
  AgentSkillsInventory,
  GlobalSkillsInventory,
} from "./openclaw-types";
import { buildGatewayHeaders } from "./gateway-config";
import type { GatewayWsClient } from "./gateway-ws-client";
import type { BusinessBuilderResourceDraft } from "./business-builder";
import { createBusinessBuilderDraft, toProjectResources } from "./business-builder";

import {
  normalizeArray,
  toAgent,
  toSession,
  toTimeline,
  scoreBubbleLabel,
  isHeartbeatStartEvent,
  isOperatorLikeMessage,
  finalizeHeartbeatWindow,
  parseHeartbeatWindows,
  deriveAgentLiveStatus,
  toSkill,
  toMemory,
  toAgentFileEntry,
  toAgentsFilesListResult,
  toAgentsFilesGetResult,
  toAgentsFilesSetResult,
  toProjectArtefactIndex,
  toToolCatalogProfile,
  toToolCatalogEntry,
  toToolCatalogGroup,
  toToolsCatalogResult,
  toChannelMetaEntry,
  toChannelAccountSnapshot,
  toChannelsStatusSnapshot,
  toCronJob,
  toCronStatus,
  toSkillStatusEntry,
  toSkillStatusReport,
  toSkillStudioCatalogEntry,
  toSkillStudioDetail,
  toSkillStudioFileContent,
  toSkillDemoRunResult,
  toOfficeSettings,
  toMeshAsset,
  toAgentMemoryEntry,
  toPendingApproval,
  asRecord,
  toDepartment,
  toCapabilitySlot,
  toBusinessConfig,
  toLedgerEntry,
  toProjectAccount,
  toProjectAccountEvent,
  toExperiment,
  toMetricEvent,
  toResourceType,
  toResourceLowBehavior,
  toResourceEventKind,
  toProjectResource,
  toResourceEvent,
  toProject,
  toCompanyAgent,
  toRoleSlot,
  toTask,
  toFederationPolicy,
  hashSchemaVersion,
  toProviderIndexProfile,
  resolveCanonicalWriteProvider,
  toHeartbeatProfile,
  toChannelBinding,
  toOfficeObject,
  toOfficeObjectSidecar,
  toCanonicalOfficeObjectId,
  normalizeCompanyModel,
  buildWorkload,
  buildReconciliationWarnings,
  parseConfiguredAgentsFromConfig,
  COMPANY_STORAGE_KEY,
  OFFICE_OBJECTS_STORAGE_KEY,
  CLUSTER_BOUNDARY_LIMIT,
  DEFAULT_COMPANY_MODEL,
} from "./adapter/_normalize";

export {
  parseHeartbeatWindows,
  deriveAgentLiveStatus,
  toProjectArtefactIndex,
  toTask,
  toTimeline,
  toFederationPolicy,
  hashSchemaVersion,
  toProviderIndexProfile,
  resolveCanonicalWriteProvider,
} from "./adapter/_normalize";

type Json = Record<string, unknown>;

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

  private async tryReadJson(
    path: string,
    baseUrl: string = this.stateUrl,
  ): Promise<{ ok: true; payload: Json } | { ok: false; status?: number }> {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: buildGatewayHeaders(),
      });
      if (!response.ok) {
        return { ok: false, status: response.status };
      }
      return { ok: true, payload: (await response.json()) as Json };
    } catch {
      return { ok: false };
    }
  }

  private getSkillStudioStateBases(): string[] {
    const bases = [this.stateUrl];
    if (typeof window !== "undefined") {
      const currentOrigin = window.location.origin.trim();
      if (currentOrigin && !bases.includes(currentOrigin)) {
        bases.push(currentOrigin);
      }
    }
    return bases;
  }

  private async readSkillStudioJson(path: string): Promise<Json> {
    let lastStatus: number | undefined;
    for (const baseUrl of this.getSkillStudioStateBases()) {
      const result = await this.tryReadJson(path, baseUrl);
      if (result.ok) {
        return result.payload;
      }
      lastStatus = result.status ?? lastStatus;
      if (result.status !== 404) {
        break;
      }
    }
    throw new Error(`request_failed:${path}:${lastStatus ?? "unreachable"}`);
  }

  private async postSkillStudioJson(path: string, body: Json): Promise<Json | null> {
    for (const baseUrl of this.getSkillStudioStateBases()) {
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          method: "POST",
          headers: buildGatewayHeaders({ "content-type": "application/json" }),
          body: JSON.stringify(body),
        });
        if (response.ok) {
          return (await response.json()) as Json;
        }
        if (response.status !== 404) {
          return null;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  private async postBoardJson(path: string, body: Json): Promise<Json> {
    let response: Response;
    try {
      response = await fetch(`${this.stateUrl}${path}`, {
        method: "POST",
        headers: buildGatewayHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error(`request_unreachable:${path}`);
    }
    const payload = (await response.json()) as Json;
    if (!response.ok || payload.ok === false) {
      throw new Error(
        typeof payload.error === "string" ? payload.error : `request_failed:${path}:${response.status}`,
      );
    }
    return payload;
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
    const agentsNode =
      configRoot.agents && typeof configRoot.agents === "object"
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
                  name:
                    typeof (row.identity as Record<string, unknown>).name === "string"
                      ? String((row.identity as Record<string, unknown>).name)
                      : undefined,
                  theme:
                    typeof (row.identity as Record<string, unknown>).theme === "string"
                      ? String((row.identity as Record<string, unknown>).theme)
                      : undefined,
                  emoji:
                    typeof (row.identity as Record<string, unknown>).emoji === "string"
                      ? String((row.identity as Record<string, unknown>).emoji)
                      : undefined,
                  avatar:
                    typeof (row.identity as Record<string, unknown>).avatar === "string"
                      ? String((row.identity as Record<string, unknown>).avatar)
                      : undefined,
                  avatarUrl:
                    typeof (row.identity as Record<string, unknown>).avatarUrl === "string"
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
      deduped.set(row.id, {
        ...(deduped.get(row.id) ?? {}),
        ...row,
      } as AgentsListResult["agents"][number]);
    }
    const defaultIdRaw = agentsNode.default;
    const defaultId =
      typeof defaultIdRaw === "string" && defaultIdRaw.trim() ? defaultIdRaw.trim() : "main";
    const mainKeyRaw = agentsNode.mainKey;
    const mainKey =
      typeof mainKeyRaw === "string" && mainKeyRaw.trim() ? mainKeyRaw.trim() : "main";
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
            const identity =
              row.identity && typeof row.identity === "object" ? (row.identity as Json) : {};
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
    const fallbackPath = `/openclaw/agents/${encodeURIComponent(agentId)}/files`;
    const result = await this.invokeGatewayMethod("agents.files.list", { agentId });
    const parsed = result.ok ? toAgentsFilesListResult(result.payload) : null;
    const needsFallback =
      !parsed ||
      parsed.files.length === 0 ||
      parsed.files.every((file) => !file.path.includes("/") && !file.name.includes("/"));
    if (!needsFallback) return parsed;
    try {
      const fallbackPayload = await this.readJson(fallbackPath);
      const fallbackParsed = toAgentsFilesListResult(fallbackPayload);
      if (fallbackParsed) return fallbackParsed;
    } catch {
      // Keep original error semantics when fallback is unavailable.
    }
    if (!result.ok) throw new Error(result.error ?? "agents_files_list_failed");
    if (!parsed) throw new Error("agents_files_list_invalid");
    return parsed;
  }

  async getAgentFile(agentId: string, name: string): Promise<AgentsFilesGetResult> {
    const result = await this.invokeGatewayMethod("agents.files.get", { agentId, name });
    const parsed = toAgentsFilesGetResult(result.payload);
    if (result.ok && parsed) return parsed;
    try {
      const fallbackPayload = await this.readJson(
        `/openclaw/agents/${encodeURIComponent(agentId)}/files/get?name=${encodeURIComponent(name)}`,
      );
      const fallbackParsed = toAgentsFilesGetResult(fallbackPayload);
      if (fallbackParsed) return fallbackParsed;
    } catch {
      // keep original error behavior
    }
    if (!result.ok) throw new Error(result.error ?? "agents_files_get_failed");
    throw new Error("agents_files_get_invalid");
  }

  async saveAgentFile(
    agentId: string,
    name: string,
    content: string,
  ): Promise<AgentsFilesSetResult> {
    const result = await this.invokeGatewayMethod("agents.files.set", { agentId, name, content });
    if (!result.ok) throw new Error(result.error ?? "agents_files_set_failed");
    const parsed = toAgentsFilesSetResult(result.payload);
    if (!parsed) throw new Error("agents_files_set_invalid");
    return parsed;
  }

  async listProjectArtefacts(
    projectId: string,
    agentIds: string[],
  ): Promise<ProjectArtefactIndexResult> {
    const dedupedAgentIds = [...new Set(agentIds.map((entry) => entry.trim()).filter(Boolean))];
    if (!projectId.trim() || dedupedAgentIds.length === 0) {
      return toProjectArtefactIndex(projectId.trim(), [], Date.now());
    }
    const normalizedProjectId = projectId.trim();
    const hasProjectPath = (filePath: string): boolean => {
      const normalized = filePath.replace(/\\/g, "/").toLowerCase();
      const projectNeedle = `/projects/${normalizedProjectId.toLowerCase()}/`;
      const legacyArtefactNeedle = "/artifacts/";
      return (
        normalized.includes(projectNeedle) ||
        normalized.startsWith(`projects/${normalizedProjectId.toLowerCase()}/`) ||
        normalized.includes(legacyArtefactNeedle)
      );
    };
    const groups = await Promise.all(
      dedupedAgentIds.map(async (agentId): Promise<ProjectArtefactGroup> => {
        try {
          const list = await this.listAgentFiles(agentId);
          let sourceList = list;
          const baseHasProjectFiles = list.files.some((file) => hasProjectPath(file.path));
          if (!baseHasProjectFiles) {
            try {
              const fallbackPayload = await this.readJson(
                `/openclaw/agents/${encodeURIComponent(agentId)}/files`,
              );
              const fallbackParsed = toAgentsFilesListResult(fallbackPayload);
              if (fallbackParsed && fallbackParsed.files.length > list.files.length) {
                sourceList = fallbackParsed;
              } else if (
                fallbackParsed &&
                fallbackParsed.files.some((file) => hasProjectPath(file.path))
              ) {
                sourceList = fallbackParsed;
              }
            } catch {
              // keep default list on fallback failure
            }
          }
          const files: ProjectArtefactEntry[] = sourceList.files
            .map((file) => ({
              ...file,
              projectId: normalizedProjectId,
              agentId,
              workspace: sourceList.workspace,
            }))
            .sort((left, right) => {
              const tsDelta = (right.updatedAtMs ?? 0) - (left.updatedAtMs ?? 0);
              if (tsDelta !== 0) return tsDelta;
              return left.path.localeCompare(right.path);
            });
          return {
            projectId: normalizedProjectId,
            agentId,
            workspace: list.workspace,
            files,
          };
        } catch (error) {
          return {
            projectId: normalizedProjectId,
            agentId,
            workspace: "",
            files: [],
            error: error instanceof Error ? error.message : "agents_files_list_failed",
          };
        }
      }),
    );
    return toProjectArtefactIndex(normalizedProjectId, groups, Date.now());
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

  async getAgentSkillsInventory(agentId: string): Promise<AgentSkillsInventory | null> {
    const payload = await this.readSkillStudioJson(
      `/openclaw/skills/agent-inventory?agentId=${encodeURIComponent(agentId)}`,
    );
    if (!payload || typeof payload !== "object") return null;
    return {
      agentId: typeof payload.agentId === "string" ? payload.agentId : agentId,
      workspacePath: typeof payload.workspacePath === "string" ? payload.workspacePath : "",
      workspaceSkills: normalizeArray(payload.workspaceSkills, (entry) => {
        if (!entry || typeof entry !== "object") return null;
        const row = entry as Json;
        const skillId = String(row.skillId ?? "").trim();
        const sourcePath = String(row.sourcePath ?? "").trim();
        const scope = row.scope === "shared" ? "shared" : "agent";
        if (!skillId || !sourcePath) return null;
        return { skillId, sourcePath, scope };
      }),
      sharedSkills: normalizeArray(payload.sharedSkills, (entry) => {
        if (!entry || typeof entry !== "object") return null;
        const row = entry as Json;
        const skillId = String(row.skillId ?? "").trim();
        const sourcePath = String(row.sourcePath ?? "").trim();
        const scope = row.scope === "agent" ? "agent" : "shared";
        if (!skillId || !sourcePath) return null;
        return { skillId, sourcePath, scope };
      }),
    };
  }

  async getGlobalSkillsInventory(): Promise<GlobalSkillsInventory | null> {
    const payload = await this.readSkillStudioJson("/openclaw/skills/global-inventory");
    if (!payload || typeof payload !== "object") return null;
    return {
      sharedSkills: normalizeArray(payload.sharedSkills, (entry) => {
        if (!entry || typeof entry !== "object") return null;
        const row = entry as Json;
        const skillId = String(row.skillId ?? "").trim();
        const sourcePath = String(row.sourcePath ?? "").trim();
        const scope = row.scope === "agent" ? "agent" : "shared";
        if (!skillId || !sourcePath) return null;
        return { skillId, sourcePath, scope };
      }),
    };
  }

  async installRepoSkillToAgentWorkspace(
    agentId: string,
    skillId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    return this.postWorkspaceSkillMutation("/openclaw/skills/install-workspace", { agentId, skillId });
  }

  async removeAgentWorkspaceSkill(
    agentId: string,
    skillId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    return this.postWorkspaceSkillMutation("/openclaw/skills/remove-workspace", { agentId, skillId });
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

  async getSessionTimeline(
    agentId: string,
    sessionKey: string,
    limit = 200,
  ): Promise<SessionTimelineModel> {
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

  async sendMessage(
    input: ChatSendRequest,
  ): Promise<{ ok: boolean; eventId?: string; error?: string }> {
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

  async listSkillStudioCatalog(agentId?: string): Promise<SkillStudioCatalogEntry[]> {
    const query = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
    const primaryPath = `/openclaw/skills/catalog${query}`;
    for (const baseUrl of this.getSkillStudioStateBases()) {
      const primary = await this.tryReadJson(primaryPath, baseUrl);
      if (primary.ok) {
        return normalizeArray(primary.payload.skills, toSkillStudioCatalogEntry);
      }
      if (primary.status !== 404) {
        throw new Error(`request_failed:${primaryPath}:${primary.status ?? "unreachable"}`);
      }
    }
    const legacyPath = `/openclaw/skills${query}`;
    const legacy = await this.tryReadJson(legacyPath);
    if (!legacy.ok) {
      throw new Error(`request_failed:${primaryPath}:404`);
    }
    const catalog = normalizeArray(legacy.payload.skills, toSkillStudioCatalogEntry);
    if (catalog.length > 0) {
      return catalog;
    }
    return normalizeArray(legacy.payload.skills, toSkill).map((skill) => ({
      skillId: skill.name,
      packageKey: skill.name,
      displayName: skill.name,
      description: "",
      category: skill.category,
      scope: skill.scope,
      sourcePath: skill.sourcePath,
      updatedAt: skill.updatedAt,
      hasManifest: false,
      hasTests: false,
      hasDiagram: false,
      hasSkillMemory: false,
    }));
  }

  async getSkillStudioDetail(skillId: string, agentId?: string): Promise<SkillStudioDetail | null> {
    const query = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
    const payload = await this.readSkillStudioJson(
      `/openclaw/skills/${encodeURIComponent(skillId)}${query}`,
    );
    return toSkillStudioDetail(payload.skill ?? payload);
  }

  async getSkillStudioFile(
    skillId: string,
    filePath: string,
  ): Promise<SkillStudioFileContent | null> {
    const payload = await this.readSkillStudioJson(
      `/openclaw/skills/${encodeURIComponent(skillId)}/file?path=${encodeURIComponent(filePath)}`,
    );
    return toSkillStudioFileContent(payload.file ?? payload);
  }

  async saveSkillStudioFile(
    skillId: string,
    filePath: string,
    content: string,
  ): Promise<SkillStudioFileContent | null> {
    const payload = await this.postSkillStudioJson(
      `/openclaw/skills/${encodeURIComponent(skillId)}/file`,
      { path: filePath, content },
    );
    if (!payload) return null;
    return toSkillStudioFileContent(payload.file ?? payload);
  }

  async runSkillStudioDemo(skillId: string, caseId: string): Promise<SkillDemoRunResult | null> {
    const payload = await this.postSkillStudioJson(
      `/openclaw/skills/${encodeURIComponent(skillId)}/demos/run`,
      { caseId },
    );
    if (!payload) return null;
    return toSkillDemoRunResult(payload.run ?? payload);
  }

  async saveSkillStudioManifest(
    skillId: string,
    input: { manifest?: SkillManifest; rawYaml?: string },
  ): Promise<SkillStudioDetail | null> {
    const payload = await this.postSkillStudioJson(
      `/openclaw/skills/${encodeURIComponent(skillId)}/config`,
      input as Json,
    );
    if (!payload) return null;
    return toSkillStudioDetail(payload.skill ?? payload);
  }

  async listMemory(): Promise<MemoryItemModel[]> {
    const payload = await this.readJson("/openclaw/memory");
    return normalizeArray(payload.memory, toMemory);
  }

  async listAgentMemoryEntries(agentId: string): Promise<AgentMemoryEntry[]> {
    const payload = await this.readJson(
      `/openclaw/agents/${encodeURIComponent(agentId)}/memory-entries`,
    );
    return normalizeArray(payload.entries, (entry) => toAgentMemoryEntry(agentId, entry));
  }

  async getConfigSnapshot(): Promise<OpenClawConfigSnapshot> {
    const payload = await this.readJson("/openclaw/config");
    const config =
      payload.config && typeof payload.config === "object"
        ? (payload.config as Record<string, unknown>)
        : {};
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
      return {
        summary: "preview endpoint unavailable",
        diffText: JSON.stringify(nextConfig, null, 2),
      };
    }
    const payload = (await response.json()) as Json;
    return {
      summary: String(payload.summary ?? "preview generated"),
      diffText: typeof payload.diffText === "string" ? payload.diffText : undefined,
    };
  }

  async applyConfig(
    nextConfig: Record<string, unknown>,
    confirm: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
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

  private async postWorkspaceSkillMutation(
    path: string,
    body: Record<string, unknown>,
  ): Promise<{ ok: boolean; error?: string }> {
    let response: Response;
    try {
      response = await fetch(`${this.stateUrl}${path}`, {
        method: "POST",
        headers: buildGatewayHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(body),
      });
    } catch {
      return { ok: false, error: `request_unreachable:${path}` };
    }
    const payload = (await response.json().catch(() => ({}))) as Json;
    if (!response.ok || payload.ok === false) {
      return {
        ok: false,
        error:
          typeof payload.error === "string"
            ? payload.error
            : `request_failed:${path}:${response.status}`,
      };
    }
    return { ok: true };
  }

  private async getCompanyModelWithSource(): Promise<{
    company: CompanyModel;
    source: "gateway" | "localStorage" | "default";
  }> {
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

  async saveCompanyModel(
    input: CompanyModel,
  ): Promise<{ ok: boolean; company: CompanyModel; error?: string }> {
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
  }): Promise<{
    ok: boolean;
    teamId?: string;
    projectId?: string;
    createdAgents?: string[];
    error?: string;
  }> {
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
          error:
            typeof payload.error === "string"
              ? payload.error
              : `team_create_failed:${response.status}`,
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
      if (
        previous.remaining !== resource.remaining ||
        previous.limit !== resource.limit ||
        previous.reserved !== resource.reserved
      ) {
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
    const nextBalance =
      input.type === "credit" ? currentBalance + amountCents : currentBalance - amountCents;
    if (input.type === "debit" && nextBalance < 0)
      return { ok: false, error: "insufficient_balance" };

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
      description:
        input.note?.trim() || (input.type === "credit" ? "Account funding" : "Account spend"),
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
          error:
            typeof payload.error === "string"
              ? payload.error
              : `heartbeat_render_failed:${response.status}`,
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

  async syncTeamBusinessSkillsToAgents(input: {
    teamId: string;
    mode?: "replace_minimum" | "append_only";
    dryRun?: boolean;
  }): Promise<TeamBusinessSkillSyncResult> {
    const payload = {
      teamId: input.teamId,
      mode: input.mode ?? "replace_minimum",
      dryRun: input.dryRun === true,
    };
    try {
      const response = await fetch(`${this.stateUrl}/openclaw/team/business/equip-skills`, {
        method: "POST",
        headers: buildGatewayHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as Json;
      if (!response.ok || body.ok === false) {
        return {
          ok: false,
          teamId: input.teamId,
          projectId: "",
          mode: payload.mode,
          dryRun: payload.dryRun,
          touchedAgents: [],
          missingAgents: [],
          preview: [],
          error:
            typeof body.error === "string"
              ? body.error
              : `team_business_skill_sync_failed:${response.status}`,
        };
      }
      return {
        ok: true,
        teamId: typeof body.teamId === "string" ? body.teamId : input.teamId,
        projectId: typeof body.projectId === "string" ? body.projectId : "",
        mode: body.mode === "append_only" ? "append_only" : "replace_minimum",
        dryRun: body.dryRun === true,
        touchedAgents: Array.isArray(body.touchedAgents)
          ? body.touchedAgents.filter((entry): entry is string => typeof entry === "string")
          : [],
        missingAgents: Array.isArray(body.missingAgents)
          ? body.missingAgents.filter((entry): entry is string => typeof entry === "string")
          : [],
        preview: Array.isArray(body.preview)
          ? body.preview
              .map((entry) => {
                if (!entry || typeof entry !== "object") return null;
                const row = entry as Json;
                const agentId = typeof row.agentId === "string" ? row.agentId : "";
                if (!agentId) return null;
                return {
                  agentId,
                  role: row.role === "biz_executor" ? "biz_executor" : "biz_pm",
                  mode: row.mode === "append_only" ? "append_only" : "replace_minimum",
                  beforeSkills: Array.isArray(row.beforeSkills)
                    ? row.beforeSkills.filter((item): item is string => typeof item === "string")
                    : [],
                  afterSkills: Array.isArray(row.afterSkills)
                    ? row.afterSkills.filter((item): item is string => typeof item === "string")
                    : [],
                };
              })
              .filter(
                (entry): entry is TeamBusinessSkillSyncResult["preview"][number] => entry !== null,
              )
          : [],
      };
    } catch {
      return {
        ok: false,
        teamId: input.teamId,
        projectId: "",
        mode: payload.mode,
        dryRun: payload.dryRun,
        touchedAgents: [],
        missingAgents: [],
        preview: [],
        error: "team_business_skill_sync_unavailable",
      };
    }
  }

  async upsertChannelBinding(
    input: ChannelBindingModel,
  ): Promise<{ ok: boolean; company: CompanyModel; error?: string }> {
    const company = await this.getCompanyModel();
    const nextBindings = company.channelBindings.filter(
      (binding) =>
        !(
          binding.platform === input.platform &&
          binding.externalChannelId === input.externalChannelId
        ),
    );
    nextBindings.push(input);
    return this.saveCompanyModel({ ...company, channelBindings: nextBindings });
  }

  async listFederatedTasks(
    input: { projectId?: string; provider?: FederatedTaskModel["provider"] } = {},
  ): Promise<FederatedTaskModel[]> {
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
    const nextPolicies = company.federationPolicies.filter(
      (policy) => policy.projectId !== input.projectId,
    );
    nextPolicies.push(input);
    return this.saveCompanyModel({ ...company, federationPolicies: nextPolicies });
  }

  async upsertProviderIndexProfile(
    input: ProviderIndexProfile,
  ): Promise<{ ok: boolean; company: CompanyModel; error?: string }> {
    const company = await this.getCompanyModel();
    const nextProfiles = company.providerIndexProfiles.filter(
      (profile) => profile.profileId !== input.profileId,
    );
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

  async manualResync(
    projectId: string,
    provider?: FederatedTaskModel["provider"],
  ): Promise<{ ok: boolean; error?: string }> {
    const company = await this.getCompanyModel();
    const nextTasks = company.tasks.map((task) => {
      if (task.projectId !== projectId) return task;
      if (provider && task.provider !== provider) return task;
      return {
        ...task,
        syncState: "pending" as const,
        syncError: undefined,
        updatedAt: Date.now(),
      };
    });
    const initialSave = await this.saveCompanyModel({ ...company, tasks: nextTasks });
    if (!initialSave.ok) return { ok: false, error: initialSave.error };

    const reconciledTasks = nextTasks.map((task) => {
      if (task.projectId !== projectId) return task;
      if (provider && task.provider !== provider) return task;
      return {
        ...task,
        syncState: "healthy" as const,
        syncError: undefined,
        updatedAt: Date.now(),
      };
    });
    const finalSave = await this.saveCompanyModel({ ...company, tasks: reconciledTasks });
    return { ok: finalSave.ok, error: finalSave.error };
  }

  async getOfficeObjects(): Promise<OfficeObjectSidecarModel[]> {
    try {
      const payload = await this.readJson("/openclaw/office-objects");
      const objects = normalizeArray(
        payload.objects ?? payload.officeObjects ?? payload,
        toOfficeObjectSidecar,
      );
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
      return toOfficeSettings({});
    }
  }

  async saveOfficeSettings(
    settings: OfficeSettingsModel,
  ): Promise<{ ok: boolean; settings: OfficeSettingsModel; error?: string }> {
    const normalized = toOfficeSettings(settings);
    try {
      const response = await fetch(`${this.stateUrl}/openclaw/office-settings`, {
        method: "POST",
        headers: buildGatewayHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ settings: normalized }),
      });
      if (!response.ok) {
        return {
          ok: false,
          settings: normalized,
          error: `office_settings_save_failed:${response.status}`,
        };
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

  async downloadMeshAsset(input: {
    url: string;
    label?: string;
  }): Promise<{ ok: boolean; asset?: MeshAssetModel; error?: string }> {
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
        return {
          ok: false,
          error: typeof payload.error === "string" ? payload.error : "mesh_download_failed",
        };
      }
      const asset = toMeshAsset(payload.asset);
      if (!asset) return { ok: false, error: "mesh_asset_invalid" };
      return { ok: true, asset };
    } catch {
      return { ok: false, error: "mesh_download_unavailable" };
    }
  }

  async saveOfficeObjects(
    objects: OfficeObjectSidecarModel[],
  ): Promise<{ ok: boolean; objects: OfficeObjectSidecarModel[]; error?: string }> {
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

  async upsertOfficeObject(
    object: OfficeObjectSidecarModel,
    options?: { currentObjects?: OfficeObjectSidecarModel[] },
  ): Promise<{ ok: boolean; objects: OfficeObjectSidecarModel[]; error?: string }> {
    const current = options?.currentObjects ?? (await this.getOfficeObjects());
    const canonicalId = toCanonicalOfficeObjectId(object.id);
    const next = current.filter((item) => toCanonicalOfficeObjectId(item.id) !== canonicalId);
    next.push(object);
    return this.saveOfficeObjects(next);
  }

  async deleteOfficeObject(
    objectId: string,
    options?: { currentObjects?: OfficeObjectSidecarModel[] },
  ): Promise<{ ok: boolean; objects: OfficeObjectSidecarModel[]; error?: string }> {
    const current = options?.currentObjects ?? (await this.getOfficeObjects());
    const canonicalId = toCanonicalOfficeObjectId(objectId);
    const next = current.filter((item) => toCanonicalOfficeObjectId(item.id) !== canonicalId);
    return this.saveOfficeObjects(next);
  }

  async getUnifiedOfficeModel(): Promise<UnifiedOfficeModel> {
    const [runtimeAgents, memory, skills, companyResult, configSnapshot, officeObjects] =
      await Promise.all([
        this.listAgents().catch(() => []),
        this.listMemory().catch(() => []),
        this.listSkills().catch(() => []),
        this.getCompanyModelWithSource().catch(() => ({
          company: DEFAULT_COMPANY_MODEL,
          source: "default" as const,
        })),
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
        (!object.metadata ||
          typeof object.metadata.teamId !== "string" ||
          !String(object.metadata.teamId).trim())
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
    const ceoAnchorMode = officeObjects.some((object) => object.meshType === "glass-wall")
      ? "glass-derived"
      : "fallback";
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

  async resolveApproval(
    id: string,
    decision: "approved" | "rejected",
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.stateUrl}/openclaw/pending-approvals/resolve`, {
        method: "POST",
        headers: buildGatewayHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ id, decision }),
      });
      const payload = (await response.json()) as Json;
      return {
        ok: payload.ok === true,
        error: typeof payload.error === "string" ? payload.error : undefined,
      };
    } catch {
      return { ok: false, error: "resolve_request_failed" };
    }
  }
}
