import { describe, expect, it } from "vitest";

import { normalizeOfficeObjectId, resolvePersistedOfficeObjectId } from "./office-object-id";

describe("interactive object id resolution", () => {
  it("normalizes office-prefixed ids", () => {
    expect(normalizeOfficeObjectId("office-plant-1")).toBe("plant-1");
    expect(normalizeOfficeObjectId("plant-1")).toBe("plant-1");
  });

  it("matches normalized id when sidecar stores raw ids", () => {
    const knownIds = new Set(["plant-1", "couch-1"]);
    expect(resolvePersistedOfficeObjectId("office-plant-1", knownIds)).toBe("plant-1");
  });

  it("keeps legacy prefixed id when sidecar already stores prefixed ids", () => {
    const knownIds = new Set(["office-plant-1", "office-couch-1"]);
    expect(resolvePersistedOfficeObjectId("office-plant-1", knownIds)).toBe("office-plant-1");
    expect(resolvePersistedOfficeObjectId("plant-1", knownIds)).toBe("office-plant-1");
  });

  it("falls back to normalized id when unknown", () => {
    const knownIds = new Set<string>();
    expect(resolvePersistedOfficeObjectId("office-bookshelf-2", knownIds)).toBe("bookshelf-2");
  });
});
