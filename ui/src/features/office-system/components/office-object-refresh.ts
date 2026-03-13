/**
 * OFFICE OBJECT REFRESH
 * =====================
 * Best-effort provider refresh helpers after successful office-object mutations.
 *
 * KEY CONCEPTS:
 * - Mutation success should not be reclassified as failure just because the follow-up refresh fails.
 * - Refresh failures still need logging so stale snapshots can be diagnosed without hiding the original write result.
 *
 * USAGE:
 * - Call after confirmed office-object write/delete success.
 *
 * MEMORY REFERENCES:
 * - MEM-0179
 */

export async function refreshOfficeDataSafely(
  refresh: () => Promise<void>,
  logWarning: (message: string, error: unknown) => void = console.warn,
): Promise<void> {
  try {
    await refresh();
  } catch (error) {
    logWarning("Office data refresh failed after a successful office-object mutation.", error);
  }
}
