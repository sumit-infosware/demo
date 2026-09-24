import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { ConflictError, NotFoundError } from "../errors/errors.js";
import { deviceCaller } from "../helpers/device-caller.helper.js";
import { devicesRepository } from "../repositories/devices.repository.js";
import type { DeviceDto, DeviceReadRequest, DeviceReadResponse } from "../types/devices.types.js";

const { findByDeviceId, list, create, update, deactivate, updateLastSeen } = devicesRepository;

type Actor = { userId: string; email?: string };

function toDeviceDto(d: {
  id: bigint;
  deviceId: string;
  deviceType: string;
  location: string;
  displayName: string;
  controllerHost: string;
  controllerPort: number;
  controllerProtocol: string;
  machineIdOnController: string | null;
  endpointPath: string | null;
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
}): DeviceDto {
  return {
    id: d.id.toString(),
    deviceId: d.deviceId,
    deviceType: d.deviceType,
    location: d.location,
    displayName: d.displayName,
    controllerHost: d.controllerHost,
    controllerPort: d.controllerPort,
    controllerProtocol: d.controllerProtocol,
    machineIdOnController: d.machineIdOnController,
    endpointPath: d.endpointPath,
    isActive: d.isActive,
    lastSeenAt: d.lastSeenAt,
    createdAt: d.createdAt,
  };
}

export const devicesService = {
  listDevices: async (
    filters: { deviceType?: string; location?: string; isActive?: boolean },
    auditCtx?: AuditContext,
  ) => {
    const devices = await list(filters);
    await writeAudit(auditCtx, {
      action: AuditAction.DEVICE_LIST,
      resource: AuditResource.DEVICE,
      result: AuditResult.SUCCESS,
    });
    return { devices: devices.map(toDeviceDto), total: devices.length };
  },

  getDevice: async (deviceId: string, auditCtx?: AuditContext) => {
    const device = await findByDeviceId(deviceId);
    if (!device) throw new NotFoundError(`Device ${deviceId}`);
    await writeAudit(auditCtx, {
      action: AuditAction.DEVICE_READ,
      resource: AuditResource.DEVICE,
      resourceId: deviceId,
      result: AuditResult.SUCCESS,
    });
    return toDeviceDto(device);
  },

  createDevice: async (
    data: {
      deviceId: string;
      deviceType: string;
      location: string;
      displayName: string;
      controllerHost: string;
      controllerPort: number;
      controllerProtocol: string;
      machineIdOnController?: string;
      endpointPath?: string;
    },
    _actor: Actor,
    auditCtx?: AuditContext,
  ) => {
    const existing = await findByDeviceId(data.deviceId);
    if (existing) throw new ConflictError(`Device ${data.deviceId} already exists`);

    const device = await create(data);
    await writeAudit(auditCtx, {
      action: AuditAction.DEVICE_CREATE,
      resource: AuditResource.DEVICE,
      resourceId: data.deviceId,
      result: AuditResult.SUCCESS,
      meta: { deviceType: data.deviceType, location: data.location },
    });
    return toDeviceDto(device);
  },

  updateDevice: async (
    deviceId: string,
    data: Partial<{
      deviceType: string;
      location: string;
      displayName: string;
      controllerHost: string;
      controllerPort: number;
      controllerProtocol: string;
      machineIdOnController: string;
      endpointPath: string;
      isActive: boolean;
    }>,
    _actor: Actor,
    auditCtx?: AuditContext,
  ) => {
    const existing = await findByDeviceId(deviceId);
    if (!existing) throw new NotFoundError(`Device ${deviceId}`);

    const updated = await update(deviceId, data);
    await writeAudit(auditCtx, {
      action: AuditAction.DEVICE_UPDATE,
      resource: AuditResource.DEVICE,
      resourceId: deviceId,
      result: AuditResult.SUCCESS,
      meta: { changedFields: Object.keys(data) },
    });
    return toDeviceDto(updated);
  },

  deactivateDevice: async (deviceId: string, _actor: Actor, auditCtx?: AuditContext) => {
    const existing = await findByDeviceId(deviceId);
    if (!existing) throw new NotFoundError(`Device ${deviceId}`);

    const deactivated = await deactivate(deviceId);
    await writeAudit(auditCtx, {
      action: AuditAction.DEVICE_DEACTIVATE,
      resource: AuditResource.DEVICE,
      resourceId: deviceId,
      result: AuditResult.SUCCESS,
    });
    return toDeviceDto(deactivated);
  },

  heartbeat: async (deviceId: string): Promise<void> => {
    const existing = await findByDeviceId(deviceId);
    if (!existing) throw new NotFoundError(`Device ${deviceId}`);
    await updateLastSeen(deviceId);
  },

  readFromDevice: async (
    deviceId: string,
    request: DeviceReadRequest,
    _actor: Actor,
    auditCtx?: AuditContext,
  ): Promise<DeviceReadResponse> => {
    const device = await findByDeviceId(deviceId);
    if (!device) throw new NotFoundError(`Device ${deviceId}`);
    if (!device.isActive) {
      throw new ConflictError(`Device ${deviceId} is deactivated`);
    }

    const response = await deviceCaller.call(device, request);

    await updateLastSeen(deviceId);

    await writeAudit(auditCtx, {
      action: AuditAction.DEVICE_INVOKE,
      resource: AuditResource.DEVICE,
      resourceId: deviceId,
      result: AuditResult.SUCCESS,
      meta: { requestType: request.requestType, reading: response.reading },
    });

    return response;
  },
};
