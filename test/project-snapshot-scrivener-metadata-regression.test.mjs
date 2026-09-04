// Intent: prove legacy Scrivener-derived scene chunks can be enriched without causing a false package-verification failure.
import assert from "node:assert/strict";

import {
  assertProjectSnapshotsSemanticallyEquivalent,
  buildProjectSemanticVerificationSnapshot,
  collectProjectSnapshotSemanticDifferences,
} from "../apps/editor/public/adapters/storage/project-snapshot-verification.js";

const PROJECT_ID = "project-scrivener-regression";
const SCENE_ID = "scene-0023";

function createScene({ includeScrivenerMetadata = false } = {}) {
  const scene = {
    sceneId: SCENE_ID,
    chapterId: "chapter-0003",
    chapterTitle: "Chapter 3",
    sceneTitle: "Am I dreaming or am I dead",
    sceneSynopsis: "",
    editorText: "The old package already contains the manuscript body.",
    blocks: [{
      blockId: "block-0722",
      paragraphId: "paragraph-0722",
      lineNumber: 722,
      kind: "narration",
      speakerLabel: "",
      text: "The old package already contains the manuscript body.",
      issueIds: [],
      eventTagIds: [],
      isDraft: false,
    }],
  };

  if (includeScrivenerMetadata) {
    scene.scrivenerMetadata = {
      uuid: "SCRIVENER-SCENE-0023",
      type: "Text",
      binderPath: ["Manuscript", "Chapter 3", "Am I dreaming or am I dead"],
      contentFilePath: "Files/Data/SCRIVENER-SCENE-0023/content.rtf",
      label: "",
      status: "First Draft",
      notes: "Imported inspector note",
      keywords: ["dream"],
      includeInCompile: true,
      rawCustomMetadata: {},
      raw: {},
    };
  }

  return scene;
}

function createExpectedSaveSnapshot() {
  const canonicalScene = createScene({ includeScrivenerMetadata: true });
  const legacyLoadedSidecar = createScene({ includeScrivenerMetadata: false });
  return {
    schemaVersion: 2,
    activeProjectId: PROJECT_ID,
    projects: [{
      id: PROJECT_ID,
      schemaVersion: 2,
      title: "Scrivener Regression",
      source: "scrivener-import",
      projectSettings: { activeSceneId: SCENE_ID },
      projectIndex: {
        sceneOrder: [SCENE_ID],
        scenes: [{
          id: SCENE_ID,
          chapterId: "chapter-0003",
          title: "Am I dreaming or am I dead",
          synopsis: "",
        }],
      },
      sceneDrafts: {
        [SCENE_ID]: canonicalScene,
      },
      structureDrafts: {
        sceneOrder: [SCENE_ID],
        scenes: [{
          sceneId: SCENE_ID,
          chapterId: "chapter-0003",
          chapterTitle: "Chapter 3",
          sceneTitle: "Am I dreaming or am I dead",
          sceneSynopsis: "",
          order: 1,
          initialText: "",
        }],
      },
      workspace: {
        project: {
          lines: canonicalScene.blocks.map((block) => ({
            ...block,
            sceneId: SCENE_ID,
            chapterId: "chapter-0003",
            chapterTitle: "Chapter 3",
            sceneTitle: "Am I dreaming or am I dead",
            sceneSynopsis: "",
          })),
        },
      },
    }],
    // Reproduces an already-loaded older package sidecar: the body is current, but the later Scrivener provenance field is absent.
    sceneStore: {
      [PROJECT_ID]: {
        [SCENE_ID]: legacyLoadedSidecar,
      },
    },
  };
}

function createWriterReadbackSnapshot(expectedSnapshot) {
  const actual = structuredClone(expectedSnapshot);
  const enrichedScene = createScene({ includeScrivenerMetadata: true });

  // Folder manifests do not duplicate scene drafts; the writer materializes their durable fields into the scene chunk.
  actual.projects[0].sceneDrafts = {};
  actual.projects[0].workspace.project.lines = actual.projects[0].workspace.project.lines.map((line) => ({
    ...line,
    text: "",
  }));
  actual.sceneStore[PROJECT_ID][SCENE_ID] = enrichedScene;
  return actual;
}

export async function runProjectSnapshotScrivenerMetadataRegressionTest() {
  const expected = createExpectedSaveSnapshot();
  const actual = createWriterReadbackSnapshot(expected);

  const projectedExpected = buildProjectSemanticVerificationSnapshot(expected);
  assert.deepEqual(
    projectedExpected.projects[0].scenes[SCENE_ID].scrivenerMetadata,
    expected.projects[0].sceneDrafts[SCENE_ID].scrivenerMetadata,
    "Verification must compose canonical Scrivener metadata with an older body-bearing sceneStore entry.",
  );

  assert.deepEqual(
    collectProjectSnapshotSemanticDifferences(expected, actual),
    [],
    "Enriching a legacy scene sidecar with canonical Scrivener metadata must not make a valid save look corrupt.",
  );
  assert.doesNotThrow(() => assertProjectSnapshotsSemanticallyEquivalent(expected, actual, {
    operation: "Project package save",
  }));

  // The fix must preserve strictness: changing the imported provenance is still a semantic mismatch.
  const corrupted = structuredClone(actual);
  corrupted.sceneStore[PROJECT_ID][SCENE_ID].scrivenerMetadata.uuid = "WRONG-SCRIVENER-ID";
  assert.throws(
    () => assertProjectSnapshotsSemanticallyEquivalent(expected, corrupted, {
      operation: "Project package save",
    }),
    /scrivenerMetadata\.uuid/,
  );
}
