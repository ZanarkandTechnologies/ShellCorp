/**
 * TEAM BUSINESS COMMANDS
 * =======================
 * Purpose
 * - Business configuration: get, context, set, set-all.
 * - Agent skill equipping and workspace skill sync.
 * - Demo seeding and lamp video generation.
 */
import path from "node:path";
import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { Command } from "commander";
import {
  type SidecarStore,
  type BusinessConfigModel,
  type BusinessEquipMode,
  type BusinessTeamRole,
  type BoardTaskStatus,
  type BoardTaskPriority,
  type CompanyModel,
  type ConfigEntry,
  ensureCommandPermission,
  resolveProjectOrFail,
  parseBusinessType,
  parseCapabilityCategory,
  defaultBusinessConfig,
  ensureProjectAccount,
  defaultProjectResources,
  buildTeamBusinessSkillTargets,
  applyAgentSkillsByMode,
  resolveSkillSourceDirectory,
  tryResolveWorkspaceFromOpenclawConfig,
  resolveOpenclawStateRoot,
  pathExists,
  runInfshVideoGeneration,
  toSlug,
  collectConfigEntry,
  normalizeConfigEntries,
  parseSkillList,
  asRecord,
  formatOutput,
  fail,
} from "./_shared.js";
import { postBoardCommand, tryLogCliActivity } from "./_convex.js";

export function registerTeamBusiness(team: Command, store: SidecarStore): void {
  const business = team.command("business").description("Manage business configuration for a team");

  business
    .command("get")
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
        businessConfig: project.businessConfig ?? null,
        trackingContext: project.trackingContext ?? "",
      };
      formatOutput(
        opts.json ? "json" : "text",
        payload,
        project.businessConfig
          ? `${opts.teamId} | type=${project.businessConfig.type} | measure=${project.businessConfig.slots.measure.skillId} | execute=${project.businessConfig.slots.execute.skillId} | distribute=${project.businessConfig.slots.distribute.skillId}`
          : `${opts.teamId} has no business config`,
      );
    });

  // ─── Business context sub-commands ────────────────────────────────────────

  const businessContext = business
    .command("context")
    .description("Manage freeform business tracking context");
  businessContext
    .command("get")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const text = project.trackingContext ?? "";
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, trackingContext: text },
        text ? text : `${opts.teamId} has no tracking context`,
      );
    });

  businessContext
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--text <text>", "Tracking context text")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; text: string; json?: boolean }) => {
      ensureCommandPermission("team.business.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const nextText = opts.text.trim();
      const nextProject = nextText
        ? { ...project, trackingContext: nextText }
        : (() => {
            const { trackingContext: _trackingContext, ...rest } = project;
            return rest;
          })();
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, trackingContext: nextText },
        `Updated business tracking context for ${opts.teamId}`,
      );
    });

  // ─── Business slot set ────────────────────────────────────────────────────

  business
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--slot <slot>", "Capability slot: measure|execute|distribute")
    .requiredOption("--skill-id <skillId>", "Skill identifier for selected slot")
    .option("--business-type <type>", "affiliate_marketing|content_creator|saas|custom")
    .option("--config-json <json>", "JSON object for slot config")
    .option(
      "--config <entry>",
      "Config key=value (repeatable)",
      collectConfigEntry,
      [] as ConfigEntry[],
    )
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        slot: string;
        skillId: string;
        businessType?: string;
        configJson?: string;
        config: ConfigEntry[];
        json?: boolean;
      }) => {
        ensureCommandPermission("team.business.write");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const slot = parseCapabilityCategory(opts.slot);
        const skillId = opts.skillId.trim();
        if (!skillId) fail("invalid_skill_id");
        const baseConfig = opts.configJson?.trim()
          ? normalizeConfigEntries(
              parseSkillList(opts.configJson.trim()).reduce((acc, _) => acc, [] as ConfigEntry[]),
            )
          : {};
        const parsedConfigJson = opts.configJson?.trim()
          ? (() => {
              try {
                const p = JSON.parse(opts.configJson.trim()) as unknown;
                if (p && typeof p === "object" && !Array.isArray(p)) {
                  const out: Record<string, string> = {};
                  for (const [key, value] of Object.entries(p as Record<string, unknown>)) {
                    if (typeof value === "string") out[key] = value;
                  }
                  return out;
                }
                return {};
              } catch {
                throw new Error("invalid_config_json");
              }
            })()
          : {};
        const extraConfig = normalizeConfigEntries(opts.config);
        const mergedConfig = { ...parsedConfigJson, ...extraConfig };
        const currentBusinessConfig =
          project.businessConfig ??
          defaultBusinessConfig(
            opts.businessType?.trim() ? parseBusinessType(opts.businessType.trim()) : "custom",
          );
        const nextType = opts.businessType?.trim()
          ? parseBusinessType(opts.businessType.trim())
          : currentBusinessConfig.type;
        const nextBusinessConfig: BusinessConfigModel = {
          type: nextType,
          slots: {
            measure: { ...currentBusinessConfig.slots.measure },
            execute: { ...currentBusinessConfig.slots.execute },
            distribute: { ...currentBusinessConfig.slots.distribute },
          },
        };
        const existingSlot = nextBusinessConfig.slots[slot];
        nextBusinessConfig.slots[slot] = {
          skillId,
          category: slot,
          config: Object.keys(mergedConfig).length > 0 ? mergedConfig : existingSlot.config,
        };
        const nextProject = {
          ...project,
          businessConfig: nextBusinessConfig,
          account: project.account ?? ensureProjectAccount(projectId, project),
          accountEvents: project.accountEvents ?? [],
          ledger: project.ledger ?? [],
          experiments: project.experiments ?? [],
          metricEvents: project.metricEvents ?? [],
          resources: project.resources ?? defaultProjectResources(projectId),
          resourceEvents: project.resourceEvents ?? [],
        };
        await store.writeCompanyModel({
          ...company,
          projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
        });
        formatOutput(
          opts.json ? "json" : "text",
          {
            ok: true,
            teamId: opts.teamId,
            projectId,
            businessType: nextBusinessConfig.type,
            slot,
            skillId,
            config: nextBusinessConfig.slots[slot].config,
          },
          `Updated business slot '${slot}' for ${opts.teamId}`,
        );
      },
    );

  business
    .command("set-all")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--business-type <type>", "affiliate_marketing|content_creator|saas|custom")
    .requiredOption("--measure-skill-id <skillId>", "Measure slot skill id")
    .requiredOption("--execute-skill-id <skillId>", "Execute slot skill id")
    .requiredOption("--distribute-skill-id <skillId>", "Distribute slot skill id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        businessType: string;
        measureSkillId: string;
        executeSkillId: string;
        distributeSkillId: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.business.write");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const nextType = parseBusinessType(opts.businessType.trim());
        const nextBusinessConfig: BusinessConfigModel = {
          type: nextType,
          slots: {
            measure: {
              category: "measure",
              skillId: opts.measureSkillId.trim(),
              config: project.businessConfig?.slots.measure.config ?? {},
            },
            execute: {
              category: "execute",
              skillId: opts.executeSkillId.trim(),
              config: project.businessConfig?.slots.execute.config ?? {},
            },
            distribute: {
              category: "distribute",
              skillId: opts.distributeSkillId.trim(),
              config: project.businessConfig?.slots.distribute.config ?? {},
            },
          },
        };
        const nextProject = {
          ...project,
          businessConfig: nextBusinessConfig,
          account: project.account ?? ensureProjectAccount(projectId, project),
          accountEvents: project.accountEvents ?? [],
          resources: project.resources ?? defaultProjectResources(projectId),
          resourceEvents: project.resourceEvents ?? [],
          ledger: project.ledger ?? [],
          experiments: project.experiments ?? [],
          metricEvents: project.metricEvents ?? [],
        };
        await store.writeCompanyModel({
          ...company,
          projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, businessConfig: nextBusinessConfig },
          `Updated all business slots for ${opts.teamId}`,
        );
      },
    );

  // ─── Skill equipping ──────────────────────────────────────────────────────

  business
    .command("equip-skills")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--mode <mode>", "replace_minimum|append_only", "replace_minimum")
    .option("--dry-run", "Preview without writing openclaw.json", false)
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; mode: string; dryRun?: boolean; json?: boolean }) => {
      ensureCommandPermission("team.business.write");
      const mode = opts.mode.trim() as BusinessEquipMode;
      if (mode !== "replace_minimum" && mode !== "append_only") {
        fail(`invalid_mode:${opts.mode}`);
      }
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const pmAgent = company.agents.find(
        (entry) => entry.projectId === projectId && entry.role === "biz_pm",
      );
      const executorAgent = company.agents.find(
        (entry) => entry.projectId === projectId && entry.role === "biz_executor",
      );
      if (!pmAgent || !executorAgent) {
        fail(`business_agents_missing:${opts.teamId}`);
      }
      const targets = buildTeamBusinessSkillTargets(project);
      const targetByAgentId = new Map<string, string[]>([
        [pmAgent.agentId, targets.pmSkills],
        [executorAgent.agentId, targets.executorSkills],
      ]);
      const openclawConfig = await store.readOpenclawConfig();
      const agentsNode = asRecord(openclawConfig.agents);
      const currentList = Array.isArray(agentsNode.list) ? [...agentsNode.list] : [];
      const touchedAgents: string[] = [];
      const missingAgents: string[] = [];
      const preview: Array<{
        agentId: string;
        role: BusinessTeamRole;
        mode: BusinessEquipMode;
        beforeSkills: string[];
        afterSkills: string[];
      }> = [];
      const nextList = currentList.map((entry) => {
        const row = asRecord(entry);
        const id = typeof row.id === "string" ? row.id.trim() : "";
        if (!id || !targetByAgentId.has(id)) return row;
        const targetSkills = targetByAgentId.get(id) ?? [];
        const existingSkills = Array.isArray(row.skills)
          ? row.skills.filter((item): item is string => typeof item === "string")
          : [];
        const nextSkills = applyAgentSkillsByMode(existingSkills, targetSkills, mode);
        touchedAgents.push(id);
        preview.push({
          agentId: id,
          role: id === pmAgent.agentId ? "biz_pm" : "biz_executor",
          mode,
          beforeSkills: existingSkills,
          afterSkills: nextSkills,
        });
        return { ...row, skills: nextSkills };
      });
      for (const agentId of [pmAgent.agentId, executorAgent.agentId]) {
        if (!touchedAgents.includes(agentId)) missingAgents.push(agentId);
      }
      if (!opts.dryRun) {
        const nextConfig = {
          ...openclawConfig,
          agents: { ...agentsNode, list: nextList },
        } as Record<string, unknown>;
        await store.writeOpenclawConfig(nextConfig);
      }
      formatOutput(
        opts.json ? "json" : "text",
        {
          ok: true,
          teamId: opts.teamId,
          projectId,
          mode,
          dryRun: Boolean(opts.dryRun),
          touchedAgents,
          missingAgents,
          preview,
        },
        `Equipped skills for ${opts.teamId}: touched=${touchedAgents.length} missing=${missingAgents.length} dryRun=${opts.dryRun ? "yes" : "no"}`,
      );
    });

  business
    .command("sync-workspace-skills")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--dry-run", "Preview workspace sync without writing files", false)
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; dryRun?: boolean; json?: boolean }) => {
      ensureCommandPermission("team.business.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const pmAgent = company.agents.find(
        (entry) => entry.projectId === projectId && entry.role === "biz_pm",
      );
      const executorAgent = company.agents.find(
        (entry) => entry.projectId === projectId && entry.role === "biz_executor",
      );
      if (!pmAgent || !executorAgent) fail(`business_agents_missing:${opts.teamId}`);
      const targets = buildTeamBusinessSkillTargets(project);
      const targetByAgentId = new Map<string, string[]>([
        [pmAgent.agentId, targets.pmSkills],
        [executorAgent.agentId, targets.executorSkills],
      ]);
      const stateRoot = resolveOpenclawStateRoot();
      const openclawConfig = await store.readOpenclawConfig();
      const skillsRoot = path.resolve(process.cwd(), "skills");
      const rows: Array<{
        agentId: string;
        role: BusinessTeamRole;
        workspacePath: string;
        targetSkills: string[];
        copiedSkills: string[];
        unchangedSkills: string[];
        missingSourceSkills: string[];
        staleWorkspaceSkills: string[];
      }> = [];
      const missingAgents: string[] = [];
      for (const [agentId, targetSkills] of targetByAgentId.entries()) {
        const workspacePath = tryResolveWorkspaceFromOpenclawConfig(
          openclawConfig,
          stateRoot,
          agentId,
        );
        const hasWorkspace = await pathExists(workspacePath);
        const existingSkillDirs = hasWorkspace
          ? await readdir(path.join(workspacePath, "skills")).catch(() => [] as string[])
          : [];
        if (!hasWorkspace) missingAgents.push(agentId);
        const copiedSkills: string[] = [];
        const unchangedSkills: string[] = [];
        const missingSourceSkills: string[] = [];
        for (const skillId of targetSkills) {
          const sourcePath = await resolveSkillSourceDirectory(skillsRoot, skillId);
          if (!sourcePath) {
            missingSourceSkills.push(skillId);
            continue;
          }
          const destinationPath = path.join(workspacePath, "skills", skillId);
          const alreadyPresent = await pathExists(destinationPath);
          if (alreadyPresent) unchangedSkills.push(skillId);
          else copiedSkills.push(skillId);
          if (!opts.dryRun) {
            await mkdir(path.dirname(destinationPath), { recursive: true });
            await cp(sourcePath, destinationPath, { recursive: true, force: true });
          }
        }
        const staleWorkspaceSkills = existingSkillDirs.filter(
          (skillId) => !targetSkills.includes(skillId),
        );
        rows.push({
          agentId,
          role: agentId === pmAgent.agentId ? "biz_pm" : "biz_executor",
          workspacePath,
          targetSkills,
          copiedSkills,
          unchangedSkills,
          missingSourceSkills,
          staleWorkspaceSkills,
        });
      }
      formatOutput(
        opts.json ? "json" : "text",
        {
          ok: true,
          teamId: opts.teamId,
          projectId,
          dryRun: Boolean(opts.dryRun),
          missingAgents,
          rows,
        },
        `Synced workspace skills for ${opts.teamId}: copied=${rows.reduce((sum, row) => sum + row.copiedSkills.length, 0)} dryRun=${opts.dryRun ? "yes" : "no"}`,
      );
    });

  // ─── Seed demo ────────────────────────────────────────────────────────────

  business
    .command("seed-demo")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.business.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const now = Date.now();
      const iso = (value: number): string => new Date(value).toISOString();
      const teamAgents = company.agents.filter((entry) => entry.projectId === projectId);
      const pmAgentId =
        teamAgents.find((entry) => entry.role === "biz_pm")?.agentId ??
        `${toSlug(project.name) || "team"}-pm`;
      const executorAgentId =
        teamAgents.find((entry) => entry.role === "biz_executor")?.agentId ??
        `${toSlug(project.name) || "team"}-executor`;
      const artefactVideoPath = `workspace-${executorAgentId}/artifacts/affiliate/veo-demo-v1.mp4`;
      const artefactCaptionPath = `workspace-${executorAgentId}/artifacts/affiliate/caption-demo-v1.txt`;
      const nextProject = {
        ...project,
        ledger: [
          ...(project.ledger ?? []),
          {
            id: `ledger-rev-${now}`,
            projectId,
            timestamp: iso(now - 60 * 60 * 1000),
            type: "revenue" as const,
            amount: 1234,
            currency: "USD",
            source: "amazon_associates",
            description: "Demo affiliate commission",
          },
          {
            id: `ledger-cost-${now}`,
            projectId,
            timestamp: iso(now - 45 * 60 * 1000),
            type: "cost" as const,
            amount: 219,
            currency: "USD",
            source: "openai_api",
            description: "Demo generation cost",
          },
        ],
        experiments: [
          ...(project.experiments ?? []),
          {
            id: `exp-${now}`,
            projectId,
            hypothesis: "Short hooks increase click-through rate",
            status: "completed" as const,
            startedAt: iso(now - 3 * 60 * 60 * 1000),
            endedAt: iso(now - 30 * 60 * 1000),
            results: "Variant B outperformed control by 24%",
            metricsBefore: { clicks: 42 },
            metricsAfter: { clicks: 52 },
          },
        ],
        metricEvents: [
          ...(project.metricEvents ?? []),
          {
            id: `metric-${now}`,
            projectId,
            timestamp: iso(now - 15 * 60 * 1000),
            source: "amazon_associates",
            metrics: {
              clicks: 240,
              ordered_items: 3,
              shipped_items: 2,
              conversion_rate: 1.25,
              revenue_cents: 1234,
              commission_cents: 876,
            },
          },
        ],
      };
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
      });
      const seededBoardTasks = [
        {
          taskId: `seed-${projectId}-research`,
          title: "Research trending AI affiliate products",
          status: "done" as BoardTaskStatus,
          priority: "high" as BoardTaskPriority,
          ownerAgentId: executorAgentId,
          detail: "Seeded demo task for SC11 pipeline: research complete with product shortlist.",
        },
        {
          taskId: `seed-${projectId}-create-content`,
          title: "Create affiliate short video (veo demo)",
          status: "in_progress" as BoardTaskStatus,
          priority: "high" as BoardTaskPriority,
          ownerAgentId: executorAgentId,
          detail: `Artifact path: ${artefactVideoPath}`,
        },
        {
          taskId: `seed-${projectId}-distribute`,
          title: "Distribute TikTok + Instagram post",
          status: "todo" as BoardTaskStatus,
          priority: "medium" as BoardTaskPriority,
          ownerAgentId: executorAgentId,
          detail: `Caption artifact: ${artefactCaptionPath}`,
        },
        {
          taskId: `seed-${projectId}-measure`,
          title: "Measure Amazon Associates results",
          status: "todo" as BoardTaskStatus,
          priority: "medium" as BoardTaskPriority,
          ownerAgentId: pmAgentId,
          detail:
            "Record clicks, ordered_items, shipped_items, conversion_rate, revenue_cents, commission_cents.",
        },
      ];
      let boardSeeded = false;
      for (const task of seededBoardTasks) {
        try {
          await postBoardCommand({
            projectId,
            command: "task_add",
            taskId: task.taskId,
            title: task.title,
            ownerAgentId: task.ownerAgentId,
            priority: task.priority,
            status: task.status,
            actorType: "operator",
            actorAgentId: "seed-demo",
            detail: task.detail,
          });
          boardSeeded = true;
        } catch {
          // Optional in seed path
        }
      }
      await tryLogCliActivity({
        projectId,
        teamId: opts.teamId.trim(),
        actorAgentId: pmAgentId,
        activityType: "planning",
        label: "seed_demo_planning",
        detail: "PM seeded affiliate marketing demo narrative.",
        source: "team.business.seed-demo",
      });
      await tryLogCliActivity({
        projectId,
        teamId: opts.teamId.trim(),
        actorAgentId: executorAgentId,
        activityType: "research",
        label: "seed_demo_research",
        detail: "Research task seeded with affiliate shortlist.",
        source: "team.business.seed-demo",
      });
      await tryLogCliActivity({
        projectId,
        teamId: opts.teamId.trim(),
        actorAgentId: executorAgentId,
        activityType: "executing",
        label: "seed_demo_video_generated",
        detail: `Generated demo artifact at ${artefactVideoPath} via infsh CLI simulation.`,
        source: "team.business.seed-demo",
      });
      await tryLogCliActivity({
        projectId,
        teamId: opts.teamId.trim(),
        actorAgentId: executorAgentId,
        activityType: "distributing",
        label: "seed_demo_distribution_ready",
        detail: `Distribution task prepared with caption artifact ${artefactCaptionPath}.`,
        source: "team.business.seed-demo",
      });
      formatOutput(
        opts.json ? "json" : "text",
        {
          ok: true,
          teamId: opts.teamId,
          projectId,
          boardSeeded,
          seededTasks: seededBoardTasks.map((task) => ({
            taskId: task.taskId,
            status: task.status,
          })),
          seededArtifacts: [artefactVideoPath, artefactCaptionPath],
        },
        `Seeded demo business data for ${opts.teamId} (board=${boardSeeded ? "yes" : "no"})`,
      );
    });

  // ─── Generate lamp videos ─────────────────────────────────────────────────

  business
    .command("generate-lamp-videos")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option(
      "--count <count>",
      "Number of videos to generate",
      (value) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10) fail(`invalid_count:${value}`);
        return parsed;
      },
      2,
    )
    .option("--model <model>", "infsh model id", "google/veo-3-1-fast")
    .option(
      "--spend-per-video-cents <amount>",
      "Ledger spend per video",
      (value) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 0) fail(`invalid_spend_per_video_cents:${value}`);
        return parsed;
      },
      120,
    )
    .option("--simulate", "Create deterministic local artifacts without running infsh", false)
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        count: number;
        model: string;
        spendPerVideoCents: number;
        simulate?: boolean;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.business.write");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const executorAgent =
          company.agents.find(
            (entry) => entry.projectId === projectId && entry.role === "biz_executor",
          ) ?? company.agents.find((entry) => entry.projectId === projectId);
        if (!executorAgent) fail(`team_executor_missing:${opts.teamId}`);
        const stateRoot = resolveOpenclawStateRoot();
        const openclawConfig = await store.readOpenclawConfig();
        const workspacePath = tryResolveWorkspaceFromOpenclawConfig(
          openclawConfig,
          stateRoot,
          executorAgent.agentId,
        );
        const videoDir = path.join(workspacePath, "projects", projectId, "affiliate", "videos");
        await mkdir(videoDir, { recursive: true });
        const createdArtifacts: Array<{
          index: number;
          videoPath: string;
          captionPath: string;
          metadataPath: string;
          sourceRef?: string;
          prompt: string;
        }> = [];
        for (let index = 0; index < opts.count; index += 1) {
          const variant = index + 1;
          const prompt = `Create a vertical UGC ad video for a modern desk lamp. Variant ${variant}. Include: hook in first 2 seconds, clear benefit, and CTA to buy via affiliate link.`;
          const stamp = Date.now() + index;
          const baseName = `lamp-sell-v${variant}-${stamp}`;
          const videoPath = path.join(videoDir, `${baseName}.mp4`);
          const captionPath = path.join(videoDir, `${baseName}.caption.txt`);
          const metadataPath = path.join(videoDir, `${baseName}.json`);
          let sourceRef = "";
          if (opts.simulate) {
            await writeFile(videoPath, "SIMULATED_MP4_BINARY_PLACEHOLDER\n", "utf-8");
            sourceRef = "simulated://local-video";
          } else {
            const generation = await runInfshVideoGeneration(opts.model.trim(), prompt);
            const preferredRef =
              generation.refs.find((ref) => /\.mp4(\?.*)?$/i.test(ref)) ?? generation.refs[0] ?? "";
            if (!preferredRef) {
              fail(
                `infsh_video_ref_missing:variant=${variant}:stdout=${generation.stdout.slice(0, 200)}`,
              );
            }
            sourceRef = preferredRef;
            if (/^https?:\/\//i.test(preferredRef)) {
              const response = await fetch(preferredRef);
              if (!response.ok) fail(`video_download_failed:${response.status}:${preferredRef}`);
              const bytes = Buffer.from(await response.arrayBuffer());
              await writeFile(videoPath, bytes);
            } else {
              const resolvedRef = preferredRef.startsWith("/")
                ? preferredRef
                : path.resolve(preferredRef);
              if (!(await pathExists(resolvedRef))) fail(`video_path_not_found:${preferredRef}`);
              await cp(resolvedRef, videoPath, { force: true });
            }
          }
          const caption = [
            "Brighten your desk setup with this minimalist LED lamp.",
            "Tap the affiliate link for today's best deal.",
            "#desksetup #homedecor #lighting #affiliate",
          ].join("\n");
          await writeFile(captionPath, `${caption}\n`, "utf-8");
          await writeFile(
            metadataPath,
            `${JSON.stringify({ projectId, teamId: opts.teamId, agentId: executorAgent.agentId, model: opts.model.trim(), prompt, sourceRef, createdAt: new Date(stamp).toISOString() }, null, 2)}\n`,
            "utf-8",
          );
          const relativeVideoPath = `workspace-${executorAgent.agentId}/projects/${projectId}/affiliate/videos/${path.basename(videoPath)}`;
          const relativeCaptionPath = `workspace-${executorAgent.agentId}/projects/${projectId}/affiliate/videos/${path.basename(captionPath)}`;
          const taskId = `lamp-${projectId}-${variant}`;
          try {
            await postBoardCommand({
              projectId,
              command: "task_add",
              taskId,
              title: `Create lamp promo video variant ${variant}`,
              ownerAgentId: executorAgent.agentId,
              priority: "high",
              status: "done",
              actorType: "operator",
              actorAgentId: "video-generator",
              detail: `Artifact path: ${relativeVideoPath}\nCaption path: ${relativeCaptionPath}`,
            });
          } catch {
            // Optional board write for local demo mode.
          }
          await tryLogCliActivity({
            projectId,
            teamId: opts.teamId.trim(),
            actorAgentId: executorAgent.agentId,
            activityType: "executing",
            label: "lamp_video_generated",
            detail: `Generated lamp video variant ${variant} at ${relativeVideoPath}`,
            source: "team.business.generate-lamp-videos",
          });
          createdArtifacts.push({
            index: variant,
            videoPath: relativeVideoPath,
            captionPath: relativeCaptionPath,
            metadataPath: `workspace-${executorAgent.agentId}/projects/${projectId}/affiliate/videos/${path.basename(metadataPath)}`,
            sourceRef,
            prompt,
          });
        }
        const totalSpend = opts.count * opts.spendPerVideoCents;
        const account = ensureProjectAccount(projectId, project);
        const nowIso = new Date().toISOString();
        const updatedBalance = Math.max(0, account.balanceCents - totalSpend);
        const accountEvent = {
          id: `acct-${projectId}-${Date.now()}`,
          projectId,
          accountId: account.id,
          timestamp: nowIso,
          type: "debit" as const,
          amountCents: totalSpend,
          source: "inference_sh",
          note: `Generated ${opts.count} lamp videos via ${opts.model.trim()}`,
          balanceAfterCents: updatedBalance,
        };
        const ledgerEntries = createdArtifacts.map((artifact) => ({
          id: `ledger-lamp-${projectId}-${artifact.index}-${Date.now() + artifact.index}`,
          projectId,
          timestamp: nowIso,
          type: "cost" as const,
          amount: opts.spendPerVideoCents,
          currency: "USD",
          source: "inference_sh",
          description: `Lamp video variant ${artifact.index} generation`,
        }));
        const nextProject = {
          ...project,
          account: { ...account, balanceCents: updatedBalance, updatedAt: nowIso },
          accountEvents: [...(project.accountEvents ?? []), accountEvent],
          ledger: [...(project.ledger ?? []), ...ledgerEntries],
        };
        await store.writeCompanyModel({
          ...company,
          projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
        });
        formatOutput(
          opts.json ? "json" : "text",
          {
            ok: true,
            teamId: opts.teamId,
            projectId,
            model: opts.model.trim(),
            count: opts.count,
            simulated: Boolean(opts.simulate),
            totalSpendCents: totalSpend,
            artifacts: createdArtifacts,
          },
          `Generated ${createdArtifacts.length} lamp videos for ${opts.teamId} (${opts.simulate ? "simulated" : "infsh"})`,
        );
      },
    );
}
