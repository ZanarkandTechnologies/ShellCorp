# Group Memory Onboarding Runbook

## Purpose

Onboard a new or existing group into nightly group-centric observational-memory ingestion.

## Preconditions

- Gateway is running and reachable.
- Group exists in `gateway.groups` config.
- Runtime memory is set to DB-first (`runtime.memory.storage = "convex"`).

## Steps

1. Add/verify group source bindings under `gateway.groups.<groupId>.sources`.
2. Reload config (`config.reload`) so cron sync re-applies nightly group jobs.
3. Confirm one cron job exists: `group:<groupId>:daily-rollup`.
4. Trigger a dry check with RPC:
   - `group.rollup.aggregate` with `{ "groupId": "<groupId>" }`
5. Inspect memory APIs:
   - `/memory/observations?projectId=<projectId>&groupId=<groupId>`
   - `/memory/stats?projectId=<projectId>&groupId=<groupId>`
   - `/memory/rollups`

## Validation Checklist

- Nightly rollup job exists and is enabled.
- Observations written with required `projectId`, `groupId`, and `sessionKey`.
- Low-confidence entries appear as `pending_review`.
- No cross-project/group leakage when filtering by both keys.

## Troubleshooting

- No observations: verify source bindings and ingest metadata carry `projectId` + `groupId`.
- Missing cron job: run config reload and inspect `/cron/list`.
- Writes not persisted: validate Convex deployment URL/auth token.
