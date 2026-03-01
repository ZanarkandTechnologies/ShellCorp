# Gateway Module Guide

This folder owns Fahrenheit's gateway ingestion layer and routing pipeline.

## Responsibilities

- Validate and normalize incoming provider payloads into canonical gateway envelopes.
- Persist gateway messages into source-of-truth storage (`MessageStore` / Convex).
- Route conversational events to the brain runtime and emit outbound replies.
- Expose ingestion/query HTTP endpoints for built-in and external connectors.
- Publish typed internal events through `GatewayBus`.

## File Map

- `server.ts` - bootstraps the gateway runtime and hosts HTTP endpoints.
- `router.ts` - authorization + persistence + brain routing core pipeline.
- `schema.ts` - Zod validation and envelope <-> message conversion helpers.
- `message-store.ts` - storage interface and Convex-backed implementation.
- `bus.ts` - typed event bus for inbound/outbound gateway events.

## Conventions

- Keep canonical gateway payloads provider-agnostic.
- Treat `MessageStore` writes as append-only records for auditability.
- Run all ingress paths through one processing function to avoid drift.
- Add high-level header comments to gateway files and inline decision comments for non-obvious logic.
