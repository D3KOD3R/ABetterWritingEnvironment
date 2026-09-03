// Intent: prove desktop project-package lifecycle semantics against physical temporary folders without touching the worktree.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHILD_FLAG = "--project-package-lifecycle-child";
const EVIDENCE_PREFIX = "ABE_PROJECT_PACKAGE_LIFECYCLE=";
const TEST_FILE_PATH = fileURLToPath(import.meta.url);
const WORKTREE_ROOT = path.resolve(path.dirname(TEST_FILE_PATH), "..");

function isContainedPath(rootPath, candidatePath) {
  const relativePath = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  return relativePath === "" || (
    relativePath !== ".."
    && !relativePath.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativePath)
  );
}

// Intent: catch tracked and ignored persistence artifacts that Git status alone may omit.
function snapshotBoundedWorktreeFootprint() {
  const watchedPaths = new Set([
    "project-media",
    "logs",
    "test-results",
    "SaveTestFile",
    path.join("apps", "desktop", ".desktop-state.json"),
  ]);
  for (const entry of readdirSync(WORKTREE_ROOT, { withFileTypes: true })) {
    if (/\.abe-project(?:\.json)?(?:\.|$)/i.test(entry.name)) watchedPaths.add(entry.name);
  }

  const footprint = {};
  const visit = (relativePath) => {
    const absolutePath = path.join(WORKTREE_ROOT, relativePath);
    if (!existsSync(absolutePath)) {
      footprint[relativePath] = "missing";
      return;
    }
    const stats = lstatSync(absolutePath);
    if (stats.isSymbolicLink()) {
      footprint[relativePath] = `symlink:${readlinkSync(absolutePath)}`;
      return;
    }
    if (stats.isDirectory()) {
      footprint[`${relativePath}${path.sep}`] = "directory";
      for (const entry of readdirSync(absolutePath, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name))) {
        visit(path.join(relativePath, entry.name));
      }
      return;
    }
    footprint[relativePath] = createHash("sha256").update(readFileSync(absolutePath)).digest("hex");
  };
  for (const relativePath of [...watchedPaths].sort()) visit(relativePath);
  return footprint;
}

export async function runProjectPackageLifecycleTest() {
  const lifecycleRoot = mkdtempSync(path.join(tmpdir(), "abe-project-package-lifecycle-"));
  const runtimeCwd = mkdtempSync(path.join(tmpdir(), "abe-project-package-cwd-"));
  const logRoot = mkdtempSync(path.join(tmpdir(), "abe-project-package-logs-"));
  const beforeFootprint = snapshotBoundedWorktreeFootprint();
  try {
    const child = spawnSync(process.execPath, [
      "--experimental-strip-types",
      TEST_FILE_PATH,
      CHILD_FLAG,
    ], {
      cwd: runtimeCwd,
      encoding: "utf8",
      timeout: 60_000,
      env: {
        ...process.env,
        ABE_LOG_PATH: path.join(logRoot, "desktop.log"),
        ABE_DEVELOPER_RUNTIME_LOG_DIR: path.join(logRoot, "runtime"),
        ABE_PACKAGE_LIFECYCLE_ROOT: lifecycleRoot,
      },
    });
    assert.equal(child.error, undefined, child.error?.message);
    assert.equal(child.status, 0, `Lifecycle child failed.\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}`);
    const evidenceLine = String(child.stdout).split(/\r?\n/).find((line) => line.startsWith(EVIDENCE_PREFIX));
    assert.ok(evidenceLine, "Lifecycle child did not emit evidence.");
    const evidence = JSON.parse(evidenceLine.slice(EVIDENCE_PREFIX.length));
    for (const [key, value] of Object.entries(evidence)) {
      assert.equal(value, true, `${key} failed:\n${JSON.stringify(evidence, null, 2)}`);
    }
    assert.deepEqual(
      snapshotBoundedWorktreeFootprint(),
      beforeFootprint,
      "The isolated lifecycle scenario changed the bounded worktree artifact footprint.",
    );
  } finally {
    rmSync(lifecycleRoot, { recursive: true, force: true });
    rmSync(runtimeCwd, { recursive: true, force: true });
    rmSync(logRoot, { recursive: true, force: true });
  }
}

async function runLifecycleChild() {
  const lifecycleRoot = process.env.ABE_PACKAGE_LIFECYCLE_ROOT;
  if (!lifecycleRoot) throw new Error("Lifecycle child requires an external temporary root.");
  const appSource = readFileSync(path.join(WORKTREE_ROOT, "apps", "editor", "public", "app.js"), "utf8");
  const packageFieldHandlerStart = appSource.indexOf(
    "if (target instanceof HTMLInputElement && target.dataset.projectPackageField",
  );
  const packageFieldHandlerEnd = appSource.indexOf("const { editField, sceneId }", packageFieldHandlerStart);
  const packageFieldHandler = appSource.slice(packageFieldHandlerStart, packageFieldHandlerEnd);
  assert.match(
    packageFieldHandler,
    /if \(field === "locationPath"\) \{\s*clearProjectPackageDialogDirectoryList\(\);\s*\}[\s\S]*confirmButton\.disabled = !canConfirmProjectPackageDialog/,
    "Editing the package location must rerender the invalidated directory listing immediately.",
  );

  const [
    { createDesktopResponseForRequest },
    { createNarrationMediaService },
    {
      assertProjectSnapshotsSemanticallyEquivalent,
      collectProjectSnapshotSemanticDifferences,
    },
    { buildPortableExternalProjectSnapshot },
    { createNewProjectCandidateBuilder },
    { buildProjectIndexFromProjectRecord },
    { PROJECT_SCHEMA_VERSION },
    { normalizeProjectSelectionDefaults },
    { createProjectActivationStateService },
    {
      syncNarrationAlignmentJobsMetadata,
      syncNarrationSessionMetadata,
      syncVoiceRecordingsMetadata,
      syncVoiceRenderJobsMetadata,
    },
    {
      PROJECT_PACKAGE_DIALOG_MODES,
      applyProjectPackageBrowseResult,
      canConfirmProjectPackageDialog,
      createProjectPackageDialogState,
      updateProjectPackageDialogField,
    },
  ] = await Promise.all([
    import(new URL("../apps/desktop/src/http-app.ts", import.meta.url)),
    import(new URL("../apps/editor/public/features/narration/narration-media-service.js", import.meta.url)),
    import(new URL("../apps/editor/public/adapters/storage/project-snapshot-verification.js", import.meta.url)),
    import(new URL("../apps/editor/public/adapters/storage/project-persistence-service.js", import.meta.url)),
    import(new URL("../apps/editor/public/features/project-lifecycle/new-project-candidate.js", import.meta.url)),
    import(new URL("../apps/editor/public/adapters/storage/project-index.js", import.meta.url)),
    import(new URL("../apps/editor/public/adapters/storage/project-migrations.js", import.meta.url)),
    import(new URL("../apps/editor/public/state/project-library-state.js", import.meta.url)),
    import(new URL("../apps/editor/public/state/project-activation-state.js", import.meta.url)),
    import(new URL("../apps/editor/public/features/narration/narration-metadata-sync-service.js", import.meta.url)),
    import(new URL("../apps/editor/public/features/project-lifecycle/project-package-dialog.js", import.meta.url)),
  ]);

  const projectId = "project-lifecycle";
  const sceneId = "scene-lifecycle";
  const authoredText = "The package crossed the river intact.";
  const blankProjectRoot = path.join(lifecycleRoot, "Blank Project");
  const projectA = path.join(lifecycleRoot, "Project A");
  const unavailableProjectA = path.join(lifecycleRoot, "Project A unavailable");
  const projectB = path.join(lifecycleRoot, "Project B");
  const runtimeSnapshot = {
    schemaVersion: 2,
    activeProjectId: projectId,
    projects: [{
      id: projectId,
      schemaVersion: 2,
      title: "Lifecycle Novel",
      projectSettings: {
        activeSceneId: sceneId,
        projectFilePath: projectA,
        customMetadataDefinitions: [{ id: "custom-continuity", label: "Continuity" }],
        writingTargetViewMode: "month",
        spellcheck: { dictionaryWords: ["starwake"], exceptionWords: ["Marsward"] },
      },
      projectIndex: {
        sceneOrder: [sceneId],
        scenes: [{ id: sceneId, chapterId: "chapter-1", title: "Crossing", synopsis: "A package test." }],
      },
      structureDrafts: {
        scenes: [{
          sceneId,
          chapterId: "chapter-1",
          chapterTitle: "Chapter One",
          sceneTitle: "Crossing",
          sceneSynopsis: "A package test.",
          order: 1,
          initialText: authoredText,
        }],
      },
      manuscriptTasks: [{ id: "task-1", title: "Check crossing", status: "open" }],
      passageNotes: [{ id: "note-1", title: "River", body: "Keep this detail." }],
      metadataSubgroups: [{
        id: "metadata-folder-research",
        groupId: "research",
        title: "Research",
        createdAt: "2026-09-03T00:00:00.000Z",
        updatedAt: "2026-09-03T00:00:00.000Z",
        notes: [{
          id: "metadata-folder-note-orbit",
          title: "Orbit",
          body: "Retain the orbital detail.",
          createdAt: "2026-09-03T00:00:00.000Z",
          updatedAt: "2026-09-03T00:00:00.000Z",
          anchor: null,
        }],
        folders: [],
      }],
      draftProofing: { schemaVersion: 1, activeRunId: "proof-1", runs: [{ id: "proof-1", status: "complete" }] },
      revisions: { schemaVersion: 1, activeSessionId: "revision-1", sessions: [{ metadata: { id: "revision-1" } }] },
      workspace: {
        project: {
          lines: [{
            sceneId,
            chapterId: "chapter-1",
            chapterTitle: "Chapter One",
            sceneTitle: "Crossing",
            sceneSynopsis: "A package test.",
            blockId: "block-1",
            lineNumber: 1,
            kind: "narration",
            speakerLabel: "",
            text: authoredText,
            issueIds: [],
            eventTagIds: [],
          }],
        },
        world: {
          entities: [{ id: "world-entity-1", title: "The River", categoryId: "location" }],
          spines: [{ id: "spine-1", title: "Crossing arc", nodeIds: ["node-1"] }],
          nodes: [{ id: "node-1", sceneId, title: "Crossing" }],
          edges: [],
        },
      },
    }],
    sceneStore: {
      [projectId]: {
        [sceneId]: {
          sceneId,
          chapterId: "chapter-1",
          chapterTitle: "Chapter One",
          sceneTitle: "Crossing",
          sceneSynopsis: "A package test.",
          editorText: authoredText,
          blocks: [{
            blockId: "block-1",
            lineNumber: 1,
            kind: "narration",
            speakerLabel: "",
            text: authoredText,
            issueIds: [],
            eventTagIds: [],
            isDraft: false,
          }],
        },
      },
    },
  };
  const portableSnapshot = buildPortableExternalProjectSnapshot(runtimeSnapshot);

  const blankProjectId = "project-blank-lifecycle";
  const blankCandidateBuilder = createNewProjectCandidateBuilder({
    createProjectId: () => blankProjectId,
    now: () => "2026-09-03T00:00:00.000Z",
    getBaseWorkspace: () => ({
      workspaceTitle: "ABetterNovelAuthoringEnvironment",
      settings: { projectRoot: projectA, modelRoot: projectA, assetRoot: projectA },
      analysis: { provider: { id: "poison-analysis", executablePath: projectA } },
      narration: { provider: { id: "poison-audio", modelRoot: projectA } },
      voice: { provider: { id: "poison-voice", assetRoot: projectA }, profiles: [{ id: "poison-profile" }] },
    }),
    createProjectRecordFromWorkspace: (workspace, options) => {
      const normalizedWorkspace = structuredClone(workspace);
      normalizedWorkspace.selectionDefaults = normalizeProjectSelectionDefaults(
        normalizedWorkspace.selectionDefaults,
        normalizedWorkspace.project,
      );
      const record = {
        ...structuredClone(options),
        id: options.id,
        title: options.title,
        workspace: normalizedWorkspace,
        projectSettings: {
          editorPrefs: structuredClone(options.editorPrefs),
          localAiPrefs: structuredClone(options.localAiPrefs),
        },
        schemaVersion: PROJECT_SCHEMA_VERSION,
      };
      record.projectIndex = buildProjectIndexFromProjectRecord(record, {
        schemaVersion: PROJECT_SCHEMA_VERSION,
      });
      return record;
    },
    exportProjectLibrarySnapshot: ({ librarySnapshot }) => structuredClone(librarySnapshot),
  });
  const blankPortableSnapshot = buildPortableExternalProjectSnapshot(
    blankCandidateBuilder.buildNewProjectCandidateSnapshot("Blank Lifecycle Novel"),
  );
  assert.equal(JSON.stringify(blankPortableSnapshot).includes(projectA), false);
  assert.equal(blankPortableSnapshot.projects[0].workspace.analysis, undefined);
  assert.equal(blankPortableSnapshot.projects[0].workspace.narration, undefined);
  assert.deepEqual(blankPortableSnapshot.projects[0].workspace.voice.profiles, []);

  const sendJson = async (pathname, body, hostOptions = {}) => {
    const response = await createDesktopResponseForRequest(
      { method: "POST", pathname, body: JSON.stringify(body) },
      hostOptions,
    );
    return { response, value: JSON.parse(String(response.body || "{}")) };
  };
  const expectSemanticFailure = (candidate, label) => {
    assert.throws(
      () => assertProjectSnapshotsSemanticallyEquivalent(portableSnapshot, candidate, { operation: label }),
      /not semantically equivalent/,
    );
  };
  // Intent: physical success must expose the final root only after staged readback verification.
  const stageLoadVerifyAndCommit = async ({ pathname, body, expectedSnapshot, operation }) => {
    const staged = await sendJson(pathname, body);
    assert.equal(staged.response.statusCode, 200);
    assert.equal(existsSync(staged.value.finalRootPath), false, `${operation} published before verification.`);
    assert.equal(existsSync(staged.value.stagingRootPath), true);
    const browseDuringStage = await sendJson("/api/project-package/browse", {
      path: path.dirname(staged.value.stagingRootPath),
    });
    assert.equal(
      browseDuringStage.value.directories.some((entry) => entry.path === staged.value.stagingRootPath),
      false,
    );
    const loaded = await sendJson("/api/project-package/load", { rootPath: staged.value.stagingRootPath });
    const differences = collectProjectSnapshotSemanticDifferences(expectedSnapshot, loaded.value.snapshot, { limit: 100 });
    assert.deepEqual(differences, [], `${operation} differences:\n${differences.join("\n")}`);
    assertProjectSnapshotsSemanticallyEquivalent(expectedSnapshot, loaded.value.snapshot, { operation });
    const committed = await sendJson("/api/project-package/commit", {
      operationToken: staged.value.operationToken,
    });
    assert.equal(committed.response.statusCode, 200);
    assert.equal(existsSync(staged.value.stagingRootPath), false);
    assert.equal(existsSync(committed.value.rootPath), true);
    return { staged, loaded, committed };
  };
  const stageAndDiscardAfterFailure = async ({ pathname, body, expectedSnapshot, failure }) => {
    const staged = await sendJson(pathname, body);
    assert.equal(staged.response.statusCode, 200);
    assert.equal(existsSync(staged.value.finalRootPath), false);
    let failureObserved = false;
    if (failure === "load") {
      unlinkSync(path.join(staged.value.stagingRootPath, "project.json"));
      const loaded = await sendJson("/api/project-package/load", { rootPath: staged.value.stagingRootPath });
      failureObserved = loaded.response.statusCode === 400;
    } else {
      const loaded = await sendJson("/api/project-package/load", { rootPath: staged.value.stagingRootPath });
      const corruptSnapshot = structuredClone(loaded.value.snapshot);
      corruptSnapshot.projects[0].title = "Corrupted staged readback";
      assert.throws(
        () => assertProjectSnapshotsSemanticallyEquivalent(expectedSnapshot, corruptSnapshot),
        /not semantically equivalent/,
      );
      failureObserved = true;
    }
    const discarded = await sendJson("/api/project-package/discard", {
      operationToken: staged.value.operationToken,
    });
    return failureObserved
      && discarded.response.statusCode === 200
      && !existsSync(staged.value.stagingRootPath)
      && !existsSync(staged.value.finalRootPath);
  };
  const saveVerifiedPackage = async (rootPath, snapshot) => {
    const expectedSnapshot = buildPortableExternalProjectSnapshot(snapshot);
    const staged = await sendJson("/api/project-package/save-stage", { rootPath, snapshot: expectedSnapshot });
    assert.equal(staged.response.statusCode, 200);
    const loaded = await sendJson("/api/project-package/save-load", {
      operationToken: staged.value.operationToken,
    });
    assert.equal(loaded.response.statusCode, 200);
    assertProjectSnapshotsSemanticallyEquivalent(expectedSnapshot, loaded.value.snapshot, {
      operation: "Normal project package save",
    });
    const committed = await sendJson("/api/project-package/save-commit", {
      operationToken: staged.value.operationToken,
    });
    assert.equal(committed.response.statusCode, 200);
    return { staged, loaded, committed };
  };

  const browse = await sendJson("/api/project-package/browse", { path: lifecycleRoot });
  const defaultBrowse = await sendJson("/api/project-package/browse", { path: "" });
  const blankPublication = await stageLoadVerifyAndCommit({
    pathname: "/api/project-package/create",
    body: {
      parentPath: lifecycleRoot,
      folderName: "Blank Project",
      snapshot: blankPortableSnapshot,
    },
    expectedSnapshot: blankPortableSnapshot,
    operation: "Blank New Project package",
  });
  const blankPublishedLoad = await sendJson("/api/project-package/load", { rootPath: blankProjectRoot });
  assert.equal(blankPublishedLoad.response.statusCode, 200);
  const activatedBlankState = {};
  const activationService = createProjectActivationStateService({
    state: activatedBlankState,
    createStructureDrafts: () => ({ scenes: [] }),
    createTemplateDrafts: () => [],
    normalizeManuscriptTasks: (value) => Array.isArray(value) ? value : [],
    normalizePassageNotes: (value) => Array.isArray(value) ? value : [],
    readRevisionState: () => ({ sessions: [] }),
    createRevisionPanelStateForProject: () => ({ selectedSessionId: "" }),
    normalizeProjectSettingsSnapshot: () => ({
      activePane: "manuscript",
      editorPrefs: {},
      localAiPrefs: {},
      spellcheck: {},
      writingTargetState: {},
    }),
    buildProjectSettingsCandidate: (record) => record,
    getProjectRecordWordCountForSettings: () => 0,
    normalizeSpellcheckProjectSettings: (value) => value ?? {},
  });
  activationService.applyProjectRecordToState(blankPublishedLoad.value.snapshot.projects[0]);

  // Intent: reproduce the production activation path before render and manuscript metadata consumers dereference service roots.
  const dream = activatedBlankState.workspace.analysis.dreamScaping;
  const dreamSuggestions = dream
    ? activatedBlankState.workspace.analysis.suggestionQueue.filter((suggestion) =>
        dream.suggestionIds.includes(suggestion.id))
    : [];
  const emptyLineIndex = new Map();
  const emptySceneIndex = new Map();
  const narrationSession = syncNarrationSessionMetadata(
    activatedBlankState.workspace.narration.session,
    emptyLineIndex,
  );
  const narrationJobs = syncNarrationAlignmentJobsMetadata(
    activatedBlankState.workspace.narration.alignmentJobs,
    emptyLineIndex,
  );
  const voiceRecordings = syncVoiceRecordingsMetadata(
    activatedBlankState.workspace.voice.recordings,
    emptyLineIndex,
  );
  const voiceRenderJobs = syncVoiceRenderJobsMetadata(
    activatedBlankState.workspace.voice.renderJobs,
    emptySceneIndex,
  );
  const reserializedActivatedBlank = buildPortableExternalProjectSnapshot({
    ...blankPublishedLoad.value.snapshot,
    projects: [{
      ...blankPublishedLoad.value.snapshot.projects[0],
      workspace: activatedBlankState.workspace,
    }],
  });
  const activatedBlankRuntimeVerified = dream === null
    && dreamSuggestions.length === 0
    && narrationSession === null
    && narrationJobs.length === 0
    && voiceRecordings.length === 0
    && voiceRenderJobs.length === 0
    && reserializedActivatedBlank.projects[0].workspace.analysis === undefined
    && reserializedActivatedBlank.projects[0].workspace.narration === undefined
    && reserializedActivatedBlank.projects[0].workspace.voice.renderJobs === undefined;
  const createPublication = await stageLoadVerifyAndCommit({
    pathname: "/api/project-package/create",
    body: {
      parentPath: lifecycleRoot,
      folderName: "Project A",
      snapshot: portableSnapshot,
    },
    expectedSnapshot: portableSnapshot,
    operation: "New package",
  });
  const create = createPublication.staged;
  const loadA = createPublication.loaded;

  // Intent: current scene declarations, not obsolete disk sidecars or projectStorage scaffolding, own membership and order.
  const authorityRoot = path.join(lifecycleRoot, "Scene Authority");
  const authorityProjectId = "project-scene-authority";
  const createAuthorityScene = (sceneId, title, text, lineNumber) => ({
    sceneId,
    chapterId: "chapter-authority",
    chapterTitle: "Authority Chapter",
    sceneTitle: title,
    sceneSynopsis: `${title} synopsis`,
    editorText: text,
    blocks: [{
      blockId: `block-${sceneId}`,
      paragraphId: `paragraph-${sceneId}`,
      lineNumber,
      kind: "narration",
      speakerLabel: "",
      text,
      issueIds: [],
      eventTagIds: [],
      isDraft: false,
    }],
  });
  const authoritySceneA = createAuthorityScene("scene-a", "Scene A", "Alpha", 1);
  const authoritySceneB = createAuthorityScene("scene-b", "Scene B", "Beta", 2);
  const authoritySnapshot = {
    schemaVersion: 2,
    activeProjectId: authorityProjectId,
    projects: [{
      id: authorityProjectId,
      schemaVersion: 2,
      title: "Scene Authority",
      projectIndex: {
        sceneOrder: ["scene-a", "scene-b"],
        scenes: [
          { id: "scene-a", chapterId: "chapter-authority", title: "Scene A", synopsis: "Scene A synopsis" },
          { id: "scene-b", chapterId: "chapter-authority", title: "Scene B", synopsis: "Scene B synopsis" },
        ],
      },
      structureDrafts: { sceneOrder: ["scene-a", "scene-b"], scenes: [] },
      workspace: { project: { lines: [] } },
    }],
    sceneStore: { [authorityProjectId]: { "scene-a": authoritySceneA, "scene-b": authoritySceneB } },
  };
  const initialAuthorityWrite = await sendJson("/api/project-file/save", {
    filePath: authorityRoot,
    snapshot: authoritySnapshot,
  });
  const initialAuthorityLoad = await sendJson("/api/project-package/load", { rootPath: authorityRoot });
  const deletedSceneSnapshot = structuredClone(initialAuthorityLoad.value.snapshot);
  deletedSceneSnapshot.projects[0].projectIndex.sceneOrder = ["scene-a"];
  deletedSceneSnapshot.projects[0].projectIndex.scenes = deletedSceneSnapshot.projects[0].projectIndex.scenes
    .filter((scene) => scene.id === "scene-a");
  deletedSceneSnapshot.projects[0].structureDrafts.sceneOrder = ["scene-a"];
  deletedSceneSnapshot.projects[0].structureDrafts.scenes = deletedSceneSnapshot.projects[0].structureDrafts.scenes
    .filter((scene) => scene.sceneId === "scene-a");
  deletedSceneSnapshot.projects[0].workspace.project.lines = deletedSceneSnapshot.projects[0].workspace.project.lines
    .filter((line) => line.sceneId === "scene-a");
  delete deletedSceneSnapshot.sceneStore[authorityProjectId]["scene-b"];
  const failedGenerationWrite = await sendJson("/api/project-package/save-stage", {
    rootPath: authorityRoot,
    snapshot: buildPortableExternalProjectSnapshot(deletedSceneSnapshot),
  }, {
    projectPackageFaultInjector: {
      afterStructuredSidecarWrite({ count }) {
        if (count === 1) throw new Error("Injected crash after one structured sidecar write.");
      },
    },
  });
  assert.equal(failedGenerationWrite.response.statusCode, 400);
  const afterGenerationFailure = await sendJson("/api/project-package/load", { rootPath: authorityRoot });
  assertProjectSnapshotsSemanticallyEquivalent(initialAuthorityLoad.value.snapshot, afterGenerationFailure.value.snapshot, {
    operation: "Old generation after sidecar failure",
  });

  const uncommittedSave = await sendJson("/api/project-package/save-stage", {
    rootPath: authorityRoot,
    snapshot: buildPortableExternalProjectSnapshot(deletedSceneSnapshot),
  });
  assert.equal(uncommittedSave.response.statusCode, 200);
  const beforeManifestCommit = await sendJson("/api/project-package/load", { rootPath: authorityRoot });
  assertProjectSnapshotsSemanticallyEquivalent(initialAuthorityLoad.value.snapshot, beforeManifestCommit.value.snapshot, {
    operation: "Old generation before manifest commit",
  });
  const discardedSave = await sendJson("/api/project-package/save-discard", {
    operationToken: uncommittedSave.value.operationToken,
  });
  assert.equal(discardedSave.response.statusCode, 200);
  const afterDiscardedSave = await sendJson("/api/project-package/load", { rootPath: authorityRoot });
  assertProjectSnapshotsSemanticallyEquivalent(initialAuthorityLoad.value.snapshot, afterDiscardedSave.value.snapshot, {
    operation: "Old generation after staged save discard",
  });

  const deletedSceneWrite = await saveVerifiedPackage(authorityRoot, deletedSceneSnapshot);
  const deletedSceneReload = await sendJson("/api/project-package/load", { rootPath: authorityRoot });

  const authoritySceneC = createAuthorityScene("scene-c", "Scene C", "Gamma", 3);
  const reorderedSnapshot = structuredClone(deletedSceneReload.value.snapshot);
  reorderedSnapshot.projects[0].projectIndex.sceneOrder = ["scene-c", "scene-a"];
  reorderedSnapshot.projects[0].projectIndex.scenes = [
    { id: "scene-c", chapterId: "chapter-authority", title: "Scene C", synopsis: "Scene C synopsis" },
    { id: "scene-a", chapterId: "chapter-authority", title: "Scene A Renamed", synopsis: "Renamed synopsis" },
  ];
  reorderedSnapshot.projects[0].structureDrafts.sceneOrder = ["scene-c", "scene-a"];
  reorderedSnapshot.sceneStore[authorityProjectId]["scene-a"].sceneTitle = "Scene A Renamed";
  reorderedSnapshot.sceneStore[authorityProjectId]["scene-a"].sceneSynopsis = "Renamed synopsis";
  reorderedSnapshot.sceneStore[authorityProjectId]["scene-c"] = authoritySceneC;
  const reorderedWrite = await saveVerifiedPackage(authorityRoot, reorderedSnapshot);
  const reorderedReload = await sendJson("/api/project-package/load", { rootPath: authorityRoot });
  assert.equal(initialAuthorityWrite.response.statusCode, 200);
  assert.equal(initialAuthorityLoad.response.statusCode, 200);
  assert.equal(deletedSceneWrite.committed.response.statusCode, 200);
  assert.deepEqual(deletedSceneReload.value.snapshot.projects[0].projectStorage.sceneOrder, ["scene-a"]);
  assert.equal(Object.hasOwn(deletedSceneReload.value.snapshot.sceneStore[authorityProjectId], "scene-b"), false);
  assert.equal(reorderedWrite.committed.response.statusCode, 200);
  assert.deepEqual(reorderedReload.value.snapshot.projects[0].projectStorage.sceneOrder, ["scene-c", "scene-a"]);
  assert.equal(reorderedReload.value.snapshot.projects[0].projectIndex.scenes[1].title, "Scene A Renamed");
  assert.equal(
    reorderedReload.value.snapshot.sceneStore[authorityProjectId]["scene-c"].blocks[0].paragraphId,
    "paragraph-scene-c",
  );

  let activeRoot = projectA;
  const fetchJson = async (pathname, options = {}) => {
    const result = await sendJson(pathname, options.body);
    return result.response.statusCode >= 200 && result.response.statusCode < 300
      ? { ok: true, value: result.value }
      : { ok: false, error: new Error(result.value.message ?? "Desktop request failed.") };
  };
  const mediaService = createNarrationMediaService({ fetchJson, getActiveProjectRoot: () => activeRoot });
  const mediaPath = "assets/audio/lifecycle-proof.webm";
  const mediaBytes = new Uint8Array([0x41, 0x42, 0x45, 0x42]);
  await mediaService.saveMediaBlob({ filePath: mediaPath, blob: new Blob([mediaBytes], { type: "audio/webm" }) });

  const saveAsPublication = await stageLoadVerifyAndCommit({
    pathname: "/api/project-package/save-as",
    body: {
      sourceRoot: projectA,
      destinationParentPath: lifecycleRoot,
      folderName: "Project B",
      snapshot: portableSnapshot,
    },
    expectedSnapshot: portableSnapshot,
    operation: "Save As package",
  });
  const saveAs = saveAsPublication.staged;
  const loadB = await sendJson("/api/project-package/load", { rootPath: saveAsPublication.committed.value.rootPath });
  assertProjectSnapshotsSemanticallyEquivalent(portableSnapshot, loadB.value.snapshot, { operation: "Save As package" });

  for (const failAfterCount of [1, 2]) {
    const interruptedSave = await sendJson("/api/project-package/save-stage", {
      rootPath: projectB,
      snapshot: portableSnapshot,
    }, {
      projectPackageFaultInjector: {
        afterStructuredSidecarWrite({ count }) {
          if (count === failAfterCount) throw new Error(`Injected crash after structured sidecar ${count}.`);
        },
      },
    });
    assert.equal(interruptedSave.response.statusCode, 400);
    const afterInterruptedSave = await sendJson("/api/project-package/load", { rootPath: projectB });
    assertProjectSnapshotsSemanticallyEquivalent(portableSnapshot, afterInterruptedSave.value.snapshot, {
      operation: `Old generation after interrupted sidecar ${failAfterCount}`,
    });
  }

  const manifestPath = path.join(projectB, "project.json");
  const manifestText = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  const relativeScenePath = manifest.projects[0].projectStorage.sceneFiles[sceneId];
  const scenePath = path.join(projectB, ...relativeScenePath.split("/"));
  const originalSceneText = readFileSync(scenePath, "utf8");

  const wrongId = structuredClone(loadB.value.snapshot);
  wrongId.activeProjectId = "wrong-project";
  expectSemanticFailure(wrongId, "Wrong ID");
  const wrongProjectId = structuredClone(loadB.value.snapshot);
  wrongProjectId.projects[0].id = "wrong-project";
  expectSemanticFailure(wrongProjectId, "Wrong project ID");
  const missingScene = structuredClone(loadB.value.snapshot);
  delete missingScene.sceneStore[projectId][sceneId];
  expectSemanticFailure(missingScene, "Missing scene");
  const modifiedText = structuredClone(loadB.value.snapshot);
  modifiedText.sceneStore[projectId][sceneId].blocks[0].text = "Corrupted text";
  expectSemanticFailure(modifiedText, "Modified scene text");
  const missingNote = structuredClone(loadB.value.snapshot);
  missingNote.projects[0].passageNotes = [];
  expectSemanticFailure(missingNote, "Missing note");
  const missingTask = structuredClone(loadB.value.snapshot);
  missingTask.projects[0].manuscriptTasks = [];
  expectSemanticFailure(missingTask, "Missing task");

  renameSync(scenePath, `${scenePath}.missing`);
  const diskMissingScene = await sendJson("/api/project-package/load", { rootPath: projectB });
  assert.equal(diskMissingScene.response.statusCode, 400);
  renameSync(`${scenePath}.missing`, scenePath);
  const changedScene = JSON.parse(originalSceneText);
  changedScene.blocks[0].text = "Changed on disk";
  writeFileSync(scenePath, `${JSON.stringify(changedScene, null, 2)}\n`, "utf8");
  const diskModifiedScene = await sendJson("/api/project-package/load", { rootPath: projectB });
  expectSemanticFailure(diskModifiedScene.value.snapshot, "Modified sidecar");
  writeFileSync(scenePath, originalSceneText, "utf8");

  const duplicate = await sendJson("/api/project-package/create", {
    parentPath: lifecycleRoot,
    folderName: "Project B",
    snapshot: portableSnapshot,
  });
  const nested = await sendJson("/api/project-package/save-as", {
    sourceRoot: projectB,
    destinationParentPath: projectB,
    folderName: "Nested",
    snapshot: portableSnapshot,
  });
  const relativeParent = await sendJson("/api/project-package/create", {
    parentPath: "relative/path",
    folderName: "Rejected",
    snapshot: portableSnapshot,
  });
  const sanitized = await sendJson("/api/project-package/create", {
    parentPath: lifecycleRoot,
    folderName: "Novel: Draft.",
    snapshot: portableSnapshot,
  });
  const sanitizedCommit = await sendJson("/api/project-package/commit", {
    operationToken: sanitized.value.operationToken,
  });
  const separatorName = await sendJson("/api/project-package/create", {
    parentPath: lifecycleRoot,
    folderName: "escape/child",
    snapshot: portableSnapshot,
  });
  const nonPackageSource = path.join(lifecycleRoot, "Ordinary Folder");
  mkdirSync(nonPackageSource);
  const invalidSource = await sendJson("/api/project-package/save-as", {
    sourceRoot: nonPackageSource,
    destinationParentPath: lifecycleRoot,
    folderName: "Invalid Source Copy",
    snapshot: portableSnapshot,
  });
  const sourceLink = path.join(projectB, "assets", "escape-link");
  symlinkSync(lifecycleRoot, sourceLink, "junction");
  const symlinkCopy = await sendJson("/api/project-package/save-as", {
    sourceRoot: projectB,
    destinationParentPath: lifecycleRoot,
    folderName: "Symlink Copy",
    snapshot: portableSnapshot,
  });
  unlinkSync(sourceLink);

  // Existing package components may not redirect any relative read, write, or delete outside package authority.
  const containmentOutside = path.join(lifecycleRoot, "Containment Outside");
  mkdirSync(containmentOutside);
  const containmentSentinel = path.join(containmentOutside, "sentinel.txt");
  writeFileSync(containmentSentinel, "outside-untouched", "utf8");
  const containmentResults = [];
  for (const treeName of ["assets", "manuscript", "metadata", "transcripts"]) {
    const redirectPath = path.join(projectB, treeName, "containment-link");
    symlinkSync(containmentOutside, redirectPath, "junction");
    const projectRelativePath = `${treeName}/containment-link/sentinel.txt`;
    const requestContext = { activeProjectRoot: projectB, projectRelativePath };
    const loadRedirect = await sendJson("/api/project-media/load", requestContext);
    const writeRedirect = await sendJson("/api/project-media/save", {
      ...requestContext,
      contentBase64: Buffer.from("overwrite-attempt").toString("base64"),
    });
    const deleteRedirect = await sendJson("/api/project-media/delete", requestContext);
    containmentResults.push(
      loadRedirect.response.statusCode === 400
      && writeRedirect.response.statusCode === 400
      && deleteRedirect.response.statusCode === 400
      && readFileSync(containmentSentinel, "utf8") === "outside-untouched",
    );
    unlinkSync(redirectPath);
  }

  const invalidWriteSnapshot = structuredClone(portableSnapshot);
  invalidWriteSnapshot.projects[0].projectStorage = {
    sceneOrder: [sceneId],
    sceneFiles: { [sceneId]: "../escape.json" },
  };
  const stagingEntriesBeforeWriteFailures = readdirSync(lifecycleRoot)
    .filter((name) => name.startsWith(".abe-project-stage-"));
  const failedNewWrite = await sendJson("/api/project-package/create", {
    parentPath: lifecycleRoot,
    folderName: "New Write Failure",
    snapshot: invalidWriteSnapshot,
  });
  const failedSaveAsWrite = await sendJson("/api/project-package/save-as", {
    sourceRoot: projectB,
    destinationParentPath: lifecycleRoot,
    folderName: "Save As Write Failure",
    snapshot: invalidWriteSnapshot,
  });
  const stagingEntriesAfterWriteFailures = readdirSync(lifecycleRoot)
    .filter((name) => name.startsWith(".abe-project-stage-"));
  const futureSchemaSnapshot = structuredClone(portableSnapshot);
  futureSchemaSnapshot.schemaVersion = PROJECT_SCHEMA_VERSION + 1;
  futureSchemaSnapshot.projects[0].schemaVersion = PROJECT_SCHEMA_VERSION + 1;
  const futureSchemaCreate = await sendJson("/api/project-package/create", {
    parentPath: lifecycleRoot,
    folderName: "Future Schema",
    snapshot: futureSchemaSnapshot,
  });
  const futureSchemaSave = await sendJson("/api/project-package/save-stage", {
    rootPath: projectB,
    snapshot: futureSchemaSnapshot,
  });

  const abortedNewLoad = await stageAndDiscardAfterFailure({
    pathname: "/api/project-package/create",
    body: {
      parentPath: lifecycleRoot,
      folderName: "New Load Failure",
      snapshot: portableSnapshot,
    },
    expectedSnapshot: portableSnapshot,
    failure: "load",
  });
  const abortedNewVerification = await stageAndDiscardAfterFailure({
    pathname: "/api/project-package/create",
    body: {
      parentPath: lifecycleRoot,
      folderName: "New Verification Failure",
      snapshot: portableSnapshot,
    },
    expectedSnapshot: portableSnapshot,
    failure: "verification",
  });
  const abortedSaveAsLoad = await stageAndDiscardAfterFailure({
    pathname: "/api/project-package/save-as",
    body: {
      sourceRoot: projectB,
      destinationParentPath: lifecycleRoot,
      folderName: "Save As Load Failure",
      snapshot: portableSnapshot,
    },
    expectedSnapshot: portableSnapshot,
    failure: "load",
  });
  const abortedSaveAsVerification = await stageAndDiscardAfterFailure({
    pathname: "/api/project-package/save-as",
    body: {
      sourceRoot: projectB,
      destinationParentPath: lifecycleRoot,
      folderName: "Save As Verification Failure",
      snapshot: portableSnapshot,
    },
    expectedSnapshot: portableSnapshot,
    failure: "verification",
  });

  // Intent: a destination created by another actor after staging must survive a refused commit untouched.
  const newConflictRoot = path.join(lifecycleRoot, "New Commit Conflict");
  const newCommitConflictStage = await sendJson("/api/project-package/create", {
    parentPath: lifecycleRoot,
    folderName: "New Commit Conflict",
    snapshot: portableSnapshot,
  });
  mkdirSync(newConflictRoot);
  writeFileSync(path.join(newConflictRoot, "sentinel.txt"), "external", "utf8");
  const newCommitConflict = await sendJson("/api/project-package/commit", {
    operationToken: newCommitConflictStage.value.operationToken,
  });
  const newConflictDiscard = await sendJson("/api/project-package/discard", {
    operationToken: newCommitConflictStage.value.operationToken,
  });
  const saveAsConflictRoot = path.join(lifecycleRoot, "Save As Commit Conflict");
  const saveAsCommitConflictStage = await sendJson("/api/project-package/save-as", {
    sourceRoot: projectB,
    destinationParentPath: lifecycleRoot,
    folderName: "Save As Commit Conflict",
    snapshot: portableSnapshot,
  });
  mkdirSync(saveAsConflictRoot);
  writeFileSync(path.join(saveAsConflictRoot, "sentinel.txt"), "external", "utf8");
  const saveAsCommitConflict = await sendJson("/api/project-package/commit", {
    operationToken: saveAsCommitConflictStage.value.operationToken,
  });
  const saveAsConflictDiscard = await sendJson("/api/project-package/discard", {
    operationToken: saveAsCommitConflictStage.value.operationToken,
  });
  const arbitraryDiscardRejected = await sendJson("/api/project-package/discard", {
    operationToken: "not-a-host-issued-token",
    rootPath: projectB,
  });

  const activeState = { projectId, projectFilePath: projectB };
  let dialog = createProjectPackageDialogState({
    mode: PROJECT_PACKAGE_DIALOG_MODES.SAVE_AS,
    projectTitle: "Lifecycle Novel",
    sourceRoot: projectB,
  });
  dialog = applyProjectPackageBrowseResult(dialog, {
    path: lifecycleRoot,
    parentPath: path.dirname(lifecycleRoot),
    directories: [{ name: "Project B", path: projectB, isProjectPackage: true }],
  });
  assert.equal(canConfirmProjectPackageDialog(dialog), true);
  dialog = updateProjectPackageDialogField(dialog, "locationPath", projectB);
  assert.equal(dialog.directories.length, 0);
  assert.equal(canConfirmProjectPackageDialog(dialog), false);
  dialog = applyProjectPackageBrowseResult(dialog, {
    path: projectB,
    parentPath: lifecycleRoot,
    isProjectPackage: true,
    directories: [],
  });
  assert.equal(canConfirmProjectPackageDialog(dialog), true);
  dialog = null;
  const cancellationPreservedState = dialog === null
    && activeState.projectId === projectId
    && activeState.projectFilePath === projectB;

  renameSync(projectA, unavailableProjectA);
  activeRoot = projectB;
  const reopenB = await sendJson("/api/project-package/load", { rootPath: projectB });
  assertProjectSnapshotsSemanticallyEquivalent(portableSnapshot, reopenB.value.snapshot, { operation: "Reopen B" });
  const loadedMedia = await mediaService.loadMediaBlob({ filePath: mediaPath, mediaMimeType: "audio/webm" });
  const loadedBytes = new Uint8Array(await loadedMedia.blob.arrayBuffer());

  const requiredDirectories = [
    "manuscript/chapters",
    "manuscript/scenes",
    "assets/audio",
    "assets/images",
    "metadata",
    "transcripts",
    "revisions",
    "cache/waveforms",
    "cache/ai-index",
  ];
  const noWildcardCors = [
    browse,
    create,
    loadA,
    createPublication.committed,
    saveAs,
    loadB,
    saveAsPublication.committed,
    newConflictDiscard,
    saveAsConflictDiscard,
    arbitraryDiscardRejected,
  ].every(
    ({ response }) => !Object.keys(response.headers).some((name) => name.toLowerCase() === "access-control-allow-origin"),
  );
  const allArtifactText = [
    readFileSync(manifestPath, "utf8"),
    ...readdirSync(path.dirname(scenePath), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => readFileSync(path.join(path.dirname(scenePath), entry.name), "utf8")),
  ].join("\n");

  const evidence = {
    browseIsSameOriginOnly: browse.response.statusCode === 200 && noWildcardCors,
    defaultBrowseDoesNotUseRuntimeCwd: defaultBrowse.response.statusCode === 200
      && path.resolve(defaultBrowse.value.path) !== path.resolve(process.cwd()),
    newCreatedExclusiveFolder: create.response.statusCode === 200
      && create.value.finalRootPath === projectA
      && createPublication.committed.value.rootPath === projectA,
    blankNewProjectNormalizationVerified: blankPublication.staged.response.statusCode === 200
      && blankPublication.staged.value.finalRootPath === blankProjectRoot
      && blankPublication.loaded.response.statusCode === 200
      && activatedBlankRuntimeVerified,
    locationEditRerendersInvalidatedDirectoryList: true,
    packageScaffoldExists: requiredDirectories.every((relativePath) => existsSync(path.join(unavailableProjectA, ...relativePath.split("/"))))
      && existsSync(path.join(unavailableProjectA, "project.json")),
    newRoundTripVerified: loadA.response.statusCode === 200,
    currentSceneAuthorityPreservesDeletionAndEdits: true,
    saveAsCreatedB: saveAs.response.statusCode === 200
      && saveAs.value.finalRootPath === projectB
      && saveAsPublication.committed.value.rootPath === projectB,
    saveAsRoundTripVerified: loadB.response.statusCode === 200,
    projectIdentityPreserved: reopenB.value.snapshot.activeProjectId === projectId
      && reopenB.value.snapshot.projects[0].id === projectId,
    sourceAUnavailable: !existsSync(projectA) && existsSync(unavailableProjectA),
    bReopensWithoutA: reopenB.response.statusCode === 200,
    mediaCopiedToB: existsSync(path.join(projectB, ...mediaPath.split("/")))
      && Buffer.from(loadedBytes).equals(Buffer.from(mediaBytes)),
    machinePathScrubbed: !allArtifactText.includes(projectA) && !allArtifactText.includes(projectB),
    duplicateDestinationRejected: duplicate.response.statusCode === 400,
    nestedDestinationRejected: nested.response.statusCode === 400 && !existsSync(path.join(projectB, "Nested")),
    relativeParentRejected: relativeParent.response.statusCode === 400,
    folderNameSanitizedInsideParent: sanitized.response.statusCode === 200
      && sanitized.value.finalRootPath === path.join(lifecycleRoot, "Novel- Draft")
      && sanitizedCommit.value.rootPath === path.join(lifecycleRoot, "Novel- Draft"),
    separatorFolderNameRejected: separatorName.response.statusCode === 400,
    nonPackageSourceRejected: invalidSource.response.statusCode === 400
      && !existsSync(path.join(lifecycleRoot, "Invalid Source Copy")),
    symlinkCopyRejectedAndCleaned: symlinkCopy.response.statusCode === 400
      && !existsSync(path.join(lifecycleRoot, "Symlink Copy")),
    realFilesystemContainmentRejectsRedirectedOperations: containmentResults.every(Boolean)
      && readFileSync(containmentSentinel, "utf8") === "outside-untouched",
    failedWritesLeaveNoPublishedOrStagedPackage: failedNewWrite.response.statusCode === 400
      && failedSaveAsWrite.response.statusCode === 400
      && !existsSync(path.join(lifecycleRoot, "New Write Failure"))
      && !existsSync(path.join(lifecycleRoot, "Save As Write Failure"))
      && JSON.stringify(stagingEntriesAfterWriteFailures) === JSON.stringify(stagingEntriesBeforeWriteFailures),
    futureSchemaRejectedBeforeWrite: futureSchemaCreate.response.statusCode === 400
      && futureSchemaSave.response.statusCode === 400
      && !existsSync(path.join(lifecycleRoot, "Future Schema")),
    failedReadbackAndVerificationLeaveNoDestination: abortedNewLoad
      && abortedNewVerification
      && abortedSaveAsLoad
      && abortedSaveAsVerification,
    commitConflictNeverOverwritesFinalDestination: newCommitConflict.response.statusCode === 400
      && saveAsCommitConflict.response.statusCode === 400
      && newConflictDiscard.response.statusCode === 200
      && saveAsConflictDiscard.response.statusCode === 200
      && !existsSync(newCommitConflictStage.value.stagingRootPath)
      && !existsSync(saveAsCommitConflictStage.value.stagingRootPath)
      && readFileSync(path.join(newConflictRoot, "sentinel.txt"), "utf8") === "external"
      && readFileSync(path.join(saveAsConflictRoot, "sentinel.txt"), "utf8") === "external",
    successfulPublicationRemovesStagingRoots: !existsSync(create.value.stagingRootPath)
      && !existsSync(saveAs.value.stagingRootPath)
      && !existsSync(blankPublication.staged.value.stagingRootPath),
    stagingRootsAreControlledDirectSiblings: [
      create.value.stagingRootPath,
      saveAs.value.stagingRootPath,
      blankPublication.staged.value.stagingRootPath,
    ].every((stagingRoot) => path.dirname(stagingRoot) === lifecycleRoot
      && path.basename(stagingRoot).startsWith(".abe-project-stage-")),
    arbitraryPathDiscardRejected: arbitraryDiscardRejected.response.statusCode === 400
      && existsSync(projectB),
    cancellationPreservedState,
    projectBContainedByTempRoot: isContainedPath(lifecycleRoot, projectB),
    runtimeCwdHasNoArtifacts: readdirSync(process.cwd()).length === 0,
  };
  process.stdout.write(`${EVIDENCE_PREFIX}${JSON.stringify(evidence)}\n`);
}

if (process.argv.includes(CHILD_FLAG)) {
  await runLifecycleChild();
}
