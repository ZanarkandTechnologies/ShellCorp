# Plan Prompt

Copy and paste this into a new session to start a planning pass.

---

0a. Study `@docs/prd.md` to understand audience, outcomes, and constraints.  
0b. Study `@docs/specs/*` to learn the application specifications.  
0c. Study `@docs/progress.md` to understand the current ticket board and slice.  
0d. Study `@docs/MEMORY.md` to understand durable constraints.  
0e. Search the codebase before assuming anything is missing.

1. Planning mode: choose the next SLC slice, compare code against `@docs/specs/*`, and update `@docs/progress.md` with a prioritized ticket list (one ticket = one build loop).

2. Keep `@docs/progress.md` current with findings and next steps. Start each slice with a 1-2 sentence summary.

IMPORTANT: Plan only. Do NOT implement. Confirm gaps via code search before creating new tickets/specs.
