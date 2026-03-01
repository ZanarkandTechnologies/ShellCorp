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
}

export interface ReconciliationWarning {
  code:
    | "missing_runtime_agent"
    | "unmapped_runtime_agent"
    | "role_slot_deficit"
    | "channel_binding_missing_target";
  message: string;
}

export interface ProjectWorkloadSummary {
  projectId: string;
  openTickets: number;
  closedTickets: number;
  queuePressure: "low" | "medium" | "high";
}

export interface UnifiedOfficeModel {
  company: CompanyModel;
  runtimeAgents: AgentCardModel[];
  memory: MemoryItemModel[];
  skills: SkillItemModel[];
  workload: ProjectWorkloadSummary[];
  warnings: ReconciliationWarning[];
}
