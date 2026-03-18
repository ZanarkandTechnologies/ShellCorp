/**
 * TEAM COMMANDS — INDEX
 * ======================
 * Purpose
 * - Composes all team-command domain registrars into the two public exports consumed by shellcorp-cli.
 * - Creates the sidecar store once and passes it to each sub-registrar.
 *
 * KEY CONCEPTS:
 * - registerTeamCommands and registerDoctorCommands signatures are unchanged from the original file.
 * - Store is created once per register call, not per sub-module.
 *
 * MEMORY REFERENCES:
 * - MEM-0104
 * - MEM-0212
 */
import { Command } from "commander";
import { createSidecarStore } from "../sidecar-store.js";
import {
  appendTeamEventLog,
  ensureCommandPermission,
  resolveCliActorContext,
  resolveProjectOrFail,
  resolveStatusActivityType,
  runDoctor,
  optionalBeatId,
  formatOutput,
  fail,
} from "./_shared.js";
import { postBoardCommand } from "./_convex.js";
import { registerTeamCore } from "./team-core.js";
import { registerTeamBusiness } from "./team-business.js";
import { registerTeamResources } from "./team-resources.js";
import { registerTeamFunds } from "./team-funds.js";
import { registerTeamBoard } from "./team-board.js";
import { registerTeamHeartbeat } from "./team-heartbeat.js";
import { registerTeamPreset } from "./team-preset.js";
import { registerTeamConfig } from "./team-config.js";
import { registerTeamRun } from "./team-run.js";

export function registerTeamCommands(program: Command): void {
  const store = createSidecarStore();

  // Top-level `shellcorp status` command (shorthand for activity_log on the active team).
  program
    .command("status")
    .description("Report agent status with auto-resolved team/agent context")
    .argument("<statusText>", "Operator-readable status text")
    .option(
      "--state <state>",
      "planning|research|executing|distributing|blocked|handoff|summary|status (legacy values supported)",
      "status",
    )
    .option("--agent-id <agentId>", "Optional agent id override")
    .option("--team-id <teamId>", "Optional team id override (team-*)")
    .option("--label <label>", "Optional activity label override")
    .option("--task-id <taskId>", "Optional task id context")
    .option("--skill-id <skillId>", "Optional skill id context")
    .option("--step-key <stepKey>", "Optional idempotency key")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (
        statusText: string,
        opts: {
          state: string;
          agentId?: string;
          teamId?: string;
          label?: string;
          taskId?: string;
          skillId?: string;
          stepKey?: string;
          beatId?: string;
          json?: boolean;
        },
      ) => {
        ensureCommandPermission("team.activity.write");
        const company = await store.readCompanyModel();
        const detail = statusText.trim();
        if (!detail) fail("invalid_status_text");

        const actor = resolveCliActorContext({
          company,
          explicitAgentId: opts.agentId,
          explicitTeamId: opts.teamId,
        });
        if (!actor.agentId || !actor.teamId || !actor.projectId) {
          fail("missing_agent_identity:use_shellcorp_agent_login_or_--agent-id");
        }
        const activityType = resolveStatusActivityType(opts.state.trim());
        const label =
          opts.label?.trim() ||
          (activityType === "planning" || activityType === "executing" || activityType === "blocked"
            ? activityType
            : "status");
        const stepKey = opts.stepKey?.trim() || `status-${actor.agentId}-${Date.now()}`;

        const result = await postBoardCommand({
          teamId: actor.teamId,
          projectId: actor.projectId,
          command: "activity_log",
          actorType: "agent",
          actorAgentId: actor.agentId,
          activityType,
          label,
          detail,
          taskId: opts.taskId?.trim() || undefined,
          skillId: opts.skillId?.trim() || undefined,
          stepKey,
          beatId: optionalBeatId(opts.beatId),
        });
        await appendTeamEventLog({
          teamId: actor.teamId,
          projectId: actor.projectId,
          kind: "status_reported",
          agentId: actor.agentId,
          label,
          detail,
          data: {
            activityType,
            stepKey,
            taskId: opts.taskId?.trim() || undefined,
            skillId: opts.skillId?.trim() || undefined,
          },
        });
        formatOutput(
          opts.json ? "json" : "text",
          {
            ok: true,
            teamId: actor.teamId,
            projectId: actor.projectId,
            agentId: actor.agentId,
            activityType,
            label,
            statusText: detail,
            stepKey,
            result,
          },
          `Reported status for ${actor.agentId} (${activityType})`,
        );
      },
    );

  const team = program
    .command("team")
    .description("Manage team entities mapped to company projects");

  registerTeamCore(team, store);
  registerTeamBusiness(team, store);
  registerTeamResources(team, store);
  registerTeamFunds(team, store);
  registerTeamBoard(team, store);
  registerTeamHeartbeat(team, store);
  registerTeamPreset(team, store);
  registerTeamConfig(team, store);
  registerTeamRun(team, store);
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
