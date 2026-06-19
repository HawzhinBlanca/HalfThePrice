import { getCorrelationId } from "@htp/database";

/* eslint-disable @typescript-eslint/no-explicit-any */
type LogLevel = "info" | "warn" | "error" | "debug";

function serializeError(err: unknown): Record<string, unknown> | undefined {
  if (err instanceof Error) {
    return {
      errorMessage: err.message,
      errorStack: err.stack,
      ...(err.cause ? { errorCause: String(err.cause) } : {}),
    };
  }
  if (err !== undefined && err !== null) {
    return { errorValue: String(err) };
  }
  return undefined;
}

function log(level: LogLevel, message: string, meta?: Record<string, any>) {
  const correlationId = getCorrelationId();
  // If meta contains an 'error' key, serialize it properly
  const errorMeta = meta?.error ? serializeError(meta.error) : undefined;
  const cleanMeta = meta ? { ...meta } : undefined;
  if (cleanMeta?.error) delete cleanMeta.error;

  const logObj = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(correlationId ? { correlationId } : {}),
    ...cleanMeta,
    ...errorMeta,
  };

  if (process.env.NODE_ENV === "production") {
    console.log(JSON.stringify(logObj));
  } else {
    const color = level === "error" ? "\x1b[31m" : level === "warn" ? "\x1b[33m" : "\x1b[36m";
    const reset = "\x1b[0m";
    console.log(
      `[${logObj.timestamp}] ${color}${level.toUpperCase()}${reset}: ${message}`,
      meta ? JSON.stringify(meta) : ""
    );
  }
}

export const logger = {
  info: (msg: string, meta?: Record<string, any>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, any>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, any>) => log("error", msg, meta),
  debug: (msg: string, meta?: Record<string, any>) => log("debug", msg, meta),
};
