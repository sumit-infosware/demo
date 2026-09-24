import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { toJsonSafe } from "../helpers/json-serializer.helper.js";
import { ValidationError } from "../errors/errors.js";
import { tagService } from "../services/tags.service.js";
import { assetTransferService } from "../services/asset-transfer.service.js";
import type { GenerateTagInput } from "../types/tags.types.js";

// ─────────────────────────────────────────────────────────────
// v2.0 Controllers (Diagram-aligned)
// ─────────────────────────────────────────────────────────────

export const getAvailableColours = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const result = tagService.getAvailableColours();
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const generateTag = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await tagService.generateTag(
      req.body as GenerateTagInput,
      req.user!,
      req.auditCtx,
    );
    success(res, result, 201, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const markPrinted = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const result = await tagService.markPrinted(id, req.user!, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const voidTagAndReprint = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason: string };
    const result = await tagService.voidTagAndReprint(id, reason, req.user!, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const attachTopMarkingPhoto = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const { photoUrl } = req.body as { photoUrl: string };
    const result = await tagService.attachTopMarkingPhoto(id, photoUrl, req.user!, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

// ─────────────────────────────────────────────────────────────
// v1.0 Legacy Controllers (kept for backward compatibility)
// ─────────────────────────────────────────────────────────────

/**
 * DEPRECATED: Bulk startTagging removed in v2.0 flow.
 * Frontend should call POST /tags/generate per packet after line-count.
 */
export const startTagging = (_req: Request, _res: Response, next: NextFunction): void => {
  next(
    new ValidationError(
      "Deprecated endpoint. Use POST /tags/generate per packet after completing Line Count. For serialized items, call generate once per serial number.",
    ),
  );
};

export const commissionTag = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const { readBackEpc } = req.body as { readBackEpc: string };
    const result = await tagService.commissionTag(id, { readBackEpc }, req.user!, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const getLabel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const result = await tagService.getLabel(id);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const getTagById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    if (/^\d+$/.test(id)) {
      const result = await tagService.getTagById(id);
      success(res, result, 200, req.requestId);
      return;
    }

    // Non-numeric → treated as an RFID EPC lookup.
    const result = await assetTransferService.getTagByEpc(id);
    const body: Record<string, unknown> = {
      success: true,
      message: "Tag details retrieved successfully",
      data: result,
    };
    if (req.requestId) body.requestId = req.requestId;
    res.status(200).json(toJsonSafe(body));
  } catch (e) {
    next(e);
  }
};

export const getTagsByLine = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { rrLineId } = req.params as { rrLineId: string };
    const result = await tagService.getTagsByLine(rrLineId);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const listTags = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = req.query as {
      rrLineId?: string;
      status?: string;
      page?: string;
      limit?: string;
    };
    const result = await tagService.listTags({
      rrLineId: q.rrLineId,
      status: q.status,
      page: Number(q.page ?? 1),
      limit: Number(q.limit ?? 50),
    });
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};
