import { prisma } from "../../config/clients.js";

export interface RepollCandidateRow {
  gateEntryNo: string;
}

/**
 * Selects the gate entries that still have at least one line awaiting IFS QC:
 * counted (sits_status = COUNTED), not already frozen as IFS-Rejected, and not
 * yet fetch-ready. Lines already fetch-ready or on terminal Rejected status are
 * excluded so re-polling stays idempotent and cheap.
 *
 * Ordered oldest-first (by the RR's fetch time) so the longest-waiting gate
 * entries are re-read first, capped by the configured batch size.
 */
export async function listRepollCandidates(
  fetchReadyQcStatus: string,
  limit: number,
): Promise<RepollCandidateRow[]> {
  const rows = await prisma.$queryRaw<RepollCandidateRow[]>`
    SELECT r.gate_entry_no AS "gateEntryNo"
    FROM rr_lines l
    JOIN rr r ON r.id = l.rr_id
    WHERE l.sits_status = 'COUNTED'
      AND l.ifs_rejected = false
      AND (l.qc_status IS NULL OR lower(l.qc_status) <> lower(${fetchReadyQcStatus}))
    GROUP BY r.gate_entry_no
    ORDER BY MIN(r.fetched_at) ASC
    LIMIT ${limit};
  `;
  return rows;
}
