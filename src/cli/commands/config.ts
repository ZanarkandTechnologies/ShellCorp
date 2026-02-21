import { readFile } from "node:fs/promises";

import { defaultConfigPath } from "../../config/loader.js";

export async function configShowCommand(configPath?: string): Promise<void> {
  const target = configPath ?? defaultConfigPath();
  const raw = await readFile(target, "utf8");
  console.log(raw);
}
