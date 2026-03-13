import { useQuery } from "convex/react";
import { useMemo, useRef } from "react";

import { coerceLiveState } from "@/lib/live-status";
import type { AgentLiveStatus } from "@/lib/openclaw-types";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../convex/_generated/api";

type ConvexBubble = {
  id: string;
  label: string;
  weight: number;
};

type ConvexStatusRow = {
  agentId: string;
  state: string;
  statusText: string;
  bubbles: ConvexBubble[];
  currentSkillId?: string;
  recentEvents?: Array<{
    eventType: string;
    label: string;
    detail?: string;
    skillId?: string;
    occurredAt: number;
  }>;
  sessionKey?: string;
  updatedAt?: number;
};

const EVENT_STICKY_MS = 10_000;

export function useAgentLiveStatuses(
  agentIds: string[],
): Record<string, AgentLiveStatus> | undefined {
  const convexEnabled = isConvexEnabled();
  const stickyEventRef = useRef<
    Record<string, { statusText: string; label: string; expiresAt: number }>
  >({});

  const rows = useQuery(
    api.status.getMultipleAgentStatuses,
    convexEnabled && agentIds.length > 0
      ? {
          agentIds,
          recentWindowMs: EVENT_STICKY_MS,
          recentLimit: 8,
        }
      : "skip",
  );
  return useMemo(() => {
    if (!convexEnabled) return undefined;
    if (!rows) return undefined;
    const now = Date.now();
    const recordRows = rows as Record<string, ConvexStatusRow>;
    return Object.entries(recordRows).reduce<Record<string, AgentLiveStatus>>(
      (acc, [agentId, row]) => {
        const state = coerceLiveState(row.state);
        const latestEvent =
          Array.isArray(row.recentEvents) && row.recentEvents.length > 0
            ? row.recentEvents[0]
            : undefined;
        const liveEventStatusText = (() => {
          if (!latestEvent) return "";
          const detail = latestEvent.detail?.trim();
          if (!detail) return latestEvent.label;
          return `${latestEvent.label}: ${detail}`;
        })();
        if (latestEvent && liveEventStatusText) {
          stickyEventRef.current[agentId] = {
            statusText: liveEventStatusText,
            label: latestEvent.label,
            expiresAt: now + EVENT_STICKY_MS,
          };
        }
        const stickyEvent = stickyEventRef.current[agentId];
        const stickyStatusText =
          stickyEvent && stickyEvent.expiresAt > now ? stickyEvent.statusText : "";
        const stickyLabel = stickyEvent && stickyEvent.expiresAt > now ? stickyEvent.label : "";
        if (stickyEvent && stickyEvent.expiresAt <= now) {
          delete stickyEventRef.current[agentId];
        }
        const mergedBubbles = (() => {
          const statusBubbles = Array.isArray(row.bubbles) ? row.bubbles : [];
          const primaryLabel =
            latestEvent?.label?.trim() || stickyLabel || (statusBubbles[0]?.label?.trim() ?? "");
          if (!primaryLabel) return [];
          return [{ id: `primary:${agentId}:${primaryLabel}`, label: primaryLabel, weight: 100 }];
        })();
        acc[agentId] = {
          agentId: row.agentId,
          sessionKey: row.sessionKey,
          state,
          statusText: liveEventStatusText || stickyStatusText || row.statusText,
          updatedAt: row.updatedAt,
          bubbles: mergedBubbles,
          currentSkillId: latestEvent?.skillId?.trim() || row.currentSkillId?.trim() || undefined,
        };
        return acc;
      },
      {},
    );
  }, [convexEnabled, rows]);
}
