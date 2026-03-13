"use client";

/**
 * OFFICE OBJECT UI CONTRACT
 * =========================
 * Typed metadata helpers for office-object runtime interactions.
 *
 * KEY CONCEPTS:
 * - Preserves backward-compatible `metadata` storage
 * - Normalizes embed-first `uiBinding` state
 * - Reserves future `skillBinding` support without changing persistence shape
 *
 * USAGE:
 * - Parse object metadata before runtime click routing
 * - Build object metadata payloads before save/upsert flows
 *
 * MEMORY REFERENCES:
 * - MEM-0142
 */

export type OfficeObjectUiBinding =
  | { kind: "none" }
  | {
      kind: "embed";
      title: string;
      url: string;
      openMode: "panel";
      aspectRatio?: "wide" | "square" | "tall";
    };

export type OfficeObjectSkillBinding = {
  skillId: string;
  label?: string;
  effectMode?: "fixed" | "random";
  effectVariant?: "ghost" | "blink";
  effectPool?: Array<"ghost" | "blink">;
} | null;

export interface OfficeObjectInteractionConfig {
  displayName?: string;
  uiBinding: OfficeObjectUiBinding;
  skillBinding: OfficeObjectSkillBinding;
}

const DEFAULT_UI_BINDING: OfficeObjectUiBinding = { kind: "none" };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAspectRatio(value: unknown): "wide" | "square" | "tall" | undefined {
  return value === "wide" || value === "square" || value === "tall" ? value : undefined;
}

function isSkillEffectVariant(value: unknown): value is "ghost" | "blink" {
  return value === "ghost" || value === "blink";
}

export function normalizeHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function parseOfficeObjectUiBinding(
  metadata: Record<string, unknown> | undefined,
): OfficeObjectUiBinding {
  const raw = metadata?.uiBinding;
  if (!isPlainObject(raw)) return DEFAULT_UI_BINDING;
  if (raw.kind !== "embed") return DEFAULT_UI_BINDING;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const url = typeof raw.url === "string" ? normalizeHttpUrl(raw.url) : null;
  if (!title || !url) return DEFAULT_UI_BINDING;
  return {
    kind: "embed",
    title,
    url,
    openMode: "panel",
    aspectRatio: normalizeAspectRatio(raw.aspectRatio),
  };
}

export function parseOfficeObjectSkillBinding(
  metadata: Record<string, unknown> | undefined,
): OfficeObjectSkillBinding {
  const raw = metadata?.skillBinding;
  if (!isPlainObject(raw)) return null;
  if (typeof raw.skillId !== "string" || !raw.skillId.trim()) return null;
  const effectMode =
    raw.effectMode === "fixed" || raw.effectMode === "random" ? raw.effectMode : undefined;
  const effectVariant = isSkillEffectVariant(raw.effectVariant) ? raw.effectVariant : undefined;
  const effectPool = Array.isArray(raw.effectPool)
    ? raw.effectPool.filter(isSkillEffectVariant)
    : undefined;
  return {
    skillId: raw.skillId.trim(),
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : undefined,
    effectMode,
    effectVariant,
    effectPool: effectPool && effectPool.length > 0 ? [...new Set(effectPool)] : undefined,
  };
}

export function parseOfficeObjectInteractionConfig(
  metadata: Record<string, unknown> | undefined,
): OfficeObjectInteractionConfig {
  const displayName =
    typeof metadata?.displayName === "string" && metadata.displayName.trim()
      ? metadata.displayName.trim()
      : undefined;
  return {
    displayName,
    uiBinding: parseOfficeObjectUiBinding(metadata),
    skillBinding: parseOfficeObjectSkillBinding(metadata),
  };
}

export function hasOfficeObjectRuntimeUi(metadata: Record<string, unknown> | undefined): boolean {
  return parseOfficeObjectUiBinding(metadata).kind === "embed";
}

export function buildOfficeObjectMetadata(
  metadata: Record<string, unknown> | undefined,
  next: OfficeObjectInteractionConfig,
): Record<string, unknown> {
  const base = metadata ? { ...metadata } : {};
  if (next.displayName) {
    base.displayName = next.displayName;
  } else {
    delete base.displayName;
  }
  base.uiBinding = next.uiBinding;
  if (next.skillBinding) {
    base.skillBinding = next.skillBinding;
  } else {
    delete base.skillBinding;
  }
  return base;
}
