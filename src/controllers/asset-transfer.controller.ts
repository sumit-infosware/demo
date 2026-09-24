import type { NextFunction, Request, Response } from "express";
import { toJsonSafe } from "../helpers/json-serializer.helper.js";
import { assetTransferService } from "../services/asset-transfer.service.js";

function sendSuccess<T>(
  res: Response,
  data: T,
  message: string,
  status: number,
  requestId?: string,
): void {
  const body: Record<string, unknown> = { success: true, message, data };
  if (requestId) body.requestId = requestId;
  res.status(status).json(toJsonSafe(body));
}

export const listTransfers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await assetTransferService.listTransfers();
    sendSuccess(res, result, "Transfers retrieved successfully", 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const getSyncLocations = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await assetTransferService.getSyncLocations();
    sendSuccess(res, result, "Storage locations retrieved successfully", 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const getTransferAllItems = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { transferId } = req.params as { transferId: string };
    const result = await assetTransferService.getTransferAllItems(transferId);
    sendSuccess(res, result, "items fetch successfully", 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const getFlatTagByEpc = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { epc } = req.params as { epc: string };
    const result = await assetTransferService.getTagByEpcFlat(epc);
    sendSuccess(res, result, "Tag details retrieved successfully", 200, req.requestId);
  } catch (e) {
    next(e);
  }
};
