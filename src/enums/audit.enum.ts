/**
 * Standardized SITS AuditLog action, resource, result, and screen definitions.
 */

export enum AuditAction {
  // Auth & Session
  AUTH_LOGIN = "auth.login",
  AUTH_LOGOUT = "auth.logout",
  AUTH_LOGOUT_ALL = "auth.logoutAll",
  AUTH_REFRESH = "auth.refresh",

  QC_STATUS_CHANGE = "qc.status.change",
  CHARGE_STATUS_CHANGE = "charge.status.change",
  IFS_SYNC_FAILED = "ifs.sync.failed",
  IFS_SYNC_STOPPED = "ifs.sync.stopped",

  // User Management
  USER_CREATE = "user.create",
  USER_UPDATE = "user.update",
  USER_DELETE = "user.delete",
  USER_LIST = "user.list",
  USER_READ = "user.read",
  USER_ASSIGN_ROLE = "user.assignRole",
  USER_ROLE_CHANGE = "user.role.change",
  USER_CHANGE_PASSWORD = "user.change_password",
  USER_PASSWORD_RESET = "user.password.reset",

  // Role & Permissions (RBAC)
  ROLE_CREATE = "role.create",
  ROLE_UPDATE = "role.update",
  ROLE_DELETE = "role.delete",
  ROLE_ASSIGN = "role.assign",
  ROLE_READ = "role.read",
  ROLE_LIST = "role.list",
  PERMISSION_CREATE = "permission.create",
  PERMISSION_UPDATE = "permission.update",
  PERMISSION_DELETE = "permission.delete",
  PERMISSION_LIST = "permission.list",

  // Alerts
  ALERT_LIST = "alert.list",
  ALERT_ACKNOWLEDGE = "alert.acknowledge",

  // Line Count
  LINE_COUNT_CREATE = "line_count.create",
  VARIANCE_RAISE = "variance.raise",
  LINE_COUNT_READ = "line_count.read",
  LINE_COUNT_LIST = "line_count.list",

  // Baseline
  BASELINE_CREATE = "baseline.create",
  BASELINE_READ = "baseline.read",
  BASELINE_LIST = "baseline.list",

  // Count Check
  COUNT_CHECK_CREATE = "count_check.create",
  COUNT_CHECK_READ = "count_check.read",
  COUNT_CHECK_LIST = "count_check.list",

  // Devices
  DEVICE_LIST = "device.list",
  DEVICE_READ = "device.read",
  DEVICE_CREATE = "device.create",
  DEVICE_UPDATE = "device.update",
  DEVICE_DEACTIVATE = "device.deactivate",
  DEVICE_INVOKE = "device.invoke",

  // Master Data
  MASTER_DATA_ALTERNATES_SYNC = "master_data.alternates.sync",

  // Receiving Report (RR)
  RR_LIST = "rr.list",
  RR_READ = "rr.read",
  RR_LINE_LIST = "rr.line.list",
  RR_LINE_READ = "rr.line.read",
  RR_LINE_SERIAL_CHECK = "rr.line.serial_check",

  // RFID Tags
  TAG_CREATE = "tag.create",
  TAG_GENERATE = "tag.generate",
  TAG_PRINT = "tag.print",
  TAG_MARK_PRINTED = "tag.mark_printed",
  TAG_COMMISSION = "tag.commission",
  TAG_PHOTO_ATTACH = "tag.photo_attach",
  TAG_VOID = "tag.void",
  TAG_READ = "tag.read",
  TAG_LIST = "tag.list",

  // Transit & Exit
  TRANSIT_EXIT_SCAN = "transit_exit.scan",
  TRANSIT_TRANSFER_CREATE = "transit.transfer.create",
  TRANSFER_DISPATCH = "transfer.dispatch",
  TRANSFER_RECEIVE = "transfer.receive",

  // Holding
  HOLDING_RECEIVE = "holding.receive",
  HOLDING_SCAN = "holding.scan",
  HOLDING_RECONCILE = "holding.reconcile",
  HOLDING_RECONCILE_ALTERNATE = "holding.reconcile_alternate",
  HOLDING_LIST_PENDING = "holding.list_pending",

  // Binning & Storage Hierarchy
  BINNING_PLAN_CREATE = "binning.plan.create",
  BINNING_PLAN_READ = "binning.plan.read",
  BINNING_PLAN_LIST = "binning.plan.list",
  BINNING_PLAN_DOWNLOAD = "binning.plan.download",
  BINNING_PLAN_IMPORT = "binning.plan.import",
  BINNING_PLAN_ACTIVATE = "binning.plan.activate",
  BINNING_LOCATION_LIST = "binning.location.list",
  BINNING_LOCATION_REGISTER = "binning.location.register",
  BINNING_LOCATION_UNREGISTER = "binning.location.unregister",
  BINNING_LOCATION_FIND = "binning.location.find",
  BINNING_LOCATION_READ = "binning.location.read",
  BINNING_PLAN_LINE_LOCATION_READ = "binning.plan_line.location.read",
  BINNING_PLACEMENT_VERIFY = "binning.placement.verify",
  BINNING_PLACEMENT_CONFIRM = "binning.placement.confirm",
  BINNING_SYNC_UPLOAD = "binning.sync.upload",
  BINNING_SYNC_REDOCK = "binning.sync.redock",
  PUT_AWAY_CONFIRM = "put_away.confirm",
  PUT_AWAY_SYNC = "put_away.sync",

  // Stock Verification
  STOCK_VERIFICATION_CREATE = "stock_verification.create",
  STOCK_VERIFICATION_STARTED = "stock_verification.started",
  STOCK_VERIFICATION_COMPLETED = "stock_verification.completed",
  STOCK_VERIFICATION_RUN = "stock_verification.run",
  STOCK_VERIFICATION_SYNC = "stock_verification.sync",
  STOCK_VERIFICATION_LIST = "stock_verification.list",
  STOCK_VERIFICATION_READ = "stock_verification.read",

  // Variance
  VARIANCE_DISPOSITION = "variance.disposition",
  VARIANCE_RESOLVE = "variance.resolve",
  VARIANCE_LIST = "variance.list",
  VARIANCE_READ = "variance.read",
}

export enum AuditResource {
  AUTH = "auth",
  USER = "user",
  ROLE = "role",
  PERMISSION = "permission",
  ALERT = "alert",
  DEVICE = "device",
  DEVICE_REGISTRY = "device_registry",
  APPROVED_ALTERNATE = "approved_alternate",
  LINE_COUNT = "line_count",
  BASELINE = "baseline",
  COUNT_CHECK = "count_check",
  TAG = "tag",
  PACKET_TAG = "packet_tag",
  TRANSIT = "transit",
  TRANSFER = "transfer",
  HOLDING = "holding",
  BIN = "bin",
  BINNING = "binning",
  BINNING_PLAN = "binning_plan",
  BINNING_PLAN_LINE = "binning_plan_line",
  BINNING_LOCATION = "binning_location",
  PLACEMENT_CONFIRMATION = "placement_confirmation",
  PLAN_DOWNLOAD = "plan_download",
  PUT_AWAY = "put_away",
  STORAGE_CONFIRMATION = "storage_confirmation",
  SYNC_LOG = "sync_log",
  STOCK_VERIFICATION = "stock_verification",
  STOCK_VERIFICATION_RUN = "stock_verification_run",
  VARIANCE = "variance",
  RR = "rr",
  RR_LINE = "rr_line",
}

export enum AuditResult {
  SUCCESS = "success",
  FAILURE = "failure",
}
