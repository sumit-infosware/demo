import { z } from "zod";

/**
 * Validation schemas for the Transit Exit — Charge Approval module (RF-22).
 * Follow the same Zod conventions as transit.schemas.ts (RF-21).
 */

/**
 * POST /transit-exit/check-charge — check charge approval for a set of EPCs
 * (obtained from RF-21) at the transit exit.
 */
export const transitExitChargeCheckSchema = z.object({
  epcs: z
    .array(z.string().min(1, "EPC must not be empty").max(64, "EPC is too long"))
    .min(1, "At least one EPC must be provided"),
});

/**
 * POST /transit-exit/select-approved — select the approved subset for dispatch
 * (RF-23). Reuses the same EPC array shape as the RF-22 charge-check schema.
 */
export const transitExitSelectApprovedSchema = z.object({
  epcs: z
    .array(z.string().min(1, "EPC must not be empty").max(64, "EPC is too long"))
    .min(1, "At least one EPC must be provided"),
});

/**
 * POST /transit-exit/alert — raise a not-approved alert (RF-25).
 *
 * The operator supplies a free-text reason and the EPCs that were NOT approved.
 * Recipients are resolved server-side from the manager roles, so no recipient
 * list is accepted from the client (prevents spoofing/abuse).
 */
export const transitExitAlertSchema = z.object({
  ref: z.string().max(120, "Reference is too long").optional().nullable(),
  reason: z.string().trim().min(1, "A reason is required").max(1000, "Reason is too long"),
  epcs: z
    .array(z.string().min(1, "EPC must not be empty").max(64, "EPC is too long"))
    .min(1, "At least one EPC must be provided"),
});

/**
 * POST /transit-exit/generate-transfer — generate Transfer ID for approved EPCs (RF-24).
 *
 * Validates the approved EPC subset from RF-23, generates a unique Transfer ID,
 * persists Transfer and TransferLine records, creates Redis mappings, and logs the event.
 */
export const transitExitGenerateTransferSchema = z.object({
  epcs: z
    .array(z.string().min(1, "EPC must not be empty").max(64, "EPC is too long"))
    .min(1, "At least one EPC must be provided"),
  destination: z.string().min(1, "Destination is required"), // new end point for RF-24, required for Transfer creation
});
