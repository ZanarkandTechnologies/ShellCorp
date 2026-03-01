# Memory Module

## Purpose

Provide DB-first (Convex) or file-backed observational memory with trust-gated promotion and safe compression.

## Public API / Entrypoints

- `MemoryStore` in `src/memory/store.ts`
- `ObservationalMemoryPipeline` in `src/memory/pipeline.ts`
- observation helpers in `src/memory/observations.ts`

## Minimal Example

```ts
const store = new MemoryStore("./workspace");
await store.appendObservation({
  projectId: "proj-ops",
  groupId: "ops",
  sessionKey: "group:ops:main",
  eventType: "workflow.delta",
  source: "notion",
  sourceRef: "page:123",
  summary: "Task blocked by missing approval",
  trustClass: "trusted",
});
```

## How To Test

- `npm run test:once`
- `npm run typecheck`
