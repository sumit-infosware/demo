import { z } from "zod";

/**
 * Shared password strength rule. Reused by the create/update user schemas and
 * the change-password schema so password policy stays defined in one place.
 */
export const passwordRule = z
  .string()
  .min(6)
  .max(128)
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const uuid = z.string().uuid("Must be a valid uuid");

/** POST /users — create a new user. */
export const createUserSchema = z.object({
  email: z.string().email().max(254),
  password: passwordRule,
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  // Role assignment is a privileged operation; the route layer enforces the
  // appropriate permission before this value is ever used.
  roleId: uuid,
});

/** PATCH /users/:id — update an existing user. All fields optional. */
export const updateUserSchema = z
  .object({
    email: z.string().email().max(254).optional(),
    password: passwordRule.optional(),
    firstName: z.string().min(1).max(80).optional(),
    lastName: z.string().min(1).max(80).optional(),
    isActive: z.boolean().optional(),
    // Changing a user's role is a privileged operation; the route layer
    // enforces the appropriate permission before this value is used.
    roleId: uuid.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

/** Path parameter for /users/:id routes. */
export const userIdParamSchema = z.object({
  id: uuid,
});
