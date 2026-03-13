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
 * - Chat
 * - Onboarding overlays that must stay visible during guided modal flows
 * - Critical confirms
 */
export const UI_Z = {
  sceneHud: 70,
  sceneContextMenu: 300,
  panelBase: 1200,
  panelElevated: 1400,
  // Nested dialogs that open on top of panelElevated panels (e.g. task detail modal inside team panel)
  panelModal: 1600,
  chat: 1800,
  onboarding: 1900,
  critical: 2000,
} as const;
