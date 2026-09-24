import { z } from "zod";
import { BinningPlanStatus } from "../enums/status.enum.js";

export const binningPlanIdParamSchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
});

export const binningPlanQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([BinningPlanStatus.DRAFT, BinningPlanStatus.ACTIVE, BinningPlanStatus.ARCHIVED])
    .optional(),
});

export const getLatestPlanQuerySchema = z.object({});

export const downloadPlanSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
  expiresInHours: z.coerce.number().int().min(1).max(168).optional().default(24), // Max 7 days
});

export const downloadPlanParamSchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
});

// ===== RF-37 (import) / Plan lifecycle Schemas =====

export const importBinningPlanSchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
  version: z.coerce.number().int().min(1).optional(),
  notes: z.string().max(500).nullable().optional(),
  lines: z
    .array(
      z.object({
        lineNo: z.number().int().min(1).optional(),
        itemCode: z.string().min(1, "Item code is required"),
        expectedQty: z.coerce.number().positive("Expected qty must be positive"),
        binCode: z.string().min(1, "Bin code is required"),
        notes: z.string().max(500).nullable().optional(),
      }),
    )
    .min(1, "At least one line is required")
    .max(500, "Maximum 500 lines allowed"),
});

export const activatePlanParamSchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
});

// ===== RF-39: Find Location Schemas =====

export const findLocationQuerySchema = z
  .object({
    binId: z.string().optional(),
    tagId: z.string().optional(),
    planId: z.string().optional(),
    lineNo: z.coerce.number().int().min(1).optional(),
  })
  .refine(
    (data) => {
      const hasBin = Boolean(data.binId);
      const hasTag = Boolean(data.tagId);
      const hasPlanLine = Boolean(data.planId && data.lineNo !== undefined);
      return hasBin || hasTag || hasPlanLine;
    },
    {
      message: "Provide either binId, tagId, or (planId and lineNo) to find location",
    },
  );

export const locationTagIdParamSchema = z.object({
  tagId: z.string().min(1, "Location Tag ID is required"),
});

export const planLineLocationParamSchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
  lineNo: z.coerce.number().int().min(1, "Line number must be a positive integer"),
});

// ===== RF-40: Place & Verify Schemas =====

export const placeAndVerifySchema = z
  .object({
    packetEpc: z.string().min(1).optional(),
    packetTagId: z.string().regex(/^\d+$/, "Must be a numeric id").optional(),
    locationTagId: z.string().min(1).optional(),
    binId: z.string().min(1).optional(),
    planId: z.string().min(1).optional(),
    deviceId: z.string().min(1, "Device ID is required"),
    isOffline: z.boolean().optional().default(false),
    confirmedAt: z.coerce.date().optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => Boolean(data.packetEpc || data.packetTagId), {
    message: "Either packetEpc or packetTagId must be provided",
  })
  .refine((data) => Boolean(data.locationTagId || data.binId), {
    message: "Either locationTagId or binId must be provided",
  });

// ===== RF-42: Sync on Re-dock Schemas =====

export const syncItemSchema = z
  .object({
    packetEpc: z.string().min(1).optional(),
    packetTagId: z.string().min(1).optional(),
    binId: z.string().min(1).optional(),
    locationTagId: z.string().min(1).optional(),
    confirmedAt: z.coerce.date().optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => Boolean(data.packetEpc || data.packetTagId), {
    message: "Each confirmation must provide either packetEpc or packetTagId",
  })
  .refine((data) => Boolean(data.locationTagId || data.binId), {
    message: "Each confirmation must provide either locationTagId or binId",
  });

export const syncRedockSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
  planId: z.string().min(1).optional(),
  planVersion: z.number().int().min(1).optional(),
  confirmations: z
    .array(syncItemSchema)
    .min(1, "At least one confirmation item must be provided")
    .max(500, "Maximum 500 confirmations allowed per batch"),
});

// ===== RF-41: Location ↔ RFID mapping Schemas (hierarchy-native) =====

export const registerLocationSchema = z.object({
  rfid: z.string().min(1, "RFID is required"),
  binCode: z.string().min(1, "Bin code is required"),
});

export const unregisterLocationSchema = z.object({
  rfid: z.string().min(1, "RFID is required"),
});

export const listLocationsQuerySchema = z.object({
  warehouse: z.string().optional(),
  binCode: z.string().optional(),
  rfid: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
