import { z } from "zod";

/**
 * Numeric id validator that never throws (BigInt("start") would crash).
 */
const bigintIdString = z
  .string()
  .regex(/^\d+$/, "Must be a numeric id")
  .refine((v) => {
    try {
      return BigInt(v) > 0n;
    } catch {
      return false;
    }
  }, "Must be a positive id");

/** POST /tags/generate — v2.0 */
export const generateTagSchema = z.object({
  rrLineId: bigintIdString,
  packetIndex: z.coerce.number().int().min(1),
  totalPackets: z.coerce.number().int().min(1),
  packetQty: z.coerce.number().min(0),
  colour: z.string().max(50).optional().default("NONE"),
  serialNumber: z.string().min(1).max(200).optional(),
  alternateItemCode: z.string().min(1).max(50).optional(),
  tagType: z
    .enum(["LABEL", "HARD", "BARCODE", "RFID", "RFID_ENGRAVED", "BARCODE_ONLY", "HARD_RFID"])
    .optional(),
  photoRequestId: z.string().min(1).optional(),
});

/** POST /tags/start — legacy bulk tagging */
export const startTaggingSchema = z.object({
  rrLineId: bigintIdString,
  colour: z.string().min(1, "Colour is required").max(50),
  alternateItemCode: z.string().min(1).max(50).optional(),
});

/** POST /tags/:id/commission */
export const commissionTagSchema = z.object({
  readBackEpc: z.string().min(1, "Read-back EPC is required").max(64),
});

/** POST /tags/:id/void */
export const voidTagSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(500),
});

/** POST /tags/:id/photo — legacy single-photo path */
export const uploadPhotoSchema = z.object({
  photoUrl: z.string().min(1, "photoUrl is required").max(5_000_000, "photoUrl too large"),
  topNumber: z.string().max(100).optional(),
});

/** Path parameter for /tags/:id */
export const tagIdParamSchema = z.object({
  id: bigintIdString,
});

/** Path parameter for GET /tags/:id — accepts a numeric tag id OR an RFID EPC string. */
export const tagLookupParamSchema = z.object({
  id: z.string().min(1, "Tag id or EPC is required"),
});

/** Query for GET /tags */
export const listTagsQuerySchema = z.object({
  rrLineId: bigintIdString.optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
