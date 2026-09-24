import { EventType } from "../enums/event.enum.js";

/**
 * Human-readable display labels for SITS EventLog event types.
 */
export const EVENT_LABELS: Record<EventType | string, string> = {
  [EventType.RR_FETCHED]: "RR Fetched",
  [EventType.LINE_QC_STATUS_CHANGED]: "Line QC Status Changed",
  [EventType.OWNERSHIP_SET]: "Ownership Set",

  [EventType.LINE_COUNT_STARTED]: "Line Count Started",
  [EventType.LINE_COUNT_CAPTURED]: "Line Count Captured",
  [EventType.LINE_COUNT_VARIANCE]: "Line Count Variance",
  [EventType.LINE_COUNT_APPROVED]: "Line Count Approved",

  [EventType.QC_ACCEPTED]: "QC Accepted",
  [EventType.QC_REJECTED]: "QC Rejected",

  [EventType.TAGGING_STARTED]: "Tagging Started",
  [EventType.TAG_GENERATED]: "Tag Generated",
  [EventType.TAG_PRINTED]: "Tag Printed",
  [EventType.TAG_COMMISSIONED]: "Tag Commissioned",
  [EventType.TAG_VOIDED]: "Tag Voided",
  [EventType.TOP_MARKING_PHOTO_CAPTURED]: "Top Marking Photo Captured",

  [EventType.TRANSIT_EXIT_SCANNED]: "Transit Exit Scanned",
  [EventType.TRANSIT_EXIT_READ]: "Transit Exit Read",
  [EventType.TRANSIT_DOOR_READ]: "Transit Door Read",
  [EventType.TRANSFER_CREATED]: "Transfer Created",
  [EventType.UNAPPROVED_TAG_DETECTED]: "Unapproved Tag Detected",
  [EventType.CHARGE_APPROVAL_CHECK]: "Charge Approval Check",
  [EventType.APPROVED_SUBSET_SELECTED]: "Approved Subset Selected",
  [EventType.NOT_APPROVED_ALERT_RAISED]: "Not Approved Alert Raised",

  [EventType.GATE_EXIT_OK]: "Gate Exit OK",
  [EventType.GATE_ALARM]: "Gate Alarm",

  [EventType.HOLDING_IN]: "Holding In",
  [EventType.HOLDING_MISSING]: "Holding Missing",
  [EventType.HOLDING_EXTRA]: "Holding Extra",
  [EventType.ALTERNATE_RECONCILED]: "Alternate Reconciled",
  [EventType.ALTERNATE_MISMATCH]: "Alternate Mismatch",

  [EventType.COUNT_CHECKED]: "Count Checked",
  [EventType.COUNT_MISMATCH]: "Count Mismatch",

  [EventType.BIN_LOCATED]: "Bin Located",
  [EventType.PUT_AWAY_CONFIRMED]: "Put-Away Confirmed",
  [EventType.PUT_AWAY_SYNCED]: "Put-Away Stored",
  [EventType.PLACEMENT_MISMATCH]: "Placement Mismatch",
  [EventType.SYNC_CONFLICT]: "Sync Conflict",

  [EventType.STOCK_VERIFICATION_COMPLETED]: "Stock Verification Completed",
};
