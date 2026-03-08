/**
 * CLI UTILS
 * =========
 * Purpose
 * - Shared CLI output and error primitives used across team-commands and office-commands.
 *
 * KEY CONCEPTS:
 * - OutputMode controls text vs JSON output.
 * - fail() throws a typed error for commander action handlers to surface as CLI errors.
 * - formatOutput() guards against EPIPE on broken pipes (e.g. piping to `head`/`jq`).
 */

export type OutputMode = "text" | "json";

export function fail(message: string): never {
  throw new Error(message);
}

export function formatOutput<T>(mode: OutputMode, payload: T, text: string): void {
  const safeLog = (value: string): void => {
    try {
      console.log(value);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EPIPE") {
        return;
      }
      throw error;
    }
  };

  if (mode === "json") {
    safeLog(JSON.stringify(payload, null, 2));
    return;
  }
  safeLog(text);
}
