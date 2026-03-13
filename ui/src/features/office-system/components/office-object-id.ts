/**
 * OFFICE OBJECT ID HELPERS
 * ========================
 * Normalizes UI-facing IDs and resolves persisted sidecar IDs.
 */
function stripOfficePrefix(id: string): string {
  return id.startsWith("office-") ? id.slice("office-".length) : id;
}

export function normalizeOfficeObjectId(id: string): string {
  const trimmed = stripOfficePrefix(id.trim());
  if (trimmed.startsWith("cluster-team-")) {
    return `team-anchor:${trimmed.slice("cluster-".length)}`;
  }
  if (trimmed.startsWith("team-cluster-team-")) {
    return `team-anchor:${trimmed.slice("team-cluster-".length)}`;
  }
  return trimmed;
}

function scorePersistedOfficeObjectIdCandidate(candidate: string, input: string): number {
  let score = 0;
  if (candidate === input) score += 100;
  if (candidate.startsWith("team-cluster-")) score += 30;
  if (candidate.startsWith("cluster-team-")) score += 20;
  if (candidate.startsWith("office-")) score += 10;
  if (stripOfficePrefix(candidate) === input) score += 5;
  return score;
}

export function resolvePersistedOfficeObjectId(id: string, knownIds: Set<string>): string {
  const trimmed = id.trim();
  if (knownIds.has(trimmed)) return trimmed;
  const normalized = normalizeOfficeObjectId(trimmed);
  const canonicalMatches = [...knownIds]
    .filter((candidate) => normalizeOfficeObjectId(candidate) === normalized)
    .sort(
      (left, right) =>
        scorePersistedOfficeObjectIdCandidate(right, trimmed) -
        scorePersistedOfficeObjectIdCandidate(left, trimmed),
    );
  if (canonicalMatches[0]) return canonicalMatches[0];
  if (knownIds.has(normalized)) return normalized;
  const prefixed = trimmed.startsWith("office-") ? trimmed : `office-${trimmed}`;
  if (knownIds.has(prefixed)) return prefixed;
  return normalized;
}
