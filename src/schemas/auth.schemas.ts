import { z } from "zod";
import { passwordRule } from "./user.schemas.js";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(6)
    .max(128)
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

export const registerSchema = z.object({
  email: z.string().email().max(90),
  password: z
    .string()
    .min(6)
    .max(128)
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
});

// Refresh token may be supplied in the request body or via httpOnly cookie.
// The body field is optional; the controller falls back to the cookie.
export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
  })
  .optional();

// Logout is idempotent; refresh token is optional (cookie or body).
export const logoutSchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
  })
  .optional();

/**
 * POST /auth/change-password
 *
 * The project identifies users by `email`; the `username` field is accepted
 * for API compatibility and is matched against the user's `email` column.
 * `newPassword` reuses the shared `passwordRule` so password policy is
 * consistent with user creation/update. `confirmNewPassword` must equal
 * `newPassword`.
 */
export const changePasswordSchema = z
  .object({
    username: z.string().email().max(254),
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: passwordRule,
    confirmNewPassword: z.string().min(1, "Password confirmation is required"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmNewPassword"],
  });
