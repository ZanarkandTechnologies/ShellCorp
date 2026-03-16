import { describe, expect, it } from "vitest";
import { buildConsultCameraState } from "./consult-camera";

describe("consult camera", () => {
  it("builds a close speaking-shot camera for off-center employees", () => {
    const result = buildConsultCameraState([10, 0, 4]);

    expect(result.target).toEqual([10, 0.92, 4]);
    expect(result.position[1]).toBeCloseTo(1.2);
    expect(result.position[0]).toBeGreaterThan(10);
  });

  it("falls back to a stable diagonal shot for employees near the room center", () => {
    const result = buildConsultCameraState([0, 0, 0]);

    expect(result.target).toEqual([0, 0.92, 0]);
    expect(result.position[0]).toBeGreaterThan(0);
    expect(result.position[2]).toBeGreaterThan(0);
  });
});
