# Spec: Logging

**Status**: Draft
**Created**: 2026-02-21
**Author**: gpt-5.3-codex

## Problem

Without structured logs, autonomous workflows are not replayable, auditable, or diagnosable.

## Solution

Introduce a provider-swappable `LogSink` with local file logging in SLC-1 and Convex-backed logging in SLC-2.

## Success Criteria

- [ ] SC-1: Gateway writes structured events for agent, channel, and cron activity
- [ ] SC-2: File log sink persists daily JSONL logs under `~/.fahrenheit/audit/`
- [ ] SC-3: Switching to `ConvexLogSink` requires no caller changes

## Out of Scope

- Full observability pipeline (OTel traces/metrics)
- SIEM integration

## Technical Approach

- **Interface**: `LogSink` with typed methods
- **Sinks**: `FileLogSink`, `ConsoleLogSink`, `ConvexLogSink` (stub for SLC-1)
- **Schema**: stable event envelope with timestamp, kind, source, payload

## Open Questions

1. Should logs redact sensitive args by default or configurable policy?
2. Keep one file per day or rotate by size as well?
