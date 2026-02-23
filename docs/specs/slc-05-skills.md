# Spec: Skills

**Status**: Draft
**Created**: 2026-02-21
**Author**: gpt-5.3-codex

## Problem

Agents become brittle if every external system integration requires manual in-process code or static hand-authored wrappers that cannot adapt to each company's tool setup.

## Solution

Define a hybrid skill model:

- **Static skills**: file-based wrappers (`SKILL.md` + `config.json`) for stable operations
- **Generated skills/pipelines**: produced from text-defined integration descriptions and ontology mappings

The runtime can execute both static and generated skills through one policy-checked interface.

## Success Criteria

- [ ] SC-1: Skill manager discovers skill folders and indexes `SKILL.md`
- [ ] SC-2: Commands execute with skill-scoped env vars from `config.json`
- [ ] SC-3: At least one default skill works end-to-end in SLC-1
- [ ] SC-4: Production mode defaults to trusted/internal skills only; untrusted skills require explicit enablement
- [ ] SC-5: Skill execution is policy-checked (tool allowlists and optional network egress policy)
- [ ] SC-6: Text-defined provider descriptions can compile into generated callable skills/pipelines
- [ ] SC-7: Generated skills include provenance metadata (source description, mapping confidence, generated timestamp)
- [ ] SC-8: Generated skills pass the same policy and redaction constraints as static skills before execution

## Out of Scope

- MCP-native tool adapter layer
- Skill marketplace/distribution
- Fully autonomous self-modifying runtime code generation without approval controls

## Technical Approach

- **Discovery**: scan `workspace/skills/*`
- **Config**: resolve `$ENV_VAR` and optional `!command` values
- **Generation**: compile text mapping artifacts into skill manifests and command templates
- **Registry**: unify static and generated skill descriptors behind one lookup API
- **Execution**: inject env into bash process for selected skill/pipeline
- **Trust model**: classify skills by trust level and enforce execution constraints by default
- **Auditability**: log skill invocation metadata, policy decisions, and blocked attempts
- **Versioning**: generated skills are immutable per version and can be regenerated/replaced explicitly

## Open Questions

1. Should command allowlists exist per skill?
2. Do we support encrypted local skill config at rest in SLC-1?
3. What minimum metadata is required before a skill is considered trusted (owner, signature/hash, reviewed timestamp)?
4. Should generated skills be stored as files, database records, or both?
5. What confidence threshold should block auto-generation for write-capable skills?
