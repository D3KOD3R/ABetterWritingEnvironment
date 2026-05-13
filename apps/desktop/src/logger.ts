// Intent: provide file-backed desktop logging without coupling browser features to filesystem details.
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export interface DesktopLogContext {
  [key: string]: unknown;
}

export interface DesktopLogEntry {
  level: "debug" | "info" | "warn" | "error";
  scope: string;
  message: string;
  context?: DesktopLogContext;
}

const LOG_PATH = process.env.ABE_LOG_PATH ?? path.join(process.cwd(), "logs", "desktop.log");

export function logDesktopInfo(scope: string, message: string, context?: DesktopLogContext) {
  appendDesktopLog({
    level: "info",
    scope,
    message,
    context,
  });
}

export function logDesktopWarn(scope: string, message: string, context?: DesktopLogContext) {
  appendDesktopLog({
    level: "warn",
    scope,
    message,
    context,
  });
}

export function logDesktopError(scope: string, message: string, context?: DesktopLogContext) {
  appendDesktopLog({
    level: "error",
    scope,
    message,
    context,
  });
}

function appendDesktopLog(entry: DesktopLogEntry) {
  try {
    mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    appendFileSync(LOG_PATH, `${JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry,
      context: sanitizeLogContext(entry.context),
    })}\n`, "utf8");
  } catch {
    // Logging must not break the host process.
  }
}

function sanitizeLogContext(context?: DesktopLogContext) {
  if (!context || typeof context !== "object") {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, sanitizeLogValue(value)]),
  );
}

function sanitizeLogValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeLogValue(item)]),
    );
  }

  return value;
}
