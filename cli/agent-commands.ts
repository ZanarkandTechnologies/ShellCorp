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
 * - MEM-0211
 * - MEM-0212
 */
import path from "node:path";
import { execFile } from "node:child_process";
import { cp, mkdir, readFile, readdir } from "node:fs/promises";
import type { Command } from "commander";
import { createSidecarStore } from "./sidecar-store.js";
import {
  applyAgentSkillsByMode,
  asRecord,
  ensureCommandPermission,
  formatOutput,
  pathExists,
  readActorAgentId,
  readActorProjectId,
  readActorTeamId,
  renderShellExports,
  renderShellUnsets,
  resolveCliActorContext,
  resolveOpenclawStateRoot,
  resolveSkillSourceDirectory,
  resolveWorkspaceSkillsRoot,
  resolveTeamIdForAgent,
  roleLabel,
  type ShellName,
  tryResolveWorkspaceFromOpenclawConfig,
  type CompanyAgentModel,
  type CompanyModel,
} from "./team-commands/_shared.js";
import { tryLogCliActivity } from "./team-commands/_convex.js";

type SkillMode = "replace_minimum" | "append_only";

function parseSkillMode(raw: string): SkillMode {
  if (raw === "replace_minimum" || raw === "append_only") return raw;
  throw new Error(`invalid_mode:${raw}`);
}

function parseShellName(raw: string | undefined): ShellName {
  if (!raw || raw === "bash" || raw === "zsh" || raw === "fish") return (raw ?? "bash") as ShellName;
  throw new Error(`invalid_shell:${raw}`);
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

type AgentRosterRow = {
  agentId: string;
  role?: string;
  heartbeatProfileId?: string;
  teamId: string | null;
  teamName: string | null;
  projectId: string | null;
  workspacePath: string | null;
  openclawFound: boolean;
  openclawName: string | null;
};

type OpenclawRunResult = {
  stdout: string;
  stderr: string;
};

function buildAgentRoster(company: CompanyModel, openclawConfig: Record<string, unknown>): AgentRosterRow[] {
  const openclawAgentsNode = asRecord(openclawConfig.agents);
  const openclawList = Array.isArray(openclawAgentsNode.list)
    ? openclawAgentsNode.list.map((entry) => asRecord(entry))
    : [];
  const openclawById = new Map<string, Record<string, unknown>>();
  for (const entry of openclawList) {
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    if (id) openclawById.set(id, entry);
  }

  const allAgentIds = new Set<string>([
    ...company.agents.map((entry) => entry.agentId),
    ...openclawList
      .map((entry) => (typeof entry.id === "string" ? entry.id.trim() : ""))
      .filter((entry) => entry.length > 0),
  ]);

  return [...allAgentIds]
    .map((agentId) => {
      const companyRow = company.agents.find((entry) => entry.agentId === agentId);
      const openclawRow = openclawById.get(agentId);
      const projectId = companyRow?.projectId?.trim() || null;
      const project = projectId
        ? company.projects.find((entry) => entry.id === projectId) ?? null
        : null;
      const teamId = companyRow?.projectId ? resolveTeamIdForAgent(company, agentId) : null;
      const workspacePath = openclawRow
        ? tryResolveWorkspaceFromOpenclawConfig(openclawConfig, resolveOpenclawStateRoot(), agentId)
        : null;
      return {
        agentId,
        role: companyRow?.role,
        heartbeatProfileId: companyRow?.heartbeatProfileId,
        teamId,
        teamName: project?.name ?? null,
        projectId,
        workspacePath,
        openclawFound: Boolean(openclawRow),
        openclawName:
          typeof openclawRow?.name === "string" && openclawRow.name.trim()
            ? openclawRow.name.trim()
            : null,
      } satisfies AgentRosterRow;
    })
    .sort((left, right) => left.agentId.localeCompare(right.agentId));
}

function parseOpenclawJsonOutput(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

async function runOpenclawAgentCommand(args: string[]): Promise<OpenclawRunResult> {
  return await new Promise<OpenclawRunResult>((resolve, reject) => {
    execFile("openclaw", args, { encoding: "utf-8" }, (error, stdout, stderr) => {
      if (error) {
        const stderrText = typeof stderr === "string" ? stderr.trim() : "";
        const stdoutText = typeof stdout === "string" ? stdout.trim() : "";
        reject(
          new Error(
            stderrText || stdoutText || (error instanceof Error ? error.message : "openclaw_failed"),
          ),
        );
        return;
      }
      resolve({
        stdout: typeof stdout === "string" ? stdout : "",
        stderr: typeof stderr === "string" ? stderr : "",
      });
    });
  });
}

export function registerAgentCommands(program: Command): void {
  const store = createSidecarStore();
  const agent = program.command("agent").description("Inspect and edit agent configuration");
  const config = agent.command("config").description("Manage agent config");

  agent
    .command("login")
    .requiredOption("--agent-id <agentId>", "Agent id")
    .option("--shell <shell>", "bash|zsh|fish", "bash")
    .option("--json", "Output JSON", false)
    .action(async (opts: { agentId: string; shell?: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const shell = parseShellName(opts.shell);
      const company = await store.readCompanyModel();
      const actor = resolveCliActorContext({ company, explicitAgentId: opts.agentId });
      if (!actor.agentId || !actor.teamId || !actor.projectId) {
        throw new Error(`agent_missing_project:${opts.agentId}`);
      }
      const exports = [
        ["SHELLCORP_AGENT_ID", actor.agentId],
        ["SHELLCORP_TEAM_ID", actor.teamId],
        ["SHELLCORP_PROJECT_ID", actor.projectId],
        ["SHELLCORP_ACTOR_ROLE", actor.actorRole],
      ] as Array<[string, string]>;
      formatOutput(
        opts.json ? "json" : "text",
        {
          ok: true,
          shell,
          actor,
          exports: Object.fromEntries(exports),
          shellScript: renderShellExports(exports, shell),
        },
        renderShellExports(exports, shell),
      );
    });

  agent
    .command("logout")
    .option("--shell <shell>", "bash|zsh|fish", "bash")
    .option("--json", "Output JSON", false)
    .action(async (opts: { shell?: string; json?: boolean }) => {
      const shell = parseShellName(opts.shell);
      const keys = [
        "SHELLCORP_AGENT_ID",
        "SHELLCORP_ACTOR_AGENT_ID",
        "SHELLCORP_TEAM_ID",
        "SHELLCORP_PROJECT_ID",
        "SHELLCORP_ACTOR_ROLE",
      ];
      formatOutput(
        opts.json ? "json" : "text",
        {
          ok: true,
          shell,
          unset: keys,
          shellScript: renderShellUnsets(keys, shell),
        },
        renderShellUnsets(keys, shell),
      );
    });

  program
    .command("whoami")
    .description("Show the resolved ShellCorp caller context for this shell session")
    .option("--json", "Output JSON", false)
    .action(async (opts: { json?: boolean }) => {
      const company = await store.readCompanyModel();
      const actor = resolveCliActorContext({
        company,
        explicitAgentId: readActorAgentId(),
        explicitTeamId: readActorTeamId(),
        allowOperator: true,
      });
      formatOutput(
        opts.json ? "json" : "text",
        {
          ok: true,
          actor,
          env: {
            SHELLCORP_AGENT_ID: readActorAgentId() ?? null,
            SHELLCORP_TEAM_ID: readActorTeamId() ?? null,
            SHELLCORP_PROJECT_ID: readActorProjectId() ?? null,
            SHELLCORP_ACTOR_ROLE: process.env.SHELLCORP_ACTOR_ROLE?.trim() || null,
          },
        },
        actor.agentId
          ? `${actor.agentId} | role=${actor.actorRole} | team=${actor.teamId ?? "none"}`
          : `operator | role=${actor.actorRole} | team=${actor.teamId ?? "none"}`,
      );
    });

  agent
    .command("list")
    .option("--team-id <teamId>", "Filter to one team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId?: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const openclawConfig = await store.readOpenclawConfig();
      const rows = buildAgentRoster(company, openclawConfig).filter((entry) =>
        opts.teamId?.trim() ? entry.teamId === opts.teamId.trim() : true,
      );
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, agents: rows },
        rows.length === 0
          ? "No agents found."
          : rows
              .map(
                (entry) =>
                  `${entry.agentId} | role=${entry.role ?? "unknown"} | team=${entry.teamId ?? "none"} | runtime=${entry.openclawFound ? "present" : "missing"}`,
              )
              .join("\n"),
      );
    });

  agent
    .command("search")
    .requiredOption("--query <query>", "Query text")
    .option("--team-id <teamId>", "Filter to one team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { query: string; teamId?: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const openclawConfig = await store.readOpenclawConfig();
      const query = opts.query.trim().toLowerCase();
      if (!query) throw new Error("missing_query");
      const rows = buildAgentRoster(company, openclawConfig)
        .filter((entry) => (opts.teamId?.trim() ? entry.teamId === opts.teamId.trim() : true))
        .filter((entry) =>
          [
            entry.agentId,
            entry.role ?? "",
            entry.teamId ?? "",
            entry.teamName ?? "",
            entry.openclawName ?? "",
          ].some((value) => value.toLowerCase().includes(query)),
        );
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, query: opts.query.trim(), agents: rows },
        rows.length === 0
          ? `No agents matched "${opts.query.trim()}".`
          : rows
              .map(
                (entry) =>
                  `${entry.agentId} | role=${entry.role ?? "unknown"} | team=${entry.teamId ?? "none"} | runtime=${entry.openclawFound ? "present" : "missing"}`,
              )
              .join("\n"),
      );
    });

  agent
    .command("send")
    .requiredOption("--to <agentId>", "Destination agent id")
    .requiredOption("--message <text>", "Message text")
    .option("--from <agentId>", "Sender agent id override")
    .option("--team-id <teamId>", "Team id for timeline logging")
    .option("--task-id <taskId>", "Optional task context for the coordination event")
    .option("--session-id <sessionId>", "Optional OpenClaw session id override")
    .option("--deliver", "Ask OpenClaw to deliver the reply to a channel", false)
    .option("--channel <channel>", "Delivery channel")
    .option("--reply-to <target>", "Reply target override")
    .option("--reply-channel <channel>", "Reply channel override")
    .option("--reply-account <accountId>", "Reply account override")
    .option("--thinking <mode>", "off|minimal|low|medium|high|xhigh")
    .option("--verbose <mode>", "on|full|off")
    .option("--timeout <seconds>", "Timeout in seconds")
    .option("--local", "Run locally instead of through the gateway", false)
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        to: string;
        message: string;
        from?: string;
        teamId?: string;
        taskId?: string;
        sessionId?: string;
        deliver?: boolean;
        channel?: string;
        replyTo?: string;
        replyChannel?: string;
        replyAccount?: string;
        thinking?: string;
        verbose?: string;
        timeout?: string;
        local?: boolean;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.activity.write");
        const company = await store.readCompanyModel();
        const openclawConfig = await store.readOpenclawConfig();
        const roster = buildAgentRoster(company, openclawConfig);
        const actor = resolveCliActorContext({
          company,
          explicitAgentId: opts.from,
          explicitTeamId: opts.teamId,
        });
        const senderAgentId = actor.agentId;
        if (!senderAgentId) throw new Error("missing_agent_identity:use_shellcorp_agent_login_or_--from");
        const sender = roster.find((entry) => entry.agentId === senderAgentId);
        const recipient = roster.find((entry) => entry.agentId === opts.to.trim());
        if (!recipient) throw new Error(`agent_not_found:${opts.to}`);
        if (!recipient.openclawFound) throw new Error(`agent_runtime_missing:${opts.to}`);
        if (!sender) throw new Error(`agent_not_found:${senderAgentId}`);
        const resolvedTeamId = actor.teamId || sender.teamId || recipient.teamId;
        if (!resolvedTeamId) throw new Error("missing_team_id:use_--team-id_for_coordination_logging");
        const project = company.projects.find((entry) => `team-${entry.id}` === resolvedTeamId);
        if (!project) throw new Error(`team_not_found:${resolvedTeamId}`);

        const openclawArgs = ["agent"];
        if (opts.local) openclawArgs.push("--local");
        if (opts.sessionId?.trim()) {
          openclawArgs.push("--session-id", opts.sessionId.trim());
        } else {
          openclawArgs.push("--agent", recipient.agentId);
        }
        openclawArgs.push("--message", opts.message.trim());
        if (opts.deliver) openclawArgs.push("--deliver");
        if (opts.channel?.trim()) openclawArgs.push("--channel", opts.channel.trim());
        if (opts.replyTo?.trim()) openclawArgs.push("--reply-to", opts.replyTo.trim());
        if (opts.replyChannel?.trim()) openclawArgs.push("--reply-channel", opts.replyChannel.trim());
        if (opts.replyAccount?.trim()) openclawArgs.push("--reply-account", opts.replyAccount.trim());
        if (opts.thinking?.trim()) openclawArgs.push("--thinking", opts.thinking.trim());
        if (opts.verbose?.trim()) openclawArgs.push("--verbose", opts.verbose.trim());
        if (opts.timeout?.trim()) openclawArgs.push("--timeout", opts.timeout.trim());
        if (opts.json) openclawArgs.push("--json");

        const result = await runOpenclawAgentCommand(openclawArgs);
        await tryLogCliActivity({
          projectId: project.id,
          teamId: resolvedTeamId,
          actorAgentId: sender.agentId,
          activityType: "handoff",
          label: `Coordination to ${recipient.agentId}`,
          detail: opts.taskId?.trim()
            ? `${opts.message.trim()} (task ${opts.taskId.trim()})`
            : opts.message.trim(),
          source: "agent_coordination",
        });

        const parsedOutput = opts.json ? parseOpenclawJsonOutput(result.stdout) : undefined;
        const replyPreview = result.stdout.trim().split("\n").find((line) => line.trim().length > 0) ?? "";
        formatOutput(
          opts.json ? "json" : "text",
          {
            ok: true,
            fromAgentId: sender.agentId,
            toAgentId: recipient.agentId,
            teamId: resolvedTeamId,
            projectId: project.id,
            taskId: opts.taskId?.trim() || undefined,
            openclaw: {
              args: openclawArgs,
              stdout: result.stdout,
              stderr: result.stderr,
              parsed: parsedOutput,
            },
          },
          replyPreview || `Sent coordination from ${sender.agentId} to ${recipient.agentId}`,
        );
      },
    );

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
