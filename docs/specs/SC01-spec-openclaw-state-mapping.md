# SC01: OpenClaw State Mapping

## Scope

Define how Shell Company maps OpenClaw runtime state into gamified UI models without reimplementing gateway, routing, or config internals.

## Canonical References

- OpenClaw Multi-Agent Routing: https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing
- OpenClaw Plugins: https://docs.openclaw.ai/tools/plugin#plugins

## Source-of-Truth Surfaces

- `~/.openclaw/openclaw.json`
- `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- `~/.openclaw/agents/<agentId>/sessions/*.jsonl`
- `~/.openclaw/workspace-<agentId>` (or shared workspace rules from config)
- OpenClaw gateway HTTP/WS APIs for online operations

## Mapping Contracts

### AgentCardModel

- `agentId`
- `displayName`
- `workspacePath`
- `agentDir`
- `sandboxMode`
- `toolPolicy` (`allow`, `deny`)
- `sessionCount`
- `lastUpdatedAt`

### SessionRowModel

- `agentId`
- `sessionKey`
- `sessionId`
- `updatedAt`
- `channel`
- `peerLabel`
- `origin`

### SessionTimelineModel

- `agentId`
- `sessionKey`
- `events[]` from transcript messages/tool steps
- `tokenUsage` (when present in store metadata)

## Acceptance Criteria

- Adapter layer resolves agent roster from OpenClaw state.
- Adapter layer resolves session list per agent.
- UI can render session timeline from transcript-derived events.
- No dependence on deleted Fahrenheit gateway/config codepaths.
