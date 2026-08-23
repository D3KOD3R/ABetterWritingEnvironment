// Intent: derive anchored narration take selections outside the editor shell.

export function buildNarrationTakeSelection(scene, block, {
  blockRange = null,
  inlinePosition = null,
  startOffset = null,
  endOffset = null,
  selectedText = null,
  projectId = "",
} = {}) {
  if (!scene || !block) {
    return null;
  }

  const resolvedStartOffset = Number.isInteger(startOffset)
    ? startOffset
    : Number.isInteger(blockRange?.startOffset)
      ? blockRange.startOffset
      : 0;
  const resolvedEndOffset = Number.isInteger(endOffset)
    ? endOffset
    : Number.isInteger(blockRange?.endOffset)
      ? blockRange.endOffset
      : Math.max(resolvedStartOffset, String(block.text ?? "").length);
  const resolvedSelectedText = String(selectedText ?? block.text ?? "").trim();

  return {
    id: `${scene.sceneId}:${block.blockId}:${resolvedStartOffset}:${resolvedEndOffset}`,
    projectId,
    chapterId: scene.chapterId,
    chapterTitle: scene.chapterTitle,
    sceneId: scene.sceneId,
    sceneTitle: scene.sceneTitle,
    blockId: block.blockId,
    paragraphId: block.paragraphId,
    lineNumber: block.lineNumber ?? 0,
    kind: block.kind,
    kindLabel: block.kind === "dialogue" ? "Dialogue" : "Narration",
    selectedText: resolvedSelectedText,
    startOffset: resolvedStartOffset,
    endOffset: resolvedEndOffset,
    blockStartOffset: blockRange?.startOffset ?? resolvedStartOffset,
    blockEndOffset: blockRange?.endOffset ?? resolvedEndOffset,
    caretOffset: resolvedStartOffset,
    inlinePosition,
    verseText: resolvedSelectedText,
  };
}

export function selectNarrationTakeSelectionForScene(scene, {
  currentSelection = null,
  selectedBlockId = "",
  projectId = "",
  getSceneBlockRanges = () => [],
} = {}) {
  if (!scene) {
    return null;
  }

  if (currentSelection?.sceneId === scene.sceneId) {
    return currentSelection;
  }

  const resolvedBlockId = selectedBlockId && scene.blocks?.some((block) => block.blockId === selectedBlockId)
    ? selectedBlockId
    : scene.blocks?.[0]?.blockId ?? null;
  const block = resolvedBlockId ? scene.blocks.find((candidate) => candidate.blockId === resolvedBlockId) ?? null : null;
  if (!block) {
    return null;
  }

  const ranges = getSceneBlockRanges(scene);
  const blockRange = ranges.find((candidate) => candidate.blockId === block.blockId) ?? null;
  return buildNarrationTakeSelection(scene, block, {
    blockRange,
    projectId,
    startOffset: blockRange?.startOffset ?? 0,
    endOffset: blockRange?.endOffset ?? String(block.text ?? "").length,
    selectedText: block.text,
  });
}

export function resolveNarrationTakeSelectionFromTextInput({
  scene,
  contextRange = null,
  caretOffset = 0,
  caretRange = null,
  inlinePosition = null,
  projectId = "",
  findSceneBlockAtOffset = () => null,
  getSceneBlockRanges = () => [],
} = {}) {
  if (!scene) {
    return null;
  }

  const anchorOffset = contextRange?.hasExplicitSelection
    ? contextRange.startOffset
    : caretOffset;
  const block = findSceneBlockAtOffset(scene, anchorOffset) ?? scene.blocks?.[0] ?? null;
  if (!block) {
    return null;
  }

  const blockRange = getSceneBlockRanges(scene).find((candidate) => candidate.blockId === block.blockId) ?? null;
  const hasCaretRange = !contextRange?.hasExplicitSelection &&
    caretRange?.blockId === block.blockId &&
    Number.isInteger(caretRange.startOffset) &&
    Number.isInteger(caretRange.endOffset) &&
    caretRange.startOffset >= 0 &&
    caretRange.endOffset > caretRange.startOffset;
  const selectedText = contextRange?.selectedText?.trim()
    || (hasCaretRange ? String(caretRange.selectedText ?? "").trim() : "")
    || String(block.text ?? "").trim()
    || "";
  const startOffset = contextRange?.hasExplicitSelection
    ? contextRange.startOffset
    : hasCaretRange
      ? caretRange.startOffset
      : blockRange?.startOffset ?? 0;
  const endOffset = contextRange?.hasExplicitSelection
    ? contextRange.endOffset
    : hasCaretRange
      ? caretRange.endOffset
      : blockRange?.endOffset ?? selectedText.length;

  return buildNarrationTakeSelection(scene, block, {
    blockRange,
    inlinePosition,
    startOffset,
    endOffset,
    selectedText,
    projectId,
  });
}
