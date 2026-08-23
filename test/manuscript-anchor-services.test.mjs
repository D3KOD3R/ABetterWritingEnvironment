// Intent: verify anchor DTO, edit transaction, drift, validation, index, and decoration projection services.
import assert from "node:assert/strict";

import {
  MANUSCRIPT_ANCHOR_EVIDENCE_MODE,
  MANUSCRIPT_ANCHOR_STATUS,
  createAnchorEvidence,
  createManuscriptAnchor,
  createStableTextHash,
} from "../apps/editor/public/features/manuscript-anchors/manuscript-anchor-service.js";
import {
  deriveManuscriptEditTransaction,
} from "../apps/editor/public/features/manuscript-anchors/manuscript-edit-transaction-service.js";
import {
  applyEditTransactionToAnchor,
  applyEditTransactionToAnchors,
} from "../apps/editor/public/features/manuscript-anchors/manuscript-anchor-mutation-service.js";
import {
  validateAnchorAgainstText,
} from "../apps/editor/public/features/manuscript-anchors/manuscript-anchor-validation-service.js";
import {
  createManuscriptAnchorIdleValidationScheduler,
} from "../apps/editor/public/features/manuscript-anchors/manuscript-anchor-idle-validation-scheduler.js";
import {
  createManuscriptAnchorIndex,
} from "../apps/editor/public/features/manuscript-anchors/manuscript-anchor-index-service.js";
import {
  createAnchorDecorationProjections,
  createSpellcheckDecorationProjections,
} from "../apps/editor/public/features/manuscript-anchors/manuscript-decoration-projection-service.js";
import {
  createOffsetAnchoredRecordEvidencePatch,
  resolveOffsetAnchoredRecordRange,
  updateCanonicalAnchorRecordForTextEdit,
  updateCanonicalAnchorRecordsForTextEdit,
  validateCanonicalAnchorRecordAgainstText,
  validateOffsetAnchoredRecordAgainstText,
  validateOffsetAnchoredRecordsByScene,
  validateOffsetAnchoredRecordsAgainstText,
  updateOffsetAnchoredRecordsForTextEdit,
} from "../apps/editor/public/features/manuscript-anchors/manuscript-anchor-record-service.js";

export function runManuscriptAnchorServicesTest() {
  const longText = `Intro ${"A".repeat(300)} Outro`;
  const longEvidence = createAnchorEvidence({
    text: longText,
    startOffset: "Intro ".length,
    endOffset: "Intro ".length + 300,
  });
  assert.equal(longEvidence.evidenceMode, MANUSCRIPT_ANCHOR_EVIDENCE_MODE.HASH_CONTEXT);
  assert.equal(longEvidence.evidenceExcerpt, "");
  assert.equal(longEvidence.originalLength, 300);
  assert.equal(longEvidence.selectedTextPreview.length, 180);
  assert.equal(longEvidence.prefixContext, "Intro ");
  assert.equal(longEvidence.suffixContext, " Outro");
  assert.equal(longEvidence.originalHash, createStableTextHash("A".repeat(300)));

  const previousText = "Alpha target omega";
  const insertedBeforeText = "Alpha bright target omega";
  const insertBeforeTransaction = deriveManuscriptEditTransaction({
    sceneId: "scene-1",
    previousText,
    nextText: insertedBeforeText,
    createdAt: "2026-06-01T00:00:00.000Z",
  });
  assert.ok(insertBeforeTransaction);
  assert.equal(insertBeforeTransaction.startOffset, 6);
  assert.equal(insertBeforeTransaction.endOffset, 6);
  assert.equal(insertBeforeTransaction.insertedText, "bright ");
  assert.equal(insertBeforeTransaction.deletedText, "");
  assert.equal(insertBeforeTransaction.persistence, "runtime-only");

  const repeatedTextInsertion = deriveManuscriptEditTransaction({
    sceneId: "scene-1",
    previousText: "abcabc",
    nextText: "abcaabc",
    selectionStart: 4,
    selectionEnd: 4,
  });
  assert.ok(repeatedTextInsertion);
  assert.equal(repeatedTextInsertion.startOffset, 3);
  assert.equal(repeatedTextInsertion.endOffset, 3);
  assert.equal(repeatedTextInsertion.insertedText, "a");
  assert.equal(repeatedTextInsertion.deletedText, "");

  const targetAnchor = createManuscriptAnchor({
    anchorId: "anchor-target",
    sceneId: "scene-1",
    startOffset: 6,
    endOffset: 12,
    text: previousText,
  });
  const shifted = applyEditTransactionToAnchor(targetAnchor, insertBeforeTransaction, {
    textLength: previousText.length,
  });
  assert.equal(shifted.changed, true);
  assert.equal(shifted.anchor.startOffset, 13);
  assert.equal(shifted.anchor.endOffset, 19);
  assert.equal(shifted.anchor.status, MANUSCRIPT_ANCHOR_STATUS.SHIFTED);
  assert.equal(shifted.anchor.dirtyReason, "offset-shifted");
  assert.equal(shifted.anchor.lastTouchedByEditId, insertBeforeTransaction.editId);

  const insideTransaction = deriveManuscriptEditTransaction({
    sceneId: "scene-1",
    previousText,
    nextText: "Alpha tarXget omega",
    editId: "edit-inside",
  });
  const contentChanged = applyEditTransactionToAnchor(targetAnchor, insideTransaction, {
    textLength: previousText.length,
  });
  assert.equal(contentChanged.anchor.startOffset, 6);
  assert.equal(contentChanged.anchor.endOffset, 13);
  assert.equal(contentChanged.anchor.status, MANUSCRIPT_ANCHOR_STATUS.CONTENT_CHANGED);
  assert.equal(contentChanged.anchor.dirtyReason, "content-edited");

  const deleteBeforeTransaction = deriveManuscriptEditTransaction({
    sceneId: "scene-1",
    previousText,
    nextText: "target omega",
    editId: "edit-delete-before",
  });
  const shiftedBack = applyEditTransactionToAnchor(targetAnchor, deleteBeforeTransaction, {
    textLength: previousText.length,
  });
  assert.equal(shiftedBack.anchor.startOffset, 0);
  assert.equal(shiftedBack.anchor.endOffset, 6);
  assert.equal(shiftedBack.anchor.status, MANUSCRIPT_ANCHOR_STATUS.SHIFTED);

  const replacementTransaction = deriveManuscriptEditTransaction({
    sceneId: "scene-1",
    previousText,
    nextText: "Alpha seed omega",
    editId: "edit-replace-anchor",
  });
  const replaced = applyEditTransactionToAnchor(targetAnchor, replacementTransaction, {
    textLength: previousText.length,
  });
  assert.equal(replaced.anchor.startOffset, 6);
  assert.equal(replaced.anchor.endOffset, 10);
  assert.equal(replaced.anchor.status, MANUSCRIPT_ANCHOR_STATUS.CONTENT_CHANGED);
  assert.equal(replaced.anchor.dirtyReason, "content-replaced");

  const repeatedCharacterReplacement = deriveManuscriptEditTransaction({
    sceneId: "scene-1",
    previousText: "aaaa",
    nextText: "aaaaa",
    selectionStart: 2,
    selectionEnd: 2,
    selectionBeforeInputStart: 0,
    selectionBeforeInputEnd: 1,
    editId: "edit-replace-repeated-character",
  });
  assert.equal(repeatedCharacterReplacement.startOffset, 0);
  assert.equal(repeatedCharacterReplacement.endOffset, 1);
  assert.equal(repeatedCharacterReplacement.deletedText, "a");
  assert.equal(repeatedCharacterReplacement.insertedText, "aa");

  const deleteAnchorTransaction = deriveManuscriptEditTransaction({
    sceneId: "scene-1",
    previousText,
    nextText: "Alpha  omega",
    editId: "edit-delete-anchor",
  });
  const deleted = applyEditTransactionToAnchor(targetAnchor, deleteAnchorTransaction, {
    textLength: previousText.length,
  });
  assert.equal(deleted.anchor.startOffset, 6);
  assert.equal(deleted.anchor.endOffset, 6);
  assert.equal(deleted.anchor.status, MANUSCRIPT_ANCHOR_STATUS.DELETED);
  assert.equal(deleted.anchor.dirtyReason, "anchor-deleted");

  const batch = applyEditTransactionToAnchors([
    targetAnchor,
    createManuscriptAnchor({
      anchorId: "anchor-after",
      sceneId: "scene-1",
      startOffset: 13,
      endOffset: 18,
      text: previousText,
    }),
  ], insertBeforeTransaction, {
    textLength: previousText.length,
  });
  assert.equal(batch.changedAnchors.length, 2);
  assert.deepEqual(batch.anchors.map((anchor) => [anchor.startOffset, anchor.endOffset]), [
    [13, 19],
    [20, 25],
  ]);

  const validated = validateAnchorAgainstText(targetAnchor, previousText);
  assert.equal(validated.status, MANUSCRIPT_ANCHOR_STATUS.RESOLVED);
  const recovered = validateAnchorAgainstText(targetAnchor, insertedBeforeText);
  assert.equal(recovered.status, MANUSCRIPT_ANCHOR_STATUS.APPROXIMATE);
  assert.equal(recovered.startOffset, 13);
  assert.equal(recovered.endOffset, 19);
  const stale = validateAnchorAgainstText(targetAnchor, "Alpha missing omega");
  assert.equal(stale.status, MANUSCRIPT_ANCHOR_STATUS.STALE);

  const index = createManuscriptAnchorIndex({
    projectId: "project-1",
    sceneId: "scene-1",
    textLength: previousText.length,
    issues: [{
      id: "issue-1",
      evidenceExcerpt: "target",
      anchor: {
        projectId: "project-1",
        sceneId: "scene-1",
        blockId: "block-1",
        startOffset: 6,
        endOffset: 12,
      },
    }],
    tasks: [{
      id: "task-1",
      sceneId: "scene-1",
      startOffset: 0,
      endOffset: 5,
      selectedText: "Alpha",
      anchorStatus: "active",
    }],
    passageNotes: [{
      id: "note-other-scene",
      sceneId: "scene-2",
      startOffset: 0,
      endOffset: 5,
      selectedText: "Other",
    }],
    marks: [{
      id: "mark-1",
      evidenceExcerpt: "omega",
      anchorStatus: "resolved",
      anchor: {
        projectId: "project-1",
        sceneId: "scene-1",
        blockId: "block-1",
        startOffset: 13,
        endOffset: 18,
      },
    }],
  });
  assert.deepEqual(index.anchors.map((anchor) => `${anchor.ownerType}:${anchor.ownerId}`), [
    "task:task-1",
    "issue:issue-1",
    "manuscriptMark:mark-1",
  ]);

  const anchorProjections = createAnchorDecorationProjections(index.anchors, {
    sceneId: "scene-1",
    textLength: previousText.length,
    channelByOwnerType: {
      issue: "diagnostic",
      task: "task",
    },
    styleTokenByOwnerType: {
      issue: "warning",
      task: "task",
    },
    priorityByChannel: {
      diagnostic: 90,
      task: 80,
    },
  });
  assert.deepEqual(anchorProjections.map((projection) => projection.channel), ["task", "diagnostic"]);
  assert.equal(anchorProjections[0].persistence, "derived-durable");
  assert.deepEqual(anchorProjections[1].sourceRef, {
    recordType: "issue",
    recordId: "issue-1",
  });

  const spellcheckProjections = createSpellcheckDecorationProjections({
    sceneId: "scene-1",
    text: previousText,
    misspellings: [{
      word: "target",
      normalizedWord: "targte",
      index: 6,
      endIndex: 12,
    }, {
      word: "outside",
      index: 30,
      endIndex: 37,
    }],
  });
  assert.equal(spellcheckProjections.length, 1);
  assert.equal(spellcheckProjections[0].channel, "spellcheck");
  assert.equal(spellcheckProjections[0].styleToken, "misspelled");
  assert.equal(spellcheckProjections[0].persistence, "runtime-only");

  const recordDrift = updateOffsetAnchoredRecordsForTextEdit({
    records: [{
      id: "task-1",
      sceneId: "scene-1",
      startOffset: 6,
      endOffset: 12,
      selectedText: "target",
      nearbyBefore: "Alpha ",
      nearbyAfter: " omega",
      anchorStatus: "active",
    }, {
      id: "task-other-scene",
      sceneId: "scene-2",
      startOffset: 0,
      endOffset: 5,
      selectedText: "Other",
    }],
    sceneId: "scene-1",
    previousText,
    nextText: insertedBeforeText,
    ownerType: "task",
    now: "2026-06-01T00:00:00.000Z",
  });
  assert.equal(recordDrift.changedRecords.length, 1);
  assert.equal(recordDrift.records[0].startOffset, 13);
  assert.equal(recordDrift.records[0].endOffset, 19);
  assert.equal(recordDrift.records[0].selectedText, "target");
  assert.equal(recordDrift.records[0].anchorStatus, MANUSCRIPT_ANCHOR_STATUS.SHIFTED);
  assert.equal(recordDrift.records[0].anchorDirtyReason, "offset-shifted");
  assert.equal(recordDrift.records[0].nearbyBefore, "Alpha ");
  assert.equal(recordDrift.records[0].nearbyAfter, " omega");
  assert.equal(recordDrift.records[0].originalHash, undefined);
  assert.equal(recordDrift.records[1].startOffset, 0);

  const initialEvidencePatch = createOffsetAnchoredRecordEvidencePatch({
    text: previousText,
    startOffset: 6,
    endOffset: 12,
  });
  assert.equal(initialEvidencePatch.anchorStatus, MANUSCRIPT_ANCHOR_STATUS.RESOLVED);
  assert.equal(initialEvidencePatch.originalHash, createStableTextHash("target"));
  assert.equal(initialEvidencePatch.selectedTextPreview, "target");

  const legacyRecord = {
    id: "legacy-task",
    sceneId: "scene-1",
    startOffset: 6,
    endOffset: 12,
    selectedText: "target",
  };
  const lazyValidated = validateOffsetAnchoredRecordAgainstText(legacyRecord, previousText, {
    ownerType: "task",
    now: "2026-06-01T00:01:00.000Z",
  });
  assert.equal(lazyValidated.changed, true);
  assert.equal(lazyValidated.range.matched, true);
  assert.equal(lazyValidated.record.anchorStatus, MANUSCRIPT_ANCHOR_STATUS.RESOLVED);
  assert.equal(lazyValidated.record.selectedText, "target");
  assert.equal(lazyValidated.record.originalHash, createStableTextHash("target"));
  assert.equal(lazyValidated.record.anchorLastTouchedAt, "2026-06-01T00:01:00.000Z");

  const lazyRecovered = resolveOffsetAnchoredRecordRange(legacyRecord, insertedBeforeText, {
    ownerType: "task",
    fallbackRange: (record, source) => {
      const index = source.indexOf(record.selectedText);
      return index >= 0
        ? {
            startOffset: index,
            endOffset: index + record.selectedText.length,
            matched: true,
          }
        : null;
    },
  });
  assert.equal(lazyRecovered.status, MANUSCRIPT_ANCHOR_STATUS.APPROXIMATE);
  assert.equal(lazyRecovered.startOffset, 13);
  assert.equal(lazyRecovered.recordPatch.anchorStatus, MANUSCRIPT_ANCHOR_STATUS.APPROXIMATE);
  assert.equal(lazyRecovered.recordPatch.anchorDirtyReason, "legacy-range-recovered");

  const lazyStale = resolveOffsetAnchoredRecordRange(legacyRecord, "Alpha missing omega", {
    ownerType: "task",
  });
  assert.equal(lazyStale.matched, false);
  assert.equal(lazyStale.status, MANUSCRIPT_ANCHOR_STATUS.STALE);
  assert.equal(lazyStale.recordPatch.anchorStatus, MANUSCRIPT_ANCHOR_STATUS.STALE);

  const lazyBatch = validateOffsetAnchoredRecordsAgainstText({
    records: [legacyRecord, {
      id: "already-valid",
      sceneId: "scene-1",
      startOffset: 0,
      endOffset: 5,
      selectedText: "Alpha",
      ...createOffsetAnchoredRecordEvidencePatch({
        text: previousText,
        startOffset: 0,
        endOffset: 5,
      }),
    }],
    text: previousText,
    ownerType: "task",
  });
  assert.equal(lazyBatch.records.length, 2);
  assert.equal(lazyBatch.changedRecords.length, 1);
  assert.equal(lazyBatch.changedRecords[0].id, "legacy-task");

  const sceneBatch = validateOffsetAnchoredRecordsByScene({
    records: [legacyRecord, {
      id: "missing-scene",
      sceneId: "scene-missing",
      startOffset: 0,
      endOffset: 6,
      selectedText: "Missing",
    }],
    ownerType: "task",
    getTextForScene: (sceneId) => sceneId === "scene-1" ? previousText : null,
  });
  assert.equal(sceneBatch.records.length, 2);
  assert.equal(sceneBatch.changedRecords.length, 1);
  assert.equal(sceneBatch.records[1].anchorStatus, undefined);

  const recordContentEdit = updateOffsetAnchoredRecordsForTextEdit({
    records: [recordDrift.records[0]],
    sceneId: "scene-1",
    previousText: insertedBeforeText,
    nextText: "Alpha bright tarXget omega",
    ownerType: "task",
  });
  assert.equal(recordContentEdit.records[0].selectedText, "tarXget");
  assert.equal(recordContentEdit.records[0].anchorStatus, MANUSCRIPT_ANCHOR_STATUS.CONTENT_CHANGED);
  assert.equal(recordContentEdit.records[0].nearbyBefore, "Alpha bright ");
  assert.ok(recordContentEdit.records[0].originalHash);

  const recordDelete = updateOffsetAnchoredRecordsForTextEdit({
    records: [recordContentEdit.records[0]],
    sceneId: "scene-1",
    previousText: "Alpha bright tarXget omega",
    nextText: "Alpha bright  omega",
    ownerType: "task",
  });
  assert.equal(recordDelete.records[0].startOffset, "Alpha bright ".length);
  assert.equal(recordDelete.records[0].endOffset, "Alpha bright ".length);
  assert.equal(recordDelete.records[0].selectedText, "");
  assert.equal(recordDelete.records[0].anchorStatus, MANUSCRIPT_ANCHOR_STATUS.DELETED);

  // Intent: canonical anchor records share the same live drift path as task/note offset records.
  const canonicalIssue = {
    id: "issue-1",
    lifecycle: "open",
    evidenceExcerpt: "target",
    prefixContext: "Alpha ",
    suffixContext: " omega",
    anchor: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-1",
      blockId: "block-1",
      paragraphId: "paragraph-1",
      startOffset: 6,
      endOffset: 12,
    },
  };
  const canonicalShift = updateCanonicalAnchorRecordForTextEdit({
    record: canonicalIssue,
    sceneId: "scene-1",
    previousText,
    nextText: insertedBeforeText,
    ownerType: "issue",
    now: "2026-06-01T00:02:00.000Z",
  });
  assert.equal(canonicalShift.changed, true);
  assert.equal(canonicalShift.record.anchor.startOffset, 13);
  assert.equal(canonicalShift.record.anchor.endOffset, 19);
  assert.equal(canonicalShift.record.anchorStatus, MANUSCRIPT_ANCHOR_STATUS.SHIFTED);
  assert.equal(canonicalShift.record.anchorDirtyReason, "offset-shifted");
  assert.equal(canonicalShift.record.evidenceExcerpt, "target");
  assert.equal(canonicalShift.record.originalHash, undefined);

  const canonicalMarkShift = updateCanonicalAnchorRecordForTextEdit({
    record: {
      id: "mark-1",
      kind: "highlight",
      source: "author",
      evidenceExcerpt: "target",
      prefixContext: "Alpha ",
      suffixContext: " omega",
      anchor: {
        projectId: "project-1",
        chapterId: "chapter-1",
        sceneId: "scene-1",
        blockId: "block-1",
        paragraphId: "paragraph-1",
        startOffset: 6,
        endOffset: 12,
      },
    },
    sceneId: "scene-1",
    previousText,
    nextText: insertedBeforeText,
    ownerType: "manuscriptMark",
    now: "2026-06-01T00:02:30.000Z",
  });
  assert.equal(canonicalMarkShift.changed, true);
  assert.equal(canonicalMarkShift.record.anchor.startOffset, 13);
  assert.equal(canonicalMarkShift.record.anchor.endOffset, 19);
  assert.equal(canonicalMarkShift.record.anchorStatus, MANUSCRIPT_ANCHOR_STATUS.SHIFTED);
  assert.equal(canonicalMarkShift.record.evidenceExcerpt, "target");

  const repeatedTextMarkShift = updateCanonicalAnchorRecordForTextEdit({
    record: {
      id: "mark-repeated",
      kind: "highlight",
      source: "author",
      evidenceExcerpt: "abc",
      anchor: {
        sceneId: "scene-1",
        startOffset: 3,
        endOffset: 6,
      },
    },
    sceneId: "scene-1",
    previousText: "abcabc",
    nextText: "abcaabc",
    ownerType: "manuscriptMark",
    selectionStart: 4,
    selectionEnd: 4,
  });
  assert.equal(repeatedTextMarkShift.changed, true);
  assert.equal(repeatedTextMarkShift.record.anchor.startOffset, 4);
  assert.equal(repeatedTextMarkShift.record.anchor.endOffset, 7);
  assert.equal(repeatedTextMarkShift.record.anchorStatus, MANUSCRIPT_ANCHOR_STATUS.SHIFTED);
  assert.equal(repeatedTextMarkShift.record.evidenceExcerpt, "abc");

  const secondRepeatedTextMarkShift = updateCanonicalAnchorRecordForTextEdit({
    record: repeatedTextMarkShift.record,
    sceneId: "scene-1",
    previousText: "abcaabc",
    nextText: "abcaaabc",
    ownerType: "manuscriptMark",
    selectionStart: 5,
    selectionEnd: 5,
  });
  assert.equal(secondRepeatedTextMarkShift.changed, true);
  assert.equal(secondRepeatedTextMarkShift.record.anchor.startOffset, 5);
  assert.equal(secondRepeatedTextMarkShift.record.anchor.endOffset, 8);
  assert.equal(secondRepeatedTextMarkShift.record.anchorStatus, MANUSCRIPT_ANCHOR_STATUS.SHIFTED);
  assert.equal(secondRepeatedTextMarkShift.record.evidenceExcerpt, "abc");

  const canonicalContentEdit = updateCanonicalAnchorRecordForTextEdit({
    record: canonicalShift.record,
    sceneId: "scene-1",
    previousText: insertedBeforeText,
    nextText: "Alpha bright tarXget omega",
    ownerType: "issue",
    now: "2026-06-01T00:03:00.000Z",
  });
  assert.equal(canonicalContentEdit.changed, true);
  assert.equal(canonicalContentEdit.record.anchorStatus, MANUSCRIPT_ANCHOR_STATUS.CONTENT_CHANGED);
  assert.equal(canonicalContentEdit.record.anchorDirtyReason, "content-edited");
  assert.equal(canonicalContentEdit.record.evidenceExcerpt, "tarXget");
  assert.equal(canonicalContentEdit.record.originalHash, createStableTextHash("tarXget"));
  assert.equal(canonicalContentEdit.record.prefixContext, "Alpha bright ");

  const canonicalLazyRecovered = validateCanonicalAnchorRecordAgainstText(canonicalIssue, insertedBeforeText, {
    ownerType: "issue",
    now: "2026-06-01T00:04:00.000Z",
  });
  assert.equal(canonicalLazyRecovered.changed, true);
  assert.equal(canonicalLazyRecovered.record.anchor.startOffset, 13);
  assert.equal(canonicalLazyRecovered.record.anchorStatus, MANUSCRIPT_ANCHOR_STATUS.APPROXIMATE);
  assert.equal(canonicalLazyRecovered.record.anchorDirtyReason, "context-recovered");

  const revisionMarkerBatch = updateCanonicalAnchorRecordsForTextEdit({
    records: [{
      id: "revision-marker-1",
      evidenceExcerpt: "target",
      anchor: {
        sceneId: "scene-1",
        startOffset: 6,
        endOffset: 12,
      },
    }],
    sceneId: "scene-1",
    previousText,
    nextText: insertedBeforeText,
    ownerType: "revisionMarker",
  });
  assert.equal(revisionMarkerBatch.changedRecords.length, 1);
  assert.equal(revisionMarkerBatch.records[0].anchor.startOffset, 13);
  assert.equal(revisionMarkerBatch.records[0].anchorStatus, MANUSCRIPT_ANCHOR_STATUS.SHIFTED);

  const manuscriptMarkBatch = updateCanonicalAnchorRecordsForTextEdit({
    records: [{
      id: "mark-1",
      kind: "highlight",
      source: "author",
      evidenceExcerpt: "target",
      anchor: {
        sceneId: "scene-1",
        startOffset: 6,
        endOffset: 12,
      },
    }],
    sceneId: "scene-1",
    previousText,
    nextText: insertedBeforeText,
    ownerType: "manuscriptMark",
  });
  assert.equal(manuscriptMarkBatch.changedRecords.length, 1);
  assert.equal(manuscriptMarkBatch.records[0].anchor.startOffset, 13);
  assert.equal(manuscriptMarkBatch.records[0].anchorStatus, MANUSCRIPT_ANCHOR_STATUS.SHIFTED);

  const narrationSessionShift = updateCanonicalAnchorRecordForTextEdit({
    record: {
      id: "narration-session-1",
      currentAnchor: {
        sceneId: "scene-1",
        blockId: "block-1",
        startOffset: 6,
        endOffset: 6,
      },
    },
    sceneId: "scene-1",
    previousText,
    nextText: insertedBeforeText,
    ownerType: "narrationSession",
    anchorPath: ["currentAnchor"],
  });
  assert.equal(narrationSessionShift.changed, true);
  assert.equal(narrationSessionShift.record.currentAnchor.startOffset, 13);
  assert.equal(narrationSessionShift.record.currentAnchor.endOffset, 13);
  assert.equal(narrationSessionShift.record.anchorStatus, MANUSCRIPT_ANCHOR_STATUS.SHIFTED);

  // Intent: idle validation scheduling remains debounce-only so recovery work does not run during typing.
  const schedulerCalls = [];
  const timers = new Map();
  let nextTimerId = 1;
  const scheduler = createManuscriptAnchorIdleValidationScheduler({
    delayMs: 250,
    setTimeoutRef: (callback, delayMs) => {
      const timerId = nextTimerId;
      nextTimerId += 1;
      timers.set(timerId, { callback, delayMs });
      return timerId;
    },
    clearTimeoutRef: (timerId) => {
      timers.delete(timerId);
    },
    onValidate: (sceneId, context) => schedulerCalls.push({ sceneId, reason: context.reason }),
  });
  assert.equal(scheduler.schedule("scene-1"), true);
  assert.deepEqual(scheduler.getPendingSceneIds(), ["scene-1"]);
  assert.equal(timers.size, 1);
  assert.equal(scheduler.schedule("scene-1", { reason: "typing-again" }), true);
  assert.equal(timers.size, 1);
  assert.equal(scheduler.flush("scene-1", { reason: "manual-flush" }), true);
  assert.deepEqual(schedulerCalls, [{ sceneId: "scene-1", reason: "manual-flush" }]);
  assert.equal(scheduler.schedule("scene-2"), true);
  assert.equal(scheduler.schedule("scene-3"), true);
  scheduler.clearAll();
  assert.deepEqual(scheduler.getPendingSceneIds(), []);
  assert.equal(timers.size, 0);
}
