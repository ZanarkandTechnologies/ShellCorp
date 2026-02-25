# HISTORY

2026-02-25 20:10 +0800 | refactor | MEM-0100 | pivot,openclaw,ui | Hard pivot from custom Fahrenheit gateway/runtime to UI-first OpenClaw control center architecture.
2026-02-25 20:12 +0800 | feature | MEM-0101 | docs,specs | Added SC01-SC04 specs for OpenClaw state mapping, Notion plugin packaging, memory/skills UI, and chat bridge.
2026-02-25 20:15 +0800 | feature | MEM-0102 | plugin,notion | Scaffolded in-repo OpenClaw Notion extension under `extensions/notion` with manifest and entrypoint.
2026-02-25 20:18 +0800 | feature | MEM-0103 | ui,adapter | Implemented OpenClaw UI adapter contracts and rewired main app to agents/sessions/timeline/chat bridge with memory/skills views.
2026-02-26 00:10 +0800 | feature | MEM-0104 | topology,ui | Added sidecar company topology model (`workspace/office/company.json`) with departments/projects/roles/tasks/heartbeat profiles and PM channel binding defaults.
2026-02-26 00:10 +0800 | feature | MEM-0105 | adapter,reconciliation | Extended OpenClaw adapter/provider/app with unified model join, desired-vs-active reconciliation warnings, project creation flow, and channel-binding management UI.
