/** Shared types for manage-agent-modal sub-modules. MEM-0144 */

export type SkillsMode = "all" | "selected" | "none";

export type AgentConfigDraft = {
  primaryModel: string;
  fallbackModels: string;
  toolsProfile: string;
  toolsAllow: string[];
  toolsDeny: string[];
  skillsMode: SkillsMode;
  selectedSkills: string[];
};

export type TabId = "overview" | "files" | "tools" | "skills" | "channels" | "cron";
