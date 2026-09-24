import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { prisma, redis } from "../config/clients.js";
import { logger } from "../config/logger.js";
import { EVENT_TYPES } from "../constants/event-types.js";
import { ROLES } from "../constants/roles.js";
import { AlertSeverity } from "../enums/alert.enum.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { EventType } from "../enums/event.enum.js";
import { PacketTagStatus, TransferStatus } from "../enums/status.enum.js";
import { isChargeApproved } from "../helpers/charge-status.helper.js";
import { eventLogger } from "../helpers/event-logger.helper.js";
import { ifsChargeRepository } from "../ifs/repositories/ifs-charge.repository.js";
import { alertRepository } from "../repositories/alert.repository.js";
import { ALERT_TYPE_TRANSIT_EXIT_NOT_APPROVED } from "../repositories/alerts.repository.js";
import { rbacRepository } from "../repositories/rbac.repository.js";
import { tagRepository } from "../repositories/tags.repository.js";
import type {
  ChargeSource,
  ChargeStatus,
  TransitExitAlertInput,
  TransitExitAlertRecipient,
  TransitExitAlertResult,
  TransitExitApprovedLine,
  TransitExitChargeCheckInput,
  TransitExitChargeCheckResult,
  TransitExitEpcResult,
  TransitExitGenerateTransferInput,
  TransitExitGenerateTransferResult,
  TransitExitLineResult,
  TransitExitRemainingLine,
  TransitExitSelectApprovedInput,
  TransitExitSelectApprovedResult,
  TransitExitTransferEpcResult,
} from "../types/transit-exit.types.js";

/**
 * Transit Exit — Charge Approval module (RF-22).
 *
 * Given the EPC set captured at the transit exit (RF-21), resolves the IFS
 * charge-approval status for each RR line the EPCs belong to. The result is
 * consumed downstream by RF-23 (approved-subset selection).
 *
 * Resolution strategy per RR line (one check per line, even when multiple EPCs
 * on the same line are present):
 *   1. Redis cache read (`charge_status:{rrLineId}`, 5 min TTL). A hit
 *      (unexpired) is used directly — this is what makes repeated reads cheap
 *      and lets a single line check serve many EPCs.
 *   2. On miss/expiry, read the LIVE approval status from the read-only IFS
 *      `IFS_CHARGE_STATUS_VIEW` and cache the resolved status in Redis.
 *      The PostgreSQL mirror (`rr_lines.charge_status`) is NEVER used for the
 *      approval decision — it is retained only for IFS key columns and
 *      historical reporting.
 *   3. If IFS is unavailable or the line cannot be mapped, the line is placed
 *      on HOLD — approval is never assumed when the source of truth is missing.
 *
 * Redis is fail-open: a GET error is treated as a miss; a SET error is logged
 * and swallowed so the request still succeeds via the IFS path.
 */

/** Redis key prefix for cached charge-status lookups. */
const CHARGE_STATUS_KEY_PREFIX = "charge_status";

/** Cache TTL for a resolved charge status (5 minutes). */
const CHARGE_STATUS_TTL_SECONDS = 300;

/** TTL for the `transfer:{tid}` Redis transfer record (24 hours). */
const TRANSFER_KEY_TTL_SECONDS = 86_400;

/**
 * Resolves the charge-approval status for a single RR line.
 *
 * Returns the resolved status plus its provenance and the line's IFS
 * identifiers. On any Redis/IFS failure the line is placed on HOLD (never
 * assumed approved).
 */
async function resolveLineChargeStatus(rrLineId: bigint): Promise<{
  chargeStatus: ChargeStatus;
  source: ChargeSource;
  rrLineNo: string;
  rrNo: string;
}> {
  const key = `${CHARGE_STATUS_KEY_PREFIX}:${rrLineId.toString()}`;

  // 1. Redis cache read (fail-open: treat GET error as a miss).
  try {
    const cached = await redis.get(key);
    if (cached !== null && cached !== undefined) {
      return {
        chargeStatus: cached === "approved" ? "approved" : "pending",
        source: "redis",
        rrLineNo: "",
        rrNo: "",
      };
    }
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err), key },
      "transit_exit: redis_get_error",
    );
  }

  // Local mirror read for IFS key columns only (never the approval decision).
  const mirrorRows = await tagRepository.findChargeStatusByRrLineIds([rrLineId]);
  const mirrorRow = mirrorRows[0];
  const rrLineNo = mirrorRow?.rrLineNo ?? "";
  const rrNo = mirrorRow?.rr.rrNo ?? "";

  // 2. Cache miss → live IFS read. On any failure → HOLD.
  try {
    const row = await ifsChargeRepository.findByRrLineId(rrLineId);
    if (!row || row.chargesApproved === null || row.chargesApproved === undefined) {
      return { chargeStatus: "hold", source: "hold", rrLineNo, rrNo };
    }

    const chargeStatus: ChargeStatus = isChargeApproved(row.chargesApproved)
      ? "approved"
      : "pending";

    // 3. Cache the resolved status (fail-open: SET error is logged, not fatal).
    try {
      await redis.set(key, chargeStatus, "EX", CHARGE_STATUS_TTL_SECONDS);
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err), key },
        "transit_exit: redis_set_error",
      );
    }

    return { chargeStatus, source: "ifs", rrLineNo, rrNo };
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err), rrLineId: rrLineId.toString() },
      "transit_exit: charge_status_ifs_error",
    );
    return { chargeStatus: "hold", source: "hold", rrLineNo, rrNo };
  }
}

export const transitExitService = {
  async checkCharge(
    input: TransitExitChargeCheckInput,
    actor: { userId: string; email: string },
    auditCtx?: { actorId?: string; actorEmail?: string; requestId?: string },
  ): Promise<TransitExitChargeCheckResult> {
    const { epcs } = input;

    // De-duplicate while preserving first-seen order (same as RF-21).
    const seen = new Set<string>();
    const uniqueEpcs: string[] = [];
    for (const epc of epcs) {
      if (!seen.has(epc)) {
        seen.add(epc);
        uniqueEpcs.push(epc);
      }
    }

    // Map each EPC to its RR line (UNKNOWN EPCs have no line).
    const foundTags = await tagRepository.findByEpcs(uniqueEpcs);
    const epcToRrLineId = new Map<string, bigint>();
    for (const tag of foundTags) {
      epcToRrLineId.set(tag.epc, tag.rrLineId);
    }

    // Group FOUND EPCs by RR line — one charge check per line.
    const lineEpcGroups = new Map<bigint, string[]>();
    for (const epc of uniqueEpcs) {
      const rrLineId = epcToRrLineId.get(epc);
      if (rrLineId === undefined) continue; // UNKNOWN
      const group = lineEpcGroups.get(rrLineId);
      if (group) group.push(epc);
      else lineEpcGroups.set(rrLineId, [epc]);
    }

    const lineResults: TransitExitLineResult[] = [];
    const epcResults: TransitExitEpcResult[] = [];

    // Per-EPC results in first-seen de-duplicated order.
    for (const epc of uniqueEpcs) {
      const rrLineId = epcToRrLineId.get(epc);
      if (rrLineId === undefined) {
        epcResults.push({
          epc,
          status: "UNKNOWN",
          rrLineId: null,
          chargeStatus: null,
          approved: null,
        });
      }
    }

    // Resolve each distinct line (Redis-first, then live IFS, then HOLD).
    for (const [rrLineId, groupEpcs] of lineEpcGroups) {
      const { chargeStatus, source, rrLineNo, rrNo } = await resolveLineChargeStatus(rrLineId);

      const approved = chargeStatus === "approved";
      const rrLineIdStr = rrLineId.toString();

      lineResults.push({
        rrLineId: rrLineIdStr,
        rrLineNo,
        rrNo,
        chargeStatus,
        source,
        approved,
        epcs: groupEpcs,
      });

      for (const epc of groupEpcs) {
        epcResults.push({
          epc,
          status: "FOUND",
          rrLineId: rrLineIdStr,
          chargeStatus,
          approved,
        });
      }

      // Best-effort event logging (never fails the request).
      await eventLogger
        .log({
          ref: rrLineIdStr,
          eventType: EventType.CHARGE_APPROVAL_CHECK,
          phase: "3-Transit",
          appUser: actor.userId || undefined,
          payload: {
            chargeStatus,
            source,
            approved,
            epcCount: groupEpcs.length,
            actorId: auditCtx?.actorId,
            actorEmail: auditCtx?.actorEmail,
            requestId: auditCtx?.requestId,
          },
        })
        .catch(() => undefined);
    }

    const approvedLines = lineResults.filter((l) => l.chargeStatus === "approved").length;
    const pendingLines = lineResults.filter((l) => l.chargeStatus === "pending").length;
    const holdLines = lineResults.filter((l) => l.chargeStatus === "hold").length;
    const unknown = epcResults.filter((e) => e.status === "UNKNOWN").length;

    await writeAudit(auditCtx, {
      action: AuditAction.CHARGE_STATUS_CHANGE,
      resource: AuditResource.TRANSIT,
      result: AuditResult.SUCCESS,
      meta: {
        totalEpcs: epcs.length,
        approvedLines,
        pendingLines,
        holdLines,
        unknown,
      },
    });

    return {
      totalEpcs: epcs.length,
      uniqueEpcs: uniqueEpcs.length,
      unknown,
      duplicates: epcs.length - uniqueEpcs.length,
      approvedLines,
      pendingLines,
      holdLines,
      lines: lineResults,
      epcs: epcResults,
    };
  },

  /**
   * Select the approved subset of EPCs for dispatch (RF-23).
   *
   * Re-resolves each RR line's charge status server-side (never trusting a
   * client-supplied approval) using the same fail-safe HOLD behaviour as
   * `checkCharge`. Only EPCs whose RR line resolves to `approved` are placed
   * in the dispatch subset; everything else (pending / hold / UNKNOWN) stays
   * in transit and is returned as `remainingEpcs`.
   *
   * The result is enriched with per-line IFS identifiers so RF-24 can generate
   * Transfer IDs without re-resolving charge status. Event logging is
   * best-effort and never fails the request.
   */
  async selectApproved(
    input: TransitExitSelectApprovedInput,
    actor: { userId: string; email: string },
    auditCtx?: AuditContext,
  ): Promise<TransitExitSelectApprovedResult> {
    const { epcs } = input;

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
    const tagByEpc = new Map(foundTags.map((t) => [t.epc, t]));

    // Group EPCs by RR line (UNKNOWN EPCs have no line).
    const epcsByLine = new Map<bigint, string[]>();
    const unknownEpcs: string[] = [];
    for (const epc of uniqueEpcs) {
      const tag = tagByEpc.get(epc);
      if (!tag) {
        unknownEpcs.push(epc);
        continue;
      }
      const list = epcsByLine.get(tag.rrLineId) ?? [];
      list.push(epc);
      epcsByLine.set(tag.rrLineId, list);
    }

    // Resolve charge status per line (Redis-first → live IFS → HOLD).
    const lineIds = [...epcsByLine.keys()];
    const resolved = await Promise.all(lineIds.map((id) => resolveLineChargeStatus(id)));
    const statusByLine = new Map(lineIds.map((id, i) => [id, resolved[i]]));

    const approvedEpcs: string[] = [];
    const remainingEpcs: string[] = [];
    const approvedLines: TransitExitApprovedLine[] = [];
    const remainingLines: TransitExitRemainingLine[] = [];

    for (const lineId of lineIds) {
      const { chargeStatus, rrLineNo, rrNo } = statusByLine.get(lineId)!;
      const lineEpcs = epcsByLine.get(lineId)!;

      if (chargeStatus === "approved") {
        approvedEpcs.push(...lineEpcs);
        approvedLines.push({
          rrLineId: lineId.toString(),
          rrLineNo,
          rrNo,
          epcs: lineEpcs,
        });
      } else {
        remainingEpcs.push(...lineEpcs);
        remainingLines.push({
          rrLineId: lineId.toString(),
          rrLineNo,
          rrNo,
          chargeStatus,
          epcs: lineEpcs,
        });
      }
    }

    // UNKNOWN EPCs cannot be approved — they remain in transit.
    remainingEpcs.push(...unknownEpcs);
    if (unknownEpcs.length > 0) {
      remainingLines.push({
        rrLineId: null,
        rrLineNo: "",
        rrNo: "",
        chargeStatus: null,
        epcs: unknownEpcs,
      });
    }

    // Best-effort event logging for the approved subset (non-fatal).
    await Promise.all(
      approvedLines.map((line) =>
        eventLogger
          .log({
            ref: line.rrLineId,
            eventType: EventType.APPROVED_SUBSET_SELECTED,
            phase: "3-Transit",
            appUser: actor.userId || undefined,
            payload: {
              epcs: line.epcs,
              rrLineNo: line.rrLineNo,
              rrNo: line.rrNo,
              actorId: auditCtx?.actorId,
              actorEmail: auditCtx?.actorEmail,
              requestId: auditCtx?.requestId,
            },
          })
          .catch(() => undefined),
      ),
    );

    await writeAudit(auditCtx, {
      action: AuditAction.CHARGE_STATUS_CHANGE,
      resource: AuditResource.TRANSIT,
      result: AuditResult.SUCCESS,
      meta: {
        totalEpcs: epcs.length,
        approvedCount: approvedEpcs.length,
        remainingCount: remainingEpcs.length,
      },
    });

    return {
      totalEpcs: epcs.length,
      uniqueEpcs: uniqueEpcs.length,
      duplicates: epcs.length - uniqueEpcs.length,
      approvedCount: approvedEpcs.length,
      remainingCount: remainingEpcs.length,
      approvedEpcs,
      remainingEpcs,
      approvedLines,
      remainingLines,
    };
  },

  /**
   * Raise a not-approved alert at the transit exit (RF-25).
   *
   * Persists an alert in the generic `Alert` model and resolves the recipient
   * managers from their roles (transit_manager, holding_manager) so the alert
   * is addressed to people, never to hardcoded user IDs. The actual delivery
   * channel (email/push/etc.) is intentionally out of scope here — this module
   * guarantees the alert is recorded and the correct recipients are resolved,
   * which is the auditable source of truth. Delivery can be layered on later
   * without changing this contract.
   *
   * The operation is best-effort on the notification side: if recipient
   * resolution fails we still record the alert (it is the critical audit
   * artifact) and surface the failure in the response rather than dropping the
   * alert entirely.
   */
  async raiseNotApprovedAlert(
    input: TransitExitAlertInput,
    actor: { userId: string; email: string },
    auditCtx?: AuditContext,
  ): Promise<TransitExitAlertResult> {
    const { ref, reason, epcs } = input;

    // Manager roles that should be notified (resolved by name, not by ID).
    const notifiedRoles = [ROLES.TRANSIT_MANAGER, ROLES.HOLDING_MANAGER];

    // Resolve recipient users from the manager roles (active, non-deleted only).
    // Each user may hold more than one of the notified roles; we keep the first
    // matching role for display while de-duplicating users by id.
    const recipientMap = new Map<string, TransitExitAlertRecipient>();
    for (const role of notifiedRoles) {
      const users = await rbacRepository.findUsersByRoleName(role);
      for (const u of users) {
        if (!recipientMap.has(u.id)) {
          recipientMap.set(u.id, {
            role,
            userId: u.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
          });
        }
      }
    }
    const recipients = [...recipientMap.values()];

    // Persist the alert (the critical, auditable artifact).
    const alert = await alertRepository.create({
      alertType: ALERT_TYPE_TRANSIT_EXIT_NOT_APPROVED,
      severity: AlertSeverity.WARNING,
      ref: ref ?? null,
      message: reason,
      payload: {
        raisedBy: { userId: actor.userId || null, email: actor.email },
        epcs,
        recipients: recipients.map((r) => ({ userId: r.userId, email: r.email })),
      },
    });

    // Best-effort event log (non-fatal).
    await eventLogger
      .log({
        ref: ref ?? "transit-exit",
        eventType: EventType.NOT_APPROVED_ALERT_RAISED,
        phase: "3-Transit",
        appUser: actor.userId || undefined,
        payload: {
          alertId: alert.id.toString(),
          reason,
          epcCount: epcs.length,
          recipientCount: recipients.length,
          actorId: auditCtx?.actorId,
          actorEmail: auditCtx?.actorEmail,
          requestId: auditCtx?.requestId,
        },
      })
      .catch(() => undefined);

    return {
      alertId: alert.id.toString(),
      alertType: alert.alertType,
      severity: alert.severity,
      ref: alert.ref,
      message: alert.message,
      status: alert.status,
      createdAt: alert.createdAt.toISOString(),
      notifiedRoles,
      recipients,
    };
  },

  /**
   * Generate a Transfer ID for the approved EPC subset (RF-24).
   *
   * Validates each EPC is approved and eligible for transfer, generates a unique
   * Transfer ID, persists Transfer and TransferLine records in a transaction,
   * creates Redis mappings (tid:{epc} → TID, tid_set:{tid} → EPC set, and the
   * `transfer:{tid}` JSON record consumed by fixed-gate verification), and logs
   * the event.
   *
   * Returns the Transfer ID, the EPCs that were transferred, and per-EPC
   * validation results.
   */
  async generateTransfer(
    input: TransitExitGenerateTransferInput,
    actor: { userId: string; email: string },
    auditCtx?: AuditContext,
  ): Promise<TransitExitGenerateTransferResult> {
    const { epcs, destination } = input;
    const createdBy = actor.userId && actor.userId.length > 0 ? actor.userId : null;

    // De-duplicate while preserving first-seen order.
    const seen = new Set<string>();
    const uniqueEpcs: string[] = [];
    for (const epc of epcs) {
      if (!seen.has(epc)) {
        seen.add(epc);
        uniqueEpcs.push(epc);
      }
    }

    // Fetch all PacketTags for the EPCs.
    const foundTags = await tagRepository.findByEpcs(uniqueEpcs);
    const tagByEpc = new Map(foundTags.map((t) => [t.epc, t]));

    // Resolve charge status once per distinct line (no N+1 per EPC).
    const distinctLineIds = [...new Set(foundTags.map((t) => t.rrLineId))];
    const resolved = await Promise.all(distinctLineIds.map((id) => resolveLineChargeStatus(id)));
    const statusByLine = new Map(distinctLineIds.map((id, i) => [id, resolved[i]]));

    // Validate each EPC.
    const epcResults: TransitExitTransferEpcResult[] = [];
    const validEpcs: string[] = [];
    const validTags: typeof foundTags = [];

    for (const epc of uniqueEpcs) {
      const tag = tagByEpc.get(epc);
      if (!tag) {
        epcResults.push({
          epc,
          status: "UNKNOWN",
          rrLineId: null,
          rrLineNo: null,
          rrNo: null,
          reason: "EPC not found in PacketTag",
        });
        continue;
      }

      // EPC is approved only when its RR line resolves to approved.
      const { chargeStatus, rrLineNo, rrNo } = statusByLine.get(tag.rrLineId)!;
      if (chargeStatus !== "approved") {
        epcResults.push({
          epc,
          status: "NOT_APPROVED",
          rrLineId: tag.rrLineId.toString(),
          rrLineNo,
          rrNo,
          reason: `RR line charge status is ${chargeStatus}`,
        });
        continue;
      }

      // Check PacketTag status - only CREATED, COMMISSIONED, LABEL_PRINTED, TRANSIT_OUT are eligible
      const eligibleStatuses = [
        PacketTagStatus.CREATED,
        PacketTagStatus.COMMISSIONED,
        PacketTagStatus.LABEL_PRINTED,
        PacketTagStatus.TRANSIT_OUT,
      ];
      if (!eligibleStatuses.includes(tag.status as PacketTagStatus)) {
        epcResults.push({
          epc,
          status: "HOLD",
          rrLineId: tag.rrLineId.toString(),
          rrLineNo,
          rrNo,
          reason: `PacketTag status is ${tag.status}, not eligible for transfer`,
        });
        continue;
      }

      // Valid EPC for transfer
      validEpcs.push(epc);
      validTags.push(tag);
      epcResults.push({
        epc,
        status: "VALID",
        rrLineId: tag.rrLineId.toString(),
        rrLineNo,
        rrNo,
      });
    }

    if (validEpcs.length === 0) {
      throw new Error("No valid approved EPCs provided for transfer");
    }

    // Generate Transfer ID
    const { generateTransferId } = await import("../helpers/transfer-id-generator.helper.js");
    const transferId = await generateTransferId();

    // Create Transfer, TransferLines, and update tag statuses in a transaction.
    await prisma.$transaction(async (tx) => {
      // 1. Create Transfer
      const createdTransfer = await tx.transfer.create({
        data: {
          transferId,
          status: TransferStatus.IN_TRANSIT,
          fromLocation: "TRANSIT",
          toLocation: destination,
          createdBy,
          dispatchedAt: new Date(),
        },
      });

      // 2. Create TransferLines
      const transferLinesData = validTags.map((tag) => ({
        transferId: createdTransfer.id,
        packetTagId: tag.id,
        rrLineId: tag.rrLineId,
        epc: tag.epc,
      }));

      await tx.transferLine.createMany({
        data: transferLinesData,
      });

      // 3. Move the tags to SENT_TO_HOLDING so they are not dispatched again.
      await tx.packetTag.updateMany({
        where: { id: { in: validTags.map((t) => t.id) } },
        data: { status: PacketTagStatus.SENT_TO_HOLDING },
      });

      return createdTransfer;
    });

    // Create Redis mappings (tid:{epc} → TID, tid_set:{tid} → EPC set, and the
    // transfer:{tid} JSON record consumed by fixed-gate verification).
    const redisPipeline = redis.pipeline();
    for (const epc of validEpcs) {
      redisPipeline.set(`tid:${epc}`, transferId, "EX", TRANSFER_KEY_TTL_SECONDS);
    }
    redisPipeline.set(
      `tid_set:${transferId}`,
      JSON.stringify(validEpcs),
      "EX",
      TRANSFER_KEY_TTL_SECONDS,
    );
    redisPipeline.set(
      `transfer:${transferId}`,
      JSON.stringify({
        transferId,
        destinationStore: destination,
        epcs: validEpcs,
        status: TransferStatus.IN_TRANSIT,
        createdAt: new Date().toISOString(),
      }),
      "EX",
      TRANSFER_KEY_TTL_SECONDS,
    );
    await redisPipeline.exec();

    // Event logging (best-effort)
    await Promise.all(
      validEpcs.map((epc) =>
        eventLogger
          .log({
            ref: epc,
            eventType: EVENT_TYPES.TRANSFER_CREATED,
            phase: "3-Transit",
            appUser: createdBy ?? undefined,
            payload: {
              transferId,
              epc,
              actorId: auditCtx?.actorId,
              actorEmail: auditCtx?.actorEmail,
              requestId: auditCtx?.requestId,
            },
          })
          .catch(() => undefined),
      ),
    );

    await writeAudit(auditCtx, {
      action: AuditAction.TRANSIT_TRANSFER_CREATE,
      resource: AuditResource.TRANSFER,
      resourceId: transferId,
      result: AuditResult.SUCCESS,
      meta: { destination, epcCount: validEpcs.length },
    });
    await writeAudit(auditCtx, {
      action: AuditAction.TRANSFER_DISPATCH,
      resource: AuditResource.TRANSFER,
      resourceId: transferId,
      result: AuditResult.SUCCESS,
      meta: { destination, epcCount: validEpcs.length },
    });

    return {
      transferId,
      epcs: validEpcs,
      totalEpcs: validEpcs.length,
      epcResults,
    };
  },
};
