import { z } from "zod";
import { SITS_QC_STATUS } from "../ifs/status/ifs-status.js";

export const listRrsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const rrIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "Must be a valid RR id"),
});

export const rrLineIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "Must be a valid RR line id"),
});

export const listRrLinesQuerySchema = z.object({
  rrId: z.string().regex(/^\d+$/).optional(),
  qcStatus: z
    .enum([SITS_QC_STATUS.PASSED, SITS_QC_STATUS.FAILED, SITS_QC_STATUS.PENDING])
    .optional(),
  taggableOnly: z.coerce.boolean().optional(),
});
