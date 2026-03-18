# SC12: Board-Native Task Planning And Review

## Status

Active SC12 replacement spec. This is the target workflow contract for ShellCorp task planning, human review, and agent execution.

## Purpose

Define the minimal workflow ShellCorp should support for agent-led planning:

- one canonical team board per team
- markdown task memory as the working state
- `review` as a normal board lane
- human review through the same task, not a separate proposal object
- per-agent board views as filters over the team board, not separate persisted boards

## Workflow Contract

1. Agent reads the team board.
2. If there are no actionable tickets, agent creates one or more planning tasks.
3. Agent writes the plan into the task memory.
4. Agent moves the task into `review` when human sign-off is needed.
5. Human reviews by operating the `review` lane.
6. After review, work continues on the same task.
7. Agent claims the task, gathers more context, and appends progress into the same task memory.
8. The task moves through normal board lanes until complete.

## State Model

Structured board metadata stays thin:

- `taskId`
- `projectId`
- `teamId`
- `title`
- `status`
- `priority`
- `ownerAgentId`
- `linkedSessionKey` when needed
- timestamps
- optional generic review metadata like `approvalState`

Rich task state lives in markdown task memory:

- goal
- plan
- gathered context
- blockers
- review notes
- progress log
- execution outcome

## Per-Agent Boards

Each team has one canonical board. An agent board is a filtered view over that board, usually by:

- `ownerAgentId`
- `status`
- unassigned tasks
- review tasks

Do not create a second persisted board store per agent.

## Required CLI Surface

- `team board task add`
- `team board task update`
- `team board task move`
- `team board task claim`
- `team board task mine`
- `team board task memory show`
- `team board task memory set`
- `team board task memory append`

## Product Rules

- No separate proposal persistence model.
- No special workflow object for planning approval.
- Human review is lane-driven.
- Task memory is markdown-first.
- Append-only logs remain the durable audit surface outside mutable task memory.

## Acceptance Criteria

1. An agent can create a planning task when no actionable work exists.
2. The agent can append a plan to task memory and move the task into `review`.
3. Human review can happen entirely through the board and task memory.
4. An agent can claim a reviewed task and continue from the same task memory.
5. Per-agent task views are filtered board views, not separate board stores.
