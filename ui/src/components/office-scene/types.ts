/**
 * OFFICE SCENE TYPES
 * ==================
 * Shared types for the office scene composition modules.
 *
 * KEY CONCEPTS:
 * - Keep the public scene props stable while internal modules split by responsibility.
 * - Scene internals should import shared contracts from here instead of redefining them.
 *
 * USAGE:
 * - Import `OfficeSceneProps` from the public scene shell and internal scene modules.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 */

import type { DeskLayoutData, EmployeeData, OfficeId, OfficeObject, TeamData } from "@/lib/types";
import type { OfficeFootprint } from "@/lib/office-footprint";
import type { OfficeSettingsModel } from "@/lib/openclaw-types";

export interface OfficeSceneProps {
  teams: TeamData[];
  employees: EmployeeData[];
  desks: DeskLayoutData[];
  officeObjects: OfficeObject[];
  officeFootprint: OfficeFootprint;
  officeDecorSettings: OfficeSettingsModel["decor"];
  officeViewSettings: Pick<
    OfficeSettingsModel,
    "viewProfile" | "orbitControlsEnabled" | "cameraOrientation"
  >;
  companyId?: OfficeId<"companies">;
  onNavigationReady?: () => void;
}
