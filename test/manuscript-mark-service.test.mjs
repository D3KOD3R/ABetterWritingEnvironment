// Intent: verify legacy inline formatting can migrate through anchor-backed manuscript marks.
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  updateInlineFormatRangesForTextEdit,
} from "../apps/editor/public/features/manuscript-editor/manuscript-command-controller.js";
import {
  updateSceneBlocksForTextEdit,
} from "../apps/editor/public/features/manuscript-editor/manuscript-block-text-service.js";
import {
  updateCanonicalAnchorRecordForTextEdit,
} from "../apps/editor/public/features/manuscript-anchors/manuscript-anchor-record-service.js";
import {
  createAuthorMarkProjectionFromManuscriptMark,
  deriveManuscriptMarksFromInlineFormatRanges,
  isCompatibilityManuscriptMark,
  promoteCompatibilityManuscriptMarksForSceneFormat,
  syncCompatibilityManuscriptMarksForScene,
  toggleManuscriptMarksForSceneSelection,
  updateManuscriptMarksForSceneTextEdit,
} from "../apps/editor/public/features/manuscript-editor/manuscript-mark-service.js";

export function runManuscriptMarkServiceTest() {
  const sceneBlocks = [
    {
      blockId: "block-1",
      paragraphId: "paragraph-1",
      chapterId: "chapter-1",
      sceneId: "scene-1",
      text: "Alpha target.",
    },
    {
      blockId: "block-2",
      paragraphId: "paragraph-2",
      chapterId: "chapter-1",
      sceneId: "scene-1",
      text: "Second block.",
    },
  ];
  const text = "Alpha target.\n\nSecond block.";

  const derived = deriveManuscriptMarksFromInlineFormatRanges({
    projectId: "project-1",
    sceneId: "scene-1",
    text,
    sceneBlocks,
    inlineFormatRanges: [{
      id: "inline-italic-6-12",
      formatId: "italic",
      startOffset: 6,
      endOffset: 12,
    }],
  });
  assert.equal(derived.unmappedRanges.length, 0);
  assert.equal(derived.marks.length, 1);
  assert.equal(derived.marks[0].kind, "italic");
  assert.equal(derived.marks[0].anchor.blockId, "block-1");
  assert.equal(derived.marks[0].anchor.paragraphId, "paragraph-1");
  assert.equal(derived.marks[0].anchor.startOffset, 6);
  assert.equal(derived.marks[0].anchor.endOffset, 12);
  assert.equal(derived.marks[0].evidenceExcerpt, "target");
  assert.match(derived.marks[0].originalHash, /^fnv1a32:/);

  const projection = createAuthorMarkProjectionFromManuscriptMark(derived.marks[0], {
    sceneId: "scene-1",
    text,
    sceneBlocks,
    channel: "author-mark",
    priority: 100,
  });
  assert.equal(projection.startOffset, 6);
  assert.equal(projection.endOffset, 12);
  assert.deepEqual(projection.sourceRef, {
    recordType: "manuscriptMark",
    recordId: derived.marks[0].id,
  });

  const split = deriveManuscriptMarksFromInlineFormatRanges({
    projectId: "project-1",
    sceneId: "scene-1",
    text,
    sceneBlocks,
    inlineFormatRanges: [{
      id: "inline-highlight-6-21",
      formatId: "highlight",
      startOffset: 6,
      endOffset: 21,
    }],
  });
  assert.equal(split.unmappedRanges.length, 0);
  assert.deepEqual(split.marks.map((mark) => ({
    blockId: mark.anchor.blockId,
    startOffset: mark.anchor.startOffset,
    endOffset: mark.anchor.endOffset,
    evidenceExcerpt: mark.evidenceExcerpt,
  })), [
    {
      blockId: "block-1",
      startOffset: 6,
      endOffset: 13,
      evidenceExcerpt: "target.",
    },
    {
      blockId: "block-2",
      startOffset: 0,
      endOffset: 6,
      evidenceExcerpt: "Second",
    },
  ]);

  const unmapped = deriveManuscriptMarksFromInlineFormatRanges({
    sceneId: "scene-1",
    text,
    sceneBlocks: [],
    inlineFormatRanges: [{
      id: "inline-underline-0-5",
      formatId: "underline",
      startOffset: 0,
      endOffset: 5,
    }],
  });
  assert.equal(unmapped.marks.length, 0);
  assert.equal(unmapped.unmappedRanges.length, 1);

  const longText = "A".repeat(300);
  const longRange = deriveManuscriptMarksFromInlineFormatRanges({
    projectId: "project-1",
    sceneId: "scene-long",
    text: longText,
    sceneBlocks: [{
      blockId: "block-long",
      paragraphId: "paragraph-long",
      text: longText,
    }],
    inlineFormatRanges: [{
      id: "inline-highlight-0-300",
      formatId: "highlight",
      startOffset: 0,
      endOffset: 300,
    }],
  });
  assert.equal(longRange.marks[0].evidenceMode, "hash-context");
  assert.equal(longRange.marks[0].evidenceExcerpt, "");
  assert.equal(longRange.marks[0].originalLength, 300);
  assert.equal(longRange.marks[0].selectedTextPreview.length, 180);

  const synced = syncCompatibilityManuscriptMarksForScene({
    marks: [
      {
        id: "mark-canonical-keep",
        kind: "underline",
        source: "author",
        anchor: {
          sceneId: "scene-1",
          blockId: "block-2",
          startOffset: 7,
          endOffset: 12,
        },
      },
      {
        id: "mark-inline-old-block-1-0-5",
        kind: "italic",
        source: "author",
        anchor: {
          sceneId: "scene-1",
          blockId: "block-1",
          startOffset: 0,
          endOffset: 5,
        },
      },
    ],
    projectId: "project-1",
    sceneId: "scene-1",
    text,
    sceneBlocks,
    inlineFormatRanges: [{
      id: "inline-bold-0-5",
      formatId: "bold",
      startOffset: 0,
      endOffset: 5,
    }],
  });
  assert.equal(synced.changed, true);
  assert.equal(synced.marks.length, 2);
  assert.equal(synced.marks[0].id, "mark-canonical-keep");
  assert.equal(synced.marks[1].kind, "bold");
  assert.equal(isCompatibilityManuscriptMark(synced.marks[1]), true);
  assert.equal(synced.marks.some((mark) => mark.id === "mark-inline-old-block-1-0-5"), false);

  const addedCanonicalMarks = toggleManuscriptMarksForSceneSelection({
    marks: [],
    sequences: {
      mark: 3,
      issue: 2,
    },
    projectId: "project-1",
    sceneId: "scene-1",
    text,
    sceneBlocks,
    selection: {
      startOffset: 6,
      endOffset: 21,
    },
    kind: "highlight",
    metadata: {
      purpose: "reference",
      colorToken: "amber",
    },
    now: "2026-06-04T00:00:00.000Z",
  });
  assert.equal(addedCanonicalMarks.changed, true);
  assert.equal(addedCanonicalMarks.reason, "added-mark");
  assert.equal(addedCanonicalMarks.sequences.mark, 5);
  assert.equal(addedCanonicalMarks.sequences.issue, 2);
  assert.deepEqual(addedCanonicalMarks.addedMarks.map((mark) => ({
    id: mark.id,
    kind: mark.kind,
    blockId: mark.anchor.blockId,
    startOffset: mark.anchor.startOffset,
    endOffset: mark.anchor.endOffset,
    source: mark.source,
    metadata: mark.metadata,
  })), [
    {
      id: "mark-0004",
      kind: "highlight",
      blockId: "block-1",
      startOffset: 6,
      endOffset: 13,
      source: "author",
      metadata: {
        colorToken: "amber",
        purpose: "reference",
      },
    },
    {
      id: "mark-0005",
      kind: "highlight",
      blockId: "block-2",
      startOffset: 0,
      endOffset: 6,
      source: "author",
      metadata: {
        colorToken: "amber",
        purpose: "reference",
      },
    },
  ]);

  const singleNewlineText = "Alpha target.\nSecond block.";
  const tolerantCanonicalMarks = toggleManuscriptMarksForSceneSelection({
    marks: [],
    sequences: {
      mark: 12,
    },
    projectId: "project-1",
    sceneId: "scene-1",
    text: singleNewlineText,
    sceneBlocks,
    selection: {
      startOffset: 6,
      endOffset: 20,
    },
    kind: "highlight",
    now: "2026-06-04T00:00:00.000Z",
  });
  assert.equal(tolerantCanonicalMarks.changed, true);
  assert.equal(tolerantCanonicalMarks.reason, "added-mark");
  assert.deepEqual(tolerantCanonicalMarks.addedMarks.map((mark) => ({
    id: mark.id,
    blockId: mark.anchor.blockId,
    startOffset: mark.anchor.startOffset,
    endOffset: mark.anchor.endOffset,
    evidenceExcerpt: mark.evidenceExcerpt,
  })), [
    {
      id: "mark-0013",
      blockId: "block-1",
      startOffset: 6,
      endOffset: 13,
      evidenceExcerpt: "target.",
    },
    {
      id: "mark-0014",
      blockId: "block-2",
      startOffset: 0,
      endOffset: 6,
      evidenceExcerpt: "Second",
    },
  ]);
  assert.deepEqual(tolerantCanonicalMarks.addedMarks.map((mark) =>
    createAuthorMarkProjectionFromManuscriptMark(mark, {
      sceneId: "scene-1",
      text: singleNewlineText,
      sceneBlocks,
    })?.startOffset
  ), [6, 14]);

  // Intent: keep freshly created scenes decorateable even when live text appears before draft blocks exist.
  const freshSceneText = "Test to see if decorations apply in a new scene.";
  const freshSceneBlocks = updateSceneBlocksForTextEdit({
    sceneId: "draft-scene-markup",
    previousText: "",
    nextText: freshSceneText,
    blocks: [],
  });
  const freshSelectionStart = freshSceneText.indexOf("decorations");
  const freshSceneHighlight = toggleManuscriptMarksForSceneSelection({
    marks: [],
    sequences: {},
    projectId: "project-1",
    chapterId: "draft-chapter-markup",
    sceneId: "draft-scene-markup",
    text: freshSceneText,
    sceneBlocks: freshSceneBlocks,
    selection: {
      sceneId: "draft-scene-markup",
      startOffset: freshSelectionStart,
      endOffset: freshSelectionStart + "decorations".length,
    },
    kind: "highlight",
    source: "author",
    metadata: {
      purpose: "reference",
      colorToken: "user-highlight",
    },
  });
  assert.equal(freshSceneHighlight.changed, true);
  assert.equal(freshSceneHighlight.reason, "added-mark");
  assert.equal(freshSceneHighlight.addedMarks[0].anchor.blockId, "draft-block-draft-scene-markup-1");
  assert.equal(freshSceneHighlight.addedMarks[0].anchor.chapterId, "draft-chapter-markup");
  assert.equal(freshSceneHighlight.addedMarks[0].evidenceExcerpt, "decorations");
  const freshSceneProjection = createAuthorMarkProjectionFromManuscriptMark(freshSceneHighlight.addedMarks[0], {
    sceneId: "draft-scene-markup",
    text: freshSceneText,
    sceneBlocks: freshSceneBlocks,
  });
  assert.equal(freshSceneProjection.startOffset, freshSelectionStart);
  assert.equal(freshSceneProjection.endOffset, freshSelectionStart + "decorations".length);
  assert.equal(freshSceneProjection.styleToken, "highlight");
  const freshBoldStart = freshSceneText.indexOf("new scene");
  const freshSceneBold = toggleManuscriptMarksForSceneSelection({
    marks: freshSceneHighlight.marks,
    sequences: freshSceneHighlight.sequences,
    projectId: "project-1",
    chapterId: "draft-chapter-markup",
    sceneId: "draft-scene-markup",
    text: freshSceneText,
    sceneBlocks: freshSceneBlocks,
    selection: {
      sceneId: "draft-scene-markup",
      startOffset: freshBoldStart,
      endOffset: freshBoldStart + "new scene".length,
    },
    kind: "bold",
    source: "author",
    metadata: {
      purpose: "emphasis",
    },
  });
  assert.equal(freshSceneBold.changed, true);
  assert.equal(freshSceneBold.reason, "added-mark");
  assert.equal(freshSceneBold.addedMarks[0].anchor.blockId, "draft-block-draft-scene-markup-1");
  const freshBoldProjection = createAuthorMarkProjectionFromManuscriptMark(freshSceneBold.addedMarks[0], {
    sceneId: "draft-scene-markup",
    text: freshSceneText,
    sceneBlocks: freshSceneBlocks,
  });
  assert.equal(freshBoldProjection.startOffset, freshBoldStart);
  assert.equal(freshBoldProjection.endOffset, freshBoldStart + "new scene".length);
  assert.equal(freshBoldProjection.styleToken, "bold");

  // Intent: adding a selected highlight must not delete earlier pending/compatibility highlights in the same scene.
  const existingCompatibilityHighlight = syncCompatibilityManuscriptMarksForScene({
    marks: [],
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-compat",
    text: "Earlier highlight.\n\nLater selected highlight.",
    sceneBlocks: [{
      blockId: "block-compat-1",
      paragraphId: "paragraph-compat-1",
      chapterId: "chapter-1",
      sceneId: "scene-compat",
      text: "Earlier highlight.\n\nLater selected highlight.",
    }],
    inlineFormatRanges: [{
      id: "inline-highlight-0-17",
      formatId: "highlight",
      startOffset: 0,
      endOffset: 17,
    }],
  });
  assert.equal(existingCompatibilityHighlight.marks.length, 1);
  assert.equal(isCompatibilityManuscriptMark(existingCompatibilityHighlight.marks[0]), true);

  const laterSelectionStart = "Earlier highlight.\n\n".length;
  const addLaterSelectedHighlight = toggleManuscriptMarksForSceneSelection({
    marks: existingCompatibilityHighlight.marks,
    sequences: existingCompatibilityHighlight.sequences,
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-compat",
    text: "Earlier highlight.\n\nLater selected highlight.",
    sceneBlocks: [{
      blockId: "block-compat-1",
      paragraphId: "paragraph-compat-1",
      chapterId: "chapter-1",
      sceneId: "scene-compat",
      text: "Earlier highlight.\n\nLater selected highlight.",
    }],
    selection: {
      startOffset: laterSelectionStart,
      endOffset: laterSelectionStart + "Later selected".length,
    },
    kind: "highlight",
    source: "author",
    metadata: {
      purpose: "reference",
      colorToken: "user-highlight",
    },
  });
  assert.equal(addLaterSelectedHighlight.changed, true);
  assert.equal(addLaterSelectedHighlight.addedMarks.length, 1);
  assert.equal(addLaterSelectedHighlight.marks.length, 2);

  const promotedCompatibilityHighlight = promoteCompatibilityManuscriptMarksForSceneFormat({
    marks: addLaterSelectedHighlight.marks,
    sequences: addLaterSelectedHighlight.sequences,
    sceneId: "scene-compat",
    kind: "highlight",
    source: "author",
    now: "2026-06-07T00:00:00.000Z",
  });
  assert.equal(promotedCompatibilityHighlight.changed, true);
  assert.equal(promotedCompatibilityHighlight.promotedMarkIds.length, 1);
  assert.equal(promotedCompatibilityHighlight.marks.length, 2);
  assert.equal(promotedCompatibilityHighlight.marks.some((mark) => isCompatibilityManuscriptMark(mark)), false);

  const afterHighlightRangeCleanupSync = syncCompatibilityManuscriptMarksForScene({
    marks: promotedCompatibilityHighlight.marks,
    sequences: promotedCompatibilityHighlight.sequences,
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-compat",
    text: "Earlier highlight.\n\nLater selected highlight.",
    sceneBlocks: [{
      blockId: "block-compat-1",
      paragraphId: "paragraph-compat-1",
      chapterId: "chapter-1",
      sceneId: "scene-compat",
      text: "Earlier highlight.\n\nLater selected highlight.",
    }],
    inlineFormatRanges: [],
  });
  assert.equal(afterHighlightRangeCleanupSync.marks.length, 2);
  assert.deepEqual(afterHighlightRangeCleanupSync.marks
    .map((mark) => createAuthorMarkProjectionFromManuscriptMark(mark, {
      sceneId: "scene-compat",
      text: "Earlier highlight.\n\nLater selected highlight.",
      sceneBlocks: [{
        blockId: "block-compat-1",
        paragraphId: "paragraph-compat-1",
        chapterId: "chapter-1",
        sceneId: "scene-compat",
        text: "Earlier highlight.\n\nLater selected highlight.",
      }],
    }))
    .filter(Boolean)
    .map((projection) => [projection.startOffset, projection.endOffset, projection.styleToken])
    .sort((left, right) => left[0] - right[0]), [
      [0, 17, "highlight"],
      [laterSelectionStart, laterSelectionStart + "Later selected".length, "highlight"],
    ]);

  // Intent: guard the loaded project shape that originally made screenshot-selected highlights appear to do nothing.
  const fixtureRecord = JSON.parse(fs.readFileSync(
    new URL("../SaveTestFile/OriginFileproject-serva-vitae.abe-project.json", import.meta.url),
    "utf8",
  ));
  const fixtureProjectRecord = fixtureRecord.projects?.[0] ?? fixtureRecord;
  const fixtureProject = fixtureProjectRecord.workspace?.project ?? {};
  const fixtureSceneId = "scene-0023";
  const fixtureScene = (fixtureProject.scenes ?? [])
    .find((candidate) => candidate?.sceneId === fixtureSceneId);
  const fixtureDraft = fixtureProjectRecord.sceneDrafts?.[fixtureSceneId] ?? {};
  const fixtureSceneStoreProjectKey = Object.keys(fixtureRecord.sceneStore ?? {})
    .find((key) => fixtureRecord.sceneStore?.[key]?.[fixtureSceneId]);
  const fixtureSceneStoreRecord =
    fixtureRecord.sceneStore?.[fixtureSceneStoreProjectKey]?.[fixtureSceneId] ??
    fixtureRecord.sceneStore?.[`${fixtureProject.id}.${fixtureSceneId}`] ??
    fixtureRecord.sceneStore?.[`OriginFileproject-serva-vitae.${fixtureSceneId}`] ??
    {};
  const fixtureSceneBlocks = Array.isArray(fixtureScene?.blocks)
    ? fixtureScene.blocks
    : Array.isArray(fixtureDraft.blocks)
      ? fixtureDraft.blocks
      : Array.isArray(fixtureSceneStoreRecord.blocks)
        ? fixtureSceneStoreRecord.blocks
      : [];
  const fixtureText = String(fixtureDraft.editorText ?? fixtureScene?.editorText ?? fixtureSceneStoreRecord.editorText ?? "");
  const fixtureSelectionText = [
    "There was something entirely new about the experience",
    "All he could see was the emptiness of a white void",
    "A strange bubbling ringing",
  ].find((candidate) => fixtureText.includes(candidate));
  assert.equal(typeof fixtureSelectionText, "string");
  const fixtureStartOffset = fixtureText.indexOf(fixtureSelectionText);
  assert.notEqual(fixtureStartOffset, -1);

  const fixtureHighlight = toggleManuscriptMarksForSceneSelection({
    marks: [],
    sequences: {},
    projectId: fixtureProject.id,
    chapterId: fixtureScene?.chapterId,
    sceneId: fixtureSceneId,
    text: fixtureText,
    sceneBlocks: fixtureSceneBlocks,
    selection: {
      sceneId: fixtureSceneId,
      startOffset: fixtureStartOffset,
      endOffset: fixtureStartOffset + fixtureSelectionText.length,
    },
    kind: "highlight",
    source: "author",
    metadata: {
      purpose: "reference",
      colorToken: "user-highlight",
    },
    now: "2026-06-06T00:00:00.000Z",
  });
  assert.equal(fixtureHighlight.changed, true);
  assert.equal(fixtureHighlight.reason, "added-mark");
  assert.equal(fixtureHighlight.addedMarks.length, 1);
  assert.equal(fixtureHighlight.addedMarks[0].kind, "highlight");
  assert.equal(fixtureHighlight.addedMarks[0].source, "author");
  assert.equal(fixtureHighlight.addedMarks[0].anchor.sceneId, fixtureSceneId);
  assert.equal(fixtureHighlight.addedMarks[0].evidenceExcerpt, fixtureSelectionText);

  const fixtureProjection = createAuthorMarkProjectionFromManuscriptMark(fixtureHighlight.addedMarks[0], {
    sceneId: fixtureSceneId,
    text: fixtureText,
    sceneBlocks: fixtureSceneBlocks,
  });
  assert.equal(fixtureProjection.startOffset, fixtureStartOffset);
  assert.equal(fixtureProjection.endOffset, fixtureStartOffset + fixtureSelectionText.length);
  assert.equal(fixtureProjection.styleToken, "highlight");

  // Intent: keep pending-highlight typing anchored to the inserted text after promotion into canonical marks.
  const staleBlockPendingText = "abcaabc\n\ntail";
  const pendingHighlightRanges = updateInlineFormatRangesForTextEdit({
    ranges: [],
    previousText: "abcabc\n\ntail",
    nextText: staleBlockPendingText,
    selectionStart: 4,
    selectionEnd: 4,
    pendingFormats: {
      highlight: true,
    },
  });
  assert.deepEqual(pendingHighlightRanges, [{
    id: "inline-highlight-3-4",
    formatId: "highlight",
    startOffset: 3,
    endOffset: 4,
  }]);
  const pendingHighlightSync = syncCompatibilityManuscriptMarksForScene({
    marks: [],
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    text: staleBlockPendingText,
    sceneBlocks: [
      {
        blockId: "block-1",
        paragraphId: "paragraph-1",
        chapterId: "chapter-1",
        sceneId: "scene-1",
        text: "abcabc",
      },
      {
        blockId: "block-2",
        paragraphId: "paragraph-2",
        chapterId: "chapter-1",
        sceneId: "scene-1",
        text: "tail",
      },
    ],
    inlineFormatRanges: pendingHighlightRanges,
  });
  assert.equal(pendingHighlightSync.changed, true);
  assert.equal(pendingHighlightSync.marks.length, 1);
  assert.equal(pendingHighlightSync.marks[0].anchor.startOffset, 3);
  assert.equal(pendingHighlightSync.marks[0].anchor.endOffset, 4);
  assert.equal(pendingHighlightSync.marks[0].evidenceExcerpt, "a");
  const pendingProjection = createAuthorMarkProjectionFromManuscriptMark(pendingHighlightSync.marks[0], {
    sceneId: "scene-1",
    text: staleBlockPendingText,
    sceneBlocks: [
      {
        blockId: "block-1",
        paragraphId: "paragraph-1",
        chapterId: "chapter-1",
        sceneId: "scene-1",
        text: "abcabc",
      },
      {
        blockId: "block-2",
        paragraphId: "paragraph-2",
        chapterId: "chapter-1",
        sceneId: "scene-1",
        text: "tail",
      },
    ],
  });
  assert.equal(pendingProjection.startOffset, 3);
  assert.equal(pendingProjection.endOffset, 4);

  // Intent: keep pending highlight typing and existing selected highlights adjacent through repeated text insertions.
  const repeatedBlock = (blockText) => [{
    blockId: "block-1",
    paragraphId: "paragraph-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    text: blockText,
  }];
  const existingRepeatedMark = {
    id: "mark-existing",
    kind: "highlight",
    source: "author",
    evidenceExcerpt: "abc",
    anchor: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-1",
      blockId: "block-1",
      paragraphId: "paragraph-1",
      startOffset: 3,
      endOffset: 6,
    },
  };
  const firstShiftedExistingMark = updateCanonicalAnchorRecordForTextEdit({
    record: existingRepeatedMark,
    sceneId: "scene-1",
    previousText: "abcabc",
    nextText: "abcaabc",
    ownerType: "manuscriptMark",
    selectionStart: 4,
    selectionEnd: 4,
  }).record;
  const firstRepeatedInlineRanges = updateInlineFormatRangesForTextEdit({
    ranges: [],
    previousText: "abcabc",
    nextText: "abcaabc",
    selectionStart: 4,
    selectionEnd: 4,
    pendingFormats: {
      highlight: true,
    },
  });
  const firstRepeatedSync = syncCompatibilityManuscriptMarksForScene({
    marks: [firstShiftedExistingMark],
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    text: "abcaabc",
    sceneBlocks: repeatedBlock("abcaabc"),
    inlineFormatRanges: firstRepeatedInlineRanges,
  });
  assert.deepEqual(firstRepeatedSync.marks
    .map((mark) => createAuthorMarkProjectionFromManuscriptMark(mark, {
      sceneId: "scene-1",
      text: "abcaabc",
      sceneBlocks: repeatedBlock("abcaabc"),
    }))
    .filter(Boolean)
    .map((projection) => [projection.startOffset, projection.endOffset])
    .sort((left, right) => left[0] - right[0]), [
      [3, 4],
      [4, 7],
    ]);

  const secondShiftedExistingMark = updateCanonicalAnchorRecordForTextEdit({
    record: firstRepeatedSync.marks.find((mark) => mark.id === "mark-existing"),
    sceneId: "scene-1",
    previousText: "abcaabc",
    nextText: "abcaaabc",
    ownerType: "manuscriptMark",
    selectionStart: 5,
    selectionEnd: 5,
  }).record;
  const secondRepeatedInlineRanges = updateInlineFormatRangesForTextEdit({
    ranges: firstRepeatedInlineRanges,
    previousText: "abcaabc",
    nextText: "abcaaabc",
    selectionStart: 5,
    selectionEnd: 5,
    pendingFormats: {
      highlight: true,
    },
  });
  const secondRepeatedSync = syncCompatibilityManuscriptMarksForScene({
    marks: [
      secondShiftedExistingMark,
      ...firstRepeatedSync.marks.filter((mark) => mark.id !== "mark-existing"),
    ],
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    text: "abcaaabc",
    sceneBlocks: repeatedBlock("abcaaabc"),
    inlineFormatRanges: secondRepeatedInlineRanges,
  });
  assert.deepEqual(secondRepeatedSync.marks
    .map((mark) => createAuthorMarkProjectionFromManuscriptMark(mark, {
      sceneId: "scene-1",
      text: "abcaaabc",
      sceneBlocks: repeatedBlock("abcaaabc"),
    }))
    .filter(Boolean)
    .map((projection) => [projection.startOffset, projection.endOffset])
    .sort((left, right) => left[0] - right[0]), [
      [3, 5],
      [5, 8],
    ]);

  const staleBlockDecorationShift = updateManuscriptMarksForSceneTextEdit({
    marks: [existingRepeatedMark],
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    previousText: "zabcabc",
    nextText: "zzabcabc",
    previousSceneBlocks: repeatedBlock("abcabc"),
    nextSceneBlocks: repeatedBlock("zzabcabc"),
    selectionStart: 2,
    selectionEnd: 2,
  });
  assert.equal(staleBlockDecorationShift.changedMarks.length, 1);
  const staleBlockProjection = createAuthorMarkProjectionFromManuscriptMark(staleBlockDecorationShift.marks[0], {
    sceneId: "scene-1",
    text: "zzabcabc",
    sceneBlocks: repeatedBlock("zzabcabc"),
  });
  assert.deepEqual([staleBlockProjection.startOffset, staleBlockProjection.endOffset], [4, 7]);

  const wholeHighlightMark = {
    id: "mark-whole",
    kind: "highlight",
    source: "author",
    evidenceExcerpt: "abcdef",
    anchor: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-1",
      blockId: "block-1",
      paragraphId: "paragraph-1",
      startOffset: 0,
      endOffset: 6,
    },
  };
  const splitWhenSwitchOff = updateManuscriptMarksForSceneTextEdit({
    marks: [wholeHighlightMark],
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    previousText: "abcdef",
    nextText: "abcXdef",
    previousSceneBlocks: repeatedBlock("abcdef"),
    nextSceneBlocks: repeatedBlock("abcXdef"),
    pendingFormats: {
      highlight: false,
    },
    selectionStart: 4,
    selectionEnd: 4,
  });
  assert.equal(splitWhenSwitchOff.marks.length, 2);
  assert.deepEqual(splitWhenSwitchOff.marks
    .map((mark) => createAuthorMarkProjectionFromManuscriptMark(mark, {
      sceneId: "scene-1",
      text: "abcXdef",
      sceneBlocks: repeatedBlock("abcXdef"),
    }))
    .filter(Boolean)
    .map((projection) => [projection.startOffset, projection.endOffset]), [
      [0, 3],
      [4, 7],
    ]);

  const expandWhenSwitchOn = updateManuscriptMarksForSceneTextEdit({
    marks: [wholeHighlightMark],
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    previousText: "abcdef",
    nextText: "abcXdef",
    previousSceneBlocks: repeatedBlock("abcdef"),
    nextSceneBlocks: repeatedBlock("abcXdef"),
    pendingFormats: {
      highlight: true,
    },
    selectionStart: 4,
    selectionEnd: 4,
  });
  assert.equal(expandWhenSwitchOn.marks.length, 1);
  const expandedProjection = createAuthorMarkProjectionFromManuscriptMark(expandWhenSwitchOn.marks[0], {
    sceneId: "scene-1",
    text: "abcXdef",
    sceneBlocks: repeatedBlock("abcXdef"),
  });
  assert.deepEqual([expandedProjection.startOffset, expandedProjection.endOffset], [0, 7]);

  const wholeBoldMark = {
    ...wholeHighlightMark,
    id: "mark-bold-whole",
    kind: "bold",
    metadata: {
      purpose: "emphasis",
    },
  };
  const splitBoldWhenSwitchOff = updateManuscriptMarksForSceneTextEdit({
    marks: [wholeBoldMark],
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    previousText: "abcdef",
    nextText: "abcXdef",
    previousSceneBlocks: repeatedBlock("abcdef"),
    nextSceneBlocks: repeatedBlock("abcXdef"),
    pendingFormats: {
      bold: false,
    },
    selectionStart: 4,
    selectionEnd: 4,
  });
  assert.equal(splitBoldWhenSwitchOff.marks.length, 2);
  assert.deepEqual(splitBoldWhenSwitchOff.marks
    .map((mark) => createAuthorMarkProjectionFromManuscriptMark(mark, {
      sceneId: "scene-1",
      text: "abcXdef",
      sceneBlocks: repeatedBlock("abcXdef"),
    }))
    .filter(Boolean)
    .map((projection) => [projection.startOffset, projection.endOffset, projection.styleToken]), [
      [0, 3, "bold"],
      [4, 7, "bold"],
    ]);

  const expandBoldWhenSwitchOn = updateManuscriptMarksForSceneTextEdit({
    marks: [wholeBoldMark],
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    previousText: "abcdef",
    nextText: "abcXdef",
    previousSceneBlocks: repeatedBlock("abcdef"),
    nextSceneBlocks: repeatedBlock("abcXdef"),
    pendingFormats: {
      bold: true,
    },
    selectionStart: 4,
    selectionEnd: 4,
  });
  assert.equal(expandBoldWhenSwitchOn.marks.length, 1);
  const expandedBoldProjection = createAuthorMarkProjectionFromManuscriptMark(expandBoldWhenSwitchOn.marks[0], {
    sceneId: "scene-1",
    text: "abcXdef",
    sceneBlocks: repeatedBlock("abcXdef"),
  });
  assert.deepEqual([expandedBoldProjection.startOffset, expandedBoldProjection.endOffset, expandedBoldProjection.styleToken], [0, 7, "bold"]);

  const removedCanonicalMarks = toggleManuscriptMarksForSceneSelection({
    marks: addedCanonicalMarks.marks,
    sequences: addedCanonicalMarks.sequences,
    projectId: "project-1",
    sceneId: "scene-1",
    text,
    sceneBlocks,
    selection: {
      startOffset: 6,
      endOffset: 21,
    },
    kind: "highlight",
    now: "2026-06-04T00:00:01.000Z",
  });
  assert.equal(removedCanonicalMarks.changed, true);
  assert.equal(removedCanonicalMarks.toggledOff, true);
  assert.deepEqual(removedCanonicalMarks.removedMarkIds, ["mark-0004", "mark-0005"]);
  assert.deepEqual(removedCanonicalMarks.marks, []);
  assert.equal(removedCanonicalMarks.sequences.mark, 5);

  const splitCanonicalMark = toggleManuscriptMarksForSceneSelection({
    marks: [{
      id: "mark-0009",
      kind: "italic",
      source: "author",
      anchorStatus: "resolved",
      anchorDirtyReason: "",
      anchor: {
        projectId: "project-1",
        chapterId: "chapter-1",
        sceneId: "scene-1",
        blockId: "block-1",
        paragraphId: "paragraph-1",
        startOffset: 0,
        endOffset: 13,
      },
      metadata: {
        purpose: "emphasis",
      },
    }],
    sequences: {
      mark: 9,
    },
    projectId: "project-1",
    sceneId: "scene-1",
    text,
    sceneBlocks,
    selection: {
      startOffset: 6,
      endOffset: 12,
    },
    kind: "italic",
    now: "2026-06-04T00:00:02.000Z",
  });
  assert.equal(splitCanonicalMark.changed, true);
  assert.equal(splitCanonicalMark.toggledOff, true);
  assert.deepEqual(splitCanonicalMark.removedMarkIds, ["mark-0009"]);
  assert.equal(splitCanonicalMark.sequences.mark, 11);
  assert.deepEqual(splitCanonicalMark.marks.map((mark) => ({
    id: mark.id,
    blockId: mark.anchor.blockId,
    startOffset: mark.anchor.startOffset,
    endOffset: mark.anchor.endOffset,
    evidenceExcerpt: mark.evidenceExcerpt,
    metadata: mark.metadata,
  })), [
    {
      id: "mark-0010",
      blockId: "block-1",
      startOffset: 0,
      endOffset: 6,
      evidenceExcerpt: "Alpha ",
      metadata: {
        purpose: "emphasis",
      },
    },
    {
      id: "mark-0011",
      blockId: "block-1",
      startOffset: 12,
      endOffset: 13,
      evidenceExcerpt: ".",
      metadata: {
        purpose: "emphasis",
      },
    },
  ]);
}
