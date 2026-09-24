/**
 * Maps the raw HTTP "METHOD baseUrl path" string stored on an AuditLog row
 * to a stable business screen code + label (e.g. "POST /api/v1/tags/generate"
 * -> { code: "TAGGING", label: "Tagging" }).
 */

export interface ScreenInfo {
  code: string;
  label: string;
}

interface ScreenRule {
  /** Substring matched (lower-cased) against the stored screen string. */
  match: string;
  code: string;
  label: string;
}

const SCREEN_RULES: readonly ScreenRule[] = [
  { match: "/auth/", code: "AUTHENTICATION", label: "Authentication" },
  { match: "/count-check", code: "COUNT_CHECK", label: "Count Check" },
  { match: "/line-count", code: "LINE_COUNT", label: "Line Count" },
  { match: "/master-data", code: "MASTER_DATA", label: "Master Data" },
  { match: "/stock-verification", code: "STOCK_VERIFICATION", label: "Stock Verification" },
  { match: "/gate-verify", code: "GATE_VERIFY", label: "Gate Verify" },
  { match: "/baseline", code: "BASELINE", label: "Baseline" },
  { match: "/put-away", code: "PUT_AWAY", label: "Put Away" },
  { match: "/variance", code: "VARIANCE", label: "Variance" },
  { match: "/devices", code: "DEVICES", label: "Devices" },
  { match: "/holding", code: "HOLDING", label: "Holding" },
  { match: "/transit", code: "TRANSIT", label: "Transit" },
  { match: "/binning", code: "BINNING", label: "Binning" },
  { match: "/alerts", code: "ALERTS", label: "Alerts" },
  { match: "/users", code: "USERS", label: "User Management" },
  { match: "/rbac", code: "RBAC", label: "Roles & Permissions" },
  { match: "/tags", code: "TAGGING", label: "Tagging" },
  { match: "/rr", code: "RECEIVING", label: "Receiving Report" },
  { match: "/audit", code: "AUDIT", label: "Audit" },
];

const UNKNOWN: ScreenInfo = { code: "UNKNOWN", label: "Unknown" };

export function getScreenInfo(raw: string | null | undefined): ScreenInfo {
  if (!raw) return UNKNOWN;

  const key = raw.toLowerCase();
  const rule = SCREEN_RULES.find((r) => key.includes(r.match));
  if (rule) return { code: rule.code, label: rule.label };

  return {
    code:
      key
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toUpperCase() || "UNKNOWN",
    label: raw,
  };
}

/**
 * Translates a user-supplied screen filter (as displayed: a business label like
 * "Tagging", a code like "TAGGING", or a raw "METHOD baseUrl path" string) into
 * the stored path substrings that should be matched. Raw path/method strings are
 * passed through unchanged so substring matching still works.
 */
export function getScreenSearchTerms(input: string): string[] {
  const q = input.trim().toLowerCase();
  if (!q) return [];

  // Raw HTTP-method + path style input, keep as a plain substring.
  if (q.includes("/")) return [q];

  const matchedRules = SCREEN_RULES.filter(
    (rule) => rule.code.toLowerCase().includes(q) || rule.label.toLowerCase().includes(q),
  );
  return [...matchedRules.map((rule) => rule.match), q];
}
