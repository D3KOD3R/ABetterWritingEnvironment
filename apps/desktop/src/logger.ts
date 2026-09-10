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
const appendLog = createDesktopLogWriter(LOG_PATH);

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
  appendLog(entry);
}

// Intent: avoid repeated directory syscalls while retaining immediate, ordered crash-adjacent diagnostics.
// No deferred queue means callers and process shutdown keep the existing synchronous contract.
export function createDesktopLogWriter(filePath: string, io = { mkdirSync, appendFileSync }) {
  let directoryReady = false;
  return (entry: DesktopLogEntry) => {
    try {
      if (!directoryReady) {
        io.mkdirSync(path.dirname(filePath), { recursive: true });
        directoryReady = true;
      }
      const line = `${JSON.stringify({
        timestamp: new Date().toISOString(),
        ...entry,
        context: sanitizeLogContext(entry.context),
      })}\n`;
      try {
        io.appendFileSync(filePath, line, "utf8");
      } catch (error) {
        // A removed directory must not lose the first subsequent diagnostic; retry ENOENT once.
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        io.mkdirSync(path.dirname(filePath), { recursive: true });
        io.appendFileSync(filePath, line, "utf8");
      }
    } catch {
      // Retry directory setup on the next event if the destination disappeared or was unavailable.
      // Logging remains best-effort and must never break the host process.
      directoryReady = false;
    }
  };
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
