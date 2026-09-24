import { z } from "zod";
import { VarianceDisposition } from "../enums/status.enum.js";

export const listVariancesQuerySchema = z.object({
  context: z.enum(["BASELINE", "COUNT_CHECK", "HOLDING_RECEIVE"]).optional(),
  disposition: z
    .enum([
      VarianceDisposition.PENDING,
      VarianceDisposition.ACCEPTED,
      VarianceDisposition.REJECTED,
      VarianceDisposition.REWORK,
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const varianceIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "Must be a numeric id"),
});

export const resolveVarianceSchema = z.object({
  disposition: z.enum([
    VarianceDisposition.ACCEPTED,
    VarianceDisposition.REJECTED,
    VarianceDisposition.REWORK,
  ]),
  notes: z.string().max(1000).optional(),
});
