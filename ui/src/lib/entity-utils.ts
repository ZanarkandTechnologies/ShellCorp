/**
 * ENTITY UTILITIES
 * ================
 * Shared helpers for resolving entity identifiers in the office simulation.
 *
 * MEMORY REFERENCES:
 * - MEM-0144 refactor: unified extractAgentId from agent-memory-panel and manage-agent-modal
 */

/**
 * Strips the "employee-" prefix from an employeeId to get the raw agentId.
 * Returns the value as-is if it does not carry the prefix (e.g. raw agent IDs passed directly).
 */
export function extractAgentId(employeeId: string | null | undefined): string | null {
  if (!employeeId) return null;
  return employeeId.startsWith("employee-") ? employeeId.slice("employee-".length) : employeeId;
}
