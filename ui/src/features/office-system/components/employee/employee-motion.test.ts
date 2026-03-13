import { describe, expect, it } from "vitest";

import { getEmployeeAnimationPose } from "./employee-motion";

describe("employee motion pose", () => {
  it("gives walking a stronger bob and sway than stationary modes", () => {
    const walking = getEmployeeAnimationPose(0.1, 0, "walking");
    const working = getEmployeeAnimationPose(0.1, 0, "working");
    const idle = getEmployeeAnimationPose(0.1, 0, "idle");

    expect(walking.bobY).toBeGreaterThan(working.bobY);
    expect(walking.bobY).toBeGreaterThan(idle.bobY);
    expect(Math.abs(walking.rollZ)).toBeGreaterThan(Math.abs(working.rollZ));
    expect(Math.abs(walking.rollZ)).toBeGreaterThan(Math.abs(idle.rollZ));
  });

  it("keeps desk work subtler than general idle motion", () => {
    const working = getEmployeeAnimationPose(0.35, 0, "working");
    const idle = getEmployeeAnimationPose(0.35, 0, "idle");

    expect(working.bobY).toBeLessThan(idle.bobY);
    expect(Math.abs(working.rollZ)).toBeLessThan(Math.abs(idle.rollZ));
  });

  it("desynchronizes avatars when a phase offset is applied", () => {
    const basePose = getEmployeeAnimationPose(0.25, 0, "idle");
    const shiftedPose = getEmployeeAnimationPose(0.25, 0.7, "idle");

    expect(shiftedPose.bobY).not.toBe(basePose.bobY);
    expect(shiftedPose.rollZ).not.toBe(basePose.rollZ);
    expect(shiftedPose.yawY).not.toBe(basePose.yawY);
  });
});
