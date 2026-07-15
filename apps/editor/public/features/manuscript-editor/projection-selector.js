// Intent: select render-only manuscript projections without making the editor host a persistence owner.
import {
  createDraftProofCoverageProjections,
} from "../draft-proofing/draft-proofing-service.js";
import {
  createAnchorDecorationProjection,
  createSpellcheckDecorationProjections,
} from "../manuscript-anchors/manuscript-decoration-projection-service.js";
import { normalizeInlineFormatRanges } from "./manuscript-command-controller.js";
import {
  createAuthorMarkProjectionFromManuscriptMark,
  deriveManuscriptMarksFromInlineFormatRanges,
  isCompatibilityManuscriptMark,
  normalizeManuscriptMarks,
} from "./manuscript-mark-service.js";

export const MANUSCRIPT_PROJECTION_CHANNELS = Object.freeze({
  AUTHOR_MARK: "author-mark",
  DRAFT_PROOF: "draft-proof",
  DIAGNOSTIC: "diagnostic",
  TASK: "task",
  NOTE: "note",
  SEARCH: "search",
  NARRATION_FOLLOW: "narration-follow",
  SPELLCHECK: "spellcheck",
});

const PROJECTION_PRIORITY = Object.freeze({
  [MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK]: 100,
  [MANUSCRIPT_PROJECTION_CHANNELS.DRAFT_PROOF]: 95,
  [MANUSCRIPT_PROJECTION_CHANNELS.DIAGNOSTIC]: 90,
  [MANUSCRIPT_PROJECTION_CHANNELS.TASK]: 80,
  [MANUSCRIPT_PROJECTION_CHANNELS.NOTE]: 80,
  [MANUSCRIPT_PROJECTION_CHANNELS.SEARCH]: 70,
  [MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW]: 70,
  [MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK]: 40,
});

export function selectManuscriptProjections({
  projectId = "",
  sceneId = "",
  text = "",
  sceneBlocks = [],
  inlineFormatRanges = [],
  manuscriptMarks = [],
  draftProofing = null,
  draftProofRunId = "",
  diagnosticIssues = [],
  anchoredRecordPreviews = [],
  searchPreviews = [],
  narrationSelection = null,
  spellcheckMisspellings = [],
  includeAuthorMarks = true,
  includeDraftProofing = true,
  includeDiagnostics = true,
  includeAnchoredRecords = true,
  includeRuntimeSelections = true,
  includeSpellcheck = true,
} = {}) {
  const normalizedText = String(text ?? "");
  const normalizedProjectId = typeof projectId === "string" ? projectId : "";
  const normalizedSceneId = typeof sceneId === "string" ? sceneId : "";
  const projections = [];

  if (includeAuthorMarks) {
    projections.push(...createAuthorMarkProjections({
      projectId: normalizedProjectId,
      sceneId: normalizedSceneId,
      text: normalizedText,
      sceneBlocks,
      manuscriptMarks,
      inlineFormatRanges,
    }));
  }

  if (includeDraftProofing) {
    projections.push(...createDraftProofCoverageProjections({
      draftProofing,
      sceneId: normalizedSceneId,
      textLength: normalizedText.length,
      runId: draftProofRunId,
      channel: MANUSCRIPT_PROJECTION_CHANNELS.DRAFT_PROOF,
      priority: PROJECTION_PRIORITY[MANUSCRIPT_PROJECTION_CHANNELS.DRAFT_PROOF],
    }));
  }

  if (includeDiagnostics) {
    for (const issue of Array.isArray(diagnosticIssues) ? diagnosticIssues : []) {
      const projection = createDiagnosticProjection(
        issue,
        normalizedProjectId,
        normalizedSceneId,
        normalizedText,
        sceneBlocks,
      );
      if (projection) {
        projections.push(projection);
      }
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
    projections.push(...createSpellcheckDecorationProjections({
      sceneId: normalizedSceneId,
      text: normalizedText,
      misspellings: spellcheckMisspellings,
      channel: MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK,
      styleToken: "misspelled",
      priority: PROJECTION_PRIORITY[MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK],
    }));
  }

  return projections.sort(compareManuscriptProjections);
}

export function selectProjectionChannel(projections, channel) {
  return (Array.isArray(projections) ? projections : [])
    .filter((projection) => projection?.channel === channel)
    .sort(compareManuscriptProjections);
}

// Intent: prefer schema-shaped manuscript marks while legacy scene ranges remain readable during migration.
function createAuthorMarkProjections({
  projectId = "",
  sceneId = "",
  text = "",
  sceneBlocks = [],
  manuscriptMarks = [],
  inlineFormatRanges = [],
} = {}) {
  const explicitMarks = normalizeManuscriptMarks(manuscriptMarks, { sceneId });
  const hasCompatibilityMarks = explicitMarks.some((mark) => (
    isCompatibilityManuscriptMark(mark) &&
    String(mark?.anchor?.sceneId ?? "") === sceneId
  ));
  const derived = hasCompatibilityMarks
    ? { marks: [], unmappedRanges: [] }
    : deriveManuscriptMarksFromInlineFormatRanges({
      projectId,
      sceneId,
      text,
      sceneBlocks,
      inlineFormatRanges,
    });
  const projectionMarks = [
    ...explicitMarks,
    ...derived.marks,
  ];
  const projections = [];

  for (const mark of projectionMarks) {
    const projection = createAuthorMarkProjectionFromManuscriptMark(mark, {
      sceneId,
      sceneBlocks,
      text,
      channel: MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK,
      priority: PROJECTION_PRIORITY[MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK],
    });
    if (projection) {
      projections.push(projection);
    }
  }

  for (const range of normalizeInlineFormatRanges(derived.unmappedRanges, text.length)) {
    projections.push(createLegacyAuthorMarkProjection(range, sceneId));
  }

  return projections;
}

function createLegacyAuthorMarkProjection(range, sceneId) {
  return {
    id: `author-mark:${range.id}`,
    sceneId,
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
  };
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

// Intent: derive a visual diagnostic only while its durable issue anchor still resolves in current scene text.
function createDiagnosticProjection(issue, projectId, sceneId, text, sceneBlocks) {
  const issueId = typeof issue?.id === "string" ? issue.id : "";
  const anchor = issue?.anchor && typeof issue.anchor === "object" ? issue.anchor : null;
  const anchorProjectId = typeof anchor?.projectId === "string" ? anchor.projectId : "";
  const anchorSceneId = typeof anchor?.sceneId === "string" ? anchor.sceneId : "";
  const anchorBlockId = typeof anchor?.blockId === "string" ? anchor.blockId : "";
  const startOffset = Number(anchor?.startOffset);
  const endOffset = Number(anchor?.endOffset);
  const blocks = Array.isArray(sceneBlocks) ? sceneBlocks : [];
  if (
    !issueId ||
    issue?.lifecycle !== "open" ||
    !anchorProjectId ||
    (projectId && anchorProjectId !== projectId) ||
    anchorSceneId !== sceneId ||
    !anchorBlockId ||
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    startOffset < 0 ||
    endOffset <= startOffset
  ) {
    return null;
  }

  const blockIndex = blocks.findIndex((block) => block?.blockId === anchorBlockId);
  const blockText = blockIndex >= 0 ? String(blocks[blockIndex]?.text ?? "") : "";
  const evidenceExcerpt = typeof issue?.evidenceExcerpt === "string" ? issue.evidenceExcerpt : "";
  if (
    blockIndex < 0 ||
    endOffset > blockText.length ||
    !evidenceExcerpt ||
    blockText.slice(startOffset, endOffset) !== evidenceExcerpt
  ) {
    return null;
  }

  const sceneBlockStart = blocks.slice(0, blockIndex).reduce(
    (offset, block) => offset + String(block?.text ?? "").length + 2,
    0,
  );
  const sceneStartOffset = sceneBlockStart + startOffset;
  const sceneEndOffset = sceneBlockStart + endOffset;
  if (
    sceneEndOffset > text.length ||
    text.slice(sceneStartOffset, sceneEndOffset) !== evidenceExcerpt
  ) {
    return null;
  }

  const styleToken = ["error", "warning", "info"].includes(issue.severity)
    ? issue.severity
    : "warning";
  return {
    id: `diagnostic:${issueId}`,
    sceneId,
    startOffset: sceneStartOffset,
    endOffset: sceneEndOffset,
    channel: MANUSCRIPT_PROJECTION_CHANNELS.DIAGNOSTIC,
    styleToken,
    priority: PROJECTION_PRIORITY[MANUSCRIPT_PROJECTION_CHANNELS.DIAGNOSTIC],
    persistence: "derived-durable",
    sourceRef: {
      recordType: "issue",
      recordId: issueId,
    },
  };
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
  return createAnchorDecorationProjection({
    anchorId: `${recordType}:${recordId}`,
    ownerType: recordType,
    ownerId: recordId,
    projectionId: `${channel}:${recordId}`,
    sceneId: projectionSceneId,
    startOffset,
    endOffset,
    status: preview?.anchorStatus,
  }, {
    sceneId,
    textLength,
    channel,
    styleToken,
    priority: PROJECTION_PRIORITY[channel],
    persistence: "derived-durable",
  });
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
