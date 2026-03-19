import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setCliInstallExecFileRunnerForTests } from "./cli-install.js";
import { registerOnboardingCommands } from "./onboarding-commands.js";

async function setupRepoFixture(
  input: { withPackageJson?: boolean } = {},
): Promise<{ repoRoot: string; stateDir: string }> {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "shellcorp-onboarding-repo-"));
  const stateDir = path.join(repoRoot, "state");
  await mkdir(path.join(repoRoot, "templates", "openclaw"), { recursive: true });
  await mkdir(path.join(repoRoot, "templates", "sidecar"), { recursive: true });
  await mkdir(path.join(repoRoot, "ui"), { recursive: true });
  await mkdir(path.join(repoRoot, "extensions", "notion"), { recursive: true });

  await writeFile(
    path.join(repoRoot, "templates", "openclaw", "openclaw.template.json"),
    `${JSON.stringify(
      {
        tools: { profile: "coding" },
        hooks: { internal: { enabled: true, entries: { "shellcorp-status": { enabled: true } } } },
        agents: {
          defaults: {
            heartbeat: { every: "3m", includeReasoning: true, target: "last", prompt: "heartbeat" },
          },
          list: [],
        },
        plugins: { load: { paths: [] } },
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  await writeFile(
    path.join(repoRoot, "templates", "sidecar", "company.template.json"),
    `${JSON.stringify(
      {
        version: 1,
        departments: [
          { id: "dept-ceo", name: "CEO Office", description: "", goal: "" },
          { id: "dept-products", name: "Product Studio", description: "", goal: "" },
        ],
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
        heartbeatProfiles: [
          {
            id: "hb-ceo",
            role: "ceo",
            cadenceMinutes: 15,
            teamDescription: "",
            productDetails: "",
            goal: "",
          },
        ],
        tasks: [],
        channelBindings: [],
        federationPolicies: [],
        providerIndexProfiles: [],
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  await writeFile(
    path.join(repoRoot, "templates", "sidecar", "office-objects.template.json"),
    "[]\n",
    "utf-8",
  );
  await writeFile(
    path.join(repoRoot, "templates", "sidecar", "pending-approvals.template.json"),
    "[]\n",
    "utf-8",
  );
  await writeFile(
    path.join(repoRoot, "ui", ".env.example"),
    `${[
      "VITE_GATEWAY_URL=http://127.0.0.1:18789",
      "VITE_GATEWAY_TOKEN=",
      "VITE_STATE_URL=http://127.0.0.1:5173",
    ].join("\n")}\n`,
    "utf-8",
  );
  await writeFile(
    path.join(repoRoot, ".env.local"),
    `${["CONVEX_URL=https://demo.convex.cloud", "NOTION_API_KEY=secret_test"].join("\n")}\n`,
    "utf-8",
  );
  if (input.withPackageJson === true) {
    await mkdir(path.join(repoRoot, "bin"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "package.json"),
      `${JSON.stringify(
        {
          name: "shellcorp-test-fixture",
          version: "0.0.0",
          private: true,
          bin: {
            shellcorp: "./bin/shellcorp.js",
          },
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );
    await writeFile(path.join(repoRoot, "bin", "shellcorp.js"), "#!/usr/bin/env node\n", "utf-8");
  }

  return { repoRoot, stateDir };
}

async function seedOpenclawMainAgent(stateDir: string): Promise<void> {
  await mkdir(stateDir, { recursive: true });
  await writeFile(
    path.join(stateDir, "openclaw.json"),
    `${JSON.stringify(
      {
        agents: {
          list: [
            {
              id: "main",
              name: "CEO Agent",
              workspace: path.join(stateDir, "workspace-main"),
            },
          ],
        },
        plugins: { load: { paths: [] } },
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
}

async function runCommand(args: string[]): Promise<void> {
  const program = new Command();
  registerOnboardingCommands(program);
  await program.parseAsync(args, { from: "user" });
}

afterEach(() => {
  vi.restoreAllMocks();
  setCliInstallExecFileRunnerForTests(null);
  delete process.env.OPENCLAW_STATE_DIR;
  delete process.env.SHELLCORP_REPO_ROOT;
  process.exitCode = undefined;
});

describe("onboarding CLI", () => {
  it("fails preflight when OpenClaw has not been initialized yet", async () => {
    const { repoRoot, stateDir } = await setupRepoFixture();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_REPO_ROOT = repoRoot;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(["onboarding", "--yes", "--json"]);

    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      ok: boolean;
      preflight?: { ok: boolean; issues?: string[] };
    };
    expect(payload.ok).toBe(false);
    expect(payload.preflight?.ok).toBe(false);
    expect(payload.preflight?.issues).toContain("missing_openclaw_config");
    expect(payload.preflight?.issues).toContain("missing_main_agent");
  });

  it("bootstraps required sidecars and generates ui env from repo env", async () => {
    const { repoRoot, stateDir } = await setupRepoFixture();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_REPO_ROOT = repoRoot;
    await seedOpenclawMainAgent(stateDir);

    await runCommand(["onboarding", "--yes", "--style", "cozy", "--gateway-token", "token-123"]);

    const companyRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const company = JSON.parse(companyRaw) as { officeStylePreset?: string };
    expect(company.officeStylePreset).toBe("cozy");

    const openclawRaw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
    const openclaw = JSON.parse(openclawRaw) as {
      version?: unknown;
      shellcorp?: unknown;
      plugins?: {
        load?: { paths?: string[] };
        entries?: { "notion-shell"?: unknown };
      };
    };
    expect(openclaw.version).toBeUndefined();
    expect(openclaw.shellcorp).toBeUndefined();
    expect(openclaw.plugins?.load?.paths ?? []).not.toContain(
      path.join(repoRoot, "extensions", "notion"),
    );
    expect(openclaw.plugins?.entries?.["notion-shell"]).toBeUndefined();

    const shellcorpRaw = await readFile(path.join(stateDir, "shellcorp.json"), "utf-8");
    const shellcorp = JSON.parse(shellcorpRaw) as { convex?: { siteUrl?: string } };
    expect(shellcorp.convex?.siteUrl).toBe("https://demo.convex.cloud");

    const uiEnvRaw = await readFile(path.join(repoRoot, "ui", ".env.local"), "utf-8");
    expect(uiEnvRaw).toContain("VITE_GATEWAY_TOKEN=token-123");
    expect(uiEnvRaw).toContain("VITE_CONVEX_URL=https://demo.convex.cloud");

    const approvalsRaw = await readFile(path.join(stateDir, "pending-approvals.json"), "utf-8");
    expect(JSON.parse(approvalsRaw)).toEqual([]);
  });

  it("preserves existing ui env keys and removes stale onboarding-managed notion wiring", async () => {
    const { repoRoot, stateDir } = await setupRepoFixture();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_REPO_ROOT = repoRoot;

    await mkdir(stateDir, { recursive: true });
    await writeFile(
      path.join(stateDir, "openclaw.json"),
      `${JSON.stringify(
        {
          version: 1,
          plugins: {
            load: { paths: ["./extensions/notion"] },
            entries: {
              "notion-shell": {
                enabled: true,
                config: {
                  defaultAccountId: "default",
                  webhook: {
                    path: "/plugins/notion-shell/webhook",
                    targetAgentId: "main",
                  },
                },
              },
            },
          },
          agents: {
            list: [
              {
                id: "main",
                name: "CEO Agent",
                workspace: path.join(stateDir, "workspace-main"),
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );
    await writeFile(
      path.join(repoRoot, "ui", ".env.local"),
      "CUSTOM_FLAG=keepme\nVITE_GATEWAY_URL=http://localhost:9999\n",
      "utf-8",
    );

    await runCommand(["onboarding", "--yes"]);

    const openclawRaw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
    const openclaw = JSON.parse(openclawRaw) as {
      plugins?: {
        load?: { paths?: string[] };
        entries?: { "notion-shell"?: unknown };
      };
    };
    expect(openclaw.plugins?.load?.paths ?? []).toEqual([]);
    expect(openclaw.plugins?.entries?.["notion-shell"]).toBeUndefined();

    const uiEnvRaw = await readFile(path.join(repoRoot, "ui", ".env.local"), "utf-8");
    expect(uiEnvRaw).toContain("CUSTOM_FLAG=keepme");
    expect(uiEnvRaw).toContain("VITE_GATEWAY_URL=http://localhost:9999");
  });

  it("refreshes VITE_CONVEX_URL from the repo root env on rerun", async () => {
    const { repoRoot, stateDir } = await setupRepoFixture();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_REPO_ROOT = repoRoot;
    await seedOpenclawMainAgent(stateDir);

    await writeFile(
      path.join(repoRoot, "ui", ".env.local"),
      "VITE_CONVEX_URL=https://old-ui.convex.site\n",
      "utf-8",
    );
    await writeFile(
      path.join(repoRoot, ".env.local"),
      "CONVEX_URL=https://fresh-root.convex.site\n",
      "utf-8",
    );

    await runCommand(["onboarding", "--yes"]);

    const uiEnvRaw = await readFile(path.join(repoRoot, "ui", ".env.local"), "utf-8");
    const openclawRaw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
    const openclaw = JSON.parse(openclawRaw) as { shellcorp?: { convex?: { siteUrl?: string } } };
    const shellcorpRaw = await readFile(path.join(stateDir, "shellcorp.json"), "utf-8");
    const shellcorp = JSON.parse(shellcorpRaw) as { convex?: { siteUrl?: string } };
    expect(uiEnvRaw).toContain("VITE_CONVEX_URL=https://fresh-root.convex.site");
    expect(openclaw.shellcorp).toBeUndefined();
    expect(shellcorp.convex?.siteUrl).toBe("https://fresh-root.convex.site");
  });

  it("prefers CONVEX_SITE_URL for persisted shellcorp CLI config when both Convex URLs exist", async () => {
    const { repoRoot, stateDir } = await setupRepoFixture();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_REPO_ROOT = repoRoot;
    await seedOpenclawMainAgent(stateDir);

    await writeFile(
      path.join(repoRoot, ".env.local"),
      ["CONVEX_URL=http://127.0.0.1:3210", "CONVEX_SITE_URL=http://127.0.0.1:3211"].join("\n"),
      "utf-8",
    );

    await runCommand(["onboarding", "--yes"]);

    const shellcorpRaw = await readFile(path.join(stateDir, "shellcorp.json"), "utf-8");
    const shellcorp = JSON.parse(shellcorpRaw) as { convex?: { siteUrl?: string } };
    expect(shellcorp.convex?.siteUrl).toBe("http://127.0.0.1:3211");
  });

  it("preserves persisted shellcorp convex site url when repo env is absent", async () => {
    const { repoRoot, stateDir } = await setupRepoFixture();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_REPO_ROOT = repoRoot;
    await seedOpenclawMainAgent(stateDir);

    await writeFile(path.join(repoRoot, ".env.local"), "NOTION_API_KEY=secret_test\n", "utf-8");
    await writeFile(
      path.join(stateDir, "openclaw.json"),
      `${JSON.stringify(
        {
          version: 1,
          agents: {
            list: [
              {
                id: "main",
                name: "CEO Agent",
                workspace: path.join(stateDir, "workspace-main"),
              },
            ],
          },
          plugins: { load: { paths: [] } },
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );
    await writeFile(
      path.join(stateDir, "shellcorp.json"),
      `${JSON.stringify(
        {
          convex: { siteUrl: "https://persisted.convex.site" },
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );

    await runCommand(["onboarding", "--yes"]);

    const uiEnvRaw = await readFile(path.join(repoRoot, "ui", ".env.local"), "utf-8");
    const openclawRaw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
    const openclaw = JSON.parse(openclawRaw) as { shellcorp?: unknown };
    const shellcorpRaw = await readFile(path.join(stateDir, "shellcorp.json"), "utf-8");
    const shellcorp = JSON.parse(shellcorpRaw) as { convex?: { siteUrl?: string } };
    expect(uiEnvRaw).toContain("VITE_CONVEX_URL=https://persisted.convex.site");
    expect(openclaw.shellcorp).toBeUndefined();
    expect(shellcorp.convex?.siteUrl).toBe("https://persisted.convex.site");
  });

  it("reports structured json output with doctor status", async () => {
    const { repoRoot, stateDir } = await setupRepoFixture();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_REPO_ROOT = repoRoot;
    await seedOpenclawMainAgent(stateDir);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(["onboarding", "--yes", "--json"]);

    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      ok: boolean;
      preflight?: { ok: boolean };
      cliInstall?: { status?: string; attempted?: boolean };
      doctor?: { teamData?: { ok: boolean }; officeObjects?: { ok: boolean } };
      uiEnv?: { VITE_CONVEX_URL?: string };
    };
    expect(payload.ok).toBe(true);
    expect(payload.preflight?.ok).toBe(true);
    expect(payload.cliInstall?.status).toBe("skipped");
    expect(payload.cliInstall?.attempted).toBe(false);
    expect(payload.doctor?.teamData?.ok).toBe(true);
    expect(payload.doctor?.officeObjects?.ok).toBe(true);
    expect(payload.uiEnv?.VITE_CONVEX_URL).toBe("https://demo.convex.cloud");
  });

  it("auto-patches a missing main agent and still reports openclaw.json as updated", async () => {
    const { repoRoot, stateDir } = await setupRepoFixture();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_REPO_ROOT = repoRoot;
    await mkdir(stateDir, { recursive: true });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await writeFile(
      path.join(stateDir, "openclaw.json"),
      `${JSON.stringify(
        {
          version: 1,
          agents: {
            list: [],
          },
          plugins: { load: { paths: [] } },
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );

    await runCommand(["onboarding", "--yes", "--json"]);

    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      ok: boolean;
      sidecars?: Record<string, string>;
      nextSteps?: string[];
    };
    const openclawRaw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
    const openclaw = JSON.parse(openclawRaw) as {
      agents?: { list?: Array<{ id?: string }> };
    };

    expect(payload.ok).toBe(true);
    expect(payload.sidecars?.["openclaw.json"]).toBe("updated");
    expect(
      payload.nextSteps?.some((step) => step.includes("Review the generated OpenClaw config")),
    ).toBe(true);
    expect(openclaw.agents?.list?.some((entry) => entry.id === "main")).toBe(true);
  });

  it("does not rewrite openclaw.json on rerun when only stale notion wiring was absent", async () => {
    const { repoRoot, stateDir } = await setupRepoFixture();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_REPO_ROOT = repoRoot;
    await seedOpenclawMainAgent(stateDir);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(["onboarding", "--yes", "--json"]);
    logSpy.mockClear();

    await runCommand(["onboarding", "--yes", "--json"]);

    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sidecars?: Record<string, string>;
    };
    expect(payload.sidecars?.["openclaw.json"]).toBe("unchanged");
  });

  it("removes invalid shellcorp-managed root keys from openclaw.json and migrates convex settings", async () => {
    const { repoRoot, stateDir } = await setupRepoFixture();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_REPO_ROOT = repoRoot;
    await mkdir(stateDir, { recursive: true });
    await writeFile(path.join(repoRoot, ".env.local"), "NOTION_API_KEY=secret_test\n", "utf-8");

    await writeFile(
      path.join(stateDir, "openclaw.json"),
      `${JSON.stringify(
        {
          version: 1,
          shellcorp: { convex: { siteUrl: "https://persisted.convex.site" } },
          agents: {
            list: [
              {
                id: "main",
                name: "CEO Agent",
                workspace: path.join(stateDir, "workspace-main"),
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );

    await runCommand(["onboarding", "--yes", "--json"]);

    const openclawRaw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
    const openclaw = JSON.parse(openclawRaw) as { version?: unknown; shellcorp?: unknown };
    const shellcorpRaw = await readFile(path.join(stateDir, "shellcorp.json"), "utf-8");
    const shellcorp = JSON.parse(shellcorpRaw) as { convex?: { siteUrl?: string } };
    expect(openclaw.version).toBeUndefined();
    expect(openclaw.shellcorp).toBeUndefined();
    expect(shellcorp.convex?.siteUrl).toBe("https://persisted.convex.site");
  });

  it("skips CLI install in --yes mode unless explicitly requested", async () => {
    const { repoRoot, stateDir } = await setupRepoFixture({ withPackageJson: true });
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_REPO_ROOT = repoRoot;
    await seedOpenclawMainAgent(stateDir);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const execRunner = vi.fn(async () => ({ stdout: "", stderr: "" }));
    setCliInstallExecFileRunnerForTests(execRunner);

    await runCommand(["onboarding", "--yes", "--json"]);

    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      cliInstall?: { status?: string; attempted?: boolean };
    };
    expect(payload.cliInstall?.status).toBe("skipped");
    expect(payload.cliInstall?.attempted).toBe(false);
    expect(execRunner).not.toHaveBeenCalled();
  });

  it("runs npm link when --install-cli is requested", async () => {
    const { repoRoot, stateDir } = await setupRepoFixture({ withPackageJson: true });
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_REPO_ROOT = repoRoot;
    await seedOpenclawMainAgent(stateDir);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const execRunner = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    setCliInstallExecFileRunnerForTests(execRunner);

    await runCommand(["onboarding", "--yes", "--install-cli", "--json"]);

    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      cliInstall?: { status?: string; attempted?: boolean; ok?: boolean };
    };
    expect(execRunner).toHaveBeenCalledWith(
      "npm",
      ["link"],
      expect.objectContaining({ cwd: repoRoot }),
    );
    expect(payload.cliInstall?.status).toBe("installed");
    expect(payload.cliInstall?.attempted).toBe(true);
    expect(payload.cliInstall?.ok).toBe(true);
  });

  it("records CLI install failure without failing onboarding", async () => {
    const { repoRoot, stateDir } = await setupRepoFixture({ withPackageJson: true });
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_REPO_ROOT = repoRoot;
    await seedOpenclawMainAgent(stateDir);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const execRunner = vi.fn().mockRejectedValue(new Error("boom"));
    setCliInstallExecFileRunnerForTests(execRunner);

    await runCommand(["onboarding", "--yes", "--install-cli", "--json"]);

    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      ok?: boolean;
      cliInstall?: { status?: string; attempted?: boolean; ok?: boolean; note?: string };
    };
    expect(payload.ok).toBe(true);
    expect(payload.cliInstall?.status).toBe("failed");
    expect(payload.cliInstall?.attempted).toBe(true);
    expect(payload.cliInstall?.ok).toBe(false);
    expect(payload.cliInstall?.note).toContain("Run `npm link` manually");
  });

  it("lets --skip-install-cli override --install-cli", async () => {
    const { repoRoot, stateDir } = await setupRepoFixture({ withPackageJson: true });
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.SHELLCORP_REPO_ROOT = repoRoot;
    await seedOpenclawMainAgent(stateDir);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const execRunner = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    setCliInstallExecFileRunnerForTests(execRunner);

    await runCommand(["onboarding", "--yes", "--install-cli", "--skip-install-cli", "--json"]);

    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      cliInstall?: { status?: string; attempted?: boolean };
    };
    expect(payload.cliInstall?.status).toBe("skipped");
    expect(payload.cliInstall?.attempted).toBe(false);
    expect(execRunner).not.toHaveBeenCalled();
  });
});
