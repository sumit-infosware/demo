import { z } from "zod";

// ===== RF-43: Approved alternates full-sync payload =====
// Empty payload would deactivate every row, so at least one item is required.
export const syncApprovedAlternatesSchema = z.object({
  items: z
    .array(
      z.object({
        orderedItem: z.string().min(1, "Ordered item is required"),
        alternateItem: z.string().min(1, "Alternate item is required"),
        isApproved: z.boolean().optional(),
      }),
    )
    .min(1, "At least one alternate is required"),
});

export type SyncApprovedAlternatesRequest = z.infer<typeof syncApprovedAlternatesSchema>;
