/**
 * Central registry of system role names.
 *
 * Single source of truth for role names used across the application.
 * These names map directly to the `Role.name` column in the database
 * (which is unique). The seed and RBAC logic reference these constants
 * rather than hardcoding strings.
 */
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MANAGER: "manager",
  OPERATOR: "operator",
  STORE_MANAGER: "store_manager",
  // Recipients of transit-exit anomaly alerts (RF-25). Resolved by role name
  // so alerts are never addressed to hardcoded user IDs.
  TRANSIT_MANAGER: "transit_manager",
  HOLDING_MANAGER: "holding_manager",
  // Security audience for anti-theft alarms (transit-door / gate unauthorized exits).
  SECURITY: "security",
} as const;

/** Type representing every known role name. */
export type RoleName = (typeof ROLES)[keyof typeof ROLES];
