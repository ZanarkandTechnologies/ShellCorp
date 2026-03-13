import { describe, expect, it } from "vitest";
import { buildAgentOverviewDisplay, getAgentInitials } from "./overview-display";

describe("manage agent overview display", () => {
  it("prefers live identity name and emoji over fallback sources", () => {
    const display = buildAgentOverviewDisplay({
      employee: {
        _id: "employee-1",
        teamId: "team-1",
        name: "Shell Operator",
        initialPosition: [0, 0, 0],
        isBusy: false,
        team: "Ops",
      },
      identity: {
        agentId: "zan",
        name: "Zan Prime",
        avatar: "",
        emoji: "🟥",
      },
      selectedAgent: {
        id: "zan",
        name: "Fallback Name",
        identity: {
          name: "Fallback Identity",
          emoji: "🟦",
          avatarUrl: "https://example.com/portrait.png",
        },
      },
      selectedAgentId: "zan",
      agentsList: {
        defaultId: "zan",
        mainKey: "main",
        scope: "workspace",
        agents: [],
      },
      usageOverview: null,
    });

    expect(display.displayName).toBe("Zan Prime");
    expect(display.emoji).toBe("🟥");
    expect(display.avatarUrl).toBe("https://example.com/portrait.png");
    expect(display.statusLabel).toBe("Standing By");
  });

  it("derives bounded usage meters from tracked values", () => {
    const display = buildAgentOverviewDisplay({
      employee: null,
      identity: null,
      selectedAgent: null,
      selectedAgentId: "main",
      agentsList: null,
      usageOverview: {
        latestSession: {
          sessionTotals: {
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            totalTokens: 1200,
            estimatedCostUsd: 0.25,
            responseCount: 2,
          },
        },
        cost24hUsd: 1,
        cost7dUsd: 2,
        totalTrackedCostUsd: 3,
        totalTokens: 500_000,
        trackedSessions: 6,
      },
    });

    expect(display.usageMeters).toHaveLength(3);
    expect(display.usageMeters[0]?.value).toBeCloseTo(8.3333333333);
    expect(display.usageMeters[1]?.value).toBeCloseTo(33.3333333333);
    expect(display.usageMeters[2]?.value).toBe(25);
  });

  it("builds stable initials from the first two name parts", () => {
    expect(getAgentInitials("Zan Mainframe")).toBe("ZM");
    expect(getAgentInitials("zan")).toBe("Z");
    expect(getAgentInitials("")).toBe("AG");
  });
});
