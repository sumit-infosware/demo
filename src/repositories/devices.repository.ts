import type { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma } from "../config/clients.js";

const deviceSelect = {
  id: true,
  deviceId: true,
  deviceType: true,
  location: true,
  displayName: true,
  controllerHost: true,
  controllerPort: true,
  controllerProtocol: true,
  machineIdOnController: true,
  endpointPath: true,
  config: true,
  isActive: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const devicesRepository = {
  findByDeviceId: (deviceId: string) =>
    prisma.deviceRegistry.findUnique({
      where: { deviceId },
      select: deviceSelect,
    }),

  list: (filters: { deviceType?: string; location?: string; isActive?: boolean }) => {
    const where: Prisma.DeviceRegistryWhereInput = {
      ...(filters.deviceType && { deviceType: filters.deviceType }),
      ...(filters.location && { location: filters.location }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    };
    return prisma.deviceRegistry.findMany({
      where,
      orderBy: [{ location: "asc" }, { deviceId: "asc" }],
      select: deviceSelect,
    });
  },

  create: (data: {
    deviceId: string;
    deviceType: string;
    location: string;
    displayName: string;
    controllerHost: string;
    controllerPort: number;
    controllerProtocol: string;
    machineIdOnController?: string;
    endpointPath?: string;
    config?: Prisma.InputJsonValue;
  }) =>
    prisma.deviceRegistry.create({
      data,
      select: deviceSelect,
    }),

  update: (
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
  ) =>
    prisma.deviceRegistry.update({
      where: { deviceId },
      data,
      select: deviceSelect,
    }),

  deactivate: (deviceId: string) =>
    prisma.deviceRegistry.update({
      where: { deviceId },
      data: { isActive: false },
      select: deviceSelect,
    }),

  updateLastSeen: (deviceId: string) =>
    prisma.deviceRegistry.update({
      where: { deviceId },
      data: { lastSeenAt: new Date() },
      select: deviceSelect,
    }),
};
