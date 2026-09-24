import { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { authService } from "../services/auth.service.js";

const { login, refreshToken, logout } = authService;

export const loginUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = req.body as { email: string; password: string };
    const result = await login(
      {
        ...data,
        userAgent: req.headers["user-agent"],
        ip: req.ip,
      },
      req.auditCtx,
    );

    // Set refresh token as httpOnly cookie
    res.cookie("refresh_token", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/v1/auth",
    });
    success(res, { user: result.user, accessToken: result.accessToken }, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const refreshAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const refreshTokenValue =
      (req.body as { refreshToken?: string })?.refreshToken ??
      (req.cookies?.refresh_token as string | undefined);
    const result = await refreshToken(
      refreshTokenValue,
      req.headers["user-agent"],
      req.ip,
      req.auditCtx,
    );
    // Set new refresh token as httpOnly cookie
    res.cookie("refresh_token", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/v1/auth",
    });
    success(res, { accessToken: result.accessToken }, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const logoutUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const refreshTokenValue =
      (req.cookies?.refresh_token as string | undefined) ??
      (req.body as { refreshToken?: string })?.refreshToken;
    await logout(refreshTokenValue, req.auditCtx);
    // Clear refresh token cookie
    res.clearCookie("refresh_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/auth",
    });
    success(res, { message: "Logged out successfully" }, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { username, oldPassword, newPassword } = req.body as {
      username: string;
      oldPassword: string;
      newPassword: string;
    };
    const result = await authService.changePassword(
      { username, oldPassword, newPassword },
      req.auditCtx,
    );
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};
