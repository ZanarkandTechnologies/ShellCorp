# Create Business Team

This contract proves the core team-creation example in the skill still works against the local CLI.

```json skill-test
{
  "name": "create business team",
  "steps": [
    {
      "run": [
        "team",
        "create",
        "--name",
        "Buffalos AI",
        "--description",
        "Team focused on Minecraft mod generation",
        "--goal",
        "Generate and ship high-quality Minecraft mods",
        "--kpi",
        "weekly_shipped_tickets",
        "--kpi",
        "closed_vs_open_ticket_ratio",
        "--auto-roles",
        "builder,pm,growth_marketer"
      ],
      "expect": {
        "companyProjectIdsInclude": ["proj-buffalos-ai"],
        "openclawAgentIdsInclude": ["buffalos-ai-builder", "buffalos-ai-pm", "buffalos-ai-growth"],
        "filesExist": [
          "workspace-buffalos-ai-builder/AGENTS.md",
          "workspace-buffalos-ai-pm/HEARTBEAT.md",
          "workspace-buffalos-ai-growth/SOUL.md"
        ]
      }
    }
  ]
}
```
