import { describe, expect, it } from "vitest";

import type { OfficeSettingsModel } from "@/lib/openclaw-types";
import type { EmployeeData, OfficeObject } from "@/lib/types";
import {
  buildEmployeeSignature,
  buildOfficeObjectSignature,
  stabilizeOfficeData,
} from "./office-data-stability";

function createOfficeSettings(): OfficeSettingsModel {
  return {
    meshAssetDir: "",
    officeFootprint: { width: 30, depth: 24 },
    officeLayout: {
      version: 1,
      tileSize: 1,
      tiles: ["0,0"],
    },
    decor: {
      floorPatternId: "sandstone_tiles",
      wallColorId: "gallery_cream",
      backgroundId: "shell_haze",
    },
    viewProfile: "free_orbit_3d",
    orbitControlsEnabled: true,
    cameraOrientation: "south_east",
  };
}

function createEmployee(overrides: Partial<EmployeeData> = {}): EmployeeData {
  return {
    _id: "employee-main",
    teamId: "team-openclaw",
    name: "Main Agent",
    initialPosition: [0, 0, 0],
    isBusy: false,
    team: "OpenClaw Ops",
    ...overrides,
  };
}

function createOfficeObject(overrides: Partial<OfficeObject> = {}): OfficeObject {
  return {
    _id: "monitor-1",
    meshType: "custom-mesh",
    position: [1, 0, 1],
    rotation: [0, 0, 0],
    metadata: {},
    ...overrides,
  };
}

function createValue(params?: { employees?: EmployeeData[]; officeObjects?: OfficeObject[] }) {
  return {
    company: { _id: "company-demo", name: "Shell Company" },
    teams: [],
    employees: params?.employees ?? [createEmployee()],
    officeObjects: params?.officeObjects ?? [createOfficeObject()],
    desks: [],
    officeSettings: createOfficeSettings(),
    companyModel: null,
    workload: [],
    warnings: [],
    refresh: async () => {},
    applyOfficeSettings: () => {},
    manualResync: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertFederationPolicy: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertProviderIndexProfile: async () => ({ ok: false, error: "adapter_unavailable" }),
    isLoading: false,
  };
}

describe("office-data-provider stabilization", () => {
  it("treats activity target changes as employee changes", () => {
    const base = [createEmployee()];
    const next = [
      createEmployee({
        activityTargetSkillId: "world-monitor",
        activityTargetPosition: [4, 0, 8.35],
        activityTargetObjectPosition: [4, 0, 7],
        activityEffectVariant: "ghost",
      }),
    ];

    expect(buildEmployeeSignature(base)).not.toBe(buildEmployeeSignature(next));

    const currentValue = createValue({ employees: base });
    const nextValue = createValue({ employees: next });

    const stabilized = stabilizeOfficeData(currentValue, nextValue);
    expect(stabilized.employees).toBe(nextValue.employees);
  });

  it("treats skill binding changes as office object changes", () => {
    const base = [
      createOfficeObject({
        metadata: {
          displayName: "Monitor",
        },
      }),
    ];
    const next = [
      createOfficeObject({
        metadata: {
          displayName: "Monitor",
          skillBinding: {
            skillId: "world-monitor",
            label: "World Monitor",
          },
        },
      }),
    ];

    expect(buildOfficeObjectSignature(base)).not.toBe(buildOfficeObjectSignature(next));

    const currentValue = createValue({ officeObjects: base });
    const nextValue = createValue({ officeObjects: next });

    const stabilized = stabilizeOfficeData(currentValue, nextValue);
    expect(stabilized.officeObjects).toBe(nextValue.officeObjects);
  });
});
