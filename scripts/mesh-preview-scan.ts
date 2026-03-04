/**
 * Mesh Preview Scanner
 * ====================
 * Scans a mesh directory for .glb/.gltf assets and creates missing .preview.png
 * thumbnails by rendering each mesh headlessly in a browser.
 */
import { createServer } from "node:http";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright";
import type { Page } from "playwright";

const MESH_EXTENSIONS = new Set([".glb", ".gltf"]);
const PREVIEW_EXTENSIONS = [".preview.png", ".preview.jpg", ".preview.jpeg", ".preview.webp"];
const PREVIEW_WIDTH = 512;
const PREVIEW_HEIGHT = 512;
const RENDER_WAIT_MS = 12000;

interface CliOptions {
  dir: string;
  force: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  let dir = "~/.openclaw/assets/meshes";
  let force = false;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dir") {
      dir = argv[index + 1] ?? dir;
      index += 1;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  return { dir: resolveHomePath(dir), force, dryRun };
}

function resolveHomePath(inputPath: string): string {
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return path.resolve(inputPath);
}

function hashString(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildViewerHtml(relFilePath: string): string {
  const seed = hashString(relFilePath);
  const hueA = seed % 360;
  const hueB = (hueA + 32) % 360;
  const escaped = relFilePath.replace(/"/g, "&quot;");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Mesh Preview</title>
    <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        background: linear-gradient(145deg, hsl(${hueA} 24% 13%), hsl(${hueB} 30% 18%));
      }
      .stage {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
      }
      model-viewer {
        width: 88%;
        height: 88%;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 14px;
        background: radial-gradient(circle at 50% 30%, #f6f7fb, #dfe3ec);
      }
    </style>
  </head>
  <body>
    <div class="stage">
      <model-viewer
        id="viewer"
        src="/assets/${escaped}"
        camera-controls
        disable-pan
        auto-rotate
        rotation-per-second="14deg"
        camera-orbit="35deg 72deg auto"
        field-of-view="28deg"
        shadow-intensity="1"
        exposure="1"
        environment-image="neutral"
        tone-mapping="neutral"
      ></model-viewer>
    </div>
    <script>
      window.__meshReady = false;
      window.__meshError = "";
      const viewer = document.getElementById("viewer");
      viewer.addEventListener("load", () => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          window.__meshReady = true;
        }));
      });
      viewer.addEventListener("error", () => {
        window.__meshError = "failed_to_load_model";
      });
    </script>
  </body>
</html>`;
}

function safeRelative(meshDir: string, targetPath: string): string {
  return path.relative(meshDir, targetPath).split(path.sep).join("/");
}

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".glb") return "model/gltf-binary";
  if (ext === ".gltf") return "model/gltf+json";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".json") return "application/json";
  return "application/octet-stream";
}

async function withStaticServer<T>(meshDir: string, runTask: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createServer(async (req, res) => {
    const reqUrl = req.url ?? "/";
    const parsed = new URL(reqUrl, "http://127.0.0.1");
    if (parsed.pathname === "/viewer") {
      const rel = parsed.searchParams.get("file") ?? "";
      res.statusCode = 200;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(buildViewerHtml(rel));
      return;
    }
    if (!parsed.pathname.startsWith("/assets/")) {
      res.statusCode = 404;
      res.end("not_found");
      return;
    }
    const relPath = decodeURIComponent(parsed.pathname.slice("/assets/".length));
    const absolutePath = path.resolve(meshDir, relPath);
    if (!absolutePath.startsWith(path.resolve(meshDir))) {
      res.statusCode = 400;
      res.end("invalid_path");
      return;
    }
    try {
      const bytes = await readFile(absolutePath);
      res.statusCode = 200;
      res.setHeader("content-type", guessContentType(absolutePath));
      res.end(bytes);
    } catch {
      res.statusCode = 404;
      res.end("asset_not_found");
    }
  });

  const address = await new Promise<{ port: number }>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (typeof addr === "object" && addr && "port" in addr) {
        resolve({ port: addr.port });
      } else {
        reject(new Error("server_bind_failed"));
      }
    });
    server.on("error", (error) => reject(error));
  });

  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await runTask(baseUrl);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
}

async function listMeshFiles(rootDir: string): Promise<string[]> {
  const stack = [rootDir];
  const out: string[] = [];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && MESH_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        out.push(fullPath);
      }
    }
  }

  return out.sort((a, b) => a.localeCompare(b));
}

function hasAnyPreview(meshFilePath: string): boolean {
  const base = meshFilePath.replace(/\.(glb|gltf)$/i, "");
  return PREVIEW_EXTENSIONS.some((ext) => existsSync(`${base}${ext}`));
}

async function renderPreviewImage(
  page: Page,
  baseUrl: string,
  relMeshPath: string,
  outputPath: string,
): Promise<void> {
  await page.goto(`${baseUrl}/viewer?file=${encodeURIComponent(relMeshPath)}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as unknown as { __meshReady?: boolean }).__meshReady === true, {
    timeout: RENDER_WAIT_MS,
  });
  await page.screenshot({ path: outputPath, fullPage: false });
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(options.dir, { recursive: true });
  const meshFiles = await listMeshFiles(options.dir);
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  if (options.dryRun) {
    for (const meshPath of meshFiles) {
      const hasPreview = hasAnyPreview(meshPath);
      if (hasPreview && !options.force) {
        skipped += 1;
      } else {
        generated += 1;
      }
    }
  } else {
    await withStaticServer(options.dir, async (baseUrl) => {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({
          viewport: { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT },
          deviceScaleFactor: 1,
        });
        for (const meshPath of meshFiles) {
          const basePath = meshPath.replace(/\.(glb|gltf)$/i, "");
          const previewPath = `${basePath}.preview.png`;
          const hasPreview = hasAnyPreview(meshPath);

          if (hasPreview && !options.force) {
            skipped += 1;
            continue;
          }

          const rel = safeRelative(options.dir, meshPath);
          try {
            await renderPreviewImage(page, baseUrl, rel, previewPath);
            generated += 1;
          } catch (error) {
            failed += 1;
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[mesh-preview-scan] failed render: ${rel} (${message})`);
          }
        }
      } finally {
        await browser.close();
      }
    });
  }

  console.log(`[mesh-preview-scan] directory: ${options.dir}`);
  console.log(`[mesh-preview-scan] meshes: ${meshFiles.length}`);
  console.log(`[mesh-preview-scan] generated: ${generated}`);
  console.log(`[mesh-preview-scan] skipped_existing: ${skipped}`);
  console.log(`[mesh-preview-scan] failed: ${failed}`);
  if (options.dryRun) {
    console.log("[mesh-preview-scan] dry-run mode (no files written)");
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[mesh-preview-scan] failed: ${message}`);
  process.exitCode = 1;
});
