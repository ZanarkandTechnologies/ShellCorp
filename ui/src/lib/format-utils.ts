/**
 * FORMAT UTILITIES
 * ================
 * Shared display formatting helpers for UI components.
 *
 * MEMORY REFERENCES:
 * - MEM-0144 refactor: unified formatTimestamp from 4 duplicate inline definitions
 */

export function formatTimestamp(ts?: number): string {
  if (!ts) return "n/a";
  return new Date(ts).toLocaleString();
}
