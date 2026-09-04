// Intent: keep desktop Scrivener import on the normal New Project package-publication boundary instead of a cache-only/single-file side path.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  } finally {
    clearProjectImportCandidate("test-finish");
  }
}
