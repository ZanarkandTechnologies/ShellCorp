import { describe, expect, it } from "vitest";

import { normalizeOfficeObjectId, resolvePersistedOfficeObjectId } from "./office-object-id";

describe("office object id helpers", () => {
  it("normalizes team-cluster id variants to one canonical anchor key", () => {
    expect(normalizeOfficeObjectId("cluster-team-alpha")).toBe("team-anchor:team-alpha");
    expect(normalizeOfficeObjectId("team-cluster-team-alpha")).toBe("team-anchor:team-alpha");
    expect(normalizeOfficeObjectId("office-cluster-team-alpha")).toBe("team-anchor:team-alpha");
  });

  it("resolves synthetic scene team-cluster ids to the persisted current-format id", () => {
    const knownIds = new Set([
      "team-cluster-team-alpha",
      "cluster-team-management",
      "office-plant-1",
    ]);

    expect(resolvePersistedOfficeObjectId("cluster-team-alpha", knownIds)).toBe(
      "team-cluster-team-alpha",
    );
    expect(resolvePersistedOfficeObjectId("team-cluster-team-management", knownIds)).toBe(
      "cluster-team-management",
    );
    expect(resolvePersistedOfficeObjectId("plant-1", knownIds)).toBe("office-plant-1");
  });
});
