import { existsSync } from "node:fs";
import path from "node:path";

import { loadConfig } from "../../config/loader.js";

export async function statusCommand(configPath?: string): Promise<void> {
  const config = await loadConfig(configPath);
  const sessionDir = path.join(config.dataDir, "sessions");
  const cronPath = path.join(config.dataDir, "cron-jobs.json");
  const auditDir = path.join(config.dataDir, "audit");

  console.log(
    JSON.stringify(
      {
        workspaceDir: path.resolve(config.workspaceDir),
        dataDir: config.dataDir,
        sessionDirExists: existsSync(sessionDir),
        cronStoreExists: existsSync(cronPath),
        auditDirExists: existsSync(auditDir),
        enabledChannels: Object.entries(config.channels)
          .filter(([, value]) => value.enabled)
          .map(([name]) => name),
      },
      null,
      2,
    ),
  );
}
