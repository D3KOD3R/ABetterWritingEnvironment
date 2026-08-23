// Intent: keep scene block text aligned with the flat textarea text after live manuscript edits.
import { deriveManuscriptEditTransaction } from "../manuscript-anchors/manuscript-edit-transaction-service.js";

const DEFAULT_SCENE_BLOCK_SEPARATOR = "\n\n";

// Intent: preserve an addressable draft block even when a new scene has visible text before canonical blocks exist.
export function reconcileSceneBlocksWithEditorText({
  blocks = [],
  sceneId = "",
  chapterId = "",
  text = "",
} = {}) {
  const sourceBlocks = Array.isArray(blocks) ? blocks : [];
  const normalizedText = String(text ?? "");
  if (!sourceBlocks.length) {
    return [createDraftSceneBlock({
      sceneId,
      chapterId,
      text: normalizedText,
    })];
  }

  if (sourceBlocks.length === 1) {
    return [normalizeSceneBlockForEditorText(sourceBlocks[0], {
      sceneId,
      chapterId,
      text: normalizedText,
      index: 0,
    })];
  }

  return sourceBlocks.map((block, index) => normalizeSceneBlockForEditorText(block, {
    sceneId,
    chapterId,
    text: String(block?.text ?? ""),
    index,
  }));
}

export function updateSceneBlocksForTextEdit({
  blocks = [],
  previousText = "",
  nextText = "",
  sceneId = "",
  separator = DEFAULT_SCENE_BLOCK_SEPARATOR,
  selectionStart = null,
  selectionEnd = null,
  selectionBeforeInputStart = null,
  selectionBeforeInputEnd = null,
} = {}) {
  const sourceBlocks = Array.isArray(blocks) ? blocks : [];
  const previous = String(previousText ?? "");
  const next = String(nextText ?? "");
  if (!sourceBlocks.length) {
    return reconcileSceneBlocksWithEditorText({
      sceneId,
      text: next,
    });
  }

  if (previous === next) {
    return reconcileSceneBlocksWithEditorText({
      blocks: sourceBlocks,
      sceneId,
      text: next,
    });
  }

  if (sourceBlocks.length === 1) {
    return [normalizeSceneBlockForEditorText(sourceBlocks[0], {
      sceneId,
      text: next,
      index: 0,
    })];
  }

  const blockRanges = createBlockRanges(sourceBlocks, previous, separator);
  const transaction = deriveManuscriptEditTransaction({
    sceneId: String(sceneId ?? "") || "scene",
    previousText: previous,
    nextText: next,
    selectionStart,
    selectionEnd,
    selectionBeforeInputStart,
    selectionBeforeInputEnd,
  });
  if (!transaction || !blockRanges.length) {
    return sourceBlocks.map(cloneBlock);
  }

  const editedRange = blockRanges.find((range) => (
    transaction.startOffset >= range.startOffset &&
    transaction.endOffset <= range.endOffset
  ));
  if (!editedRange) {
    return sourceBlocks.map(cloneBlock);
  }

  const localStart = transaction.startOffset - editedRange.startOffset;
  const localEnd = transaction.endOffset - editedRange.startOffset;
  const nextBlockText = [
    editedRange.text.slice(0, localStart),
    transaction.insertedText,
    editedRange.text.slice(localEnd),
  ].join("");

  return sourceBlocks.map((block, index) => (
    index === editedRange.index
      ? {
          ...cloneBlock(block),
          text: nextBlockText,
        }
      : cloneBlock(block)
  ));
}

function createBlockRanges(blocks, previousText, separator) {
  const exactRanges = createExactBlockRanges(blocks, separator);
  if (exactRanges.length && exactRanges.map((range) => range.text).join(separator) === previousText) {
    return exactRanges;
  }

  return createLocatedBlockRanges(blocks, previousText);
}

function createExactBlockRanges(blocks, separator) {
  const ranges = [];
  let offset = 0;
  for (let index = 0; index < blocks.length; index += 1) {
    const text = String(blocks[index]?.text ?? "");
    ranges.push({
      index,
      text,
      startOffset: offset,
      endOffset: offset + text.length,
    });
    offset += text.length + (index < blocks.length - 1 ? separator.length : 0);
  }
  return ranges;
}

function createLocatedBlockRanges(blocks, previousText) {
  const ranges = [];
  let cursor = 0;
  for (let index = 0; index < blocks.length; index += 1) {
    const text = String(blocks[index]?.text ?? "");
    if (!text) {
      continue;
    }

    const startOffset = previousText.indexOf(text, cursor);
    if (startOffset === -1) {
      return [];
    }

    ranges.push({
      index,
      text,
      startOffset,
      endOffset: startOffset + text.length,
    });
    cursor = startOffset + text.length;
  }
  return ranges;
}

function cloneBlock(block) {
  return {
    ...(block && typeof block === "object" ? block : {}),
  };
}

function normalizeSceneBlockForEditorText(block, {
  sceneId = "",
  chapterId = "",
  text = "",
  index = 0,
} = {}) {
  const normalizedSceneId = normalizeId(sceneId || block?.sceneId, "scene");
  const fallbackOrdinal = Math.max(1, Number(index) + 1 || 1);
  const blockId = normalizeId(block?.blockId || block?.id, `draft-block-${normalizedSceneId}-${fallbackOrdinal}`);
  return {
    ...cloneBlock(block),
    blockId,
    paragraphId: normalizeId(block?.paragraphId, `draft-paragraph-${normalizedSceneId}-${fallbackOrdinal}`),
    chapterId: normalizeId(block?.chapterId || chapterId, ""),
    sceneId: normalizedSceneId,
    lineNumber: normalizeLineNumber(block?.lineNumber),
    kind: typeof block?.kind === "string" && block.kind ? block.kind : "narration",
    speakerLabel: typeof block?.speakerLabel === "string" ? block.speakerLabel : "",
    text: String(text ?? ""),
    issueIds: Array.isArray(block?.issueIds) ? [...block.issueIds] : [],
    eventTagIds: Array.isArray(block?.eventTagIds) ? [...block.eventTagIds] : [],
    isDraft: Boolean(block?.isDraft ?? true),
  };
}

function createDraftSceneBlock({
  sceneId = "",
  chapterId = "",
  text = "",
} = {}) {
  return normalizeSceneBlockForEditorText({
    isDraft: true,
  }, {
    sceneId,
    chapterId,
    text,
    index: 0,
  });
}

function normalizeId(value, fallback) {
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  return normalizedValue || fallback;
}

function normalizeLineNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
