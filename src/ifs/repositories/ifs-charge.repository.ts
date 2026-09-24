import { prisma } from "../../config/clients.js";
import { ifsClient } from "../client/ifs-client.js";
import { IFS_TABLES } from "../types/ifs.types.js";
import type { IfsChargeStatus } from "../types/ifs.types.js";

/**
 * IFS charge-status repository — the live approval source for the transit-exit
 * charge gate (RF-22).
 *
 * The charge-approval decision is read directly from IFS (`IFS_CHARGE_STATUS_VIEW`)
 * and NEVER from the PostgreSQL mirror (`rr_lines.charge_status`). The mirror is
 * retained only for reporting/historical use and to provide the IFS key columns
 * used to locate the live row.
 *
 * IFS is READ-ONLY from SITS's perspective: this module only issues a SELECT via
 * IfsClient, which refuses any non-read statement outright.
 */
export const ifsChargeRepository = {
  /**
   * Reads the live charge-approval status from IFS for a single RR line.
   *
   * The line's IFS keys are taken from the local mirror (gate entry no /
   * receipt no) — identifiers only, never the approval decision. Returns null
   * when the line cannot be mapped to an IFS row or the IFS query comes back
   * empty; callers must treat a null as HOLD (never as approved).
   */
  findByRrLineId: async (rrLineId: bigint): Promise<IfsChargeStatus | null> => {
    const line = await prisma.rrLine.findUnique({
      where: { id: rrLineId },
      select: {
        gateEntryNo: true,
        receiptNo: true,
        rr: { select: { gateEntryNo: true, receiptNo: true, rrNo: true } },
      },
    });

    if (!line) return null;

    const gateEntryNo = line.gateEntryNo ?? line.rr.gateEntryNo ?? line.rr.rrNo;
    const receiptNo = line.receiptNo ?? line.rr.receiptNo;
    if (!gateEntryNo) return null;

    const sql = `
      SELECT
        GATE_ENTRY_NO AS gateEntryNo,
        RECEIPT_NO AS receiptNo,
        CHARGES_APPROVED AS chargesApproved
      FROM ${IFS_TABLES.CHARGE_STATUS_VIEW}
      WHERE GATE_ENTRY_NO = ? ${receiptNo ? "AND RECEIPT_NO = ?" : ""}
      LIMIT 1;
    `;
    const params = receiptNo ? [gateEntryNo, receiptNo] : [gateEntryNo];
    const rows = await ifsClient.query<IfsChargeStatus>(sql, params);
    return rows[0] ?? null;
  },
};
