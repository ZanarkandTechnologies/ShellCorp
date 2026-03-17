/**
 * OVERVIEW TAB HELPERS
 * ====================
 * Deterministic display helpers for compact team roster cards.
 *
 * KEY CONCEPTS:
 * - Compact card previews must keep a stable face palette per employee seed.
 * - Relative update timestamps should stay terse and scan-friendly.
 *
 * USAGE:
 * - Imported by `overview-tab.tsx` for mini avatar previews and update labels.
 *
 * MEMORY REFERENCES:
 * - MEM-0196
 */

import { HAIR_COLORS, PANTS_COLORS, SHIRT_COLORS, SKIN_COLORS } from "../../../constants";

export type AvatarPalette = {
  hair: string;
  skin: string;
  shirt: string;
  pants: string;
};

export function formatRelativeTime(timestamp?: number, now: number = Date.now()): string {
  if (!timestamp || !Number.isFinite(timestamp)) return "No recent update";
  const diff = Math.max(0, now - timestamp);
  if (diff < 60_000) return "Updated just now";
  if (diff < 3_600_000) return `Updated ${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `Updated ${Math.floor(diff / 3_600_000)}h ago`;
  return `Updated ${Math.floor(diff / 86_400_000)}d ago`;
}

export function pickStableColor(seed: string, palette: readonly string[]): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return palette[hash % palette.length] ?? palette[0] ?? "#888888";
}

export function resolvePreviewPalette(seed: string): AvatarPalette {
  return {
    hair: pickStableColor(`${seed}:hair`, HAIR_COLORS),
    skin: pickStableColor(`${seed}:skin`, SKIN_COLORS),
    shirt: pickStableColor(`${seed}:shirt`, SHIRT_COLORS),
    pants: pickStableColor(`${seed}:pants`, PANTS_COLORS),
  };
}
