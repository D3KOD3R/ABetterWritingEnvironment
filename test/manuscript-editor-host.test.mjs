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
  clearTextareaProjectionLayer,
  estimateTextareaVisualLineBeforeOffset,
  findTextareaOffsetForVisualLineEnd,
  renderTextareaAuthorMarkContent,
  renderTextareaDiagnosticContent,
  renderTextareaDraftProofContent,
  renderTextareaEditorHostHTML,
  renderTextareaManuScriptInfographicLaneContent,
  renderTextareaNarrationFollowContent,
  renderTextareaNarrationRecordingContent,
  renderTextareaSpellcheckContent,
  resolveTextareaEditorHostContentWidth,
} from "../apps/editor/public/adapters/editor-host/textarea-editor-host.js";
import {
  resolveMeasuredEditorGutterLineCount,
} from "../apps/editor/public/features/manuscript-editor/manuscript-layout-service.js";

export function runManuscriptEditorHostTest() {
  const metadataIcon = {
    dataUrl: "data:image/png;base64,AAAA",
    mediaType: "image/png",
    name: "lore.png",
    size: 3,
  };
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
        settings: {
          backdropColor: "#c69fc6",
          highlightIntensityByTheme: {
            light: 64,
            dark: 90,
          },
        },
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
    narrationRecordingPreviews: [{
      id: "recording-1",
      sceneId: "scene-1",
      startOffset: 0,
      endOffset: 5,
    }],
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

  assert.equal(snapshot.projections.length, 10);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK).length, 3);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.DRAFT_PROOF).length, 1);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.DIAGNOSTIC).length, 1);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.NOTE).length, 1);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.SEARCH).length, 1);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW).length, 1);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_RECORDING).length, 1);
  assert.equal(selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK).length, 1);
  assert.match(renderTextareaAuthorMarkContent(snapshot), /editor-inline-format-italic/);
  assert.match(renderTextareaAuthorMarkContent(snapshot), /editor-inline-format-italic-token/);
  assert.match(renderTextareaAuthorMarkContent(snapshot), /data-italic-text="Quiet"/);
  assert.match(renderTextareaAuthorMarkContent(snapshot), /editor-inline-format-bold/);
  assert.match(renderTextareaAuthorMarkContent(snapshot), /editor-inline-format-highlight/);
  assert.match(renderTextareaAuthorMarkContent(snapshot), /--editor-mark-highlight-color:rgba\(125, 197, 255, 0\.34\)/);
  assert.match(renderTextareaAuthorMarkContent(snapshot), /has-inline-format-projection/);
  assert.match(renderTextareaDraftProofContent(snapshot), /editor-draft-proof-range/);
  assert.match(renderTextareaDraftProofContent(snapshot), /--editor-draft-proof-backdrop-color:#c69fc6/);
  assert.match(renderTextareaDraftProofContent(snapshot), /--editor-draft-proof-light-fill-strength:64%/);
  assert.match(renderTextareaDraftProofContent(snapshot), /--editor-draft-proof-light-outline-strength:40%/);
  assert.match(renderTextareaDraftProofContent(snapshot), /--editor-draft-proof-dark-fill-strength:90%/);
  const paragraphText = "SOL year 2107\n\nthis is a test paragraph.";
  const paragraphStartOffset = "SOL year 2107".length;
  const paragraphSnapshot = createManuscriptEditorHostSnapshot({
    sceneId: "scene-1",
    text: paragraphText,
    projections: [{
      id: "draft-proof-paragraph-1",
      sceneId: "scene-1",
      startOffset: paragraphStartOffset,
      endOffset: paragraphText.length,
      channel: MANUSCRIPT_PROJECTION_CHANNELS.DRAFT_PROOF,
      styleToken: "covered",
      priority: 95,
      visualStyle: {
        backdropColor: "#c69fc6",
      },
    }],
  });
  const paragraphDraftProofMarkup = renderTextareaDraftProofContent(paragraphSnapshot);
  assert.doesNotMatch(paragraphDraftProofMarkup, /editor-draft-proof-range[^>]*>\n/);
  assert.match(
    paragraphDraftProofMarkup,
    /SOL year 2107\n\n<span class="editor-draft-proof-range"[^>]*>this is a test paragraph\.<\/span>/,
  );
  assert.match(renderTextareaNarrationFollowContent(snapshot), /editor-narration-follow-range/);
  assert.match(renderTextareaNarrationRecordingContent(snapshot), /editor-narration-recording-range/);
  const activeNarrationRecordingMarkup = renderTextareaNarrationRecordingContent(createManuscriptEditorHostSnapshot({
    sceneId: "scene-1",
    text: "alpha beta",
    projections: [{
      id: "narration-recording:recording-1",
      sceneId: "scene-1",
      startOffset: 0,
      endOffset: 5,
      channel: MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_RECORDING,
      styleToken: "narration-recording-active",
      priority: 65,
    }],
  }));
  assert.match(activeNarrationRecordingMarkup, /editor-narration-recording-range--active/);
  assert.match(renderTextareaDiagnosticContent(snapshot), /editor-diagnostic-warning/);
  assert.match(renderTextareaDiagnosticContent(snapshot), /data-diagnostic-id="issue-1"/);
  assert.match(renderTextareaSpellcheckContent(snapshot), /editor-spellcheck-word is-misspelled/);

  const manuScriptInfographicLaneSnapshot = createManuscriptEditorHostSnapshot({
    sceneId: "scene-1",
    text: "alpha beta gamma",
    projections: [{
      id: "ManuScriptInfographicLane:task:task:task-1:0",
      sceneId: "scene-1",
      startOffset: 0,
      endOffset: 5,
      channel: MANUSCRIPT_PROJECTION_CHANNELS.MANU_SCRIPT_INFOGRAPHIC_LANE,
      styleToken: "task",
      label: "Task: Alpha",
      priority: 75,
      sourceRef: {
        recordType: "task",
        recordId: "task-1",
      },
    }, {
      id: "ManuScriptInfographicLane:research:passageNote:note-research:0",
      sceneId: "scene-1",
      startOffset: 0,
      endOffset: 5,
      channel: MANUSCRIPT_PROJECTION_CHANNELS.MANU_SCRIPT_INFOGRAPHIC_LANE,
      styleToken: "research",
      label: "Research: Alpha",
      priority: 75,
      sourceRef: {
        recordType: "passageNote",
        recordId: "note-research",
      },
    }, {
      id: "ManuScriptInfographicLane:world:eventTag:event-1:0",
      sceneId: "scene-1",
      startOffset: 0,
      endOffset: 5,
      channel: MANUSCRIPT_PROJECTION_CHANNELS.MANU_SCRIPT_INFOGRAPHIC_LANE,
      styleToken: "world",
      label: "World Spine: Arrival",
      priority: 75,
      sourceRef: {
        recordType: "eventTag",
        recordId: "event-1",
        nodeId: "event:event-1",
      },
    }, {
      id: "ManuScriptInfographicLane:world-start:worldSpineNode:node-1:start:0",
      sceneId: "scene-1",
      startOffset: 0,
      endOffset: 1,
      channel: MANUSCRIPT_PROJECTION_CHANNELS.MANU_SCRIPT_INFOGRAPHIC_LANE,
      styleToken: "world-start",
      label: "World Spine start: Signal under the ice",
      priority: 75,
      sourceRef: {
        recordType: "worldSpineNode",
        recordId: "node-1:start",
        nodeId: "node-1",
      },
    }, {
      id: "ManuScriptInfographicLane:world-end:worldSpineNode:node-1:end:11",
      sceneId: "scene-1",
      startOffset: 11,
      endOffset: 12,
      channel: MANUSCRIPT_PROJECTION_CHANNELS.MANU_SCRIPT_INFOGRAPHIC_LANE,
      styleToken: "world-end",
      label: "World Spine end: Signal under the ice",
      priority: 75,
      sourceRef: {
        recordType: "worldSpineNode",
        recordId: "node-1:end",
        nodeId: "node-1",
      },
    }, {
      id: "ManuScriptInfographicLane:metadata:passageNote:note-1:6",
      sceneId: "scene-1",
      startOffset: 6,
      endOffset: 10,
      channel: MANUSCRIPT_PROJECTION_CHANNELS.MANU_SCRIPT_INFOGRAPHIC_LANE,
      styleToken: "metadata",
      label: "Lore: Beta",
      priority: 75,
      sourceRef: {
        recordType: "passageNote",
        recordId: "note-1",
      },
      visualStyle: {
        icon: metadataIcon,
      },
    }],
  });
  const manuScriptInfographicLaneHtml = renderTextareaManuScriptInfographicLaneContent(manuScriptInfographicLaneSnapshot, {
    charactersPerLine: 80,
    visualLineCount: 2,
  });
  assert.match(manuScriptInfographicLaneHtml, /editor-ManuScriptInfographicLane-marker--task/);
  assert.match(manuScriptInfographicLaneHtml, /editor-ManuScriptInfographicLane-marker--research/);
  assert.match(manuScriptInfographicLaneHtml, /editor-ManuScriptInfographicLane-marker--world/);
  assert.match(manuScriptInfographicLaneHtml, /editor-ManuScriptInfographicLane-marker--world-start/);
  assert.match(manuScriptInfographicLaneHtml, /editor-ManuScriptInfographicLane-marker--world-end/);
  assert.match(manuScriptInfographicLaneHtml, /editor-ManuScriptInfographicLane-marker--metadata/);
  assert.match(manuScriptInfographicLaneHtml, /data-action="open-ManuScriptInfographicLane-marker"/);
  assert.match(manuScriptInfographicLaneHtml, /data-record-type="task"/);
  assert.match(manuScriptInfographicLaneHtml, /aria-label="Task: Alpha"/);
  assert.match(manuScriptInfographicLaneHtml, /data-node-id="event:event-1"/);
  assert.match(manuScriptInfographicLaneHtml, /aria-label="Lore: Beta"/);
  assert.match(manuScriptInfographicLaneHtml, /metadata-image-icon--lane/);

  const liveFollowSnapshot = createManuscriptEditorHostSnapshot({
    sceneId: "scene-1",
    text: "alpha beta gamma",
    projections: [{
      id: "read",
      sceneId: "scene-1",
      startOffset: 0,
      endOffset: 16,
      channel: MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW,
      styleToken: "narration-follow-read",
      priority: 70,
    }, {
      id: "current",
      sceneId: "scene-1",
      startOffset: 6,
      endOffset: 10,
      channel: MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW,
      styleToken: "narration-follow-current",
      priority: 70,
    }],
  });
  const liveFollowMarkup = renderTextareaNarrationFollowContent(liveFollowSnapshot);
  assert.match(liveFollowMarkup, /editor-narration-follow-read-range">alpha /);
  assert.match(liveFollowMarkup, /editor-narration-follow-current-range">beta<\/span>/);

  const markup = renderTextareaEditorHostHTML({
    sceneId: "scene-1",
    text,
    projections,
    inputClassName: "has-revision-preview",
    draftProofBackdropColor: "#abc",
  });
  assert.match(markup, /data-inline-format-layer/);
  assert.match(markup, /data-draft-proof-layer/);
  assert.match(markup, /data-narration-recording-layer/);
  assert.match(markup, /data-narration-follow-layer/);
  assert.match(markup, /--editor-draft-proof-backdrop-color:#aabbcc/);
  assert.match(markup, /editor-draft-proof-range/);
  assert.match(markup, /editor-narration-follow-range/);
  assert.match(markup, /editor-narration-recording-range/);
  assert.match(markup, /<div class="editor-draft-proof-layer__content"><span class="editor-draft-proof-range"/);
  assert.doesNotMatch(markup, /<div class="editor-draft-proof-layer__content">\s+<span class="editor-draft-proof-range"/);
  assert.match(markup, /<div class="editor-spellcheck-layer" data-spellcheck-layer aria-hidden="true"><\/div>/);
  assert.match(markup, /data-diagnostic-layer/);
  assert.match(markup, /editor-diagnostic-warning/);
  assert.match(markup, /data-spellcheck-layer/);
  assert.match(markup, /class="editor-document-input has-revision-preview has-inline-format-projection"/);
  assert.match(markup, /Quiet dooor\./);
  assert.doesNotMatch(markup, /<textarea[^>]*readonly/);

  const readOnlyMarkup = renderTextareaEditorHostHTML({
    sceneId: "scene-1",
    text,
    projections,
    readOnly: true,
  });
  assert.match(readOnlyMarkup, /<textarea[^>]*class="editor-document-input has-inline-format-projection"[^>]*readonly/);
  assert.match(readOnlyMarkup, /aria-readonly="true"/);

  // Intent: prove clearing an author-mark overlay cannot leave the native textarea transparent.
  const originalHTMLElement = globalThis.HTMLElement;
  const originalHTMLTextAreaElement = globalThis.HTMLTextAreaElement;
  class FakeHTMLElement {}
  class FakeClassList {
    constructor(tokens = []) {
      this.tokens = new Set(tokens);
    }

    remove(token) {
      this.tokens.delete(token);
    }

    contains(token) {
      return this.tokens.has(token);
    }
  }
  class FakeTextAreaElement extends FakeHTMLElement {
    constructor() {
      super();
      this.classList = new FakeClassList(["has-inline-format-projection"]);
    }
  }
  try {
    globalThis.HTMLElement = FakeHTMLElement;
    globalThis.HTMLTextAreaElement = FakeTextAreaElement;
    const inlineFormatLayer = new FakeHTMLElement();
    inlineFormatLayer.innerHTML = "<span>overlay</span>";
    const textarea = new FakeTextAreaElement();
    assert.equal(clearTextareaProjectionLayer({
      inlineFormatLayer,
      textarea,
    }, MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK), true);
    assert.equal(inlineFormatLayer.innerHTML, "");
    assert.equal(textarea.classList.contains("has-inline-format-projection"), false);
  } finally {
    globalThis.HTMLElement = originalHTMLElement;
    globalThis.HTMLTextAreaElement = originalHTMLTextAreaElement;
  }

  const wrappedText = "abcdefghij\nklmno";
  assert.equal(estimateTextareaVisualLineBeforeOffset(wrappedText, 9, 4), 2);
  assert.equal(estimateTextareaVisualLineBeforeOffset(wrappedText, 12, 4), 3);
  assert.equal(findTextareaOffsetForVisualLineEnd(wrappedText, 0, 4), 4);
  assert.equal(findTextareaOffsetForVisualLineEnd(wrappedText, 2, 4), 10);
  assert.equal(findTextareaOffsetForVisualLineEnd(wrappedText, 3, 4), 15);
  assert.equal(resolveTextareaEditorHostContentWidth({
    clientWidth: 1040,
    paddingLeft: "140px",
    paddingRight: "140px",
  }), 760);
  assert.equal(resolveTextareaEditorHostContentWidth({
    clientWidth: 420,
    paddingLeft: "0px",
    paddingRight: "0px",
  }), 420);
  assert.equal(resolveTextareaEditorHostContentWidth({
    clientWidth: 320,
    paddingLeft: "190px",
    paddingRight: "190px",
  }), 320);

  assert.equal(
    resolveMeasuredEditorGutterLineCount({
      scrollHeight: 120.6,
      lineHeight: 24,
      fallbackLineCount: 9,
    }),
    5,
  );
  assert.equal(
    resolveMeasuredEditorGutterLineCount({
      scrollHeight: 132,
      lineHeight: 24,
      paddingTop: 6,
      paddingBottom: 6,
      fallbackLineCount: 9,
    }),
    5,
  );
  assert.equal(
    resolveMeasuredEditorGutterLineCount({
      scrollHeight: 120,
      lineHeight: 0,
      fallbackLineCount: 9,
    }),
    9,
  );
}
