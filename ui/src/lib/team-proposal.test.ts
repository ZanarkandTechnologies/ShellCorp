import { describe, expect, it } from "vitest";

import {
  buildTeamProposal,
  canExecuteProposalRoles,
  createTeamProposal,
  validateTeamIdeaGate,
} from "./team-proposal";

describe("team proposal helpers", () => {
  it("fails the idea gate when required fields are missing", () => {
    const issues = validateTeamIdeaGate({
      focus: "",
      targetCustomer: "",
      primaryGoal: "",
      constraints: "",
    });
    expect(issues).toEqual([
      "Business focus is required.",
      "Target customer is required.",
      "Primary goal is required.",
      "Constraints are required.",
    ]);
  });

  it("builds an executable affiliate proposal with supported roles", () => {
    const proposal = buildTeamProposal({
      businessType: "affiliate_marketing",
      ideaBrief: {
        focus: "affiliate content engine",
        targetCustomer: "home office shoppers",
        primaryGoal: "ship weekly revenue-producing videos",
        constraints: "keep API spend low and reuse proven channels",
      },
    });
    expect(proposal.ideaGateStatus).toBe("passed");
    expect(proposal.proposedBusinessConfig.capabilitySkills.measure).toBe(
      "amazon-affiliate-metrics",
    );
    expect(proposal.proposedRoles.some((role) => role.mappedRuntimeRole === "biz_pm")).toBe(true);
    expect(
      canExecuteProposalRoles(proposal.proposedRoles, proposal.proposedBusinessConfig.businessType),
    ).toBe(true);
  });

  it("flags unsupported specialist roles before execution", () => {
    const proposal = buildTeamProposal({
      businessType: "saas",
      ideaBrief: {
        focus: "sales automation product",
        targetCustomer: "small agencies",
        primaryGoal: "build and sell a repeatable SaaS offer",
        constraints: "need legal review and support coverage",
      },
    });
    expect(proposal.proposedRoles.some((role) => role.supported === false)).toBe(true);
    expect(
      canExecuteProposalRoles(proposal.proposedRoles, proposal.proposedBusinessConfig.businessType),
    ).toBe(false);
  });

  it("allows CLI callers to override proposal copy and board items", () => {
    const proposal = createTeamProposal({
      businessType: "affiliate_marketing",
      requestedBy: "founder",
      sourceAgentId: "main",
      ideaBrief: {
        focus: "affiliate content engine",
        targetCustomer: "home office shoppers",
        primaryGoal: "ship weekly revenue-producing videos",
        constraints: "keep spend low",
      },
      researchSummary: "Researched creator-led affiliate teams with PM + executor loops.",
      proposalSummary: "Custom packet from CEO skill.",
      proposedInitialBoardItems: [
        {
          id: "task-custom",
          title: "Review channel stack",
        },
      ],
    });
    expect(proposal.requestedBy).toBe("founder");
    expect(proposal.sourceAgentId).toBe("main");
    expect(proposal.researchSummary).toContain("Researched creator-led affiliate teams");
    expect(proposal.proposedInitialBoardItems).toEqual([
      { id: "task-custom", title: "Review channel stack" },
    ]);
  });
});
