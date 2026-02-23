import type { FahrenheitConfig } from "../config/schema.js";
import type { InboundEnvelope, SessionBusyPolicy } from "../types.js";

export interface ResolvedRoute {
  groupId: string;
  sessionKey: string;
  mainSessionKey: string;
  matchedBy: string;
  mode: "conversational" | "observational";
  busyPolicy: SessionBusyPolicy;
  allowFrom: string[];
}

function sourceScopeMatches(scope: "dm" | "group" | "comments" | "all", envelope: InboundEnvelope): boolean {
  if (scope === "all") return true;
  if (scope === "dm") return !envelope.isGroup;
  if (scope === "group") return envelope.isGroup;
  return envelope.channelId === "notion";
}

function resolveMatchedGroup(config: FahrenheitConfig, envelope: InboundEnvelope): { groupId: string; matchedBy: string } | null {
  // Priority 1: explicit channel ID bindings always win over scope fallbacks.
  for (const [groupId, group] of Object.entries(config.gateway.groups)) {
    for (const source of group.sources) {
      if (source.channel !== envelope.channelId) continue;
      if (source.channelIds.length === 0) continue;
      if (!source.channelIds.includes(envelope.sourceId)) continue;
      return { groupId, matchedBy: `group:${groupId}:channelId` };
    }
  }

  // Priority 2: scope-based routing when no channel ID binding matches.
  for (const [groupId, group] of Object.entries(config.gateway.groups)) {
    for (const source of group.sources) {
      if (source.channel !== envelope.channelId) continue;
      if (source.scope && sourceScopeMatches(source.scope, envelope)) {
        return { groupId, matchedBy: `group:${groupId}:scope:${source.scope}` };
      }
      if (!source.scope) {
        return { groupId, matchedBy: `group:${groupId}:channel` };
      }
    }
  }

  return null;
}

function buildSessionKey(groupId: string, envelope: InboundEnvelope): { mainSessionKey: string; sessionKey: string } {
  const mainSessionKey = `group:${groupId}:main`;
  const scope = envelope.channelId === "notion" ? "comments" : envelope.isGroup ? "group" : "dm";
  const identity = envelope.isGroup ? envelope.sourceId : envelope.senderId;
  let sessionKey = `group:${groupId}:${envelope.channelId}:${scope}:${identity}`;
  if (envelope.threadId) {
    sessionKey = `${sessionKey}:thread:${envelope.threadId}`;
  }
  return { mainSessionKey, sessionKey };
}

export function resolveRoute(config: FahrenheitConfig, envelope: InboundEnvelope): ResolvedRoute | null {
  const matched = resolveMatchedGroup(config, envelope);
  if (!matched) return null;
  const group = config.gateway.groups[matched.groupId];
  const keys = buildSessionKey(matched.groupId, envelope);
  return {
    groupId: matched.groupId,
    mainSessionKey: keys.mainSessionKey,
    sessionKey: keys.sessionKey,
    matchedBy: matched.matchedBy,
    mode: group.mode,
    busyPolicy: group.busyPolicy,
    allowFrom: group.allowFrom,
  };
}

export function buildPersonalCliSessionKey(identity: string, threadId?: string): string {
  const base = `group:personal:cli:dm:${identity}`;
  return threadId ? `${base}:thread:${threadId}` : base;
}
