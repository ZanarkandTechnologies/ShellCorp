import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installShellcorpCli,
  reinstallShellcorpCli,
  setCliInstallExecFileRunnerForTests,
} from "./cli-install.js";

describe("cli install helpers", () => {
  afterEach(() => {
    setCliInstallExecFileRunnerForTests(null);
    vi.restoreAllMocks();
  });

  async function createRepoFixture(): Promise<string> {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "shellcorp-cli-install-"));
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({ name: "shellcorp-test", private: true }, null, 2),
      "utf-8",
    );
    return repoRoot;
  }

  it("installs the CLI with npm link when requested", async () => {
    const repoRoot = await createRepoFixture();
    const execRunner = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    setCliInstallExecFileRunnerForTests(execRunner);

    const result = await installShellcorpCli({ repoRoot, requested: true });

    expect(execRunner).toHaveBeenCalledWith(
      "npm",
      ["link"],
      expect.objectContaining({ cwd: repoRoot }),
    );
    expect(result.status).toBe("installed");
    expect(result.ok).toBe(true);
  });

  it("reinstalls by refreshing deps, bundling, unlinking, and relinking in order", async () => {
    const repoRoot = await createRepoFixture();
    const execRunner = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    setCliInstallExecFileRunnerForTests(execRunner);

    const result = await reinstallShellcorpCli({ repoRoot });

    expect(execRunner.mock.calls.map((call) => call[1])).toEqual([
      ["install"],
      ["run", "cli:bundle"],
      ["unlink", "-g", "shellcorp"],
      ["link"],
    ]);
    expect(result.status).toBe("reinstalled");
    expect(result.ok).toBe(true);
  });

  it("ignores unlink failures and still relinks the CLI", async () => {
    const repoRoot = await createRepoFixture();
    const execRunner = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockRejectedValueOnce(new Error("not currently linked"))
      .mockResolvedValueOnce({ stdout: "", stderr: "" });
    setCliInstallExecFileRunnerForTests(execRunner);

    const result = await reinstallShellcorpCli({ repoRoot });

    expect(result.ok).toBe(true);
    expect(result.steps[2]?.note).toContain("ignored:");
    expect(execRunner).toHaveBeenLastCalledWith(
      "npm",
      ["link"],
      expect.objectContaining({ cwd: repoRoot }),
    );
  });

  it("stops reinstall when the bundle step fails", async () => {
    const repoRoot = await createRepoFixture();
    const execRunner = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockRejectedValueOnce(new Error("bundle failed"));
    setCliInstallExecFileRunnerForTests(execRunner);

    const result = await reinstallShellcorpCli({ repoRoot });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(execRunner).toHaveBeenCalledTimes(2);
    expect(result.note).toContain("npm run cli:bundle");
  });
});
