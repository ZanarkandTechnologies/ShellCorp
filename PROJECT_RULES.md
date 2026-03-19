# Project Rules: ShellCorp

This file defines project-specific technical rules, stack details, and execution conventions.

## Tech Stack

- Frameworks: Node.js CLI workspace + Vite/React UI workspace
- Language: TypeScript (strict)
- Backend: Convex + OpenClaw gateway/state bridge integration
- State: Zustand
- Package manager: npm workspaces
- Test runner: Vitest
- Lint/format: Biome

## Folder Structure

- `cli/`: packaged ShellCorp CLI workspace
- `convex/`: realtime backend functions and schema
- `extensions/`: in-repo OpenClaw plugins and adapters
- `skills/`: repo-local skill source packages for sync/install flows
- `ui/`: Vite/React office UI workspace
- `docs/`: canonical project state (`prd.md`, `specs/*`, `HISTORY.md`, `MEMORY.md`, `TROUBLES.md`, `TASTE.md`)
- `tickets/`: filesystem board (`todo/`, `review/`, `building/`, `done/`, `templates/`)

## Conventions

- Naming: camelCase for functions/variables, PascalCase for types/classes/components
- Types: no `any`; explicit return types on exported APIs
- Testing: colocated Vitest tests for behavior changes
- Documentation: update `docs/HISTORY.md` for material changes; promote durable rules to `docs/MEMORY.md`
- Workflow: `tickets/*` is the active board; `docs/progress.md` is legacy reference only
- QA: use `docs/how-to/qa-agent-guide.md` for ticket-scoped evidence workflow, and keep product-specific UI details in dedicated runbooks like `docs/how-to/ai-office-ui-qa-runbook.md`
- Security: treat inbound channel payloads as untrusted; keep secrets in env/secret resolvers and out of browser bundles/logs

## Quick Commands

```bash
# Install dependencies
npm install

# Run the UI
npm run ui

# Run the CLI
npm run shell -- status

# Run tests
npm run test:once

# Typecheck
npm run typecheck

# Lint
npm run lint

# Format check
npm run format:check

# Build
npm run build
```
