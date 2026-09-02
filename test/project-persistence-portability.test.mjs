// Intent: pin project-folder authority by exercising package persistence and normal narration media storage in an isolated process.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHILD_FLAG = "--portability-scenario-child";
const EVIDENCE_PREFIX = "ABE_PORTABILITY_EVIDENCE=";
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

// Intent: detect ignored or tracked project/runtime artifacts that ordinary Git status can miss.
function snapshotBoundedWorktreeFootprint() {
  const watchedPaths = new Set([
    "project-media",
    "logs",
    "test-results",
    "SaveTestFile",
    path.join("apps", "desktop", ".desktop-state.json"),
  ]);

  for (const entry of readdirSync(WORKTREE_ROOT, { withFileTypes: true })) {
    if (/\.abe-project(?:\.json)?(?:\.|$)/i.test(entry.name)) {
      watchedPaths.add(entry.name);
    }
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

    footprint[relativePath] = createHash("sha256")
      .update(readFileSync(absolutePath))
      .digest("hex");
  };

  for (const relativePath of [...watchedPaths].sort()) {
    visit(relativePath);
  }
  return footprint;
}

function parseChildEvidence(stdout) {
  const evidenceLine = String(stdout ?? "")
    .split(/\r?\n/)
    .find((line) => line.startsWith(EVIDENCE_PREFIX));
  assert.ok(evidenceLine, "Portability child did not emit its evidence object.");
  return JSON.parse(evidenceLine.slice(EVIDENCE_PREFIX.length));
}

export async function runProjectPersistencePortabilityTest() {
  const externalProjectRoot = mkdtempSync(path.join(tmpdir(), "abe-portability-project-"));
  const runtimeCwd = mkdtempSync(path.join(tmpdir(), "abe-portability-cwd-"));
  const externalLogRoot = mkdtempSync(path.join(tmpdir(), "abe-portability-logs-"));
  const selectedProjectFolder = path.join(externalProjectRoot, "portable-synthetic-project");
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
        ABE_LOG_PATH: path.join(externalLogRoot, "desktop.log"),
        ABE_DEVELOPER_RUNTIME_LOG_DIR: path.join(externalLogRoot, "runtime"),
        ABE_PORTABILITY_PROJECT_ROOT: externalProjectRoot,
        ABE_PORTABILITY_PROJECT_FOLDER: selectedProjectFolder,
        ABE_PORTABILITY_RUNTIME_CWD: runtimeCwd,
        ABE_PORTABILITY_WORKTREE_ROOT: WORKTREE_ROOT,
      },
    });

    assert.equal(child.error, undefined, `Portability child failed to launch: ${child.error?.message ?? "unknown error"}`);
    assert.equal(
      child.status,
      0,
      `Portability child scenario failed.\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}`,
    );

    const evidence = parseChildEvidence(child.stdout);
    assert.equal(evidence.packageSaveSucceeded, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.packageReloadSucceeded, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.projectIdentityRoundTripped, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.manuscriptContentRoundTripped, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.semanticMutationRoundTripped, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.hostReturnedProjectRootIsDirectory, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.hostReturnedProjectRootUnderSelection, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.manifestUnderProjectRoot, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.sceneSidecarUnderProjectRoot, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.narrationSaved, true, JSON.stringify(evidence, null, 2));
    assert.match(evidence.producedMediaLogicalPath, /^assets\/audio\/[^/]+$/);
    assert.equal(evidence.logicalReferenceIsRelative, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.durableReferenceRemainedLogical, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.mediaFileExists, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.actualMediaUnderProjectRoot, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.actualMediaUnderRuntimeCwd, false, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.actualMediaUnderWorktree, false, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.saveLoadByteRoundTrip, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.loadedMediaPhysicalPathMatchesSave, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.traversalEscapeRejected, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.absoluteEscapeRejected, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.loadEscapesRejected, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.deleteEscapesRejected, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.missingProjectRootRejected, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.legacySingleFileRootRejected, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.defaultLibraryRootRejected, true, JSON.stringify(evidence, null, 2));
    assert.equal(evidence.noRejectedMediaFileCreated, true, JSON.stringify(evidence, null, 2));

    const afterFootprint = snapshotBoundedWorktreeFootprint();
    assert.deepEqual(afterFootprint, beforeFootprint, "The isolated portability scenario changed the bounded worktree artifact footprint.");

    assert.equal(evidence.actualMediaPhysicalPath, evidence.desiredMediaPhysicalPath, JSON.stringify(evidence, null, 2));
  } finally {
    rmSync(externalProjectRoot, { recursive: true, force: true });
    rmSync(runtimeCwd, { recursive: true, force: true });
    rmSync(externalLogRoot, { recursive: true, force: true });
  }
}

async function runPortabilityScenarioChild() {
  const externalProjectRoot = process.env.ABE_PORTABILITY_PROJECT_ROOT;
  const selectedProjectFolder = process.env.ABE_PORTABILITY_PROJECT_FOLDER;
  const runtimeCwd = process.env.ABE_PORTABILITY_RUNTIME_CWD;
  const worktreeRoot = process.env.ABE_PORTABILITY_WORKTREE_ROOT;
  if (!externalProjectRoot || !selectedProjectFolder || !runtimeCwd || !worktreeRoot) {
    throw new Error("Portability child requires all three temporary roots and the worktree root.");
  }

  const [
    { createDesktopResponseForRequest },
    { createNarrationRecordingRuntime },
    { createNarrationRecordingFinalizationService },
    { createNarrationMediaService },
  ] = await Promise.all([
    import(new URL("../apps/desktop/src/http-app.ts", import.meta.url)),
    import(new URL("../apps/editor/public/features/narration/narration-take-service.js", import.meta.url)),
    import(new URL("../apps/editor/public/features/narration/narration-recording-finalization-service.js", import.meta.url)),
    import(new URL("../apps/editor/public/features/narration/narration-media-service.js", import.meta.url)),
  ]);

  const projectId = "project-portability";
  const sceneId = "scene-portability";
  const authoredText = "The portable lantern stayed lit.";
  const semanticMutation = {
    id: "note-portability-proof",
    title: "Portability proof",
    body: "This project-owned note survived the selected-folder round trip.",
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    anchor: null,
  };
  const syntheticSnapshot = {
    schemaVersion: 2,
    activeProjectId: projectId,
    projects: [{
      id: projectId,
      schemaVersion: 2,
      title: "Portable Synthetic Project",
      projectSettings: { activeSceneId: sceneId },
      projectIndex: {
        sceneOrder: [sceneId],
        scenes: [{
          id: sceneId,
          chapterId: "chapter-portability",
          title: "A Small Departure",
          synopsis: "A deterministic portability fixture.",
        }],
      },
      structureDrafts: {
        scenes: [{
          sceneId,
          chapterId: "chapter-portability",
          chapterTitle: "Chapter One",
          sceneTitle: "A Small Departure",
          sceneSynopsis: "A deterministic portability fixture.",
          order: 1,
          initialText: authoredText,
        }],
      },
      passageNotes: [],
      workspace: {
        project: {
          lines: [{
            sceneId,
            chapterId: "chapter-portability",
            chapterTitle: "Chapter One",
            sceneTitle: "A Small Departure",
            sceneSynopsis: "A deterministic portability fixture.",
            blockId: "block-portability",
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
          chapterId: "chapter-portability",
          chapterTitle: "Chapter One",
          sceneTitle: "A Small Departure",
          sceneSynopsis: "A deterministic portability fixture.",
          editorText: authoredText,
          blocks: [{
            blockId: "block-portability",
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

  const sendDesktopJson = async (pathname, body) => {
    const response = await createDesktopResponseForRequest({
      method: "POST",
      pathname,
      body: JSON.stringify(body),
    });
    const value = JSON.parse(String(response.body));
    return { response, value };
  };

  const firstSave = await sendDesktopJson("/api/project-file/save", {
    filePath: selectedProjectFolder,
    snapshot: syntheticSnapshot,
  });
  const hostReturnedProjectRoot = firstSave.value.filePath;
  const firstLoad = await sendDesktopJson("/api/project-file/load", {
    filePath: hostReturnedProjectRoot,
  });
  const loadedSnapshot = firstLoad.value;
  loadedSnapshot.projects[0].passageNotes = [semanticMutation];

  const mutationSave = await sendDesktopJson("/api/project-file/save", {
    filePath: hostReturnedProjectRoot,
    snapshot: loadedSnapshot,
  });
  const mutationLoad = await sendDesktopJson("/api/project-file/load", {
    filePath: mutationSave.value.filePath,
  });
  const reloadedSnapshot = mutationLoad.value;

  let actualMediaPhysicalPath = "";
  let loadedMediaPhysicalPath = "";
  const mediaService = createNarrationMediaService({
    getActiveProjectRoot: () => hostReturnedProjectRoot,
    fetchJson: async (pathname, options = {}) => {
      const result = await sendDesktopJson(pathname, options.body);
      const ok = result.response.statusCode >= 200 && result.response.statusCode < 300;
      if (ok && pathname === "/api/project-media/save") {
        actualMediaPhysicalPath = result.value.filePath;
      }
      if (ok && pathname === "/api/project-media/load") {
        loadedMediaPhysicalPath = result.value.filePath;
      }
      return ok
        ? { ok: true, value: result.value }
        : { ok: false, error: new Error(result.value.message ?? "Desktop request failed.") };
    },
  });
  const selection = {
    sceneId,
    sceneTitle: "A Small Departure",
    chapterId: "chapter-portability",
    chapterTitle: "Chapter One",
    blockId: "block-portability",
    lineNumber: 1,
    verseText: authoredText,
  };
  const runtime = createNarrationRecordingRuntime(selection, {
    projectId,
    mediaMimeType: "audio/webm",
    recordingId: "take-portability-proof",
    nowMs: 1_788_307_200_000,
  });
  const deterministicMediaBytes = new Uint8Array([0x41, 0x42, 0x45, 0x01]);
  runtime.chunks.push(new Blob([deterministicMediaBytes], {
    type: "audio/webm",
  }));

  const finalizationService = createNarrationRecordingFinalizationService({
    cleanupRuntime: () => {},
    saveMediaBlob: mediaService.saveMediaBlob,
    resolveSelection: () => selection,
    getProjectId: () => projectId,
    blobConstructor: Blob,
  });
  const narrationResult = await finalizationService.finalizeRuntime(runtime);
  const loadedNarration = await mediaService.loadMediaBlob({
    filePath: narrationResult.finalRecord.mediaPath,
    mediaMimeType: narrationResult.finalRecord.mediaMimeType,
  });
  const loadedMediaBytes = new Uint8Array(await loadedNarration.blob.arrayBuffer());

  // Intent: prove the strict desktop project-media path cannot escape or borrow non-package roots.
  const contentBase64 = Buffer.from(deterministicMediaBytes).toString("base64");
  const traversalEscapePath = path.resolve(hostReturnedProjectRoot, "..", "escape.webm");
  const absoluteEscapePath = path.join(runtimeCwd, "absolute-escape.webm");
  const missingRootCwdPath = path.join(runtimeCwd, ...runtime.mediaPath.split("/"));
  const legacyProjectFilePath = path.join(externalProjectRoot, "legacy.abe-project.json");
  writeFileSync(legacyProjectFilePath, JSON.stringify(syntheticSnapshot), "utf8");
  const traversalEscape = await sendDesktopJson("/api/project-media/save", {
    activeProjectRoot: hostReturnedProjectRoot,
    projectRelativePath: "../escape.webm",
    contentBase64,
  });
  const absoluteEscape = await sendDesktopJson("/api/project-media/save", {
    activeProjectRoot: hostReturnedProjectRoot,
    projectRelativePath: absoluteEscapePath,
    contentBase64,
  });
  const traversalLoad = await sendDesktopJson("/api/project-media/load", {
    activeProjectRoot: hostReturnedProjectRoot,
    projectRelativePath: "../escape.webm",
  });
  const absoluteLoad = await sendDesktopJson("/api/project-media/load", {
    activeProjectRoot: hostReturnedProjectRoot,
    projectRelativePath: absoluteEscapePath,
  });
  const traversalDelete = await sendDesktopJson("/api/project-media/delete", {
    activeProjectRoot: hostReturnedProjectRoot,
    projectRelativePath: "../escape.webm",
  });
  const absoluteDelete = await sendDesktopJson("/api/project-media/delete", {
    activeProjectRoot: hostReturnedProjectRoot,
    projectRelativePath: absoluteEscapePath,
  });
  const missingProjectRoot = await sendDesktopJson("/api/project-media/save", {
    activeProjectRoot: "",
    projectRelativePath: runtime.mediaPath,
    contentBase64,
  });
  const relativePathWithoutContext = await sendDesktopJson("/api/project-media/save", {
    filePath: runtime.mediaPath,
    contentBase64,
  });
  const legacySingleFileRoot = await sendDesktopJson("/api/project-media/save", {
    activeProjectRoot: legacyProjectFilePath,
    projectRelativePath: runtime.mediaPath,
    contentBase64,
  });
  const defaultLibraryRoot = await sendDesktopJson("/api/project-media/save", {
    activeProjectRoot: externalProjectRoot,
    projectRelativePath: runtime.mediaPath,
    contentBase64,
  });

  const manifestPath = path.join(hostReturnedProjectRoot, "project.json");
  const sceneSidecarPath = path.join(
    hostReturnedProjectRoot,
    "manuscript",
    "scenes",
    projectId,
    `scene_${sceneId}.json`,
  );
  const desiredMediaLogicalPath = path.join(
    "assets",
    "audio",
    path.basename(runtime.mediaPath),
  ).split(path.sep).join("/");
  const desiredMediaPhysicalPath = path.join(hostReturnedProjectRoot, ...desiredMediaLogicalPath.split("/"));
  const reloadedProject = reloadedSnapshot.projects.find((project) => project.id === projectId);
  const reloadedScene = reloadedSnapshot.sceneStore?.[projectId]?.[sceneId];
  const reloadedMutation = reloadedProject?.passageNotes?.find((note) => note.id === semanticMutation.id);

  const evidence = {
    externalProjectRoot,
    selectedProjectFolder,
    runtimeCwd,
    hostReturnedProjectRoot,
    packageSaveSucceeded: firstSave.response.statusCode === 200 && mutationSave.response.statusCode === 200,
    packageReloadSucceeded: firstLoad.response.statusCode === 200 && mutationLoad.response.statusCode === 200,
    projectIdentityRoundTripped: reloadedSnapshot.activeProjectId === projectId && reloadedProject?.id === projectId,
    manuscriptContentRoundTripped: reloadedScene?.blocks?.[0]?.text === authoredText,
    semanticMutationRoundTripped: reloadedMutation?.body === semanticMutation.body,
    hostReturnedProjectRootIsDirectory: existsSync(hostReturnedProjectRoot) && lstatSync(hostReturnedProjectRoot).isDirectory(),
    hostReturnedProjectRootUnderSelection: isContainedPath(externalProjectRoot, hostReturnedProjectRoot),
    manifestPath,
    manifestUnderProjectRoot: existsSync(manifestPath) && isContainedPath(hostReturnedProjectRoot, manifestPath),
    sceneSidecarPath,
    sceneSidecarUnderProjectRoot: existsSync(sceneSidecarPath) && isContainedPath(hostReturnedProjectRoot, sceneSidecarPath),
    narrationSaved: narrationResult.finalRecord?.status === "saved",
    producedMediaLogicalPath: runtime.mediaPath,
    logicalReferenceIsRelative: !path.isAbsolute(runtime.mediaPath)
      && !runtime.mediaPath.startsWith("/")
      && !/^[A-Za-z]:/.test(runtime.mediaPath),
    durableReferenceRemainedLogical: narrationResult.finalRecord?.mediaPath === runtime.mediaPath,
    desiredMediaLogicalPath,
    desiredMediaPhysicalPath,
    actualMediaPhysicalPath,
    mediaFileExists: Boolean(actualMediaPhysicalPath) && existsSync(actualMediaPhysicalPath),
    actualMediaUnderProjectRoot: Boolean(actualMediaPhysicalPath) && isContainedPath(hostReturnedProjectRoot, actualMediaPhysicalPath),
    actualMediaUnderRuntimeCwd: Boolean(actualMediaPhysicalPath) && isContainedPath(runtimeCwd, actualMediaPhysicalPath),
    actualMediaUnderWorktree: Boolean(actualMediaPhysicalPath) && isContainedPath(worktreeRoot, actualMediaPhysicalPath),
    loadedMediaPhysicalPath,
    loadedMediaPhysicalPathMatchesSave: loadedMediaPhysicalPath === actualMediaPhysicalPath,
    saveLoadByteRoundTrip: Buffer.from(loadedMediaBytes).equals(Buffer.from(deterministicMediaBytes)),
    traversalEscapeRejected: traversalEscape.response.statusCode === 400,
    absoluteEscapeRejected: absoluteEscape.response.statusCode === 400,
    loadEscapesRejected: traversalLoad.response.statusCode === 400 && absoluteLoad.response.statusCode === 400,
    deleteEscapesRejected: traversalDelete.response.statusCode === 400 && absoluteDelete.response.statusCode === 400,
    missingProjectRootRejected: missingProjectRoot.response.statusCode === 400
      && relativePathWithoutContext.response.statusCode === 400,
    legacySingleFileRootRejected: legacySingleFileRoot.response.statusCode === 400,
    defaultLibraryRootRejected: defaultLibraryRoot.response.statusCode === 400,
    noRejectedMediaFileCreated: !existsSync(traversalEscapePath)
      && !existsSync(absoluteEscapePath)
      && !existsSync(missingRootCwdPath),
  };

  process.stdout.write(`${EVIDENCE_PREFIX}${JSON.stringify(evidence)}\n`);
}

if (process.argv.includes(CHILD_FLAG)) {
  await runPortabilityScenarioChild();
}
