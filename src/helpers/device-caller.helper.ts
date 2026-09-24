import { logger } from "../config/logger.js";
import { CONTROLLER_PROTOCOLS } from "../constants/device-types.js";
import { AppError } from "../errors/errors.js";
import type { DeviceReadRequest, DeviceReadResponse } from "../types/devices.types.js";

interface Device {
  deviceId: string;
  controllerHost: string;
  controllerPort: number;
  controllerProtocol: string;
  machineIdOnController: string | null;
  endpointPath: string | null;
}

/**
 * Calls the physical device via its controller.
 * Supports multiple protocols (HTTP, Modbus, Serial-over-TCP).
 * Currently only HTTP is implemented — others are stubs for future.
 */
export const deviceCaller = {
  async sendPlan(device: Device, payload: Record<string, unknown>): Promise<void> {
    if (device.controllerProtocol !== CONTROLLER_PROTOCOLS.HTTP) {
      throw new AppError(
        `Plan delivery is not supported for protocol ${device.controllerProtocol}`,
        501,
        "NOT_IMPLEMENTED",
      );
    }

    const path = device.endpointPath || "/plan";
    const url = `http://${device.controllerHost}:${device.controllerPort}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineId: device.machineIdOnController,
          action: "download_plan",
          plan: payload,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AppError(`Controller returned HTTP ${response.status}`, 502, "CONTROLLER_ERROR");
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error({ err, deviceId: device.deviceId, url }, "Plan delivery failed");
      throw new AppError(
        `Failed to deliver plan to device ${device.deviceId}: ${(err as Error).message}`,
        503,
        "DEVICE_UNREACHABLE",
      );
    } finally {
      clearTimeout(timeout);
    }
  },

  async call(device: Device, request: DeviceReadRequest): Promise<DeviceReadResponse> {
    switch (device.controllerProtocol) {
      case CONTROLLER_PROTOCOLS.HTTP:
        return await callHttp(device, request);
      case CONTROLLER_PROTOCOLS.MODBUS_TCP:
        throw new AppError("Modbus TCP not yet implemented", 501, "NOT_IMPLEMENTED");
      case CONTROLLER_PROTOCOLS.SERIAL_TCP:
        throw new AppError("Serial TCP not yet implemented", 501, "NOT_IMPLEMENTED");
      case CONTROLLER_PROTOCOLS.MQTT:
        throw new AppError("MQTT not yet implemented", 501, "NOT_IMPLEMENTED");
      default:
        throw new AppError(
          `Unknown protocol: ${device.controllerProtocol}`,
          400,
          "UNKNOWN_PROTOCOL",
        );
    }
  },
};

async function callHttp(device: Device, request: DeviceReadRequest): Promise<DeviceReadResponse> {
  const path = device.endpointPath || "/read";
  const url = `http://${device.controllerHost}:${device.controllerPort}${path}`;

  const body = {
    machineId: device.machineIdOnController,
    action: request.requestType,
    ...(request.params || {}),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new AppError(`Controller returned HTTP ${response.status}`, 502, "CONTROLLER_ERROR");
    }

    const data = (await response.json()) as {
      value?: number;
      unit?: string;
      [k: string]: unknown;
    };

    if (typeof data.value !== "number") {
      throw new AppError(
        "Invalid response from controller — missing 'value' field",
        502,
        "CONTROLLER_ERROR",
      );
    }

    return {
      deviceId: device.deviceId,
      reading: data.value,
      unit: (data.unit as string) || "unknown",
      timestamp: new Date().toISOString(),
      raw: data,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ err, deviceId: device.deviceId, url }, "Device call failed");
    throw new AppError(
      `Failed to reach device ${device.deviceId}: ${(err as Error).message}`,
      503,
      "DEVICE_UNREACHABLE",
    );
  }
}
