// Intent: select render-only manuscript projections without making the editor host a persistence owner.
import { normalizeInlineFormatRanges } from "./manuscript-command-controller.js";

export const MANUSCRIPT_PROJECTION_CHANNELS = Object.freeze({
  AUTHOR_MARK: "author-mark",
  TASK: "task",
  NOTE: "note",
  SEARCH: "search",
  NARRATION_FOLLOW: "narration-follow",
  SPELLCHECK: "spellcheck",
});

const PROJECTION_PRIORITY = Object.freeze({
  [MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK]: 100,
  [MANUSCRIPT_PROJECTION_CHANNELS.TASK]: 80,
  [MANUSCRIPT_PROJECTION_CHANNELS.NOTE]: 80,
  [MANUSCRIPT_PROJECTION_CHANNELS.SEARCH]: 70,
  [MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW]: 70,
  [MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK]: 40,
});

export function selectManuscriptProjections({
  sceneId = "",
  text = "",
  inlineFormatRanges = [],
  anchoredRecordPreviews = [],
  searchPreviews = [],
  narrationSelection = null,
  spellcheckMisspellings = [],
  includeAuthorMarks = true,
  includeAnchoredRecords = true,
  includeRuntimeSelections = true,
  includeSpellcheck = true,
} = {}) {
  const normalizedText = String(text ?? "");
  const normalizedSceneId = typeof sceneId === "string" ? sceneId : "";
  const projections = [];

  if (includeAuthorMarks) {
    for (const range of normalizeInlineFormatRanges(inlineFormatRanges, normalizedText.length)) {
      projections.push({
        id: `author-mark:${range.id}`,
        sceneId: normalizedSceneId,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        channel: MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK,
        styleToken: range.formatId,
        priority: PROJECTION_PRIORITY[MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK],
        persistence: "derived-durable",
        sourceRef: {
          recordType: "inlineFormatRange",
          recordId: range.id,
        },
      });
    }
  }

  if (includeAnchoredRecords) {
    for (const preview of Array.isArray(anchoredRecordPreviews) ? anchoredRecordPreviews : []) {
      const projection = createAnchoredRecordProjection(preview, normalizedSceneId, normalizedText.length);
      if (projection) {
        projections.push(projection);
      }
    }
  }

  if (includeRuntimeSelections) {
    for (const preview of Array.isArray(searchPreviews) ? searchPreviews : []) {
      const projection = createRuntimeSelectionProjection(
        preview,
        normalizedSceneId,
        normalizedText.length,
        MANUSCRIPT_PROJECTION_CHANNELS.SEARCH,
      );
      if (projection) {
        projections.push(projection);
      }
    }

    const narrationProjection = createRuntimeSelectionProjection(
      narrationSelection,
      normalizedSceneId,
      normalizedText.length,
      MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW,
    );
    if (narrationProjection) {
      projections.push(narrationProjection);
    }
  }

  if (includeSpellcheck) {
    for (const misspelling of Array.isArray(spellcheckMisspellings) ? spellcheckMisspellings : []) {
      const startOffset = Number(misspelling?.index);
      const endOffset = Number(misspelling?.endIndex);
      if (
        !Number.isInteger(startOffset) ||
        !Number.isInteger(endOffset) ||
        startOffset < 0 ||
        endOffset <= startOffset ||
        endOffset > normalizedText.length
      ) {
        continue;
      }
      const normalizedWord = typeof misspelling.normalizedWord === "string"
        ? misspelling.normalizedWord
        : String(misspelling.word ?? "").toLowerCase();
      projections.push({
        id: `spellcheck:${normalizedSceneId}:${startOffset}:${endOffset}:${normalizedWord}`,
        sceneId: normalizedSceneId,
        startOffset,
        endOffset,
        channel: MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK,
        styleToken: "misspelled",
        priority: PROJECTION_PRIORITY[MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK],
        persistence: "runtime-only",
      });
    }
  }

  return projections.sort(compareManuscriptProjections);
}

export function selectProjectionChannel(projections, channel) {
  return (Array.isArray(projections) ? projections : [])
    .filter((projection) => projection?.channel === channel)
    .sort(compareManuscriptProjections);
}

function compareManuscriptProjections(left, right) {
  return (
    left.startOffset - right.startOffset ||
    left.endOffset - right.endOffset ||
    right.priority - left.priority ||
    left.channel.localeCompare(right.channel) ||
    left.id.localeCompare(right.id)
  );
}

function createAnchoredRecordProjection(preview, sceneId, textLength) {
  const recordType = preview?.recordType === "task"
    ? "task"
    : preview?.recordType === "passageNote"
      ? "passageNote"
      : "";
  const recordId = typeof preview?.recordId === "string" ? preview.recordId : "";
  const projectionSceneId = typeof preview?.sceneId === "string" ? preview.sceneId : sceneId;
  const startOffset = Number(preview?.startOffset);
  const endOffset = Number(preview?.endOffset);
  if (
    !recordType ||
    !recordId ||
    projectionSceneId !== sceneId ||
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    startOffset < 0 ||
    endOffset <= startOffset ||
    endOffset > textLength
  ) {
    return null;
  }

  const isTask = recordType === "task";
  const noteType = preview?.noteType === "research" ? "research" : "inspiration";
  const channel = isTask ? MANUSCRIPT_PROJECTION_CHANNELS.TASK : MANUSCRIPT_PROJECTION_CHANNELS.NOTE;
  const styleToken = isTask ? "task" : noteType;
  return {
    id: `${channel}:${recordId}`,
    sceneId,
    startOffset,
    endOffset,
    channel,
    styleToken,
    priority: PROJECTION_PRIORITY[channel],
    persistence: "derived-durable",
    sourceRef: {
      recordType,
      recordId,
    },
  };
}

function createRuntimeSelectionProjection(preview, sceneId, textLength, channel) {
  if (!preview || typeof preview !== "object") {
    return null;
  }

  const projectionSceneId = typeof preview.sceneId === "string" ? preview.sceneId : sceneId;
  const startOffset = Number(preview.startOffset);
  const endOffset = Number(preview.endOffset);
  if (
    projectionSceneId !== sceneId ||
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    startOffset < 0 ||
    endOffset <= startOffset ||
    endOffset > textLength
  ) {
    return null;
  }

  const sourceId = typeof preview.id === "string" && preview.id
    ? preview.id
    : `${sceneId}:${startOffset}:${endOffset}`;
  return {
    id: `${channel}:${sourceId}`,
    sceneId,
    startOffset,
    endOffset,
    channel,
    styleToken: channel,
    priority: PROJECTION_PRIORITY[channel],
    persistence: "runtime-only",
  };
}
