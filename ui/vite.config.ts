import path from "node:path";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { buildNewTeamClusterObject } from "../cli/team-cluster-placement";
import {
  getSkillStudioDetail,
  listSkillStudioCatalog,
  readSkillStudioFile,
  runSkillStudioDemo,
  saveSkillStudioManifest,
  saveSkillStudioFile,
} from "./skill-studio-state";
import { normalizeBridgeOfficeSettings, type BridgeOfficeSettings as OfficeSettings } from "./office-settings-bridge";

type JsonObject = Record<string, unknown>;
type MemoryEntryType = "discovery" | "decision" | "problem" | "solution" | "pattern" | "warning" | "success" | "refactor" | "bugfix" | "feature";
type TaskProvider = "internal" | "notion" | "vibe" | "linear";
type TaskSyncState = "healthy" | "pending" | "conflict" | "error";
type TeamRole = "builder" | "growth_marketer" | "pm" | "biz_pm" | "biz_executor";
type BusinessType = "affiliate_marketing" | "content_creator" | "saas" | "custom";
type BusinessEquipMode = "replace_minimum" | "append_only";

const OPENCLAW_HOME = process.env.OPENCLAW_STATE_DIR || path.join(process.env.HOME || "", ".openclaw");
const OPENCLAW_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || path.join(OPENCLAW_HOME, "openclaw.json");
const REPO_ROOT = path.resolve(__dirname, "..");
const SKILLS_ROOT = path.join(REPO_ROOT, "skills");
const COMPANY_MODEL_PATH = path.join(OPENCLAW_HOME, "company.json");
const OFFICE_OBJECTS_PATH = path.join(OPENCLAW_HOME, "office-objects.json");
const OFFICE_SETTINGS_PATH = path.join(OPENCLAW_HOME, "office.json");
const OFFICE_OBJECTS_TEMPLATE_PATH = path.resolve(
  __dirname,
  "../templates/sidecar/office-objects.template.json",
);
const PENDING_APPROVALS_PATH = path.join(OPENCLAW_HOME, "pending-approvals.json");
const PENDING_APPROVALS_TEMPLATE_PATH = path.resolve(__dirname, "../templates/sidecar/pending-approvals.template.json");
const BIZ_PM_HEARTBEAT_TEMPLATE_PATH = path.resolve(__dirname, "../templates/workspace/HEARTBEAT-biz-pm.md");
const BIZ_EXECUTOR_HEARTBEAT_TEMPLATE_PATH = path.resolve(__dirname, "../templates/workspace/HEARTBEAT-biz-executor.md");
const DEFAULT_MESH_ASSET_DIR = path.join(OPENCLAW_HOME, "assets", "meshes");
const CRON_JOBS_PATH = path.join(OPENCLAW_HOME, "cron", "jobs.json");
const MESH_EXTENSIONS = new Set([".glb", ".gltf"]);
const MESH_PREVIEW_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const SKILL_PACKAGE_FILE_NAMES = ["SKILL.md", "skill.md"] as const;

interface SessionUsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  responseCount: number;
}

interface SessionUsageSummary {
  lastResponse?: SessionUsageTotals & {
    provider?: string;
    model?: string;
    timestamp?: number;
  };
  sessionTotals: SessionUsageTotals;
  last24Hours?: SessionUsageTotals;
  last7Days?: SessionUsageTotals;
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

async function readInstalledSkillDirectories(rootDir: string, scope: "agent" | "shared"): Promise<JsonObject[]> {
  if (!(await isDirectory(rootDir))) return [];
  const entries = await readdir(rootDir, { withFileTypes: true });
  const rows: JsonObject[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(rootDir, entry.name);
    const hasPackageFile = await Promise.all(
      SKILL_PACKAGE_FILE_NAMES.map((fileName) => pathExists(path.join(skillDir, fileName))),
    ).then((results) => results.some(Boolean));
    if (!hasPackageFile) continue;
    rows.push({
      skillId: entry.name,
      sourcePath: skillDir,
      scope,
    });
  }
  return rows.sort((a, b) => String(a.skillId ?? "").localeCompare(String(b.skillId ?? "")));
}

async function resolveRepoSkillDirectory(skillId: string): Promise<string | null> {
  const direct = path.join(SKILLS_ROOT, skillId);
  if (await isDirectory(direct)) return direct;
  const categories = await readdir(SKILLS_ROOT).catch(() => [] as string[]);
  for (const category of categories) {
    const nested = path.join(SKILLS_ROOT, category, skillId);
    if (await isDirectory(nested)) return nested;
  }
  return null;
}

async function resolveAgentWorkspacePath(agentId: string): Promise<string> {
  const config = await readJsonFile<JsonObject>(OPENCLAW_CONFIG_PATH, {});
  const agentsNode =
    config.agents && typeof config.agents === "object" ? (config.agents as JsonObject) : {};
  const list = Array.isArray(agentsNode.list) ? (agentsNode.list as JsonObject[]) : [];
  const match = list.find((entry) => String(entry.id ?? "").trim() === agentId);
  const workspacePath = typeof match?.workspace === "string" ? match.workspace.trim() : "";
  return workspacePath || path.join(OPENCLAW_HOME, "workspace", agentId);
}

function writeJson(res: { setHeader: (k: string, v: string) => void; end: (body: string) => void }, status: number, payload: unknown): void {
  res.setHeader("content-type", "application/json");
  res.setHeader("x-shellcorp-state-bridge", "vite");
  (res as { statusCode?: number }).statusCode = status;
  res.end(JSON.stringify(payload));
}

function requestHeader(req: unknown, name: string): string {
  const headers = (req as { headers?: Record<string, string | string[] | undefined> }).headers ?? {};
  const raw = headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return typeof raw === "string" ? raw : "";
}

function hasBridgeWriteAccess(req: unknown): boolean {
  const expectedToken = process.env.SHELLCORP_STATE_BRIDGE_TOKEN?.trim();
  if (expectedToken) {
    const providedToken = requestHeader(req, "x-shellcorp-state-bridge-token").trim();
    if (!providedToken || providedToken !== expectedToken) return false;
  }
  const role = requestHeader(req, "x-shellcorp-actor-role").trim().toLowerCase() || "operator";
  const allowed = requestHeader(req, "x-shellcorp-allowed-permissions").trim();
  if (!allowed) return role === "operator";
  if (allowed === "*") return true;
  const permissions = new Set(allowed.split(",").map((entry) => entry.trim()).filter(Boolean));
  return permissions.has("state.write");
}

async function readBody(req: { on: (name: string, cb: (chunk?: Buffer) => void) => void }): Promise<unknown> {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk) => chunks.push(chunk ?? Buffer.alloc(0)));
    req.on("end", () => resolve());
    req.on("error", (error) => reject(error));
  });
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    return {};
  }
}

function normalizeOfficeSettings(input: unknown): Required<OfficeSettings> {
  return normalizeBridgeOfficeSettings(input, DEFAULT_MESH_ASSET_DIR);
}

async function readOfficeSettings(): Promise<OfficeSettings> {
  const raw = await readJsonFile<OfficeSettings>(OFFICE_SETTINGS_PATH, {
    meshAssetDir: DEFAULT_MESH_ASSET_DIR,
    officeFootprint: { width: 35, depth: 35 },
    officeLayout: { version: 1, tileSize: 1, tiles: [] },
    decor: {
      floorPatternId: "sandstone_tiles",
      wallColorId: "gallery_cream",
      backgroundId: "shell_haze",
    },
    viewProfile: "free_orbit_3d",
    orbitControlsEnabled: true,
    cameraOrientation: "south_east",
  });
  return normalizeOfficeSettings(raw);
}

function asMeshPublicPath(fileName: string): string {
  return `/openclaw/assets/meshes/${encodeURIComponent(fileName)}`;
}

function sanitizeLabelToFileBase(label: string): string {
  const cleaned = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || `mesh-${Date.now()}`;
}

async function toUniqueFilePath(baseDir: string, desiredName: string): Promise<string> {
  const ext = path.extname(desiredName);
  const baseName = path.basename(desiredName, ext);
  let attempt = 0;
  while (attempt < 1000) {
    const suffix = attempt === 0 ? "" : `-${attempt}`;
    const candidate = path.join(baseDir, `${baseName}${suffix}${ext}`);
    try {
      await stat(candidate);
      attempt += 1;
    } catch {
      return candidate;
    }
  }
  return path.join(baseDir, `${baseName}-${Date.now()}${ext}`);
}

async function listMeshAssets(meshAssetDir: string): Promise<JsonObject[]> {
  await mkdir(meshAssetDir, { recursive: true });
  const rows = await readdir(meshAssetDir, { withFileTypes: true });
  const assets = await Promise.all(
    rows
      .filter((row) => row.isFile())
      .map(async (row) => {
        const ext = path.extname(row.name).toLowerCase();
        if (!MESH_EXTENSIONS.has(ext)) return null;
        const filePath = path.join(meshAssetDir, row.name);
        const fileStat = await stat(filePath);
        return {
          assetId: row.name,
          label: path.basename(row.name, ext),
          localPath: filePath,
          publicPath: asMeshPublicPath(row.name),
          fileName: row.name,
          fileSizeBytes: fileStat.size,
          sourceType: "local",
          validated: true,
          addedAt: fileStat.mtimeMs,
        } satisfies JsonObject;
      }),
  );
  return assets.filter((asset): asset is JsonObject => asset !== null);
}

function inferMeshExtensionFromUrl(rawUrl: string): ".glb" | ".gltf" {
  const pathname = new URL(rawUrl).pathname.toLowerCase();
  if (pathname.endsWith(".gltf")) return ".gltf";
  return ".glb";
}

function normalizeAgentsFromConfig(config: JsonObject): JsonObject[] {
  const agents = (config.agents as JsonObject | undefined) ?? {};
  const list = Array.isArray(agents.list) ? (agents.list as JsonObject[]) : [];
  return list;
}

function resolveAgentDir(agent: JsonObject): string {
  const id = String(agent.id ?? "").trim() || "main";
  const configured = String(agent.agentDir ?? "").trim();
  return configured || path.join(OPENCLAW_HOME, "agents", id, "agent");
}

function resolveWorkspace(config: JsonObject, agent: JsonObject): string {
  const configured = String(agent.workspace ?? "").trim();
  if (configured) return configured;
  const defaults = (config.agents as JsonObject | undefined)?.defaults as JsonObject | undefined;
  const fallback = String(defaults?.workspace ?? "").trim();
  if (fallback) return fallback;
  return path.join(OPENCLAW_HOME, "workspace");
}

function isMemoryEntryType(value: string): value is MemoryEntryType {
  return [
    "discovery",
    "decision",
    "problem",
    "solution",
    "pattern",
    "warning",
    "success",
    "refactor",
    "bugfix",
    "feature",
  ].includes(value);
}

function normalizePathForPayload(basePath: string, filePath: string): string {
  const relative = path.relative(basePath, filePath) || path.basename(filePath);
  return relative.split(path.sep).join("/");
}

async function listMarkdownFilesRecursively(targetDir: string): Promise<string[]> {
  const rows = await readdir(targetDir, { withFileTypes: true });
  const files = await Promise.all(
    rows.map(async (row) => {
      const nextPath = path.join(targetDir, row.name);
      if (row.isDirectory()) {
        return listMarkdownFilesRecursively(nextPath);
      }
      return nextPath.endsWith(".md") ? [nextPath] : [];
    }),
  );
  return files.flat();
}

async function listWorkspaceFilesRecursively(workspacePath: string, currentDir: string = workspacePath): Promise<JsonObject[]> {
  let rows: import("node:fs").Dirent[] = [];
  try {
    rows = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = await Promise.all(
    rows.map(async (row): Promise<JsonObject[]> => {
      const nextPath = path.join(currentDir, row.name);
      if (row.isDirectory()) {
        if (row.name === ".git" || row.name === "node_modules" || row.name === ".cursor") return [];
        return listWorkspaceFilesRecursively(workspacePath, nextPath);
      }
      if (!row.isFile()) return [];
      let size: number | undefined;
      let updatedAtMs: number | undefined;
      try {
        const fileStat = await stat(nextPath);
        size = fileStat.size;
        updatedAtMs = fileStat.mtimeMs;
      } catch {
        // best effort metadata only
      }
      const relativePath = normalizePathForPayload(workspacePath, nextPath);
      return [
        {
          name: relativePath,
          path: relativePath,
          missing: false,
          ...(typeof size === "number" ? { size } : {}),
          ...(typeof updatedAtMs === "number" ? { updatedAtMs } : {}),
        } satisfies JsonObject,
      ];
    }),
  );
  return files.flat();
}

function parseMemoryLine(input: {
  line: string;
  sourcePath: string;
  lineNumber: number;
  agentId: string;
}): JsonObject | null {
  const rawText = input.line.trim();
  if (!rawText || rawText.startsWith("#")) return null;
  const memoryPattern =
    /^(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?\s*[+-]\d{4})?)\s*\|\s*([^|]+)\|\s*([A-Za-z]+-\d+)\s*\|\s*([^|]+)\|\s*(.+)$/;
  const match = rawText.match(memoryPattern);
  const lowerSource = input.sourcePath.toLowerCase();

  if (match) {
    const tsRaw = match[1].trim();
    const typeRaw = match[2].trim().toLowerCase();
    const memId = match[3].trim();
    const tags = match[4]
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const text = match[5].trim();
    const ts = Date.parse(tsRaw);
    return {
      id: `${input.agentId}:${input.sourcePath}:${input.lineNumber}`,
      agentId: input.agentId,
      sourcePath: input.sourcePath,
      lineNumber: input.lineNumber,
      rawText,
      text,
      ts: Number.isFinite(ts) ? ts : undefined,
      timestamp: Number.isFinite(ts) ? ts : undefined,
      type: isMemoryEntryType(typeRaw) ? typeRaw : undefined,
      memId,
      tags,
      metadata: {},
    } satisfies JsonObject;
  }

  // Daily note fallback: preserve non-empty lines from memory/*.md as row entries.
  if (lowerSource.startsWith("memory/")) {
    const dateMatch = input.sourcePath.match(/memory\/(\d{4}-\d{2}-\d{2})\.md$/);
    const ts = dateMatch ? Date.parse(`${dateMatch[1]}T00:00:00Z`) : Number.NaN;
    return {
      id: `${input.agentId}:${input.sourcePath}:${input.lineNumber}`,
      agentId: input.agentId,
      sourcePath: input.sourcePath,
      lineNumber: input.lineNumber,
      rawText,
      text: rawText,
      ts: Number.isFinite(ts) ? ts : undefined,
      timestamp: Number.isFinite(ts) ? ts : undefined,
      type: undefined,
      memId: undefined,
      tags: [],
      metadata: {},
    } satisfies JsonObject;
  }

  return null;
}

async function readAgentMemoryEntries(config: JsonObject, agent: JsonObject): Promise<JsonObject[]> {
  const agentId = String(agent.id ?? "").trim();
  if (!agentId) return [];
  const workspacePath = path.resolve(resolveWorkspace(config, agent));
  const rootMemoryPath = path.join(workspacePath, "MEMORY.md");
  const dailyMemoryDir = path.join(workspacePath, "memory");
  const entries: Array<{ entry: JsonObject; order: number; sourcePath: string; lineNumber: number; ts?: number }> = [];
  const candidateFiles: string[] = [];
  let order = 0;

  if (existsSync(rootMemoryPath)) {
    candidateFiles.push(rootMemoryPath);
  }
  if (existsSync(dailyMemoryDir)) {
    const dailyFiles = await listMarkdownFilesRecursively(dailyMemoryDir);
    candidateFiles.push(...dailyFiles.sort((a, b) => a.localeCompare(b)));
  }

  for (const filePath of candidateFiles) {
    let raw = "";
    try {
      raw = await readFile(filePath, "utf-8");
    } catch {
      // Ignore unreadable files so one bad memory document does not break the whole endpoint.
      continue;
    }
    const sourcePath = normalizePathForPayload(workspacePath, filePath);
    const lines = raw.split(/\r?\n/g);
    for (let index = 0; index < lines.length; index += 1) {
      const parsed = parseMemoryLine({
        line: lines[index],
        sourcePath,
        lineNumber: index + 1,
        agentId,
      });
      if (!parsed) continue;
      const ts = typeof parsed.ts === "number" ? parsed.ts : undefined;
      entries.push({ entry: parsed, order, sourcePath, lineNumber: index + 1, ts });
      order += 1;
    }
  }

  entries.sort((left, right) => {
    const leftHasTs = typeof left.ts === "number";
    const rightHasTs = typeof right.ts === "number";
    if (leftHasTs && rightHasTs) return (right.ts as number) - (left.ts as number);
    if (leftHasTs && !rightHasTs) return -1;
    if (!leftHasTs && rightHasTs) return 1;
    if (left.sourcePath !== right.sourcePath) return left.sourcePath.localeCompare(right.sourcePath);
    if (left.lineNumber !== right.lineNumber) return left.lineNumber - right.lineNumber;
    return left.order - right.order;
  });

  return entries.map((row) => row.entry);
}

async function readAgentSessionsIndex(agentId: string): Promise<Record<string, JsonObject>> {
  const sessionsPath = path.join(OPENCLAW_HOME, "agents", agentId, "sessions", "sessions.json");
  const parsed = await readJsonFile<JsonObject>(sessionsPath, {});
  const rows: Record<string, JsonObject> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!value || typeof value !== "object") continue;
    rows[key] = value as JsonObject;
  }
  return rows;
}

function resolveSessionTranscriptPath(agentId: string, sessionRow: JsonObject): string | null {
  const sessionsDir = path.join(OPENCLAW_HOME, "agents", agentId, "sessions");
  const directTranscriptPath = String(sessionRow.transcriptPath ?? "").trim();
  if (directTranscriptPath) {
    return path.isAbsolute(directTranscriptPath) ? directTranscriptPath : path.join(sessionsDir, directTranscriptPath);
  }
  const sessionId = String(sessionRow.sessionId ?? "").trim();
  if (!sessionId) return null;
  return path.join(sessionsDir, `${sessionId}.jsonl`);
}

function extractTextFromTranscriptMessage(message: JsonObject): string {
  const content = Array.isArray(message.content) ? message.content : [];
  const chunks = content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const row = item as JsonObject;
      if (typeof row.text === "string") return row.text;
      if (typeof row.content === "string") return row.content;
      return "";
    })
    .filter(Boolean);
  if (chunks.length > 0) return chunks.join("\n");
  if (typeof message.text === "string") return message.text;
  return "";
}

function extractTextFromTranscriptRow(row: JsonObject): string {
  const type = String(row.type ?? "message");
  if (type === "message") {
    const msg = row.message && typeof row.message === "object" ? (row.message as JsonObject) : null;
    if (!msg) return "";
    return extractTextFromTranscriptMessage(msg).trim();
  }
  if (typeof row.text === "string" && row.text.trim()) return row.text.trim();
  if (typeof row.content === "string" && row.content.trim()) return row.content.trim();
  if (type === "tool") {
    const toolName = typeof row.toolName === "string" ? row.toolName.trim() : "";
    const status = typeof row.status === "string" ? row.status.trim() : "";
    const args = row.args ? JSON.stringify(row.args) : "";
    return [toolName || "tool", status, args].filter(Boolean).join(" ").trim();
  }
  return "";
}

function getUsageNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptySessionUsageTotals(): SessionUsageTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    responseCount: 0,
  };
}

function buildSessionUsageSummary(rows: JsonObject[]): SessionUsageSummary | undefined {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const totals = emptySessionUsageTotals();
  const last24Hours = emptySessionUsageTotals();
  const last7Days = emptySessionUsageTotals();
  let lastResponse: SessionUsageSummary["lastResponse"];
  for (const row of rows) {
    if (String(row.type ?? "") !== "message") continue;
    const message = row.message && typeof row.message === "object" ? (row.message as JsonObject) : null;
    if (!message || String(message.role ?? "") !== "assistant") continue;
    const usage = message.usage && typeof message.usage === "object" ? (message.usage as JsonObject) : null;
    if (!usage) continue;
    const usageSnapshot = {
      inputTokens: Math.max(0, Math.round(getUsageNumber(usage.input))),
      outputTokens: Math.max(0, Math.round(getUsageNumber(usage.output))),
      cacheReadTokens: Math.max(0, Math.round(getUsageNumber(usage.cacheRead))),
      cacheWriteTokens: Math.max(0, Math.round(getUsageNumber(usage.cacheWrite))),
      totalTokens: Math.max(0, Math.round(getUsageNumber(usage.totalTokens))),
      estimatedCostUsd: Math.max(
        0,
        getUsageNumber(
          usage.cost && typeof usage.cost === "object" ? (usage.cost as JsonObject).total : 0,
        ),
      ),
      responseCount: 1,
      provider: typeof message.provider === "string" ? message.provider : undefined,
      model: typeof message.model === "string" ? message.model : undefined,
      timestamp: typeof row.timestamp === "string" ? Date.parse(row.timestamp) : undefined,
    };
    totals.inputTokens += usageSnapshot.inputTokens;
    totals.outputTokens += usageSnapshot.outputTokens;
    totals.cacheReadTokens += usageSnapshot.cacheReadTokens;
    totals.cacheWriteTokens += usageSnapshot.cacheWriteTokens;
    totals.totalTokens += usageSnapshot.totalTokens;
    totals.estimatedCostUsd += usageSnapshot.estimatedCostUsd;
    totals.responseCount += 1;
    if ((usageSnapshot.timestamp ?? 0) >= dayAgo) {
      last24Hours.inputTokens += usageSnapshot.inputTokens;
      last24Hours.outputTokens += usageSnapshot.outputTokens;
      last24Hours.cacheReadTokens += usageSnapshot.cacheReadTokens;
      last24Hours.cacheWriteTokens += usageSnapshot.cacheWriteTokens;
      last24Hours.totalTokens += usageSnapshot.totalTokens;
      last24Hours.estimatedCostUsd += usageSnapshot.estimatedCostUsd;
      last24Hours.responseCount += 1;
    }
    if ((usageSnapshot.timestamp ?? 0) >= weekAgo) {
      last7Days.inputTokens += usageSnapshot.inputTokens;
      last7Days.outputTokens += usageSnapshot.outputTokens;
      last7Days.cacheReadTokens += usageSnapshot.cacheReadTokens;
      last7Days.cacheWriteTokens += usageSnapshot.cacheWriteTokens;
      last7Days.totalTokens += usageSnapshot.totalTokens;
      last7Days.estimatedCostUsd += usageSnapshot.estimatedCostUsd;
      last7Days.responseCount += 1;
    }
    lastResponse = usageSnapshot;
  }
  if (totals.responseCount === 0) return undefined;
  return {
    ...(lastResponse ? { lastResponse } : {}),
    sessionTotals: totals,
    last24Hours,
    last7Days,
  };
}

async function readSessionTimelineData(
  agentId: string,
  sessionKey: string,
  limit: number,
): Promise<{ events: JsonObject[]; usageSummary?: SessionUsageSummary }> {
  const sessions = await readAgentSessionsIndex(agentId);
  const sessionRow = sessions[sessionKey];
  if (!sessionRow) return { events: [] };
  const transcriptPath = resolveSessionTranscriptPath(agentId, sessionRow);
  if (!transcriptPath || !existsSync(transcriptPath)) return { events: [] };
  let raw = "";
  try {
    raw = await readFile(transcriptPath, "utf-8");
  } catch {
    return { events: [] };
  }
  const lines = raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  const events: JsonObject[] = [];
  const transcriptRows: JsonObject[] = [];
  const fallbackBaseTs = typeof sessionRow.updatedAt === "number" ? sessionRow.updatedAt : 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    try {
      const row = JSON.parse(line) as JsonObject;
      transcriptRows.push(row);
      const rowType = String(row.type ?? "status");
      const text = extractTextFromTranscriptRow(row);
      if (!text) continue;
      const tsRaw = typeof row.timestamp === "string" ? Date.parse(row.timestamp) : Number.NaN;
      const role =
        rowType === "message"
          ? String(((row.message as JsonObject | undefined)?.role) ?? "assistant")
          : rowType === "tool"
            ? "tool"
            : "system";
      events.push({
        ts: Number.isFinite(tsRaw) ? tsRaw : fallbackBaseTs + index,
        type: rowType === "tool" ? "tool" : rowType === "message" ? "message" : "status",
        role,
        text,
        source: typeof row.source === "string" ? row.source : undefined,
        eventId: typeof row.id === "string" ? row.id : undefined,
        rawType: rowType,
      });
    } catch {
      // Skip malformed transcript lines.
    }
  }
  return {
    events: events.slice(Math.max(0, events.length - Math.max(1, limit))),
    usageSummary: buildSessionUsageSummary(transcriptRows),
  };
}

function normalizeOfficeObjects(objects: unknown[]): JsonObject[] {
  return objects
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const row = entry as JsonObject;
      const id = String(row.id ?? row._id ?? row.identifier ?? "").trim();
      const identifier = String(row.identifier ?? id).trim();
      const meshType = String(row.meshType ?? "");
      const position = Array.isArray(row.position) ? row.position : [0, 0, 0];
      const rotation = Array.isArray(row.rotation) ? row.rotation : [0, 0, 0];
      const scale = Array.isArray(row.scale) ? row.scale : undefined;
      const metadata = row.metadata && typeof row.metadata === "object" ? (row.metadata as JsonObject) : {};
      if (!id || !identifier || !meshType) return null;
      return {
        id,
        identifier,
        meshType,
        position,
        rotation,
        ...(scale ? { scale } : {}),
        metadata,
      } satisfies JsonObject;
    })
    .filter((entry): entry is JsonObject => entry !== null);
}

function normalizeProvider(value: unknown): TaskProvider {
  const provider = String(value ?? "internal");
  if (provider === "notion" || provider === "vibe" || provider === "linear") return provider;
  return "internal";
}

function normalizeSyncState(value: unknown): TaskSyncState {
  const syncState = String(value ?? "healthy");
  if (syncState === "pending" || syncState === "conflict" || syncState === "error") return syncState;
  return "healthy";
}

function normalizeFederatedTasks(tasks: unknown[]): JsonObject[] {
  return tasks
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const row = entry as JsonObject;
      const id = String(row.id ?? row.taskId ?? "").trim();
      const projectId = String(row.projectId ?? "").trim();
      const title = String(row.title ?? "").trim();
      if (!id || !projectId || !title) return null;
      const status = String(row.status ?? "todo");
      const priority = String(row.priority ?? "medium");
      const provider = normalizeProvider(row.provider ?? row.sourceProvider);
      return {
        id,
        projectId,
        title,
        status: status === "in_progress" || status === "blocked" || status === "done" ? status : "todo",
        ownerAgentId: typeof row.ownerAgentId === "string" ? row.ownerAgentId : undefined,
        priority: priority === "low" || priority === "high" ? priority : "medium",
        provider,
        canonicalProvider: normalizeProvider(row.canonicalProvider ?? provider),
        providerUrl: typeof row.providerUrl === "string" ? row.providerUrl : "",
        syncState: normalizeSyncState(row.syncState),
        syncError: typeof row.syncError === "string" ? row.syncError : undefined,
        updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : Date.now(),
      } satisfies JsonObject;
    })
    .filter((entry): entry is JsonObject => entry !== null);
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeKpiList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const row of input) {
    if (typeof row !== "string") continue;
    const trimmed = row.trim();
    if (trimmed) out.add(trimmed);
  }
  return [...out];
}

function normalizeTeamRoles(input: unknown): TeamRole[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<TeamRole>();
  for (const row of input) {
    if (row === "builder" || row === "growth_marketer" || row === "pm" || row === "biz_pm" || row === "biz_executor") out.add(row);
  }
  return [...out];
}

function normalizeBusinessType(input: unknown): BusinessType | null {
  if (
    input === "affiliate_marketing" ||
    input === "content_creator" ||
    input === "saas" ||
    input === "custom"
  ) {
    return input;
  }
  return null;
}

function projectIdFromTeamId(teamId: string): string {
  return teamId.startsWith("team-") ? teamId.slice("team-".length) : teamId;
}

function roleSuffix(role: TeamRole): string {
  if (role === "growth_marketer") return "growth";
  if (role === "biz_pm") return "pm";
  if (role === "biz_executor") return "executor";
  return role;
}

function defaultHeartbeatProfileIdForRole(role: TeamRole): string {
  if (role === "builder") return "hb-builder";
  if (role === "growth_marketer") return "hb-growth";
  if (role === "biz_pm") return "hb-biz-pm";
  if (role === "biz_executor") return "hb-biz-executor";
  return "hb-pm";
}

function defaultBusinessConfig(
  type: BusinessType,
  overrides?: { measure?: string; execute?: string; distribute?: string },
): JsonObject {
  return {
    type,
    slots: {
      measure: {
        skillId: overrides?.measure?.trim() || "amazon-affiliate-metrics",
        category: "measure",
        config: type === "affiliate_marketing" ? { platform: "amazon_associates" } : {},
      },
      execute: {
        skillId: overrides?.execute?.trim() || "video-generator",
        category: "execute",
        config: {},
      },
      distribute: {
        skillId: overrides?.distribute?.trim() || "tiktok-poster",
        category: "distribute",
        config: {},
      },
    },
  } satisfies JsonObject;
}

function defaultProjectResources(projectId: string): JsonObject[] {
  return [
    {
      id: `${projectId}:cash`,
      projectId,
      type: "cash_budget",
      name: "Cash Budget",
      unit: "usd_cents",
      remaining: 5000,
      limit: 5000,
      reserved: 0,
      trackerSkillId: "resource-cash-tracker",
      refreshCadenceMinutes: 15,
      policy: {
        advisoryOnly: true,
        softLimit: 1500,
        hardLimit: 0,
        whenLow: "deprioritize_expensive_tasks",
      },
      metadata: { currency: "USD" },
    } satisfies JsonObject,
    {
      id: `${projectId}:api`,
      projectId,
      type: "api_quota",
      name: "API Quota",
      unit: "requests",
      remaining: 1000,
      limit: 1000,
      reserved: 0,
      trackerSkillId: "resource-api-quota-tracker",
      refreshCadenceMinutes: 15,
      policy: {
        advisoryOnly: true,
        softLimit: 200,
        hardLimit: 0,
        whenLow: "warn",
      },
    } satisfies JsonObject,
    {
      id: `${projectId}:distribution`,
      projectId,
      type: "distribution_slots",
      name: "Distribution Slots",
      unit: "posts_per_day",
      remaining: 10,
      limit: 10,
      reserved: 0,
      trackerSkillId: "resource-distribution-tracker",
      refreshCadenceMinutes: 60,
      policy: {
        advisoryOnly: true,
        softLimit: 2,
        hardLimit: 0,
        whenLow: "ask_pm_review",
      },
      metadata: { platform: "tiktok" },
    } satisfies JsonObject,
  ];
}

function parseSkillList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function uniqueSkills(skills: string[]): string[] {
  return [...new Set(skills.map((entry) => entry.trim()).filter(Boolean))];
}

function applyAgentSkillsByMode(currentSkills: string[], targetSkills: string[], mode: BusinessEquipMode): string[] {
  if (mode === "append_only") return uniqueSkills([...currentSkills, ...targetSkills]);
  return uniqueSkills(targetSkills);
}

function buildTeamBusinessSkillTargets(project: JsonObject): { pmSkills: string[]; executorSkills: string[] } {
  const businessConfig = project.businessConfig && typeof project.businessConfig === "object" ? (project.businessConfig as JsonObject) : {};
  const slots = businessConfig.slots && typeof businessConfig.slots === "object" ? (businessConfig.slots as JsonObject) : {};
  const measureSlot = slots.measure && typeof slots.measure === "object" ? (slots.measure as JsonObject) : {};
  const executeSlot = slots.execute && typeof slots.execute === "object" ? (slots.execute as JsonObject) : {};
  const distributeSlot = slots.distribute && typeof slots.distribute === "object" ? (slots.distribute as JsonObject) : {};
  const slotSkills = uniqueSkills([
    ...parseSkillList(typeof measureSlot.skillId === "string" ? measureSlot.skillId : ""),
    ...parseSkillList(typeof executeSlot.skillId === "string" ? executeSlot.skillId : ""),
    ...parseSkillList(typeof distributeSlot.skillId === "string" ? distributeSlot.skillId : ""),
  ]);
  const resources = Array.isArray(project.resources) ? (project.resources as JsonObject[]) : [];
  const trackerSkills = uniqueSkills(
    resources
      .map((resource) => (typeof resource.trackerSkillId === "string" ? resource.trackerSkillId : ""))
      .filter(Boolean),
  );
  const sharedCore = ["shellcorp-team-cli", "status-self-reporter"];
  const pmCore = ["shellcorp-kanban-ops", "ledger-manager", "experiment-runner"];
  return {
    pmSkills: uniqueSkills([...sharedCore, ...pmCore, ...slotSkills, ...trackerSkills]),
    executorSkills: uniqueSkills([...sharedCore, ...slotSkills]),
  };
}

function ensureBusinessHeartbeatProfiles(company: JsonObject): JsonObject {
  const heartbeatProfiles = Array.isArray(company.heartbeatProfiles) ? [...company.heartbeatProfiles] : [];
  const hasBizPm = heartbeatProfiles.some(
    (entry) => entry && typeof entry === "object" && String((entry as JsonObject).id ?? "") === "hb-biz-pm",
  );
  const hasBizExecutor = heartbeatProfiles.some(
    (entry) => entry && typeof entry === "object" && String((entry as JsonObject).id ?? "") === "hb-biz-executor",
  );
  if (!hasBizPm) {
    heartbeatProfiles.push({
      id: "hb-biz-pm",
      role: "biz_pm",
      cadenceMinutes: 5,
      teamDescription: "Business PM loop",
      productDetails: "Track KPIs and profitability, manage kanban",
      goal: "Keep business net-positive with clear execution priorities",
    } satisfies JsonObject);
  }
  if (!hasBizExecutor) {
    heartbeatProfiles.push({
      id: "hb-biz-executor",
      role: "biz_executor",
      cadenceMinutes: 5,
      teamDescription: "Business execution loop",
      productDetails: "Execute highest-value tasks and report measurements",
      goal: "Create and distribute growth assets every heartbeat",
    } satisfies JsonObject);
  }
  return {
    ...company,
    heartbeatProfiles,
  };
}

async function upsertBusinessCronJobsBridge(projectId: string, agentIds: string[]): Promise<void> {
  let jobsRaw = await readJsonFile<unknown>(CRON_JOBS_PATH, []);
  if (!Array.isArray(jobsRaw)) jobsRaw = [];
  const jobsById = new Map<string, JsonObject>();
  for (const row of jobsRaw) {
    if (!row || typeof row !== "object") continue;
    const obj = row as JsonObject;
    const id = typeof obj.id === "string" ? obj.id : "";
    if (!id) continue;
    jobsById.set(id, obj);
  }

  const now = Date.now();
  for (const agentId of agentIds) {
    const isPm = /-pm$/.test(agentId);
    const jobId = `biz-heartbeat-${projectId}-${isPm ? "pm" : "executor"}`;
    jobsById.set(jobId, {
      id: jobId,
      agentId,
      name: `Business heartbeat (${isPm ? "PM" : "Executor"}) ${projectId}`,
      enabled: true,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: { kind: "every", everyMs: 180000 },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: {
        kind: "agentTurn",
        message: isPm
          ? "Read HEARTBEAT.md, review KPIs and P&L, reprioritize kanban tasks, and return HEARTBEAT_OK."
          : "Read HEARTBEAT.md, execute the highest-priority business task, and return HEARTBEAT_OK.",
      },
      delivery: { mode: "none" },
    } satisfies JsonObject);
  }
  await mkdir(path.dirname(CRON_JOBS_PATH), { recursive: true });
  await writeFile(CRON_JOBS_PATH, `${JSON.stringify([...jobsById.values()], null, 2)}\n`, "utf-8");
}

function resourcesSnapshot(project: JsonObject): string {
  const resources = Array.isArray(project.resources) ? (project.resources as JsonObject[]) : [];
  if (resources.length === 0) return "none";
  return resources
    .map((resource) => {
      const name = String(resource.name ?? "resource");
      const remaining = Number(resource.remaining ?? 0);
      const limit = Number(resource.limit ?? 0);
      const unit = String(resource.unit ?? "units");
      return `${name}=${remaining}/${limit} ${unit}`;
    })
    .join(" | ");
}

function resourceAdvisories(project: JsonObject): string {
  const resources = Array.isArray(project.resources) ? (project.resources as JsonObject[]) : [];
  const advisories: string[] = [];
  for (const resource of resources) {
    const policy = resource.policy && typeof resource.policy === "object" ? (resource.policy as JsonObject) : {};
    const name = String(resource.name ?? "resource");
    const remaining = Number(resource.remaining ?? 0);
    const softLimit = Number(policy.softLimit ?? Number.NaN);
    const hardLimit = Number(policy.hardLimit ?? Number.NaN);
    const whenLow = String(policy.whenLow ?? "warn");
    if (Number.isFinite(hardLimit) && remaining <= hardLimit) {
      advisories.push(`${name}: hard-limit reached -> ${whenLow}`);
      continue;
    }
    if (Number.isFinite(softLimit) && remaining <= softLimit) {
      advisories.push(`${name}: low -> ${whenLow}`);
    }
  }
  return advisories.length > 0 ? advisories.join("; ") : "none";
}

function renderHeartbeatTemplate(rawTemplate: string, project: JsonObject): string {
  const businessConfig = project.businessConfig && typeof project.businessConfig === "object" ? (project.businessConfig as JsonObject) : {};
  const slots = businessConfig.slots && typeof businessConfig.slots === "object" ? (businessConfig.slots as JsonObject) : {};
  const measure = slots.measure && typeof slots.measure === "object" ? (slots.measure as JsonObject) : {};
  const execute = slots.execute && typeof slots.execute === "object" ? (slots.execute as JsonObject) : {};
  const distribute = slots.distribute && typeof slots.distribute === "object" ? (slots.distribute as JsonObject) : {};
  const ledger = Array.isArray(project.ledger) ? (project.ledger as JsonObject[]) : [];
  const revenue = ledger
    .filter((entry) => String(entry.type ?? "") === "revenue")
    .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const costs = ledger
    .filter((entry) => String(entry.type ?? "") === "cost")
    .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const profit = revenue - costs;
  const experiments = Array.isArray(project.experiments) ? (project.experiments as JsonObject[]) : [];
  const metrics = Array.isArray(project.metricEvents) ? (project.metricEvents as JsonObject[]) : [];
  let rendered = rawTemplate;
  const replacements: Record<string, string> = {
    "{projectName}": String(project.name ?? ""),
    "{businessType}": String(businessConfig.type ?? "custom"),
    "{projectGoal}": String(project.goal ?? ""),
    "{totalRevenue}": String(revenue),
    "{totalCosts}": String(costs),
    "{profit}": String(profit),
    "{experimentsSummary}":
      experiments.length > 0
        ? experiments
            .slice(-3)
            .map((entry) => `${String(entry.hypothesis ?? "")} (${String(entry.status ?? "running")})`)
            .join("; ")
        : "none",
    "{recentMetrics}": metrics.length > 0 ? JSON.stringify((metrics[metrics.length - 1] as JsonObject).metrics ?? {}) : "none",
    "{openTasks}": "0",
    "{inProgressTasks}": "0",
    "{blockedTasks}": "0",
    "{resourcesSnapshot}": resourcesSnapshot(project),
    "{resourceAdvisories}": resourceAdvisories(project),
    "{measureSkillId}": String(measure.skillId ?? "not-set"),
    "{executeSkillId}": String(execute.skillId ?? "not-set"),
    "{distributeSkillId}": String(distribute.skillId ?? "not-set"),
    "{measureConfig}": JSON.stringify(measure.config ?? {}),
    "{executeConfig}": JSON.stringify(execute.config ?? {}),
    "{distributeConfig}": JSON.stringify(distribute.config ?? {}),
    "{tasksList}": "[]",
  };
  for (const [needle, value] of Object.entries(replacements)) {
    rendered = rendered.split(needle).join(value);
  }
  return rendered;
}

function shellcorpStateBridge() {
  return {
    name: "shellcorp-openclaw-state-bridge",
    configureServer(server: {
      middlewares: { use: (cb: (req: { method?: string; url?: string; on: (name: string, cb: (chunk?: Buffer) => void) => void }, res: { setHeader: (k: string, v: string) => void; end: (body: string) => void }, next: () => void) => void) => void };
    }) {
      server.middlewares.use(async (req, res, next) => {
        const method = (req.method || "GET").toUpperCase();
        const url = new URL(req.url || "/", "http://127.0.0.1:5173");
        const pathname = url.pathname;

        if (!pathname.startsWith("/openclaw/")) {
          next();
          return;
        }

        const config = await readJsonFile<JsonObject>(OPENCLAW_CONFIG_PATH, {});
        const configuredAgents = normalizeAgentsFromConfig(config);

        if (method === "GET" && pathname === "/openclaw/config") {
          writeJson(res, 200, { stateVersion: Date.now(), config });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/agents") {
          const agents = await Promise.all(
            configuredAgents.map(async (agent) => {
              const agentId = String(agent.id ?? "").trim();
              const sessions = await readAgentSessionsIndex(agentId);
              return {
                agentId,
                displayName: String((agent.identity as JsonObject | undefined)?.name ?? agent.name ?? agentId),
                workspacePath: resolveWorkspace(config, agent),
                agentDir: resolveAgentDir(agent),
                sandboxMode: String(((agent.sandbox as JsonObject | undefined)?.mode ?? "off")),
                toolPolicy: {
                  allow: Array.isArray((agent.tools as JsonObject | undefined)?.allow) ? ((agent.tools as JsonObject).allow as unknown[]) : [],
                  deny: Array.isArray((agent.tools as JsonObject | undefined)?.deny) ? ((agent.tools as JsonObject).deny as unknown[]) : [],
                },
                sessionCount: Object.keys(sessions).length,
                lastUpdatedAt: Date.now(),
              };
            }),
          );
          writeJson(res, 200, { agents });
          return;
        }

        const sessionsMatch = pathname.match(/^\/openclaw\/agents\/([^/]+)\/sessions$/);
        if (method === "GET" && sessionsMatch) {
          const agentId = decodeURIComponent(sessionsMatch[1]);
          const sessions = await readAgentSessionsIndex(agentId);
          const payload = Object.entries(sessions).map(([sessionKey, row]) => ({
            sessionKey,
            sessionId: typeof row.sessionId === "string" ? row.sessionId : undefined,
            updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : 0,
            channel: typeof (row.deliveryContext as JsonObject | undefined)?.channel === "string" ? String((row.deliveryContext as JsonObject).channel) : undefined,
            peerLabel: typeof row.lastTo === "string" ? row.lastTo : undefined,
            origin: typeof (row.origin as JsonObject | undefined)?.provider === "string" ? String((row.origin as JsonObject).provider) : undefined,
          }));
          writeJson(res, 200, { sessions: payload });
          return;
        }

        const memoryEntriesMatch = pathname.match(/^\/openclaw\/agents\/([^/]+)\/memory-entries$/);
        if (method === "GET" && memoryEntriesMatch) {
          const agentId = decodeURIComponent(memoryEntriesMatch[1]);
          const configuredAgent = configuredAgents.find((agent) => String(agent.id ?? "").trim() === agentId);
          if (!configuredAgent) {
            writeJson(res, 404, { error: "agent_not_found", entries: [] });
            return;
          }
          try {
            const entries = await readAgentMemoryEntries(config, configuredAgent);
            writeJson(res, 200, { entries });
          } catch {
            writeJson(res, 500, { error: "memory_entries_unavailable", entries: [] });
          }
          return;
        }

        const agentFilesListMatch = pathname.match(/^\/openclaw\/agents\/([^/]+)\/files$/);
        if (method === "GET" && agentFilesListMatch) {
          const agentId = decodeURIComponent(agentFilesListMatch[1]);
          const configuredAgent = configuredAgents.find((agent) => String(agent.id ?? "").trim() === agentId);
          if (!configuredAgent) {
            writeJson(res, 404, { error: "agent_not_found", agentId, workspace: "", files: [] });
            return;
          }
          const workspacePath = path.resolve(resolveWorkspace(config, configuredAgent));
          const files = existsSync(workspacePath) ? await listWorkspaceFilesRecursively(workspacePath) : [];
          writeJson(res, 200, { agentId, workspace: workspacePath, files });
          return;
        }

        const agentFilesGetMatch = pathname.match(/^\/openclaw\/agents\/([^/]+)\/files\/get$/);
        if (method === "GET" && agentFilesGetMatch) {
          const agentId = decodeURIComponent(agentFilesGetMatch[1]);
          const requestedName = url.searchParams.get("name") ?? "";
          const safeName = requestedName.replace(/\\/g, "/").replace(/^\/+/, "");
          if (!safeName || safeName.includes("..")) {
            writeJson(res, 400, { error: "invalid_file_name" });
            return;
          }
          const configuredAgent = configuredAgents.find((agent) => String(agent.id ?? "").trim() === agentId);
          if (!configuredAgent) {
            writeJson(res, 404, { error: "agent_not_found" });
            return;
          }
          const workspacePath = path.resolve(resolveWorkspace(config, configuredAgent));
          const filePath = path.resolve(path.join(workspacePath, safeName));
          if (!filePath.startsWith(workspacePath)) {
            writeJson(res, 400, { error: "invalid_file_path" });
            return;
          }
          if (!existsSync(filePath)) {
            writeJson(res, 404, { error: "file_not_found", agentId, workspace: workspacePath, file: { name: safeName, path: safeName, missing: true } });
            return;
          }
          let content = "";
          try {
            content = await readFile(filePath, "utf-8");
          } catch {
            content = "";
          }
          let size: number | undefined;
          let updatedAtMs: number | undefined;
          try {
            const fileStat = await stat(filePath);
            size = fileStat.size;
            updatedAtMs = fileStat.mtimeMs;
          } catch {
            // best effort metadata only
          }
          writeJson(res, 200, {
            agentId,
            workspace: workspacePath,
            file: {
              name: safeName,
              path: safeName,
              missing: false,
              ...(typeof size === "number" ? { size } : {}),
              ...(typeof updatedAtMs === "number" ? { updatedAtMs } : {}),
              content,
            },
          });
          return;
        }

        const agentFilesRawMatch = pathname.match(/^\/openclaw\/agents\/([^/]+)\/files\/raw$/);
        if (method === "GET" && agentFilesRawMatch) {
          const agentId = decodeURIComponent(agentFilesRawMatch[1]);
          const requestedName = url.searchParams.get("name") ?? "";
          const safeName = requestedName.replace(/\\/g, "/").replace(/^\/+/, "");
          if (!safeName || safeName.includes("..")) {
            writeJson(res, 400, { error: "invalid_file_name" });
            return;
          }
          const configuredAgent = configuredAgents.find((agent) => String(agent.id ?? "").trim() === agentId);
          if (!configuredAgent) {
            writeJson(res, 404, { error: "agent_not_found" });
            return;
          }
          const workspacePath = path.resolve(resolveWorkspace(config, configuredAgent));
          const filePath = path.resolve(path.join(workspacePath, safeName));
          if (!filePath.startsWith(workspacePath)) {
            writeJson(res, 400, { error: "invalid_file_path" });
            return;
          }
          if (!existsSync(filePath)) {
            writeJson(res, 404, { error: "file_not_found" });
            return;
          }

          let bytes: Buffer;
          try {
            bytes = await readFile(filePath);
          } catch {
            writeJson(res, 500, { error: "file_read_failed" });
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          const mimeByExt: Record<string, string> = {
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".ogg": "video/ogg",
            ".mov": "video/quicktime",
          };
          const mime = mimeByExt[ext] ?? "application/octet-stream";
          res.setHeader("content-type", mime);
          res.setHeader("cache-control", "no-store");
          (res as { statusCode?: number }).statusCode = 200;
          (res as { end: (body: Buffer) => void }).end(bytes);
          return;
        }

        const eventsMatch = pathname.match(/^\/openclaw\/agents\/([^/]+)\/sessions\/([^/]+)\/events$/);
        if (method === "GET" && eventsMatch) {
          const agentId = decodeURIComponent(eventsMatch[1]);
          const sessionKey = decodeURIComponent(eventsMatch[2]);
          const requestedLimit = Number(url.searchParams.get("limit") ?? "200");
          const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(500, Math.floor(requestedLimit))) : 200;
          const timelineData = await readSessionTimelineData(agentId, sessionKey, limit);
          writeJson(res, 200, {
            timeline: {
              agentId,
              sessionKey,
              events: timelineData.events,
              usageSummary: timelineData.usageSummary,
              tokenUsage: timelineData.usageSummary
                ? {
                    inputTokens: timelineData.usageSummary.sessionTotals.inputTokens,
                    outputTokens: timelineData.usageSummary.sessionTotals.outputTokens,
                    totalTokens: timelineData.usageSummary.sessionTotals.totalTokens,
                    cacheReadTokens: timelineData.usageSummary.sessionTotals.cacheReadTokens,
                    cacheWriteTokens: timelineData.usageSummary.sessionTotals.cacheWriteTokens,
                    estimatedCostUsd: timelineData.usageSummary.sessionTotals.estimatedCostUsd,
                  }
                : undefined,
            },
          });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/chat/send") {
          const body = (await readBody(req)) as JsonObject;
          const agentId = String(body.agentId ?? "").trim();
          const sessionKey = String(body.sessionKey ?? "").trim();
          const message = String(body.message ?? "").trim();
          if (!agentId || !sessionKey || !message) {
            writeJson(res, 400, { ok: false, error: "chat_send_invalid_payload" });
            return;
          }
          const sessions = await readAgentSessionsIndex(agentId);
          const sessionRow = sessions[sessionKey];
          if (!sessionRow) {
            writeJson(res, 404, { ok: false, error: "chat_send_session_not_found" });
            return;
          }
          const transcriptPath = resolveSessionTranscriptPath(agentId, sessionRow);
          if (!transcriptPath) {
            writeJson(res, 404, { ok: false, error: "chat_send_transcript_missing" });
            return;
          }
          const nowIso = new Date().toISOString();
          const eventId = `ui-${Date.now().toString(36)}`;
          const payload = {
            type: "message",
            id: eventId,
            parentId: null,
            timestamp: nowIso,
            source: "ui",
            message: {
              role: "user",
              content: [{ type: "text", text: message }],
              timestamp: Date.now(),
            },
          };
          await mkdir(path.dirname(transcriptPath), { recursive: true });
          const existingTranscript = existsSync(transcriptPath) ? await readFile(transcriptPath, "utf-8") : "";
          const nextTranscript = `${existingTranscript}${existingTranscript.endsWith("\n") || existingTranscript.length === 0 ? "" : "\n"}${JSON.stringify(payload)}\n`;
          await writeFile(transcriptPath, nextTranscript, "utf-8");
          sessions[sessionKey] = {
            ...sessionRow,
            updatedAt: Date.now(),
            lastTo: "ShellCorp UI",
          };
          const sessionsPath = path.join(OPENCLAW_HOME, "agents", agentId, "sessions", "sessions.json");
          await writeFile(sessionsPath, `${JSON.stringify(sessions, null, 2)}\n`, "utf-8");
          writeJson(res, 200, { ok: true, eventId });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/skills/global-inventory") {
          const sharedSkills = await readInstalledSkillDirectories(
            path.join(OPENCLAW_HOME, "skills"),
            "shared",
          );
          writeJson(res, 200, { sharedSkills });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/skills/agent-inventory") {
          const agentId = String(url.searchParams.get("agentId") ?? "").trim();
          if (!agentId) {
            writeJson(res, 400, { ok: false, error: "agent_id_required" });
            return;
          }
          const workspacePath = await resolveAgentWorkspacePath(agentId);
          const workspaceSkills = await readInstalledSkillDirectories(
            path.join(workspacePath, "skills"),
            "agent",
          );
          const sharedSkills = await readInstalledSkillDirectories(
            path.join(OPENCLAW_HOME, "skills"),
            "shared",
          );
          writeJson(res, 200, { agentId, workspacePath, workspaceSkills, sharedSkills });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/skills/install-workspace") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = (await readBody(req)) as JsonObject;
          const agentId = String(body.agentId ?? "").trim();
          const skillId = String(body.skillId ?? "").trim();
          if (!agentId || !skillId) {
            writeJson(res, 400, { ok: false, error: "skill_install_invalid_payload" });
            return;
          }
          const sourceDir = await resolveRepoSkillDirectory(skillId);
          if (!sourceDir) {
            writeJson(res, 404, { ok: false, error: "skill_source_not_found" });
            return;
          }
          const workspacePath = await resolveAgentWorkspacePath(agentId);
          const destinationDir = path.join(workspacePath, "skills", skillId);
          await mkdir(path.dirname(destinationDir), { recursive: true });
          await cp(sourceDir, destinationDir, { recursive: true, force: true });
          writeJson(res, 200, { ok: true });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/skills/remove-workspace") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = (await readBody(req)) as JsonObject;
          const agentId = String(body.agentId ?? "").trim();
          const skillId = String(body.skillId ?? "").trim();
          if (!agentId || !skillId) {
            writeJson(res, 400, { ok: false, error: "skill_remove_invalid_payload" });
            return;
          }
          const workspacePath = await resolveAgentWorkspacePath(agentId);
          const destinationDir = path.join(workspacePath, "skills", skillId);
          await rm(destinationDir, { recursive: true, force: true });
          writeJson(res, 200, { ok: true });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/skills") {
          const catalog = await listSkillStudioCatalog(SKILLS_ROOT, REPO_ROOT);
          writeJson(res, 200, {
            skills: catalog.map((entry) => ({
              name: entry.skillId,
              category: entry.category,
              scope: entry.scope,
              sourcePath: entry.sourcePath,
              updatedAt: entry.updatedAt,
            })),
          });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/skills/catalog") {
          const skills = await listSkillStudioCatalog(SKILLS_ROOT, REPO_ROOT);
          writeJson(res, 200, { skills });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/memory") {
          writeJson(res, 200, { memory: [] });
          return;
        }

        const skillDetailMatch = pathname.match(/^\/openclaw\/skills\/([^/]+)$/);
        if (method === "GET" && skillDetailMatch) {
          const skillId = decodeURIComponent(skillDetailMatch[1]);
          const skill = await getSkillStudioDetail(SKILLS_ROOT, REPO_ROOT, skillId, [], url.searchParams.get("agentId") ?? undefined);
          if (!skill) {
            writeJson(res, 404, { error: "skill_not_found" });
            return;
          }
          writeJson(res, 200, { skill });
          return;
        }

        const skillFileMatch = pathname.match(/^\/openclaw\/skills\/([^/]+)\/file$/);
        if (method === "GET" && skillFileMatch) {
          const skillId = decodeURIComponent(skillFileMatch[1]);
          const filePath = url.searchParams.get("path") ?? "";
          if (!filePath.trim()) {
            writeJson(res, 400, { error: "skill_file_path_required" });
            return;
          }
          const file = await readSkillStudioFile(SKILLS_ROOT, REPO_ROOT, skillId, filePath);
          if (!file) {
            writeJson(res, 404, { error: "skill_file_not_found" });
            return;
          }
          writeJson(res, 200, { file });
          return;
        }
        if (method === "POST" && skillFileMatch) {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { error: "forbidden" });
            return;
          }
          const skillId = decodeURIComponent(skillFileMatch[1]);
          const body = (await readBody(req)) as JsonObject;
          const filePath = String(body.path ?? "").trim();
          if (!filePath) {
            writeJson(res, 400, { error: "skill_file_path_required" });
            return;
          }
          if (typeof body.content !== "string") {
            writeJson(res, 400, { error: "skill_file_content_required" });
            return;
          }
          const file = await saveSkillStudioFile(
            SKILLS_ROOT,
            REPO_ROOT,
            skillId,
            filePath,
            body.content,
          );
          if (!file) {
            writeJson(res, 404, { error: "skill_file_not_writable" });
            return;
          }
          writeJson(res, 200, { file });
          return;
        }

        const skillDemoRunMatch = pathname.match(/^\/openclaw\/skills\/([^/]+)\/demos\/run$/);
        if (method === "POST" && skillDemoRunMatch) {
          const skillId = decodeURIComponent(skillDemoRunMatch[1]);
          const body = (await readBody(req)) as JsonObject;
          const caseId = String(body.caseId ?? "").trim();
          if (!caseId) {
            writeJson(res, 400, { error: "skill_demo_case_required" });
            return;
          }
          const run = await runSkillStudioDemo(SKILLS_ROOT, REPO_ROOT, skillId, caseId);
          if (!run) {
            writeJson(res, 404, { error: "skill_demo_not_found" });
            return;
          }
          writeJson(res, 200, { run });
          return;
        }

        const skillConfigMatch = pathname.match(/^\/openclaw\/skills\/([^/]+)\/config$/);
        if (method === "POST" && skillConfigMatch) {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { error: "forbidden" });
            return;
          }
          const skillId = decodeURIComponent(skillConfigMatch[1]);
          const body = (await readBody(req)) as JsonObject;
          const skill = await saveSkillStudioManifest(SKILLS_ROOT, REPO_ROOT, skillId, {
            manifest:
              body.manifest && typeof body.manifest === "object"
                ? (body.manifest as Record<string, unknown> as never)
                : undefined,
            rawYaml: typeof body.rawYaml === "string" ? body.rawYaml : undefined,
          });
          if (!skill) {
            writeJson(res, 404, { error: "skill_not_found" });
            return;
          }
          writeJson(res, 200, { skill });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/company-model") {
          const company = await readJsonFile<JsonObject>(COMPANY_MODEL_PATH, {});
          writeJson(res, 200, { company });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/office-objects") {
          let objects = normalizeOfficeObjects(await readJsonFile<unknown[]>(OFFICE_OBJECTS_PATH, []));
          if (objects.length === 0) {
            const seeded = await readJsonFile<unknown[]>(OFFICE_OBJECTS_TEMPLATE_PATH, []);
            objects = normalizeOfficeObjects(seeded);
            if (objects.length > 0) {
              await mkdir(path.dirname(OFFICE_OBJECTS_PATH), { recursive: true });
              await writeFile(OFFICE_OBJECTS_PATH, `${JSON.stringify(objects, null, 2)}\n`, "utf-8");
            }
          }
          writeJson(res, 200, { objects });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/office-settings") {
          const settings = await readOfficeSettings();
          writeJson(res, 200, { settings });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/office-settings") {
          const body = (await readBody(req)) as JsonObject;
          const settings = normalizeOfficeSettings(body.settings ?? body);
          await mkdir(path.dirname(OFFICE_SETTINGS_PATH), { recursive: true });
          await writeFile(OFFICE_SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
          writeJson(res, 200, { ok: true, settings });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/mesh-assets") {
          const settings = await readOfficeSettings();
          const assets = await listMeshAssets(settings.meshAssetDir ?? DEFAULT_MESH_ASSET_DIR);
          writeJson(res, 200, { assets, meshAssetDir: settings.meshAssetDir ?? DEFAULT_MESH_ASSET_DIR });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/mesh-assets/download") {
          const body = (await readBody(req)) as JsonObject;
          const sourceUrl = typeof body.url === "string" ? body.url.trim() : "";
          const label = typeof body.label === "string" ? body.label : "";
          if (!sourceUrl) {
            writeJson(res, 400, { ok: false, error: "mesh_url_required" });
            return;
          }
          let parsedUrl: URL;
          try {
            parsedUrl = new URL(sourceUrl);
          } catch {
            writeJson(res, 400, { ok: false, error: "mesh_url_invalid" });
            return;
          }
          if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
            writeJson(res, 400, { ok: false, error: "mesh_url_protocol_invalid" });
            return;
          }

          const settings = await readOfficeSettings();
          const meshAssetDir = settings.meshAssetDir ?? DEFAULT_MESH_ASSET_DIR;
          await mkdir(meshAssetDir, { recursive: true });
          const ext = inferMeshExtensionFromUrl(sourceUrl);
          const desiredName = `${sanitizeLabelToFileBase(label || path.basename(parsedUrl.pathname, path.extname(parsedUrl.pathname)))}${ext}`;
          const targetPath = await toUniqueFilePath(meshAssetDir, desiredName);

          let response: Response;
          try {
            response = await fetch(sourceUrl);
          } catch {
            writeJson(res, 502, { ok: false, error: "mesh_download_unreachable" });
            return;
          }
          if (!response.ok) {
            writeJson(res, 502, { ok: false, error: `mesh_download_failed:${response.status}` });
            return;
          }
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          await writeFile(targetPath, buffer);
          const fileName = path.basename(targetPath);
          const fileStat = await stat(targetPath);

          writeJson(res, 200, {
            ok: true,
            asset: {
              assetId: fileName,
              label: path.basename(fileName, path.extname(fileName)),
              sourceUrl,
              localPath: targetPath,
              publicPath: asMeshPublicPath(fileName),
              fileName,
              fileSizeBytes: fileStat.size,
              sourceType: "downloaded",
              validated: true,
              addedAt: fileStat.mtimeMs,
            },
          });
          return;
        }

        const meshAssetMatch = pathname.match(/^\/openclaw\/assets\/meshes\/([^/]+)$/);
        if (method === "GET" && meshAssetMatch) {
          const fileName = decodeURIComponent(meshAssetMatch[1]);
          if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
            writeJson(res, 400, { ok: false, error: "mesh_asset_path_invalid" });
            return;
          }
          const settings = await readOfficeSettings();
          const meshAssetDir = settings.meshAssetDir ?? DEFAULT_MESH_ASSET_DIR;
          const filePath = path.join(meshAssetDir, fileName);
          const ext = path.extname(fileName).toLowerCase();
          const isMeshFile = MESH_EXTENSIONS.has(ext);
          const isPreviewFile = MESH_PREVIEW_EXTENSIONS.has(ext) && fileName.includes(".preview.");
          const isMetadataFile = ext === ".json" && fileName.endsWith(".meta.json");
          if (!isMeshFile && !isPreviewFile && !isMetadataFile) {
            writeJson(res, 400, { ok: false, error: "mesh_asset_extension_invalid" });
            return;
          }
          try {
            const bytes = await readFile(filePath);
            if (ext === ".gltf") {
              res.setHeader("content-type", "model/gltf+json");
            } else if (ext === ".glb") {
              res.setHeader("content-type", "model/gltf-binary");
            } else if (ext === ".png") {
              res.setHeader("content-type", "image/png");
            } else if (ext === ".jpg" || ext === ".jpeg") {
              res.setHeader("content-type", "image/jpeg");
            } else if (ext === ".webp") {
              res.setHeader("content-type", "image/webp");
            } else if (ext === ".json") {
              res.setHeader("content-type", "application/json");
            }
            (res as { statusCode?: number }).statusCode = 200;
            (res as { end: (body: Buffer) => void }).end(bytes);
          } catch {
            writeJson(res, 404, { ok: false, error: "mesh_asset_not_found" });
          }
          return;
        }

        if (method === "POST" && pathname === "/openclaw/office-objects") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = (await readBody(req)) as JsonObject;
          const input = Array.isArray(body.objects) ? body.objects : [];
          const objects = normalizeOfficeObjects(input);
          await mkdir(path.dirname(OFFICE_OBJECTS_PATH), { recursive: true });
          await writeFile(OFFICE_OBJECTS_PATH, `${JSON.stringify(objects, null, 2)}\n`, "utf-8");
          writeJson(res, 200, { ok: true, objects });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/company-model") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = (await readBody(req)) as JsonObject;
          const company = (body.company as JsonObject | undefined) ?? {};
          const tasks = Array.isArray(company.tasks) ? normalizeFederatedTasks(company.tasks) : [];
          await mkdir(path.dirname(COMPANY_MODEL_PATH), { recursive: true });
          const normalizedCompany = {
            ...company,
            tasks,
            federationPolicies: Array.isArray(company.federationPolicies) ? company.federationPolicies : [],
            providerIndexProfiles: Array.isArray(company.providerIndexProfiles) ? company.providerIndexProfiles : [],
          };
          await writeFile(COMPANY_MODEL_PATH, `${JSON.stringify(normalizedCompany, null, 2)}\n`, "utf-8");
          writeJson(res, 200, { ok: true, company: normalizedCompany });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/team/create") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = (await readBody(req)) as JsonObject;
          const name = typeof body.name === "string" ? body.name.trim() : "";
          const description = typeof body.description === "string" ? body.description.trim() : "";
          const goal = typeof body.goal === "string" ? body.goal.trim() : "";
          const kpis = normalizeKpiList(body.kpis);
          const businessType = normalizeBusinessType(body.businessType);
          const capabilitySkills =
            body.capabilitySkills && typeof body.capabilitySkills === "object"
              ? {
                  measure:
                    typeof (body.capabilitySkills as JsonObject).measure === "string"
                      ? String((body.capabilitySkills as JsonObject).measure)
                      : undefined,
                  execute:
                    typeof (body.capabilitySkills as JsonObject).execute === "string"
                      ? String((body.capabilitySkills as JsonObject).execute)
                      : undefined,
                  distribute:
                    typeof (body.capabilitySkills as JsonObject).distribute === "string"
                      ? String((body.capabilitySkills as JsonObject).distribute)
                      : undefined,
                }
              : undefined;
          const autoRoles = businessType ? (["biz_pm", "biz_executor"] satisfies TeamRole[]) : normalizeTeamRoles(body.autoRoles);
          const registerOpenclawAgents = body.registerOpenclawAgents === true;
          const withCluster = body.withCluster !== false;
          if (!name || !goal) {
            writeJson(res, 400, { ok: false, error: "team_create_invalid_payload" });
            return;
          }

          const slug = toSlug(name) || `team-${Date.now()}`;
          const teamId = typeof body.teamId === "string" && body.teamId.trim() ? body.teamId.trim() : `team-proj-${slug}`;
          const projectId = projectIdFromTeamId(teamId);

          let company = await readJsonFile<JsonObject>(COMPANY_MODEL_PATH, {});
          if (businessType) {
            company = ensureBusinessHeartbeatProfiles(company);
          }
          const projects = Array.isArray(company.projects) ? [...company.projects] : [];
          if (projects.some((entry) => entry && typeof entry === "object" && String((entry as JsonObject).id ?? "").trim() === projectId)) {
            writeJson(res, 409, { ok: false, error: "team_already_exists", teamId, projectId });
            return;
          }
          const departments = Array.isArray(company.departments) ? company.departments : [];
          const deptProducts = departments.find((entry) => entry && typeof entry === "object" && String((entry as JsonObject).id ?? "") === "dept-products");
          const fallbackDepartmentId = String((deptProducts as JsonObject | undefined)?.id ?? (departments[0] && typeof departments[0] === "object" ? String((departments[0] as JsonObject).id ?? "dept-products") : "dept-products"));

          const nextProject = {
            id: projectId,
            departmentId: fallbackDepartmentId,
            name,
            githubUrl: "",
            status: "active",
            goal,
            kpis,
            ...(businessType ? { businessConfig: defaultBusinessConfig(businessType, capabilitySkills) } : {}),
            account: {
              id: `${projectId}:account`,
              projectId,
              currency: "USD",
              balanceCents: 0,
              updatedAt: new Date().toISOString(),
            },
            accountEvents: [],
            ledger: [],
            experiments: [],
            metricEvents: [],
            resources: businessType ? defaultProjectResources(projectId) : [],
            resourceEvents: [],
          } satisfies JsonObject;

          const agents = Array.isArray(company.agents) ? [...company.agents] : [];
          const roleSlots = Array.isArray(company.roleSlots) ? [...company.roleSlots] : [];
          for (const role of autoRoles) {
            const agentId = `${slug}-${roleSuffix(role)}`;
            agents.push({
              agentId,
              role,
              projectId,
              heartbeatProfileId: defaultHeartbeatProfileIdForRole(role),
              lifecycleState: "pending_spawn",
              isCeo: false,
            } satisfies JsonObject);
            roleSlots.push({
              projectId,
              role,
              desiredCount: 1,
              spawnPolicy: "queue_pressure",
            } satisfies JsonObject);
          }

          const nextCompany = {
            ...company,
            projects: [...projects, nextProject],
            agents,
            roleSlots,
            federationPolicies: Array.isArray(company.federationPolicies) ? company.federationPolicies : [],
            providerIndexProfiles: Array.isArray(company.providerIndexProfiles) ? company.providerIndexProfiles : [],
            tasks: Array.isArray(company.tasks) ? normalizeFederatedTasks(company.tasks) : [],
          } satisfies JsonObject;
          await mkdir(path.dirname(COMPANY_MODEL_PATH), { recursive: true });
          await writeFile(COMPANY_MODEL_PATH, `${JSON.stringify(nextCompany, null, 2)}\n`, "utf-8");
          const createdAgentIds = autoRoles.map((role) => `${slug}-${roleSuffix(role)}`);

          if (withCluster) {
            const currentObjects = normalizeOfficeObjects(await readJsonFile<unknown[]>(OFFICE_OBJECTS_PATH, []));
            const clusterId = `team-cluster-${teamId}`;
            const nextObjects = currentObjects.filter((entry) => String(entry.id ?? "") !== clusterId);
            nextObjects.push(
              buildNewTeamClusterObject({
                existingObjects: currentObjects,
                teamId,
                name,
                description,
              }) satisfies JsonObject,
            );
            await mkdir(path.dirname(OFFICE_OBJECTS_PATH), { recursive: true });
            await writeFile(OFFICE_OBJECTS_PATH, `${JSON.stringify(nextObjects, null, 2)}\n`, "utf-8");
          }

          if (registerOpenclawAgents && autoRoles.length > 0) {
            const config = await readJsonFile<JsonObject>(OPENCLAW_CONFIG_PATH, {});
            const agentsNode = config.agents && typeof config.agents === "object" ? { ...(config.agents as JsonObject) } : {};
            const list = Array.isArray(agentsNode.list) ? [...(agentsNode.list as JsonObject[])] : [];
            const existing = new Set(list.map((entry) => String((entry as JsonObject).id ?? "").trim()));
            for (const role of autoRoles) {
              const agentId = `${slug}-${roleSuffix(role)}`;
              if (existing.has(agentId)) continue;
              const workspacePath = path.join(OPENCLAW_HOME, "workspace", "products", agentId);
              list.push({
                id: agentId,
                workspace: workspacePath,
                agentDir: path.join(OPENCLAW_HOME, "agents", agentId, "agent"),
              } satisfies JsonObject);
            }
            const nextConfig = { ...config, agents: { ...agentsNode, list } } satisfies JsonObject;
            await mkdir(path.dirname(OPENCLAW_CONFIG_PATH), { recursive: true });
            await writeFile(OPENCLAW_CONFIG_PATH, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf-8");
          }
          if (businessType) {
            for (const agentId of createdAgentIds) {
              const workspacePath = path.join(OPENCLAW_HOME, "workspace", "products", agentId);
              const templatePath = /-pm$/.test(agentId) ? BIZ_PM_HEARTBEAT_TEMPLATE_PATH : BIZ_EXECUTOR_HEARTBEAT_TEMPLATE_PATH;
              try {
                const template = await readFile(templatePath, "utf-8");
                await mkdir(workspacePath, { recursive: true });
                await writeFile(path.join(workspacePath, "HEARTBEAT.md"), template, "utf-8");
              } catch {
                // best-effort workspace template materialization
              }
            }
            await upsertBusinessCronJobsBridge(projectId, createdAgentIds);
          }

          writeJson(res, 200, {
            ok: true,
            teamId,
            projectId,
            createdAgents: createdAgentIds,
          });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/team/heartbeat/render") {
          const body = (await readBody(req)) as JsonObject;
          const teamId = typeof body.teamId === "string" ? body.teamId.trim() : "";
          const role = body.role === "biz_pm" || body.role === "biz_executor" ? body.role : "";
          if (!teamId || !role) {
            writeJson(res, 400, { ok: false, error: "heartbeat_render_invalid_payload" });
            return;
          }
          const projectId = projectIdFromTeamId(teamId);
          const company = await readJsonFile<JsonObject>(COMPANY_MODEL_PATH, {});
          const projects = Array.isArray(company.projects) ? (company.projects as JsonObject[]) : [];
          const project = projects.find((entry) => String(entry.id ?? "") === projectId);
          if (!project) {
            writeJson(res, 404, { ok: false, error: "heartbeat_render_project_not_found" });
            return;
          }
          const templatePath = role === "biz_pm" ? BIZ_PM_HEARTBEAT_TEMPLATE_PATH : BIZ_EXECUTOR_HEARTBEAT_TEMPLATE_PATH;
          try {
            const rawTemplate = await readFile(templatePath, "utf-8");
            const rendered = renderHeartbeatTemplate(rawTemplate, project);
            writeJson(res, 200, { ok: true, rendered });
            return;
          } catch {
            writeJson(res, 500, { ok: false, error: "heartbeat_render_template_unavailable" });
            return;
          }
        }

        if (method === "POST" && pathname === "/openclaw/team/business/equip-skills") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = (await readBody(req)) as JsonObject;
          const teamId = typeof body.teamId === "string" ? body.teamId.trim() : "";
          const mode = body.mode === "append_only" ? "append_only" : "replace_minimum";
          const dryRun = body.dryRun === true;
          if (!teamId) {
            writeJson(res, 400, { ok: false, error: "team_business_skill_sync_invalid_payload" });
            return;
          }
          const projectId = projectIdFromTeamId(teamId);
          const company = await readJsonFile<JsonObject>(COMPANY_MODEL_PATH, {});
          const projects = Array.isArray(company.projects) ? (company.projects as JsonObject[]) : [];
          const project = projects.find((entry) => String(entry.id ?? "").trim() === projectId);
          if (!project) {
            writeJson(res, 404, { ok: false, error: "team_business_skill_sync_project_not_found" });
            return;
          }
          const companyAgents = Array.isArray(company.agents) ? (company.agents as JsonObject[]) : [];
          const pmAgent = companyAgents.find(
            (entry) => String(entry.projectId ?? "").trim() === projectId && String(entry.role ?? "").trim() === "biz_pm",
          );
          const executorAgent = companyAgents.find(
            (entry) => String(entry.projectId ?? "").trim() === projectId && String(entry.role ?? "").trim() === "biz_executor",
          );
          if (!pmAgent || !executorAgent) {
            writeJson(res, 404, { ok: false, error: "team_business_skill_sync_agents_missing" });
            return;
          }
          const pmAgentId = String(pmAgent.agentId ?? "").trim();
          const executorAgentId = String(executorAgent.agentId ?? "").trim();
          if (!pmAgentId || !executorAgentId) {
            writeJson(res, 404, { ok: false, error: "team_business_skill_sync_agents_invalid" });
            return;
          }
          const targets = buildTeamBusinessSkillTargets(project);
          const targetByAgentId = new Map<string, string[]>([
            [pmAgentId, targets.pmSkills],
            [executorAgentId, targets.executorSkills],
          ]);
          const config = await readJsonFile<JsonObject>(OPENCLAW_CONFIG_PATH, {});
          const agentsNode = config.agents && typeof config.agents === "object" ? { ...(config.agents as JsonObject) } : {};
          const list = Array.isArray(agentsNode.list) ? [...(agentsNode.list as JsonObject[])] : [];
          const touchedAgents: string[] = [];
          const missingAgents: string[] = [];
          const preview: JsonObject[] = [];
          const nextList = list.map((entry) => {
            const id = String(entry.id ?? "").trim();
            if (!id || !targetByAgentId.has(id)) return entry;
            const beforeSkills = Array.isArray(entry.skills)
              ? (entry.skills as unknown[]).filter((item): item is string => typeof item === "string")
              : [];
            const afterSkills = applyAgentSkillsByMode(beforeSkills, targetByAgentId.get(id) ?? [], mode);
            touchedAgents.push(id);
            preview.push({
              agentId: id,
              role: id === pmAgentId ? "biz_pm" : "biz_executor",
              mode,
              beforeSkills,
              afterSkills,
            });
            return {
              ...entry,
              skills: afterSkills,
            } satisfies JsonObject;
          });
          for (const id of [pmAgentId, executorAgentId]) {
            if (!touchedAgents.includes(id)) missingAgents.push(id);
          }
          if (!dryRun) {
            const nextConfig = {
              ...config,
              agents: {
                ...agentsNode,
                list: nextList,
              },
            } satisfies JsonObject;
            await mkdir(path.dirname(OPENCLAW_CONFIG_PATH), { recursive: true });
            await writeFile(OPENCLAW_CONFIG_PATH, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf-8");
          }
          writeJson(res, 200, {
            ok: true,
            teamId,
            projectId,
            mode,
            dryRun,
            touchedAgents,
            missingAgents,
            preview,
          });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/config/preview") {
          const body = (await readBody(req)) as JsonObject;
          const nextConfig = (body.nextConfig as JsonObject | undefined) ?? {};
          writeJson(res, 200, {
            summary: "preview generated by local state bridge",
            diffText: JSON.stringify(nextConfig, null, 2),
          });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/config/apply") {
          const body = (await readBody(req)) as JsonObject;
          const nextConfig = (body.nextConfig as JsonObject | undefined) ?? {};
          await mkdir(path.dirname(OPENCLAW_CONFIG_PATH), { recursive: true });
          await writeFile(OPENCLAW_CONFIG_PATH, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf-8");
          writeJson(res, 200, { ok: true });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/config/rollback") {
          const backupPath = `${OPENCLAW_CONFIG_PATH}.bak`;
          if (!existsSync(backupPath)) {
            writeJson(res, 200, { ok: false, error: "rollback_backup_missing" });
            return;
          }
          const backupContent = await readFile(backupPath, "utf-8");
          await writeFile(OPENCLAW_CONFIG_PATH, backupContent, "utf-8");
          writeJson(res, 200, { ok: true });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/pending-approvals") {
          let approvals = await readJsonFile<unknown[]>(PENDING_APPROVALS_PATH, []);
          if (!Array.isArray(approvals)) approvals = [];
          if (approvals.length === 0) {
            const seeded = await readJsonFile<unknown[]>(PENDING_APPROVALS_TEMPLATE_PATH, []);
            if (Array.isArray(seeded) && seeded.length > 0) {
              approvals = seeded;
              await mkdir(path.dirname(PENDING_APPROVALS_PATH), { recursive: true });
              await writeFile(PENDING_APPROVALS_PATH, `${JSON.stringify(approvals, null, 2)}\n`, "utf-8");
            }
          }
          const pending = approvals.filter(
            (entry) => entry && typeof entry === "object" && (entry as JsonObject).status === "pending",
          );
          writeJson(res, 200, { approvals: pending });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/pending-approvals/resolve") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = (await readBody(req)) as JsonObject;
          const approvalId = String(body.id ?? "").trim();
          const decision = String(body.decision ?? "").trim();
          if (!approvalId || (decision !== "approved" && decision !== "rejected")) {
            writeJson(res, 400, { ok: false, error: "invalid_request: need id and decision (approved|rejected)" });
            return;
          }
          let approvals = await readJsonFile<unknown[]>(PENDING_APPROVALS_PATH, []);
          if (!Array.isArray(approvals)) approvals = [];
          let found = false;
          const updated = approvals.map((entry) => {
            if (entry && typeof entry === "object" && (entry as JsonObject).id === approvalId) {
              found = true;
              return { ...(entry as JsonObject), status: decision, resolvedAt: Date.now() };
            }
            return entry;
          });
          if (!found) {
            writeJson(res, 404, { ok: false, error: "approval_not_found" });
            return;
          }
          await mkdir(path.dirname(PENDING_APPROVALS_PATH), { recursive: true });
          await writeFile(PENDING_APPROVALS_PATH, `${JSON.stringify(updated, null, 2)}\n`, "utf-8");
          writeJson(res, 200, { ok: true });
          return;
        }

        writeJson(res, 404, { ok: false, error: `state_bridge_route_not_found:${pathname}` });
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  plugins: [shellcorpStateBridge(), tailwindcss(), react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
