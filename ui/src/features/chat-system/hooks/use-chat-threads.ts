"use client";

import { useCallback, useEffect, useState } from "react";
import { useChatStore } from "@/features/chat-system/chat-store";
import { useAppStore } from "@/lib/app-store";
import type { AgentCardModel, SessionRowModel } from "@/lib/openclaw-types";
import { useGateway } from "@/providers/gateway-provider";

type AgentsListResult = { agents: Array<{ id: string; name?: string; identity?: { name?: string } }> };
type SessionsListResult = { sessions: Array<{ key: string; label?: string; displayName?: string; surface?: string; updatedAt?: number | null; sessionId?: string }> };

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

export function useChatThreads(): {
    threads: Array<{ _id: string; title?: string; parentThreadId?: string; agentId?: string; sessionKey?: string; isPendingNew?: boolean }>;
    subthreadsMap: Record<string, Array<{ _id: string; title?: string; parentThreadId?: string; agentId?: string; sessionKey?: string; isPendingNew?: boolean }>>;
    threadId: string | null;
    setThreadId: (threadId: string) => void;
    handleNewThread: () => void;
    handleDeleteThread: (threadId: string) => void;
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
            return;
        }
        let cancelled = false;
        async function loadSessions(): Promise<void> {
            try {
                const res = await client.request<SessionsListResult>("sessions.list", { agentId: selectedAgentId });
                if (cancelled) return;
                const raw = Array.isArray(res?.sessions) ? res.sessions : [];
                const rows = raw
                    .filter((s) => parseAgentIdFromKey(s.key) === selectedAgentId)
                    .map((s) => mapSessionToRow(selectedAgentId, s));
                setSessions(rows);
                const mappedThreads = rows.map((row) => ({
                    _id: row.sessionKey,
                    title: row.peerLabel || row.channel || row.sessionKey,
                    agentId: selectedAgentId,
                    sessionKey: row.sessionKey,
                }));
                setThreads(mappedThreads);
                if (!selectedSessionKey && mappedThreads.length > 0) {
                    setSelectedSessionKey(mappedThreads[0]._id);
                } else if (selectedSessionKey && !mappedThreads.some((thread) => thread._id === selectedSessionKey)) {
                    setSelectedSessionKey(mappedThreads[0]?._id ?? null);
                }
            } catch {
                if (cancelled) return;
                setSessions([]);
                setThreads([]);
            }
        }
        void loadSessions();
        return () => {
            cancelled = true;
        };
    }, [client, selectedAgentId, selectedSessionKey, setSelectedSessionKey, setThreads]);

    useEffect(() => {
        if (!currentEmployeeId) return;
        if (selectedSessionKey) return;
        if (threads.length === 0) return;
        setSelectedSessionKey(threads[0]._id);
    }, [currentEmployeeId, selectedSessionKey, setSelectedSessionKey, threads]);

    const handleNewThread = useCallback((): void => {
        if (!selectedAgentId || isCreatingThread || currentEmployeeId) return;
        setIsCreatingThread(true);
        const currentSessionKey = selectedSessionKey || sessions[0]?.sessionKey;
        if (!currentSessionKey) {
            const placeholder = `ui:${selectedAgentId}:${Date.now()}`;
            setThreads([{ _id: placeholder, title: "New Chat", agentId: selectedAgentId, sessionKey: placeholder, isPendingNew: true }, ...threads]);
            setSelectedSessionKey(placeholder);
            setIsCreatingThread(false);
            return;
        }
        void client
            .request("chat.send", { sessionKey: currentSessionKey, message: "/new", deliver: false })
            .then(async () => {
                const res = await client.request<SessionsListResult>("sessions.list", { agentId: selectedAgentId });
                const raw = Array.isArray(res?.sessions) ? res.sessions : [];
                const rows = raw
                    .filter((s) => parseAgentIdFromKey(s.key) === selectedAgentId)
                    .map((s) => mapSessionToRow(selectedAgentId, s));
                setSessions(rows);
                const mappedThreads = rows.map((row) => ({
                    _id: row.sessionKey,
                    title: row.peerLabel || row.channel || row.sessionKey,
                    agentId: selectedAgentId,
                    sessionKey: row.sessionKey,
                }));
                setThreads(mappedThreads);
                setSelectedSessionKey(mappedThreads[0]?._id ?? null);
            })
            .finally(() => setIsCreatingThread(false));
    }, [client, currentEmployeeId, isCreatingThread, selectedAgentId, selectedSessionKey, sessions, setSelectedSessionKey, setThreads, threads]);

    const handleDeleteThread = useCallback(
        (deleteThreadId: string): void => {
            const nextThreads = threads.filter((thread) => thread._id !== deleteThreadId);
            setThreads(nextThreads);
            if (selectedSessionKey === deleteThreadId) {
                setSelectedSessionKey(nextThreads[0]?._id ?? null);
            }
            if (messagesByThread[deleteThreadId]) {
                const nextMessagesByThread = { ...messagesByThread };
                delete nextMessagesByThread[deleteThreadId];
                setMessagesByThread(nextMessagesByThread);
            }
        },
        [messagesByThread, selectedSessionKey, setMessagesByThread, setSelectedSessionKey, setThreads, threads],
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

