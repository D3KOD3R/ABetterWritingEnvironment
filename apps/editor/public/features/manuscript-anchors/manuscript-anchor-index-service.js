// Intent: collect anchor-bearing records into one scene-local index before mutation or projection.
import {
  MANUSCRIPT_ANCHOR_STATUS,
  normalizeAnchorStatus,
  normalizeManuscriptAnchor,
} from "./manuscript-anchor-service.js";

export function createManuscriptAnchorIndex({
  projectId = "",
  sceneId = "",
  issues = [],
  tasks = [],
  passageNotes = [],
  eventTags = [],
  marks = [],
  revisionMarkers = [],
  narrationRecords = [],
  records = [],
  textLength = Number.POSITIVE_INFINITY,
} = {}) {
  const normalizedSceneId = String(sceneId ?? "");
  const entries = [
    ...collectIssueAnchors(issues, projectId, normalizedSceneId, textLength),
    ...collectOffsetRecordAnchors(tasks, "task", normalizedSceneId, textLength),
    ...collectOffsetRecordAnchors(passageNotes, "passageNote", normalizedSceneId, textLength),
    ...collectIssueAnchors(eventTags, projectId, normalizedSceneId, textLength, "eventTag"),
    ...collectGenericAnchorRecords(marks, "manuscriptMark", normalizedSceneId, textLength),
    ...collectGenericAnchorRecords(revisionMarkers, "revisionMarker", normalizedSceneId, textLength),
    ...collectGenericAnchorRecords(narrationRecords, "narrationRecord", normalizedSceneId, textLength),
    ...collectGenericAnchorRecords(records, "record", normalizedSceneId, textLength),
  ];

  return {
    projectId: String(projectId ?? ""),
    sceneId: normalizedSceneId,
    anchors: entries.sort((left, right) => (
      left.startOffset - right.startOffset ||
      left.endOffset - right.endOffset ||
      left.ownerType.localeCompare(right.ownerType) ||
      left.ownerId.localeCompare(right.ownerId)
    )),
  };
}

function collectIssueAnchors(records, projectId, sceneId, textLength, ownerType = "issue") {
  const entries = [];
  for (const record of Array.isArray(records) ? records : []) {
    const anchor = record?.anchor && typeof record.anchor === "object" ? record.anchor : null;
    if (!anchor) {
      continue;
    }

    const normalized = normalizeManuscriptAnchor({
      ...anchor,
      anchorId: `${ownerType}:${record.id ?? ""}`,
      projectId: anchor.projectId ?? projectId,
      status: record.anchorStatus ?? anchor.status ?? MANUSCRIPT_ANCHOR_STATUS.RESOLVED,
      evidenceExcerpt: typeof record.evidenceExcerpt === "string" ? record.evidenceExcerpt : anchor.evidenceExcerpt,
    }, {
      textLength,
      defaultSceneId: sceneId,
    });
    if (!normalized || normalized.sceneId !== sceneId) {
      continue;
    }

    entries.push(createIndexEntry(record, ownerType, normalized));
  }
  return entries;
}

function collectOffsetRecordAnchors(records, ownerType, sceneId, textLength) {
  const entries = [];
  for (const record of Array.isArray(records) ? records : []) {
    const normalized = normalizeManuscriptAnchor({
      anchorId: `${ownerType}:${record?.id ?? ""}`,
      projectId: record?.projectId,
      chapterId: record?.chapterId,
      sceneId: record?.sceneId,
      blockId: record?.blockId,
      paragraphId: record?.paragraphId,
      startOffset: record?.startOffset,
      endOffset: record?.endOffset,
      status: record?.anchorStatus ?? record?.status,
      evidenceExcerpt: record?.selectedText,
      selectedTextPreview: record?.selectedText,
      prefixContext: record?.nearbyBefore,
      suffixContext: record?.nearbyAfter,
    }, {
      textLength,
      defaultSceneId: sceneId,
    });
    if (!normalized || normalized.sceneId !== sceneId) {
      continue;
    }

    entries.push(createIndexEntry(record, ownerType, normalized));
  }
  return entries;
}

function collectGenericAnchorRecords(records, fallbackOwnerType, sceneId, textLength) {
  const entries = [];
  for (const record of Array.isArray(records) ? records : []) {
    const anchor = record?.anchor && typeof record.anchor === "object" ? record.anchor : record;
    const ownerType = typeof record?.ownerType === "string" && record.ownerType
      ? record.ownerType
      : fallbackOwnerType;
    const normalized = normalizeManuscriptAnchor({
      ...anchor,
      anchorId: anchor?.anchorId ?? `${ownerType}:${record?.id ?? anchor?.id ?? ""}`,
      status: anchor?.status ?? record?.anchorStatus ?? record?.status,
    }, {
      textLength,
      defaultSceneId: sceneId,
      allowCollapsed: true,
    });
    if (!normalized || normalized.sceneId !== sceneId) {
      continue;
    }

    entries.push(createIndexEntry(record, ownerType, normalized));
  }
  return entries;
}

function createIndexEntry(record, ownerType, anchor) {
  const ownerId = String(record?.id ?? anchor.anchorId ?? "");
  return {
    ...anchor,
    ownerType,
    ownerId,
    anchorId: anchor.anchorId || `${ownerType}:${ownerId}`,
    record,
    status: normalizeAnchorStatus(anchor.status),
  };
}
