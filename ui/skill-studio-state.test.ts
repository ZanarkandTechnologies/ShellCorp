import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { getSkillStudioDetail, readSkillStudioFile, saveSkillStudioFile } from "./skill-studio-state";

const tempRoots: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempRoots.push(tempDir);
  return tempDir;
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })),
  );
});

describe("skill-studio-state file saves", () => {
  it("loads nested skill packages by leaf skill id", async () => {
    const repoRoot = await createTempDir("skill-studio-repo-");
    const skillsRoot = path.join(repoRoot, "skills");
    const skillDir = path.join(skillsRoot, "agents", "create-team");
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), "# Create Team\n", "utf8");
    await writeFile(
      path.join(skillDir, "skill.config.yaml"),
      "interface:\n  displayName: Create Team\n",
      "utf8",
    );

    const detail = await getSkillStudioDetail(skillsRoot, repoRoot, "create-team");

    expect(detail?.skillId).toBe("create-team");
    expect(detail?.packageKey).toBe("agents/create-team");
  });

  it("marks repo references as read-only", async () => {
    const repoRoot = await createTempDir("skill-studio-repo-");
    const skillsRoot = path.join(repoRoot, "skills");
    const skillDir = path.join(skillsRoot, "create-team");
    await mkdir(path.join(repoRoot, "docs"), { recursive: true });
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), "# Create Team\n", "utf8");
    await writeFile(
      path.join(skillDir, "skill.config.yaml"),
      [
        "interface:",
        "  displayName: Create Team",
        "dependencies:",
        "  docs:",
        "    - ../../docs/reference.md",
      ].join("\n"),
      "utf8",
    );
    await writeFile(path.join(repoRoot, "docs", "reference.md"), "hello\n", "utf8");

    const file = await readSkillStudioFile(skillsRoot, repoRoot, "create-team", "ref:docs/reference.md");

    expect(file?.isText).toBe(true);
    expect(file?.writable).toBe(false);
  });

  it("saves writable package files in place", async () => {
    const repoRoot = await createTempDir("skill-studio-repo-");
    const skillsRoot = path.join(repoRoot, "skills");
    const skillDir = path.join(skillsRoot, "create-team");
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), "# Create Team\n", "utf8");
    await writeFile(
      path.join(skillDir, "skill.config.yaml"),
      "interface:\n  displayName: Create Team\n",
      "utf8",
    );

    const saved = await saveSkillStudioFile(
      skillsRoot,
      repoRoot,
      "create-team",
      "SKILL.md",
      "# Updated Skill\n",
    );

    expect(saved?.writable).toBe(true);
    await expect(readFile(path.join(skillDir, "SKILL.md"), "utf8")).resolves.toBe("# Updated Skill\n");
  });
});
