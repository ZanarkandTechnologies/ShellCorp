import { describe, expect, it } from "vitest";
import type { OfficeObjectModel } from "./sidecar-store.js";
import {
  buildNewTeamClusterObject,
  resolveNewTeamClusterPosition,
} from "./team-cluster-placement.js";

function makeObject(id: string, meshType: string, position: [number, number, number]): OfficeObjectModel {
  return {
    id,
    identifier: id,
    meshType,
    position,
  };
}

describe("team cluster placement", () => {
  it("uses the first open office slot for the first project cluster", () => {
    expect(resolveNewTeamClusterPosition([])).toEqual([0, 0, 0]);
  });

  it("moves later project clusters to the next deterministic open slot", () => {
    expect(resolveNewTeamClusterPosition([makeObject("cluster-alpha", "team-cluster", [0, 0, 0])])).toEqual([
      -5,
      0,
      -5,
    ]);
  });

  it("builds a new team-cluster object with deterministic metadata and placement", () => {
    expect(
      buildNewTeamClusterObject({
        existingObjects: [makeObject("cluster-alpha", "team-cluster", [0, 0, 0])],
        teamId: "team-proj-beta",
        name: "Beta",
        description: "Second team",
      }),
    ).toEqual({
      id: "team-cluster-team-proj-beta",
      identifier: "team-cluster-team-proj-beta",
      meshType: "team-cluster",
      position: [-5, 0, -5],
      rotation: [0, 0, 0],
      metadata: {
        teamId: "team-proj-beta",
        name: "Beta",
        description: "Second team",
        services: [],
      },
    });
  });
});
