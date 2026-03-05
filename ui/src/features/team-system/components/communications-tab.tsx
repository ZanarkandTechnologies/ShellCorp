"use client";

/**
 * COMMUNICATIONS TAB
 * ==================
 * Internal ops feed showing agent activity filtered by type.
 *
 * KEY CONCEPTS:
 * - Left sidebar channel filter (planning / executing / blocked / handoff).
 * - Right panel shows filtered activity rows from Convex or sidecar.
 *
 * USAGE:
 * - Rendered inside TeamPanel as the "communications" TabsContent.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CommunicationRow, CommunicationsFilter } from "./team-panel-types";

interface CommunicationsTabProps {
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
  communicationsFilter,
  setCommunicationsFilter,
  filteredRows,
}: CommunicationsTabProps): JSX.Element {
  return (
    <div className="grid h-full grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
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
        </CardContent>
      </Card>

      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm"># team-internal</CardTitle>
            <Badge variant="outline" className="text-[10px] uppercase">
              {communicationsFilter}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex h-[calc(100%-3rem)] min-h-0 flex-col gap-3 overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 rounded-md border p-3">
            <div className="space-y-2">
              {filteredRows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-md border bg-muted/20 p-2 text-sm"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.agentId}</span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] uppercase"
                      >
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
                    <p className="text-[11px] text-muted-foreground">
                      task: {row.taskId}
                    </p>
                  ) : null}
                </div>
              ))}
              {filteredRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No activity yet. Agents should publish updates with `shellcorp status` during each heartbeat turn.
                </p>
              ) : null}
            </div>
          </ScrollArea>
          <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
            Internal ops feed. Use `shellcorp status` for structured updates and timeline replay.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
