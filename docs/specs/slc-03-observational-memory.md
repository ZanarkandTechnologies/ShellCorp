# Spec: Observational Memory

**Status**: Draft
**Created**: 2026-02-21
**Author**: gpt-5.3-codex

## Problem

Operational context is lost when continuous activity from channels and tools is not captured and compressed into durable memory.

## Solution

Use a two-file memory model:

- `HISTORY.md` for timestamped raw observations
- `MEMORY.md` for synthesized durable facts

Cron jobs collect data via skills/CLIs and append to history; heartbeat drives compression.

## Success Criteria

- [ ] SC-1: Cron-driven observations append structured entries to `HISTORY.md`
- [ ] SC-2: Compression writes key facts to `MEMORY.md` and truncates history safely
- [ ] SC-3: Brain prompt includes `MEMORY.md` context on each turn

## Out of Scope

- Embedding/vector retrieval in SLC-1
- Cross-session CRDT memory synchronization

## Technical Approach

- **Store**: File-backed markdown memory in workspace root
- **Mutation**: Atomic append and bounded truncate operations
- **Retrieval**: Basic keyword/regex search in SLC-1

## Open Questions

1. Trigger compression by size, lines, time, or combined threshold?
2. Keep history snapshots for forensic replay before truncation?
