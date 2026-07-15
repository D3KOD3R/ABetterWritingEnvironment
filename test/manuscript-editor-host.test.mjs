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
  estimateTextareaVisualLineBeforeOffset,
  findTextareaOffsetForVisualLineEnd,
  renderTextareaAuthorMarkContent,
  renderTextareaDiagnosticContent,
  renderTextareaDraftProofContent,
  renderTextareaEditorHostHTML,
  renderTextareaSpellcheckContent,
} from "../apps/editor/public/adapters/editor-host/textarea-editor-host.js";

export function runManuscriptEditorHostTest() {
  const text = "Quiet dooor.";
  const projections = selectManuscriptProjections({
    projectId: "project-1",
    sceneId: "scene-1",
    text,
    sceneBlocks: [{
      blockId: "block-1",
      text,
    }],
    inlineFormatRanges: [{
      id: "mark-1",
      formatId: "italic",
      startOffset: 0,
      endOffset: 5,
    }],
    draftProofing: {
      activeRunId: "draft-proof-run-0001",
      runs: [{
        id: "draft-proof-run-0001",
        label: "Draft proof 1",
        iterationNumber: 1,
        status: "active",
        coverageByScene: {
          "scene-1": [{
            startOffset: 0,
            endOffset: 5,
            touchedAt: "2026-07-15T01:00:00.000Z",
          }],
        },
      }],
    },
    spellcheckMisspellings: [{
      word: "dooor",
      index: 6,
      endIndex: 11,
    }],
    diagnosticIssues: [{
      id: "issue-1",
      severity: "warning",
      lifecycle: "open",
      evidenceExcerpt: "dooor",
      anchor: {
        projectId: "project-1",
        sceneId: "scene-1",
        blockId: "block-1",
        startOffset: 6,
        endOffset: 11,
      },
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
        id: "same-scene-bold",
        sceneId: "scene-1",
        startOffset: 6,
        endOffset: 11,
        channel: MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK,
        styleToken: "bold",
        priority: 100,
      },
      {
        id: "same-scene-highlight",
        sceneId: "scene-1",
        startOffset: 6,
        endOffset: 11,
        channel: MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK,
        styleToken: "highlight",
        priority: 100,
        visualStyle: {
          highlightColor: "rgba(125, 197, 255, 0.34)",
          highlightOutline: "rgba(71, 148, 214, 0.24)",
          highlightColorId: "sky",
        },
      },
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

  assert.equal(snapshot.projections.length, 9);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK).length, 3);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.DRAFT_PROOF).length, 1);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.DIAGNOSTIC).length, 1);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.NOTE).length, 1);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.SEARCH).length, 1);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW).length, 1);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK).length, 1);
  assert.match(renderTextareaAuthorMarkContent(snapshot), /editor-inline-format-italic/);
  assert.match(renderTextareaAuthorMarkContent(snapshot), /editor-inline-format-italic-token/);
  assert.match(renderTextareaAuthorMarkContent(snapshot), /data-italic-text="Quiet"/);
  assert.match(renderTextareaAuthorMarkContent(snapshot), /editor-inline-format-bold/);
  assert.match(renderTextareaAuthorMarkContent(snapshot), /editor-inline-format-highlight/);
  assert.match(renderTextareaAuthorMarkContent(snapshot), /--editor-mark-highlight-color:rgba\(125, 197, 255, 0\.34\)/);
  assert.match(renderTextareaAuthorMarkContent(snapshot), /has-inline-format-projection/);
  assert.match(renderTextareaDraftProofContent(snapshot), /editor-draft-proof-range/);
  assert.match(renderTextareaDiagnosticContent(snapshot), /editor-diagnostic-warning/);
  assert.match(renderTextareaDiagnosticContent(snapshot), /data-diagnostic-id="issue-1"/);
  assert.match(renderTextareaSpellcheckContent(snapshot), /editor-spellcheck-word is-misspelled/);

  const markup = renderTextareaEditorHostHTML({
    sceneId: "scene-1",
    text,
    projections,
    inputClassName: "has-revision-preview",
  });
  assert.match(markup, /data-inline-format-layer/);
  assert.match(markup, /data-draft-proof-layer/);
  assert.match(markup, /editor-draft-proof-range/);
  assert.match(markup, /data-diagnostic-layer/);
  assert.match(markup, /editor-diagnostic-warning/);
  assert.match(markup, /data-spellcheck-layer/);
  assert.match(markup, /class="editor-document-input has-revision-preview has-inline-format-projection"/);
  assert.match(markup, /Quiet dooor\./);

  const wrappedText = "abcdefghij\nklmno";
  assert.equal(estimateTextareaVisualLineBeforeOffset(wrappedText, 9, 4), 2);
  assert.equal(estimateTextareaVisualLineBeforeOffset(wrappedText, 12, 4), 3);
  assert.equal(findTextareaOffsetForVisualLineEnd(wrappedText, 0, 4), 4);
  assert.equal(findTextareaOffsetForVisualLineEnd(wrappedText, 2, 4), 10);
  assert.equal(findTextareaOffsetForVisualLineEnd(wrappedText, 3, 4), 15);
}
