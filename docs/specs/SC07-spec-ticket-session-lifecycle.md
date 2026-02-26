# SC07: Ticket-Session Lifecycle Contract

## Scope

Define ticket lifecycle semantics in Shell Company where one active ticket maps to one active agent session until explicit closure.

## Canonical References

- OpenClaw Multi-Agent Routing: https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing
- OpenClaw Plugins: https://docs.openclaw.ai/tools/plugin#plugins
- `SC04`: `docs/specs/SC04-spec-chat-bridge-openclaw.md`
- `SC06`: `docs/specs/SC06-spec-kanban-federation-sync.md`

## Product Rule

For SC07:

- `ticket == session` while ticket state is active (`todo`, `in_progress`, `blocked`).
- Ticket close transitions associated session to closed/archived state.
- Reopen creates a new active session link unless policy explicitly allows resume.

## Lifecycle States

### Ticket States

- `todo`
- `in_progress`
- `blocked`
- `done`
- `cancelled`

### Session Link States

- `unbound`
- `active`
- `closing`
- `closed`
- `reopened`

## Data Contracts

### TicketSessionBinding

- `bindingId`
- `projectId`
- `ticketId`
- `agentId`
- `sessionKey`
- `sessionId` (optional if unresolved)
- `state`
- `openedAt`
- `closedAt` (optional)
- `closedBy` (operator/automation id)
- `closureReason` (`done | cancelled | operator_override`)

### TicketSessionPolicy

- `projectId`
- `closeBehavior`: `close_on_done | close_on_done_or_cancelled`
- `reopenBehavior`: `new_session | resume_previous_if_available`
- `autoBindOnCreate`: boolean

## Required Flows

### Create Ticket

- Create or bind an active session for assigned agent.
- Persist binding with `state=active`.
- Show linked session context in UI ticket detail and session panel.

### Update Ticket

- Status changes keep existing active session unless entering close condition.
- Assignment changes require explicit rebind confirmation in UI.

### Close Ticket

- Transition binding `active -> closing -> closed`.
- Send final close action through OpenClaw bridge when supported.
- Lock default autonomous writes on closed ticket/session pair.

### Reopen Ticket

- Follow `reopenBehavior` policy.
- Default SC07 behavior: create new active session and keep history link to prior closed session.

## UI Requirements

- Ticket detail shows linked agent session and current binding state.
- Session panel can filter by open tickets and show closure trail.
- Close/reopen actions display deterministic state transitions and errors.

## Observability and Audit

- Every binding transition logs actor, timestamp, and source action.
- Failed close operations remain visible with retry affordance.
- No silent state divergence between ticket status and binding status.

## Acceptance Criteria

- New ticket can open and bind to an active OpenClaw session.
- Closing ticket closes/archives linked session per policy.
- Reopening ticket follows configured reopen behavior with visible history.
- Operators can inspect binding timeline and debug failed transitions.
