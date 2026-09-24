import { z } from "zod";

/**
 * Validation schemas for the Transit Door Read module (RF-26, RF-27, RF-28).
 * Follows the same Zod conventions as transit.schemas.ts.
 */

/**
 * POST /transit-door/read — bulk EPC read at the transit door.
 * The EPC set is supplied by the gate RFID reader.
 */
export const transitDoorReadSchema = z.object({
  deviceId: z.string().min(1, "Device ID must not be empty").max(64, "Device ID is too long"),
  epcs: z
    .array(z.string().min(1, "EPC must not be empty").max(64, "EPC is too long"))
    .min(1, "At least one EPC must be provided"),
});
