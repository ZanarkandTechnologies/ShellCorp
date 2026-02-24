# Hybrid Connector Onboarding Runbook

## Purpose

Onboard a productivity platform (Notion first) by auto-discovering sources, proposing mappings/skills, and committing approved mappings safely.

## Preconditions

- Connector exists under `ontology.connectors.<connectorId>`.
- Connector has valid API key and `enabled: true`.
- Gateway is reachable.

## Flow

1. Discover accessible sources:
   - RPC: `connector.onboarding.discover`
   - Params: `{ "connectorId": "notion" }`
2. Propose mapping + generated skill artifacts:
   - RPC: `connector.onboarding.propose`
   - Params: `{ "connectorId": "notion", "selectedSourceIds": ["..."] }`
3. Review proposal confidence and unresolved entities.
4. Commit approved database mappings:
   - RPC: `connector.onboarding.commit`
   - Params: `{ "connectorId": "notion", "mappings": [{ "entityType": "task", "databaseId": "..." }] }`
5. Run connector proof:
   - RPC: `connector.bootstrap.prove`
6. Commit proof to memory with partition keys:
   - RPC: `connector.bootstrap.commit`
   - Params include `projectId`, `groupId`, `sessionKey`.

## Validation Checklist

- Discovery returns stable source catalog sorted by title.
- Proposal returns mapping confidence and unresolved entities.
- Commit updates connector entity `databaseId` values.
- Bootstrap proof and commit produce observations with required partition keys.

## Troubleshooting

- Discovery fails: verify connector API key and workspace permissions.
- No mapping match: set `databaseNameHint` per entity and rerun proposal.
- Commit denied: check gateway token and tool allow/deny policy.
