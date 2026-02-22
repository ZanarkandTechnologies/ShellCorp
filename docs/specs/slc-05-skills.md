# Spec: Skills

**Status**: Draft
**Created**: 2026-02-21
**Author**: gpt-5.3-codex

## Problem

Agents become brittle if every external system integration requires custom in-process code.

## Solution

Define skills as file-based CLI wrappers:

- `SKILL.md`: behavioral instructions + command patterns
- `config.json`: per-skill environment variables/secrets

The brain reads skill docs and executes commands via bash.

## Success Criteria

- [ ] SC-1: Skill manager discovers skill folders and indexes `SKILL.md`
- [ ] SC-2: Commands execute with skill-scoped env vars from `config.json`
- [ ] SC-3: At least one default skill works end-to-end in SLC-1

## Out of Scope

- MCP-native tool adapter layer
- Skill marketplace/distribution

## Technical Approach

- **Discovery**: scan `workspace/skills/*`
- **Config**: resolve `$ENV_VAR` and optional `!command` values
- **Execution**: inject env into bash process for selected skill

## Open Questions

1. Should command allowlists exist per skill?
2. Do we support encrypted local skill config at rest in SLC-1?
