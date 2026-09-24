/**
 * Classification of a gate entry during an idempotent sync.
 */
export const GATE_ENTRY_STATE = {
  NEW: "NEW",
  UPDATED: "UPDATED",
  UNCHANGED: "UNCHANGED",
} as const;

export type GateEntryState = (typeof GATE_ENTRY_STATE)[keyof typeof GATE_ENTRY_STATE];

/**
 * Values derived per the HAL ownership rule (REP PO / REP FOC -> Repair, PO -> Company).
 */
export const PO_OWNERSHIP = {
  REPAIR: "Repair",
  COMPANY: "Company",
} as const;

export type PoOwnership = (typeof PO_OWNERSHIP)[keyof typeof PO_OWNERSHIP];

/**
 * Status of the IFS Polling State (ifs_sync_state.status) across restarts.
 *
 * Canonical home — poll-state.service and the poll/repoll processors use it.
 */
export const IFS_POLL_STATE = {
  RUNNING: "RUNNING",
  STOPPED: "STOPPED",
  FAILED: "FAILED",
} as const;

export type IfsPollState = (typeof IFS_POLL_STATE)[keyof typeof IFS_POLL_STATE];

/**
 * Status for per gate-entry sync outcome (ifs_gate_entry_sync_state.status).
 */
export const IFS_GATE_ENTRY_SYNC_STATE = {
  PENDING: "PENDING",
  SYNCED: "SYNCED",
  FAILED: "FAILED",
} as const;

export type IfsGateEntrySyncState =
  (typeof IFS_GATE_ENTRY_SYNC_STATE)[keyof typeof IFS_GATE_ENTRY_SYNC_STATE];

/**
 * Watermark health (ifs_sync_watermarks.status).
 */
export const IFS_WATERMARK_STATUS = {
  HEALTHY: "HEALTHY",
  DEGRADED: "DEGRADED",
} as const;

export type IfsWatermarkStatus = (typeof IFS_WATERMARK_STATUS)[keyof typeof IFS_WATERMARK_STATUS];
