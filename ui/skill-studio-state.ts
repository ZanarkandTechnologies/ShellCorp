/**
 * SKILL STUDIO STATE BRIDGE
 * =========================
 * File-backed catalog/detail/file/demo helpers for the Skill Studio UI.
 *
 * KEY CONCEPTS:
 * - Repo-local `skills/` is the canonical authoring source in v1.
 * - Read access is limited to the skill package and explicit references.
 * - Demo execution reuses the markdown skill contract runtime.
 *
 * USAGE:
 * - Imported by the Vite state bridge routes in `ui/vite.config.ts`.
 *
 * MEMORY REFERENCES:
 * - MEM-0157
 * - MEM-0166
 */

import path from "node:path";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import type {
  SkillDemoCase,
  SkillDemoRunResult,
  SkillManifest,
  SkillStatusEntry,
  SkillStudioCatalogEntry,
  SkillStudioDetail,
  SkillStudioFileContent,
  SkillStudioFileEntry,
} from "./src/lib/openclaw-types";
import {
  deriveSkillManifest,
  extractSkillFrontmatter,
  stringifySkillManifest,
} from "./src/lib/skill-studio";
import {
  collectSkillContractTests,
  extractSkillContract,
  runSkillContractSpec,
  setupSkillTestStateDir,
} from "../skills/skill-contract-runtime";

type SkillPackageRecord = {
  skillId: string;
  packageKey: string;
  category: string;
  sourcePath: string;
  updatedAt?: number;
  manifestPath: string;
  manifestRaw: string | null;
  manifest: SkillManifest;
  skillPath: string;
  skillMarkdown: string;
  displayName: string;
  description: string;
  fileEntries: SkillStudioFileEntry[];
  demoCases: SkillDemoCase[];
};

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".ts", ".tsx", ".js", ".jsx", ".css"]);
const PACKAGE_FILE_NAMES = ["SKILL.md", "skill.md"] as const;

function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function isWithin(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function titleCaseFromId(value: string): string {
  return value
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function deriveCategory(packageKey: string): string {
  const segments = toPosixPath(packageKey).split("/");
  return segments.length > 1 ? segments[0] ?? "general" : "workflow";
}

function classifySkillFile(filePath: string, skillDir: string, explicitReferenceSet: Set<string>): SkillStudioFileEntry["kind"] {
  const relative = toPosixPath(path.relative(skillDir, filePath));
  const fileName = path.basename(filePath);
  if (fileName === "SKILL.md" || fileName === "skill.md") return "skill";
  if (fileName === "skill.config.yaml") return "config";
  if (relative === "MEMORY.md") return "memory";
  if (relative.startsWith("tests/")) return "test";
  if (relative.startsWith("fixtures/")) return "fixture";
  if (explicitReferenceSet.has(filePath)) return "reference";
  return "asset";
}

async function walkFiles(rootDir: string): Promise<string[]> {
  const stack = [rootDir];
  const files: string[] = [];
  while (stack.length > 0) {
    const currentDir = stack.pop() ?? "";
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else {
        files.push(entryPath);
      }
    }
  }
  return files.sort();
}

async function findSkillPackages(skillsRoot: string): Promise<string[]> {
  const files = await walkFiles(skillsRoot);
  const skillFiles = files.filter((filePath) => PACKAGE_FILE_NAMES.includes(path.basename(filePath) as (typeof PACKAGE_FILE_NAMES)[number]));
  return skillFiles.map((filePath) => path.dirname(filePath)).sort();
}

function resolveExplicitReferencePaths(skillDir: string, repoRoot: string, manifest: SkillManifest): string[] {
  const references = [...manifest.references, ...manifest.dependencies.docs];
  return references
    .map((entry) => {
      const trimmed = entry.trim();
      if (!trimmed) return null;
      const resolved = path.resolve(skillDir, trimmed);
      if (!isWithin(repoRoot, resolved)) return null;
      return resolved;
    })
    .filter((entry): entry is string => entry !== null);
}

async function buildFileEntries(skillDir: string, repoRoot: string, manifest: SkillManifest): Promise<SkillStudioFileEntry[]> {
  const packageFiles = await walkFiles(skillDir);
  const explicitReferencePaths = resolveExplicitReferencePaths(skillDir, repoRoot, manifest);
  const explicitReferenceSet = new Set(explicitReferencePaths);
  const allFiles = [...packageFiles, ...explicitReferencePaths.filter((filePath) => !packageFiles.includes(filePath))];

  const entries = await Promise.all(
    allFiles.map(async (filePath) => {
      const stats = await stat(filePath).catch(() => null);
      if (!stats?.isFile()) return null;
      const relativePath = isWithin(skillDir, filePath)
        ? toPosixPath(path.relative(skillDir, filePath))
        : `ref:${toPosixPath(path.relative(repoRoot, filePath))}`;
      return {
        path: relativePath,
        kind: classifySkillFile(filePath, skillDir, explicitReferenceSet),
        isText: TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase()) || path.basename(filePath) === "SKILL.md",
      } satisfies SkillStudioFileEntry;
    }),
  );
  return entries.filter((entry): entry is SkillStudioFileEntry => entry !== null);
}

function buildDemoCaseId(relativePath: string, specName: string): string {
  const compactPath = relativePath.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  const compactName = specName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return `${compactPath}:${compactName}`;
}

async function buildDemoCases(skillDir: string): Promise<SkillDemoCase[]> {
  const testCases = await collectSkillContractTests(skillDir);
  return testCases.map(({ filePath, spec }) => ({
    id: buildDemoCaseId(toPosixPath(path.relative(skillDir, filePath)), spec.name),
    title: spec.name,
    filePath,
    stepCount: spec.steps.length,
    relativePath: toPosixPath(path.relative(skillDir, filePath)),
  }));
}

function matchRuntimeStatus(skillId: string, packageKey: string, runtimeStatuses: SkillStatusEntry[]): SkillStatusEntry | undefined {
  const lowerSkillId = skillId.toLowerCase();
  const lowerPackageKey = packageKey.toLowerCase();
  return runtimeStatuses.find((entry) => {
    const name = entry.name.toLowerCase();
    const key = entry.skillKey.toLowerCase();
    const filePath = entry.filePath.toLowerCase();
    return name === lowerSkillId || key === lowerSkillId || key === lowerPackageKey || filePath.includes(`/${lowerSkillId}/`);
  });
}

function normalizeSkillLookup(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function findSkillRecord(records: SkillPackageRecord[], skillId: string): SkillPackageRecord | null {
  const normalizedTarget = normalizeSkillLookup(skillId);
  return (
    records.find((entry) => entry.skillId === skillId) ??
    records.find((entry) => entry.packageKey === skillId) ??
    records.find((entry) => normalizeSkillLookup(entry.skillId) === normalizedTarget) ??
    records.find((entry) => normalizeSkillLookup(entry.packageKey) === normalizedTarget) ??
    null
  );
}

async function readSkillPackageRecord(
  skillDir: string,
  skillsRoot: string,
  repoRoot: string,
): Promise<SkillPackageRecord> {
  const skillPath = PACKAGE_FILE_NAMES.map((name) => path.join(skillDir, name)).find((candidate) => candidate.toLowerCase().endsWith(".md")) ?? path.join(skillDir, "SKILL.md");
  const existingSkillPath = await stat(skillPath).then(() => skillPath).catch(async () => {
    const fallback = path.join(skillDir, "skill.md");
    await stat(fallback);
    return fallback;
  });
  const skillMarkdown = await readFile(existingSkillPath, "utf-8");
  const manifestPath = path.join(skillDir, "skill.config.yaml");
  const manifestRaw = await readFile(manifestPath, "utf-8").catch(() => null);
  const packageKey = toPosixPath(path.relative(skillsRoot, skillDir));
  const skillId = packageKey.split("/").at(-1) ?? packageKey;
  const frontmatter = extractSkillFrontmatter(skillMarkdown);
  const displayName = frontmatter.name?.trim() || titleCaseFromId(skillId);
  const manifest = deriveSkillManifest(manifestRaw, skillMarkdown, displayName);
  const fileEntries = await buildFileEntries(skillDir, repoRoot, manifest);
  const demoCases = await buildDemoCases(skillDir);
  const skillStats = await stat(existingSkillPath);
  return {
    skillId,
    packageKey,
    category: deriveCategory(packageKey),
    sourcePath: toPosixPath(path.relative(repoRoot, skillDir)),
    updatedAt: skillStats.mtimeMs,
    manifestPath: toPosixPath(path.relative(repoRoot, manifestPath)),
    manifestRaw,
    manifest,
    skillPath: existingSkillPath,
    skillMarkdown,
    displayName: manifest.interface.displayName,
    description: manifest.interface.shortDescription,
    fileEntries,
    demoCases,
  };
}

async function readAllSkillPackages(skillsRoot: string, repoRoot: string): Promise<SkillPackageRecord[]> {
  const skillDirs = await findSkillPackages(skillsRoot);
  return Promise.all(skillDirs.map((skillDir) => readSkillPackageRecord(skillDir, skillsRoot, repoRoot)));
}

export async function listSkillStudioCatalog(
  skillsRoot: string,
  repoRoot: string,
  runtimeStatuses: SkillStatusEntry[] = [],
): Promise<SkillStudioCatalogEntry[]> {
  const records = await readAllSkillPackages(skillsRoot, repoRoot);
  return records.map((record) => {
    const runtimeStatus = matchRuntimeStatus(record.skillId, record.packageKey, runtimeStatuses);
    return {
      skillId: record.skillId,
      packageKey: record.packageKey,
      displayName: record.displayName,
      description: record.description,
      category: record.category,
      scope: runtimeStatus?.source.toLowerCase().includes("agent") ? "agent" : "shared",
      sourcePath: record.sourcePath,
      updatedAt: record.updatedAt,
      hasManifest: record.manifestRaw !== null,
      hasTests: record.demoCases.length > 0,
      hasDiagram: Boolean(record.manifest.visualization.mermaid?.trim()),
      hasSkillMemory: record.manifest.state.mode === "skill_memory",
      runtimeStatus: runtimeStatus
        ? {
            eligible: runtimeStatus.eligible,
            blockedByAllowlist: runtimeStatus.blockedByAllowlist,
            disabled: runtimeStatus.disabled,
            source: runtimeStatus.source,
          }
        : undefined,
    } satisfies SkillStudioCatalogEntry;
  });
}

export async function getSkillStudioDetail(
  skillsRoot: string,
  repoRoot: string,
  skillId: string,
  runtimeStatuses: SkillStatusEntry[] = [],
  focusAgentId?: string,
): Promise<SkillStudioDetail | null> {
  const records = await readAllSkillPackages(skillsRoot, repoRoot);
  const record = findSkillRecord(records, skillId);
  if (!record) return null;
  return {
    skillId: record.skillId,
    packageKey: record.packageKey,
    displayName: record.displayName,
    description: record.description,
    category: record.category,
    scope: "shared",
    sourcePath: record.sourcePath,
    updatedAt: record.updatedAt,
    manifest: record.manifest,
    manifestPath: record.manifestPath,
    hasManifest: record.manifestRaw !== null,
    overviewMarkdown: record.skillMarkdown,
    mermaid: record.manifest.visualization.mermaid,
    relatedSkills: record.manifest.dependencies.skills,
    fileEntries: record.fileEntries,
    demoCases: record.demoCases,
    runtimeStatus: matchRuntimeStatus(record.skillId, record.packageKey, runtimeStatuses),
    focusAgentId,
  };
}

function resolveSkillFilePath(record: SkillPackageRecord, repoRoot: string, requestedPath: string): string | null {
  const entry = record.fileEntries.find((file) => file.path === requestedPath);
  if (!entry) return null;
  if (requestedPath.startsWith("ref:")) {
    const repoRelative = requestedPath.slice(4);
    const resolved = path.resolve(repoRoot, repoRelative);
    return isWithin(repoRoot, resolved) ? resolved : null;
  }
  const resolved = path.resolve(path.dirname(record.skillPath), requestedPath);
  return isWithin(path.dirname(record.skillPath), resolved) ? resolved : null;
}

export async function readSkillStudioFile(
  skillsRoot: string,
  repoRoot: string,
  skillId: string,
  requestedPath: string,
): Promise<SkillStudioFileContent | null> {
  const records = await readAllSkillPackages(skillsRoot, repoRoot);
  const record = findSkillRecord(records, skillId);
  if (!record) return null;
  const filePath = resolveSkillFilePath(record, repoRoot, requestedPath);
  const entry = record.fileEntries.find((file) => file.path === requestedPath);
  if (!filePath || !entry) return null;
  const stats = await stat(filePath).catch(() => null);
  if (!stats?.isFile()) return null;
  if (!entry.isText) {
    return {
      path: requestedPath,
      kind: entry.kind,
      isText: false,
      sizeBytes: stats.size,
    };
  }
  return {
    path: requestedPath,
    kind: entry.kind,
    isText: true,
    writable: !requestedPath.startsWith("ref:"),
    content: await readFile(filePath, "utf-8"),
    sizeBytes: stats.size,
  };
}

export async function saveSkillStudioFile(
  skillsRoot: string,
  repoRoot: string,
  skillId: string,
  requestedPath: string,
  content: string,
): Promise<SkillStudioFileContent | null> {
  const records = await readAllSkillPackages(skillsRoot, repoRoot);
  const record = findSkillRecord(records, skillId);
  if (!record) return null;
  const entry = record.fileEntries.find((file) => file.path === requestedPath);
  if (!entry || !entry.isText || requestedPath.startsWith("ref:")) return null;
  const filePath = resolveSkillFilePath(record, repoRoot, requestedPath);
  if (!filePath) return null;
  await writeFile(filePath, content, "utf-8");
  const stats = await stat(filePath).catch(() => null);
  return {
    path: requestedPath,
    kind: entry.kind,
    isText: true,
    writable: true,
    content,
    sizeBytes: stats?.size,
  };
}

export async function runSkillStudioDemo(
  skillsRoot: string,
  repoRoot: string,
  skillId: string,
  caseId: string,
): Promise<SkillDemoRunResult | null> {
  const records = await readAllSkillPackages(skillsRoot, repoRoot);
  const record = findSkillRecord(records, skillId);
  if (!record) return null;
  const selectedCase = record.demoCases.find((entry) => entry.id === caseId);
  if (!selectedCase) return null;
  const markdown = await readFile(selectedCase.filePath, "utf-8");
  const spec = extractSkillContract(markdown);
  const stateDir = await setupSkillTestStateDir();
  const result = await runSkillContractSpec(spec, stateDir);
  return {
    caseId: selectedCase.id,
    caseName: result.name,
    passed: result.passed,
    durationMs: result.durationMs,
    stdout: result.steps.map((step) => step.stdout).filter(Boolean).join("\n\n"),
    stderr: result.steps.map((step) => step.stderr).filter(Boolean).join("\n\n"),
    filesChecked: spec.steps.flatMap((step) => step.expect?.filesExist ?? []),
    steps: result.steps.map((step) => ({
      run: step.run,
      stdout: step.stdout,
      stderr: step.stderr,
      durationMs: step.durationMs,
      passed: step.expectation.passed,
      failures: step.expectation.failures,
    })),
  };
}

export async function saveSkillStudioManifest(
  skillsRoot: string,
  repoRoot: string,
  skillId: string,
  input: { manifest?: SkillManifest; rawYaml?: string },
): Promise<SkillStudioDetail | null> {
  const records = await readAllSkillPackages(skillsRoot, repoRoot);
  const record = findSkillRecord(records, skillId);
  if (!record) return null;
  const nextRaw = input.rawYaml ?? stringifySkillManifest(input.manifest ?? record.manifest);
  const reparsed = deriveSkillManifest(nextRaw, record.skillMarkdown, record.displayName);
  await writeFile(path.join(path.dirname(record.skillPath), "skill.config.yaml"), nextRaw, "utf-8");
  const nextRecord = await readSkillPackageRecord(path.dirname(record.skillPath), skillsRoot, repoRoot);
  return {
    skillId: nextRecord.skillId,
    packageKey: nextRecord.packageKey,
    displayName: nextRecord.displayName,
    description: nextRecord.description,
    category: nextRecord.category,
    scope: "shared",
    sourcePath: nextRecord.sourcePath,
    updatedAt: nextRecord.updatedAt,
    manifest: reparsed,
    manifestPath: nextRecord.manifestPath,
    hasManifest: true,
    overviewMarkdown: nextRecord.skillMarkdown,
    mermaid: reparsed.visualization.mermaid,
    relatedSkills: reparsed.dependencies.skills,
    fileEntries: nextRecord.fileEntries,
    demoCases: nextRecord.demoCases,
  };
}
