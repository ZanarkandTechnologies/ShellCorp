/** Shared types for manage-agent-modal sub-modules. MEM-0144 */
import type { SessionTimelineModel } from "@/lib/openclaw-types";

export type SkillsMode = "all" | "selected" | "none";

export type AgentConfigDraft = {
  primaryModel: string;
  fallbackModels: string;
  heartbeatEveryOverride: string;
  heartbeatDefaultEvery: string;
  heartbeatIncludeReasoning: boolean;
  heartbeatTarget: string;
  heartbeatPrompt: string;
  toolsProfile: string;
  toolsAllow: string[];
  toolsDeny: string[];
  skillsMode: SkillsMode;
  selectedSkills: string[];
  appearanceClothesStyle: "default" | "dj" | "professional" | "techBro";
  appearanceHairColor: string;
  appearancePetType: "none" | "dog" | "cat" | "goldfish" | "rabbit" | "lobster";
};

export type TabId = "overview" | "files" | "tools" | "channels" | "cron";

export type AgentUsageOverview = {
  latestSession?: SessionTimelineModel["usageSummary"];
  cost24hUsd: number;
  cost7dUsd: number;
  totalTrackedCostUsd: number;
  totalTokens: number;
  trackedSessions: number;
  unavailableText?: string;
};
