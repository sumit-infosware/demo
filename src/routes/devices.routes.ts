import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  createDevice,
  deactivateDevice,
  getDevice,
  heartbeat,
  listDevices,
  readFromDevice,
  updateDevice,
} from "../controllers/devices.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { audit } from "../middleware/audit.middleware.js";
import { validate } from "../middleware/http.middleware.js";
import {
  createDeviceSchema,
  deviceIdParamSchema,
  deviceReadSchema,
  listDevicesQuerySchema,
  updateDeviceSchema,
} from "../schemas/devices.schemas.js";

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * tags:
 *   - name: Devices
 *     description: Device registry — physical hardware management (weighing machines, reel counters, RFID readers, printers)
 */

/**
 * @openapi
 * /devices:
 *   get:
 *     summary: List devices
 *     description: Returns all registered devices with optional filtering by type, location, and active status.
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: deviceType
 *         schema: { type: string, enum: [WEIGHING, REEL_COUNTER, RFID_READER_DESKTOP, RFID_READER_FIXED, RFID_READER_GATE, PRINTER, HANDHELD] }
 *       - in: query
 *         name: location
 *         schema: { type: string, enum: [TRANSIT, HOLDING, GATE, DOCK] }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       '200': { description: Devices retrieved successfully }
 *       '401': { description: Unauthorized }
 *       '403': { description: Forbidden }
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.DEVICE_READ),
  validate(listDevicesQuerySchema, "query"),
  listDevices,
);

/**
 * @openapi
 * /devices:
 *   post:
 *     summary: Register a new device
 *     description: Admin-only endpoint to register a new hardware device in the SITS registry.
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceId, deviceType, location, displayName, controllerHost, controllerPort]
 *             properties:
 *               deviceId: { type: string, example: "WM-TRANSIT-03" }
 *               deviceType: { type: string, enum: [WEIGHING, REEL_COUNTER, RFID_READER_DESKTOP, RFID_READER_FIXED, RFID_READER_GATE, PRINTER, HANDHELD] }
 *               location: { type: string, enum: [TRANSIT, HOLDING, GATE, DOCK] }
 *               displayName: { type: string, example: "Weighing Machine - Bay 3" }
 *               controllerHost: { type: string, example: "192.168.1.50" }
 *               controllerPort: { type: integer, example: 8080 }
 *               controllerProtocol: { type: string, enum: [HTTP, MODBUS_TCP, SERIAL_TCP, MQTT], default: "HTTP" }
 *               machineIdOnController: { type: string, example: "MACHINE_3" }
 *               endpointPath: { type: string, example: "/read" }
 *     responses:
 *       '201': { description: Device registered successfully }
 *       '400': { description: Validation error }
 *       '409': { description: Device already exists }
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.DEVICE_MANAGE),
  validate(createDeviceSchema),
  audit,
  createDevice,
);

/**
 * @openapi
 * /devices/{deviceId}/heartbeat:
 *   post:
 *     summary: Device heartbeat ping
 *     description: Device pings backend to update last-seen timestamp (health monitoring).
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema: { type: string, example: "WM-TRANSIT-01" }
 *     responses:
 *       '200': { description: Heartbeat recorded }
 *       '404': { description: Device not found }
 */
router.post(
  "/:deviceId/heartbeat",
  requirePermission(PERMISSIONS.DEVICE_READ),
  validate(deviceIdParamSchema, "params"),
  heartbeat,
);

/**
 * @openapi
 * /devices/{deviceId}/read:
 *   post:
 *     summary: Invoke a physical device to read data
 *     description: >
 *       Backend forwards a read request to the device's controller. For weighing machines returns weight,
 *       for reel counters returns count, for RFID readers returns EPC.
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema: { type: string, example: "WM-TRANSIT-01" }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestType]
 *             properties:
 *               requestType: { type: string, enum: [weight, reel_count, read_epc] }
 *               packetTagId: { type: string, example: "1" }
 *               params: { type: object }
 *     responses:
 *       '200':
 *         description: Reading returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deviceId: { type: string }
 *                 reading: { type: number, example: 3.02 }
 *                 unit: { type: string, example: "kg" }
 *                 timestamp: { type: string }
 *       '404': { description: Device not found }
 *       '503': { description: Device unreachable }
 */
router.post(
  "/:deviceId/read",
  requirePermission(PERMISSIONS.DEVICE_INVOKE),
  validate(deviceIdParamSchema, "params"),
  validate(deviceReadSchema),
  audit,
  readFromDevice,
);

/**
 * @openapi
 * /devices/{deviceId}:
 *   patch:
 *     summary: Update device configuration
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName: { type: string }
 *               controllerHost: { type: string }
 *               controllerPort: { type: integer }
 *               isActive: { type: boolean }
 *     responses:
 *       '200': { description: Device updated }
 *       '404': { description: Device not found }
 */
router.patch(
  "/:deviceId",
  requirePermission(PERMISSIONS.DEVICE_MANAGE),
  validate(deviceIdParamSchema, "params"),
  validate(updateDeviceSchema),
  audit,
  updateDevice,
);

/**
 * @openapi
 * /devices/{deviceId}:
 *   delete:
 *     summary: Deactivate a device
 *     description: Soft-deactivates a device (sets isActive=false).
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200': { description: Device deactivated }
 *       '404': { description: Device not found }
 */
router.delete(
  "/:deviceId",
  requirePermission(PERMISSIONS.DEVICE_MANAGE),
  validate(deviceIdParamSchema, "params"),
  audit,
  deactivateDevice,
);

/**
 * @openapi
 * /devices/{deviceId}:
 *   get:
 *     summary: Get device by ID
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema: { type: string, example: "WM-TRANSIT-01" }
 *     responses:
 *       '200': { description: Device details }
 *       '404': { description: Device not found }
 */
router.get(
  "/:deviceId",
  requirePermission(PERMISSIONS.DEVICE_READ),
  validate(deviceIdParamSchema, "params"),
  getDevice,
);

export default router;
