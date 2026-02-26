# SC10: Heartbeat-Driven Autonomy Loop and Operator Governance

## Scope

Define heartbeat-driven autonomous execution loops and the operator governance controls required to keep autonomous actions visible, auditable, and interruptible.

## Canonical References

- OpenClaw Multi-Agent Routing: https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing
- OpenClaw Plugins: https://docs.openclaw.ai/tools/plugin#plugins
- `SC01`: `docs/specs/SC01-spec-openclaw-state-mapping.md`
- `SC04`: `docs/specs/SC04-spec-chat-bridge-openclaw.md`
- `SC07`: `docs/specs/SC07-spec-ticket-session-lifecycle.md`

## Product Rules

- Every autonomous action must map to a unique heartbeat invocation id.
- No autonomous work runs without explicit policy.
- Operators can pause/resume/manual-run loops at any time.
- Loop failures and state transitions are visible, never silent.

## Data Contracts

### HeartbeatPolicy

- `agentId`
- `projectId` (optional)
- `enabled`
- `intervalSeconds`
- `maxConsecutiveFailures`
- `taskSelectionStrategy`: `fifo | priority | operator_assigned`
- `requireApprovalAbove` (optional threshold)
- `allowedActions[]`
- `cooldownAfterFailureSeconds`

### GovernanceOverride

- `overrideId`
- `agentId`
- `action`: `pause | resume | manual_run | kill`
- `issuedBy`
- `issuedAt`
- `reason` (optional)
- `expiresAt` (optional)

### HeartbeatRecord

- `beatId`
- `agentId`
- `projectId` (optional)
- `triggeredAt`
- `triggerSource`: `scheduled | manual | resume_after_pause`
- `ticketId` (optional)
- `sessionId` (optional)
- `outcome`: `success | failure | skipped | no_work`
- `durationMs`
- `error` (optional)

### HeartbeatLoopState

- `agentId`
- `status`: `running | paused | circuit_open | disabled`
- `lastBeatId`
- `lastBeatAt`
- `nextScheduledAt`
- `consecutiveFailures`
- `pausedBy` (optional)
- `pausedAt` (optional)

## Required Flows

### Scheduled Tick

1. Scheduler triggers based on policy interval.
2. Loop gate checks status (`running` required).
3. Work item is selected from federated board state.
4. Session context is opened/continued using ticket-session binding.
5. Work dispatch runs through OpenClaw chat/tool bridge.
6. Beat outcome is persisted with audit metadata.

### Pause/Resume

- Pause halts future ticks and records governance override.
- Resume re-enters running state with explicit operator action.

### Manual Run

- Manual run executes one beat with same policy constraints.
- Manual run is auditable and does not silently rewrite scheduled cadence.

### Circuit Breaker

- Repeated failures open circuit state.
- Circuit-open prevents further autonomous ticks until recovery policy/operator action.

## UI Requirements

- Operator can see loop status per agent and globally.
- Controls for pause/resume/manual run are accessible in UI.
- Heartbeat history timeline shows outcomes and traces.
- Circuit-open state is prominent and actionable.
- Governance override log is inspectable.

## Acceptance Criteria

- Policy-configured loops execute and produce auditable records.
- Pause/resume/manual run behave deterministically.
- Circuit breaker engages and blocks loops after configured failure threshold.
- Operators can inspect failures and override history.
- No autonomous work executes when policy is disabled/absent.
