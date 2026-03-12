/**
 * TEAM PROPOSAL HEURISTICS
 * ========================
 * Deterministic helpers for the SC12 CEO-led team proposal flow.
 *
 * KEY CONCEPTS:
 * - Validates the minimum idea gate before proposal creation
 * - Synthesizes a proposal packet from a short business brief
 * - Flags unsupported role structures before approval/execution
 *
 * USAGE:
 * - Build proposal drafts in the CLI/team proposal flow
 * - Re-check execution support before creating a team
 *
 * MEMORY REFERENCES:
 * - MEM-0153
 */

import type {
  AgentRole,
  TeamProposalBoardItem,
  TeamProposalBusinessConfig,
  TeamProposalIdeaBrief,
  TeamProposalModel,
  TeamProposalRoleRecommendation,
} from "./openclaw-types.js";

export type TeamProposalDraftInput = {
  requestedBy?: string;
  sourceAgentId?: string;
  businessType: TeamProposalBusinessConfig["businessType"];
  ideaBrief: TeamProposalIdeaBrief;
};

export type TeamProposalCreateInput = Partial<
  Pick<
    TeamProposalModel,
    | "requestedBy"
    | "sourceAgentId"
    | "title"
    | "researchSummary"
    | "proposalSummary"
    | "proposedTeamName"
    | "proposedDescription"
    | "proposedRoles"
    | "proposedInitialBoardItems"
    | "reviewTaskTitle"
  >
> & {
  businessType: TeamProposalBusinessConfig["businessType"];
  ideaBrief: TeamProposalIdeaBrief;
  proposedBusinessConfig?: Partial<TeamProposalBusinessConfig>;
};

const EXECUTABLE_RUNTIME_ROLES = new Set<AgentRole>([
  "builder",
  "growth_marketer",
  "pm",
  "biz_pm",
  "biz_executor",
]);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function capitalizeWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function normalizeTeamName(focus: string): string {
  const cleaned = focus.trim();
  if (!cleaned) return "New Venture Team";
  const titled = capitalizeWords(cleaned);
  return /team$/i.test(titled) ? titled : `${titled} Team`;
}

function inferRoles(
  businessType: TeamProposalBusinessConfig["businessType"],
  ideaBrief: TeamProposalIdeaBrief,
): TeamProposalRoleRecommendation[] {
  const notes =
    `${ideaBrief.focus} ${ideaBrief.primaryGoal} ${ideaBrief.constraints} ${ideaBrief.notes ?? ""}`.toLowerCase();
  const roles: TeamProposalRoleRecommendation[] = [];

  if (businessType === "affiliate_marketing" || businessType === "content_creator") {
    roles.push({
      roleId: "biz-pm",
      title: "Business PM",
      rationale:
        "Owns KPI pressure, board prioritization, and operator reporting for the proposed business loop.",
      supported: true,
      mappedRuntimeRole: "biz_pm",
    });
    roles.push({
      roleId: "biz-executor",
      title: "Business Executor",
      rationale:
        "Executes the highest-priority production and distribution tasks required by the plan.",
      supported: true,
      mappedRuntimeRole: "biz_executor",
    });
  } else {
    roles.push({
      roleId: "pm",
      title: "Project Manager",
      rationale: "Owns planning, sequencing, and accountability for the proposed team.",
      supported: true,
      mappedRuntimeRole: "pm",
    });
  }

  if (
    businessType === "saas" ||
    /\bbuild|app|product|landing|website|software|automation|tool\b/.test(notes)
  ) {
    roles.push({
      roleId: "builder",
      title: "Builder",
      rationale: "Needed to build and iterate on product or technical assets implied by the idea.",
      supported: true,
      mappedRuntimeRole: "builder",
    });
  }

  if (
    businessType === "custom" &&
    /\bmarket|traffic|ads|growth|content|distribution|tiktok|youtube|reddit|audience\b/.test(notes)
  ) {
    roles.push({
      roleId: "growth",
      title: "Growth Marketer",
      rationale:
        "Needed to handle acquisition, publishing, or audience growth motions described in the brief.",
      supported: true,
      mappedRuntimeRole: "growth_marketer",
    });
  }

  if (/\banalyst|finance|ops|support|sales|legal\b/.test(notes)) {
    roles.push({
      roleId: "specialist",
      title: "Specialist Operator",
      rationale:
        "The brief implies a specialist function that ShellCorp cannot auto-provision yet.",
      supported: false,
    });
  }

  return roles;
}

function inferCapabilitySkills(
  businessType: TeamProposalBusinessConfig["businessType"],
): TeamProposalBusinessConfig["capabilitySkills"] {
  if (businessType === "affiliate_marketing") {
    return {
      measure: "amazon-affiliate-metrics",
      execute: "video-generator",
      distribute: "tiktok-poster",
    };
  }
  if (businessType === "content_creator") {
    return {
      measure: "bitly-click-tracker",
      execute: "article-writer",
      distribute: "youtube-shorts-poster",
    };
  }
  if (businessType === "saas") {
    return {
      measure: "stripe-revenue",
      execute: "landing-page-builder",
      distribute: "reddit-poster",
    };
  }
  return {
    measure: "bitly-click-tracker",
    execute: "article-writer",
    distribute: "reddit-poster",
  };
}

function inferBoardItems(
  businessType: TeamProposalBusinessConfig["businessType"],
  roles: TeamProposalRoleRecommendation[],
): TeamProposalBoardItem[] {
  const ownerRoleId = roles.find((role) => role.supported)?.roleId;
  const base: TeamProposalBoardItem[] = [
    {
      id: "task-discovery-brief",
      title: "Turn approved proposal into a working execution brief",
      detail: "Summarize goals, constraints, and first execution loop for the new team.",
      ownerRoleId,
    },
    {
      id: "task-define-kpis",
      title: "Confirm KPIs and review cadence",
      detail: "Lock success metrics and heartbeat review expectations for the team.",
      ownerRoleId,
    },
  ];
  if (businessType === "affiliate_marketing" || businessType === "content_creator") {
    base.push({
      id: "task-first-campaign",
      title: "Prepare first acquisition and content batch",
      detail: "Start the first measurable content/distribution loop after team bootstrap.",
      ownerRoleId,
    });
  } else {
    base.push({
      id: "task-first-build",
      title: "Prepare first product build sprint",
      detail: "Translate the approved plan into the first product or systems build sprint.",
      ownerRoleId,
    });
  }
  return base;
}

export function validateTeamIdeaGate(ideaBrief: TeamProposalIdeaBrief): string[] {
  const issues: string[] = [];
  if (!ideaBrief.focus.trim()) issues.push("Business focus is required.");
  if (!ideaBrief.targetCustomer.trim()) issues.push("Target customer is required.");
  if (!ideaBrief.primaryGoal.trim()) issues.push("Primary goal is required.");
  if (!ideaBrief.constraints.trim()) issues.push("Constraints are required.");
  return issues;
}

export function canExecuteProposalRoles(
  roles: TeamProposalRoleRecommendation[],
  businessType?: TeamProposalBusinessConfig["businessType"],
): boolean {
  if (businessType && businessType !== "custom") {
    return roles.every(
      (role) =>
        role.supported &&
        (role.mappedRuntimeRole === "biz_pm" || role.mappedRuntimeRole === "biz_executor"),
    );
  }
  return roles.every(
    (role) =>
      role.supported &&
      role.mappedRuntimeRole &&
      EXECUTABLE_RUNTIME_ROLES.has(role.mappedRuntimeRole),
  );
}

export function buildTeamProposal(input: TeamProposalDraftInput): TeamProposalModel {
  const createdAt = Date.now();
  const businessType = input.businessType;
  const capabilitySkills = inferCapabilitySkills(businessType);
  const proposedRoles = inferRoles(businessType, input.ideaBrief);
  const teamName = normalizeTeamName(input.ideaBrief.focus);
  const gateIssues = validateTeamIdeaGate(input.ideaBrief);
  const proposalSlug = slugify(`${teamName}-${createdAt}`);
  const executable = canExecuteProposalRoles(proposedRoles, businessType);
  const researchSummary = [
    `CEO intake passed a minimum brief for ${input.ideaBrief.focus}.`,
    `Target customer: ${input.ideaBrief.targetCustomer}.`,
    `Primary goal: ${input.ideaBrief.primaryGoal}.`,
    executable
      ? "Current ShellCorp runtime can provision the recommended team shape directly."
      : "The recommended team shape includes roles ShellCorp cannot auto-provision yet.",
  ].join(" ");
  const proposalSummary = [
    `Create ${teamName} to pursue ${input.ideaBrief.primaryGoal}.`,
    `The initial operating loop should focus on ${input.ideaBrief.focus} for ${input.ideaBrief.targetCustomer}.`,
    `Constraints to respect: ${input.ideaBrief.constraints}.`,
  ].join(" ");
  return {
    id: `proposal-${proposalSlug}`,
    requestedBy: input.requestedBy?.trim() || "operator",
    sourceAgentId: input.sourceAgentId?.trim() || "main",
    title: `CEO proposal: ${teamName}`,
    ideaBrief: input.ideaBrief,
    ideaGateStatus: gateIssues.length === 0 ? "passed" : "blocked",
    researchSummary,
    proposalSummary,
    proposedTeamName: teamName,
    proposedDescription: `CEO-proposed team for ${input.ideaBrief.focus}.`,
    proposedRoles,
    proposedBusinessConfig: {
      businessType,
      capabilitySkills,
    },
    proposedInitialBoardItems: inferBoardItems(businessType, proposedRoles),
    approvalStatus: "pending",
    executionStatus: gateIssues.length === 0 && executable ? "ready_to_create" : "draft",
    reviewTaskTitle: `Review CEO proposal for ${teamName}`,
    createdAt,
    updatedAt: createdAt,
  };
}

export function createTeamProposal(input: TeamProposalCreateInput): TeamProposalModel {
  const defaults = buildTeamProposal({
    requestedBy: input.requestedBy,
    sourceAgentId: input.sourceAgentId,
    businessType: input.businessType,
    ideaBrief: input.ideaBrief,
  });
  const proposedBusinessConfig: TeamProposalBusinessConfig = {
    businessType:
      input.proposedBusinessConfig?.businessType ?? defaults.proposedBusinessConfig.businessType,
    capabilitySkills: {
      measure:
        input.proposedBusinessConfig?.capabilitySkills?.measure ??
        defaults.proposedBusinessConfig.capabilitySkills.measure,
      execute:
        input.proposedBusinessConfig?.capabilitySkills?.execute ??
        defaults.proposedBusinessConfig.capabilitySkills.execute,
      distribute:
        input.proposedBusinessConfig?.capabilitySkills?.distribute ??
        defaults.proposedBusinessConfig.capabilitySkills.distribute,
    },
  };
  const proposedRoles =
    input.proposedRoles && input.proposedRoles.length > 0
      ? input.proposedRoles
      : defaults.proposedRoles;
  const executable = canExecuteProposalRoles(proposedRoles, proposedBusinessConfig.businessType);
  return {
    ...defaults,
    ...(input.title?.trim() ? { title: input.title.trim() } : {}),
    ...(input.requestedBy?.trim() ? { requestedBy: input.requestedBy.trim() } : {}),
    ...(input.sourceAgentId?.trim() ? { sourceAgentId: input.sourceAgentId.trim() } : {}),
    ...(input.researchSummary?.trim() ? { researchSummary: input.researchSummary.trim() } : {}),
    ...(input.proposalSummary?.trim() ? { proposalSummary: input.proposalSummary.trim() } : {}),
    ...(input.proposedTeamName?.trim() ? { proposedTeamName: input.proposedTeamName.trim() } : {}),
    ...(input.proposedDescription?.trim()
      ? { proposedDescription: input.proposedDescription.trim() }
      : {}),
    proposedRoles,
    proposedBusinessConfig,
    proposedInitialBoardItems:
      input.proposedInitialBoardItems && input.proposedInitialBoardItems.length > 0
        ? input.proposedInitialBoardItems
        : defaults.proposedInitialBoardItems,
    ...(input.reviewTaskTitle?.trim() ? { reviewTaskTitle: input.reviewTaskTitle.trim() } : {}),
    executionStatus:
      defaults.ideaGateStatus === "passed" && executable ? "ready_to_create" : "draft",
    updatedAt: Date.now(),
  };
}
