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

// Intent: keep the active compatibility host markup replaceable by a later editor implementation.
export function renderTextareaEditorHostHTML({
  sceneId = "",
  text = "",
  projections = [],
  inputClassName = "",
} = {}) {
  const snapshot = createManuscriptEditorHostSnapshot({ sceneId, text, projections });
  return `
    <div class="editor-inline-format-layer" data-inline-format-layer aria-hidden="true">
      ${renderTextareaAuthorMarkContent(snapshot)}
    </div>
    <div class="editor-diagnostic-layer" data-diagnostic-layer aria-hidden="true">
      <div class="editor-diagnostic-layer__content">
        ${renderTextareaDiagnosticContent(snapshot)}
      </div>
    </div>
    <div class="editor-spellcheck-layer" data-spellcheck-layer aria-hidden="true"></div>
    <textarea
      class="editor-document-input ${escapeHtml(inputClassName)}"
      data-edit-field="editor-text"
      data-scene-id="${escapeHtml(snapshot.sceneId)}"
      spellcheck="false"
      lang="en-US"
      autocapitalize="off"
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
  return {
    kind: MANUSCRIPT_EDITOR_HOST_KIND.TEXTAREA_OVERLAY,
    textarea,
    sceneId: String(textarea.dataset.sceneId ?? ""),
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
  return {
    lineHeight,
    fontSize,
    charactersPerLine: Math.max(8, Math.floor(host.textarea.clientWidth / approximateCharacterWidth)),
  };
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
    syncTextareaMirroredLayerStyle(content, host.textarea);
    content.style.color = "transparent";
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
  layer.innerHTML = `
    <div class="editor-diagnostic-layer__content">
      ${renderTextareaDiagnosticContent(normalizedSnapshot)}
    </div>
  `;
  const content = layer.querySelector(".editor-diagnostic-layer__content");
  if (content instanceof HTMLElement) {
    syncTextareaMirroredLayerStyle(content, host.textarea);
  }
  return true;
}

export function clearTextareaProjectionLayer(host, channel) {
  const layer = getTextareaProjectionLayer(host, channel);
  if (!(layer instanceof HTMLElement)) {
    return false;
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
  layer.innerHTML = `
    <div class="editor-spellcheck-layer__content">
      ${renderTextareaSpellcheckContent(normalizedSnapshot)}
    </div>
  `;
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
      : "task";
  host.textarea.classList.add("has-task-preview");
  if (normalizedProjection.channel === MANUSCRIPT_PROJECTION_CHANNELS.NOTE) {
    host.textarea.classList.add("has-passage-note-preview", `has-${styleToken}-preview`);
  }

  const codeframe = host.textarea.closest(".scene-editor-codeframe");
  if (codeframe instanceof HTMLElement) {
    codeframe.classList.add("is-task-previewing");
    if (normalizedProjection.channel === MANUSCRIPT_PROJECTION_CHANNELS.NOTE) {
      codeframe.classList.add("is-passage-note-previewing", `is-${styleToken}-previewing`);
    }
  }

  selectTextareaEditorHostRange(host, normalizedProjection.startOffset, normalizedProjection.endOffset, {
    focus,
    scroll: false,
  });
  return true;
}

// Intent: render an active search or narration range as transient host selection state only.
export function showTextareaRuntimeSelectionPreview(host, projection, { focus = true } = {}) {
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
    scroll: false,
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
  );
  host.textarea.closest(".scene-editor-codeframe")?.classList.remove(
    "is-task-previewing",
    "is-passage-note-previewing",
    "is-inspiration-previewing",
    "is-research-previewing",
  );
  return true;
}

export function renderTextareaAuthorMarkContent(snapshot) {
  const text = String(snapshot?.text ?? "");
  const projections = selectManuscriptEditorHostChannel(snapshot, MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK);
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

    const activeTokens = projections
      .filter((projection) => projection.startOffset <= startOffset && projection.endOffset >= endOffset)
      .map((projection) => projection.styleToken);
    const className = activeTokens.length
      ? ` class="${activeTokens.map((token) => `editor-inline-format-${escapeHtml(token)}`).join(" ")}"`
      : "";
    parts.push(`<span${className}>${escapeHtml(segment)}</span>`);
  }

  return `<div class="editor-inline-format-layer__content">${parts.join("")}</div>`;
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
  content.style.color = "rgba(31, 36, 48, 0.02)";
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
