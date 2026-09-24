/**
 * Event types logged by IFS synchronization and fetching pipelines.
 */
export enum IfsEventType {
  MANUAL_FETCH_COMPLETED = "manual.fetch.completed",
  GATE_ENTRY_LINE_FLAGGED = "gate-entry.line.flagged",
  RR_LINE_REJECTED = "rr-line.rejected",
  RR_LINE_FETCH_READY = "rr-line.fetch-ready",
  GATE_ENTRY_LINE_CANCELLED = "gate-entry.line.cancelled",
  RR_LINE_SERIALS_MISSING = "rr-line.serials-missing",
  GATE_ENTRY_SYNCED = "gate-entry.synced",
  GATE_ENTRY_SYNCED_NEW = "gate-entry.synced.new",
  GATE_ENTRY_SYNCED_UPDATED = "gate-entry.synced.updated",
  GATE_ENTRY_SYNCED_UNCHANGED = "gate-entry.synced.unchanged",
}
