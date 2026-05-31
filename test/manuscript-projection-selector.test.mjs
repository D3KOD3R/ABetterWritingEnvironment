// Intent: verify durable author marks and runtime-only editor visuals remain distinct projections.
import assert from "node:assert/strict";

import {
  MANUSCRIPT_PROJECTION_CHANNELS,
  selectManuscriptProjections,
  selectProjectionChannel,
} from "../apps/editor/public/features/manuscript-editor/projection-selector.js";

export function runManuscriptProjectionSelectorTest() {
  const projections = selectManuscriptProjections({
    sceneId: "scene-1",
    text: "Quiet dooor.",
    inlineFormatRanges: [{
      id: "format-1",
      formatId: "italic",
      startOffset: 0,
      endOffset: 5,
    }],
    spellcheckMisspellings: [{
      word: "dooor",
      normalizedWord: "dooor",
      index: 6,
      endIndex: 11,
    }],
    anchoredRecordPreviews: [{
      recordType: "task",
      recordId: "task-1",
      sceneId: "scene-1",
      startOffset: 0,
      endOffset: 5,
    }, {
      recordType: "passageNote",
      recordId: "note-1",
      sceneId: "scene-1",
      noteType: "research",
      startOffset: 6,
      endOffset: 11,
    }],
    searchPreviews: [{
      id: "match-1",
      sceneId: "scene-1",
      startOffset: 0,
      endOffset: 5,
    }],
    narrationSelection: {
      id: "take-1",
      sceneId: "scene-1",
      startOffset: 6,
      endOffset: 11,
    },
  });

  const authorMarks = selectProjectionChannel(projections, MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK);
  const tasks = selectProjectionChannel(projections, MANUSCRIPT_PROJECTION_CHANNELS.TASK);
  const notes = selectProjectionChannel(projections, MANUSCRIPT_PROJECTION_CHANNELS.NOTE);
  const search = selectProjectionChannel(projections, MANUSCRIPT_PROJECTION_CHANNELS.SEARCH);
  const narration = selectProjectionChannel(projections, MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW);
  const spellcheck = selectProjectionChannel(projections, MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK);
  assert.equal(authorMarks.length, 1);
  assert.equal(authorMarks[0].styleToken, "italic");
  assert.equal(authorMarks[0].persistence, "derived-durable");
  assert.equal(authorMarks[0].sourceRef.recordId, "format-1");
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].styleToken, "task");
  assert.equal(tasks[0].sourceRef.recordId, "task-1");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].styleToken, "research");
  assert.equal(notes[0].persistence, "derived-durable");
  assert.equal(search.length, 1);
  assert.equal(search[0].persistence, "runtime-only");
  assert.equal(narration.length, 1);
  assert.equal(narration[0].styleToken, "narration-follow");
  assert.equal(narration[0].persistence, "runtime-only");
  assert.equal(spellcheck.length, 1);
  assert.equal(spellcheck[0].styleToken, "misspelled");
  assert.equal(spellcheck[0].persistence, "runtime-only");

  const diagnosticText = "Quiet.\n\nThe customs ring waits.";
  const diagnosticProjections = selectManuscriptProjections({
    projectId: "project-1",
    sceneId: "scene-1",
    text: diagnosticText,
    sceneBlocks: [{
      blockId: "block-1",
      text: "Quiet.",
    }, {
      blockId: "block-2",
      text: "The customs ring waits.",
    }],
    diagnosticIssues: [{
      id: "issue-1",
      severity: "warning",
      lifecycle: "open",
      evidenceExcerpt: "customs ring",
      anchor: {
        projectId: "project-1",
        sceneId: "scene-1",
        blockId: "block-2",
        startOffset: 4,
        endOffset: 16,
      },
    }, {
      id: "wrong-scene",
      severity: "error",
      lifecycle: "open",
      evidenceExcerpt: "Quiet",
      anchor: {
        projectId: "project-1",
        sceneId: "scene-2",
        blockId: "block-1",
        startOffset: 0,
        endOffset: 5,
      },
    }, {
      id: "invalid-range",
      severity: "info",
      lifecycle: "open",
      evidenceExcerpt: "customs ring",
      anchor: {
        projectId: "project-1",
        sceneId: "scene-1",
        blockId: "block-2",
        startOffset: 4,
        endOffset: 200,
      },
    }],
    suggestionQueue: [{
      id: "world-suggestion-1",
      suggestionType: "entity",
      evidence: [],
    }],
    includeAuthorMarks: false,
    includeAnchoredRecords: false,
    includeRuntimeSelections: false,
    includeSpellcheck: false,
  });
  const diagnostics = selectProjectionChannel(diagnosticProjections, MANUSCRIPT_PROJECTION_CHANNELS.DIAGNOSTIC);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].startOffset, 12);
  assert.equal(diagnostics[0].endOffset, 24);
  assert.equal(diagnostics[0].styleToken, "warning");
  assert.equal(diagnostics[0].persistence, "derived-durable");
  assert.deepEqual(diagnostics[0].sourceRef, {
    recordType: "issue",
    recordId: "issue-1",
  });
  assert.equal(MANUSCRIPT_PROJECTION_CHANNELS.SUGGESTION, undefined);
  assert.equal(diagnosticProjections.some((projection) => projection.channel === "suggestion"), false);

  const staleDiagnostic = selectManuscriptProjections({
    projectId: "project-1",
    sceneId: "scene-1",
    text: "Inserted before the anchor.\n\nThe customs ring waits.",
    sceneBlocks: [{
      blockId: "block-1",
      text: "Quiet.",
    }, {
      blockId: "block-2",
      text: "The customs ring waits.",
    }],
    diagnosticIssues: [{
      id: "stale-issue",
      severity: "warning",
      lifecycle: "open",
      evidenceExcerpt: "customs ring",
      anchor: {
        projectId: "project-1",
        sceneId: "scene-1",
        blockId: "block-2",
        startOffset: 4,
        endOffset: 16,
      },
    }],
    includeAuthorMarks: false,
    includeAnchoredRecords: false,
    includeRuntimeSelections: false,
    includeSpellcheck: false,
  });
  assert.deepEqual(staleDiagnostic, []);

  const overlapping = selectManuscriptProjections({
    projectId: "project-1",
    sceneId: "scene-1",
    text: "dooor",
    sceneBlocks: [{
      blockId: "block-overlap",
      text: "dooor",
    }],
    inlineFormatRanges: [{
      id: "format-overlap",
      formatId: "highlight",
      startOffset: 0,
      endOffset: 5,
    }],
    diagnosticIssues: [{
      id: "issue-overlap",
      severity: "error",
      lifecycle: "open",
      evidenceExcerpt: "dooor",
      anchor: {
        projectId: "project-1",
        sceneId: "scene-1",
        blockId: "block-overlap",
        startOffset: 0,
        endOffset: 5,
      },
    }],
    spellcheckMisspellings: [{
      word: "dooor",
      normalizedWord: "dooor",
      index: 0,
      endIndex: 5,
    }],
    includeAnchoredRecords: false,
  });
  assert.equal(overlapping[0].channel, MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK);
  assert.equal(overlapping[1].channel, MANUSCRIPT_PROJECTION_CHANNELS.DIAGNOSTIC);
  assert.equal(overlapping[2].channel, MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK);

  const invalidRuntimeRange = selectManuscriptProjections({
    sceneId: "scene-1",
    text: "Quiet.",
    spellcheckMisspellings: [{
      word: "Outside",
      index: 20,
      endIndex: 27,
    }],
    includeAuthorMarks: false,
  });
  assert.deepEqual(invalidRuntimeRange, []);

  const invalidAnchoredRecord = selectManuscriptProjections({
    sceneId: "scene-1",
    text: "Quiet.",
    anchoredRecordPreviews: [{
      recordType: "passageNote",
      recordId: "wrong-scene",
      sceneId: "scene-2",
      startOffset: 0,
      endOffset: 5,
    }],
    includeAuthorMarks: false,
    includeSpellcheck: false,
  });
  assert.deepEqual(invalidAnchoredRecord, []);

  const invalidRuntimeSelections = selectManuscriptProjections({
    sceneId: "scene-1",
    text: "Quiet.",
    searchPreviews: [{
      sceneId: "scene-2",
      startOffset: 0,
      endOffset: 5,
    }],
    narrationSelection: {
      sceneId: "scene-1",
      startOffset: 2,
      endOffset: 20,
    },
    includeAuthorMarks: false,
    includeAnchoredRecords: false,
    includeSpellcheck: false,
  });
  assert.deepEqual(invalidRuntimeSelections, []);
}
