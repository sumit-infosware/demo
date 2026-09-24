import { z } from "zod";
import { AlertSeverity } from "../enums/alert.enum.js";

export const listAlertsQuerySchema = z.object({
  type: z.string().optional(),
  severity: z.enum([AlertSeverity.INFO, AlertSeverity.WARNING, AlertSeverity.CRITICAL]).optional(),
  status: z.string().optional(),
  unreadOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const alertIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "Must be a numeric id"),
});
