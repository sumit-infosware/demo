/**
 * Raw IFS `GATE_ENTRY_DETAIL.STATUS` values.
 */
export const IFS_LINE_STATUS = {
  TO_BE_COUNTED: "TO_BE_COUNTED",
  INSPECTED: "INSPECTED",
  HOLD: "HOLD",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type IfsLineStatus = (typeof IFS_LINE_STATUS)[keyof typeof IFS_LINE_STATUS];

/** Legacy SITS manual/seed QC vocabulary — no longer written by IFS fetch. */
export const SITS_QC_STATUS = {
  PASSED: "passed",
  FAILED: "failed",
  PENDING: "pending",
  TO_BE_INSPECTED: "to_be_inspected",
  QUARANTINE: "quarantine",
} as const;

export type SitsQcStatus = (typeof SITS_QC_STATUS)[keyof typeof SITS_QC_STATUS];
