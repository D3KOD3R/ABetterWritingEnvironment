// Intent: prove a Scrivener source location remains transient while portable provenance survives package creation and later saves.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createDesktopResponseForRequest } from "../apps/desktop/src/http-app.ts";
import { buildPortableExternalProjectSnapshot } from "../apps/editor/public/adapters/storage/project-persistence-service.js";
import { buildScrivenerProjectSnapshotFromFiles } from "../apps/editor/public/adapters/storage/scrivener-import-service.js";
import { assertProjectSnapshotsSemanticallyEquivalent } from "../apps/editor/public/adapters/storage/project-snapshot-verification.js";

const ABSOLUTE_SOURCE_PATH = "C:\\Users\\TestUser\\Documents\\PrivateNovel.scriv";
const SCRIVENER_UUID = "SCRIVENER-SCENE-UUID";
const RELATIVE_CONTENT_PATH = `Files/Data/${SCRIVENER_UUID}/content.rtf`;

function createTextFile(filePath, content) {
  return {
    name: filePath.split(/[\\/]/).at(-1),
    path: filePath,
    size: content.length,
    type: "text/plain",
    async text() {
      return content;
    },
  };
}

function containsExactString(value, expected) {
  if (value === expected) return true;
  if (Array.isArray(value)) return value.some((entry) => containsExactString(entry, expected));
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some((entry) => containsExactString(entry, expected));
}

async function postDesktopJson(pathname, body) {
  const response = await createDesktopResponseForRequest({
    method: "POST",
    pathname,
    body: JSON.stringify(body),
  });
  return { response, value: JSON.parse(String(response.body || "{}")) };
}

export async function runScrivenerImportPortabilityTest() {
  // These in-memory source entries deliberately have no backing .scriv directory after conversion.
  const candidate = await buildScrivenerProjectSnapshotFromFiles([
    createTextFile("PrivateNovel.scriv/PrivateNovel.scrivx", `
      <ScrivenerProject>
        <Binder>
          <BinderItem UUID="draft-root">
            <Title>Draft</Title>
            <Type>DraftFolder</Type>
            <Children>
              <BinderItem UUID="chapter-one">
                <Title>Chapter One</Title>
                <Type>Folder</Type>
                <Children>
                  <BinderItem UUID="${SCRIVENER_UUID}">
                    <Title>Opening Scene</Title>
                    <Type>Text</Type>
                  </BinderItem>
                </Children>
              </BinderItem>
            </Children>
          </BinderItem>
        </Binder>
      </ScrivenerProject>
    `),
    createTextFile(`PrivateNovel.scriv/${RELATIVE_CONTENT_PATH}`, "Portable imported manuscript text."),
  ], {
    now: "2026-09-04T00:00:00.000Z",
    sourceLabel: "PrivateNovel.scriv",
    sourcePath: ABSOLUTE_SOURCE_PATH,
  });

  const candidateProject = candidate.projects[0];
  const candidateScene = candidateProject.sceneDrafts["scene-0001"];
  assert.equal(candidateProject.importReport.sourcePath, ABSOLUTE_SOURCE_PATH);
  assert.equal(candidateProject.projectSettings.projectSourcePath, ABSOLUTE_SOURCE_PATH);
  assert.equal(candidateScene.scrivenerMetadata.uuid, SCRIVENER_UUID);
  assert.ok(candidateScene.scrivenerMetadata.contentFilePath.endsWith(RELATIVE_CONTENT_PATH));

  const portable = buildPortableExternalProjectSnapshot(candidate);
  const portableProject = portable.projects[0];
  assert.equal(Object.hasOwn(portableProject.importReport, "sourcePath"), false);
  assert.equal(Object.hasOwn(portableProject.projectSettings, "projectSourcePath"), false);
  assert.equal(containsExactString(portable, ABSOLUTE_SOURCE_PATH), false);
  assert.equal(portableProject.importReport.sourceLabel, "PrivateNovel.scriv");
  assert.ok(portableProject.importReport.scrivxPath.endsWith("PrivateNovel.scrivx"));
  assert.ok(portableProject.importReport.fileManifest.some((entry) => entry.path.endsWith(RELATIVE_CONTENT_PATH)));
  assert.equal(portableProject.sceneDrafts["scene-0001"].scrivenerMetadata.uuid, SCRIVENER_UUID);
  assert.deepEqual(portableProject.sceneDrafts["scene-0001"].scrivenerMetadata.binderPath, [
    "Draft",
    "Chapter One",
    "Opening Scene",
  ]);
  assert.ok(portableProject.sceneDrafts["scene-0001"].scrivenerMetadata.contentFilePath.endsWith(RELATIVE_CONTENT_PATH));

  const packageParent = await mkdtemp(path.join(tmpdir(), "abe-scrivener-portability-"));
  try {
    const staged = await postDesktopJson("/api/project-package/create", {
      parentPath: packageParent,
      folderName: "Portable Scrivener Import",
      snapshot: portable,
    });
    assert.equal(staged.response.statusCode, 200);

    const projectJsonText = await readFile(path.join(staged.value.stagingRootPath, "project.json"), "utf8");
    const physicalManifest = JSON.parse(projectJsonText);
    assert.equal(Object.hasOwn(physicalManifest.projects[0].importReport, "sourcePath"), false);
    assert.equal(containsExactString(physicalManifest, ABSOLUTE_SOURCE_PATH), false);
    assert.equal(projectJsonText.includes(JSON.stringify(ABSOLUTE_SOURCE_PATH).slice(1, -1)), false);

    const committed = await postDesktopJson("/api/project-package/commit", {
      operationToken: staged.value.operationToken,
    });
    assert.equal(committed.response.statusCode, 200);

    const loaded = await postDesktopJson("/api/project-package/load", {
      rootPath: committed.value.rootPath,
    });
    assert.equal(loaded.response.statusCode, 200);
    assertProjectSnapshotsSemanticallyEquivalent(portable, loaded.value.snapshot, {
      operation: "Portable Scrivener package load",
    });
    const loadedProject = loaded.value.snapshot.projects[0];
    const loadedScene = loaded.value.snapshot.sceneStore[loadedProject.id]["scene-0001"];
    assert.equal(Object.hasOwn(loadedProject.importReport, "sourcePath"), false);
    assert.equal(loadedScene.scrivenerMetadata.uuid, SCRIVENER_UUID);
    assert.deepEqual(loadedScene.scrivenerMetadata.binderPath, ["Draft", "Chapter One", "Opening Scene"]);
    assert.ok(loadedScene.scrivenerMetadata.contentFilePath.endsWith(RELATIVE_CONTENT_PATH));

    // A normal subsequent Save reads only the ABE package; it never consults the original Scrivener location.
    const saveStage = await postDesktopJson("/api/project-package/save-stage", {
      rootPath: committed.value.rootPath,
      snapshot: loaded.value.snapshot,
    });
    assert.equal(saveStage.response.statusCode, 200);
    const saveReadback = await postDesktopJson("/api/project-package/save-load", {
      operationToken: saveStage.value.operationToken,
    });
    assert.equal(saveReadback.response.statusCode, 200);
    assertProjectSnapshotsSemanticallyEquivalent(loaded.value.snapshot, saveReadback.value.snapshot, {
      operation: "Portable Scrivener package subsequent save",
    });
    const saveCommit = await postDesktopJson("/api/project-package/save-commit", {
      operationToken: saveStage.value.operationToken,
    });
    assert.equal(saveCommit.response.statusCode, 200);

    const reloaded = await postDesktopJson("/api/project-package/load", {
      rootPath: committed.value.rootPath,
    });
    assert.equal(reloaded.response.statusCode, 200);
    assert.equal(containsExactString(reloaded.value.snapshot, ABSOLUTE_SOURCE_PATH), false);
    assertProjectSnapshotsSemanticallyEquivalent(loaded.value.snapshot, reloaded.value.snapshot, {
      operation: "Portable Scrivener package reload after save",
    });
  } finally {
    await rm(packageParent, { recursive: true, force: true });
  }
}
