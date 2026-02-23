import path from "node:path";

import { loadConfig } from "../../config/loader.js";
import { FileLogSink } from "../../logging/file-sink.js";
import { PiBrainRuntime } from "../../agent/runner.js";

export async function agentCommand(message: string, configPath?: string): Promise<void> {
  const config = await loadConfig(configPath);
  const runtime = new PiBrainRuntime({
    dataDir: config.runtime.dataDir,
    workspaceDir: path.resolve(config.runtime.workspaceDir),
    logSink: new FileLogSink(),
    ai: config.runtime.ai,
    agent: config.runtime.agent,
  });
  const response = await runtime.handleMessage(config.runtime.agent.personalSessionKey, message);
  console.log(response);
}
