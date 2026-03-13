/**
 * AGENT CONFIG DRAFT
 * ==================
 * Shared OpenClaw agent-config draft helpers used by Manage Agent
 * and Skill Studio's per-agent equip surface.
 *
 * KEY CONCEPTS:
 * - Draft parsing reads one agent row from the config snapshot.
 * - Draft serialization writes only the selected agent entry back.
 *
 * USAGE:
 * - Import from Manage Agent and Skills Studio when editing agent config.
 *
 * MEMORY REFERENCES:
 * - MEM-0188
 */

import type { AgentConfigDraft } from "./_types";

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function cloneAgentConfigDraft(value: AgentConfigDraft): AgentConfigDraft {
  return cloneConfig(value);
}

export const EMPTY_AGENT_CONFIG_DRAFT: AgentConfigDraft = {
  primaryModel: "",
  fallbackModels: "",
  toolsProfile: "",
  toolsAllow: [],
  toolsDeny: [],
  skillsMode: "all",
  selectedSkills: [],
};

export function resolveAgentConfigDraft(
  config: Record<string, unknown> | null,
  agentId: string,
): AgentConfigDraft {
  const agentsNode =
    config?.agents && typeof config.agents === "object"
      ? (config.agents as Record<string, unknown>)
      : {};
  const list = Array.isArray(agentsNode.list) ? agentsNode.list : [];
  const entry = list.find((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return String(row.id ?? row.agentId ?? "").trim() === agentId;
  }) as Record<string, unknown> | undefined;
  const modelNode = entry?.model;
  let primaryModel = "";
  let fallbackModels = "";
  if (typeof modelNode === "string") {
    primaryModel = modelNode;
  } else if (modelNode && typeof modelNode === "object") {
    const row = modelNode as Record<string, unknown>;
    primaryModel = String(row.primary ?? row.model ?? "");
    if (Array.isArray(row.fallbacks)) {
      fallbackModels = row.fallbacks
        .filter((item): item is string => typeof item === "string")
        .join(", ");
    }
  }
  const toolsNode =
    entry?.tools && typeof entry.tools === "object" ? (entry.tools as Record<string, unknown>) : {};
  const toolsAllow = Array.isArray(toolsNode.alsoAllow)
    ? toolsNode.alsoAllow.filter((item): item is string => typeof item === "string")
    : [];
  const toolsDeny = Array.isArray(toolsNode.deny)
    ? toolsNode.deny.filter((item): item is string => typeof item === "string")
    : [];
  const skillsArray = Array.isArray(entry?.skills)
    ? entry.skills.filter((item): item is string => typeof item === "string")
    : null;
  const skillsMode = skillsArray === null ? "all" : skillsArray.length === 0 ? "none" : "selected";
  return {
    primaryModel,
    fallbackModels,
    toolsProfile: typeof toolsNode.profile === "string" ? toolsNode.profile : "",
    toolsAllow,
    toolsDeny,
    skillsMode,
    selectedSkills: skillsArray ?? [],
  };
}

export function buildNextAgentConfig(
  currentConfig: Record<string, unknown>,
  agentId: string,
  draft: AgentConfigDraft,
): Record<string, unknown> {
  const next = cloneConfig(currentConfig);
  const root = next as Record<string, unknown>;
  const agentsNode =
    root.agents && typeof root.agents === "object"
      ? (root.agents as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const list = Array.isArray(agentsNode.list) ? (cloneConfig(agentsNode.list) as unknown[]) : [];
  const idx = list.findIndex((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return String(row.id ?? row.agentId ?? "").trim() === agentId;
  });
  const baseEntry =
    idx >= 0 && list[idx] && typeof list[idx] === "object"
      ? (cloneConfig(list[idx]) as Record<string, unknown>)
      : ({ id: agentId } as Record<string, unknown>);

  const primaryModel = draft.primaryModel.trim();
  const fallbackModels = draft.fallbackModels
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (!primaryModel && fallbackModels.length === 0) {
    delete baseEntry.model;
  } else if (fallbackModels.length > 0) {
    baseEntry.model = { primary: primaryModel, fallbacks: fallbackModels };
  } else {
    baseEntry.model = primaryModel;
  }

  const toolsNode =
    baseEntry.tools && typeof baseEntry.tools === "object"
      ? (cloneConfig(baseEntry.tools) as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const profile = draft.toolsProfile.trim();
  if (profile) toolsNode.profile = profile;
  else delete toolsNode.profile;
  if (draft.toolsAllow.length > 0) toolsNode.alsoAllow = [...draft.toolsAllow];
  else delete toolsNode.alsoAllow;
  if (draft.toolsDeny.length > 0) toolsNode.deny = [...draft.toolsDeny];
  else delete toolsNode.deny;
  if (Object.keys(toolsNode).length > 0) baseEntry.tools = toolsNode;
  else delete baseEntry.tools;

  if (draft.skillsMode === "all") {
    delete baseEntry.skills;
  } else if (draft.skillsMode === "none") {
    baseEntry.skills = [];
  } else {
    baseEntry.skills = [...draft.selectedSkills];
  }

  if (idx >= 0) list[idx] = baseEntry;
  else list.push(baseEntry);
  agentsNode.list = list;
  root.agents = agentsNode;
  return next;
}
