/**
 * TEAM RUN COMMANDS
 * =================
 * Purpose
 * - Provide a fast test-mode surface for heartbeat-driven teams.
 *
 * KEY CONCEPTS:
 * - MVP run/test does not need a second runtime; it needs a faster way to adjust cadence and inspect the current heartbeat plan.
 * - Test mode is just a focused wrapper around team heartbeat config.
 *
 * USAGE:
 * - shellcorp team run show --team-id team-proj-alpha --json
 * - shellcorp team run live --team-id team-proj-alpha --cadence-minutes 1
 * - shellcorp team run test-mode --team-id team-proj-alpha --cadence-minutes 1
 *
 * MEMORY REFERENCES:
 * - MEM-0196
 * - MEM-0200
 * - MEM-0215
 */
import type { Command } from "commander";
import { ensureOpenclawHeartbeatScaffold } from "./_convex.js";
import { buildTeamSnapshot } from "./team-config.js";
import {
  ensureCommandPermission,
  ensureHeartbeatProfile,
  formatOutput,
  projectIdFromTeamId,
  resolveProjectOrFail,
  type SidecarStore,
} from "./_shared.js";

export function registerTeamRun(team: Command, store: SidecarStore): void {
  const run = team.command("run").description("Run/test helpers for heartbeat-driven teams");

  run
    .command("show")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const payload = await buildTeamSnapshot(store, opts.teamId.trim());
      formatOutput(
        opts.json ? "json" : "text",
        payload,
        `${opts.teamId} | agents=${(payload.agents as unknown[]).length} | heartbeatProfiles=${(
          payload.heartbeatProfiles as unknown[]
        ).length}`,
      );
    });

  run
    .command("live")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--cadence-minutes <minutes>", "Heartbeat cadence in minutes", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`invalid_cadence_minutes:${value}`);
      return parsed;
    })
    .option("--goal <goal>", "Optional live-mode goal override")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: { teamId: string; cadenceMinutes: number; goal?: string; json?: boolean }) => {
        ensureCommandPermission("team.heartbeat.write");
        const company = await store.readCompanyModel();
        const projectId = projectIdFromTeamId(opts.teamId.trim());
        const { project } = resolveProjectOrFail(company, opts.teamId.trim());
        const { company: withProfile, profileId } = ensureHeartbeatProfile(company, projectId);
        const nextGoal = opts.goal?.trim() || project.goal;
        const nextProfiles = withProfile.heartbeatProfiles.map((profile) =>
          profile.id === profileId
            ? {
                ...profile,
                cadenceMinutes: opts.cadenceMinutes,
                goal: nextGoal,
                teamDescription: profile.teamDescription || project.name,
              }
            : profile,
        );
        const nextAgents = withProfile.agents.map((agent) =>
          agent.projectId === projectId ? { ...agent, heartbeatProfileId: profileId } : agent,
        );
        const teamAgents = nextAgents.filter((agent) => agent.projectId === projectId);
        await store.writeCompanyModel({
          ...withProfile,
          heartbeatProfiles: nextProfiles,
          agents: nextAgents,
        });
        const updatedOpenclawAgents = await ensureOpenclawHeartbeatScaffold({
          store,
          agentIds: teamAgents.map((agent) => agent.agentId),
          cadenceMinutes: opts.cadenceMinutes,
        });
        const snapshot = await buildTeamSnapshot(store, opts.teamId.trim());
        formatOutput(
          opts.json ? "json" : "text",
          {
            ok: true,
            teamId: opts.teamId,
            projectId,
            heartbeatProfileId: profileId,
            cadenceMinutes: opts.cadenceMinutes,
            goal: nextGoal,
            updatedOpenclawAgents,
            runtime: snapshot.runtime,
            notes: [
              "Leave the OpenClaw gateway running so the real team heartbeats execute on the new cadence.",
              "Restart the gateway if your runtime does not hot-reload openclaw.json changes immediately.",
              "Use `team monitor` and `agent monitor` to inspect the live team state and workspace paths.",
            ],
          },
          `Enabled live mode for ${opts.teamId} at ${opts.cadenceMinutes}m cadence`,
        );
      },
    );

  run
    .command("test-mode")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--cadence-minutes <minutes>", "Heartbeat cadence in minutes", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`invalid_cadence_minutes:${value}`);
      return parsed;
    })
    .option("--goal <goal>", "Optional test-mode goal override")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: { teamId: string; cadenceMinutes: number; goal?: string; json?: boolean }) => {
        ensureCommandPermission("team.heartbeat.write");
        const company = await store.readCompanyModel();
        const projectId = projectIdFromTeamId(opts.teamId.trim());
        const { project } = resolveProjectOrFail(company, opts.teamId.trim());
        const { company: withProfile, profileId } = ensureHeartbeatProfile(company, projectId);
        const nextGoal =
          opts.goal?.trim() ||
          withProfile.heartbeatProfiles.find((profile) => profile.id === profileId)?.goal ||
          project.goal;
        const nextProfiles = withProfile.heartbeatProfiles.map((profile) =>
          profile.id === profileId
            ? {
                ...profile,
                cadenceMinutes: opts.cadenceMinutes,
                goal: nextGoal,
                teamDescription: profile.teamDescription || project.name,
              }
            : profile,
        );
        const nextAgents = withProfile.agents.map((agent) =>
          agent.projectId === projectId ? { ...agent, heartbeatProfileId: profileId } : agent,
        );
        const teamAgents = nextAgents.filter((agent) => agent.projectId === projectId);
        await store.writeCompanyModel({
          ...withProfile,
          heartbeatProfiles: nextProfiles,
          agents: nextAgents,
        });
        const updatedOpenclawAgents = await ensureOpenclawHeartbeatScaffold({
          store,
          agentIds: teamAgents.map((agent) => agent.agentId),
          cadenceMinutes: opts.cadenceMinutes,
        });
        formatOutput(
          opts.json ? "json" : "text",
          {
            ok: true,
            teamId: opts.teamId,
            projectId,
            heartbeatProfileId: profileId,
            cadenceMinutes: opts.cadenceMinutes,
            goal: nextGoal,
            updatedOpenclawAgents,
            notes: [
              "Leave the OpenClaw gateway running so the new test cadence takes effect.",
              "Restart OpenClaw gateway if you need runtime heartbeat config to refresh immediately.",
            ],
          },
          `Enabled test mode for ${opts.teamId} at ${opts.cadenceMinutes}m cadence`,
        );
      },
    );
}
