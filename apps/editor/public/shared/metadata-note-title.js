// Intent: metadata-note titles are semantic project text; rendering and file-name limits must not truncate them.
export function normalizeMetadataNoteTitle(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}
