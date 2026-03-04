/**
 * TEAM COMMANDS
 * =============
 * Purpose
 * - Implement team lifecycle commands for ShellCorp CEO operations.
 *
 * KEY CONCEPTS:
 * - Team ID maps to project ID as `team-<projectId>`.
 * - Team metadata mutates company sidecar and optional office cluster metadata.
 *
 * USAGE:
 * - shellcorp team create --name "Alpha" --description "..." --goal "..."
 * - shellcorp doctor team-data
 *
 * MEMORY REFERENCES:
 * - MEM-0104
 */
import { Command } from "commander";
import {
  createSidecarStore,
  type CompanyAgentModel,
  type CompanyModel,
  type HeartbeatProfileModel,
  type OfficeObjectModel,
  type RoleSlotModel,
  type SpawnPolicy,
} from "./sidecar-store.js";

type OutputMode = "text" | "json";
type TeamRole = "builder" | "growth_marketer" | "pm";

interface TeamSummary {
  teamId: string;
  projectId: string;
  name: string;
  status: string;
  goal: string;
  kpis: string[];
}

function fail(message: string): never {
  throw new Error(message);
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeKpis(values: string[]): string[] {
  const deduped = new Set<string>();
  for (const value of values) {
    const next = value.trim();
    if (next) deduped.add(next);
  }
  return [...deduped];
}

function projectIdFromTeamId(teamId: string): string {
  const trimmed = teamId.trim();
  if (!trimmed.startsWith("team-")) fail(`invalid_team_id: ${teamId}`);
  return trimmed.slice("team-".length);
}

function teamIdFromProjectId(projectId: string): string {
  return `team-${projectId}`;
}

function collectValue(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseRoles(raw: string): TeamRole[] {
  const parsed = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const out: TeamRole[] = [];
  for (const role of parsed) {
    if (role !== "builder" && role !== "growth_marketer" && role !== "pm") {
      fail(`invalid_role: ${role}`);
    }
    out.push(role);
  }
  return [...new Set(out)];
}

function parseSpawnPolicy(raw: string): SpawnPolicy {
  if (raw === "manual") return "manual";
  if (raw === "queue_pressure") return "queue_pressure";
  fail(`invalid_spawn_policy: ${raw}`);
}

function resolveProjectOrFail(company: CompanyModel, teamId: string) {
  const projectId = projectIdFromTeamId(teamId);
  const project = company.projects.find((entry) => entry.id === projectId);
  if (!project) fail(`team_not_found: ${teamId}`);
  return { projectId, project };
}

function upsertTeamCluster(
  officeObjects: OfficeObjectModel[],
  input: { teamId: string; name: string; description: string },
): OfficeObjectModel[] {
  const existingIndex = officeObjects.findIndex(
    (object) => object.meshType === "team-cluster" && object.metadata?.teamId === input.teamId,
  );
  if (existingIndex === -1) {
    return [
      ...officeObjects,
      {
        id: `team-cluster-${input.teamId}`,
        identifier: `team-cluster-${input.teamId}`,
        meshType: "team-cluster",
        position: [0, 0, 8],
        rotation: [0, 0, 0],
        metadata: {
          teamId: input.teamId,
          name: input.name,
          description: input.description,
          services: [],
        },
      },
    ];
  }
  const next = [...officeObjects];
  const existing = next[existingIndex];
  next[existingIndex] = {
    ...existing,
    metadata: {
      ...(existing.metadata ?? {}),
      teamId: input.teamId,
      name: input.name,
      description: input.description,
    },
  };
  return next;
}

function formatOutput<T>(mode: OutputMode, payload: T, text: string): void {
  if (mode === "json") {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(text);
}

function buildTeamSummaries(company: CompanyModel): TeamSummary[] {
  return company.projects.map((project) => ({
    teamId: teamIdFromProjectId(project.id),
    projectId: project.id,
    name: project.name,
    status: project.status,
    goal: project.goal,
    kpis: project.kpis,
  }));
}

function ensureHeartbeatProfile(company: CompanyModel, projectId: string): { company: CompanyModel; profileId: string } {
  const profileId = `hb-team-${projectId}`;
  const existing = company.heartbeatProfiles.find((entry) => entry.id === profileId);
  if (existing) return { company, profileId };
  const fallback = company.heartbeatProfiles.find((entry) => entry.id === "hb-pm");
  const profile: HeartbeatProfileModel = {
    id: profileId,
    role: "pm",
    cadenceMinutes: fallback?.cadenceMinutes ?? 10,
    teamDescription: fallback?.teamDescription ?? "",
    productDetails: fallback?.productDetails ?? "",
    goal: fallback?.goal ?? "",
  };
  return {
    company: { ...company, heartbeatProfiles: [...company.heartbeatProfiles, profile] },
    profileId,
  };
}

function defaultHeartbeatProfileForRole(role: TeamRole): string {
  if (role === "builder") return "hb-builder";
  if (role === "growth_marketer") return "hb-growth";
  return "hb-pm";
}

function buildAutoAgents(projectId: string, slug: string, roles: TeamRole[]): CompanyAgentModel[] {
  return roles.map((role) => ({
    agentId: `${slug}-${role.replace("_marketer", "")}`,
    role,
    projectId,
    heartbeatProfileId: defaultHeartbeatProfileForRole(role),
    isCeo: false,
    lifecycleState: "pending_spawn",
  }));
}

function buildAutoRoleSlots(projectId: string, roles: TeamRole[]): RoleSlotModel[] {
  return roles.map((role) => ({
    projectId,
    role,
    desiredCount: 1,
    spawnPolicy: "queue_pressure",
  }));
}

function runDoctor(company: CompanyModel): string[] {
  const issues: string[] = [];
  const projectIds = new Set(company.projects.map((project) => project.id));
  const heartbeatIds = new Set(company.heartbeatProfiles.map((profile) => profile.id));
  const seenProjects = new Set<string>();
  for (const project of company.projects) {
    if (seenProjects.has(project.id)) issues.push(`duplicate_project_id:${project.id}`);
    seenProjects.add(project.id);
  }
  const seenAgents = new Set<string>();
  for (const agent of company.agents) {
    if (seenAgents.has(agent.agentId)) issues.push(`duplicate_agent_id:${agent.agentId}`);
    seenAgents.add(agent.agentId);
    if (agent.projectId && !projectIds.has(agent.projectId)) issues.push(`agent_project_missing:${agent.agentId}:${agent.projectId}`);
    if (!heartbeatIds.has(agent.heartbeatProfileId)) {
      issues.push(`agent_heartbeat_missing:${agent.agentId}:${agent.heartbeatProfileId}`);
    }
  }
  for (const slot of company.roleSlots) {
    if (!projectIds.has(slot.projectId)) issues.push(`role_slot_project_missing:${slot.projectId}:${slot.role}`);
  }
  return issues;
}

export function registerTeamCommands(program: Command): void {
  const store = createSidecarStore();
  const team = program.command("team").description("Manage team entities mapped to company projects");

  team
    .command("list")
    .option("--json", "Output JSON", false)
    .action(async (opts: { json?: boolean }) => {
      const company = await store.readCompanyModel();
      const summaries = buildTeamSummaries(company);
      if (opts.json) {
        console.log(JSON.stringify({ teams: summaries }, null, 2));
        return;
      }
      if (summaries.length === 0) {
        console.log("No teams found.");
        return;
      }
      const lines = summaries.map((entry) => `${entry.teamId} | ${entry.name} | ${entry.status} | KPIs=${entry.kpis.length}`);
      console.log(lines.join("\n"));
    });

  team
    .command("create")
    .requiredOption("--name <name>", "Team display name")
    .requiredOption("--description <description>", "Team description")
    .requiredOption("--goal <goal>", "Team goal")
    .option("--kpi <kpi>", "KPI identifier (repeatable)", collectValue, [] as string[])
    .option("--team-id <teamId>", "Override team id (team-*)")
    .option("--auto-roles <roles>", "Comma-separated role list (builder,pm,growth_marketer)")
    .option("--with-cluster", "Create/update team-cluster metadata in office-objects sidecar", false)
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        name: string;
        description: string;
        goal: string;
        kpi: string[];
        teamId?: string;
        autoRoles?: string;
        withCluster?: boolean;
        json?: boolean;
      }) => {
        const company = await store.readCompanyModel();
        const slug = toSlug(opts.name) || `${Date.now()}`;
        const teamId = opts.teamId?.trim() || `team-proj-${slug}`;
        const projectId = projectIdFromTeamId(teamId);
        if (company.projects.some((entry) => entry.id === projectId)) {
          fail(`team_exists:${teamId}`);
        }
        const kpis = normalizeKpis(opts.kpi);
        const project = {
          id: projectId,
          departmentId: company.departments[1]?.id ?? company.departments[0]?.id ?? "dept-products",
          name: opts.name.trim(),
          githubUrl: "",
          status: "active" as const,
          goal: opts.goal.trim(),
          kpis,
        };
        let nextCompany: CompanyModel = {
          ...company,
          projects: [...company.projects, project],
        };
        if (opts.autoRoles?.trim()) {
          const roles = parseRoles(opts.autoRoles);
          nextCompany = {
            ...nextCompany,
            roleSlots: [...nextCompany.roleSlots, ...buildAutoRoleSlots(projectId, roles)],
            agents: [...nextCompany.agents, ...buildAutoAgents(projectId, toSlug(project.name) || slug, roles)],
          };
        }
        await store.writeCompanyModel(nextCompany);
        if (opts.withCluster) {
          const officeObjects = await store.readOfficeObjects();
          const nextObjects = upsertTeamCluster(officeObjects, {
            teamId,
            name: project.name,
            description: opts.description.trim(),
          });
          await store.writeOfficeObjects(nextObjects);
        }
        formatOutput(opts.json ? "json" : "text", { ok: true, teamId, projectId }, `Created ${teamId} -> ${projectId}`);
      },
    );

  team
    .command("update")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--name <name>", "New name")
    .option("--description <description>", "New description (stored in team cluster metadata if present)")
    .option("--goal <goal>", "New team goal")
    .option("--kpi-add <kpi>", "Add KPI (repeatable)", collectValue, [] as string[])
    .option("--kpi-remove <kpi>", "Remove KPI (repeatable)", collectValue, [] as string[])
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        name?: string;
        description?: string;
        goal?: string;
        kpiAdd: string[];
        kpiRemove: string[];
        json?: boolean;
      }) => {
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const removeSet = new Set(normalizeKpis(opts.kpiRemove));
        const addKpis = normalizeKpis(opts.kpiAdd);
        const nextKpis = normalizeKpis([...project.kpis.filter((item) => !removeSet.has(item)), ...addKpis]);
        const nextProject = {
          ...project,
          name: opts.name?.trim() ? opts.name.trim() : project.name,
          goal: opts.goal?.trim() ? opts.goal.trim() : project.goal,
          kpis: nextKpis,
        };
        const nextCompany: CompanyModel = {
          ...company,
          projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
        };
        await store.writeCompanyModel(nextCompany);

        if (opts.description?.trim()) {
          const officeObjects = await store.readOfficeObjects();
          const nextObjects = upsertTeamCluster(officeObjects, {
            teamId: opts.teamId.trim(),
            name: nextProject.name,
            description: opts.description.trim(),
          });
          await store.writeOfficeObjects(nextObjects);
        }
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, kpis: nextKpis },
          `Updated ${opts.teamId}`,
        );
      },
    );

  team
    .command("archive")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const nextCompany: CompanyModel = {
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...project,
                status: "archived",
              }
            : entry,
        ),
        roleSlots: company.roleSlots.map((slot) =>
          slot.projectId === projectId
            ? {
                ...slot,
                desiredCount: 0,
              }
            : slot,
        ),
        agents: company.agents.map((agent) =>
          agent.projectId === projectId
            ? {
                ...agent,
                lifecycleState: "retired",
              }
            : agent,
        ),
      };
      await store.writeCompanyModel(nextCompany);
      formatOutput(opts.json ? "json" : "text", { ok: true, teamId: opts.teamId }, `Archived ${opts.teamId}`);
    });

  const roleSlot = team.command("role-slot").description("Manage team role slots");
  roleSlot
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--role <role>", "Role: builder|pm|growth_marketer")
    .requiredOption("--desired-count <count>", "Desired count", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 0) fail(`invalid_desired_count:${value}`);
      return parsed;
    })
    .option("--spawn-policy <policy>", "queue_pressure|manual", "queue_pressure")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        role: string;
        desiredCount: number;
        spawnPolicy: string;
        json?: boolean;
      }) => {
        const company = await store.readCompanyModel();
        const projectId = projectIdFromTeamId(opts.teamId);
        if (!company.projects.some((entry) => entry.id === projectId)) fail(`team_not_found:${opts.teamId}`);
        const role = parseRoles(opts.role).at(0);
        if (!role) fail(`invalid_role:${opts.role}`);
        const spawnPolicy = parseSpawnPolicy(opts.spawnPolicy);
        const nextRoleSlots = company.roleSlots.filter((slot) => !(slot.projectId === projectId && slot.role === role));
        nextRoleSlots.push({
          projectId,
          role,
          desiredCount: opts.desiredCount,
          spawnPolicy,
        });
        await store.writeCompanyModel({
          ...company,
          roleSlots: nextRoleSlots,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, role, desiredCount: opts.desiredCount, spawnPolicy },
          `Role slot updated for ${opts.teamId} (${role})`,
        );
      },
    );

  const heartbeat = team.command("heartbeat").description("Manage team heartbeat profile");
  heartbeat
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--cadence-minutes <minutes>", "Heartbeat cadence in minutes", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) fail(`invalid_cadence_minutes:${value}`);
      return parsed;
    })
    .requiredOption("--goal <goal>", "Heartbeat goal")
    .option("--team-description <text>", "Team description")
    .option("--product-details <text>", "Product details")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        cadenceMinutes: number;
        goal: string;
        teamDescription?: string;
        productDetails?: string;
        json?: boolean;
      }) => {
        const company = await store.readCompanyModel();
        const projectId = projectIdFromTeamId(opts.teamId);
        if (!company.projects.some((entry) => entry.id === projectId)) fail(`team_not_found:${opts.teamId}`);
        const withProfile = ensureHeartbeatProfile(company, projectId);
        const nextProfiles = withProfile.company.heartbeatProfiles.map((profile) =>
          profile.id === withProfile.profileId
            ? {
                ...profile,
                cadenceMinutes: opts.cadenceMinutes,
                goal: opts.goal.trim(),
                teamDescription: opts.teamDescription?.trim() || profile.teamDescription,
                productDetails: opts.productDetails?.trim() || profile.productDetails,
              }
            : profile,
        );
        const nextAgents = withProfile.company.agents.map((agent) =>
          agent.projectId === projectId
            ? {
                ...agent,
                heartbeatProfileId: withProfile.profileId,
              }
            : agent,
        );
        await store.writeCompanyModel({
          ...withProfile.company,
          heartbeatProfiles: nextProfiles,
          agents: nextAgents,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, heartbeatProfileId: withProfile.profileId },
          `Heartbeat updated for ${opts.teamId}`,
        );
      },
    );
}

export function registerDoctorCommands(program: Command): void {
  const store = createSidecarStore();
  const doctor = program.command("doctor").description("Validate sidecar data contracts");
  doctor
    .command("team-data")
    .option("--json", "Output JSON", false)
    .action(async (opts: { json?: boolean }) => {
      const company = await store.readCompanyModel();
      const issues = runDoctor(company);
      if (opts.json) {
        console.log(JSON.stringify({ ok: issues.length === 0, issues }, null, 2));
      } else if (issues.length === 0) {
        console.log("team-data: ok");
      } else {
        console.error("team-data: invalid");
        for (const issue of issues) console.error(`- ${issue}`);
      }
      if (issues.length > 0) {
        process.exitCode = 1;
      }
    });
}

