"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/app-store";
import { gatewayBase, stateBase } from "@/lib/gateway-config";
import { OpenClawAdapter } from "@/lib/openclaw-adapter";
import type { AgentCardModel, SessionRowModel, SessionTimelineModel } from "@/lib/openclaw-types";

function fmtTs(ts?: number): string {
  if (!ts) return "n/a";
  return new Date(ts).toLocaleString();
}

export function AgentSessionPanel() {
  const isOpen = useAppStore((state) => state.isAgentSessionPanelOpen);
  const setIsOpen = useAppStore((state) => state.setIsAgentSessionPanelOpen);
  const selectedAgentId = useAppStore((state) => state.selectedAgentId);
  const setSelectedAgentId = useAppStore((state) => state.setSelectedAgentId);
  const selectedSessionKey = useAppStore((state) => state.selectedSessionKey);
  const setSelectedSessionKey = useAppStore((state) => state.setSelectedSessionKey);

  const adapter = useMemo(() => new OpenClawAdapter(gatewayBase, stateBase), []);
  const [runtimeAgents, setRuntimeAgents] = useState<AgentCardModel[]>([]);
  const [sessions, setSessions] = useState<SessionRowModel[]>([]);
  const [timeline, setTimeline] = useState<SessionTimelineModel | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function loadUnified(): Promise<void> {
      try {
        const unified = await adapter.getUnifiedOfficeModel();
        if (cancelled) return;
        setRuntimeAgents(unified.runtimeAgents);
        if (!selectedAgentId && unified.runtimeAgents.length > 0) {
          setSelectedAgentId(unified.runtimeAgents[0].agentId);
        }
      } catch (error) {
        if (!cancelled) setErrorText(error instanceof Error ? error.message : "openclaw_unavailable");
      }
    }
    void loadUnified();
    const timer = setInterval(() => void loadUnified(), 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [adapter, isOpen, selectedAgentId, setSelectedAgentId]);

  useEffect(() => {
    if (!isOpen || !selectedAgentId) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    async function loadSessions(): Promise<void> {
      try {
        const rows = await adapter.listSessions(selectedAgentId);
        if (cancelled) return;
        setSessions(rows);
        if (!selectedSessionKey && rows.length > 0) {
          setSelectedSessionKey(rows[0].sessionKey);
        }
      } catch (error) {
        if (!cancelled) setErrorText(error instanceof Error ? error.message : "sessions_load_failed");
      }
    }
    void loadSessions();
    return () => {
      cancelled = true;
    };
  }, [adapter, isOpen, selectedAgentId, selectedSessionKey, setSelectedSessionKey]);

  useEffect(() => {
    if (!isOpen || !selectedAgentId || !selectedSessionKey) {
      setTimeline(null);
      return;
    }
    let cancelled = false;
    async function loadTimeline(): Promise<void> {
      try {
        const next = await adapter.getSessionTimeline(selectedAgentId, selectedSessionKey);
        if (!cancelled) setTimeline(next);
      } catch (error) {
        if (!cancelled) setErrorText(error instanceof Error ? error.message : "timeline_load_failed");
      }
    }
    void loadTimeline();
    return () => {
      cancelled = true;
    };
  }, [adapter, isOpen, selectedAgentId, selectedSessionKey]);

  async function sendMessage(): Promise<void> {
    const text = messageDraft.trim();
    if (!selectedAgentId || !selectedSessionKey || !text) return;
    setIsSending(true);
    setStatusText("");
    try {
      const result = await adapter.sendMessage({
        agentId: selectedAgentId,
        sessionKey: selectedSessionKey,
        message: text,
      });
      if (!result.ok) {
        setStatusText(result.error ?? "message_send_failed");
      } else {
        setStatusText(`Message sent${result.eventId ? ` (${result.eventId})` : ""}.`);
        setMessageDraft("");
        const nextTimeline = await adapter.getSessionTimeline(selectedAgentId, selectedSessionKey);
        setTimeline(nextTimeline);
      }
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "message_send_failed");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="min-w-[70vw] max-w-none h-[90vh] overflow-hidden p-0 z-[1200]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Agent Session Panel</DialogTitle>
          {errorText ? <p className="text-xs text-destructive">{errorText}</p> : null}
        </DialogHeader>

        <div className="h-full overflow-hidden px-6 pb-6">
          <div className="mb-3 mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm"
              value={selectedAgentId ?? ""}
              onChange={(event) => setSelectedAgentId(event.target.value || null)}
            >
              {runtimeAgents.map((agent) => (
                <option key={agent.agentId} value={agent.agentId}>
                  {agent.displayName} ({agent.agentId})
                </option>
              ))}
            </select>
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm"
              value={selectedSessionKey ?? ""}
              onChange={(event) => setSelectedSessionKey(event.target.value || null)}
            >
              <option value="">Select session</option>
              {sessions.map((session) => (
                <option key={session.sessionKey} value={session.sessionKey}>
                  {session.sessionKey}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Session Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[58vh] rounded-md border p-2">
                  <ul className="space-y-1 text-sm">
                    {(timeline?.events ?? []).map((event, index) => (
                      <li key={`${event.ts}-${index}`}>
                        {fmtTs(event.ts)} · {event.type} · {event.role} · {event.text}
                      </li>
                    ))}
                    {(timeline?.events.length ?? 0) === 0 ? (
                      <li className="text-muted-foreground">No timeline events yet.</li>
                    ) : null}
                  </ul>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Chat Bridge</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  className="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  placeholder="Send message to selected session..."
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    disabled={isSending || !selectedAgentId || !selectedSessionKey || !messageDraft.trim()}
                    onClick={() => void sendMessage()}
                  >
                    {isSending ? "Sending..." : "Send"}
                  </Button>
                  <span className="text-xs text-muted-foreground">{statusText}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

