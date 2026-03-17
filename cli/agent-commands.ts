/**
 * AGENT COMMANDS
 * ==============
 * Purpose
 * - Expose a small CLI surface for inspecting and editing agent-level config.
 *
 * KEY CONCEPTS:
 * - Agent config is explicit: role, team, skills, heartbeat profile, and workspace path should be visible and scriptable.
 * - Per-agent heartbeat edits get their own profile so one tweak does not silently mutate every agent sharing a default profile.
 *
 * USAGE:
 * - shellcorp agent config show --agent-id alpha-pm --json
 * - shellcorp agent config set-skills --agent-id alpha-builder --skills shellcorp-team-cli,status-self-reporter
 * - shellcorp agent config set-heartbeat --agent-id alpha-pm --cadence-minutes 1 --goal "Test loop"
 *
 * MEMORY REFERENCES:
 * - MEM-0196
 */
import path from "node:path";
import { cp, mkdir, readFile, readdir } from "node:fs/promises";
import type { Command } from "commander";
import { createSidecarStore } from "./sidecar-store.js";
import {
  applyAgentSkillsByMode,
  asRecord,
  ensureCommandPermission,
  formatOutput,
  pathExists,
  resolveOpenclawStateRoot,
  resolveSkillSourceDirectory,
  resolveWorkspaceSkillsRoot,
  resolveTeamIdForAgent,
  roleLabel,
  tryResolveWorkspaceFromOpenclawConfig,
  type CompanyAgentModel,
  type CompanyModel,
} from "./team-commands/_shared.js";

type SkillMode = "replace_minimum" | "append_only";

function parseSkillMode(raw: string): SkillMode {
  if (raw === "replace_minimum" || raw === "append_only") return raw;
  throw new Error(`invalid_mode:${raw}`);
}

function ensureAgentHeartbeatProfile(
  company: CompanyModel,
  agent: CompanyAgentModel,
): { company: CompanyModel; profileId: string } {
  const profileId = `hb-agent-${agent.agentId}`;
  const existing = company.heartbeatProfiles.find((entry) => entry.id === profileId);
  if (existing) return { company, profileId };
  const base =
    company.heartbeatProfiles.find((entry) => entry.id === agent.heartbeatProfileId) ??
    company.heartbeatProfiles.find((entry) => entry.role === agent.role);
  return {
    company: {
      ...company,
      heartbeatProfiles: [
        ...company.heartbeatProfiles,
        {
          id: profileId,
          role: agent.role,
          cadenceMinutes: base?.cadenceMinutes ?? 10,
          teamDescription: base?.teamDescription ?? roleLabel(agent.role),
          productDetails: base?.productDetails ?? "",
          goal: base?.goal ?? "",
        },
      ],
    },
    profileId,
  };
}

export function registerAgentCommands(program: Command): void {
  const store = createSidecarStore();
  const agent = program.command("agent").description("Inspect and edit agent configuration");
  const config = agent.command("config").description("Manage agent config");

  config
    .command("show")
    .requiredOption("--agent-id <agentId>", "Agent id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { agentId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const openclawConfig = await store.readOpenclawConfig();
      const row = company.agents.find((entry) => entry.agentId === opts.agentId.trim());
      if (!row) throw new Error(`agent_not_found:${opts.agentId}`);
      const teamId = row.projectId ? resolveTeamIdForAgent(company, row.agentId) : null;
      const heartbeatProfile = company.heartbeatProfiles.find(
        (entry) => entry.id === row.heartbeatProfileId,
      );
      const openclawAgentsNode = asRecord(openclawConfig.agents);
      const openclawEntry = Array.isArray(openclawAgentsNode.list)
        ? openclawAgentsNode.list.find((entry) => asRecord(entry).id === row.agentId)
        : undefined;
      const workspacePath = tryResolveWorkspaceFromOpenclawConfig(
        openclawConfig,
        resolveOpenclawStateRoot(),
        row.agentId,
      );
      formatOutput(
        opts.json ? "json" : "text",
        {
          ok: true,
          agent: row,
          teamId,
          heartbeatProfile,
          workspacePath,
          openclawEntry: openclawEntry ? asRecord(openclawEntry) : null,
        },
        `${row.agentId} | role=${row.role} | team=${teamId ?? "none"} | heartbeat=${row.heartbeatProfileId}`,
      );
    });

  config
    .command("set-skills")
    .requiredOption("--agent-id <agentId>", "Agent id")
    .requiredOption("--skills <skills>", "Comma-separated skill ids")
    .option("--mode <mode>", "replace_minimum|append_only", "replace_minimum")
    .option("--sync-workspace", "Copy the selected skill folders into the workspace", false)
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        agentId: string;
        skills: string;
        mode: string;
        syncWorkspace?: boolean;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.business.write");
        const mode = parseSkillMode(opts.mode.trim());
        const targetSkills = opts.skills
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);
        const openclawConfig = await store.readOpenclawConfig();
        const agentsNode = asRecord(openclawConfig.agents);
        const currentList = Array.isArray(agentsNode.list) ? [...agentsNode.list] : [];
        let found = false;
        let beforeSkills: string[] = [];
        let afterSkills: string[] = [];
        const nextList = currentList.map((entry) => {
          const row = asRecord(entry);
          if (row.id !== opts.agentId.trim()) return row;
          found = true;
          beforeSkills = Array.isArray(row.skills)
            ? row.skills.filter((item): item is string => typeof item === "string")
            : [];
          afterSkills = applyAgentSkillsByMode(beforeSkills, targetSkills, mode);
          return { ...row, skills: afterSkills };
        });
        if (!found) throw new Error(`agent_not_found:${opts.agentId}`);
        await store.writeOpenclawConfig({
          ...openclawConfig,
          agents: { ...agentsNode, list: nextList },
        });

        const skillsRoot = await resolveWorkspaceSkillsRoot();
        const workspacePath = tryResolveWorkspaceFromOpenclawConfig(
          openclawConfig,
          resolveOpenclawStateRoot(),
          opts.agentId.trim(),
        );
        const existingSkillDirs = opts.syncWorkspace
          ? await readdir(path.join(workspacePath, "skills")).catch(() => [] as string[])
          : [];
        const copiedSkills: string[] = [];
        const missingSourceSkills: string[] = [];
        if (opts.syncWorkspace) {
          for (const skillId of targetSkills) {
            const sourcePath = await resolveSkillSourceDirectory(skillsRoot, skillId);
            if (!sourcePath) {
              missingSourceSkills.push(skillId);
              continue;
            }
            const destinationPath = path.join(workspacePath, "skills", skillId);
            const alreadyPresent = await pathExists(destinationPath);
            if (!alreadyPresent) copiedSkills.push(skillId);
            await mkdir(path.dirname(destinationPath), { recursive: true });
            await cp(sourcePath, destinationPath, { recursive: true, force: true });
          }
        }
        if (missingSourceSkills.length > 0) {
          throw new Error(`missing_skill_sources:${missingSourceSkills.join(",")}`);
        }
        formatOutput(
          opts.json ? "json" : "text",
          {
            ok: true,
            agentId: opts.agentId,
            mode,
            beforeSkills,
            afterSkills,
            workspacePath,
            copiedSkills,
            staleWorkspaceSkills: existingSkillDirs.filter((entry) => !targetSkills.includes(entry)),
          },
          `Updated skills for ${opts.agentId}: ${afterSkills.join(", ")}`,
        );
      },
    );

  config
    .command("set-heartbeat")
    .requiredOption("--agent-id <agentId>", "Agent id")
    .requiredOption("--cadence-minutes <minutes>", "Heartbeat cadence in minutes", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`invalid_cadence_minutes:${value}`);
      return parsed;
    })
    .requiredOption("--goal <goal>", "Heartbeat goal")
    .option("--team-description <text>", "Optional team description override")
    .option("--product-details <text>", "Optional product details override")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        agentId: string;
        cadenceMinutes: number;
        goal: string;
        teamDescription?: string;
        productDetails?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.heartbeat.write");
        const company = await store.readCompanyModel();
        const currentAgent = company.agents.find((entry) => entry.agentId === opts.agentId.trim());
        if (!currentAgent) throw new Error(`agent_not_found:${opts.agentId}`);
        const { company: withProfile, profileId } = ensureAgentHeartbeatProfile(company, currentAgent);
        const nextProfiles = withProfile.heartbeatProfiles.map((entry) =>
          entry.id === profileId
            ? {
                ...entry,
                cadenceMinutes: opts.cadenceMinutes,
                goal: opts.goal.trim(),
                teamDescription: opts.teamDescription?.trim() || entry.teamDescription,
                productDetails: opts.productDetails?.trim() || entry.productDetails,
              }
            : entry,
        );
        const nextAgents = withProfile.agents.map((entry) =>
          entry.agentId === currentAgent.agentId ? { ...entry, heartbeatProfileId: profileId } : entry,
        );
        await store.writeCompanyModel({
          ...withProfile,
          heartbeatProfiles: nextProfiles,
          agents: nextAgents,
        });
        formatOutput(
          opts.json ? "json" : "text",
          {
            ok: true,
            agentId: opts.agentId,
            heartbeatProfileId: profileId,
            cadenceMinutes: opts.cadenceMinutes,
            goal: opts.goal.trim(),
          },
          `Updated heartbeat profile for ${opts.agentId} -> ${profileId}`,
        );
      },
    );

  agent
    .command("monitor")
    .requiredOption("--agent-id <agentId>", "Agent id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { agentId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const openclawConfig = await store.readOpenclawConfig();
      const currentAgent = company.agents.find((entry) => entry.agentId === opts.agentId.trim());
      if (!currentAgent) throw new Error(`agent_not_found:${opts.agentId}`);
      const heartbeatProfile = company.heartbeatProfiles.find(
        (entry) => entry.id === currentAgent.heartbeatProfileId,
      );
      const cronPath = path.join(resolveOpenclawStateRoot(), "cron", "jobs.json");
      const cronJobs = await (async () => {
        try {
          const raw = await readFile(cronPath, "utf-8");
          const parsed = JSON.parse(raw) as unknown;
          return Array.isArray(parsed)
            ? parsed.filter((entry) => asRecord(entry).agentId === currentAgent.agentId)
            : [];
        } catch {
          return [];
        }
      })();
      const workspacePath = tryResolveWorkspaceFromOpenclawConfig(
        openclawConfig,
        resolveOpenclawStateRoot(),
        currentAgent.agentId,
      );
      formatOutput(
        opts.json ? "json" : "text",
        {
          ok: true,
          agent: currentAgent,
          heartbeatProfile,
          workspacePath,
          cronJobs,
        },
        `${currentAgent.agentId} | role=${currentAgent.role} | cron=${cronJobs.length}`,
      );
    });
}
