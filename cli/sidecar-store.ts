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
export type AgentRole = "ceo" | "builder" | "growth_marketer" | "pm" | "biz_pm" | "biz_executor";
export type AgentLifecycleState = "active" | "idle" | "pending_spawn" | "retired";
export type SpawnPolicy = "queue_pressure" | "manual";
export type OfficeStylePreset = "default" | "pixel" | "brutalist" | "cozy";
export type CapabilityCategory = "measure" | "execute" | "distribute";
export type LedgerEntryType = "revenue" | "cost";
export type AccountEventType = "credit" | "debit";
export type ExperimentStatus = "running" | "completed" | "failed";
export type ResourceType = "cash_budget" | "api_quota" | "distribution_slots" | "custom";
export type ResourceEventKind = "refresh" | "consumption" | "adjustment";
export type ResourceLowBehavior = "warn" | "deprioritize_expensive_tasks" | "ask_pm_review";

export interface CapabilitySlotModel {
  skillId: string;
  category: CapabilityCategory;
  config: Record<string, string>;
}

export interface BusinessConfigModel {
  type: string;
  slots: {
    measure: CapabilitySlotModel;
    execute: CapabilitySlotModel;
    distribute: CapabilitySlotModel;
  };
}

export interface LedgerEntryModel {
  id: string;
  projectId: string;
  timestamp: string;
  type: LedgerEntryType;
  amount: number;
  currency: string;
  source: string;
  description: string;
  experimentId?: string;
}

export interface ProjectAccountModel {
  id: string;
  projectId: string;
  currency: string;
  balanceCents: number;
  updatedAt: string;
}

export interface ProjectAccountEventModel {
  id: string;
  projectId: string;
  accountId: string;
  timestamp: string;
  type: AccountEventType;
  amountCents: number;
  source: string;
  note?: string;
  balanceAfterCents: number;
}

export interface ExperimentModel {
  id: string;
  projectId: string;
  hypothesis: string;
  status: ExperimentStatus;
  startedAt: string;
  endedAt?: string;
  results?: string;
  metricsBefore?: Record<string, number>;
  metricsAfter?: Record<string, number>;
}

export interface MetricEventModel {
  id: string;
  projectId: string;
  timestamp: string;
  source: string;
  metrics: Record<string, number>;
}

export interface ResourcePolicyModel {
  advisoryOnly: true;
  softLimit?: number;
  hardLimit?: number;
  whenLow: ResourceLowBehavior;
}

export interface ProjectResourceModel {
  id: string;
  projectId: string;
  type: ResourceType;
  name: string;
  unit: string;
  remaining: number;
  limit: number;
  reserved?: number;
  trackerSkillId: string;
  refreshCadenceMinutes?: number;
  policy: ResourcePolicyModel;
  metadata?: Record<string, string>;
}

export interface ResourceEventModel {
  id: string;
  projectId: string;
  resourceId: string;
  ts: string;
  kind: ResourceEventKind;
  delta: number;
  remainingAfter: number;
  source: string;
  note?: string;
}

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
  trackingContext?: string;
  businessConfig?: BusinessConfigModel;
  account?: ProjectAccountModel;
  accountEvents: ProjectAccountEventModel[];
  ledger: LedgerEntryModel[];
  experiments: ExperimentModel[];
  metricEvents: MetricEventModel[];
  resources: ProjectResourceModel[];
  resourceEvents: ResourceEventModel[];
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
  officeStylePreset?: OfficeStylePreset;
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
  if (
    text === "ceo" ||
    text === "builder" ||
    text === "growth_marketer" ||
    text === "pm" ||
    text === "biz_pm" ||
    text === "biz_executor"
  ) {
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

function normalizeCapabilityCategory(value: unknown): CapabilityCategory {
  if (value === "measure" || value === "execute" || value === "distribute") return value;
  return "measure";
}

function normalizeStringRecord(value: unknown): Record<string, string> {
  const row = asObject(value);
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(row)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
}

function normalizeCapabilitySlot(value: unknown, fallback: CapabilityCategory): CapabilitySlotModel {
  const row = asObject(value);
  const skillId = asString(row.skillId).trim();
  return {
    skillId: skillId || `${fallback}-skill`,
    category: normalizeCapabilityCategory(row.category ?? fallback),
    config: normalizeStringRecord(row.config),
  };
}

function normalizeBusinessConfig(value: unknown): BusinessConfigModel | undefined {
  const row = asObject(value);
  const type = asString(row.type).trim();
  if (!type) return undefined;
  const slots = asObject(row.slots);
  return {
    type,
    slots: {
      measure: normalizeCapabilitySlot(slots.measure, "measure"),
      execute: normalizeCapabilitySlot(slots.execute, "execute"),
      distribute: normalizeCapabilitySlot(slots.distribute, "distribute"),
    },
  };
}

function normalizeNumberRecord(value: unknown): Record<string, number> | undefined {
  const row = asObject(value);
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(row)) {
    if (typeof raw === "number" && Number.isFinite(raw)) out[key] = raw;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeLedgerType(value: unknown): LedgerEntryType {
  return value === "revenue" ? "revenue" : "cost";
}

function normalizeAccountEventType(value: unknown): AccountEventType {
  return value === "credit" ? "credit" : "debit";
}

function normalizeExperimentStatus(value: unknown): ExperimentStatus {
  if (value === "completed" || value === "failed") return value;
  return "running";
}

function normalizeOfficeStylePreset(value: unknown): OfficeStylePreset | undefined {
  if (value === "default" || value === "pixel" || value === "brutalist" || value === "cozy") {
    return value;
  }
  return undefined;
}

function normalizeResourceType(value: unknown): ResourceType {
  if (value === "cash_budget" || value === "api_quota" || value === "distribution_slots" || value === "custom") {
    return value;
  }
  return "custom";
}

function normalizeResourceEventKind(value: unknown): ResourceEventKind {
  if (value === "refresh" || value === "consumption") return value;
  return "adjustment";
}

function normalizeResourceLowBehavior(value: unknown): ResourceLowBehavior {
  if (value === "deprioritize_expensive_tasks" || value === "ask_pm_review") return value;
  return "warn";
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
            ...(asString(obj.trackingContext).trim() ? { trackingContext: asString(obj.trackingContext).trim() } : {}),
            ...(normalizeBusinessConfig(obj.businessConfig) ? { businessConfig: normalizeBusinessConfig(obj.businessConfig) } : {}),
            ...(() => {
              const accountObj = asObject(obj.account);
              const accountId = asString(accountObj.id).trim();
              const accountProjectId = asString(accountObj.projectId).trim() || id;
              const updatedAt = asString(accountObj.updatedAt).trim();
              const currency = asString(accountObj.currency).trim() || "USD";
              const balanceCents = asNumber(accountObj.balanceCents, 0);
              if (!accountId || !updatedAt) return {};
              return {
                account: {
                  id: accountId,
                  projectId: accountProjectId,
                  currency,
                  balanceCents: Number.isFinite(balanceCents) ? Math.round(balanceCents) : 0,
                  updatedAt,
                } satisfies ProjectAccountModel,
              };
            })(),
            accountEvents: Array.isArray(obj.accountEvents)
              ? obj.accountEvents
                  .map((eventRow) => {
                    const eventObj = asObject(eventRow);
                    const eventId = asString(eventObj.id).trim();
                    const eventProjectId = asString(eventObj.projectId).trim() || id;
                    const accountId = asString(eventObj.accountId).trim();
                    const timestamp = asString(eventObj.timestamp).trim();
                    const source = asString(eventObj.source).trim();
                    if (!eventId || !accountId || !timestamp || !source) return null;
                    const amountCents = asNumber(eventObj.amountCents, 0);
                    const balanceAfterCents = asNumber(eventObj.balanceAfterCents, 0);
                    const note = asString(eventObj.note).trim();
                    return {
                      id: eventId,
                      projectId: eventProjectId,
                      accountId,
                      timestamp,
                      type: normalizeAccountEventType(eventObj.type),
                      amountCents: Number.isFinite(amountCents) ? Math.round(amountCents) : 0,
                      source,
                      balanceAfterCents: Number.isFinite(balanceAfterCents) ? Math.round(balanceAfterCents) : 0,
                      ...(note ? { note } : {}),
                    } satisfies ProjectAccountEventModel;
                  })
                  .filter((entry): entry is ProjectAccountEventModel => entry !== null)
              : [],
            ledger: Array.isArray(obj.ledger)
              ? obj.ledger
                  .map((ledgerRow) => {
                    const ledgerObj = asObject(ledgerRow);
                    const ledgerId = asString(ledgerObj.id).trim();
                    const projectId = asString(ledgerObj.projectId).trim() || id;
                    const timestamp = asString(ledgerObj.timestamp).trim();
                    const source = asString(ledgerObj.source).trim();
                    const description = asString(ledgerObj.description).trim();
                    if (!ledgerId || !timestamp || !source || !description) return null;
                    const currency = asString(ledgerObj.currency).trim() || "USD";
                    const amount = asNumber(ledgerObj.amount, 0);
                    return {
                      id: ledgerId,
                      projectId,
                      timestamp,
                      type: normalizeLedgerType(ledgerObj.type),
                      amount: Number.isFinite(amount) ? amount : 0,
                      currency,
                      source,
                      description,
                      ...(asString(ledgerObj.experimentId).trim()
                        ? { experimentId: asString(ledgerObj.experimentId).trim() }
                        : {}),
                    } satisfies LedgerEntryModel;
                  })
                  .filter((entry): entry is LedgerEntryModel => entry !== null)
              : [],
            experiments: Array.isArray(obj.experiments)
              ? obj.experiments
                  .map((experimentRow) => {
                    const experimentObj = asObject(experimentRow);
                    const experimentId = asString(experimentObj.id).trim();
                    const projectId = asString(experimentObj.projectId).trim() || id;
                    const hypothesis = asString(experimentObj.hypothesis).trim();
                    const startedAt = asString(experimentObj.startedAt).trim();
                    if (!experimentId || !hypothesis || !startedAt) return null;
                    const endedAt = asString(experimentObj.endedAt).trim();
                    const results = asString(experimentObj.results).trim();
                    return {
                      id: experimentId,
                      projectId,
                      hypothesis,
                      status: normalizeExperimentStatus(experimentObj.status),
                      startedAt,
                      ...(endedAt ? { endedAt } : {}),
                      ...(results ? { results } : {}),
                      ...(normalizeNumberRecord(experimentObj.metricsBefore)
                        ? { metricsBefore: normalizeNumberRecord(experimentObj.metricsBefore) }
                        : {}),
                      ...(normalizeNumberRecord(experimentObj.metricsAfter)
                        ? { metricsAfter: normalizeNumberRecord(experimentObj.metricsAfter) }
                        : {}),
                    } satisfies ExperimentModel;
                  })
                  .filter((entry): entry is ExperimentModel => entry !== null)
              : [],
            metricEvents: Array.isArray(obj.metricEvents)
              ? obj.metricEvents
                  .map((eventRow) => {
                    const eventObj = asObject(eventRow);
                    const eventId = asString(eventObj.id).trim();
                    const projectId = asString(eventObj.projectId).trim() || id;
                    const timestamp = asString(eventObj.timestamp).trim();
                    const source = asString(eventObj.source).trim();
                    const metrics = normalizeNumberRecord(eventObj.metrics);
                    if (!eventId || !timestamp || !source || !metrics) return null;
                    return {
                      id: eventId,
                      projectId,
                      timestamp,
                      source,
                      metrics,
                    } satisfies MetricEventModel;
                  })
                  .filter((entry): entry is MetricEventModel => entry !== null)
              : [],
            resources: Array.isArray(obj.resources)
              ? obj.resources
                  .map((resourceRow) => {
                    const resourceObj = asObject(resourceRow);
                    const resourceId = asString(resourceObj.id).trim();
                    const projectId = asString(resourceObj.projectId).trim() || id;
                    const name = asString(resourceObj.name).trim();
                    const unit = asString(resourceObj.unit).trim();
                    const trackerSkillId = asString(resourceObj.trackerSkillId).trim();
                    if (!resourceId || !name || !unit || !trackerSkillId) return null;
                    const remaining = asNumber(resourceObj.remaining, 0);
                    const limit = asNumber(resourceObj.limit, 0);
                    const reserved = asNumber(resourceObj.reserved, Number.NaN);
                    const refreshCadenceMinutes = asNumber(resourceObj.refreshCadenceMinutes, Number.NaN);
                    const policyObj = asObject(resourceObj.policy);
                    const metadata = normalizeStringRecord(resourceObj.metadata);
                    return {
                      id: resourceId,
                      projectId,
                      type: normalizeResourceType(resourceObj.type),
                      name,
                      unit,
                      remaining,
                      limit,
                      ...(Number.isFinite(reserved) ? { reserved } : {}),
                      trackerSkillId,
                      ...(Number.isFinite(refreshCadenceMinutes)
                        ? { refreshCadenceMinutes: Math.max(1, Math.floor(refreshCadenceMinutes)) }
                        : {}),
                      policy: {
                        advisoryOnly: true,
                        ...(Number.isFinite(asNumber(policyObj.softLimit, Number.NaN))
                          ? { softLimit: asNumber(policyObj.softLimit, 0) }
                          : {}),
                        ...(Number.isFinite(asNumber(policyObj.hardLimit, Number.NaN))
                          ? { hardLimit: asNumber(policyObj.hardLimit, 0) }
                          : {}),
                        whenLow: normalizeResourceLowBehavior(policyObj.whenLow),
                      },
                      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
                    } satisfies ProjectResourceModel;
                  })
                  .filter((entry): entry is ProjectResourceModel => entry !== null)
              : [],
            resourceEvents: Array.isArray(obj.resourceEvents)
              ? obj.resourceEvents
                  .map((eventRow) => {
                    const eventObj = asObject(eventRow);
                    const eventId = asString(eventObj.id).trim();
                    const projectId = asString(eventObj.projectId).trim() || id;
                    const resourceId = asString(eventObj.resourceId).trim();
                    const ts = asString(eventObj.ts).trim();
                    const source = asString(eventObj.source).trim();
                    if (!eventId || !resourceId || !ts || !source) return null;
                    return {
                      id: eventId,
                      projectId,
                      resourceId,
                      ts,
                      kind: normalizeResourceEventKind(eventObj.kind),
                      delta: asNumber(eventObj.delta, 0),
                      remainingAfter: asNumber(eventObj.remainingAfter, 0),
                      source,
                      ...(asString(eventObj.note).trim() ? { note: asString(eventObj.note).trim() } : {}),
                    } satisfies ResourceEventModel;
                  })
                  .filter((entry): entry is ResourceEventModel => entry !== null)
              : [],
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
    ...(normalizeOfficeStylePreset(row.officeStylePreset) ? { officeStylePreset: normalizeOfficeStylePreset(row.officeStylePreset) } : {}),
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
  openclawConfigPath: string;
  readCompanyModel: () => Promise<CompanyModel>;
  writeCompanyModel: (model: CompanyModel) => Promise<void>;
  readOfficeObjects: () => Promise<OfficeObjectModel[]>;
  writeOfficeObjects: (objects: OfficeObjectModel[]) => Promise<void>;
  readOpenclawConfig: () => Promise<JsonObject>;
  writeOpenclawConfig: (config: JsonObject) => Promise<void>;
  readOfficeStylePreset: () => Promise<OfficeStylePreset>;
  writeOfficeStylePreset: (preset: OfficeStylePreset) => Promise<void>;
}

export function generateObjectId(meshType: string): string {
  const slug = asString(meshType, "object")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "object";
  const nonce = Math.random().toString(36).slice(2, 8);
  return `${slug}-${nonce}`;
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
  const openclawConfigPath = path.join(openclawHome, "openclaw.json");
  return {
    companyPath,
    officeObjectsPath,
    openclawConfigPath,
    readCompanyModel: async () => normalizeCompanyModel(await readJsonFile(companyPath, {})),
    writeCompanyModel: async (model) => writeJsonAtomic(companyPath, normalizeCompanyModel(model)),
    readOfficeObjects: async () => normalizeOfficeObjects(await readJsonFile(officeObjectsPath, [])),
    writeOfficeObjects: async (objects) => writeJsonAtomic(officeObjectsPath, normalizeOfficeObjects(objects)),
    readOpenclawConfig: async () => asObject(await readJsonFile(openclawConfigPath, {})),
    writeOpenclawConfig: async (config) => writeJsonAtomic(openclawConfigPath, asObject(config)),
    readOfficeStylePreset: async () => {
      const company = normalizeCompanyModel(await readJsonFile(companyPath, {}));
      return company.officeStylePreset ?? "default";
    },
    writeOfficeStylePreset: async (preset) => {
      const company = normalizeCompanyModel(await readJsonFile(companyPath, {}));
      await writeJsonAtomic(companyPath, {
        ...company,
        officeStylePreset: normalizeOfficeStylePreset(preset) ?? "default",
      });
    },
  };
}

