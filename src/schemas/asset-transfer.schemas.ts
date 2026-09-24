import { z } from "zod";

export const transferIdParamSchema = z.object({
  transferId: z.string().min(1, "Transfer ID is required"),
});

export const epcParamSchema = z.object({
  epc: z.string().regex(/^[0-9A-Fa-f]{8,}$/, "Invalid EPC"),
});
