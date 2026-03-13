import type { CompanyOfficeObjectModel } from "@/lib/openclaw-types";

export function canObjectScale(meshType: CompanyOfficeObjectModel["meshType"] | string): boolean {
  return meshType !== "team-cluster";
}

export function getNextRotationY(currentRotationY: number, direction: "left" | "right"): number {
  const increment = direction === "right" ? Math.PI / 2 : -Math.PI / 2;
  return currentRotationY + increment;
}

export function getNextUniformScale(currentScalar: number, delta: number): number {
  return Math.min(3, Math.max(0.4, Number((currentScalar + delta).toFixed(2))));
}
