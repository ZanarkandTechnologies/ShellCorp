/**
 * CONSULT CAMERA
 * ==============
 * Pure helper for deriving a close speaking-shot camera around an
 * employee position during consult/story mode.
 *
 * KEY CONCEPTS:
 * - Keep consult framing deterministic and centered on the speaking employee.
 * - The helper stays pure so camera math can be unit-tested without the scene shell.
 *
 * USAGE:
 * - Imported by `use-office-scene-camera.ts`.
 *
 * MEMORY REFERENCES:
 * - MEM-0168
 */

import * as THREE from "three";

export type ConsultCameraState = {
  position: [number, number, number];
  target: [number, number, number];
};

export function buildConsultCameraState(
  employeePosition: [number, number, number],
): ConsultCameraState {
  const [x, y, z] = employeePosition;
  const outward = new THREE.Vector3(x, 0, z);
  if (outward.lengthSq() < 0.001) {
    outward.set(1, 0, 1);
  }
  outward.normalize();

  const side = new THREE.Vector3(-outward.z, 0, outward.x).multiplyScalar(0.16);
  const cameraPosition = new THREE.Vector3(x, y + 1.2, z)
    .add(outward.multiplyScalar(1.85))
    .add(side);
  const cameraTarget = new THREE.Vector3(x, y + 0.92, z);

  return {
    position: [cameraPosition.x, cameraPosition.y, cameraPosition.z],
    target: [cameraTarget.x, cameraTarget.y, cameraTarget.z],
  };
}
