// Intent: build a repeatable revision-history fixture from a source project file for panel testing.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectLibrarySeedFromPath } from "../apps/desktop/src/project-source.ts";
import { createEmptyRevisionProjectState, createRevisionStorageService, normalizeRevisionProjectState } from "../apps/editor/public/adapters/storage/revision-storage-service.js";
import { createRevisionPanelController } from "../apps/editor/public/features/revisions/revision-panel-controller.js";
import { createRevisionService } from "../apps/editor/public/features/revisions/revision-service.js";

const DEFAULT_SOURCE_FIXTURE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "SaveTestFile",
  "RevisionsTest",
  "RevisionsTestOriginFileproject-serva-vitae.abe-project.json",
);

const DEFAULT_TIME_SERIES = [
  "2026-05-18T09:00:00.000Z",
  "2026-05-18T09:03:00.000Z",
  "2026-05-18T09:10:00.000Z",
  "2026-05-18T09:25:00.000Z",
  "2026-05-18T09:40:00.000Z",
  "2026-05-18T09:55:00.000Z",
];

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function createIdFactory() {
  let counter = 0;
  return (prefix = "revision-session") => {
    counter += 1;
    return `${prefix}-fixture-${String(counter).padStart(2, "0")}`;
  };
}

function hasRevisionSessions(revisionState) {
  return Array.isArray(revisionState?.sessions) && revisionState.sessions.length > 0;
}

function updateSceneDraftText(projectRecord, sceneId, text) {
  const drafts = projectRecord?.sceneDrafts;
  if (!drafts || typeof drafts !== "object") {
    return false;
  }

  const draft = drafts[sceneId];
  if (!draft || typeof draft !== "object") {
    return false;
  }

  draft.editorText = text;
  return true;
}

function updateSceneLineText(projectRecord, sceneId, text) {
  if (!Array.isArray(projectRecord?.workspace?.project?.lines)) {
    return false;
  }

  let updated = false;
  for (const line of projectRecord.workspace.project.lines) {
    if (line?.sceneId !== sceneId) {
      continue;
    }
    if (!updated) {
      line.text = text;
      updated = true;
      continue;
    }
    if (typeof line.text === "string" && line.text.trim()) {
      break;
    }
  }
  return updated;
}

function applySessionOneChanges(projectRecord) {
  // Intent: seed a visible manuscript rewrite, a task edit, and a world entity edit for the panel.
  const openingText = [
    "REVISIONSTEST A",
    "John wakes to a colder, sharper version of the opening dream.",
    "The revised passage keeps the same scene anchor but changes the rhythm and wording enough to generate a clear diff.",
  ].join("\n\n");
  updateSceneDraftText(projectRecord, "scene-0001", openingText);
  updateSceneLineText(projectRecord, "scene-0001", openingText);

  const firstTask = Array.isArray(projectRecord.manuscriptTasks) ? projectRecord.manuscriptTasks[0] : null;
  if (firstTask) {
    firstTask.title = `${String(firstTask.title ?? "Revision Task")} (seeded panel check)`;
    firstTask.body = `${String(firstTask.body ?? firstTask.description ?? "Revision body")} This fixture adds an explicit task edit so the revision panel has a non-scene entity to display.`;
    firstTask.description = firstTask.body;
    firstTask.status = "in-progress";
  }

  const firstEntity = Array.isArray(projectRecord.workspace?.world?.entities)
    ? projectRecord.workspace.world.entities[0]
    : null;
  if (firstEntity) {
    firstEntity.name = `${String(firstEntity.name ?? firstEntity.title ?? "World Entity")} Revised`;
    firstEntity.notes = `${String(firstEntity.notes ?? "")}\n\nSeeded revision-panel fixture note: this entity was adjusted for diff coverage.`;
  }
}

function applySessionTwoChanges(projectRecord) {
  // Intent: seed a second session with a different scene and a different origin for panel filtering.
  const closingText = [
    "REVISIONSTEST B",
    "The second seeded pass tightens the closing scene for a clearer follow-up revision record.",
    "It gives the panel a second banked session with different content and a different origin label.",
  ].join("\n\n");
  updateSceneDraftText(projectRecord, "scene-0023", closingText);
  updateSceneLineText(projectRecord, "scene-0023", closingText);

  const secondTask = Array.isArray(projectRecord.manuscriptTasks) ? projectRecord.manuscriptTasks[1] : null;
  if (secondTask) {
    secondTask.title = `${String(secondTask.title ?? "Revision Task")} (local AI pass)`;
    secondTask.body = `${String(secondTask.body ?? secondTask.description ?? "Revision body")} This second session gives the filter UI a different event origin and another changed entity.`;
    secondTask.description = secondTask.body;
    secondTask.status = "open";
  }
}

function writeTextFile(filePath, content) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
}

function writeJsonFile(filePath, value) {
  writeTextFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function buildSeededRevisionState(projectRecord, { nowSeries = DEFAULT_TIME_SERIES } = {}) {
  const timeSeries = [...nowSeries];
  const nextNow = () => timeSeries.shift() ?? "2026-05-18T10:00:00.000Z";
  const getProjectSnapshot = () => projectRecord;
  let revisionState = normalizeRevisionProjectState(projectRecord.revisions);

  const service = createRevisionService({
    getProjectRecord: () => projectRecord,
    getProjectSnapshot,
    getRevisionState: () => revisionState,
    setRevisionState: (nextState) => {
      revisionState = normalizeRevisionProjectState(nextState);
      projectRecord.revisions = revisionState;
    },
    now: nextNow,
    idFactory: createIdFactory(),
  });

  // Intent: capture the first session from the original source state before mutating the project.
  service.startSession({
    title: "Fixture Revision Session A",
    description: "Seeded session for manuscript, task, and world entity coverage.",
    startedAt: nextNow(),
    origin: "manual_editor",
    sourceService: "RevisionFixtureSeeder",
  });
  applySessionOneChanges(projectRecord);
  service.recordEvent({
    eventType: "manuscript_edit",
    entityType: "scene",
    entityId: "scene-0001",
    description: "Refined the opening scene prose",
    changeCategory: "manuscript",
    origin: "manual_editor",
    sourceService: "RevisionFixtureSeeder",
  });
  service.recordEvent({
    eventType: "manuscript_edit",
    entityType: "scene",
    entityId: "scene-0001",
    description: "Refined the opening scene prose",
    changeCategory: "manuscript",
    origin: "manual_editor",
    sourceService: "RevisionFixtureSeeder",
  });
  service.recordEvent({
    eventType: "task_edit",
    entityType: "manuscript_task",
    entityId: String(projectRecord.manuscriptTasks?.[0]?.id ?? ""),
    description: "Adjusted a task record for diff coverage",
    changeCategory: "task",
    origin: "manual_editor",
    sourceService: "RevisionFixtureSeeder",
  });
  service.recordEvent({
    eventType: "entity_edit",
    entityType: "world_entity",
    entityId: String(projectRecord.workspace?.world?.entities?.[0]?.id ?? ""),
    description: "Adjusted a world entity for diff coverage",
    changeCategory: "worldbuilding",
    origin: "manual_editor",
    sourceService: "RevisionFixtureSeeder",
  });
  const sessionA = service.bankCurrentRevision({
    reason: "fixture-seeded-session-a",
    writingSessionBoundaryKey: "fixture-session-a",
    markWorkingState: false,
  }).session;

  if (sessionA?.metadata?.id) {
    service.archiveSession(sessionA.metadata.id);
  }

  // Intent: capture a second session against the already-updated source state with a different origin.
  service.startSession({
    title: "Fixture Revision Session B",
    description: "Seeded session for alternate scene and task coverage.",
    startedAt: nextNow(),
    origin: "local_ai",
    sourceService: "RevisionFixtureSeeder",
  });
  applySessionTwoChanges(projectRecord);
  service.recordEvent({
    eventType: "manuscript_edit",
    entityType: "scene",
    entityId: "scene-0023",
    description: "Adjusted the closing scene prose",
    changeCategory: "manuscript",
    origin: "local_ai",
    sourceService: "RevisionFixtureSeeder",
  });
  service.recordEvent({
    eventType: "task_edit",
    entityType: "manuscript_task",
    entityId: String(projectRecord.manuscriptTasks?.[1]?.id ?? ""),
    description: "Adjusted a follow-up task record for diff coverage",
    changeCategory: "research",
    origin: "local_ai",
    sourceService: "RevisionFixtureSeeder",
  });
  const sessionB = service.bankCurrentRevision({
    reason: "fixture-seeded-session-b",
    writingSessionBoundaryKey: "fixture-session-b",
    markWorkingState: false,
  }).session;

  const storageService = createRevisionStorageService();
  storageService.writeRevisionState(projectRecord, revisionState);
  const normalizedRevisionState = storageService.readRevisionState(projectRecord);

  return {
    projectRecord,
    revisionState: normalizedRevisionState,
    sessions: normalizedRevisionState.sessions,
    sessionA,
    sessionB,
  };
}

function buildCanonicalRevisionFixture(sourceProject) {
  const projectRecord = cloneValue(sourceProject);
  projectRecord.revisions = createEmptyRevisionProjectState();
  return buildSeededRevisionState(projectRecord);
}

function buildRevisionFixtureFromProject(projectRecord, {
  revisionFixtureMode = "reuse-existing",
} = {}) {
  const normalizedState = normalizeRevisionProjectState(projectRecord.revisions);
  if (revisionFixtureMode !== "replace-existing" && hasRevisionSessions(normalizedState)) {
    return {
      projectRecord,
      revisionState: normalizedState,
      sessions: normalizedState.sessions,
      sessionA: normalizedState.sessions[0] ?? null,
      sessionB: normalizedState.sessions[1] ?? null,
      wasSeeded: false,
    };
  }

  const seeded = buildCanonicalRevisionFixture(projectRecord);
  return {
    ...seeded,
    wasSeeded: true,
  };
}

function writeRevisionPackage(outputRoot, projectRecord, revisionState) {
  // Intent: mirror the future desktop revisions folder layout so the fixture is inspectable on disk.
  const root = path.resolve(outputRoot);
  const revisionsRoot = path.join(root, "revisions");
  const sessionsRoot = path.join(revisionsRoot, "sessions");
  const projectOutputPath = path.join(root, "project.json");
  const revisionsIndexPath = path.join(revisionsRoot, "index.json");

  mkdirSync(sessionsRoot, { recursive: true });

  const sessionIndex = revisionState.sessions.map((session) => {
    const sessionRoot = path.join(sessionsRoot, session.metadata.id);
    const revisionJsonPath = path.join(sessionRoot, "revision.json");
    const eventsJsonPath = path.join(sessionRoot, "events.json");
    const diffJsonPath = path.join(sessionRoot, "project.diff.json");
    const summaryPath = path.join(sessionRoot, "summary.md");

    mkdirSync(sessionRoot, { recursive: true });
    writeJsonFile(revisionJsonPath, session);
    writeJsonFile(eventsJsonPath, session.events ?? []);
    writeJsonFile(diffJsonPath, session.diff ?? null);
    writeTextFile(summaryPath, `${String(session.summaryMarkdown ?? "").trim()}\n`);

    return {
      id: session.metadata.id,
      status: session.metadata.status,
      title: session.metadata.title,
      sessionPath: path.relative(root, revisionJsonPath),
      eventsPath: path.relative(root, eventsJsonPath),
      diffPath: path.relative(root, diffJsonPath),
      summaryPath: path.relative(root, summaryPath),
    };
  });

  writeJsonFile(projectOutputPath, {
    ...cloneValue(projectRecord),
    revisions: cloneValue(revisionState),
  });

  writeJsonFile(revisionsIndexPath, {
    schemaVersion: revisionState.schemaVersion ?? 1,
    activeSessionId: revisionState.activeSessionId,
    sessions: sessionIndex,
    projectPath: path.relative(root, projectOutputPath),
  });

  return {
    projectOutputPath,
    revisionsIndexPath,
    sessionIndex,
    revisionsRoot,
  };
}

export function createRevisionPanelFixture({
  sourcePath = DEFAULT_SOURCE_FIXTURE,
  outputRoot,
  revisionFixtureMode = "reuse-existing",
} = {}) {
  const library = loadProjectLibrarySeedFromPath(sourcePath);
  const sourceProject = library.projects[0];
  if (!sourceProject) {
    throw new Error(`No project record was found in ${sourcePath}`);
  }

  const seeded = buildRevisionFixtureFromProject(cloneValue(sourceProject), {
    revisionFixtureMode,
  });
  const modelController = createRevisionPanelController();
  const panelModel = modelController.buildPanelModel(seeded.revisionState, {
    selectedSessionId: seeded.sessions.at(-1)?.metadata.id ?? "",
    showFullDiff: true,
  });

  const packagePaths = outputRoot
    ? writeRevisionPackage(outputRoot, seeded.projectRecord, seeded.revisionState)
    : null;

  return {
    sourcePath,
    sourceProject,
    projectRecord: seeded.projectRecord,
    revisionState: seeded.revisionState,
    panelModel,
    packagePaths,
    wasSeeded: seeded.wasSeeded ?? false,
  };
}

export function getDefaultRevisionFixtureSourcePath() {
  return DEFAULT_SOURCE_FIXTURE;
}

export function seedRevisionFixtureSourceFile({
  sourcePath = DEFAULT_SOURCE_FIXTURE,
} = {}) {
  const library = loadProjectLibrarySeedFromPath(sourcePath);
  const sourceProject = library.projects[0];
  if (!sourceProject) {
    throw new Error(`No project record was found in ${sourcePath}`);
  }

  const seeded = buildCanonicalRevisionFixture(sourceProject);
  const projectJson = {
    ...cloneValue(seeded.projectRecord),
    revisions: cloneValue(seeded.revisionState),
  };
  writeJsonFile(sourcePath, projectJson);
  return {
    sourcePath,
    projectId: seeded.projectRecord.id,
    sessionCount: seeded.revisionState.sessions.length,
    revisionState: seeded.revisionState,
    projectRecord: seeded.projectRecord,
  };
}
