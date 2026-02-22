# Spec: Gateway

**Status**: Draft
**Created**: 2026-02-21
**Author**: gpt-5.3-codex

## Problem

Inbound messages from multiple channels need a unified path into one persistent brain session (or selected role session), without losing source context or creating brittle per-channel logic.

## Solution

Implement a channel-agnostic gateway router that normalizes inbound events into a shared envelope and dispatches them to configured Pi sessions.

## Success Criteria

- [ ] SC-1: Messages from supported channels normalize to one `InboundEnvelope` type
- [ ] SC-2: Router resolves target session from channel/team config and dispatches prompt/steer
- [ ] SC-3: Outbound responses return to original channel with thread/group context preserved

## Out of Scope

- Realtime web dashboard transport
- Advanced cross-channel prioritization

## Technical Approach

- **Backend**: TypeScript gateway service with typed event bus
- **Config**: Zod schema for channels and routing rules
- **Integrations**: grammY, discord.js, @slack/bolt, Baileys

## Open Questions

1. Should non-owner DMs be dropped or staged into moderation queue by default?
2. Do we route by channel only or channel+workspace/team identity from day one?
