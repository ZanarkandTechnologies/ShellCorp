/**
 * UI Z-Index Hierarchy
 * ====================
 * Centralized z-index values for office overlays.
 *
 * Ordering (low -> high):
 * - Scene HUD chrome
 * - 3D context menus
 * - Standard panels/dialogs
 * - Elevated panels (team/session/skills/memory)
 * - Chat and critical confirms
 */
export const UI_Z = {
  sceneHud: 70,
  sceneContextMenu: 300,
  panelBase: 1200,
  panelElevated: 1400,
  chat: 1800,
  critical: 2000,
} as const;

