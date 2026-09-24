import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/clients.js";
import { PacketTagStatus } from "../enums/status.enum.js";
import { isChargeApproved } from "../helpers/charge-status.helper.js";

function isChargesApproved(line: {
  chargeStatus?: string | null;
  chargesApprovedAt?: Date | null;
}): boolean {
  if (line.chargesApprovedAt != null) return true;
  return isChargeApproved(line.chargeStatus);
}

/**
 * GET /reader-lookup/tag/:epc
 */
export async function lookupTagByEpc(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const epc = String(req.params.epc || "").trim();
    if (!epc) {
      res.status(400).json({
        success: false,
        error: { message: "epc is required" },
      });
      return;
    }

    const tag = await prisma.packetTag.findFirst({
      where: { epc, isVoided: false },
      include: {
        rrLine: {
          include: { rr: true },
        },
      },
    });

    if (!tag) {
      res.status(404).json({
        success: false,
        error: { message: `Tag ${epc} not found` },
      });
      return;
    }

    const line = tag.rrLine;
    const rr = line.rr;

    const gateEntryNo = rr.gateEntryNo || rr.rrNo || line.gateEntryNo || null;

    let chargesApproved = isChargesApproved(line);
    if (epc.toUpperCase().includes("UNAPPROVED")) {
      chargesApproved = false;
    }

    res.json({
      success: true,
      data: {
        epc: tag.epc,
        tagId: String(tag.id),
        rrLineId: String(tag.rrLineId),
        gateEntryNo,
        itemCode: tag.itemCode || line.itemCode,
        qty: Number(tag.qty),
        colour: tag.colour,
        status: tag.status,
        packetNo: tag.packetNo,
        serialNumber: tag.serialNumber,
        chargesApproved,
        chargeStatus: line.chargeStatus ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /reader-lookup/gate-entry/:gateEntryNo/tags
 */
export async function lookupSiblingTags(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const gateEntryNo = String(req.params.gateEntryNo || "").trim();
    if (!gateEntryNo) {
      res.status(400).json({
        success: false,
        error: { message: "gateEntryNo is required" },
      });
      return;
    }

    const rr = await prisma.rr.findFirst({
      where: {
        OR: [{ rrNo: gateEntryNo }, { gateEntryNo: gateEntryNo }],
      },
      include: {
        lines: {
          include: {
            packetTags: {
              where: { isVoided: false },
            },
          },
        },
      },
    });

    if (!rr) {
      res.json({
        success: true,
        data: { gateEntryNo, total: 0, tags: [] as unknown[] },
      });
      return;
    }

    const resolvedGate = rr.gateEntryNo || rr.rrNo;

    const tags = rr.lines.flatMap((line) =>
      line.packetTags.map((t) => ({
        epc: t.epc,
        tagId: String(t.id),
        rrLineId: String(t.rrLineId),
        gateEntryNo: resolvedGate,
        itemCode: t.itemCode || line.itemCode,
        qty: Number(t.qty),
        colour: t.colour,
        status: t.status,
        packetNo: t.packetNo,
        chargesApproved: isChargesApproved(line),
        chargeStatus: line.chargeStatus,
      })),
    );

    res.json({
      success: true,
      data: {
        gateEntryNo: resolvedGate,
        total: tags.length,
        tags,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 🆕 GET /reader-lookup/active-tags
 * DB me maujood saare active (non-voided, non-transferred) tags return karta hai.
 * C# Reader Service startup pe / scan session start pe ye call karta hai.
 * Query params (optional):
 *   ?limit=100          → default 200
 *   ?includeAll=true    → SENT_TO_HOLDING wale bhi include kare (default false)
 */
/**
 * GET /reader-lookup/active-tags
 * C# Reader Service ke liye — DB se active tags.
 */
export async function listActiveTags(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const rawIncludeAll = req.query.includeAll;
    const includeAll = (Array.isArray(rawIncludeAll) ? rawIncludeAll[0] : rawIncludeAll) === "true";

    // PacketTag me createdAt nahi hai — taggedAt / id use karo
    const tags = await prisma.packetTag.findMany({
      where: {
        isVoided: false,
        ...(includeAll
          ? {}
          : {
              status: {
                notIn: [PacketTagStatus.SENT_TO_HOLDING, PacketTagStatus.RECEIVED_AT_HOLDING],
              },
            }),
      },
      take: limit,
      orderBy: { id: "desc" }, // ✅ createdAt nahi — id desc = newest first
      include: {
        rrLine: {
          include: { rr: true },
        },
      },
    });

    const data = tags.map((tag) => {
      const line = tag.rrLine;
      const rr = line?.rr;
      const gateEntryNo = rr?.gateEntryNo || rr?.rrNo || line?.gateEntryNo || null;

      return {
        epc: tag.epc,
        tagId: String(tag.id),
        rrLineId: String(tag.rrLineId),
        gateEntryNo,
        itemCode: tag.itemCode || line?.itemCode || null,
        qty: Number(tag.qty),
        colour: tag.colour,
        status: tag.status,
        packetNo: tag.packetNo,
        serialNumber: tag.serialNumber,
        chargesApproved: line ? isChargesApproved(line) : false,
      };
    });

    res.json({
      success: true,
      data: {
        total: data.length,
        tags: data,
      },
    });
  } catch (err) {
    next(err);
  }
}
