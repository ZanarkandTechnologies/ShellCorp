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

export const HAIR_COLORS = ["#000000", "#A52A2A", "#D2691E", "#FFD700", "#C0C0C0"];
export const SKIN_COLORS = ["#F5F5DC", "#FFE4C4", "#FFDBAC", "#F5DEB3", "#D2B48C", "#CD853F"];
export const SHIRT_COLORS = ["#FF0000", "#0000FF", "#008000", "#FFFF00", "#FFA500", "#800080", "#FFFFFF", "#808080"];
export const PANTS_COLORS = ["#00008B", "#2F4F4F", "#000000", "#A0522D", "#808080"];

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
