import { z } from "zod";

export const putAwaySyncSchema = z.object({
  deviceId: z.string().min(1),
  items: z
    .array(
      z.object({
        packetTagEpc: z.string().min(1),
        binRfidEpc: z.string().min(1),
        ifsLocationNo: z.string().optional(),
        warehouse: z.string().optional(),
        binNo: z.string().optional(),
        confirmedAt: z.string().datetime().optional(),
      }),
    )
    .min(1)
    .max(500),
});
