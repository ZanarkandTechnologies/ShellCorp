# Spec: Security

**Status**: Draft
**Created**: 2026-02-21
**Author**: gpt-5.3-codex

## Problem

Persistent operational agents touching real systems require strict controls on who can invoke them, what tools can run, and how secrets are handled.

## Solution

Ship security-first defaults:

- Allowlist-based sender auth
- Tool policy resolution by session/role
- Secret resolution from environment/commands (no plaintext requirement)
- Structured audit trail with sensitive-field redaction

## Success Criteria

- [ ] SC-1: Unauthorized senders are rejected before agent execution
- [ ] SC-2: Tool policy enforcement blocks disallowed tools/commands
- [ ] SC-3: Secrets are resolved without leaking values into logs/prompts

## Out of Scope

- Enterprise IAM/SSO provider integration
- Hardware-backed key management

## Technical Approach

- **Auth**: channel-specific allowlists and optional owner IDs
- **Policy**: allow/deny tool matrix by role session
- **Secrets**: `$ENV_VAR` and optional `!command` resolver with cache
- **Audit**: JSONL log entries with redaction hooks

## Open Questions

1. Should bash command policy use regex denylist, allowlist, or both?
2. Do we need per-skill network egress controls in SLC-1?
