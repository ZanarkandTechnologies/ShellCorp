"use client";

/**
 * OFFICE DATA PROVIDER
 * ====================
 * React provider that loads, refreshes, and stabilizes the office snapshot for UI consumers.
 *
 * KEY CONCEPTS:
 * - Owns adapter wiring and provider state transitions.
 * - Delegates pure office-data derivation to `office-data-mapper.ts`.
 * - Applies stability guards so live-status updates do not rebroadcast unchanged office trees.
 *
 * USAGE:
 * - Wrap office surfaces with `OfficeDataProvider`.
 * - Read derived office state through `useOfficeDataContext()`.
 *
 * MEMORY REFERENCES:
 * - MEM-0175
 * - MEM-0176
 * - MEM-0194
 */

import React, {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAgentLiveStatuses } from "@/hooks/use-agent-live-status";
import type { OpenClawAdapter } from "@/lib/openclaw-adapter";
import type {
  AgentLiveStatus,
  FederatedTaskProvider,
  FederationProjectPolicy,
  OfficeSettingsModel,
  PendingApprovalModel,
  ProviderIndexProfile,
  UnifiedOfficeModel,
} from "@/lib/openclaw-types";
import {
  areStringArraysEqual,
  fallbackData,
  toOfficeData,
  type OfficeDataContextValue,
} from "@/providers/office-data-mapper";
import { stabilizeOfficeData } from "@/providers/office-data-stability";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";

const OfficeDataContext = createContext<OfficeDataContextValue | undefined>(undefined);

export type { OfficeDataContextValue };

export function OfficeDataProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const sharedAdapter = useOpenClawAdapter();
  const [value, setValue] = useState<OfficeDataContextValue>({ ...fallbackData(), isLoading: true });
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const adapterRef = useRef<OpenClawAdapter | null>(null);
  const cancelledRef = useRef(false);
  const latestUnifiedRef = useRef<UnifiedOfficeModel | null>(null);
  const latestApprovalsRef = useRef<PendingApprovalModel[]>([]);
  const latestLiveStatusSignatureRef = useRef("");
  const liveStatusByConvex = useAgentLiveStatuses(agentIds);
  const liveStatusByConvexRef = useRef<Record<string, AgentLiveStatus> | undefined>(undefined);

  useEffect(() => {
    liveStatusByConvexRef.current = liveStatusByConvex;
  }, [liveStatusByConvex]);

  const applyOfficeSettingsValue = useMemo(
    () => (settings: OfficeSettingsModel) => {
      const unified = latestUnifiedRef.current;
      if (!unified) {
        setValue((current) => ({ ...current, officeSettings: settings }));
        return;
      }
      const pendingApprovals = latestApprovalsRef.current;
      const statusByAgent =
        liveStatusByConvexRef.current && Object.keys(liveStatusByConvexRef.current).length > 0
          ? liveStatusByConvexRef.current
          : {};
      setValue((current) => {
        const next = stabilizeOfficeData(
          current,
          toOfficeData(unified, settings, pendingApprovals, statusByAgent),
        );
        if (next === current) return current;
        return {
          ...next,
          refresh: current.refresh,
          applyOfficeSettings: current.applyOfficeSettings,
          manualResync: current.manualResync,
          upsertFederationPolicy: current.upsertFederationPolicy,
          upsertProviderIndexProfile: current.upsertProviderIndexProfile,
        };
      });
    },
    [],
  );

  const load = React.useCallback(async (): Promise<void> => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    try {
      const [unified, pendingApprovals, officeSettings, configSnapshot] = await Promise.all([
        adapter.getUnifiedOfficeModel(),
        adapter.getPendingApprovals(),
        adapter.getOfficeSettings(),
        adapter.getConfigSnapshot(),
      ]);
      const nextAgentIds = [
        ...new Set([
          ...unified.runtimeAgents.map((item) => item.agentId),
          ...unified.configuredAgents.map((item) => item.agentId),
        ]),
      ];
      setAgentIds((current) =>
        areStringArraysEqual(current, nextAgentIds) ? current : nextAgentIds,
      );

      let statusByAgent: Record<string, AgentLiveStatus> = {};
      if (liveStatusByConvexRef.current && Object.keys(liveStatusByConvexRef.current).length > 0) {
        statusByAgent = liveStatusByConvexRef.current;
      } else {
        statusByAgent = await adapter.getAgentsLiveStatus(nextAgentIds);
      }
      latestLiveStatusSignatureRef.current = JSON.stringify(statusByAgent);

      latestUnifiedRef.current = unified;
      latestApprovalsRef.current = pendingApprovals;
      if (cancelledRef.current) return;
      setValue((current) => {
        const next = stabilizeOfficeData(
          current,
          toOfficeData(unified, officeSettings, pendingApprovals, statusByAgent, configSnapshot),
        );
        if (next === current) return current;
        return {
          ...next,
          refresh: current.refresh,
          applyOfficeSettings: current.applyOfficeSettings,
          manualResync: current.manualResync,
          upsertFederationPolicy: current.upsertFederationPolicy,
          upsertProviderIndexProfile: current.upsertProviderIndexProfile,
        };
      });
    } catch {
      if (cancelledRef.current) return;
      setValue((current) => ({
        ...fallbackData(),
        refresh: current.refresh,
        applyOfficeSettings: current.applyOfficeSettings,
        manualResync: current.manualResync,
        upsertFederationPolicy: current.upsertFederationPolicy,
        upsertProviderIndexProfile: current.upsertProviderIndexProfile,
      }));
    }
  }, []);

  useEffect(() => {
    if (!liveStatusByConvex || Object.keys(liveStatusByConvex).length === 0) return;
    const nextStatusSignature = JSON.stringify(liveStatusByConvex);
    if (latestLiveStatusSignatureRef.current === nextStatusSignature) return;
    const unified = latestUnifiedRef.current;
    if (!unified) return;
    const pendingApprovals = latestApprovalsRef.current;
    latestLiveStatusSignatureRef.current = nextStatusSignature;
    setValue((current) => {
      const next = stabilizeOfficeData(
        current,
        toOfficeData(unified, current.officeSettings, pendingApprovals, liveStatusByConvex),
      );
      if (next === current) return current;
      return {
        ...next,
        refresh: current.refresh,
        applyOfficeSettings: current.applyOfficeSettings,
        manualResync: current.manualResync,
        upsertFederationPolicy: current.upsertFederationPolicy,
        upsertProviderIndexProfile: current.upsertProviderIndexProfile,
      };
    });
  }, [liveStatusByConvex]);

  useEffect(() => {
    adapterRef.current = sharedAdapter;
    cancelledRef.current = false;

    async function refresh(): Promise<void> {
      await load();
    }

    async function manualResync(
      projectId: string,
      provider?: FederatedTaskProvider,
    ): Promise<{ ok: boolean; error?: string }> {
      const adapter = adapterRef.current;
      if (!adapter) return { ok: false, error: "adapter_unavailable" };
      const result = await adapter.manualResync(projectId, provider);
      await load();
      return result;
    }

    async function upsertFederationPolicy(
      policy: FederationProjectPolicy,
    ): Promise<{ ok: boolean; error?: string }> {
      const adapter = adapterRef.current;
      if (!adapter) return { ok: false, error: "adapter_unavailable" };
      const result = await adapter.upsertFederationPolicy(policy);
      await load();
      return { ok: result.ok, error: result.error };
    }

    async function upsertProviderIndexProfile(
      profile: ProviderIndexProfile,
    ): Promise<{ ok: boolean; error?: string }> {
      const adapter = adapterRef.current;
      if (!adapter) return { ok: false, error: "adapter_unavailable" };
      const result = await adapter.upsertProviderIndexProfile(profile);
      await load();
      return { ok: result.ok, error: result.error };
    }

    setValue((current) => ({
      ...current,
      refresh,
      applyOfficeSettings: applyOfficeSettingsValue,
      manualResync,
      upsertFederationPolicy,
      upsertProviderIndexProfile,
      isLoading: true,
    }));
    void load();

    return () => {
      cancelledRef.current = true;
    };
  }, [applyOfficeSettingsValue, load, sharedAdapter]);

  const memoizedValue = useMemo(() => value, [value]);

  return <OfficeDataContext.Provider value={memoizedValue}>{children}</OfficeDataContext.Provider>;
}

export function useOfficeDataContext(): OfficeDataContextValue {
  const context = useContext(OfficeDataContext);
  if (!context) {
    throw new Error("useOfficeDataContext must be used within OfficeDataProvider");
  }
  return context;
}
