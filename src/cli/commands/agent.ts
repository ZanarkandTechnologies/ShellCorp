import path from "node:path";

import { loadConfig } from "../../config/loader.js";
import { FileLogSink } from "../../logging/file-sink.js";
import { PiBrainRuntime } from "../../agent/runner.js";

export async function agentCommand(message: string, configPath?: string): Promise<void> {
  const config = await loadConfig(configPath);
  const runtime = new PiBrainRuntime({
    dataDir: config.dataDir,
    workspaceDir: path.resolve(config.workspaceDir),
    logSink: new FileLogSink(),
  });
  const response = await runtime.handleMessage("brain:main", message);
  console.log(response);
}
