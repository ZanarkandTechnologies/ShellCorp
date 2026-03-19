import { describe, expect, it } from "vitest";

import type {
  AgentCardModel,
  CompanyModel,
  OfficeSettingsModel,
  UnifiedOfficeModel,
} from "@/lib/openclaw-types";
import type { EmployeeData, OfficeObject } from "@/lib/types";
import {
  buildEmployeeSignature,
  buildOfficeObjectSignature,
  stabilizeOfficeData,
} from "./office-data-stability";
import { toOfficeData } from "./office-data-mapper";

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

function createRuntimeAgent(overrides: Partial<AgentCardModel> = {}): AgentCardModel {
  return {
    agentId: "main",
    displayName: "Main Agent",
    workspacePath: "/tmp/main",
    agentDir: "/tmp/main/agent",
    sandboxMode: "workspace-write",
    toolPolicy: { allow: [], deny: [] },
    sessionCount: 0,
    ...overrides,
  };
}

function createCompanyModel(overrides: Partial<CompanyModel> = {}): CompanyModel {
  return {
    version: 1,
    departments: [],
    projects: [],
    agents: [
      {
        agentId: "main",
        role: "ceo",
        heartbeatProfileId: "hb-ceo",
        isCeo: true,
        lifecycleState: "active",
      },
    ],
    roleSlots: [],
    tasks: [],
    federationPolicies: [],
    providerIndexProfiles: [],
    heartbeatProfiles: [
      {
        id: "hb-ceo",
        role: "ceo",
        cadenceMinutes: 15,
        teamDescription: "Executive oversight",
        productDetails: "Company control surface",
        goal: "Keep the company aligned",
      },
    ],
    channelBindings: [],
    heartbeatRuntime: {
      enabled: true,
      pluginId: "shellcorp-heartbeat",
      serviceId: "company-heartbeat-loop",
      cadenceMinutes: 10,
      notes: "Run heartbeat execution through OpenClaw.",
    },
    officeObjects: [],
    ...overrides,
  };
}

function createUnifiedOfficeModel(overrides: Partial<UnifiedOfficeModel> = {}): UnifiedOfficeModel {
  return {
    company: createCompanyModel(),
    runtimeAgents: [createRuntimeAgent()],
    configuredAgents: [createRuntimeAgent()],
    officeObjects: [],
    memory: [],
    skills: [],
    workload: [],
    warnings: [],
    diagnostics: {
      configAgentCount: 1,
      runtimeAgentCount: 1,
      sidecarAgentCount: 1,
      missingRuntimeAgentIds: [],
      unmappedRuntimeAgentIds: [],
      invalidOfficeObjects: [],
      duplicateOfficeObjectIds: [],
      officeObjectCount: 0,
      clampedClusterCount: 0,
      outOfBoundsClusterObjectIds: [],
      ceoAnchorMode: "fallback",
      source: "localStorage",
    },
    ...overrides,
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

describe("office-data-provider team synthesis", () => {
  it("does not synthesize an OpenClaw Ops cluster when all projects are archived", () => {
    const company = createCompanyModel({
      projects: [
        {
          id: "proj-shellcorp-dev-team",
          departmentId: "dept-products",
          name: "ShellCorp Dev Team",
          githubUrl: "",
          status: "archived",
          goal: "Internal product loop",
          kpis: [],
          accountEvents: [],
          ledger: [],
          experiments: [],
          metricEvents: [],
          resources: [],
          resourceEvents: [],
        },
      ],
      agents: [
        {
          agentId: "main",
          role: "ceo",
          heartbeatProfileId: "hb-ceo",
          isCeo: true,
          lifecycleState: "active",
        },
        {
          agentId: "shellcorp-dev-team-pm",
          role: "pm",
          projectId: "proj-shellcorp-dev-team",
          heartbeatProfileId: "hb-ceo",
          lifecycleState: "retired",
        },
      ],
    });
    const unified = createUnifiedOfficeModel({
      company,
      runtimeAgents: [
        createRuntimeAgent(),
        createRuntimeAgent({
          agentId: "shellcorp-dev-team-pm",
          displayName: "ShellCorp PM",
          workspacePath: "/tmp/shellcorp-dev-team-pm",
          agentDir: "/tmp/shellcorp-dev-team-pm/agent",
        }),
      ],
      configuredAgents: [
        createRuntimeAgent(),
        createRuntimeAgent({
          agentId: "shellcorp-dev-team-pm",
          displayName: "ShellCorp PM",
          workspacePath: "/tmp/shellcorp-dev-team-pm",
          agentDir: "/tmp/shellcorp-dev-team-pm/agent",
        }),
      ],
    });

    const result = toOfficeData(unified, createOfficeSettings());

    expect(result.teams.map((team) => team._id)).toEqual(["team-management"]);
    expect(result.officeObjects.every((object) => object.metadata?.teamId !== "team-openclaw")).toBe(
      true,
    );
    expect(result.employees.every((employee) => employee.team !== "OpenClaw Ops")).toBe(true);
  });

  it("keeps the explicit OpenClaw Ops fallback when no agents are discovered", () => {
    const unified = createUnifiedOfficeModel({
      runtimeAgents: [],
      configuredAgents: [],
    });

    const result = toOfficeData(unified, createOfficeSettings());

    expect(result.teams.map((team) => team._id)).toContain("team-openclaw");
    expect(result.officeObjects.some((object) => object.metadata?.teamId === "team-openclaw")).toBe(
      true,
    );
  });
});
