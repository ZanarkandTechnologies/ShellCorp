/**
 * REVIEW BOARD HELPERS
 * ====================
 * Shared helpers for CEO board task normalization and UI demo fallback state.
 *
 * KEY CONCEPTS:
 * - Review surfaces use shared board tasks as compact working memory for planning and human review.
 * - UI surfaces can fall back to curated mock tasks so the workflow stays inspectable before live data exists.
 *
 * USAGE:
 * - Imported by CEO Workbench, User Tasks, and menu badge counts.
 *
 * MEMORY REFERENCES:
 * - MEM-0155
 */

import type { PanelTask } from "@/features/team-system/components/team-panel-types";

export type ReviewBoardTask = PanelTask & {
  projectId: string;
  isMock?: boolean;
};

type CompanyBoardTaskRow = {
  taskId: string;
  projectId: string;
  title: string;
  status?: string;
  ownerAgentId?: string;
  priority?: string;
  provider?: string;
  providerUrl?: string;
  syncState?: string;
  syncError?: string;
  notes?: string;
  approvalState?: string;
  linkedSessionKey?: string;
  createdTeamId?: string;
  createdProjectId?: string;
  createdAt?: number;
  updatedAt?: number;
  dueAt?: number;
};

const MOCK_REVIEW_BOARD_TASKS: ReviewBoardTask[] = [
  {
    id: "mock-ceo-task-affiliate-lab",
    projectId: "ceo-board",
    title: "Plan affiliate lab launch",
    status: "review",
    ownerAgentId: "main",
    priority: "high",
    provider: "internal",
    syncState: "healthy",
    approvalState: "pending_review",
    linkedSessionKey: "agent:main:affiliate-lab-planning",
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
      "- Human review the planning notes and either approve the lane move or request changes.",
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
    title: "Revise support copilot plan",
    status: "review",
    ownerAgentId: "main",
    priority: "medium",
    provider: "internal",
    syncState: "healthy",
    approvalState: "changes_requested",
    linkedSessionKey: "agent:main:support-copilot-revision",
    createdAt: Date.parse("2026-03-11T10:00:00Z"),
    updatedAt: Date.parse("2026-03-12T11:20:00Z"),
    notes: [
      "Goal: Rework the support-ops plan around human-in-the-loop escalation.",
      "",
      "Current State:",
      "- Founder asked for lower risk and fewer autonomous replies.",
      "- Existing draft still assumes direct customer messaging for tier-1 issues.",
      "",
      "Blockers:",
      "- Need approval on which channels are allowed for auto-drafts.",
      "",
      "Next Step:",
      "- Rewrite the task plan and seed safer starting tasks.",
    ].join("\n"),
    isMock: true,
  },
  {
    id: "mock-ceo-task-saas-studio",
    projectId: "ceo-board",
    title: "SaaS Studio bootstrap finished",
    status: "done",
    ownerAgentId: "main",
    priority: "low",
    provider: "internal",
    syncState: "healthy",
    approvalState: "executed",
    linkedSessionKey: "agent:main:saas-studio",
    createdTeamId: "team-saas-studio",
    createdProjectId: "saas-studio",
    createdAt: Date.parse("2026-03-10T09:00:00Z"),
    updatedAt: Date.parse("2026-03-12T09:40:00Z"),
    notes: [
      "Goal: Launch a SaaS experimentation team around agency workflow automation.",
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

export function normalizeReviewBoardTasks(
  rows: ReadonlyArray<CompanyBoardTaskRow> | undefined,
): ReviewBoardTask[] {
  return (rows ?? []).map((task) => ({
    id: task.taskId,
    projectId: task.projectId,
    title: task.title,
    status:
      task.status === "in_progress" ||
      task.status === "review" ||
      task.status === "blocked" ||
      task.status === "done"
        ? task.status
        : "todo",
    ownerAgentId: task.ownerAgentId,
    priority: task.priority === "low" || task.priority === "high" ? task.priority : "medium",
    provider:
      task.provider === "notion" || task.provider === "vibe" || task.provider === "linear"
        ? task.provider
        : "internal",
    providerUrl: task.providerUrl,
    syncState:
      task.syncState === "pending" || task.syncState === "conflict" || task.syncState === "error"
        ? task.syncState
        : "healthy",
    syncError: task.syncError,
    notes: task.notes,
    approvalState:
      task.approvalState === "pending_review" ||
      task.approvalState === "approved" ||
      task.approvalState === "rejected" ||
      task.approvalState === "changes_requested" ||
      task.approvalState === "executed"
        ? task.approvalState
        : "draft",
    linkedSessionKey: task.linkedSessionKey,
    createdTeamId: task.createdTeamId,
    createdProjectId: task.createdProjectId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    dueAt: task.dueAt,
  }));
}

export function resolveReviewBoardTasks(params: {
  convexEnabled: boolean;
  hasLoaded: boolean;
  rows: ReadonlyArray<CompanyBoardTaskRow> | undefined;
}): { tasks: ReviewBoardTask[]; isMock: boolean } {
  const liveTasks = normalizeReviewBoardTasks(params.rows);
  if (liveTasks.length > 0) return { tasks: liveTasks, isMock: false };
  if (!params.convexEnabled || params.hasLoaded) {
    return { tasks: MOCK_REVIEW_BOARD_TASKS, isMock: true };
  }
  return { tasks: [], isMock: false };
}

export function countReviewLaneTasks(tasks: ReadonlyArray<ReviewBoardTask>): number {
  return tasks.filter((task) => task.status === "review").length;
}
