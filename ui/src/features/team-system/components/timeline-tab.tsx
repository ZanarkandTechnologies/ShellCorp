"use client";

/**
 * TIMELINE TAB
 * ============
 * Team activity timeline backed by Convex AgentActivityFeed or fallback rows.
 *
 * KEY CONCEPTS:
 * - Wraps AgentActivityFeed when Convex is enabled.
 * - Falls back to communication rows when Convex is disabled.
 *
 * USAGE:
 * - Rendered inside TeamPanel as the "timeline" TabsContent.
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentActivityFeed } from "./agent-activity-feed";
import type { AgentCandidate, CommunicationRow } from "./team-panel-types";

interface TimelineTabProps {
  convexEnabled: boolean;
  teamScopeId: string | null;
  activityFeedCandidates: AgentCandidate[];
  communicationRows: CommunicationRow[];
}

export function TimelineTab({
  convexEnabled,
  teamScopeId,
  activityFeedCandidates,
  communicationRows,
}: TimelineTabProps): JSX.Element {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">Team Timeline</CardTitle>
          {teamScopeId ? (
            <Badge variant="outline" className="text-[10px] uppercase">
              {teamScopeId}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-3rem)] overflow-hidden">
        {convexEnabled && teamScopeId ? (
          <AgentActivityFeed teamId={teamScopeId} candidates={activityFeedCandidates} />
        ) : (
          <ScrollArea className="h-full rounded-md border p-3">
            <div className="space-y-2">
              {communicationRows.map((row) => (
                <div
                  key={`timeline-fallback-${row.id}`}
                  className="rounded-md border bg-muted/20 p-2 text-sm"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.agentId}</span>
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {row.activityType}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(row.occurredAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="font-medium">{row.label}</p>
                  {row.detail ? (
                    <p className="text-xs text-muted-foreground">{row.detail}</p>
                  ) : null}
                  {row.taskId ? (
                    <p className="text-[11px] text-muted-foreground">task: {row.taskId}</p>
                  ) : null}
                </div>
              ))}
              {communicationRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Enable Convex and team logging to view beat drill-down timeline.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
