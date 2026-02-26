# Expected UI Spec: Agent Personalization Studio (SC09)

## Screen Intent

Let operators customize an agent's appearance and assets with immediate preview while keeping operational logic separate from cosmetic controls.

## Components

- Agent selector
- Tabs (`appearance`, `assets`, `history`)
- Live preview stage (2D/3D)
- Style preset controls (`voxel`, `pixel_sprite`, `custom_mesh`)
- Color override controls
- Asset catalog grid + apply action
- Upload zone with validation feedback
- Primary actions (`save`, `reset`)

## UX Goal

Operators can safely personalize agents in a few steps with strong feedback:

- pick agent,
- preview changes,
- validate assets,
- save with confidence.

## Visual Hierarchy

1. Live preview stage
2. Style and appearance controls
3. Asset catalog actions
4. Upload and validation status

## Interaction Expectations

- Changing preset updates preview immediately.
- Applying an asset updates preview state instantly.
- Invalid upload surfaces reason and blocks save.
- Save button only enables when form is dirty and valid.

## Responsive Expectations

- Desktop: split pane (preview + control panel).
- Mobile: stacked layout (preview on top, controls below).

## Geometry Assertions

```json
[
  {
    "element": "topToolbar",
    "expected_bbox_pct": { "x": [0, 100], "y": [0, 12], "w": [100, 100], "h": [8, 14] },
    "tolerance_pct": 2
  },
  {
    "element": "livePreviewStage",
    "expected_bbox_pct": { "x": [0, 62], "y": [12, 84], "w": [44, 64], "h": [48, 74] },
    "tolerance_pct": 3
  },
  {
    "element": "controlSidebar",
    "expected_bbox_pct": { "x": [56, 100], "y": [12, 84], "w": [32, 46], "h": [48, 74] },
    "tolerance_pct": 3
  },
  {
    "element": "uploadZone",
    "expected_bbox_pct": { "x": [0, 100], "y": [84, 100], "w": [100, 100], "h": [12, 20] },
    "tolerance_pct": 2
  }
]
```

## ASCII Wireframe

```text
+--------------------------------------------------------------------------------------------------+
| Agent: [Alice v]     [Appearance] [Assets] [History]                             [Save] [Reset]|
+--------------------------------------------------------------------------------------------------+
|                                       |                                                        |
|               LIVE PREVIEW            | Style Preset                                           |
|              (3D/2D stage)            | (o) Voxel   ( ) Pixel Sprite   ( ) Custom Mesh        |
|                                       |--------------------------------------------------------|
| [Rotate] [Zoom] [Reset Camera]        | Color Overrides                                        |
|                                       | Hair:[#]  Skin:[#]  Shirt:[#]  Pants:[#]              |
|                                       |--------------------------------------------------------|
|                                       | Asset Catalog                                          |
|                                       | [Thumb] [Thumb] [Thumb] [Thumb]                        |
|                                       | [Apply] [Apply] [Apply] [Apply]                        |
|                                       | Validation: [Healthy]                                  |
+--------------------------------------------------------------------------------------------------+
| Upload Assets (.glb/.png/.jpg)  [Drop Here] [Browse]     Status: Ready / Error Details         |
+--------------------------------------------------------------------------------------------------+
```
