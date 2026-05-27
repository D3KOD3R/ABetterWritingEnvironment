// Intent: resolve durable anchored-record navigation into editor projections without owning DOM effects.
import {
  MANUSCRIPT_PROJECTION_CHANNELS,
  selectManuscriptProjections,
} from "./projection-selector.js";

export function createAnchoredRecordNavigationController({
  resolveRecordRange,
  repairResolvedRange,
} = {}) {
  if (typeof resolveRecordRange !== "function") {
    throw new Error("AnchoredRecordNavigationController requires resolveRecordRange.");
  }

  function findRecordAtSelection({
    records = [],
    recordType = "",
    sceneId = "",
    selectionStart = 0,
    selectionEnd = selectionStart,
    text = "",
  } = {}) {
    const normalizedSceneId = String(sceneId ?? "");
    const startOffset = Math.min(normalizeOffset(selectionStart), normalizeOffset(selectionEnd));
    const endOffset = Math.max(normalizeOffset(selectionStart), normalizeOffset(selectionEnd));
    const hasSelection = endOffset > startOffset;
    const candidates = (Array.isArray(records) ? records : [])
      .filter((record) => record?.sceneId === normalizedSceneId)
      .map((record) => ({
        record,
        range: resolveRecordRange(record, String(text ?? "")),
      }))
      .filter(({ range }) => Number(range?.endOffset) > Number(range?.startOffset))
      .filter(({ range }) =>
        hasSelection
          ? range.startOffset < endOffset && range.endOffset > startOffset
          : startOffset >= range.startOffset && startOffset <= range.endOffset,
      )
      .sort((left, right) =>
        (left.range.endOffset - left.range.startOffset) -
        (right.range.endOffset - right.range.startOffset),
      );

    const match = candidates[0] ?? null;
    if (!match) {
      return null;
    }

    repairResolvedRange?.(recordType, match.record, match.range);
    return match.record;
  }

  function buildPreview({
    record,
    recordType = "",
    text = "",
    repair = true,
  } = {}) {
    if (!record || (recordType !== "task" && recordType !== "passageNote")) {
      return null;
    }

    const resolvedRange = resolveRecordRange(record, String(text ?? ""));
    if (
      !resolvedRange ||
      !Number.isInteger(resolvedRange.startOffset) ||
      !Number.isInteger(resolvedRange.endOffset) ||
      resolvedRange.endOffset <= resolvedRange.startOffset
    ) {
      return null;
    }

    if (repair) {
      repairResolvedRange?.(recordType, record, resolvedRange);
    }
    const channel = recordType === "task"
      ? MANUSCRIPT_PROJECTION_CHANNELS.TASK
      : MANUSCRIPT_PROJECTION_CHANNELS.NOTE;
    const projection = selectManuscriptProjections({
      sceneId: String(record.sceneId ?? ""),
      text,
      anchoredRecordPreviews: [{
        recordType,
        recordId: String(record.id ?? ""),
        sceneId: String(record.sceneId ?? ""),
        noteType: record.noteType,
        startOffset: resolvedRange.startOffset,
        endOffset: resolvedRange.endOffset,
      }],
      includeAuthorMarks: false,
      includeSpellcheck: false,
    }).find((candidate) => candidate.channel === channel) ?? null;

    if (!projection) {
      return null;
    }

    return {
      projection,
      resolvedRange,
      previewSelection: {
        taskId: record.id,
        sceneId: record.sceneId,
        selectionStart: resolvedRange.startOffset,
        selectionEnd: resolvedRange.endOffset,
      },
    };
  }

  return {
    buildPreview,
    findRecordAtSelection,
  };
}

function normalizeOffset(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}
