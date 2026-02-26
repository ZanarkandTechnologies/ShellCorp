import { useEffect, useMemo, useState } from "react";

import OfficeSimulation from "@/components/office-simulation";
import { gatewayBase, stateBase } from "@/lib/gateway-config";
import { OpenClawAdapter } from "@/lib/openclaw-adapter";
import type {
  AgentCardModel,
  CompanyModel,
  DepartmentModel,
  MemoryItemModel,
  ChannelBindingModel,
  ProjectWorkloadSummary,
  ReconciliationWarning,
  SessionRowModel,
  SessionTimelineModel,
  SkillItemModel,
} from "@/lib/openclaw-types";
import { OfficeDataProvider } from "@/providers/office-data-provider";

type UiTab = "operations" | "memory" | "skills" | "office";
type AppProps = {
  initialTab?: UiTab;
};

function fmtTs(ts?: number): string {
  if (!ts) return "n/a";
  return new Date(ts).toLocaleString();
}

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
  const adapter = useMemo(() => new OpenClawAdapter(gatewayBase, stateBase), []);
  const [activeTab, setActiveTab] = useState<UiTab>(initialTab);
  const [agents, setAgents] = useState<AgentCardModel[]>([]);
  const [sessions, setSessions] = useState<SessionRowModel[]>([]);
  const [timeline, setTimeline] = useState<SessionTimelineModel | null>(null);
  const [memory, setMemory] = useState<MemoryItemModel[]>([]);
  const [skills, setSkills] = useState<SkillItemModel[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedSessionKey, setSelectedSessionKey] = useState<string>("");
  const [messageDraft, setMessageDraft] = useState<string>("");
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("");
  const [errorText, setErrorText] = useState<string>("");
  const [configDraftText, setConfigDraftText] = useState<string>("{}");
  const [configPreviewText, setConfigPreviewText] = useState<string>("");
  const [configStatusText, setConfigStatusText] = useState<string>("");
  const [configBusy, setConfigBusy] = useState<boolean>(false);
  const [confirmConfigWrite, setConfirmConfigWrite] = useState<boolean>(false);
  const [agentModelDraft, setAgentModelDraft] = useState<string>("");
  const [sandboxModeDraft, setSandboxModeDraft] = useState<string>("off");
  const [toolsAllowDraft, setToolsAllowDraft] = useState<string>("");
  const [toolsDenyDraft, setToolsDenyDraft] = useState<string>("");
  const [vmSnapshotDraft, setVmSnapshotDraft] = useState<string>("");
  const [notionPluginAccountDraft, setNotionPluginAccountDraft] = useState<string>("default");
  const [notionApiKeyDraft, setNotionApiKeyDraft] = useState<string>("");
  const [companyModel, setCompanyModel] = useState<CompanyModel | null>(null);
  const [workload, setWorkload] = useState<ProjectWorkloadSummary[]>([]);
  const [reconWarnings, setReconWarnings] = useState<ReconciliationWarning[]>([]);
  const [newProjectName, setNewProjectName] = useState<string>("");
  const [newProjectDepartmentId, setNewProjectDepartmentId] = useState<string>("dept-products");
  const [newProjectGithub, setNewProjectGithub] = useState<string>("");
  const [newProjectGoal, setNewProjectGoal] = useState<string>("");
  const [bindingPlatform, setBindingPlatform] = useState<"slack" | "discord">("slack");
  const [bindingProjectId, setBindingProjectId] = useState<string>("");
  const [bindingExternalChannelId, setBindingExternalChannelId] = useState<string>("");
  const [bindingAgentIdOverride, setBindingAgentIdOverride] = useState<string>("");

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
      const nextAgents = unified.configuredAgents.length > 0
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
      const nextTimeline = await adapter.getSessionTimeline(agentId, sessionKey);
      setTimeline(nextTimeline);
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
    const plugins = (config.plugins as Record<string, unknown> | undefined) ?? {};
    const entries = (plugins.entries as Record<string, unknown> | undefined) ?? {};
    const notionShell = (entries["notion-shell"] as Record<string, unknown> | undefined) ?? {};
    const pluginCfg = (notionShell.config as Record<string, unknown> | undefined) ?? {};
    setNotionPluginAccountDraft(typeof pluginCfg.defaultAccountId === "string" ? pluginCfg.defaultAccountId : "default");
    const channels = (config.channels as Record<string, unknown> | undefined) ?? {};
    const notion = (channels.notion as Record<string, unknown> | undefined) ?? {};
    const accounts = (notion.accounts as Record<string, unknown> | undefined) ?? {};
    const notionDefault = (accounts.default as Record<string, unknown> | undefined) ?? {};
    setNotionApiKeyDraft(typeof notionDefault.apiKey === "string" ? notionDefault.apiKey : "");
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
        allow: toolsAllowDraft
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        deny: toolsDenyDraft
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
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
    const notionShell = ((entries["notion-shell"] as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
    notionShell.enabled = true;
    notionShell.config = {
      ...((notionShell.config as Record<string, unknown> | undefined) ?? {}),
      defaultAccountId: notionPluginAccountDraft.trim() || "default",
    };
    entries["notion-shell"] = notionShell;
    if (companyModel?.heartbeatRuntime) {
      const heartbeatPlugin = ((entries[companyModel.heartbeatRuntime.pluginId] as Record<string, unknown> | undefined) ?? {}) as Record<
        string,
        unknown
      >;
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

    const channels = ((next.channels as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
    const notion = ((channels.notion as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
    const accounts = ((notion.accounts as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
    const notionDefault = ((accounts.default as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
    notionDefault.apiKey = notionApiKeyDraft;
    accounts.default = notionDefault;
    notion.accounts = accounts;
    channels.notion = notion;
    next.channels = channels;

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

      <section className="panel tabsPanel">
        <div className="tabs">
          <button className={activeTab === "operations" ? "active" : ""} onClick={() => setActiveTab("operations")}>
            Operations
          </button>
          <button className={activeTab === "memory" ? "active" : ""} onClick={() => setActiveTab("memory")}>
            Memory
          </button>
          <button className={activeTab === "skills" ? "active" : ""} onClick={() => setActiveTab("skills")}>
            Skills
          </button>
          <button className={activeTab === "office" ? "active" : ""} onClick={() => setActiveTab("office")}>
            Office
          </button>
        </div>
      </section>

      {errorText ? <p className="panel eyebrow">{errorText}</p> : null}
      {reconWarnings.length > 0 ? (
        <section className="panel">
          <h3>Reconciliation Warnings</h3>
          <ul className="memorySearchResults">
            {reconWarnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>
                {warning.code}: {warning.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activeTab === "operations" ? (
        <section className="panel">
          <h2>Agent Sessions</h2>
          <div className="controls">
            <select value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)}>
              {agents.map((agent) => (
                <option key={agent.agentId} value={agent.agentId}>
                  {agent.displayName} ({agent.agentId})
                </option>
              ))}
            </select>
            <select value={selectedSessionKey} onChange={(event) => setSelectedSessionKey(event.target.value)}>
              <option value="">select session</option>
              {sessions.map((session) => (
                <option key={session.sessionKey} value={session.sessionKey}>
                  {session.sessionKey}
                </option>
              ))}
            </select>
          </div>

          {selectedAgent ? (
            <article className="panel">
              <h3>Agent Card</h3>
              <p className="eyebrow">
                {selectedAgent.displayName} | sandbox: {selectedAgent.sandboxMode} | sessions: {selectedAgent.sessionCount}
              </p>
              <p className="eyebrow">workspace: {selectedAgent.workspacePath || "n/a"}</p>
              <p className="eyebrow">agentDir: {selectedAgent.agentDir || "n/a"}</p>
            </article>
          ) : null}

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Session Key</th>
                  <th>Session ID</th>
                  <th>Channel</th>
                  <th>Peer</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.sessionKey}>
                    <td>{session.sessionKey}</td>
                    <td>{session.sessionId ?? "n/a"}</td>
                    <td>{session.channel ?? "n/a"}</td>
                    <td>{session.peerLabel ?? "n/a"}</td>
                    <td>{fmtTs(session.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <article className="panel">
            <h3>Session Timeline</h3>
            <ul className="memorySearchResults">
              {(timeline?.events ?? []).map((event, index) => (
                <li key={`${event.ts}-${index}`}>
                  {fmtTs(event.ts)} | {event.type} | {event.role} | {event.text}
                </li>
              ))}
              {(timeline?.events?.length ?? 0) === 0 ? <li>No timeline events yet.</li> : null}
            </ul>
          </article>

          <article className="panel">
            <h3>Chat Bridge</h3>
            <div className="controls">
              <textarea
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="Send message to selected session..."
                rows={4}
              />
            </div>
            <div className="controls">
              <button disabled={isBusy || !selectedAgentId || !selectedSessionKey || !messageDraft.trim()} onClick={() => void sendMessage()}>
                {isBusy ? "Sending..." : "Send"}
              </button>
            </div>
            {statusText ? <p className="eyebrow">{statusText}</p> : null}
          </article>
        </section>
      ) : null}

      {activeTab === "memory" ? (
        <section className="panel">
          <h2>Agent Memory</h2>
          <div className="memoryStatsGrid">
            <article className="panel statCard">
              <p>Total Entries</p>
              <h3>{memory.length}</h3>
            </article>
            <article className="panel statCard">
              <p>Critical</p>
              <h3>{memory.filter((entry) => entry.level === "critical").length}</h3>
            </article>
            <article className="panel statCard">
              <p>Warning</p>
              <h3>{memory.filter((entry) => entry.level === "warning").length}</h3>
            </article>
          </div>
          <ul className="memorySearchResults">
            {memory.map((entry) => (
              <li key={entry.id}>
                {fmtTs(entry.ts)} | {entry.agentId} | {entry.level} | {entry.summary}
              </li>
            ))}
            {memory.length === 0 ? <li>No memory entries loaded.</li> : null}
          </ul>
        </section>
      ) : null}

      {activeTab === "skills" ? (
        <section className="panel">
          <h2>Skills</h2>
          <div className="memoryStatsGrid">
            <article className="panel statCard">
              <p>All Skills</p>
              <h3>{skills.length}</h3>
            </article>
            <article className="panel statCard">
              <p>Shared</p>
              <h3>{skillsByScope.shared.length}</h3>
            </article>
            <article className="panel statCard">
              <p>Per-Agent</p>
              <h3>{skillsByScope.agent.length}</h3>
            </article>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Scope</th>
                  <th>Source</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {skills.map((skill) => (
                  <tr key={`${skill.scope}-${skill.name}-${skill.sourcePath}`}>
                    <td>{skill.name}</td>
                    <td>{skill.category}</td>
                    <td>{skill.scope}</td>
                    <td className="content">{skill.sourcePath || "n/a"}</td>
                    <td>{fmtTs(skill.updatedAt)}</td>
                  </tr>
                ))}
                {skills.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No skills loaded.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === "office" ? (
        <section className="panel">
          <h2>Gamified Office</h2>
          <p className="eyebrow">Visualization and game logic remain the core product surface.</p>
          <article className="panel">
            <h3>Company Topology (Sidecar Model)</h3>
            <p className="eyebrow">
              OpenClaw runtime keeps active agents only. Sidecar model keeps project/team metadata, role slots, heartbeat profiles, and channel routing.
            </p>
            <div className="memoryStatsGrid">
              <article className="panel statCard">
                <p>Departments</p>
                <h3>{departments.length}</h3>
              </article>
              <article className="panel statCard">
                <p>Projects</p>
                <h3>{projects.length}</h3>
              </article>
              <article className="panel statCard">
                <p>Role Slots</p>
                <h3>{companyModel?.roleSlots.length ?? 0}</h3>
              </article>
              <article className="panel statCard">
                <p>Channel Bindings</p>
                <h3>{companyModel?.channelBindings.length ?? 0}</h3>
              </article>
            </div>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Goal</th>
                    <th>GitHub</th>
                    <th>Open</th>
                    <th>Closed</th>
                    <th>Queue Pressure</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => {
                    const summary = workload.find((item) => item.projectId === project.id);
                    return (
                      <tr key={project.id}>
                        <td>{project.name}</td>
                        <td className="content">{project.goal}</td>
                        <td className="content">{project.githubUrl || "n/a"}</td>
                        <td>{summary?.openTickets ?? 0}</td>
                        <td>{summary?.closedTickets ?? 0}</td>
                        <td>{summary?.queuePressure ?? "low"}</td>
                      </tr>
                    );
                  })}
                  {projects.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No projects yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="controls">
              <select value={newProjectDepartmentId} onChange={(event) => setNewProjectDepartmentId(event.target.value)}>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
                {departments.length === 0 ? <option value="dept-products">Product Studio</option> : null}
              </select>
              <input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="new project name"
              />
              <input value={newProjectGithub} onChange={(event) => setNewProjectGithub(event.target.value)} placeholder="github url" />
              <input value={newProjectGoal} onChange={(event) => setNewProjectGoal(event.target.value)} placeholder="project goal" />
              <button onClick={() => void createProject()}>Create Project (+ builder/growth/pm slots)</button>
            </div>
          </article>
          <div className="officeShell">
            <OfficeDataProvider>
              <OfficeSimulation />
            </OfficeDataProvider>
          </div>
          <article className="panel">
            <h3>Customer Channel Routing (PM Default)</h3>
            <p className="eyebrow">Bind Slack/Discord customer channels to project PM agents with CEO fallback.</p>
            <div className="controls">
              <select value={bindingPlatform} onChange={(event) => setBindingPlatform(event.target.value as "slack" | "discord")}>
                <option value="slack">slack</option>
                <option value="discord">discord</option>
              </select>
              <select value={bindingProjectId} onChange={(event) => setBindingProjectId(event.target.value)}>
                <option value="">select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <input
                value={bindingExternalChannelId}
                onChange={(event) => setBindingExternalChannelId(event.target.value)}
                placeholder="external channel id"
              />
              <input
                value={bindingAgentIdOverride}
                onChange={(event) => setBindingAgentIdOverride(event.target.value)}
                placeholder="optional agent override"
              />
              <button onClick={() => void saveChannelBinding()}>Save Channel Binding</button>
            </div>
            <ul className="memorySearchResults">
              {(companyModel?.channelBindings ?? []).map((binding) => (
                <li key={`${binding.platform}-${binding.externalChannelId}`}>
                  {binding.platform}:{binding.externalChannelId} {"->"} {binding.projectId} ({binding.agentIdOverride ?? binding.agentRole})
                </li>
              ))}
              {(companyModel?.channelBindings.length ?? 0) === 0 ? <li>No channel bindings configured.</li> : null}
            </ul>
          </article>
          <article className="panel">
            <h3>Heartbeat Runtime</h3>
            <p className="eyebrow">
              {companyModel?.heartbeatRuntime.enabled ? "enabled" : "disabled"} via plugin {companyModel?.heartbeatRuntime.pluginId ?? "n/a"} / service{" "}
              {companyModel?.heartbeatRuntime.serviceId ?? "n/a"} / cadence {companyModel?.heartbeatRuntime.cadenceMinutes ?? 0} min.
            </p>
            <p className="eyebrow">{companyModel?.heartbeatRuntime.notes ?? ""}</p>
          </article>
          <article className="panel">
            <h3>Control Deck (OpenClaw Config)</h3>
            <p className="eyebrow">
              Configure agents, tool policy, sandbox mode, VM snapshot defaults, and Notion plugin settings from the office UI.
            </p>
            <div className="controls">
              <select value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)}>
                {agents.map((agent) => (
                  <option key={agent.agentId} value={agent.agentId}>
                    {agent.displayName} ({agent.agentId})
                  </option>
                ))}
              </select>
              <input value={agentModelDraft} onChange={(event) => setAgentModelDraft(event.target.value)} placeholder="agent model (e.g. anthropic/claude-sonnet-4-5)" />
              <input value={sandboxModeDraft} onChange={(event) => setSandboxModeDraft(event.target.value)} placeholder="sandbox mode (off|all|...)" />
              <input value={toolsAllowDraft} onChange={(event) => setToolsAllowDraft(event.target.value)} placeholder="tools allow (comma-separated)" />
              <input value={toolsDenyDraft} onChange={(event) => setToolsDenyDraft(event.target.value)} placeholder="tools deny (comma-separated)" />
              <input value={vmSnapshotDraft} onChange={(event) => setVmSnapshotDraft(event.target.value)} placeholder="project vmSnapshotId default" />
              <input value={notionPluginAccountDraft} onChange={(event) => setNotionPluginAccountDraft(event.target.value)} placeholder="notion-shell defaultAccountId" />
              <input value={notionApiKeyDraft} onChange={(event) => setNotionApiKeyDraft(event.target.value)} placeholder="channels.notion.accounts.default.apiKey" />
            </div>
            <div className="controls">
              <button onClick={patchConfigDraft}>Patch Draft From Controls</button>
              <button onClick={() => void refreshConfig()}>Load Live Config</button>
              <button disabled={configBusy} onClick={() => void previewConfig()}>
                {configBusy ? "Working..." : "Preview Changes"}
              </button>
              <label className="eyebrow">
                <input type="checkbox" checked={confirmConfigWrite} onChange={(event) => setConfirmConfigWrite(event.target.checked)} />
                confirm config write
              </label>
              <button disabled={configBusy} onClick={() => void applyConfig()}>
                Apply Config
              </button>
              <button disabled={configBusy} onClick={() => void rollbackConfig()}>
                Rollback
              </button>
            </div>
            {configStatusText ? <p className="eyebrow">{configStatusText}</p> : null}
            <div className="configGrid">
              <label>
                Config Draft (JSON)
                <textarea rows={12} value={configDraftText} onChange={(event) => setConfigDraftText(event.target.value)} />
              </label>
              <label>
                Preview / Diff
                <textarea rows={12} readOnly value={configPreviewText || "No preview yet."} />
              </label>
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}
