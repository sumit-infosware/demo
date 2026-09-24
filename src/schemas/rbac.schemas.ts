import { z } from "zod";

/** Role creation payload. */
export const createRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Role name is required")
    .max(80, "Role name must be at most 80 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Role name may only contain letters, numbers, hyphens and underscores",
    ),
  description: z.string().trim().max(255).optional(),
  permissionIds: z
    .array(z.string().uuid("Each permission id must be a valid UUID"))
    .min(1, "At least one permission must be assigned")
    .optional(),
});

/** Role update payload (all fields optional). */
export const updateRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Role name is required")
    .max(80, "Role name must be at most 80 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Role name may only contain letters, numbers, hyphens and underscores",
    )
    .optional(),
  description: z.string().trim().max(255).nullable().optional(),
  permissionIds: z
    .array(z.string().uuid("Each permission id must be a valid UUID"))
    .min(1, "At least one permission must be assigned")
    .optional(),
});

/** Permission creation payload. */
export const createPermissionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Permission code is required")
    .max(100, "Permission code must be at most 100 characters")
    .regex(
      /^[a-z0-9_.]+$/,
      "Permission code may only contain lowercase letters, numbers, dots and underscores",
    ),
  description: z.string().trim().max(255).optional(),
});

/** Permission update payload (all fields optional). */
export const updatePermissionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Permission code is required")
    .max(100, "Permission code must be at most 100 characters")
    .regex(
      /^[a-z0-9_.]+$/,
      "Permission code may only contain lowercase letters, numbers, dots and underscores",
    )
    .optional(),
  description: z.string().trim().max(255).nullable().optional(),
});

/** Path parameter: UUID identifier. */
export const idParamSchema = z.object({
  id: z.string().uuid("Invalid id format"),
});
