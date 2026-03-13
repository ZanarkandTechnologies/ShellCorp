/**
 * TEAM CORE COMMANDS
 * ==================
 * Purpose
 * - Team lifecycle: create, list, show, update, archive.
 * - Team KPI management.
 * - Team role-slot management.
 */
import type { Command } from "commander";
import {
  buildAutoAgents,
  buildAutoRoleSlots,
  buildBusinessAgents,
  buildBusinessRoleSlots,
  buildTeamSummaries,
  type CompanyAgentModel,
  type CompanyModel,
  collectValue,
  copyBusinessHeartbeatTemplates,
  defaultBusinessConfig,
  defaultProjectResources,
  deregisterOpenclawAgents,
  ensureBusinessHeartbeatProfiles,
  ensureCommandPermission,
  fail,
  formatOutput,
  normalizeKpis,
  parseBusinessType,
  parseRoleSlotRole,
  parseRoles,
  parseSpawnPolicy,
  projectIdFromTeamId,
  provisionOpenclawAgents,
  removeTeamClusters,
  resolveProjectOrFail,
  type SidecarStore,
  toSlug,
  upsertBusinessCronJobs,
  upsertTeamCluster,
} from "./_shared.js";

export function registerTeamCore(team: Command, store: SidecarStore): void {
  team
    .command("list")
    .option("--json", "Output JSON", false)
    .action(async (opts: { json?: boolean }) => {
      ensureCommandPermission("team.read");
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
      const lines = summaries.map(
        (entry) => `${entry.teamId} | ${entry.name} | ${entry.status} | KPIs=${entry.kpis.length}`,
      );
      console.log(lines.join("\n"));
    });

  team
    .command("show")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const payload = {
        ok: true,
        teamId: opts.teamId,
        projectId,
        project,
        roleSlots: company.roleSlots.filter((entry) => entry.projectId === projectId),
        agents: company.agents.filter((entry) => entry.projectId === projectId),
      };
      formatOutput(
        opts.json ? "json" : "text",
        payload,
        `${opts.teamId} | ${project.name} | goal=${project.goal} | kpis=${project.kpis.length} | status=${project.status}`,
      );
    });

  team
    .command("create")
    .requiredOption("--name <name>", "Team display name")
    .requiredOption("--description <description>", "Team description")
    .requiredOption("--goal <goal>", "Team goal")
    .option("--kpi <kpi>", "KPI identifier (repeatable)", collectValue, [] as string[])
    .option("--team-id <teamId>", "Override team id (team-*)")
    .option("--auto-roles <roles>", "Comma-separated role list (builder,pm,growth_marketer)")
    .option("--business-type <type>", "affiliate_marketing|content_creator|saas|custom")
    .option(
      "--with-cluster",
      "Create/update team-cluster metadata in office-objects sidecar",
      false,
    )
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        name: string;
        description: string;
        goal: string;
        kpi: string[];
        teamId?: string;
        autoRoles?: string;
        businessType?: string;
        withCluster?: boolean;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.meta.write");
        const businessType = opts.businessType?.trim()
          ? parseBusinessType(opts.businessType.trim())
          : undefined;
        let company = await store.readCompanyModel();
        if (businessType) {
          company = ensureBusinessHeartbeatProfiles(company);
        }
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
          ...(businessType ? { businessConfig: defaultBusinessConfig(businessType) } : {}),
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
        };
        let nextCompany: CompanyModel = {
          ...company,
          projects: [...company.projects, project],
        };
        let createdAgents: CompanyAgentModel[] = [];
        if (businessType) {
          const businessAgents = buildBusinessAgents(projectId, toSlug(project.name) || slug);
          createdAgents = businessAgents;
          nextCompany = {
            ...nextCompany,
            roleSlots: [...nextCompany.roleSlots, ...buildBusinessRoleSlots(projectId)],
            agents: [...nextCompany.agents, ...businessAgents],
          };
          await copyBusinessHeartbeatTemplates(businessAgents.map((agent) => agent.agentId));
          await upsertBusinessCronJobs(
            projectId,
            businessAgents.map((agent) => agent.agentId),
          );
        } else if (opts.autoRoles?.trim()) {
          const roles = parseRoles(opts.autoRoles);
          createdAgents = buildAutoAgents(projectId, toSlug(project.name) || slug, roles);
          nextCompany = {
            ...nextCompany,
            roleSlots: [...nextCompany.roleSlots, ...buildAutoRoleSlots(projectId, roles)],
            agents: [...nextCompany.agents, ...createdAgents],
          };
        }
        await store.writeCompanyModel(nextCompany);
        await provisionOpenclawAgents({ store, agents: createdAgents, projectName: project.name });
        if (opts.withCluster) {
          const officeObjects = await store.readOfficeObjects();
          const nextObjects = upsertTeamCluster(officeObjects, {
            teamId,
            name: project.name,
            description: opts.description.trim(),
          });
          await store.writeOfficeObjects(nextObjects);
        }
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId, projectId },
          `Created ${teamId} -> ${projectId}`,
        );
      },
    );

  team
    .command("update")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--name <name>", "New name")
    .option(
      "--description <description>",
      "New description (stored in team cluster metadata if present)",
    )
    .option("--goal <goal>", "New team goal")
    .option("--kpi-add <kpi>", "Add KPI (repeatable)", collectValue, [] as string[])
    .option("--kpi-remove <kpi>", "Remove KPI (repeatable)", collectValue, [] as string[])
    .option("--kpi-set <kpi>", "Replace KPI set (repeatable)", collectValue, [] as string[])
    .option("--clear-kpis", "Clear all KPIs before apply", false)
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        name?: string;
        description?: string;
        goal?: string;
        kpiAdd: string[];
        kpiRemove: string[];
        kpiSet: string[];
        clearKpis?: boolean;
        json?: boolean;
      }) => {
        const touchesMeta = Boolean(
          opts.name?.trim() || opts.description?.trim() || opts.goal?.trim(),
        );
        const touchesKpi =
          opts.kpiAdd.length > 0 ||
          opts.kpiRemove.length > 0 ||
          opts.kpiSet.length > 0 ||
          opts.clearKpis === true;
        if (touchesMeta) ensureCommandPermission("team.meta.write");
        if (touchesKpi) ensureCommandPermission("team.kpi.write");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const removeSet = new Set(normalizeKpis(opts.kpiRemove));
        const addKpis = normalizeKpis(opts.kpiAdd);
        const setKpis = normalizeKpis(opts.kpiSet);
        const baseKpis = setKpis.length > 0 ? setKpis : opts.clearKpis ? [] : project.kpis;
        const nextKpis = normalizeKpis([
          ...baseKpis.filter((item) => !removeSet.has(item)),
          ...addKpis,
        ]);
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
    .option(
      "--deregister-openclaw",
      "Remove archived team agents from openclaw.json agents.list",
      false,
    )
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; deregisterOpenclaw?: boolean; json?: boolean }) => {
      ensureCommandPermission("team.archive");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const archivedAgentIds = company.agents
        .filter((agent) => agent.projectId === projectId)
        .map((agent) => agent.agentId);
      const nextCompany: CompanyModel = {
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId ? { ...project, status: "archived" } : entry,
        ),
        roleSlots: company.roleSlots.map((slot) =>
          slot.projectId === projectId ? { ...slot, desiredCount: 0 } : slot,
        ),
        agents: company.agents.map((agent) =>
          agent.projectId === projectId ? { ...agent, lifecycleState: "retired" } : agent,
        ),
      };
      await store.writeCompanyModel(nextCompany);
      const officeObjects = await store.readOfficeObjects();
      const nextOfficeObjects = removeTeamClusters(officeObjects, {
        teamId: opts.teamId.trim(),
      });
      if (nextOfficeObjects.length !== officeObjects.length) {
        await store.writeOfficeObjects(nextOfficeObjects);
      }
      if (opts.deregisterOpenclaw) {
        await deregisterOpenclawAgents({ store, agentIds: archivedAgentIds });
      }
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId },
        `Archived ${opts.teamId}`,
      );
    });

  // ─── KPI sub-commands ──────────────────────────────────────────────────────

  const kpi = team.command("kpi").description("Manage team KPI set");
  kpi
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--kpi <kpi>", "KPI identifier (repeatable)", collectValue, [] as string[])
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; kpi: string[]; json?: boolean }) => {
      ensureCommandPermission("team.kpi.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const nextKpis = normalizeKpis(opts.kpi);
      const nextCompany: CompanyModel = {
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId ? { ...project, kpis: nextKpis } : entry,
        ),
      };
      await store.writeCompanyModel(nextCompany);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, kpis: nextKpis },
        `Set ${nextKpis.length} KPI(s) for ${opts.teamId}`,
      );
    });

  kpi
    .command("clear")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.kpi.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const nextCompany: CompanyModel = {
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId ? { ...project, kpis: [] } : entry,
        ),
      };
      await store.writeCompanyModel(nextCompany);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, kpis: [] },
        `Cleared KPIs for ${opts.teamId}`,
      );
    });

  // ─── Role-slot sub-commands ────────────────────────────────────────────────

  const roleSlot = team.command("role-slot").description("Manage team role slots");
  roleSlot
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--role <role>", "Role: builder|pm|growth_marketer|biz_pm|biz_executor")
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
        ensureCommandPermission("team.meta.write");
        const company = await store.readCompanyModel();
        const projectId = projectIdFromTeamId(opts.teamId);
        if (!company.projects.some((entry) => entry.id === projectId))
          fail(`team_not_found:${opts.teamId}`);
        const role = parseRoleSlotRole(opts.role);
        const spawnPolicy = parseSpawnPolicy(opts.spawnPolicy);
        const nextRoleSlots = company.roleSlots.filter(
          (slot) => !(slot.projectId === projectId && slot.role === role),
        );
        nextRoleSlots.push({ projectId, role, desiredCount: opts.desiredCount, spawnPolicy });
        await store.writeCompanyModel({ ...company, roleSlots: nextRoleSlots });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, role, desiredCount: opts.desiredCount, spawnPolicy },
          `Role slot updated for ${opts.teamId} (${role})`,
        );
      },
    );
}
