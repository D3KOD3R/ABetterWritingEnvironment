// Intent: keep stale scene runtime projections from blocking package restart/save verification.
import assert from "node:assert/strict";

import {
  loadProjectPackage,
  loadStagedProjectPackageSave,
  sanitizeLoadedProjectPackageValue,
} from "../apps/editor/public/adapters/storage/project-package.js";
import { assertProjectSnapshotsSemanticallyEquivalent } from "../apps/editor/public/adapters/storage/project-snapshot-verification.js";

function createSnapshot({ includeRevisionStats = false } = {}) {
  const projectId = "project-restart-regression";
  const sceneId = "scene-0001";
  const scene = {
    sceneId,
    chapterId: "chapter-1",
    chapterTitle: "Chapter One",
    sceneTitle: "Restart Scene",
    sceneSynopsis: "A restart regression fixture.",
    editorText: "The project reopened without poisoning its next save.",
    blocks: [{
      blockId: "block-1",
      lineNumber: 1,
      kind: "narration",
      speakerLabel: "",
      text: "The project reopened without poisoning its next save.",
      issueIds: [],
      eventTagIds: [],
      isDraft: false,
    }],
  };
  if (includeRevisionStats) {
    scene.revisionStats = {
      addedWords: 12,
      removedWords: 3,
      source: "stale-runtime-projection",
    };
  }

  return {
    schemaVersion: 2,
    activeProjectId: projectId,
    projects: [{
      id: projectId,
      schemaVersion: 2,
      title: "Restart Regression",
      projectSettings: { activeSceneId: sceneId },
      projectIndex: {
        sceneOrder: [sceneId],
        scenes: [{
          id: sceneId,
          chapterId: "chapter-1",
          title: "Restart Scene",
          synopsis: "A restart regression fixture.",
        }],
      },
      structureDrafts: {
        scenes: [{
          sceneId,
          chapterId: "chapter-1",
          chapterTitle: "Chapter One",
          sceneTitle: "Restart Scene",
          sceneSynopsis: "A restart regression fixture.",
          order: 1,
          initialText: "The project reopened without poisoning its next save.",
        }],
      },
      workspace: {
        project: {
          lines: [],
        },
      },
    }],
    sceneStore: {
      [projectId]: {
        [sceneId]: scene,
      },
    },
  };
}

export async function runProjectPackageRevisionStatsRegressionTest() {
  const expectedSnapshot = createSnapshot();
  const stalePackageSnapshot = createSnapshot({ includeRevisionStats: true });

  assert.throws(
    () => assertProjectSnapshotsSemanticallyEquivalent(expectedSnapshot, stalePackageSnapshot, {
      operation: "Regression control",
    }),
    /revisionStats/,
    "The fixture must reproduce the package verification failure before transport sanitization.",
  );

  const directSanitized = sanitizeLoadedProjectPackageValue({
    rootPath: "C:\\Projects\\Restart Regression",
    snapshot: stalePackageSnapshot,
  });
  assert.equal(
    Object.hasOwn(
      directSanitized.snapshot.sceneStore["project-restart-regression"]["scene-0001"],
      "revisionStats",
    ),
    false,
  );
  assert.doesNotThrow(() => assertProjectSnapshotsSemanticallyEquivalent(
    expectedSnapshot,
    directSanitized.snapshot,
    { operation: "Sanitized project package" },
  ));

  const fetchJsonFromDesktopApi = async (pathname) => ({
    ok: true,
    value: {
      rootPath: "C:\\Projects\\Restart Regression",
      operationToken: pathname.includes("save-load") ? "save-token" : undefined,
      snapshot: stalePackageSnapshot,
    },
  });

  const reopened = await loadProjectPackage({
    rootPath: "C:\\Projects\\Restart Regression",
  }, { fetchJsonFromDesktopApi });
  assert.equal(
    Object.hasOwn(reopened.snapshot.sceneStore["project-restart-regression"]["scene-0001"], "revisionStats"),
    false,
  );

  const stagedReadback = await loadStagedProjectPackageSave({
    operationToken: "save-token",
  }, { fetchJsonFromDesktopApi });
  assert.equal(
    Object.hasOwn(stagedReadback.snapshot.sceneStore["project-restart-regression"]["scene-0001"], "revisionStats"),
    false,
  );
  assert.doesNotThrow(() => assertProjectSnapshotsSemanticallyEquivalent(
    expectedSnapshot,
    stagedReadback.snapshot,
    { operation: "Project package save" },
  ));

  // Sanitization must clone the host response rather than mutate cached/readback evidence in place.
  assert.equal(
    Object.hasOwn(stalePackageSnapshot.sceneStore["project-restart-regression"]["scene-0001"], "revisionStats"),
    true,
  );
}
