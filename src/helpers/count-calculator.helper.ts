import { Prisma } from "../../prisma/generated/prisma/client.js";
import { ValidationError } from "../errors/errors.js";

/**
 * Count calculation helpers (RF-18).
 * Handles the math for weight-based and reel-based counting.
 */

export interface WeightCountInput {
  totalWeight: Prisma.Decimal;
  unitWeight: Prisma.Decimal;
  tolerance?: number;
}

export interface WeightCountResult {
  count: number;
  raw: number;
  tolerance: number;
}

export const countCalculator = {
  /**
   * Calculate count from weight measurement.
   * Formula: count = round(totalWeight / unitWeight)
   * Throws if tolerance exceeded (indicates bad unit_weight or damaged packet).
   */
  fromWeight: (input: WeightCountInput): WeightCountResult => {
    if (input.unitWeight.isZero() || input.unitWeight.isNegative()) {
      throw new ValidationError("Unit weight must be a positive number");
    }
    if (input.totalWeight.isNegative()) {
      throw new ValidationError("Total weight cannot be negative");
    }
    if (input.totalWeight.isZero()) {
      throw new ValidationError("Total weight is zero — packet may not be placed on scale");
    }

    const raw = Number(input.totalWeight.div(input.unitWeight).toString());
    const count = Math.round(raw);
    const tolerance = Math.abs(raw - count);
    const maxTolerance = input.tolerance ?? 0.1;

    if (tolerance > maxTolerance) {
      throw new ValidationError(
        `Weight-based count has high tolerance (${tolerance.toFixed(4)}). Verify unit weight or check for damage.`,
        {
          rawCount: raw,
          roundedCount: count,
          tolerance,
          maxTolerance,
        },
      );
    }

    return { count, raw, tolerance };
  },

  /**
   * Reel counter returns count directly — just validate.
   */
  fromReel: (reading: number): number => {
    if (reading < 0) {
      throw new ValidationError("Reel count cannot be negative");
    }
    return reading;
  },

  /**
   * Manual count — just validate.
   */
  validateManual: (count: number): number => {
    if (!Number.isFinite(count) || count < 0) {
      throw new ValidationError("Manual count must be a non-negative number");
    }
    return count;
  },
};
