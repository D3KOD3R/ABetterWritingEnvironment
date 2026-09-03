// Intent: make external project DTOs obey the same omission and array-slot rules as their JSON transport.
export function canonicalizeJsonPersistenceValue(value) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("External project snapshots must have a JSON representation.");
  }
  return JSON.parse(serialized);
}
