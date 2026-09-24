/**
 * Single source of truth for every line-status vocabulary used by the
 * HAL/SITS receiving flow (read-only from IFS).
 *
 * IFS `GATE_ENTRY_DETAIL.STATUS` is stored VERBATIM in `rr_lines.qc_status`
 * (flow cells 533/534/543). Statuses arrive raw from IFS as To-be-counted /
 * Inspected / Hold / Rejected / Cancelled and SITS never translates them;
 * all comparisons are case-insensitive.
 */

import {
  IFS_LINE_STATUS,
  type IfsLineStatus,
  SITS_QC_STATUS,
  type SitsQcStatus,
} from "../enums/ifs-qc-status.enum.js";

export { IFS_LINE_STATUS, SITS_QC_STATUS, type IfsLineStatus, type SitsQcStatus };

/**
 * Normalizes raw IFS detail status strings to canonical uppercase values.
 * e.g. "To-be-counted" -> "TO_BE_COUNTED", "Inspected" -> "INSPECTED", "Hold" -> "HOLD", "Rejected" -> "REJECTED"
 */
export function normalizeIfsQcStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  const s = status.trim().toUpperCase().replace(/[- ]/g, "_");
  if (s === "TO_BE_COUNTED") return IFS_LINE_STATUS.TO_BE_COUNTED;
  if (s === "INSPECTED") return IFS_LINE_STATUS.INSPECTED;
  if (s === "HOLD") return IFS_LINE_STATUS.HOLD;
  if (s === "REJECTED") return IFS_LINE_STATUS.REJECTED;
  if (s === "CANCELLED" || s === "CANCELED") return IFS_LINE_STATUS.CANCELLED;
  return s;
}

/** Status that unlocks tagging once a counted line reaches it (fetch-ready). */
export const FETCH_READY_STATUS = IFS_LINE_STATUS.INSPECTED;

function equalsIgnoreCase(status: string | null | undefined, value: string): boolean {
  return Boolean(status) && status!.trim().toLowerCase() === value.toLowerCase();
}

/** True when an IFS line STATUS means Rejected (terminal — never re-polled). */
export function isIfsRejectedStatus(status: string | null | undefined): boolean {
  return equalsIgnoreCase(status, IFS_LINE_STATUS.REJECTED);
}

/** True when an IFS line STATUS means Cancelled (void tags on sync). */
export function isIfsCancelledStatus(status: string | null | undefined): boolean {
  return equalsIgnoreCase(status, IFS_LINE_STATUS.CANCELLED);
}

/** True when an IFS line STATUS means Inspected (tagging unlocked). */
export function isIfsInspectedStatus(status: string | null | undefined): boolean {
  return equalsIgnoreCase(status, IFS_LINE_STATUS.INSPECTED);
}

/** True when an IFS line STATUS means Hold (keep re-polling). */
export function isIfsHoldStatus(status: string | null | undefined): boolean {
  return equalsIgnoreCase(status, IFS_LINE_STATUS.HOLD);
}

/** True when an IFS line STATUS means To-be-counted (count before tagging). */
export function isIfsToBeCountedStatus(status: string | null | undefined): boolean {
  return equalsIgnoreCase(status, IFS_LINE_STATUS.TO_BE_COUNTED);
}

/**
 * The single pre-tagging QC gate (flow cells 543/544). Tagging unlocks once a
 * line reaches the IFS Inspected status; the legacy translated "passed" value
 * is accepted only for pre-existing seeded/demo rows.
 *
 * @param fetchReady the configured fetch-ready status (defaults to Inspected).
 */
export function isTaggableQcStatus(
  status: string | null | undefined,
  fetchReady: string = FETCH_READY_STATUS,
): boolean {
  return equalsIgnoreCase(status, fetchReady) || equalsIgnoreCase(status, SITS_QC_STATUS.PASSED);
}
