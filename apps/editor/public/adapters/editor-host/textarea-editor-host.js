// Intent: adapt manuscript projections and commands to the current textarea-plus-overlay editor surface.
import {
  applyTextareaTextMutation,
  resolveTextareaManuscriptSelection,
} from "../../features/manuscript-editor/manuscript-command-controller.js";
import {
  MANUSCRIPT_PROJECTION_CHANNELS,
} from "../../features/manuscript-editor/projection-selector.js";
import {
  MANUSCRIPT_EDITOR_HOST_KIND,
  createManuscriptEditorHostSnapshot,
  selectManuscriptEditorHostChannel,
} from "../../features/manuscript-editor/editor-host-interface.js";
import { escapeHtml } from "../../shared/ui-utils.js";

const TEXTAREA_MIRRORED_STYLE_PROPERTIES = Object.freeze([
  "boxSizing",
  "direction",
  "font",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontVariant",
  "fontVariantLigatures",
  "fontWeight",
  "fontStretch",
  "fontKerning",
  "fontFeatureSettings",
  "fontVariationSettings",
  "letterSpacing",
  "lineHeight",
  "textAlign",
  "textIndent",
  "textRendering",
  "textTransform",
  "unicodeBidi",
  "whiteSpace",
  "wordBreak",
  "wordSpacing",
  "overflowWrap",
  "hyphens",
  "tabSize",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
]);

const TEXTAREA_OFFSET_MIRRORED_STYLE_PROPERTIES = Object.freeze([
  "borderBottomWidth",
  "borderLeftWidth",
  "borderRightWidth",
  "borderTopWidth",
  "boxSizing",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "overflowWrap",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "tabSize",
  "textIndent",
  "textTransform",
  "wordBreak",
  "wordSpacing",
]);

const narrationFollowLayerRenderCache = new WeakMap();

// Intent: keep the active compatibility host markup replaceable by a later editor implementation.
export function renderTextareaEditorHostHTML({
  sceneId = "",
  text = "",
  projections = [],
  inputClassName = "",
  draftProofBackdropColor = "",
  readOnly = false,
} = {}) {
  const snapshot = createManuscriptEditorHostSnapshot({ sceneId, text, projections });
  const hasAuthorMarks = selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK).length > 0;
  const inputClassNames = [
    inputClassName,
    hasAuthorMarks ? "has-inline-format-projection" : "",
  ].filter(Boolean).join(" ");
  const readOnlyAttribute = readOnly ? `readonly aria-readonly="true"` : "";
  const draftProofBackdropStyle = createDraftProofBackdropStyleAttribute(draftProofBackdropColor);
  const draftProofContent = renderTextareaProjectionContentShell(
    "editor-draft-proof-layer__content",
    renderTextareaDraftProofContent(snapshot),
  );
  const narrationRecordingContent = renderTextareaProjectionContentShell(
    "editor-narration-recording-layer__content",
    renderTextareaNarrationRecordingContent(snapshot),
  );
  const narrationFollowContent = renderTextareaProjectionContentShell(
    "editor-narration-follow-layer__content",
    renderTextareaNarrationFollowContent(snapshot),
  );
  const diagnosticContent = renderTextareaProjectionContentShell(
    "editor-diagnostic-layer__content",
    renderTextareaDiagnosticContent(snapshot),
  );
  return `
    <div class="editor-draft-proof-layer" data-draft-proof-layer aria-hidden="true"${draftProofBackdropStyle}>${draftProofContent}</div>
    <div class="editor-narration-recording-layer" data-narration-recording-layer aria-hidden="true">${narrationRecordingContent}</div>
    <div class="editor-narration-follow-layer" data-narration-follow-layer aria-hidden="true">${narrationFollowContent}</div>
    <div class="editor-inline-format-layer" data-inline-format-layer aria-hidden="true">
      ${renderTextareaAuthorMarkContent(snapshot)}
    </div>
    <div class="editor-diagnostic-layer" data-diagnostic-layer aria-hidden="true">${diagnosticContent}</div>
    <div class="editor-spellcheck-layer" data-spellcheck-layer aria-hidden="true"></div>
    <textarea
      class="editor-document-input ${escapeHtml(inputClassNames)}"
      data-edit-field="editor-text"
      data-scene-id="${escapeHtml(snapshot.sceneId)}"
      spellcheck="false"
      lang="en-US"
      autocapitalize="off"
      ${readOnlyAttribute}
    >${escapeHtml(snapshot.text)}</textarea>
  `;
}

// Intent: expose the textarea as a capability adapter instead of making feature commands depend on DOM structure.
export function resolveTextareaEditorHost(target) {
  const textarea = resolveTextareaElement(target);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return null;
  }

  const body = textarea.closest(".editor-document-body");
  const codeframe = textarea.closest(".scene-editor-codeframe");
  const manuScriptInfographicLane = codeframe?.querySelector("[data-editor-manuscript-infographic-lane]") ?? null;
  return {
    kind: MANUSCRIPT_EDITOR_HOST_KIND.TEXTAREA_OVERLAY,
    textarea,
    sceneId: String(textarea.dataset.sceneId ?? ""),
    manuScriptInfographicLane,
    manuScriptInfographicLaneTrack: manuScriptInfographicLane?.querySelector("[data-manuscript-infographic-lane-track]") ?? null,
    draftProofLayer: body?.querySelector("[data-draft-proof-layer]") ?? null,
    narrationRecordingLayer: body?.querySelector("[data-narration-recording-layer]") ?? null,
    narrationFollowLayer: body?.querySelector("[data-narration-follow-layer]") ?? null,
    inlineFormatLayer: body?.querySelector("[data-inline-format-layer]") ?? null,
    diagnosticLayer: body?.querySelector("[data-diagnostic-layer]") ?? null,
    spellcheckLayer: body?.querySelector("[data-spellcheck-layer]") ?? null,
    readSelection(formatRanges = []) {
      return resolveTextareaManuscriptSelection(textarea, formatRanges);
    },
    applyTextMutation(mutation) {
      return applyTextareaTextMutation(textarea, mutation);
    },
  };
}

// Intent: expose host focus as an adapter capability so shell code does not depend on textarea APIs.
export function focusTextareaEditorHost(host, { preventScroll = true } = {}) {
  if (!(host?.textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  try {
    host.textarea.focus({ preventScroll });
  } catch {
    host.textarea.focus();
  }
  return true;
}

// Intent: capture only host-owned selection and viewport details for higher-level manuscript policies.
export function readTextareaEditorHostSelection(host) {
  if (!(host?.textarea instanceof HTMLTextAreaElement)) {
    return null;
  }

  const codeframe = host.textarea.closest(".scene-editor-codeframe");
  const startOffset = Number.isInteger(host.textarea.selectionStart) ? host.textarea.selectionStart : 0;
  const endOffset = Number.isInteger(host.textarea.selectionEnd) ? host.textarea.selectionEnd : startOffset;
  return {
    sceneId: String(host.textarea.dataset.sceneId ?? ""),
    text: host.textarea.value,
    startOffset: Math.min(startOffset, endOffset),
    endOffset: Math.max(startOffset, endOffset),
    scrollTop: codeframe instanceof HTMLElement ? codeframe.scrollTop : null,
    scrollLeft: codeframe instanceof HTMLElement ? codeframe.scrollLeft : null,
  };
}

export function captureTextareaEditorHostBookmark(host) {
  const selection = readTextareaEditorHostSelection(host);
  if (!selection?.sceneId) {
    return null;
  }

  return {
    sceneId: selection.sceneId,
    selectionStart: selection.startOffset,
    selectionEnd: selection.endOffset,
    codeframeScrollTop: Number.isFinite(selection.scrollTop) ? selection.scrollTop : 0,
    codeframeScrollLeft: Number.isFinite(selection.scrollLeft) ? selection.scrollLeft : 0,
  };
}

export function captureTextareaEditorHostViewport(host) {
  const selection = readTextareaEditorHostSelection(host);
  if (!(host?.textarea instanceof HTMLTextAreaElement) || !selection) {
    return null;
  }

  return {
    wasFocused: document.activeElement === host.textarea,
    selectionStart: selection.startOffset,
    selectionEnd: selection.endOffset,
    selectionDirection: host.textarea.selectionDirection,
    scrollTop: selection.scrollTop,
    scrollLeft: selection.scrollLeft,
  };
}

export function restoreTextareaEditorHostViewport(host, viewport) {
  if (!(host?.textarea instanceof HTMLTextAreaElement) || !viewport) {
    return false;
  }

  if (viewport.wasFocused) {
    focusTextareaEditorHost(host, { preventScroll: true });
  }

  const safeStart = clampTextareaOffset(
    Number.isInteger(viewport.selectionStart) ? viewport.selectionStart : host.textarea.selectionStart,
    host.textarea.value.length,
  );
  const safeEnd = clampTextareaOffset(
    Number.isInteger(viewport.selectionEnd) ? viewport.selectionEnd : host.textarea.selectionEnd,
    host.textarea.value.length,
  );
  try {
    host.textarea.setSelectionRange(safeStart, safeEnd, viewport.selectionDirection ?? "forward");
  } catch {
    host.textarea.setSelectionRange(Math.min(safeStart, safeEnd), Math.max(safeStart, safeEnd));
  }

  const codeframe = host.textarea.closest(".scene-editor-codeframe");
  if (codeframe instanceof HTMLElement) {
    codeframe.scrollTop = Math.max(0, viewport.scrollTop ?? 0);
    codeframe.scrollLeft = Math.max(0, viewport.scrollLeft ?? 0);
  }
  return true;
}

export function restoreTextareaEditorHostBookmark(host, bookmark, { focus = false } = {}) {
  if (!(host?.textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const codeframe = host.textarea.closest(".scene-editor-codeframe");
  if (codeframe instanceof HTMLElement) {
    codeframe.scrollTo({
      left: Math.max(0, Number(bookmark?.codeframeScrollLeft) || 0),
      top: Math.max(0, Number(bookmark?.codeframeScrollTop) || 0),
    });
  }

  return Boolean(selectTextareaEditorHostRange(
    host,
    Number(bookmark?.selectionStart),
    Number(bookmark?.selectionEnd),
    { focus, scroll: false },
  ));
}

export function selectTextareaEditorHostRange(
  host,
  startOffset,
  endOffset = startOffset,
  { focus = true, scroll = false, behavior = "auto" } = {},
) {
  if (!(host?.textarea instanceof HTMLTextAreaElement)) {
    return null;
  }

  const safeStart = clampTextareaOffset(startOffset, host.textarea.value.length);
  const safeEnd = clampTextareaOffset(endOffset, host.textarea.value.length);
  const selectionStart = Math.min(safeStart, safeEnd);
  const selectionEnd = Math.max(safeStart, safeEnd);
  if (focus) {
    focusTextareaEditorHost(host, { preventScroll: true });
  }
  host.textarea.setSelectionRange(selectionStart, selectionEnd, "forward");
  if (scroll) {
    scrollTextareaEditorHostToOffset(host, selectionStart, { behavior });
  }
  return {
    startOffset: selectionStart,
    endOffset: selectionEnd,
  };
}

export function scrollTextareaEditorHostToSelection(host, options = {}) {
  const selection = readTextareaEditorHostSelection(host);
  if (!selection) {
    return false;
  }

  return scrollTextareaEditorHostToOffset(host, selection.startOffset, options);
}

export function scrollTextareaEditorHostToOffset(host, offset, options = {}) {
  if (!(host?.textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const codeframe = host.textarea.closest(".scene-editor-codeframe");
  if (!(codeframe instanceof HTMLElement)) {
    return false;
  }

  const metrics = getTextareaEditorHostWrapMetrics(host);
  const body = host.textarea.closest(".editor-document-body");
  const bodyStyle = body instanceof HTMLElement ? window.getComputedStyle(body) : null;
  const paddingTop = bodyStyle ? parseFloat(bodyStyle.paddingTop || "0") : 0;
  const measuredOffsetTop = measureTextareaOffsetTop(host.textarea, offset);
  const visualLine = estimateTextareaVisualLineBeforeOffset(
    host.textarea.value,
    offset,
    metrics.charactersPerLine,
  );
  const offsetTop = Number.isFinite(measuredOffsetTop)
    ? measuredOffsetTop
    : visualLine * metrics.lineHeight;
  const targetTop = paddingTop + offsetTop - codeframe.clientHeight / 2 + metrics.lineHeight;
  const maxScrollTop = Math.max(0, codeframe.scrollHeight - codeframe.clientHeight);
  const top = Math.max(0, Math.min(maxScrollTop, targetTop));

  codeframe.scrollTo({
    top,
    behavior: options.behavior ?? "auto",
  });
  return true;
}

export function getTextareaEditorHostWrapMetrics(host) {
  if (!(host?.textarea instanceof HTMLTextAreaElement)) {
    return {
      lineHeight: 1,
      fontSize: 16,
      charactersPerLine: 80,
    };
  }

  const style = window.getComputedStyle(host.textarea);
  const lineHeight = parseFloat(style.lineHeight || "0") || 1;
  const fontSize = parseFloat(style.fontSize || "0") || 16;
  const approximateCharacterWidth = Math.max(6, fontSize * 0.56);
  const contentWidth = resolveTextareaEditorHostContentWidth({
    clientWidth: host.textarea.clientWidth,
    paddingLeft: style.paddingLeft,
    paddingRight: style.paddingRight,
  });
  return {
    lineHeight,
    fontSize,
    charactersPerLine: Math.max(8, Math.floor(contentWidth / approximateCharacterWidth)),
  };
}

export function resolveTextareaVisualLineIndexForOffset(host, offset) {
  if (!(host?.textarea instanceof HTMLTextAreaElement)) {
    return 0;
  }

  const metrics = getTextareaEditorHostWrapMetrics(host);
  const measuredOffsetTop = measureTextareaOffsetTop(host.textarea, offset);
  if (Number.isFinite(measuredOffsetTop) && metrics.lineHeight > 0) {
    const style = window.getComputedStyle(host.textarea);
    const paddingTop = parseFloat(style.paddingTop || "0") || 0;
    return Math.max(0, Math.round(Math.max(0, measuredOffsetTop - paddingTop) / metrics.lineHeight));
  }

  return estimateTextareaVisualLineBeforeOffset(
    host.textarea.value,
    offset,
    metrics.charactersPerLine,
  );
}

// Intent: distinguish the full native hit target from the centered manuscript text measure.
export function resolveTextareaEditorHostContentWidth({
  clientWidth = 0,
  paddingLeft = 0,
  paddingRight = 0,
} = {}) {
  const safeClientWidth = normalizeNonNegativeDimension(clientWidth);
  const horizontalPadding =
    normalizeNonNegativeDimension(paddingLeft) +
    normalizeNonNegativeDimension(paddingRight);
  const contentWidth = safeClientWidth - horizontalPadding;
  return contentWidth > 0 ? contentWidth : safeClientWidth;
}

// Intent: paint active draft proof-read coverage as a low-strength underlay below author marks.
export function renderTextareaDraftProofLayer(host, snapshot) {
  const layer = getTextareaProjectionLayer(host, MANUSCRIPT_PROJECTION_CHANNELS.DRAFT_PROOF);
  if (!(layer instanceof HTMLElement) || !(host?.textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const normalizedSnapshot = createManuscriptEditorHostSnapshot(snapshot);
  const backdropColor = normalizeCssHexColor(snapshot?.draftProofBackdropColor);
  if (backdropColor) {
    layer.style.setProperty("--editor-draft-proof-backdrop-color", backdropColor);
  } else {
    layer.style.removeProperty("--editor-draft-proof-backdrop-color");
  }
  layer.innerHTML = renderTextareaProjectionContentShell(
    "editor-draft-proof-layer__content",
    renderTextareaDraftProofContent(normalizedSnapshot),
  );
  const content = layer.querySelector(".editor-draft-proof-layer__content");
  if (content instanceof HTMLElement) {
    syncTextareaMirroredLayerStyle(content, host.textarea);
  }
  return true;
}

// Intent: repaint saved narration takes as durable but render-only manuscript coverage.
export function renderTextareaNarrationRecordingLayer(host, snapshot) {
  const layer = getTextareaProjectionLayer(host, MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_RECORDING);
  if (!(layer instanceof HTMLElement) || !(host?.textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const normalizedSnapshot = createManuscriptEditorHostSnapshot(snapshot);
  layer.innerHTML = renderTextareaProjectionContentShell(
    "editor-narration-recording-layer__content",
    renderTextareaNarrationRecordingContent(normalizedSnapshot),
  );
  const content = layer.querySelector(".editor-narration-recording-layer__content");
  if (content instanceof HTMLElement) {
    syncTextareaMirroredLayerStyle(content, host.textarea);
  }
  return true;
}

// Intent: repaint the live narration-follow cursor as a render-only overlay rather than native textarea selection.
export function renderTextareaNarrationFollowLayer(host, snapshot) {
  const layer = getTextareaProjectionLayer(host, MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW);
  if (!(layer instanceof HTMLElement) || !(host?.textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const normalizedSnapshot = createManuscriptEditorHostSnapshot(snapshot);
  const renderSignature = [
    createNarrationFollowLayerRenderSignature(normalizedSnapshot),
    Math.round(host.textarea.clientWidth),
    Math.round(host.textarea.scrollHeight),
  ].join(";");
  const cachedRender = narrationFollowLayerRenderCache.get(layer);
  if (cachedRender?.signature === renderSignature && cachedRender.text === normalizedSnapshot.text) {
    return false;
  }

  layer.innerHTML = renderTextareaProjectionContentShell(
    "editor-narration-follow-layer__content",
    renderTextareaNarrationFollowContent(normalizedSnapshot),
  );
  narrationFollowLayerRenderCache.set(layer, {
    signature: renderSignature,
    text: normalizedSnapshot.text,
  });
  const content = layer.querySelector(".editor-narration-follow-layer__content");
  if (content instanceof HTMLElement) {
    syncTextareaMirroredLayerStyle(content, host.textarea);
  }
  return true;
}

// Intent: repaint durable author marks as a disposable textarea overlay after shell layout changes.
export function renderTextareaAuthorMarkLayer(host, snapshot) {
  const layer = getTextareaProjectionLayer(host, MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK);
  if (!(layer instanceof HTMLElement) || !(host?.textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const normalizedSnapshot = createManuscriptEditorHostSnapshot(snapshot);
  layer.innerHTML = renderTextareaAuthorMarkContent(normalizedSnapshot);
  const content = layer.querySelector(".editor-inline-format-layer__content");
  if (content instanceof HTMLElement) {
    const hasAuthorMarks = selectManuscriptEditorHostChannel(normalizedSnapshot, MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK).length > 0;
    syncTextareaMirroredLayerStyle(content, host.textarea);
    content.classList.toggle("has-inline-format-projection", hasAuthorMarks);
    content.style.color = "";
    host.textarea.classList.toggle("has-inline-format-projection", hasAuthorMarks);
  }
  return true;
}

// Intent: paint accepted anchor-backed issues as disposable manuscript diagnostics below editable text.
export function renderTextareaDiagnosticLayer(host, snapshot) {
  const layer = getTextareaProjectionLayer(host, MANUSCRIPT_PROJECTION_CHANNELS.DIAGNOSTIC);
  if (!(layer instanceof HTMLElement) || !(host?.textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const normalizedSnapshot = createManuscriptEditorHostSnapshot(snapshot);
  layer.innerHTML = renderTextareaProjectionContentShell(
    "editor-diagnostic-layer__content",
    renderTextareaDiagnosticContent(normalizedSnapshot),
  );
  const content = layer.querySelector(".editor-diagnostic-layer__content");
  if (content instanceof HTMLElement) {
    syncTextareaMirroredLayerStyle(content, host.textarea);
  }
  return true;
}

// Intent: paint durable world and custom metadata anchors in the ManuScriptInfographicLane track.
export function renderTextareaManuScriptInfographicLane(host, snapshot, {
  charactersPerLine,
  visualLineCount,
} = {}) {
  const track = resolveManuScriptInfographicLaneTrack(host);
  if (!(track instanceof HTMLElement) || !(host?.textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const normalizedSnapshot = createManuscriptEditorHostSnapshot(snapshot);
  track.innerHTML = renderTextareaManuScriptInfographicLaneContent(normalizedSnapshot, {
    charactersPerLine,
    visualLineCount,
  });
  return true;
}

export function clearTextareaProjectionLayer(host, channel) {
  const layer = getTextareaProjectionLayer(host, channel);
  if (!(layer instanceof HTMLElement)) {
    return false;
  }

  if (channel === MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW) {
    narrationFollowLayerRenderCache.delete(layer);
  }
  // Intent: a cleared author-mark overlay must restore the native text layer as the readable source.
  if (channel === MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK && host?.textarea instanceof HTMLTextAreaElement) {
    host.textarea.classList.remove("has-inline-format-projection");
  }
  layer.innerHTML = "";
  return true;
}

export function renderTextareaSpellcheckLayer(host, snapshot) {
  const layer = getTextareaProjectionLayer(host, MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK);
  if (!(layer instanceof HTMLElement) || !(host?.textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const normalizedSnapshot = createManuscriptEditorHostSnapshot(snapshot);
  layer.innerHTML = renderTextareaProjectionContentShell(
    "editor-spellcheck-layer__content",
    renderTextareaSpellcheckContent(normalizedSnapshot),
  );
  const content = layer.querySelector(".editor-spellcheck-layer__content");
  if (content instanceof HTMLElement) {
    syncTextareaMirroredLayerStyle(content, host.textarea);
  }
  return true;
}

export function syncTextareaSpellcheckTypingState(host, activeTypingWordRange) {
  const layer = getTextareaProjectionLayer(host, MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK);
  const content = layer?.querySelector(".editor-spellcheck-layer__content");
  if (!(content instanceof HTMLElement)) {
    return;
  }

  content.querySelectorAll(".editor-spellcheck-word.is-typing-active").forEach((word) => {
    word.classList.remove("is-typing-active");
  });

  const startOffset = Number(activeTypingWordRange?.startOffset);
  const endOffset = Number(activeTypingWordRange?.endOffset);
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset)) {
    return;
  }

  const activeWord = content.querySelector(
    `.editor-spellcheck-word[data-spellcheck-start="${startOffset}"][data-spellcheck-end="${endOffset}"]`,
  );
  if (activeWord instanceof HTMLElement) {
    activeWord.classList.add("is-typing-active");
  }
}

// Intent: use the compatibility host's native selection glow for one active anchored-record preview.
export function showTextareaAnchoredRecordPreview(host, projection, { focus = true } = {}) {
  if (!(host?.textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const snapshot = createManuscriptEditorHostSnapshot({
    sceneId: host.sceneId,
    text: host.textarea.value,
    projections: [projection],
  });
  const normalizedProjection = snapshot.projections[0];
  if (
    !normalizedProjection ||
    ![MANUSCRIPT_PROJECTION_CHANNELS.TASK, MANUSCRIPT_PROJECTION_CHANNELS.NOTE].includes(normalizedProjection.channel)
  ) {
    return false;
  }

  clearTextareaAnchoredRecordPreview(host);
  const styleToken = normalizedProjection.styleToken === "research" ? "research"
    : normalizedProjection.styleToken === "inspiration" ? "inspiration"
      : normalizedProjection.styleToken === "metadata" ? "metadata"
        : "task";
  host.textarea.classList.add("has-task-preview");
  if (normalizedProjection.channel === MANUSCRIPT_PROJECTION_CHANNELS.NOTE) {
    host.textarea.classList.add("has-passage-note-preview", `has-${styleToken}-preview`);
    applyCustomMetadataPreviewStyle(host.textarea, normalizedProjection);
  }

  const codeframe = host.textarea.closest(".scene-editor-codeframe");
  if (codeframe instanceof HTMLElement) {
    codeframe.classList.add("is-task-previewing");
    if (normalizedProjection.channel === MANUSCRIPT_PROJECTION_CHANNELS.NOTE) {
      codeframe.classList.add("is-passage-note-previewing", `is-${styleToken}-previewing`);
      applyCustomMetadataPreviewStyle(codeframe, normalizedProjection);
    }
  }

  selectTextareaEditorHostRange(host, normalizedProjection.startOffset, normalizedProjection.endOffset, {
    focus,
    scroll: false,
  });
  return true;
}

// Intent: render an active search or narration range as transient host selection state only.
export function showTextareaRuntimeSelectionPreview(host, projection, { focus = true, scroll = false, behavior = "auto" } = {}) {
  if (!(host?.textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const snapshot = createManuscriptEditorHostSnapshot({
    sceneId: host.sceneId,
    text: host.textarea.value,
    projections: [projection],
  });
  const normalizedProjection = snapshot.projections[0];
  if (
    !normalizedProjection ||
    ![MANUSCRIPT_PROJECTION_CHANNELS.SEARCH, MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW].includes(normalizedProjection.channel)
  ) {
    return false;
  }

  clearTextareaRuntimeSelectionPreview(host);
  const isSearch = normalizedProjection.channel === MANUSCRIPT_PROJECTION_CHANNELS.SEARCH;
  const classToken = isSearch ? "search" : "narration";
  host.textarea.classList.add(`has-${classToken}-preview`);
  const codeframe = host.textarea.closest(".scene-editor-codeframe");
  if (codeframe instanceof HTMLElement) {
    codeframe.classList.add(`is-${classToken}-previewing`);
  }

  selectTextareaEditorHostRange(host, normalizedProjection.startOffset, normalizedProjection.endOffset, {
    focus,
    scroll,
    behavior,
  });
  return true;
}

export function clearTextareaRuntimeSelectionPreview(host) {
  if (!(host?.textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  host.textarea.classList.remove("has-search-preview", "has-narration-preview");
  host.textarea.closest(".scene-editor-codeframe")?.classList.remove(
    "is-search-previewing",
    "is-narration-previewing",
  );
  return true;
}

export function clearTextareaAnchoredRecordPreview(host) {
  if (!(host?.textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  host.textarea.classList.remove(
    "has-task-preview",
    "has-passage-note-preview",
    "has-inspiration-preview",
    "has-research-preview",
    "has-metadata-preview",
  );
  clearCustomMetadataPreviewStyle(host.textarea);
  host.textarea.closest(".scene-editor-codeframe")?.classList.remove(
    "is-task-previewing",
    "is-passage-note-previewing",
    "is-inspiration-previewing",
    "is-research-previewing",
    "is-metadata-previewing",
  );
  clearCustomMetadataPreviewStyle(host.textarea.closest(".scene-editor-codeframe"));
  return true;
}

function applyCustomMetadataPreviewStyle(element, projection) {
  if (!(element instanceof HTMLElement) || projection?.styleToken !== "metadata") {
    return;
  }

  const visualStyle = projection.visualStyle && typeof projection.visualStyle === "object"
    ? projection.visualStyle
    : {};
  if (typeof visualStyle.highlightColor === "string" && visualStyle.highlightColor.trim()) {
    element.style.setProperty("--metadata-preview-bg", visualStyle.highlightColor);
  }
  if (typeof visualStyle.highlightShadow === "string" && visualStyle.highlightShadow.trim()) {
    element.style.setProperty("--metadata-preview-shadow", visualStyle.highlightShadow);
  }
  if (typeof visualStyle.highlightOutline === "string" && visualStyle.highlightOutline.trim()) {
    element.style.setProperty("--metadata-preview-outline", visualStyle.highlightOutline);
  }
}

function clearCustomMetadataPreviewStyle(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.style.removeProperty("--metadata-preview-bg");
  element.style.removeProperty("--metadata-preview-shadow");
  element.style.removeProperty("--metadata-preview-outline");
}

// Intent: prevent template indentation from becoming rendered text in pre-wrapped overlay mirrors.
function renderTextareaProjectionContentShell(className, content = "") {
  return `<div class="${className}">${String(content ?? "")}</div>`;
}

function createNarrationFollowLayerRenderSignature(snapshot) {
  const projections = selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW);
  return [
    String(snapshot?.sceneId ?? ""),
    String(snapshot?.text ?? "").length,
    projections
      .map((projection) => [
        projection.startOffset,
        projection.endOffset,
        projection.styleToken,
      ].join(":"))
      .join("|"),
  ].join(";");
}

export function renderTextareaAuthorMarkContent(snapshot) {
  const text = String(snapshot?.text ?? "");
  const projections = selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK);
  const hasAuthorMarks = projections.length > 0;
  const boundaries = new Set([0, text.length]);
  for (const projection of projections) {
    boundaries.add(projection.startOffset);
    boundaries.add(projection.endOffset);
  }

  const offsets = [...boundaries].sort((left, right) => left - right);
  const parts = [];
  for (let index = 0; index < offsets.length - 1; index += 1) {
    const startOffset = offsets[index];
    const endOffset = offsets[index + 1];
    const segment = text.slice(startOffset, endOffset);
    if (!segment) {
      continue;
    }

    const activeProjections = projections
      .filter((projection) => projection.startOffset <= startOffset && projection.endOffset >= endOffset);
    const activeTokens = activeProjections.map((projection) => projection.styleToken);
    const className = activeTokens.length
      ? ` class="${activeTokens.map((token) => `editor-inline-format-${escapeHtml(token)}`).join(" ")}"`
      : "";
    const inlineStyle = createAuthorMarkSegmentStyle(activeProjections);
    const styleAttribute = inlineStyle ? ` style="${escapeHtml(inlineStyle)}"` : "";
    parts.push(`<span${className}${styleAttribute}>${renderAuthorMarkSegmentText(segment, activeTokens)}</span>`);
  }

  return `<div class="editor-inline-format-layer__content${hasAuthorMarks ? " has-inline-format-projection" : ""}">${parts.join("")}</div>`;
}

export function renderTextareaDraftProofContent(snapshot) {
  const text = String(snapshot?.text ?? "");
  const projections = selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.DRAFT_PROOF);
  const boundaries = new Set([0, text.length]);
  for (const projection of projections) {
    boundaries.add(projection.startOffset);
    boundaries.add(projection.endOffset);
  }

  const offsets = [...boundaries].sort((left, right) => left - right);
  const parts = [];
  for (let index = 0; index < offsets.length - 1; index += 1) {
    const startOffset = offsets[index];
    const endOffset = offsets[index + 1];
    const segment = text.slice(startOffset, endOffset);
    if (!segment) {
      continue;
    }

    const activeProjection = projections.find((projection) =>
      projection.startOffset <= startOffset && projection.endOffset >= endOffset
    );
    if (!activeProjection) {
      parts.push(escapeHtml(segment));
      continue;
    }

    const styleAttribute = createDraftProofRangeStyleAttribute(activeProjection);
    parts.push(renderTextareaDraftProofRangeSegment(segment, styleAttribute));
  }

  return parts.join("");
}

export function renderTextareaNarrationRecordingContent(snapshot) {
  const text = String(snapshot?.text ?? "");
  const projections = selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_RECORDING);
  const boundaries = new Set([0, text.length]);
  for (const projection of projections) {
    boundaries.add(projection.startOffset);
    boundaries.add(projection.endOffset);
  }

  const offsets = [...boundaries].sort((left, right) => left - right);
  const parts = [];
  for (let index = 0; index < offsets.length - 1; index += 1) {
    const startOffset = offsets[index];
    const endOffset = offsets[index + 1];
    const segment = text.slice(startOffset, endOffset);
    if (!segment) {
      continue;
    }

    const activeProjection = projections.find((projection) =>
      projection.startOffset <= startOffset && projection.endOffset >= endOffset
    );
    if (!activeProjection) {
      parts.push(escapeHtml(segment));
      continue;
    }

    const rangeClassName = activeProjection.styleToken === "narration-recording-active"
      ? "editor-narration-recording-range editor-narration-recording-range--active"
      : "editor-narration-recording-range";
    parts.push(`<span class="${rangeClassName}">${escapeHtml(segment)}</span>`);
  }

  return parts.join("");
}

export function renderTextareaNarrationFollowContent(snapshot) {
  const text = String(snapshot?.text ?? "");
  const projections = selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW);
  const boundaries = new Set([0, text.length]);
  for (const projection of projections) {
    boundaries.add(projection.startOffset);
    boundaries.add(projection.endOffset);
  }

  const offsets = [...boundaries].sort((left, right) => left - right);
  const parts = [];
  for (let index = 0; index < offsets.length - 1; index += 1) {
    const startOffset = offsets[index];
    const endOffset = offsets[index + 1];
    const segment = text.slice(startOffset, endOffset);
    if (!segment) {
      continue;
    }

    const activeProjections = projections.filter((projection) =>
      projection.startOffset <= startOffset && projection.endOffset >= endOffset
    );
    if (!activeProjections.length) {
      parts.push(escapeHtml(segment));
      continue;
    }

    const rangeClassName = getNarrationFollowRangeClassName(activeProjections);
    parts.push(`<span class="${rangeClassName}">${escapeHtml(segment)}</span>`);
  }

  return parts.join("");
}

// Intent: paint the current spoken words above the softer already-read coverage when ranges overlap.
function getNarrationFollowRangeClassName(activeProjections) {
  const projections = Array.isArray(activeProjections) ? activeProjections : [];
  const selectedProjection = projections.find((projection) => projection?.styleToken === "narration-follow-current")
    ?? projections.find((projection) => projection?.styleToken === "narration-follow-read")
    ?? projections[0]
    ?? null;
  const styleToken = selectedProjection?.styleToken;
  if (styleToken === "narration-follow-current") {
    return "editor-narration-follow-range editor-narration-follow-current-range";
  }

  if (styleToken === "narration-follow-read") {
    return "editor-narration-follow-range editor-narration-follow-read-range";
  }

  return "editor-narration-follow-range";
}

function createAuthorMarkSegmentStyle(activeProjections) {
  const highlightProjection = activeProjections.find((projection) =>
    projection?.styleToken === "highlight" &&
    typeof projection?.visualStyle?.highlightColor === "string" &&
    typeof projection?.visualStyle?.highlightOutline === "string",
  );
  if (!highlightProjection) {
    return "";
  }

  return [
    `--editor-mark-highlight-color:${highlightProjection.visualStyle.highlightColor}`,
    `--editor-mark-highlight-outline:${highlightProjection.visualStyle.highlightOutline}`,
  ].join("; ");
}

function createDraftProofBackdropStyleAttribute(value) {
  const color = normalizeCssHexColor(value);
  return color ? ` style="--editor-draft-proof-backdrop-color:${escapeHtml(color)};"` : "";
}

function createDraftProofRangeStyleAttribute(projection) {
  const declarations = [];
  const color = normalizeCssHexColor(projection?.visualStyle?.backdropColor);
  if (color) {
    declarations.push(`--editor-draft-proof-backdrop-color:${color}`);
  }

  const intensityByTheme = projection?.visualStyle?.highlightIntensityByTheme &&
    typeof projection.visualStyle.highlightIntensityByTheme === "object"
    ? projection.visualStyle.highlightIntensityByTheme
    : {};
  appendDraftProofIntensityDeclarations(declarations, "light", intensityByTheme.light);
  appendDraftProofIntensityDeclarations(declarations, "dark", intensityByTheme.dark);

  return declarations.length ? ` style="${escapeHtml(declarations.join(";"))};"` : "";
}

function appendDraftProofIntensityDeclarations(declarations, theme, value) {
  const intensity = normalizeCssPercentageNumber(value);
  if (intensity === null) {
    return;
  }

  const outlineRatio = theme === "dark" ? 1 : 0.62;
  const edgeRatio = theme === "dark" ? 0.72 : 0.57;
  declarations.push(
    `--editor-draft-proof-${theme}-fill-strength:${intensity}%`,
    `--editor-draft-proof-${theme}-outline-strength:${Math.round(intensity * outlineRatio)}%`,
    `--editor-draft-proof-${theme}-edge-strength:${Math.round(intensity * edgeRatio)}%`,
  );
}

function normalizeCssPercentageNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.max(0, Math.min(Math.round(number), 100));
}

// Intent: keep proof-read paint off hard returns so blank paragraph separators do not look vertically offset.
function renderTextareaDraftProofRangeSegment(segment, styleAttribute = "") {
  return String(segment ?? "")
    .split(/(\n)/)
    .map((part) => {
      if (part === "\n") {
        return "\n";
      }
      if (!part) {
        return "";
      }
      return `<span class="editor-draft-proof-range"${styleAttribute}>${escapeHtml(part)}</span>`;
    })
    .join("");
}

function normalizeCssHexColor(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  const match = raw.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) {
    return "";
  }

  const hex = match[1].toLowerCase();
  if (hex.length === 3) {
    return `#${hex.split("").map((character) => `${character}${character}`).join("")}`;
  }

  return `#${hex}`;
}

// Intent: render italic marks with a normal-width layout token and a true italic paint layer.
function renderAuthorMarkSegmentText(segment, activeTokens = []) {
  const value = String(segment ?? "");
  if (!activeTokens.includes("italic")) {
    return escapeHtml(value);
  }

  return value
    .split(/(\s+)/)
    .map((token) => {
      if (!token || /^\s+$/.test(token)) {
        return escapeHtml(token);
      }

      const escapedToken = escapeHtml(token);
      return `<span class="editor-inline-format-italic-token" data-italic-text="${escapedToken}">${escapedToken}</span>`;
    })
    .join("");
}

export function renderTextareaDiagnosticContent(snapshot) {
  const text = String(snapshot?.text ?? "");
  const projections = selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.DIAGNOSTIC);
  const boundaries = new Set([0, text.length]);
  for (const projection of projections) {
    boundaries.add(projection.startOffset);
    boundaries.add(projection.endOffset);
  }

  const offsets = [...boundaries].sort((left, right) => left - right);
  const parts = [];
  for (let index = 0; index < offsets.length - 1; index += 1) {
    const startOffset = offsets[index];
    const endOffset = offsets[index + 1];
    const segment = text.slice(startOffset, endOffset);
    if (!segment) {
      continue;
    }

    const activeProjection = selectVisibleDiagnosticProjection(
      projections.filter((projection) => projection.startOffset <= startOffset && projection.endOffset >= endOffset),
    );
    if (!activeProjection) {
      parts.push(escapeHtml(segment));
      continue;
    }

    const styleToken = ["error", "warning", "info"].includes(activeProjection.styleToken)
      ? activeProjection.styleToken
      : "warning";
    const recordId = activeProjection.sourceRef?.recordId ?? "";
    parts.push(
      `<span class="editor-diagnostic-range editor-diagnostic-${styleToken}" data-diagnostic-id="${escapeHtml(recordId)}">${escapeHtml(segment)}</span>`,
    );
  }

  return parts.join("");
}

export function renderTextareaManuScriptInfographicLaneContent(snapshot, {
  charactersPerLine = 80,
  visualLineCount = 1,
} = {}) {
  const text = String(snapshot?.text ?? "");
  const projections = selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.MANU_SCRIPT_INFOGRAPHIC_LANE);
  const lineCount = Math.max(1, Math.ceil(Number(visualLineCount) || 1));
  const markersByLine = new Map();

  for (const projection of projections) {
    const lineIndex = Math.max(
      0,
      Math.min(
        lineCount - 1,
        estimateTextareaVisualLineBeforeOffset(text, projection.startOffset, charactersPerLine),
      ),
    );
    const markers = markersByLine.get(lineIndex) ?? [];
    markers.push(projection);
    markersByLine.set(lineIndex, markers);
  }

  return Array.from({ length: lineCount }, (_, lineIndex) => {
    const markers = (markersByLine.get(lineIndex) ?? []).sort(compareManuScriptInfographicLaneMarkers);
    return `
      <div class="editor-ManuScriptInfographicLane__line" data-manuscript-infographic-lane-line="${lineIndex + 1}">
        ${markers.map(renderTextareaManuScriptInfographicLaneMarker).join("")}
      </div>
    `;
  }).join("");
}

export function renderTextareaSpellcheckContent(snapshot) {
  const text = String(snapshot?.text ?? "");
  const flaggedRanges = new Set(
    selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK)
      .map((projection) => `${projection.startOffset}:${projection.endOffset}`),
  );
  const pattern = /[A-Za-z][A-Za-z'’-]*/g;
  let lastIndex = 0;
  let output = "";

  for (const match of text.matchAll(pattern)) {
    const token = String(match[0] ?? "");
    const index = Number(match.index);
    if (!Number.isInteger(index) || index < lastIndex) {
      continue;
    }

    output += escapeHtml(text.slice(lastIndex, index));
    const className = flaggedRanges.has(`${index}:${index + token.length}`)
      ? "editor-spellcheck-word is-misspelled"
      : "editor-spellcheck-word";
    output += `<span class="${className}" data-spellcheck-start="${index}" data-spellcheck-end="${index + token.length}">${escapeHtml(token)}</span>`;
    lastIndex = index + token.length;
  }

  return output + escapeHtml(text.slice(lastIndex));
}

function getTextareaProjectionLayer(host, channel) {
  if (channel === MANUSCRIPT_PROJECTION_CHANNELS.MANU_SCRIPT_INFOGRAPHIC_LANE) {
    return resolveManuScriptInfographicLaneTrack(host);
  }
  if (channel === MANUSCRIPT_PROJECTION_CHANNELS.DRAFT_PROOF) {
    return host?.draftProofLayer ?? null;
  }
  if (channel === MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_RECORDING) {
    return host?.narrationRecordingLayer ?? null;
  }
  if (channel === MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW) {
    return host?.narrationFollowLayer ?? null;
  }
  if (channel === MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK) {
    return host?.inlineFormatLayer ?? null;
  }
  if (channel === MANUSCRIPT_PROJECTION_CHANNELS.DIAGNOSTIC) {
    return host?.diagnosticLayer ?? null;
  }
  if (channel === MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK) {
    return host?.spellcheckLayer ?? null;
  }
  return null;
}

function resolveManuScriptInfographicLaneTrack(host) {
  if (host?.manuScriptInfographicLaneTrack instanceof HTMLElement) {
    return host.manuScriptInfographicLaneTrack;
  }

  if (host?.manuScriptInfographicLane instanceof HTMLElement) {
    return host.manuScriptInfographicLane.querySelector("[data-manuscript-infographic-lane-track]")
      ?? host.manuScriptInfographicLane;
  }

  return null;
}

function renderTextareaManuScriptInfographicLaneMarker(projection) {
  const markerType = normalizeManuScriptInfographicLaneMarkerType(projection?.styleToken);
  const sourceRef = projection?.sourceRef && typeof projection.sourceRef === "object"
    ? projection.sourceRef
    : {};
  const label = String(projection?.label ?? "").trim() || getDefaultManuScriptInfographicLaneLabel(markerType);
  const icon = projection?.visualStyle?.icon && typeof projection.visualStyle.icon === "object"
    ? projection.visualStyle.icon
    : null;
  return `
    <button
      class="editor-ManuScriptInfographicLane-marker editor-ManuScriptInfographicLane-marker--${escapeHtml(markerType)}"
      type="button"
      data-action="open-ManuScriptInfographicLane-marker"
      data-marker-type="${escapeHtml(markerType)}"
      data-record-type="${escapeHtml(String(sourceRef.recordType ?? ""))}"
      data-record-id="${escapeHtml(String(sourceRef.recordId ?? ""))}"
      data-node-id="${escapeHtml(String(sourceRef.nodeId ?? ""))}"
      data-scene-id="${escapeHtml(String(projection.sceneId ?? ""))}"
      data-start-offset="${escapeHtml(String(projection.startOffset ?? ""))}"
      title="${escapeHtml(label)}"
      aria-label="${escapeHtml(label)}"
    >${icon?.dataUrl ? renderManuScriptInfographicLaneImageIcon(icon) : renderManuScriptInfographicLaneIcon(markerType)}</button>
  `;
}

function renderManuScriptInfographicLaneImageIcon(icon) {
  return `
    <img
      class="editor-ManuScriptInfographicLane-marker__icon metadata-image-icon metadata-image-icon--lane"
      src="${escapeHtml(icon.dataUrl)}"
      alt=""
      aria-hidden="true"
      draggable="false"
    />
  `;
}

function renderManuScriptInfographicLaneIcon(markerType) {
  if (markerType === "task") {
    return `
      <svg class="editor-ManuScriptInfographicLane-marker__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M8 2.4v7.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <circle cx="8" cy="12.7" r="1.15" fill="currentColor"/>
      </svg>
    `;
  }

  if (markerType === "research") {
    return `
      <svg class="editor-ManuScriptInfographicLane-marker__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="6.9" cy="6.9" r="4.2" fill="none" stroke="currentColor" stroke-width="1.45"/>
        <path d="m10.1 10.1 3.3 3.3" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      </svg>
    `;
  }

  if (markerType === "world" || markerType === "world-start" || markerType === "world-end") {
    return `
      <svg class="editor-ManuScriptInfographicLane-marker__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        ${markerType === "world-start" ? '<path d="M8 1.1v3.1" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>' : ""}
        <circle cx="8" cy="8" r="4.9" fill="none" stroke="currentColor" stroke-width="1.3"/>
        <path d="M3.5 8h9M8 3.1c1.2 1.5 1.8 3.1 1.8 4.9S9.2 11.4 8 12.9M8 3.1C6.8 4.6 6.2 6.2 6.2 8s.6 3.4 1.8 4.9" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        ${markerType === "world-end" ? '<path d="M8 11.8v3.1" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>' : ""}
      </svg>
    `;
  }

  return `
    <svg class="editor-ManuScriptInfographicLane-marker__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4.2 2.6h6.9c.9 0 1.6.7 1.6 1.6v7.2c0 1.1-.9 2-2 2H5.2c-1 0-1.9-.8-1.9-1.9V3.5c0-.5.4-.9.9-.9Z" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>
      <path d="M5.7 5.6h5.1M5.7 8h4.4M5.7 10.4h3.2" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M3.3 11.4c0 1 .8 1.9 1.9 1.9" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
    </svg>
  `;
}

function compareManuScriptInfographicLaneMarkers(left, right) {
  return (
    getManuScriptInfographicLaneMarkerSortRank(left.styleToken) - getManuScriptInfographicLaneMarkerSortRank(right.styleToken) ||
    String(left.sourceRef?.recordId ?? "").localeCompare(String(right.sourceRef?.recordId ?? "")) ||
    String(left.id ?? "").localeCompare(String(right.id ?? ""))
  );
}

function normalizeManuScriptInfographicLaneMarkerType(markerType) {
  const normalizedMarkerType = String(markerType ?? "").trim();
  return ["task", "research", "world", "world-start", "world-end", "metadata"].includes(normalizedMarkerType)
    ? normalizedMarkerType
    : "metadata";
}

function getDefaultManuScriptInfographicLaneLabel(markerType) {
  if (markerType === "task") {
    return "Open task marker";
  }
  if (markerType === "research") {
    return "Open research marker";
  }
  if (markerType === "world") {
    return "Open World Spine marker";
  }
  if (markerType === "world-start") {
    return "Open World Spine event start";
  }
  if (markerType === "world-end") {
    return "Open World Spine event end";
  }
  return "Open metadata marker";
}

function getManuScriptInfographicLaneMarkerSortRank(markerType) {
  const order = {
    task: 0,
    research: 1,
    "world-start": 2,
    world: 3,
    "world-end": 4,
    metadata: 5,
  };
  return order[normalizeManuScriptInfographicLaneMarkerType(markerType)] ?? 9;
}

// Intent: keep overlapping issue visuals stable while the console retains every underlying record.
function selectVisibleDiagnosticProjection(projections) {
  const severityRank = {
    error: 3,
    warning: 2,
    info: 1,
  };
  return [...projections].sort((left, right) => (
    (severityRank[right.styleToken] ?? 0) - (severityRank[left.styleToken] ?? 0) ||
    left.id.localeCompare(right.id)
  ))[0] ?? null;
}

function resolveTextareaElement(target) {
  if (target instanceof HTMLTextAreaElement && target.classList.contains("editor-document-input")) {
    return target;
  }

  if (target instanceof HTMLElement) {
    return target.querySelector(".editor-document-input");
  }

  return null;
}

function syncTextareaMirroredLayerStyle(content, textarea) {
  const style = window.getComputedStyle(textarea);
  for (const property of TEXTAREA_MIRRORED_STYLE_PROPERTIES) {
    try {
      content.style[property] = style[property] || "";
    } catch {
      // Ignore unsupported style properties in older browser hosts.
    }
  }

  content.style.width = `${Math.round(textarea.clientWidth)}px`;
  content.style.minHeight = `${Math.round(textarea.scrollHeight)}px`;
  content.style.margin = "0";
}

function measureTextareaOffsetTop(textarea, offset) {
  const style = window.getComputedStyle(textarea);
  const marker = document.createElement("span");
  const mirror = document.createElement("div");
  const bounds = textarea.getBoundingClientRect();

  for (const property of TEXTAREA_OFFSET_MIRRORED_STYLE_PROPERTIES) {
    mirror.style[property] = style[property];
  }

  Object.assign(mirror.style, {
    position: "absolute",
    visibility: "hidden",
    pointerEvents: "none",
    top: "0",
    left: "-9999px",
    width: `${bounds.width}px`,
    minHeight: "0",
    height: "auto",
    overflow: "hidden",
    whiteSpace: "pre-wrap",
  });

  const safeOffset = clampTextareaOffset(offset, textarea.value.length);
  mirror.append(document.createTextNode(textarea.value.slice(0, safeOffset)));
  marker.textContent = "\u200b";
  mirror.append(marker);
  mirror.append(document.createTextNode(textarea.value.slice(safeOffset) || "\u200b"));
  document.body.append(mirror);
  const top = marker.offsetTop;
  mirror.remove();
  return top;
}

export function estimateTextareaVisualLineBeforeOffset(text, offset, charactersPerLine) {
  const safeCharactersPerLine = Math.max(1, Math.floor(Number(charactersPerLine) || 1));
  const beforeCursor = String(text ?? "").slice(0, Math.max(0, offset));
  const logicalLines = beforeCursor.split("\n");
  let visualLine = 0;

  for (let index = 0; index < logicalLines.length; index += 1) {
    const line = logicalLines[index];
    if (index === logicalLines.length - 1) {
      visualLine += Math.floor(line.length / safeCharactersPerLine);
      continue;
    }

    visualLine += Math.max(1, Math.ceil(line.length / safeCharactersPerLine));
  }

  return visualLine;
}

export function findTextareaOffsetForVisualLineEnd(text, targetVisualLineIndex, charactersPerLine) {
  const safeTargetIndex = Math.max(0, Math.floor(Number(targetVisualLineIndex) || 0));
  const safeCharactersPerLine = Math.max(1, Math.floor(Number(charactersPerLine) || 1));
  const logicalLines = String(text ?? "").split("\n");
  let visualLineIndex = 0;
  let logicalStartOffset = 0;

  for (const logicalLine of logicalLines) {
    const lineLength = logicalLine.length;
    const wrappedLineCount = Math.max(1, Math.ceil(lineLength / safeCharactersPerLine));
    if (safeTargetIndex < visualLineIndex + wrappedLineCount) {
      const relativeLineIndex = safeTargetIndex - visualLineIndex;
      const endOffsetWithinLine = Math.min(lineLength, (relativeLineIndex + 1) * safeCharactersPerLine);
      return logicalStartOffset + endOffsetWithinLine;
    }

    visualLineIndex += wrappedLineCount;
    logicalStartOffset += lineLength + 1;
  }

  return String(text ?? "").length;
}

function clampTextareaOffset(value, textLength) {
  const number = Number(value);
  const safeNumber = Number.isFinite(number) ? Math.floor(number) : 0;
  return Math.max(0, Math.min(safeNumber, Math.max(0, Number(textLength) || 0)));
}

function normalizeNonNegativeDimension(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
