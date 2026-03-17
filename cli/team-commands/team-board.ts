/**
 * TEAM BOARD COMMANDS
 * ====================
 * Purpose
 * - Board task lifecycle: add, move, update, delete, assign, block, done, reopen, reprioritize, list.
 * - Team status reporting (explicit status writes to Convex).
 * - Bot activity log / timeline / next-task queries.
 *
 * MEMORY REFERENCES:
 * - MEM-0202
 */
import { Command } from "commander";
import {
  appendTeamEventLog,
  type SidecarStore,
  ensureCommandPermission,
  resolveProjectOrFail,
  parseBoardTaskStatus,
  parseBoardTaskPriority,
  parseBoardActivityType,
  parseStatusReportState,
  optionalBeatId,
  formatOutput,
  fail,
} from "./_shared.js";
import { postBoardCommand, postBoardQuery, postStatusReport } from "./_convex.js";

async function writeBoardEvent(input: {
  teamId: string;
  projectId: string;
  kind:
    | "task_added"
    | "task_moved"
    | "task_updated"
    | "task_deleted"
    | "task_assigned"
    | "task_blocked"
    | "task_done"
    | "task_reopened"
    | "task_reprioritized"
    | "status_reported"
    | "activity_logged";
  agentId?: string;
  taskId?: string;
  label?: string;
  detail?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  await appendTeamEventLog(input);
}

export function registerTeamBoard(team: Command, store: SidecarStore): void {
  const board = team.command("board").description("Manage Convex-backed team board tasks");
  const boardTask = board.command("task").description("Task lifecycle commands");

  boardTask
    .command("add")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--title <title>", "Task title")
    .option("--task-id <taskId>", "Task id override")
    .option("--owner-agent-id <agentId>", "Assigned agent id")
    .option("--priority <priority>", "low|medium|high", "medium")
    .option("--status <status>", "todo|in_progress|blocked|done", "todo")
    .option("--task-type <taskType>", "Optional workflow type metadata")
    .option("--approval-state <state>", "Optional approval state metadata")
    .option("--linked-session-key <sessionKey>", "Optional linked session key")
    .option("--created-team-id <teamId>", "Optional created team id metadata")
    .option("--created-project-id <projectId>", "Optional created project id metadata")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--detail <detail>", "Optional detail")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        title: string;
        taskId?: string;
        ownerAgentId?: string;
        priority: string;
        status: string;
        taskType?: string;
        approvalState?: string;
        linkedSessionKey?: string;
        createdTeamId?: string;
        createdProjectId?: string;
        actorAgentId: string;
        beatId?: string;
        detail?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.board.write");
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const result = await postBoardCommand({
          projectId,
          command: "task_add",
          taskId: opts.taskId?.trim() || undefined,
          title: opts.title.trim(),
          ownerAgentId: opts.ownerAgentId?.trim() || undefined,
          priority: parseBoardTaskPriority(opts.priority),
          status: parseBoardTaskStatus(opts.status),
          taskType: opts.taskType?.trim() || undefined,
          approvalState: opts.approvalState?.trim() || undefined,
          linkedSessionKey: opts.linkedSessionKey?.trim() || undefined,
          createdTeamId: opts.createdTeamId?.trim() || undefined,
          createdProjectId: opts.createdProjectId?.trim() || undefined,
          actorType: "operator",
          actorAgentId: opts.actorAgentId.trim(),
          beatId: optionalBeatId(opts.beatId),
          detail: opts.detail?.trim() || undefined,
        });
        await writeBoardEvent({
          teamId: opts.teamId,
          projectId,
          kind: "task_added",
          agentId: opts.actorAgentId.trim(),
          taskId: (result.taskId as string | undefined) ?? opts.taskId?.trim(),
          label: opts.title.trim(),
          detail: opts.detail?.trim() || undefined,
          data: {
            ownerAgentId: opts.ownerAgentId?.trim() || undefined,
            priority: parseBoardTaskPriority(opts.priority),
            status: parseBoardTaskStatus(opts.status),
          },
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, result },
          `Added task ${(result.taskId as string | undefined) ?? "unknown"} for ${opts.teamId}`,
        );
      },
    );

  boardTask
    .command("move")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .requiredOption("--status <status>", "todo|in_progress|blocked|done")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--detail <detail>", "Optional detail")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        taskId: string;
        status: string;
        actorAgentId: string;
        beatId?: string;
        detail?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.board.write");
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const result = await postBoardCommand({
          projectId,
          command: "task_move",
          taskId: opts.taskId.trim(),
          status: parseBoardTaskStatus(opts.status),
          actorType: "operator",
          actorAgentId: opts.actorAgentId.trim(),
          beatId: optionalBeatId(opts.beatId),
          detail: opts.detail?.trim() || undefined,
        });
        await writeBoardEvent({
          teamId: opts.teamId,
          projectId,
          kind: "task_moved",
          agentId: opts.actorAgentId.trim(),
          taskId: opts.taskId.trim(),
          detail: opts.detail?.trim() || undefined,
          data: { status: parseBoardTaskStatus(opts.status) },
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, result },
          `Moved task ${opts.taskId} to ${opts.status}`,
        );
      },
    );

  boardTask
    .command("update")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .option("--title <title>", "Updated task title")
    .option("--detail <detail>", "Updated task detail/notes")
    .option("--task-type <taskType>", "Updated workflow type metadata")
    .option("--approval-state <state>", "Updated approval state metadata")
    .option("--linked-session-key <sessionKey>", "Updated linked session key metadata")
    .option("--created-team-id <teamId>", "Updated created team id metadata")
    .option("--created-project-id <projectId>", "Updated created project id metadata")
    .option("--due-at <timestamp>", "Due timestamp (ms epoch)", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) fail(`invalid_due_at:${value}`);
      return parsed;
    })
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        taskId: string;
        title?: string;
        detail?: string;
        taskType?: string;
        approvalState?: string;
        linkedSessionKey?: string;
        createdTeamId?: string;
        createdProjectId?: string;
        dueAt?: number;
        actorAgentId: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.board.write");
        if (
          !opts.title?.trim() &&
          !opts.detail?.trim() &&
          !opts.taskType?.trim() &&
          !opts.approvalState?.trim() &&
          !opts.linkedSessionKey?.trim() &&
          !opts.createdTeamId?.trim() &&
          !opts.createdProjectId?.trim() &&
          typeof opts.dueAt !== "number"
        ) {
          fail(
            "task_update_requires_change:title|detail|task-type|approval-state|linked-session-key|created-team-id|created-project-id|due-at",
          );
        }
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const result = await postBoardCommand({
          projectId,
          command: "task_update",
          taskId: opts.taskId.trim(),
          title: opts.title?.trim() || undefined,
          detail: opts.detail?.trim() || undefined,
          taskType: opts.taskType?.trim() || undefined,
          approvalState: opts.approvalState?.trim() || undefined,
          linkedSessionKey: opts.linkedSessionKey?.trim() || undefined,
          createdTeamId: opts.createdTeamId?.trim() || undefined,
          createdProjectId: opts.createdProjectId?.trim() || undefined,
          dueAt: opts.dueAt,
          actorType: "operator",
          actorAgentId: opts.actorAgentId.trim(),
          beatId: optionalBeatId(opts.beatId),
        });
        await writeBoardEvent({
          teamId: opts.teamId,
          projectId,
          kind: "task_updated",
          agentId: opts.actorAgentId.trim(),
          taskId: opts.taskId.trim(),
          detail: opts.detail?.trim() || undefined,
          data: {
            title: opts.title?.trim() || undefined,
            taskType: opts.taskType?.trim() || undefined,
            approvalState: opts.approvalState?.trim() || undefined,
            linkedSessionKey: opts.linkedSessionKey?.trim() || undefined,
            createdTeamId: opts.createdTeamId?.trim() || undefined,
            createdProjectId: opts.createdProjectId?.trim() || undefined,
            dueAt: opts.dueAt,
          },
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, result },
          `Updated task ${opts.taskId}`,
        );
      },
    );

  boardTask
    .command("delete")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        taskId: string;
        actorAgentId: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.board.write");
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const result = await postBoardCommand({
          projectId,
          command: "task_delete",
          taskId: opts.taskId.trim(),
          actorType: "operator",
          actorAgentId: opts.actorAgentId.trim(),
          beatId: optionalBeatId(opts.beatId),
        });
        await writeBoardEvent({
          teamId: opts.teamId,
          projectId,
          kind: "task_deleted",
          agentId: opts.actorAgentId.trim(),
          taskId: opts.taskId.trim(),
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, result },
          `Deleted task ${opts.taskId}`,
        );
      },
    );

  boardTask
    .command("assign")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .requiredOption("--owner-agent-id <agentId>", "Owner agent id")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        taskId: string;
        ownerAgentId: string;
        actorAgentId: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.board.write");
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const result = await postBoardCommand({
          projectId,
          command: "task_assign",
          taskId: opts.taskId.trim(),
          ownerAgentId: opts.ownerAgentId.trim(),
          actorType: "operator",
          actorAgentId: opts.actorAgentId.trim(),
          beatId: optionalBeatId(opts.beatId),
        });
        await writeBoardEvent({
          teamId: opts.teamId,
          projectId,
          kind: "task_assigned",
          agentId: opts.actorAgentId.trim(),
          taskId: opts.taskId.trim(),
          data: { ownerAgentId: opts.ownerAgentId.trim() },
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, result },
          `Assigned task ${opts.taskId} to ${opts.ownerAgentId}`,
        );
      },
    );

  boardTask
    .command("block")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .option("--reason <reason>", "Block reason")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        taskId: string;
        reason?: string;
        actorAgentId: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.board.write");
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const result = await postBoardCommand({
          projectId,
          command: "task_block",
          taskId: opts.taskId.trim(),
          actorType: "operator",
          actorAgentId: opts.actorAgentId.trim(),
          beatId: optionalBeatId(opts.beatId),
          detail: opts.reason?.trim() || undefined,
        });
        await writeBoardEvent({
          teamId: opts.teamId,
          projectId,
          kind: "task_blocked",
          agentId: opts.actorAgentId.trim(),
          taskId: opts.taskId.trim(),
          detail: opts.reason?.trim() || undefined,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, result },
          `Blocked task ${opts.taskId}`,
        );
      },
    );

  boardTask
    .command("done")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .option("--note <note>", "Completion note")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        taskId: string;
        note?: string;
        actorAgentId: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.board.write");
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const result = await postBoardCommand({
          projectId,
          command: "task_done",
          taskId: opts.taskId.trim(),
          actorType: "operator",
          actorAgentId: opts.actorAgentId.trim(),
          beatId: optionalBeatId(opts.beatId),
          detail: opts.note?.trim() || undefined,
        });
        await writeBoardEvent({
          teamId: opts.teamId,
          projectId,
          kind: "task_done",
          agentId: opts.actorAgentId.trim(),
          taskId: opts.taskId.trim(),
          detail: opts.note?.trim() || undefined,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, result },
          `Marked task ${opts.taskId} done`,
        );
      },
    );

  boardTask
    .command("reopen")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .option("--note <note>", "Reopen note")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        taskId: string;
        note?: string;
        actorAgentId: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.board.write");
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const result = await postBoardCommand({
          projectId,
          command: "task_reopen",
          taskId: opts.taskId.trim(),
          actorType: "operator",
          actorAgentId: opts.actorAgentId.trim(),
          beatId: optionalBeatId(opts.beatId),
          detail: opts.note?.trim() || undefined,
        });
        await writeBoardEvent({
          teamId: opts.teamId,
          projectId,
          kind: "task_reopened",
          agentId: opts.actorAgentId.trim(),
          taskId: opts.taskId.trim(),
          detail: opts.note?.trim() || undefined,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, result },
          `Reopened task ${opts.taskId}`,
        );
      },
    );

  boardTask
    .command("reprioritize")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .requiredOption("--priority <priority>", "low|medium|high")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        taskId: string;
        priority: string;
        actorAgentId: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.board.write");
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const result = await postBoardCommand({
          projectId,
          command: "task_reprioritize",
          taskId: opts.taskId.trim(),
          priority: parseBoardTaskPriority(opts.priority),
          actorType: "operator",
          actorAgentId: opts.actorAgentId.trim(),
          beatId: optionalBeatId(opts.beatId),
        });
        await writeBoardEvent({
          teamId: opts.teamId,
          projectId,
          kind: "task_reprioritized",
          agentId: opts.actorAgentId.trim(),
          taskId: opts.taskId.trim(),
          data: { priority: parseBoardTaskPriority(opts.priority) },
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, result },
          `Reprioritized task ${opts.taskId} to ${opts.priority}`,
        );
      },
    );

  boardTask
    .command("list")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--status <status>", "todo|in_progress|blocked|done")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; status?: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId);
      const data = await postBoardQuery({ projectId, query: "tasks" });
      const tasks = Array.isArray((data as { tasks?: unknown[] })?.tasks)
        ? ((data as { tasks: unknown[] }).tasks as unknown[])
        : [];
      const filtered =
        opts.status?.trim() && tasks.length > 0
          ? tasks.filter((entry) => {
              if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
              return (
                (entry as { status?: string }).status === parseBoardTaskStatus(opts.status!.trim())
              );
            })
          : tasks;
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, tasks: filtered },
        filtered.length === 0
          ? `${opts.teamId} has no board tasks`
          : filtered
              .map((row) => {
                const task = row as {
                  taskId?: string;
                  status?: string;
                  priority?: string;
                  title?: string;
                  ownerAgentId?: string;
                };
                return `${task.taskId ?? "unknown"} | ${task.status ?? "todo"} | ${task.priority ?? "medium"} | ${task.ownerAgentId ?? "unassigned"} | ${task.title ?? ""}`;
              })
              .join("\n"),
      );
    });

  // ─── Status report sub-commands ───────────────────────────────────────────

  const status = team.command("status").description("Manage explicit agent status reports");
  status
    .command("report")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--agent-id <agentId>", "Agent id")
    .requiredOption(
      "--state <state>",
      "running|ok|no_work|error|idle|planning|executing|blocked|done",
    )
    .requiredOption("--status-text <text>", "Current status detail")
    .option("--step-key <stepKey>", "Idempotency key")
    .option("--skill-id <skillId>", "Optional related skill id")
    .option("--session-key <sessionKey>", "Optional OpenClaw session key")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--source <source>", "Optional source label", "shellcorp_cli")
    .option("--occurred-at <epochMs>", "Optional occurred timestamp", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 0) fail(`invalid_occurred_at:${value}`);
      return parsed;
    })
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        agentId: string;
        state: string;
        statusText: string;
        stepKey?: string;
        skillId?: string;
        sessionKey?: string;
        beatId?: string;
        source?: string;
        occurredAt?: number;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.activity.write");
        const company = await store.readCompanyModel();
        resolveProjectOrFail(company, opts.teamId);
        const agentId = opts.agentId.trim();
        const state = parseStatusReportState(opts.state.trim());
        const statusText = opts.statusText.trim();
        if (!agentId) fail("invalid_agent_id");
        if (!statusText) fail("invalid_status_text");
        const stepKey = opts.stepKey?.trim() || `status-${agentId}-${Date.now()}`;
        const result = await postStatusReport({
          teamId: opts.teamId.trim(),
          agentId,
          state,
          statusText,
          stepKey,
          skillId: opts.skillId?.trim() || undefined,
          sessionKey: opts.sessionKey?.trim() || undefined,
          beatId: optionalBeatId(opts.beatId),
          source: opts.source?.trim() || "shellcorp_cli",
          occurredAt: opts.occurredAt,
        });
        await writeBoardEvent({
          teamId: opts.teamId.trim(),
          projectId: resolveProjectOrFail(company, opts.teamId).projectId,
          kind: "status_reported",
          agentId,
          label: state,
          detail: statusText,
          data: {
            stepKey,
            skillId: opts.skillId?.trim() || undefined,
            sessionKey: opts.sessionKey?.trim() || undefined,
            source: opts.source?.trim() || "shellcorp_cli",
          },
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, agentId, state, statusText, stepKey, result },
          `Reported status for ${agentId} (${state})`,
        );
      },
    );

  // ─── Bot sub-commands ─────────────────────────────────────────────────────

  const bot = team.command("bot").description("Manage team command-bot activity logs");
  bot
    .command("log")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--agent-id <agentId>", "Agent id")
    .requiredOption(
      "--activity-type <type>",
      "planning|research|executing|distributing|blocked|handoff|summary|status",
    )
    .requiredOption("--label <label>", "Activity label")
    .option("--detail <detail>", "Activity detail")
    .option("--task-id <taskId>", "Task id context")
    .option("--skill-id <skillId>", "Skill id context")
    .option("--state <state>", "Optional task state context")
    .option("--step-key <stepKey>", "Idempotency key")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        agentId: string;
        activityType: string;
        label: string;
        detail?: string;
        taskId?: string;
        skillId?: string;
        state?: string;
        stepKey?: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.activity.write");
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const result = await postBoardCommand({
          projectId,
          command: "activity_log",
          actorType: "agent",
          actorAgentId: opts.agentId.trim(),
          activityType: parseBoardActivityType(opts.activityType),
          label: opts.label.trim(),
          detail: opts.detail?.trim() || undefined,
          taskId: opts.taskId?.trim() || undefined,
          skillId: opts.skillId?.trim() || undefined,
          status: opts.state?.trim() || undefined,
          stepKey: opts.stepKey?.trim() || undefined,
          beatId: optionalBeatId(opts.beatId),
        });
        await writeBoardEvent({
          teamId: opts.teamId,
          projectId,
          kind: "activity_logged",
          agentId: opts.agentId.trim(),
          taskId: opts.taskId?.trim() || undefined,
          label: opts.label.trim(),
          detail: opts.detail?.trim() || undefined,
          data: {
            activityType: parseBoardActivityType(opts.activityType),
            skillId: opts.skillId?.trim() || undefined,
            state: opts.state?.trim() || undefined,
            stepKey: opts.stepKey?.trim() || undefined,
          },
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, result },
          `Logged activity for ${opts.agentId} (${opts.activityType})`,
        );
      },
    );

  bot
    .command("timeline")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--agent-id <agentId>", "Filter agent")
    .option(
      "--limit <limit>",
      "Max rows",
      (value) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 1) fail(`invalid_limit:${value}`);
        return parsed;
      },
      20,
    )
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; agentId?: string; limit: number; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId);
      const data = await postBoardQuery({
        projectId,
        query: "activity",
        agentId: opts.agentId?.trim() || undefined,
        limit: opts.limit,
      });
      const rows = Array.isArray(data) ? data : [];
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, events: rows },
        rows.length === 0
          ? `${opts.teamId} has no activity events`
          : rows
              .map((row) => {
                const event = row as {
                  occurredAt?: number;
                  agentId?: string;
                  activityType?: string;
                  label?: string;
                  taskId?: string;
                };
                const at =
                  typeof event.occurredAt === "number"
                    ? new Date(event.occurredAt).toISOString()
                    : "unknown-time";
                return `${at} | ${event.agentId ?? "unknown-agent"} | ${event.activityType ?? "status"} | ${event.label ?? ""} | ${event.taskId ?? "-"}`;
              })
              .join("\n"),
      );
    });

  bot
    .command("next")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--agent-id <agentId>", "Agent id for personalized ranking")
    .option(
      "--limit <limit>",
      "Max rows",
      (value) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 1) fail(`invalid_limit:${value}`);
        return parsed;
      },
      5,
    )
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; agentId?: string; limit: number; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId);
      const rows = await postBoardQuery({
        projectId,
        query: "next",
        agentId: opts.agentId?.trim() || undefined,
        limit: opts.limit,
      });
      const list = Array.isArray(rows) ? rows : [];
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, candidates: list },
        list.length === 0
          ? `${opts.teamId} has no next candidates`
          : list
              .map((row) => {
                const candidate = row as {
                  taskId?: string;
                  priority?: string;
                  status?: string;
                  title?: string;
                  ownerAgentId?: string;
                };
                return `${candidate.taskId ?? "unknown"} | ${candidate.priority ?? "medium"} | ${candidate.ownerAgentId ?? "unassigned"} | ${candidate.title ?? ""}`;
              })
              .join("\n"),
      );
    });
}
