# CLI AGENTS

## Scope

- Owns the ShellCorp command-line entrypoints, install/bootstrap flows, and sidecar-facing operator commands.

## Rules

- Reuse shared helpers for repo-root resolution and install/link flows instead of duplicating shell logic across commands.
- Keep operator-facing commands JSON-friendly when they return structured state.
- Treat `npm link` at the repo root as the canonical way to expose the global `shellcorp` alias.
- Agent coordination must stay transport-thin: use native `openclaw agent` for the turn, log one shared timeline breadcrumb, and keep durable work context on board/task or team-memory surfaces instead of creating a second chat store. See `MEM-0211`.
- Onboarding must keep `~/.openclaw/openclaw.json` valid for OpenClaw itself: do not add ShellCorp-only root keys there, and persist ShellCorp runtime state in dedicated sidecars such as `~/.openclaw/shellcorp.json`. See `MEM-0218`, `MEM-0219`.
- Onboarding must verify Convex runtime readiness before UI handoff: if a Convex URL is configured but unreachable, warn in both human and JSON output and do not auto-launch the UI into a broken state. See `MEM-0221`.

## Validation

- Add or update Vitest coverage for CLI behavior changes.
- Run targeted CLI tests first, then repo backpressure checks.
