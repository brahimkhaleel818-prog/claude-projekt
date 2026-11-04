import pino from "pino";
import { str } from "./env";

export const logger = pino({
  level: ["fatal", "error", "warn", "info", "debug", "trace", "silent"].includes(str("LOG_LEVEL", "info")) ? str("LOG_LEVEL", "info") : "info",
  base: { app: "uber-preismonitor" },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ["*.client_secret", "*.access_token", "*.authorization", "*.Authorization", "*.password"],
    censor: "[geheim]",
  },
});
