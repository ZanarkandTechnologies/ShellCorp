/**
 * OFFICE OBJECT ID HELPERS
 * ========================
 * Normalizes UI-facing IDs and resolves persisted sidecar IDs.
 */
export function normalizeOfficeObjectId(id: string): string {
  const trimmed = id.trim();
  return trimmed.startsWith("office-") ? trimmed.slice("office-".length) : trimmed;
}

export function resolvePersistedOfficeObjectId(id: string, knownIds: Set<string>): string {
  const trimmed = id.trim();
  if (knownIds.has(trimmed)) return trimmed;
  const normalized = normalizeOfficeObjectId(trimmed);
  if (knownIds.has(normalized)) return normalized;
  const prefixed = trimmed.startsWith("office-") ? trimmed : `office-${trimmed}`;
  if (knownIds.has(prefixed)) return prefixed;
  return normalized;
}
