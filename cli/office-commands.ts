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
import path from "node:path";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { Command } from "commander";
import {
  createSidecarStore,
  generateObjectId,
  resolveOpenclawHome,
  type CompanyModel,
  type OfficeObjectModel,
  type OfficeStylePreset,
} from "./sidecar-store.js";
import { renderOfficeAscii } from "./office-renderer.js";

const FLOOR_SIZE = 35;
const HALF_FLOOR = FLOOR_SIZE / 2;
const MESH_TYPES = new Set(["team-cluster", "plant", "couch", "bookshelf", "pantry", "glass-wall", "custom-mesh"]);
const THEME_PRESETS: Array<{ id: OfficeStylePreset; description: string }> = [
  { id: "default", description: "Balanced default office palette" },
  { id: "pixel", description: "Pixel-like retro office mood" },
  { id: "brutalist", description: "High-contrast concrete office style" },
  { id: "cozy", description: "Warm and comfortable office style" },
];

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
  if (normalized === "default" || normalized === "pixel" || normalized === "brutalist" || normalized === "cozy") {
    return normalized;
  }
  fail(`invalid_theme_preset:${preset}`);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getTeamNameById(company: CompanyModel, teamId: string): string {
  if (!teamId.startsWith("team-")) return "";
  const projectId = teamId.slice("team-".length);
  const project = company.projects.find((entry) => entry.id === projectId);
  return project?.name ?? "";
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
  await appendFile(indexPath, `- ${createdAt.slice(0, 10)} | ${title} | ${targetPath} | office,${input.assetType},${input.style}\n`, "utf-8");

  return { path: targetPath, title };
}

export function registerOfficeCommands(program: Command): void {
  const store = createSidecarStore();
  const office = program.command("office").description("Manage office layout and personalization");

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
                teams: company.projects.map((project) => ({ teamId: `team-${project.id}`, name: project.name })),
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
      const filtered = opts.type?.trim() ? objects.filter((entry) => entry.meshType === opts.type?.trim()) : objects;
      if (opts.json) {
        console.log(JSON.stringify({ objects: filtered }, null, 2));
        return;
      }
      if (filtered.length === 0) {
        console.log("No office objects found.");
        return;
      }
      const lines = filtered.map((entry) => `${entry.id} | ${entry.meshType} | pos=${entry.position.join(",")}`);
      console.log(lines.join("\n"));
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
      console.log(payload.map((entry) => `${entry.teamId || "(unlinked)"} | ${entry.name || "Unnamed"} | agents=${entry.agentCount}`).join("\n"));
    });

  office
    .command("add")
    .argument("<meshType>", "Object mesh type")
    .requiredOption("--position <x,y,z>", "World position")
    .option("--rotation <x,y,z>", "Rotation")
    .option("--scale <x,y,z>", "Scale")
    .option("--id <id>", "Custom object id")
    .option("--metadata <key=value>", "Metadata entries (repeatable)", collectValue, [] as string[])
    .option("--json", "Output JSON", false)
    .action(
      async (meshTypeArg: string, opts: { position: string; rotation?: string; scale?: string; id?: string; metadata: string[]; json?: boolean }) => {
        const meshType = ensureMeshType(meshTypeArg);
        const position = parseVector3(opts.position, "--position");
        assertPositionInBounds(position);
        const rotation = opts.rotation ? parseVector3(opts.rotation, "--rotation") : undefined;
        const scale = opts.scale ? parseVector3(opts.scale, "--scale") : undefined;
        const metadata = parseMetadata(opts.metadata ?? []);
        const objectId = opts.id?.trim() || generateObjectId(meshType);

        const objects = await store.readOfficeObjects();
        if (objects.some((entry) => entry.id === objectId)) {
          fail(`object_exists:${objectId}`);
        }

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
        formatOutput(opts.json ? "json" : "text", { ok: true, object: nextObject }, `Added object ${objectId}`);
      },
    );

  office
    .command("move")
    .argument("<objectId>", "Object id")
    .requiredOption("--position <x,y,z>", "New position")
    .option("--rotation <x,y,z>", "New rotation")
    .option("--json", "Output JSON", false)
    .action(async (objectId: string, opts: { position: string; rotation?: string; json?: boolean }) => {
      const objects = await store.readOfficeObjects();
      const index = objects.findIndex((entry) => entry.id === objectId.trim());
      if (index === -1) fail(`object_not_found:${objectId}`);
      const position = parseVector3(opts.position, "--position");
      assertPositionInBounds(position);
      const rotation = opts.rotation ? parseVector3(opts.rotation, "--rotation") : undefined;
      const next = [...objects];
      const current = next[index];
      next[index] = {
        ...current,
        position,
        ...(rotation ? { rotation } : {}),
      };
      await store.writeOfficeObjects(next);
      formatOutput(opts.json ? "json" : "text", { ok: true, object: next[index] }, `Moved object ${objectId}`);
    });

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
      formatOutput(opts.json ? "json" : "text", { ok: true, removed: found }, `Removed object ${objectId}`);
    });

  office
    .command("generate")
    .argument("<prompt...>", "Meshy prompt for office asset")
    .option("--style <style>", "Asset style", "low-poly")
    .option("--type <assetType>", "Asset type", "prop")
    .option("--deliverable <deliverable>", "spec-only|generate-later|unknown", "spec-only")
    .option("--json", "Output JSON", false)
    .action(
      async (promptParts: string[], opts: { style: string; type: string; deliverable: string; json?: boolean }) => {
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
      formatOutput(opts.json ? "json" : "text", { ok: true, preset: normalized }, `Office theme set to ${normalized}`);
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

