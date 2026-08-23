// Intent: render the manuscript scene editor surface from editor state and feature-owned display inputs.
import {
  areHighlightCustomColorsEqual,
  CUSTOM_HIGHLIGHT_COLOR_ID,
  EDITOR_WIDTH_OPTIONS,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  HIGHLIGHT_COLOR_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  normalizeHighlightRecentCustomColors,
  resolveHighlightColorOption,
} from "../editor-model.js";
import {
  DRAFT_PROOF_RUN_STATUS,
} from "./draft-proofing/draft-proofing-service.js";
import {
  INLINE_DECORATION_ERASER,
  INLINE_FORMATS,
} from "./manuscript-editor/manuscript-command-controller.js";
import {
  selectManuscriptProjections,
} from "./manuscript-editor/projection-selector.js";
import {
  createManuScriptInfographicLanePreviewsForScene,
} from "./manuscript-editor/ManuScriptInfographicLane-selector.js";
import { renderNarrationRecordingReviewHTML } from "./narration/narration-recording-review-service.js";
import {
  createVoiceRecordingSceneBlockRanges,
  resolveVoiceRecordingSceneRange,
} from "./voice/voice-recording-service.js";
import { renderTextareaEditorHostHTML } from "../adapters/editor-host/textarea-editor-host.js";
import { escapeHtml } from "../shared/ui-utils.js";

const REVISION_DRAFTING_UI_ENABLED = false;
// Intent: bench the draft-reset affordance until it belongs to the planned revision-perusal workflow.
const SCENE_DRAFT_REVERT_ACTION_ENABLED = false;

// Intent: keep the scene editor's word-count labels consistent across the template and live DOM updates.
export function formatSceneEditorWordCount(wordCount) {
  const safeWordCount = normalizeSceneEditorWordCount(wordCount);
  return `${safeWordCount} word${safeWordCount === 1 ? "" : "s"}`;
}

// Intent: keep the selection readout explicit so the user can distinguish highlighted text from scene totals.
export function formatSceneEditorSelectionWordCount(wordCount) {
  const safeWordCount = normalizeSceneEditorWordCount(wordCount);
  return `${safeWordCount} word${safeWordCount === 1 ? "" : "s"} selected`;
}

export function createNarrationRecordingPreviewsForScene(state, scene) {
  if (!scene?.sceneId) {
    return [];
  }

  const recordings = Array.isArray(state?.workspace?.voice?.recordings)
    ? state.workspace.voice.recordings
    : [];
  const projectId = String(state?.activeProjectId ?? state?.workspace?.project?.id ?? "").trim();
  const blockRanges = createVoiceRecordingSceneBlockRanges(scene);

  return recordings
    .filter((recording) => recording?.sceneId === scene.sceneId)
    .filter((recording) => !projectId || recording.projectId === projectId)
    .map((recording) => createNarrationRecordingPreview(recording, blockRanges, scene))
    .filter(Boolean)
    .map((preview) => preview.id && preview.id === state?.narrationRecordingPreviewId
      ? { ...preview, styleToken: "narration-recording-active" }
      : preview)
    .sort((left, right) => (
      left.startOffset - right.startOffset ||
      String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? ""))
    ));
}

function normalizeSceneEditorWordCount(wordCount) {
  const numericWordCount = Number(wordCount);
  if (!Number.isFinite(numericWordCount) || numericWordCount < 0) {
    return 0;
  }

  return Math.max(0, Math.round(numericWordCount));
}

function createNarrationRecordingPreview(recording, blockRanges, scene) {
  const range = resolveVoiceRecordingSceneRange(recording, scene, { blockRanges });
  const startOffset = range?.startOffset;
  const endOffset = range?.endOffset;

  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset) || endOffset <= startOffset) {
    return null;
  }

  return {
    ...recording,
    id: String(recording.id ?? ""),
    sceneId: scene.sceneId,
    startOffset: Math.max(0, startOffset),
    endOffset: Math.min(String(scene.editorText ?? "").length, endOffset),
  };
}

function resolveSceneEditorWordCountFromProjectIndex(projectIndex, sceneId, fallbackText = "") {
  const scenes = Array.isArray(projectIndex?.scenes) ? projectIndex.scenes : [];
  const scene = scenes.find((candidate) => candidate?.id === sceneId);
  const wordCount = Number(scene?.wordCount);
  if (Number.isFinite(wordCount) && wordCount >= 0) {
    return Math.max(0, Math.round(wordCount));
  }

  return countSceneEditorWords(fallbackText);
}

function resolveSceneEditorChapterWordCountFromProjectIndex(projectIndex, chapterId, fallbackSceneWordCount = 0, activeSceneId = "") {
  const chapters = Array.isArray(projectIndex?.chapters) ? projectIndex.chapters : [];
  const chapter = chapters.find((candidate) => candidate?.id === chapterId);
  const wordCount = Number(chapter?.wordCount);
  if (Number.isFinite(wordCount) && wordCount >= 0) {
    return Math.max(0, Math.round(wordCount));
  }

  const scenes = Array.isArray(projectIndex?.scenes) ? projectIndex.scenes : [];
  return scenes
    .filter((candidate) => candidate?.chapterId === chapterId)
    .reduce((total, candidate) => {
      if (candidate?.id === activeSceneId) {
        return total + Math.max(0, Math.round(Number(fallbackSceneWordCount) || 0));
      }

      const sceneWordCount = Number(candidate?.wordCount);
      return total + (Number.isFinite(sceneWordCount) && sceneWordCount >= 0 ? Math.max(0, Math.round(sceneWordCount)) : 0);
    }, 0);
}

function countSceneEditorWords(value) {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return 0;
  }

  return normalizedValue.split(/\s+/).filter(Boolean).length;
}

// Intent: derive footer scene-step navigation from the current binder order without mutating editor state.
function resolveSceneEditorNextScene(state, currentSceneId) {
  const scenes = Array.isArray(state?.scenes) ? state.scenes : [];
  const currentIndex = scenes.findIndex((candidate) => candidate?.sceneId === currentSceneId);
  if (currentIndex < 0) {
    return null;
  }

  return scenes.slice(currentIndex + 1).find((candidate) => typeof candidate?.sceneId === "string" && candidate.sceneId.trim()) ?? null;
}

// Intent: keep tooltip labels useful while preventing empty scene names from leaking into controls.
function formatSceneEditorNavigationSceneTitle(scene) {
  const title = String(scene?.sceneTitle ?? "").trim();
  return title || "Untitled scene";
}

// Intent: compose the manuscript panel around the selected scene content and feature-owned editor controls.
export function renderManuscriptPanelHTML({
  state,
  selectedScene,
  editorMode,
  grammarCheckSummary,
  projectIndex,
  buildEditorStyle,
  getInlinePassageDraftAnchor,
  narrationPlaybackState = null,
  formatChapterDisplayTitle = (value) => String(value ?? "").trim() || "Untitled chapter",
}) {
  return `
    ${selectedScene ? renderSceneEditorHTML(selectedScene, {
      state,
      editorMode,
      grammarCheckSummary,
      projectIndex,
      buildEditorStyle,
      getInlinePassageDraftAnchor,
      narrationPlaybackState,
      formatChapterDisplayTitle,
    }) : ""}
  `;
}

// Intent: keep grammar checking as one compact manuscript-control cluster in the chapter context rail.
function renderCompactGrammarCheck(state, grammarCheckSummary) {
  const grammarCheckEnabled = state?.editorPrefs?.grammarCheckEnabled !== false;
  const grammarCheckLabel = grammarCheckSummary?.label
    ? String(grammarCheckSummary.label)
    : "0 flagged words";
  const grammarCheckPanelOpen = Boolean(state?.grammarCheckPanel?.open);
  const grammarCheckButtonTitle = grammarCheckPanelOpen
    ? "Close grammar check list"
    : "Open grammar check list";

  return `
    <div class="grammar-check-compact" aria-label="Grammar check">
      <label class="grammar-check-compact__toggle">
        <input
          type="checkbox"
          data-editor-pref="grammarCheckEnabled"
          ${grammarCheckEnabled ? "checked" : ""}
          aria-label="Enable live grammar checking"
        />
        <span>Grammar check</span>
      </label>
      <button
        class="grammar-check-compact__status"
        type="button"
        data-action="toggle-grammar-check-panel"
        aria-pressed="${grammarCheckPanelOpen ? "true" : "false"}"
        title="${escapeHtml(grammarCheckButtonTitle)}"
      >${escapeHtml(grammarCheckEnabled ? grammarCheckLabel : "Live off")}</button>
    </div>
  `;
}

// Intent: group chapter-scoped readouts with the chapter breadcrumb so the scene-title masthead remains open for author tools.
function renderSceneEditorContext({
  scene,
  chapterTitle,
  chapterWordCount,
  state,
  grammarCheckSummary,
  narrationDecorationControlHtml = "",
}) {
  return `
    <div class="scene-editor-context">
      <div class="scene-editor-context__meta scene-editor-context__meta--left">
        ${renderCompactGrammarCheck(state, grammarCheckSummary)}
        ${narrationDecorationControlHtml}
      </div>
      <strong data-scene-editor-chapter-title="${escapeHtml(scene.chapterId)}">${escapeHtml(chapterTitle)}</strong>
      <div class="scene-editor-context__meta scene-editor-context__meta--right">
        <span class="scene-editor-context__count" data-scene-editor-chapter-word-count="${escapeHtml(scene.chapterId)}">${escapeHtml(`Chapter words: ${formatSceneEditorWordCount(chapterWordCount)}`)}</span>
      </div>
    </div>
  `;
}

// Intent: expose narration-only overlay visibility beside the read-only script it affects.
function renderNarrationDecorationToggles(state) {
  return `
    <div class="narration-decoration-toggle-group" aria-label="Narration viewport decoration controls">
      ${renderNarrationDecorationToggle({
        action: "toggle-narration-manuscript-decorations",
        checked: state?.narrationFollowSettings?.manuscriptDecorationsVisible !== false,
        label: "Manuscript",
        titleWhenChecked: "Hide manuscript decorations in narration view",
        titleWhenUnchecked: "Show manuscript decorations in narration view",
      })}
      ${renderNarrationDecorationToggle({
        action: "toggle-narration-decorations",
        checked: state?.narrationFollowSettings?.narrationDecorationsVisible !== false,
        label: "Narration",
        titleWhenChecked: "Hide narrated passage decorations",
        titleWhenUnchecked: "Show narrated passage decorations",
      })}
    </div>
  `;
}

function renderNarrationDecorationToggle({
  action,
  checked,
  label,
  titleWhenChecked,
  titleWhenUnchecked,
}) {
  const title = checked ? titleWhenChecked : titleWhenUnchecked;
  return `
    <label
      class="narration-decoration-compact"
      title="${escapeHtml(title)}"
      aria-label="${escapeHtml(title)}"
    >
      <input
        type="checkbox"
        data-action="${escapeHtml(action)}"
        ${checked ? "checked" : ""}
      />
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

export function renderSceneEditorHTML(scene, {
  state,
  editorMode,
  grammarCheckSummary,
  projectIndex,
  buildEditorStyle,
  getInlinePassageDraftAnchor,
  narrationPlaybackState,
  formatChapterDisplayTitle,
}) {
  // Intent: keep manuscript and narration modes in one render surface while their controllers are extracted.
  const mode = editorMode === "narration" ? "narration" : "manuscript";
  const hasDraft = Boolean(state.sceneDrafts[scene.sceneId]);
  const revisionStats = state.sceneDrafts?.[scene.sceneId]?.revisionStats ?? null;
  const revisionEditCount = Number(revisionStats?.editCount ?? 0);
  const showRevisionHighlight = Boolean(
    REVISION_DRAFTING_UI_ENABLED &&
    state.editorPrefs?.revisionOverlayEnabled &&
    revisionEditCount > 0,
  );
  const localAiStatus = state.localAiTitleStatus[scene.sceneId];
  // Intent: let narration mode suppress manuscript and narration overlays independently without deleting anchored data.
  const narrationManuscriptDecorationsVisible = mode !== "narration" ||
    state.narrationFollowSettings?.manuscriptDecorationsVisible !== false;
  const narrationDecorationsVisible = mode !== "narration" ||
    state.narrationFollowSettings?.narrationDecorationsVisible !== false;
  const narrationManuscriptDecorationsHidden = mode === "narration" && !narrationManuscriptDecorationsVisible;
  const allNarrationRecordingPreviews = mode === "narration"
    ? createNarrationRecordingPreviewsForScene(state, scene)
    : [];
  const narrationRecordingPreviews = narrationDecorationsVisible
    ? allNarrationRecordingPreviews
    : [];
  const narrationReviewRecording = mode === "narration"
    ? resolveNarrationReviewRecording(allNarrationRecordingPreviews, state?.narrationRecordingReview)
    : null;
  const includeDraftProofing = mode === "manuscript" && state.draftProofMarksVisible === true;
  const isDraftProofSelectionMode = mode === "manuscript" && hasActiveDraftProofRun(state.draftProofing);
  const manuScriptInfographicLaneVisible = state.editorPrefs?.manuScriptInfographicLaneVisible !== false;
  const manuScriptInfographicLanePreviews = manuScriptInfographicLaneVisible
    ? createManuScriptInfographicLanePreviewsForScene({ state, scene })
    : [];
  const manuscriptProjections = selectManuscriptProjections({
    projectId: state.workspace?.project?.id ?? "",
    sceneId: scene.sceneId,
    text: scene.editorText ?? "",
    sceneBlocks: scene.blocks,
    inlineFormatRanges: state.sceneDrafts?.[scene.sceneId]?.inlineFormatRanges,
    manuscriptMarks: state.workspace?.project?.marks,
    draftProofing: state.draftProofing,
    diagnosticIssues: narrationManuscriptDecorationsVisible ? state.workspace?.project?.issues : [],
    manuScriptInfographicLanePreviews,
    narrationRecordingPreviews,
    includeAuthorMarks: narrationManuscriptDecorationsVisible,
    includeDraftProofing,
    includeDiagnostics: narrationManuscriptDecorationsVisible,
    includeAnchoredRecords: narrationManuscriptDecorationsVisible,
    includeManuScriptInfographicLane: manuScriptInfographicLaneVisible,
    includeSpellcheck: false,
  });
  const chapterTitle = typeof formatChapterDisplayTitle === "function"
    ? formatChapterDisplayTitle(scene.chapterTitle)
    : String(scene.chapterTitle ?? "").trim() || "Untitled chapter";
  const sceneWordCount = resolveSceneEditorWordCountFromProjectIndex(
    projectIndex,
    scene.sceneId,
    scene.editorText ?? "",
  );
  const chapterWordCount = resolveSceneEditorChapterWordCountFromProjectIndex(
    projectIndex,
    scene.chapterId,
    sceneWordCount,
    scene.sceneId,
  );
  const nextScene = resolveSceneEditorNextScene(state, scene.sceneId);
  const narrationDecorationControlHtml = mode === "narration"
    ? renderNarrationDecorationToggles(state)
    : "";

  return `
    <section
      class="scene-editor-shell ${mode === "narration" ? "narration-editor-shell" : ""} ${showRevisionHighlight ? "has-revision-preview" : ""}"
      data-scene-editor-scene-id="${escapeHtml(scene.sceneId)}"
    >
      ${renderSceneEditorContext({
        scene,
        chapterTitle,
        chapterWordCount,
        state,
        grammarCheckSummary,
        narrationDecorationControlHtml,
      })}
      <div class="scene-editor-masthead">
        <input
          class="editor-title-input scene-editor-title-input"
          type="text"
          value="${escapeHtml(scene.sceneTitle)}"
          data-edit-field="scene-title"
          data-scene-id="${escapeHtml(scene.sceneId)}"
          data-scene-title-id="${escapeHtml(scene.sceneId)}"
          aria-label="Scene title"
        />
      </div>
      ${mode === "manuscript" ? `
        <div class="scene-editor-header">
          <div class="scene-editor-tools">
            ${renderEditorSetting("Font", "fontFamilyId", FONT_OPTIONS.map((option) => ({
              value: option.id,
              label: option.label,
            })), state.editorPrefs.fontFamilyId)}
            ${renderEditorSetting("Size", "fontSize", FONT_SIZE_OPTIONS.map((value) => ({
              value: String(value),
              label: `${value}px`,
            })), String(state.editorPrefs.fontSize))}
            ${renderEditorSetting("Line Height", "lineHeight", LINE_HEIGHT_OPTIONS.map((value) => ({
              value: String(value),
              label: `${value}x`,
            })), String(state.editorPrefs.lineHeight))}
            ${renderEditorSetting("Text Width", "editorWidth", EDITOR_WIDTH_OPTIONS.map((value) => ({
              value: String(value),
              label: `${value}px`,
            })), String(state.editorPrefs.editorWidth))}
            ${renderInlineFormatButton("bold", "B", state)}
            ${renderInlineFormatButton("italic", "I", state)}
            ${renderInlineFormatButton("underline", "U", state)}
            ${renderInlineFormatButton("strikethrough", "S", state)}
            ${renderInlineFormatButton("highlight", "H", state)}
            ${renderDecorationEraserButton(state)}
            ${localAiStatus && localAiStatus !== "loading" ? `<span class="local-ai-status">${escapeHtml(localAiStatus)}</span>` : ""}
            ${SCENE_DRAFT_REVERT_ACTION_ENABLED && hasDraft ? `<button class="tag-button editor-action-button" data-action="reset-scene-draft" data-scene-id="${escapeHtml(scene.sceneId)}">Revert local draft</button>` : ""}
          </div>
        </div>
      ` : ""}
      ${renderHighlightColorPalette(state)}
      ${REVISION_DRAFTING_UI_ENABLED ? renderRevisionPanel(scene, state, revisionStats) : ""}
      ${narrationReviewRecording ? renderNarrationRecordingReviewHTML({
        recording: narrationReviewRecording,
        scene,
        reviewState: state.narrationRecordingReview,
        playbackState: narrationPlaybackState,
        waveformState: state.narrationRecordingWaveforms?.[narrationReviewRecording.id] ?? null,
      }) : ""}

      <div
        class="scene-editor-codeframe ${mode === "narration" ? "narration-editor-frame" : ""} ${showRevisionHighlight ? "has-revision-preview" : ""}"
        data-scene-editor="${escapeHtml(scene.sceneId)}"
        style="${escapeHtml(buildEditorStyle())}"
      >
        <div class="editor-document-gutter" data-editor-gutter aria-hidden="true"></div>
        ${renderManuScriptInfographicLaneShell(manuScriptInfographicLaneVisible)}
        <div class="editor-document-body">
          ${renderTextareaEditorHostHTML({
            sceneId: scene.sceneId,
            text: scene.editorText ?? "",
            projections: manuscriptProjections,
            inputClassName: [
              showRevisionHighlight ? "has-revision-preview" : "",
              isDraftProofSelectionMode ? "is-draft-proofing" : "",
              narrationManuscriptDecorationsHidden ? "is-narration-manuscript-decorations-hidden" : "",
            ].filter(Boolean).join(" "),
            draftProofBackdropColor: includeDraftProofing ? state.draftProofing?.settings?.backdropColor ?? "" : "",
            readOnly: mode === "narration",
          })}
        </div>
        ${renderInlinePassageDraftHTML(scene, state, getInlinePassageDraftAnchor)}
      </div>
      <div class="scene-editor-footer">
        <span class="scene-editor-footer__selection" data-scene-editor-selection-word-count="${escapeHtml(scene.sceneId)}">${escapeHtml(formatSceneEditorSelectionWordCount(0))}</span>
        ${renderSceneEditorNextSceneButton(scene, nextScene)}
        <span class="scene-editor-footer__scene" data-scene-editor-scene-word-count="${escapeHtml(scene.sceneId)}">${escapeHtml(`Scene words: ${formatSceneEditorWordCount(sceneWordCount)}`)}</span>
      </div>
    </section>
  `;
}

// Intent: display only the opened take for this rendered scene, leaving saved-take lists in the Audio tab.
function resolveNarrationReviewRecording(recordings, reviewState) {
  const recordingId = typeof reviewState?.recordingId === "string" && reviewState.recordingId.trim()
    ? reviewState.recordingId.trim()
    : "";
  if (!recordingId || !Array.isArray(recordings)) {
    return null;
  }

  return recordings.find((recording) => recording?.id === recordingId) ?? null;
}

// Intent: keep the ManuScriptInfographicLane toggle persistent while marker paint remains render-only.
function renderManuScriptInfographicLaneShell(visible = true) {
  const toggleLabel = visible
    ? "Hide ManuScriptInfographicLane"
    : "Show ManuScriptInfographicLane";
  return `
    <div
      class="editor-ManuScriptInfographicLane ${visible ? "is-visible" : "is-hidden"}"
      data-editor-manuscript-infographic-lane
      data-feature="ManuScriptInfographicLane"
      data-manuscript-infographic-lane-visible="${visible ? "true" : "false"}"
      aria-label="ManuScriptInfographicLane markers"
    >
      <div class="editor-ManuScriptInfographicLane__float">
        <button
          class="editor-ManuScriptInfographicLane-toggle ${visible ? "is-visible" : ""}"
          type="button"
          data-action="toggle-ManuScriptInfographicLane"
          aria-label="${escapeHtml(toggleLabel)}"
          aria-pressed="${visible ? "true" : "false"}"
          title="${escapeHtml(toggleLabel)}"
        ><span class="editor-ManuScriptInfographicLane-toggle__eye" aria-hidden="true"></span></button>
      </div>
      <div class="editor-ManuScriptInfographicLane__track" data-manuscript-infographic-lane-track></div>
    </div>
  `;
}

// Intent: let the host style active proof-read selections distinctly from saved coverage marks.
function hasActiveDraftProofRun(draftProofing) {
  const activeRunId = String(draftProofing?.activeRunId ?? "").trim();
  const runs = Array.isArray(draftProofing?.runs) ? draftProofing.runs : [];
  return Boolean(activeRunId) && runs.some((run) =>
    run?.id === activeRunId && run?.status === DRAFT_PROOF_RUN_STATUS.ACTIVE
  );
}

// Intent: render the footer navigation affordance as a scene-order command, not a manuscript data mutation.
function renderSceneEditorNextSceneButton(scene, nextScene) {
  const currentSceneId = String(scene?.sceneId ?? "");
  const nextSceneId = String(nextScene?.sceneId ?? "");
  const nextSceneTitle = formatSceneEditorNavigationSceneTitle(nextScene);
  const enabled = Boolean(nextSceneId);
  const label = enabled
    ? `Go to next scene: ${nextSceneTitle}`
    : "No next scene";

  return `
    <button
      class="scene-editor-footer__next-scene"
      type="button"
      data-action="select-next-scene"
      data-scene-id="${escapeHtml(currentSceneId)}"
      data-next-scene-id="${escapeHtml(nextSceneId)}"
      data-tooltip="${escapeHtml(label)}"
      aria-label="${escapeHtml(label)}"
      title="${escapeHtml(label)}"
      ${enabled ? "" : "disabled"}
    ><span class="scene-editor-footer__next-scene-icon" aria-hidden="true"></span></button>
  `;
}

function renderRevisionPanel(scene, state, revisionStats) {
  // Intent: keep dormant revision UI markup isolated until the drafting workflow is re-enabled.
  const revisionEditCount = Number(revisionStats?.editCount ?? 0);
  const revisionHistory = Array.isArray(revisionStats?.history) ? revisionStats.history : [];
  const revisionOverlayEnabled = state.editorPrefs?.revisionOverlayEnabled === true;
  const summary = revisionStats?.lastChangeSummary
    ? String(revisionStats.lastChangeSummary)
    : "Track revisions while you edit this passage.";

  return `
    <div class="scene-revision-panel ${revisionOverlayEnabled ? "is-enabled" : ""} ${revisionEditCount > 0 ? "has-history" : ""}">
      <div class="scene-revision-panel__header">
        <div class="scene-revision-panel__title">
          <span>Revisions</span>
          <strong data-revision-count="${escapeHtml(scene.sceneId)}">${escapeHtml(`${revisionEditCount} edit${revisionEditCount === 1 ? "" : "s"}`)}</strong>
        </div>
        <button
          class="tag-button editor-action-button"
          type="button"
          data-action="toggle-revision-overlay"
          data-scene-id="${escapeHtml(scene.sceneId)}"
        >${revisionOverlayEnabled ? "Hide highlights" : "Show highlights"}</button>
      </div>
      <p class="scene-revision-panel__summary" data-revision-summary="${escapeHtml(scene.sceneId)}">${escapeHtml(summary)}</p>
      ${revisionHistory.length ? `
        <ul class="scene-revision-panel__history" data-revision-history="${escapeHtml(scene.sceneId)}">
          ${revisionHistory.slice(0, 3).map((entry) => `
            <li>
              <strong>${escapeHtml(entry.summary || "Edited passage")}</strong>
              <span>${escapeHtml(formatRevisionTimestamp(entry.updatedAt || entry.createdAt || ""))}</span>
            </li>
          `).join("")}
        </ul>
      ` : ""}
    </div>
  `;
}

function formatRevisionTimestamp(value) {
  const timestamp = typeof value === "string" ? value.trim() : "";
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
}

export function getPassageNotePlaceholder(noteType) {
  return noteType === "research"
    ? "Collect references, facts, and questions for this passage..."
    : noteType === "inspiration"
      ? "What are you trying to convey here?"
      : `Store ${String(noteType ?? "").trim() ? "metadata" : "custom metadata"} for this passage...`;
}

function renderInlinePassageDraftHTML(scene, state, getInlinePassageDraftAnchor) {
  // Intent: render anchored note drafts beside the text they will attach to.
  const draft = state.inlinePassageDraft;
  if (!draft || draft.sceneId !== scene.sceneId) {
    return "";
  }

  const label = resolveInlinePassageDraftLabel(draft, state);
  const anchor = getInlinePassageDraftAnchor(draft, scene.editorText ?? "", {
    includePendingVerse: true,
  });
  const prompt = anchor
    ? `${label} will save against: ${anchor.selectedText.slice(0, 96)}`
    : `Save this ${label.toLowerCase()} note against the verse typed in the manuscript field below.`;
  return `
    <section
      class="inline-passage-bubble inline-passage-${escapeHtml(draft.noteType)}"
      data-inline-passage-draft
      style="--inline-passage-y:${Math.round(draft.y)}px; ${draft.metadataHighlightColor ? `--inline-passage-accent:${escapeHtml(draft.metadataHighlightColor)};` : ""}"
    >
      <div class="inline-passage-heading">
        <span>${escapeHtml(label)} note</span>
        <strong data-inline-passage-status>${escapeHtml(prompt)}</strong>
        <button class="inline-passage-close" type="button" data-action="cancel-inline-passage-note" aria-label="Cancel ${escapeHtml(label)}">x</button>
      </div>
      <textarea
        data-edit-field="inline-passage-note"
        data-scene-id="${escapeHtml(scene.sceneId)}"
        placeholder="${escapeHtml(getPassageNotePlaceholder(draft.noteType))}"
      >${escapeHtml(draft.body ?? "")}</textarea>
      <label class="inline-passage-verse-shell">
        <span>Typed verse</span>
        <textarea
          class="inline-passage-verse-field"
          data-edit-field="inline-passage-verse"
          data-scene-id="${escapeHtml(scene.sceneId)}"
          placeholder="Type the manuscript verse this note belongs to."
        >${escapeHtml(draft.typedText ?? "")}</textarea>
      </label>
      <div class="inline-passage-actions">
        <span aria-hidden="true"></span>
        <button class="tag-button" type="button" data-inline-passage-save data-action="commit-inline-passage-note">${escapeHtml(draft.editingNoteId ? `Update ${label.toLowerCase()} note` : "Save to typed verse")}</button>
      </div>
    </section>
  `;
}

function resolveInlinePassageDraftLabel(draft, state) {
  if (typeof draft?.metadataLabel === "string" && draft.metadataLabel.trim()) {
    return draft.metadataLabel.trim();
  }

  if (draft?.noteType === "research") {
    return "Research";
  }

  if (draft?.noteType === "inspiration") {
    return "Inspiration";
  }

  const definition = Array.isArray(state?.customMetadataDefinitions)
    ? state.customMetadataDefinitions.find((candidate) => candidate?.id === draft?.noteType)
    : null;
  return String(definition?.label ?? "").trim() || "Metadata";
}

function renderEditorSetting(label, prefKey, options, selectedValue) {
  return `
    <label class="editor-inline-setting">
      <span>${escapeHtml(label)}</span>
      <select data-editor-pref="${escapeHtml(prefKey)}">
        ${options.map((option) => `
          <option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? "selected" : ""}>
            ${escapeHtml(option.label)}
          </option>
        `).join("")}
      </select>
    </label>
  `;
}

function renderInlineFormatButton(formatId, label, state) {
  const isActive = state.manuscriptInlineFormatting?.pendingFormats?.[formatId] === true;
  const isHighlightButton = formatId === "highlight";
  const highlightColor = resolveHighlightColorOption(
    state?.editorPrefs?.highlightColorId,
    state?.editorPrefs?.highlightCustomRgb,
  );
  const title = isHighlightButton
    ? "Highlight (right-click for colour)"
    : INLINE_FORMATS[formatId]?.label ?? label;
  const buttonStyle = isHighlightButton
    ? ` style="--highlight-button-color:${escapeHtml(highlightColor.color)}; --highlight-button-outline:${escapeHtml(highlightColor.outline)}"`
    : "";
  const menuAttributes = isHighlightButton
    ? ` aria-haspopup="menu" aria-expanded="${state?.highlightColorPaletteOpen ? "true" : "false"}"`
    : "";
  const buttonContent = isHighlightButton
    ? `${escapeHtml(label)}<span class="inline-format-highlight-swatch" aria-hidden="true"></span>`
    : escapeHtml(label);
  return `
    <button
      class="tag-button editor-action-button editor-toggle-button inline-format-button inline-format-${escapeHtml(formatId)}${isHighlightButton ? " has-highlight-palette" : ""}"
      type="button"
      data-action="toggle-inline-format"
      data-inline-format="${escapeHtml(formatId)}"
      ${isHighlightButton ? "data-highlight-color-trigger" : ""}
      aria-pressed="${isActive ? "true" : "false"}"
      title="${escapeHtml(title)}"
      ${menuAttributes}
      ${buttonStyle}
    >${buttonContent}</button>
  `;
}

function renderDecorationEraserButton(state) {
  const isActive = state.manuscriptInlineFormatting?.pendingClearDecorations === true;
  return `
    <button
      class="tag-button editor-action-button editor-toggle-button inline-format-button inline-format-eraser"
      type="button"
      data-action="toggle-decoration-eraser"
      aria-pressed="${isActive ? "true" : "false"}"
      aria-label="${escapeHtml(INLINE_DECORATION_ERASER.label)}"
      title="${escapeHtml(INLINE_DECORATION_ERASER.label)}"
    ><span class="inline-format-eraser-icon" aria-hidden="true"></span></button>
  `;
}

function renderHighlightColorPalette(state) {
  // Intent: expose the user-level highlight colour preference without introducing a separate decorations panel.
  if (!state?.highlightColorPaletteOpen) {
    return "";
  }

  const activeColor = resolveHighlightColorOption(
    state?.editorPrefs?.highlightColorId,
    state?.editorPrefs?.highlightCustomRgb,
  );
  const customColor = resolveHighlightColorOption(
    CUSTOM_HIGHLIGHT_COLOR_ID,
    state?.editorPrefs?.highlightCustomRgb,
  );
  const customRgb = customColor.rgb;
  // Intent: render committed custom colours separately from the live RGB editor swatch.
  const recentCustomColors = normalizeHighlightRecentCustomColors(
    state?.editorPrefs?.highlightRecentCustomColors,
  );
  const position = state?.highlightColorPalettePosition && typeof state.highlightColorPalettePosition === "object"
    ? state.highlightColorPalettePosition
    : {};
  const left = Number.isFinite(Number(position.left)) ? Math.round(Number(position.left)) : 12;
  const top = Number.isFinite(Number(position.top)) ? Math.round(Number(position.top)) : 84;
  return `
    <div
      class="highlight-color-palette"
      data-highlight-color-palette
      role="menu"
      aria-label="Highlight colour"
      style="--highlight-palette-left:${left}px; --highlight-palette-top:${top}px;"
    >
      <div class="highlight-color-palette__swatches">
        ${HIGHLIGHT_COLOR_OPTIONS.map((option) => {
          const isActive = option.id === activeColor.id;
          return `
            <button
              class="highlight-color-swatch ${isActive ? "is-active" : ""}"
              type="button"
              data-action="set-highlight-color"
              data-highlight-color-id="${escapeHtml(option.id)}"
              role="menuitemradio"
              aria-checked="${isActive ? "true" : "false"}"
              aria-label="${escapeHtml(`${option.label} highlight`)}"
              title="${escapeHtml(option.label)}"
              style="--highlight-swatch-color:${escapeHtml(option.color)}; --highlight-swatch-outline:${escapeHtml(option.outline)}"
            ><span aria-hidden="true"></span></button>
          `;
        }).join("")}
        <button
          class="highlight-color-swatch highlight-color-custom-swatch ${activeColor.id === CUSTOM_HIGHLIGHT_COLOR_ID ? "is-active" : ""}"
          type="button"
          data-action="set-highlight-color"
          data-highlight-color-id="${CUSTOM_HIGHLIGHT_COLOR_ID}"
          role="menuitemradio"
          aria-checked="${activeColor.id === CUSTOM_HIGHLIGHT_COLOR_ID ? "true" : "false"}"
          aria-label="Custom highlight"
          title="Custom"
          style="--highlight-swatch-color:${escapeHtml(customColor.color)}; --highlight-swatch-outline:${escapeHtml(customColor.outline)}"
        ><span aria-hidden="true"></span></button>
      </div>
      ${recentCustomColors.length ? `
        <div class="highlight-color-palette__recent" aria-label="Recent custom highlight colours">
          ${recentCustomColors.map((rgb, index) => {
            const option = resolveHighlightColorOption(CUSTOM_HIGHLIGHT_COLOR_ID, rgb);
            const isActive = activeColor.id === CUSTOM_HIGHLIGHT_COLOR_ID &&
              areHighlightCustomColorsEqual(activeColor.rgb, rgb);
            return `
              <button
                class="highlight-color-swatch highlight-color-recent-swatch ${isActive ? "is-active" : ""}"
                type="button"
                data-action="set-highlight-color"
                data-highlight-color-id="${CUSTOM_HIGHLIGHT_COLOR_ID}"
                data-highlight-custom-rgb-index="${escapeHtml(String(index))}"
                role="menuitemradio"
                aria-checked="${isActive ? "true" : "false"}"
                aria-label="${escapeHtml(`Recent custom highlight ${index + 1}`)}"
                title="${escapeHtml(`Recent custom ${index + 1}`)}"
                style="--highlight-swatch-color:${escapeHtml(option.color)}; --highlight-swatch-outline:${escapeHtml(option.outline)}"
              ><span aria-hidden="true"></span></button>
            `;
          }).join("")}
        </div>
      ` : ""}
      <div class="highlight-color-rgb-controls" data-highlight-rgb-controls>
        ${renderHighlightRgbSlider("red", "R", customRgb.red)}
        ${renderHighlightRgbSlider("green", "G", customRgb.green)}
        ${renderHighlightRgbSlider("blue", "B", customRgb.blue)}
        <div
          class="highlight-color-rgb-preview"
          data-highlight-rgb-preview
          style="--highlight-swatch-color:${escapeHtml(customColor.color)}; --highlight-swatch-outline:${escapeHtml(customColor.outline)}"
        >
          <span aria-hidden="true"></span>
          <strong data-highlight-rgb-label>${escapeHtml(`rgb(${customRgb.red}, ${customRgb.green}, ${customRgb.blue})`)}</strong>
        </div>
      </div>
    </div>
  `;
}

function renderHighlightRgbSlider(channel, label, value) {
  return `
    <label class="highlight-color-rgb-row">
      <span>${escapeHtml(label)}</span>
      <input
        type="range"
        min="0"
        max="255"
        step="1"
        value="${escapeHtml(String(value))}"
        data-highlight-rgb-channel="${escapeHtml(channel)}"
        aria-label="${escapeHtml(`${label} highlight channel`)}"
      />
      <output data-highlight-rgb-output="${escapeHtml(channel)}">${escapeHtml(String(value))}</output>
    </label>
  `;
}
