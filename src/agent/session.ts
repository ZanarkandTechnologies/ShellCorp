import { mkdir } from "node:fs/promises";
import path from "node:path";

export function toSessionFilePath(dataDir: string, sessionKey: string): string {
  const safeKey = sessionKey.replace(/[^a-zA-Z0-9:_-]/g, "_");
  return path.join(dataDir, "sessions", `${safeKey}.jsonl`);
}

export async function ensureSessionDir(dataDir: string): Promise<void> {
  await mkdir(path.join(dataDir, "sessions"), { recursive: true });
}
