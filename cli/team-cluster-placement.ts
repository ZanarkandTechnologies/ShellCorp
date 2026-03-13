/**
 * TEAM CLUSTER PLACEMENT
 * ======================
 * Purpose
 * - Resolve deterministic office anchors for newly created team clusters.
 *
 * KEY CONCEPTS:
 * - Reuse the shared office placement solver instead of inventing a second team-only path.
 * - Preserve a safe fallback only when the search grid is exhausted.
 *
 * USAGE:
 * - resolveNewTeamClusterPosition(existingObjects)
 * - buildNewTeamClusterObject(...)
 *
 * MEMORY REFERENCES:
 * - MEM-0183
 */

import { HALF_FLOOR } from "./constants.js";
import { findFirstOpenPlacement } from "./office-placement.js";
import type { OfficeObjectModel } from "./sidecar-store.js";

const FALLBACK_TEAM_CLUSTER_POSITION: [number, number, number] = [0, 0, 8];

export function resolveNewTeamClusterPosition(
  existingObjects: OfficeObjectModel[],
): [number, number, number] {
  return (
    findFirstOpenPlacement({
      meshType: "team-cluster",
      existingObjects,
      bounds: { halfExtent: HALF_FLOOR },
    }) ?? FALLBACK_TEAM_CLUSTER_POSITION
  );
}

export function buildNewTeamClusterObject(input: {
  existingObjects: OfficeObjectModel[];
  teamId: string;
  name: string;
  description: string;
}): OfficeObjectModel {
  return {
    id: `team-cluster-${input.teamId}`,
    identifier: `team-cluster-${input.teamId}`,
    meshType: "team-cluster",
    position: resolveNewTeamClusterPosition(input.existingObjects),
    rotation: [0, 0, 0],
    metadata: {
      teamId: input.teamId,
      name: input.name,
      description: input.description,
      services: [],
    },
  };
}
