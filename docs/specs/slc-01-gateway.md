# Spec: Gateway

**Status**: Draft
**Created**: 2026-02-21
**Author**: gpt-5.3-codex

## Problem

Inbound messages from multiple channels need a unified path into persistent session-keyed agents, and agents also need a safe outbound path to proactively message channels when resolving blockers or reporting outcomes.

## Solution

Implement a channel-agnostic gateway that:

1. Normalizes inbound events into a shared envelope and routes to configured session-keyed agents.
2. Exposes a policy-checked outbound interface so agents can initiate proactive messages (for example mentions, thread updates, and unblock requests).

## Success Criteria

- [ ] SC-1: Messages from supported channels normalize to one `InboundEnvelope` type
- [ ] SC-2: Router resolves target session from binding rules and dispatches prompt/steer
- [ ] SC-3: Outbound responses return to original channel with thread/group context preserved
- [ ] SC-4: Ingress defaults deny unauthorized senders/providers and reject unauthenticated control traffic
- [ ] SC-5: Session keys are agent-namespaced and support DM/group scoping with backward-compatible fallback
- [ ] SC-6: Ingest and provider test paths support idempotency keys and return monotonically increasing state version metadata
- [ ] SC-7: Gateway supports proactive outbound send API with channel/thread targeting and idempotency keys
- [ ] SC-8: Proactive outbound sends are policy-checked (allowed channel, mention rules, rate limits) before dispatch

## Out of Scope

- Realtime web dashboard transport
- Advanced cross-channel prioritization
- Fully autonomous broadcast campaigns across all channels

## Technical Approach

- **Backend**: TypeScript gateway service with typed event bus
- **Config**: Zod schema for channels, bindings, and session scoping rules
- **Integrations**: grammY, discord.js, @slack/bolt, Baileys
- **Outbound contract**: typed `send` API with destination (`provider`, `channelId`, `threadId`, `targets`) and correlation metadata
- **Policy hook**: enforce outbound rules before provider adapter dispatch

## Security Constraints

- Gateway bind defaults to loopback/private network; public exposure is explicit opt-in.
- HTTP ingestion and RPC surfaces require auth when configured and emit auditable rejected-attempt logs.
- Provider payloads are treated as untrusted input and normalized through one validation path before routing.
- Gateway must preserve provenance (`sourceId`, channel/provider identity) for downstream policy checks.
- Proactive outbound actions require session identity, policy authorization, and audit logging with correlation IDs.

## Open Questions

1. Should non-owner DMs be dropped or staged into moderation queue by default?
2. Do we route by channel only or channel+workspace/team identity from day one?
3. What default rate limits should apply to proactive outbound messages per session/provider?
