/**
 * SIDECAR STORE
 * =============
 * Purpose
 * - Read/write ShellCorp sidecar JSON files in ~/.openclaw.
 *
 * KEY CONCEPTS:
 * - Atomic file writes via temp file + rename.
 * - Preserve unknown fields while normalizing required arrays.
 *
 * USAGE:
 * - const store = createSidecarStore();
 * - const company = await store.readCompanyModel();
 *
 * MEMORY REFERENCES:
 * - MEM-0104
 */
import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

export type JsonObject = Record<string, unknown>;

export type ProjectStatus = "active" | "paused" | "archived";
export type AgentRole = "ceo" | "builder" | "growth_marketer" | "pm";
export type AgentLifecycleState = "active" | "idle" | "pending_spawn" | "retired";
export type SpawnPolicy = "queue_pressure" | "manual";

export interface DepartmentModel {
  id: string;
  name: string;
  description: string;
  goal: string;
}

export interface ProjectModel {
  id: string;
  departmentId: string;
  name: string;
  githubUrl: string;
  status: ProjectStatus;
  goal: string;
  kpis: string[];
}

export interface CompanyAgentModel {
  agentId: string;
  role: AgentRole;
  projectId?: string;
  heartbeatProfileId: string;
  isCeo: boolean;
  lifecycleState: AgentLifecycleState;
}

export interface RoleSlotModel {
  projectId: string;
  role: Exclude<AgentRole, "ceo">;
  desiredCount: number;
  spawnPolicy: SpawnPolicy;
}

export interface HeartbeatProfileModel {
  id: string;
  role: AgentRole;
  cadenceMinutes: number;
  teamDescription: string;
  productDetails: string;
  goal: string;
}

export interface CompanyModel {
  version: number;
  departments: DepartmentModel[];
  projects: ProjectModel[];
  agents: CompanyAgentModel[];
  roleSlots: RoleSlotModel[];
  heartbeatProfiles: HeartbeatProfileModel[];
  tasks: unknown[];
  channelBindings: unknown[];
  federationPolicies: unknown[];
  providerIndexProfiles: unknown[];
  heartbeatRuntime?: JsonObject;
  [key: string]: unknown;
}

export interface OfficeObjectModel {
  id: string;
  identifier: string;
  meshType: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  metadata?: Record<string, unknown>;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" ? (value as JsonObject) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeProjectStatus(value: unknown): ProjectStatus {
  const text = asString(value, "active");
  return text === "paused" || text === "archived" ? text : "active";
}

function normalizeAgentRole(value: unknown): AgentRole {
  const text = asString(value, "builder");
  if (text === "ceo" || text === "builder" || text === "growth_marketer" || text === "pm") {
    return text;
  }
  return "builder";
}

function normalizeLifecycle(value: unknown): AgentLifecycleState {
  const text = asString(value, "active");
  if (text === "idle" || text === "pending_spawn" || text === "retired") return text;
  return "active";
}

function normalizeSpawnPolicy(value: unknown): SpawnPolicy {
  return value === "manual" ? "manual" : "queue_pressure";
}

function normalizeCompanyModel(input: unknown): CompanyModel {
  const row = asObject(input);
  const departments = Array.isArray(row.departments)
    ? row.departments
        .map((entry) => {
          const obj = asObject(entry);
          const id = asString(obj.id).trim();
          const name = asString(obj.name).trim();
          if (!id || !name) return null;
          return {
            id,
            name,
            description: asString(obj.description),
            goal: asString(obj.goal),
          } satisfies DepartmentModel;
        })
        .filter((entry): entry is DepartmentModel => entry !== null)
    : [];
  const projects = Array.isArray(row.projects)
    ? row.projects
        .map((entry) => {
          const obj = asObject(entry);
          const id = asString(obj.id).trim();
          const departmentId = asString(obj.departmentId).trim();
          const name = asString(obj.name).trim();
          if (!id || !departmentId || !name) return null;
          return {
            id,
            departmentId,
            name,
            githubUrl: asString(obj.githubUrl),
            status: normalizeProjectStatus(obj.status),
            goal: asString(obj.goal),
            kpis: asStringArray(obj.kpis),
          } satisfies ProjectModel;
        })
        .filter((entry): entry is ProjectModel => entry !== null)
    : [];
  const agents = Array.isArray(row.agents)
    ? row.agents
        .map((entry) => {
          const obj = asObject(entry);
          const agentId = asString(obj.agentId).trim();
          if (!agentId) return null;
          const projectId = asString(obj.projectId).trim();
          return {
            agentId,
            role: normalizeAgentRole(obj.role),
            ...(projectId ? { projectId } : {}),
            heartbeatProfileId: asString(obj.heartbeatProfileId).trim() || "hb-pm",
            isCeo: obj.isCeo === true,
            lifecycleState: normalizeLifecycle(obj.lifecycleState),
          } satisfies CompanyAgentModel;
        })
        .filter((entry): entry is CompanyAgentModel => entry !== null)
    : [];
  const roleSlots = Array.isArray(row.roleSlots)
    ? row.roleSlots
        .map((entry) => {
          const obj = asObject(entry);
          const projectId = asString(obj.projectId).trim();
          const role = normalizeAgentRole(obj.role);
          if (!projectId || role === "ceo") return null;
          return {
            projectId,
            role,
            desiredCount: Math.max(0, Math.floor(asNumber(obj.desiredCount, 0))),
            spawnPolicy: normalizeSpawnPolicy(obj.spawnPolicy),
          } satisfies RoleSlotModel;
        })
        .filter((entry): entry is RoleSlotModel => entry !== null)
    : [];
  const heartbeatProfiles = Array.isArray(row.heartbeatProfiles)
    ? row.heartbeatProfiles
        .map((entry) => {
          const obj = asObject(entry);
          const id = asString(obj.id).trim();
          if (!id) return null;
          return {
            id,
            role: normalizeAgentRole(obj.role),
            cadenceMinutes: Math.max(1, Math.floor(asNumber(obj.cadenceMinutes, 10))),
            teamDescription: asString(obj.teamDescription),
            productDetails: asString(obj.productDetails),
            goal: asString(obj.goal),
          } satisfies HeartbeatProfileModel;
        })
        .filter((entry): entry is HeartbeatProfileModel => entry !== null)
    : [];

  return {
    ...row,
    version: Math.max(1, Math.floor(asNumber(row.version, 1))),
    departments,
    projects,
    agents,
    roleSlots,
    heartbeatProfiles,
    tasks: Array.isArray(row.tasks) ? row.tasks : [],
    channelBindings: Array.isArray(row.channelBindings) ? row.channelBindings : [],
    federationPolicies: Array.isArray(row.federationPolicies) ? row.federationPolicies : [],
    providerIndexProfiles: Array.isArray(row.providerIndexProfiles) ? row.providerIndexProfiles : [],
    heartbeatRuntime: asObject(row.heartbeatRuntime),
  };
}

function normalizeOfficeObjects(input: unknown): OfficeObjectModel[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      const obj = asObject(entry);
      const id = asString(obj.id).trim();
      const identifier = asString(obj.identifier, id).trim();
      const meshType = asString(obj.meshType).trim();
      if (!id || !identifier || !meshType) return null;
      const position = Array.isArray(obj.position) ? obj.position : [];
      if (position.length !== 3 || position.some((value) => typeof value !== "number")) return null;
      const rotation = Array.isArray(obj.rotation) && obj.rotation.length === 3 ? (obj.rotation as [number, number, number]) : undefined;
      const scale = Array.isArray(obj.scale) && obj.scale.length === 3 ? (obj.scale as [number, number, number]) : undefined;
      const metadata = asObject(obj.metadata);
      return {
        id,
        identifier,
        meshType,
        position: [Number(position[0]), Number(position[1]), Number(position[2])],
        ...(rotation ? { rotation } : {}),
        ...(scale ? { scale } : {}),
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      } satisfies OfficeObjectModel;
    })
    .filter((entry): entry is OfficeObjectModel => entry !== null);
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(filePath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  await rename(tempPath, filePath);
}

export interface SidecarStore {
  companyPath: string;
  officeObjectsPath: string;
  readCompanyModel: () => Promise<CompanyModel>;
  writeCompanyModel: (model: CompanyModel) => Promise<void>;
  readOfficeObjects: () => Promise<OfficeObjectModel[]>;
  writeOfficeObjects: (objects: OfficeObjectModel[]) => Promise<void>;
}

export function resolveOpenclawHome(): string {
  if (process.env.OPENCLAW_STATE_DIR && process.env.OPENCLAW_STATE_DIR.trim()) {
    return path.resolve(process.env.OPENCLAW_STATE_DIR);
  }
  return path.join(process.env.HOME || "", ".openclaw");
}

export function createSidecarStore(): SidecarStore {
  const openclawHome = resolveOpenclawHome();
  const companyPath = path.join(openclawHome, "company.json");
  const officeObjectsPath = path.join(openclawHome, "office-objects.json");
  return {
    companyPath,
    officeObjectsPath,
    readCompanyModel: async () => normalizeCompanyModel(await readJsonFile(companyPath, {})),
    writeCompanyModel: async (model) => writeJsonAtomic(companyPath, normalizeCompanyModel(model)),
    readOfficeObjects: async () => normalizeOfficeObjects(await readJsonFile(officeObjectsPath, [])),
    writeOfficeObjects: async (objects) => writeJsonAtomic(officeObjectsPath, normalizeOfficeObjects(objects)),
  };
}

