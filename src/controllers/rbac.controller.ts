import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { rbacService } from "../services/rbac.service.js";

const {
  listRoles,
  listPermissions,
  createRole,
  getRoleById,
  updateRole,
  deleteRole,
  createPermission,
  getPermissionById,
  updatePermission,
  deletePermission,
  assignRole,
  getMyPermissions,
} = rbacService;

export const listRolesHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const roles = await listRoles();
    success(res, roles, 200, _req.requestId);
  } catch (e) {
    next(e);
  }
};

export const listPermissionsHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const permissions = await listPermissions();
    success(res, permissions, 200, _req.requestId);
  } catch (e) {
    next(e);
  }
};

export const createRoleHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name, description, permissionIds } = req.body as {
      name: string;
      description?: string;
      permissionIds?: string[];
    };
    const role = await createRole({ name, description, permissionIds }, req.auditCtx);
    success(res, role, 201, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const getRoleHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const role = await getRoleById(id);
    success(res, role, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const updateRoleHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const { name, description, permissionIds } = req.body as {
      name?: string;
      description?: string | null;
      permissionIds?: string[];
    };
    const role = await updateRole(id, { name, description, permissionIds }, req.auditCtx);
    success(res, role, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const deleteRoleHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const result = await deleteRole(id, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const createPermissionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { code, description } = req.body as { code: string; description?: string };
    const permission = await createPermission({ code, description }, req.auditCtx);
    success(res, permission, 201, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const getPermissionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const permission = await getPermissionById(id);
    success(res, permission, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const updatePermissionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const { code, description } = req.body as { code?: string; description?: string | null };
    const permission = await updatePermission(id, { code, description }, req.auditCtx);
    success(res, permission, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const deletePermissionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const result = await deletePermission(id, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

// ─── Existing RBAC handlers (preserved) ──────────────────────
export const assignRoleHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { userId, roleId } = req.body as { userId: string; roleId: string };
    const result = await assignRole(userId, roleId);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const getMyPermissionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const permissions = await getMyPermissions(userId);
    success(res, permissions, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};
