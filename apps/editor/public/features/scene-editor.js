// Intent: render the manuscript scene editor surface from editor state and feature-owned display inputs.
import {
  CUSTOM_HIGHLIGHT_COLOR_ID,
  EDITOR_WIDTH_OPTIONS,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  HIGHLIGHT_COLOR_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  resolveHighlightColorOption,
} from "../editor-model.js";
import {
  INLINE_FORMATS,
} from "./manuscript-editor/manuscript-command-controller.js";
import {
  selectManuscriptProjections,
} from "./manuscript-editor/projection-selector.js";
import { renderTextareaEditorHostHTML } from "../adapters/editor-host/textarea-editor-host.js";
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

// Intent: compose the manuscript panel around the selected scene content and feature-owned editor controls.
export function renderManuscriptPanelHTML({
  state,
  selectedScene,
  editorMode,
  grammarCheckSummary,
  projectIndex,
  buildEditorStyle,
  getInlinePassageDraftAnchor,
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
      formatChapterDisplayTitle,
    }) : ""}
  `;
}

// Intent: keep grammar checking as one compact manuscript-control cluster in the scene masthead.
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
  const manuscriptProjections = selectManuscriptProjections({
    projectId: state.workspace?.project?.id ?? "",
    sceneId: scene.sceneId,
    text: scene.editorText ?? "",
    sceneBlocks: scene.blocks,
    inlineFormatRanges: state.sceneDrafts?.[scene.sceneId]?.inlineFormatRanges,
    manuscriptMarks: state.workspace?.project?.marks,
    draftProofing: state.draftProofing,
    diagnosticIssues: state.workspace?.project?.issues,
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

  return `
    <section
      class="scene-editor-shell ${mode === "narration" ? "narration-editor-shell" : ""} ${showRevisionHighlight ? "has-revision-preview" : ""}"
      data-scene-editor-scene-id="${escapeHtml(scene.sceneId)}"
    >
      <div class="scene-editor-context">
        <strong data-scene-editor-chapter-title="${escapeHtml(scene.chapterId)}">${escapeHtml(chapterTitle)}</strong>
      </div>
      <div class="scene-editor-masthead">
        ${renderCompactGrammarCheck(state, grammarCheckSummary)}
        <input
          class="editor-title-input scene-editor-title-input"
          type="text"
          value="${escapeHtml(scene.sceneTitle)}"
          data-edit-field="scene-title"
          data-scene-id="${escapeHtml(scene.sceneId)}"
          data-scene-title-id="${escapeHtml(scene.sceneId)}"
          aria-label="Scene title"
        />
        <span class="scene-editor-context__count" data-scene-editor-chapter-word-count="${escapeHtml(scene.chapterId)}">${escapeHtml(`Chapter words: ${formatSceneEditorWordCount(chapterWordCount)}`)}</span>
      </div>
      <div class="scene-editor-header">
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
          ${localAiStatus && localAiStatus !== "loading" ? `<span class="local-ai-status">${escapeHtml(localAiStatus)}</span>` : ""}
          ${hasDraft ? `<button class="tag-button editor-action-button" data-action="reset-scene-draft" data-scene-id="${escapeHtml(scene.sceneId)}">Revert local draft</button>` : ""}
        </div>
      </div>
      ${renderHighlightColorPalette(state)}
      ${REVISION_DRAFTING_UI_ENABLED ? renderRevisionPanel(scene, state, revisionStats) : ""}

      <div
        class="scene-editor-codeframe ${mode === "narration" ? "narration-editor-frame" : ""} ${showRevisionHighlight ? "has-revision-preview" : ""}"
        data-scene-editor="${escapeHtml(scene.sceneId)}"
        style="${escapeHtml(buildEditorStyle())}"
      >
        <div class="editor-document-gutter" data-editor-gutter aria-hidden="true"></div>
        <div class="editor-document-body">
          ${renderTextareaEditorHostHTML({
            sceneId: scene.sceneId,
            text: scene.editorText ?? "",
            projections: manuscriptProjections,
            inputClassName: showRevisionHighlight ? "has-revision-preview" : "",
          })}
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
