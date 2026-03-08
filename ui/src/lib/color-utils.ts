/**
 * COLOR UTILITIES
 * ===============
 * CSS variable → THREE.Color conversion helper.
 * Extracted from office-scene.tsx to enable reuse in team-cluster.tsx.
 *
 * KEY CONCEPTS:
 * - Reads CSS custom properties at runtime (no SSR; checks window guard).
 * - Converts oklch() format to HSL-approximate for Three.js consumption.
 *
 * MEMORY REFERENCES:
 * - MEM-0144 refactor: Phase 3b extraction
 */
import * as THREE from "three";

/**
 * Converts a CSS custom property (e.g. "--primary") to a THREE.Color.
 * Handles oklch() format with a simple HSL approximation.
 * Results are not cached — callers should memoize if called in hot paths.
 *
 * MEM-0144: js-cache-function-results applies here; callers should useMemo by CSS var key.
 */
export function getCSSColor(variable: string): THREE.Color {
  if (typeof window === "undefined") return new THREE.Color("#cccccc");

  const root = document.documentElement;
  const value = getComputedStyle(root).getPropertyValue(variable).trim();

  if (value.startsWith("oklch")) {
    const match = value.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
    if (match) {
      const [, l, c, h] = match;
      const lightness = parseFloat(l);
      const chroma = parseFloat(c);
      const hue = parseFloat(h);

      const s = chroma * 100;
      const hslH = hue;
      const hslL = lightness * 100;

      return new THREE.Color().setHSL(hslH / 360, s / 100, hslL / 100);
    }
  }

  return new THREE.Color(value || "#cccccc");
}
