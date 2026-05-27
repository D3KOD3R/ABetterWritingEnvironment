// Intent: own manuscript selection policy without owning DOM focus, scrolling, or persistence effects.

export function createManuscriptSelectionController({
  findSceneBlockAtOffset = () => null,
} = {}) {
  function createBookmark({
    sceneId = "",
    startOffset = 0,
    endOffset = startOffset,
    scrollTop = 0,
    scrollLeft = 0,
  } = {}) {
    const normalizedSceneId = String(sceneId ?? "").trim();
    if (!normalizedSceneId) {
      return null;
    }

    const normalizedStart = normalizeOffset(startOffset);
    const normalizedEnd = normalizeOffset(endOffset, normalizedStart);
    return {
      sceneId: normalizedSceneId,
      selectionStart: Math.min(normalizedStart, normalizedEnd),
      selectionEnd: Math.max(normalizedStart, normalizedEnd),
      codeframeScrollTop: normalizeScrollValue(scrollTop, 0),
      codeframeScrollLeft: normalizeScrollValue(scrollLeft, 0),
    };
  }

  function getSelectedText({
    text = "",
    startOffset = 0,
    endOffset = startOffset,
  } = {}) {
    const value = String(text ?? "");
    const start = clampOffset(startOffset, value.length);
    const end = clampOffset(endOffset, value.length);
    return end > start ? value.slice(start, end).trim() : "";
  }

  function getContextRange({
    text = "",
    startOffset = 0,
    endOffset = startOffset,
  } = {}) {
    const value = String(text ?? "");
    const explicitStart = clampOffset(startOffset, value.length);
    const explicitEnd = clampOffset(endOffset, value.length);

    if (explicitEnd > explicitStart && value.slice(explicitStart, explicitEnd).trim()) {
      return trimTextRange(value, explicitStart, explicitEnd, true);
    }

    const lineStart = value.lastIndexOf("\n", Math.max(0, explicitStart - 1)) + 1;
    const nextBreak = value.indexOf("\n", explicitStart);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    if (lineEnd <= lineStart || !value.slice(lineStart, lineEnd).trim()) {
      return null;
    }

    return trimTextRange(value, lineStart, lineEnd, false);
  }

  function createSelectionSnapshot({
    scene,
    sceneId = scene?.sceneId ?? "",
    text = scene?.editorText ?? "",
    startOffset = 0,
    endOffset = startOffset,
    lineNumber = null,
    scrollTop = null,
    scrollLeft = null,
  } = {}) {
    const normalizedSceneId = String(sceneId ?? "").trim();
    if (!scene || !normalizedSceneId) {
      return null;
    }

    const textLength = String(text ?? "").length;
    const start = clampOffset(startOffset, textLength);
    const end = clampOffset(endOffset, textLength);
    const block = findSceneBlockAtOffset(scene, start) ?? scene.blocks?.[0] ?? null;
    return {
      sceneId: normalizedSceneId,
      blockId: block?.blockId ?? "",
      lineNumber: Number.isInteger(lineNumber) ? lineNumber : block?.lineNumber ?? null,
      startOffset: Math.min(start, end),
      endOffset: Math.max(start, end),
      scrollTop: Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : null,
      scrollLeft: Number.isFinite(scrollLeft) ? Math.max(0, scrollLeft) : null,
    };
  }

  function resolveSelectionDefaultsForSave({
    selectedBlockId = "",
    scene = null,
    liveSelection = null,
    cachedSelection = null,
    fallbackStartOffset = 0,
    fallbackEndOffset = fallbackStartOffset,
  } = {}) {
    if (!scene) {
      return {
        blockId: selectedBlockId,
        lineNumber: null,
        startOffset: null,
        endOffset: null,
        scrollTop: null,
        scrollLeft: null,
      };
    }

    const textLength = String(scene.editorText ?? "").length;
    const resolvedSelection = liveSelection ?? cachedSelection;
    const startOffset = clampOffset(
      Number.isInteger(resolvedSelection?.startOffset) ? resolvedSelection.startOffset : fallbackStartOffset,
      textLength,
    );
    const endOffset = clampOffset(
      Number.isInteger(resolvedSelection?.endOffset) ? resolvedSelection.endOffset : fallbackEndOffset,
      textLength,
    );
    const block =
      findSceneBlockAtOffset(scene, startOffset)
      ?? scene.blocks?.find((candidate) => candidate.blockId === selectedBlockId)
      ?? scene.blocks?.[0]
      ?? null;

    return {
      blockId: block?.blockId ?? selectedBlockId,
      lineNumber: Number.isInteger(resolvedSelection?.lineNumber)
        ? resolvedSelection.lineNumber
        : block?.lineNumber ?? null,
      startOffset: Math.min(startOffset, endOffset),
      endOffset: Math.max(startOffset, endOffset),
      scrollTop: Number.isFinite(resolvedSelection?.scrollTop) ? Math.max(0, resolvedSelection.scrollTop) : null,
      scrollLeft: Number.isFinite(resolvedSelection?.scrollLeft) ? Math.max(0, resolvedSelection.scrollLeft) : null,
    };
  }

  function normalizeSavedSceneSelection(candidate, scene) {
    const textLength = String(scene?.editorText ?? "").length;
    const startOffset = Number.isInteger(candidate?.sceneSelectionStart)
      ? clampOffset(candidate.sceneSelectionStart, textLength)
      : null;
    const endOffset = Number.isInteger(candidate?.sceneSelectionEnd)
      ? clampOffset(candidate.sceneSelectionEnd, textLength)
      : startOffset;
    return {
      blockId:
        typeof candidate?.sceneSelectionBlockId === "string" && candidate.sceneSelectionBlockId.trim()
          ? candidate.sceneSelectionBlockId
          : scene?.blocks?.[0]?.blockId ?? "",
      lineNumber: Number.isInteger(candidate?.sceneSelectionLineNumber)
        ? Math.max(1, candidate.sceneSelectionLineNumber)
        : null,
      startOffset,
      endOffset,
      scrollTop: Number.isFinite(candidate?.sceneSelectionScrollTop)
        ? Math.max(0, candidate.sceneSelectionScrollTop)
        : null,
      scrollLeft: Number.isFinite(candidate?.sceneSelectionScrollLeft)
        ? Math.max(0, candidate.sceneSelectionScrollLeft)
        : null,
    };
  }

  return {
    createBookmark,
    createSelectionSnapshot,
    getContextRange,
    getSelectedText,
    normalizeSavedSceneSelection,
    resolveSelectionDefaultsForSave,
    trimTextRange,
  };
}

export function trimTextRange(value, startOffset, endOffset, hasExplicitSelection) {
  const text = String(value ?? "");
  let nextStart = clampOffset(startOffset, text.length);
  let nextEnd = clampOffset(endOffset, text.length);

  while (nextStart < nextEnd && /\s/.test(text[nextStart])) {
    nextStart += 1;
  }

  while (nextEnd > nextStart && /\s/.test(text[nextEnd - 1])) {
    nextEnd -= 1;
  }

  if (nextEnd <= nextStart) {
    return null;
  }

  return {
    selectedText: text.slice(nextStart, nextEnd),
    startOffset: nextStart,
    endOffset: nextEnd,
    hasExplicitSelection: Boolean(hasExplicitSelection),
  };
}

function clampOffset(value, textLength) {
  const number = Number(value);
  const safeNumber = Number.isFinite(number) ? Math.floor(number) : 0;
  return Math.max(0, Math.min(safeNumber, Math.max(0, Number(textLength) || 0)));
}

function normalizeOffset(value, fallback = 0) {
  return Number.isInteger(value) ? Math.max(0, value) : Math.max(0, fallback);
}

function normalizeScrollValue(value, fallback) {
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}
