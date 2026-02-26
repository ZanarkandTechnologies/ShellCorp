"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/app-store";
import { gatewayBase, stateBase } from "@/lib/gateway-config";
import { OpenClawAdapter } from "@/lib/openclaw-adapter";
import type { AgentMemoryEntry } from "@/lib/openclaw-types";
import { useOfficeDataContext } from "@/providers/office-data-provider";

/**
 * AGENT MEMORY PANEL
 * ==================
 * Displays per-agent memory rows loaded directly from OpenClaw memory files.
 *
 * KEY CONCEPTS:
 * - Employee-triggered modal backed by app-store state
 * - Read-only memory row rendering from MEMORY.md + memory/*.md
 * - Tabbed MVP surface: list, search, graph placeholder
 *
 * USAGE:
 * - Render once in office simulation root
 * - Drive open/close using app-store memoryPanelEmployeeId
 *
 * MEMORY REFERENCES:
 * - MEM-0109
 */

type MemoryPanelTab = "list" | "search" | "graph";

function formatTimestamp(ts?: number): string {
  if (!ts) return "no timestamp";
  return new Date(ts).toLocaleString();
}

function extractAgentId(employeeId: string | null): string | null {
  if (!employeeId) return null;
  return employeeId.startsWith("employee-") ? employeeId.replace(/^employee-/, "") : employeeId;
}

function matchesQuery(entry: AgentMemoryEntry, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  return (
    entry.text.toLowerCase().includes(needle) ||
    entry.rawText.toLowerCase().includes(needle) ||
    entry.source.sourcePath.toLowerCase().includes(needle) ||
    (entry.memId ?? "").toLowerCase().includes(needle) ||
    entry.tags.some((tag) => tag.toLowerCase().includes(needle))
  );
}

function toUserFacingError(errorText: string): string {
  if (!errorText) return "";
  if (errorText.includes(":404")) return "Agent is not configured in OpenClaw yet.";
  if (errorText.includes("request_unreachable")) return "State bridge is unavailable. Check your OpenClaw/Vite bridge.";
  if (errorText.includes("memory_entries_unavailable")) return "Memory files are currently unavailable for this agent.";
  if (errorText.includes("request_failed")) return "Memory data request failed. Please retry.";
  return "Unable to load memory entries right now.";
}

export function AgentMemoryPanel() {
  const adapter = useMemo(() => new OpenClawAdapter(gatewayBase, stateBase), []);
  const { employees } = useOfficeDataContext();
  const memoryPanelEmployeeId = useAppStore((state) => state.memoryPanelEmployeeId);
  const setMemoryPanelEmployeeId = useAppStore((state) => state.setMemoryPanelEmployeeId);
  const [entries, setEntries] = useState<AgentMemoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<MemoryPanelTab>("list");
  const [reloadTick, setReloadTick] = useState(0);

  const employee = useMemo(
    () => employees.find((row) => row._id === memoryPanelEmployeeId) ?? null,
    [employees, memoryPanelEmployeeId],
  );
  const agentId = useMemo(() => extractAgentId(memoryPanelEmployeeId ? String(memoryPanelEmployeeId) : null), [memoryPanelEmployeeId]);

  useEffect(() => {
    if (!agentId) {
      setEntries([]);
      setIsLoading(false);
      setErrorText("");
      return;
    }
    let cancelled = false;
    const currentAgentId = agentId;
    async function load(): Promise<void> {
      setIsLoading(true);
      try {
        const payload = await adapter.listAgentMemoryEntries(currentAgentId);
        if (cancelled) return;
        setEntries(payload);
        setErrorText("");
      } catch (error) {
        if (cancelled) return;
        setEntries([]);
        setErrorText(error instanceof Error ? error.message : "memory_entries_load_failed");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [adapter, agentId, reloadTick]);

  const filteredEntries = useMemo(() => entries.filter((entry) => matchesQuery(entry, query)), [entries, query]);

  if (!memoryPanelEmployeeId) return null;

  return (
    <Dialog
      open={Boolean(memoryPanelEmployeeId)}
      onOpenChange={(open) => {
        if (!open) {
          setMemoryPanelEmployeeId(null);
          setQuery("");
          setActiveTab("list");
        }
      }}
    >
      <DialogContent className="min-w-[70vw] max-w-none h-[90vh] overflow-hidden p-0 z-[1200]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <span>{employee?.name ?? "Agent"} Memory</span>
            {agentId ? <Badge variant="outline">{agentId}</Badge> : null}
          </DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MemoryPanelTab)} className="flex h-full flex-col overflow-hidden px-6 pb-6">
          <TabsList className="mt-4 w-fit">
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="graph">Graph</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4 flex-1 overflow-hidden">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Memory Rows</CardTitle>
              </CardHeader>
              <CardContent className="h-[calc(100%-3rem)] overflow-hidden">
                <ScrollArea className="h-full rounded-md border p-3">
                  <div className="space-y-2">
                    {isLoading ? <p className="text-sm text-muted-foreground">Loading memory rows...</p> : null}
                    {!isLoading && entries.map((entry) => (
                      <div key={entry.id} className="rounded-md border p-2 text-sm">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{entry.source.sourcePath}</Badge>
                          <Badge variant="outline">L{entry.source.lineNumber}</Badge>
                          {entry.type ? <Badge variant="outline">{entry.type}</Badge> : null}
                          {entry.memId ? <Badge variant="outline">{entry.memId}</Badge> : null}
                          <span className="text-xs text-muted-foreground">{formatTimestamp(entry.ts)}</span>
                        </div>
                        <p className="break-words">{entry.text}</p>
                        {entry.tags.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {entry.tags.map((tag) => (
                              <Badge key={`${entry.id}-${tag}`} variant="outline">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {!isLoading && entries.length === 0 && !errorText ? (
                      <p className="text-sm text-muted-foreground">No memory entries found for this agent yet.</p>
                    ) : null}
                    {!isLoading && entries.length === 0 && errorText ? (
                      <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                        <p className="text-sm text-destructive">{toUserFacingError(errorText)}</p>
                        <Button size="sm" variant="outline" onClick={() => setReloadTick((value) => value + 1)}>
                          Retry
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="search" className="mt-4 flex-1 overflow-hidden">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Search Agent Memory</CardTitle>
              </CardHeader>
              <CardContent className="h-[calc(100%-3rem)] overflow-hidden space-y-3">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by text, tags, MEM id, or source path"
                />
                <ScrollArea className="h-[calc(100%-3rem)] rounded-md border p-3">
                  <div className="space-y-2">
                    {filteredEntries.map((entry) => (
                      <div key={`search-${entry.id}`} className="rounded-md border p-2 text-sm">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{entry.source.sourcePath}</Badge>
                          <Badge variant="outline">L{entry.source.lineNumber}</Badge>
                          {entry.memId ? <Badge variant="outline">{entry.memId}</Badge> : null}
                        </div>
                        <p className="break-words">{entry.text}</p>
                      </div>
                    ))}
                    {filteredEntries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No matches. Try `MEM-`, a tag, or a keyword.
                      </p>
                    ) : null}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="graph" className="mt-4 flex-1 overflow-hidden">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Memory Graph (Placeholder)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Coming soon: linked memory graph for relationship-aware recall.</p>
                <p>
                  Planned metadata extension points: <code>metadata.links[]</code>, confidence scores, and category facets.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
