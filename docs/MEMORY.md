# MEMORY

2026-02-25 20:10 +0800 | decision | MEM-0100 | architecture,invariant | OpenClaw is the runtime source of truth; Shell Company focuses on UI mapping, visualization, and operator workflows.
2026-02-25 20:10 +0800 | decision | MEM-0101 | docs,invariant | Canonical docs indexes for this project are OpenClaw Multi-Agent Routing and OpenClaw Plugins pages.
2026-02-25 20:15 +0800 | decision | MEM-0102 | plugins,invariant | Notion integration is delivered as an in-repo OpenClaw extension (`extensions/notion`) instead of internal gateway code.
2026-02-25 20:18 +0800 | decision | MEM-0103 | ui,invariant | UI must preserve office/game visualization and only replace the data layer with OpenClaw state adapters.
2026-02-26 00:10 +0800 | decision | MEM-0104 | topology,invariant | Company/org metadata is stored in sidecar JSON (`workspace/office/company.json`) while OpenClaw runtime config contains only active agents/bindings.
2026-02-26 00:10 +0800 | decision | MEM-0105 | routing,invariant | Customer channel routing defaults to project PM agent, with optional per-channel agent override and reconciliation warnings for unmapped targets.
