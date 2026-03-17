# CLI AGENTS

## Scope

- Owns the ShellCorp command-line entrypoints, install/bootstrap flows, and sidecar-facing operator commands.

## Rules

- Reuse shared helpers for repo-root resolution and install/link flows instead of duplicating shell logic across commands.
- Keep operator-facing commands JSON-friendly when they return structured state.
- Treat `npm link` at the repo root as the canonical way to expose the global `shellcorp` alias.

## Validation

- Add or update Vitest coverage for CLI behavior changes.
- Run targeted CLI tests first, then repo backpressure checks.
