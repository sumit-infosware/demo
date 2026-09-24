import { z } from "zod";
import { CONTROLLER_PROTOCOLS, DEVICE_LOCATIONS, DEVICE_TYPES } from "../constants/device-types.js";

const deviceTypeEnum = z.enum([
  DEVICE_TYPES.WEIGHING,
  DEVICE_TYPES.REEL_COUNTER,
  DEVICE_TYPES.RFID_READER_DESKTOP,
  DEVICE_TYPES.RFID_READER_FIXED,
  DEVICE_TYPES.RFID_READER_GATE,
  DEVICE_TYPES.PRINTER,
  DEVICE_TYPES.HANDHELD,
  DEVICE_TYPES.TRANSIT_DOOR_READER,
]);

const locationEnum = z.enum([
  DEVICE_LOCATIONS.TRANSIT,
  DEVICE_LOCATIONS.HOLDING,
  DEVICE_LOCATIONS.GATE,
  DEVICE_LOCATIONS.DOCK,
]);

const protocolEnum = z.enum([
  CONTROLLER_PROTOCOLS.HTTP,
  CONTROLLER_PROTOCOLS.MODBUS_TCP,
  CONTROLLER_PROTOCOLS.SERIAL_TCP,
  CONTROLLER_PROTOCOLS.MQTT,
]);

export const createDeviceSchema = z.object({
  deviceId: z.string().min(1).max(100),
  deviceType: deviceTypeEnum,
  location: locationEnum,
  displayName: z.string().min(1).max(200),
  controllerHost: z.string().min(1).max(100),
  controllerPort: z.number().int().min(1).max(65535),
  controllerProtocol: protocolEnum.default(CONTROLLER_PROTOCOLS.HTTP),
  machineIdOnController: z.string().max(100).optional(),
  endpointPath: z.string().max(200).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const updateDeviceSchema = createDeviceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listDevicesQuerySchema = z.object({
  deviceType: deviceTypeEnum.optional(),
  location: locationEnum.optional(),
  isActive: z.coerce.boolean().optional(),
});

export const deviceIdParamSchema = z.object({
  deviceId: z.string().min(1).max(100),
});

export const deviceReadSchema = z.object({
  packetTagId: z.string().regex(/^\d+$/).optional(),
  requestType: z.enum(["weight", "reel_count", "read_epc"]),
  params: z.record(z.string(), z.unknown()).optional(),
});
