import {
  EDITOR_WIDTH_OPTIONS,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  LINE_HEIGHT_OPTIONS,
} from "../editor-model.js";
import { escapeHtml } from "../shared/ui-utils.js";

export function renderManuscriptPanelHTML({
  state,
  selectedScene,
  editorMode,
  buildEditorStyle,
  getInlinePassageDraftAnchor,
}) {
  return `
    <div class="panel-heading">
      <p class="panel-kicker">Scene Editor</p>
      <h2>Scene Editor Viewport</h2>
    </div>
    ${selectedScene ? renderSceneEditorHTML(selectedScene, {
      state,
      editorMode,
      buildEditorStyle,
      getInlinePassageDraftAnchor,
    }) : ""}
  `;
}

export function renderSceneEditorHTML(scene, {
  state,
  editorMode,
  buildEditorStyle,
  getInlinePassageDraftAnchor,
}) {
  const mode = editorMode === "narration" ? "narration" : "manuscript";
  const hasDraft = Boolean(state.sceneDrafts[scene.sceneId]);
  const localAiStatus = state.localAiTitleStatus[scene.sceneId];
  const narrationSelection = mode === "narration" && state.narrationTakeSelection?.sceneId === scene.sceneId
    ? state.narrationTakeSelection
    : null;
  const narrationSession = mode === "narration" ? state.narrationTakeSession : null;

  return `
    <section class="scene-editor-shell ${mode === "narration" ? "narration-editor-shell" : ""}">
      <div class="scene-editor-header">
        <div class="editor-title-row">
          <input
            class="editor-title-input"
            type="text"
            value="${escapeHtml(scene.sceneTitle)}"
            data-edit-field="scene-title"
            data-scene-id="${escapeHtml(scene.sceneId)}"
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
            `}
          ${hasDraft ? `<button class="tag-button editor-action-button" data-action="reset-scene-draft" data-scene-id="${escapeHtml(scene.sceneId)}">Revert local draft</button>` : ""}
        </div>
      </div>

      <div
        class="scene-editor-codeframe ${mode === "narration" ? "narration-editor-frame" : ""}"
        data-scene-editor="${escapeHtml(scene.sceneId)}"
        style="${escapeHtml(buildEditorStyle())}"
      >
        <div class="editor-document-gutter" data-editor-gutter aria-hidden="true"></div>
        <div class="editor-document-body">
          <textarea
            class="editor-document-input"
            data-edit-field="editor-text"
            data-scene-id="${escapeHtml(scene.sceneId)}"
            spellcheck="true"
          >${escapeHtml(scene.editorText ?? "")}</textarea>
        </div>
        ${renderInlinePassageDraftHTML(scene, state, getInlinePassageDraftAnchor)}
      </div>
    </section>
  `;
}

export function getPassageNotePlaceholder(noteType) {
  return noteType === "research"
    ? "Collect references, facts, and questions for this passage..."
    : "What are you trying to convey here?";
}

function renderInlinePassageDraftHTML(scene, state, getInlinePassageDraftAnchor) {
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
        <button class="tag-button" type="button" data-inline-passage-save data-action="commit-inline-passage-note">Save to typed verse</button>
      </div>
    </section>
  `;
}

function renderNarrationRecordingTools(scene, selection, session) {
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
