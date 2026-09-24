import type { Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { transitExitService } from "../services/transit-exit.service.js";
import type {
  TransitExitAlertInput,
  TransitExitChargeCheckInput,
  TransitExitGenerateTransferInput,
  TransitExitSelectApprovedInput,
} from "../types/transit-exit.types.js";

/**
 * Transit Exit — Charge Approval controller (RF-22), Select Approved
 * controller (RF-23), and Generate Transfer controller (RF-24).
 * Thin: parse input, delegate to the service, return the success envelope.
 */

/** Resolve the acting identity: a device, else the authenticated user. */
function actorFromRequest(req: Request): { userId: string; email: string } {
  if (req.deviceActor) {
    return { userId: req.deviceActor.userId, email: req.deviceActor.email };
  }
  const user = req.user!;
  return { userId: user.userId, email: user.email };
}

export const transitExitController = {
  async checkCharge(this: void, req: Request, res: Response) {
    const input = req.body as TransitExitChargeCheckInput;
    const user = req.user!;
    const result = await transitExitService.checkCharge(
      input,
      { userId: user.userId, email: user.email },
      {
        actorId: req.auditCtx?.actorId,
        actorEmail: req.auditCtx?.actorEmail,
        requestId: req.requestId,
      },
    );
    return success(res, result, 200, req.requestId);
  },

  /**
   * POST /transit-exit/select-approved — select the approved subset (RF-23).
   * Thin handler: validate (route layer) → service → success envelope.
   */
  async selectApproved(this: void, req: Request, res: Response) {
    const input = req.body as TransitExitSelectApprovedInput;
    const user = req.user!;
    const result = await transitExitService.selectApproved(
      input,
      { userId: user.userId, email: user.email },
      {
        actorId: req.auditCtx?.actorId,
        actorEmail: req.auditCtx?.actorEmail,
        requestId: req.requestId,
      },
    );
    return success(res, result, 200, req.requestId);
  },

  /**
   * POST /transit-exit/alert — raise a not-approved alert (RF-25).
   * Thin handler: validate (route layer) → service → success envelope.
   */
  async raiseAlert(this: void, req: Request, res: Response) {
    const input = req.body as TransitExitAlertInput;
    const user = req.user!;
    const result = await transitExitService.raiseNotApprovedAlert(
      input,
      { userId: user.userId, email: user.email },
      {
        actorId: req.auditCtx?.actorId,
        actorEmail: req.auditCtx?.actorEmail,
        requestId: req.requestId,
      },
    );
    return success(res, result, 201, req.requestId);
  },

  /**
   * POST /transit-exit/generate-transfer (human) and POST /reader-lookup/generate-transfer
   * (device) — generate Transfer ID for approved EPCs (RF-24).
   *
   * The single shared implementation is `transitExitService.generateTransfer`;
   * the acting identity is the authenticated device when present, else the
   * JWT user (devices map to a null createdBy for the @db.Uuid column).
   */
  async generateTransfer(this: void, req: Request, res: Response) {
    const input = req.body as TransitExitGenerateTransferInput;
    const result = await transitExitService.generateTransfer(input, actorFromRequest(req), {
      actorId: req.auditCtx?.actorId,
      actorEmail: req.auditCtx?.actorEmail,
      requestId: req.requestId,
    });
    return success(res, result, 201, req.requestId);
  },
};
