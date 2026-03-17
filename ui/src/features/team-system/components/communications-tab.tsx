"use client";

/**
 * ACTIVITY TAB
 * ============
 * Board-first team worklog showing status updates, handoffs, and execution breadcrumbs.
 *
 * KEY CONCEPTS:
 * - Coordination is task-first, not chat-first.
 * - Activity rows are the shared audit trail for team work.
 *
 * USAGE:
 * - Rendered inside TeamPanel as the "communications" TabsContent.
 *
 * MEMORY REFERENCES:
 * - MEM-0196
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CommunicationRow, CommunicationsFilter } from "./team-panel-types";

interface CommunicationsTabProps {
  teamId: string | null;
  communicationsFilter: CommunicationsFilter;
  setCommunicationsFilter: (filter: CommunicationsFilter) => void;
  filteredRows: CommunicationRow[];
}

const CHANNELS: { id: CommunicationsFilter; label: string }[] = [
  { id: "all", label: "all activity" },
  { id: "planning", label: "planning" },
  { id: "executing", label: "executing" },
  { id: "blocked", label: "blocked" },
  { id: "handoff", label: "handoff" },
];

export function CommunicationsTab({
  teamId,
  communicationsFilter,
  setCommunicationsFilter,
  filteredRows,
}: CommunicationsTabProps): JSX.Element {
  return (
    <div className="grid h-full grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          {CHANNELS.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={communicationsFilter === item.id ? "secondary" : "ghost"}
              className="w-full justify-start text-xs"
              onClick={() => setCommunicationsFilter(item.id)}
            >
              # {item.label}
            </Button>
          ))}
          <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
            Team coordination is board-first. Keep status updates, blocked reasons, handoffs, and
            task memory on tickets instead of relying on team chat.
          </div>
        </CardContent>
      </Card>

      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-sm">Team Activity</CardTitle>
              <p className="text-xs text-muted-foreground">
                Shared worklog for ticket ownership, execution updates, and handoffs.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">
                {communicationsFilter}
              </Badge>
              {teamId ? (
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {teamId}
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex h-[calc(100%-3rem)] min-h-0 flex-col gap-3 overflow-hidden">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Use this for
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Seeing who changed a ticket, who is blocked, and what the latest execution trail
                says.
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Not for</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Team group chat. If you need to intervene, message the relevant agent directly from
                Overview or inspect the ticket.
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Source</p>
              <p className="mt-2 text-sm text-muted-foreground">
                `shellcorp status`, board actions, and task-linked activity rows.
              </p>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1 rounded-md border p-3">
            <div className="space-y-2">
              {filteredRows.map((row) => (
                <div key={row.id} className="rounded-md border bg-muted/20 p-3 text-sm">
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
                    <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
                  ) : null}
                  {row.taskId ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">ticket: {row.taskId}</p>
                  ) : null}
                </div>
              ))}
              {filteredRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No matching worklog rows yet. Agents should publish structured status updates and
                  keep ticket memory current.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
