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

function supportsColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR === "0") return false;
  if (!process.stdout.isTTY) return false;
  return process.env.TERM !== "dumb";
}

function paint(code: number, text: string): string {
  if (!supportsColor()) return text;
  return `\u001b[${code}m${text}\u001b[0m`;
}

export function cliBold(text: string): string {
  return paint(1, text);
}

export function cliDim(text: string): string {
  return paint(2, text);
}

export function cliCyan(text: string): string {
  return paint(36, text);
}

export function cliBlue(text: string): string {
  return paint(34, text);
}

export function cliGreen(text: string): string {
  return paint(32, text);
}

export function cliYellow(text: string): string {
  return paint(33, text);
}

export function cliRed(text: string): string {
  return paint(31, text);
}

export function cliMagenta(text: string): string {
  return paint(35, text);
}

export function cliSection(title: string): string {
  return `${cliBold(cliCyan(title))}`;
}

export function cliStatus(value: string, tone: "ok" | "warn" | "error" | "info" | "muted"): string {
  if (tone === "ok") return cliGreen(value);
  if (tone === "warn") return cliYellow(value);
  if (tone === "error") return cliRed(value);
  if (tone === "info") return cliBlue(value);
  return cliDim(value);
}

export function cliKeyValue(
  label: string,
  value: string,
  tone: "ok" | "warn" | "error" | "info" | "muted" = "info",
): string {
  return `${cliDim(label)} ${cliStatus(value, tone)}`;
}

export function formatOutput<T>(mode: OutputMode, payload: T, text: string): void {
  const safeLog = (value: string): void => {
    try {
      console.log(value);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: unknown }).code === "EPIPE"
      ) {
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
