# Implementation Plan Prompt

Copy and paste this into a new session to start a planning pass.

---

0a. Study `@docs/prd.md` to understand audience, outcomes, and constraints.
0b. Study `@docs/specs/*` to learn the application specifications.
0c. Study the active ticket in `@tickets/review/*` first; if none exists, inspect `@tickets/todo/*`.
0d. Study `@docs/MEMORY.md` for durable technical constraints.
0e. Study `@docs/TROUBLES.md` for repeated failure patterns that should be avoided in this slice.
0f. If UI or UX is in scope, study `@docs/TASTE.md` and `@docs/how-to/qa-agent-guide.md`.
0g. Search the codebase before assuming anything is missing.
0h. Confirm affected interfaces and nearest module `README.md` + `AGENTS.md` before proposing changes.

1. Planning mode only: produce the next smallest executable slice.
2. Use `skills/tech-impl-plan` output shape.
3. Keep the ticket in `tickets/review/` until human approval.
4. If scope splits, create follow-up tickets in `tickets/todo/` immediately.
5. UI-bearing plans must define `Agent Contract`, `Test hook`, and expected QA artifacts before build starts.

IMPORTANT: Plan only. Do not implement.
