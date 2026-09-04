// Intent: verify project metadata folders can store unanchored and optionally anchored notes.
import assert from "node:assert/strict";

import { renderMetadataSubgroupPanelHTML } from "../apps/editor/public/features/metadata-console/metadata-subgroup-panel.js";
import {
  countMetadataSubgroupNotesByGroup,
  createMetadataSubgroup,
  createMetadataSubgroupNote,
  createMetadataSubgroupNoteInputFromPassageNote,
  findMetadataSubgroupNote,
  normalizeMetadataSubgroups,
  selectMetadataSubgroupsByGroupId,
  updateMetadataSubgroupNote,
} from "../apps/editor/public/features/metadata-console/metadata-subgroup-service.js";

export function runMetadataSubgroupServiceTest() {
  const supportedGroupIds = ["inspiration", "research", "metadata-lore"];
  const created = createMetadataSubgroup({
    groupId: "research",
    title: "Archive Leads",
  }, [], supportedGroupIds, "2026-07-15T01:00:00.000Z");

  assert.equal(created.subgroup.groupId, "research");
  assert.equal(created.subgroup.title, "Archive Leads");
  assert.match(created.subgroup.id, /^metadata-folder-/);
  assert.equal(created.subgroups.length, 1);

  const noteResult = createMetadataSubgroupNote({
    subgroupId: created.subgroup.id,
    title: "Library lead",
    body: "Ask whether the record names the orbital platform.",
  }, created.subgroups, supportedGroupIds, "2026-07-15T01:05:00.000Z");

  assert.equal(noteResult.note.title, "Library lead");
  assert.equal(noteResult.note.anchor, null);

  const anchored = updateMetadataSubgroupNote(
    noteResult.subgroups,
    created.subgroup.id,
    noteResult.note.id,
    {
      anchor: {
        sceneId: "scene-1",
        chapterId: "chapter-1",
        chapterTitle: "Chapter One",
        sceneTitle: "Arrival",
        selectedText: "the marked verse",
        startOffset: 12,
        endOffset: 28,
      },
    },
    supportedGroupIds,
    "2026-07-15T01:10:00.000Z",
  );
  const anchoredNote = findMetadataSubgroupNote(anchored, created.subgroup.id, noteResult.note.id, supportedGroupIds);
  assert.equal(anchoredNote.anchor.sceneId, "scene-1");
  assert.equal(anchoredNote.anchor.selectedText, "the marked verse");

  assert.equal(selectMetadataSubgroupsByGroupId(anchored, "research", supportedGroupIds).length, 1);
  const child = createMetadataSubgroup({
    groupId: "research",
    parentSubgroupId: created.subgroup.id,
    title: "Primary Sources",
  }, anchored, supportedGroupIds, "2026-07-15T01:15:00.000Z");
  assert.equal(child.subgroup.title, "Primary Sources");
  assert.equal(child.subgroups[0].folders.length, 1);
  assert.equal(child.subgroups[0].folders[0].id, child.subgroup.id);

  const passageImportInput = createMetadataSubgroupNoteInputFromPassageNote({
    id: "note-1",
    noteType: "research",
    sceneId: "scene-2",
    chapterId: "chapter-2",
    chapterTitle: "Chapter Two",
    sceneTitle: "Docking",
    selectedText: "the station ledger",
    startOffset: 18,
    endOffset: 36,
    title: "Station ledger",
    body: "Loose research note.",
    createdAt: "2026-07-15T01:16:00.000Z",
  }, child.subgroup.id);
  assert.equal(passageImportInput.subgroupId, child.subgroup.id);
  assert.equal(passageImportInput.anchor.sceneId, "scene-2");

  const childNote = createMetadataSubgroupNote(
    passageImportInput,
    child.subgroups,
    supportedGroupIds,
    "2026-07-15T01:20:00.000Z",
  );
  assert.equal(childNote.note.title, "Station ledger");
  assert.equal(
    findMetadataSubgroupNote(childNote.subgroups, child.subgroup.id, childNote.note.id, supportedGroupIds).anchor.selectedText,
    "the station ledger",
  );
  assert.equal(countMetadataSubgroupNotesByGroup(childNote.subgroups, supportedGroupIds).research, 2);

  assert.deepEqual(normalizeMetadataSubgroups([{
    id: "metadata-subgroup-drop",
    groupId: "unknown",
    title: "Drop me",
  }], supportedGroupIds), []);

  const [normalizedExtensionFolder] = normalizeMetadataSubgroups([{
    id: "metadata-folder-imported",
    groupId: "research",
    title: "Imported notes",
    notes: [{
      id: "metadata-folder-note-imported",
      title: "Imported comment",
      body: "Preserve importer provenance.",
      createdAt: "2026-07-15T01:25:00.000Z",
      updatedAt: "2026-07-15T01:30:00.000Z",
      anchor: null,
      sourceDocumentId: "scene-one",
      sourceCommentId: "COMMENT-1",
      sourceKind: "comment",
      extensionPayload: { labels: ["imported", "review"] },
      groupId: "storage-group",
      folderId: "storage-folder",
      manuscriptAnchor: { sceneId: "legacy-scene" },
    }],
  }], supportedGroupIds);
  const [normalizedExtensionNote] = normalizedExtensionFolder.notes;
  assert.equal(normalizedExtensionNote.sourceDocumentId, "scene-one");
  assert.equal(normalizedExtensionNote.sourceCommentId, "COMMENT-1");
  assert.equal(normalizedExtensionNote.sourceKind, "comment");
  assert.deepEqual(normalizedExtensionNote.extensionPayload, { labels: ["imported", "review"] });
  assert.equal(Object.hasOwn(normalizedExtensionNote, "groupId"), false);
  assert.equal(Object.hasOwn(normalizedExtensionNote, "folderId"), false);
  assert.equal(Object.hasOwn(normalizedExtensionNote, "manuscriptAnchor"), false);

  const markup = renderMetadataSubgroupPanelHTML({
    groupId: "research",
    subgroups: childNote.subgroups,
    selectedNoteId: noteResult.note.id,
  });
  assert.match(markup, />Folders</);
  assert.match(markup, />New folder</);
  assert.match(markup, /data-action="add-metadata-folder"/);
  assert.match(markup, /data-action="add-metadata-child-folder"/);
  assert.match(markup, /data-metadata-folder-drop-target="true"/);
  assert.match(markup, /metadata-folder-icon/);
  assert.match(markup, /data-action="add-metadata-folder-note"/);
  assert.match(markup, /Delete folder/);
  assert.match(markup, /data-action="point-metadata-subgroup-note-to-selection"/);
  assert.match(markup, /data-action="open-metadata-subgroup-note-anchor"/);
  assert.match(markup, /the marked verse/);
  assert.doesNotMatch(markup, /<span>Folder<\/span>/);
  assert.doesNotMatch(markup, /New subgroup/);
}
