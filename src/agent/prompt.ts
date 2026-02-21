import { readFile } from "node:fs/promises";
import path from "node:path";

import { SkillManager } from "../skills/manager.js";
import { MemoryStore } from "../memory/store.js";

async function safeRead(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

export async function buildSystemPrompt(
  workspaceDir: string,
  skillManager: SkillManager,
  memoryStore: MemoryStore,
  basePrompt: string,
): Promise<string> {
  const agents = await safeRead(path.join(workspaceDir, "AGENTS.md"));
  const soul = await safeRead(path.join(workspaceDir, "SOUL.md"));
  const tools = await safeRead(path.join(workspaceDir, "TOOLS.md"));
  const memory = await memoryStore.readMemory();
  const skillIndex = await skillManager.buildSkillIndex();

  return [
    basePrompt,
    "\n# AGENTS\n",
    agents,
    "\n# SOUL\n",
    soul,
    "\n# TOOLS\n",
    tools,
    "\n# MEMORY\n",
    memory,
    "\n# SKILLS\n",
    skillIndex,
  ].join("\n");
}
