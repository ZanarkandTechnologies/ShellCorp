/**
 * TEAM BOARD COMMANDS
 * ====================
 * Purpose
 * - Board task lifecycle: add, move, update, delete, assign, claim, block, done, reopen, reprioritize, list.
 * - Markdown-first task memory helpers for plan/context/progress stored directly on the task.
 * - Agent-scoped board views implemented as filtered views over one canonical team board.
 * - Team status reporting (explicit status writes to Convex).
 * - Bot activity log / timeline / next-task queries.
 *
 * MEMORY REFERENCES:
 * - MEM-0202
 * - MEM-0206
 * - MEM-0210
 * - MEM-0215
 */
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import {
  type SidecarStore,
  asRecord,
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

type BoardTaskRow = {
  taskId: string;
  title: string;
  status?: string;
  priority?: string;
  ownerAgentId?: string;
  notes?: string;
  detail?: string;
  updatedAt?: number;
};

async function readBoardTasks(projectId: string): Promise<BoardTaskRow[]> {
  const data = await postBoardQuery({ projectId, query: "tasks" });
  const rows = Array.isArray((data as { tasks?: unknown[] })?.tasks)
    ? ((data as { tasks: unknown[] }).tasks as unknown[])
    : [];
  return rows
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => {
      const record = asRecord(row);
      return {
        taskId: String(record.taskId ?? "").trim(),
        title: String(record.title ?? "").trim(),
        status: typeof record.status === "string" ? record.status : undefined,
        priority: typeof record.priority === "string" ? record.priority : undefined,
        ownerAgentId: typeof record.ownerAgentId === "string" ? record.ownerAgentId : undefined,
        notes: typeof record.notes === "string" ? record.notes : undefined,
        detail: typeof record.detail === "string" ? record.detail : undefined,
        updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : undefined,
      } satisfies BoardTaskRow;
    })
    .filter((row) => row.taskId.length > 0);
}

async function readBoardTaskOrFail(projectId: string, taskId: string): Promise<BoardTaskRow> {
  const task = (await readBoardTasks(projectId)).find((entry) => entry.taskId === taskId.trim());
  if (!task) throw new Error(`task_not_found:${taskId}`);
  return task;
}

async function readMemoryInput(opts: { text?: string; file?: string }): Promise<string> {
  const inline = opts.text?.trim();
  if (inline) return inline;
  const filePath = opts.file?.trim();
  if (filePath) {
    const text = await readFile(filePath, "utf-8");
    if (!text.trim()) fail("invalid_memory_text");
    return text;
  }
  fail("missing_memory_text:use_--text_or_--file");
}

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
    | "task_claimed"
    | "task_memory_set"
    | "task_memory_appended"
    | "status_reported"
    | "activity_logged";
  agentId?: string;
  taskId?: string;
  label?: string;
  detail?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  // MEM-0215: board activity is Convex-canonical; keep the CLI flow shape without mirroring to sidecar logs.
  void input;
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
    .option("--status <status>", "todo|in_progress|review|blocked|done", "todo")
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
    .requiredOption("--status <status>", "todo|in_progress|review|blocked|done")
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
    .command("claim")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .requiredOption("--agent-id <agentId>", "Agent id claiming the task")
    .option("--status <status>", "todo|in_progress|review|blocked|done", "in_progress")
    .option("--note <note>", "Optional claim note appended to task memory")
    .option("--actor-agent-id <agentId>", "Actor agent id override")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        taskId: string;
        agentId: string;
        status: string;
        note?: string;
        actorAgentId?: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.board.write");
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const actorAgentId = opts.actorAgentId?.trim() || opts.agentId.trim();
        const task = await readBoardTaskOrFail(projectId, opts.taskId);

        await postBoardCommand({
          projectId,
          command: "task_assign",
          taskId: opts.taskId.trim(),
          ownerAgentId: opts.agentId.trim(),
          actorType: "agent",
          actorAgentId,
          beatId: optionalBeatId(opts.beatId),
        });
        await postBoardCommand({
          projectId,
          command: "task_move",
          taskId: opts.taskId.trim(),
          status: parseBoardTaskStatus(opts.status),
          actorType: "agent",
          actorAgentId,
          beatId: optionalBeatId(opts.beatId),
        });

        if (opts.note?.trim()) {
          const nextMemory = task.notes?.trim()
            ? `${task.notes.trim()}\n\nClaimed by ${opts.agentId.trim()}: ${opts.note.trim()}`
            : `Claimed by ${opts.agentId.trim()}: ${opts.note.trim()}`;
          await postBoardCommand({
            projectId,
            command: "task_update",
            taskId: opts.taskId.trim(),
            detail: nextMemory,
            actorType: "agent",
            actorAgentId,
            beatId: optionalBeatId(opts.beatId),
          });
        }

        await writeBoardEvent({
          teamId: opts.teamId,
          projectId,
          kind: "task_claimed",
          agentId: actorAgentId,
          taskId: opts.taskId.trim(),
          detail: opts.note?.trim() || undefined,
          data: {
            ownerAgentId: opts.agentId.trim(),
            status: parseBoardTaskStatus(opts.status),
          },
        });
        formatOutput(
          opts.json ? "json" : "text",
          {
            ok: true,
            teamId: opts.teamId,
            projectId,
            taskId: opts.taskId.trim(),
            ownerAgentId: opts.agentId.trim(),
            status: parseBoardTaskStatus(opts.status),
          },
          `Claimed task ${opts.taskId} for ${opts.agentId}`,
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
    .option("--status <status>", "todo|in_progress|review|blocked|done")
    .option("--agent-id <agentId>", "Filter tasks owned by one agent")
    .option("--include-unassigned", "Include unassigned tasks when filtering by agent", false)
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        status?: string;
        agentId?: string;
        includeUnassigned?: boolean;
        json?: boolean;
      }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId);
      const tasks = await readBoardTasks(projectId);
      const filtered = tasks.filter((task) => {
        if (opts.status?.trim() && task.status !== parseBoardTaskStatus(opts.status.trim())) {
          return false;
        }
        if (opts.agentId?.trim()) {
          if (task.ownerAgentId === opts.agentId.trim()) return true;
          return Boolean(opts.includeUnassigned) && !task.ownerAgentId;
        }
        return true;
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, tasks: filtered },
        filtered.length === 0
          ? `${opts.teamId} has no board tasks`
          : filtered
              .map(
                (task) =>
                  `${task.taskId} | ${task.status ?? "todo"} | ${task.priority ?? "medium"} | ${task.ownerAgentId ?? "unassigned"} | ${task.title}`,
              )
              .join("\n"),
      );
    });

  boardTask
    .command("mine")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--agent-id <agentId>", "Agent id")
    .option("--status <status>", "todo|in_progress|review|blocked|done")
    .option("--include-unassigned", "Include unassigned tasks alongside owned work", false)
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        agentId: string;
        status?: string;
        includeUnassigned?: boolean;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.read");
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const tasks = (await readBoardTasks(projectId)).filter((task) => {
          if (opts.status?.trim() && task.status !== parseBoardTaskStatus(opts.status.trim())) {
            return false;
          }
          return (
            task.ownerAgentId === opts.agentId.trim() ||
            (Boolean(opts.includeUnassigned) && !task.ownerAgentId)
          );
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, agentId: opts.agentId.trim(), tasks },
          tasks.length === 0
            ? `${opts.agentId} has no tasks on ${opts.teamId}`
            : tasks
                .map(
                  (task) =>
                    `${task.taskId} | ${task.status ?? "todo"} | ${task.priority ?? "medium"} | ${task.title}`,
                )
                .join("\n"),
        );
      },
    );

  const memory = boardTask.command("memory").description("Manage markdown task memory");

  memory
    .command("show")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; taskId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId);
      const task = await readBoardTaskOrFail(projectId, opts.taskId);
      const memoryText = task.notes ?? task.detail ?? "";
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, taskId: task.taskId, memory: memoryText },
        memoryText || `${opts.taskId} has no task memory`,
      );
    });

  memory
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .option("--text <text>", "Markdown memory text")
    .option("--file <path>", "Read markdown memory from file")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        taskId: string;
        text?: string;
        file?: string;
        actorAgentId: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.board.write");
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const memoryText = await readMemoryInput(opts);
        const result = await postBoardCommand({
          projectId,
          command: "task_update",
          taskId: opts.taskId.trim(),
          detail: memoryText,
          actorType: "agent",
          actorAgentId: opts.actorAgentId.trim(),
          beatId: optionalBeatId(opts.beatId),
        });
        await writeBoardEvent({
          teamId: opts.teamId,
          projectId,
          kind: "task_memory_set",
          agentId: opts.actorAgentId.trim(),
          taskId: opts.taskId.trim(),
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, taskId: opts.taskId.trim(), result },
          `Set task memory for ${opts.taskId}`,
        );
      },
    );

  memory
    .command("append")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--task-id <taskId>", "Task id")
    .option("--text <text>", "Markdown memory text")
    .option("--file <path>", "Read markdown memory from file")
    .option("--actor-agent-id <agentId>", "Actor agent id", "main")
    .option("--beat-id <beatId>", "Optional heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        taskId: string;
        text?: string;
        file?: string;
        actorAgentId: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.board.write");
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const current = await readBoardTaskOrFail(projectId, opts.taskId);
        const nextChunk = await readMemoryInput(opts);
        const currentText = current.notes ?? current.detail ?? "";
        const nextMemory = currentText.trim() ? `${currentText.trim()}\n\n${nextChunk}` : nextChunk;
        const result = await postBoardCommand({
          projectId,
          command: "task_update",
          taskId: opts.taskId.trim(),
          detail: nextMemory,
          actorType: "agent",
          actorAgentId: opts.actorAgentId.trim(),
          beatId: optionalBeatId(opts.beatId),
        });
        await writeBoardEvent({
          teamId: opts.teamId,
          projectId,
          kind: "task_memory_appended",
          agentId: opts.actorAgentId.trim(),
          taskId: opts.taskId.trim(),
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, taskId: opts.taskId.trim(), result },
          `Appended task memory for ${opts.taskId}`,
        );
      },
    );

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
