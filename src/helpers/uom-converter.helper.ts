import { Prisma } from "../../prisma/generated/prisma/client.js";
import { ValidationError } from "../errors/errors.js";

/**
 * UoM / packaging conversion (RF-06, BR-12).
 *
 * Converts a vendor-side quantity (packages × qty_per_package in vendor UoM)
 * into HAL stocking UoM. All tag quantities MUST be stored in stocking UoM.
 *
 * Rules:
 *   • Same UoM  → no conversion, factor unused.
 *   • Different UoM → requires `conversionFactor` from item master
 *                     (stocking_qty = vendor_qty × factor).
 *   • Missing factor when a conversion is required → ValidationError
 *     (BR-12 says the operator must be prompted; the API surfaces this).
 */

export interface UomConversionInput {
  numPackages: number;
  qtyPerPackage: Prisma.Decimal;
  vendorUom: string;
  stockingUom: string;
  conversionFactor: Prisma.Decimal | null;
}

export interface UomConversionResult {
  totalQtyStockingUom: Prisma.Decimal;
  qtyPerTagStockingUom: Prisma.Decimal;
  totalPackets: number;
}

export const uomConverter = {
  convertToStockingUom: (input: UomConversionInput): UomConversionResult => {
    const { numPackages, qtyPerPackage, vendorUom, stockingUom, conversionFactor } = input;

    if (numPackages <= 0) {
      throw new ValidationError("numPackages must be > 0 to compute a tag quantity");
    }

    const totalVendorQty = qtyPerPackage.mul(numPackages);
    let totalStockingQty: Prisma.Decimal;

    if (vendorUom.trim().toLowerCase() === stockingUom.trim().toLowerCase()) {
      totalStockingQty = totalVendorQty;
    } else if (conversionFactor && !conversionFactor.isZero()) {
      totalStockingQty = totalVendorQty.mul(conversionFactor);
    } else {
      throw new ValidationError(
        `Cannot convert ${vendorUom} → ${stockingUom}: no conversion factor available on item master`,
      );
    }

    const qtyPerTag = totalStockingQty.div(numPackages);

    return {
      totalQtyStockingUom: totalStockingQty,
      qtyPerTagStockingUom: qtyPerTag,
      totalPackets: numPackages,
    };
  },
};
