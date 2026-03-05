# Feature: ShellCorp CLI

ShellCorp CLI is the operational surface for team topology and office state in this phase.

## Value

- Create and steer teams without editing raw JSON manually.
- Control heartbeat and role demand with explicit commands.
- Keep operations scriptable with `--json` output where supported.

## CLI Entry

```bash
shellcorp <command>
```

Fallback (if global CLI is not installed in the current environment):

```bash
npm run shell -- <command>
```

## Team Commands

```bash
shellcorp team list
shellcorp team create --name "Alpha" --description "Core team" --goal "Ship roadmap" --kpi weekly_shipped_tickets --auto-roles builder,pm,growth_marketer
shellcorp team update --team-id team-proj-alpha --goal "Reduce backlog" --kpi-add support_reply_sla_minutes
shellcorp team heartbeat set --team-id team-proj-alpha --cadence-minutes 15 --goal "Create or execute relevant tickets from Kanban"
shellcorp team heartbeat render --team-id team-proj-alpha --role biz_pm
shellcorp team role-slot set --team-id team-proj-alpha --role builder --desired-count 2
shellcorp team archive --team-id team-proj-alpha
shellcorp team archive --team-id team-proj-alpha --deregister-openclaw
```

`team create` now also provisions matching OpenClaw runtime agent entries plus bootstrap workspace/session directories so newly created team agents are immediately messageable.

## Business And Resource Commands

```bash
shellcorp team business get --team-id team-proj-affiliate --json
shellcorp team business set --team-id team-proj-affiliate --slot measure --skill-id stripe-revenue
shellcorp team resources list --team-id team-proj-affiliate --json
shellcorp team resources events --team-id team-proj-affiliate --limit 20 --json
shellcorp team resources reserve --team-id team-proj-affiliate --resource-id proj-affiliate:cash --amount 300
shellcorp team resources release --team-id team-proj-affiliate --resource-id proj-affiliate:cash --amount 100
shellcorp team resources remove --team-id team-proj-affiliate --resource-id proj-affiliate:custom
shellcorp team status report --team-id team-proj-affiliate --agent-id affiliate-pm --state planning --status-text "Reviewing board and KPIs" --step-key hb-affiliate-pm-001
shellcorp team bot log --team-id team-proj-affiliate --agent-id affiliate-pm --activity-type status --label heartbeat_decision --detail "Prioritize high-ROI creative test"
```

## Office Commands

```bash
shellcorp office print
shellcorp office list
shellcorp office teams
shellcorp office add plant --position -10,0,-10
shellcorp office add plant --auto-place
shellcorp office add custom-mesh --auto-place --mesh-public-path /openclaw/assets/meshes/dragon.glb --display-name "Dragon"
shellcorp office add team-cluster --auto-place --metadata name=Dragons
shellcorp office doctor
shellcorp office doctor --reason missing_mesh_public_path
shellcorp office doctor --fix
shellcorp office move plant-nw --position 0,0,0
shellcorp office remove plant-nw
shellcorp office theme
shellcorp office theme set cozy
shellcorp office generate "small cactus desk plant" --style low-poly --type prop
```

## Validation And Automation

```bash
shellcorp doctor team-data
shellcorp team list --json
shellcorp doctor team-data --json
```

`doctor team-data` also validates resource integrity (duplicate resource IDs, missing tracker skill IDs, invalid limits, and resource events referencing missing resources).

## Source Of Truth

Commands mutate sidecar data:

- `~/.openclaw/company.json`
- `~/.openclaw/office-objects.json` (when office object metadata is split)

`office add` now supports either explicit coordinates (`--position`) or deterministic empty-space placement (`--auto-place`). Manual and auto flows both reject occupied positions to keep layout state collision-safe.

For UI parity:

- `custom-mesh` now requires mesh metadata (`--mesh-public-path` or equivalent metadata key) so objects render as real meshes instead of placeholders.
- `team-cluster` now auto-attaches to a real project-backed `team-<projectId>` mapping (creating/reviving a project if needed), so the cluster appears as a real team in UI panels.
- `office doctor` audits persisted office objects and reports invalid entries (for example custom meshes missing `meshPublicPath` or clusters mapped to missing/archived teams). Use `--reason <reason>` to target specific issue classes, and `office doctor --fix` to remove the current matched set.

When teams create agents, CLI also provisions OpenClaw runtime surfaces:

- `~/.openclaw/openclaw.json` (`agents.list` entries)
- `~/.openclaw/workspace-<agentId>/` (bootstrap workspace files)
- `~/.openclaw/agents/<agentId>/sessions/` (session store directories)

This is aligned with CLI-first invariants in `MEM-0119`, `MEM-0120`, and `MEM-0123`.

## Related Docs

- Intent cookbook: `docs/how-to/ceo-team-cli-scl-cookbook.md`
- Team CLI skill: `skills/shellcorp-team-cli/SKILL.md`
- Decorations: `docs/feature-decorations.md`
