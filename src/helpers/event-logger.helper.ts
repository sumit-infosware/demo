import { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma } from "../config/clients.js";
import { logger } from "../config/logger.js";

/**
 * Tag-level event logger (RF-43).
 *
 * Appends to the `event_log` table for every lifecycle event on a packet
 * (tagged, commissioned, label_printed, transit_out, holding_in, count_checked,
 * stored, etc.). Failures are swallowed and logged — event logging must never
 * break the primary business operation (same policy as writeAudit).
 */

export interface EventLogInput {
  ref: string;
  eventType: string;
  phase: string;
  device?: string;
  appUser?: string;
  payload?: Record<string, unknown>;
}

export const eventLogger = {
  log: async (input: EventLogInput): Promise<void> => {
    try {
      await prisma.eventLog.create({
        data: {
          ref: input.ref,
          eventType: input.eventType,
          phase: input.phase,
          device: input.device ?? null,
          appUser: input.appUser ?? null,
          // Prisma's Json? column needs Prisma.JsonNull for explicit null,
          // not plain `null` (that's a TS-level type restriction).
          payload:
            input.payload !== undefined
              ? (input.payload as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        },
      });
    } catch (err) {
      logger.error(
        { err, ref: input.ref, eventType: input.eventType },
        "event_log: failed to persist event",
      );
    }
  },
};
