"use client";

/**
 * TEAM MEMORY TAB
 * ===============
 * Realtime append-only team memory log with a small operator note composer.
 *
 * KEY CONCEPTS:
 * - Shared team memory is a live log, not a mutable document.
 * - Private OpenClaw memory stays on the agent side; this surface is project-relative shared memory.
 *
 * USAGE:
 * - Rendered inside TeamPanel as the "memory" TabsContent.
 *
 * MEMORY REFERENCES:
 * - MEM-0209
 */

import { useState } from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { describeTeamMemoryAuthor, formatTeamMemoryKindLabel } from "./team-memory-tab.helpers";
import type { TeamMemoryEntryKind, TeamMemoryRow } from "./team-panel-types";

interface TeamMemoryTabProps {
  projectId: string | null;
  teamId: string | null;
  convexEnabled: boolean;
  memoryRows: TeamMemoryRow[];
  composeState: { pending: boolean; error?: string; ok?: string };
  onAppendOperatorNote: (input: { kind: TeamMemoryEntryKind; body: string }) => Promise<boolean>;
}

const MEMORY_KINDS: TeamMemoryEntryKind[] = [
  "note",
  "decision",
  "handoff",
  "result",
  "risk",
  "summary",
];

export function TeamMemoryTab({
  projectId,
  teamId,
  convexEnabled,
  memoryRows,
  composeState,
  onAppendOperatorNote,
}: TeamMemoryTabProps) {
  const [draftKind, setDraftKind] = useState<TeamMemoryEntryKind>("note");
  const [draftBody, setDraftBody] = useState("");

  async function handleSubmit(): Promise<void> {
    const body = draftBody.trim();
    if (!body) return;
    const ok = await onAppendOperatorNote({ kind: draftKind, body });
    if (ok) setDraftBody("");
  }

  return (
    <div className="grid h-full grid-cols-1 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">Log Note</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
                  aria-label="Team memory help"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-64">
                Shared memory is append-only. Use it for durable observations, decisions,
                handoffs, risks, and results tied to the current team scope.
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!convexEnabled ? (
            <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
              Connect Convex to enable realtime team memory.
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kind</p>
            <div className="flex flex-wrap gap-2">
              {MEMORY_KINDS.map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  size="sm"
                  variant={draftKind === kind ? "secondary" : "outline"}
                  className="text-xs capitalize"
                  onClick={() => setDraftKind(kind)}
                  disabled={!convexEnabled || composeState.pending}
                >
                  {formatTeamMemoryKindLabel(kind)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Markdown Note
            </p>
            <Textarea
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
              placeholder="Add a short shared note for the team memory log."
              className="min-h-40"
              disabled={!convexEnabled || composeState.pending}
            />
          </div>

          <Button
            onClick={() => void handleSubmit()}
            disabled={!convexEnabled || composeState.pending || draftBody.trim().length === 0}
            className="w-full"
          >
            {composeState.pending ? "Logging..." : "Append Note"}
          </Button>

          {composeState.error ? (
            <p className="text-sm text-destructive">{composeState.error}</p>
          ) : null}
          {composeState.ok ? <p className="text-sm text-emerald-500">{composeState.ok}</p> : null}

          <div className="space-y-1 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
            <p>Project: {projectId ?? "none"}</p>
            <p>Team: {teamId ?? "none"}</p>
            <p>Entries loaded: {memoryRows.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-sm">Team Memory Log</CardTitle>
              <p className="text-xs text-muted-foreground">
                Realtime shared memory for project-relative decisions, handoffs, and results.
              </p>
            </div>
            {projectId ? (
              <Badge variant="outline" className="text-[10px] uppercase">
                {projectId}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex h-[calc(100%-3rem)] min-h-0 flex-col overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 rounded-md border p-3">
            <div className="space-y-3">
              {memoryRows.map((entry) => (
                <div key={entry.id} className="rounded-md border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {formatTeamMemoryKindLabel(entry.kind)}
                    </Badge>
                    <span className="font-medium">{describeTeamMemoryAuthor(entry)}</span>
                    <span className="text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                    {entry.taskId ? (
                      <Badge variant="outline" className="text-[10px] uppercase">
                        task {entry.taskId}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{entry.body}</p>
                </div>
              ))}
              {memoryRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No shared memory entries yet. Start by logging one durable note, decision, or
                  handoff for this team.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
