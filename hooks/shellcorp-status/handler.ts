const HEARTBEAT_START_PATTERN = /read\s+heartbeat\.md/i;
const HEARTBEAT_OK_PATTERN = /\bheartbeat_ok\b/i;
const HEARTBEAT_ERROR_PATTERN = /\b(error|failed|exception|timeout)\b/i;
const TOOL_PATTERN =
  /\b(ReadFile|Shell|TodoWrite|AskQuestion|Task|CallMcpTool|WebSearch|WebFetch|Edit|Write|Delete)\b/g;
const SKILL_PATTERN = /\bskill[:\s-]+([a-z0-9-_/]+)/i;

export interface HookEvent {
  type: string;
  action: string;
  sessionKey?: string;
  timestamp?: Date;
  context?: {
    content?: string;
    bodyForAgent?: string;
    transcript?: string;
  };
}

export interface ConvexStatusEvent {
  teamId?: string;
  agentId: string;
  eventType: "heartbeat_start" | "heartbeat_ok" | "heartbeat_no_work" | "heartbeat_error" | "tool_call" | "skill_call";
  label: string;
  detail?: string;
  sessionKey?: string;
  occurredAt?: number;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function extractSessionKey(event: HookEvent & Record<string, unknown>): string {
  const session = (event as { session?: { key?: string } }).session;
  const payload = (event as { payload?: { sessionKey?: string; session?: { key?: string } } }).payload;
  return firstString(
    event.sessionKey,
    session?.key,
    payload?.sessionKey,
    payload?.session?.key,
    event.context?.content,
  );
}

function parseAgentId(sessionKey?: string): string | null {
  if (!sessionKey) return null;
  const match = sessionKey.match(/^agent:([^:]+):/i);
  return match?.[1] ?? null;
}

function teamIdFromProjectId(projectId?: string): string | null {
  if (!projectId) return null;
  const trimmed = projectId.trim();
  if (!trimmed) return null;
  return `team-${trimmed}`;
}

function extractTeamId(event: HookEvent & Record<string, unknown>): string | null {
  const directTeam = firstString(
    (event as { teamId?: string }).teamId,
    (event as { team?: { id?: string; teamId?: string } }).team?.id,
    (event as { team?: { id?: string; teamId?: string } }).team?.teamId,
  );
  if (directTeam) return directTeam;

  const payload = (event as { payload?: Record<string, unknown> }).payload;
  const payloadTeam = firstString(
    typeof payload?.teamId === "string" ? payload.teamId : "",
    typeof payload?.targetTeamId === "string" ? payload.targetTeamId : "",
  );
  if (payloadTeam) return payloadTeam;
  const payloadProjectId = firstString(
    typeof payload?.projectId === "string" ? payload.projectId : "",
    typeof payload?.targetProjectId === "string" ? payload.targetProjectId : "",
  );
  return teamIdFromProjectId(payloadProjectId);
}

function extractAgentId(event: HookEvent & Record<string, unknown>, sessionKey: string): string | null {
  const directAgent = firstString(
    (event as { agentId?: string }).agentId,
    (event as { agent?: { id?: string; agentId?: string } }).agent?.id,
    (event as { agent?: { id?: string; agentId?: string } }).agent?.agentId,
  );
  if (directAgent) return directAgent;

  const payload = (event as { payload?: Record<string, unknown> }).payload;
  const payloadAgent = firstString(
    typeof payload?.agentId === "string" ? payload.agentId : "",
    typeof payload?.targetAgentId === "string" ? payload.targetAgentId : "",
    typeof payload?.sourceAgentId === "string" ? payload.sourceAgentId : "",
    typeof payload?.agent === "object" && payload.agent && typeof (payload.agent as Record<string, unknown>).id === "string"
      ? ((payload.agent as Record<string, unknown>).id as string)
      : "",
  );
  if (payloadAgent) return payloadAgent;

  return parseAgentId(sessionKey);
}

function extractText(event: HookEvent & Record<string, unknown>): string {
  const payload = (event as { payload?: Record<string, unknown> }).payload;
  const payloadContext = payload && typeof payload.context === "object" ? (payload.context as Record<string, unknown>) : undefined;
  const raw =
    firstString(
      event.context?.bodyForAgent,
      event.context?.transcript,
      event.context?.content,
      (event.context as { text?: string; message?: string; body?: string } | undefined)?.text,
      (event.context as { text?: string; message?: string; body?: string } | undefined)?.message,
      (event.context as { text?: string; message?: string; body?: string } | undefined)?.body,
      typeof payload?.bodyForAgent === "string" ? payload.bodyForAgent : "",
      typeof payload?.transcript === "string" ? payload.transcript : "",
      typeof payload?.content === "string" ? payload.content : "",
      typeof payload?.text === "string" ? payload.text : "",
      typeof payload?.message === "string" ? payload.message : "",
      typeof payload?.body === "string" ? payload.body : "",
      typeof payloadContext?.bodyForAgent === "string" ? payloadContext.bodyForAgent : "",
      typeof payloadContext?.transcript === "string" ? payloadContext.transcript : "",
      typeof payloadContext?.content === "string" ? payloadContext.content : "",
      typeof payloadContext?.text === "string" ? payloadContext.text : "",
      typeof payloadContext?.message === "string" ? payloadContext.message : "",
      typeof payloadContext?.body === "string" ? payloadContext.body : "",
    ) || "";
  return String(raw);
}

function classifyToolCalls(text: string): string[] {
  const matches = text.match(TOOL_PATTERN) ?? [];
  return [...new Set(matches)];
}

function classifySkillCall(text: string): string | null {
  const match = text.match(SKILL_PATTERN);
  return match?.[1]?.trim() || null;
}

export function classifyEvent(event: HookEvent): ConvexStatusEvent[] {
  const sessionKey = extractSessionKey(event as HookEvent & Record<string, unknown>);
  const agentId = extractAgentId(event as HookEvent & Record<string, unknown>, sessionKey);
  if (!agentId) return [];
  if (event.type !== "message") return [];

  const text = extractText(event as HookEvent & Record<string, unknown>);
  const trimmedText = text.trim();

  const occurredAt = event.timestamp instanceof Date ? event.timestamp.getTime() : Date.now();
  const teamId = extractTeamId(event as HookEvent & Record<string, unknown>) ?? undefined;
  const common = {
    teamId,
    agentId,
    sessionKey,
    occurredAt,
  };

  // Any inbound message means work is about to start.
  if (event.action === "received") {
    const label = HEARTBEAT_START_PATTERN.test(trimmedText) ? "Heartbeat" : "Message Received";
    return [{ ...common, eventType: "heartbeat_start", label, detail: trimmedText.slice(0, 240) }];
  }

  if (event.action === "sent" && HEARTBEAT_ERROR_PATTERN.test(trimmedText) && /heartbeat/i.test(trimmedText)) {
    return [{ ...common, eventType: "heartbeat_error", label: "Heartbeat Error", detail: trimmedText.slice(0, 240) }];
  }

  const skill = classifySkillCall(trimmedText);
  if (skill) {
    return [{ ...common, eventType: "skill_call", label: skill, detail: trimmedText.slice(0, 240) }];
  }

  const tools = classifyToolCalls(trimmedText);
  if (tools.length > 0) {
    return tools.map((tool) => ({
      ...common,
      eventType: "tool_call",
      label: tool,
      detail: trimmedText.slice(0, 240),
    }));
  }

  if (event.action === "sent" && (HEARTBEAT_OK_PATTERN.test(trimmedText) || trimmedText.length > 0)) {
    return [{ ...common, eventType: "heartbeat_ok", label: "Heartbeat OK", detail: trimmedText.slice(0, 240) }];
  }

  return [];
}

export async function publishEvents(convexSiteUrl: string, events: ConvexStatusEvent[], debugEnabled = false): Promise<void> {
  for (const row of events) {
    const response = await fetch(`${convexSiteUrl.replace(/\/+$/, "")}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(row),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`ingest returned ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ""}`);
    }
    if (debugEnabled) {
      console.info(`[shellcorp-status-hook] published ${row.eventType} for agent ${row.agentId}`);
    }
  }
}

export default async function transform(event: HookEvent): Promise<void> {
  const convexSiteUrl =
    process.env.SHELLCORP_CONVEX_SITE_URL ??
    process.env.CONVEX_SITE_URL ??
    "http://127.0.0.1:3211";
  const debugEnabled = process.env.SHELLCORP_STATUS_HOOK_DEBUG === "1";
  if (!convexSiteUrl) return;

  try {
    const events = classifyEvent(event);
    if (events.length === 0) {
      if (debugEnabled) {
        const text = extractText(event as HookEvent & Record<string, unknown>).trim();
        const sessionKey = extractSessionKey(event as HookEvent & Record<string, unknown>);
        const topLevelKeys = Object.keys((event as Record<string, unknown>) ?? {}).slice(0, 12).join(",");
        const payloadValue = (event as { payload?: unknown }).payload;
        const payloadKeys =
          payloadValue && typeof payloadValue === "object"
            ? Object.keys(payloadValue as Record<string, unknown>).slice(0, 12).join(",")
            : "n/a";
        console.info(
          `[shellcorp-status-hook] no matching events for ${event.type}:${event.action} session=${sessionKey || "n/a"} text="${text.slice(0, 120)}" keys=${topLevelKeys} payloadKeys=${payloadKeys}`,
        );
      }
      return;
    }
    if (debugEnabled) {
      console.info(`[shellcorp-status-hook] publishing ${events.length} event(s) to ${convexSiteUrl}`);
    }
    await publishEvents(convexSiteUrl, events, debugEnabled);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[shellcorp-status-hook] failed to publish event: ${message}`);
  }
}
