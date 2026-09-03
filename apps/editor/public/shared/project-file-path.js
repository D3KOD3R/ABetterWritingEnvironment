// Intent: keep project file path resolution rules small, explicit, and testable.
export function normalizeProjectFilePath(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Intent: recognize desktop absolute roots without borrowing browser cwd semantics.
export function hasProjectFilePath(value) {
  const normalized = normalizeProjectFilePath(value);
  if (!normalized) {
    return false;
  }
  const windowsDrivePath = /^[A-Za-z]:[\\/]/.test(normalized);
  const windowsUncPath = /^(?:\\\\|\/\/)[^\\/]+[\\/][^\\/]+(?:[\\/]|$)/.test(normalized);
  const posixAbsolutePath = /^\/(?!\/)/.test(normalized);
  return windowsDrivePath || windowsUncPath || posixAbsolutePath;
}

// Intent: prefer the file that was actually loaded over any stale path carried in memory.
export function resolveLoadedProjectFilePath(requestedProjectFilePath = "", recordProjectFilePath = "") {
  const requested = normalizeProjectFilePath(requestedProjectFilePath);
  if (hasProjectFilePath(requested)) {
    return requested;
  }

  const record = normalizeProjectFilePath(recordProjectFilePath);
  if (hasProjectFilePath(record)) {
    return record;
  }

  return "";
}
