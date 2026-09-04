// Intent: keep desktop Scrivener import on the normal New Project package-publication boundary instead of a cache-only/single-file side path.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDesktopResponseForRequest } from "../apps/desktop/src/http-app.ts";
import { buildPortableExternalProjectSnapshot } from "../apps/editor/public/adapters/storage/project-persistence-service.js";
import { buildScrivenerProjectSnapshotFromFiles } from "../apps/editor/public/adapters/storage/scrivener-import-service.js";
import { assertProjectSnapshotsSemanticallyEquivalent } from "../apps/editor/public/adapters/storage/project-snapshot-verification.js";
import { createNewProjectCandidateBuilder } from "../apps/editor/public/features/project-lifecycle/new-project-candidate.js";
import {
  PROJECT_PACKAGE_DIALOG_INTENTS,
  PROJECT_PACKAGE_DIALOG_MODES,
  applyProjectPackageBrowseResult,
  canConfirmProjectPackageDialog,
  createProjectPackageDialogState,
  renderProjectPackageDialogHTML,
} from "../apps/editor/public/features/project-lifecycle/project-package-dialog.js";
import {
  buildPendingProjectImportSnapshot,
  clearProjectImportCandidate,
  stageProjectImportCandidate,
} from "../apps/editor/public/state/project-import-candidate-store.js";

const TEST_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_ROOT, "..");

async function readRepoFile(relativePath) {
  return readFile(path.join(REPO_ROOT, relativePath), "utf8");
}

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

async function postDesktopJson(pathname, body) {
  const response = await createDesktopResponseForRequest({
    method: "POST",
    pathname,
    body: JSON.stringify(body),
  });
  return { response, value: JSON.parse(String(response.body || "{}")) };
}

async function publishVerifiedPackage(parentPath, folderName, snapshot) {
  const staged = await postDesktopJson("/api/project-package/create", {
    parentPath,
    folderName,
    snapshot,
  });
  assert.equal(staged.response.statusCode, 200);
  const stagedLoad = await postDesktopJson("/api/project-package/load", {
    rootPath: staged.value.stagingRootPath,
  });
  assert.equal(stagedLoad.response.statusCode, 200);
  assertProjectSnapshotsSemanticallyEquivalent(snapshot, stagedLoad.value.snapshot, {
    operation: `${folderName} initial Scrivener import verification`,
  });
  const committed = await postDesktopJson("/api/project-package/commit", {
    operationToken: staged.value.operationToken,
  });
  assert.equal(committed.response.statusCode, 200);
  return committed.value.rootPath;
}

async function saveVerifiedPackage(rootPath, snapshot) {
  const staged = await postDesktopJson("/api/project-package/save-stage", { rootPath, snapshot });
  assert.equal(staged.response.statusCode, 200);
  const stagedLoad = await postDesktopJson("/api/project-package/save-load", {
    operationToken: staged.value.operationToken,
  });
  assert.equal(stagedLoad.response.statusCode, 200);
  assertProjectSnapshotsSemanticallyEquivalent(snapshot, stagedLoad.value.snapshot, {
    operation: "Edited first Scrivener package verification",
  });
  const committed = await postDesktopJson("/api/project-package/save-commit", {
    operationToken: staged.value.operationToken,
  });
  assert.equal(committed.response.statusCode, 200);
}

async function assertRepeatedScrivenerImportPackageIsolation() {
  const sourceFiles = [
    createTextFile("Shared Novel.scriv/Shared Novel.scrivx", `
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
                  <BinderItem UUID="shared-scene-uuid">
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
    createTextFile("Shared Novel.scriv/Files/Data/shared-scene-uuid/content.txt", "Shared source manuscript."),
  ];
  const importOptions = {
    now: "2026-09-04T00:00:00.000Z",
    projectTitle: "Shared Novel",
    sourceLabel: "Shared Novel.scriv",
    sourcePath: "C:\\Sources\\Shared Novel.scriv",
  };
  const firstCandidate = await buildScrivenerProjectSnapshotFromFiles(sourceFiles, importOptions);
  const secondCandidate = await buildScrivenerProjectSnapshotFromFiles(sourceFiles, importOptions);
  const firstId = firstCandidate.activeProjectId;
  const secondId = secondCandidate.activeProjectId;
  assert.notEqual(firstId, secondId, "Repeated imports must allocate independent ABE project identity.");
  assert.deepEqual(Object.keys(firstCandidate.sceneStore), [firstId]);
  assert.deepEqual(Object.keys(secondCandidate.sceneStore), [secondId]);

  const firstPortable = buildPortableExternalProjectSnapshot(firstCandidate);
  const secondPortable = buildPortableExternalProjectSnapshot(secondCandidate);
  const packageParent = await mkdtemp(path.join(tmpdir(), "abe-scrivener-identity-"));
  try {
    const firstRoot = await publishVerifiedPackage(packageParent, "Shared Novel A", firstPortable);
    const secondRoot = await publishVerifiedPackage(packageParent, "Shared Novel B", secondPortable);
    const firstLoad = await postDesktopJson("/api/project-package/load", { rootPath: firstRoot });
    const secondLoad = await postDesktopJson("/api/project-package/load", { rootPath: secondRoot });
    assert.equal(firstLoad.response.statusCode, 200);
    assert.equal(secondLoad.response.statusCode, 200);
    assert.equal(firstLoad.value.snapshot.projects[0].title, "Shared Novel");
    assert.equal(secondLoad.value.snapshot.projects[0].title, "Shared Novel");
    assert.notEqual(firstLoad.value.snapshot.activeProjectId, secondLoad.value.snapshot.activeProjectId);
    assert.deepEqual(
      firstLoad.value.snapshot.projects[0].structureDrafts.scrivenerBinder,
      secondLoad.value.snapshot.projects[0].structureDrafts.scrivenerBinder,
    );
    assert.deepEqual(
      firstLoad.value.snapshot.sceneStore[firstId]["scene-0001"].scrivenerMetadata,
      secondLoad.value.snapshot.sceneStore[secondId]["scene-0001"].scrivenerMetadata,
    );
    assert.deepEqual(
      firstLoad.value.snapshot.projects[0].sourceArchive,
      secondLoad.value.snapshot.projects[0].sourceArchive,
    );

    // Saving one imported package must address only its UUID-keyed scene store and physical root.
    const editedFirst = structuredClone(firstLoad.value.snapshot);
    editedFirst.sceneStore[firstId]["scene-0001"].editorText = "Edited only in the first package.";
    editedFirst.sceneStore[firstId]["scene-0001"].blocks[0].text = "Edited only in the first package.";
    await saveVerifiedPackage(firstRoot, editedFirst);

    const firstReload = await postDesktopJson("/api/project-package/load", { rootPath: firstRoot });
    const secondReload = await postDesktopJson("/api/project-package/load", { rootPath: secondRoot });
    assert.equal(firstReload.response.statusCode, 200);
    assert.equal(secondReload.response.statusCode, 200);
    assert.equal(firstReload.value.snapshot.sceneStore[firstId]["scene-0001"].editorText, "Edited only in the first package.");
    assert.equal(secondReload.value.snapshot.sceneStore[secondId]["scene-0001"].editorText, "Shared source manuscript.");
    assertProjectSnapshotsSemanticallyEquivalent(editedFirst, firstReload.value.snapshot, {
      operation: "Edited first Scrivener package reload",
    });
    assertProjectSnapshotsSemanticallyEquivalent(secondPortable, secondReload.value.snapshot, {
      operation: "Independent second Scrivener package reload",
    });
  } finally {
    await rm(packageParent, { recursive: true, force: true });
  }
}

function createScrivenerCandidateSnapshot() {
  const projectId = "scrivener-imported-novel";
  const sceneId = "scene-0001";
  const title = "Imported Novel";
  return {
    schemaVersion: 2,
    activeProjectId: projectId,
    projects: [{
      id: projectId,
      title,
      source: "scrivener-import",
      importReport: {
        kind: "scrivener",
        sourcePath: "C:\\Sources\\Imported Novel.scriv",
        manuscriptSceneCount: 1,
        customMetadataFieldCount: 1,
      },
      projectIndex: {
        projectId,
        projectTitle: title,
        sceneOrder: [sceneId],
        scenes: [{ id: sceneId, chapterId: "chapter-0001", title: "Opening", synopsis: "" }],
      },
      workspace: {
        project: {
          id: projectId,
          title,
          binder: { id: projectId, title, children: [] },
          navigationTargets: {
            [projectId]: { refId: projectId, kind: "project", title },
          },
          lines: [],
        },
      },
      projectSettings: {
        projectFilePath: "",
        projectSourcePath: "C:\\Sources\\Imported Novel.scriv",
      },
      sceneDrafts: {
        [sceneId]: {
          sceneId,
          chapterId: "chapter-0001",
          chapterTitle: "Chapter One",
          sceneTitle: "Opening",
          sceneSynopsis: "",
          editorText: "Imported Scrivener text.",
          blocks: [],
        },
      },
    }],
    sceneStore: {
      [projectId]: {
        [sceneId]: {
          sceneId,
          chapterId: "chapter-0001",
          chapterTitle: "Chapter One",
          sceneTitle: "Opening",
          sceneSynopsis: "",
          editorText: "Imported Scrivener text.",
          blocks: [],
        },
      },
    },
  };
}

export async function runScrivenerImportPackageLifecycleTest() {
  clearProjectImportCandidate("test-start");
  try {
    const sourceSnapshot = createScrivenerCandidateSnapshot();
    stageProjectImportCandidate({
      kind: "scrivener",
      snapshot: sourceSnapshot,
      projectTitle: "Imported Novel",
      sourceLabel: "Imported Novel.scriv",
      sourcePath: "C:\\Sources\\Imported Novel.scriv",
      sceneCount: 1,
      metadataCount: 1,
    });

    const dialog = createProjectPackageDialogState({
      mode: PROJECT_PACKAGE_DIALOG_MODES.NEW,
      projectTitle: "Untitled Project",
    });
    assert.equal(dialog.intent, PROJECT_PACKAGE_DIALOG_INTENTS.SCRIVENER_IMPORT);
    assert.equal(dialog.projectName, "Imported Novel");
    assert.equal(dialog.folderName, "Imported Novel");
    assert.equal(dialog.sourceRoot, "C:\\Sources\\Imported Novel.scriv");

    const renderedDialog = renderProjectPackageDialogHTML(dialog);
    assert.match(renderedDialog, /Import Scrivener Project/);
    assert.match(renderedDialog, /Import Project/);
    assert.match(renderedDialog, /Scrivener source/);
    assert.match(renderedDialog, /C:\\Sources\\Imported Novel\.scriv/);
    assert.match(renderedDialog, /data-action="browse-project-package-path"/);

    const readyDialog = applyProjectPackageBrowseResult(dialog, {
      path: "C:\\Projects",
      parentPath: "C:\\",
      directories: [],
      isProjectPackage: false,
    });
    assert.equal(canConfirmProjectPackageDialog(readyDialog), true);

    let nativeCandidateCalls = 0;
    const candidateBuilder = createNewProjectCandidateBuilder({
      createProjectRecordFromWorkspace: (workspace, options) => {
        nativeCandidateCalls += 1;
        return { ...options, workspace };
      },
      exportProjectLibrarySnapshot: ({ librarySnapshot }) => librarySnapshot,
      createProjectId: () => "project-native",
      now: () => "2026-09-04T00:00:00.000Z",
    });

    const importedSnapshot = candidateBuilder.buildNewProjectCandidateSnapshot("Renamed Imported Novel");
    assert.equal(nativeCandidateCalls, 0, "Pending imports must replace only the New Project candidate, not create a blank project first.");
    assert.equal(importedSnapshot.activeProjectId, "scrivener-imported-novel");
    assert.equal(importedSnapshot.projects[0].title, "Renamed Imported Novel");
    assert.equal(importedSnapshot.projects[0].source, "scrivener-import");
    assert.equal(importedSnapshot.projects[0].importReport.kind, "scrivener");
    assert.equal(importedSnapshot.projects[0].projectSettings.projectFilePath, "");
    assert.equal(importedSnapshot.sceneStore["scrivener-imported-novel"]["scene-0001"].editorText, "Imported Scrivener text.");
    assert.equal(sourceSnapshot.projects[0].title, "Imported Novel", "Import publication must clone before applying the chosen project name.");

    const directSnapshot = buildPendingProjectImportSnapshot("Another Imported Name");
    assert.equal(directSnapshot.projects[0].workspace.project.title, "Another Imported Name");
    assert.equal(directSnapshot.projects[0].workspace.project.binder.title, "Another Imported Name");
    assert.equal(directSnapshot.projects[0].projectIndex.projectTitle, "Another Imported Name");
    assert.equal(directSnapshot.projects[0].projectSettings.projectSourcePath, "C:\\Sources\\Imported Novel.scriv");

    clearProjectImportCandidate("test-native-fallback");
    const nativeSnapshot = candidateBuilder.buildNewProjectCandidateSnapshot("Native Project");
    assert.equal(nativeCandidateCalls, 1);
    assert.equal(nativeSnapshot.activeProjectId, "project-native");

    const [controllerSource, importCandidateSource, appSource, chromeSource] = await Promise.all([
      readRepoFile("apps/editor/public/features/project-lifecycle/project-package-dialog-controller.js"),
      readRepoFile("apps/editor/public/features/project-lifecycle/scrivener-import-candidate.js"),
      readRepoFile("apps/editor/public/app.js"),
      readRepoFile("apps/editor/public/shell/editor-chrome.js"),
    ]);

    assert.match(controllerSource, /import-scrivener-project[\s\S]*stopImmediatePropagation\(\)[\s\S]*openNativeScrivenerDirectoryPicker/);
    assert.match(controllerSource, /prepareScrivenerImportCandidate/);
    assert.match(controllerSource, /subscribeProjectImportCandidate/);
    assert.match(controllerSource, /toggle-file-menu/);
    assert.match(controllerSource, /create-project/);
    assert.doesNotMatch(importCandidateSource, /hydrateProjectLibraryFromLoadedSnapshot/);
    assert.doesNotMatch(importCandidateSource, /saveProjectSnapshotAs/);
    assert.match(importCandidateSource, /stageProjectImportCandidate/);
    assert.match(appSource, /createDesktopProjectPackage\([\s\S]*buildCandidateSnapshot:\s*\(\)\s*=>\s*buildNewProjectCandidateSnapshot\(title\)/);
    assert.match(chromeSource, /Import Scrivener Project\.\.\./);
    assert.doesNotMatch(chromeSource, />\s*Port Scrivener\.\.\.\s*</);

    await assertRepeatedScrivenerImportPackageIsolation();
  } finally {
    clearProjectImportCandidate("test-finish");
  }
}
