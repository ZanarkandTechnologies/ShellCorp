import { existsSync } from "node:fs";
import path from "node:path";

import { loadConfig } from "../../config/loader.js";

export async function statusCommand(configPath?: string): Promise<void> {
  const config = await loadConfig(configPath);
  const sessionDir = path.join(config.runtime.dataDir, "sessions");
  const cronPath = config.runtime.cron.storePath ?? path.join(config.runtime.dataDir, "cron-jobs.json");
  const auditDir = path.join(config.runtime.dataDir, "audit");

  console.log(
    JSON.stringify(
      {
        workspaceDir: path.resolve(config.runtime.workspaceDir),
        dataDir: config.runtime.dataDir,
        sessionDirExists: existsSync(sessionDir),
        cronStoreExists: existsSync(cronPath),
        auditDirExists: existsSync(auditDir),
        enabledChannels: Object.entries(config.gateway.channels)
          .filter(([, value]) => value.enabled)
          .map(([name]) => name),
      },
      null,
      2,
    ),
  );
}
