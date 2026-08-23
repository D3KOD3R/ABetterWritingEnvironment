// Intent: create manual World Spine event tags from manuscript selections without owning shell persistence.

export function buildWorldSpineEventComposerFromContextMenu(menu, point = {}) {
  if (!menu) {
    return null;
  }

  return {
    ...menu,
    composerType: "world-spine-event",
    x: (Number(point.x) || 0) + 10,
    y: Number(point.y) || 0,
  };
}

// Intent: preserve event pins as canonical block anchors rather than textarea-only offsets.
export function buildWorldSpineEventTagFromComposer({
  composer = null,
  scene = null,
  label = "",
  projectId = "",
  sequence = 0,
  now = new Date().toISOString(),
  getSceneBlockRanges = createSceneBlockRanges,
} = {}) {
  if (!composer || composer.composerType !== "world-spine-event" || !scene?.sceneId) {
    return null;
  }

  const eventLabel = normalizeEventLabel(label || composer.selectedText || "World Spine event");
  if (!eventLabel) {
    return null;
  }

  const text = String(scene.editorText ?? "");
  const startOffset = clampOffset(composer.startOffset, text.length);
  const endOffset = clampOffset(composer.endOffset, text.length);
  const blockRanges = getSceneBlockRanges(scene);
  const blockRange = findBlockRangeForOffset(blockRanges, startOffset) ?? blockRanges[0] ?? null;
  if (!blockRange?.blockId || !String(blockRange.text ?? "").length) {
    return null;
  }

  const blockTextLength = blockRange.text.length;
  const localStartOffset = Math.max(0, Math.min(startOffset - blockRange.startOffset, Math.max(0, blockTextLength - 1)));
  const localEndOffset = Math.max(
    localStartOffset + 1,
    Math.min(
      Math.max(endOffset - blockRange.startOffset, localStartOffset + 1),
      blockTextLength,
    ),
  );
  const evidenceExcerpt = blockRange.text.slice(localStartOffset, localEndOffset) || composer.selectedText || eventLabel;
  const sceneLineNumber = Number(blockRange.sceneLineNumber);
  const lineNumber = Number(blockRange.lineNumber);
  const location = readSceneLocationLabel(scene);

  return {
    id: `event-${String(Math.max(0, Number(sequence) || 0) + 1).padStart(4, "0")}`,
    kind: "plot-turn",
    label: eventLabel,
    source: "manual",
    anchor: {
      projectId: String(projectId ?? ""),
      chapterId: String(scene.chapterId ?? ""),
      sceneId: scene.sceneId,
      blockId: blockRange.blockId,
      paragraphId: String(blockRange.paragraphId ?? blockRange.blockId),
      startOffset: localStartOffset,
      endOffset: localEndOffset,
    },
    evidenceExcerpt,
    createdAt: now,
    notes: "",
    blockId: blockRange.blockId,
    lineNumber: Number.isFinite(lineNumber) ? lineNumber : null,
    sceneLineNumber: Number.isFinite(sceneLineNumber) ? sceneLineNumber : null,
    chapterTitle: String(scene.chapterTitle ?? ""),
    sceneTitle: String(scene.sceneTitle ?? ""),
    location,
  };
}

function readSceneLocationLabel(scene = {}) {
  return normalizeEventLabel(
    scene?.worldSpineMetadata?.location ??
    scene?.metadata?.location ??
    scene?.metadata?.storyLocation ??
    scene?.location ??
    scene?.storyLocation ??
    scene?.place ??
    scene?.setting ??
    scene?.locality ??
    "",
  );
}

function findBlockRangeForOffset(blockRanges = [], offset = 0) {
  return (Array.isArray(blockRanges) ? blockRanges : []).find((range) =>
    offset >= range.startOffset && offset <= range.endOffset
  ) ?? null;
}

function createSceneBlockRanges(scene) {
  const blocks = Array.isArray(scene?.blocks) ? scene.blocks : [];
  const ranges = [];
  let offset = 0;

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const text = String(block?.text ?? "");
    const startOffset = offset;
    const endOffset = startOffset + text.length;
    ranges.push({
      ...block,
      blockId: String(block?.blockId ?? ""),
      text,
      startOffset,
      endOffset,
    });
    offset = endOffset + (index < blocks.length - 1 ? 2 : 0);
  }

  return ranges;
}

function normalizeEventLabel(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96);
}

function clampOffset(value, textLength) {
  const number = Number(value);
  const safeNumber = Number.isFinite(number) ? Math.floor(number) : 0;
  return Math.max(0, Math.min(safeNumber, Math.max(0, Number(textLength) || 0)));
}
