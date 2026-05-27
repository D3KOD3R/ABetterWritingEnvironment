// Intent: verify editor-host adapters render projection channels without becoming a persistence model.
import assert from "node:assert/strict";

import {
  createManuscriptEditorHostSnapshot,
  selectManuscriptEditorHostChannel,
} from "../apps/editor/public/features/manuscript-editor/editor-host-interface.js";
import {
  MANUSCRIPT_PROJECTION_CHANNELS,
  selectManuscriptProjections,
} from "../apps/editor/public/features/manuscript-editor/projection-selector.js";
import {
  renderTextareaAuthorMarkContent,
  renderTextareaEditorHostHTML,
  renderTextareaSpellcheckContent,
} from "../apps/editor/public/adapters/editor-host/textarea-editor-host.js";

export function runManuscriptEditorHostTest() {
  const text = "Quiet dooor.";
  const projections = selectManuscriptProjections({
    sceneId: "scene-1",
    text,
    inlineFormatRanges: [{
      id: "mark-1",
      formatId: "italic",
      startOffset: 0,
      endOffset: 5,
    }],
    spellcheckMisspellings: [{
      word: "dooor",
      index: 6,
      endIndex: 11,
    }],
    anchoredRecordPreviews: [{
      recordType: "passageNote",
      recordId: "note-1",
      sceneId: "scene-1",
      noteType: "inspiration",
      startOffset: 6,
      endOffset: 11,
    }],
    searchPreviews: [{
      id: "search-1",
      sceneId: "scene-1",
      startOffset: 0,
      endOffset: 5,
    }],
    narrationSelection: {
      id: "narration-1",
      sceneId: "scene-1",
      startOffset: 6,
      endOffset: 11,
    },
  });
  const snapshot = createManuscriptEditorHostSnapshot({
    sceneId: "scene-1",
    text,
    projections: [
      ...projections,
      {
        id: "foreign-scene",
        sceneId: "scene-2",
        startOffset: 0,
        endOffset: 5,
        channel: MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK,
        styleToken: "bold",
        priority: 100,
      },
    ],
  });

  assert.equal(snapshot.projections.length, 5);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK).length, 1);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.NOTE).length, 1);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.SEARCH).length, 1);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW).length, 1);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK).length, 1);
  assert.match(renderTextareaAuthorMarkContent(snapshot), /editor-inline-format-italic/);
  assert.match(renderTextareaSpellcheckContent(snapshot), /editor-spellcheck-word is-misspelled/);

  const markup = renderTextareaEditorHostHTML({
    sceneId: "scene-1",
    text,
    projections,
    inputClassName: "has-revision-preview",
  });
  assert.match(markup, /data-inline-format-layer/);
  assert.match(markup, /data-spellcheck-layer/);
  assert.match(markup, /class="editor-document-input has-revision-preview"/);
  assert.match(markup, /Quiet dooor\./);
}
