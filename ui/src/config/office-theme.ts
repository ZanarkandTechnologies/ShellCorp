/**
 * OFFICE THEME CONFIG
 * ===================
 * Centralized visual tokens for office scene styling and interactions.
 */

export interface OfficeTheme {
  scene: {
    floor: string;
    walls: string;
    background: string;
  };
  lighting: {
    ambient: string;
    directional: string;
    point: string;
  };
  interaction: {
    selectionEdge: string;
    hoverEdge: string;
    dragIndicator: string;
  };
}

export function getOfficeTheme(isDarkMode: boolean): OfficeTheme {
  return {
    scene: {
      floor: "#d9dddc",
      walls: "#d9dddc",
      background: isDarkMode ? "#1a1612" : "#e8dcc4",
    },
    lighting: {
      ambient: "#ffffff",
      directional: "#ffffff",
      point: "#eef2ff",
    },
    interaction: {
      selectionEdge: "#00ff00",
      hoverEdge: "#ffffff",
      dragIndicator: "#ffff00",
    },
  };
}

export const OFFICE_INTERACTION_COLORS = getOfficeTheme(false).interaction;
