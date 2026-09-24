import { z } from "zod";
import { StockVerificationTrigger } from "../enums/status.enum.js";

/** POST /ifs/stock-verification/sync — handheld re-dock stock verification. */
export const stockVerificationSyncSchema = z.object({
  deviceId: z.string().min(1),
  items: z
    .array(
      z.object({
        binRfidEpc: z.string().min(1),
        ifsLocationNo: z.string().min(1),
        warehouse: z.string().optional(),
        scannedEpcs: z.array(z.string().min(1)).min(1).max(500),
        scannedAt: z.string().datetime().optional(),
        offline: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(500),
});

/** POST /ifs/stock-verification/run — admin-triggered manual reconciliation. */
export const stockVerificationRunSchema = z.object({
  locationNo: z.string().min(1),
});

/** GET /ifs/stock-verification/runs — paginated run history. */
export const stockVerificationRunsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  trigger: z
    .enum([
      StockVerificationTrigger.DEVICE,
      StockVerificationTrigger.MANUAL,
      StockVerificationTrigger.SCHEDULED,
    ])
    .optional(),
  locationNo: z.string().optional(),
});

/** GET /ifs/stock-verification/runs/:id — single run detail. */
export const stockVerificationRunParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
