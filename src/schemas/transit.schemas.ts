import { z } from "zod";

/**
 * Validation schemas for the Transit module (Phase 3 — Transit Exit).
 * Follow the same Zod conventions as tags.schemas.ts.
 */

/**
 * POST /transit/read — bulk EPC read at the transit exit (RF-21).
 * The EPC set is supplied by the FX9600 4-port RFID reader integration.
 * `transferId` is optional: when present the read is compared against the
 * Transfer's approved line EPCs for a completeness/rescan answer.
 */
export const transitReadSchema = z.object({
  readerId: z.string().min(1, "Reader id must not be empty").max(64).optional(),
  port: z.coerce.number().int("Port must be an integer").min(1).max(4).optional(),
  transferId: z.string().min(1, "Transfer id must not be empty").max(40).optional(),
  epcs: z
    .array(z.string().min(1, "EPC must not be empty").max(64, "EPC is too long"))
    .min(1, "At least one EPC must be provided"),
});
