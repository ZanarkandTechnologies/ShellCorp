import type { FahrenheitConfig } from "../config/schema.js";

function getByPath(root: unknown, path: string): unknown {
  const segments = path.split(".");
  let cursor: unknown = root;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

export function collectSensitiveValues(config: FahrenheitConfig, basePaths: string[]): string[] {
  const values = new Set<string>();
  for (const p of basePaths) {
    const value = getByPath(config, p);
    if (typeof value === "string" && value.trim()) {
      values.add(value);
    }
  }

  for (const providerConfig of Object.values(config.runtime.ai.providers)) {
    if (providerConfig.apiKey && providerConfig.apiKey.trim()) {
      values.add(providerConfig.apiKey);
    }
  }

  return [...values];
}

export function redactString(input: string, sensitiveValues: string[]): string {
  let output = input;
  for (const value of sensitiveValues) {
    if (!value) continue;
    output = output.split(value).join("__REDACTED__");
  }
  return output;
}

export function redactUnknown(input: unknown, sensitiveValues: string[]): unknown {
  if (typeof input === "string") return redactString(input, sensitiveValues);
  if (Array.isArray(input)) return input.map((item) => redactUnknown(item, sensitiveValues));
  if (!input || typeof input !== "object") return input;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    result[key] = redactUnknown(value, sensitiveValues);
  }
  return result;
}
