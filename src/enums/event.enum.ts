/**
 * Standardized SITS EventLog event types.
 *
 * Appended to the `event_log` table for lifecycle tracking across receiving,
 * counting, tagging, transit, gate verification, holding, count checking,
 * put-away / binning, and stock verification.
 */
export enum EventType {
  // Phase 1: Fetch & QC
  RR_FETCHED = "rr_fetched",
  LINE_QC_STATUS_CHANGED = "line_qc_status_changed",
  OWNERSHIP_SET = "ownership_set",

  // Phase 2: Counting (line-level, BEFORE tagging)
  LINE_COUNT_STARTED = "line_count_started",
  LINE_COUNT_CAPTURED = "COUNTED",
  LINE_COUNT_VARIANCE = "line_count_variance",
  LINE_COUNT_APPROVED = "line_count_approved",

  // Phase 3: QC Accept
  QC_ACCEPTED = "qc_accepted",
  QC_REJECTED = "qc_rejected",

  // Phase 4: Tagging
  TAGGING_STARTED = "tagging_started",
  TAG_GENERATED = "TAGGED",
  TAG_PRINTED = "tag_printed",
  TAG_COMMISSIONED = "commissioned",
  TAG_VOIDED = "tag_voided",
  TOP_MARKING_PHOTO_CAPTURED = "top_marking_photo_captured",

  // Legacy aliases
  TAGGED = "tagged",
  BASELINE_COUNTED = "baseline_counted",
  BASELINE_VARIANCE = "baseline_variance",

  // Phase 5: Transfer / Transit
  TRANSIT_EXIT_SCANNED = "TRANSIT_OUT",
  TRANSIT_EXIT_READ = "transit_exit_read",
  TRANSIT_DOOR_READ = "TRANSIT_DOOR_READ",
  TRANSFER_CREATED = "transfer_created",
  UNAPPROVED_TAG_DETECTED = "unapproved_tag_detected",
  CHARGE_APPROVAL_CHECK = "charge_approval_check",
  APPROVED_SUBSET_SELECTED = "approved_subset_selected",
  NOT_APPROVED_ALERT_RAISED = "not_approved_alert_raised",

  // Phase 6: Gate Verify
  GATE_EXIT_OK = "gate_exit_ok",
  GATE_ALARM = "gate_alarm",

  // Phase 7: Holding
  HOLDING_IN = "holding_in",
  HOLDING_MISSING = "holding_missing",
  HOLDING_EXTRA = "holding_extra",
  ALTERNATE_RECONCILED = "alternate_reconciled",
  ALTERNATE_MISMATCH = "alternate_mismatch",

  // Phase 8: Count-Check
  COUNT_CHECKED = "count_checked",
  COUNT_MISMATCH = "count_mismatch",

  // Phase 9: Put-away / Binning
  BIN_LOCATED = "bin_located",
  PUT_AWAY_CONFIRMED = "put_away_confirmed",
  PUT_AWAY_SYNCED = "STORED",
  PLACEMENT_MISMATCH = "PLACEMENT_MISMATCH",
  SYNC_CONFLICT = "SYNC_CONFLICT",

  // Phase 10: Stock Verification (physical audit vs IFS stock)
  STOCK_VERIFICATION_COMPLETED = "stock_verification_completed",
}
