# SC04: Chat Bridge to OpenClaw

## Scope

Define the minimal send/refresh bridge from the office UI to OpenClaw so operators can steer sessions from the same gamified surface.

## Canonical References

- OpenClaw Multi-Agent Routing: https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing
- OpenClaw Plugins: https://docs.openclaw.ai/tools/plugin#plugins

## Bridge Responsibilities

- Select agent and session in UI.
- Submit operator messages to OpenClaw gateway API.
- Poll or subscribe for updated session timeline events.
- Expose delivery status and error feedback in UI.

## Contract

### Request

- `agentId`
- `sessionKey`
- `message`
- `metadata` (optional)

### Response

- `ok`
- `eventId` or equivalent trace ID
- `error` when failed

## Security Notes

- UI should support bearer token usage when required by gateway.
- No secret material should be persisted in browser-local state.

## Acceptance Criteria

- Operator can send at least one message into a selected agent session.
- Timeline refresh reflects new events after send.
- Failures are visible with actionable error messages.
