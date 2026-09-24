import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { devicesService } from "../services/devices.service.js";

export const listDevices = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = req.query as { deviceType?: string; location?: string; isActive?: string };
    const result = await devicesService.listDevices(
      {
        deviceType: q.deviceType,
        location: q.location,
        isActive: q.isActive === undefined ? undefined : q.isActive === "true",
      },
      req.auditCtx,
    );
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const getDevice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { deviceId } = req.params as { deviceId: string };
    const result = await devicesService.getDevice(deviceId, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const createDevice = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await devicesService.createDevice(
      req.body as Parameters<typeof devicesService.createDevice>[0],
      req.user!,
      req.auditCtx,
    );
    success(res, result, 201, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const updateDevice = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { deviceId } = req.params as { deviceId: string };
    const result = await devicesService.updateDevice(
      deviceId,
      req.body as Parameters<typeof devicesService.updateDevice>[1],
      req.user!,
      req.auditCtx,
    );
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const deactivateDevice = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { deviceId } = req.params as { deviceId: string };
    const result = await devicesService.deactivateDevice(deviceId, req.user!, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const heartbeat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { deviceId } = req.params as { deviceId: string };
    await devicesService.heartbeat(deviceId);
    success(res, { ok: true }, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const readFromDevice = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { deviceId } = req.params as { deviceId: string };
    const result = await devicesService.readFromDevice(
      deviceId,
      req.body as Parameters<typeof devicesService.readFromDevice>[1],
      req.user!,
      req.auditCtx,
    );
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};
