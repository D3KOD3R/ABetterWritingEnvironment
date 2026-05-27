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

  const overlapping = selectManuscriptProjections({
    sceneId: "scene-1",
    text: "dooor",
    inlineFormatRanges: [{
      id: "format-overlap",
      formatId: "highlight",
      startOffset: 0,
      endOffset: 5,
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
  assert.equal(overlapping[1].channel, MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK);

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
