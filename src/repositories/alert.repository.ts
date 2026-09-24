import type { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma } from "../config/clients.js";
import { ROLES } from "../constants/roles.js";
import { AlertChannel, AlertSeverity, AlertStatus, AlertType } from "../enums/alert.enum.js";

/**
 * Alert data access (RF-25 — transit-exit not-approved alert).
 *
 * Reuses the existing generic `Alert` model rather than introducing a new
 * table. The model is intentionally generic (alertType / severity / ref /
 * message / status / payload JSON), so:
 *   • `alertType`  → "TRANSIT_EXIT_NOT_APPROVED"
 *   • `severity`   → "WARNING"
 *   • `ref`        → the transit-exit / transfer reference (if known)
 *   • `message`    → the free-text reason supplied by the user
 *   • `payload`    → JSON holding the raising user + the not-approved EPCs
 *
 * Recipients are NOT stored here by default; they are resolved separately via
 * `rbacRepository.findUsersByRoleName` so the alert is never tied to a
 * hardcoded user list. A `recipientRoles` override is supported for alerting
 * flows that carry an explicit audience (e.g. the transit-door anti-theft
 * alarm addressed to SECURITY + the managers).
 */
export const ALERT_TYPE_TRANSIT_EXIT_NOT_APPROVED = AlertType.TRANSIT_EXIT_NOT_APPROVED;

export const alertRepository = {
  /** Creates an alert record using the generic Alert model. */
  create: (data: {
    alertType: string;
    severity?: string;
    ref?: string | null;
    message: string;
    recipientRoles?: string;
    payload?: unknown;
  }) =>
    prisma.alert.create({
      data: {
        alertType: data.alertType,
        type: data.alertType, // Required field - same as alertType for compatibility
        severity: data.severity ?? AlertSeverity.WARNING,
        ref: data.ref ?? null,
        message: data.message,
        status: AlertStatus.OPEN,
        recipientRoles: data.recipientRoles ?? `${ROLES.TRANSIT_MANAGER},${ROLES.HOLDING_MANAGER}`, // Required field
        channel: AlertChannel.IN_APP, // Required field
        // JSON column — the generic model stores the raising user + EPCs here.
        payload: data.payload as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        alertType: true,
        severity: true,
        ref: true,
        message: true,
        status: true,
        createdAt: true,
      },
    }),

  /** Returns all alerts for a given reference (audit trail). */
  listByRef: (ref: string) =>
    prisma.alert.findMany({
      where: { ref },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        alertType: true,
        severity: true,
        ref: true,
        message: true,
        status: true,
        createdAt: true,
      },
    }),
};
