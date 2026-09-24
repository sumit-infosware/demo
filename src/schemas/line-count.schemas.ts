// import { z } from "zod";

// export const captureLineCountSchema = z
//   .object({
//     rrLineId: z.string().regex(/^\d+$/),
//     method: z.enum(["MANUAL", "WEIGHT", "REEL"]),
//     numPackages: z.number().int().positive(),
//     qtyPerPackage: z.number().positive(),
//     manualCount: z.number().nonnegative().optional(),
//     unitWeightG: z.number().positive().optional(),
//     totalWeightG: z.number().nonnegative().optional(),
//     reelReadingMtr: z.number().nonnegative().optional(),
//     pitchMm: z.number().positive().optional(),
//     operatorEditedQty: z.number().nonnegative().optional(),
//     deviceId: z.string().max(100).optional(),
//     notes: z.string().max(1000).optional(),
//   })
//   .refine(
//     (d) => {
//       if (d.method === "MANUAL") return d.manualCount !== undefined;
//       if (d.method === "WEIGHT") return d.unitWeightG !== undefined && d.totalWeightG !== undefined;
//       if (d.method === "REEL") return d.reelReadingMtr !== undefined;
//       return false;
//     },
//     { message: "Missing required fields for the selected method" },
//   );

// export const rrLineIdParamSchema = z.object({
//   rrLineId: z.string().regex(/^\d+$/),
// });

import { z } from "zod";
import { COUNTING_METHODS } from "../constants/device-types.js";

export const captureLineCountSchema = z
  .object({
    rrLineId: z.string().regex(/^\d+$/),
    method: z.enum([COUNTING_METHODS.MANUAL, COUNTING_METHODS.WEIGHT, COUNTING_METHODS.REEL]),
    numPackages: z.number().int().positive(),
    qtyPerPackage: z.number().positive(),
    manualCount: z.number().nonnegative().optional().nullable(),
    unitWeightG: z.number().nonnegative().optional().nullable(),
    totalWeightG: z.number().nonnegative().optional().nullable(),
    reelReadingMtr: z.number().nonnegative().optional().nullable(),
    pitchMm: z.number().nonnegative().optional().nullable(), // 👈 FIXED: .nonnegative() allows 0
    operatorEditedQty: z.number().nonnegative().optional().nullable(),
    deviceId: z.string().max(100).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .refine(
    (d) => {
      if (d.method === COUNTING_METHODS.MANUAL)
        return d.manualCount !== undefined && d.manualCount !== null;
      if (d.method === COUNTING_METHODS.WEIGHT)
        return (
          d.unitWeightG !== undefined &&
          d.unitWeightG !== null &&
          d.totalWeightG !== undefined &&
          d.totalWeightG !== null
        );
      if (d.method === COUNTING_METHODS.REEL)
        return d.reelReadingMtr !== undefined && d.reelReadingMtr !== null;
      return false;
    },
    { message: "Missing required fields for the selected counting method" },
  );

export const rrLineIdParamSchema = z.object({
  rrLineId: z.string().regex(/^\d+$/),
});
