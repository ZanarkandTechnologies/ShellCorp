# Skills Module Contract

## Purpose

Define how repo-local skills are structured and how their examples are kept executable.

## Invariants

- Every production skill folder must contain a `SKILL.md` (or legacy `skill.md` until migrated).
- Prefer splitting workflow skills from tool skills when discovery and progressive disclosure differ.
- Skills that drive ShellCorp CLI behavior should prefer executable examples over prose-only examples.
- Skill contract tests live beside the skill under `tests/*.md`.
- Skill tests should exercise stable CLI workflows only; they must not depend on network access.
- Rich reasoning belongs in `SKILL.md`; executable procedures belong in markdown test cases.

## Testing

- Run all skill contract tests with `pnpm run test:skills`.
- Add at least one contract test for any new ShellCorp-first operational skill.
- Contract cases should validate observable state, not internal implementation details.

## Conventions

- Use markdown for skill tests so they remain readable to both humans and agents.
- Put one `json skill-test` block in each test markdown file.
- Prefer multi-step procedures over a single opaque command when the workflow matters.
- Reuse existing CLI commands instead of inventing a new harness-specific interface.
