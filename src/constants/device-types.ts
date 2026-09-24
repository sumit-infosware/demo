/**
 * Device type and location constants for the device_registry.
 */
export const DEVICE_TYPES = {
  WEIGHING: "WEIGHING",
  REEL_COUNTER: "REEL_COUNTER",
  RFID_READER_DESKTOP: "RFID_READER_DESKTOP",
  RFID_READER_FIXED: "RFID_READER_FIXED",
  RFID_READER_GATE: "RFID_READER_GATE",
  PRINTER: "PRINTER",
  HANDHELD: "HANDHELD",
  TRANSIT_DOOR_READER: "TRANSIT_DOOR_READER",
} as const;

export type DeviceType = (typeof DEVICE_TYPES)[keyof typeof DEVICE_TYPES];

export const DEVICE_LOCATIONS = {
  TRANSIT: "TRANSIT",
  HOLDING: "HOLDING",
  GATE: "GATE",
  DOCK: "DOCK",
} as const;

export type DeviceLocation = (typeof DEVICE_LOCATIONS)[keyof typeof DEVICE_LOCATIONS];

export const CONTROLLER_PROTOCOLS = {
  HTTP: "HTTP",
  MODBUS_TCP: "MODBUS_TCP",
  SERIAL_TCP: "SERIAL_TCP",
  MQTT: "MQTT",
} as const;

export type ControllerProtocol = (typeof CONTROLLER_PROTOCOLS)[keyof typeof CONTROLLER_PROTOCOLS];

export const COUNTING_METHODS = {
  MANUAL: "MANUAL",
  WEIGHT: "WEIGHT",
  REEL: "REEL",
} as const;

export type CountingMethod = (typeof COUNTING_METHODS)[keyof typeof COUNTING_METHODS];
