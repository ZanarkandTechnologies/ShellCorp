"use client";

import { useCallback, useEffect, useState } from "react";
import { useChatStore } from "@/features/chat-system/chat-store";
import { useAppStore } from "@/lib/app-store";
import { stateBase } from "@/lib/gateway-config";
import type { AgentCardModel, SessionRowModel } from "@/lib/openclaw-types";
import { useGateway } from "@/providers/gateway-provider";

type AgentsListResult = { agents: Array<{ id: string; name?: string; identity?: { name?: string } }> };
type SessionsListResult = { sessions: Array<{ key: string; label?: string; displayName?: string; surface?: string; updatedAt?: number | null; sessionId?: string }> };
type SessionsResolveResult = { ok?: boolean; key?: string };
type SessionsDeleteResult = { ok?: boolean; deleted?: boolean };

function mapAgentToCard(entry: AgentsListResult["agents"][number]): AgentCardModel {
    const displayName = entry.name ?? entry.identity?.name ?? entry.id;
    return {
        agentId: entry.id,
        displayName,
        workspacePath: "",
        agentDir: "",
        sandboxMode: "off",
        toolPolicy: { allow: [], deny: [] },
        sessionCount: 0,
    };
}

function mapSessionToRow(agentId: string, entry: SessionsListResult["sessions"][number]): SessionRowModel {
    return {
        agentId,
        sessionKey: entry.key,
        sessionId: entry.sessionId,
        updatedAt: entry.updatedAt ?? undefined,
        channel: entry.surface,
        peerLabel: entry.label ?? entry.displayName,
    };
}

function parseAgentIdFromKey(key: string): string {
    const parts = key.split(":");
    return parts[1] ?? "";
}

function mapRowsToThreads(agentId: string, rows: SessionRowModel[]) {
    return rows.map((row) => ({
        _id: row.sessionKey,
        title: row.peerLabel || row.channel || row.sessionKey,
        agentId,
        sessionKey: row.sessionKey,
    }));
}

export function useChatThreads(): {
    threads: Array<{ _id: string; title?: string; parentThreadId?: string; agentId?: string; sessionKey?: string; isPendingNew?: boolean }>;
    subthreadsMap: Record<string, Array<{ _id: string; title?: string; parentThreadId?: string; agentId?: string; sessionKey?: string; isPendingNew?: boolean }>>;
    threadId: string | null;
    setThreadId: (threadId: string) => void;
    handleNewThread: () => void;
    handleDeleteThread: (threadId: string) => Promise<{ ok: boolean; error?: string }>;
    isCreatingThread: boolean;
    agents: AgentCardModel[];
    selectedAgentId: string | null;
    setSelectedAgentId: (agentId: string | null) => void;
} {
    const threads = useChatStore((state) => state.threads);
    const setThreads = useChatStore((state) => state.setThreads);
    const selectedSessionKey = useAppStore((state) => state.selectedSessionKey);
    const setSelectedSessionKey = useAppStore((state) => state.setSelectedSessionKey);
    const selectedAgentId = useAppStore((state) => state.selectedAgentId);
    const setSelectedAgentId = useAppStore((state) => state.setSelectedAgentId);
    const messagesByThread = useChatStore((state) => state.messagesByThread);
    const setMessagesByThread = useChatStore((state) => state.setMessagesByThread);
    const currentEmployeeId = useChatStore((state) => state.currentEmployeeId);
    const [agents, setAgents] = useState<AgentCardModel[]>([]);
    const [sessions, setSessions] = useState<SessionRowModel[]>([]);
    const [isCreatingThread, setIsCreatingThread] = useState(false);
    const { client } = useGateway();

    const setThreadId = useCallback(
        (nextThreadId: string): void => {
            setSelectedSessionKey(nextThreadId);
        },
        [setSelectedSessionKey],
    );

    const resolveSessionKeyForAgent = useCallback(
        async (agentId: string): Promise<string | null> => {
            const fallbackKey = `agent:${agentId}:main`;
            try {
                const resolved = await client.request<SessionsResolveResult>("sessions.resolve", {
                    key: fallbackKey,
                    includeGlobal: false,
                    includeUnknown: false,
                });
                const key = typeof resolved?.key === "string" ? resolved.key.trim() : "";
                return key || fallbackKey;
            } catch {
                return fallbackKey;
            }
        },
        [client],
    );

    const syncSessionsForAgent = useCallback(
        async (agentId: string): Promise<Array<{ _id: string; title?: string; parentThreadId?: string; agentId?: string; sessionKey?: string; isPendingNew?: boolean }>> => {
            const res = await client.request<SessionsListResult>("sessions.list", { agentId });
            const raw = Array.isArray(res?.sessions) ? res.sessions : [];
            const rows = raw.filter((s) => parseAgentIdFromKey(s.key) === agentId).map((s) => mapSessionToRow(agentId, s));
            const mappedThreads = mapRowsToThreads(agentId, rows);
            setSessions(rows);
            setThreads(mappedThreads);
            return mappedThreads;
        },
        [client, setThreads],
    );

    useEffect(() => {
        let cancelled = false;
        async function loadAgents(): Promise<void> {
            try {
                const res = await client.request<AgentsListResult>("agents.list", {});
                if (cancelled) return;
                const rows = Array.isArray(res?.agents) ? res.agents.map(mapAgentToCard) : [];
                setAgents(rows);
                if (!selectedAgentId && rows.length > 0) {
                    setSelectedAgentId(rows[0].agentId);
                }
            } catch {
                if (!cancelled) setAgents([]);
            }
        }
        void loadAgents();
        return () => {
            cancelled = true;
        };
    }, [client, selectedAgentId, setSelectedAgentId]);

    useEffect(() => {
        if (!selectedAgentId) {
            setSessions([]);
            setThreads([]);
            setSelectedSessionKey(null);
            return;
        }
        const activeAgentId = selectedAgentId;
        let cancelled = false;
        async function loadSessions(): Promise<void> {
            try {
                const mappedThreads = await syncSessionsForAgent(activeAgentId);
                if (cancelled) return;
                const sessionAgentId = selectedSessionKey ? parseAgentIdFromKey(selectedSessionKey) : "";
                const selectedStillValid = Boolean(selectedSessionKey && mappedThreads.some((thread) => thread._id === selectedSessionKey));
                if (mappedThreads.length > 0) {
                    if (!selectedStillValid || sessionAgentId !== activeAgentId) {
                        setSelectedSessionKey(mappedThreads[0]._id);
                    }
                    return;
                }

                const resolvedKey = await resolveSessionKeyForAgent(activeAgentId);
                if (cancelled) return;
                if (resolvedKey) {
                    setThreads([{ _id: resolvedKey, title: "New Chat", agentId: activeAgentId, sessionKey: resolvedKey, isPendingNew: true }]);
                    setSelectedSessionKey(resolvedKey);
                } else {
                    setThreads([]);
                    setSelectedSessionKey(null);
                }
            } catch {
                if (cancelled) return;
                setSessions([]);
                setThreads([]);
                if (selectedSessionKey && parseAgentIdFromKey(selectedSessionKey) === activeAgentId) {
                    setSelectedSessionKey(null);
                }
            }
        }
        void loadSessions();
        return () => {
            cancelled = true;
        };
    }, [resolveSessionKeyForAgent, selectedAgentId, selectedSessionKey, setSelectedSessionKey, setThreads, syncSessionsForAgent]);

    useEffect(() => {
        if (!currentEmployeeId) return;
        if (selectedSessionKey) return;
        if (threads.length === 0) return;
        setSelectedSessionKey(threads[0]._id);
    }, [currentEmployeeId, selectedSessionKey, setSelectedSessionKey, threads]);

    const handleNewThread = useCallback((): void => {
        if (!selectedAgentId || isCreatingThread || currentEmployeeId) return;
        setIsCreatingThread(true);
        void (async () => {
            let currentSessionKey = selectedSessionKey;
            if (!currentSessionKey || parseAgentIdFromKey(currentSessionKey) !== selectedAgentId) {
                currentSessionKey = sessions[0]?.sessionKey ?? (await resolveSessionKeyForAgent(selectedAgentId));
            }
            if (!currentSessionKey) {
                setIsCreatingThread(false);
                return;
            }
            setSelectedSessionKey(currentSessionKey);
            await client.request("chat.send", { sessionKey: currentSessionKey, message: "/new", deliver: false });
            const mappedThreads = await syncSessionsForAgent(selectedAgentId);
            if (mappedThreads.length > 0) {
                setSelectedSessionKey(mappedThreads[0]._id);
                return;
            }
            const resolvedKey = await resolveSessionKeyForAgent(selectedAgentId);
            if (resolvedKey) {
                setThreads([{ _id: resolvedKey, title: "New Chat", agentId: selectedAgentId, sessionKey: resolvedKey, isPendingNew: true }]);
                setSelectedSessionKey(resolvedKey);
            }
        })()
            .catch(() => {
                // Keep existing list/state when creating a thread fails.
            })
            .finally(() => setIsCreatingThread(false));
    }, [
        client,
        currentEmployeeId,
        isCreatingThread,
        resolveSessionKeyForAgent,
        selectedAgentId,
        selectedSessionKey,
        sessions,
        setSelectedSessionKey,
        setThreads,
        syncSessionsForAgent,
    ]);

    const handleDeleteThread = useCallback(
        async (deleteThreadId: string): Promise<{ ok: boolean; error?: string }> => {
            // #region agent log
            fetch("http://127.0.0.1:7441/ingest/6430476e-9d36-400f-ba65-8018f53bec18", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8dc679" },
                body: JSON.stringify({
                    sessionId: "8dc679",
                    location: "use-chat-threads.ts:handleDeleteThread-entry",
                    message: "handleDeleteThread called",
                    data: { deleteThreadId },
                    timestamp: Date.now(),
                    hypothesisId: "H5",
                }),
            }).catch(() => {});
            // #endregion
            if (!deleteThreadId) return { ok: false, error: "session_delete_invalid_key" };
            try {
            let deleteResult: SessionsDeleteResult | null = null;
            try {
                deleteResult = await client.request<SessionsDeleteResult>("sessions.delete", {
                    key: deleteThreadId,
                    deleteTranscript: true,
                });
                // #region agent log
                fetch("http://127.0.0.1:7441/ingest/6430476e-9d36-400f-ba65-8018f53bec18", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8dc679" },
                    body: JSON.stringify({
                        sessionId: "8dc679",
                        location: "use-chat-threads.ts:handleDeleteThread-gateway-result",
                        message: "sessions.delete gateway response",
                        data: { deleteResult, ok: deleteResult?.ok },
                        timestamp: Date.now(),
                        hypothesisId: "H5",
                    }),
                }).catch(() => {});
                // #endregion
            } catch (wsError) {
                const errMsg = wsError instanceof Error ? wsError.message : String(wsError);
                // #region agent log
                fetch("http://127.0.0.1:7441/ingest/6430476e-9d36-400f-ba65-8018f53bec18", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8dc679" },
                    body: JSON.stringify({
                        sessionId: "8dc679",
                        runId: "pre-fix-2",
                        hypothesisId: "H6",
                        location: "use-chat-threads.ts:handleDeleteThread-ws-catch",
                        message: "sessions.delete ws error observed",
                        data: {
                            errMsg,
                            hasWebchatToken: errMsg.toLowerCase().includes("webchat"),
                            hasWindow: typeof window !== "undefined",
                            stateBase,
                        },
                        timestamp: Date.now(),
                    }),
                }).catch(() => {});
                // #endregion
                throw wsError;
            }
            if (deleteResult?.ok === false) {
                return { ok: false, error: "session_delete_failed" };
            }
            const targetAgentId = parseAgentIdFromKey(deleteThreadId);
            const refreshAgentId = selectedAgentId || targetAgentId;
            if (!refreshAgentId) {
                return { ok: false, error: "session_delete_agent_missing" };
            }
            const nextMessagesByThread = { ...messagesByThread };
            delete nextMessagesByThread[deleteThreadId];
            setMessagesByThread(nextMessagesByThread);
            const mappedThreads = await syncSessionsForAgent(refreshAgentId);
            if (mappedThreads.length === 0) {
                const resolvedKey = await resolveSessionKeyForAgent(refreshAgentId);
                if (resolvedKey) {
                    setThreads([{ _id: resolvedKey, title: "New Chat", agentId: refreshAgentId, sessionKey: resolvedKey, isPendingNew: true }]);
                    setSelectedSessionKey(resolvedKey);
                } else {
                    setSelectedSessionKey(null);
                }
            } else if (selectedSessionKey === deleteThreadId || !mappedThreads.some((thread) => thread._id === selectedSessionKey)) {
                setSelectedSessionKey(mappedThreads[0]._id);
            }
            return { ok: true };
        } catch (error) {
                // #region agent log
                fetch("http://127.0.0.1:7441/ingest/6430476e-9d36-400f-ba65-8018f53bec18", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8dc679" },
                    body: JSON.stringify({
                        sessionId: "8dc679",
                        location: "use-chat-threads.ts:handleDeleteThread-catch",
                        message: "handleDeleteThread threw",
                        data: { error: String(error), message: error instanceof Error ? error.message : "" },
                        timestamp: Date.now(),
                        hypothesisId: "H5",
                    }),
                }).catch(() => {});
                // #endregion
                return {
                    ok: false,
                    error: error instanceof Error ? error.message : "session_delete_failed",
                };
            }
        },
        [
            client,
            messagesByThread,
            resolveSessionKeyForAgent,
            selectedAgentId,
            selectedSessionKey,
            setMessagesByThread,
            setSelectedSessionKey,
            setThreads,
            syncSessionsForAgent,
        ],
    );

    return {
        threads,
        subthreadsMap: {},
        threadId: selectedSessionKey,
        setThreadId,
        handleNewThread,
        handleDeleteThread,
        isCreatingThread,
        agents,
        selectedAgentId,
        setSelectedAgentId,
    };
}

