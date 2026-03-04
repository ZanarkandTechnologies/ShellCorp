# Extensions

ShellCorp uses plugin-first extension boundaries with OpenClaw.

## Principles

- Runtime/tool execution stays in OpenClaw plugin contracts.
- ShellCorp focuses on UI mapping, orchestration visibility, and operator workflows.
- Extension write ownership and routing rules must remain explicit.

## Current Extension: Notion Comments Hook

Current workflow is comments-first inbound automation through OpenClaw hooks.

Primary docs:

- `docs/how-to/notion-comment-hook-contract.md`
- `docs/how-to/sc06-kanban-notion-setup.md`

Related durable constraints:

- Notion integration is in-repo plugin-first (`MEM-0102`).
- Notion inbound automation is comments-first via `/hooks/notion` mappings (`MEM-0117`).

## Extension Surface Ownership

- Extension contracts/specs: `docs/specs/**`
- Operational runbooks: `docs/how-to/**`
- Product-level value framing: `docs/features-overview.md`

## Adding Future Extensions

When adding a new extension:

1. Add or update a spec in `docs/specs/`.
2. Add a focused how-to runbook in `docs/how-to/`.
3. Add a short entry in this page with:
   - extension name
   - operator value
   - canonical contract/runbook links
4. Update `docs/features-overview.md` if user-facing value changes.
