/**
 * OFFICE LAYOUT SAVE
 * ==================
 * Optimistic persistence helper for builder-mode office layout edits.
 *
 * KEY CONCEPTS:
 * - Apply the next office settings locally before the save round-trip completes.
 * - Roll back to the previous settings if the persistence call fails.
 *
 * USAGE:
 * - Import from `office-layout-editor.tsx` when committing a builder stroke.
 *
 * MEMORY REFERENCES:
 * - MEM-0174
 * - MEM-0175
 */

import type { OfficeSettingsModel } from "@/lib/openclaw-types";

export async function saveOfficeSettingsOptimistically(params: {
  previousSettings: OfficeSettingsModel;
  nextSettings: OfficeSettingsModel;
  applyOfficeSettings: (settings: OfficeSettingsModel) => void;
  saveOfficeSettings: (
    settings: OfficeSettingsModel,
  ) => Promise<{ ok: boolean; settings: OfficeSettingsModel; error?: string }>;
}): Promise<{ ok: boolean; settings: OfficeSettingsModel; error?: string }> {
  const { previousSettings, nextSettings, applyOfficeSettings, saveOfficeSettings } = params;
  applyOfficeSettings(nextSettings);
  try {
    const result = await saveOfficeSettings(nextSettings);
    if (!result.ok) {
      applyOfficeSettings(previousSettings);
      return result;
    }
    applyOfficeSettings(result.settings);
    return result;
  } catch (error) {
    applyOfficeSettings(previousSettings);
    throw error;
  }
}
