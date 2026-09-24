import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { userService } from "../services/user.service.js";

/**
 * User CRUD controllers.
 *
 * Controllers are thin: they read the request, read the authenticated actor
 * from `req.user` (resolved by the `authenticate` middleware), delegate all
 * business logic to `userService`, and return the standard API envelope.
 * Authorization (permission checks) is enforced at the route layer.
 */
export const listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const result = await userService.listUsers({ page, limit }, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const user = await userService.getUserById(id, req.auditCtx);
    success(res, user, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = req.body as {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      roleId: string;
    };
    const user = await userService.createUser(data, req.user!, req.auditCtx);
    success(res, user, 201, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const data = req.body as {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      isActive?: boolean;
      roleId?: string;
    };
    const user = await userService.updateUser(id, data, req.user!, req.auditCtx);
    success(res, user, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const result = await userService.deleteUser(id, req.user!, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};
