import type { AuditContext } from "../audit/audit.types.js";
import { EventType } from "../enums/event.enum.js";
import { eventLogger } from "../helpers/event-logger.helper.js";
import { tagRepository } from "../repositories/tags.repository.js";
import { transferRepository } from "../repositories/transfer.repository.js";
import type { TransitReadInput, TransitReadResult } from "../types/transit.types.js";

/**
 * Transit Exit module (Phase 3) — RF-21.
 *
 * `readEpcs` accepts a bulk EPC read captured by an RFID reader at the transit
 * exit. Each EPC is looked up in PacketTag (the `tags` table). Registered EPCs
 * are partitioned as FOUND; unregistered EPCs as UNKNOWN. Every EPC is also
 * written to the event log (RF-43) for downstream analytics / reconciliation.
 *
 * Completeness check (partial-read rescan): when a `transferId` is supplied,
 * the expected set is the approved subset carried by that Transfer's lines
 * (TransferLines) — never the whole transit baseline. Reads are compared
 * against it; missing expected EPCs ⇒ `requiresRescan: true`. Before a TID /
 * transfer exists (first raw read, no `transferId`) no completeness claim is
 * made and the raw read is returned (`complete: null`, `requiresRescan: false`).
 */
export const transitService = {
  async readEpcs(
    input: TransitReadInput,
    actor: { userId: string; email: string },
    auditCtx?: AuditContext,
  ): Promise<TransitReadResult> {
    const { readerId, port, epcs, transferId } = input;

    // De-duplicate while preserving first-seen order.
    const seen = new Set<string>();
    const uniqueEpcs: string[] = [];
    for (const epc of epcs) {
      if (!seen.has(epc)) {
        seen.add(epc);
        uniqueEpcs.push(epc);
      }
    }

    const foundTags = await tagRepository.findByEpcs(uniqueEpcs);
    const foundSet = new Set(foundTags.map((t) => t.epc));

    const epcResults: { epc: string; status: "FOUND" | "UNKNOWN" }[] = uniqueEpcs.map((epc) => ({
      epc,
      status: foundSet.has(epc) ? "FOUND" : "UNKNOWN",
    }));

    const matched = epcResults.filter((e) => e.status === "FOUND").length;
    const unknown = epcResults.length - matched;

    // Completeness comparison against the Transfer's approved lines.
    let requiresRescan = false;
    let complete: boolean | null = null;
    let missingEpcs: string[] = [];
    let resolvedTransferId: string | null = transferId ?? null;

    if (transferId) {
      const transfer = await transferRepository.findExpectedEpcsByTransferId(transferId);
      if (transfer) {
        // Compare actual reads vs the expected TransferLines (approved subset).
        const readSet = new Set(uniqueEpcs.map((e) => e.toUpperCase()));
        missingEpcs = transfer.expectedEpcs
          .map((e) => e.toUpperCase())
          .filter((e) => !readSet.has(e))
          .reduce<string[]>((acc, e) => (acc.includes(e) ? acc : [...acc, e]), []);
        requiresRescan = missingEpcs.length > 0;
        complete = missingEpcs.length === 0;
      } else {
        // Transfer not (yet) created — e.g. a pre-TID first read. No completeness claim.
        resolvedTransferId = null;
      }
    }

    // Event logging is best-effort: a logging failure must not fail the read.
    await Promise.all(
      epcResults.map((r) =>
        eventLogger
          .log({
            ref: r.epc,
            eventType: EventType.TRANSIT_EXIT_READ,
            phase: "3-Transit",
            device: readerId ?? "unknown",
            appUser: actor.userId,
            payload: {
              status: r.status,
              readerId: readerId ?? null,
              port: port ?? null,
              transferId: resolvedTransferId,
              complete,
              missingEpcs,
              actorId: auditCtx?.actorId,
              actorEmail: auditCtx?.actorEmail,
              requestId: auditCtx?.requestId,
            },
          })
          .catch(() => undefined),
      ),
    );

    return {
      totalRead: epcs.length,
      uniqueRead: uniqueEpcs.length,
      matched,
      unknown,
      duplicates: epcs.length - uniqueEpcs.length,
      requiresRescan,
      transferId: resolvedTransferId,
      complete,
      missingEpcs,
      epcs: epcResults,
    };
  },
};
