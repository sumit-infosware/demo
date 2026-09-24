import type { AuditContext } from "../audit/audit.types.ts";
import type { AccountSnapshot, DeviceActor } from "./common.ts";

declare global {
  namespace Express {
    interface Request {
      /** Unique request id (set by request-id middleware). */
      requestId: string;
      /** Authenticated account snapshot (set by auth middleware). */
      user?: AccountSnapshot;
      /** Device identity (set by device-auth middleware). */
      deviceActor?: DeviceActor;
      /** Original request ip (normalized helper). */
      clientIp?: string;
      /** Audit context for the current request (set by audit middleware). */
      auditCtx?: AuditContext;
    }
    interface Response {
      /** Optional error logged flag to avoid double-logging in error middleware. */
      errorLogged?: boolean;
    }
  }
}

export {};
