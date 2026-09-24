import { join } from "node:path";
import pino from "pino";

const logFile = join(process.cwd(), "logs", "app.log");

function buildLogger() {
  return pino({
    level: process.env.LOG_LEVEL || "info",

    transport: {
      targets: [
        // Always write logs to file
        {
          target: "pino/file",
          level: process.env.LOG_LEVEL || "info",
          options: {
            destination: logFile,
            mkdir: true,
          },
        },

        // Pretty logs in development
        ...(process.env.NODE_ENV === "development"
          ? [
              {
                target: "pino-pretty",
                level: process.env.LOG_LEVEL || "info",
                options: {
                  colorize: true,
                  translateTime: "SYS:HH:MM:ss",
                  ignore: "pid,hostname",
                },
              },
            ]
          : []),
      ],
    },

    redact: {
      paths: [
        "authorization",
        "cookie",
        "password",
        "oldPassword",
        "newPassword",
        "confirmNewPassword",
        "token",
        "accessToken",
        "refreshToken",
        "secret",
        "*.password",
        "*.oldPassword",
        "*.newPassword",
        "*.confirmNewPassword",
        "req.headers.authorization",
        "req.headers.cookie",
      ],
      censor: "[REDACTED]",
    },
  });
}

export const logger = buildLogger();
