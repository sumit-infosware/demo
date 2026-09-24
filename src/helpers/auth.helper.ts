import bcrypt from "bcrypt";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";

const encoder = new TextEncoder();
const accessSecret = encoder.encode(env.JWT_ACCESS_SECRET);
const refreshSecret = encoder.encode(env.JWT_REFRESH_SECRET);

export const authHelper = {
  encryptPassword: (password: string) => bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS),

  verifyPassword: (password: string, hash: string) => bcrypt.compare(password, hash),

  generateAccessToken: (payload: { sub: string; email: string }) =>
    new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer(env.JWT_ISSUER)
      .setAudience(env.JWT_AUDIENCE)
      .setExpirationTime(env.ACCESS_TOKEN_EXPIRES_IN)
      .sign(accessSecret),

  generateRefreshToken: (payload: { sub: string; email: string; jti: string }) =>
    new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer(env.JWT_ISSUER)
      .setAudience(env.JWT_AUDIENCE)
      .setExpirationTime(env.REFRESH_TOKEN_EXPIRES_IN)
      .sign(refreshSecret),

  verifyAccessToken: (token: string) =>
    jwtVerify(token, accessSecret, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }),

  verifyRefreshToken: (token: string) =>
    jwtVerify(token, refreshSecret, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }),
};
