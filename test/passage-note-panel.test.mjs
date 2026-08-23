// Intent: verify passage-note console item rendering stays outside the app shell.
import assert from "node:assert/strict";

import {
  formatImportSourceLabel,
  renderPassageNoteItemHTML,
  renderPassageNotePanelHTML,
} from "../apps/editor/public/features/anchored-records/passage-note-panel.js";

export function runPassageNotePanelTest() {
  const metadataIcon = {
    dataUrl: "data:image/png;base64,AAAA",
    mediaType: "image/png",
    name: "lore.png",
    size: 3,
  };
  assert.equal(formatImportSourceLabel("source-front-matter"), "Front matter");
  assert.equal(formatImportSourceLabel("source-world-note"), "World Note");

  const markup = renderPassageNoteItemHTML({
    id: "note-1",
    noteType: "research",
    chapterTitle: "Chapter One",
    sceneTitle: "Arrival",
    source: "source-research",
    title: "Research title",
    body: "Research body",
  }, {
    selectedNoteId: "note-1",
    previewNoteId: "note-1",
  });

  assert.match(markup, /passage-note-item is-selected is-previewing/);
  assert.match(markup, /Chapter One · Arrival · Research/);
  assert.match(markup, /data-note-type="research"/);
  assert.match(markup, /draggable="true"/);
  assert.match(markup, /data-edit-field="passage-note-title"/);
  assert.match(markup, /data-action="edit-passage-note"/);
  assert.match(markup, /aria-label="Delete research note"/);

  const customMarkup = renderPassageNoteItemHTML({
    id: "note-lore",
    noteType: "metadata-lore",
    metadataLabel: "Lore",
    chapterTitle: "Chapter One",
    sceneTitle: "Arrival",
    title: "Lore title",
    body: "Lore body",
  });
  assert.match(customMarkup, /aria-label="Delete lore note"/);
  assert.match(customMarkup, /aria-label="Lore title"/);

  const panelMarkup = renderPassageNotePanelHTML({
    noteType: "research",
    label: "Research",
    groups: [{
      chapterKey: "chapter-1",
      chapterTitle: "Chapter One",
      items: [{
        id: "note-1",
        noteType: "research",
        chapterTitle: "Chapter One",
        sceneTitle: "Arrival",
        title: "Research title",
        body: "Research body",
      }],
    }],
  }, {
    selectedNoteId: "note-1",
    collapsedChapterIds: ["chapter-1"],
  });

  assert.match(panelMarkup, /passage-note-panel-kicker/);
  assert.match(panelMarkup, /Research/);
  assert.match(panelMarkup, /data-console-panel="research"/);
  assert.match(panelMarkup, /class="console-chapter-group passage-note-chapter-group is-collapsed"/);
  assert.match(panelMarkup, /aria-expanded="false"/);

  const customPanelMarkup = renderPassageNotePanelHTML({
    noteType: "metadata-lore",
    label: "Lore",
    highlightColor: "#7fcf9f",
    metadataIcon,
    groups: [],
  });
  assert.match(customPanelMarkup, /metadata-image-icon--panel/);
  assert.doesNotMatch(customPanelMarkup, /metadata-color-swatch/);
  assert.match(customPanelMarkup, /No lore bubbles yet/);

  const emptyMarkup = renderPassageNotePanelHTML({ label: "Inspiration", groups: [] });
  assert.match(emptyMarkup, /No inspiration bubbles yet/);
}
