export interface DeviceDto {
  id: string;
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
}

export interface DeviceReadRequest {
  packetTagId?: string;
  requestType: "weight" | "reel_count" | "read_epc";
  params?: Record<string, unknown>;
}

export interface DeviceReadResponse {
  deviceId: string;
  reading: number;
  unit: string;
  timestamp: string;
  raw?: unknown;
}
