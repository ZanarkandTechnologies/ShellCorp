import { describe, expect, it } from "vitest";

import { buildTeamAiUsageSummary, sumUsageTotals } from "./session-usage";

describe("session usage helpers", () => {
  it("sums usage totals across session summaries", () => {
    const totals = sumUsageTotals([
      {
        sessionTotals: {
          inputTokens: 100,
          outputTokens: 20,
          cacheReadTokens: 5,
          cacheWriteTokens: 1,
          totalTokens: 126,
          estimatedCostUsd: 0.12,
          responseCount: 2,
        },
      },
      {
        sessionTotals: {
          inputTokens: 50,
          outputTokens: 10,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 60,
          estimatedCostUsd: 0.03,
          responseCount: 1,
        },
      },
    ]);
    expect(totals).toEqual({
      inputTokens: 150,
      outputTokens: 30,
      cacheReadTokens: 5,
      cacheWriteTokens: 1,
      totalTokens: 186,
      estimatedCostUsd: 0.15,
      responseCount: 3,
    });
  });

  it("builds 24h and 7d team AI burn summaries from session rows", () => {
    const summary = buildTeamAiUsageSummary(
      [
        {
          agentId: "builder",
          usageSummary: {
            sessionTotals: {
              inputTokens: 120,
              outputTokens: 30,
              cacheReadTokens: 10,
              cacheWriteTokens: 0,
              totalTokens: 160,
              estimatedCostUsd: 0.2,
              responseCount: 3,
            },
            last24Hours: {
              inputTokens: 40,
              outputTokens: 10,
              cacheReadTokens: 2,
              cacheWriteTokens: 0,
              totalTokens: 52,
              estimatedCostUsd: 0.07,
              responseCount: 1,
            },
            last7Days: {
              inputTokens: 120,
              outputTokens: 30,
              cacheReadTokens: 10,
              cacheWriteTokens: 0,
              totalTokens: 160,
              estimatedCostUsd: 0.2,
              responseCount: 3,
            },
          },
        },
        {
          agentId: "pm",
          usageSummary: {
            sessionTotals: {
              inputTokens: 90,
              outputTokens: 15,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 105,
              estimatedCostUsd: 0.11,
              responseCount: 2,
            },
            last24Hours: {
              inputTokens: 0,
              outputTokens: 0,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 0,
              estimatedCostUsd: 0,
              responseCount: 0,
            },
            last7Days: {
              inputTokens: 90,
              outputTokens: 15,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 105,
              estimatedCostUsd: 0.11,
              responseCount: 2,
            },
          },
        },
        {
          agentId: "pm",
          usageSummary: {
            sessionTotals: {
              inputTokens: 60,
              outputTokens: 10,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 70,
              estimatedCostUsd: 0.08,
              responseCount: 1,
            },
            last24Hours: {
              inputTokens: 0,
              outputTokens: 0,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 0,
              estimatedCostUsd: 0,
              responseCount: 0,
            },
            last7Days: {
              inputTokens: 0,
              outputTokens: 0,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 0,
              estimatedCostUsd: 0,
              responseCount: 0,
            },
          },
        },
      ],
    );
    expect(summary).toEqual({
      trackedAgents: 2,
      trackedSessions: 3,
      cost24hUsd: 0.07,
      cost7dUsd: 0.31,
      totalTrackedCostUsd: 0.39,
      totalTokens: 335,
    });
  });

  it("does not overcount old session cost when only a recent response exists", () => {
    const summary = buildTeamAiUsageSummary([
      {
        agentId: "builder",
        usageSummary: {
          sessionTotals: {
            inputTokens: 500,
            outputTokens: 100,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            totalTokens: 600,
            estimatedCostUsd: 1.25,
            responseCount: 8,
          },
          last24Hours: {
            inputTokens: 20,
            outputTokens: 5,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            totalTokens: 25,
            estimatedCostUsd: 0.04,
            responseCount: 1,
          },
          last7Days: {
            inputTokens: 120,
            outputTokens: 24,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            totalTokens: 144,
            estimatedCostUsd: 0.28,
            responseCount: 3,
          },
        },
      },
    ]);
    expect(summary.cost24hUsd).toBe(0.04);
    expect(summary.cost7dUsd).toBe(0.28);
    expect(summary.totalTrackedCostUsd).toBe(1.25);
  });
});
