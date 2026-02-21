import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { bahamutConfigSchema, type BahamutConfig } from "./schema.js";
import { resolveSecretValue } from "../security/secrets.js";

function expandHome(p: string): string {
  return p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p;
}

export function defaultConfigPath(): string {
  return path.join(os.homedir(), ".bahamut", "bahamut.json");
}

async function resolveSecretStrings(obj: unknown): Promise<unknown> {
  if (typeof obj === "string") {
    if (obj.startsWith("$") || obj.startsWith("!")) {
      return resolveSecretValue(obj);
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return Promise.all(obj.map((v) => resolveSecretStrings(v)));
  }
  if (obj && typeof obj === "object") {
    const entries = await Promise.all(
      Object.entries(obj).map(async ([k, v]) => [k, await resolveSecretStrings(v)] as const),
    );
    return Object.fromEntries(entries);
  }
  return obj;
}

export async function loadConfig(configPath = defaultConfigPath()): Promise<BahamutConfig> {
  const absolutePath = expandHome(configPath);
  if (!existsSync(absolutePath)) {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, JSON.stringify({}, null, 2), "utf8");
  }
  const raw = await readFile(absolutePath, "utf8");
  const parsed = raw.trim() ? JSON.parse(raw) : {};
  const resolved = await resolveSecretStrings(parsed);
  const config = bahamutConfigSchema.parse(resolved);
  return {
    ...config,
    workspaceDir: expandHome(config.workspaceDir),
    dataDir: expandHome(config.dataDir),
  };
}
