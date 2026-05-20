// Intent: verify revision storage normalizes empty, legacy, and aggregated revision state safely.
import assert from "node:assert/strict";

import {
  createRevisionStorageService,
  getPersistableRevisionProjectState,
  normalizeRevisionProjectState,
} from "../apps/editor/public/adapters/storage/revision-storage-service.js";
import { createRevisionPanelController } from "../apps/editor/public/features/revisions/revision-panel-controller.js";
import { createRevisionService } from "../apps/editor/public/features/revisions/revision-service.js";
import { renderRevisionPanelHTML } from "../apps/editor/public/features/revisions/revision-panel-view.js";

function createMinimalProjectRecord() {
  return {
    id: "project-revision-storage-test",
    title: "Revision Storage Test",
    workspace: {
      project: {
        id: "project-revision-storage-test",
        title: "Revision Storage Test",
        lines: [
          {
            id: "block-1",
            sceneId: "scene-1",
            text: "Opening draft text.",
          },
        ],
      },
      world: {
        templates: [],
        entities: [],
        spines: [],
      },
    },
    projectIndex: {
      sceneOrder: ["scene-1"],
      scenes: [
        {
          id: "scene-1",
          title: "Opening",
          chapterId: "chapter-1",
          chapterTitle: "Chapter One",
          wordCount: 3,
        },
      ],
    },
    sceneDrafts: {
      "scene-1": {
        sceneId: "scene-1",
        chapterId: "chapter-1",
        chapterTitle: "Chapter One",
        sceneTitle: "Opening",
        editorText: "Opening draft text.",
      },
    },
    manuscriptTasks: [],
    passageNotes: [],
    projectSettings: {},
  };
}

export async function runRevisionStorageTest() {
  const storageService = createRevisionStorageService();
  const panelController = createRevisionPanelController();

  // Intent: projects without revision state should normalize to an empty history.
  const emptyProject = createMinimalProjectRecord();
  const emptyState = storageService.readRevisionState(emptyProject);
  assert.equal(emptyState.sessions.length, 0);
  assert.equal(emptyState.activeSessionId, "");
  assert.equal(getPersistableRevisionProjectState(emptyProject.revisions), undefined);

  const emptyPanelHtml = renderRevisionPanelHTML(panelController.buildPanelModel(emptyState));
  assert.match(emptyPanelHtml, /No writing sessions match this view/);
  assert.match(emptyPanelHtml, /No Writing Session selected/);

  // Intent: legacy shapes should still normalize into revision sessions.
  const legacyProject = createMinimalProjectRecord();
  legacyProject.revisions = {
    activeSessionId: "legacy-session",
    sessions: [
      {
        revision: {
          id: "legacy-session",
          status: "finalised",
          startedAt: "2026-05-18T00:00:00.000Z",
          finalisedAt: "2026-05-18T00:30:00.000Z",
          title: "Legacy Revision Session",
          description: "Legacy field shape from an older project snapshot.",
          origin: "manual_editor",
          changeCategories: ["manuscript"],
          origins: ["manual_editor"],
          writingSessionBoundaryKey: "legacy-boundary",
        },
        events: [
          {
            id: "legacy-event",
            eventType: "manuscript_edit",
            timestamp: "2026-05-18T00:10:00.000Z",
            origin: "manual_editor",
            sourceService: "legacy",
            entityType: "scene",
            entityId: "scene-1",
            description: "Legacy edit record",
            changeCategory: "manuscript",
            mode: "manual",
            occurrenceCount: 1,
          },
        ],
        diff: {
          schemaVersion: 1,
          generatedAt: "2026-05-18T00:30:00.000Z",
          baselineHash: "h00000001",
          finalHash: "h00000002",
          operations: [
            {
              op: "replace",
              path: "manuscript.scenesById.scene-1.title",
              before: "Opening",
              after: "Opening",
            },
          ],
          changedEntities: [
            {
              entityType: "scene",
              entityId: "scene-1",
              title: "Opening",
              status: "changed",
            },
          ],
          sceneChanges: [],
          summary: {
            added: 0,
            removed: 0,
            changed: 1,
          },
        },
        changedEntities: [
          {
            entityType: "scene",
            entityId: "scene-1",
            title: "Opening",
            status: "changed",
          },
        ],
        summaryMarkdown: "Legacy summary",
        checkpoints: [],
      },
    ],
  };

  const legacyState = storageService.readRevisionState(legacyProject);
  assert.equal(legacyState.sessions.length, 1);
  assert.equal(legacyState.sessions[0].metadata.id, "legacy-session");
  assert.equal(legacyState.sessions[0].metadata.status, "finalised");
  assert.equal(legacyState.activeSessionId, "");

  // Intent: duplicate manuscript edits should aggregate into one ledger entry instead of spamming events.
  let revisionState = normalizeRevisionProjectState(emptyProject.revisions);
  const projectRecord = createMinimalProjectRecord();
  const service = createRevisionService({
    getProjectRecord: () => projectRecord,
    getProjectSnapshot: () => projectRecord,
    getRevisionState: () => revisionState,
    setRevisionState: (nextState) => {
      revisionState = normalizeRevisionProjectState(nextState);
      projectRecord.revisions = revisionState;
    },
    now: () => "2026-05-18T01:00:00.000Z",
    idFactory: (prefix) => `${prefix}-aggregate-test`,
  });

  service.recordEvent({
    eventType: "manuscript_edit",
    entityType: "scene",
    entityId: "scene-1",
    description: "First pass over opening scene",
    changeCategory: "manuscript",
    origin: "manual_editor",
    sourceService: "RevisionStorageTest",
  });
  service.recordEvent({
    eventType: "manuscript_edit",
    entityType: "scene",
    entityId: "scene-1",
    description: "First pass over opening scene",
    changeCategory: "manuscript",
    origin: "manual_editor",
    sourceService: "RevisionStorageTest",
  });

  assert.equal(revisionState.sessions.length, 1);
  assert.equal(revisionState.sessions[0].events.length, 1);
  assert.equal(revisionState.sessions[0].events[0].occurrenceCount, 2);
  assert.equal(revisionState.sessions[0].diff, null);

  projectRecord.sceneDrafts["scene-1"].editorText = "Opening draft text with a substantive revision.";
  const banked = service.bankCurrentRevision({
    reason: "revision-storage-test",
    writingSessionBoundaryKey: "revision-storage-test",
  });

  assert.equal(banked.banked, true);
  assert.equal(revisionState.sessions[0].metadata.status, "finalised");
  assert.equal(revisionState.sessions[0].diff.operations.length > 0, true);
  assert.equal(revisionState.sessions[0].summaryMarkdown.includes("Revision Summary"), true);
  assert.equal(revisionState.sessions[0].changedEntities.some((entity) => entity.entityType === "scene"), true);
}
