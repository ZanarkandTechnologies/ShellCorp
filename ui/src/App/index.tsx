import { useEffect, useMemo, useState } from "react";

import { gatewayBase } from "@/lib/gateway-config";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { formatTimestamp as fmtTs } from "@/lib/format-utils";
import type {
  AgentCardModel,
  ChannelBindingModel,
  CompanyModel,
  DepartmentModel,
  MemoryItemModel,
  ProjectWorkloadSummary,
  ReconciliationWarning,
  SessionRowModel,
  SessionTimelineModel,
  SkillItemModel,
} from "@/lib/openclaw-types";

import {
  MemorySection,
  OfficeSection,
  OperationsSection,
  ReconciliationWarnings,
  SkillsSection,
} from "./render-sections";
import { AppTabNav } from "./tab-nav";
import type { AppProps, UiTab } from "./types";

function safeParseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const fallbackAgents: AgentCardModel[] = [
  {
    agentId: "main",
    displayName: "Main Agent",
    workspacePath: "~/.openclaw/workspace",
    agentDir: "~/.openclaw/agents/main/agent",
    sandboxMode: "off",
    toolPolicy: { allow: [], deny: [] },
    sessionCount: 0,
  },
];

export function App({ initialTab = "operations" }: AppProps): JSX.Element {
  const adapter = useOpenClawAdapter();
  const [activeTab, setActiveTab] = useState<UiTab>(initialTab);
  const [agents, setAgents] = useState<AgentCardModel[]>([]);
  const [sessions, setSessions] = useState<SessionRowModel[]>([]);
  const [timeline, setTimeline] = useState<SessionTimelineModel | null>(null);
  const [memory, setMemory] = useState<MemoryItemModel[]>([]);
  const [skills, setSkills] = useState<SkillItemModel[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedSessionKey, setSelectedSessionKey] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [configDraftText, setConfigDraftText] = useState("{}");
  const [configPreviewText, setConfigPreviewText] = useState("");
  const [configStatusText, setConfigStatusText] = useState("");
  const [configBusy, setConfigBusy] = useState(false);
  const [confirmConfigWrite, setConfirmConfigWrite] = useState(false);
  const [agentModelDraft, setAgentModelDraft] = useState("");
  const [sandboxModeDraft, setSandboxModeDraft] = useState("off");
  const [toolsAllowDraft, setToolsAllowDraft] = useState("");
  const [toolsDenyDraft, setToolsDenyDraft] = useState("");
  const [vmSnapshotDraft, setVmSnapshotDraft] = useState("");
  const [companyModel, setCompanyModel] = useState<CompanyModel | null>(null);
  const [workload, setWorkload] = useState<ProjectWorkloadSummary[]>([]);
  const [reconWarnings, setReconWarnings] = useState<ReconciliationWarning[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDepartmentId, setNewProjectDepartmentId] = useState("dept-products");
  const [newProjectGithub, setNewProjectGithub] = useState("");
  const [newProjectGoal, setNewProjectGoal] = useState("");
  const [bindingPlatform, setBindingPlatform] = useState<"slack" | "discord">("slack");
  const [bindingProjectId, setBindingProjectId] = useState("");
  const [bindingExternalChannelId, setBindingExternalChannelId] = useState("");
  const [bindingAgentIdOverride, setBindingAgentIdOverride] = useState("");

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.agentId === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );
  const departments = useMemo<DepartmentModel[]>(() => companyModel?.departments ?? [], [companyModel]);
  const projects = useMemo(() => companyModel?.projects ?? [], [companyModel]);
  const skillsByScope = useMemo(
    () => ({
      shared: skills.filter((skill) => skill.scope === "shared"),
      agent: skills.filter((skill) => skill.scope === "agent"),
    }),
    [skills],
  );
  const workloadByProject = useMemo(
    () => new Map(workload.map((summary) => [summary.projectId, summary])),
    [workload],
  );

  useEffect(() => {
    const onOpenChat = (event: Event): void => {
      const custom = event as CustomEvent<{ agentId?: string }>;
      const agentId = custom.detail?.agentId;
      setActiveTab("operations");
      if (agentId) {
        setSelectedAgentId(agentId);
      }
    };

    window.addEventListener("office:open-chat", onOpenChat);
    return () => window.removeEventListener("office:open-chat", onOpenChat);
  }, []);

  async function refreshAgentsMemorySkills(): Promise<void> {
    try {
      const unified = await adapter.getUnifiedOfficeModel();
      const nextAgents =
        unified.configuredAgents.length > 0
          ? unified.configuredAgents
          : unified.runtimeAgents.length > 0
            ? unified.runtimeAgents
            : fallbackAgents;
      setAgents(nextAgents);
      setMemory(unified.memory);
      setSkills(unified.skills);
      setCompanyModel(unified.company);
      setWorkload(unified.workload);
      setReconWarnings(unified.warnings);
      if (!bindingProjectId && unified.company.projects.length > 0) {
        setBindingProjectId(unified.company.projects[0].id);
      }
      if (!selectedAgentId && nextAgents.length > 0) {
        setSelectedAgentId(nextAgents[0].agentId);
      }
      setErrorText("");
    } catch (error) {
      setAgents(fallbackAgents);
      setMemory([]);
      setSkills([]);
      setErrorText(error instanceof Error ? error.message : "openclaw_adapter_unavailable");
    }
  }

  async function refreshConfig(): Promise<void> {
    try {
      const snapshot = await adapter.getConfigSnapshot();
      setConfigDraftText(JSON.stringify(snapshot.config ?? {}, null, 2));
      setConfigStatusText(snapshot.stateVersion != null ? `stateVersion=${snapshot.stateVersion}` : "config loaded");
    } catch (error) {
      setConfigStatusText(error instanceof Error ? error.message : "config_load_failed");
      setConfigDraftText("{}");
    }
  }

  async function refreshSessions(agentId: string): Promise<void> {
    if (!agentId) return;
    try {
      const nextSessions = await adapter.listSessions(agentId);
      setSessions(nextSessions);
      if (!selectedSessionKey && nextSessions.length > 0) {
        setSelectedSessionKey(nextSessions[0].sessionKey);
      }
    } catch (error) {
      setSessions([]);
      setTimeline(null);
      setErrorText(error instanceof Error ? error.message : "sessions_load_failed");
    }
  }

  async function refreshTimeline(agentId: string, sessionKey: string): Promise<void> {
    if (!agentId || !sessionKey) return;
    try {
      setTimeline(await adapter.getSessionTimeline(agentId, sessionKey));
    } catch (error) {
      setTimeline(null);
      setErrorText(error instanceof Error ? error.message : "timeline_load_failed");
    }
  }

  async function sendMessage(): Promise<void> {
    const trimmed = messageDraft.trim();
    if (!selectedAgentId || !selectedSessionKey || !trimmed) return;
    setIsBusy(true);
    setStatusText("");
    try {
      const result = await adapter.sendMessage({
        agentId: selectedAgentId,
        sessionKey: selectedSessionKey,
        message: trimmed,
      });
      if (!result.ok) {
        setStatusText(result.error ?? "message_send_failed");
      } else {
        setStatusText(`Message sent${result.eventId ? ` (${result.eventId})` : ""}.`);
        setMessageDraft("");
        await refreshTimeline(selectedAgentId, selectedSessionKey);
      }
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "message_send_failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function createProject(): Promise<void> {
    const name = newProjectName.trim();
    if (!name || !newProjectDepartmentId) {
      setStatusText("project_name_and_department_required");
      return;
    }
    const result = await adapter.createProject({
      departmentId: newProjectDepartmentId,
      projectName: name,
      githubUrl: newProjectGithub,
      goal: newProjectGoal,
    });
    if (!result.ok) {
      setStatusText(result.error ?? "project_create_failed");
      return;
    }
    setStatusText("project_created");
    setNewProjectName("");
    setNewProjectGithub("");
    setNewProjectGoal("");
    await refreshAgentsMemorySkills();
  }

  async function saveChannelBinding(): Promise<void> {
    if (!bindingProjectId || !bindingExternalChannelId.trim()) {
      setStatusText("binding_project_and_external_channel_required");
      return;
    }
    const payload: ChannelBindingModel = {
      platform: bindingPlatform,
      externalChannelId: bindingExternalChannelId.trim(),
      projectId: bindingProjectId,
      agentRole: "pm",
      routingMode: bindingAgentIdOverride.trim() ? "override_agent" : "default_pm",
      agentIdOverride: bindingAgentIdOverride.trim() || undefined,
    };
    const result = await adapter.upsertChannelBinding(payload);
    if (!result.ok) {
      setStatusText(result.error ?? "binding_save_failed");
      return;
    }
    setStatusText("binding_saved");
    setBindingExternalChannelId("");
    setBindingAgentIdOverride("");
    await refreshAgentsMemorySkills();
  }

  useEffect(() => {
    void refreshAgentsMemorySkills();
    void refreshConfig();
    const timer = setInterval(() => {
      void refreshAgentsMemorySkills();
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedAgentId) return;
    void refreshSessions(selectedAgentId);
  }, [selectedAgentId]);

  useEffect(() => {
    if (!selectedAgentId || !selectedSessionKey) return;
    void refreshTimeline(selectedAgentId, selectedSessionKey);
  }, [selectedAgentId, selectedSessionKey]);

  useEffect(() => {
    const config = safeParseJson(configDraftText);
    if (!config || !selectedAgentId) return;
    const agentsCfg = (config.agents as Record<string, unknown> | undefined) ?? {};
    const list = Array.isArray(agentsCfg.list) ? (agentsCfg.list as Array<Record<string, unknown>>) : [];
    const row = list.find((entry) => String(entry.id ?? "") === selectedAgentId);
    if (row) {
      setAgentModelDraft(typeof row.model === "string" ? row.model : "");
      const sandbox = (row.sandbox as Record<string, unknown> | undefined) ?? {};
      setSandboxModeDraft(typeof sandbox.mode === "string" ? sandbox.mode : "off");
      const tools = (row.tools as Record<string, unknown> | undefined) ?? {};
      setToolsAllowDraft(Array.isArray(tools.allow) ? (tools.allow as string[]).join(", ") : "");
      setToolsDenyDraft(Array.isArray(tools.deny) ? (tools.deny as string[]).join(", ") : "");
    }
    const projectDefaults = (config.projectDefaults as Record<string, unknown> | undefined) ?? {};
    setVmSnapshotDraft(typeof projectDefaults.vmSnapshotId === "string" ? projectDefaults.vmSnapshotId : "");
  }, [configDraftText, selectedAgentId]);

  function patchConfigDraft(): void {
    const config = safeParseJson(configDraftText);
    if (!config || !selectedAgentId) {
      setConfigStatusText("invalid_config_json_or_agent");
      return;
    }
    const next = structuredClone(config);
    const agentsCfg = (next.agents as Record<string, unknown> | undefined) ?? {};
    const list = Array.isArray(agentsCfg.list) ? (agentsCfg.list as Array<Record<string, unknown>>) : [];
    const rowIndex = list.findIndex((entry) => String(entry.id ?? "") === selectedAgentId);
    if (rowIndex >= 0) {
      const row = list[rowIndex];
      row.model = agentModelDraft.trim() || undefined;
      row.sandbox = {
        ...((row.sandbox as Record<string, unknown> | undefined) ?? {}),
        mode: sandboxModeDraft.trim() || "off",
      };
      row.tools = {
        ...((row.tools as Record<string, unknown> | undefined) ?? {}),
        allow: toolsAllowDraft.split(",").map((item) => item.trim()).filter(Boolean),
        deny: toolsDenyDraft.split(",").map((item) => item.trim()).filter(Boolean),
      };
      list[rowIndex] = row;
      agentsCfg.list = list;
      next.agents = agentsCfg;
    }

    next.projectDefaults = {
      ...((next.projectDefaults as Record<string, unknown> | undefined) ?? {}),
      vmSnapshotId: vmSnapshotDraft.trim(),
    };

    const plugins = ((next.plugins as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
    const entries = ((plugins.entries as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
    if (companyModel?.heartbeatRuntime) {
      const heartbeatPlugin =
        ((entries[companyModel.heartbeatRuntime.pluginId] as Record<string, unknown> | undefined) ??
          {}) as Record<string, unknown>;
      heartbeatPlugin.enabled = companyModel.heartbeatRuntime.enabled;
      heartbeatPlugin.config = {
        ...((heartbeatPlugin.config as Record<string, unknown> | undefined) ?? {}),
        serviceId: companyModel.heartbeatRuntime.serviceId,
        cadenceMinutes: companyModel.heartbeatRuntime.cadenceMinutes,
      };
      entries[companyModel.heartbeatRuntime.pluginId] = heartbeatPlugin;
    }
    plugins.entries = entries;
    next.plugins = plugins;

    setConfigDraftText(JSON.stringify(next, null, 2));
    setConfigStatusText("draft patched");
  }

  async function previewConfig(): Promise<void> {
    const config = safeParseJson(configDraftText);
    if (!config) {
      setConfigStatusText("invalid_config_json");
      return;
    }
    setConfigBusy(true);
    try {
      const preview = await adapter.previewConfig(config);
      setConfigPreviewText(preview.diffText ?? preview.summary);
      setConfigStatusText(preview.summary);
    } catch (error) {
      setConfigStatusText(error instanceof Error ? error.message : "preview_failed");
    } finally {
      setConfigBusy(false);
    }
  }

  async function applyConfig(): Promise<void> {
    const config = safeParseJson(configDraftText);
    if (!config) {
      setConfigStatusText("invalid_config_json");
      return;
    }
    if (!confirmConfigWrite) {
      setConfigStatusText("confirm_writes_required");
      return;
    }
    setConfigBusy(true);
    try {
      const result = await adapter.applyConfig(config, true);
      setConfigStatusText(result.ok ? "config applied" : result.error ?? "config_apply_failed");
      if (result.ok) {
        await refreshAgentsMemorySkills();
        await refreshConfig();
      }
    } catch (error) {
      setConfigStatusText(error instanceof Error ? error.message : "config_apply_failed");
    } finally {
      setConfigBusy(false);
    }
  }

  async function rollbackConfig(): Promise<void> {
    setConfigBusy(true);
    try {
      const result = await adapter.rollbackConfig();
      setConfigStatusText(result.ok ? "config rollback complete" : result.error ?? "rollback_failed");
      if (result.ok) {
        await refreshAgentsMemorySkills();
        await refreshConfig();
      }
    } catch (error) {
      setConfigStatusText(error instanceof Error ? error.message : "rollback_failed");
    } finally {
      setConfigBusy(false);
    }
  }

  return (
    <main className="app">
      <header className="panel topbar">
        <div>
          <p className="eyebrow">Shell Company</p>
          <h1>OpenClaw Office Control Center</h1>
          <p className="eyebrow">Gateway: {gatewayBase}</p>
        </div>
        <div className="controls">
          <button onClick={() => void refreshAgentsMemorySkills()}>Refresh</button>
        </div>
      </header>

      <AppTabNav activeTab={activeTab} onSelect={setActiveTab} />
      {errorText ? <p className="panel eyebrow">{errorText}</p> : null}
      <ReconciliationWarnings warnings={reconWarnings} />

      {activeTab === "operations" ? (
        <OperationsSection
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
          selectedAgent={selectedAgent}
          sessions={sessions}
          selectedSessionKey={selectedSessionKey}
          onSelectSession={setSelectedSessionKey}
          timeline={timeline}
          messageDraft={messageDraft}
          onChangeMessageDraft={setMessageDraft}
          onSendMessage={() => void sendMessage()}
          isBusy={isBusy}
          statusText={statusText}
        />
      ) : null}

      {activeTab === "memory" ? <MemorySection memory={memory} /> : null}
      {activeTab === "skills" ? <SkillsSection skills={skills} skillsByScope={skillsByScope} /> : null}
      {activeTab === "office" ? (
        <OfficeSection
          departments={departments}
          projects={projects}
          companyModel={companyModel}
          workloadByProject={workloadByProject}
          newProjectDepartmentId={newProjectDepartmentId}
          onChangeNewProjectDepartmentId={setNewProjectDepartmentId}
          newProjectName={newProjectName}
          onChangeNewProjectName={setNewProjectName}
          newProjectGithub={newProjectGithub}
          onChangeNewProjectGithub={setNewProjectGithub}
          newProjectGoal={newProjectGoal}
          onChangeNewProjectGoal={setNewProjectGoal}
          onCreateProject={() => void createProject()}
          bindingPlatform={bindingPlatform}
          onChangeBindingPlatform={setBindingPlatform}
          bindingProjectId={bindingProjectId}
          onChangeBindingProjectId={setBindingProjectId}
          bindingExternalChannelId={bindingExternalChannelId}
          onChangeBindingExternalChannelId={setBindingExternalChannelId}
          bindingAgentIdOverride={bindingAgentIdOverride}
          onChangeBindingAgentIdOverride={setBindingAgentIdOverride}
          onSaveChannelBinding={() => void saveChannelBinding()}
          selectedAgentId={selectedAgentId}
          onSelectAgentId={setSelectedAgentId}
          agents={agents}
          agentModelDraft={agentModelDraft}
          onChangeAgentModelDraft={setAgentModelDraft}
          sandboxModeDraft={sandboxModeDraft}
          onChangeSandboxModeDraft={setSandboxModeDraft}
          toolsAllowDraft={toolsAllowDraft}
          onChangeToolsAllowDraft={setToolsAllowDraft}
          toolsDenyDraft={toolsDenyDraft}
          onChangeToolsDenyDraft={setToolsDenyDraft}
          vmSnapshotDraft={vmSnapshotDraft}
          onChangeVmSnapshotDraft={setVmSnapshotDraft}
          onPatchConfigDraft={patchConfigDraft}
          onRefreshConfig={() => void refreshConfig()}
          configBusy={configBusy}
          confirmConfigWrite={confirmConfigWrite}
          onChangeConfirmConfigWrite={setConfirmConfigWrite}
          onPreviewConfig={() => void previewConfig()}
          onApplyConfig={() => void applyConfig()}
          onRollbackConfig={() => void rollbackConfig()}
          configStatusText={configStatusText}
          configDraftText={configDraftText}
          onChangeConfigDraftText={setConfigDraftText}
          configPreviewText={configPreviewText}
        />
      ) : null}
    </main>
  );
}

export type { AppProps };
export type { UiTab } from "./types";
