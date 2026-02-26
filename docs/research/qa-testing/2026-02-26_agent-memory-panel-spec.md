# Agent Memory Panel Expected UI Spec

## Screen Intent

- Provide a per-employee memory viewer for file-backed OpenClaw memory (`MEMORY.md` and `memory/*.md`) in the office scene workflow.
- Keep the panel read-only for MVP while exposing a clear path to graph-based memory exploration.

## Components

- `AgentMemoryPanel` modal container with focus trap and dismiss controls.
- Header region with employee name + agent id badge.
- Tab navigation: `List`, `Search`, `Graph`.
- `List` tab with scrollable memory rows, source badges, line numbers, and optional metadata chips (`type`, `memId`, `tags`).
- `Search` tab with query input and filtered result list.
- `Graph` tab placeholder card for future knowledge graph surface.

## ASCII Layout (Desktop)

```text
+------------------------------------------------------------------+
| Agent Name Memory                                 [agent-id] [X] |
+------------------------------------------------------------------+
| [ List ] [ Search ] [ Graph ]                                   |
+------------------------------------------------------------------+
|                                                                  |
|  List/Search Body (scrollable)                                  |
|  +------------------------------------------------------------+  |
|  | sourcePath | Ln | type | MEM-#### | timestamp             |  |
|  | memory row text...                                         |  |
|  +------------------------------------------------------------+  |
|  | ...                                                        |  |
|                                                                  |
+------------------------------------------------------------------+
```

## Layout Assertions

```json
[
  {
    "element": "memoryModal",
    "expected_bbox_pct": { "x": [12, 20], "y": [5, 12], "w": [65, 80], "h": [78, 92] },
    "tolerance_pct": 2
  },
  {
    "element": "tabNavigation",
    "expected_bbox_pct": { "x": [16, 24], "y": [14, 22], "w": [30, 48], "h": [4, 8] },
    "tolerance_pct": 2
  },
  {
    "element": "memoryContentArea",
    "expected_bbox_pct": { "x": [16, 24], "y": [22, 30], "w": [58, 72], "h": [52, 66] },
    "tolerance_pct": 2
  }
]
```

## Behavior Assertions

- Clicking employee context `Memory` opens the modal for the selected employee.
- `List` tab renders entries when rows exist; otherwise shows explicit empty state copy.
- `Search` tab filters by text, source path, `MEM-` ids, and tags.
- `Graph` tab renders a placeholder with no runtime errors.
- Modal closes via close button, outside click, and `Esc`, returning control to office interactions.
