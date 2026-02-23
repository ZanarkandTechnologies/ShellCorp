export type ChannelId = string;
export type GatewayDirection = "inbound" | "outbound";
export type GatewayMode = "conversational" | "observational";
export type SessionBusyPolicy = "queue" | "steer";

export interface GatewayMessage {
  channelId: ChannelId;
  sourceId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  direction: GatewayDirection;
  mode: GatewayMode;
  threadId?: string;
  correlationId?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface InboundEnvelope {
  channelId: ChannelId;
  sourceId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  isGroup: boolean;
  mode?: GatewayMode;
  threadId?: string;
  correlationId?: string;
  raw?: unknown;
}

export interface OutboundEnvelope {
  channelId: ChannelId;
  sourceId: string;
  content: string;
  threadId?: string;
  correlationId?: string;
  raw?: unknown;
}

export interface AgentActionLog {
  ts: number;
  sessionKey: string;
  correlationId?: string;
  action: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface CronRunLog {
  ts: number;
  jobId: string;
  correlationId?: string;
  status: "ok" | "error";
  detail: string;
}

export interface ChannelMessageLog {
  ts: number;
  direction: GatewayDirection;
  channelId: ChannelId;
  sourceId: string;
  correlationId?: string;
  senderId?: string;
  content: string;
}

export type OntologyEntityType = "task" | "project" | "goal" | "crmRecord";

export type OntologyOperation = "list" | "get" | "create" | "update" | "search";

export interface CanonicalEntity {
  id: string;
  entityType: OntologyEntityType;
  title: string;
  status?: string;
  summary?: string;
  owner?: string;
  dueDate?: string;
  tags?: string[];
  priority?: string;
  value?: number;
  currency?: string;
  externalUrl?: string;
  source: {
    provider: string;
    workspace: string;
    databaseId?: string;
    rawId?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface OntologyEntityMapping {
  databaseId?: string;
  databaseNameHint?: string;
  titleField?: string;
  statusField?: string;
  summaryField?: string;
  ownerField?: string;
  dueDateField?: string;
  tagsField?: string;
  priorityField?: string;
  valueField?: string;
  currencyField?: string;
}

export interface OntologyMappingArtifact {
  generatedAt: string;
  description: string;
  confidence: number;
  notes: string[];
  clarificationQuestions: string[];
  entities: Record<OntologyEntityType, OntologyEntityMapping>;
}

export interface OntologyQueryRequest {
  operation: OntologyOperation;
  entityType: OntologyEntityType;
  id?: string;
  query?: string;
  limit?: number;
  filters?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  confirmWrite?: boolean;
}

export interface OntologyQueryResult {
  operation: OntologyOperation;
  entityType: OntologyEntityType;
  confidence: number;
  needsConfirmation: boolean;
  clarificationQuestions: string[];
  records: CanonicalEntity[];
  notes: string[];
}

export type ObservationTrustClass = "trusted" | "untrusted" | "system";
export type ObservationSignalType = "blocker" | "risk" | "upsell" | "improvement";
export type MemoryPromotionClass = "informational" | "operational" | "warning";

export interface ObservationSignal {
  type: ObservationSignalType;
  label: string;
  confidence: number;
  details?: string;
}

export interface ObservationEvent {
  id: string;
  eventType: string;
  source: string;
  sourceRef: string;
  occurredAt: string;
  projectTags: string[];
  roleTags: string[];
  workflowStage?: string;
  decisionRef?: string;
  summary: string;
  confidence: number;
  trustClass: ObservationTrustClass;
  signals: ObservationSignal[];
  metadata?: Record<string, unknown>;
}

export interface ObservationPromotionResult {
  promoted: boolean;
  reason: string;
  promotionClass?: MemoryPromotionClass;
}
