# OpenClaw Adapter Contracts (UI)

This doc describes the **UI-facing adapter contract** implemented by:

- `ui/src/lib/openclaw-adapter.ts` (`OpenClawAdapter`)
- `ui/src/lib/openclaw-types.ts` (TypeScript models)

The goal is to make it easy to:

1) understand what the UI expects from OpenClaw surfaces, and
2) evolve backend/gateway responses without breaking the UI.

## Architecture

ShellCorp’s UI talks to two kinds of surfaces:

- **State HTTP surfaces** (read-only JSON): `GET {stateBase}/openclaw/...`
- **Gateway WS methods** (RPC-style): e.g. `agents.list`, `skills.status`, `tools.catalog`

In the UI, the adapter is injected via:

- `ui/src/providers/openclaw-adapter-provider.tsx`

```ts
adapter: new OpenClawAdapter("", stateBase, wsClient)
```

## Core read surfaces (HTTP)

These endpoints are used via the adapter’s `readJson()`:

### `GET /openclaw/agents`

Mapped by:

- `OpenClawAdapter.listAgents(): Promise<AgentCardModel[]>`

The adapter is tolerant of several field names (`agentId` vs `id`, `displayName` vs `name`).

**UI contract** (`AgentCardModel`):

- `agentId: string`
- `displayName: string`
- `workspacePath: string`
- `agentDir: string`
- `sandboxMode: string` (defaults to `"off"`)
- `toolPolicy: { allow: string[]; deny: string[] }`
- `sessionCount: number`
- `lastUpdatedAt?: number`

### `GET /openclaw/agents/:agentId/sessions`

Mapped by:

- `OpenClawAdapter.listSessions(agentId): Promise<SessionRowModel[]>`

**UI contract** (`SessionRowModel`):

- `agentId: string`
- `sessionKey: string`
- `sessionId?: string`
- `updatedAt?: number`
- `channel?: string`
- `peerLabel?: string`
- `origin?: string`

### `GET /openclaw/agents/:agentId/sessions/:sessionKey/events?limit=...`

Mapped by:

- `OpenClawAdapter.getSessionTimeline(agentId, sessionKey, limit?): Promise<SessionTimelineModel>`

The adapter normalizes events into:

- `type: "message" | "tool" | "status"`
- `role: string`
- `text: string`
- `ts: number`
- `source?: "heartbeat" | "ui" | "operator" | "unknown"`

Heartbeat windows are detected by regex:

- start: `/read\s+heartbeat\.md[\s\S]*current\s+time:/i`
- ok: `/\bHEARTBEAT_OK\b/i`

## Core gateway methods (WebSocket)

These are invoked via `invokeGatewayMethod()` and require a connected gateway WS client.

### `agents.list`

Mapped by:

- `OpenClawAdapter.getAgentsList(): Promise<AgentsListResult>`

If the gateway method is unavailable, the adapter falls back to:

- `getConfigSnapshot()` + `listAgents()`

### `agent.identity.get`

Mapped by:

- `OpenClawAdapter.getAgentIdentity(agentId): Promise<AgentIdentityResult | null>`

### `tools.catalog`

Mapped by:

- `OpenClawAdapter.getToolsCatalog(agentId): Promise<ToolsCatalogResult | null>`

### `skills.status`

Mapped by:

- `OpenClawAdapter.getSkillsStatus(agentId): Promise<SkillStatusReport | null>`

### `channels.status`

Mapped by:

- `OpenClawAdapter.getChannelsStatus(): Promise<ChannelsStatusSnapshot | null>`

### `cron.status` / `cron.list`

Mapped by:

- `OpenClawAdapter.getCronStatus(): Promise<CronStatus | null>`
- `OpenClawAdapter.listCronJobs(): Promise<CronJob[]>`

### `agents.files.list` / `agents.files.get` / `agents.files.set`

Mapped by:

- `OpenClawAdapter.listAgentFiles(agentId): Promise<AgentsFilesListResult>`
- `OpenClawAdapter.getAgentFile(agentId, name): Promise<AgentsFilesGetResult>`
- `OpenClawAdapter.saveAgentFile(agentId, name, content): Promise<AgentsFilesSetResult>`
- `OpenClawAdapter.listProjectArtefacts(projectId, agentIds): Promise<ProjectArtefactIndexResult>`

UI usage:

- Manage Agent modal file editor (`files` tab)
- Team Panel Projects-tab project-scoped artefact viewer (read-only browse/preview)

## Unified UI entrypoint

Most UI screens should prefer the high-level aggregate:

- `OpenClawAdapter.getUnifiedOfficeModel(): Promise<UnifiedOfficeModel>`

`App.tsx` currently uses this to populate:

- `agents`
- `sessions` (via `listSessions` on selection)
- `timeline` (via `getSessionTimeline`)
- `memory`
- `skills`
- `company` + workload/warnings

## CLI bundling (for global `shellcorp`)

To ensure global `shellcorp` works even when repo `node_modules` is missing, the CLI is bundled via esbuild.

- Source entry: `cli/shellcorp-cli.ts`
- Bundle output: `dist/bundle/shellcorp-cli.cjs`
- Wrapper: `bin/shellcorp.js` prefers the bundle when present.

Commands:

```bash
npm --prefix /home/kenjipcx/Zanarkand/ShellCorp run cli:bundle
```

Note: For piping JSON output to `jq`, prefer `npm --silent` to avoid `npm run` banner lines:

```bash
npm --silent --prefix /home/kenjipcx/Zanarkand/ShellCorp run shell -- team board task list --team-id team-proj-shellcorp-v2 --json | jq .
```

## Testing

Adapter unit tests live in:

- `ui/src/lib/openclaw-adapter.test.ts`

Run:

```bash
npm --prefix /home/kenjipcx/Zanarkand/ShellCorp run test:once -- ui/src/lib/openclaw-adapter.test.ts
```

## Versioning guidance

- Prefer additive changes to gateway/state payloads.
- Keep adapter parsing **tolerant** (multiple field aliases) when upstream schemas are still moving.
- When breaking changes are required, update this doc and add/adjust adapter tests first.
