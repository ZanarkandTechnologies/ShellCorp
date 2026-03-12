/**
 * OPENCLAW UI TYPES
 * =================
 * Shared contracts for mapping OpenClaw state and gateway surfaces into UI models.
 */

/** Full agent lifecycle state union — MEM-0144 */
export type AgentState =
  | "running"
  | "ok"
  | "no_work"
  | "error"
  | "idle"
  | "planning"
  | "executing"
  | "blocked"
  | "done";

export interface AgentCardModel {
  agentId: string;
  displayName: string;
  workspacePath: string;
  agentDir: string;
  sandboxMode: string;
  toolPolicy: {
    allow: string[];
    deny: string[];
  };
  sessionCount: number;
  lastUpdatedAt?: number;
}

export interface SessionRowModel {
  agentId: string;
  sessionKey: string;
  sessionId?: string;
  updatedAt?: number;
  channel?: string;
  peerLabel?: string;
  origin?: string;
}

export interface SessionTimelineEvent {
  ts: number;
  type: "message" | "tool" | "status";
  role: string;
  text: string;
  source?: "heartbeat" | "ui" | "operator" | "unknown";
  eventId?: string;
  raw?: Record<string, unknown>;
}

export interface SessionTimelineModel {
  agentId: string;
  sessionKey: string;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    contextTokens?: number;
  };
  events: SessionTimelineEvent[];
}

export interface HeartbeatSkillBubble {
  id: string;
  label: string;
  weight: number;
}

export interface HeartbeatWindow {
  beatId: string;
  sessionKey: string;
  startedAt: number;
  endedAt?: number;
  trigger: "scheduled" | "manual" | "unknown";
  status: "running" | "ok" | "no_work" | "error";
  summary: string;
  skillBubbles: HeartbeatSkillBubble[];
  eventCount: number;
}

export interface AgentLiveStatus {
  agentId: string;
  sessionKey?: string;
  state: AgentState;
  statusText: string;
  updatedAt?: number;
  bubbles: HeartbeatSkillBubble[];
  latestHeartbeat?: HeartbeatWindow;
}

export interface SkillItemModel {
  name: string;
  category: string;
  scope: "agent" | "shared";
  sourcePath: string;
  updatedAt?: number;
}

export interface MemoryItemModel {
  id: string;
  agentId: string;
  summary: string;
  level: "info" | "warning" | "critical";
  ts: number;
}

export type AgentMemoryEntryType =
  | "discovery"
  | "decision"
  | "problem"
  | "solution"
  | "pattern"
  | "warning"
  | "success"
  | "refactor"
  | "bugfix"
  | "feature";

export interface AgentMemorySource {
  sourcePath: string;
  lineNumber: number;
}

export interface AgentMemoryEntry {
  id: string;
  agentId: string;
  source: AgentMemorySource;
  rawText: string;
  text: string;
  ts?: number;
  type?: AgentMemoryEntryType;
  memId?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface ChatSendRequest {
  agentId: string;
  sessionKey: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface OpenClawConfigSnapshot {
  stateVersion?: number;
  config: Record<string, unknown>;
}

export interface OpenClawConfigPreview {
  summary: string;
  diffText?: string;
}

export type AgentRole = "ceo" | "builder" | "growth_marketer" | "pm" | "biz_pm" | "biz_executor";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type FederatedTaskProvider = "internal" | "notion" | "vibe" | "linear";
export type TaskSyncState = "healthy" | "pending" | "conflict" | "error";
export type FederationConflictPolicy = "canonical_wins" | "newest_wins";
export type ProjectStatus = "active" | "paused" | "archived";
export type AgentLifecycleState = "active" | "idle" | "pending_spawn" | "retired";
export type CapabilityCategory = "measure" | "execute" | "distribute";
export type LedgerEntryType = "revenue" | "cost";
export type AccountEventType = "credit" | "debit";
export type ExperimentStatus = "running" | "completed" | "failed";
export type ResourceType = "cash_budget" | "api_quota" | "distribution_slots" | "custom";
export type ResourceHealth = "healthy" | "warning" | "depleted";
export type ResourceLowBehavior = "warn" | "deprioritize_expensive_tasks" | "ask_pm_review";
export type ResourceEventKind = "refresh" | "consumption" | "adjustment";

export interface CapabilitySlotModel {
  skillId: string;
  category: CapabilityCategory;
  config: Record<string, string>;
}

export interface BusinessConfigModel {
  type: string;
  slots: {
    measure: CapabilitySlotModel;
    execute: CapabilitySlotModel;
    distribute: CapabilitySlotModel;
  };
}

export interface LedgerEntryModel {
  id: string;
  projectId: string;
  timestamp: string;
  type: LedgerEntryType;
  amount: number;
  currency: string;
  source: string;
  description: string;
  experimentId?: string;
}

export interface ProjectAccountModel {
  id: string;
  projectId: string;
  currency: string;
  balanceCents: number;
  updatedAt: string;
}

export interface ProjectAccountEventModel {
  id: string;
  projectId: string;
  accountId: string;
  timestamp: string;
  type: AccountEventType;
  amountCents: number;
  source: string;
  note?: string;
  balanceAfterCents: number;
}

export interface ExperimentModel {
  id: string;
  projectId: string;
  hypothesis: string;
  status: ExperimentStatus;
  startedAt: string;
  endedAt?: string;
  results?: string;
  metricsBefore?: Record<string, number>;
  metricsAfter?: Record<string, number>;
}

export interface MetricEventModel {
  id: string;
  projectId: string;
  timestamp: string;
  source: string;
  metrics: Record<string, number>;
}

export interface ResourcePolicyModel {
  advisoryOnly: true;
  softLimit?: number;
  hardLimit?: number;
  whenLow: ResourceLowBehavior;
}

export interface ProjectResourceModel {
  id: string;
  projectId: string;
  type: ResourceType;
  name: string;
  unit: string;
  remaining: number;
  limit: number;
  reserved?: number;
  trackerSkillId: string;
  refreshCadenceMinutes?: number;
  policy: ResourcePolicyModel;
  metadata?: Record<string, string>;
}

export interface ResourceEventModel {
  id: string;
  projectId: string;
  resourceId: string;
  ts: string;
  kind: ResourceEventKind;
  delta: number;
  remainingAfter: number;
  source: string;
  note?: string;
}

export interface BusinessReadinessIssueModel {
  code: string;
  message: string;
}

export interface BusinessBuilderStateModel {
  businessType: string;
  capabilitySkills: {
    measure: string;
    execute: string;
    distribute: string;
  };
  resources: ProjectResourceModel[];
  readinessIssues: BusinessReadinessIssueModel[];
}

export interface DepartmentModel {
  id: string;
  name: string;
  description: string;
  goal: string;
}

export interface ProjectModel {
  id: string;
  departmentId: string;
  name: string;
  githubUrl: string;
  status: ProjectStatus;
  goal: string;
  kpis: string[];
  trackingContext?: string;
  businessConfig?: BusinessConfigModel;
  account?: ProjectAccountModel;
  accountEvents: ProjectAccountEventModel[];
  ledger: LedgerEntryModel[];
  experiments: ExperimentModel[];
  metricEvents: MetricEventModel[];
  resources: ProjectResourceModel[];
  resourceEvents: ResourceEventModel[];
}

export interface CompanyAgentModel {
  agentId: string;
  role: AgentRole;
  projectId?: string;
  heartbeatProfileId: string;
  isCeo?: boolean;
  lifecycleState: AgentLifecycleState;
}

export interface CompanyOfficeObjectModel {
  id: string;
  identifier?: string;
  meshType:
    | "team-cluster"
    | "plant"
    | "couch"
    | "bookshelf"
    | "pantry"
    | "glass-wall"
    | "custom-mesh";
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  projectId?: string;
  metadata?: Record<string, unknown>;
}

export interface OfficeObjectSidecarModel {
  id: string;
  identifier: string;
  meshType: CompanyOfficeObjectModel["meshType"];
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  metadata?: Record<string, unknown>;
}

export interface OfficeSettingsModel {
  meshAssetDir: string;
}

export interface MeshAssetModel {
  assetId: string;
  label: string;
  localPath: string;
  publicPath: string;
  fileName: string;
  fileSizeBytes: number;
  sourceType: "local" | "downloaded";
  validated: boolean;
  addedAt: number;
  sourceUrl?: string;
}

export interface RoleSlotModel {
  projectId: string;
  role: Exclude<AgentRole, "ceo">;
  desiredCount: number;
  spawnPolicy: "manual" | "queue_pressure";
}

export interface TaskModel {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  ownerAgentId?: string;
  priority: "low" | "medium" | "high";
  artefactPath?: string;
}

export interface FederatedTaskModel extends TaskModel {
  provider: FederatedTaskProvider;
  canonicalProvider: FederatedTaskProvider;
  providerUrl?: string;
  syncState: TaskSyncState;
  syncError?: string;
  updatedAt: number;
}

export interface FederationProjectPolicy {
  projectId: string;
  canonicalProvider: FederatedTaskProvider;
  mirrors: FederatedTaskProvider[];
  writeBackEnabled: boolean;
  conflictPolicy: FederationConflictPolicy;
}

export interface ProviderIndexField {
  name: string;
  type: string;
  description?: string;
  options?: string[];
}

export interface ProviderIndexProfile {
  profileId: string;
  projectId: string;
  provider: FederatedTaskProvider;
  entityId: string;
  entityName: string;
  toolNamingPrefix?: string;
  fetchCommandHints: string[];
  fieldMappings: ProviderIndexField[];
  schemaVersion: string;
  updatedAt: number;
}

export interface HeartbeatProfileModel {
  id: string;
  role: AgentRole;
  cadenceMinutes: number;
  teamDescription: string;
  productDetails: string;
  goal: string;
}

export interface ChannelBindingModel {
  platform: "slack" | "discord";
  externalChannelId: string;
  projectId: string;
  agentRole: AgentRole;
  agentIdOverride?: string;
  routingMode: "default_pm" | "override_agent";
}

export interface HeartbeatRuntimeModel {
  enabled: boolean;
  pluginId: string;
  serviceId: string;
  cadenceMinutes: number;
  notes?: string;
}

export type TeamProposalIdeaGateStatus = "draft" | "passed" | "blocked";
export type TeamProposalApprovalStatus = "pending" | "approved" | "rejected" | "changes_requested";
export type TeamProposalExecutionStatus =
  | "draft"
  | "ready_to_create"
  | "creating"
  | "created"
  | "failed";

export interface TeamProposalIdeaBrief {
  focus: string;
  targetCustomer: string;
  primaryGoal: string;
  constraints: string;
  notes?: string;
}

export interface TeamProposalRoleRecommendation {
  roleId: string;
  title: string;
  rationale: string;
  supported: boolean;
  mappedRuntimeRole?: AgentRole;
}

export interface TeamProposalBoardItem {
  id: string;
  title: string;
  detail?: string;
  ownerRoleId?: string;
}

export interface TeamProposalBusinessConfig {
  businessType: "affiliate_marketing" | "content_creator" | "saas" | "custom";
  capabilitySkills: {
    measure: string;
    execute: string;
    distribute: string;
  };
}

export interface TeamProposalModel {
  id: string;
  requestedBy: string;
  sourceAgentId: string;
  title: string;
  ideaBrief: TeamProposalIdeaBrief;
  ideaGateStatus: TeamProposalIdeaGateStatus;
  researchSummary: string;
  proposalSummary: string;
  proposedTeamName: string;
  proposedDescription: string;
  proposedRoles: TeamProposalRoleRecommendation[];
  proposedBusinessConfig: TeamProposalBusinessConfig;
  proposedInitialBoardItems: TeamProposalBoardItem[];
  approvalStatus: TeamProposalApprovalStatus;
  executionStatus: TeamProposalExecutionStatus;
  reviewTaskTitle: string;
  createdAt: number;
  updatedAt: number;
  approvalNote?: string;
  executionError?: string;
  createdTeamId?: string;
  createdProjectId?: string;
}

export interface CompanyModel {
  version: number;
  departments: DepartmentModel[];
  projects: ProjectModel[];
  agents: CompanyAgentModel[];
  roleSlots: RoleSlotModel[];
  tasks: FederatedTaskModel[];
  federationPolicies: FederationProjectPolicy[];
  providerIndexProfiles: ProviderIndexProfile[];
  heartbeatProfiles: HeartbeatProfileModel[];
  channelBindings: ChannelBindingModel[];
  heartbeatRuntime: HeartbeatRuntimeModel;
  teamProposals: TeamProposalModel[];
  officeObjects?: CompanyOfficeObjectModel[];
}

export interface ReconciliationWarning {
  code:
    | "missing_runtime_agent"
    | "runtime_not_in_sidecar"
    | "sidecar_not_in_config"
    | "role_slot_deficit"
    | "channel_binding_missing_target"
    | "configured_agent_not_running";
  message: string;
}

export interface ProjectWorkloadSummary {
  projectId: string;
  openTickets: number;
  closedTickets: number;
  queuePressure: "low" | "medium" | "high";
}

export type ApprovalActionType =
  | "tool_call"
  | "external_message"
  | "deploy"
  | "delete"
  | "write"
  | "config_change";
export type ApprovalRiskLevel = "low" | "medium" | "high" | "critical";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface PendingApprovalModel {
  id: string;
  agentId: string;
  actionType: ApprovalActionType;
  toolName?: string;
  description: string;
  riskLevel: ApprovalRiskLevel;
  createdAt: number;
  context?: string;
  status: ApprovalStatus;
}

export interface UnifiedOfficeModel {
  company: CompanyModel;
  runtimeAgents: AgentCardModel[];
  configuredAgents: AgentCardModel[];
  officeObjects: OfficeObjectSidecarModel[];
  memory: MemoryItemModel[];
  skills: SkillItemModel[];
  workload: ProjectWorkloadSummary[];
  warnings: ReconciliationWarning[];
  diagnostics: {
    configAgentCount: number;
    runtimeAgentCount: number;
    sidecarAgentCount: number;
    missingRuntimeAgentIds: string[];
    unmappedRuntimeAgentIds: string[];
    invalidOfficeObjects: string[];
    duplicateOfficeObjectIds: string[];
    officeObjectCount: number;
    clampedClusterCount: number;
    outOfBoundsClusterObjectIds: string[];
    ceoAnchorMode: "glass-derived" | "fallback";
    source: "gateway" | "localStorage" | "default";
  };
}

export interface GatewayAgentIdentityModel {
  name?: string;
  theme?: string;
  emoji?: string;
  avatar?: string;
  avatarUrl?: string;
}

export interface GatewayAgentRowModel {
  id: string;
  name?: string;
  identity?: GatewayAgentIdentityModel;
}

export interface AgentsListResult {
  defaultId: string;
  mainKey: string;
  scope: string;
  agents: GatewayAgentRowModel[];
}

export interface ToolCatalogProfile {
  id: "minimal" | "coding" | "messaging" | "full";
  label: string;
}

export interface ToolCatalogEntry {
  id: string;
  label: string;
  description: string;
  source: "core" | "plugin";
  pluginId?: string;
  optional?: boolean;
  defaultProfiles: Array<"minimal" | "coding" | "messaging" | "full">;
}

export interface ToolCatalogGroup {
  id: string;
  label: string;
  source: "core" | "plugin";
  pluginId?: string;
  tools: ToolCatalogEntry[];
}

export interface ToolsCatalogResult {
  agentId: string;
  profiles: ToolCatalogProfile[];
  groups: ToolCatalogGroup[];
}

export interface AgentIdentityResult {
  agentId: string;
  name: string;
  avatar: string;
  emoji?: string;
}

export interface AgentFileEntry {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
}

export interface ProjectArtefactEntry extends AgentFileEntry {
  projectId: string;
  agentId: string;
  workspace: string;
}

export interface ProjectArtefactGroup {
  projectId: string;
  agentId: string;
  workspace: string;
  files: ProjectArtefactEntry[];
  error?: string;
}

export interface ProjectArtefactIndexResult {
  projectId: string;
  groups: ProjectArtefactGroup[];
  files: ProjectArtefactEntry[];
  fetchedAtMs: number;
}

export interface AgentsFilesListResult {
  agentId: string;
  workspace: string;
  files: AgentFileEntry[];
}

export interface AgentsFilesGetResult {
  agentId: string;
  workspace: string;
  file: AgentFileEntry;
}

export interface AgentsFilesSetResult {
  ok: true;
  agentId: string;
  workspace: string;
  file: AgentFileEntry;
}

export interface ChannelUiMetaEntry {
  id: string;
  label: string;
  detailLabel: string;
  systemImage?: string;
}

export interface ChannelAccountSnapshot {
  accountId: string;
  name?: string | null;
  enabled?: boolean | null;
  configured?: boolean | null;
  linked?: boolean | null;
  running?: boolean | null;
  connected?: boolean | null;
  reconnectAttempts?: number | null;
  lastConnectedAt?: number | null;
  lastError?: string | null;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
  lastProbeAt?: number | null;
  mode?: string | null;
  dmPolicy?: string | null;
  allowFrom?: string[] | null;
  tokenSource?: string | null;
  botTokenSource?: string | null;
  appTokenSource?: string | null;
  credentialSource?: string | null;
  audienceType?: string | null;
  audience?: string | null;
  webhookPath?: string | null;
  webhookUrl?: string | null;
  baseUrl?: string | null;
  allowUnmentionedGroups?: boolean | null;
  cliPath?: string | null;
  dbPath?: string | null;
  port?: number | null;
  probe?: unknown;
  audit?: unknown;
  application?: unknown;
}

export interface ChannelsStatusSnapshot {
  ts: number;
  channelOrder: string[];
  channelLabels: Record<string, string>;
  channelDetailLabels?: Record<string, string>;
  channelSystemImages?: Record<string, string>;
  channelMeta?: ChannelUiMetaEntry[];
  channels: Record<string, unknown>;
  channelAccounts: Record<string, ChannelAccountSnapshot[]>;
  channelDefaultAccountId: Record<string, string>;
}

export type CronSchedule =
  | { kind: "at"; at: string }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | { kind: "cron"; expr: string; tz?: string; staggerMs?: number };

export type CronSessionTarget = "main" | "isolated";
export type CronWakeMode = "next-heartbeat" | "now";

export type CronPayload =
  | { kind: "systemEvent"; text: string }
  | {
      kind: "agentTurn";
      message: string;
      model?: string;
      thinking?: string;
      timeoutSeconds?: number;
    };

export interface CronDelivery {
  mode: "none" | "announce" | "webhook";
  channel?: string;
  to?: string;
  bestEffort?: boolean;
}

export interface CronJobState {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "skipped";
  lastError?: string;
  lastDurationMs?: number;
}

export interface CronJob {
  id: string;
  agentId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: CronSessionTarget;
  wakeMode: CronWakeMode;
  payload: CronPayload;
  delivery?: CronDelivery;
  state?: CronJobState;
}

export interface CronStatus {
  enabled: boolean;
  jobs: number;
  nextWakeAtMs?: number | null;
}

export interface SkillsStatusConfigCheck {
  path: string;
  satisfied: boolean;
}

export interface SkillInstallOption {
  id: string;
  kind: "brew" | "node" | "go" | "uv";
  label: string;
  bins: string[];
}

export interface SkillStatusEntry {
  name: string;
  description: string;
  source: string;
  filePath: string;
  baseDir: string;
  skillKey: string;
  bundled?: boolean;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: {
    bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  missing: {
    bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  configChecks: SkillsStatusConfigCheck[];
  install: SkillInstallOption[];
}

export interface SkillStatusReport {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: SkillStatusEntry[];
}

export interface TeamBusinessSkillSyncPreviewRow {
  agentId: string;
  role: "biz_pm" | "biz_executor";
  mode: "replace_minimum" | "append_only";
  beforeSkills: string[];
  afterSkills: string[];
}

export interface TeamBusinessSkillSyncResult {
  ok: boolean;
  teamId: string;
  projectId: string;
  mode: "replace_minimum" | "append_only";
  dryRun: boolean;
  touchedAgents: string[];
  missingAgents: string[];
  preview: TeamBusinessSkillSyncPreviewRow[];
  error?: string;
}
