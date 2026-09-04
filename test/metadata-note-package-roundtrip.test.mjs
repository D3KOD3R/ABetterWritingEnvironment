// Intent: prove generic metadata-note provenance survives physical package sidecars and strict semantic readback verification.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createDesktopResponseForRequest } from "../apps/desktop/src/http-app.ts";
import { buildPortableExternalProjectSnapshot } from "../apps/editor/public/adapters/storage/project-persistence-service.js";
import { assertProjectSnapshotsSemanticallyEquivalent } from "../apps/editor/public/adapters/storage/project-snapshot-verification.js";

const PROJECT_ID = "project-metadata-note-roundtrip";
const FOLDER_ID = "metadata-folder-comments";
const NOTE_ID = "metadata-folder-note-comment-one";

function createCandidateSnapshot() {
  return {
    schemaVersion: 2,
    activeProjectId: PROJECT_ID,
    projects: [{
      id: PROJECT_ID,
      schemaVersion: 2,
      title: "Metadata Note Round Trip",
      projectSettings: { activeSceneId: "" },
      projectIndex: { sceneOrder: [], scenes: [] },
      structureDrafts: { scenes: [] },
      metadataSubgroups: [{
        id: FOLDER_ID,
        groupId: "metadata-comments-and-footnotes",
        title: "Comments and Footnotes",
        createdAt: "2026-09-04T00:00:00.000Z",
        updatedAt: "2026-09-04T00:00:00.000Z",
        notes: [{
          id: NOTE_ID,
          title: "Comment 1",
          body: "Imported comment body.",
          createdAt: "2026-09-04T00:00:00.000Z",
          updatedAt: "2026-09-04T00:00:00.000Z",
          anchor: null,
          sourceDocumentId: "scene-one",
          sourceCommentId: "COMMENT-1",
          sourceKind: "comment",
        }],
        folders: [],
      }],
      workspace: { project: { lines: [] } },
    }],
    sceneStore: { [PROJECT_ID]: {} },
  };
}

async function postDesktopJson(pathname, body) {
  const response = await createDesktopResponseForRequest({
    method: "POST",
    pathname,
    body: JSON.stringify(body),
  });
  return { response, value: JSON.parse(String(response.body || "{}")) };
}

export async function runMetadataNotePackageRoundtripTest() {
  const packageParent = await mkdtemp(path.join(tmpdir(), "abe-metadata-note-roundtrip-"));
  try {
    const candidate = buildPortableExternalProjectSnapshot(createCandidateSnapshot());
    const staged = await postDesktopJson("/api/project-package/create", {
      parentPath: packageParent,
      folderName: "Metadata Note Package",
      snapshot: candidate,
    });
    assert.equal(staged.response.statusCode, 200);

    const manifest = JSON.parse(await readFile(path.join(staged.value.stagingRootPath, "project.json"), "utf8"));
    const noteRelativePath = manifest.projects[0].projectStorage.metadataFolders.noteFiles[FOLDER_ID][NOTE_ID];
    const sidecar = JSON.parse(await readFile(path.join(staged.value.stagingRootPath, ...noteRelativePath.split("/")), "utf8"));
    assert.equal(sidecar.sourceDocumentId, "scene-one");
    assert.equal(sidecar.sourceCommentId, "COMMENT-1");
    assert.equal(sidecar.sourceKind, "comment");
    assert.equal(sidecar.groupId, "metadata-comments-and-footnotes");
    assert.equal(sidecar.folderId, FOLDER_ID);

    const loaded = await postDesktopJson("/api/project-package/load", {
      rootPath: staged.value.stagingRootPath,
    });
    assert.equal(loaded.response.statusCode, 200);
    const loadedNote = loaded.value.snapshot.projects[0].metadataSubgroups[0].notes[0];
    assert.equal(loadedNote.sourceDocumentId, "scene-one");
    assert.equal(loadedNote.sourceCommentId, "COMMENT-1");
    assert.equal(loadedNote.sourceKind, "comment");
    assert.equal(Object.hasOwn(loadedNote, "groupId"), false);
    assert.equal(Object.hasOwn(loadedNote, "folderId"), false);
    assertProjectSnapshotsSemanticallyEquivalent(candidate, loaded.value.snapshot, {
      operation: "Metadata note physical package round trip",
    });

    const committed = await postDesktopJson("/api/project-package/commit", {
      operationToken: staged.value.operationToken,
    });
    assert.equal(committed.response.statusCode, 200);
  } finally {
    await rm(packageParent, { recursive: true, force: true });
  }
}
