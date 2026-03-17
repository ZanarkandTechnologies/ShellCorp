# CLI

## Purpose

ShellCorp's command-line entrypoints for onboarding, office management, team workflows, UI launch, and local install/link flows.

## Public API / entrypoints

- `npm run shell -- <command>`
- `shellcorp <command>` after `npm link`
- `npm run cli:reinstall`
- `bash scripts/reinstall-cli.sh`

## Minimal example

```bash
npm run cli:reinstall
shellcorp onboarding --yes
shellcorp team list --json
```

## How to test

```bash
npm run test:once -- cli/cli-install.test.ts cli/onboarding-commands.test.ts
```
