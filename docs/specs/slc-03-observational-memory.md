# Spec: Observational Memory

**Status**: Draft
**Created**: 2026-02-21
**Author**: gpt-5.3-codex

## Problem

Operational context is lost when continuous activity from channels and tools is not captured, interpreted for workflow signals, and compressed into durable memory.

## Solution

Use a two-file memory model:

- `HISTORY.md` for timestamped raw observations
- `MEMORY.md` for synthesized durable facts

Cron jobs and observer outputs collect data via skills/CLIs and append to history; heartbeat drives compression and promotion.

## Success Criteria

- [ ] SC-1: Cron-driven observations append structured entries to `HISTORY.md`
- [ ] SC-2: Compression writes key facts to `MEMORY.md` and truncates history safely
- [ ] SC-3: Brain prompt includes `MEMORY.md` context on each turn
- [ ] SC-4: Memory entries carry source trust metadata and preserve provenance for forensic replay
- [ ] SC-5: Untrusted observations cannot directly promote to durable memory without validation/approval rules
- [ ] SC-6: Workflow and blocker observations are captured as typed entries before promotion.
- [ ] SC-7: Promotion rules distinguish informational memory from actionable operational memory.

## Out of Scope

- Embedding/vector retrieval in SLC-1
- Cross-session CRDT memory synchronization

## Technical Approach

- **Store**: File-backed markdown memory in workspace root
- **Mutation**: Atomic append and bounded truncate operations
- **Retrieval**: Basic keyword/regex search in SLC-1
- **Trust boundary**: label entries by source class (trusted, untrusted, system) and gate promotion to `MEMORY.md`
- **Safety controls**: require explicit promotion criteria for instructions that modify policy/tooling behavior
- **Observer intake**: accept structured workflow/blocker events with source references and confidence.
- **Promotion classes**: maintain separate promotion criteria for facts, patterns, and operational warnings.

## Open Questions

1. Trigger compression by size, lines, time, or combined threshold?
2. Keep history snapshots for forensic replay before truncation?
3. Which trust levels are allowed to auto-promote into durable memory in SLC-1?
4. Should blocker observations expire if not re-observed after a time window?
