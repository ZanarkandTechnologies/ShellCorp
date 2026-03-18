/**
 * TEAM PRESET COMMANDS
 * ====================
 * Purpose
 * - Preview and apply opinionated team presets so operators can describe a team once, review the generated config, and then materialize it through the CLI.
 *
 * KEY CONCEPTS:
 * - Preset flows are preview-first: they print the exact roles, heartbeat config, and skills before mutating state.
 * - The first preset is `dev`, which models a ShellCorp product team as a PM + builder core with an optional marketer role slot.
 *
 * USAGE:
 * - shellcorp team preset dev --json
 * - shellcorp team preset dev --apply --with-cluster
 *
 * MEMORY REFERENCES:
 * - MEM-0195
 */
import path from "node:path";
import { cp, mkdir, readdir } from "node:fs/promises";
import type { Command } from "commander";
import {
  applyAgentSkillsByMode,
  buildAutoAgents,
  ensureCommandPermission,
  ensureHeartbeatProfile,
  formatOutput,
  pathExists,
  projectIdFromTeamId,
  provisionOpenclawAgents,
  resolveOpenclawStateRoot,
  resolveSkillSourceDirectory,
  resolveWorkspaceSkillsRoot,
  roleLabel,
  toSlug,
  tryResolveWorkspaceFromOpenclawConfig,
  type CompanyAgentModel,
  type CompanyModel,
  type SidecarStore,
  upsertTeamCluster,
  writeFileIfMissing,
} from "./_shared.js";
import { ensureOpenclawHeartbeatScaffold, writeTeamHeartbeatFiles } from "./_convex.js";

type MarketerMode = "none" | "elastic" | "persistent";
type CoreRole = "pm" | "builder" | "growth_marketer";

type PresetSkillRow = {
  role: CoreRole;
  label: string;
  targetSkills: string[];
  note?: string;
};

type WorkspaceSkillRow = {
  agentId: string;
  role: CoreRole;
  workspacePath: string;
  targetSkills: string[];
  copiedSkills: string[];
  unchangedSkills: string[];
  missingSourceSkills: string[];
  staleWorkspaceSkills: string[];
};

const DEV_PRESET_ID = "shellcorp_dev_team";
const DEFAULT_TEAM_NAME = "ShellCorp Dev Team";
const DEFAULT_TEAM_DESCRIPTION =
  "Internal product team that scouts adjacent AI-office products, proposes bounded improvements, implements approved changes, and turns meaningful wins into operator-facing updates.";
const DEFAULT_TEAM_GOAL =
  "Continuously improve ShellCorp by scouting competitors, shaping actionable tickets, shipping approved improvements, and surfacing launch-worthy updates.";

export type DevPresetApplyOptions = {
  teamId?: string;
  name?: string;
  description?: string;
  goal?: string;
  marketerMode?: MarketerMode;
  cadenceMinutes?: number;
  withCluster?: boolean;
};

function parseMarketerMode(raw: string): MarketerMode {
  if (raw === "none" || raw === "elastic" || raw === "persistent") return raw;
  throw new Error(`invalid_marketer_mode:${raw}`);
}

function devPresetSkillPlan(marketerMode: MarketerMode): PresetSkillRow[] {
  return [
    {
      role: "pm",
      label: "PM",
      targetSkills: [
        "shellcorp-team-cli",
        "shellcorp-kanban-ops",
        "shellcorp-competitor-feature-scout",
        "create-team",
        "status-self-reporter",
      ],
    },
    {
      role: "builder",
      label: "Dev",
      targetSkills: ["shellcorp-team-cli", "shellcorp-kanban-ops", "status-self-reporter"],
      note: "Builder stays tool-heavy by design; coding capability should come from the agent runtime plus CLI access.",
    },
    {
      role: "growth_marketer",
      label: "Marketer",
      targetSkills: ["shellcorp-team-cli", "shellcorp-kanban-ops", "status-self-reporter"],
      note:
        marketerMode === "none"
          ? "Marketer is disabled for this preset."
          : "No dedicated in-repo marketing skill exists yet, so marketer uses shared board/CLI/status skills for now.",
    },
  ];
}

function buildPresetNotes(marketerMode: MarketerMode): string[] {
  const notes = [
    "Preview first, then re-run with --apply once the generated roles and skills look right.",
    "PM is the persistent planning brain. Builder is the persistent execution role.",
    "Marketer should stay optional until you actually want daily distribution work in the demo.",
  ];
  if (marketerMode !== "persistent") {
    notes.push(
      "Marketer is configured as a role slot, not a permanent agent, so the team can stay lean until promotion work is needed.",
    );
  }
  return notes;
}

function buildHeartbeatProductDetails(marketerMode: MarketerMode): string {
  return [
    "PM scouts competitor repos, proposes tickets, and decides when extra execution capacity is worth adding.",
    "Builder takes approved tickets and ships bounded implementation work.",
    marketerMode === "persistent"
      ? "Marketer turns meaningful product deltas into short-form launch updates."
      : "Marketer remains optional and should only be activated when the shipped work is worth promoting.",
  ].join(" ");
}

function buildTextPreview(payload: {
  mode: "preview" | "apply";
  teamId: string;
  projectExists: boolean;
  marketerMode: MarketerMode;
  cadenceMinutes: number;
  skillPlan: PresetSkillRow[];
}): string {
  const skillLines = payload.skillPlan
    .map((row) => `${row.label}: ${row.targetSkills.join(", ") || "(none)"}`)
    .join("\n");
  return [
    `${payload.mode === "preview" ? "Preview" : "Applied"} ${DEV_PRESET_ID} -> ${payload.teamId}`,
    `existing=${payload.projectExists ? "yes" : "no"} marketer=${payload.marketerMode} cadence=${payload.cadenceMinutes}m`,
    skillLines,
  ].join("\n");
}

function buildRoleSlotEntries(
  projectId: string,
  marketerMode: MarketerMode,
): CompanyModel["roleSlots"] {
  return [
    { projectId, role: "pm", desiredCount: 1, spawnPolicy: "queue_pressure" as const },
    { projectId, role: "builder", desiredCount: 1, spawnPolicy: "queue_pressure" as const },
    {
      projectId,
      role: "growth_marketer",
      desiredCount: marketerMode === "persistent" ? 1 : 0,
      spawnPolicy: marketerMode === "persistent" ? ("queue_pressure" as const) : ("manual" as const),
    },
  ];
}

function buildMissingAgents(
  projectId: string,
  slug: string,
  company: CompanyModel,
  marketerMode: MarketerMode,
): CompanyAgentModel[] {
  const targetRoles: CoreRole[] =
    marketerMode === "persistent" ? ["pm", "builder", "growth_marketer"] : ["pm", "builder"];
  const currentRoles = new Set(
    company.agents.filter((entry) => entry.projectId === projectId).map((entry) => entry.role),
  );
  const missingRoles = targetRoles.filter((role) => !currentRoles.has(role));
  return missingRoles.length === 0 ? [] : buildAutoAgents(projectId, slug, missingRoles);
}

async function syncPresetSkills(opts: {
  store: SidecarStore;
  teamAgents: CompanyAgentModel[];
  skillPlan: PresetSkillRow[];
}): Promise<{
  touchedAgents: string[];
  missingAgents: string[];
  preview: Array<{
    agentId: string;
    role: CoreRole;
    beforeSkills: string[];
    afterSkills: string[];
  }>;
  workspaceRows: WorkspaceSkillRow[];
}> {
  const roleSkillTargets = new Map<CoreRole, string[]>(
    opts.skillPlan.map((row) => [row.role, row.targetSkills]),
  );
  const openclawConfig = await opts.store.readOpenclawConfig();
  const agentsNode =
    openclawConfig && typeof openclawConfig === "object" && "agents" in openclawConfig
      ? (openclawConfig.agents as Record<string, unknown>)
      : {};
  const currentList = Array.isArray(agentsNode.list) ? [...agentsNode.list] : [];
  const touchedAgents: string[] = [];
  const preview: Array<{
    agentId: string;
    role: CoreRole;
    beforeSkills: string[];
    afterSkills: string[];
  }> = [];
  const teamRoleByAgentId = new Map(
    opts.teamAgents
      .filter(
        (entry): entry is CompanyAgentModel & { role: CoreRole } =>
          entry.role === "pm" || entry.role === "builder" || entry.role === "growth_marketer",
      )
      .map((entry) => [entry.agentId, entry.role]),
  );
  const nextList = currentList.map((entry) => {
    const row = entry && typeof entry === "object" ? ({ ...entry } as Record<string, unknown>) : {};
    const agentId = typeof row.id === "string" ? row.id.trim() : "";
    const role = teamRoleByAgentId.get(agentId);
    if (!agentId || !role) return row;
    const existingSkills = Array.isArray(row.skills)
      ? row.skills.filter((item): item is string => typeof item === "string")
      : [];
    const targetSkills = roleSkillTargets.get(role) ?? [];
    const afterSkills = applyAgentSkillsByMode(existingSkills, targetSkills, "replace_minimum");
    preview.push({ agentId, role, beforeSkills: existingSkills, afterSkills });
    touchedAgents.push(agentId);
    return { ...row, skills: afterSkills };
  });
  const missingAgents = opts.teamAgents
    .map((entry) => entry.agentId)
    .filter((agentId) => !touchedAgents.includes(agentId));
  await opts.store.writeOpenclawConfig({
    ...(openclawConfig as Record<string, unknown>),
    agents: { ...agentsNode, list: nextList },
  });

  const stateRoot = resolveOpenclawStateRoot();
  const refreshedConfig = await opts.store.readOpenclawConfig();
  const skillsRoot = await resolveWorkspaceSkillsRoot();
  const workspaceRows: WorkspaceSkillRow[] = [];
  for (const agent of opts.teamAgents) {
    if (agent.role !== "pm" && agent.role !== "builder" && agent.role !== "growth_marketer") continue;
    const workspacePath = tryResolveWorkspaceFromOpenclawConfig(
      refreshedConfig as Record<string, unknown>,
      stateRoot,
      agent.agentId,
    );
    const hasWorkspace = await pathExists(workspacePath);
    const existingSkillDirs = hasWorkspace
      ? await readdir(path.join(workspacePath, "skills")).catch(() => [] as string[])
      : [];
    const targetSkills = roleSkillTargets.get(agent.role) ?? [];
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
      await mkdir(path.dirname(destinationPath), { recursive: true });
      await cp(sourcePath, destinationPath, { recursive: true, force: true });
    }
    await writeFileIfMissing(
      path.join(workspacePath, "PRESET.md"),
      `# PRESET\n\n- presetId: ${DEV_PRESET_ID}\n- role: ${roleLabel(agent.role)}\n`,
    );
    workspaceRows.push({
      agentId: agent.agentId,
      role: agent.role,
      workspacePath,
      targetSkills,
      copiedSkills,
      unchangedSkills,
      missingSourceSkills,
      staleWorkspaceSkills: existingSkillDirs.filter((skillId) => !targetSkills.includes(skillId)),
    });
  }

  const allMissingSourceSkills = workspaceRows.flatMap((row) => row.missingSourceSkills);
  if (allMissingSourceSkills.length > 0) {
    throw new Error(`missing_skill_sources:${[...new Set(allMissingSourceSkills)].join(",")}`);
  }

  return { touchedAgents, missingAgents, preview, workspaceRows };
}

export async function applyDevTeamPreset(
  store: SidecarStore,
  opts: DevPresetApplyOptions = {},
): Promise<Record<string, unknown>> {
  const marketerMode = opts.marketerMode ?? "elastic";
  let company = await store.readCompanyModel();
  const teamName = opts.name?.trim() || DEFAULT_TEAM_NAME;
  const description = opts.description?.trim() || DEFAULT_TEAM_DESCRIPTION;
  const goal = opts.goal?.trim() || DEFAULT_TEAM_GOAL;
  const cadenceMinutes = opts.cadenceMinutes ?? 3;
  const teamId = opts.teamId?.trim() || `team-proj-${toSlug(teamName) || "shellcorp-dev-team"}`;
  const projectId = projectIdFromTeamId(teamId);
  const existingProject = company.projects.find((entry) => entry.id === projectId);
  const skillPlan = devPresetSkillPlan(marketerMode);
  const notes = buildPresetNotes(marketerMode);
  const previewPayload = {
    ok: true,
    mode: "apply" as const,
    presetId: DEV_PRESET_ID,
    teamId,
    projectId,
    projectExists: Boolean(existingProject),
    teamName,
    description,
    goal,
    marketerMode,
    cadenceMinutes,
    rolePlan: {
      persistent: marketerMode === "persistent" ? ["pm", "builder", "growth_marketer"] : ["pm", "builder"],
      elastic: marketerMode === "elastic" ? ["growth_marketer"] : [],
    },
    skillPlan,
    notes,
    heartbeatPlan: {
      cadenceMinutes,
      goal,
      teamDescription: description,
      productDetails: buildHeartbeatProductDetails(marketerMode),
    },
  };

  const slug = toSlug(teamName) || "shellcorp-dev-team";
  const nextProject =
    existingProject ??
    ({
      id: projectId,
      departmentId:
        company.departments[1]?.id ?? company.departments[0]?.id ?? "dept-products",
      name: teamName,
      githubUrl: "",
      status: "active" as const,
      goal,
      kpis: ["feature-throughput", "review-throughput", "demo-readiness"],
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    } satisfies CompanyModel["projects"][number]);
  const updatedProject = {
    ...nextProject,
    name: teamName,
    goal,
  };
  const createdAgents = buildMissingAgents(projectId, slug, company, marketerMode);
  const existingRoleSlots = company.roleSlots.filter(
    (slot) =>
      !(
        slot.projectId === projectId &&
        (slot.role === "pm" || slot.role === "builder" || slot.role === "growth_marketer")
      ),
  );
  const { company: withProfile, profileId } = ensureHeartbeatProfile(company, projectId);
  company = withProfile;
  const nextProfiles = company.heartbeatProfiles.map((profile) =>
    profile.id === profileId
      ? {
          ...profile,
          cadenceMinutes,
          goal,
          teamDescription: description,
          productDetails: buildHeartbeatProductDetails(marketerMode),
        }
      : profile,
  );
  const nextAgents = [...company.agents, ...createdAgents].map((agent) =>
    agent.projectId === projectId ? { ...agent, heartbeatProfileId: profileId } : agent,
  );
  const projectList = company.projects.some((entry) => entry.id === projectId)
    ? company.projects.map((entry) => (entry.id === projectId ? updatedProject : entry))
    : [...company.projects, updatedProject];
  await store.writeCompanyModel({
    ...company,
    projects: projectList,
    roleSlots: [...existingRoleSlots, ...buildRoleSlotEntries(projectId, marketerMode)],
    agents: nextAgents,
    heartbeatProfiles: nextProfiles,
  });
  await provisionOpenclawAgents({ store, agents: createdAgents, projectName: teamName });
  if (opts.withCluster) {
    const officeObjects = await store.readOfficeObjects();
    const nextObjects = upsertTeamCluster(officeObjects, {
      teamId,
      name: teamName,
      description,
    });
    await store.writeOfficeObjects(nextObjects);
  }
  const refreshedCompany = await store.readCompanyModel();
  const teamAgents = refreshedCompany.agents.filter((entry) => entry.projectId === projectId);
  const skillSync = await syncPresetSkills({ store, teamAgents, skillPlan });
  await writeTeamHeartbeatFiles({
    store,
    project: refreshedCompany.projects.find((entry) => entry.id === projectId) ?? updatedProject,
    agents: teamAgents,
  });
  const updatedOpenclawAgents = await ensureOpenclawHeartbeatScaffold({
    store,
    agentIds: teamAgents.map((entry) => entry.agentId),
  });
  return {
    ...previewPayload,
    createdAgentIds: createdAgents.map((entry) => entry.agentId),
    heartbeatProfileId: profileId,
    updatedOpenclawAgents,
    skillSync,
  };
}

export function registerTeamPreset(team: Command, store: SidecarStore): void {
  const preset = team.command("preset").description("Preview and apply opinionated team presets");

  preset
    .command("dev")
    .description("Preview or apply the ShellCorp Dev Team preset")
    .option("--team-id <teamId>", "Existing team id to reconfigure, or target id for new team")
    .option("--name <name>", "Team display name", DEFAULT_TEAM_NAME)
    .option("--description <description>", "Team description", DEFAULT_TEAM_DESCRIPTION)
    .option("--goal <goal>", "Team goal", DEFAULT_TEAM_GOAL)
    .option("--marketer-mode <mode>", "none|elastic|persistent", "elastic")
    .option("--cadence-minutes <minutes>", "Heartbeat cadence in minutes", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`invalid_cadence_minutes:${value}`);
      return parsed;
    }, 3)
    .option("--with-cluster", "Create/update team-cluster metadata in office-objects sidecar", false)
    .option("--apply", "Write the preset instead of only previewing it", false)
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId?: string;
        name: string;
        description: string;
        goal: string;
        marketerMode: string;
        cadenceMinutes: number;
        withCluster?: boolean;
        apply?: boolean;
        json?: boolean;
      }) => {
        ensureCommandPermission(opts.apply ? "team.meta.write" : "team.read");
        const marketerMode = parseMarketerMode(opts.marketerMode.trim());
        const teamName = opts.name.trim() || DEFAULT_TEAM_NAME;
        const description = opts.description.trim() || DEFAULT_TEAM_DESCRIPTION;
        const goal = opts.goal.trim() || DEFAULT_TEAM_GOAL;
        const teamId = opts.teamId?.trim() || `team-proj-${toSlug(teamName) || "shellcorp-dev-team"}`;
        const projectId = projectIdFromTeamId(teamId);
        const company = await store.readCompanyModel();
        const existingProject = company.projects.find((entry) => entry.id === projectId);
        const skillPlan = devPresetSkillPlan(marketerMode);
        const notes = buildPresetNotes(marketerMode);
        const previewPayload = {
          ok: true,
          mode: opts.apply ? "apply" : "preview",
          presetId: DEV_PRESET_ID,
          teamId,
          projectId,
          projectExists: Boolean(existingProject),
          teamName,
          description,
          goal,
          marketerMode,
          cadenceMinutes: opts.cadenceMinutes,
          rolePlan: {
            persistent: marketerMode === "persistent" ? ["pm", "builder", "growth_marketer"] : ["pm", "builder"],
            elastic: marketerMode === "elastic" ? ["growth_marketer"] : [],
          },
          skillPlan,
          notes,
          heartbeatPlan: {
            cadenceMinutes: opts.cadenceMinutes,
            goal,
            teamDescription: description,
            productDetails: buildHeartbeatProductDetails(marketerMode),
          },
        };
        if (!opts.apply) {
          formatOutput(
            opts.json ? "json" : "text",
            previewPayload,
            buildTextPreview({
              mode: "preview",
              teamId,
              projectExists: Boolean(existingProject),
              marketerMode,
              cadenceMinutes: opts.cadenceMinutes,
              skillPlan,
            }),
          );
          return;
        }
        const payload = await applyDevTeamPreset(store, {
          teamId,
          name: teamName,
          description,
          goal,
          marketerMode,
          cadenceMinutes: opts.cadenceMinutes,
          withCluster: opts.withCluster,
        });
        formatOutput(
          opts.json ? "json" : "text",
          payload,
          buildTextPreview({
            mode: "apply",
            teamId,
            projectExists: Boolean(existingProject),
            marketerMode,
            cadenceMinutes: opts.cadenceMinutes,
            skillPlan,
          }),
        );
      },
    );
}
