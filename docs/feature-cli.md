# Feature: ShellCorp CLI

ShellCorp CLI is the operational surface for team topology and office state in this phase.

## Value

- Create and steer teams without editing raw JSON manually.
- Control heartbeat and role demand with explicit commands.
- Keep operations scriptable with `--json` output where supported.

## CLI Entry

```bash
npm run shell -- <command>
```

## Team Commands

```bash
npm run shell -- team list
npm run shell -- team create --name "Alpha" --description "Core team" --goal "Ship roadmap" --kpi weekly_shipped_tickets --auto-roles builder,pm,growth_marketer
npm run shell -- team update --team-id team-proj-alpha --goal "Reduce backlog" --kpi-add support_reply_sla_minutes
npm run shell -- team heartbeat set --team-id team-proj-alpha --cadence-minutes 15 --goal "Create or execute relevant tickets from Kanban"
npm run shell -- team role-slot set --team-id team-proj-alpha --role builder --desired-count 2
npm run shell -- team archive --team-id team-proj-alpha
```

## Office Commands

```bash
npm run shell -- office print
npm run shell -- office list
npm run shell -- office teams
npm run shell -- office add plant --position -10,0,-10
npm run shell -- office move plant-nw --position 0,0,0
npm run shell -- office remove plant-nw
npm run shell -- office theme
npm run shell -- office theme set cozy
npm run shell -- office generate "small cactus desk plant" --style low-poly --type prop
```

## Validation And Automation

```bash
npm run shell -- doctor team-data
npm run shell -- team list --json
npm run shell -- doctor team-data --json
```

## Source Of Truth

Commands mutate sidecar data:

- `~/.openclaw/company.json`
- `~/.openclaw/office-objects.json` (when office object metadata is split)

This is aligned with CLI-first invariants in `MEM-0119` and `MEM-0120`.

## Related Docs

- Intent cookbook: `docs/how-to/ceo-team-cli-scl-cookbook.md`
- Team CLI skill: `skills/shellcorp-team-cli/SKILL.md`
- Decorations: `docs/feature-decorations.md`
