import OfficeSimulation from "@/components/office-simulation";
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
import { formatTimestamp as fmtTs } from "@/lib/format-utils";
import { OfficeDataProvider } from "@/providers/office-data-provider";

type ReconciliationWarningsProps = {
  warnings: ReconciliationWarning[];
};

export function ReconciliationWarnings({
  warnings,
}: ReconciliationWarningsProps): JSX.Element | null {
  if (warnings.length === 0) return null;
  return (
    <section className="panel">
      <h3>Reconciliation Warnings</h3>
      <ul className="memorySearchResults">
        {warnings.map((warning, index) => (
          <li key={`${warning.code}-${index}`}>
            {warning.code}: {warning.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

type OperationsSectionProps = {
  agents: AgentCardModel[];
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  selectedAgent: AgentCardModel | null;
  sessions: SessionRowModel[];
  selectedSessionKey: string;
  onSelectSession: (sessionKey: string) => void;
  timeline: SessionTimelineModel | null;
  messageDraft: string;
  onChangeMessageDraft: (value: string) => void;
  onSendMessage: () => void;
  isBusy: boolean;
  statusText: string;
};

export function OperationsSection({
  agents,
  selectedAgentId,
  onSelectAgent,
  selectedAgent,
  sessions,
  selectedSessionKey,
  onSelectSession,
  timeline,
  messageDraft,
  onChangeMessageDraft,
  onSendMessage,
  isBusy,
  statusText,
}: OperationsSectionProps): JSX.Element {
  return (
    <section className="panel">
      <h2>Agent Sessions</h2>

      <article className="panel">
        <h3>Agent Roster</h3>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Sandbox</th>
                <th>Sessions</th>
                <th>Workspace</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr
                  key={agent.agentId}
                  className={agent.agentId === selectedAgentId ? "active" : ""}
                  onClick={() => onSelectAgent(agent.agentId)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    {agent.displayName} <span className="eyebrow">({agent.agentId})</span>
                  </td>
                  <td>{agent.sandboxMode}</td>
                  <td>{agent.sessionCount}</td>
                  <td className="content">{agent.workspacePath || "n/a"}</td>
                </tr>
              ))}
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={4}>No agents loaded.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      <div className="controls">
        <select value={selectedAgentId} onChange={(event) => onSelectAgent(event.target.value)}>
          {agents.map((agent) => (
            <option key={agent.agentId} value={agent.agentId}>
              {agent.displayName} ({agent.agentId})
            </option>
          ))}
        </select>
        <select value={selectedSessionKey} onChange={(event) => onSelectSession(event.target.value)}>
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
            {selectedAgent.displayName} | sandbox: {selectedAgent.sandboxMode} | sessions:{" "}
            {selectedAgent.sessionCount}
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
            onChange={(event) => onChangeMessageDraft(event.target.value)}
            placeholder="Send message to selected session..."
            rows={4}
          />
        </div>
        <div className="controls">
          <button
            disabled={isBusy || !selectedAgentId || !selectedSessionKey || !messageDraft.trim()}
            onClick={onSendMessage}
          >
            {isBusy ? "Sending..." : "Send"}
          </button>
        </div>
        {statusText ? <p className="eyebrow">{statusText}</p> : null}
      </article>
    </section>
  );
}

type MemorySectionProps = {
  memory: MemoryItemModel[];
};

export function MemorySection({ memory }: MemorySectionProps): JSX.Element {
  const criticalCount = memory.filter((entry) => entry.level === "critical").length;
  const warningCount = memory.filter((entry) => entry.level === "warning").length;

  return (
    <section className="panel">
      <h2>Agent Memory</h2>
      <div className="memoryStatsGrid">
        <article className="panel statCard">
          <p>Total Entries</p>
          <h3>{memory.length}</h3>
        </article>
        <article className="panel statCard">
          <p>Critical</p>
          <h3>{criticalCount}</h3>
        </article>
        <article className="panel statCard">
          <p>Warning</p>
          <h3>{warningCount}</h3>
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
  );
}

type SkillsSectionProps = {
  skills: SkillItemModel[];
  skillsByScope: {
    shared: SkillItemModel[];
    agent: SkillItemModel[];
  };
};

export function SkillsSection({
  skills,
  skillsByScope,
}: SkillsSectionProps): JSX.Element {
  return (
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
  );
}

type OfficeSectionProps = {
  departments: DepartmentModel[];
  projects: CompanyModel["projects"];
  companyModel: CompanyModel | null;
  workloadByProject: ReadonlyMap<string, ProjectWorkloadSummary>;
  newProjectDepartmentId: string;
  onChangeNewProjectDepartmentId: (value: string) => void;
  newProjectName: string;
  onChangeNewProjectName: (value: string) => void;
  newProjectGithub: string;
  onChangeNewProjectGithub: (value: string) => void;
  newProjectGoal: string;
  onChangeNewProjectGoal: (value: string) => void;
  onCreateProject: () => void;
  bindingPlatform: "slack" | "discord";
  onChangeBindingPlatform: (value: "slack" | "discord") => void;
  bindingProjectId: string;
  onChangeBindingProjectId: (value: string) => void;
  bindingExternalChannelId: string;
  onChangeBindingExternalChannelId: (value: string) => void;
  bindingAgentIdOverride: string;
  onChangeBindingAgentIdOverride: (value: string) => void;
  onSaveChannelBinding: () => void;
  selectedAgentId: string;
  onSelectAgentId: (value: string) => void;
  agents: AgentCardModel[];
  agentModelDraft: string;
  onChangeAgentModelDraft: (value: string) => void;
  sandboxModeDraft: string;
  onChangeSandboxModeDraft: (value: string) => void;
  toolsAllowDraft: string;
  onChangeToolsAllowDraft: (value: string) => void;
  toolsDenyDraft: string;
  onChangeToolsDenyDraft: (value: string) => void;
  vmSnapshotDraft: string;
  onChangeVmSnapshotDraft: (value: string) => void;
  onPatchConfigDraft: () => void;
  onRefreshConfig: () => void;
  configBusy: boolean;
  confirmConfigWrite: boolean;
  onChangeConfirmConfigWrite: (value: boolean) => void;
  onPreviewConfig: () => void;
  onApplyConfig: () => void;
  onRollbackConfig: () => void;
  configStatusText: string;
  configDraftText: string;
  onChangeConfigDraftText: (value: string) => void;
  configPreviewText: string;
};

export function OfficeSection({
  departments,
  projects,
  companyModel,
  workloadByProject,
  newProjectDepartmentId,
  onChangeNewProjectDepartmentId,
  newProjectName,
  onChangeNewProjectName,
  newProjectGithub,
  onChangeNewProjectGithub,
  newProjectGoal,
  onChangeNewProjectGoal,
  onCreateProject,
  bindingPlatform,
  onChangeBindingPlatform,
  bindingProjectId,
  onChangeBindingProjectId,
  bindingExternalChannelId,
  onChangeBindingExternalChannelId,
  bindingAgentIdOverride,
  onChangeBindingAgentIdOverride,
  onSaveChannelBinding,
  selectedAgentId,
  onSelectAgentId,
  agents,
  agentModelDraft,
  onChangeAgentModelDraft,
  sandboxModeDraft,
  onChangeSandboxModeDraft,
  toolsAllowDraft,
  onChangeToolsAllowDraft,
  toolsDenyDraft,
  onChangeToolsDenyDraft,
  vmSnapshotDraft,
  onChangeVmSnapshotDraft,
  onPatchConfigDraft,
  onRefreshConfig,
  configBusy,
  confirmConfigWrite,
  onChangeConfirmConfigWrite,
  onPreviewConfig,
  onApplyConfig,
  onRollbackConfig,
  configStatusText,
  configDraftText,
  onChangeConfigDraftText,
  configPreviewText,
}: OfficeSectionProps): JSX.Element {
  return (
    <section className="panel">
      <h2>Gamified Office</h2>
      <p className="eyebrow">Visualization and game logic remain the core product surface.</p>
      <article className="panel">
        <h3>Company Topology (Sidecar Model)</h3>
        <p className="eyebrow">
          OpenClaw runtime keeps active agents only. Sidecar model keeps project/team metadata,
          role slots, heartbeat profiles, and channel routing.
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
                const summary = workloadByProject.get(project.id);
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
          <select
            value={newProjectDepartmentId}
            onChange={(event) => onChangeNewProjectDepartmentId(event.target.value)}
          >
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
            {departments.length === 0 ? <option value="dept-products">Product Studio</option> : null}
          </select>
          <input
            value={newProjectName}
            onChange={(event) => onChangeNewProjectName(event.target.value)}
            placeholder="new project name"
          />
          <input
            value={newProjectGithub}
            onChange={(event) => onChangeNewProjectGithub(event.target.value)}
            placeholder="github url"
          />
          <input
            value={newProjectGoal}
            onChange={(event) => onChangeNewProjectGoal(event.target.value)}
            placeholder="project goal"
          />
          <button onClick={onCreateProject}>Create Project (+ builder/growth/pm slots)</button>
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
          <select
            value={bindingPlatform}
            onChange={(event) => onChangeBindingPlatform(event.target.value as "slack" | "discord")}
          >
            <option value="slack">slack</option>
            <option value="discord">discord</option>
          </select>
          <select value={bindingProjectId} onChange={(event) => onChangeBindingProjectId(event.target.value)}>
            <option value="">select project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <input
            value={bindingExternalChannelId}
            onChange={(event) => onChangeBindingExternalChannelId(event.target.value)}
            placeholder="external channel id"
          />
          <input
            value={bindingAgentIdOverride}
            onChange={(event) => onChangeBindingAgentIdOverride(event.target.value)}
            placeholder="optional agent override"
          />
          <button onClick={onSaveChannelBinding}>Save Channel Binding</button>
        </div>
        <ul className="memorySearchResults">
          {(companyModel?.channelBindings ?? []).map((binding: ChannelBindingModel) => (
            <li key={`${binding.platform}-${binding.externalChannelId}`}>
              {binding.platform}:{binding.externalChannelId} {"->"} {binding.projectId} (
              {binding.agentIdOverride ?? binding.agentRole})
            </li>
          ))}
          {(companyModel?.channelBindings.length ?? 0) === 0 ? <li>No channel bindings configured.</li> : null}
        </ul>
      </article>

      <article className="panel">
        <h3>Heartbeat Runtime</h3>
        <p className="eyebrow">
          {companyModel?.heartbeatRuntime.enabled ? "enabled" : "disabled"} via plugin{" "}
          {companyModel?.heartbeatRuntime.pluginId ?? "n/a"} / service{" "}
          {companyModel?.heartbeatRuntime.serviceId ?? "n/a"} / cadence{" "}
          {companyModel?.heartbeatRuntime.cadenceMinutes ?? 0} min.
        </p>
        <p className="eyebrow">{companyModel?.heartbeatRuntime.notes ?? ""}</p>
      </article>

      <article className="panel">
        <h3>Control Deck (OpenClaw Config)</h3>
        <p className="eyebrow">
          Configure agents, tool policy, sandbox mode, and VM snapshot defaults from the office UI.
        </p>
        <div className="controls">
          <select value={selectedAgentId} onChange={(event) => onSelectAgentId(event.target.value)}>
            {agents.map((agent) => (
              <option key={agent.agentId} value={agent.agentId}>
                {agent.displayName} ({agent.agentId})
              </option>
            ))}
          </select>
          <input
            value={agentModelDraft}
            onChange={(event) => onChangeAgentModelDraft(event.target.value)}
            placeholder="agent model (e.g. anthropic/claude-sonnet-4-5)"
          />
          <input
            value={sandboxModeDraft}
            onChange={(event) => onChangeSandboxModeDraft(event.target.value)}
            placeholder="sandbox mode (off|all|...)"
          />
          <input
            value={toolsAllowDraft}
            onChange={(event) => onChangeToolsAllowDraft(event.target.value)}
            placeholder="tools allow (comma-separated)"
          />
          <input
            value={toolsDenyDraft}
            onChange={(event) => onChangeToolsDenyDraft(event.target.value)}
            placeholder="tools deny (comma-separated)"
          />
          <input
            value={vmSnapshotDraft}
            onChange={(event) => onChangeVmSnapshotDraft(event.target.value)}
            placeholder="project vmSnapshotId default"
          />
        </div>
        <div className="controls">
          <button onClick={onPatchConfigDraft}>Patch Draft From Controls</button>
          <button onClick={onRefreshConfig}>Load Live Config</button>
          <button disabled={configBusy} onClick={onPreviewConfig}>
            {configBusy ? "Working..." : "Preview Changes"}
          </button>
          <label className="eyebrow">
            <input
              type="checkbox"
              checked={confirmConfigWrite}
              onChange={(event) => onChangeConfirmConfigWrite(event.target.checked)}
            />
            confirm config write
          </label>
          <button disabled={configBusy} onClick={onApplyConfig}>
            Apply Config
          </button>
          <button disabled={configBusy} onClick={onRollbackConfig}>
            Rollback
          </button>
        </div>
        {configStatusText ? <p className="eyebrow">{configStatusText}</p> : null}
        <div className="configGrid">
          <label>
            Config Draft (JSON)
            <textarea rows={12} value={configDraftText} onChange={(event) => onChangeConfigDraftText(event.target.value)} />
          </label>
          <label>
            Preview / Diff
            <textarea rows={12} readOnly value={configPreviewText || "No preview yet."} />
          </label>
        </div>
      </article>
    </section>
  );
}
