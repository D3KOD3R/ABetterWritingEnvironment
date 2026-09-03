function normalizeNullableLineNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

// Intent: sidecar blocks carry manuscript identity/content only; scene and chapter context remain canonical elsewhere.
export function normalizePersistedSceneBlock(candidate, {
  fallbackBlockId,
} = {}) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : {};
  const blockId = typeof source.blockId === "string" && source.blockId.trim()
    ? source.blockId
    : fallbackBlockId;
  const lineNumber = normalizeNullableLineNumber(source.lineNumber);
  return {
    blockId,
    paragraphId: typeof source.paragraphId === "string" ? source.paragraphId : "",
    lineNumber,
    kind: typeof source.kind === "string" ? source.kind : "narration",
    speakerLabel: typeof source.speakerLabel === "string" ? source.speakerLabel : "",
    text: typeof source.text === "string" ? source.text : "",
    issueIds: Array.isArray(source.issueIds) ? [...source.issueIds] : [],
    eventTagIds: Array.isArray(source.eventTagIds) ? [...source.eventTagIds] : [],
    isDraft: source.isDraft === true || lineNumber === null,
  };
}

// Empty block text is a paragraph, including at the beginning or end of a scene.
export function composePersistedSceneEditorText(blocks = []) {
  return blocks.map((block) => String(block?.text ?? "")).join("\n\n");
}
