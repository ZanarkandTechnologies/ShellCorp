import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { resolveSecretValue } from "../security/secrets.js";

export interface Skill {
  name: string;
  dir: string;
  instruction: string;
  env: Record<string, string>;
}

export class SkillManager {
  constructor(private readonly skillsDir: string) {}

  async listSkills(): Promise<Skill[]> {
    let entries: string[] = [];
    try {
      entries = await readdir(this.skillsDir);
    } catch {
      return [];
    }

    const skills: Skill[] = [];
    for (const name of entries) {
      const dir = path.join(this.skillsDir, name);
      const instructionPath = path.join(dir, "SKILL.md");
      const configPath = path.join(dir, "config.json");
      try {
        const instruction = await readFile(instructionPath, "utf8");
        const env = await this.loadSkillEnv(configPath);
        skills.push({ name, dir, instruction, env });
      } catch {
        // ignore invalid skill directories
      }
    }
    return skills;
  }

  async buildSkillIndex(): Promise<string> {
    const skills = await this.listSkills();
    if (skills.length === 0) {
      return "No skills are installed.";
    }
    return skills.map((skill) => `- ${skill.name}: ${skill.instruction.split("\n")[0]}`).join("\n");
  }

  private async loadSkillEnv(configPath: string): Promise<Record<string, string>> {
    try {
      const raw = await readFile(configPath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, string>;
      const resolved = await Promise.all(
        Object.entries(parsed).map(async ([k, v]) => [k, await resolveSecretValue(v)] as const),
      );
      return Object.fromEntries(resolved);
    } catch {
      return {};
    }
  }
}
