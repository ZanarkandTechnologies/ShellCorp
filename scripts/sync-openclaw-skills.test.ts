import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  discoverSkillPackages,
  parseArgs,
  resolveOpenclawStateRoot,
  syncOpenclawSkills,
} from "./sync-openclaw-skills";

const tempRoots: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempRoots.push(tempDir);
  return tempDir;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
});

describe("sync-openclaw-skills", () => {
  it("discovers nested skill packages and flattens them by package id", async () => {
    const rootDir = await createTempDir("skill-sync-source-");
    await mkdir(path.join(rootDir, "cross-cutting", "experiment-runner"), { recursive: true });
    await mkdir(path.join(rootDir, "distribute", "instagram-poster"), { recursive: true });
    await writeFile(
      path.join(rootDir, "cross-cutting", "experiment-runner", "SKILL.md"),
      "# Experiment Runner\n",
      "utf8",
    );
    await writeFile(
      path.join(rootDir, "distribute", "instagram-poster", "skill.md"),
      "# Instagram Poster\n",
      "utf8",
    );

    const packages = await discoverSkillPackages(rootDir);

    expect(packages).toEqual([
      {
        skillId: "experiment-runner",
        sourceDir: path.join(rootDir, "cross-cutting", "experiment-runner"),
      },
      {
        skillId: "instagram-poster",
        sourceDir: path.join(rootDir, "distribute", "instagram-poster"),
      },
    ]);
  });

  it("copies each discovered package into the destination root by skill id", async () => {
    const sourceRoot = await createTempDir("skill-sync-source-");
    const destinationRoot = await createTempDir("skill-sync-destination-");
    await mkdir(path.join(sourceRoot, "create-team"), { recursive: true });
    await mkdir(path.join(sourceRoot, "cross-cutting", "ledger-manager"), { recursive: true });
    await writeFile(path.join(sourceRoot, "create-team", "SKILL.md"), "# Create Team\n", "utf8");
    await writeFile(
      path.join(sourceRoot, "cross-cutting", "ledger-manager", "SKILL.md"),
      "# Ledger Manager\n",
      "utf8",
    );
    await writeFile(path.join(sourceRoot, "create-team", "notes.txt"), "hello", "utf8");

    const result = await syncOpenclawSkills({
      sourceRoot,
      destinationRoot,
      dryRun: false,
      clean: true,
    });

    expect(result.copied).toEqual(["create-team", "ledger-manager"]);
    await expect(
      readFile(path.join(destinationRoot, "create-team", "notes.txt"), "utf8"),
    ).resolves.toBe("hello");
    await expect(
      readFile(path.join(destinationRoot, "ledger-manager", "SKILL.md"), "utf8"),
    ).resolves.toContain("Ledger Manager");
  });

  it("resolves the default destination from OPENCLAW_STATE_DIR", () => {
    expect(resolveOpenclawStateRoot({ OPENCLAW_STATE_DIR: "/tmp/custom-openclaw" })).toBe(
      "/tmp/custom-openclaw",
    );
  });

  it("parses dry-run and clean flags", () => {
    const options = parseArgs(
      ["--source", "/repo/skills", "--dest", "/tmp/openclaw/skills", "--dry-run", "--clean"],
      {},
      "/repo",
    );

    expect(options).toEqual({
      sourceRoot: "/repo/skills",
      destinationRoot: "/tmp/openclaw/skills",
      dryRun: true,
      clean: true,
    });
  });
});
