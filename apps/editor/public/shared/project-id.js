// Intent: allocate package identity independently from author-facing titles and source provenance.
// UUID-backed IDs keep separately published packages distinct without a cache lookup or dedupe policy.
export function createRandomProjectId(cryptoRef = globalThis.crypto) {
  if (typeof cryptoRef?.randomUUID !== "function") {
    throw new Error("Project creation requires collision-resistant UUID generation.");
  }
  return `project-${cryptoRef.randomUUID()}`;
}
