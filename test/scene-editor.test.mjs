// Intent: verify scene-editor mode gates manuscript-only projection channels.
import assert from "node:assert/strict";

import {
  createNarrationRecordingPreviewsForScene,
  renderSceneEditorHTML,
} from "../apps/editor/public/features/scene-editor.js";
import { renderNarrationMetadataPanelHTML } from "../apps/editor/public/features/narration/narration-metadata-panel.js";

function createSceneEditorState(overrides = {}) {
  return {
    scenes: [
      {
        sceneId: "scene-1",
        sceneTitle: "Scene 1",
      },
      {
        sceneId: "scene-2",
        sceneTitle: "Scene 2",
      },
    ],
    sceneDrafts: {},
    editorPrefs: {
      fontFamilyId: "serif",
      fontSize: 18,
      lineHeight: 1.6,
      editorWidth: 760,
      manuScriptInfographicLaneVisible: true,
      revisionOverlayEnabled: false,
    },
    manuscriptInlineFormatting: { pendingFormats: {} },
    localAiTitleStatus: {},
    narrationTakeSelection: null,
    narrationTakeSession: null,
    draftProofMarksVisible: true,
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
            touchedAt: "2026-07-17T00:00:00.000Z",
          }],
        },
      }],
      settings: {
        backdropColor: "#ffeeaa",
      },
    },
    workspace: {
      project: {
        id: "project-1",
        marks: [],
        issues: [],
      },
    },
    ...overrides,
  };
}

function createScene(overrides = {}) {
  return {
    sceneId: "scene-1",
    chapterId: "chapter-1",
    chapterTitle: "Chapter 1",
    sceneTitle: "Scene 1",
    editorText: "Alpha beta gamma.",
    blocks: [],
    ...overrides,
  };
}

function renderScene(mode, options = {}) {
  return renderSceneEditorHTML(createScene(options.scene), {
    state: createSceneEditorState(options.state),
    editorMode: mode,
    grammarCheckSummary: { label: "0 flagged words" },
    projectIndex: null,
    buildEditorStyle: () => "",
    getInlinePassageDraftAnchor: () => null,
    narrationPlaybackState: options.narrationPlaybackState ?? null,
    formatChapterDisplayTitle: (value) => value,
  });
}

export function runSceneEditorTest() {
  const manuscriptHtml = renderScene("manuscript");
  const contextIndex = manuscriptHtml.indexOf("scene-editor-context");
  const grammarIndex = manuscriptHtml.indexOf("grammar-check-compact");
  const chapterTitleIndex = manuscriptHtml.indexOf("data-scene-editor-chapter-title");
  const chapterWordCountIndex = manuscriptHtml.indexOf("data-scene-editor-chapter-word-count");
  const mastheadIndex = manuscriptHtml.indexOf("scene-editor-masthead");
  assert.match(manuscriptHtml, /scene-editor-context__meta--left/);
  assert.match(manuscriptHtml, /scene-editor-context__meta--right/);
  assert.equal(contextIndex < grammarIndex && grammarIndex < mastheadIndex, true);
  assert.equal(contextIndex < chapterTitleIndex && chapterTitleIndex < mastheadIndex, true);
  assert.equal(contextIndex < chapterWordCountIndex && chapterWordCountIndex < mastheadIndex, true);
  assert.match(manuscriptHtml, /editor-draft-proof-range/);
  assert.match(manuscriptHtml, /editor-document-input is-draft-proofing/);
  assert.match(manuscriptHtml, /data-editor-manuscript-infographic-lane/);
  assert.match(manuscriptHtml, /data-feature="ManuScriptInfographicLane"/);
  assert.match(manuscriptHtml, /data-action="toggle-ManuScriptInfographicLane"/);
  assert.match(manuscriptHtml, /aria-label="Hide ManuScriptInfographicLane"/);
  assert.match(manuscriptHtml, /data-action="select-next-scene"/);
  assert.match(manuscriptHtml, /data-next-scene-id="scene-2"/);
  assert.match(manuscriptHtml, /data-tooltip="Go to next scene: Scene 2"/);
  assert.match(manuscriptHtml, /scene-editor-footer__next-scene-icon/);
  assert.doesNotMatch(manuscriptHtml, /<textarea[^>]*class="editor-document-input[^"]*"[^>]*readonly/);
  assert.doesNotMatch(manuscriptHtml, /data-action="toggle-narration-manuscript-decorations"/);

  const narrationHtml = renderScene("narration");
  assert.doesNotMatch(narrationHtml, /narration-recording-tools/);
  assert.doesNotMatch(narrationHtml, /editor-draft-proof-range/);
  assert.doesNotMatch(narrationHtml, /is-draft-proofing/);
  assert.doesNotMatch(narrationHtml, /--editor-draft-proof-backdrop-color/);
  assert.match(narrationHtml, /<textarea[^>]*class="editor-document-input[^"]*"[^>]*readonly/);
  assert.match(narrationHtml, /aria-readonly="true"/);
  assert.match(narrationHtml, /narration-decoration-compact/);
  assert.match(narrationHtml, /data-action="toggle-narration-manuscript-decorations"/);
  assert.match(narrationHtml, /data-action="toggle-narration-decorations"/);
  assert.match(narrationHtml, /Manuscript/);
  assert.match(narrationHtml, /Narration/);

  const narrationMetadataHtml = renderNarrationMetadataPanelHTML({
    scene: createScene(),
    selection: {
      sceneId: "scene-1",
      blockId: "block-1",
      lineNumber: 27,
      displayLineNumber: 315,
      kindLabel: "Narration",
    },
    session: null,
    recordings: [],
  });
  assert.match(narrationMetadataHtml, /Line 315 · Narration/);
  assert.match(narrationMetadataHtml, /narration-transport-actions/);
  assert.match(narrationMetadataHtml, /aria-label="Start recording"/);
  assert.match(narrationMetadataHtml, /aria-label="Play latest saved take"/);
  assert.match(narrationMetadataHtml, /aria-label="Delete latest saved take"/);
  assert.doesNotMatch(narrationMetadataHtml, /narration-recording-actions/);
  assert.match(narrationMetadataHtml, /data-action="toggle-narration-follow-scroll"/);
  assert.match(narrationMetadataHtml, /Follow scroll/);
  assert.doesNotMatch(narrationMetadataHtml, /data-action="toggle-narration-manuscript-decorations"/);
  assert.match(narrationMetadataHtml, /Clear armed line/);
  assert.doesNotMatch(narrationMetadataHtml, /Line 27 · Narration/);

  const narrationMetadataWithProviderHtml = renderNarrationMetadataPanelHTML({
    scene: createScene(),
    selection: {
      sceneId: "scene-1",
      blockId: "block-1",
      lineNumber: 27,
      displayLineNumber: 315,
      kindLabel: "Narration",
    },
    session: {
      status: "recording",
      trackerStatus: "Speech tracker listening",
      elapsedLabel: "0:03",
      speechProviderLabel: "Browser Web Speech",
      liveTranscript: "alpha beta",
      cleanupTranscript: "",
    },
    recordings: [],
  });
  assert.match(narrationMetadataWithProviderHtml, /Tracker engine/);
  assert.match(narrationMetadataWithProviderHtml, /Browser Web Speech/);
  assert.match(narrationMetadataWithProviderHtml, /aria-label="Stop recording"/);
  assert.match(narrationMetadataWithProviderHtml, /Live tracker/);
  assert.match(narrationMetadataWithProviderHtml, /alpha beta/);
  assert.match(narrationMetadataWithProviderHtml, /Whisper post/);

  const narrationSavedTakeHtml = renderScene("narration", {
    scene: {
      blocks: [{
        blockId: "block-1",
        paragraphId: "paragraph-1",
        lineNumber: 315,
        kind: "narration",
        text: "Alpha beta gamma.",
      }],
    },
    state: {
      narrationRecordingPreviewId: "take-1",
      workspace: {
        project: {
          id: "project-1",
          marks: [],
          issues: [],
        },
        voice: {
          recordings: [{
            id: "take-1",
            projectId: "project-1",
            sceneId: "scene-1",
            blockId: "block-1",
            lineNumber: 315,
            startOffset: 0,
            endOffset: 10,
            verseText: "Alpha beta",
            durationMs: 2400,
            status: "saved",
            mediaPath: "project-media/project-1/take-1.webm",
          }],
        },
      },
    },
  });
  assert.doesNotMatch(narrationSavedTakeHtml, /narration-saved-take/);
  assert.match(narrationSavedTakeHtml, /editor-narration-recording-range/);
  assert.match(narrationSavedTakeHtml, /editor-narration-recording-range--active/);

  const narrationHiddenDecorationsHtml = renderScene("narration", {
    scene: {
      blocks: [{
        blockId: "block-1",
        paragraphId: "paragraph-1",
        lineNumber: 315,
        kind: "narration",
        text: "Alpha beta gamma.",
      }],
    },
    state: {
      narrationFollowSettings: {
        liveHighlightEnabled: true,
        followScrollEnabled: true,
        manuscriptDecorationsVisible: false,
      },
      narrationRecordingPreviewId: "take-1",
      narrationRecordingReview: {
        recordingId: "take-1",
      },
      workspace: {
        project: {
          id: "project-1",
          marks: [{
            id: "mark-highlight",
            kind: "highlight",
            anchorStatus: "resolved",
            anchor: {
              projectId: "project-1",
              sceneId: "scene-1",
              blockId: "block-1",
              paragraphId: "paragraph-1",
              startOffset: 0,
              endOffset: 5,
            },
          }],
          issues: [{
            id: "issue-1",
            severity: "warning",
            lifecycle: "open",
            evidenceExcerpt: "beta",
            anchor: {
              projectId: "project-1",
              sceneId: "scene-1",
              blockId: "block-1",
              startOffset: 6,
              endOffset: 10,
            },
          }],
        },
        voice: {
          recordings: [{
            id: "take-1",
            projectId: "project-1",
            sceneId: "scene-1",
            blockId: "block-1",
            lineNumber: 315,
            startOffset: 0,
            endOffset: 10,
            verseText: "Alpha beta",
            transcript: "alpha beta gamma",
            durationMs: 2400,
            status: "saved",
            mediaPath: "project-media/project-1/take-1.webm",
          }],
        },
      },
    },
  });
  assert.match(narrationHiddenDecorationsHtml, /editor-document-input is-narration-manuscript-decorations-hidden/);
  assert.match(narrationHiddenDecorationsHtml, /editor-narration-recording-range/);
  assert.doesNotMatch(narrationHiddenDecorationsHtml, /editor-inline-format-highlight/);
  assert.doesNotMatch(narrationHiddenDecorationsHtml, /editor-diagnostic-warning/);
  assert.match(narrationHiddenDecorationsHtml, /narration-recording-review/);

  const narrationHiddenNarrationDecorationsHtml = renderScene("narration", {
    scene: {
      blocks: [{
        blockId: "block-1",
        paragraphId: "paragraph-1",
        lineNumber: 315,
        kind: "narration",
        text: "Alpha beta gamma.",
      }],
    },
    state: {
      narrationFollowSettings: {
        liveHighlightEnabled: true,
        followScrollEnabled: true,
        manuscriptDecorationsVisible: true,
        narrationDecorationsVisible: false,
      },
      narrationRecordingPreviewId: "take-1",
      workspace: {
        project: {
          id: "project-1",
          marks: [{
            id: "mark-highlight",
            kind: "highlight",
            anchorStatus: "resolved",
            anchor: {
              projectId: "project-1",
              sceneId: "scene-1",
              blockId: "block-1",
              paragraphId: "paragraph-1",
              startOffset: 0,
              endOffset: 5,
            },
          }],
          issues: [],
        },
        voice: {
          recordings: [{
            id: "take-1",
            projectId: "project-1",
            sceneId: "scene-1",
            blockId: "block-1",
            lineNumber: 315,
            startOffset: 0,
            endOffset: 10,
            verseText: "Alpha beta",
            durationMs: 2400,
            status: "saved",
            mediaPath: "project-media/project-1/take-1.webm",
          }],
        },
      },
    },
  });
  assert.doesNotMatch(narrationHiddenNarrationDecorationsHtml, /editor-narration-recording-range/);
  assert.match(narrationHiddenNarrationDecorationsHtml, /editor-inline-format-highlight/);

  const narrationReviewHtml = renderScene("narration", {
    scene: {
      blocks: [{
        blockId: "block-1",
        paragraphId: "paragraph-1",
        lineNumber: 315,
        kind: "narration",
        text: "Alpha beta gamma.",
      }],
    },
    state: {
      narrationRecordingReview: {
        recordingId: "take-1",
        currentTimeSeconds: 1,
        durationSeconds: 2.4,
      },
      workspace: {
        project: {
          id: "project-1",
          marks: [],
          issues: [],
        },
        voice: {
          recordings: [{
            id: "take-1",
            projectId: "project-1",
            sceneId: "scene-1",
            blockId: "block-1",
            lineNumber: 315,
            startOffset: 0,
            endOffset: 10,
            verseText: "Alpha beta",
            transcript: "alpha beta gamma delta",
            durationMs: 2400,
            status: "saved",
            mediaPath: "project-media/project-1/take-1.webm",
          }],
        },
      },
    },
    narrationPlaybackState: {
      recordingId: "take-1",
      currentTimeSeconds: 1,
      durationSeconds: 2.4,
      status: "playing",
      active: true,
    },
  });
  assert.match(narrationReviewHtml, /narration-recording-review/);
  assert.match(narrationReviewHtml, /data-narration-review-seek/);
  assert.match(narrationReviewHtml, /data-action="seek-narration-recording-word"/);
  assert.match(narrationReviewHtml, /data-action="stop-voice-recording-preview"/);
  assert.equal(
    narrationReviewHtml.indexOf("narration-recording-review") < narrationReviewHtml.indexOf("scene-editor-codeframe"),
    true,
  );

  const narrationSavedTakePanelHtml = renderNarrationMetadataPanelHTML({
    scene: createScene(),
    recordings: [{
      id: "take-1",
      projectId: "project-1",
      sceneId: "scene-1",
      blockId: "block-1",
      lineNumber: 315,
      displayStartLineNumber: 315,
      displayEndLineNumber: 318,
      startOffset: 0,
      endOffset: 10,
      verseText: "Alpha beta",
      durationMs: 2400,
      status: "saved",
      mediaPath: "project-media/project-1/take-1.webm",
    }],
    playbackState: {
      recordingId: "take-1",
      status: "playing",
    },
  });
  assert.match(narrationSavedTakePanelHtml, /narration-saved-take/);
  assert.match(narrationSavedTakePanelHtml, /Lines 315-318 · 2s/);
  assert.match(narrationSavedTakePanelHtml, /data-narration-recording-preview-id="take-1"/);
  assert.match(narrationSavedTakePanelHtml, /data-action="stop-voice-recording-preview"/);
  assert.doesNotMatch(narrationSavedTakePanelHtml, /data-action="go-to-voice-recording-verse"/);
  assert.doesNotMatch(narrationSavedTakePanelHtml, />Open<\/button>/);
  assert.match(narrationSavedTakePanelHtml, /data-action="delete-voice-recording"/);
  assert.match(narrationSavedTakePanelHtml, /data-recording-id="take-1"/);

  const shiftedRecordingScene = {
    sceneId: "scene-1",
    blocks: [
      { blockId: "block-1", text: "Alpha beta." },
      { blockId: "block-2", text: "Making his way toward the docking bay." },
    ],
    editorText: "Alpha beta.\n\nMaking his way toward the docking bay.",
  };
  const shiftedPreviewStart = shiftedRecordingScene.editorText.indexOf("Making his way");
  const shiftedPreviews = createNarrationRecordingPreviewsForScene({
    activeProjectId: "project-1",
    narrationRecordingPreviewId: "take-shifted",
    workspace: {
      project: { id: "project-1" },
      voice: {
        recordings: [{
          id: "take-shifted",
          projectId: "project-1",
          sceneId: "scene-1",
          blockId: "block-2",
          startOffset: shiftedPreviewStart + "Making ".length,
          endOffset: shiftedRecordingScene.editorText.length,
          verseText: "his way toward the docking bay.",
          transcript: "making his way toward the docking bay",
          status: "saved",
        }],
      },
    },
  }, shiftedRecordingScene);
  assert.equal(shiftedPreviews.length, 1);
  assert.equal(shiftedPreviews[0].startOffset, shiftedPreviewStart);
  assert.equal(shiftedPreviews[0].styleToken, "narration-recording-active");

  const lastSceneHtml = renderScene("manuscript", {
    scene: {
      sceneId: "scene-2",
      sceneTitle: "Scene 2",
    },
  });
  assert.match(lastSceneHtml, /data-tooltip="No next scene"/);
  assert.match(lastSceneHtml, /disabled/);

  const hiddenInfographicLaneHtml = renderScene("manuscript", {
    state: {
      manuscriptTasks: [{
        id: "task-hidden-1",
        sceneId: "scene-1",
        title: "Hidden lane task",
        startOffset: 0,
        endOffset: 5,
        status: "open",
      }],
      editorPrefs: {
        fontFamilyId: "serif",
        fontSize: 18,
        lineHeight: 1.6,
        editorWidth: 760,
        manuScriptInfographicLaneVisible: false,
        revisionOverlayEnabled: false,
      },
    },
  });
  assert.match(hiddenInfographicLaneHtml, /editor-ManuScriptInfographicLane is-hidden/);
  assert.match(hiddenInfographicLaneHtml, /aria-label="Show ManuScriptInfographicLane"/);
  assert.doesNotMatch(hiddenInfographicLaneHtml, /ManuScriptInfographicLane:task:/);

  const highlightPaletteHtml = renderScene("manuscript", {
    state: {
      highlightColorPaletteOpen: true,
      editorPrefs: {
        fontFamilyId: "serif",
        fontSize: 18,
        lineHeight: 1.6,
        editorWidth: 760,
        revisionOverlayEnabled: false,
        highlightColorId: "custom",
        highlightCustomRgb: { red: 12, green: 34, blue: 56 },
        highlightRecentCustomColors: [
          { red: 12, green: 34, blue: 56 },
          { red: 200, green: 120, blue: 40 },
        ],
      },
    },
  });
  assert.match(highlightPaletteHtml, /highlight-color-palette__recent/);
  assert.match(highlightPaletteHtml, /data-highlight-custom-rgb-index="0"/);
  assert.match(highlightPaletteHtml, /data-highlight-custom-rgb-index="1"/);
  assert.match(highlightPaletteHtml, /rgba\(12, 34, 56, 0\.44\)/);
  assert.match(highlightPaletteHtml, /data-highlight-rgb-channel="red"/);
}
