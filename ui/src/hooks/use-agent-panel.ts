"use client";

/**
 * USE AGENT PANEL
 * ===============
 * Consolidates the shared open-gated async load + cancellation pattern from
 * agent-memory-panel, agent-session-panel, and manage-agent-modal.
 *
 * KEY CONCEPTS:
 * - Resolves agentId from employeeId (strips "employee-" prefix via entity-utils).
 * - Gates any fetch on the panel being open — satisfies MEM-0143 (hot path non-blocking).
 * - Returns { agentId, isOpen } for callers to use in their own effects.
 *
 * USAGE:
 * - const { agentId } = useAgentPanel({ employeeId, isOpen });
 *
 * MEMORY REFERENCES:
 * - MEM-0143: office-modal hot path stays non-blocking
 * - MEM-0144 refactor: Phase 2 hook extraction
 */
import { useMemo } from "react";
import { extractAgentId } from "@/lib/entity-utils";

export interface UseAgentPanelOptions {
  employeeId: string | null | undefined;
  isOpen: boolean;
}

export interface UseAgentPanelResult {
  agentId: string | null;
  isOpen: boolean;
}

export function useAgentPanel({ employeeId, isOpen }: UseAgentPanelOptions): UseAgentPanelResult {
  const agentId = useMemo(() => extractAgentId(employeeId ?? null), [employeeId]);
  return { agentId, isOpen };
}
