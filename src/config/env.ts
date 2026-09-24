import "dotenv/config";
import { z } from "zod";
import { logger } from "./logger.js";

const secretField = z
  .string()
  .min(16, "JWT secret must be at least 16 characters")
  .default("dev-only-secret-Q8zP4mN7vX2kL9rT5yC3hJ6sD1fG8");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4500),
  DATABASE_URL: z.string().default("postgresql://postgres:root@localhost:5432/sits-backend"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  // External IFS MySQL — READ-ONLY. SITS never writes to this database.
  IFS_DATABASE_URL: z.string().url().default("mysql://root:root@localhost:3306/ifs_demo"),
  IFS_POLLING_ENABLED: z.enum(["true", "false"]).default("true"),
  JWT_ISSUER: z.string().min(1).default("my-secure-backend"),
  JWT_AUDIENCE: z.string().min(1).default("my-secure-backend-api"),
  JWT_ACCESS_SECRET: secretField,
  JWT_REFRESH_SECRET: secretField,
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  CSRF_HEADER_NAME: z.string().min(1).default("x-requested-with"),
  PUBLIC_PATHS: z.string().default("/health,/api/v1/auth/login"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error(
    {
      errors: parsed.error.flatten().fieldErrors,
    },
    "Invalid environment variables",
  );
  console.error("Invalid environment variables:");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

const data = parsed.data;

// Fail fast in production if real secrets were not provided.
if (
  data.NODE_ENV === "production" &&
  (data.JWT_ACCESS_SECRET.startsWith("dev-") || data.JWT_REFRESH_SECRET.startsWith("dev-"))
) {
  console.error("Production requires real JWT secrets (run: npm run keys:generate)");
  process.exit(1);
}

export const env = {
  ...data,
  isDev: data.NODE_ENV === "development",
  isTest: data.NODE_ENV === "test",
  isProd: data.NODE_ENV === "production",
  ifsPollingEnabled: data.IFS_POLLING_ENABLED === "true",
  corsOrigins: data.CORS_ORIGIN.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  publicPaths: data.PUBLIC_PATHS.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
} as const;

export type Env = typeof env;
