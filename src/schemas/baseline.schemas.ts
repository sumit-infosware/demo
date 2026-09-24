import { z } from "zod";
import { COUNTING_METHODS } from "../constants/device-types.js";

export const captureBaselineSchema = z
  .object({
    packetTagId: z.string().regex(/^\d+$/, "Must be a numeric id"),
    method: z.enum([COUNTING_METHODS.MANUAL, COUNTING_METHODS.WEIGHT, COUNTING_METHODS.REEL]),
    manualCount: z.number().nonnegative().optional().nullable(),
    unitWeight: z.number().nonnegative().optional().nullable(), // Allow null/0
    totalWeight: z.number().nonnegative().optional().nullable(), // Allow null/0
    reelReading: z.number().nonnegative().optional().nullable(), // Allow null/0
    deviceId: z.string().max(100).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.method === COUNTING_METHODS.MANUAL)
        return data.manualCount !== undefined && data.manualCount !== null;
      if (data.method === COUNTING_METHODS.WEIGHT)
        return (
          data.unitWeight !== undefined &&
          data.unitWeight !== null &&
          data.totalWeight !== undefined &&
          data.totalWeight !== null
        );
      if (data.method === COUNTING_METHODS.REEL)
        return data.reelReading !== undefined && data.reelReading !== null;
      return false;
    },
    {
      message: "Missing required fields for the selected method",
    },
  );

export const listBaselinesQuerySchema = z.object({
  method: z
    .enum([COUNTING_METHODS.MANUAL, COUNTING_METHODS.WEIGHT, COUNTING_METHODS.REEL])
    .optional(),
  varianceOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const packetTagIdParamSchema = z.object({
  packetTagId: z.string().regex(/^\d+$/, "Must be a numeric id"),
});
