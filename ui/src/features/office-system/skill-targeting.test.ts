import { describe, expect, it } from "vitest";

import type { OfficeObject } from "@/lib/types";
import {
  buildSkillTargetObjectMap,
  getOfficeSkillAnchorPosition,
  getOfficeSkillAnchorPositionForOccupant,
} from "./skill-targeting";

describe("office skill targeting", () => {
  it("offsets anchors slightly in front of the bound object", () => {
    const object: OfficeObject = {
      _id: "monitor-1",
      meshType: "custom-mesh",
      position: [4, 0, 7],
      rotation: [0, 0, 0],
      metadata: {
        skillBinding: {
          skillId: "world-monitor",
        },
      },
    };

    expect(getOfficeSkillAnchorPosition(object)).toEqual([4, 0, 9.1]);
  });

  it("spreads multiple occupants around the same bound object", () => {
    const object: OfficeObject = {
      _id: "monitor-1",
      meshType: "custom-mesh",
      position: [1, 0, 2],
      rotation: [0, 0, 0],
      metadata: { skillBinding: { skillId: "world-monitor" } },
    };

    const first = getOfficeSkillAnchorPositionForOccupant(object, 0, 3);
    const second = getOfficeSkillAnchorPositionForOccupant(object, 1, 3);
    const third = getOfficeSkillAnchorPositionForOccupant(object, 2, 3);

    expect(first).not.toEqual(second);
    expect(second).not.toEqual(third);
    expect(first[2]).toBeLessThanOrEqual(4.1);
    expect(third[2]).toBeLessThanOrEqual(4.1);
  });

  it("builds a lookup from skill bindings and ignores duplicates", () => {
    const objects: OfficeObject[] = [
      {
        _id: "monitor-1",
        meshType: "custom-mesh",
        position: [1, 0, 2],
        rotation: [0, 0, 0],
        metadata: { skillBinding: { skillId: "world-monitor" } },
      },
      {
        _id: "monitor-2",
        meshType: "custom-mesh",
        position: [9, 0, 9],
        rotation: [0, 1.57, 0],
        metadata: { skillBinding: { skillId: "world-monitor" } },
      },
      {
        _id: "plant-1",
        meshType: "plant",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
      },
    ];

    const map = buildSkillTargetObjectMap(objects);
    expect(map.get("world-monitor")?._id).toBe("monitor-1");
    expect(map.size).toBe(1);
  });
});
