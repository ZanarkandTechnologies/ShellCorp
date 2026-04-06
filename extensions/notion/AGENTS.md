# Notion Extension AGENTS

## Scope

- Owns the in-repo Notion OpenClaw plugin under `extensions/notion`.

## Rules

- Keep Notion ingress plugin-first: the stable production webhook URL is `/plugins/notion-shell/webhook`, not the temporary FastAPI probe.
- Treat the probe server as fixture-capture tooling only; it must not become the long-lived runtime path.
- Inbound comment automation is intentionally narrow: verification challenge, `comment.created`, wake-word filtering, comment lookup, then proxy to OpenClaw `/hooks/agent`.
- Preserve deterministic `hook:notion:` session keys for forwarded comment runs. See `MEM-0154`.
- Prefer small pure helpers with focused tests for signature validation, payload normalization, and dispatch shaping.

## Validation

- Add or update focused Vitest coverage for webhook normalization, signature validation, and dispatch behavior.
- Run `pnpm typecheck:root` and targeted tests after changes in this module.
