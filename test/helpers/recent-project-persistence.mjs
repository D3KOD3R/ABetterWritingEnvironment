// Exercise real browser repository, persistence, activation and desktop package IO together.
// A single-project package is authoritative for content, never for Recent registry membership.
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createBrowserStorageAdapter } from "../../apps/editor/public/adapters/storage/browser-storage-adapter.js";
import { createPreferencesRepository } from "../../apps/editor/public/adapters/storage/preferences-repository.js";
import { createProjectRepository } from "../../apps/editor/public/adapters/storage/project-repository.js";
import { createProjectService } from "../../apps/editor/public/adapters/storage/project-service.js";
import { createProjectPersistenceService, buildPortableExternalProjectSnapshot } from "../../apps/editor/public/adapters/storage/project-persistence-service.js";
import { createProjectActivationStateService } from "../../apps/editor/public/state/project-activation-state.js";
import { createProjectActivationController } from "../../apps/editor/public/state/project-activation-controller.js";
import { buildSceneRecords } from "../../apps/editor/public/editor-model.js";
import { migrateProjectData } from "../../apps/editor/public/adapters/storage/project-migrations.js";

export async function assertRecentPackageRoundTrip({ root, sendJson }) {
  const storage = new Map();
  const writes = [];
  const windowRef = {
    localStorage: {
      get length() { return storage.size; },
      key: index => [...storage.keys()][index],
      getItem: key => storage.get(key) ?? null,
      setItem(key, value) { storage.set(key, String(value)); writes.push(key); },
      removeItem(key) { storage.delete(key); writes.push(key); },
    },
    setTimeout: () => 1, clearTimeout() {},
  };
  const adapter = createBrowserStorageAdapter({ windowRef });
  const repository = createProjectRepository({ storageAdapter: adapter });
  const projectService = createProjectService({
    projectRepository: repository, preferencesRepository: createPreferencesRepository({ storageAdapter: adapter }),
  });
  const makeRecord = letter => {
    const sceneId = "scene-0001", chapterId = "chapter-0001";
    const text = letter === "A" ? "ALPHA lighthouse" : letter === "B" ? "BRAVO observatory" : "CHARLIE mountain";
    const scene = { sceneId, chapterId, chapterTitle: letter + " CHAPTER", sceneTitle: letter + " SCENE", editorText: text,
      blocks: [{ blockId: "block-1", lineNumber: 1, kind: "narration", text, issueIds: [], eventTagIds: [] }] };
    const record = {
      id: "recent-" + letter, title: "RECENT " + letter, schemaVersion: 2,
      workspace: { project: { id: "recent-" + letter, title: "RECENT " + letter, stats: {},
        lines: [{ ...scene.blocks[0], sceneId, chapterId, chapterTitle: scene.chapterTitle, sceneTitle: scene.sceneTitle }] }, world: { stats: {} } },
      sceneDrafts: { [sceneId]: scene },
      structureDrafts: { scenes: [{ sceneId, chapterId, chapterTitle: scene.chapterTitle, sceneTitle: scene.sceneTitle, order: 1 }] },
      projectSettings: { activeSceneId: sceneId, projectFilePath: path.join(root, "RECENT " + letter), editorPrefs: { projectFileAutosaveEnabled: true } },
    };
    return migrateProjectData({ projects: [record], activeProjectId: record.id }).projects[0];
  };
  const records = ["A", "B", "C"].map(makeRecord);
  const [a, b, c] = records;
  for (const record of [a, b]) {
    const snapshot = buildPortableExternalProjectSnapshot({ activeProjectId: record.id, projects: [record] });
    const staged = await sendJson("/api/project-package/create", { parentPath: root, folderName: record.title, snapshot });
    assert.equal(staged.response.statusCode, 200);
    const committed = await sendJson("/api/project-package/commit", { operationToken: staged.value.operationToken });
    assert.equal(committed.response.statusCode, 200);
  }
  const library = projectService.saveProjectLibrarySnapshot({ activeProjectId: a.id, projects: records });
  const state = { projectLibrary: library.projects, activeProjectId: a.id, projectLibrarySelectionId: a.id,
    workspace: structuredClone(a.workspace), sceneDrafts: structuredClone(a.sceneDrafts), structureDrafts: structuredClone(a.structureDrafts),
    projectTitle: a.title, projectFilePath: a.projectSettings.projectFilePath, projectFileStorageMode: "desktop-package",
    projectFileHandle: null, editorPrefs: { projectFileAutosaveEnabled: true }, writingTargetState: {} };
  let service, controller;
  const boundaries = [];
  const observe = phase => {
    const ids = projectService.loadProjectLibrarySnapshot().projects.map(r => r.id).sort();
    boundaries.push({ phase, ids });
    assert.deepEqual(ids, records.map(r => r.id).sort(), phase + ": unrelated registry membership must survive");
  };
  // This test makes no author edits between switches. Return the current canonical record,
  // avoiding artificial mutations from runtime-only hydration fields in the test adapter.
  const runtimeRecord = () => structuredClone(state.projectLibrary.find(r => r.id === state.activeProjectId));
  const stateService = createProjectActivationStateService({
    state, createStructureDrafts: () => ({ scenes: [] }), createTemplateDrafts: () => [],
    normalizeManuscriptTasks: value => value ?? [], normalizePassageNotes: value => value ?? [],
    readRevisionState: () => ({}), createRevisionPanelStateForProject: () => ({}),
    buildProjectSettingsCandidate: record => record.projectSettings,
    normalizeProjectSettingsSnapshot: value => ({ ...value, localAiPrefs: {}, collapsedChapterIds: [], collapsedConsoleChapterIds: {} }),
    getProjectRecordWordCountForSettings: () => 2, normalizeSpellcheckProjectSettings: value => value ?? {},
  });
  const getActive = () => state.projectLibrary.find(r => r.id === state.activeProjectId);
  const requests = [];
  service = createProjectPersistenceService({
    state, windowRef, projectService, projectRepository: repository,
    fetchJsonFromDesktopApi: async (pathname, options = {}) => {
      const body = options.body ?? {}; requests.push({ pathname, body });
      if (pathname === "/api/settings") return { ok: true, value: {} };
      const result = await sendJson(pathname, body);
      if (result.response.statusCode !== 200) throw Error(result.value.error ?? JSON.stringify(result.value));
      if (pathname === "/api/project-package/load") observe("durable-loaded-before-hydration");
      return { ok: true, value: result.value };
    },
    createProjectRecordFromRuntimeState: runtimeRecord, getActiveProjectRecord: getActive,
    normalizeProjectLibrarySnapshot: migrateProjectData, normalizeProjectRecord: record => record,
    resolveActiveProjectId: (id, snapshot) => id ?? snapshot.projects[0]?.id,
    activateLoadedProjectRecord: ({ projectRecord, projectFileDestination }) => {
      observe("cache-refreshed-before-activation");
      controller.activateProjectRecord(projectRecord, { projectFileDestination, renderAfter: true });
      observe("after-activation");
    },
  });
  const noop = () => {};
  controller = createProjectActivationController({
    state, clone: structuredClone,
    ...Object.fromEntries(["saveWritingTargetState","clearWritingTargetDraft","clearWritingTargetSnapshotTimer",
      "setNarrationRecordingRuntime","cleanupNarrationRecordingRuntime","setVoiceRecordingPreviewAudio","setVoiceRecordingPreviewUrl",
      "revokeObjectUrl","clearBinderTitleClickState","writeProjectSourcePath","writeBinderWidth","writeConsoleWidth",
      "writePanelResizerLayoutProfiles","persistConsoleDockCollapsedState","persistCollapsedChapterState","persistCollapsedConsoleChapterState",
      "writeWritingTargetStore","syncLegacyProjectStorageFromState","logWritingTargetDebugEvent",
      "restoreSelectionFromWorkspaceDefaults","syncWritingTargetState","refreshWritingTargetSessionLifecycle","logWritingTargetLoadCheckpoint",
      "recordWritingTargetSnapshot"].map(key => [key, noop])),
    getNarrationRecordingRuntime: () => null, getVoiceRecordingPreviewAudio: () => null,
    getVoiceRecordingPreviewUrl: () => "", readWritingTargetStore: () => ({}),
    clearProjectAutosaveState: () => service.clearProjectAutosaveState(),
    persistActiveProjectId: id => service.persistActiveProjectId(id),
    applyProjectRecordToState(record, options) { stateService.applyProjectRecordToState(record, options); observe("after-hydration"); },
    refreshScenes() { state.scenes = buildSceneRecords(state.workspace, state.sceneDrafts, state.structureDrafts); },
    render() {
      const expected = records.find(r => r.id === state.activeProjectId);
      assert.equal(state.projectFilePath, expected.projectSettings.projectFilePath);
      assert.equal(state.projectFileStorageMode, "desktop-package");
      assert.equal(state.scenes[0].editorText, expected.sceneDrafts["scene-0001"].editorText);
      assert.equal(state.scenes[0].chapterTitle, expected.title.at(-1) + " CHAPTER");
      assert.equal(state.scenes[0].sceneTitle, expected.title.at(-1) + " SCENE");
      observe("render");
    },
  });
  const fingerprint = directory => {
    const result = {};
    const visit = (dir, prefix = "") => {
      for (const item of readdirSync(dir, { withFileTypes: true })) {
        const relative = path.join(prefix, item.name);
        if (item.isDirectory()) visit(path.join(dir, item.name), relative);
        else result[relative] = createHash("sha256").update(readFileSync(path.join(dir, item.name))).digest("hex");
      }
    };
    visit(directory); return result;
  };

  // Reproduce the captured destructive boundary before exercising the expanded Recent route.
  await service.saveProjectSnapshot({ reason: "autosave" });
  observe("after-single-project-autosave");
  const cKeys = [...storage.keys()].filter(key => key.includes(c.id));
  const cBefore = cKeys.map(key => [key, storage.get(key)]);
  for (const expected of [b, a, b]) {
    const other = expected.id === b.id ? a : b;
    const untouched = fingerprint(other.projectSettings.projectFilePath);
    // The disk copy must win even when the same scene ID has a conflicting cached body.
    repository.saveScene(expected.id, "scene-0001", { ...expected.sceneDrafts["scene-0001"], editorText: "STALE CACHE", blocks: [] });
    observe("before-click");
    const clickedRecord = state.projectLibrary.find(r => r.id === expected.id);
    assert.ok(clickedRecord);
    await service.activateRecentProject(clickedRecord.id);
    assert.equal(state.activeProjectId, expected.id);
    assert.deepEqual(state.projectFileAutosaveTarget, { projectId: expected.id, filePath: expected.projectSettings.projectFilePath, fileHandle: null });
    assert.ok(requests.some(r => r.pathname === "/api/project-package/load" && r.body.rootPath === expected.projectSettings.projectFilePath));
    service.markProjectAutosaveDirty({ reason: "recent-regression" });
    await service.flushProjectAutosave();
    observe("after-autosave");
    assert.deepEqual(fingerprint(other.projectSettings.projectFilePath), untouched, "non-selected package changed");
    assert.deepEqual(cKeys.map(key => [key, storage.get(key)]), cBefore, "unrelated C cache changed");
  }
  assert.ok(boundaries.some(b => b.phase === "after-hydration"));
  // A broken/mismatched Recent destination must leave the active project intact and
  // must never fall back to the selected row's stale cached manuscript.
  const activeBeforeFailure = state.activeProjectId;
  const aRow = state.projectLibrary.find(r => r.id === a.id);
  const originalRoot = aRow.projectSettings.projectFilePath;
  aRow.projectSettings.projectFilePath = b.projectSettings.projectFilePath;
  await assert.rejects(() => service.activateRecentProject(a.id), /different project/);
  assert.equal(state.activeProjectId, activeBeforeFailure);
  aRow.projectSettings.projectFilePath = path.join(root, "Missing package");
  await assert.rejects(() => service.activateRecentProject(a.id));
  assert.equal(state.activeProjectId, activeBeforeFailure);
  aRow.projectSettings.projectFilePath = originalRoot;
  observe("failed-load-preserves-registry");
}
