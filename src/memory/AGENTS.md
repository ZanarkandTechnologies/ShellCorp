# Memory Module Guide

This module owns Fahrenheit's observational memory storage and promotion logic.

## Responsibilities

- Persist append-only observation events into `HISTORY.md`.
- Promote trusted/system observations into curated `MEMORY.md`.
- Run bounded compression with replay-safe snapshots.
- Keep project/role partition metadata on every observation record.

## Invariants

- Observation events are workflow deltas, never full source record clones.
- Untrusted observations never auto-promote under default policy.
- Compression snapshots history before truncation.

## Tests

- `src/memory/store.test.ts`
- `src/memory/pipeline.test.ts`
