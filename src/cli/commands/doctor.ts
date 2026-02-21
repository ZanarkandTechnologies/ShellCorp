import path from "node:path";
import { existsSync } from "node:fs";

import { loadConfig } from "../../config/loader.js";

export async function doctorCommand(configPath?: string): Promise<void> {
  const config = await loadConfig(configPath);
  const checks = [
    ["workspace exists", existsSync(path.resolve(config.workspaceDir))],
    ["data dir exists", existsSync(config.dataDir)],
    ["heartbeat interval valid", config.heartbeat.intervalMinutes > 0],
  ] as const;

  for (const [label, ok] of checks) {
    console.log(`${ok ? "OK" : "FAIL"}: ${label}`);
  }
}
