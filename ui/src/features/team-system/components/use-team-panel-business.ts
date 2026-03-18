"use client";

/**
 * TEAM PANEL BUSINESS STATE
 * =========================
 * Purpose
 * - Keep Team Panel business builder and ledger orchestration out of the panel shell.
 *
 * KEY CONCEPTS:
 * - Business builder state is project-scoped and resets when the selected project changes.
 * - Ledger writes flow through the adapter and remain project-local.
 *
 * USAGE:
 * - Call from TeamPanel with resolved project/team context and refresh callback.
 *
 * MEMORY REFERENCES:
 * - MEM-0197
 * - MEM-0206
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeBusinessReadinessIssues,
  createBusinessBuilderDraft,
  projectToBusinessBuilderDraft,
  type BusinessBuilderDraft,
} from "@/lib/business-builder";
import type {
  ProjectAccountEventModel,
  ProjectAccountModel,
  ProjectModel,
  ProjectResourceModel,
} from "@/lib/openclaw-types";
import type { OpenClawAdapter } from "@/lib/openclaw-adapter";
import type { BusinessSlotKey } from "./business-flow/business-skill-library";

type TeamLike = {
  _id: string;
  businessReadiness?: {
    ready?: boolean;
    issues?: string[];
  };
} | null;

type LedgerEntryLike = {
  id: string;
  projectId: string;
  timestamp: string;
  type: "revenue" | "cost";
  amount: number;
  source: string;
  description: string;
};

type ExperimentLike = {
  status: string;
};

type ProjectLike = (ProjectModel & {
  experiments?: ExperimentLike[];
  ledger?: LedgerEntryLike[];
  account?: ProjectAccountModel;
  accountEvents?: ProjectAccountEventModel[];
  resources?: ProjectResourceModel[];
}) | null;

interface UseTeamPanelBusinessStateInput {
  adapter: OpenClawAdapter;
  refresh: () => Promise<void>;
  project: ProjectLike;
  team: TeamLike;
  globalMode: boolean;
}

interface ActionState {
  pending: boolean;
  error?: string;
  ok?: string;
}

export function useTeamPanelBusinessState({
  adapter,
  refresh,
  project,
  team,
  globalMode,
}: UseTeamPanelBusinessStateInput): {
  builderDraft: BusinessBuilderDraft;
  selectedBusinessSlot: BusinessSlotKey;
  setSelectedBusinessSlot: (slot: BusinessSlotKey) => void;
  trackingContext: string;
  setTrackingContext: (value: string) => void;
  builderSaveState: ActionState;
  ledgerActionState: ActionState;
  readinessIssues: Array<{ code: string; message: string }>;
  activeExperimentCount: number;
  hasBusinessConfig: boolean;
  accountEvents: ProjectAccountEventModel[];
  teamAccount: ProjectAccountModel;
  toggleCapabilitySkill: (slot: BusinessSlotKey, skillId: string) => void;
  handleSaveBusinessBuilder: () => Promise<void>;
  handleRecordAccountEvent: (input: {
    type: "credit" | "debit";
    amountCents: number;
    source: string;
    note?: string;
  }) => Promise<void>;
} {
  const [builderDraft, setBuilderDraft] = useState(() => createBusinessBuilderDraft("none"));
  const [builderSaveState, setBuilderSaveState] = useState<ActionState>({ pending: false });
  const [selectedBusinessSlot, setSelectedBusinessSlot] = useState<BusinessSlotKey>("measure");
  const [ledgerActionState, setLedgerActionState] = useState<ActionState>({ pending: false });
  const [trackingContext, setTrackingContext] = useState("");
  const lastBuilderProjectIdRef = useRef<string | null>(null);

  const hasBusinessConfig = Boolean(project?.businessConfig);

  const activeExperimentCount = useMemo(
    () => (project?.experiments ?? []).filter((entry) => entry.status === "running").length,
    [project?.experiments],
  );

  const readinessIssues = useMemo(
    () =>
      team?.businessReadiness?.issues && team.businessReadiness.issues.length > 0
        ? team.businessReadiness.issues.map((issue, idx) => ({
            code: `team-${idx}`,
            message: issue,
          }))
        : computeBusinessReadinessIssues(builderDraft),
    [builderDraft, team?.businessReadiness?.issues],
  );

  const accountEvents = useMemo<ProjectAccountEventModel[]>(() => {
    if (project?.accountEvents?.length) return project.accountEvents;
    const ledgerRows = [...(project?.ledger ?? [])].sort(
      (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
    );
    let running = 0;
    return ledgerRows.map((entry) => {
      running += entry.type === "revenue" ? entry.amount : -entry.amount;
      return {
        id: `ledger-derived-${entry.id}`,
        projectId: entry.projectId,
        accountId: `${entry.projectId}:account`,
        timestamp: entry.timestamp,
        type: (entry.type === "revenue" ? "credit" : "debit") as "credit" | "debit",
        amountCents: entry.amount,
        source: entry.source,
        note: entry.description,
        balanceAfterCents: running,
      };
    });
  }, [project?.accountEvents, project?.ledger]);

  const teamAccount = useMemo<ProjectAccountModel>(() => {
    if (project?.account) return project.account;
    const latest = accountEvents[accountEvents.length - 1];
    return {
      id: `${project?.id ?? "project"}:account`,
      projectId: project?.id ?? "project",
      currency: "USD",
      balanceCents: latest?.balanceAfterCents ?? 0,
      updatedAt: latest?.timestamp ?? new Date().toISOString(),
    };
  }, [accountEvents, project?.account, project?.id]);

  useEffect(() => {
    const nextProjectId = project?.id ?? null;
    if (lastBuilderProjectIdRef.current === nextProjectId) return;
    lastBuilderProjectIdRef.current = nextProjectId;
    setBuilderDraft(projectToBusinessBuilderDraft(project));
    setBuilderSaveState({ pending: false });
    setTrackingContext(project?.trackingContext ?? "");
    setSelectedBusinessSlot("measure");
    setLedgerActionState({ pending: false });
  }, [project]);

  function toggleCapabilitySkill(slot: BusinessSlotKey, skillId: string): void {
    setBuilderDraft((current) => {
      const existing = current.capabilitySkills[slot]
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const nextSet = new Set(existing);
      if (nextSet.has(skillId)) nextSet.delete(skillId);
      else nextSet.add(skillId);
      return {
        ...current,
        capabilitySkills: { ...current.capabilitySkills, [slot]: [...nextSet].join(", ") },
      };
    });
  }

  async function handleSaveBusinessBuilder(): Promise<void> {
    if (!project?.id) return;
    setBuilderSaveState({ pending: true });
    const saved = await adapter.saveBusinessBuilderConfig({
      projectId: project.id,
      businessType: builderDraft.businessType === "none" ? "custom" : builderDraft.businessType,
      capabilitySkills: builderDraft.capabilitySkills,
      resources: builderDraft.resources,
      trackingContext,
      source: "ui.team_panel.builder",
    });
    if (!saved.ok) {
      setBuilderSaveState({ pending: false, error: saved.error ?? "business_builder_save_failed" });
      return;
    }
    const targetTeamId = globalMode ? `team-${project.id}` : String(team?._id ?? "");
    if (targetTeamId) {
      const sync = await adapter.syncTeamBusinessSkillsToAgents({
        teamId: targetTeamId,
        mode: "replace_minimum",
      });
      if (!sync.ok) {
        await refresh();
        setBuilderSaveState({
          pending: false,
          error: `business_saved_but_skill_sync_failed:${sync.error ?? "unknown_error"}`,
        });
        return;
      }
      await refresh();
      setBuilderSaveState({
        pending: false,
        ok: `Saved. Equipped skills synced for ${sync.touchedAgents.length} agent(s).`,
      });
      return;
    }
    await refresh();
    setBuilderSaveState({ pending: false, ok: "Saved." });
  }

  async function handleRecordAccountEvent(input: {
    type: "credit" | "debit";
    amountCents: number;
    source: string;
    note?: string;
  }): Promise<void> {
    if (!project?.id) return;
    setLedgerActionState({ pending: true });
    const result = await adapter.recordProjectAccountEvent({
      projectId: project.id,
      type: input.type,
      amountCents: input.amountCents,
      source: input.source,
      note: input.note,
      currency: teamAccount.currency,
    });
    if (!result.ok) {
      setLedgerActionState({ pending: false, error: result.error ?? "ledger_update_failed" });
      return;
    }
    await refresh();
    setLedgerActionState({
      pending: false,
      ok: input.type === "credit" ? "Funding recorded." : "Spend recorded.",
    });
  }

  return {
    builderDraft,
    selectedBusinessSlot,
    setSelectedBusinessSlot,
    trackingContext,
    setTrackingContext,
    builderSaveState,
    ledgerActionState,
    readinessIssues,
    activeExperimentCount,
    hasBusinessConfig,
    accountEvents,
    teamAccount,
    toggleCapabilitySkill,
    handleSaveBusinessBuilder,
    handleRecordAccountEvent,
  };
}
