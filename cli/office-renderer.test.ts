import { describe, expect, it } from "vitest";
import { renderOfficeAscii } from "./office-renderer.js";
import type { CompanyAgentModel, OfficeObjectModel } from "./sidecar-store.js";

function makeObject(
  id: string,
  meshType: string,
  position: [number, number, number],
): OfficeObjectModel {
  return {
    id,
    identifier: id,
    meshType,
    position,
    rotation: [0, 0, 0],
  };
}

const noAgents: CompanyAgentModel[] = [];

describe("renderOfficeAscii", () => {
  it("renders an empty office grid with legend", () => {
    const output = renderOfficeAscii([], noAgents, { useColor: false, width: 21, height: 11 });
    expect(output).toContain("Legend:");
    expect(output).toContain("- (no office objects)");
    expect(output).toContain("- A agents (0)");
  });

  it("renders known symbols for object mesh types", () => {
    const output = renderOfficeAscii(
      [
        makeObject("team-alpha", "team-cluster", [-12, 0, -5]),
        makeObject("plant-nw", "plant", [14, 0, -14]),
      ],
      noAgents,
      { useColor: false, width: 31, height: 16 },
    );
    expect(output).toContain("T team-alpha (team-cluster)");
    expect(output).toContain("P plant-nw (plant)");
  });

  it("uses collision priority to prefer team-cluster over decor", () => {
    const output = renderOfficeAscii(
      [
        makeObject("plant-mid", "plant", [0, 0, 0]),
        makeObject("team-mid", "team-cluster", [0, 0, 0]),
      ],
      noAgents,
      { useColor: false, width: 31, height: 16 },
    );
    expect(output).toContain("T team-mid (team-cluster)");
    expect(output).not.toContain("P plant-mid (plant)");
  });
});

