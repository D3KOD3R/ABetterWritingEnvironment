// Intent: keep project file path resolution rules small, explicit, and testable.
export function normalizeProjectFilePath(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Intent: treat only absolute-looking paths as durable file destinations.
export function hasProjectFilePath(value) {
  const normalized = normalizeProjectFilePath(value);
  return Boolean(normalized) && /[\\/]/.test(normalized);
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
