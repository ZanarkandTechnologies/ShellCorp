import { EventEmitter } from "node:events";
import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";

class MockChild extends EventEmitter {
  stdout = null;
  stderr = null;
  stdin = null;
}

describe("ui CLI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("runs the repo-local ui script through npm", async () => {
    const child = new MockChild();
    const spawnMock = vi.fn(() => child);
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }));
    const { registerUiCommands } = await import("./ui-commands.js");

    const program = new Command();
    registerUiCommands(program);
    const parsePromise = program.parseAsync(["ui"], { from: "user" });
    child.emit("exit", 0, null);
    await parsePromise;

    expect(spawnMock).toHaveBeenCalledWith(
      expect.stringMatching(/^npm(\.cmd)?$/),
      ["run", "ui"],
      expect.objectContaining({
        cwd: process.cwd(),
        stdio: "inherit",
      }),
    );
  });

  it("does not re-signal the parent when launched in onboarding handoff mode", async () => {
    const child = new MockChild();
    const spawnMock = vi.fn(() => child);
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }));
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);
    const { startUiDevServer } = await import("./ui-commands.js");

    const startPromise = startUiDevServer({ cwd: "/tmp/shellcorp-ui", propagateSignal: false });
    child.emit("exit", null, "SIGINT");
    await startPromise;

    expect(spawnMock).toHaveBeenCalledWith(
      expect.stringMatching(/^npm(\.cmd)?$/),
      ["run", "ui"],
      expect.objectContaining({
        cwd: "/tmp/shellcorp-ui",
        stdio: "inherit",
      }),
    );
    expect(killSpy).not.toHaveBeenCalled();
  });
});
