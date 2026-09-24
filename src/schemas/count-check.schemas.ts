import { z } from "zod";
import { COUNTING_METHODS } from "../constants/device-types.js";

export const captureCountCheckSchema = z.object({
  packetTagId: z.string().regex(/^\d+$/, "Must be a numeric id"),
  method: z
    .enum([COUNTING_METHODS.MANUAL, COUNTING_METHODS.WEIGHT, COUNTING_METHODS.REEL])
    .optional(),
  manualCount: z.number().nonnegative().optional(),
  unitWeight: z.number().positive().optional(),
  totalWeight: z.number().nonnegative().optional(),
  reelReading: z.number().nonnegative().optional(),
  deviceId: z.string().max(100).optional(),
  managerOverride: z.boolean().optional(),
  overrideNotes: z.string().max(1000).optional(),
});

export const listCountChecksQuerySchema = z.object({
  mismatchesOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
