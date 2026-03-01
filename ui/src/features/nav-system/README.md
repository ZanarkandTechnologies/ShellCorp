# Navigation System

> **Feature Status**: Active
> **Last Updated**: Dec 2025

## Overview

The Navigation System provides pathfinding algorithms and navigation components for employees and objects in the 3D office environment.

## Architecture

Combined `lib/pathfinding` + `components/navigation` into a unified feature module.

**Structure**:
- **Pathfinding Algorithms** (`pathfinding/`): Core pathfinding logic
- **Navigation Components** (`components/`): React components for navigation visualization

## Components

### Pathfinding Algorithms

Core pathfinding algorithms for calculating routes through the office space.

**Location**: `pathfinding/`

**Features**:
- Grid-based pathfinding
- Obstacle avoidance
- Multi-level navigation support

### Navigation Components

React components for visualizing and managing navigation.

**Location**: `components/`

**Features**:
- Path visualization
- Navigation controls
- Route planning UI

## Integration Points

Used by:
- `components/office-scene.tsx` - Main office scene
- `features/office-system/components/employee.tsx` - Employee movement
- `hooks/use-drag-drop.ts` - Drag and drop interactions
- `components/debug/*` - Debug visualization
- `lib/types.ts` - Type definitions

## File Structure

```
features/nav-system/
├── README.md              # This file
├── index.ts               # Public API exports
├── pathfinding/           # Pathfinding algorithms
└── components/            # Navigation components
```

---

## Migration History

**Refactored**: Combined `lib/pathfinding` + `components/navigation` → `features/nav-system`
- Moved pathfinding algorithms to `features/nav-system/pathfinding/`
- Moved navigation components to `features/nav-system/components/`
- Updated all imports (7 files)
- Created public API (`features/nav-system/index.ts`)
- Removed old directories

---

## Related Systems

- **Office System** (`features/office-system/`): Uses navigation for employee movement
- **Interactive Objects** (`features/office-system/components/interactive-object.tsx`): Uses pathfinding for object placement

