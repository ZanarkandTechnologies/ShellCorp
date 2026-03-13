import { describe, expect, it } from "vitest";

import type { OfficeObjectSidecarModel } from "../../lib/openclaw-types";
import type { OfficeObject, TeamData } from "../../lib/types";

import {
  describeOfficeLayoutRemovalBlockers,
  formatOfficeLayoutRemovalBlockers,
  getNewOfficeLayoutRemovalBlockers,
  getOfficeLayoutRemovalBlockers,
  mergeOfficeObjectsWithPersistedPositions,
  mergeTeamsWithPersistedClusterPositions,
} from "./office-layout-removal-guards";

const fullLayout = {
  version: 1 as const,
  tileSize: 1 as const,
  tiles: [
    "0:0",
    "1:0",
    "2:0",
    "3:0",
    "4:0",
    "0:1",
    "1:1",
    "2:1",
    "3:1",
    "4:1",
    "0:2",
    "1:2",
    "2:2",
    "3:2",
    "4:2",
  ],
};

describe("office layout removal guards", () => {
  it("prefers the latest persisted object position over stale provider state", () => {
    const providerObjects: OfficeObject[] = [
      {
        _id: "plant-1",
        companyId: "company-demo",
        meshType: "plant",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
      },
    ];
    const persistedObjects: OfficeObjectSidecarModel[] = [
      {
        id: "office-plant-1",
        identifier: "plant-1",
        meshType: "plant",
        position: [3, 0, 1],
        rotation: [0, 0, 0],
        metadata: {},
      },
    ];

    const effectiveObjects = mergeOfficeObjectsWithPersistedPositions(
      providerObjects,
      persistedObjects,
    );

    const removingOldTile = getOfficeLayoutRemovalBlockers({
      candidateLayout: {
        ...fullLayout,
        tiles: fullLayout.tiles.filter((tile) => tile !== "0:1"),
      },
      officeObjects: effectiveObjects,
      teams: [],
      managementAnchor: [2, 0, 1],
    });

    expect(removingOldTile.isValid).toBe(true);

    const removingNewTile = getOfficeLayoutRemovalBlockers({
      candidateLayout: {
        ...fullLayout,
        tiles: fullLayout.tiles.filter((tile) => tile !== "3:1"),
      },
      officeObjects: effectiveObjects,
      teams: [],
      managementAnchor: [2, 0, 1],
    });

    expect(removingNewTile.isValid).toBe(false);
    expect(removingNewTile.objectIds).toEqual(["plant-1"]);
  });

  it("updates team anchors from persisted cluster objects", () => {
    const teams: TeamData[] = [
      {
        _id: "team-alpha",
        companyId: "company-demo",
        name: "Alpha",
        description: "Alpha team",
        clusterPosition: [0, 0, 0],
        employees: [],
      },
    ];
    const persistedObjects: OfficeObjectSidecarModel[] = [
      {
        id: "office-cluster-team-alpha",
        identifier: "cluster-team-alpha",
        meshType: "team-cluster",
        position: [2, 0, 1],
        rotation: [0, 0, 0],
        metadata: {},
      },
    ];

    const effectiveTeams = mergeTeamsWithPersistedClusterPositions(teams, persistedObjects);

    expect(effectiveTeams[0]?.clusterPosition).toEqual([2, 0, 1]);
  });

  it("formats blocker details for the builder error message", () => {
    expect(
      formatOfficeLayoutRemovalBlockers({
        objectIds: ["plant-1", "bookshelf-1"],
        teamIds: ["team-alpha", "team-beta"],
        keepsManagementArea: false,
      }),
    ).toBe("plant-1, bookshelf-1, team-alpha +2 more");
  });

  it("describes blockers with readable object and team labels", () => {
    expect(
      describeOfficeLayoutRemovalBlockers({
        blockers: {
          objectIds: ["plant-1"],
          teamIds: ["team-alpha"],
          keepsManagementArea: false,
        },
        officeObjects: [
          {
            _id: "plant-1",
            companyId: "company-demo",
            meshType: "plant",
            position: [1, 0, 1],
            rotation: [0, 0, 0],
          },
        ],
        teams: [
          {
            _id: "team-alpha",
            companyId: "company-demo",
            name: "Alpha",
            description: "Alpha team",
            clusterPosition: [2, 0, 1],
            employees: [],
          },
        ],
        persistedObjects: [
          {
            id: "plant-1",
            identifier: "plant-main",
            meshType: "plant",
            position: [1, 0, 1],
            rotation: [0, 0, 0],
            metadata: {},
          },
        ],
      }),
    ).toBe("plant-main, Team: Alpha, Management zone");
  });

  it("does not double-count a team when its blocking cluster object is already present", () => {
    const blockers = getOfficeLayoutRemovalBlockers({
      candidateLayout: {
        ...fullLayout,
        tiles: fullLayout.tiles.filter((tile) => tile !== "2:1"),
      },
      officeObjects: [
        {
          _id: "team-cluster-team-alpha",
          companyId: "company-demo",
          meshType: "team-cluster",
          position: [2, 0, 1],
          rotation: [0, 0, 0],
          metadata: { teamId: "team-alpha" },
        },
      ],
      teams: [
        {
          _id: "team-alpha",
          companyId: "company-demo",
          name: "Alpha",
          description: "Alpha team",
          clusterPosition: [2, 0, 1],
          employees: [],
        },
      ],
      managementAnchor: [4, 0, 1],
    });

    expect(blockers.objectIds).toEqual(["team-cluster-team-alpha"]);
    expect(blockers.teamIds).toEqual([]);
  });

  it("describes blocking team-cluster objects with the team name", () => {
    expect(
      describeOfficeLayoutRemovalBlockers({
        blockers: {
          objectIds: ["team-cluster-team-alpha"],
          teamIds: [],
          keepsManagementArea: true,
        },
        officeObjects: [
          {
            _id: "team-cluster-team-alpha",
            companyId: "company-demo",
            meshType: "team-cluster",
            position: [2, 0, 1],
            rotation: [0, 0, 0],
            metadata: { teamId: "team-alpha" },
          },
        ],
        teams: [
          {
            _id: "team-alpha",
            companyId: "company-demo",
            name: "Alpha",
            description: "Alpha team",
            clusterPosition: [2, 0, 1],
            employees: [],
          },
        ],
        persistedObjects: [
          {
            id: "team-cluster-team-alpha",
            identifier: "team-cluster-team-alpha",
            meshType: "team-cluster",
            position: [2, 0, 1],
            rotation: [0, 0, 0],
            metadata: { teamId: "team-alpha" },
          },
        ],
      }),
    ).toBe("Team: Alpha");
  });

  it("only reports blockers newly introduced by the candidate layout", () => {
    const baseline = {
      objectIds: ["team-cluster-team-alpha"],
      teamIds: [],
      keepsManagementArea: false,
      isValid: false,
    };
    const candidate = {
      objectIds: ["team-cluster-team-alpha", "plant-1"],
      teamIds: ["team-beta"],
      keepsManagementArea: false,
      isValid: false,
    };

    expect(
      getNewOfficeLayoutRemovalBlockers({
        baseline,
        candidate,
      }),
    ).toEqual({
      objectIds: ["plant-1"],
      teamIds: ["team-beta"],
      keepsManagementArea: true,
      isValid: false,
    });
  });

  it("does not block removal when the management zone was already invalid before the stroke", () => {
    expect(
      getNewOfficeLayoutRemovalBlockers({
        baseline: {
          objectIds: ["team-cluster-team-alpha"],
          teamIds: [],
          keepsManagementArea: false,
          isValid: false,
        },
        candidate: {
          objectIds: ["team-cluster-team-alpha"],
          teamIds: [],
          keepsManagementArea: false,
          isValid: false,
        },
      }),
    ).toEqual({
      objectIds: [],
      teamIds: [],
      keepsManagementArea: true,
      isValid: true,
    });
  });
});
