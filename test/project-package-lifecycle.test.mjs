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
    {
      PROJECT_PACKAGE_DIALOG_MODES,
      createProjectPackageDialogState,
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
      projectSettings: { activeSceneId: sceneId, projectFilePath: projectA },
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

  const sendJson = async (pathname, body) => {
    const response = await createDesktopResponseForRequest({ method: "POST", pathname, body: JSON.stringify(body) });
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
      && blankPublication.loaded.response.statusCode === 200,
    packageScaffoldExists: requiredDirectories.every((relativePath) => existsSync(path.join(unavailableProjectA, ...relativePath.split("/"))))
      && existsSync(path.join(unavailableProjectA, "project.json")),
    newRoundTripVerified: loadA.response.statusCode === 200,
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
    failedWritesLeaveNoPublishedOrStagedPackage: failedNewWrite.response.statusCode === 400
      && failedSaveAsWrite.response.statusCode === 400
      && !existsSync(path.join(lifecycleRoot, "New Write Failure"))
      && !existsSync(path.join(lifecycleRoot, "Save As Write Failure"))
      && JSON.stringify(stagingEntriesAfterWriteFailures) === JSON.stringify(stagingEntriesBeforeWriteFailures),
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
