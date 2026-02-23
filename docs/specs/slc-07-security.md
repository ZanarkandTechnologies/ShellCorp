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
- [ ] SC-4: Runtime defaults are secure-by-default (gateway loopback/private bind, auth required for remote control surfaces)
- [ ] SC-5: Untrusted content is labeled and cannot directly trigger long-term memory/policy mutation without confirmation
- [ ] SC-6: Write operations to external systems enforce confidence/approval gates and produce auditable correlation IDs
- [ ] SC-7: Skill execution enforces outbound network policy (allowlist/denylist) with explicit exceptions

## Out of Scope

- Enterprise IAM/SSO provider integration
- Hardware-backed key management

## Technical Approach

- **Auth**: channel-specific allowlists and optional owner IDs
- **Policy**: allow/deny tool matrix by role session
- **Secrets**: `$ENV_VAR` and optional `!command` resolver with cache
- **Audit**: JSONL log entries with redaction hooks
- **Secure defaults**: loopback/private bind defaults, explicit opt-in for public exposure, and mandatory auth token for non-local control APIs
- **Trust boundaries**: classify sources as trusted/untrusted and require escalation paths before privileged actions
- **Write safety**: confidence threshold + explicit confirmation for low-confidence or high-impact writes
- **Egress control**: per-skill outbound restrictions with environment-scoped policy configuration

## Open Questions

1. Should bash command policy use regex denylist, allowlist, or both?
2. What is the minimum viable egress policy in SLC-1 (global allowlist, per-skill allowlist, or denylist-only)?
3. Which actions are always approval-gated regardless of confidence (e.g. credential rotation, billing/financial writes)?
