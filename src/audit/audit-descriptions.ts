/**
 * Read-time description generator for audit log entries.
 *
 * Nothing stores a human-readable description today, so sentences are built
 * from the persisted action string, resource, and metadata captured by each
 * writeAudit call site. Existing rows render fine without any migration.
 */
import { AuditAction } from "../enums/audit.enum.js";

export interface DescriptionContext {
  /** Stored AuditAction value, e.g. "tag.generate". */
  action: string;
  /** Structured metadata captured at write time (requestId, actorEmail, op meta). */
  meta: Record<string, unknown>;
  /** Human-readable resource label, e.g. "Packet Tag". */
  resourceLabel: string;
  /** Identifier of the affected resource. */
  resourceId: string | null;
  /** Human-readable screen label, e.g. "Tagging". */
  screenLabel: string;
}

type Template = string | ((ctx: DescriptionContext) => string);

const prettify = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value).replace(/_+/g, " ").trim()
    : "";

const val = (meta: Record<string, unknown>, key: string): string => {
  const value = meta[key];
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  const json = JSON.stringify(value);
  return json === undefined ? "" : json;
};

const has = (meta: Record<string, unknown>, key: string): boolean =>
  meta[key] !== undefined && meta[key] !== null;

const idOf = (ctx: DescriptionContext, fallbackKey = "resourceId"): string =>
  ctx.meta[fallbackKey] !== undefined && ctx.meta[fallbackKey] !== null
    ? val(ctx.meta, fallbackKey)
    : (ctx.resourceId ?? "");

const confirmResult = (ctx: DescriptionContext, ok: string, noun: string): string => {
  const reason = val(ctx.meta, "reason");
  return reason ? `${noun} failed (${prettify(reason)}).` : ok;
};

const DESCRIPTIONS: Partial<Record<AuditAction, Template>> = {
  // ── Auth & Session ─────────────────────────────────────────
  [AuditAction.AUTH_LOGIN]: "User logged in successfully.",
  [AuditAction.AUTH_REFRESH]: "User session token was refreshed.",
  [AuditAction.AUTH_LOGOUT]: "User logged out.",
  [AuditAction.AUTH_LOGOUT_ALL]: "User logged out from all sessions.",
  [AuditAction.QC_STATUS_CHANGE]: (ctx) =>
    `QC status changed for ${idOf(ctx)} to ${val(ctx.meta, "status") || "unknown"}.`,
  [AuditAction.CHARGE_STATUS_CHANGE]: (ctx) =>
    `Charge status checked for ${idOf(ctx)} as ${val(ctx.meta, "status") || "unknown"}.`,
  [AuditAction.IFS_SYNC_FAILED]: (ctx) =>
    `IFS synchronization failed${val(ctx.meta, "gateEntryNo") ? ` for ${val(ctx.meta, "gateEntryNo")}` : ""}.`,
  [AuditAction.IFS_SYNC_STOPPED]: (ctx) =>
    `IFS polling stopped${val(ctx.meta, "reason") ? ` (${prettify(ctx.meta.reason)})` : ""}.`,

  // ── User Management ────────────────────────────────────────
  [AuditAction.USER_LIST]: "Listed users.",
  [AuditAction.USER_READ]: (ctx) => `Viewed user ${idOf(ctx)}.`,
  [AuditAction.USER_CREATE]: (ctx) => `Created user ${val(ctx.meta, "email") || idOf(ctx)}.`,
  [AuditAction.USER_UPDATE]: (ctx) => `Updated user ${idOf(ctx)}.`,
  [AuditAction.USER_ROLE_CHANGE]: (ctx) =>
    `Changed role for user ${idOf(ctx)} from ${val(ctx.meta, "oldRoleId") || "unknown"} to ${val(ctx.meta, "newRoleId") || "unknown"}.`,
  [AuditAction.USER_DELETE]: (ctx) => `Deleted user ${val(ctx.meta, "email") || idOf(ctx)}.`,
  [AuditAction.USER_ASSIGN_ROLE]: (ctx) =>
    `Assigned role ${val(ctx.meta, "roleName")} to user ${idOf(ctx)}.`,
  [AuditAction.USER_CHANGE_PASSWORD]: (ctx) =>
    `User ${val(ctx.meta, "email") || idOf(ctx)} changed their password.`,
  [AuditAction.USER_PASSWORD_RESET]: (ctx) => `Password was reset for user ${idOf(ctx)}.`,

  // ── Role & Permissions ─────────────────────────────────────
  [AuditAction.ROLE_CREATE]: (ctx) => `Created role "${val(ctx.meta, "name") || idOf(ctx)}".`,
  [AuditAction.ROLE_UPDATE]: (ctx) => `Updated role "${val(ctx.meta, "name") || idOf(ctx)}".`,
  [AuditAction.ROLE_DELETE]: (ctx) => `Deleted role ${idOf(ctx)}.`,
  [AuditAction.ROLE_ASSIGN]: (ctx) => `Assigned role "${val(ctx.meta, "name")}".`,
  [AuditAction.ROLE_READ]: (ctx) => `Viewed role ${idOf(ctx)}.`,
  [AuditAction.ROLE_LIST]: "Listed roles.",
  [AuditAction.PERMISSION_CREATE]: (ctx) =>
    `Created permission ${val(ctx.meta, "code") || idOf(ctx)}.`,
  [AuditAction.PERMISSION_UPDATE]: (ctx) =>
    `Updated permission ${val(ctx.meta, "code") || idOf(ctx)}.`,
  [AuditAction.PERMISSION_DELETE]: (ctx) => `Deleted permission ${idOf(ctx)}.`,
  [AuditAction.PERMISSION_LIST]: "Listed permissions.",

  // ── Alerts ─────────────────────────────────────────────────
  [AuditAction.ALERT_LIST]: "Listed alerts.",
  [AuditAction.ALERT_ACKNOWLEDGE]: (ctx) => `Acknowledged alert ${idOf(ctx)}.`,

  // ── Line Count ─────────────────────────────────────────────
  [AuditAction.LINE_COUNT_CREATE]: (ctx) =>
    `Recorded a line count of ${val(ctx.meta, "finalQty") || "?"}${has(ctx.meta, "variance") && ctx.meta.variance === true ? " with variance" : ""} for RR line ${idOf(ctx)}.`,
  [AuditAction.VARIANCE_RAISE]: (ctx) => `Raised variance for ${idOf(ctx)}.`,
  [AuditAction.LINE_COUNT_READ]: (ctx) => `Viewed line count for RR line ${idOf(ctx)}.`,
  [AuditAction.LINE_COUNT_LIST]: "Listed line counts.",

  // ── Baseline ───────────────────────────────────────────────
  [AuditAction.BASELINE_CREATE]: (ctx) =>
    `Captured baseline${val(ctx.meta, "method") ? ` via ${val(ctx.meta, "method")}` : ""} for packet tag ${idOf(ctx)}.`,
  [AuditAction.BASELINE_READ]: (ctx) => `Viewed baseline for packet tag ${idOf(ctx)}.`,
  [AuditAction.BASELINE_LIST]: "Listed baselines.",

  // ── Count Check ────────────────────────────────────────────
  [AuditAction.COUNT_CHECK_CREATE]: (ctx) =>
    `Recorded count check of ${val(ctx.meta, "actualCount") || "?"} against baseline ${val(ctx.meta, "baselineCount") || "?"} for packet ${idOf(ctx)}.`,
  [AuditAction.COUNT_CHECK_READ]: (ctx) => `Viewed count check for packet ${idOf(ctx)}.`,
  [AuditAction.COUNT_CHECK_LIST]: "Listed count checks.",

  // ── Devices ────────────────────────────────────────────────
  [AuditAction.DEVICE_LIST]: "Listed devices.",
  [AuditAction.DEVICE_READ]: (ctx) => `Viewed device ${idOf(ctx)}.`,
  [AuditAction.DEVICE_CREATE]: (ctx) =>
    `Registered ${val(ctx.meta, "deviceType") || ""} device ${idOf(ctx) || val(ctx.meta, "location")}.`,
  [AuditAction.DEVICE_UPDATE]: (ctx) => `Updated device ${idOf(ctx)}.`,
  [AuditAction.DEVICE_DEACTIVATE]: (ctx) => `Deactivated device ${idOf(ctx)}.`,
  [AuditAction.DEVICE_INVOKE]: (ctx) =>
    `Invoked ${val(ctx.meta, "requestType") || "operation"} on device ${idOf(ctx)}.`,

  // ── Master Data ────────────────────────────────────────────
  [AuditAction.MASTER_DATA_ALTERNATES_SYNC]: (ctx) =>
    `Synced approved alternates (${val(ctx.meta, "upserted") || 0} upserted, ${val(ctx.meta, "deactivated") || 0} deactivated).`,

  // ── Receiving Report ───────────────────────────────────────
  [AuditAction.RR_LIST]: "Listed receiving reports.",
  [AuditAction.RR_READ]: (ctx) => `Viewed receiving report ${idOf(ctx)}.`,
  [AuditAction.RR_LINE_READ]: (ctx) => `Viewed receiving report line ${idOf(ctx)}.`,
  [AuditAction.RR_LINE_LIST]: "Listed receiving report lines.",
  [AuditAction.RR_LINE_SERIAL_CHECK]: (ctx) => `Checked serials for RR line ${idOf(ctx)}.`,

  // ── RFID Tags ──────────────────────────────────────────────
  [AuditAction.TAG_GENERATE]: (ctx) =>
    `RFID tag ${val(ctx.meta, "epc") || idOf(ctx)} was generated${val(ctx.meta, "serialNumber") ? ` with serial number ${val(ctx.meta, "serialNumber")}` : ""}.`,
  [AuditAction.TAG_MARK_PRINTED]: (ctx) =>
    `RFID tag ${val(ctx.meta, "epc") || idOf(ctx)} was marked as printed.`,
  [AuditAction.TAG_COMMISSION]: (ctx) =>
    `RFID tag ${val(ctx.meta, "epc") || idOf(ctx)} was commissioned.`,
  [AuditAction.TAG_VOID]: (ctx) =>
    `RFID tag ${idOf(ctx)} was voided${val(ctx.meta, "reason") ? ` (${prettify(ctx.meta.reason)})` : ""}.`,
  [AuditAction.TAG_PHOTO_ATTACH]: (ctx) => `Attached a photo to packet tag ${idOf(ctx)}.`,
  [AuditAction.TAG_READ]: (ctx) => `Viewed packet tag ${idOf(ctx)}.`,
  [AuditAction.TAG_LIST]: (ctx) => `Listed ${val(ctx.meta, "count") || "packet"} packet tags.`,

  // ── Transit & Exit ─────────────────────────────────────────
  [AuditAction.TRANSIT_EXIT_SCAN]: "Scanned a transit exit.",
  [AuditAction.TRANSIT_TRANSFER_CREATE]: (ctx) => `Created transit transfer ${idOf(ctx)}.`,
  [AuditAction.TRANSFER_DISPATCH]: (ctx) => `Dispatched transfer ${idOf(ctx)}.`,
  [AuditAction.TRANSFER_RECEIVE]: (ctx) => `Received transfer ${idOf(ctx)}.`,

  // ── Holding ────────────────────────────────────────────────
  [AuditAction.HOLDING_SCAN]: (ctx) =>
    `Scanned holding arrival for transfer ${idOf(ctx)} (${val(ctx.meta, "found") || 0} found, ${val(ctx.meta, "missing") || 0} missing, ${val(ctx.meta, "extra") || 0} extra).`,
  [AuditAction.HOLDING_RECEIVE]: (ctx) =>
    `Completed holding receive for transfer ${idOf(ctx)} (${val(ctx.meta, "receivedCount") || 0} received, ${val(ctx.meta, "missingCount") || 0} missing).`,
  [AuditAction.HOLDING_RECONCILE_ALTERNATE]: (ctx) =>
    `Reconciled alternate item ${val(ctx.meta, "ifsItem") || "?"} against tagged item ${val(ctx.meta, "taggedItem") || "?"} for packet ${idOf(ctx)}.`,
  [AuditAction.HOLDING_LIST_PENDING]: "Listed pending holding transfers.",

  // ── Binning ────────────────────────────────────────────────
  [AuditAction.BINNING_PLAN_CREATE]: (ctx) => `Created binning plan ${idOf(ctx)}.`,
  [AuditAction.BINNING_PLAN_READ]: (ctx) =>
    confirmResult(
      ctx,
      `Viewed binning plan ${idOf(ctx, "planId") || idOf(ctx)}.`,
      "Binning plan lookup",
    ),
  [AuditAction.BINNING_PLAN_LIST]: (ctx) => `Listed ${val(ctx.meta, "count") || ""} binning plans.`,
  [AuditAction.BINNING_PLAN_DOWNLOAD]: (ctx) =>
    confirmResult(
      ctx,
      `Downloaded binning plan ${val(ctx.meta, "planId") || idOf(ctx)} to device ${val(ctx.meta, "deviceId") || "?"}.`,
      "Binning plan download",
    ),
  [AuditAction.BINNING_PLAN_IMPORT]: (ctx) =>
    confirmResult(
      ctx,
      `Imported binning plan ${idOf(ctx, "planId")} (${val(ctx.meta, "createdLines") || 0} created, ${val(ctx.meta, "updatedLines") || 0} updated).`,
      "Binning plan import",
    ),
  [AuditAction.BINNING_PLAN_ACTIVATE]: (ctx) =>
    confirmResult(
      ctx,
      `Activated binning plan ${val(ctx.meta, "planId") || idOf(ctx)}.`,
      "Binning plan activation",
    ),
  [AuditAction.BINNING_LOCATION_LIST]: (ctx) =>
    `Listed ${val(ctx.meta, "count") || ""} binning locations.`,
  [AuditAction.BINNING_LOCATION_REGISTER]: (ctx) =>
    confirmResult(
      ctx,
      `Registered ${val(ctx.meta, "binCode") || "bin"} with RFID ${val(ctx.meta, "rfid")}.`,
      "Binning location registration",
    ),
  [AuditAction.BINNING_LOCATION_UNREGISTER]: (ctx) =>
    confirmResult(
      ctx,
      `Unregistered bin location RFID ${val(ctx.meta, "rfid") || idOf(ctx)}.`,
      "Binning location unregistration",
    ),
  [AuditAction.BINNING_LOCATION_FIND]: (ctx) =>
    confirmResult(
      ctx,
      `Located bin ${val(ctx.meta, "binCode")}${val(ctx.meta, "tagId") ? ` (tag ${val(ctx.meta, "tagId")})` : ""}.`,
      "Bin location lookup",
    ),
  [AuditAction.BINNING_LOCATION_READ]: (ctx) =>
    confirmResult(
      ctx,
      `Found location ${val(ctx.meta, "binCode") ? `at bin ${val(ctx.meta, "binCode")}` : ""} for tag ${val(ctx.meta, "tagId") || idOf(ctx)}.`,
      "Location lookup",
    ),
  [AuditAction.BINNING_PLAN_LINE_LOCATION_READ]: (ctx) =>
    confirmResult(
      ctx,
      `Viewed location for binning plan line ${val(ctx.meta, "lineNo") || idOf(ctx)}.`,
      "Plan line location lookup",
    ),
  [AuditAction.BINNING_PLACEMENT_VERIFY]: (ctx) =>
    confirmResult(
      ctx,
      `Verified placement of packet ${val(ctx.meta, "epc") || "?"} at bin ${val(ctx.meta, "binCode") || "?"}.`,
      "Placement verification",
    ),
  [AuditAction.BINNING_PLACEMENT_CONFIRM]: (ctx) =>
    confirmResult(
      ctx,
      `Confirmed placement of packet ${val(ctx.meta, "epc") || "?"} at bin ${val(ctx.meta, "binCode") || "?"}.`,
      "Placement confirmation",
    ),
  [AuditAction.BINNING_SYNC_UPLOAD]: (ctx) =>
    `Uploaded ${val(ctx.meta, "itemCount") || ""} binning sync records.`,
  [AuditAction.BINNING_SYNC_REDOCK]: (ctx) =>
    confirmResult(
      ctx,
      `Redock sync completed with status ${prettify(ctx.meta.status) || "?"} (${val(ctx.meta, "uploaded") || 0} uploaded, ${val(ctx.meta, "conflicts") || 0} conflicts).`,
      "Redock sync",
    ),

  // ── Put Away ───────────────────────────────────────────────
  [AuditAction.PUT_AWAY_CONFIRM]: (ctx) => `Confirmed put-away for packet ${idOf(ctx)}.`,
  [AuditAction.PUT_AWAY_SYNC]: (ctx) =>
    `Synced ${val(ctx.meta, "itemCount") || ""} put-away records from device ${val(ctx.meta, "deviceId") || "?"}.`,

  // ── Stock Verification ─────────────────────────────────────
  [AuditAction.STOCK_VERIFICATION_CREATE]: (ctx) => `Created stock verification run ${idOf(ctx)}.`,
  [AuditAction.STOCK_VERIFICATION_STARTED]: (ctx) =>
    `Started stock verification${val(ctx.meta, "locationNo") ? ` for location ${val(ctx.meta, "locationNo")}` : ""}.`,
  [AuditAction.STOCK_VERIFICATION_COMPLETED]: (ctx) =>
    `Completed stock verification${val(ctx.meta, "locationNo") ? ` for location ${val(ctx.meta, "locationNo")}` : ""}.`,
  [AuditAction.STOCK_VERIFICATION_RUN]: (ctx) =>
    `Ran stock verification${val(ctx.meta, "locationNo") ? ` for location ${val(ctx.meta, "locationNo")}` : ""}.`,
  [AuditAction.STOCK_VERIFICATION_SYNC]: (ctx) =>
    `Synced ${val(ctx.meta, "itemCount") || ""} stock verification records from device ${val(ctx.meta, "deviceId") || "?"}.`,
  [AuditAction.STOCK_VERIFICATION_LIST]: "Listed stock verification runs.",
  [AuditAction.STOCK_VERIFICATION_READ]: (ctx) => `Viewed stock verification run ${idOf(ctx)}.`,

  // ── Variance ───────────────────────────────────────────────
  [AuditAction.VARIANCE_DISPOSITION]: (ctx) =>
    `Recorded disposition "${val(ctx.meta, "disposition")}" for variance ${idOf(ctx)}.`,
  [AuditAction.VARIANCE_RESOLVE]: (ctx) =>
    `Resolved variance ${idOf(ctx)}${val(ctx.meta, "disposition") ? ` with disposition "${val(ctx.meta, "disposition")}"` : ""}.`,
  [AuditAction.VARIANCE_LIST]: "Listed variances.",
  [AuditAction.VARIANCE_READ]: (ctx) => `Viewed variance ${idOf(ctx)}.`,
};

const DEFAULT_TEMPLATE: Template = (ctx) =>
  `${ctx.resourceLabel}${ctx.resourceId ? ` ${ctx.resourceId}` : ""} — ${ctx.action}.`;

function interpolatePlaceholder(key: string, ctx: DescriptionContext): string {
  if (key === "resourceLabel") return ctx.resourceLabel;
  if (key === "resourceId") return ctx.resourceId ?? "";
  if (key === "screenLabel") return ctx.screenLabel;
  // prettify known snake_case values for readability
  if (key === "reason" || key === "status") return prettify(ctx.meta[key]);
  return val(ctx.meta, key);
}

function finalize(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  const cleaned = collapsed
    .replace(/[,;:]+\s*$/, "")
    .replace(/\s+([.,;])/g, "$1")
    .replace(/\s+:/g, ":")
    .trim();
  return cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
}

export function buildDescription(ctx: DescriptionContext): string {
  const template = DESCRIPTIONS[ctx.action as AuditAction] ?? DEFAULT_TEMPLATE;
  const raw = typeof template === "function" ? template(ctx) : template;

  return finalize(
    raw.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_match: string, key: string) =>
      interpolatePlaceholder(key, ctx),
    ),
  );
}
