import type { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger.js";
import { AuthenticationError, AuthorizationError } from "../errors/errors.js";
import { devicesRepository } from "../repositories/devices.repository.js";
import { DEVICE_ACTOR_EMPTY_EMAIL, DEVICE_ACTOR_EMPTY_USER } from "../types/common.js";

/** Header carrying the physical device id (sent by the C#/handheld readers). */
export const DEVICE_ID_HEADER = "x-device-id";

/**
 * Device authentication middleware (decision: transit-exit device endpoints).
 *
 * Device-facing readers are NOT JWT users — they authenticate by a registered
 * `DeviceRegistry` row. This middleware resolves the `X-Device-Id` header
 * against the registry, requires the device to be active, optionally restricts
 * the allowed device types, and attaches a `DeviceActor` to `req.deviceActor`
 * so downstream controllers/services can act on the device's behalf.
 *
 * Signature-compatible with the human flows: `DeviceActor.userId`/`email` are
 * kept empty so services that share the `{ userId, email }` actor shape can be
 * reused unchanged — they map an empty userId to null for @db.Uuid columns.
 */
export function authenticateDevice(
  allowDeviceTypes?: string[],
): (req: Request, _res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    void (async () => {
      try {
        const deviceId = String(req.header(DEVICE_ID_HEADER) || "").trim();
        if (!deviceId) {
          throw new AuthenticationError(`Missing ${DEVICE_ID_HEADER} header`);
        }

        const device = await devicesRepository.findByDeviceId(deviceId);
        if (!device) {
          throw new AuthenticationError(`Device ${deviceId} is not registered`);
        }
        if (!device.isActive) {
          throw new AuthorizationError(`Device ${deviceId} is deactivated`);
        }
        if (
          allowDeviceTypes &&
          allowDeviceTypes.length > 0 &&
          !allowDeviceTypes.includes(device.deviceType)
        ) {
          throw new AuthorizationError(
            `Device ${deviceId} is not an allowed reader for this operation (type: ${device.deviceType})`,
          );
        }

        // Best-effort last-seen heartbeat (never fails the request).
        await devicesRepository.updateLastSeen(deviceId).catch(() => undefined);

        req.deviceActor = {
          userId: DEVICE_ACTOR_EMPTY_USER,
          email: DEVICE_ACTOR_EMPTY_EMAIL,
          deviceId: device.deviceId,
          deviceType: device.deviceType,
        };

        logger.info({ deviceId, deviceType: device.deviceType }, "device:authenticated");
        next();
      } catch (err) {
        next(err);
      }
    })();
  };
}
