/**
 * Central registry of permission codes.
 *
 * Single source of truth for every permission string used across the
 * application. Permission codes follow the existing `resource.action`
 * convention already established in the seed (e.g. `users.read`,
 * `admin.access`). Controllers, services, routes and middleware must
 * reference these constants rather than hardcoding strings.
 */
export const PERMISSIONS = {
  // Role management
  ROLE_CREATE: "roles.create",
  ROLE_READ: "roles.read",
  ROLE_UPDATE: "roles.update",
  ROLE_DELETE: "roles.delete",

  // Permission management
  PERMISSION_CREATE: "permissions.create",
  PERMISSION_READ: "permissions.read",
  PERMISSION_UPDATE: "permissions.update",
  PERMISSION_DELETE: "permissions.delete",

  // Existing application-level permission (seeded by the original seed).
  ADMIN_ACCESS: "admin.access",

  // ─── User CRUD ───────────────────────────────────────────────
  USER_CREATE: "user:create",
  USER_READ: "user:read",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",

  // ─── Receiving Report (RR) ───────────────────────────────────
  RR_READ: "rr:read",
  RR_FETCH: "rr:fetch",

  // ─── IFS Integration (Fetch + Polling) ───────────────────────
  IFS_FETCH: "ifs:fetch",
  IFS_POLL_CONTROL: "ifs:poll:control",
  IFS_POLL_CONFIG_READ: "ifs:poll:config:read",
  IFS_POLL_CONFIG_WRITE: "ifs:poll:config:write",
  IFS_POLL_STATE_READ: "ifs:poll:state:read",
  IFS_POLL_CONFIG_UPDATE: "ifs:poll:config:update",
  IFS_STOCK_VERIFICATION_READ: "ifs:stock_verification:read",
  IFS_STOCK_VERIFICATION_RUN: "ifs:stock_verification:run",

  // ─── Tagging (Phase 2) ───────────────────────────────────────
  TAG_CREATE: "tag:create",
  TAG_READ: "tag:read",
  TAG_COMMISSION: "tag:commission",
  TAG_PRINT: "tag:print",

  // ─── Baseline (Phase 3) ────────────────────────────────
  BASELINE_CREATE: "baseline:create",
  BASELINE_READ: "baseline:read",
  BASELINE_UPDATE: "baseline:update",

  // ─── Devices ──────────────────────────────────────────
  DEVICE_READ: "device:read",
  DEVICE_MANAGE: "device:manage",
  DEVICE_INVOKE: "device:invoke",

  // ─── Holding Receive (Phase 6) ───────────────────────
  HOLDING_SCAN: "holding:scan",
  HOLDING_RECEIVE: "holding:receive",
  HOLDING_RECONCILE: "holding:reconcile",

  // ─── Count Check (Phase 7) ───────────────────────────
  COUNTCHECK_CREATE: "countcheck:create",
  COUNTCHECK_READ: "countcheck:read",
  COUNTCHECK_OVERRIDE: "countcheck:override",

  // ─── Alerts ───────────────────────────────────────────
  ALERT_READ: "alert:read",
  ALERT_ACKNOWLEDGE: "alert:acknowledge",

  // ─── Variance ─────────────────────────────────────────
  VARIANCE_READ: "variance:read",
  VARIANCE_RESOLVE: "variance:resolve",

  // ─── Transit Exit — Charge Approval (RF-22) ─────────────────
  TRANSIT_CHARGE_CHECK: "transit:charge_check",

  // ─── Transit Exit — Select Approved Subset (RF-23) ──────────
  TRANSIT_SELECT_APPROVED: "transit:select_approved",

  // ─── Transit Exit — Generate Transfer (RF-24) ──────────────
  TRANSIT_GENERATE_TRANSFER: "transit:generate_transfer",

  // ─── Transit Exit — Not-Approved Alert (RF-25) ─────────────
  TRANSIT_ALERT_CREATE: "transit:alert_create",

  // ─── Transit Door — Read EPC (RF-26, RF-27, RF-28) ──────────
  TRANSIT_DOOR_READ: "transit:door_read",

  // NEW v2.0
  LINE_COUNT_CREATE: "line_count.create",
  LINE_COUNT_READ: "line_count.read",
  LINE_COUNT_APPROVE: "line_count.approve",
  OWNERSHIP_SET: "ownership.set",
  TAG_VOID: "tag.void",
  PUT_AWAY_SYNC: "put_away.sync",
  HANDHELD_PHOTO_UPLOAD: "handheld.photo_upload",
  // ─── Binning (RF-37, RF-40, RF-41) ───────────────────────────
  BINNING_PLAN_READ: "binning:plan_read",
  BINNING_CONFIRM: "binning:confirm",
  BINNING_LOCATION_READ: "binning:location_read",
  BINNING_LOCATION_MANAGE: "binning:location_manage",

  // ─── Asset Transfer & Storage ────────────────────────────────
  ASSET_TRANSFER_READ: "asset_transfer:read",
} as const;

/** Type representing every valid permission code. */
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Array form of every permission code (useful for seeding/admin grants). */
export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS);
