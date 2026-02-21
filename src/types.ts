export type ChannelId = "telegram" | "discord" | "slack" | "whatsapp" | "local";

export interface InboundEnvelope {
  channelId: ChannelId;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  isGroup: boolean;
  threadId?: string;
  raw?: unknown;
}

export interface OutboundEnvelope {
  channelId: ChannelId;
  chatId: string;
  content: string;
  threadId?: string;
  raw?: unknown;
}

export interface AgentActionLog {
  ts: number;
  sessionKey: string;
  action: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface CronRunLog {
  ts: number;
  jobId: string;
  status: "ok" | "error";
  detail: string;
}

export interface ChannelMessageLog {
  ts: number;
  direction: "inbound" | "outbound";
  channelId: ChannelId;
  chatId: string;
  senderId?: string;
  content: string;
}
