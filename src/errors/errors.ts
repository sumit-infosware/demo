/**
 * Central error primitives.
 * All application errors extend AppError and carry an HTTP status + error code.
 * Unknown errors are normalized in the error middleware — never surfaced raw.
 */

import { HttpStatus } from "../http/statusCodes.js";

export type ErrorDetails = Record<string, unknown> | unknown[] | undefined;

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: ErrorDetails;
  readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    code: string = "INTERNAL_ERROR",
    details?: ErrorDetails,
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, HttpStatus.FORBIDDEN, "FORBIDDEN");
  }
}

export class ValidationError extends AppError {
  constructor(message = "Request validation failed", details?: ErrorDetails) {
    super(message, HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, HttpStatus.NOT_FOUND, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, HttpStatus.CONFLICT, "CONFLICT");
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED");
  }
}

/** A Prisma known-request-error shape (duck-typed to avoid version coupling). */
interface PrismaErrorLike {
  code?: string;
  name?: string;
}

/**
 * Maps Prisma errors to safe, client-meaningful AppErrors.
 * Never leaks the raw DB message to the client.
 */
export function prismaErrorToAppError(error: unknown): AppError {
  const candidate = error as PrismaErrorLike;
  if (candidate && typeof candidate === "object" && candidate.code) {
    switch (candidate.code) {
      case "P2002":
        return new ConflictError("A record with this value already exists");
      case "P2025":
        return new NotFoundError("Record");
      case "P2003":
        return new ValidationError("Related record does not exist");
      default:
        return new AppError("Database operation failed", HttpStatus.BAD_REQUEST, "DB_ERROR");
    }
  }
  return new AppError(
    "Database operation failed",
    HttpStatus.INTERNAL_SERVER_ERROR,
    "DATABASE_ERROR",
  );
}
