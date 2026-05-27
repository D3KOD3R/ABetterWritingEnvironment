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
    spellcheckLayer: body?.querySelector("[data-spellcheck-layer]") ?? null,
    readSelection(formatRanges = []) {
      return resolveTextareaManuscriptSelection(textarea, formatRanges);
    },
    applyTextMutation(mutation) {
      return applyTextareaTextMutation(textarea, mutation);
    },
  };
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

  if (focus) {
    host.textarea.focus({ preventScroll: true });
  }
  host.textarea.setSelectionRange(normalizedProjection.startOffset, normalizedProjection.endOffset, "forward");
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

  if (focus) {
    host.textarea.focus({ preventScroll: true });
  }
  host.textarea.setSelectionRange(normalizedProjection.startOffset, normalizedProjection.endOffset, "forward");
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
  if (channel === MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK) {
    return host?.spellcheckLayer ?? null;
  }
  return null;
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
