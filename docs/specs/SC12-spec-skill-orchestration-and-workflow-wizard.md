# SC12: CEO Team Generation Workflow

## Status

Proposed replacement for the deferred wizard framing. This spec supersedes the earlier SC12 "skill orchestration wizard" direction while preserving the existing planning trail.

## Purpose

Define the canonical founder workflow for starting a new team through the CEO OpenClaw agent using:

- CEO chat as the entry point,
- a CLI-backed team-generation skill,
- a minimum-brief idea gate,
- research-backed proposal generation,
- founder review through User Tasks,
- task-backed working memory on the board,
- approval-triggered team creation,
- and heartbeat handoff after bootstrap.

The current product simplification for this spec is:

- the CEO board task is the proposal container,
- the same task carries founder approval state,
- task notes act as compact working memory,
- linked session/chat holds the richer working thread.

## Why This Exists

The original SC12 drifted toward recreating workflow tooling inside the UI. That is the wrong ownership boundary for ShellCorp.

OpenClaw already owns agent runtime and behavior. ShellCorp already has a local CLI for team creation and team mutation. The missing product layer is not another custom runtime. It is a clean operator workflow around the existing runtime:

1. founder tells the CEO agent to start a team for an idea,
2. CEO agent asks follow-up questions until the idea passes a minimum gate,
3. CEO agent researches the likely team shape, tools, and data sources,
4. CEO agent persists a readable proposal through ShellCorp CLI,
5. founder approves or requests changes from User Tasks,
6. CEO agent executes the approved proposal through ShellCorp CLI,
7. the created team appears in the existing office/team surfaces,
8. created board tasks become the short-term task/session memory surface,
9. heartbeat takes over.

## Existing Foundation To Reuse

SC12 must build around current ShellCorp and OpenClaw primitives instead of introducing new runtime code.

### Reused product surfaces

- [`ui/src/features/team-system/components/business-tab.tsx`](/home/kenjipcx/Zanarkand/ShellCorp/ui/src/features/team-system/components/business-tab.tsx)
- [`ui/src/features/team-system/components/business-flow/business-readiness-panel.tsx`](/home/kenjipcx/Zanarkand/ShellCorp/ui/src/features/team-system/components/business-flow/business-readiness-panel.tsx)
- [`ui/src/components/hud/user-tasks-panel.tsx`](/home/kenjipcx/Zanarkand/ShellCorp/ui/src/components/hud/user-tasks-panel.tsx)
- [`ui/src/components/office-scene/use-office-scene-interactions.ts`](/home/kenjipcx/Zanarkand/ShellCorp/ui/src/components/office-scene/use-office-scene-interactions.ts)
- [`cli/team-commands/team-business.ts`](/home/kenjipcx/Zanarkand/ShellCorp/cli/team-commands/team-business.ts)
- [`skills/shellcorp-team-cli/SKILL.md`](/home/kenjipcx/Zanarkand/ShellCorp/skills/shellcorp-team-cli/SKILL.md)

### Reused capabilities

- `shellcorp team create`
- `shellcorp team business set-all`
- `shellcorp team business equip-skills`
- `shellcorp team board task add`
- `shellcorp team board task update`
- existing team readiness/business surfaces
- existing OpenClaw heartbeat bootstrap and role templates
- existing `task == session` direction from SC07

### Product rules

- OpenClaw remains the runtime source of truth.
- CEO behavior changes should come from skill instructions and heartbeat guidance, not new agent-runtime code in ShellCorp.
- User Tasks is a filtered founder approval surface over CEO board tasks.
- Team Panel and Business tab remain post-create inspection/editing surfaces, not the primary intake flow.
- CEO proposal work should prefer shared board/chat/session primitives over proposal-specific workflow stores.

## Primary Workflow

1. Founder asks the CEO agent to start a team for an idea.
2. CEO agent follows the SC12 team-generation skill:
   - gather missing business brief details,
   - check minimum gate,
   - run real-world research,
   - prepare a proposal packet.
3. CEO agent persists the work as a CEO board task through ShellCorp CLI.
4. User Tasks shows the founder that CEO board task in a review filter.
5. Founder approves, rejects, or requests changes.
6. CEO agent monitors the proposal state and executes approved proposals through ShellCorp CLI.
7. ShellCorp creates the team with existing create/business/equip/bootstrap flows.
8. ShellCorp seeds the new team board with the initial tasks and working-memory template.
9. Existing office/team surfaces display the created team.
10. Heartbeat governs the team after bootstrap by reading and updating task-backed memory.

## Skill and CLI Contract

SC12 is CLI-first and skill-driven.

### CEO skill responsibilities

The CEO skill must instruct the agent to:

1. ask follow-up questions until the idea gate passes,
2. research likely roles, tools, workflows, and required data sources,
3. write a concise readable proposal packet,
4. persist that packet through the `shellcorp team proposal` CLI,
5. wait for founder review state,
6. execute only after founder approval.

### Required CLI proposal lifecycle

SC12 requires a `team proposal` CLI namespace that supports:

- create
- list
- show
- approve
- reject
- request-changes
- execute

Proposal persistence lives in sidecar company state, not a separate workflow backend.

## Idea Gate Contract

The minimum idea gate is intentionally small.

Required fields:

- `focus`
- `targetCustomer`
- `primaryGoal`
- `constraints`

Optional:

- `notes`

Gate outcomes:

- `draft`
- `passed`
- `blocked`

The CEO must not persist a proposal as executable until the brief is complete enough to pass the gate.

## Proposal Packet Contract

Each proposal must survive chat, review, and execution without depending on transient chat context.

### Required proposal fields

- `id`
- `requestedBy`
- `sourceAgentId`
- `title`
- `ideaBrief`
- `ideaGateStatus`
- `researchSummary`
- `proposalSummary`
- `proposedTeamName`
- `proposedDescription`
- `proposedRoles[]`
- `proposedBusinessConfig`
- `proposedInitialBoardItems[]`
- `approvalStatus`
- `executionStatus`
- `reviewTaskTitle`
- `createdAt`
- `updatedAt`

### Optional proposal fields

- `approvalNote`
- `executionError`
- `createdTeamId`
- `createdProjectId`
- `recommendedTools[]`
- `requiredDataSources[]`

### Role policy

Each proposed role includes:

- `roleId`
- `title`
- `rationale`
- `supported`
- `mappedRuntimeRole` when executable in the current runtime

SC12 may propose roles beyond the currently auto-provisionable runtime set, but unsupported roles must be visible before approval and must block direct execution.

## Approval and Board Integration

Approval happens in User Tasks, not in the action approval queue.

### Founder review behavior

- User Tasks shows CEO board tasks marked for founder review.
- Founder can approve, reject, or request changes on that same task.
- The UI is a thin review surface over shared board state; it does not own proposal generation logic.

### CEO workbench behavior

SC12 also introduces a CEO workbench surface.

- Clicking the CEO desk opens a dedicated CEO workbench panel.
- The workbench shows CEO board task pipeline state for the CEO:
  - drafting,
  - waiting for founder review,
  - approved,
  - executed,
  - failed.
- The workbench can reuse Team Panel/kanban visual patterns, but it is not the Team Panel itself.

### Board integration

- CEO board tasks link to the created team/project when execution succeeds.
- Team bootstrap still includes initial board items for the created team.
- After successful execution, those items are created for the new team/project.
- Those items are not only tasks; they are also the working memory container for the execution loop.
- SC12 does not require a generalized personal kanban system before shipping this slice.

## Task / Session Memory Contract

SC12 should reuse the board instead of inventing a separate short-term memory layer for execution.

### Product rule

- Each active task acts like a lightweight Notion-style working-memory page for the current execution session.
- Agents should be able to resume work from the task title, notes, and linked skill/tool context without requiring a human handoff.
- The board becomes the canonical short-term execution memory surface; long-term durable decisions still belong in normal memory/history systems.

### Required task memory fields

At minimum, each active task must be able to hold:

- task goal / intended outcome,
- current notes or execution context,
- blocker state,
- next recommended step,
- optionally links, artifacts, or provider URLs.

### Agent behavior expectation

- Before acting, the agent reads the task notes plus the relevant skill instructions.
- During work, the agent writes back meaningful state changes to the task notes.
- When blocked, the agent records unblock context in the task.
- On a later heartbeat/session, the agent resumes from that task memory instead of depending on transcript recall alone.

### Relationship to SC07

- SC07 still owns the full ticket/session lifecycle contract.
- SC12 adopts the operational rule that the task card should already be useful as session memory even before the full SC07 binding model is finished.

## CLI Execution Contract

Execution must reuse existing team/business/equip/bootstrap primitives rather than inventing frontend-only creation logic.

Expected execution path:

1. validate proposal and runtime-supported roles,
2. create team/project,
3. apply business config where relevant,
4. sync business skills into created agents where relevant,
5. create initial board items with task-memory-ready notes/content,
6. persist execution result back into proposal state,
7. refresh normal team/office surfaces.

## Dynamic Role Policy

SC12 is flexible in proposal generation and strict in execution.

### Allowed

- The CEO may recommend different team shapes depending on business type and research findings.
- The proposal may include builders, PMs, growth marketers, business PMs, business executors, or unsupported specialist roles.

### Guardrail

- Unsupported roles can appear in the proposal.
- Unsupported roles must be explicitly marked.
- Execution must fail clearly rather than silently dropping roles or partially creating the wrong team shape.

## Acceptance Targets

1. Founder can start with a business idea and receive a research-backed CEO proposal without manually configuring the Business tab first.
2. The CEO can complete the proposal lifecycle with a ShellCorp skill doc plus CLI commands, without new agent-runtime code in ShellCorp.
3. User Tasks acts as the founder review and approval surface.
4. Clicking the CEO desk opens a CEO workbench that reflects proposal workflow state.
5. Approved proposals create teams through existing create/business/equip/bootstrap logic.
6. Created teams appear in existing office, topology, Team Panel, and readiness surfaces.
7. Created task cards hold enough session memory for an agent to resume work from the board plus skill context.
8. Unsupported role structures are blocked before execution and reported clearly.

## Out of Scope

1. Writing new OpenClaw runtime orchestration code for proposal handling.
2. A generalized ask-user platform beyond this workflow.
3. Arbitrary external task-provider approval integrations in v1.
4. Replacing Team Panel or Business tab with a new creation wizard.
5. Full personal-kanban infrastructure beyond the CEO workbench and founder review surfaces.
6. Replacing long-term memory/history systems with task notes.
