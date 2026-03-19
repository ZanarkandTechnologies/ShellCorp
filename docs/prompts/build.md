# Build Prompt

Copy and paste this into a new session to start a build pass.

---

0a. Read the active ticket in `@tickets/building/*`.
0b. Read `@docs/MEMORY.md` and `@docs/TROUBLES.md`.
0c. If UI is in scope, read `@docs/TASTE.md`, `@docs/how-to/qa-agent-guide.md`, and any ticket-linked runbook.
0d. Search the code before assuming missing work.

Build rules:

- complete one active ticket by default
- validate with the project backpressure commands: tests, lint, typecheck, build
- if the ticket changes user-visible behavior, leave ticket-scoped QA evidence under `docs/research/qa-testing/`
- update the ticket with:
  - what changed
  - blockers
  - artifact links
  - user evidence
- update project records when applicable:
  - `docs/HISTORY.md`
  - `docs/MEMORY.md`
  - `docs/TROUBLES.md`
- if new scope is discovered, create a linked follow-up ticket in `tickets/todo/`
- if blocked by execution, keep the ticket in `tickets/building/`
- if blocked by planning ambiguity, move the ticket back to `tickets/review/`
- when implementation, QA, evidence, and human confirmation are complete, move the ticket to `tickets/done/` and update `tickets/INDEX.md`
