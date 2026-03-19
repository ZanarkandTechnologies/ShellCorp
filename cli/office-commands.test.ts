import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerOfficeCommands } from "./office-commands.js";

const baseCompany = {
  version: 1,
  departments: [
    { id: "dept-ceo", name: "CEO Office", description: "", goal: "" },
    { id: "dept-products", name: "Product Studio", description: "", goal: "" },
  ],
  projects: [
    {
      id: "proj-alpha",
      departmentId: "dept-products",
      name: "Alpha",
      githubUrl: "",
      status: "active",
      goal: "Ship",
      kpis: [],
    },
  ],
  agents: [
    {
      agentId: "alpha-pm",
      role: "pm",
      projectId: "proj-alpha",
      heartbeatProfileId: "hb-pm",
      isCeo: false,
      lifecycleState: "active",
    },
  ],
  roleSlots: [],
  heartbeatProfiles: [
    {
      id: "hb-pm",
      role: "pm",
      cadenceMinutes: 10,
      teamDescription: "",
      productDetails: "",
      goal: "",
    },
  ],
  tasks: [],
  channelBindings: [],
  federationPolicies: [],
  providerIndexProfiles: [],
};

interface Snapshot {
  officeStylePreset?: string;
}

interface CompanySnapshot {
  projects?: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}

interface OfficeSettingsSnapshot {
  decor?: {
    floorPatternId?: string;
    wallColorId?: string;
    backgroundId?: string;
  };
}

async function setupStateDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "shellcorp-office-cli-test-"));
  await writeFile(
    path.join(dir, "company.json"),
    `${JSON.stringify(baseCompany, null, 2)}\n`,
    "utf-8",
  );
  await writeFile(path.join(dir, "office-objects.json"), "[]\n", "utf-8");
  await writeFile(
    path.join(dir, "office.json"),
    `${JSON.stringify(
      {
        officeFootprint: { width: 35, depth: 35 },
        decor: {
          floorPatternId: "sandstone_tiles",
          wallColorId: "gallery_cream",
          backgroundId: "shell_haze",
        },
        viewProfile: "free_orbit_3d",
        orbitControlsEnabled: true,
        cameraOrientation: "south_east",
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  return dir;
}

async function runCommand(args: string[]): Promise<void> {
  const program = new Command();
  registerOfficeCommands(program);
  await program.parseAsync(args, { from: "user" });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.OPENCLAW_STATE_DIR;
  process.exitCode = undefined;
});

describe("office CLI", () => {
  it("adds, moves, and removes objects", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    await runCommand(["office", "add", "plant", "--id", "plant-a", "--position", "-10,0,-10"]);
    await runCommand(["office", "move", "plant-a", "--position", "0,0,0"]);
    await runCommand(["office", "remove", "plant-a"]);

    const raw = await readFile(path.join(stateDir, "office-objects.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual([]);
  });

  it("sets and reads office theme", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(["office", "theme", "set", "cozy"]);
    await runCommand(["office", "theme"]);

    const raw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const company = JSON.parse(raw) as Snapshot;
    expect(company.officeStylePreset).toBe("cozy");
    expect(logSpy).toHaveBeenCalledWith("Current office theme: cozy");
  });

  it("applies a decor pack through the CLI", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    await runCommand(["office", "decor", "pack", "apply", "clam-cabinet"]);

    const raw = await readFile(path.join(stateDir, "office.json"), "utf-8");
    const office = JSON.parse(raw) as OfficeSettingsSnapshot;
    expect(office.decor?.floorPatternId).toBe("graphite_grid");
    expect(office.decor?.wallColorId).toBe("harbor_blue");
    expect(office.decor?.backgroundId).toBe("midnight_tide");
  });

  it("sets floor, wall, and background decor directly through the CLI", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    await runCommand(["office", "decor", "floor", "set", "walnut_parquet"]);
    await runCommand(["office", "decor", "wall", "set", "sage_mist"]);
    await runCommand(["office", "decor", "background", "set", "kelp_fog"]);

    const raw = await readFile(path.join(stateDir, "office.json"), "utf-8");
    const office = JSON.parse(raw) as OfficeSettingsSnapshot;
    expect(office.decor?.floorPatternId).toBe("walnut_parquet");
    expect(office.decor?.wallColorId).toBe("sage_mist");
    expect(office.decor?.backgroundId).toBe("kelp_fog");
  });

  it("places and clears a wall painting through the CLI", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    await runCommand(["office", "decor", "painting", "place", "back-center", "sunrise_blocks"]);
    let raw = await readFile(path.join(stateDir, "office-objects.json"), "utf-8");
    let objects = JSON.parse(raw) as Array<{
      id: string;
      meshType: string;
      metadata?: Record<string, unknown>;
    }>;
    expect(objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "wall-art-back-center",
          meshType: "wall-art",
          metadata: expect.objectContaining({
            wallSlotId: "back-center",
            paintingPresetId: "sunrise_blocks",
          }),
        }),
      ]),
    );

    await runCommand(["office", "decor", "painting", "clear", "back-center"]);
    raw = await readFile(path.join(stateDir, "office-objects.json"), "utf-8");
    objects = JSON.parse(raw) as Array<{
      id: string;
      meshType: string;
      metadata?: Record<string, unknown>;
    }>;
    expect(objects.some((entry) => entry.id === "wall-art-back-center")).toBe(false);
  });

  it("prints decor docs entry point", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(["office", "decor", "docs"]);

    const payload = String(logSpy.mock.calls.at(-1)?.[0] ?? "");
    expect(payload).toContain("Office decor CLI");
    expect(payload).toContain("shellcorp office decor floor list");
    expect(payload).toContain("shellcorp office decor pack apply clam-cabinet");
    expect(payload).toContain("shellcorp office decor background set midnight_tide");
  });

  it("lists floor, wall, and background options through the CLI", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(["office", "decor", "floor", "list"]);
    expect(String(logSpy.mock.calls.at(-1)?.[0] ?? "")).toContain("walnut_parquet");

    await runCommand(["office", "decor", "wall", "list"]);
    expect(String(logSpy.mock.calls.at(-1)?.[0] ?? "")).toContain("harbor_blue");

    await runCommand(["office", "decor", "background", "list"]);
    expect(String(logSpy.mock.calls.at(-1)?.[0] ?? "")).toContain("midnight_tide");
  });

  it("writes a meshy spec via office generate", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    await runCommand([
      "office",
      "generate",
      "small",
      "cactus",
      "desk",
      "plant",
      "--style",
      "low-poly",
      "--type",
      "prop",
    ]);

    const assetDir = path.join(stateDir, "assets", "mesh");
    const files = await readdir(assetDir);
    const specFile = files.find((name) => name.endsWith(".md") && name !== "INDEX.md");
    expect(specFile).toBeTruthy();
    const specRaw = await readFile(path.join(assetDir, specFile as string), "utf-8");
    expect(specRaw).toContain("# small cactus desk plant");
    expect(specRaw).toContain("- style: low-poly");
    expect(specRaw).toContain("- asset_type: prop");
  });

  it("prints json output for office list", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand(["office", "add", "plant", "--id", "plant-a", "--position", "-10,0,-10"]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(["office", "list", "--json"]);
    const payload = String(logSpy.mock.calls.at(-1)?.[0] ?? "");
    expect(payload).toContain('"objects"');
    expect(payload).toContain('"plant-a"');
  });

  it("validates placement flags for office add", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    await expect(runCommand(["office", "add", "plant"])).rejects.toThrow(
      "placement_requires_position_or_auto",
    );
    await expect(
      runCommand(["office", "add", "plant", "--position", "0,0,0", "--auto-place"]),
    ).rejects.toThrow("placement_flags_conflict");
  });

  it("auto-places an object into first available slot", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand(["office", "add", "plant", "--id", "plant-a", "--position", "0,0,0"]);
    await runCommand(["office", "add", "plant", "--id", "plant-b", "--auto-place"]);

    const raw = await readFile(path.join(stateDir, "office-objects.json"), "utf-8");
    const objects = JSON.parse(raw) as Array<{ id: string; position: [number, number, number] }>;
    const plantB = objects.find((entry) => entry.id === "plant-b");
    expect(plantB?.position).toEqual([-2, 0, -2]);
  });

  it("fails auto-placement when no empty slot is available", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const blockers: Array<{
      id: string;
      identifier: string;
      meshType: string;
      position: [number, number, number];
    }> = [];
    for (let x = -17; x <= 17; x += 1) {
      for (let z = -17; z <= 17; z += 1) {
        blockers.push({
          id: `block-${x}-${z}`,
          identifier: `block-${x}-${z}`,
          meshType: "plant",
          position: [x, 0, z],
        });
      }
    }
    await writeFile(
      path.join(stateDir, "office-objects.json"),
      `${JSON.stringify(blockers, null, 2)}\n`,
      "utf-8",
    );

    await expect(runCommand(["office", "add", "plant", "--auto-place"])).rejects.toThrow(
      "no_empty_space_available:plant",
    );
  });

  it("rejects overlapping manual add and move placements", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand(["office", "add", "plant", "--id", "plant-a", "--position", "0,0,0"]);
    await expect(
      runCommand(["office", "add", "plant", "--id", "plant-b", "--position", "0,0,0"]),
    ).rejects.toThrow("position_occupied");

    await runCommand(["office", "add", "couch", "--id", "couch-a", "--position", "4,0,0"]);
    await expect(runCommand(["office", "move", "couch-a", "--position", "0,0,0"])).rejects.toThrow(
      "position_occupied",
    );
  });

  it("requires mesh metadata for custom-mesh and accepts explicit mesh path", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await expect(runCommand(["office", "add", "custom-mesh", "--auto-place"])).rejects.toThrow(
      "custom_mesh_requires_asset_metadata",
    );

    await runCommand([
      "office",
      "add",
      "custom-mesh",
      "--id",
      "dragon-mesh-a",
      "--auto-place",
      "--mesh-public-path",
      "/openclaw/assets/meshes/dragon.glb",
      "--display-name",
      "Dragon",
    ]);
    const raw = await readFile(path.join(stateDir, "office-objects.json"), "utf-8");
    const objects = JSON.parse(raw) as Array<{ id: string; metadata?: Record<string, unknown> }>;
    const dragon = objects.find((entry) => entry.id === "dragon-mesh-a");
    expect(dragon?.metadata?.meshPublicPath).toBe("/openclaw/assets/meshes/dragon.glb");
    expect(dragon?.metadata?.displayName).toBe("Dragon");
  });

  it("creates a real project-backed team when adding a team cluster", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    await runCommand([
      "office",
      "add",
      "team-cluster",
      "--id",
      "cluster-dragons",
      "--auto-place",
      "--metadata",
      "name=Dragons",
    ]);

    const companyRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const company = JSON.parse(companyRaw) as CompanySnapshot;
    const dragonsProject = (company.projects ?? []).find((entry) => entry.name === "Dragons");
    expect(dragonsProject).toBeTruthy();
    expect(dragonsProject?.status).toBe("active");

    const objectsRaw = await readFile(path.join(stateDir, "office-objects.json"), "utf-8");
    const objects = JSON.parse(objectsRaw) as Array<{
      id: string;
      metadata?: Record<string, unknown>;
    }>;
    const cluster = objects.find((entry) => entry.id === "cluster-dragons");
    expect(cluster?.metadata?.teamId).toBe(`team-${dragonsProject?.id}`);
    expect(cluster?.metadata?.name).toBe("Dragons");
  });

  it("reports invalid office objects via office doctor", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const seeded = [
      { id: "plant-a", identifier: "plant-a", meshType: "plant", position: [0, 0, 0] },
      {
        id: "dragon-bad",
        identifier: "dragon-bad",
        meshType: "custom-mesh",
        position: [2, 0, 0],
        metadata: { label: "dragon" },
      },
      {
        id: "cluster-bad",
        identifier: "cluster-bad",
        meshType: "team-cluster",
        position: [4, 0, 0],
        metadata: { teamId: "team-proj-missing" },
      },
    ];
    await writeFile(
      path.join(stateDir, "office-objects.json"),
      `${JSON.stringify(seeded, null, 2)}\n`,
      "utf-8",
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(["office", "doctor", "--json"]);
    const payloadRaw = String(logSpy.mock.calls.at(-1)?.[0] ?? "");
    const payload = JSON.parse(payloadRaw) as {
      ok: boolean;
      invalidCount: number;
      invalid: Array<{ id: string; reasons: string[] }>;
    };
    expect(payload.ok).toBe(false);
    expect(payload.invalidCount).toBe(2);
    expect(
      payload.invalid.some(
        (entry) => entry.id === "dragon-bad" && entry.reasons.includes("missing_mesh_public_path"),
      ),
    ).toBe(true);
    expect(
      payload.invalid.some(
        (entry) => entry.id === "cluster-bad" && entry.reasons.includes("team_project_missing"),
      ),
    ).toBe(true);
  });

  it("removes invalid office objects via office doctor --fix", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const seeded = [
      { id: "plant-a", identifier: "plant-a", meshType: "plant", position: [0, 0, 0] },
      {
        id: "dragon-bad",
        identifier: "dragon-bad",
        meshType: "custom-mesh",
        position: [2, 0, 0],
        metadata: { label: "dragon" },
      },
      {
        id: "cluster-bad",
        identifier: "cluster-bad",
        meshType: "team-cluster",
        position: [4, 0, 0],
        metadata: { teamId: "team-proj-missing" },
      },
    ];
    await writeFile(
      path.join(stateDir, "office-objects.json"),
      `${JSON.stringify(seeded, null, 2)}\n`,
      "utf-8",
    );

    await runCommand(["office", "doctor", "--fix"]);
    const raw = await readFile(path.join(stateDir, "office-objects.json"), "utf-8");
    const objects = JSON.parse(raw) as Array<{ id: string }>;
    expect(objects.map((entry) => entry.id)).toEqual(["plant-a"]);
  });

  it("filters doctor cleanup by reason", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const seeded = [
      { id: "plant-a", identifier: "plant-a", meshType: "plant", position: [0, 0, 0] },
      {
        id: "dragon-bad",
        identifier: "dragon-bad",
        meshType: "custom-mesh",
        position: [2, 0, 0],
        metadata: { label: "dragon" },
      },
      {
        id: "cluster-bad",
        identifier: "cluster-bad",
        meshType: "team-cluster",
        position: [4, 0, 0],
        metadata: { teamId: "team-proj-missing" },
      },
    ];
    await writeFile(
      path.join(stateDir, "office-objects.json"),
      `${JSON.stringify(seeded, null, 2)}\n`,
      "utf-8",
    );

    await runCommand(["office", "doctor", "--reason", "missing_mesh_public_path", "--fix"]);
    const raw = await readFile(path.join(stateDir, "office-objects.json"), "utf-8");
    const objects = JSON.parse(raw) as Array<{ id: string }>;
    expect(objects.map((entry) => entry.id)).toEqual(["plant-a", "cluster-bad"]);
  });

  it("treats the synthetic management cluster as valid", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const seeded = [
      {
        id: "cluster-team-management",
        identifier: "cluster-team-management",
        meshType: "team-cluster",
        position: [0, 0, 0],
        metadata: { teamId: "team-management", name: "Management" },
      },
    ];
    await writeFile(
      path.join(stateDir, "office-objects.json"),
      `${JSON.stringify(seeded, null, 2)}\n`,
      "utf-8",
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(["office", "doctor", "--json"]);

    const payloadRaw = String(logSpy.mock.calls.at(-1)?.[0] ?? "");
    const payload = JSON.parse(payloadRaw) as {
      ok: boolean;
      invalidCount: number;
      invalid: Array<{ id: string; reasons: string[] }>;
    };
    expect(payload.ok).toBe(true);
    expect(payload.invalidCount).toBe(0);
    expect(payload.invalid).toEqual([]);
  });
});
