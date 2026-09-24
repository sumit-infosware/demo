import type { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma } from "../config/clients.js";
import { ALERT_RECIPIENT_ROLES } from "../constants/alert.constants.js";
import { AlertChannel, AlertSeverity, AlertStatus, AlertType } from "../enums/alert.enum.js";

// Export constant used by Sumit's Transit Exit logic
export const ALERT_TYPE_TRANSIT_EXIT_NOT_APPROVED = AlertType.TRANSIT_EXIT_NOT_APPROVED;

const alertSelect = {
  id: true,
  type: true,
  alertType: true,
  severity: true,
  message: true,
  recipientRoles: true,
  channel: true,
  sourceFn: true,
  ref: true,
  meta: true,
  payload: true,
  status: true,
  createdAt: true,
  acknowledgedBy: true,
  acknowledgedAt: true,
} as const;

export const alertsRepository = {
  /**
   * Universal alert creation method.
   * Handles both Transit Exit alerts (Sumit) and Baseline/Holding alerts (Divyanshu).
   */
  create: (data: {
    type?: string;
    alertType?: string;
    severity?: string;
    message: string;
    recipientRoles?: string;
    channel?: string;
    sourceFn?: string;
    ref?: string | null;
    meta?: Prisma.InputJsonValue;
    payload?: Prisma.InputJsonValue;
  }) => {
    const typeValue = data.type ?? data.alertType ?? AlertType.GENERAL;
    const alertTypeValue = data.alertType ?? data.type ?? AlertType.GENERAL;

    return prisma.alert.create({
      data: {
        type: typeValue,
        alertType: alertTypeValue,
        severity: data.severity ?? AlertSeverity.WARNING,
        message: data.message,
        recipientRoles: data.recipientRoles ?? ALERT_RECIPIENT_ROLES.DEFAULT,
        channel: data.channel ?? AlertChannel.IN_APP,
        sourceFn: data.sourceFn ?? null,
        ref: data.ref ?? null,
        meta: data.meta ?? undefined,
        payload: data.payload ?? undefined,
      },
      select: alertSelect,
    });
  },

  findById: (id: bigint) =>
    prisma.alert.findUnique({
      where: { id },
      select: alertSelect,
    }),

  /** Returns all alerts for a given reference (Sumit's method for audit trail). */
  listByRef: (ref: string) =>
    prisma.alert.findMany({
      where: { ref },
      orderBy: { createdAt: "desc" },
      select: alertSelect,
    }),

  list: async (filters: {
    type?: string; // filters by alertType (not type column) for transit-door use case
    severity?: string;
    status?: string;
    unreadOnly?: boolean;
    recipientRoles?: string[];
    skip: number;
    take: number;
  }) => {
    const where: Prisma.AlertWhereInput = {
      ...(filters.type && { alertType: filters.type }),
      ...(filters.severity && { severity: filters.severity }),
      ...(filters.status && { status: filters.status }),
      ...(filters.unreadOnly && { acknowledgedAt: null }),
      ...(filters.recipientRoles?.length && {
        OR: filters.recipientRoles.map((role) => ({ recipientRoles: { contains: role } })),
      }),
    };
    const [items, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        skip: filters.skip,
        take: filters.take,
        orderBy: { createdAt: "desc" },
        select: alertSelect,
      }),
      prisma.alert.count({ where }),
    ]);
    return { items, total };
  },

  /** Idempotently acknowledge an alert. If already acknowledged, returns existing alert without changes. */
  acknowledge: async (id: bigint, userId: string) => {
    const existing = await prisma.alert.findUnique({
      where: { id },
      select: { ...alertSelect, acknowledgedAt: true },
    });

    if (!existing) {
      return null;
    }

    // Already acknowledged - return existing without changes (idempotent)
    if (existing.acknowledgedAt) {
      return existing;
    }

    // Not yet acknowledged - perform update
    return prisma.alert.update({
      where: { id },
      data: {
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        status: AlertStatus.ACKNOWLEDGED,
      },
      select: alertSelect,
    });
  },

  findRecentByRef: (type: string, ref: string, sinceMinutes: number) => {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
    return prisma.alert.findFirst({
      where: {
        type,
        ref,
        createdAt: { gte: since },
      },
      select: { id: true, createdAt: true },
    });
  },
};
