import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/clients.js";
import { PhotoRequestStatus } from "../enums/status.enum.js";
import { NotFoundError, ValidationError } from "../errors/errors.js";
import { saveSessionPhoto } from "../helpers/photo-storage.helper.js";
import { success } from "../http/ApiResponse.js";
import { handheldService } from "../services/handheld.service.js";

/**
 * POST /handheld/photo-request
 * Called from frontend BEFORE tag is generated.
 * Body: { sessionId, packetIndex?, rrLineId?, itemCode?, totalPhotos }
 */
export async function createPhotoRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { sessionId, packetIndex, rrLineId, itemCode, totalPhotos } = req.body as {
      sessionId?: string;
      packetIndex?: number;
      rrLineId?: string;
      itemCode?: string;
      totalPhotos?: number;
    };

    if (!sessionId || sessionId.trim().length === 0) {
      throw new ValidationError("sessionId required");
    }

    const count = Math.min(3, Math.max(1, Number(totalPhotos) || 1));

    // Optional enrichment: if rrLineId given, fetch itemCode for handheld UI
    let resolvedItemCode = itemCode;
    if (!resolvedItemCode && rrLineId) {
      try {
        const line = await prisma.rrLine.findUnique({
          where: { id: BigInt(rrLineId) },
          select: { itemCode: true },
        });
        if (line) resolvedItemCode = line.itemCode;
      } catch {
        /* non-fatal */
      }
    }

    const created = handheldService.create({
      sessionId: sessionId.trim(),
      packetIndex,
      rrLineId,
      itemCode: resolvedItemCode,
      totalPhotos: count,
      createdBy: req.user?.userId,
    });

    success(res, created, 201, req.requestId);
  } catch (e) {
    next(e);
  }
}

/**
 * GET /handheld/pending-requests?deviceId=C72-01
 * Called every ~2s by the handheld browser page.
 */
export function pendingRequests(req: Request, res: Response, next: NextFunction): void {
  try {
    const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId : undefined;
    const list = handheldService.pendingForDevice(deviceId);
    success(res, { count: list.length, requests: list }, 200, req.requestId);
  } catch (e) {
    next(e);
  }
}

/**
 * GET /handheld/request/:id/status
 * Frontend polls this to see progress.
 */
export function getRequestStatus(req: Request, res: Response, next: NextFunction): void {
  try {
    const { id } = req.params as { id: string };
    const r = handheldService.get(id);
    if (!r) throw new NotFoundError("Photo request");
    success(res, r, 200, req.requestId);
  } catch (e) {
    next(e);
  }
}

/**
 * POST /handheld/submit-photo
 * Handheld uploads a single photo.
 * Body: { requestId, sequence, photoBase64, deviceId? }
 * Saved to uploads/sessions/{sessionId}/tmp-{seq}.jpg
 */
export async function submitPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { requestId, sequence, photoBase64, deviceId } = req.body as {
      requestId?: string;
      sequence?: number;
      photoBase64?: string;
      deviceId?: string;
    };

    if (!requestId || !photoBase64 || !sequence) {
      throw new ValidationError("requestId, sequence, photoBase64 all required");
    }

    const request = handheldService.get(requestId);
    if (!request) throw new NotFoundError("Photo request");

    if (
      request.status === PhotoRequestStatus.COMPLETED ||
      request.status === PhotoRequestStatus.CANCELLED ||
      request.status === PhotoRequestStatus.CONSUMED
    ) {
      throw new ValidationError(`Cannot submit photo — request is ${request.status}`);
    }

    const stored = await saveSessionPhoto(request.sessionId, Number(sequence), photoBase64);

    const updated = handheldService.addPhoto(
      requestId,
      {
        sequence: stored.sequence,
        url: stored.url,
        path: stored.path,
        capturedAt: stored.capturedAt,
      },
      deviceId,
    );

    success(res, updated, 200, req.requestId);
  } catch (e) {
    next(e);
  }
}

/**
 * POST /handheld/request/:id/cancel
 */
export function cancelRequest(req: Request, res: Response, next: NextFunction): void {
  try {
    const { id } = req.params as { id: string };
    const r = handheldService.cancel(id);
    success(res, { requestId: id, status: r?.status ?? "NOT_FOUND" }, 200, req.requestId);
  } catch (e) {
    next(e);
  }
}
