/**
 * OPENCLAW UI TYPES
 * =================
 * Shared contracts for mapping OpenClaw state and gateway surfaces into UI models.
 */

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

export type AgentRole = "ceo" | "builder" | "growth_marketer" | "pm";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type ProjectStatus = "active" | "paused" | "archived";
export type AgentLifecycleState = "active" | "idle" | "pending_spawn" | "retired";

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
  meshType: "team-cluster" | "plant" | "couch" | "bookshelf" | "pantry" | "glass-wall";
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

export interface CompanyModel {
  version: number;
  departments: DepartmentModel[];
  projects: ProjectModel[];
  agents: CompanyAgentModel[];
  roleSlots: RoleSlotModel[];
  tasks: TaskModel[];
  heartbeatProfiles: HeartbeatProfileModel[];
  channelBindings: ChannelBindingModel[];
  heartbeatRuntime: HeartbeatRuntimeModel;
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

export type ApprovalActionType = "tool_call" | "external_message" | "deploy" | "delete" | "write" | "config_change";
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
