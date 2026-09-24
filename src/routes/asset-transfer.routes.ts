import { Router } from "express";
import {
  getFlatTagByEpc,
  getSyncLocations,
  getTransferAllItems,
  listTransfers,
} from "../controllers/asset-transfer.controller.js";
import { validate } from "../middleware/http.middleware.js";
import { epcParamSchema, transferIdParamSchema } from "../schemas/asset-transfer.schemas.js";

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Asset Transfer & Storage
 *     description: Asset transfer tracking, storage locations, and tag lookups (public, no auth required)
 */

/**
 * @openapi
 * /transfers:
 *   get:
 *     summary: Get all transfers
 *     tags: [Asset Transfer & Storage]
 *     responses:
 *       '200':
 *         description: Transfers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransfersResponse'
 */
router.get("/transfers", listTransfers);

/**
 * @openapi
 * /transfer/get/all/items/{transferId}:
 *   get:
 *     summary: Get all items for a transfer, grouped by storage location
 *     tags: [Asset Transfer & Storage]
 *     parameters:
 *       - in: path
 *         name: transferId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Items fetch successfully
 *       '404':
 *         description: Transfer not found
 */
router.get(
  "/transfer/get/all/items/:transferId",
  validate(transferIdParamSchema, "params"),
  getTransferAllItems,
);

/**
 * @openapi
 * /sync/locations:
 *   get:
 *     summary: Get the full storage hierarchy (warehouse -> bay -> row -> tier -> bin)
 *     tags: [Asset Transfer & Storage]
 *     responses:
 *       '200':
 *         description: Storage locations retrieved successfully
 */
router.get("/sync/locations", getSyncLocations);

/**
 * @openapi
 * /tag/{epc}:
 *   get:
 *     summary: Get tag details by EPC (flat)
 *     tags: [Asset Transfer & Storage]
 *     parameters:
 *       - in: path
 *         name: epc
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Tag details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TagDetailsResponse'
 *       '404':
 *         description: Tag not found
 */
router.get("/tag/:epc", validate(epcParamSchema, "params"), getFlatTagByEpc);

export default router;
