import type { AuditContext } from "../audit/audit.types.js";
import { redis } from "../config/clients.js";
import { logger } from "../config/logger.js";
import { DEVICE_TYPES } from "../constants/device-types.js";
import { ROLES } from "../constants/roles.js";
import { AlertSeverity, AlertType } from "../enums/alert.enum.js";
import { EventType } from "../enums/event.enum.js";
import { eventLogger } from "../helpers/event-logger.helper.js";
import { assessTransitAuthorization } from "../helpers/transfer-authorization.helper.js";
import { alertRepository } from "../repositories/alert.repository.js";
import { devicesRepository } from "../repositories/devices.repository.js";
import { tagRepository } from "../repositories/tags.repository.js";
import type {
  TransitDoorEpcResult,
  TransitDoorEpcStatus,
  TransitDoorReadInput,
  TransitDoorReadResult,
} from "../types/transit-door.types.js";

/**
 * Transit Door Read module (RF-26, RF-27, RF-28) — anti-theft.
 *
 * Gate reader at the transit door reads departing RFID tags.
 *
 * Per EPC:
 *   • tagType === "BARCODE_ONLY"  → EXEMPT. Barcode-only packets carry no RFID
 *     inlay, so a missing TID is expected and NOT an alarm. The exemption is an
 *     explicit tag-type check — an UNKNOWN EPC is never auto-exempted.
 *   • otherwise: tid:{epc} exists in Redis → AUTHORIZED.
 *   • otherwise → UNAUTHORIZED: CRITICAL alert addressed to
 *     SECURITY + transit_manager/holding_manager (per existing rules) + EventLog.
 *
 * Duplicate alarm prevention: checks for an existing UNAUTHORIZED alert for the
 * same EPC within a 5-minute window to avoid flooding from reader rescans.
 */
export const transitDoorService = {
  async readEpcs(
    input: TransitDoorReadInput,
    actor: { userId: string; email: string },
    auditCtx?: AuditContext,
  ): Promise<TransitDoorReadResult> {
    const { deviceId, epcs } = input;

    // 1. Validate device exists and is active
    const device = await devicesRepository.findByDeviceId(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }
    if (!device.isActive) {
      throw new Error(`Device ${deviceId} is deactivated`);
    }
    // Allow both GATE and FIXED RFID readers at transit doors
    const allowedTypes = [
      DEVICE_TYPES.RFID_READER_GATE,
      DEVICE_TYPES.RFID_READER_FIXED,
      DEVICE_TYPES.TRANSIT_DOOR_READER,
    ];
    if (!allowedTypes.includes(device.deviceType as (typeof allowedTypes)[number])) {
      throw new Error(
        `Device ${deviceId} is not a valid transit door reader (type: ${device.deviceType})`,
      );
    }

    // 2. De-duplicate EPCs while preserving first-seen order
    const seen = new Set<string>();
    const uniqueEpcs: string[] = [];
    for (const epc of epcs) {
      if (!seen.has(epc)) {
        seen.add(epc);
        uniqueEpcs.push(epc);
      }
    }

    // 3. Resolve tag types ONCE so barcode-only exemption is an explicit check
    //    (unknown EPCs are treated as RFID-enabled — the exemption can never
    //    mask a missing RFID inlay).
    const foundTags = await tagRepository.findByEpcs(uniqueEpcs);
    const tagTypeByEpc = new Map(foundTags.map((t) => [t.epc, t.tagType]));

    // 4. Process each EPC: barcode exemption then Redis tid:{epc} check
    const decision = await assessTransitAuthorization(uniqueEpcs);

    const epcResults: TransitDoorEpcResult[] = [];
    let authorizedCount = 0;
    let unauthorizedCount = 0;
    let exemptCount = 0;

    for (const epc of uniqueEpcs) {
      const redisKey = `tid:${epc}`;
      const verdict = decision.get(epc);
      const hasTid = verdict?.transferId !== null;
      const status: TransitDoorEpcStatus = verdict?.status ?? "UNAUTHORIZED";
      // let hasTid = false;
      let redisError = false;

      // Barcode-only tag: exemption is an explicit tagType check, never a guess
      // based on a missing TID.
      if (tagTypeByEpc.get(epc) === "BARCODE_ONLY") {
        exemptCount++;
        epcResults.push({ epc, hasTid: false, status: "EXEMPT", reason: "barcode-only tag" });

        await eventLogger
          .log({
            ref: epc,
            eventType: EventType.TRANSIT_DOOR_READ,
            phase: "3-Transit",
            device: deviceId,
            appUser: actor.userId || undefined,
            payload: {
              status: "EXEMPT",
              hasTid: false,
              reason: "barcode-only tag",
              deviceId,
              actorId: auditCtx?.actorId,
              actorEmail: auditCtx?.actorEmail,
              requestId: auditCtx?.requestId,
            },
          })
          .catch(() => undefined);

        continue;
      }

      // RFID-enabled tag: check Redis with fail-open behavior.
      try {
        const tid = await redis.get(redisKey);
        hasTid = tid !== null && tid !== undefined;
      } catch (err) {
        logger.error(
          { err, epc, key: redisKey },
          "transit-door: redis GET failed, treating as no TID (fail-open)",
        );
        redisError = true;
      }

      const status: TransitDoorEpcStatus = hasTid ? "AUTHORIZED" : "UNAUTHORIZED";

      if (hasTid) {
        authorizedCount++;
      } else {
        unauthorizedCount++;

        // Anti-theft alarm (RF-28): CRITICAL severity for security.
        const alertRef = `transit-door:${epc}`;
        let shouldCreateAlert = true;

        try {
          const { alertsRepository } = await import("../repositories/alerts.repository.js");
          const recentAlert = await alertsRepository.findRecentByRef(
            AlertType.TRANSIT_DOOR_UNAUTHORIZED,
            alertRef,
            5,
          );
          if (recentAlert) {
            logger.info(
              { epc, alertRef },
              "transit-door: skipping duplicate alert (recent alert exists)",
            );
            shouldCreateAlert = false;
          }
        } catch (err) {
          logger.error(
            { err, epc },
            "transit-door: failed to check recent alerts, proceeding to create",
          );
        }

        if (shouldCreateAlert) {
          try {
            const alert = await alertRepository.create({
              alertType: AlertType.TRANSIT_DOOR_UNAUTHORIZED,
              severity: AlertSeverity.CRITICAL,
              ref: alertRef,
              message: `Unauthorized exit attempt: EPC ${epc} has no TID at transit door ${deviceId}`,
              recipientRoles: [ROLES.SECURITY, ROLES.TRANSIT_MANAGER, ROLES.HOLDING_MANAGER].join(
                ",",
              ),
              payload: {
                deviceId,
                epc,
                redisError,
                raisedBy: { userId: actor.userId || null, email: actor.email },
              },
            });

            await eventLogger.log({
              ref: epc,
              eventType: EventType.GATE_ALARM,
              phase: "3-Transit",
              device: deviceId,
              appUser: actor.userId || undefined,
              payload: {
                status: "UNAUTHORIZED",
                alertId: alert.id.toString(),
                deviceId,
                epc,
                redisError,
                actorId: auditCtx?.actorId,
                actorEmail: auditCtx?.actorEmail,
                requestId: auditCtx?.requestId,
              },
            });

            logger.info(
              { epc, alertId: alert.id },
              "transit-door: unauthorized alert and event log created",
            );
          } catch (err) {
            logger.error(
              { err, epc },
              "transit-door: failed to create alert/event log for unauthorized EPC",
            );
          }
        }
      }

      epcResults.push({ epc, hasTid, status });

      // Event logging for every EPC read (best-effort, like transit service)
      await eventLogger
        .log({
          ref: epc,
          eventType: EventType.TRANSIT_DOOR_READ,
          phase: "3-Transit",
          device: deviceId,
          appUser: actor.userId || undefined,
          payload: {
            status,
            hasTid,
            deviceId,
            redisError,
            actorId: auditCtx?.actorId,
            actorEmail: auditCtx?.actorEmail,
            requestId: auditCtx?.requestId,
          },
        })
        .catch(() => undefined);
    }

    return {
      totalTags: epcs.length,
      authorized: authorizedCount,
      unauthorized: unauthorizedCount,
      exempt: exemptCount,
      results: epcResults,
    };
  },
};
