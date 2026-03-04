# Project Rules: ShellCorp

This file defines project-specific technical rules, stack details, and execution conventions.

## Tech Stack

- Framework: Node.js CLI + gateway runtime
- Language: TypeScript (strict)
- Database/Backend: OpenClaw gateway/state bridge integration
- Package Manager: npm
- Test Runner: Vitest

## Folder Structure

- `src/`: main source code
- `workspace/`: runtime prompts, skills, and provider scaffolds
- `docs/`: canonical project state (`prd.md`, `specs/*`, `progress.md`, `HISTORY.md`, `MEMORY.md`)
- `ui/src/lib/`: OpenClaw integration adapters and gateway clients

## Conventions

- Naming: camelCase for functions/variables, PascalCase for types/classes
- Testing: colocated Vitest tests (`*.test.ts`) for behavior changes
- Validation: pass `test`, `typecheck`, and `build` before merge
- Security: treat inbound channel payloads as untrusted; keep secrets in env/secret resolvers

## Quick Commands

```bash
# Install dependencies
npm install

# Run gateway
npm run gateway

# Run tests
npm run test:once

# Typecheck
npm run typecheck

# Build
npm run build
```
