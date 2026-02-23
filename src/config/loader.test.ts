import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { loadConfig } from "./loader.js";

describe("loadConfig gateway security defaults", () => {
  it("rejects non-loopback bind without ingest token", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "fahrenheit-config-"));
    const configPath = path.join(tmpDir, "fahrenheit.json");
    await writeFile(
      configPath,
      JSON.stringify(
        {
          gateway: {
            server: {
              bind: "lan",
              port: 8787,
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    await expect(loadConfig(configPath)).rejects.toThrow(
      "gateway.server.ingestToken is required when gateway server bind is non-loopback",
    );
  });

  it("allows non-loopback bind when ingest token is present", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "fahrenheit-config-"));
    const configPath = path.join(tmpDir, "fahrenheit.json");
    await writeFile(
      configPath,
      JSON.stringify(
        {
          gateway: {
            server: {
              bind: "lan",
              port: 8787,
              ingestToken: "secret-token",
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const config = await loadConfig(configPath);
    expect(config.gateway.server.host).toBe("0.0.0.0");
    expect(config.gateway.server.ingestToken).toBe("secret-token");
  });

  it("rejects legacy top-level channels key", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "fahrenheit-config-"));
    const configPath = path.join(tmpDir, "fahrenheit.json");
    await writeFile(
      configPath,
      JSON.stringify(
        {
          channels: {
            telegram: {
              enabled: true,
              botToken: "$TELEGRAM_BOT_TOKEN",
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    await expect(loadConfig(configPath)).rejects.toThrow('Unsupported legacy config key "channels". Use "gateway.channels" instead.');
  });
});
