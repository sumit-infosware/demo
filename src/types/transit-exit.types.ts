/**
 * Types for the Transit Exit — Charge Approval module (RF-22).
 *
 * Follows the same conventions as transit.types.ts (RF-21): plain interfaces,
 * explicit string unions for status, and a result envelope that carries enough
 * structured information for the downstream RF-23 approved-subset selection.
 */

/** Per-EPC disposition at the transit exit (same vocabulary as RF-21). */
export type TransitExitEpcStatus = "FOUND" | "UNKNOWN";

/**
 * Resolved charge-approval status for an RR line.
 * - "approved" — IFS charge status is approved.
 * - "pending"  — IFS charge status is pending / not yet approved / unknown.
 * - "hold"     — IFS/DB was unavailable; the line is held (never assumed approved).
 */
export type ChargeStatus = "approved" | "pending" | "hold";

/** Where the resolved charge status came from. */
export type ChargeSource = "redis" | "ifs" | "hold";

export interface TransitExitChargeCheckInput {
  /** EPC set obtained from RF-21 (bulk RFID read at the transit exit). */
  epcs: string[];
}

/** Per-RrLine charge-approval result (one entry per distinct line). */
export interface TransitExitLineResult {
  rrLineId: string;
  rrLineNo: string;
  rrNo: string;
  chargeStatus: ChargeStatus;
  /** Provenance of the resolved status (redis cache / live IFS / hold). */
  source: ChargeSource;
  /** Convenience flag: true only when chargeStatus === "approved". */
  approved: boolean;
  /** EPCs (from the request) that belong to this line. */
  epcs: string[];
}

/** Per-EPC charge-approval result, in first-seen de-duplicated order. */
export interface TransitExitEpcResult {
  epc: string;
  status: TransitExitEpcStatus;
  /** RR line the EPC maps to; null when the EPC is UNKNOWN. */
  rrLineId: string | null;
  /** Resolved charge status; null when the EPC is UNKNOWN. */
  chargeStatus: ChargeStatus | null;
  /** Whether the line is approved; null when the EPC is UNKNOWN. */
  approved: boolean | null;
}

export interface TransitExitChargeCheckResult {
  totalEpcs: number;
  uniqueEpcs: number;
  unknown: number;
  duplicates: number;
  approvedLines: number;
  pendingLines: number;
  holdLines: number;
  lines: TransitExitLineResult[];
  epcs: TransitExitEpcResult[];
}

/**
 * Types for the Transit Exit — Select Approved Subset module (RF-23).
 *
 * Follows the same conventions as the RF-22 types above. The approved subset
 * is derived server-side by re-resolving each RR line's charge status (never
 * trusting a client-supplied approval), so the result carries enough
 * structured information for RF-24 to generate Transfer IDs.
 */

/** POST /transit-exit/select-approved — select the approved subset (RF-23). */
export interface TransitExitSelectApprovedInput {
  /** EPC set captured at the transit exit (RF-21). */
  epcs: string[];
}

/** A single RR line whose charge status is approved (included in dispatch). */
export interface TransitExitApprovedLine {
  rrLineId: string;
  rrLineNo: string;
  rrNo: string;
  /** Approved EPCs belonging to this line. */
  epcs: string[];
}

/** A single RR line excluded from the dispatch subset (not approved / unknown). */
export interface TransitExitRemainingLine {
  /** RR line identifier; null when the EPC is UNKNOWN (no PacketTag). */
  rrLineId: string | null;
  rrLineNo: string;
  rrNo: string;
  /** Resolved charge status; null when the EPC is UNKNOWN. */
  chargeStatus: ChargeStatus | null;
  /** EPCs belonging to this line that were NOT selected for dispatch. */
  epcs: string[];
}

export interface TransitExitSelectApprovedResult {
  totalEpcs: number;
  uniqueEpcs: number;
  duplicates: number;
  /** Number of EPCs selected for dispatch (approved lines). */
  approvedCount: number;
  /** Number of EPCs NOT selected (pending / hold / unknown). */
  remainingCount: number;
  /** EPCs selected for dispatch (RR line charge status approved). */
  approvedEpcs: string[];
  /** EPCs NOT selected — stay in transit (pending / hold / unknown). */
  remainingEpcs: string[];
  /** Approved RR lines (carries IFS identifiers for RF-24 Transfer ID generation). */
  approvedLines: TransitExitApprovedLine[];
  /** RR lines excluded from the dispatch subset. */
  remainingLines: TransitExitRemainingLine[];
}

/**
 * Types for the Transit Exit — Not-Approved Alert module (RF-25).
 *
 * When the operator at the transit exit decides NOT to approve a packet (or a
 * set of EPCs) for dispatch, they raise an alert addressed to the relevant
 * managers. The alert is persisted in the generic `Alert` model and the
 * recipients are resolved by role name (never hardcoded user IDs).
 */

/** POST /transit-exit/alert — raise a not-approved alert (RF-25). */
export interface TransitExitAlertInput {
  /** Optional transit-exit / transfer reference (e.g. transferId) for traceability. */
  ref?: string | null;
  /** Free-text reason the packet(s) were not approved. */
  reason: string;
  /** EPCs that were NOT approved (the subject of the alert). */
  epcs: string[];
}

/** A recipient resolved from a manager role. */
export interface TransitExitAlertRecipient {
  role: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface TransitExitAlertResult {
  alertId: string;
  alertType: string;
  severity: string;
  ref: string | null;
  message: string;
  status: string;
  createdAt: string;
  /** Manager roles that were notified. */
  notifiedRoles: string[];
  /** Resolved recipient users (from the manager roles). */
  recipients: TransitExitAlertRecipient[];
}

/**
 * Types for the Transit Exit — Generate Transfer ID module (RF-24).
 *
 * Takes the approved EPC subset from RF-23, validates each EPC is approved
 * and eligible for transfer, generates a unique Transfer ID, persists the
 * Transfer and TransferLine records, creates Redis mappings, and logs the event.
 */

/** POST /transit-exit/generate-transfer — generate Transfer ID for approved EPCs (RF-24). */
export interface TransitExitGenerateTransferInput {
  /** Approved EPC set from RF-23 select-approved. */
  epcs: string[];
  destination: string;
}

/** Per-EPC validation result for transfer generation. */
export interface TransitExitTransferEpcResult {
  epc: string;
  status: "VALID" | "INVALID" | "NOT_APPROVED" | "HOLD" | "UNKNOWN";
  rrLineId: string | null;
  rrLineNo: string | null;
  rrNo: string | null;
  reason?: string;
}

export interface TransitExitGenerateTransferResult {
  transferId: string;
  epcs: string[];
  totalEpcs: number;
  epcResults: TransitExitTransferEpcResult[];
}
