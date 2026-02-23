import path from "node:path";
import { existsSync } from "node:fs";

import { loadConfig } from "../../config/loader.js";

export async function doctorCommand(configPath?: string): Promise<void> {
  const config = await loadConfig(configPath);
  const checks = [
    ["workspace exists", existsSync(path.resolve(config.runtime.workspaceDir))],
    ["data dir exists", existsSync(config.runtime.dataDir)],
    ["heartbeat interval valid", config.runtime.heartbeat.intervalMinutes > 0],
  ] as const;

  for (const [label, ok] of checks) {
    console.log(`${ok ? "OK" : "FAIL"}: ${label}`);
  }
}
