// Exercise bootstrap authority and explicit legacy persistence through real service/host boundaries.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testPath = fileURLToPath(import.meta.url);
const worktree = path.resolve(path.dirname(testPath), "..");
const childFlag = "--default-seed-legacy-save-child";

function sourceFootprint() {
  const files = ["project-serva-vitae.abe-project.json", "apps/desktop/.desktop-state.json"];
  return {
    packageEntries: readdirSync(worktree).filter((name) => /\.abe-project(?:\.|$)/i.test(name)).sort(),
    files: Object.fromEntries(files.map((name) => {
      const filePath = path.join(worktree, name);
      return [name, existsSync(filePath) ? createHash("sha256").update(readFileSync(filePath)).digest("hex") : null];
    })),
  };
}

export async function runProjectDefaultSeedLegacySaveTest() {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "abe-default-seed-legacy-save-"));
  const before = sourceFootprint();
  try {
    // Match normal desktop cwd; only the test's explicit author destinations and logs use OS-temp paths.
    const child = spawnSync(process.execPath, ["--experimental-strip-types", testPath, childFlag], {
      cwd: worktree,
      encoding: "utf8",
      timeout: 60_000,
      env: {
        ...process.env,
        ABE_DEFAULT_SEED_TEST_ROOT: temporaryRoot,
        ABE_LOG_PATH: path.join(temporaryRoot, "desktop.log"),
        ABE_DEVELOPER_RUNTIME_LOG_DIR: path.join(temporaryRoot, "runtime-logs"),
      },
    });
    assert.equal(child.error, undefined, child.error?.message);
    assert.equal(child.status, 0, `${child.stdout}\n${child.stderr}`);
    assert.deepEqual(sourceFootprint(), before, "Startup/save must not change source fixtures, packages, or desktop state.");
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

async function runChild() {
  const temporaryRoot = process.env.ABE_DEFAULT_SEED_TEST_ROOT;
  assert.ok(temporaryRoot);
  const { createDesktopResponseForRequest } = await import("../apps/desktop/src/http-app.ts");
  const { createProjectPersistenceService } = await import("../apps/editor/public/adapters/storage/project-persistence-service.js");
  const { createBrowserStorageAdapter } = await import("../apps/editor/public/adapters/storage/browser-storage-adapter.js");
  const { createProjectRepository } = await import("../apps/editor/public/adapters/storage/project-repository.js");
  const { createPreferencesRepository } = await import("../apps/editor/public/adapters/storage/preferences-repository.js");
  const { createProjectService } = await import("../apps/editor/public/adapters/storage/project-service.js");
  const { assertProjectSnapshotsSemanticallyEquivalent } = await import("../apps/editor/public/adapters/storage/project-snapshot-verification.js");
  const calls = [];
  const preferences = [];
  let corruptReadback = false;
  let failWrite = false;
  const request = async (pathname, options = {}) => {
    calls.push({ pathname, body: structuredClone(options.body) });
    // Capture the real service's machine-pointer requests without changing module-relative desktop settings.
    if (pathname === "/api/settings") {
      preferences.push(structuredClone(options.body));
      return { ok: true, value: {} };
    }
    if (failWrite && pathname === "/api/project-file/save") {
      return { ok: false, error: new Error("Injected durable write failure.") };
    }
    const response = await createDesktopResponseForRequest({
      method: options.method ?? "GET", pathname,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const value = JSON.parse(response.body);
    if (response.statusCode !== 200) return { ok: false, error: new Error(value.message) };
    if (corruptReadback && pathname === "/api/project-file/load") {
      value.sceneStore[value.activeProjectId]["scene-2"].editorText = "The manuscript was lost.";
    }
    return { ok: true, value };
  };

  function createRuntime(snapshot) {
    const memory = new Map();
    const windowRef = {
      localStorage: {
        getItem: (key) => memory.get(key) ?? null,
        setItem: (key, value) => memory.set(key, String(value)),
        removeItem: (key) => memory.delete(key),
      },
      setTimeout: (callback) => ({ callback }),
      clearTimeout: () => {},
    };
    const storageAdapter = createBrowserStorageAdapter({ windowRef });
    const projectRepository = createProjectRepository({ storageAdapter });
    const projectService = createProjectService({
      projectRepository, preferencesRepository: createPreferencesRepository({ storageAdapter }),
    });
    const library = projectService.saveProjectLibrarySnapshot(structuredClone(snapshot), { replaceExistingCache: true });
    const state = {
      projectLibrary: library.projects, activeProjectId: library.activeProjectId,
      projectLibrarySelectionId: library.activeProjectId,
      projectFilePath: "", projectFileStorageMode: "", projectFileHandle: null,
      projectFileBusy: false, projectFileAutosaveDirty: false, projectFileAutosaveBlocked: null,
      projectFileAutosaveRevision: 0, projectFileAutosaveTarget: null, projectFileAutosaveTimer: null,
      projectFileAutosaveSuppressionDepth: 0, projectCacheSuppressionDepth: 0,
      projectPersistenceDirtyDomains: {}, editorPrefs: { projectFileAutosaveEnabled: true },
    };
    const active = () => state.projectLibrary.find((project) => project.id === state.activeProjectId);
    state.workspace = structuredClone(active().workspace);
    state.projectTitle = active().title;
    const service = createProjectPersistenceService({
      state, windowRef, projectRepository, projectService, fetchJsonFromDesktopApi: request,
      projectSchemaVersion: 2, autosaveDelayMs: 1,
      shouldPersistProjectCache: () => state.projectCacheSuppressionDepth === 0,
      getActiveProjectRecord: active,
      createProjectRecordFromRuntimeState: () => ({
        ...active(), workspace: structuredClone(state.workspace),
        projectSettings: { ...active().projectSettings, projectFilePath: state.projectFilePath },
      }),
      normalizeProjectLibrarySnapshot: (candidate) => candidate,
      normalizeProjectRecord: (candidate) => candidate,
      resolveActiveProjectId: (candidate, snapshot) => candidate ?? snapshot.projects[0]?.id,
      activateLoadedProjectRecord: ({ projectRecord }) => {
        state.workspace = structuredClone(projectRecord.workspace);
        state.projectTitle = projectRecord.title;
      },
    });
    return { state, service, active, memory };
  }

  // A fresh desktop seed follows the same record-sync/reconnect/autosave entry points as browser boot.
  const seedResult = await request("/api/project-library");
  assert.equal(seedResult.ok, true);
  for (const project of seedResult.value.projects) {
    assert.equal(project.projectSettings.projectFilePath, "");
    assert.equal(project.projectFilePath, undefined);
  }
  const seed = createRuntime(seedResult.value);
  seed.service.syncActiveProjectFileDestinationFromRecord({ persistDesktopProjectFilePath: false, source: "boot" });
  await seed.service.restoreLastOpenedProject({ lastProjectFilePath: "C:\\Old\\unused.json", lastProjectFilePathExplicit: false });
  assert.equal(seed.state.projectFilePath, "");
  assert.equal(preferences.some((entry) => entry.lastProjectFilePathExplicit === true), false);
  seed.service.primeProjectAutosaveTarget();
  seed.state.workspace.project.title += " edited bootstrap";
  seed.service.commitCanonicalProjectMutation({ domain: "project", source: "startup-edit", dirtyReason: "title" });
  await seed.service.flushProjectAutosave();
  const seedSave = await seed.service.saveProjectSnapshot({ reason: "autosave" });
  assert.equal(seedSave.projectFilePersisted, false);
  assert.equal(seedSave.fallbackPersisted, true);
  assert.equal(seed.state.projectFilePath, "");
  assert.equal(calls.some(({ pathname }) => /\/api\/project-(?:file|package)\/(?:save|create)/.test(pathname)), false);
  assert.equal(existsSync(path.join(worktree, "project-serva-vitae.abe-project")), false);

  // Destinationless bootstrap cannot be replaced without a fresh, explicit user decision.
  const newRoot = path.join(temporaryRoot, "Explicit New");
  const newOptions = { parentPath: temporaryRoot, folderName: "Explicit New", buildCandidateSnapshot: createManuscriptSnapshot };
  await assert.rejects(() => seed.service.createDesktopProjectPackage(newOptions), /no durable destination/);
  const bootstrapBeforeCancel = structuredClone(seed.state);
  let confirmations = 0;
  const cancelled = await seed.service.createDesktopProjectPackage({ ...newOptions,
    confirmDiscardUnsaved: () => { confirmations += 1; return false; },
    buildCandidateSnapshot: () => assert.fail("Cancel must not construct a new project."),
  });
  assert.equal(cancelled.status, "cancelled");
  assert.equal(confirmations, 1);
  assert.deepEqual(seed.state, bootstrapBeforeCancel);
  assert.equal(existsSync(newRoot), false);
  // Discard consent authorizes replacement only after successful publication; failure retains the bootstrap.
  await assert.rejects(() => seed.service.createDesktopProjectPackage({ ...newOptions,
    parentPath: path.join(temporaryRoot, "missing-parent"), confirmDiscardUnsaved: () => true,
  }));
  assert.equal(seed.state.activeProjectId, bootstrapBeforeCancel.activeProjectId);
  assert.deepEqual(seed.state.workspace, bootstrapBeforeCancel.workspace);
  assert.equal(seed.state.projectFileAutosaveDirty, true);
  assert.equal(seed.state.projectFilePath, "");
  const created = await seed.service.createDesktopProjectPackage({ ...newOptions,
    confirmDiscardUnsaved: () => { confirmations += 1; return true; },
  });
  assert.equal(created.status, "created");
  assert.equal(confirmations, 2);
  assert.equal(seed.state.projectFilePath, newRoot);
  assert.equal(seed.state.projectFileStorageMode, "desktop-package");
  assert.equal(seed.state.activeProjectId, "legacy-novel");
  assert.equal(existsSync(path.join(newRoot, "project.json")), true);
  assert.equal(seed.state.projectFileAutosaveDirty, false);
  assert.equal(existsSync(path.join(worktree, "project-serva-vitae.abe-project")), false);

  const legacyPath = path.join(temporaryRoot, "legacy-novel.abe-project.json");
  const legacySnapshot = createManuscriptSnapshot();
  writeFileSync(legacyPath, JSON.stringify(legacySnapshot, null, 2));
  const loaded = await request("/api/project-file/load", { method: "POST", body: { filePath: legacyPath } });
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.value.sceneStore, legacySnapshot.sceneStore, "Legacy JSON must not be read as a sidecar manifest.");
  const legacy = createRuntime(legacySnapshot);
  await legacy.service.hydrateProjectLibraryFromLoadedSnapshot(loaded.value, {
    filePath: legacyPath, mode: "desktop-path", reason: "explicit-open", preserveProjectIdentity: true,
  });
  assert.equal(legacy.state.projectFilePath, legacyPath);
  assert.equal(legacy.state.projectFileStorageMode, "desktop-path");
  assert.ok(preferences.some((entry) => entry.lastProjectFilePath === legacyPath && entry.lastProjectFilePathExplicit === true));

  // Exercise the autosave coordinator, serializer, explicit transport, physical JSON, and durable readback together.
  const editedText = "Mara opened the brass gate.\n\nBeyond it, the winter sea remembered her name.";
  legacy.active().projectSettings.activeSceneId = "scene-2";
  legacy.state.workspace.selectionDefaults.sceneId = "scene-2";
  legacy.active().sceneDrafts["scene-2"] = { ...legacySnapshot.sceneStore["legacy-novel"]["scene-2"], editorText: editedText,
    blocks: [{ blockId: "block-2", kind: "narration", text: editedText }] };
  legacy.service.commitCanonicalProjectMutation({ domain: "manuscript", changedSceneIds: ["scene-2"], source: "editor-change" });
  await legacy.service.flushProjectAutosave();
  assert.equal(legacy.state.projectFileAutosaveDirty, false);
  assert.equal(legacy.state.projectFileAutosaveBlocked, null);
  assert.equal(legacy.state.projectFilePath, legacyPath);
  assert.equal(statSync(legacyPath).isFile(), true);
  assert.equal(existsSync(legacyPath.replace(/\.json$/, "")), false);
  const saved = JSON.parse(readFileSync(legacyPath, "utf8"));
  assert.equal(saved.sceneStore["legacy-novel"]["scene-2"].editorText, editedText);
  assert.equal(saved.sceneStore["legacy-novel"]["scene-1"].blocks[0].text, legacySnapshot.sceneStore["legacy-novel"]["scene-1"].blocks[0].text);
  assert.equal(saved.projects[0].workspace.project.chapters[1].title, "The Return");
  const reloaded = await request("/api/project-file/load", { method: "POST", body: { filePath: legacyPath } });
  assert.deepEqual(reloaded.value, saved);
  const reopened = createRuntime(legacySnapshot);
  await reopened.service.restoreLastOpenedProject({ lastProjectFilePath: legacyPath, lastProjectFilePathExplicit: true });
  assert.equal(reopened.state.projectFilePath, legacyPath);
  assert.equal(reopened.state.projectFileStorageMode, "desktop-path");
  assert.equal((await reopened.service.saveProjectSnapshot({ reason: "manual-save" })).projectFilePersisted, true);

  // A failed verification cannot adopt a different path; the genuine write failure still blocks New Project.
  const failedDestination = path.join(temporaryRoot, "unverified.abe-project.json");
  corruptReadback = true;
  await assert.rejects(() => legacy.service.saveProjectSnapshotToFilePath(failedDestination, saved), /verification failed/);
  corruptReadback = false;
  assert.equal(legacy.state.projectFilePath, legacyPath);
  assert.equal(preferences.some((entry) => entry.lastProjectFilePath === failedDestination), false);
  failWrite = true;
  legacy.service.markProjectAutosaveDirty({ reason: "unsaved manuscript" });
  await legacy.service.flushProjectAutosave();
  assert.equal(legacy.state.projectFileAutosaveDirty, true);
  await assert.rejects(() => legacy.service.createDesktopProjectPackage({
    parentPath: temporaryRoot, folderName: "Blocked New",
    buildCandidateSnapshot: () => assert.fail("A failed durable save must block candidate construction."),
    confirmDiscardUnsaved: () => assert.fail("A saved project's failed durability must not offer destinationless discard."),
  }), /durable save is blocked|could not be durably saved/);
  assert.equal(legacy.state.projectFilePath, legacyPath);
  assert.equal(existsSync(path.join(temporaryRoot, "Blocked New")), false);
  failWrite = false;

  // Invalid input fails before replacement, and explicit file authority cannot overwrite a directory/manifest.
  const beforeInvalidSave = readFileSync(legacyPath, "utf8");
  const invalid = await request("/api/project-file/save", { method: "POST", body: { filePath: legacyPath, storageMode: "desktop-path", snapshot: { ...saved, schemaVersion: 999 } } });
  assert.equal(invalid.ok, false);
  assert.equal(readFileSync(legacyPath, "utf8"), beforeInvalidSave);
  assert.equal(readdirSync(temporaryRoot).some((name) => name.startsWith(".abe-project-file-")), false);

  // Explicit Save As retains the established staged semantic boundary for JSON -> package conversion.
  const packageOwner = createRuntime(legacySnapshot);
  await packageOwner.service.hydrateProjectLibraryFromLoadedSnapshot(saved, { filePath: legacyPath, mode: "desktop-path", preserveProjectIdentity: true });
  await packageOwner.service.saveProjectSnapshotAsPackage({ destinationParentPath: temporaryRoot, folderName: "Converted Novel.json" });
  const packageRoot = path.join(temporaryRoot, "Converted Novel.json");
  assert.equal(packageOwner.state.projectFilePath, packageRoot);
  assert.equal(packageOwner.state.projectFileStorageMode, "desktop-package");
  assert.equal(statSync(packageRoot).isDirectory(), true);
  const packageLoad = await request("/api/project-package/load", { method: "POST", body: { rootPath: packageRoot } });
  assert.equal(packageLoad.ok, true);
  // Hydration recalculates indexes/stats before export; verify the snapshot actually submitted for publication.
  const packageExpected = calls.findLast(({ pathname }) => pathname === "/api/project-package/save-as").body.snapshot;
  assertProjectSnapshotsSemanticallyEquivalent(packageExpected, packageLoad.value.snapshot);
  assert.equal(packageLoad.value.snapshot.sceneStore["legacy-novel"]["scene-2"].editorText, editedText);
  const changedPackage = structuredClone(packageLoad.value.snapshot);
  changedPackage.sceneStore["legacy-novel"]["scene-2"].editorText = "Lost manuscript";
  assert.throws(() => assertProjectSnapshotsSemanticallyEquivalent(packageExpected, changedPackage), /semantically equivalent/);
  assert.equal((await packageOwner.service.saveProjectSnapshot({ reason: "autosave" })).projectFilePersisted, true);
  assert.ok(calls.some(({ pathname }) => pathname === "/api/project-package/save-commit"));
  assert.equal(readFileSync(legacyPath, "utf8"), beforeInvalidSave, "Save As and package Save leave the legacy source intact.");
  const directoryWrite = await request("/api/project-file/save", { method: "POST", body: { filePath: packageRoot, storageMode: "desktop-path", snapshot: saved } });
  assert.equal(directoryWrite.ok, false);
  assert.equal(existsSync(path.join(packageRoot, "project.json")), true);
}

function createManuscriptSnapshot() {
  const projectId = "legacy-novel";
  const texts = ["Mara found a sealed letter beneath the orchard wall.", "She carried the letter home, but the house had vanished."];
  const scenes = texts.map((text, index) => ({
    sceneId: `scene-${index + 1}`, chapterId: `chapter-${index + 1}`,
    chapterTitle: index ? "The Return" : "The Letter", sceneTitle: index ? "An Empty Road" : "The Orchard",
    editorText: text, blocks: [{ blockId: `block-${index + 1}`, kind: "narration", text }],
  }));
  return {
    schemaVersion: 2, activeProjectId: projectId,
    projects: [{
      id: projectId, title: "The Remembering Sea", schemaVersion: 2,
      projectSettings: {}, sceneDrafts: {},
      projectIndex: { sceneOrder: scenes.map((scene) => scene.sceneId), scenes: scenes.map((scene) => ({ id: scene.sceneId, chapterId: scene.chapterId, title: scene.sceneTitle, lineCount: 1 })) },
      structureDrafts: { scenes: scenes.map((scene) => ({ sceneId: scene.sceneId, chapterId: scene.chapterId, chapterTitle: scene.chapterTitle, sceneTitle: scene.sceneTitle })), sceneOrder: scenes.map((scene) => scene.sceneId) },
      workspace: { project: {
        id: projectId, title: "The Remembering Sea", stats: { chapterCount: 2, sceneCount: 2 },
        chapters: scenes.map((scene) => ({ id: scene.chapterId, title: scene.chapterTitle, scenes: [{ id: scene.sceneId, title: scene.sceneTitle }] })),
        lines: [],
      }, selectionDefaults: { sceneId: "scene-1" } },
      passageNotes: [{ id: "note-1", body: "The letter must remain unopened until winter." }],
      metadataSubgroups: [], manuscriptTasks: [{ id: "task-1", title: "Revisit the orchard promise" }],
    }],
    sceneStore: { [projectId]: Object.fromEntries(scenes.map((scene) => [scene.sceneId, scene])) },
  };
}

if (process.argv.includes(childFlag)) await runChild();
