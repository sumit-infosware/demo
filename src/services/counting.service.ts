import { Prisma } from "../../prisma/generated/prisma/client.js";
import { ValidationError } from "../errors/errors.js";
import { countCalculator } from "../helpers/count-calculator.helper.js";
import { COUNTING_METHODS, type CountingMethod } from "../constants/device-types.js";

/**
 * Shared counting service (RF-14, RF-15, RF-16, RF-18).
 * Reused by Phase 3 (Baseline) and Phase 7 (Count Check).
 */

export interface CountCaptureInput {
  method: CountingMethod;
  manualCount?: number;
  unitWeight?: number;
  totalWeight?: number;
  reelReading?: number;
}

export interface CountCaptureResult {
  method: CountingMethod;
  count: Prisma.Decimal;
  unitWeight?: Prisma.Decimal;
  totalWeight?: Prisma.Decimal;
}

export const countingService = {
  /**
   * Compute count from the operator's captured data.
   * Dispatches to correct method (manual, weight, reel).
   */
  capture: (input: CountCaptureInput): CountCaptureResult => {
    switch (input.method) {
      case COUNTING_METHODS.MANUAL: {
        if (input.manualCount === undefined) {
          throw new ValidationError("manualCount is required for MANUAL method");
        }
        const count = countCalculator.validateManual(input.manualCount);
        return {
          method: COUNTING_METHODS.MANUAL,
          count: new Prisma.Decimal(count),
        };
      }

      case COUNTING_METHODS.WEIGHT: {
        if (input.unitWeight === undefined || input.totalWeight === undefined) {
          throw new ValidationError("unitWeight and totalWeight are required for WEIGHT method");
        }
        const result = countCalculator.fromWeight({
          totalWeight: new Prisma.Decimal(input.totalWeight),
          unitWeight: new Prisma.Decimal(input.unitWeight),
        });
        return {
          method: COUNTING_METHODS.WEIGHT,
          count: new Prisma.Decimal(result.count),
          unitWeight: new Prisma.Decimal(input.unitWeight),
          totalWeight: new Prisma.Decimal(input.totalWeight),
        };
      }

      case COUNTING_METHODS.REEL: {
        if (input.reelReading === undefined) {
          throw new ValidationError("reelReading is required for REEL method");
        }
        const count = countCalculator.fromReel(input.reelReading);
        return {
          method: COUNTING_METHODS.REEL,
          count: new Prisma.Decimal(count),
        };
      }

      default:
        throw new ValidationError(`Unknown counting method: ${String(input.method)}`);
    }
  },
};
