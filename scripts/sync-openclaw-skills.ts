/**
 * OpenClaw Skill Sync
 * ===================
 * Copies every repo skill package into the shared OpenClaw skills directory so
 * local runtime inventory matches the in-repo skill catalog.
 *
 * KEY CONCEPTS:
 * - Skill packages are directories containing `SKILL.md` or `skill.md`.
 * - Nested category folders under `skills/` are flattened by package id.
 * - `OPENCLAW_STATE_DIR` overrides the default `~/.openclaw` state root.
 *
 * USAGE:
 * - `npm run skills:sync:openclaw`
 * - `npm run skills:sync:openclaw -- --dry-run`
 * - `npm run skills:sync:openclaw -- --clean`
 *
 * MEMORY REFERENCES:
 * - MEM-0199
 * - MEM-0204
 */
import os from "node:os";
import path from "node:path";
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";

const SKILL_MANIFEST_NAMES = new Set(["SKILL.md", "skill.md"]);

export interface SyncOptions {
  sourceRoot: string;
  destinationRoot: string;
  dryRun: boolean;
  clean: boolean;
}

export interface SkillPackage {
  skillId: string;
  sourceDir: string;
}

export interface SyncResult {
  copied: string[];
  destinationRoot: string;
  dryRun: boolean;
}

function resolveHomePath(inputPath: string): string {
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return path.resolve(inputPath);
}

export function resolveOpenclawStateRoot(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.OPENCLAW_STATE_DIR?.trim();
  return resolveHomePath(raw && raw.length > 0 ? raw : "~/.openclaw");
}

async function pathIsDirectory(targetPath: string): Promise<boolean> {
  try {
    const entry = await stat(targetPath);
    return entry.isDirectory();
  } catch {
    return false;
  }
}

async function walkForSkillPackages(rootDir: string): Promise<string[]> {
  const packageDirs: string[] = [];
  const queue = [rootDir];
  while (queue.length > 0) {
    const currentDir = queue.shift();
    if (!currentDir) continue;
    const entries = await readdir(currentDir, { withFileTypes: true });
    const manifestEntry = entries.find(
      (entry) => entry.isFile() && SKILL_MANIFEST_NAMES.has(entry.name),
    );
    if (manifestEntry) {
      packageDirs.push(currentDir);
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      queue.push(path.join(currentDir, entry.name));
    }
  }
  packageDirs.sort((left, right) => left.localeCompare(right));
  return packageDirs;
}

export async function discoverSkillPackages(sourceRoot: string): Promise<SkillPackage[]> {
  if (!(await pathIsDirectory(sourceRoot))) {
    throw new Error(`skills_root_missing:${sourceRoot}`);
  }
  const packageDirs = await walkForSkillPackages(sourceRoot);
  const byId = new Map<string, SkillPackage>();
  for (const packageDir of packageDirs) {
    const skillId = path.basename(packageDir);
    const existing = byId.get(skillId);
    if (existing) {
      throw new Error(`duplicate_skill_id:${skillId}:${existing.sourceDir}:${packageDir}`);
    }
    byId.set(skillId, { skillId, sourceDir: packageDir });
  }
  return [...byId.values()].sort((left, right) => left.skillId.localeCompare(right.skillId));
}

export function parseArgs(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): SyncOptions {
  let sourceRoot = path.resolve(cwd, "skills");
  let destinationRoot = path.join(resolveOpenclawStateRoot(env), "skills");
  let dryRun = false;
  let clean = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source") {
      sourceRoot = resolveHomePath(argv[index + 1] ?? sourceRoot);
      index += 1;
      continue;
    }
    if (arg === "--dest") {
      destinationRoot = resolveHomePath(argv[index + 1] ?? destinationRoot);
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--clean") {
      clean = true;
      continue;
    }
  }

  return { sourceRoot, destinationRoot, dryRun, clean };
}

export async function syncOpenclawSkills(options: SyncOptions): Promise<SyncResult> {
  const packages = await discoverSkillPackages(options.sourceRoot);
  if (!options.dryRun) {
    await mkdir(options.destinationRoot, { recursive: true });
  }
  const copied: string[] = [];
  for (const skillPackage of packages) {
    const destinationDir = path.join(options.destinationRoot, skillPackage.skillId);
    if (!options.dryRun && options.clean) {
      await rm(destinationDir, { recursive: true, force: true });
    }
    if (!options.dryRun) {
      await cp(skillPackage.sourceDir, destinationDir, {
        recursive: true,
        force: true,
      });
    }
    copied.push(skillPackage.skillId);
  }
  return {
    copied,
    destinationRoot: options.destinationRoot,
    dryRun: options.dryRun,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const result = await syncOpenclawSkills(options);
  const prefix = result.dryRun ? "Dry run" : "Synced";
  console.log(
    `${prefix} ${result.copied.length} skill packages into ${result.destinationRoot}`,
  );
  for (const skillId of result.copied) {
    console.log(`- ${skillId}`);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (import.meta.url === new URL(`file://${invokedPath}`).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`skills_sync_failed:${message}`);
    process.exitCode = 1;
  });
}
