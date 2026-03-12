/**
 * TEAM HEARTBEAT COMMANDS
 * ========================
 * Purpose
 * - Heartbeat profile management: render, set, sync (with watch mode), bootstrap.
 */
import path from "node:path";
import { watch } from "node:fs";
import { Command } from "commander";
import {
  type SidecarStore,
  ensureCommandPermission,
  resolveProjectOrFail,
  projectIdFromTeamId,
  ensureHeartbeatProfile,
  formatOutput,
  fail,
} from "./_shared.js";
import {
  renderBusinessHeartbeatTemplate,
  syncTeamHeartbeatFiles,
  writeTeamHeartbeatFiles,
  ensureOpenclawHeartbeatScaffold,
} from "./_convex.js";

export function registerTeamHeartbeat(team: Command, store: SidecarStore): void {
  const heartbeat = team.command("heartbeat").description("Manage team heartbeat profile");

  heartbeat
    .command("render")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--role <role>", "Role: biz_pm|biz_executor")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; role: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      if (opts.role !== "biz_pm" && opts.role !== "biz_executor") fail(`invalid_role:${opts.role}`);
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const rendered = await renderBusinessHeartbeatTemplate({ role: opts.role, project });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, role: opts.role, rendered },
        rendered,
      );
    });

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
        ensureCommandPermission("team.heartbeat.write");
        const company = await store.readCompanyModel();
        const projectId = projectIdFromTeamId(opts.teamId);
        if (!company.projects.some((entry) => entry.id === projectId))
          fail(`team_not_found:${opts.teamId}`);
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
            ? { ...agent, heartbeatProfileId: withProfile.profileId }
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

  heartbeat
    .command("sync")
    .description("Hot-swap HEARTBEAT.md files from workspace templates")
    .option("--team-id <teamId>", "Optional team id (team-*). Defaults to all teams.")
    .option("--watch", "Watch template files and re-sync on changes", false)
    .option("--json", "Output JSON (non-watch mode only)", false)
    .action(async (opts: { teamId?: string; watch?: boolean; json?: boolean }) => {
      ensureCommandPermission("team.heartbeat.write");
      if (opts.watch && opts.json) {
        fail("invalid_options:--watch cannot be used with --json");
      }
      const runSync = async (): Promise<{
        teamsTouched: number;
        heartbeatFilesWritten: number;
        teamsSkipped: number;
      }> => {
        return syncTeamHeartbeatFiles({ store, teamId: opts.teamId?.trim() || undefined });
      };
      const firstResult = await runSync();
      if (!opts.watch) {
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, mode: "oneshot", teamId: opts.teamId?.trim() || null, ...firstResult },
          `Heartbeat sync completed (${firstResult.heartbeatFilesWritten} file(s) across ${firstResult.teamsTouched} team(s))`,
        );
        return;
      }

      const templatesDir = path.resolve(process.cwd(), "templates", "workspace");
      console.log(
        `Heartbeat watch active in ${templatesDir}. Initial sync wrote ${firstResult.heartbeatFilesWritten} file(s) across ${firstResult.teamsTouched} team(s).`,
      );
      let syncInFlight = false;
      let syncQueued = false;
      const triggerSync = async (reason: string): Promise<void> => {
        if (syncInFlight) {
          syncQueued = true;
          return;
        }
        syncInFlight = true;
        try {
          let nextReason = reason;
          do {
            syncQueued = false;
            const result = await runSync();
            console.log(
              `Heartbeat sync (${nextReason}) wrote ${result.heartbeatFilesWritten} file(s) across ${result.teamsTouched} team(s)`,
            );
            nextReason = "queued-change";
          } while (syncQueued);
        } catch (error) {
          fail(`heartbeat_sync_failed:${error instanceof Error ? error.message : String(error)}`);
        } finally {
          syncInFlight = false;
        }
      };

      const watcher = watch(templatesDir, { persistent: true }, (eventType, filename) => {
        if (!filename) return;
        const file = filename.toString();
        if (!/^HEARTBEAT-biz-(pm|executor)\.md$/.test(file)) return;
        void triggerSync(`${eventType}:${file}`);
      });

      const shutdown = (): void => {
        watcher.close();
        console.log("Heartbeat watch stopped.");
        process.exit(0);
      };
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
      await new Promise<void>(() => {});
    });

  heartbeat
    .command("bootstrap")
    .description("Write layered HEARTBEAT.md files and scaffold OpenClaw heartbeat config")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      ensureCommandPermission("team.heartbeat.write");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const teamAgents = company.agents.filter((agent) => agent.projectId === projectId);
      if (teamAgents.length === 0) {
        fail(`team_has_no_agents:${opts.teamId}`);
      }
      const written = await writeTeamHeartbeatFiles({ store, project, agents: teamAgents });
      const configUpdatedAgents = await ensureOpenclawHeartbeatScaffold({
        store,
        agentIds: teamAgents.map((agent) => agent.agentId),
      });
      formatOutput(
        opts.json ? "json" : "text",
        {
          ok: true,
          teamId: opts.teamId,
          projectId,
          writtenHeartbeatFiles: written,
          updatedOpenclawAgents: configUpdatedAgents,
          notes: [
            "Restart OpenClaw gateway after bootstrap to apply config.",
            "Heartbeats now use layered context protocol and status-first reporting.",
          ],
        },
        `Heartbeat bootstrap completed for ${opts.teamId} (${written} workspace file(s), ${configUpdatedAgents} config agent(s))`,
      );
    });
}
