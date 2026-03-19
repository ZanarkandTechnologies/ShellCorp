/**
 * OFFICE COMMANDS
 * ===============
 * Purpose
 * - Provide CLI-first office decoration and personalization workflows.
 *
 * KEY CONCEPTS:
 * - Office objects are persisted in `office-objects.json`.
 * - Office theme preset is stored in `company.json.officeStylePreset`.
 *
 * USAGE:
 * - shellcorp office print
 * - shellcorp office add plant --position -10,0,-10
 *
 * MEMORY REFERENCES:
 * - MEM-0120
 */

import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { FLOOR_SIZE, HALF_FLOOR } from "./constants.js";
import { findFirstOpenPlacement, isPlacementAreaFree } from "./office-placement.js";
import { renderOfficeAscii } from "./office-renderer.js";
import {
  type CompanyModel,
  createSidecarStore,
  generateObjectId,
  type OfficeBackgroundId,
  type OfficeFloorPatternId,
  type OfficeObjectModel,
  type OfficeSettingsModel,
  type OfficeStylePreset,
  type OfficeWallColorId,
  resolveOpenclawHome,
} from "./sidecar-store.js";
import { readStarterOfficeTemplates } from "./starter-office.js";

const MESH_TYPES = new Set([
  "team-cluster",
  "plant",
  "couch",
  "bookshelf",
  "pantry",
  "glass-wall",
  "custom-mesh",
  "wall-art",
]);
const THEME_PRESETS: Array<{ id: OfficeStylePreset; description: string }> = [
  { id: "default", description: "Balanced default office palette" },
  { id: "pixel", description: "Pixel-like retro office mood" },
  { id: "brutalist", description: "High-contrast concrete office style" },
  { id: "cozy", description: "Warm and comfortable office style" },
];
const OFFICE_FLOOR_PATTERNS = [
  {
    id: "sandstone_tiles" as const,
    label: "Sandstone Tiles",
    description: "Warm square tiles with subtle grout lines.",
  },
  {
    id: "graphite_grid" as const,
    label: "Graphite Grid",
    description: "Cool stone grid for a more technical office look.",
  },
  {
    id: "walnut_parquet" as const,
    label: "Walnut Parquet",
    description: "Simple parquet-inspired wood pattern.",
  },
];
const OFFICE_WALL_COLORS = [
  {
    id: "gallery_cream" as const,
    label: "Gallery Cream",
    description: "Soft shell-white wall tone for brighter rooms.",
  },
  {
    id: "sage_mist" as const,
    label: "Sage Mist",
    description: "Muted green wall tone with a grounded burrow feel.",
  },
  {
    id: "harbor_blue" as const,
    label: "Harbor Blue",
    description: "Blue-grey wall tone for a colder clam-cabinet mood.",
  },
  {
    id: "clay_rose" as const,
    label: "Clay Rose",
    description: "Warm clay wall tone for estuary sunset rooms.",
  },
];
const OFFICE_BACKGROUNDS = [
  {
    id: "shell_haze" as const,
    label: "Shell Haze",
    description: "Warm shell-toned void that stays soft in light and dark mode.",
  },
  {
    id: "midnight_tide" as const,
    label: "Midnight Tide",
    description: "Cool harbor backdrop for the darker clam-cabinet moods.",
  },
  {
    id: "kelp_fog" as const,
    label: "Kelp Fog",
    description: "Muted environmental backdrop with a mossy underground feel.",
  },
  {
    id: "estuary_glow" as const,
    label: "Estuary Glow",
    description: "Warmer dusk-toned backdrop for softer atmospheric offices.",
  },
] as const;
const OFFICE_PAINTINGS = [
  {
    id: "sunrise_blocks",
    label: "Sunrise Blocks",
    description: "Layered warm blocks with a soft sunrise accent.",
  },
  {
    id: "night_geometry",
    label: "Night Geometry",
    description: "Dark geometric shapes with brass contrast.",
  },
  {
    id: "studio_lines",
    label: "Studio Lines",
    description: "Minimal graphic lines in a neutral studio palette.",
  },
] as const;
const OFFICE_DECOR_PACKS = [
  {
    id: "shell-parlor",
    label: "Shell Parlor",
    description: "Soft shell walls with warm stone flooring. Calm and slightly coastal.",
    floorPatternId: "sandstone_tiles" as const,
    wallColorId: "gallery_cream" as const,
    backgroundId: "shell_haze" as const,
  },
  {
    id: "clam-cabinet",
    label: "Clam Cabinet",
    description: "Blue-grey walls with graphite flooring for a cool crustacean control room.",
    floorPatternId: "graphite_grid" as const,
    wallColorId: "harbor_blue" as const,
    backgroundId: "midnight_tide" as const,
  },
  {
    id: "underclaw-burrow",
    label: "Underclaw Burrow",
    description: "Muted sage walls with walnut floor tones for an underground den feel.",
    floorPatternId: "walnut_parquet" as const,
    wallColorId: "sage_mist" as const,
    backgroundId: "kelp_fog" as const,
  },
  {
    id: "estuary-sunset",
    label: "Estuary Sunset",
    description: "Clay walls with warm tile flooring for a softer environmental room.",
    floorPatternId: "sandstone_tiles" as const,
    wallColorId: "clay_rose" as const,
    backgroundId: "estuary_glow" as const,
  },
] as const;
const WALL_ART_SLOTS = [
  { id: "back-left", label: "Back Left" },
  { id: "back-center", label: "Back Center" },
  { id: "back-right", label: "Back Right" },
  { id: "left-center", label: "Left Wall" },
] as const;

type OutputMode = "text" | "json";

function fail(message: string): never {
  throw new Error(message);
}

function formatOutput<T>(mode: OutputMode, payload: T, text: string): void {
  if (mode === "json") {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(text);
}

function parseVector3(raw: string, flagName: string): [number, number, number] {
  const parsed = raw
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry));
  if (parsed.length !== 3) {
    fail(`invalid_vector:${flagName}:${raw}`);
  }
  return [parsed[0], parsed[1], parsed[2]];
}

function assertPositionInBounds(position: [number, number, number]): void {
  const [x, , z] = position;
  if (x < -HALF_FLOOR || x > HALF_FLOOR || z < -HALF_FLOOR || z > HALF_FLOOR) {
    fail(`position_out_of_bounds:x=${x},z=${z},allowed=[-${HALF_FLOOR},${HALF_FLOOR}]`);
  }
}

function assertPositionUnoccupied(input: {
  position: [number, number, number];
  meshType: string;
  metadata?: Record<string, unknown>;
  objects: OfficeObjectModel[];
  ignoreObjectId?: string;
}): void {
  const free = isPlacementAreaFree({
    position: input.position,
    meshType: input.meshType,
    metadata: input.metadata,
    existingObjects: input.objects,
    bounds: { halfExtent: HALF_FLOOR },
    ignoreObjectId: input.ignoreObjectId,
  });
  if (!free) {
    fail(`position_occupied:x=${input.position[0]},z=${input.position[2]}`);
  }
}

function collectValue(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseMetadata(values: string[]): Record<string, unknown> {
  const entries: Record<string, unknown> = {};
  for (const entry of values) {
    const idx = entry.indexOf("=");
    if (idx <= 0 || idx >= entry.length - 1) {
      fail(`invalid_metadata:${entry}:expected_key_equals_value`);
    }
    const key = entry.slice(0, idx).trim();
    const value = entry.slice(idx + 1).trim();
    if (!key || !value) fail(`invalid_metadata:${entry}:expected_key_equals_value`);
    entries[key] = value;
  }
  return entries;
}

function ensureMeshType(meshType: string): string {
  const normalized = meshType.trim();
  if (!MESH_TYPES.has(normalized)) {
    fail(`invalid_mesh_type:${meshType}`);
  }
  return normalized;
}

function ensureThemePreset(preset: string): OfficeStylePreset {
  const normalized = preset.trim();
  if (
    normalized === "default" ||
    normalized === "pixel" ||
    normalized === "brutalist" ||
    normalized === "cozy"
  ) {
    return normalized;
  }
  fail(`invalid_theme_preset:${preset}`);
}

function ensureFloorPatternId(patternId: string): OfficeFloorPatternId {
  const normalized = patternId.trim();
  if (
    normalized === "sandstone_tiles" ||
    normalized === "graphite_grid" ||
    normalized === "walnut_parquet"
  ) {
    return normalized;
  }
  fail(`invalid_floor_pattern:${patternId}`);
}

function ensureWallColorId(wallColorId: string): OfficeWallColorId {
  const normalized = wallColorId.trim();
  if (
    normalized === "gallery_cream" ||
    normalized === "sage_mist" ||
    normalized === "harbor_blue" ||
    normalized === "clay_rose"
  ) {
    return normalized;
  }
  fail(`invalid_wall_color:${wallColorId}`);
}

function ensureBackgroundId(backgroundId: string): OfficeBackgroundId {
  const normalized = backgroundId.trim();
  if (
    normalized === "shell_haze" ||
    normalized === "midnight_tide" ||
    normalized === "kelp_fog" ||
    normalized === "estuary_glow"
  ) {
    return normalized;
  }
  fail(`invalid_background:${backgroundId}`);
}

function ensurePaintingPresetId(presetId: string): string {
  const normalized = presetId.trim();
  if (OFFICE_PAINTINGS.some((entry) => entry.id === normalized)) return normalized;
  fail(`invalid_painting_preset:${presetId}`);
}

function ensureDecorPackId(packId: string): (typeof OFFICE_DECOR_PACKS)[number] {
  const normalized = packId.trim();
  const pack = OFFICE_DECOR_PACKS.find((entry) => entry.id === normalized);
  if (pack) return pack;
  fail(`invalid_decor_pack:${packId}`);
}

function ensureWallArtSlotId(slotId: string): (typeof WALL_ART_SLOTS)[number]["id"] {
  const normalized = slotId.trim();
  if (WALL_ART_SLOTS.some((entry) => entry.id === normalized)) {
    return normalized as (typeof WALL_ART_SLOTS)[number]["id"];
  }
  fail(`invalid_wall_art_slot:${slotId}`);
}

function getWallArtSlotLayout(
  officeSettings: OfficeSettingsModel,
  slotId: (typeof WALL_ART_SLOTS)[number]["id"],
): { position: [number, number, number]; rotation: [number, number, number] } {
  const halfWidth = officeSettings.officeFootprint.width / 2;
  const halfDepth = officeSettings.officeFootprint.depth / 2;
  const artY = 3.2;
  const inset = 0.23;
  switch (slotId) {
    case "back-left":
      return {
        position: [-Math.max(4, halfWidth * 0.45), artY, -halfDepth + inset],
        rotation: [0, 0, 0],
      };
    case "back-center":
      return {
        position: [0, artY, -halfDepth + inset],
        rotation: [0, 0, 0],
      };
    case "back-right":
      return {
        position: [Math.max(4, halfWidth * 0.45), artY, -halfDepth + inset],
        rotation: [0, 0, 0],
      };
    case "left-center":
      return {
        position: [-halfWidth + inset, artY, 0],
        rotation: [0, Math.PI / 2, 0],
      };
  }
}

function formatDecorState(
  settings: OfficeSettingsModel,
  paintings: OfficeObjectModel[],
): {
  decor: OfficeSettingsModel["decor"];
  paintings: Array<{ slotId: string; paintingPresetId: string; objectId: string }>;
} {
  return {
    decor: settings.decor,
    paintings: paintings
      .filter((entry) => entry.meshType === "wall-art")
      .map((entry) => ({
        slotId:
          typeof entry.metadata?.wallSlotId === "string" ? String(entry.metadata.wallSlotId) : "",
        paintingPresetId:
          typeof entry.metadata?.paintingPresetId === "string"
            ? String(entry.metadata.paintingPresetId)
            : "",
        objectId: entry.id,
      }))
      .filter((entry) => entry.slotId && entry.paintingPresetId),
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function firstUsableDepartmentId(company: CompanyModel): string {
  const preferred = company.departments.find((entry) => entry.id === "dept-products");
  if (preferred) return preferred.id;
  return company.departments[0]?.id ?? "dept-products";
}

function nextProjectId(company: CompanyModel, base: string): string {
  const slug = slugify(base) || "office-team";
  const direct = slug.startsWith("proj-") ? slug : `proj-${slug}`;
  if (!company.projects.some((entry) => entry.id === direct)) return direct;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${direct}-${index}`;
    if (!company.projects.some((entry) => entry.id === candidate)) return candidate;
  }
  return `${direct}-${Date.now()}`;
}

async function ensureTeamClusterProject(opts: {
  store: ReturnType<typeof createSidecarStore>;
  metadata: Record<string, unknown>;
  fallbackObjectId: string;
}): Promise<Record<string, unknown>> {
  const company = await opts.store.readCompanyModel();
  const requestedTeamId =
    typeof opts.metadata.teamId === "string" ? opts.metadata.teamId.trim() : "";
  const requestedName = typeof opts.metadata.name === "string" ? opts.metadata.name.trim() : "";
  const requestedDescription =
    typeof opts.metadata.description === "string" ? opts.metadata.description.trim() : "";
  let projectId = requestedTeamId.startsWith("team-") ? requestedTeamId.slice("team-".length) : "";
  if (!projectId) {
    const seed = requestedName || requestedTeamId || opts.fallbackObjectId;
    projectId = nextProjectId(company, seed);
  }
  let project = company.projects.find((entry) => entry.id === projectId);
  let nextCompany = company;

  if (!project) {
    const projectName = requestedName || `Team ${projectId.replace(/^proj-/, "")}`;
    project = {
      id: projectId,
      departmentId: firstUsableDepartmentId(company),
      name: projectName,
      githubUrl: "",
      status: "active",
      goal: requestedDescription || `Operate team ${projectName}`,
      kpis: [],
      account: {
        id: `${projectId}:account`,
        projectId,
        currency: "USD",
        balanceCents: 0,
        updatedAt: new Date().toISOString(),
      },
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    };
    nextCompany = {
      ...company,
      projects: [...company.projects, project],
    };
    await opts.store.writeCompanyModel(nextCompany);
  } else if (project.status === "archived") {
    const revived = { ...project, status: "active" as const };
    nextCompany = {
      ...company,
      projects: company.projects.map((entry) => (entry.id === projectId ? revived : entry)),
    };
    project = revived;
    await opts.store.writeCompanyModel(nextCompany);
  }
  if (!project) fail("team_cluster_project_resolution_failed");

  return {
    ...opts.metadata,
    teamId: `team-${project.id}`,
    name: requestedName || project.name,
    ...(requestedDescription ? { description: requestedDescription } : {}),
  };
}

function getTeamNameById(company: CompanyModel, teamId: string): string {
  if (!teamId.startsWith("team-")) return "";
  const projectId = teamId.slice("team-".length);
  const project = company.projects.find((entry) => entry.id === projectId);
  return project?.name ?? "";
}

export function findInvalidOfficeObjects(input: {
  objects: OfficeObjectModel[];
  company: CompanyModel;
}): Array<{
  id: string;
  meshType: string;
  reasons: string[];
}> {
  const projectIds = new Set(input.company.projects.map((entry) => entry.id));
  const archivedProjectIds = new Set(
    input.company.projects.filter((entry) => entry.status === "archived").map((entry) => entry.id),
  );
  const issues: Array<{ id: string; meshType: string; reasons: string[] }> = [];
  for (const object of input.objects) {
    const reasons: string[] = [];
    if (object.meshType === "custom-mesh") {
      const meshPath =
        typeof object.metadata?.meshPublicPath === "string"
          ? object.metadata.meshPublicPath.trim()
          : "";
      if (!meshPath) {
        reasons.push("missing_mesh_public_path");
      }
    }
    if (object.meshType === "team-cluster") {
      const teamId =
        typeof object.metadata?.teamId === "string" ? object.metadata.teamId.trim() : "";
      if (!teamId) {
        reasons.push("missing_team_id");
      } else if (teamId === "team-management") {
        // MEM-0176: the CEO desk anchor persists through a synthetic management cluster.
        // It is not backed by a normal project row and should not be treated as missing team data.
      } else if (!teamId.startsWith("team-")) {
        reasons.push("invalid_team_id_format");
      } else {
        const projectId = teamId.slice("team-".length);
        if (!projectIds.has(projectId)) {
          reasons.push("team_project_missing");
        } else if (archivedProjectIds.has(projectId)) {
          reasons.push("team_project_archived");
        }
      }
    }
    if (reasons.length > 0) {
      issues.push({ id: object.id, meshType: object.meshType, reasons });
    }
  }
  return issues;
}

async function writeMeshySpecFile(input: {
  prompt: string;
  style: string;
  assetType: string;
  deliverable: string;
}): Promise<{ path: string; title: string }> {
  const openclawHome = resolveOpenclawHome();
  const assetsDir = path.join(openclawHome, "assets", "mesh");
  await mkdir(assetsDir, { recursive: true });
  const now = new Date();
  const createdAt = now.toISOString();
  const stamp = createdAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const title = input.prompt.trim() || "Office Asset Request";
  const slug = slugify(title) || "office-asset";
  const filename = `${stamp}--${slug}.md`;
  const targetPath = path.join(assetsDir, filename);

  const body = `# ${title}

- created_at_utc: ${createdAt}
- asset_type: ${input.assetType}
- style: ${input.style}
- target_use: office_decor
- deliverable: ${input.deliverable}
- tags: [office, decoration, ${input.assetType}, ${input.style}]

## Prompt (verbatim)
${input.prompt}

## Clarified requirements
- Intended for ShellCorp office decoration.
- Keep style consistent with current office aesthetic.

## Assumptions
- This request is spec-first and does not trigger direct Meshy API generation.
- Resulting output should be compatible with custom-mesh decoration flow.

## Open questions
- Should this be placed as furniture, wall decor, or a free-standing prop?

## Next steps
- Use meshy-asset-capture skill to refine and execute generation.
- Import validated mesh and place via \`shellcorp office add custom-mesh ...\`.
`;

  await writeFile(targetPath, body, "utf-8");

  const indexPath = path.join(assetsDir, "INDEX.md");
  await appendFile(
    indexPath,
    `- ${createdAt.slice(0, 10)} | ${title} | ${targetPath} | office,${input.assetType},${input.style}\n`,
    "utf-8",
  );

  return { path: targetPath, title };
}

export function registerOfficeCommands(program: Command): void {
  const store = createSidecarStore();
  const office = program.command("office").description("Manage office layout and personalization");

  office
    .command("init")
    .description("Apply the canonical starter office template")
    .option("--force", "Overwrite existing office.json and office-objects.json", false)
    .option("--json", "Output JSON", false)
    .action(async (opts: { force?: boolean; json?: boolean }) => {
      const starterOffice = await readStarterOfficeTemplates();
      const currentObjects = await store.readOfficeObjects();
      const currentSettings = await store.readOfficeSettings();
      const hasExistingObjects = currentObjects.length > 0;
      const hasExistingSettings =
        currentSettings.officeLayout.tiles.length !== 35 * 35 ||
        currentSettings.decor.floorPatternId !== "sandstone_tiles" ||
        currentSettings.decor.wallColorId !== "gallery_cream" ||
        currentSettings.decor.backgroundId !== "shell_haze" ||
        currentSettings.viewProfile !== "free_orbit_3d" ||
        currentSettings.cameraOrientation !== "south_east";
      if ((hasExistingObjects || hasExistingSettings) && opts.force !== true) {
        fail("starter_office_exists:use_force");
      }
      await store.writeOfficeSettings(starterOffice.officeSettings);
      await store.writeOfficeObjects(starterOffice.officeObjects);
      formatOutput(
        opts.json ? "json" : "text",
        {
          ok: true,
          forced: opts.force === true,
          officeSettings: starterOffice.officeSettings,
          officeObjects: starterOffice.officeObjects,
        },
        `Applied starter office (${starterOffice.officeObjects.length} objects)`,
      );
    });

  office
    .command("print")
    .option("--width <n>", "Grid width", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 15) fail(`invalid_width:${value}`);
      return parsed;
    })
    .option("--height <n>", "Grid height", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 10) fail(`invalid_height:${value}`);
      return parsed;
    })
    .option("--no-coords", "Hide coordinate labels")
    .option("--no-legend", "Hide legend")
    .option("--no-color", "Disable ANSI colors")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        width?: number;
        height?: number;
        coords?: boolean;
        legend?: boolean;
        color?: boolean;
        json?: boolean;
      }) => {
        const objects = await store.readOfficeObjects();
        const company = await store.readCompanyModel();
        if (opts.json) {
          console.log(
            JSON.stringify(
              {
                objects,
                teams: company.projects.map((project) => ({
                  teamId: `team-${project.id}`,
                  name: project.name,
                })),
              },
              null,
              2,
            ),
          );
          return;
        }
        const rendered = renderOfficeAscii(objects, company.agents, {
          width: opts.width,
          height: opts.height,
          showCoords: opts.coords,
          showLegend: opts.legend,
          useColor: opts.color !== false && Boolean(process.stdout.isTTY),
        });
        console.log(rendered);
      },
    );

  office
    .command("list")
    .option("--type <meshType>", "Filter by mesh type")
    .option("--json", "Output JSON", false)
    .action(async (opts: { type?: string; json?: boolean }) => {
      const objects = await store.readOfficeObjects();
      const filtered = opts.type?.trim()
        ? objects.filter((entry) => entry.meshType === opts.type?.trim())
        : objects;
      if (opts.json) {
        console.log(JSON.stringify({ objects: filtered }, null, 2));
        return;
      }
      if (filtered.length === 0) {
        console.log("No office objects found.");
        return;
      }
      const lines = filtered.map(
        (entry) => `${entry.id} | ${entry.meshType} | pos=${entry.position.join(",")}`,
      );
      console.log(lines.join("\n"));
    });

  office
    .command("doctor")
    .description("Detect and optionally remove invalid office objects")
    .option("--fix", "Remove invalid objects", false)
    .option(
      "--reason <reason>",
      "Only include invalid objects matching this reason (repeatable)",
      collectValue,
      [] as string[],
    )
    .option("--json", "Output JSON", false)
    .action(async (opts: { fix?: boolean; reason?: string[]; json?: boolean }) => {
      const objects = await store.readOfficeObjects();
      const company = await store.readCompanyModel();
      const allInvalid = findInvalidOfficeObjects({ objects, company });
      const reasonFilter = new Set(
        (opts.reason ?? []).map((entry) => entry.trim()).filter(Boolean),
      );
      const invalid =
        reasonFilter.size === 0
          ? allInvalid
          : allInvalid.filter((entry) => entry.reasons.some((reason) => reasonFilter.has(reason)));
      let removed: string[] = [];
      if (opts.fix && invalid.length > 0) {
        const invalidSet = new Set(invalid.map((entry) => entry.id));
        const next = objects.filter((entry) => !invalidSet.has(entry.id));
        removed = [...invalidSet];
        await store.writeOfficeObjects(next);
      }
      const payload = {
        ok: invalid.length === 0,
        totalInvalidCount: allInvalid.length,
        invalidCount: invalid.length,
        filteredByReason: [...reasonFilter],
        invalid,
        fixed: opts.fix === true,
        removed,
      };
      if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }
      if (invalid.length === 0) {
        console.log("office-objects: ok");
        return;
      }
      console.log(`office-objects: invalid (${invalid.length})`);
      for (const entry of invalid) {
        console.log(`- ${entry.id} | ${entry.meshType} | ${entry.reasons.join(",")}`);
      }
      if (opts.fix) {
        console.log(`removed ${removed.length} invalid objects`);
      } else {
        console.log("run `npm run shell -- office doctor --fix` to remove invalid objects");
      }
    });

  office
    .command("teams")
    .option("--json", "Output JSON", false)
    .action(async (opts: { json?: boolean }) => {
      const objects = await store.readOfficeObjects();
      const company = await store.readCompanyModel();
      const teamObjects = objects.filter((entry) => entry.meshType === "team-cluster");
      const payload = teamObjects.map((entry) => {
        const teamId = String(entry.metadata?.teamId ?? "");
        const projectId = teamId.startsWith("team-") ? teamId.slice("team-".length) : "";
        const agentCount = company.agents.filter((agent) => agent.projectId === projectId).length;
        return {
          id: entry.id,
          teamId,
          name: String(entry.metadata?.name ?? getTeamNameById(company, teamId)),
          position: entry.position,
          agentCount,
        };
      });
      if (opts.json) {
        console.log(JSON.stringify({ teams: payload }, null, 2));
        return;
      }
      if (payload.length === 0) {
        console.log("No team clusters found.");
        return;
      }
      console.log(
        payload
          .map(
            (entry) =>
              `${entry.teamId || "(unlinked)"} | ${entry.name || "Unnamed"} | agents=${entry.agentCount}`,
          )
          .join("\n"),
      );
    });

  office
    .command("add")
    .argument("<meshType>", "Object mesh type")
    .option("--position <x,y,z>", "World position")
    .option("--auto-place", "Find first available placement slot", false)
    .option("--rotation <x,y,z>", "Rotation")
    .option("--scale <x,y,z>", "Scale")
    .option("--id <id>", "Custom object id")
    .option("--mesh-public-path <path>", "Custom mesh public URL/path")
    .option("--display-name <name>", "Custom mesh display name")
    .option("--metadata <key=value>", "Metadata entries (repeatable)", collectValue, [] as string[])
    .option("--json", "Output JSON", false)
    .action(
      async (
        meshTypeArg: string,
        opts: {
          position?: string;
          autoPlace?: boolean;
          rotation?: string;
          scale?: string;
          id?: string;
          meshPublicPath?: string;
          displayName?: string;
          metadata: string[];
          json?: boolean;
        },
      ) => {
        const meshType = ensureMeshType(meshTypeArg);
        const rotation = opts.rotation ? parseVector3(opts.rotation, "--rotation") : undefined;
        const scale = opts.scale ? parseVector3(opts.scale, "--scale") : undefined;
        let metadata = parseMetadata(opts.metadata ?? []);
        if (opts.meshPublicPath?.trim()) metadata.meshPublicPath = opts.meshPublicPath.trim();
        if (opts.displayName?.trim()) metadata.displayName = opts.displayName.trim();
        const objectId = opts.id?.trim() || generateObjectId(meshType);
        const hasPosition = Boolean(opts.position && opts.position.trim());
        const wantsAutoPlace = opts.autoPlace === true;
        if (!hasPosition && !wantsAutoPlace) {
          fail("placement_requires_position_or_auto");
        }
        if (hasPosition && wantsAutoPlace) {
          fail("placement_flags_conflict");
        }
        if (meshType === "custom-mesh") {
          const meshPath =
            typeof metadata.meshPublicPath === "string" ? metadata.meshPublicPath.trim() : "";
          if (!meshPath) fail("custom_mesh_requires_asset_metadata");
        }
        if (meshType === "team-cluster") {
          metadata = await ensureTeamClusterProject({
            store,
            metadata,
            fallbackObjectId: objectId,
          });
        }

        const objects = await store.readOfficeObjects();
        if (objects.some((entry) => entry.id === objectId)) {
          fail(`object_exists:${objectId}`);
        }
        const position =
          hasPosition && opts.position
            ? parseVector3(opts.position, "--position")
            : findFirstOpenPlacement({
                meshType,
                metadata,
                existingObjects: objects,
                bounds: { halfExtent: HALF_FLOOR },
              });
        if (!position) {
          fail(`no_empty_space_available:${meshType}`);
        }
        assertPositionInBounds(position);
        assertPositionUnoccupied({ position, meshType, metadata, objects });

        const nextObject: OfficeObjectModel = {
          id: objectId,
          identifier: objectId,
          meshType,
          position,
          ...(rotation ? { rotation } : {}),
          ...(scale ? { scale } : {}),
          ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
        };
        await store.writeOfficeObjects([...objects, nextObject]);
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, object: nextObject },
          `Added object ${objectId}`,
        );
      },
    );

  office
    .command("move")
    .argument("<objectId>", "Object id")
    .requiredOption("--position <x,y,z>", "New position")
    .option("--rotation <x,y,z>", "New rotation")
    .option("--json", "Output JSON", false)
    .action(
      async (objectId: string, opts: { position: string; rotation?: string; json?: boolean }) => {
        const objects = await store.readOfficeObjects();
        const index = objects.findIndex((entry) => entry.id === objectId.trim());
        if (index === -1) fail(`object_not_found:${objectId}`);
        const position = parseVector3(opts.position, "--position");
        assertPositionInBounds(position);
        const rotation = opts.rotation ? parseVector3(opts.rotation, "--rotation") : undefined;
        const next = [...objects];
        const current = next[index];
        assertPositionUnoccupied({
          position,
          meshType: current.meshType,
          metadata: current.metadata,
          objects,
          ignoreObjectId: current.id,
        });
        next[index] = {
          ...current,
          position,
          ...(rotation ? { rotation } : {}),
        };
        await store.writeOfficeObjects(next);
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, object: next[index] },
          `Moved object ${objectId}`,
        );
      },
    );

  office
    .command("remove")
    .argument("<objectId>", "Object id")
    .option("--json", "Output JSON", false)
    .action(async (objectId: string, opts: { json?: boolean }) => {
      const objects = await store.readOfficeObjects();
      const found = objects.find((entry) => entry.id === objectId.trim());
      if (!found) fail(`object_not_found:${objectId}`);
      const next = objects.filter((entry) => entry.id !== objectId.trim());
      await store.writeOfficeObjects(next);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, removed: found },
        `Removed object ${objectId}`,
      );
    });

  office
    .command("generate")
    .argument("<prompt...>", "Meshy prompt for office asset")
    .option("--style <style>", "Asset style", "low-poly")
    .option("--type <assetType>", "Asset type", "prop")
    .option("--deliverable <deliverable>", "spec-only|generate-later|unknown", "spec-only")
    .option("--json", "Output JSON", false)
    .action(
      async (
        promptParts: string[],
        opts: { style: string; type: string; deliverable: string; json?: boolean },
      ) => {
        const prompt = promptParts.join(" ").trim();
        if (!prompt) fail("missing_prompt");
        const written = await writeMeshySpecFile({
          prompt,
          style: opts.style.trim(),
          assetType: opts.type.trim(),
          deliverable: opts.deliverable.trim(),
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, title: written.title, path: written.path },
          `Meshy spec saved: ${written.path}`,
        );
      },
    );

  const decor = office.command("decor").description("Manage office decor settings and wall art");

  decor
    .command("docs")
    .option("--json", "Output JSON", false)
    .action((opts: { json?: boolean }) => {
      const examples = [
        "shellcorp office decor",
        "shellcorp office decor list",
        "shellcorp office decor pack list",
        "shellcorp office decor floor list",
        "shellcorp office decor wall list",
        "shellcorp office decor background list",
        "shellcorp office decor painting list",
        "shellcorp office decor pack apply clam-cabinet",
        "shellcorp office decor floor set walnut_parquet",
        "shellcorp office decor wall set sage_mist",
        "shellcorp office decor background set midnight_tide",
        "shellcorp office decor painting place back-center sunrise_blocks",
        "shellcorp office decor painting clear back-center",
      ];
      const payload = {
        purpose: "Configure ShellCorp office decoration through office.json and wall-art objects.",
        examples,
      };
      formatOutput(
        opts.json ? "json" : "text",
        payload,
        ["Office decor CLI", "", "Examples:", ...examples.map((entry) => `- ${entry}`)].join("\n"),
      );
    });

  decor
    .command("list")
    .option("--json", "Output JSON", false)
    .action(async (opts: { json?: boolean }) => {
      const settings = await store.readOfficeSettings();
      const objects = await store.readOfficeObjects();
      const payload = {
        current: formatDecorState(settings, objects),
        packs: OFFICE_DECOR_PACKS,
        floorPatterns: OFFICE_FLOOR_PATTERNS,
        wallColors: OFFICE_WALL_COLORS,
        backgrounds: OFFICE_BACKGROUNDS,
        paintings: OFFICE_PAINTINGS,
        slots: WALL_ART_SLOTS,
      };
      formatOutput(
        opts.json ? "json" : "text",
        payload,
        [
          `Current floor: ${settings.decor.floorPatternId}`,
          `Current wall: ${settings.decor.wallColorId}`,
          `Current background: ${settings.decor.backgroundId}`,
          `Paintings: ${payload.current.paintings.length}`,
          "",
          "Use `shellcorp office decor floor|wall|background|painting|pack list` to inspect options.",
        ].join("\n"),
      );
    });

  decor.option("--json", "Output JSON", false).action(async (opts: { json?: boolean }) => {
    const settings = await store.readOfficeSettings();
    const objects = await store.readOfficeObjects();
    const payload = formatDecorState(settings, objects);
    formatOutput(
      opts.json ? "json" : "text",
      payload,
      [
        `Current floor: ${settings.decor.floorPatternId}`,
        `Current wall: ${settings.decor.wallColorId}`,
        `Current background: ${settings.decor.backgroundId}`,
        `Paintings: ${payload.paintings.map((entry) => `${entry.slotId}=${entry.paintingPresetId}`).join(", ") || "none"}`,
        "",
        "Use `shellcorp office decor list` for the full catalog.",
      ].join("\n"),
    );
  });

  const decorPack = decor.command("pack").description("Apply curated decor packs");
  decorPack
    .command("list")
    .option("--json", "Output JSON", false)
    .action((opts: { json?: boolean }) => {
      formatOutput(
        opts.json ? "json" : "text",
        { packs: OFFICE_DECOR_PACKS },
        OFFICE_DECOR_PACKS.map(
          (entry) =>
            `${entry.id} | ${entry.label} | floor=${entry.floorPatternId} wall=${entry.wallColorId} background=${entry.backgroundId}`,
        ).join("\n"),
      );
    });
  decorPack
    .command("apply")
    .argument("<packId>", "Decor pack id")
    .option("--json", "Output JSON", false)
    .action(async (packId: string, opts: { json?: boolean }) => {
      const pack = ensureDecorPackId(packId);
      const settings = await store.readOfficeSettings();
      const nextSettings: OfficeSettingsModel = {
        ...settings,
        decor: {
          floorPatternId: pack.floorPatternId,
          wallColorId: pack.wallColorId,
          backgroundId: pack.backgroundId,
        },
      };
      await store.writeOfficeSettings(nextSettings);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, packId: pack.id, decor: nextSettings.decor },
        `Applied decor pack ${pack.id}`,
      );
    });

  const decorFloor = decor.command("floor").description("Manage floor decor");
  decorFloor
    .command("list")
    .option("--json", "Output JSON", false)
    .action((opts: { json?: boolean }) => {
      formatOutput(
        opts.json ? "json" : "text",
        { floorPatterns: OFFICE_FLOOR_PATTERNS },
        OFFICE_FLOOR_PATTERNS.map(
          (entry) => `${entry.id} | ${entry.label} | ${entry.description}`,
        ).join("\n"),
      );
    });
  decorFloor
    .command("set")
    .argument("<patternId>", "Floor pattern id")
    .option("--json", "Output JSON", false)
    .action(async (patternId: string, opts: { json?: boolean }) => {
      const normalized = ensureFloorPatternId(patternId);
      const settings = await store.readOfficeSettings();
      const nextSettings: OfficeSettingsModel = {
        ...settings,
        decor: {
          ...settings.decor,
          floorPatternId: normalized,
        },
      };
      await store.writeOfficeSettings(nextSettings);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, floorPatternId: normalized, decor: nextSettings.decor },
        `Office floor set to ${normalized}`,
      );
    });

  const decorWall = decor.command("wall").description("Manage wall decor");
  decorWall
    .command("list")
    .option("--json", "Output JSON", false)
    .action((opts: { json?: boolean }) => {
      formatOutput(
        opts.json ? "json" : "text",
        { wallColors: OFFICE_WALL_COLORS },
        OFFICE_WALL_COLORS.map(
          (entry) => `${entry.id} | ${entry.label} | ${entry.description}`,
        ).join("\n"),
      );
    });
  decorWall
    .command("set")
    .argument("<wallColorId>", "Wall color id")
    .option("--json", "Output JSON", false)
    .action(async (wallColorId: string, opts: { json?: boolean }) => {
      const normalized = ensureWallColorId(wallColorId);
      const settings = await store.readOfficeSettings();
      const nextSettings: OfficeSettingsModel = {
        ...settings,
        decor: {
          ...settings.decor,
          wallColorId: normalized,
        },
      };
      await store.writeOfficeSettings(nextSettings);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, wallColorId: normalized, decor: nextSettings.decor },
        `Office wall color set to ${normalized}`,
      );
    });

  const decorBackground = decor
    .command("background")
    .description("Manage scene background decor");
  decorBackground
    .command("list")
    .option("--json", "Output JSON", false)
    .action((opts: { json?: boolean }) => {
      formatOutput(
        opts.json ? "json" : "text",
        { backgrounds: OFFICE_BACKGROUNDS },
        OFFICE_BACKGROUNDS.map(
          (entry) => `${entry.id} | ${entry.label} | ${entry.description}`,
        ).join("\n"),
      );
    });
  decorBackground
    .command("set")
    .argument("<backgroundId>", "Background preset id")
    .option("--json", "Output JSON", false)
    .action(async (backgroundId: string, opts: { json?: boolean }) => {
      const normalized = ensureBackgroundId(backgroundId);
      const settings = await store.readOfficeSettings();
      const nextSettings: OfficeSettingsModel = {
        ...settings,
        decor: {
          ...settings.decor,
          backgroundId: normalized,
        },
      };
      await store.writeOfficeSettings(nextSettings);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, backgroundId: normalized, decor: nextSettings.decor },
        `Office background set to ${normalized}`,
      );
    });

  const painting = decor.command("painting").description("Manage fixed-slot wall paintings");
  painting
    .command("list")
    .option("--json", "Output JSON", false)
    .action((opts: { json?: boolean }) => {
      formatOutput(
        opts.json ? "json" : "text",
        { paintings: OFFICE_PAINTINGS, slots: WALL_ART_SLOTS },
        [
          "Paintings:",
          ...OFFICE_PAINTINGS.map((entry) => `- ${entry.id} | ${entry.label}`),
          "",
          "Slots:",
          ...WALL_ART_SLOTS.map((entry) => `- ${entry.id} | ${entry.label}`),
        ].join("\n"),
      );
    });
  painting
    .command("place")
    .argument("<slotId>", "Wall slot id")
    .argument("<paintingPresetId>", "Painting preset id")
    .option("--json", "Output JSON", false)
    .action(async (slotId: string, paintingPresetId: string, opts: { json?: boolean }) => {
      const normalizedSlotId = ensureWallArtSlotId(slotId);
      const normalizedPaintingPresetId = ensurePaintingPresetId(paintingPresetId);
      const settings = await store.readOfficeSettings();
      const objects = await store.readOfficeObjects();
      const layout = getWallArtSlotLayout(settings, normalizedSlotId);
      const nextObjects = objects.filter((entry) => entry.id !== `wall-art-${normalizedSlotId}`);
      nextObjects.push({
        id: `wall-art-${normalizedSlotId}`,
        identifier: `wall-art-${normalizedSlotId}`,
        meshType: "wall-art",
        position: layout.position,
        rotation: layout.rotation,
        metadata: {
          wallSlotId: normalizedSlotId,
          paintingPresetId: normalizedPaintingPresetId,
          displayName:
            OFFICE_PAINTINGS.find((entry) => entry.id === normalizedPaintingPresetId)?.label ??
            normalizedPaintingPresetId,
        },
      });
      await store.writeOfficeObjects(nextObjects);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, slotId: normalizedSlotId, paintingPresetId: normalizedPaintingPresetId },
        `Placed ${normalizedPaintingPresetId} on ${normalizedSlotId}`,
      );
    });
  painting
    .command("clear")
    .argument("<slotId>", "Wall slot id")
    .option("--json", "Output JSON", false)
    .action(async (slotId: string, opts: { json?: boolean }) => {
      const normalizedSlotId = ensureWallArtSlotId(slotId);
      const objects = await store.readOfficeObjects();
      const nextObjects = objects.filter((entry) => entry.id !== `wall-art-${normalizedSlotId}`);
      await store.writeOfficeObjects(nextObjects);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, slotId: normalizedSlotId },
        `Cleared wall art slot ${normalizedSlotId}`,
      );
    });

  const theme = office.command("theme").description("Manage office style presets");
  theme
    .command("list")
    .option("--json", "Output JSON", false)
    .action((opts: { json?: boolean }) => {
      if (opts.json) {
        console.log(JSON.stringify({ presets: THEME_PRESETS }, null, 2));
        return;
      }
      console.log(THEME_PRESETS.map((entry) => `${entry.id} | ${entry.description}`).join("\n"));
    });

  theme
    .command("set")
    .argument("<preset>", "Theme preset")
    .option("--json", "Output JSON", false)
    .action(async (preset: string, opts: { json?: boolean }) => {
      const normalized = ensureThemePreset(preset);
      await store.writeOfficeStylePreset(normalized);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, preset: normalized },
        `Office theme set to ${normalized}`,
      );
    });

  theme.option("--json", "Output JSON", false).action(async (opts: { json?: boolean }) => {
    const current = await store.readOfficeStylePreset();
    if (opts.json) {
      console.log(JSON.stringify({ preset: current }, null, 2));
      return;
    }
    console.log(`Current office theme: ${current}`);
  });
}
