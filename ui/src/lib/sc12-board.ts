/**
 * SC12 BOARD HELPERS
 * ==================
 * Shared helpers for CEO board task normalization and UI demo fallback state.
 *
 * KEY CONCEPTS:
 * - SC12 uses shared board tasks as compact working memory for CEO proposal work.
 * - UI surfaces can fall back to curated mock tasks so the workflow stays inspectable before live data exists.
 *
 * USAGE:
 * - Imported by CEO Workbench, User Tasks, and menu badge counts.
 *
 * MEMORY REFERENCES:
 * - MEM-0155
 */

import type { PanelTask } from "@/features/team-system/components/team-panel-types";

export type Sc12BoardTask = PanelTask & {
  projectId: string;
  isMock?: boolean;
};

type CompanyBoardTaskRow = {
  taskId: string;
  projectId: string;
  title: string;
  status?: PanelTask["status"];
  ownerAgentId?: string;
  priority?: PanelTask["priority"];
  provider?: PanelTask["provider"];
  providerUrl?: string;
  syncState?: PanelTask["syncState"];
  syncError?: string;
  notes?: string;
  taskType?: PanelTask["taskType"];
  approvalState?: PanelTask["approvalState"];
  linkedSessionKey?: string;
  createdTeamId?: string;
  createdProjectId?: string;
  createdAt?: number;
  updatedAt?: number;
  dueAt?: number;
};

const MOCK_SC12_BOARD_TASKS: Sc12BoardTask[] = [
  {
    id: "mock-ceo-task-affiliate-lab",
    projectId: "ceo-board",
    title: "Affiliate Lab team proposal",
    status: "in_progress",
    ownerAgentId: "main",
    priority: "high",
    provider: "internal",
    syncState: "healthy",
    taskType: "team_proposal",
    approvalState: "pending_review",
    linkedSessionKey: "agent:main:affiliate-lab-proposal",
    createdAt: Date.parse("2026-03-12T13:15:00Z"),
    updatedAt: Date.parse("2026-03-12T15:45:00Z"),
    notes: [
      "# Goal",
      "Stand up a lean affiliate-content team that can ship 3 revenue-generating videos per week.",
      "",
      "# Current State",
      "- Founder brief captured for home-office buyers.",
      "- Role mix narrowed to PM + Researcher + Video Executor + Distributor.",
      "- Amazon payout windows and attribution limits checked.",
      "",
      "# Blockers",
      "- Need founder decision on whether to start with TikTok-only or TikTok + YouTube Shorts.",
      "",
      "# Next Step",
      "- Founder approve the proposal packet or request channel-scope changes.",
      "",
      "# Links",
      "- Brief doc: https://example.com/affiliate-lab-brief",
      "- Benchmark set: https://example.com/affiliate-lab-benchmarks",
    ].join("\n"),
    isMock: true,
  },
  {
    id: "mock-ceo-task-support-copilot",
    projectId: "ceo-board",
    title: "Support Copilot follow-up revision",
    status: "blocked",
    ownerAgentId: "main",
    priority: "medium",
    provider: "internal",
    syncState: "healthy",
    taskType: "team_proposal",
    approvalState: "changes_requested",
    linkedSessionKey: "agent:main:support-copilot-revision",
    createdAt: Date.parse("2026-03-11T10:00:00Z"),
    updatedAt: Date.parse("2026-03-12T11:20:00Z"),
    notes: [
      "Goal: Rework the support-ops team proposal around human-in-the-loop escalation.",
      "",
      "Current State:",
      "- Founder asked for lower risk and fewer autonomous replies.",
      "- Existing draft still assumes direct customer messaging for tier-1 issues.",
      "",
      "Blockers:",
      "- Need approval on which channels are allowed for auto-drafts.",
      "",
      "Next Step:",
      "- Rewrite the proposal summary and seed safer starting tasks.",
    ].join("\n"),
    isMock: true,
  },
  {
    id: "mock-ceo-task-saas-studio",
    projectId: "ceo-board",
    title: "SaaS Studio bootstrap executed",
    status: "done",
    ownerAgentId: "main",
    priority: "low",
    provider: "internal",
    syncState: "healthy",
    taskType: "team_proposal",
    approvalState: "executed",
    linkedSessionKey: "agent:main:saas-studio",
    createdTeamId: "team-saas-studio",
    createdProjectId: "saas-studio",
    createdAt: Date.parse("2026-03-10T09:00:00Z"),
    updatedAt: Date.parse("2026-03-12T09:40:00Z"),
    notes: [
      "Goal: Launch a SaaS experimentation team around agency proposal automation.",
      "",
      "Current State:",
      "- Founder approved.",
      "- Team created and business config applied.",
      "- Initial board seeded with onboarding, customer interviews, and pricing research tasks.",
      "",
      "Next Step:",
      "- Let heartbeat run the created team against the seeded board.",
      "",
      "Result:",
      "- Created team: team-saas-studio",
      "- Created project: saas-studio",
    ].join("\n"),
    isMock: true,
  },
];

export function normalizeSc12BoardTasks(
  rows: ReadonlyArray<CompanyBoardTaskRow> | undefined,
): Sc12BoardTask[] {
  return (rows ?? []).map((task) => ({
    id: task.taskId,
    projectId: task.projectId,
    title: task.title,
    status: task.status ?? "todo",
    ownerAgentId: task.ownerAgentId,
    priority: task.priority ?? "medium",
    provider: task.provider ?? "internal",
    providerUrl: task.providerUrl,
    syncState: task.syncState ?? "healthy",
    syncError: task.syncError,
    notes: task.notes,
    taskType: task.taskType,
    approvalState: task.approvalState,
    linkedSessionKey: task.linkedSessionKey,
    createdTeamId: task.createdTeamId,
    createdProjectId: task.createdProjectId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    dueAt: task.dueAt,
  }));
}

export function resolveSc12BoardTasks(params: {
  convexEnabled: boolean;
  hasLoaded: boolean;
  rows: ReadonlyArray<CompanyBoardTaskRow> | undefined;
}): { tasks: Sc12BoardTask[]; isMock: boolean } {
  const liveTasks = normalizeSc12BoardTasks(params.rows);
  if (liveTasks.length > 0) return { tasks: liveTasks, isMock: false };
  if (!params.convexEnabled || params.hasLoaded) {
    return { tasks: MOCK_SC12_BOARD_TASKS, isMock: true };
  }
  return { tasks: [], isMock: false };
}

export function countSc12PendingReviewTasks(tasks: ReadonlyArray<Sc12BoardTask>): number {
  return tasks.filter(
    (task) => task.approvalState === "pending_review" || task.approvalState === "changes_requested",
  ).length;
}
