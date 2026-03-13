import { describe, expect, it } from "vitest";

import { assignRandomStatuses, buildDesksByTeamId } from "./derived-data-utils";
import { buildCeoDeskData } from "./use-office-scene-derived-data";
import { getOfficePresentationRotationY } from "./view-profile";

describe("office scene derived data", () => {
  it("keeps deterministic status assignment stable across calls", () => {
    const employees = [
      {
        _id: "emp-1",
        teamId: "team-a",
        name: "Ada",
        initialPosition: [1, 0, 2],
        heartbeatState: "idle",
        statusMessage: undefined,
      },
    ] as const;

    const locks = new Map<string, number | undefined>([["team-a", undefined]]);
    const first = assignRandomStatuses([...employees], locks);
    const second = assignRandomStatuses([...employees], locks);

    expect(first).toEqual(second);
  });

  it("forces CEO employees to stay put with info status", () => {
    const employees = [
      {
        _id: "ceo-1",
        teamId: "team-management",
        name: "CEO",
        builtInRole: "ceo",
        initialPosition: [0, 0, 0],
      },
    ] as const;

    const result = assignRandomStatuses([...employees], new Map());

    expect(result[0]?.status).toBe("info");
    expect(result[0]?.wantsToWander).toBe(false);
    expect(result[0]?.statusMessage).toBe("Managing the team");
  });

  it("indexes desks by team id from persisted desk ids", () => {
    const desks = [
      { id: "desk-team-alpha-0", deskIndex: 0 },
      { id: "desk-team-alpha-1", deskIndex: 1 },
      { id: "desk-team-beta-0", deskIndex: 0 },
      { id: "ceo-desk", deskIndex: 0 },
    ] as const;

    const desksByTeamId = buildDesksByTeamId([...desks]);

    expect(desksByTeamId.get("team-alpha")?.map((desk) => desk.id)).toEqual([
      "desk-team-alpha-0",
      "desk-team-alpha-1",
    ]);
    expect(desksByTeamId.get("team-beta")?.map((desk) => desk.id)).toEqual(["desk-team-beta-0"]);
  });

  it("resolves deterministic presentation yaw for fixed 2.5D orientations", () => {
    expect(getOfficePresentationRotationY("south_east")).toBeCloseTo(Math.PI / 4);
    expect(getOfficePresentationRotationY("north_west")).toBeCloseTo((-3 * Math.PI) / 4);
  });

  it("keeps CEO desk placement derived from the management anchor", () => {
    const ceoDeskData = buildCeoDeskData({
      teams: [
        {
          _id: "team-management",
          name: "Management",
          description: "Executive team",
          clusterPosition: [12, 0, -6],
          employees: [],
        },
      ],
      desks: [{ id: "desk-team-management-0", deskIndex: 0, team: "Management" }],
      officeViewSettings: {
        viewProfile: "free_orbit_3d",
        orbitControlsEnabled: true,
        cameraOrientation: "south_east",
      },
    });

    expect(ceoDeskData?.anchorPosition).toEqual([12, 0, -6]);
    expect(ceoDeskData?.position).toEqual([12, 0, -6]);
    expect(ceoDeskData?.localPosition).toEqual([0, 0, 0]);
  });
});
