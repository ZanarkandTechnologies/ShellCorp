# Office System

> **Feature Status**: Active
> **Last Updated**: Dec 2025

## Overview

The Office System provides the 3D office environment where employees, teams, and furniture are rendered and interactable. It includes employee visualization, object interaction, and agent management UI.

## Core Components

### Interactive Object System ✅

**Status**: Complete (Nov 22, 2025)

Unified system for furniture and interactive objects in the 3D office.

**Architecture**:

- **`DraggableController`** (`controllers/draggable-controller.ts`): Pure TypeScript class for drag logic
  - Handles raycasting, grid snapping, event management
  - Testable without React
- **`InteractiveObject`** (`components/interactive-object.tsx`): Unified component for furniture/objects
  - Selection, hover, drag, context menu, DB sync
  - Uses DraggableController for drag operations
- **Employee Pattern**: Employees use `ContextMenu` directly (local selection state, no wrapper needed)

**Results**: 822 lines across 4 files → ~390 lines across 2 files (53% reduction)

**Deleted Files**:

- ❌ `draggable-object.tsx` (357 lines)
- ❌ `selectable-wrapper.tsx` (145 lines)
- ❌ `use-drag-drop.ts` (320 lines)
- ❌ `selection-store.ts` (23 lines)

See `.docs/REFACTOR_SUMMARY.md` for full details.

---

### Employee Hover Labels & Team Directory ✅

**Status**: Complete

Added hover labels to employees (similar to teams) and created a Team Directory page accessible from the global speed-dial menu.

**Features**:

- **Employee Hover Labels**: Employees show labels on hover displaying name, job title, and team name
- **Highlighted Employees**: Enhanced styling with ring effect and blue arrow indicator
- **Team Directory Component** (`components/hud/team-directory.tsx`):
  - Search functionality: filter by name, job title, or team
  - Grouped by team for better organization
  - Employee cards show: name, job title, team, CEO badge
  - "Locate" button highlights employee in 3D scene
- **Employee Highlighting System**:
  - Added `highlightedEmployeeId` to app store
  - Highlighted employees show enhanced label with primary color ring
  - Auto-clears after 5 seconds
- **Speed-Dial Integration**: Added "Team Directory" option to global speed-dial menu

**Technical Details**:

- Uses `Html` component from `@react-three/drei` for 3D text overlay
- Employee component receives `jobTitle` and `team` props
- Label positioned above employee using `TOTAL_HEIGHT + 0.5`

**Future Enhancements**:

- [ ] Add camera focus animation when locating employee
- [ ] Add employee status indicators in directory
- [ ] Add filters (by team, by status, etc.)
- [ ] Add employee detail view on click

---

### Agent Management UI ✅

**Status**: Complete (Nov 22, 2025)

Dashboard-style agent management UI for configuring employee agents.

**Component**: `components/manage-agent-dialog.tsx`

**Features**:

- **Overview Tab**: Employee stats and info
- **Tools Tab**: Multi-select tool configuration
- **Skills Tab**: Multi-select skill configuration
- **Prompt Tab**: System prompt editor

**Integration**:

- "Manage" button in employee context menu opens dialog
- Dialog state managed in `app-store.ts`
- Wired through `office/page.tsx`
- Employees link to agent configs via `agentConfigId` field

**Backend Integration**:

- Uses `convex/agents_system/agentConfigs.ts` for CRUD operations
- Links to `toolConfigs` and `skillConfigs` for configuration
- Auto-creates default config if missing when chatting

---

## File Structure

```text
features/office-system/
├── README.md                          # This file
├── index.ts                           # Public API exports
├── definitions.ts                     # Type definitions
├── components/
│   ├── interactive-object.tsx        # Unified furniture/object component
│   ├── employee.tsx                  # Employee 3D component with hover labels
│   ├── manage-agent-dialog.tsx       # Agent management UI
│   └── hud/
│       └── team-directory.tsx        # Team directory component
├── controllers/
│   └── draggable-controller.ts       # Drag logic controller
├── store/                             # Feature-specific stores
├── systems/                           # Systems (lighting, etc.)
└── prefabs/                           # 3D prefabs
```

---

## Integration Points

- **App Store** (`lib/app-store.ts`): Global state for highlighted employees, dialog state
- **Agent System** (`convex/agents_system/`): Agent configurations, tools, skills
- **Chat System** (`features/chat-system/`): Employee DMs use agent configs
- **Team System** (`features/team-system/`): Team directory integration

---

## Related Systems

- **Nav System** (`features/nav-system/`): Pathfinding and navigation for employees
- **Chat System** (`features/chat-system/`): Employee-agent communication
- **Agent System** (`convex/agents_system/`): Agent configuration backend
