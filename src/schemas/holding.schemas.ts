import { z } from "zod";

export const holdingScanSchema = z.object({
  deviceId: z.string().min(1).max(100),
  transferId: z.string().min(1).max(100),
  scannedEpcs: z.array(z.string().min(1)),
});

export const holdingReceiveSchema = z.object({
  transferId: z.string().min(1).max(100),
  receivedItems: z.array(
    z.object({
      epc: z.string().min(1),
      receivedQty: z.number().positive().optional(),
    }),
  ),
  notes: z.string().max(1000).optional(),
});

export const reconcileAlternateSchema = z.object({
  packetTagId: z.string().regex(/^\d+$/),
  ifsUpdatedItemCode: z.string().min(1).max(100),
});

export const transferIdParamSchema = z.object({
  transferId: z.string().min(1).max(100),
});
