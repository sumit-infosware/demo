import { AlertSeverity, AlertType } from "../enums/alert.enum.js";

/**
 * Standard recipient role lists for alerts.
 */
export const ALERT_RECIPIENT_ROLES = {
  DEFAULT: "transit_manager,holding_manager",
  TRANSIT_AND_HOLDING: "transit_manager,holding_manager",
  SECURITY_AND_MANAGERS: "SECURITY,TRANSIT_MANAGER,HOLDING_MANAGER,ADMIN",
  ADMIN: "admin",
} as const;

export const DEFAULT_ALERT_SEVERITY = AlertSeverity.WARNING;
export const DEFAULT_ALERT_TYPE = AlertType.GENERAL;
