/**
 * ONBOARDING COMMANDS
 * ===================
 * Purpose
 * - Bootstrap the minimum ShellCorp/OpenClaw local state for first-run setup.
 *
 * KEY CONCEPTS:
 * - Required sidecars live in `~/.openclaw`.
 * - UI-safe env vars live in `ui/.env.local` even when backend env lives at repo root.
 * - Onboarding is idempotent and only mutates ShellCorp-owned config by default.
 *
 * USAGE:
 * - shellcorp onboarding
 * - shellcorp onboarding --yes --style cozy --gateway-token token123
 *
 * MEMORY REFERENCES:
 * - MEM-0102
 * - MEM-0104
 * - MEM-0161
 * - MEM-0164
 * - MEM-0178
 * - MEM-0213
 */

import { existsSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { installShellcorpCli } from "./cli-install.js";
import {
  cliBlue,
  cliBold,
  cliCyan,
  cliDim,
  cliGreen,
  cliKeyValue,
  cliMagenta,
  cliRed,
  cliSection,
  cliStatus,
  cliYellow,
} from "./cli-utils.js";
import { findInvalidOfficeObjects } from "./office-commands.js";
import {
  type CompanyModel,
  createSidecarStore,
  type JsonObject,
  type OfficeStylePreset,
  resolveOpenclawHome,
  type ShellcorpConfigModel,
} from "./sidecar-store.js";
import { runDoctor } from "./team-commands/_shared.js";
import { startUiDevServer } from "./ui-commands.js";

type FileStatus = "created" | "updated" | "unchanged";

type OnboardingResult = {
  ok: boolean;
  stateDir: string;
  preflight: {
    ok: boolean;
    openclawConfigPresent: boolean;
    mainAgentPresent: boolean;
    issues: string[];
  };
  officeStylePreset: OfficeStylePreset;
  sidecars: Record<string, FileStatus>;
  uiEnvPath: string;
  uiEnvStatus: FileStatus;
  uiEnv: Record<string, string>;
  cliInstall: {
    attempted: boolean;
    ok: boolean;
    status: "installed" | "skipped" | "failed";
    command: string;
    note: string;
  };
  doctor: {
    teamData: { ok: boolean; issues: string[] };
    officeObjects: {
      ok: boolean;
      invalid: Array<{ id: string; meshType: string; reasons: string[] }>;
    };
  };
  nextSteps: string[];
};

type OnboardingOptions = {
  style?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
  stateUrl?: string;
  convexUrl?: string;
  installCli?: boolean;
  skipInstallCli?: boolean;
  launchUi?: boolean;
  yes?: boolean;
  json?: boolean;
};

const OFFICE_STYLE_PRESETS: readonly OfficeStylePreset[] = [
  "default",
  "pixel",
  "brutalist",
  "cozy",
] as const;
const DEFAULT_UI_ENV: Record<string, string> = {
  VITE_GATEWAY_URL: "http://127.0.0.1:18789",
  VITE_GATEWAY_TOKEN: "",
  VITE_STATE_URL: "http://127.0.0.1:5173",
  VITE_CONVEX_URL: "",
};
const CONTROLLED_UI_ENV_KEYS = [
  "VITE_GATEWAY_URL",
  "VITE_GATEWAY_TOKEN",
  "VITE_STATE_URL",
  "VITE_CONVEX_URL",
] as const;
const SHELLCORP_BANNER = `
███████╗██╗  ██╗███████╗██╗     ██╗      ██████╗ ██████╗ ██████╗ 
██╔════╝██║  ██║██╔════╝██║     ██║     ██╔════╝██╔═══██╗██╔══██╗
███████╗███████║█████╗  ██║     ██║     ██║     ██║   ██║██████╔╝
╚════██║██╔══██║██╔══╝  ██║     ██║     ██║     ██║   ██║██╔══██╗
███████║██║  ██║███████╗███████╗███████╗╚██████╗╚██████╔╝██║  ██║
╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝
`;
const UI_START_COMMAND = "`npm run shell -- ui`";
const UI_ALIAS_COMMAND = "`shellcorp ui`";
const CLI_INSTALL_COMMAND = "`npm link`";

type OpenclawPreflight = {
  ok: boolean;
  openclawConfigPresent: boolean;
  mainAgentPresent: boolean;
  issues: string[];
};

function resolveRepoRoot(): string {
  const override = process.env.SHELLCORP_REPO_ROOT?.trim();
  if (override) return path.resolve(override);
  // In the bundled CJS CLI, __dirname is available while import.meta.url is not.
  const thisDir =
    typeof __dirname === "string" && __dirname.trim()
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url));
  // When run via "npm run shell -- onboarding", cwd may be the cli workspace dir. Resolve repo root from this file's location.
  const candidateRoot = path.resolve(thisDir, "..");
  const templatesMarker = path.join(candidateRoot, "templates", "sidecar", "company.template.json");
  if (existsSync(templatesMarker)) return candidateRoot;
  return path.resolve(process.cwd());
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonTemplate<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" ? (value as JsonObject) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeComparablePath(filePath: string, repoRoot: string): string {
  return path.resolve(repoRoot, filePath);
}

function readAgentList(config: JsonObject): Array<Record<string, unknown>> {
  const agents = asObject(config.agents);
  return asArray(agents.list).filter((entry): entry is Record<string, unknown> =>
    Boolean(entry && typeof entry === "object"),
  );
}

function runOpenclawPreflight(params: {
  openclawConfigPresent: boolean;
  config: JsonObject;
}): OpenclawPreflight {
  const agentList = readAgentList(params.config);
  const mainAgentPresent = agentList.some(
    (entry) => typeof entry.id === "string" && entry.id.trim() === "main",
  );
  const issues: string[] = [];
  if (!params.openclawConfigPresent) {
    issues.push("missing_openclaw_config");
  }
  if (!mainAgentPresent) {
    issues.push("missing_main_agent");
  }
  return {
    ok: issues.length === 0,
    openclawConfigPresent: params.openclawConfigPresent,
    mainAgentPresent,
    issues,
  };
}

function ensureMainAgentInConfig(config: JsonObject): JsonObject {
  const agents = asObject(config.agents);
  const list = asArray(agents.list);
  const hasMain = list.some(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      typeof (entry as Record<string, unknown>).id === "string" &&
      (entry as Record<string, unknown>).id === "main",
  );
  if (hasMain) return config;
  const openclawHome = resolveOpenclawHome();
  const defaults = asObject(agents.defaults);
  const defaultWorkspace =
    typeof defaults.workspace === "string" && defaults.workspace.trim()
      ? defaults.workspace.trim()
      : path.join(openclawHome, "workspace");
  const mainEntry: Record<string, unknown> = {
    id: "main",
    name: "CEO Agent",
    workspace: defaultWorkspace,
  };
  return {
    ...config,
    agents: {
      ...agents,
      list: [...list, mainEntry],
    },
  };
}

function printOnboardingIntro(): void {
  const banner = SHELLCORP_BANNER.trimEnd()
    .split("\n")
    .map((line, index) => (index % 2 === 0 ? cliCyan(line) : cliBlue(line)))
    .join("\n");
  console.log(banner);
  console.log(cliSection("ShellCorp Onboarding"));
  console.log(cliDim("ShellCorp is the office UI and operator layer on top of OpenClaw."));
  console.log(
    cliDim(
      "Before ShellCorp can bootstrap its own files, OpenClaw itself must already be onboarded.",
    ),
  );
  console.log(
    cliYellow(
      "If OpenClaw is not initialized, the main CEO agent will not exist and the ShellCorp office will not load correctly.",
    ),
  );
  console.log("");
}

function printPreflightFailure(result: OpenclawPreflight): void {
  console.log(cliBold(cliRed("OpenClaw preflight failed.")));
  if (!result.openclawConfigPresent) {
    console.log(`- ${cliRed("Missing")} \`~/.openclaw/openclaw.json\`.`);
  }
  if (!result.mainAgentPresent) {
    console.log(`- ${cliRed("Missing")} \`main\` in \`openclaw.json\` \`agents.list\`.`);
  }
  console.log("");
  console.log(cliSection("Do This First"));
  console.log(`- ${cliYellow("Complete the OpenClaw onboarding flow on this machine.")}`);
  console.log(`- ${cliYellow("Confirm OpenClaw has created")} \`~/.openclaw/openclaw.json\`.`);
  console.log(
    `- ${cliYellow("Confirm")} \`agents.list\` ${cliYellow("includes the main CEO agent with id")} \`main\`.`,
  );
  console.log(`- ${cliGreen("Then rerun")} \`shellcorp onboarding\`.`);
}

function printStepStart(current: number, total: number, title: string): void {
  const filled = Math.max(1, Math.round((current / total) * 12));
  const empty = Math.max(0, 12 - filled);
  const progressBar = `${cliMagenta(`[${"#".repeat(filled)}`)}${cliDim(`${"-".repeat(empty)}]`)}`;
  console.log(`${cliSection(`Step ${current}/${total}`)} ${progressBar} ${cliBold(title)}`);
}

function printStepDone(note: string): void {
  console.log(cliKeyValue("done:", note, "ok"));
  console.log("");
}

async function pauseBetweenSteps(enabled: boolean): Promise<void> {
  if (!enabled) return;
  await delay(1_000);
}

function parseDotEnv(raw: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1);
    if (!key) continue;
    entries[key] = value;
  }
  return entries;
}

async function readDotEnvFile(filePath: string): Promise<Record<string, string>> {
  if (!(await fileExists(filePath))) return {};
  return parseDotEnv(await readFile(filePath, "utf-8"));
}

function serializeDotEnv(entries: Record<string, string>): string {
  const orderedKeys = [
    ...CONTROLLED_UI_ENV_KEYS,
    ...Object.keys(entries)
      .filter(
        (key) => !CONTROLLED_UI_ENV_KEYS.includes(key as (typeof CONTROLLED_UI_ENV_KEYS)[number]),
      )
      .sort(),
  ];
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const key of orderedKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const value = entries[key] ?? "";
    lines.push(`${key}=${value}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeOfficeStylePreset(value: string | undefined): OfficeStylePreset | null {
  if (!value) return null;
  const trimmed = value.trim();
  return OFFICE_STYLE_PRESETS.includes(trimmed as OfficeStylePreset)
    ? (trimmed as OfficeStylePreset)
    : null;
}

async function promptForStyle(
  initial: OfficeStylePreset,
  skipPrompt: boolean,
): Promise<OfficeStylePreset> {
  if (skipPrompt || !input.isTTY || !output.isTTY) return initial;
  const prompt = [
    `Choose an office style preset [${OFFICE_STYLE_PRESETS.join("/")}]`,
    `(press enter for ${initial})`,
    ": ",
  ].join(" ");
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(prompt);
    return normalizeOfficeStylePreset(answer) ?? initial;
  } finally {
    rl.close();
  }
}

async function promptForYesNo(inputValues: {
  question: string;
  defaultValue: boolean;
  skipPrompt: boolean;
}): Promise<boolean> {
  if (inputValues.skipPrompt || !input.isTTY || !output.isTTY) {
    return inputValues.defaultValue;
  }
  const suffix = inputValues.defaultValue ? "[Y/n]" : "[y/N]";
  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question(`${inputValues.question} ${suffix}: `)).trim().toLowerCase();
    if (!answer) return inputValues.defaultValue;
    if (["y", "yes"].includes(answer)) return true;
    if (["n", "no"].includes(answer)) return false;
    return inputValues.defaultValue;
  } finally {
    rl.close();
  }
}

async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

async function ensureJsonSidecar<T>(filePath: string, payload: T): Promise<FileStatus> {
  if (await fileExists(filePath)) return "unchanged";
  await writeJsonFile(filePath, payload);
  return "created";
}

function removeOnboardingManagedNotionPlugin(config: JsonObject): JsonObject {
  const repoRoot = resolveRepoRoot();
  const plugins = asObject(config.plugins);
  const load = asObject(plugins.load);
  const entries = asObject(plugins.entries);
  const notionPluginPath = path.join(repoRoot, "extensions", "notion");
  const nextPaths = asArray(load.paths)
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => {
      const comparable = normalizeComparablePath(entry, repoRoot);
      return (
        comparable !== normalizeComparablePath("./extensions/notion", repoRoot) &&
        comparable !== normalizeComparablePath(notionPluginPath, repoRoot)
      );
    });
  const { ["notion-shell"]: _removedNotionEntry, ...remainingEntries } = entries;
  return {
    ...config,
    plugins: {
      ...plugins,
      load: {
        ...load,
        paths: nextPaths,
      },
      entries: remainingEntries,
    },
  };
}

function removeInvalidOpenclawRootKeys(config: JsonObject): JsonObject {
  const { version: _removedVersion, shellcorp: _removedShellcorp, ...remaining } = config;
  return remaining;
}

function ensureShellcorpDefaults(config: JsonObject): JsonObject {
  const tools = asObject(config.tools);
  const hooks = asObject(config.hooks);
  const internal = asObject(hooks.internal);
  const entries = asObject(internal.entries);
  const statusEntry = asObject(entries["shellcorp-status"]);
  const agents = asObject(config.agents);
  const defaults = asObject(agents.defaults);
  const heartbeat = asObject(defaults.heartbeat);
  return {
    ...config,
    tools: {
      ...tools,
      profile: typeof tools.profile === "string" && tools.profile.trim() ? tools.profile : "coding",
    },
    hooks: {
      ...hooks,
      internal: {
        ...internal,
        enabled: internal.enabled !== false,
        entries: {
          ...entries,
          "shellcorp-status": {
            ...statusEntry,
            enabled: statusEntry.enabled !== false,
          },
        },
      },
    },
    agents: {
      ...agents,
      defaults: {
        ...defaults,
        heartbeat: {
          every:
            typeof heartbeat.every === "string" && heartbeat.every.trim() ? heartbeat.every : "3m",
          includeReasoning:
            typeof heartbeat.includeReasoning === "boolean" ? heartbeat.includeReasoning : true,
          target:
            typeof heartbeat.target === "string" && heartbeat.target.trim()
              ? heartbeat.target
              : "last",
          prompt:
            typeof heartbeat.prompt === "string" && heartbeat.prompt.trim()
              ? heartbeat.prompt
              : "Read HEARTBEAT.md and follow it exactly. End your response with HEARTBEAT_OK.",
        },
      },
      list: Array.isArray(agents.list) ? agents.list : [],
    },
  };
}

function chooseShellcorpConvexSiteUrl(inputValues: {
  rootEnv: Record<string, string>;
  currentShellcorpConfig: ShellcorpConfigModel;
  legacyOpenclawConfig?: JsonObject;
  opts: OnboardingOptions;
}): string {
  const convex = asObject(inputValues.currentShellcorpConfig.convex);
  const legacyShellcorp = asObject(asObject(inputValues.legacyOpenclawConfig).shellcorp);
  const legacyConvex = asObject(legacyShellcorp.convex);
  return (
    inputValues.opts.convexUrl?.trim() ||
    inputValues.rootEnv.CONVEX_SITE_URL?.trim() ||
    inputValues.rootEnv.CONVEX_URL?.trim() ||
    (typeof convex.siteUrl === "string" ? convex.siteUrl.trim() : "") ||
    (typeof legacyConvex.siteUrl === "string" ? legacyConvex.siteUrl.trim() : "")
  );
}

function applyShellcorpConvexSiteUrl(
  config: ShellcorpConfigModel,
  siteUrl: string,
): ShellcorpConfigModel {
  const convex = asObject(config.convex);
  const trimmedSiteUrl = siteUrl.trim();
  if (!trimmedSiteUrl) return config;
  return {
    ...config,
    convex: {
      ...convex,
      siteUrl: trimmedSiteUrl,
    },
  };
}

function chooseUiEnvValues(inputValues: {
  currentUiEnv: Record<string, string>;
  rootEnv: Record<string, string>;
  exampleUiEnv: Record<string, string>;
  currentShellcorpConfig: ShellcorpConfigModel;
  opts: OnboardingOptions;
}): Record<string, string> {
  const fromRootConvex =
    inputValues.rootEnv.CONVEX_URL?.trim() || inputValues.rootEnv.CONVEX_SITE_URL?.trim() || "";
  const convex = asObject(inputValues.currentShellcorpConfig.convex);
  const persistedConvex = typeof convex.siteUrl === "string" ? convex.siteUrl.trim() : "";
  return {
    VITE_GATEWAY_URL:
      inputValues.opts.gatewayUrl?.trim() ||
      inputValues.currentUiEnv.VITE_GATEWAY_URL?.trim() ||
      inputValues.exampleUiEnv.VITE_GATEWAY_URL?.trim() ||
      DEFAULT_UI_ENV.VITE_GATEWAY_URL,
    VITE_GATEWAY_TOKEN:
      inputValues.opts.gatewayToken?.trim() ||
      inputValues.currentUiEnv.VITE_GATEWAY_TOKEN?.trim() ||
      inputValues.exampleUiEnv.VITE_GATEWAY_TOKEN?.trim() ||
      DEFAULT_UI_ENV.VITE_GATEWAY_TOKEN,
    VITE_STATE_URL:
      inputValues.opts.stateUrl?.trim() ||
      inputValues.currentUiEnv.VITE_STATE_URL?.trim() ||
      inputValues.exampleUiEnv.VITE_STATE_URL?.trim() ||
      DEFAULT_UI_ENV.VITE_STATE_URL,
    VITE_CONVEX_URL:
      inputValues.opts.convexUrl?.trim() ||
      fromRootConvex ||
      persistedConvex ||
      inputValues.currentUiEnv.VITE_CONVEX_URL?.trim() ||
      DEFAULT_UI_ENV.VITE_CONVEX_URL,
  };
}

function buildNextSteps(inputValues: {
  uiEnv: Record<string, string>;
  cliInstall: OnboardingResult["cliInstall"];
  openclawChanged: boolean;
  repoRoot: string;
}): string[] {
  const steps = [
    "Start or restart the OpenClaw gateway so ShellCorp config changes are picked up.",
    inputValues.cliInstall.ok
      ? `Use ${UI_ALIAS_COMMAND} or ${UI_START_COMMAND} from the repo root to open the ShellCorp UI.`
      : `Run ${CLI_INSTALL_COMMAND} from the repo root for the global \`shellcorp\` alias, or use ${UI_START_COMMAND} directly.`,
    "Use the in-app onboarding flow to finish connector setup and learn the office controls.",
    "Ask the CEO agent to create planning tickets on the board, move one into review, and approve it as your first office workflow.",
  ];
  if (!inputValues.uiEnv.VITE_CONVEX_URL?.trim()) {
    steps.splice(
      1,
      0,
      "Run `npx convex dev` (or use your existing Convex deployment), then rerun `shellcorp onboarding --convex-url <url>` to wire the UI.",
    );
  }
  if (inputValues.openclawChanged) {
    steps.unshift(
      "Review the generated OpenClaw config at `~/.openclaw/openclaw.json` if you need to customize agents or runtime defaults.",
    );
  }
  if (!inputValues.uiEnv.VITE_GATEWAY_TOKEN?.trim()) {
    steps.push("Set `VITE_GATEWAY_TOKEN` in `ui/.env.local` if your gateway requires bearer auth.");
  }
  steps.push(
    `Optional: run \`npm --prefix ${inputValues.repoRoot} run shell -- doctor team-data --json\` for a standalone health check.`,
  );
  return steps;
}

export function registerOnboardingCommands(program: Command): void {
  const store = createSidecarStore();
  program
    .command("onboarding")
    .description(
      "Bootstrap first-run sidecars, OpenClaw config, CLI alias, UI env, and doctor checks",
    )
    .option("--style <preset>", "Office style preset: default|pixel|brutalist|cozy")
    .option("--gateway-url <url>", "Gateway URL for the UI")
    .option("--gateway-token <token>", "Gateway bearer token for the UI")
    .option("--state-url <url>", "State bridge URL for the UI")
    .option("--convex-url <url>", "Convex URL for the UI")
    .option("--install-cli", "Run `npm link` from the repo root during onboarding")
    .option("--skip-install-cli", "Skip the `npm link` step during onboarding", false)
    .option("--launch-ui", "Start the UI after onboarding completes", false)
    .option("--yes", "Use defaults without interactive prompts", false)
    .option("--json", "Output JSON", false)
    .action(async (opts: OnboardingOptions) => {
      const totalSteps = 8;
      const stepPausesEnabled = !opts.json && input.isTTY && output.isTTY;
      if (!opts.json) {
        printOnboardingIntro();
      }
      const repoRoot = resolveRepoRoot();
      const templatesRoot = path.join(repoRoot, "templates");
      const uiRoot = path.join(repoRoot, "ui");
      const uiEnvPath = path.join(uiRoot, ".env.local");
      const exampleEnvPath = path.join(uiRoot, ".env.example");
      const rootEnvPath = path.join(repoRoot, ".env.local");
      const pendingApprovalsPath = path.join(store.companyPath, "..", "pending-approvals.json");
      const rootEnv = await readDotEnvFile(rootEnvPath);
      const existingOpenclaw = await store.readOpenclawConfig();
      const existingShellcorpConfig = await store.readShellcorpConfig();
      const wasOpenclawPresent = await fileExists(store.openclawConfigPath);
      const openclawBeforeRaw = JSON.stringify(existingOpenclaw);
      const shellcorpConfigBeforeRaw = JSON.stringify(existingShellcorpConfig);
      if (!opts.json) {
        printStepStart(1, totalSteps, "Checking OpenClaw");
      }
      let preflight = runOpenclawPreflight({
        openclawConfigPresent: wasOpenclawPresent,
        config: existingOpenclaw,
      });

      // If OpenClaw created openclaw.json but did not add a "main" agent (e.g. some installers omit agents.list), add it.
      if (!preflight.ok && wasOpenclawPresent && preflight.issues.includes("missing_main_agent")) {
        const patched = ensureMainAgentInConfig(existingOpenclaw);
        await store.writeOpenclawConfig(patched);
        if (!opts.json) {
          console.log(cliDim("Added missing `main` agent to openclaw.json; re-running preflight."));
        }
        const updated = await store.readOpenclawConfig();
        preflight = runOpenclawPreflight({
          openclawConfigPresent: true,
          config: updated,
        });
        if (preflight.ok) {
          Object.assign(existingOpenclaw, updated);
        }
      }

      if (!preflight.ok) {
        if (opts.json) {
          console.log(
            JSON.stringify(
              {
                ok: false,
                stateDir: path.dirname(store.companyPath),
                preflight,
                nextSteps: [
                  "Complete the OpenClaw onboarding flow first.",
                  "Ensure `~/.openclaw/openclaw.json` exists.",
                  "Ensure `agents.list` contains the main CEO agent with id `main`.",
                  "Rerun `shellcorp onboarding` after OpenClaw is ready.",
                ],
              },
              null,
              2,
            ),
          );
        } else {
          printPreflightFailure(preflight);
        }
        process.exitCode = 1;
        return;
      }
      if (!opts.json) {
        printStepDone("OpenClaw is initialized and the main CEO agent is present.");
        await pauseBetweenSteps(stepPausesEnabled);
      }

      if (!opts.json) {
        printStepStart(2, totalSteps, "Loading ShellCorp templates");
      }
      const selectedStyle =
        normalizeOfficeStylePreset(opts.style) ??
        (await promptForStyle("default", opts.yes === true));
      const companyTemplate = await readJsonTemplate<CompanyModel>(
        path.join(templatesRoot, "sidecar", "company.template.json"),
      );
      const officeObjectsTemplate = await readJsonTemplate<unknown[]>(
        path.join(templatesRoot, "sidecar", "office-objects.template.json"),
      );
      const pendingApprovalsTemplate = await readJsonTemplate<unknown[]>(
        path.join(templatesRoot, "sidecar", "pending-approvals.template.json"),
      );
      const openclawTemplate = await readJsonTemplate<JsonObject>(
        path.join(templatesRoot, "openclaw", "openclaw.template.json"),
      );
      if (!opts.json) {
        printStepDone("Templates and defaults are ready.");
        await pauseBetweenSteps(stepPausesEnabled);
      }

      if (!opts.json) {
        printStepStart(3, totalSteps, "Preparing sidecars");
      }
      const sidecars: Record<string, FileStatus> = {
        "company.json": await ensureJsonSidecar(store.companyPath, companyTemplate),
        "office-objects.json": await ensureJsonSidecar(
          store.officeObjectsPath,
          officeObjectsTemplate,
        ),
        "pending-approvals.json": await ensureJsonSidecar(
          pendingApprovalsPath,
          pendingApprovalsTemplate,
        ),
      };
      if (!opts.json) {
        printStepDone("Sidecar files are present under `~/.openclaw`.");
        await pauseBetweenSteps(stepPausesEnabled);
      }

      if (!opts.json) {
        printStepStart(4, totalSteps, "Syncing OpenClaw config");
      }
      let nextOpenclaw =
        Object.keys(existingOpenclaw).length === 0 ? openclawTemplate : existingOpenclaw;
      nextOpenclaw = removeInvalidOpenclawRootKeys(nextOpenclaw);
      nextOpenclaw = ensureShellcorpDefaults(nextOpenclaw);
      let nextShellcorpConfig = applyShellcorpConvexSiteUrl(
        existingShellcorpConfig,
        chooseShellcorpConvexSiteUrl({
          rootEnv,
          currentShellcorpConfig: existingShellcorpConfig,
          legacyOpenclawConfig: existingOpenclaw,
          opts,
        }),
      );
      nextOpenclaw = removeOnboardingManagedNotionPlugin(nextOpenclaw);
      const openclawBefore = openclawBeforeRaw;
      const openclawAfter = JSON.stringify(nextOpenclaw);
      const shellcorpConfigAfter = JSON.stringify(nextShellcorpConfig);
      let openclawStatus: FileStatus = "unchanged";
      let shellcorpConfigStatus: FileStatus = "unchanged";
      if (!wasOpenclawPresent) {
        await store.writeOpenclawConfig(nextOpenclaw);
        openclawStatus = "created";
      } else if (openclawBefore !== openclawAfter) {
        await store.writeOpenclawConfig(nextOpenclaw);
        openclawStatus = "updated";
      }
      if (Object.keys(existingShellcorpConfig).length === 0 && Object.keys(nextShellcorpConfig).length > 0) {
        await store.writeShellcorpConfig(nextShellcorpConfig);
        shellcorpConfigStatus = "created";
      } else if (shellcorpConfigBeforeRaw !== shellcorpConfigAfter) {
        await store.writeShellcorpConfig(nextShellcorpConfig);
        shellcorpConfigStatus = "updated";
      }
      sidecars["openclaw.json"] = openclawStatus;
      sidecars["shellcorp.json"] = shellcorpConfigStatus;

      await store.writeOfficeStylePreset(selectedStyle);
      if (!opts.json) {
        printStepDone("OpenClaw config and office style are synced.");
        await pauseBetweenSteps(stepPausesEnabled);
      }

      if (!opts.json) {
        printStepStart(5, totalSteps, "Installing ShellCorp CLI");
      }
      const shouldInstallCli =
        opts.skipInstallCli === true
          ? false
          : opts.installCli === true
            ? true
            : !opts.json &&
              opts.yes !== true &&
              (await promptForYesNo({
                question: "Install the global `shellcorp` CLI alias now with `npm link`?",
                defaultValue: true,
                skipPrompt: false,
              }));
      const cliInstall = await installShellcorpCli({
        repoRoot,
        requested: shouldInstallCli,
      });
      if (!opts.json) {
        const cliNote =
          cliInstall.status === "installed"
            ? "ShellCorp CLI alias is ready."
            : cliInstall.status === "skipped"
              ? "CLI alias install skipped."
              : "CLI alias install failed; you can still continue with repo-local commands.";
        printStepDone(cliNote);
        await pauseBetweenSteps(stepPausesEnabled);
      }

      if (!opts.json) {
        printStepStart(6, totalSteps, "Generating UI environment");
      }
      const currentUiEnv = await readDotEnvFile(uiEnvPath);
      const exampleUiEnv = await readDotEnvFile(exampleEnvPath);
      const nextUiEnvValues = chooseUiEnvValues({
        currentUiEnv,
        rootEnv,
        exampleUiEnv,
        currentShellcorpConfig: nextShellcorpConfig,
        opts,
      });
      await mkdir(uiRoot, { recursive: true });
      const nextUiEnv = {
        ...currentUiEnv,
        ...nextUiEnvValues,
      };
      const previousUiRaw = (await fileExists(uiEnvPath)) ? await readFile(uiEnvPath, "utf-8") : "";
      const nextUiRaw = serializeDotEnv(nextUiEnv);
      let uiEnvStatus: FileStatus = "unchanged";
      if (!(await fileExists(uiEnvPath))) {
        uiEnvStatus = "created";
      } else if (previousUiRaw !== nextUiRaw) {
        uiEnvStatus = "updated";
      }
      if (uiEnvStatus !== "unchanged") {
        await writeFile(uiEnvPath, nextUiRaw, "utf-8");
      }
      if (!opts.json) {
        printStepDone(
          cliInstall.ok
            ? `UI env is ready. Start the UI with ${UI_ALIAS_COMMAND} or ${UI_START_COMMAND}.`
            : `UI env is ready. Start the UI with ${UI_START_COMMAND}, or run ${CLI_INSTALL_COMMAND} first for ${UI_ALIAS_COMMAND}.`,
        );
        await pauseBetweenSteps(stepPausesEnabled);
      }

      if (!opts.json) {
        printStepStart(7, totalSteps, "Running doctor checks");
      }
      const company = await store.readCompanyModel();
      const objects = await store.readOfficeObjects();
      const teamIssues = runDoctor(company);
      const officeIssues = findInvalidOfficeObjects({ company, objects });
      const result: OnboardingResult = {
        ok: teamIssues.length === 0 && officeIssues.length === 0,
        stateDir: path.dirname(store.companyPath),
        preflight,
        officeStylePreset: selectedStyle,
        sidecars,
        uiEnvPath,
        uiEnvStatus,
        uiEnv: nextUiEnvValues,
        cliInstall,
        doctor: {
          teamData: { ok: teamIssues.length === 0, issues: teamIssues },
          officeObjects: { ok: officeIssues.length === 0, invalid: officeIssues },
        },
        nextSteps: buildNextSteps({
          uiEnv: nextUiEnvValues,
          cliInstall,
          openclawChanged: openclawStatus !== "unchanged",
          repoRoot,
        }),
      };
      if (!opts.json) {
        printStepDone("Doctor checks finished.");
        await pauseBetweenSteps(stepPausesEnabled);
      }

      if (!opts.json) {
        printStepStart(8, totalSteps, "Handing off to the UI");
      }
      const shouldLaunchUi =
        !opts.json &&
        (opts.launchUi === true ||
          (opts.yes !== true &&
            (await promptForYesNo({
              question: "Launch the ShellCorp UI now?",
              defaultValue: true,
              skipPrompt: false,
            }))));
      if (shouldLaunchUi) {
        if (!opts.json) {
          console.log(
            cliDim(
              cliInstall.ok
                ? `Starting the UI now. When you stop it, rerun ${UI_ALIAS_COMMAND} or ${UI_START_COMMAND}.`
                : `Starting the UI now. When you stop it, rerun ${UI_START_COMMAND}, or install the alias first with ${CLI_INSTALL_COMMAND}.`,
            ),
          );
          console.log("");
        }
        await startUiDevServer({ cwd: repoRoot, propagateSignal: false });
        if (!opts.json) {
          printStepDone(
            cliInstall.ok
              ? `UI launch finished. Rerun ${UI_ALIAS_COMMAND} or ${UI_START_COMMAND}.`
              : `UI launch finished. Rerun ${UI_START_COMMAND}, or run ${CLI_INSTALL_COMMAND} first for ${UI_ALIAS_COMMAND}.`,
          );
        }
      } else if (!opts.json) {
        printStepDone(
          cliInstall.ok
            ? `UI launch skipped. Start it later with ${UI_ALIAS_COMMAND} or ${UI_START_COMMAND}.`
            : `UI launch skipped. Start it later with ${UI_START_COMMAND}, or run ${CLI_INSTALL_COMMAND} first for ${UI_ALIAS_COMMAND}.`,
        );
      }

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(cliBold(cliGreen("shellcorp onboarding complete")));
        console.log(cliSection("Summary"));
        console.log(`- ${cliKeyValue("state dir:", result.stateDir, "info")}`);
        console.log(`- ${cliKeyValue("office style:", result.officeStylePreset, "info")}`);
        console.log(`- ${cliKeyValue("company.json:", result.sidecars["company.json"], "ok")}`);
        console.log(
          `- ${cliKeyValue("office-objects.json:", result.sidecars["office-objects.json"], "ok")}`,
        );
        console.log(
          `- ${cliKeyValue(
            "pending-approvals.json:",
            result.sidecars["pending-approvals.json"],
            "ok",
          )}`,
        );
        console.log(`- ${cliKeyValue("openclaw.json:", result.sidecars["openclaw.json"], "ok")}`);
        console.log(
          `- ${cliKeyValue(
            "cli alias:",
            result.cliInstall.status,
            result.cliInstall.ok ? "ok" : result.cliInstall.status === "failed" ? "warn" : "info",
          )}`,
        );
        console.log(`- ${cliKeyValue("ui/.env.local:", result.uiEnvStatus, "ok")}`);
        console.log(
          `- ${cliKeyValue(
            "doctor team-data:",
            result.doctor.teamData.ok ? "ok" : "issues found",
            result.doctor.teamData.ok ? "ok" : "warn",
          )}`,
        );
        console.log(
          `- ${cliKeyValue(
            "doctor office-objects:",
            result.doctor.officeObjects.ok ? "ok" : "issues found",
            result.doctor.officeObjects.ok ? "ok" : "warn",
          )}`,
        );
        console.log("");
        console.log(cliSection("Next"));
        for (const step of result.nextSteps) {
          console.log(`- ${cliStatus(step, "info")}`);
        }
        if (result.cliInstall.status === "failed") {
          console.log(`- ${cliStatus(result.cliInstall.note, "warn")}`);
        }
        console.log(
          `- ${cliStatus(
            result.cliInstall.ok
              ? `Start the UI now with ${UI_ALIAS_COMMAND} or ${UI_START_COMMAND}.`
              : `Start the UI now with ${UI_START_COMMAND}, or run ${CLI_INSTALL_COMMAND} first for ${UI_ALIAS_COMMAND}.`,
            "ok",
          )}`,
        );
      }

      if (!result.ok) {
        process.exitCode = 1;
      }
    });
}
