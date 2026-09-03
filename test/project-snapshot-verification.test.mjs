// Intent: keep package verification strict for authored structure while tolerating writer-generated structural rows.
import assert from "node:assert/strict";
import {
  assertProjectSnapshotsSemanticallyEquivalent,
  buildProjectSemanticVerificationSnapshot,
} from "../apps/editor/public/adapters/storage/project-snapshot-verification.js";

function createSnapshot({ includeStructure = false } = {}) {
  const projectId = "project-verification";
  const sceneId = "scene-verification";
  const structuralScene = {
    sceneId,
    chapterId: "chapter-1",
    chapterTitle: "Chapter One",
    sceneTitle: "Arrival",
    sceneSynopsis: "The traveller reaches the city.",
    order: 1,
    initialText: "Rain silvered the station roof.",
    location: "Central Station",
  };
  return {
    schemaVersion: 2,
    activeProjectId: projectId,
    projects: [{
      id: projectId,
      schemaVersion: 2,
      title: "Verification Novel",
      projectSettings: { activeSceneId: sceneId },
      projectIndex: {
        sceneOrder: [sceneId],
        scenes: [{
          id: sceneId,
          chapterId: "chapter-1",
          title: "Arrival",
          synopsis: "The traveller reaches the city.",
        }],
      },
      structureDrafts: {
        scenes: includeStructure ? [structuralScene] : [],
        sceneOrder: [],
        actLabels: ["Arrival"],
      },
      workspace: {
        project: {
          lines: [{
            sceneId,
            chapterId: "chapter-1",
            chapterTitle: "Chapter One",
            sceneTitle: "Arrival",
            sceneSynopsis: "The traveller reaches the city.",
            blockId: "block-1",
            lineNumber: 1,
            kind: "narration",
            speakerLabel: "",
            text: "Rain silvered the station roof.",
            issueIds: [],
            eventTagIds: [],
          }],
        },
      },
    }],
    sceneStore: {
      [projectId]: {
        [sceneId]: {
          sceneId,
          chapterId: "chapter-1",
          chapterTitle: "Chapter One",
          sceneTitle: "Arrival",
          sceneSynopsis: "The traveller reaches the city.",
          editorText: "Rain silvered the station roof.",
          blocks: [{
            blockId: "block-1",
            lineNumber: 1,
            kind: "narration",
            speakerLabel: "",
            text: "Rain silvered the station roof.",
            issueIds: [],
            eventTagIds: [],
            isDraft: false,
          }],
        },
      },
    },
  };
}

function materializeWriterStructuralScene(snapshot) {
  const candidate = structuredClone(snapshot);
  const project = candidate.projects[0];
  const sceneId = project.projectIndex.sceneOrder[0];
  const indexScene = project.projectIndex.scenes[0];
  const existingScene = project.structureDrafts.scenes.find((scene) => scene.sceneId === sceneId) ?? {};
  project.structureDrafts.scenes = [{
    ...existingScene,
    sceneId,
    chapterId: typeof existingScene.chapterId === "string" ? existingScene.chapterId : indexScene.chapterId,
    chapterTitle: typeof existingScene.chapterTitle === "string" ? existingScene.chapterTitle : "Untitled Chapter",
    sceneTitle: typeof existingScene.sceneTitle === "string" ? existingScene.sceneTitle : indexScene.title,
    sceneSynopsis: typeof existingScene.sceneSynopsis === "string" ? existingScene.sceneSynopsis : indexScene.synopsis,
    order: Number.isFinite(Number(existingScene.order)) ? Number(existingScene.order) : 1,
    initialText: typeof existingScene.initialText === "string" ? existingScene.initialText : "",
  }];
  return candidate;
}

export async function runProjectSnapshotVerificationTest() {
  const blankCandidate = createSnapshot();
  const writerMaterialized = materializeWriterStructuralScene(blankCandidate);
  assert.doesNotThrow(() => assertProjectSnapshotsSemanticallyEquivalent(blankCandidate, writerMaterialized));

  const projected = buildProjectSemanticVerificationSnapshot(writerMaterialized);
  assert.equal(Object.hasOwn(projected.projects[0].project.structureDrafts, "scenes"), false);
  assert.deepEqual(projected.projects[0].project.structureDrafts.actLabels, ["Arrival"]);
  assert.equal(projected.projects[0].structuralScenes[0].chapterTitle, "Chapter One");

  // Intent: generated fields added beside a custom overlay must not acquire authored semantics during readback.
  const partialOverlayExpected = createSnapshot();
  partialOverlayExpected.projects[0].structureDrafts.scenes = [{
    sceneId: "scene-verification",
    location: "Mars",
  }];
  const partialOverlayMaterialized = materializeWriterStructuralScene(partialOverlayExpected);
  assert.doesNotThrow(() => assertProjectSnapshotsSemanticallyEquivalent(
    partialOverlayExpected,
    partialOverlayMaterialized,
  ));

  const changedPartialOverlay = structuredClone(partialOverlayMaterialized);
  changedPartialOverlay.projects[0].structureDrafts.scenes[0].location = "Venus";
  assert.throws(
    () => assertProjectSnapshotsSemanticallyEquivalent(partialOverlayExpected, changedPartialOverlay),
    /not semantically equivalent/,
  );
  const removedPartialOverlay = structuredClone(partialOverlayMaterialized);
  delete removedPartialOverlay.projects[0].structureDrafts.scenes[0].location;
  assert.throws(
    () => assertProjectSnapshotsSemanticallyEquivalent(partialOverlayExpected, removedPartialOverlay),
    /not semantically equivalent/,
  );

  const richExpected = createSnapshot({ includeStructure: true });
  const corruptionCases = [
    ["scene ID", (scene) => { scene.sceneId = "scene-wrong"; }],
    ["order", (scene) => { scene.order = 2; }],
    ["scene title", (scene) => { scene.sceneTitle = "Departure"; }],
    ["chapter association", (scene) => { scene.chapterId = "chapter-2"; }],
    ["synopsis", (scene) => { scene.sceneSynopsis = "Changed synopsis."; }],
    ["additional structural metadata", (scene) => { scene.location = "Harbour"; }],
  ];
  for (const [label, corrupt] of corruptionCases) {
    const candidate = structuredClone(richExpected);
    corrupt(candidate.projects[0].structureDrafts.scenes[0]);
    assert.throws(
      () => assertProjectSnapshotsSemanticallyEquivalent(richExpected, candidate, { operation: label }),
      /not semantically equivalent/,
      `${label} corruption must fail semantic verification`,
    );
  }

  const missingStructuralScene = structuredClone(richExpected);
  missingStructuralScene.projects[0].structureDrafts.scenes = [];
  assert.throws(
    () => assertProjectSnapshotsSemanticallyEquivalent(richExpected, missingStructuralScene),
    /not semantically equivalent/,
  );

  const changedNonSceneStructure = structuredClone(richExpected);
  changedNonSceneStructure.projects[0].structureDrafts.actLabels = ["Departure"];
  assert.throws(
    () => assertProjectSnapshotsSemanticallyEquivalent(richExpected, changedNonSceneStructure),
    /not semantically equivalent/,
  );
}
