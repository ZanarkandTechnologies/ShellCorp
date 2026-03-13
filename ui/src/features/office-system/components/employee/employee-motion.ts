"use client";

/**
 * EMPLOYEE MOTION
 * ===============
 * Computes subtle avatar pose offsets so employee presence reads as alive without affecting labels or pathing.
 *
 * KEY CONCEPTS:
 * - Walking uses a faster bob/sway cadence than stationary poses
 * - Working-at-desk motion stays softer than general idle to avoid noisy desk scenes
 * - Pose math is pure so animation tuning can be regression-tested
 *
 * MEMORY REFERENCES:
 * - MEM-0144
 * - MEM-0163
 */

export type EmployeeAnimationMode = "walking" | "working" | "idle";

type EmployeeAnimationPose = {
  bobY: number;
  rollZ: number;
  yawY: number;
};

export function getEmployeeAnimationPose(
  elapsedTime: number,
  phaseOffset: number,
  animationMode: EmployeeAnimationMode,
): EmployeeAnimationPose {
  const elapsed = elapsedTime + phaseOffset;
  const bobAmplitude = animationMode === "walking" ? 0.07 : animationMode === "working" ? 0.025 : 0.035;
  const bobSpeed = animationMode === "walking" ? 9 : animationMode === "working" ? 2.8 : 2.2;
  const swayAmplitude = animationMode === "walking" ? 0.06 : animationMode === "working" ? 0.015 : 0.025;
  const yawAmplitude = animationMode === "walking" ? 0.025 : 0.012;

  return {
    bobY: Math.abs(Math.sin(elapsed * bobSpeed)) * bobAmplitude,
    rollZ: Math.sin(elapsed * bobSpeed) * swayAmplitude,
    yawY: Math.sin(elapsed * (bobSpeed * 0.5)) * yawAmplitude,
  };
}
