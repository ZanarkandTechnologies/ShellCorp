function compactJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function truncate(value: string, limit = 220): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 3)}...`;
}

export function sanitizeInline(value: unknown, limit = 220): string {
  const raw = typeof value === "string" ? value : compactJson(value);
  return truncate(raw.replace(/\s+/g, " ").trim(), limit);
}

export function formatLogLine(scope: string, event: string, fields: Record<string, unknown>): string {
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${sanitizeInline(value)}`);
  return `[${scope}] event=${event}${parts.length ? ` ${parts.join(" ")}` : ""}`;
}
