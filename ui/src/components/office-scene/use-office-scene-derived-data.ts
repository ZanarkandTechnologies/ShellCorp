/**
 * OFFICE SCENE DERIVED DATA
 * =========================
 * Pure scene data shaping for desks, teams, CEO placement, and employee status overlays.
 *
 * KEY CONCEPTS:
 * - Deterministic helpers keep scene behavior stable across re-renders.
 * - Scene bootstrap and rendering consume pre-shaped data instead of repeating lookups inline.
 *
 * USAGE:
 * - Call `useOfficeSceneDerivedData` from scene composition components.
 * - Use exported pure helpers in focused unit tests.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 */

import { useMemo } from "react";
import type { DeskLayoutData, EmployeeData, TeamData } from "../../lib/types";
import {
  getAbsoluteDeskPosition,
  getDeskRotation,
} from "../../features/office-system/utils/layout";
import type { OfficeSceneViewSettings } from "./view-profile";
import {
  assignRandomStatuses,
  buildDesksByTeamId,
  buildTeamWanderLocks,
} from "./derived-data-utils";
import { getOfficePresentationRotationY } from "./view-profile";

export type OfficeSceneDerivedData = {
  ceoDeskData:
    | (DeskLayoutData & {
        position: [number, number, number];
        rotationY: number;
      })
    | null;
  employeesForScene: Array<EmployeeData & { position: [number, number, number] }>;
  teamById: Map<string, TeamData>;
  desksByTeamId: Map<string, DeskLayoutData[]>;
  teamWanderLocks: Map<string, number | undefined>;
};

export { assignRandomStatuses, buildDesksByTeamId, buildTeamWanderLocks };

export function useOfficeSceneDerivedData(params: {
  teams: TeamData[];
  employees: EmployeeData[];
  desks: DeskLayoutData[];
  officeViewSettings: OfficeSceneViewSettings;
}): OfficeSceneDerivedData {
  const { teams, employees, desks, officeViewSettings } = params;

  const ceoDeskData = useMemo(() => {
    const ceoDesk = desks.find(
      (desk) => desk.id.startsWith("desk-team-management-") || desk.id === "ceo-desk",
    );
    if (!ceoDesk) return null;

    const managementTeam = teams.find((team) => team.name === "Management");
    if (!managementTeam) return null;

    const managementDesks = desks.filter((desk) => desk.id.startsWith("desk-team-management-"));
    const clusterPosition = managementTeam.clusterPosition;

    return {
      ...ceoDesk,
      position: getAbsoluteDeskPosition(clusterPosition, ceoDesk.deskIndex, managementDesks.length),
      rotationY:
        officeViewSettings.viewProfile === "fixed_2_5d"
          ? getOfficePresentationRotationY(officeViewSettings.cameraOrientation)
          : getDeskRotation(ceoDesk.deskIndex, managementDesks.length),
    };
  }, [desks, officeViewSettings.cameraOrientation, officeViewSettings.viewProfile, teams]);

  const teamById = useMemo(() => new Map(teams.map((team) => [team._id, team])), [teams]);
  const desksByTeamId = useMemo(() => buildDesksByTeamId(desks), [desks]);
  const teamWanderLocks = useMemo(() => buildTeamWanderLocks(teams), [teams]);

  const employeesForScene = useMemo(() => {
    return assignRandomStatuses(employees, teamWanderLocks).map((employee) => ({
      ...employee,
      position: employee.initialPosition,
    }));
  }, [employees, teamWanderLocks]);

  return {
    ceoDeskData,
    employeesForScene,
    teamById,
    desksByTeamId,
    teamWanderLocks,
  };
}
