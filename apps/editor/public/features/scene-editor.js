// Intent: render the manuscript scene editor surface from editor state and feature-owned display inputs.
import {
  EDITOR_WIDTH_OPTIONS,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  LINE_HEIGHT_OPTIONS,
} from "../editor-model.js";
import {
  INLINE_FORMATS,
  normalizeInlineFormatRanges,
} from "./manuscript-editor/manuscript-command-controller.js";
import { escapeHtml } from "../shared/ui-utils.js";

const REVISION_DRAFTING_UI_ENABLED = false;

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

function normalizeSceneEditorWordCount(wordCount) {
  const numericWordCount = Number(wordCount);
  if (!Number.isFinite(numericWordCount) || numericWordCount < 0) {
    return 0;
  }

  return Math.max(0, Math.round(numericWordCount));
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

// Intent: compose the manuscript panel around shared project-file display data and selected scene content.
export function renderManuscriptPanelHTML({
  state,
  selectedScene,
  editorMode,
  grammarCheckSummary,
  projectFileDisplay,
  projectIndex,
  buildEditorStyle,
  getInlinePassageDraftAnchor,
  formatChapterDisplayTitle = (value) => String(value ?? "").trim() || "Untitled chapter",
}) {
  const safeProjectFileDisplay = projectFileDisplay ?? {
    displayName: "Untitled project file",
    tooltip: "No project file selected",
  };
  const grammarCheckEnabled = state?.editorPrefs?.grammarCheckEnabled !== false;
  const grammarCheckLabel = grammarCheckSummary?.label
    ? String(grammarCheckSummary.label)
    : "Grammar check";
  const grammarCheckPanelOpen = Boolean(state?.grammarCheckPanel?.open);
  const grammarCheckButtonTitle = grammarCheckPanelOpen
    ? "Close grammar check list"
    : "Open grammar check list";
  const grammarCheckToggleLabel = grammarCheckEnabled ? "On" : "Off";

  return `
    <div class="panel-heading scene-editor-heading">
      <p class="panel-kicker">Scene Editor</p>
      <p class="scene-editor-project-title project-file-tooltip" data-file-path-tooltip="${escapeHtml(safeProjectFileDisplay.tooltip)}">
        <span class="scene-editor-project-title__text">${escapeHtml(safeProjectFileDisplay.displayName)}</span>
      </p>
      <div class="scene-editor-heading__grammar">
        <label class="grammar-check-toggle">
          <input
            type="checkbox"
            data-editor-pref="grammarCheckEnabled"
            ${grammarCheckEnabled ? "checked" : ""}
            aria-label="Enable live grammar checking"
          />
          <span>Grammar check</span>
          <strong>${escapeHtml(grammarCheckToggleLabel)}</strong>
        </label>
        <button
          class="grammar-check-status"
          type="button"
          data-action="toggle-grammar-check-panel"
          aria-pressed="${grammarCheckPanelOpen ? "true" : "false"}"
          title="${escapeHtml(grammarCheckButtonTitle)}"
        >
          <strong>Grammar check</strong>
          <span>${escapeHtml(grammarCheckEnabled ? grammarCheckLabel : "Live off")}</span>
        </button>
      </div>
    </div>
    ${selectedScene ? renderSceneEditorHTML(selectedScene, {
      state,
      editorMode,
      grammarCheckSummary,
      projectIndex,
      buildEditorStyle,
      getInlinePassageDraftAnchor,
      formatChapterDisplayTitle,
    }) : ""}
  `;
}

export function renderSceneEditorHTML(scene, {
  state,
  editorMode,
  grammarCheckSummary,
  projectIndex,
  buildEditorStyle,
  getInlinePassageDraftAnchor,
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
  const narrationSelection = mode === "narration" && state.narrationTakeSelection?.sceneId === scene.sceneId
    ? state.narrationTakeSelection
    : null;
  const narrationSession = mode === "narration" ? state.narrationTakeSession : null;
  const inlineFormatRanges = normalizeInlineFormatRanges(
    state.sceneDrafts?.[scene.sceneId]?.inlineFormatRanges,
    String(scene.editorText ?? "").length,
  );
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

  return `
    <section
      class="scene-editor-shell ${mode === "narration" ? "narration-editor-shell" : ""} ${showRevisionHighlight ? "has-revision-preview" : ""}"
      data-scene-editor-scene-id="${escapeHtml(scene.sceneId)}"
    >
      <div class="scene-editor-context">
        <div class="scene-editor-context__chapter">
          <span>Chapter</span>
          <strong data-scene-editor-chapter-title="${escapeHtml(scene.chapterId)}">${escapeHtml(chapterTitle)}</strong>
        </div>
        <span class="scene-editor-context__count" data-scene-editor-chapter-word-count="${escapeHtml(scene.chapterId)}">${escapeHtml(`Chapter words: ${formatSceneEditorWordCount(chapterWordCount)}`)}</span>
      </div>
      <div class="scene-editor-header">
        <div class="editor-title-row">
          <input
            class="editor-title-input"
            type="text"
            value="${escapeHtml(scene.sceneTitle)}"
            data-edit-field="scene-title"
            data-scene-id="${escapeHtml(scene.sceneId)}"
            data-scene-title-id="${escapeHtml(scene.sceneId)}"
            aria-label="Scene title"
          />
          <button
            class="tag-button editor-action-button ai-title-button"
            type="button"
            data-action="suggest-scene-title"
            data-scene-id="${escapeHtml(scene.sceneId)}"
            ${state.localAiPrefs.enabled ? "" : "disabled"}
          >${localAiStatus === "loading" ? "Thinking..." : "Suggest title"}</button>
          ${localAiStatus && localAiStatus !== "loading" ? `<span class="local-ai-status">${escapeHtml(localAiStatus)}</span>` : ""}
        </div>
        <div class="scene-editor-tools ${mode === "narration" ? "narration-recording-tools" : ""}">
          ${mode === "narration"
            ? renderNarrationRecordingTools(scene, narrationSelection, narrationSession)
            : `
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
            `}
          ${hasDraft ? `<button class="tag-button editor-action-button" data-action="reset-scene-draft" data-scene-id="${escapeHtml(scene.sceneId)}">Revert local draft</button>` : ""}
        </div>
      </div>
      ${REVISION_DRAFTING_UI_ENABLED ? renderRevisionPanel(scene, state, revisionStats) : ""}

      <div
        class="scene-editor-codeframe ${mode === "narration" ? "narration-editor-frame" : ""} ${showRevisionHighlight ? "has-revision-preview" : ""}"
        data-scene-editor="${escapeHtml(scene.sceneId)}"
        style="${escapeHtml(buildEditorStyle())}"
      >
        <div class="editor-document-gutter" data-editor-gutter aria-hidden="true"></div>
        <div class="editor-document-body">
          <div class="editor-inline-format-layer" data-inline-format-layer aria-hidden="true">
            ${renderInlineFormatLayerContent(scene.editorText ?? "", inlineFormatRanges)}
          </div>
          <div class="editor-spellcheck-layer" data-spellcheck-layer aria-hidden="true"></div>
          <textarea
            class="editor-document-input ${showRevisionHighlight ? "has-revision-preview" : ""}"
            data-edit-field="editor-text"
            data-scene-id="${escapeHtml(scene.sceneId)}"
            spellcheck="false"
            lang="en-US"
            autocapitalize="off"
          >${escapeHtml(scene.editorText ?? "")}</textarea>
        </div>
        ${renderInlinePassageDraftHTML(scene, state, getInlinePassageDraftAnchor)}
      </div>
      <div class="scene-editor-footer">
        <span class="scene-editor-footer__selection" data-scene-editor-selection-word-count="${escapeHtml(scene.sceneId)}">${escapeHtml(formatSceneEditorSelectionWordCount(0))}</span>
        <span class="scene-editor-footer__scene" data-scene-editor-scene-word-count="${escapeHtml(scene.sceneId)}">${escapeHtml(`Scene words: ${formatSceneEditorWordCount(sceneWordCount)}`)}</span>
      </div>
    </section>
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
    : "What are you trying to convey here?";
}

function renderInlinePassageDraftHTML(scene, state, getInlinePassageDraftAnchor) {
  // Intent: render anchored note drafts beside the text they will attach to.
  const draft = state.inlinePassageDraft;
  if (!draft || draft.sceneId !== scene.sceneId) {
    return "";
  }

  const label = draft.noteType === "research" ? "Research" : "Inspiration";
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
      style="--inline-passage-y:${Math.round(draft.y)}px;"
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

function renderNarrationRecordingTools(scene, selection, session) {
  // Intent: expose narration-take controls without embedding recording runtime logic in the renderer.
  const statusLabel = session?.status === "recording"
    ? `Recording ${session.elapsedLabel ?? "0:00"}`
    : selection
      ? "Ready to record"
      : "Awaiting verse selection";
  const verseLabel = selection
    ? `Line ${String(selection.lineNumber ?? selection.blockLineNumber ?? "")} · ${selection.kindLabel ?? "Verse"}`
    : "Click a verse to arm recording";
  const trackerLabel = session?.trackerStatus
    ? session.trackerStatus
    : "Speech tracker idle";
  return `
    <div class="editor-inline-setting narration-recording-field">
      <span>Status</span>
      <div class="narration-recording-value ${session?.status === "recording" ? "is-recording" : ""}">${escapeHtml(statusLabel)}</div>
    </div>
    <div class="editor-inline-setting narration-recording-field">
      <span>Verse</span>
      <div class="narration-recording-value">${escapeHtml(verseLabel)}</div>
    </div>
    <div class="editor-inline-setting narration-recording-field">
      <span>Tracker</span>
      <div class="narration-recording-value">${escapeHtml(trackerLabel)}</div>
    </div>
    <div class="narration-recording-actions">
      <button
        class="tag-button editor-action-button"
        type="button"
        data-action="${session?.status === "recording" ? "stop-narration-recording" : "start-narration-recording"}"
        data-scene-id="${escapeHtml(scene.sceneId)}"
        ${session?.status === "recording" ? "" : selection ? "" : "disabled"}
      >
        ${session?.status === "recording" ? "Stop recording" : "Start recording"}
      </button>
      <button
        class="tag-button editor-action-button"
        type="button"
        data-action="clear-narration-selection"
        data-scene-id="${escapeHtml(scene.sceneId)}"
        ${selection && session?.status !== "recording" ? "" : "disabled"}
      >
        Clear verse
      </button>
    </div>
  `;
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
  const title = INLINE_FORMATS[formatId]?.label ?? label;
  return `
    <button
      class="tag-button editor-action-button editor-toggle-button inline-format-button inline-format-${escapeHtml(formatId)}"
      type="button"
      data-action="toggle-inline-format"
      data-inline-format="${escapeHtml(formatId)}"
      aria-pressed="${isActive ? "true" : "false"}"
      title="${escapeHtml(title)}"
    >${escapeHtml(label)}</button>
  `;
}

// Intent: render plain manuscript text with visual styling from range metadata without inserting tags into the manuscript body.
function renderInlineFormatLayerContent(text, ranges) {
  const normalizedText = String(text ?? "");
  const normalizedRanges = normalizeInlineFormatRanges(ranges, normalizedText.length);
  const boundaries = new Set([0, normalizedText.length]);
  for (const range of normalizedRanges) {
    boundaries.add(range.startOffset);
    boundaries.add(range.endOffset);
  }

  const offsets = [...boundaries].sort((left, right) => left - right);
  const parts = [];
  for (let index = 0; index < offsets.length - 1; index += 1) {
    const startOffset = offsets[index];
    const endOffset = offsets[index + 1];
    const segment = normalizedText.slice(startOffset, endOffset);
    if (!segment) {
      continue;
    }

    const activeFormats = normalizedRanges
      .filter((range) => range.startOffset <= startOffset && range.endOffset >= endOffset)
      .map((range) => range.formatId);
    const className = activeFormats.length
      ? ` class="${activeFormats.map((formatId) => `editor-inline-format-${escapeHtml(formatId)}`).join(" ")}"`
      : "";
    parts.push(`<span${className}>${escapeHtml(segment)}</span>`);
  }

  return `<div class="editor-inline-format-layer__content">${parts.join("")}</div>`;
}
