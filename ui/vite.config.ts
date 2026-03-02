import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile, stat } from "node:fs/promises";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

type JsonObject = Record<string, unknown>;
type MemoryEntryType = "discovery" | "decision" | "problem" | "solution" | "pattern" | "warning" | "success" | "refactor" | "bugfix" | "feature";
type TaskProvider = "internal" | "notion" | "vibe" | "linear";
type TaskSyncState = "healthy" | "pending" | "conflict" | "error";

const OPENCLAW_HOME = process.env.OPENCLAW_STATE_DIR || path.join(process.env.HOME || "", ".openclaw");
const OPENCLAW_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || path.join(OPENCLAW_HOME, "openclaw.json");
const COMPANY_MODEL_PATH = path.join(OPENCLAW_HOME, "company.json");
const OFFICE_OBJECTS_PATH = path.join(OPENCLAW_HOME, "office-objects.json");
const OFFICE_SETTINGS_PATH = path.join(OPENCLAW_HOME, "office.json");
const OFFICE_OBJECTS_TEMPLATE_PATH = path.resolve(__dirname, "../officeObjects.json");
const DEFAULT_MESH_ASSET_DIR = path.join(OPENCLAW_HOME, "assets", "meshes");
const MESH_EXTENSIONS = new Set([".glb", ".gltf"]);

interface OfficeSettings {
  meshAssetDir?: string;
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(res: { setHeader: (k: string, v: string) => void; end: (body: string) => void }, status: number, payload: unknown): void {
  res.setHeader("content-type", "application/json");
  res.setHeader("x-shellcorp-state-bridge", "vite");
  (res as { statusCode?: number }).statusCode = status;
  res.end(JSON.stringify(payload));
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

function normalizeOfficeSettings(input: unknown): OfficeSettings {
  const row = input && typeof input === "object" ? (input as JsonObject) : {};
  const meshAssetDir =
    typeof row.meshAssetDir === "string" && row.meshAssetDir.trim()
      ? path.resolve(row.meshAssetDir.trim())
      : DEFAULT_MESH_ASSET_DIR;
  return { meshAssetDir };
}

async function readOfficeSettings(): Promise<OfficeSettings> {
  const raw = await readJsonFile<OfficeSettings>(OFFICE_SETTINGS_PATH, { meshAssetDir: DEFAULT_MESH_ASSET_DIR });
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

async function readSessionTimelineEvents(agentId: string, sessionKey: string, limit: number): Promise<JsonObject[]> {
  const sessions = await readAgentSessionsIndex(agentId);
  const sessionRow = sessions[sessionKey];
  if (!sessionRow) return [];
  const transcriptPath = resolveSessionTranscriptPath(agentId, sessionRow);
  if (!transcriptPath || !existsSync(transcriptPath)) return [];
  let raw = "";
  try {
    raw = await readFile(transcriptPath, "utf-8");
  } catch {
    return [];
  }
  const lines = raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  const events: JsonObject[] = [];
  for (const line of lines) {
    try {
      const row = JSON.parse(line) as JsonObject;
      if (row.type !== "message") continue;
      const msg = row.message && typeof row.message === "object" ? (row.message as JsonObject) : null;
      if (!msg) continue;
      const text = extractTextFromTranscriptMessage(msg).trim();
      if (!text) continue;
      const tsRaw = typeof row.timestamp === "string" ? Date.parse(row.timestamp) : Number.NaN;
      events.push({
        ts: Number.isFinite(tsRaw) ? tsRaw : Date.now(),
        type: "message",
        role: String(msg.role ?? "assistant"),
        text,
      });
    } catch {
      // Skip malformed transcript lines.
    }
  }
  return events.slice(Math.max(0, events.length - Math.max(1, limit)));
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
            updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : Date.now(),
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

        const eventsMatch = pathname.match(/^\/openclaw\/agents\/([^/]+)\/sessions\/([^/]+)\/events$/);
        if (method === "GET" && eventsMatch) {
          const agentId = decodeURIComponent(eventsMatch[1]);
          const sessionKey = decodeURIComponent(eventsMatch[2]);
          const requestedLimit = Number(url.searchParams.get("limit") ?? "200");
          const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(500, Math.floor(requestedLimit))) : 200;
          const events = await readSessionTimelineEvents(agentId, sessionKey, limit);
          writeJson(res, 200, {
            timeline: {
              agentId,
              sessionKey,
              events,
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

        if (method === "GET" && pathname === "/openclaw/skills") {
          writeJson(res, 200, { skills: [] });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/memory") {
          writeJson(res, 200, { memory: [] });
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
          if (!MESH_EXTENSIONS.has(ext)) {
            writeJson(res, 400, { ok: false, error: "mesh_asset_extension_invalid" });
            return;
          }
          try {
            const bytes = await readFile(filePath);
            res.setHeader("content-type", ext === ".gltf" ? "model/gltf+json" : "model/gltf-binary");
            (res as { statusCode?: number }).statusCode = 200;
            (res as { end: (body: Buffer) => void }).end(bytes);
          } catch {
            writeJson(res, 404, { ok: false, error: "mesh_asset_not_found" });
          }
          return;
        }

        if (method === "POST" && pathname === "/openclaw/office-objects") {
          const body = (await readBody(req)) as JsonObject;
          const input = Array.isArray(body.objects) ? body.objects : [];
          const objects = normalizeOfficeObjects(input);
          await mkdir(path.dirname(OFFICE_OBJECTS_PATH), { recursive: true });
          await writeFile(OFFICE_OBJECTS_PATH, `${JSON.stringify(objects, null, 2)}\n`, "utf-8");
          writeJson(res, 200, { ok: true, objects });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/company-model") {
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

        if (method === "POST" && pathname === "/openclaw/gateway/method") {
          const body = (await readBody(req)) as JsonObject;
          const methodName = String(body.method ?? "").trim();
          const params = (body.params && typeof body.params === "object" ? body.params : {}) as JsonObject;
          const company = await readJsonFile<JsonObject>(COMPANY_MODEL_PATH, {});
          const tasks = normalizeFederatedTasks(Array.isArray(company.tasks) ? company.tasks : []);

          if (methodName === "notion-shell.tasks.update") {
            const taskId = String(params.taskId ?? "").trim();
            const updates = (params.updates && typeof params.updates === "object" ? params.updates : {}) as JsonObject;
            const target = tasks.find((task) => String(task.id) === taskId);
            if (!target) {
              writeJson(res, 404, { ok: false, error: "task_not_found" });
              return;
            }
            target.status =
              updates.status === "in_progress" || updates.status === "blocked" || updates.status === "done"
                ? updates.status
                : target.status;
            target.updatedAt = Date.now();
            target.syncState = "healthy";
            const nextCompany = { ...company, tasks };
            await mkdir(path.dirname(COMPANY_MODEL_PATH), { recursive: true });
            await writeFile(COMPANY_MODEL_PATH, `${JSON.stringify(nextCompany, null, 2)}\n`, "utf-8");
            writeJson(res, 200, { ok: true, taskId });
            return;
          }

          if (methodName === "notion-shell.tasks.sync") {
            const projectId = String(params.projectId ?? "").trim();
            const databaseId = String(params.databaseId ?? "").trim();
            const touched = tasks
              .filter((task) => String(task.projectId) === projectId)
              .filter((task) => String(task.provider) === "notion");
            for (const task of touched) {
              task.syncState = "healthy";
              task.syncError = undefined;
              task.updatedAt = Date.now();
              if (!task.providerUrl && databaseId) {
                task.providerUrl = `https://www.notion.so/${databaseId.replace(/-/g, "")}`;
              }
            }
            const nextCompany = { ...company, tasks };
            await mkdir(path.dirname(COMPANY_MODEL_PATH), { recursive: true });
            await writeFile(COMPANY_MODEL_PATH, `${JSON.stringify(nextCompany, null, 2)}\n`, "utf-8");
            writeJson(res, 200, { ok: true, synced: touched.length, tasks: touched });
            return;
          }

          if (methodName === "notion-shell.profile.bootstrap") {
            const databaseId = String(params.databaseId ?? "").trim();
            if (!databaseId) {
              writeJson(res, 400, { ok: false, error: "database_id_required" });
              return;
            }
            writeJson(res, 200, {
              ok: true,
              profile: {
                provider: "notion",
                entityId: databaseId,
                entityName: `Notion ${databaseId.slice(0, 8)}`,
                fieldMappings: [
                  { name: "Name", type: "title" },
                  { name: "Status", type: "status", options: ["To Do", "In Progress", "Blocked", "Done"] },
                  { name: "Priority", type: "select", options: ["low", "medium", "high"] },
                ],
              },
            });
            return;
          }

          writeJson(res, 404, { ok: false, error: `gateway_method_not_found:${methodName}` });
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

        writeJson(res, 404, { ok: false, error: `state_bridge_route_not_found:${pathname}` });
      });
    },
  };
}

export default defineConfig({
  root: "ui",
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
