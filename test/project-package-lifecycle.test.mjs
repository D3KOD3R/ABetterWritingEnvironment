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
    },
    { buildPortableExternalProjectSnapshot },
    {
      PROJECT_PACKAGE_DIALOG_MODES,
      createProjectPackageDialogState,
    },
  ] = await Promise.all([
    import(new URL("../apps/desktop/src/http-app.ts", import.meta.url)),
    import(new URL("../apps/editor/public/features/narration/narration-media-service.js", import.meta.url)),
    import(new URL("../apps/editor/public/adapters/storage/project-snapshot-verification.js", import.meta.url)),
    import(new URL("../apps/editor/public/adapters/storage/project-persistence-service.js", import.meta.url)),
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

  // Intent: reproduce New Project's empty structure overlay before the richer portability fixture masks normalization.
  const blankProjectId = "project-blank-lifecycle";
  const blankSceneId = "scene-blank-lifecycle";
  const blankPortableSnapshot = buildPortableExternalProjectSnapshot({
    schemaVersion: 2,
    activeProjectId: blankProjectId,
    projects: [{
      id: blankProjectId,
      schemaVersion: 2,
      title: "Blank Lifecycle Novel",
      projectSettings: { activeSceneId: blankSceneId },
      projectIndex: {
        sceneOrder: [blankSceneId],
        scenes: [{ id: blankSceneId, chapterId: "chapter-0001", title: "Scene 1", synopsis: "" }],
      },
      structureDrafts: { scenes: [], sceneOrder: [] },
      workspace: {
        project: {
          lines: [{
            sceneId: blankSceneId,
            chapterId: "chapter-0001",
            chapterTitle: "Chapter 1",
            sceneTitle: "Scene 1",
            sceneSynopsis: "",
            blockId: "block-0001",
            lineNumber: 1,
            kind: "narration",
            speakerLabel: "",
            text: "",
            issueIds: [],
            eventTagIds: [],
          }],
        },
      },
    }],
    sceneStore: {
      [blankProjectId]: {
        [blankSceneId]: {
          sceneId: blankSceneId,
          chapterId: "chapter-0001",
          chapterTitle: "Chapter 1",
          sceneTitle: "Scene 1",
          sceneSynopsis: "",
          editorText: "",
          blocks: [{
            blockId: "block-0001",
            lineNumber: 1,
            kind: "narration",
            speakerLabel: "",
            text: "",
            issueIds: [],
            eventTagIds: [],
            isDraft: false,
          }],
        },
      },
    },
  });

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

  const browse = await sendJson("/api/project-package/browse", { path: lifecycleRoot });
  const defaultBrowse = await sendJson("/api/project-package/browse", { path: "" });
  const createBlank = await sendJson("/api/project-package/create", {
    parentPath: lifecycleRoot,
    folderName: "Blank Project",
    snapshot: blankPortableSnapshot,
  });
  const loadBlank = await sendJson("/api/project-package/load", { rootPath: createBlank.value.rootPath });
  assertProjectSnapshotsSemanticallyEquivalent(blankPortableSnapshot, loadBlank.value.snapshot, {
    operation: "Blank New Project package",
  });
  const create = await sendJson("/api/project-package/create", {
    parentPath: lifecycleRoot,
    folderName: "Project A",
    snapshot: portableSnapshot,
  });
  const loadA = await sendJson("/api/project-package/load", { rootPath: create.value.rootPath });
  assertProjectSnapshotsSemanticallyEquivalent(portableSnapshot, loadA.value.snapshot, { operation: "New package" });

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

  const saveAs = await sendJson("/api/project-package/save-as", {
    sourceRoot: projectA,
    destinationParentPath: lifecycleRoot,
    folderName: "Project B",
    snapshot: portableSnapshot,
  });
  const loadB = await sendJson("/api/project-package/load", { rootPath: saveAs.value.rootPath });
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
  const noWildcardCors = [browse, create, loadA, saveAs, loadB].every(
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
    newCreatedExclusiveFolder: create.response.statusCode === 200 && create.value.rootPath === projectA,
    blankNewProjectNormalizationVerified: createBlank.response.statusCode === 200
      && createBlank.value.rootPath === blankProjectRoot
      && loadBlank.response.statusCode === 200,
    packageScaffoldExists: requiredDirectories.every((relativePath) => existsSync(path.join(unavailableProjectA, ...relativePath.split("/"))))
      && existsSync(path.join(unavailableProjectA, "project.json")),
    newRoundTripVerified: loadA.response.statusCode === 200,
    saveAsCreatedB: saveAs.response.statusCode === 200 && saveAs.value.rootPath === projectB,
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
      && sanitized.value.rootPath === path.join(lifecycleRoot, "Novel- Draft"),
    separatorFolderNameRejected: separatorName.response.statusCode === 400,
    nonPackageSourceRejected: invalidSource.response.statusCode === 400
      && !existsSync(path.join(lifecycleRoot, "Invalid Source Copy")),
    symlinkCopyRejectedAndCleaned: symlinkCopy.response.statusCode === 400
      && !existsSync(path.join(lifecycleRoot, "Symlink Copy")),
    cancellationPreservedState,
    projectBContainedByTempRoot: isContainedPath(lifecycleRoot, projectB),
    runtimeCwdHasNoArtifacts: readdirSync(process.cwd()).length === 0,
  };
  process.stdout.write(`${EVIDENCE_PREFIX}${JSON.stringify(evidence)}\n`);
}

if (process.argv.includes(CHILD_FLAG)) {
  await runLifecycleChild();
}
