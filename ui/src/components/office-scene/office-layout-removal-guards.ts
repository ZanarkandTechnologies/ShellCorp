/**
 * OFFICE LAYOUT REMOVAL GUARDS
 * ============================
 * Builder-mode dependency checks for removing persisted office floor tiles.
 *
 * KEY CONCEPTS:
 * - Tile removal must validate against the freshest persisted object anchors, not a stale provider snapshot.
 * - Team-cluster positions are derived from the same sidecar objects, so cluster anchors need the same reconciliation.
 *
 * USAGE:
 * - Import from `office-layout-editor.tsx` before applying removal strokes.
 *
 * MEMORY REFERENCES:
 * - MEM-0179
 */

import { normalizeOfficeObjectId } from "../../features/office-system/components/office-object-id";
import { isPositionInsideOfficeLayout, type OfficeLayoutModel } from "../../lib/office-layout";
import type { OfficeObjectSidecarModel } from "../../lib/openclaw-types";
import type { OfficeObject, TeamData } from "../../lib/types";

const OBJECT_MARGIN = 1;
const TEAM_CLUSTER_MARGIN = 2;
const TEAM_MARGIN = 3;

function formatMeshTypeLabel(meshType: string): string {
  return meshType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveTeamIdFromPersistedObject(
  object: Pick<OfficeObjectSidecarModel, "id" | "identifier" | "metadata">,
): string | null {
  const metadataTeamId =
    object.metadata && typeof object.metadata.teamId === "string"
      ? object.metadata.teamId.trim()
      : "";
  if (metadataTeamId) return metadataTeamId;
  const candidates = [object.id, object.identifier].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (trimmed.startsWith("cluster-team-")) {
      return trimmed.replace(/^cluster-/, "");
    }
    if (trimmed.startsWith("office-cluster-team-")) {
      return trimmed.replace(/^office-cluster-/, "");
    }
  }
  return null;
}

function resolveTeamIdFromOfficeObject(
  object: Pick<OfficeObject, "_id" | "metadata">,
): string | null {
  const metadataTeamId =
    object.metadata && typeof object.metadata.teamId === "string"
      ? object.metadata.teamId.trim()
      : "";
  if (metadataTeamId) return metadataTeamId;
  const objectId = String(object._id).trim();
  if (objectId.startsWith("cluster-team-")) {
    return objectId.replace(/^cluster-/, "");
  }
  if (objectId.startsWith("team-cluster-team-")) {
    return objectId.replace(/^team-cluster-/, "");
  }
  return null;
}

export function mergeOfficeObjectsWithPersistedPositions(
  officeObjects: OfficeObject[],
  persistedObjects: OfficeObjectSidecarModel[],
): OfficeObject[] {
  const persistedByCanonicalId = new Map<string, OfficeObjectSidecarModel>();
  for (const object of persistedObjects) {
    persistedByCanonicalId.set(normalizeOfficeObjectId(object.id), object);
  }
  return officeObjects.map((object) => {
    const persisted = persistedByCanonicalId.get(normalizeOfficeObjectId(object._id));
    if (!persisted) return object;
    return {
      ...object,
      meshType: persisted.meshType,
      position: persisted.position,
      rotation: persisted.rotation ?? object.rotation,
      scale: persisted.scale ?? object.scale,
      metadata: persisted.metadata ? { ...persisted.metadata } : object.metadata,
    };
  });
}

export function mergeTeamsWithPersistedClusterPositions(
  teams: TeamData[],
  persistedObjects: OfficeObjectSidecarModel[],
): TeamData[] {
  const clusterPositionByTeamId = new Map<string, [number, number, number]>();
  for (const object of persistedObjects) {
    if (object.meshType !== "team-cluster") continue;
    const teamId = resolveTeamIdFromPersistedObject(object);
    if (!teamId) continue;
    clusterPositionByTeamId.set(teamId, object.position);
  }
  return teams.map((team) => {
    const clusterPosition = clusterPositionByTeamId.get(team._id);
    return clusterPosition ? { ...team, clusterPosition } : team;
  });
}

export function getOfficeLayoutRemovalBlockers(input: {
  candidateLayout: OfficeLayoutModel;
  officeObjects: OfficeObject[];
  teams: TeamData[];
  managementAnchor: [number, number, number];
}): {
  objectIds: string[];
  teamIds: string[];
  keepsManagementArea: boolean;
  isValid: boolean;
} {
  const objectIds = input.officeObjects
    .filter(
      (object) =>
        !isPositionInsideOfficeLayout(
          object.position,
          input.candidateLayout,
          object.meshType === "team-cluster" ? TEAM_CLUSTER_MARGIN : OBJECT_MARGIN,
        ),
    )
    .map((object) => String(object._id));

  const blockingTeamObjectIds = new Set(
    input.officeObjects
      .filter((object) => object.meshType === "team-cluster")
      .filter((object) => objectIds.includes(String(object._id)))
      .map((object) => resolveTeamIdFromOfficeObject(object))
      .filter((teamId): teamId is string => Boolean(teamId)),
  );

  const teamIds = input.teams
    .filter(
      (team) =>
        Array.isArray(team.clusterPosition) &&
        !isPositionInsideOfficeLayout(team.clusterPosition, input.candidateLayout, TEAM_MARGIN) &&
        !blockingTeamObjectIds.has(String(team._id)),
    )
    .map((team) => String(team._id));

  const keepsManagementArea = isPositionInsideOfficeLayout(
    input.managementAnchor,
    input.candidateLayout,
    0,
  );

  return {
    objectIds,
    teamIds,
    keepsManagementArea,
    isValid: objectIds.length === 0 && teamIds.length === 0 && keepsManagementArea,
  };
}

export function getNewOfficeLayoutRemovalBlockers(input: {
  baseline: {
    objectIds: string[];
    teamIds: string[];
    keepsManagementArea: boolean;
    isValid: boolean;
  };
  candidate: {
    objectIds: string[];
    teamIds: string[];
    keepsManagementArea: boolean;
    isValid: boolean;
  };
}): {
  objectIds: string[];
  teamIds: string[];
  keepsManagementArea: boolean;
  isValid: boolean;
} {
  const baselineObjectIds = new Set(input.baseline.objectIds);
  const baselineTeamIds = new Set(input.baseline.teamIds);
  const objectIds = input.candidate.objectIds.filter(
    (objectId) => !baselineObjectIds.has(objectId),
  );
  const teamIds = input.candidate.teamIds.filter((teamId) => !baselineTeamIds.has(teamId));
  const introducesManagementBlocker =
    input.baseline.keepsManagementArea && !input.candidate.keepsManagementArea;
  const keepsManagementArea = !introducesManagementBlocker;
  return {
    objectIds,
    teamIds,
    keepsManagementArea,
    isValid: objectIds.length === 0 && teamIds.length === 0 && keepsManagementArea,
  };
}

export function formatOfficeLayoutRemovalBlockers(input: {
  objectIds: string[];
  teamIds: string[];
  keepsManagementArea: boolean;
}): string | null {
  const blockers: string[] = [];
  for (const objectId of input.objectIds) {
    blockers.push(objectId);
  }
  for (const teamId of input.teamIds) {
    blockers.push(teamId);
  }
  if (!input.keepsManagementArea) {
    blockers.push("management-zone");
  }
  if (blockers.length === 0) return null;
  const preview = blockers.slice(0, 3).join(", ");
  return blockers.length > 3 ? `${preview} +${blockers.length - 3} more` : preview;
}

export function describeOfficeLayoutRemovalBlockers(input: {
  blockers: {
    objectIds: string[];
    teamIds: string[];
    keepsManagementArea: boolean;
  };
  officeObjects: OfficeObject[];
  teams: TeamData[];
  persistedObjects: OfficeObjectSidecarModel[];
}): string | null {
  const persistedByCanonicalId = new Map<string, OfficeObjectSidecarModel>();
  for (const object of input.persistedObjects) {
    persistedByCanonicalId.set(normalizeOfficeObjectId(object.id), object);
  }
  const officeObjectById = new Map<string, OfficeObject>();
  for (const object of input.officeObjects) {
    officeObjectById.set(String(object._id), object);
  }
  const teamById = new Map<string, TeamData>();
  for (const team of input.teams) {
    teamById.set(String(team._id), team);
  }

  const labels: string[] = [];
  for (const objectId of input.blockers.objectIds) {
    const persisted = persistedByCanonicalId.get(normalizeOfficeObjectId(objectId));
    const officeObject = officeObjectById.get(objectId);
    const metadata = persisted?.metadata ?? officeObject?.metadata;
    const persistedTeamId =
      persisted && persisted.meshType === "team-cluster"
        ? resolveTeamIdFromPersistedObject(persisted)
        : null;
    const officeTeamId =
      officeObject && officeObject.meshType === "team-cluster"
        ? resolveTeamIdFromOfficeObject(officeObject)
        : null;
    const team = teamById.get(persistedTeamId ?? officeTeamId ?? "");
    const displayName =
      typeof metadata?.displayName === "string" && metadata.displayName.trim().length > 0
        ? metadata.displayName.trim()
        : team
          ? `Team: ${team.name}`
          : typeof persisted?.identifier === "string" && persisted.identifier.trim().length > 0
            ? persisted.identifier.trim()
            : officeObject
              ? formatMeshTypeLabel(officeObject.meshType)
              : "Office Object";
    labels.push(displayName);
  }
  for (const teamId of input.blockers.teamIds) {
    const team = teamById.get(teamId);
    labels.push(`Team: ${team?.name ?? teamId}`);
  }
  if (!input.blockers.keepsManagementArea) {
    labels.push("Management zone");
  }
  if (labels.length === 0) return null;
  const preview = labels.slice(0, 3).join(", ");
  return labels.length > 3 ? `${preview} +${labels.length - 3} more` : preview;
}
