/**
 * Shared charge-approval helpers.
 *
 * Single source of truth for interpreting a raw IFS charge-approval value.
 * Used by both the transit-exit module (RF-22, live IFS read) and the
 * reader-lookup module (legacy mirror read), so the two never disagree about
 * what "approved" means.
 */

/**
 * Maps a raw IFS/mirror charge-approval value to a boolean.
 *
 * IFS stores approvals as strings in mixed case (`APPROVED`, `TRUE`, `YES`,
 * `Y`, `1`). Anything unset or unrecognised is treated as NOT approved — a
 * missing/unknown value must never be assumed approved.
 */
export function isChargeApproved(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined) return false;
  const s = String(raw).trim().toUpperCase();
  return s === "APPROVED" || s === "TRUE" || s === "YES" || s === "Y" || s === "1";
}
