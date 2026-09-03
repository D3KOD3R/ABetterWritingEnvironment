function assertJsonDomainValue(value, path, ancestors) {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError(`External project snapshots cannot persist a non-finite number at ${path}.`);
  }
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    throw new TypeError(`External project snapshots contain a non-JSON value at ${path}.`);
  }
  if (!value || typeof value !== "object") return;
  if (ancestors.has(value)) {
    throw new TypeError(`External project snapshots cannot contain a cycle at ${path}.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`External project snapshots require plain objects at ${path}.`);
  }
  ancestors.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJsonDomainValue(entry, `${path}[${index}]`, ancestors));
  } else {
    Object.entries(value).forEach(([key, entry]) => assertJsonDomainValue(entry, `${path}.${key}`, ancestors));
  }
  ancestors.delete(value);
}

// Intent: make external project DTOs obey the same omission and array-slot rules as their JSON transport.
export function canonicalizeJsonPersistenceValue(value) {
  assertJsonDomainValue(value, "$", new Set());
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("External project snapshots must have a JSON representation.");
  }
  return JSON.parse(serialized);
}
