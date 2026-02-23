# Fahrenheit

Single-brain, multi-hand AI operating system.

## Runtime requirement

- Node.js 20+ (required by PI packages and dependencies like `pi-tui`)

## Quick start

```bash
npm install
npm run build
cp fahrenheit.example.json ~/.fahrenheit/fahrenheit.json
npm run gateway
```

## CLI

- `npm run gateway` - start gateway server
- `npm run status` - print runtime status
- `npm run dev -- agent --message "hello"` - one-shot prompt
- `npm run dev -- channels login` - generate provider setup scaffold (n8n workflow + env checker)

Cron management examples:

```bash
npm run dev -- cron add --id daily-review --schedule "0 9 * * *" --prompt "Run daily review" --session "brain:main"
npm run dev -- cron list
npm run dev -- cron remove --id daily-review
```

Provider scaffold (n8n-first):

```bash
npm run dev -- channels login
```

Provider control endpoints:

- `GET /providers` - list provider setup and runtime status
- `GET /providers/:id/setup` - provider setup requirements
- `GET /providers/:id/status` - provider runtime status
- `POST /providers/:id/test` - inject a provider test event through the full gateway pipeline
- `GET /ui` - built-in visual gateway dashboard
- `POST /rpc` - generic method-based control API (`gateway.status`, `providers.*`, `messages.list`, `ingest.message`, `ontology.*`)

Gateway provider configuration:

- `providers` defines bridge/ingest providers (for example `notion-comments`, `discord-comments`)
- Native realtime channels remain under `channels` (`telegram`, `discord`, `slack`, `whatsapp`)

Event sink configuration:

- `eventSink.type = "memory" | "file" | "convex"`
- `eventSink.type="memory"` for local/no-dependency testing
- `eventSink.type="file"` for append-only JSONL on disk
- `eventSink.type="convex"` when you want Convex-backed source-of-truth
- `eventSink.type="convex"` requires `eventSink.convex.deploymentUrl` (and optional `eventSink.convex.authToken`)

Pi model configuration:

- `ai.enabled=true` enables conversational brain responses
- `ai.providers` stores provider credentials/overrides (`apiKey`, `apiBase`, `extraHeaders`)
- `agents.defaults.model` selects the active model as `provider/model` (for example `anthropic/claude-opus-4-5`)
- `agents.defaults.workspace` can be used as workspace alias if `workspaceDir` is omitted

Ontology mapping configuration:

- `ontology.mappingDescription` is free-form plain language describing workspace structure
- `ontology.providers.notion.apiKey` enables Notion-backed canonical operations
- `ontology.entities.<entity>.databaseId` points each canonical entity to a Notion database
- `ontology.writeMinConfidence` controls write gating for low-confidence mappings

Ontology RPC methods:

- `ontology.mapping.describe` - returns inferred mapping artifact + clarification questions
- `ontology.query` - typed canonical operations (`list|get|create|update|search`)
- `ontology.text` - natural language request resolver mapped to canonical operations
