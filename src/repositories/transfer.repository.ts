import { prisma } from "../config/clients.js";

/**
 * Data access for the Transfer module (RF-24 partial-read rescan).
 *
 * Feeds the transit-exit completeness check: the expected EPC set for a rescan
 * is the approved subset carried by the Transfer's lines — never the whole
 * transit baseline.
 */
export const transferRepository = {
  /**
   * Returns the expected EPC set for a Transfer (its approved TransferLines).
   * Returns null when no such transfer exists.
   */
  findExpectedEpcsByTransferId: async (
    transferId: string,
  ): Promise<{ transferId: string; expectedEpcs: string[] } | null> => {
    const transfer = await prisma.transfer.findUnique({
      where: { transferId },
      select: {
        transferId: true,
        lines: { select: { epc: true } },
      },
    });
    if (!transfer) return null;
    return {
      transferId: transfer.transferId,
      expectedEpcs: transfer.lines.map((l) => l.epc),
    };
  },
};
