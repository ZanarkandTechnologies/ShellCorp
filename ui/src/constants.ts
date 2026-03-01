import * as THREE from "three";

export const CYLINDER_HEIGHT = 0.8;
export const DESK_WIDTH = 2;
export const DESK_DEPTH = 1;
export const DESK_HEIGHT = 0.5;
export const COMPUTER_HEIGHT = 0.4;
export const EMPLOYEE_RADIUS = 0.2;
export const WALL_HEIGHT = 2.5;
export const WALL_THICKNESS = 0.2;
export const FLOOR_SIZE = 35;
export const FLOOR_SIZE_FOR_DECOR = 35;
export const HALF_FLOOR = FLOOR_SIZE_FOR_DECOR / 2;

// OpenClaw lobster-themed color palette
export const HAIR_COLORS = ["#FF4500", "#FF6347", "#E84020", "#D4380D", "#CC3300"]; // Shell crown accents
export const SKIN_COLORS = ["#E8512B", "#FF5722", "#FF6B3D", "#F44336", "#D84315"]; // Shell reds/oranges (head)
export const SHIRT_COLORS = ["#CC2200", "#D4380D", "#E84020", "#B71C1C", "#C62828", "#DD2C00", "#BF360C", "#E65100"]; // Deep red/orange (body)
export const PANTS_COLORS = ["#8B1A1A", "#7B1818", "#6D1515", "#5D1212", "#4E0F0F"]; // Dark crimson (legs)

// Distinct team plumbob colors (high contrast against red/orange lobster bodies)
export const TEAM_PLUMBOB_COLORS = [
  "#00E676", // Green (classic Sims)
  "#2979FF", // Blue
  "#AA00FF", // Purple
  "#00E5FF", // Cyan
  "#FFD600", // Gold
  "#FF4081", // Pink
  "#76FF03", // Lime
  "#FF9100", // Amber
];

export const BODY_WIDTH = EMPLOYEE_RADIUS * 2;
export const LEG_HEIGHT = 0.35;
export const BODY_HEIGHT = 0.35;
export const HEAD_HEIGHT = 0.2;
export const HAIR_HEIGHT = 0.05;
export const TOTAL_HEIGHT = LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT + HAIR_HEIGHT;
export const HEAD_WIDTH = BODY_WIDTH * 0.8;
export const HAIR_WIDTH = HEAD_WIDTH * 1.05;

export const IDLE_DESTINATIONS: THREE.Vector3[] = [
  new THREE.Vector3(0, 0, -HALF_FLOOR + 2),
  new THREE.Vector3(-5, 0, -HALF_FLOOR + 2),
  new THREE.Vector3(5, 0, -HALF_FLOOR + 2),
  new THREE.Vector3(10.25, 0, -HALF_FLOOR + 2),
  new THREE.Vector3(-10.25, 0, -HALF_FLOOR + 1),
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(10, 0, 10),
  new THREE.Vector3(-10, 0, 10),
];
