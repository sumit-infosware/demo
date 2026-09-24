import { AuditAction, AuditResource } from "../enums/audit.enum.js";

/**
 * Human-readable display labels for AuditLog actions.
 */
export const AUDIT_ACTION_LABELS: Record<AuditAction | string, string> = {
  [AuditAction.AUTH_LOGIN]: "User Login",
  [AuditAction.AUTH_LOGOUT]: "User Logout",
  [AuditAction.AUTH_LOGOUT_ALL]: "Logout All Sessions",
  [AuditAction.AUTH_REFRESH]: "Refresh Session Token",
  [AuditAction.QC_STATUS_CHANGE]: "Change QC Status",
  [AuditAction.CHARGE_STATUS_CHANGE]: "Change Charge Status",
  [AuditAction.IFS_SYNC_FAILED]: "IFS Sync Failed",
  [AuditAction.IFS_SYNC_STOPPED]: "IFS Sync Stopped",

  [AuditAction.USER_CREATE]: "Create User",
  [AuditAction.USER_UPDATE]: "Update User",
  [AuditAction.USER_DELETE]: "Delete User",
  [AuditAction.USER_LIST]: "List Users",
  [AuditAction.USER_READ]: "View User Details",
  [AuditAction.USER_ASSIGN_ROLE]: "Assign User Role",
  [AuditAction.USER_ROLE_CHANGE]: "Change User Role",
  [AuditAction.USER_PASSWORD_RESET]: "Reset User Password",

  [AuditAction.ROLE_CREATE]: "Create Role",
  [AuditAction.ROLE_UPDATE]: "Update Role",
  [AuditAction.ROLE_DELETE]: "Delete Role",
  [AuditAction.ROLE_ASSIGN]: "Assign Role",
  [AuditAction.ROLE_READ]: "View Role",
  [AuditAction.ROLE_LIST]: "List Roles",
  [AuditAction.PERMISSION_CREATE]: "Create Permission",
  [AuditAction.PERMISSION_UPDATE]: "Update Permission",
  [AuditAction.PERMISSION_DELETE]: "Delete Permission",
  [AuditAction.PERMISSION_LIST]: "List Permissions",

  [AuditAction.ALERT_LIST]: "List Alerts",
  [AuditAction.ALERT_ACKNOWLEDGE]: "Acknowledge Alert",

  [AuditAction.LINE_COUNT_CREATE]: "Create Line Count",
  [AuditAction.VARIANCE_RAISE]: "Raise Variance",
  [AuditAction.LINE_COUNT_READ]: "View Line Count",
  [AuditAction.LINE_COUNT_LIST]: "List Line Counts",

  [AuditAction.BASELINE_CREATE]: "Create Baseline",
  [AuditAction.BASELINE_READ]: "View Baseline",
  [AuditAction.BASELINE_LIST]: "List Baselines",

  [AuditAction.COUNT_CHECK_CREATE]: "Create Count Check",
  [AuditAction.COUNT_CHECK_READ]: "View Count Check",
  [AuditAction.COUNT_CHECK_LIST]: "List Count Checks",

  // Devices
  [AuditAction.DEVICE_LIST]: "List Devices",
  [AuditAction.DEVICE_READ]: "View Device Details",
  [AuditAction.DEVICE_CREATE]: "Create Device",
  [AuditAction.DEVICE_UPDATE]: "Update Device",
  [AuditAction.DEVICE_DEACTIVATE]: "Deactivate Device",
  [AuditAction.DEVICE_INVOKE]: "Invoke Device",

  // Master Data
  [AuditAction.MASTER_DATA_ALTERNATES_SYNC]: "Sync Approved Alternates",

  // Receiving Report (RR)
  [AuditAction.RR_LIST]: "List Receiving Reports",
  [AuditAction.RR_READ]: "View Receiving Report",
  [AuditAction.RR_LINE_LIST]: "List RR Lines",
  [AuditAction.RR_LINE_READ]: "View RR Line",
  [AuditAction.RR_LINE_SERIAL_CHECK]: "Check RR Line Serials",

  // RFID Tags
  [AuditAction.TAG_CREATE]: "Create RFID Tag",
  [AuditAction.TAG_GENERATE]: "Generate RFID Tag",
  [AuditAction.TAG_PRINT]: "Print RFID Tag",
  [AuditAction.TAG_MARK_PRINTED]: "Mark RFID Tag Printed",
  [AuditAction.TAG_COMMISSION]: "Commission RFID Tag",
  [AuditAction.TAG_PHOTO_ATTACH]: "Attach Tag Photo",
  [AuditAction.TAG_VOID]: "Void RFID Tag",
  [AuditAction.TAG_READ]: "View Tag Details",
  [AuditAction.TAG_LIST]: "List RFID Tags",

  [AuditAction.TRANSIT_EXIT_SCAN]: "Scan Transit Exit",
  [AuditAction.TRANSIT_TRANSFER_CREATE]: "Create Transit Transfer",
  [AuditAction.TRANSFER_DISPATCH]: "Dispatch Transfer",
  [AuditAction.TRANSFER_RECEIVE]: "Receive Transfer",

  // Holding
  [AuditAction.HOLDING_RECEIVE]: "Receive Holding Packet",
  [AuditAction.HOLDING_SCAN]: "Scan Holding Packet",
  [AuditAction.HOLDING_RECONCILE]: "Reconcile Holding Packet",
  [AuditAction.HOLDING_RECONCILE_ALTERNATE]: "Reconcile Alternate Holding Packet",
  [AuditAction.HOLDING_LIST_PENDING]: "List Pending Holding Transfers",

  [AuditAction.BINNING_PLAN_CREATE]: "Create Binning Plan",
  [AuditAction.BINNING_PLAN_READ]: "View Binning Plan",
  [AuditAction.BINNING_PLAN_LIST]: "List Binning Plans",
  [AuditAction.BINNING_PLAN_DOWNLOAD]: "Download Binning Plan",
  [AuditAction.BINNING_PLAN_IMPORT]: "Import Binning Plan",
  [AuditAction.BINNING_PLAN_ACTIVATE]: "Activate Binning Plan",
  [AuditAction.BINNING_LOCATION_LIST]: "List Binning Locations",
  [AuditAction.BINNING_LOCATION_REGISTER]: "Register Binning Location",
  [AuditAction.BINNING_LOCATION_UNREGISTER]: "Unregister Binning Location",
  [AuditAction.BINNING_LOCATION_FIND]: "Find Binning Location",
  [AuditAction.BINNING_LOCATION_READ]: "View Binning Location",
  [AuditAction.BINNING_PLAN_LINE_LOCATION_READ]: "View Plan Line Location",
  [AuditAction.BINNING_PLACEMENT_VERIFY]: "Verify Placement",
  [AuditAction.BINNING_PLACEMENT_CONFIRM]: "Confirm Placement",
  [AuditAction.BINNING_SYNC_UPLOAD]: "Upload Binning Sync",
  [AuditAction.BINNING_SYNC_REDOCK]: "Redock Binning Sync",
  [AuditAction.PUT_AWAY_CONFIRM]: "Confirm Put-Away",
  [AuditAction.PUT_AWAY_SYNC]: "Sync Put-Away",

  [AuditAction.STOCK_VERIFICATION_CREATE]: "Create Stock Verification",
  [AuditAction.STOCK_VERIFICATION_STARTED]: "Start Stock Verification",
  [AuditAction.STOCK_VERIFICATION_COMPLETED]: "Complete Stock Verification",
  [AuditAction.STOCK_VERIFICATION_RUN]: "Run Stock Verification",
  [AuditAction.STOCK_VERIFICATION_SYNC]: "Sync Stock Verification",
  [AuditAction.STOCK_VERIFICATION_LIST]: "List Stock Verifications",
  [AuditAction.STOCK_VERIFICATION_READ]: "View Stock Verification",

  [AuditAction.VARIANCE_DISPOSITION]: "Dispose Variance",
  [AuditAction.VARIANCE_RESOLVE]: "Resolve Variance",
  [AuditAction.VARIANCE_LIST]: "List Variances",
  [AuditAction.VARIANCE_READ]: "View Variance",
};

/**
 * Human-readable display labels for AuditLog resources.
 */
export const AUDIT_RESOURCE_LABELS: Record<AuditResource | string, string> = {
  [AuditResource.AUTH]: "Authentication",
  [AuditResource.USER]: "User",
  [AuditResource.ROLE]: "Role",
  [AuditResource.PERMISSION]: "Permission",
  [AuditResource.ALERT]: "Alert",
  [AuditResource.DEVICE]: "Device",
  [AuditResource.DEVICE_REGISTRY]: "Device Registry",
  [AuditResource.APPROVED_ALTERNATE]: "Approved Alternate",
  [AuditResource.LINE_COUNT]: "Line Count",
  [AuditResource.BASELINE]: "Baseline Count",
  [AuditResource.COUNT_CHECK]: "Count Check",
  [AuditResource.TAG]: "RFID Tag",
  [AuditResource.PACKET_TAG]: "Packet Tag",
  [AuditResource.TRANSIT]: "Transit",
  [AuditResource.TRANSFER]: "Transfer",
  [AuditResource.HOLDING]: "Holding",
  [AuditResource.BIN]: "Bin",
  [AuditResource.BINNING]: "Binning",
  [AuditResource.BINNING_PLAN]: "Binning Plan",
  [AuditResource.BINNING_PLAN_LINE]: "Binning Plan Line",
  [AuditResource.BINNING_LOCATION]: "Binning Location",
  [AuditResource.PLACEMENT_CONFIRMATION]: "Placement Confirmation",
  [AuditResource.PLAN_DOWNLOAD]: "Plan Download",
  [AuditResource.PUT_AWAY]: "Put-Away",
  [AuditResource.STORAGE_CONFIRMATION]: "Storage Confirmation",
  [AuditResource.SYNC_LOG]: "Sync Log",
  [AuditResource.STOCK_VERIFICATION]: "Stock Verification",
  [AuditResource.STOCK_VERIFICATION_RUN]: "Stock Verification Run",
  [AuditResource.VARIANCE]: "Variance",
  [AuditResource.RR]: "Receiving Report",
  [AuditResource.RR_LINE]: "Receiving Report Line",
};
