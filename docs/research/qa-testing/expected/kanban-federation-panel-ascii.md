# Expected UI Spec: Kanban Federation Panel (SC06)

## Screen Intent

Provide one operational Kanban view across internal and external providers while clearly exposing source ownership and sync health.

## Components

- Provider filter bar (`internal`, `notion`, `vibe`)
- Global sync status indicator
- Kanban columns (`todo`, `in_progress`, `blocked`, `done`)
- Federated task cards with provider badge + deep link
- Project-level manual resync control

## UX Goal

Operators should immediately understand:

- what work is active,
- where each task comes from,
- whether sync state is healthy or needs intervention.

## Visual Hierarchy

1. Global sync health state
2. Column task distribution
3. Provider/source badge on cards
4. Card secondary actions (deep link, sync details)

## Interaction Expectations

- Provider filters narrow board scope instantly.
- Sync health icon hover/click reveals exact state details.
- Card move/write actions respect canonical provider policy.
- Deep link opens provider-native task record.

## Responsive Expectations

- Desktop: 4-lane board visible side-by-side.
- Tablet: 2x2 lane layout or horizontal lane scroll.
- Mobile: single-lane focus with lane tab switcher.

## Geometry Assertions

```json
[
  {
    "element": "panelHeader",
    "expected_bbox_pct": { "x": [0, 100], "y": [0, 12], "w": [100, 100], "h": [8, 14] },
    "tolerance_pct": 2
  },
  {
    "element": "globalSyncIndicator",
    "expected_bbox_pct": { "x": [78, 100], "y": [2, 12], "w": [10, 22], "h": [4, 10] },
    "tolerance_pct": 2
  },
  {
    "element": "kanbanLane",
    "expected_bbox_pct": { "x": [0, 100], "y": [14, 100], "w": [20, 26], "h": [78, 86] },
    "tolerance_pct": 2
  },
  {
    "element": "taskCardProviderBadge",
    "expected_bbox_pct": { "x": [70, 98], "y": [2, 28], "w": [8, 20], "h": [8, 18] },
    "tolerance_pct": 3
  }
]
```

## ASCII Wireframe

```text
+--------------------------------------------------------------------------------------------------+
| Kanban Federation                                  Filters:[All v]           Sync: HEALTHY [o] |
+--------------------------------------------------------------------------------------------------+
| TODO (3)                 | IN PROGRESS (1)          | BLOCKED (0)             | DONE (12)       |
|--------------------------|--------------------------|-------------------------|-----------------|
| Task A                   | Task B                   |                         | Task C          |
| Owner: Agent-1           | Owner: Agent-7           |                         | Owner: Agent-2  |
| Provider: [Notion]       | Provider: [Vibe]         |                         | Provider:[Int]  |
| [Open] [Sync OK]         | [Open] [Sync Conflict]   |                         | [Open] [OK]     |
|                          |                          |                         |                 |
| Task D                   |                          |                         |                 |
| Owner: Agent-4           |                          |                         |                 |
| Provider: [Internal]     |                          |                         |                 |
| [Open] [Sync Pending]    |                          |                         |                 |
+--------------------------------------------------------------------------------------------------+
```
