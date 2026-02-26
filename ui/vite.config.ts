import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

type JsonObject = Record<string, unknown>;
type MemoryEntryType = "discovery" | "decision" | "problem" | "solution" | "pattern" | "warning" | "success" | "refactor" | "bugfix" | "feature";

const OPENCLAW_HOME = process.env.OPENCLAW_STATE_DIR || path.join(process.env.HOME || "", ".openclaw");
const OPENCLAW_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || path.join(OPENCLAW_HOME, "openclaw.json");
const COMPANY_MODEL_PATH = path.join(OPENCLAW_HOME, "company.json");
const OFFICE_OBJECTS_PATH = path.join(OPENCLAW_HOME, "office-objects.json");
const OFFICE_OBJECTS_TEMPLATE_PATH = path.resolve(__dirname, "../officeObjects.json");

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
          const sessionKey = decodeURIComponent(eventsMatch[2]);
          writeJson(res, 200, {
            timeline: {
              sessionKey,
              events: [
                {
                  ts: Date.now(),
                  type: "status",
                  role: "system",
                  text: "Timeline bridge active. Event stream hydration is deferred in this slice.",
                },
              ],
            },
          });
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
          await mkdir(path.dirname(COMPANY_MODEL_PATH), { recursive: true });
          await writeFile(COMPANY_MODEL_PATH, `${JSON.stringify(company, null, 2)}\n`, "utf-8");
          writeJson(res, 200, { ok: true, company });
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
