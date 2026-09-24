import type { NextFunction, Request, Response } from "express";
import { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma, redis } from "../config/clients.js";
import { ROLES } from "../constants/roles.js";
import { AlertChannel, AlertSeverity, AlertStatus, AlertType } from "../enums/alert.enum.js";
import { PacketTagStatus, TransferStatus } from "../enums/status.enum.js";
import {
  assessTransitAuthorization,
  clearTransferRedisState,
} from "../helpers/transfer-authorization.helper.js";

/**
 * POST /api/v1/gate/verify-tag
 */
export async function verifyTagAtGate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { epc, gateId, direction } = req.body as {
      epc?: string;
      gateId?: string;
      direction?: string;
    };

    if (!epc) {
      res.status(400).json({
        success: false,
        error: { message: "epc is required" },
      });
      return;
    }

    const epcUpper = epc.toUpperCase().trim();
    // let transferId: string | null = null;
    // 1. Shared, DB-verified anti-theft decision (identical to transit-door).
    const verdicts = await assessTransitAuthorization([epcUpper]);
    const verdict = verdicts.get(epcUpper)!;
    const transferId = verdict.transferId;

    // 1. Redis lookup
    try {
      // 2. Decision — the DB transfer status is the authority.
      if (verdict.status !== "AUTHORIZED") {
        if (redis) {
          const keys = await redis.keys("transfer:TID-*");
          for (const key of keys) {
            const data = await redis.get(key);
            if (data) {
              const parsed = JSON.parse(data) as {
                transferId: string;
                epcs: string[];
              };
              if (parsed.epcs?.some((e) => e.toUpperCase() === epcUpper)) {
                transferId = parsed.transferId;
                break;
              }
            }
          }
        }
      }
    } catch (redisErr) {
      console.warn("[gate-verify] Redis lookup failed, fallback to DB", redisErr);
    }

    // 2. DB fallback
    if (!transferId) {
      const transferLine = await prisma.transferLine.findFirst({
        where: { epc: epcUpper },
        include: { transfer: true },
      });

      if (transferLine?.transfer?.status === TransferStatus.IN_TRANSIT) {
        transferId = transferLine.transfer.transferId;
      }
    }

    // 3. Decision
    if (!transferId) {
      try {
        await prisma.alert.create({
          data: {
            type: AlertType.GATE_UNAUTHORIZED_EXIT,
            alertType: AlertType.GATE_UNAUTHORIZED_EXIT,
            severity: AlertSeverity.CRITICAL,
            ref: epcUpper,
            message: `Tag ${epcUpper} attempted exit at gate ${gateId || "UNKNOWN"} without valid Transfer ID`,
            status: AlertStatus.OPEN,
            recipientRoles: `${ROLES.TRANSIT_MANAGER},${ROLES.SECURITY}`,
            channel: AlertChannel.IN_APP,
            payload: {
              epc: epcUpper,
              gateId: gateId ?? null,
              direction: direction ?? null,
              detectedAt: new Date().toISOString(),
            },
          },
        });
      } catch (alertErr) {
        console.error("[gate-verify] Alert creation failed", alertErr);
      }

      res.json({
        success: true,
        data: {
          valid: false,
          action: "ALARM",
          reason: "No active Transfer ID for this tag",
          epc: epcUpper,
          gateId: gateId ?? null,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        valid: true,
        action: "ALLOW",
        transferId,
        epc: epcUpper,
        gateId: gateId ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/transfer/:transferId/expected
 */
export async function getTransferExpectedTags(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const raw = req.params.transferId;
    const transferId = Array.isArray(raw) ? String(raw[0]) : String(raw);

    if (!transferId) {
      res.status(400).json({
        success: false,
        error: { message: "transferId is required" },
      });
      return;
    }

    let expectedEpcs: string[] = [];
    let destinationStore: string | null = null;

    // 1. Redis
    try {
      if (redis) {
        const data = await redis.get(`transfer:${transferId}`);
        if (data) {
          const parsed = JSON.parse(data) as {
            epcs?: string[];
            destinationStore?: string;
          };
          expectedEpcs = parsed.epcs ?? [];
          destinationStore = parsed.destinationStore ?? null;
        }
      }
    } catch (redisErr) {
      console.warn("[gate-verify] Redis get failed", redisErr);
    }

    // 2. DB fallback
    if (expectedEpcs.length === 0) {
      const transfer = await prisma.transfer.findUnique({
        where: { transferId },
        include: {
          lines: { select: { epc: true } },
        },
      });

      if (!transfer) {
        res.status(404).json({
          success: false,
          error: { message: `Transfer ${transferId} not found` },
        });
        return;
      }

      expectedEpcs = transfer.lines.map((l) => l.epc);
      destinationStore = transfer.toLocation ?? null;
    }

    res.json({
      success: true,
      data: {
        transferId,
        destinationStore,
        expectedCount: expectedEpcs.length,
        expectedEpcs,
      },
    });
  } catch (err) {
    next(err);
  }
}
/**
 * POST /api/v1/transfer/:transferId/receive
 * Holding receive audit — FOUND / MISSING / EXTRA
 * Body: { scannedEpcs: string[], receivedBy?: string }
 */
export async function submitHoldingAudit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const raw = req.params.transferId;
    const transferId = Array.isArray(raw) ? String(raw[0]) : String(raw);
    const { scannedEpcs } = req.body as { scannedEpcs?: string[] };

    if (!transferId) {
      res.status(400).json({ success: false, error: { message: "transferId required" } });
      return;
    }

    const scanned = [
      ...new Set((scannedEpcs || []).map((e) => String(e).toUpperCase().trim()).filter(Boolean)),
    ];

    // Expected nikalo (DB se — Redis se nahi taaki final truth DB ho)
    const transfer = await prisma.transfer.findUnique({
      where: { transferId },
      include: { lines: { select: { epc: true, packetTagId: true } } },
    });

    if (!transfer) {
      res
        .status(404)
        .json({ success: false, error: { message: `Transfer ${transferId} not found` } });
      return;
    }

    const expected = transfer.lines.map((l) => String(l.epc).toUpperCase().trim());
    const expectedSet = new Set(expected);
    const scannedSet = new Set(scanned);

    const found = expected.filter((e) => scannedSet.has(e));
    const missing = expected.filter((e) => !scannedSet.has(e));
    const extra = scanned.filter((e) => !expectedSet.has(e));

    // FOUND walo ko RECEIVED mark karo
    if (found.length > 0) {
      await prisma.packetTag.updateMany({
        where: { epc: { in: found }, isVoided: false },
        data: { status: PacketTagStatus.RECEIVED_AT_HOLDING },
      });
    }

    // Transfer status update
    let newStatus = TransferStatus.IN_TRANSIT;
    if (missing.length === 0 && extra.length === 0) {
      newStatus = TransferStatus.RECEIVED_AT_HOLDING;
    } else if (found.length > 0) {
      newStatus = TransferStatus.PARTIALLY_RECEIVED;
    }

    const transferUpdate: Prisma.TransferUpdateInput = {
      status: newStatus,
      ...(newStatus === TransferStatus.RECEIVED_AT_HOLDING ? { receivedAt: new Date() } : {}),
    };

    await prisma.transfer.update({
      where: { transferId },
      data: transferUpdate,
    });

    // Transfer no longer eligible to authorize a transit exit → clear its
    // anti-theft Redis state (fail-open; 24h TTL is the safety net).
    if (newStatus !== TransferStatus.IN_TRANSIT) {
      await clearTransferRedisState(transferId, expected);
    }

    // Missing ke liye alert
    if (missing.length > 0) {
      try {
        await prisma.alert.create({
          data: {
            type: AlertType.HOLDING_SHORT_RECEIPT,
            alertType: AlertType.HOLDING_SHORT_RECEIPT,
            severity: AlertSeverity.CRITICAL,
            ref: transferId,
            message: `Transfer ${transferId}: ${missing.length} tags missing at holding`,
            status: AlertStatus.OPEN,
            recipientRoles: `${ROLES.TRANSIT_MANAGER},${ROLES.HOLDING_MANAGER}`,
            channel: AlertChannel.IN_APP,
            payload: { transferId, found: found.length, missing, extra },
          },
        });
      } catch {
        console.warn("[gate-verify] short-receipt alert creation failed");
      }
    }

    res.json({
      success: true,
      data: {
        transferId,
        expectedCount: expected.length,
        scannedCount: scanned.length,
        foundCount: found.length,
        missingCount: missing.length,
        extraCount: extra.length,
        found,
        missing,
        extra,
        status: newStatus,
      },
    });
  } catch (err) {
    next(err);
  }
}
