# Tickets Board

Filesystem board for planning and execution.

## Lifecycle

`todo -> review -> building -> done`

- `todo`: raw or newly split work
- `review`: planning and approval
- `building`: approved execution in progress
- `done`: implemented, verified, and human-confirmed

## Rules

- one ticket = one build loop by default
- keep the ticket file updated as the source of truth
- use `tickets/templates/ticket.md`
- update `tickets/INDEX.md` when a ticket moves
- create linked follow-up tickets when scope splits
- UI-bearing tickets must define `Agent Contract` and `Evidence Checklist`

## Canonical References

- Root contract: `AGENTS.md`
- Planning prompt: `docs/prompts/plan.md`
- Build prompt: `docs/prompts/build.md`
- QA guide: `docs/how-to/qa-agent-guide.md`
