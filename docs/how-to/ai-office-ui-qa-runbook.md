# AI Office UI QA Runbook

QA-facing runbook for browser-agent testing of the ShellCorp AI Office. Documents the Sims-like interaction model, click entrypoints, panel access paths, and builder mode.

## Product Overview

The AI Office is a **Sims-like platform** where you can:

- **Click on characters (employees)** and **objects** in the 3D scene to interact with them
- Use a **radial context menu** that appears above the clicked target
- Access a **global top-left menu** for convenient, test-safe entry to all panels
- Enter **Builder Mode** to place and move objects around the office

The experience is visually driven: a 3D scene with employees, team clusters, furniture, and interactive objects. Most interactions start from a click on an employee or object; the top-left menu provides a global shortcut for QA and power users.

---

## Navigation Prerequisites

| Goal | Prerequisite |
|------|--------------|
| In-world context actions (employee/object radial menu) | Click an employee or object first |
| Global panel access (recommended for QA) | Use the top-left menu button |
| Builder mode (place/move objects) | Toggle Builder Mode from top-left menu |

**QA tip:** For broad coverage, prefer the **top-left menu** as the canonical entrypoint. It exposes the same panels as in-world clicks but does not require 3D hit-testing on employees or objects.

---

## ASCII: High-Level UI Layout

```
+------------------------------------------------------------------+
| [Menu]  top-left speed-dial (expandable)                         |
|                                                                  |
|    +----------------------------------------------------------+  |
|    |                                                          |  |
|    |                    3D OFFICE SCENE                       |  |
|    |         (employees, team clusters, furniture, etc.)       |  |
|    |                                                          |  |
|    |    [Employee]  [Team cluster]  [Plant]  [Couch]  ...      |  |
|    |                                                          |  |
|    |    Click -> radial context menu appears above target      |  |
|    |                                                          |  |
|    +----------------------------------------------------------+  |
|                                                    [Logs] bottom-right |
+------------------------------------------------------------------+

When a panel opens (from menu or in-world click):
+------------------------------------------+
|  Modal / Panel overlay (z-index 1000+)   |
|  e.g. Team Panel, Chat, Manage Agent     |
+------------------------------------------+
```

---

## Top-Left Menu (Global Entrypoint)

Click the **Menu** button (top-left) to expand the speed-dial. Items appear in this order:

| Label | Opens | Notes |
|-------|-------|-------|
| Back to Landing | Navigate to `/` | Exits office |
| Builder Mode | Toggle builder mode | Camera animates to top-down; employees hidden |
| User Tasks | UserTasksPanel modal | |
| Approvals | ApprovalQueue modal | Badge shows pending count when > 0 |
| Team Panel | Global Team Panel | All Teams view; project selector |
| Agent Session Panel | AgentSessionPanel | |
| CEO Chat | Chat with main employee | Opens chat for `employee-main` |
| Recruit Agent | AgentManager modal | May be disabled in OpenClaw-only mode |
| Shop | FurnitureShop modal | Buy/place furniture |
| Manage Teams | TeamManager modal | May be disabled in OpenClaw-only mode |
| Team Directory | TeamDirectory modal | |
| Manage Tools | ToolManager modal | May be disabled in OpenClaw-only mode |
| Skills Panel | SkillsPanel | |
| Manage Skills | SkillManager modal | |
| Settings | SettingsDialog | |

---

## Interaction Flows

### 1. Click on Employee

Clicking a walking employee (or one at a desk) selects them and opens a **radial context menu** with six actions:

| Action | Label | Result |
|--------|-------|--------|
| Chat | Chat | Opens chat dialog with that employee |
| View PC | View PC | Opens View Computer dialog (remote CUA) |
| Manage | Manage | Opens Manage Agent modal (Overview, Goals, Tools, Skills, Agent Loop tabs) |
| Kanban | Kanban | Opens Team Panel with Kanban tab, focused on this agent's tasks |
| Training | Training | Opens Training modal for this agent |
| Memory | Memory | Opens Agent Memory Panel (List/Search/Graph) |

```
        [Chat]
           |
[Memory]--[X]--[View PC]
           |
[Training] [Manage]
           |
        [Kanban]

  (X = close button; radial layout)
```

### 2. Click on Team Cluster

A team cluster is the physical workspace (desks + signboard) for a team.

| Mode | Click Result |
|------|--------------|
| Default | Opens **Team Panel** (Overview tab) for that team |
| Builder | Opens object context menu (Move, Rotate, Delete, Settings) |
| Placement (desk) | Assigns desk to this team; may show capacity error if at max |

Team Panel tabs: **Overview**, **Kanban**, **Projects**, **Communications**.

### 3. Click on Object (Furniture, Plant, etc.)

Clicking a generic office object (plant, couch, bookshelf, pantry, team-cluster in builder mode) opens a **radial context menu**:

| Action | Label | Result |
|--------|-------|--------|
| Move | Move | Hold and drag to reposition (builder mode only) |
| Rotate +90° | Rotate +90° | Rotate object 90° clockwise |
| Rotate -90° | Rotate -90° | Rotate object 90° counter-clockwise |
| Delete | Delete | Delete object (confirmation dialog) |
| Settings | Settings | Team clusters only: opens Team Options dialog |

```
        [Move]
           |
[Rotate-]--[X]--[Rotate+]
           |
      [Delete]
     (or [Settings] for team-cluster)
```

---

## Source-to-Panel Mapping (QA Automation)

Use this table to drive browser-agent tests. Each panel lists all known entrypoints.

| Panel / Dialog | Top-Left Menu | In-World Click |
|----------------|---------------|----------------|
| Team Panel (global) | Team Panel | — |
| Team Panel (team-scoped) | — | Click team cluster (default mode) |
| Team Panel (agent-focused Kanban) | — | Click employee → Kanban |
| Agent Session Panel | Agent Session Panel | — |
| Skills Panel | Skills Panel | — |
| Manage Agent modal | — | Click employee → Manage |
| Agent Memory Panel | — | Click employee → Memory |
| Training modal | — | Click employee → Training |
| Chat dialog | CEO Chat (main only) | Click employee → Chat |
| View Computer dialog | — | Click employee → View PC |
| User Tasks | User Tasks | — |
| Approvals | Approvals | — |
| Recruit Agent | Recruit Agent | — |
| Shop (Furniture) | Shop | — |
| Manage Teams | Manage Teams | — |
| Team Directory | Team Directory | — |
| Manage Tools | Manage Tools | — |
| Manage Skills | Manage Skills | — |
| Settings | Settings | — |
| Team Options dialog | — | Click team cluster (builder) → Settings |

---

## Builder Mode

| Step | Action |
|------|--------|
| Enter | Top-left menu → Builder Mode |
| Effect | Camera animates to top-down view; employees hidden; objects selectable for move/rotate/delete |
| Exit | Top-left menu → Builder Mode (toggle off) |
| During | Floor circles visible on team clusters; placement mode (e.g. desk) can be active from Shop |

**QA assertions:**

- Builder mode on: camera at top-down; no employees; object click shows radial menu
- Builder mode off: camera at perspective; employees visible; team click opens Team Panel
- Placement mode active: menu-driven modals (User Tasks, Shop, etc.) close automatically

---

## ASCII: Interaction Flow

```
                    +------------------+
                    |   QA Start       |
                    +--------+---------+
                             |
                    +--------v--------+
                    | Choose Entry   |
                    +--------+--------+
                             |
        +--------------------+--------------------+
        |                    |                    |
+-------v-------+   +--------v--------+   +-------v-------+
| Top-Left Menu |   | Employee Click  |   | Object Click  |
+-------+-------+   +--------+--------+   +-------+-------+
        |                   |                    |
        v                   v                    v
+---------------+   +---------------+   +---------------+
| Global Panels |   | 6-Action      |   | Move/Rotate/  |
| (all dialogs) |   | Radial Menu   |   | Delete/Settings|
+---------------+   +-------+-------+   +---------------+
                             |
        +--------------------+--------------------+
        |                    |                    |
+-------v-------+   +--------v--------+   +-------v-------+
| Team Panel    |   | Manage Agent    |   | Memory Panel  |
| Chat          |   | Training        |   | View Computer |
| Kanban        |   |                 |   |               |
+---------------+   +----------------+   +---------------+
```

---

## QA Checklist

### Minimal Smoke Path (Menu-First)

1. Open office page
2. Click top-left Menu
3. Open Team Panel → verify Overview/Kanban/Projects/Communications tabs
4. Open Agent Session Panel → verify panel renders
5. Open Skills Panel → verify panel renders
6. Open Settings → verify dialog opens and closes
7. Toggle Builder Mode → verify camera transition and object selection

### Complete Path (In-World Parity)

1. Click an employee → verify 6-action radial (Chat, View PC, Manage, Kanban, Training, Memory)
2. Click Chat → verify chat dialog opens
3. Click Manage → verify Manage Agent modal with tabs
4. Click Kanban → verify Team Panel opens with agent-focused Kanban
5. Click Memory → verify Agent Memory Panel
6. Click a team cluster (default mode) → verify Team Panel opens for that team
7. Enter Builder Mode → click team cluster → verify Settings in radial menu
8. Click furniture/plant → verify Move, Rotate, Delete (and Settings if team-cluster)

---

## References

- Office menu: `ui/src/components/hud/office-menu.tsx`
- Employee context menu: `ui/src/features/office-system/components/employee.tsx`
- Interactive object: `ui/src/features/office-system/components/interactive-object.tsx`
- Team cluster: `ui/src/features/office-system/components/team-cluster.tsx`
- Team panel: `ui/src/features/team-system/components/team-panel.tsx`
- Office menu parity spec: `docs/research/qa-testing/office-menu-parity-spec.md`
