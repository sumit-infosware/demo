import { AppError } from "../../errors/errors.js";

/**
 * IFS-specific error primitives.
 *
 * IFS errors are intentionally distinct from AppError subclasses: they carry
 * machine-readable codes used by the polling failure policy, and they are
 * normalized to AppError at the API boundary (see ifs.controller.ts).
 */

export class IfsError extends Error {
  readonly code: string;
  readonly isOperational: boolean;

  constructor(message: string, code = "IFS_ERROR") {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** IFS connection could not be established. */
export class IfsConnectionError extends IfsError {
  constructor(message = "Unable to connect to IFS database") {
    super(message, "IFS_CONNECTION_ERROR");
  }
}

/** A query against IFS failed (connection or SQL error). */
export class IfsQueryError extends IfsError {
  constructor(message = "IFS query failed") {
    super(message, "IFS_QUERY_ERROR");
  }
}

/**
 * Raised if any code path attempts a non-SELECT statement against IFS.
 * IFS is READ-ONLY from SITS. This is defense-in-depth on top of the DB user
 * being granted SELECT-only privileges.
 */
export class IfsReadOnlyViolationError extends IfsError {
  constructor(message = "IFS is read-only; write statements are forbidden") {
    super(message, "IFS_READ_ONLY_VIOLATION");
  }
}

/** A gate entry could not be synchronized (recorded, then retried). */
export class IfsSyncError extends IfsError {
  readonly gateEntryNo: string;
  constructor(gateEntryNo: string, message: string, cause?: unknown) {
    super(message, "IFS_SYNC_ERROR");
    this.gateEntryNo = gateEntryNo;
    if (cause instanceof Error) this.cause = cause;
  }
}

/** Normalizes an IfsError/unknown into an AppError for HTTP boundaries. */
export function toAppError(error: unknown): AppError {
  if (error instanceof IfsError) {
    if (error instanceof IfsConnectionError) {
      return new AppError(error.message, 503, error.code);
    }
    if (error instanceof IfsSyncError) {
      return new AppError(
        `Gate entry ${error.gateEntryNo} could not be synchronized: ${error.message}`,
        422,
        error.code,
      );
    }
    return new AppError(error.message, 502, error.code);
  }
  return new AppError(
    error instanceof Error ? error.message : "IFS operation failed",
    502,
    "IFS_ERROR",
  );
}
