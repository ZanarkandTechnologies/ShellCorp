"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppStore } from "@/lib/app-store";
import { api } from "../../../../../convex/_generated/api";

/**
 * TEAM ACTIVITY FEED
 * ==================
 * Team-first flattened timeline with lightweight filters.
 *
 * KEY CONCEPTS:
 * - Default view is a single chronological feed across the team.
 * - Filter by agent/source without leaving team context.
 * - Beat/session drill-down handoff stays available from each event row.
 *
 * USAGE:
 * - Render inside Team Panel Timeline tab when Convex is enabled.
 *
 * MEMORY REFERENCES:
 * - MEM-0132
 */

type AgentCandidate = {
  agentId: string;
  name: string;
};

type FeedEvent = {
  id: string;
  sourceType: "agent_event" | "activity_event" | "board_event";
  occurredAt: number;
  beatId?: string;
  sessionKey?: string;
  agentId?: string;
  eventType?: string;
  activityType?: string;
  label: string;
  detail?: string;
  taskId?: string;
};

type TeamFeedPage = {
  events: FeedEvent[];
  nextBeforeTs?: number;
  hasMore: boolean;
};

interface AgentActivityFeedProps {
  teamId: string | null;
  candidates: AgentCandidate[];
}

function formatTs(ts: number): string {
  return Number.isFinite(ts) ? new Date(ts).toLocaleString() : "unknown";
}

function formatRelative(ts: number): string {
  if (!Number.isFinite(ts)) return "unknown";
  const diffMs = Date.now() - ts;
  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
}

function eventTypeLabel(event: FeedEvent): string {
  return event.activityType ?? event.eventType ?? event.sourceType;
}

function sourceGlyph(sourceType: FeedEvent["sourceType"]): string {
  if (sourceType === "board_event") return "$";
  if (sourceType === "activity_event") return "#";
  return "S";
}

export function AgentActivityFeed({ teamId, candidates }: AgentActivityFeedProps): JSX.Element {
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [beatsOnly, setBeatsOnly] = useState(false);
  const [beforeTs, setBeforeTs] = useState<number | undefined>(undefined);
  const [pages, setPages] = useState<TeamFeedPage[]>([]);

  const setIsAgentSessionPanelOpen = useAppStore((state) => state.setIsAgentSessionPanelOpen);
  const setSelectedAgentStoreId = useAppStore((state) => state.setSelectedAgentId);
  const setSelectedSessionKey = useAppStore((state) => state.setSelectedSessionKey);

  const feedPage = useQuery(
    api.status.getTeamActivityFeed,
    teamId
      ? {
          teamId,
          limit: 120,
          beforeTs,
          agentId: selectedAgent === "all" ? undefined : selectedAgent,
          sourceType: selectedSource === "all" ? undefined : selectedSource,
          allowedAgentIds: candidates.map((candidate) => candidate.agentId),
        }
      : "skip",
  ) as TeamFeedPage | undefined;

  useEffect(() => {
    setBeforeTs(undefined);
    setPages([]);
  }, [teamId, selectedAgent, selectedSource]);

  useEffect(() => {
    if (!feedPage) return;
    setPages((current) => {
      const seen = current.some(
        (page) => page.nextBeforeTs === feedPage.nextBeforeTs && page.events.length === feedPage.events.length,
      );
      return seen ? current : [...current, feedPage];
    });
  }, [feedPage]);

  const allEvents = useMemo(
    () =>
      pages
        .flatMap((page) => page.events)
        .sort((left, right) => right.occurredAt - left.occurredAt),
    [pages],
  );

  const visibleEvents = useMemo(
    () => (beatsOnly ? allEvents.filter((event) => Boolean(event.beatId)) : allEvents),
    [allEvents, beatsOnly],
  );

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allEvents.length,
      agent_event: 0,
      activity_event: 0,
      board_event: 0,
    };
    for (const event of allEvents) counts[event.sourceType] = (counts[event.sourceType] ?? 0) + 1;
    return counts;
  }, [allEvents]);

  const agentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of allEvents) {
      const agentId = event.agentId?.trim();
      if (!agentId) continue;
      counts.set(agentId, (counts.get(agentId) ?? 0) + 1);
    }
    return counts;
  }, [allEvents]);

  const lastPage = pages[pages.length - 1];
  const canLoadMore = Boolean(lastPage?.hasMore && lastPage.nextBeforeTs);
  const knownAgents = useMemo(
    () => candidates.map((candidate) => ({ agentId: candidate.agentId, name: candidate.name })),
    [candidates],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents ({allEvents.length})</SelectItem>
              {knownAgents.map((agent) => (
                <SelectItem key={agent.agentId} value={agent.agentId}>
                  {agent.name} ({agentCounts.get(agent.agentId) ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({sourceCounts.all ?? 0})</SelectItem>
              <SelectItem value="agent_event">Status ({sourceCounts.agent_event ?? 0})</SelectItem>
              <SelectItem value="activity_event">Activity ({sourceCounts.activity_event ?? 0})</SelectItem>
              <SelectItem value="board_event">Board ({sourceCounts.board_event ?? 0})</SelectItem>
            </SelectContent>
          </Select>
          <label className="ml-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={beatsOnly} onCheckedChange={(value) => setBeatsOnly(Boolean(value))} />
            Beat-tagged
          </label>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase">
          {visibleEvents.length} rows
        </Badge>
      </div>

      <ScrollArea className="h-full min-h-0 rounded-md border p-3">
        <div className="space-y-2">
          {visibleEvents.map((event, index) => (
            <div key={`${event.id}-${index}`} className="rounded-md border bg-muted/20 p-2 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px]">
                    {sourceGlyph(event.sourceType)}
                  </span>
                  <span className="font-medium">{event.agentId ?? "system"}</span>
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {eventTypeLabel(event)}
                  </Badge>
                  {event.beatId ? (
                    <Badge variant="outline" className="text-[10px]">
                      beat {event.beatId}
                    </Badge>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground">{formatRelative(event.occurredAt)}</span>
              </div>
              <p className="font-medium">{event.label}</p>
              {event.detail ? <p className="text-xs text-muted-foreground">{event.detail}</p> : null}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>{formatTs(event.occurredAt)}</span>
                {event.taskId ? <span>task: {event.taskId}</span> : null}
                {event.sessionKey ? (
                  <Button
                    variant="link"
                    className="h-auto p-0 text-[11px]"
                    onClick={() => {
                      setSelectedAgentStoreId(event.agentId ?? null);
                      setSelectedSessionKey(event.sessionKey ?? null);
                      setIsAgentSessionPanelOpen(true);
                    }}
                  >
                    Open session
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {visibleEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No events found for current filters.
            </p>
          ) : null}
          {canLoadMore ? (
            <Button size="sm" variant="outline" className="w-full" onClick={() => setBeforeTs(lastPage?.nextBeforeTs)}>
              Load Older
            </Button>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
