# Spec: Convex App

**Status**: Draft
**Created**: 2026-02-21
**Author**: gpt-5.3-codex

## Problem

The system needs one place to expose logs and control APIs for programmatic integrations and operator visibility.

## Solution

Use one self-hosted Convex app with three modules:

1. Log ingestion/query
2. Programmatic API wrapper over Fahrenheit operations
3. Dashboard data model for visualization

## Success Criteria

- [ ] SC-1: Convex accepts log events from gateway sink
- [ ] SC-2: API endpoints support send message, list/status, cron management
- [ ] SC-3: Dashboard queries stream recent runs and health summaries

## Out of Scope

- Running Pi sessions inside Convex compute
- Replacing local scheduler execution source

## Technical Approach

- **Convex modules**: `logs/`, `api/`, `dashboard/`, optional `memory/`
- **Transport**: Gateway pushes via HTTP client with auth token
- **Boundary**: Convex is wrapper/control plane; VPS remains execution plane

## Open Questions

1. Should API wrapper be direct pass-through or policy-gated command set?
2. Should memory snapshots be mirrored into Convex for visualization?
