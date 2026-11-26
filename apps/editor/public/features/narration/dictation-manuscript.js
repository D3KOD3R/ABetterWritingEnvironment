// Speech uses the existing native editor history. Provisional words are render-only;
// only final utterances enter canonical text through the ordinary input pipeline.
export function speechInsertion(text, offset, speech) {
  const words = String(speech || "").trim();
  if (!words) return "";
  const before = text.slice(0, offset), after = text.slice(offset);
  return (before && !/\s$/.test(before) && !/^[,.;:!?)]/.test(words) ? " " : "") + words
    + (after && !/^\s|^[,.;:!?)]/.test(after) ? " " : "");
}
export function createDictationTextSession({ read, insert, offset }) {
  let expected = read(), cursor = offset;
  const committed = new Set();
  if (!Number.isInteger(cursor) || cursor < 0 || cursor > expected.length) throw new Error("Click a valid manuscript insertion point first.");
  return {
    apply(events) {
      if (read() !== expected) throw new Error("Manuscript changed during dictation. Stop and recover the transcript before continuing.");
      for (const event of events) {
        if (event.status !== "final" || committed.has(event.utteranceId)) continue;
        const addition = speechInsertion(expected, cursor, event.text);
        if (addition) {
          const next = expected.slice(0, cursor) + addition + expected.slice(cursor);
          insert(cursor, addition);
          if (read() !== next) throw new Error("Manuscript insertion was not accepted. Retained audio and transcript remain available.");
          expected = next; cursor += addition.length;
        }
        committed.add(event.utteranceId);
      }
      const provisional = events.filter(e => e.status === "partial" && !committed.has(e.utteranceId)).map(e => e.text).join(" ");
      return { cursor, text: expected, provisional: speechInsertion(expected, cursor, provisional) };
    },
  };
}
export function createDictationManuscript({ state, getText, beforeInput }) {
  let surface, session, identity, overlay, bookmark;
  const current = () => document.querySelector('textarea[data-edit-field="editor-text"]');
  const remember = event => {
    const target = event.target;
    if (target?.matches?.('textarea[data-edit-field="editor-text"]') && !session && !target.readOnly)
      bookmark = { surface: target, sceneId: target.dataset.sceneId, offset: target.selectionStart, end: target.selectionEnd };
  };
  for (const name of ["mouseup", "keyup", "select", "focusin"]) document.addEventListener(name, remember);
  function clearProjection() { overlay?.remove(); overlay = null; surface?.closest(".editor-document-body")?.classList.remove("dictation-projecting"); }
  function project(result) {
    clearProjection();
    if (!result.provisional) return;
    const body = surface.closest(".editor-document-body");
    const formatted = body.querySelector(".editor-inline-format-layer__content");
    overlay = document.createElement("div"); overlay.className = "dictation-provisional-projection"; overlay.setAttribute("aria-hidden", "true");
    const content = formatted?.cloneNode(true) || document.createElement("div");
    if (content.textContent !== result.text) content.textContent = result.text;
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let node, remaining = result.cursor;
    const span = document.createElement("span"); span.className = "dictation-provisional-word"; span.textContent = result.provisional;
    while ((node = walker.nextNode())) {
      if (remaining <= node.length) { const range = document.createRange(); range.setStart(node, remaining); range.collapse(true); range.insertNode(span); break; }
      remaining -= node.length;
    }
    if (!span.parentNode) content.append(span);
    const style = getComputedStyle(surface);
    for (const key of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "textIndent", "paddingTop", "paddingLeft", "paddingRight", "paddingBottom", "boxSizing", "wordBreak", "overflowWrap", "tabSize"]) content.style[key] = style[key];
    content.style.whiteSpace = "pre-wrap"; content.style.width = `${surface.clientWidth}px`;
    content.style.transform = `translate(${-surface.scrollLeft}px, ${-surface.scrollTop}px)`;
    overlay.append(content); body.append(overlay); body.classList.add("dictation-projecting");
  }
  return {
    begin() {
      surface = current();
      if (!surface || surface.readOnly || bookmark?.surface !== surface || bookmark.sceneId !== state.selectedSceneId || bookmark.offset !== bookmark.end) throw new Error("Click once in the manuscript to choose the insertion point before recording.");
      identity = { projectId: state.workspace?.project?.id, sceneId: state.selectedSceneId, root: state.projectFilePath };
      session = createDictationTextSession({ offset: bookmark.offset, read: () => getText(identity.sceneId), insert(offset, text) {
        if (!surface.isConnected || surface !== current() || surface.value !== getText(identity.sceneId)) throw new Error("Original manuscript editor is unavailable; transcript recovery is required.");
        clearProjection(); surface.readOnly = false;
        try {
          surface.focus({ preventScroll: true }); surface.setSelectionRange(offset, offset);
          beforeInput(surface);
          // No scripted-value fallback: it would bypass the browser's existing undo chronology.
          if (!document.execCommand("insertText", false, text)) throw new Error("Native undo-preserving speech insertion is unavailable in this browser.");
        } finally { surface.readOnly = true; }
      } });
      surface.readOnly = true;
    },
    apply(events) {
      if (!session) return;
      if (state.workspace?.project?.id !== identity.projectId || state.selectedSceneId !== identity.sceneId || state.projectFilePath !== identity.root) throw new Error("Dictation destination changed. Original audio and transcript are protected.");
      project(session.apply(events));
    },
    finish() { clearProjection(); if (surface?.isConnected) surface.readOnly = false; session = null; },
    isActive: () => Boolean(session),
  };
}
