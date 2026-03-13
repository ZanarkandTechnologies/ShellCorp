"use client";

/**
 * SKILL EFFECTS
 * =============
 * Deterministic visual-effect selection for skill-bound office activity.
 *
 * KEY CONCEPTS:
 * - Effect choice must stay stable for the lifetime of one activity.
 * - Office objects may choose a fixed effect or a deterministic random pool.
 * - Rendering code consumes the chosen variant; it should not randomize on render.
 *
 * USAGE:
 * - Resolve one effect variant per active agent skill activity.
 *
 * MEMORY REFERENCES:
 * - MEM-0173
 * - MEM-0175
 * - MEM-0176
 */

export type SkillEffectVariant = "ghost" | "blink";
export type SkillEffectMode = "fixed" | "random";

export const DEFAULT_SKILL_EFFECT_VARIANT: SkillEffectVariant = "ghost";
export const DEFAULT_SKILL_EFFECT_POOL: SkillEffectVariant[] = ["ghost", "blink"];

export type SkillEffectConfig = {
  effectMode?: SkillEffectMode;
  effectVariant?: SkillEffectVariant;
  effectPool?: SkillEffectVariant[];
};

export function buildSkillEffectSeed(params: {
  agentId: string;
  skillId: string;
  sessionKey?: string;
}): string {
  return [params.agentId.trim(), params.skillId.trim(), params.sessionKey?.trim() ?? ""]
    .filter(Boolean)
    .join("|");
}

function isSkillEffectVariant(value: unknown): value is SkillEffectVariant {
  return value === "ghost" || value === "blink";
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function normalizeSkillEffectPool(
  pool: SkillEffectVariant[] | undefined,
): SkillEffectVariant[] {
  const normalized = (pool ?? []).filter(isSkillEffectVariant);
  return normalized.length > 0 ? [...new Set(normalized)] : DEFAULT_SKILL_EFFECT_POOL;
}

export function resolveSkillEffectVariant(
  config: SkillEffectConfig | undefined,
  seed: string,
): SkillEffectVariant {
  if (!config?.effectMode || config.effectMode === "fixed") {
    return config.effectVariant && isSkillEffectVariant(config.effectVariant)
      ? config.effectVariant
      : DEFAULT_SKILL_EFFECT_VARIANT;
  }

  const pool = normalizeSkillEffectPool(config?.effectPool);
  const index = hashString(seed) % pool.length;
  return pool[index] ?? DEFAULT_SKILL_EFFECT_VARIANT;
}
