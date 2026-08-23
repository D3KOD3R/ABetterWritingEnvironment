// Intent: smoke test the desktop host, project-file routes, editor modules, and bundled workspace assets.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveLoadedProjectFilePath } from "../apps/editor/public/shared/project-file-path.js";

export async function runDesktopApplicationTest() {
  // Intent: keep desktop runtime and structured logs out of the repository during host integration checks.
  const runtimeLogDirectory = mkdtempSync(path.join(tmpdir(), "abe-desktop-runtime-logs-"));
  const previousRuntimeLogDirectory = process.env.ABE_DEVELOPER_RUNTIME_LOG_DIR;
  const previousDesktopLogPath = process.env.ABE_LOG_PATH;
  process.env.ABE_DEVELOPER_RUNTIME_LOG_DIR = runtimeLogDirectory;
  process.env.ABE_LOG_PATH = path.join(runtimeLogDirectory, "desktop.log");

  try {
    const { createDesktopResponse, createDesktopResponseForRequest } = await import("../apps/desktop/src/http-app.ts");
    const { createDesktopWorkspaceSnapshot } = await import("../apps/desktop/src/workspace.ts");
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const workspace = createDesktopWorkspaceSnapshot();

  assert.equal(workspace.workspaceTitle, "ABetterNovelAuthoringEnvironment");
  assert.equal(workspace.settings.executionMode, "local-only");
  assert.equal(workspace.project.lines.length, 7);
  assert.equal(workspace.project.lines[0].sceneLineNumber, 1);
  assert.equal(workspace.project.issues.length, 3);
  assert.equal(workspace.project.issues[0].sceneLineNumber, 2);
  assert.equal(workspace.project.issues[0].anchor.sceneId, "scene-0001");
  assert.equal(workspace.project.issues[0].lifecycle, "open");
  assert.equal(workspace.project.eventTags.length, 3);
  assert.equal(workspace.project.eventTags[0].sceneLineNumber, 3);
  assert.equal(workspace.project.characters.length, 3);
  assert.equal(workspace.world.spines.length, 3);
  assert.equal(workspace.world.entities.length, 3);
  assert.equal(workspace.analysis.suggestionQueue.length, 4);
  assert.equal(workspace.analysis.dreamScaping.ideaTitle, "Signal under the ice");
  assert.equal(
    workspace.analysis.suggestionQueue.some(
      (suggestion) => suggestion.suggestionType === "dream-scaping",
    ),
    true,
  );
  assert.equal(workspace.narration.session.currentLineNumber, 5);
  assert.equal(workspace.voice.renderJobs.length, 2);
  assert.equal(workspace.project.navigationTargets["scene-0002"].lineNumber, 4);
  assert.match(workspace.analysis.suggestionQueue[0].title, /Station/);
  assert.equal(
    resolveLoadedProjectFilePath(
      "C:\\Users\\ASUS\\Desktop\\Repos\\ABetterNovelAuthoringEnvironment\\SaveTestFile\\project-serva-vitae.abe-project.json",
      "C:\\Users\\ASUS\\Desktop\\Repos\\ABetterNovelAuthoringEnvironment\\project-serva-vitae.abe-project.json",
    ),
    "C:\\Users\\ASUS\\Desktop\\Repos\\ABetterNovelAuthoringEnvironment\\SaveTestFile\\project-serva-vitae.abe-project.json",
  );
  assert.equal(
    resolveLoadedProjectFilePath(
      "",
      "C:\\Users\\ASUS\\Desktop\\Repos\\ABetterNovelAuthoringEnvironment\\SaveTestFile\\project-serva-vitae.abe-project.json",
    ),
    "C:\\Users\\ASUS\\Desktop\\Repos\\ABetterNovelAuthoringEnvironment\\SaveTestFile\\project-serva-vitae.abe-project.json",
  );
  assert.equal(resolveLoadedProjectFilePath("", ""), "");

  const root = createDesktopResponse("/");
  assert.equal(root.statusCode, 200);
  assert.match(root.body, /Loading the local-first workspace/);

  const indexHtml = createDesktopResponse("/index.html");
  assert.equal(indexHtml.statusCode, 200);
  assert.match(indexHtml.body, /serva-vitae-project-library\.js/);
  assert.match(indexHtml.body, /<script type="module" src="\.\//);

  const workspaceResponse = createDesktopResponse("/api/workspace");
  assert.equal(workspaceResponse.statusCode, 200);
  const parsed = JSON.parse(workspaceResponse.body);
  assert.equal(parsed.analysis.provider.id, "local-rule-analysis");
  assert.equal(parsed.analysis.lastJob.result.suggestionCount, 3);
  assert.equal(parsed.voice.provider.id, "local-voice-suite");

  const settingsResponse = createDesktopResponse("/api/settings");
  assert.equal(settingsResponse.statusCode, 200);
  const desktopSettings = JSON.parse(settingsResponse.body);
  assert.equal(typeof desktopSettings.spotifyClientId, "string");
  assert.equal(typeof desktopSettings.lastProjectFilePath, "string");
  assert.equal(typeof desktopSettings.lastProjectFilePathExplicit, "boolean");

  const directRealtimeSpeechProvidersResponse = createDesktopResponse("/api/realtime-speech/providers");
  assert.equal(directRealtimeSpeechProvidersResponse.statusCode, 200);
  const directRealtimeSpeechProviders = JSON.parse(directRealtimeSpeechProvidersResponse.body);
  assert.equal(directRealtimeSpeechProviders.ok, true);
  assert.equal(
    directRealtimeSpeechProviders.providers.some((provider) => provider.id === "local-sherpa-onnx"),
    true,
  );

  const realtimeSpeechProvidersResponse = await createDesktopResponseForRequest({
    method: "GET",
    pathname: "/api/realtime-speech/providers",
  });
  assert.equal(realtimeSpeechProvidersResponse.statusCode, 200);
  const realtimeSpeechProviders = JSON.parse(realtimeSpeechProvidersResponse.body);
  assert.equal(realtimeSpeechProviders.ok, true);
  assert.equal(
    realtimeSpeechProviders.providers.some((provider) => provider.id === "local-sherpa-onnx"),
    true,
  );

  const whisperCapabilityResponse = await createDesktopResponseForRequest({
    method: "GET",
    pathname: "/api/whisper-cpp/capability",
  });
  assert.equal(whisperCapabilityResponse.statusCode, 200);
  const whisperCapability = JSON.parse(whisperCapabilityResponse.body);
  assert.equal(whisperCapability.requiresInternet, false);

  const directWhisperCapabilityResponse = createDesktopResponse("/api/whisper-cpp/capability");
  assert.equal(directWhisperCapabilityResponse.statusCode, 200);
  assert.equal(JSON.parse(directWhisperCapabilityResponse.body).requiresInternet, false);

  const updateSettingsResponse = await createDesktopResponseForRequest({
    method: "POST",
    pathname: "/api/settings",
    body: JSON.stringify({
      lastProjectFilePath: desktopSettings.lastProjectFilePath,
    }),
  });
  assert.equal(updateSettingsResponse.statusCode, 200);

  const projectLibraryResponse = createDesktopResponse("/api/project-library");
  assert.equal(projectLibraryResponse.statusCode, 200);
  const projectLibrary = JSON.parse(projectLibraryResponse.body);
  assert.equal(projectLibrary.activeProjectId, "project-serva-vitae");
  assert.equal(projectLibrary.projects.length, 1);
  assert.equal(projectLibrary.projects[0].title, "Project Serva Vitae");
  assert.equal(projectLibrary.projects[0].source, "project-file");
  assert.equal(projectLibrary.projects[0].workspace.project.stats.chapterCount, 4);
  assert.equal(projectLibrary.projects[0].workspace.project.stats.sceneCount, 29);
  assert.equal(typeof projectLibrary.projects[0].projectSettings, "object");
  assert.equal(
    projectLibrary.projects[0].projectSettings.projectFilePath,
    path.join(repoRoot, "project-serva-vitae.abe-project.json"),
  );
  assert.equal(projectLibrary.projects[0].projectSettings.writingTargetViewMode, "month");
  assert.equal(projectLibrary.projects[0].projectSettings.consoleDockCollapsed, false);
  assert.equal("userSettingPanelResizerLeftPercent" in projectLibrary.projects[0].projectSettings, true);
  assert.equal("userSettingPanelResizerRightPercent" in projectLibrary.projects[0].projectSettings, true);
  assert.equal(typeof projectLibrary.projects[0].projectSettings.projectSourcePath, "string");
  assert.equal(projectLibrary.projects[0].passageNotes.length, 19);
  assert.equal(projectLibrary.projects[0].sourceArchive.length, 5);
  assert.equal(projectLibrary.projects[0].importReport.importedWorldNotes, 11);
  assert.equal(projectLibrary.projects[0].manuscriptTasks.length, 52);
  assert.equal(projectLibrary.projects[0].workspace.project.lines.length, 855);
  assert.equal(
    projectLibrary.projects[0].workspace.world.templates.filter(
      (template) => template.source === "source-template",
    ).length,
    6,
  );
  assert.equal(
    projectLibrary.projects[0].workspace.world.templates.filter(
      (template) => template.source === "source-template",
    ).every((template) => /Template Sheets/.test(template.sourcePath ?? "")),
    true,
  );
  assert.equal(
    projectLibrary.projects[0].workspace.world.templates.filter(
      (template) => template.source === "source-template",
    ).every((template) => typeof template.sourceText === "string" && template.sourceText.trim().length > 0),
    true,
  );
  assert.equal(
    projectLibrary.projects[0].workspace.world.templates.find((template) => template.name === "Flora")?.source,
    "manual",
  );

  const tempProjectDir = mkdtempSync(path.join(tmpdir(), "abe-project-file-"));
  const savedProjectPath = path.join(tempProjectDir, "project-file.abe-project.json");
  const projectLibraryWithMetadataFolder = structuredClone(projectLibrary);
  projectLibraryWithMetadataFolder.projects[0].metadataSubgroups = [
    {
      id: "metadata-folder-archive-leads",
      groupId: "research",
      title: "Archive Leads",
      createdAt: "2026-07-17T01:00:00.000Z",
      updatedAt: "2026-07-17T01:05:00.000Z",
      notes: [
        {
          id: "metadata-folder-note-library-lead",
          title: "Library lead",
          body: "Ask whether the record names the orbital platform.",
          createdAt: "2026-07-17T01:05:00.000Z",
          updatedAt: "2026-07-17T01:05:00.000Z",
          anchor: null,
        },
      ],
      folders: [
        {
          id: "metadata-folder-primary-sources",
          groupId: "research",
          title: "Primary Sources",
          createdAt: "2026-07-17T01:06:00.000Z",
          updatedAt: "2026-07-17T01:07:00.000Z",
          notes: [
            {
              id: "metadata-folder-note-station-ledger",
              title: "Station ledger",
              body: "Nested physical folder note.",
              createdAt: "2026-07-17T01:07:00.000Z",
              updatedAt: "2026-07-17T01:07:00.000Z",
              anchor: null,
            },
          ],
          folders: [],
        },
      ],
    },
  ];
  try {
    const saveProjectFileResponse = await createDesktopResponseForRequest({
      method: "POST",
      pathname: "/api/project-file/save",
      body: JSON.stringify({
        filePath: savedProjectPath,
        snapshot: projectLibraryWithMetadataFolder,
      }),
    });
    assert.equal(saveProjectFileResponse.statusCode, 200);
    const savedProjectMeta = JSON.parse(saveProjectFileResponse.body);
    const savedProjectRoot = savedProjectMeta.filePath;
    const savedManifestPath = path.join(savedProjectRoot, "project.json");
    const firstSceneId =
      projectLibrary.projects?.[0]?.projectIndex?.sceneOrder?.[0] ??
      projectLibrary.projects?.[0]?.workspace?.project?.lines?.[0]?.sceneId ??
      "scene-0001";
    const firstScenePath = path.join(
      savedProjectRoot,
      "manuscript",
      "scenes",
      "project-serva-vitae",
      `scene_${firstSceneId}.json`,
    );
    assert.equal(existsSync(savedProjectRoot), true);
    assert.equal(statSync(savedProjectRoot).isDirectory(), true);
    assert.equal(existsSync(savedManifestPath), true);
    assert.equal(existsSync(firstScenePath), true);
    const metadataFolderPath = path.join(
      savedProjectRoot,
      "metadata",
      "project-serva-vitae",
      "research",
      "archive-leads",
    );
    const metadataFolderManifestPath = path.join(metadataFolderPath, "_folder.json");
    const nestedMetadataFolderPath = path.join(metadataFolderPath, "primary-sources");
    const nestedMetadataFolderManifestPath = path.join(nestedMetadataFolderPath, "_folder.json");
    const metadataNoteFileNames = existsSync(metadataFolderPath)
      ? readdirSync(metadataFolderPath).filter((fileName) => fileName.endsWith(".json") && fileName !== "_folder.json")
      : [];
    const nestedMetadataNoteFileNames = existsSync(nestedMetadataFolderPath)
      ? readdirSync(nestedMetadataFolderPath).filter((fileName) => fileName.endsWith(".json") && fileName !== "_folder.json")
      : [];
    assert.equal(existsSync(metadataFolderPath), true);
    assert.equal(existsSync(metadataFolderManifestPath), true);
    assert.equal(metadataNoteFileNames.length, 1);
    assert.equal(existsSync(nestedMetadataFolderPath), true);
    assert.equal(existsSync(nestedMetadataFolderManifestPath), true);
    assert.equal(nestedMetadataNoteFileNames.length, 1);

    const savedProjectFile = JSON.parse(readFileSync(savedManifestPath, "utf8"));
    assert.equal(savedProjectFile.activeProjectId, projectLibrary.activeProjectId);
    assert.equal(savedProjectFile.projects.length, 1);
    assert.equal(savedProjectFile.projects[0].title, "Project Serva Vitae");
    assert.equal(savedProjectFile.projects[0].projectSettings.writingTargetViewMode, "month");
    assert.equal(savedProjectFile.projects[0].projectSettings.consoleDockCollapsed, false);
    assert.equal("userSettingPanelResizerLeftPercent" in savedProjectFile.projects[0].projectSettings, true);
    assert.equal("userSettingPanelResizerRightPercent" in savedProjectFile.projects[0].projectSettings, true);
    assert.equal(typeof savedProjectFile.projects[0].projectSettings.projectSourcePath, "string");
    assert.equal(savedProjectFile.projects[0].passageNotes.length, projectLibrary.projects[0].passageNotes.length);
    assert.equal(savedProjectFile.projects[0].metadataSubgroups.length, 1);
    assert.equal(savedProjectFile.projects[0].projectStorage.metadataFolders.format, "metadata-folder-package-v1");
    assert.equal(Object.keys(savedProjectFile.projects[0].sceneDrafts ?? {}).length, 0);
    assert.equal(savedProjectFile.projects[0].workspace.project.lines.every((line) => line.text === ""), true);
    const savedMetadataFolder = JSON.parse(readFileSync(metadataFolderManifestPath, "utf8"));
    const savedMetadataNote = JSON.parse(readFileSync(path.join(metadataFolderPath, metadataNoteFileNames[0]), "utf8"));
    assert.equal(savedMetadataFolder.title, "Archive Leads");
    assert.deepEqual(savedMetadataFolder.folderOrder, ["metadata-folder-primary-sources"]);
    assert.equal(savedMetadataNote.body, "Ask whether the record names the orbital platform.");
    const savedNestedMetadataNote = JSON.parse(readFileSync(path.join(nestedMetadataFolderPath, nestedMetadataNoteFileNames[0]), "utf8"));
    assert.equal(savedNestedMetadataNote.body, "Nested physical folder note.");

    const loadProjectFileResponse = await createDesktopResponseForRequest({
      method: "POST",
      pathname: "/api/project-file/load",
      body: JSON.stringify({
        filePath: savedProjectRoot,
      }),
    });
    assert.equal(loadProjectFileResponse.statusCode, 200);
    const loadedProjectFile = JSON.parse(loadProjectFileResponse.body);
    assert.equal(loadedProjectFile.activeProjectId, projectLibrary.activeProjectId);
    assert.equal(loadedProjectFile.projects[0].title, "Project Serva Vitae");
    assert.equal(loadedProjectFile.projects[0].projectSettings.writingTargetViewMode, "month");
    assert.equal("userSettingPanelResizerLeftPercent" in loadedProjectFile.projects[0].projectSettings, true);
    assert.equal("userSettingPanelResizerRightPercent" in loadedProjectFile.projects[0].projectSettings, true);
    assert.equal(typeof loadedProjectFile.projects[0].projectSettings.projectSourcePath, "string");
    assert.equal(loadedProjectFile.projects[0].passageNotes.length, projectLibrary.projects[0].passageNotes.length);
    assert.equal(loadedProjectFile.projects[0].metadataSubgroups[0].title, "Archive Leads");
    assert.equal(loadedProjectFile.projects[0].metadataSubgroups[0].notes[0].title, "Library lead");
    assert.equal(loadedProjectFile.projects[0].metadataSubgroups[0].folders[0].title, "Primary Sources");
    assert.equal(loadedProjectFile.projects[0].metadataSubgroups[0].folders[0].notes[0].title, "Station ledger");
    assert.equal(
      loadedProjectFile.projects[0].metadataSubgroups[0].notes[0].body,
      "Ask whether the record names the orbital platform.",
    );
    assert.equal(
      loadedProjectFile.sceneStore?.["project-serva-vitae"]?.[firstSceneId]?.sceneId,
      firstSceneId,
    );
  } finally {
    rmSync(tempProjectDir, { recursive: true, force: true });
  }

  const tempMediaDir = mkdtempSync(path.join(tmpdir(), "abe-project-media-"));
  try {
    const mediaPath = path.join(tempMediaDir, "take.webm");
    const saveMediaResponse = await createDesktopResponseForRequest({
      method: "POST",
      pathname: "/api/project-media/save",
      body: JSON.stringify({
        filePath: mediaPath,
        contentBase64: Buffer.from("audio bytes").toString("base64"),
      }),
    });
    assert.equal(saveMediaResponse.statusCode, 200);
    assert.equal(existsSync(mediaPath), true);

    const loadMediaResponse = await createDesktopResponseForRequest({
      method: "POST",
      pathname: "/api/project-media/load",
      body: JSON.stringify({
        filePath: mediaPath,
      }),
    });
    assert.equal(loadMediaResponse.statusCode, 200);
    assert.equal(JSON.parse(loadMediaResponse.body).contentBase64, Buffer.from("audio bytes").toString("base64"));

    const imagePath = path.join(tempMediaDir, "planet.png");
    const saveImageResponse = await createDesktopResponseForRequest({
      method: "POST",
      pathname: "/api/project-media/save",
      body: JSON.stringify({
        filePath: imagePath,
        contentBase64: Buffer.from("png bytes").toString("base64"),
      }),
    });
    assert.equal(saveImageResponse.statusCode, 200);
    const loadImageUrlResponse = await createDesktopResponseForRequest({
      method: "GET",
      pathname: `/api/project-media/file/${encodeURIComponent(imagePath)}`,
    });
    assert.equal(loadImageUrlResponse.statusCode, 200);
    assert.equal(loadImageUrlResponse.headers["Content-Type"], "image/png");
    assert.equal(Buffer.isBuffer(loadImageUrlResponse.body), true);
    assert.equal(Buffer.from(loadImageUrlResponse.body).toString("utf8"), "png bytes");

    const deleteMediaResponse = await createDesktopResponseForRequest({
      method: "POST",
      pathname: "/api/project-media/delete",
      body: JSON.stringify({
        filePath: mediaPath,
      }),
    });
    assert.equal(deleteMediaResponse.statusCode, 200);
    assert.equal(JSON.parse(deleteMediaResponse.body).removed, true);
    assert.equal(existsSync(mediaPath), false);

    const secondDeleteMediaResponse = await createDesktopResponseForRequest({
      method: "POST",
      pathname: "/api/project-media/delete",
      body: JSON.stringify({
        filePath: mediaPath,
      }),
    });
    assert.equal(secondDeleteMediaResponse.statusCode, 200);
    assert.equal(JSON.parse(secondDeleteMediaResponse.body).removed, false);
  } finally {
    rmSync(tempMediaDir, { recursive: true, force: true });
  }

  const bundledProjectLibrary = createDesktopResponse("/serva-vitae-project-library.js");
  assert.equal(bundledProjectLibrary.statusCode, 200);
  assert.match(bundledProjectLibrary.body, /window\.__ABE_SERVA_VITAE_PROJECT_LIBRARY__/);
  assert.match(bundledProjectLibrary.body, /project-serva-vitae/);

  const shellScript = readFileSync(path.join(repoRoot, "apps/editor/public/shell/editor-chrome.js"), "utf8");
  const sceneEditorModuleScript = readFileSync(
    path.join(repoRoot, "apps/editor/public/features/scene-editor.js"),
    "utf8",
  );
  const writingTargetWindowScript = readFileSync(
    path.join(repoRoot, "apps/editor/public/features/writing-targets/writing-target-window.js"),
    "utf8",
  );
  const revisionWindowScript = readFileSync(
    path.join(repoRoot, "apps/editor/public/features/revisions/revision-window.js"),
    "utf8",
  );
  const writingGoalsServiceScript = readFileSync(
    path.join(repoRoot, "apps/editor/public/features/writing-targets/writing-goals-service.js"),
    "utf8",
  );
  const writingGoalsStateServiceScript = readFileSync(
    path.join(repoRoot, "apps/editor/public/features/writing-targets/writing-goals-state-service.js"),
    "utf8",
  );
  const projectFileAdapterScript = readFileSync(
    path.join(repoRoot, "apps/editor/public/adapters/storage/project-file.js"),
    "utf8",
  );
  const autosaveAdapterScript = readFileSync(
    path.join(repoRoot, "apps/editor/public/adapters/storage/autosave.js"),
    "utf8",
  );
  const projectPersistenceServiceScript = readFileSync(
    path.join(repoRoot, "apps/editor/public/adapters/storage/project-persistence-service.js"),
    "utf8",
  );
  const projectFileDisplayScript = readFileSync(
    path.join(repoRoot, "apps/editor/public/adapters/storage/project-file-display.js"),
    "utf8",
  );
  const appScript = createDesktopResponse("/app.js");
  const browserStorageAdapterScript = createDesktopResponse("/adapters/storage/browser-storage-adapter.js");
  const textareaEditorHostScript = createDesktopResponse("/adapters/editor-host/textarea-editor-host.js");
  const anchoredRecordNavigationControllerScript = createDesktopResponse("/features/manuscript-editor/anchored-record-navigation-controller.js");
  const manuscriptFindControllerScript = createDesktopResponse("/features/manuscript-editor/manuscript-find-controller.js");
  const manuscriptInputControllerScript = createDesktopResponse("/features/manuscript-editor/manuscript-input-controller.js");
  const manuscriptMarkHistoryServiceScript = createDesktopResponse("/features/manuscript-editor/manuscript-mark-history-service.js");
  const manuscriptSelectionControllerScript = createDesktopResponse("/features/manuscript-editor/manuscript-selection-controller.js");
  const taskContextMenuScript = createDesktopResponse("/features/anchored-records/task-context-menu.js");
  const taskPanelScript = createDesktopResponse("/features/anchored-records/task-panel.js");
  const passageNotePanelScript = createDesktopResponse("/features/anchored-records/passage-note-panel.js");
  const sidePanelCustomizationScript = createDesktopResponse("/features/side-panel-customization/side-panel-customization.js");
  const customMetadataPanelScript = createDesktopResponse("/features/metadata-console/custom-metadata-panel.js");
  const metadataSubgroupPanelScript = createDesktopResponse("/features/metadata-console/metadata-subgroup-panel.js");
  const metadataSubgroupServiceScript = createDesktopResponse("/features/metadata-console/metadata-subgroup-service.js");
  const deleteConfirmationDialogScript = createDesktopResponse("/features/anchored-records/delete-confirmation-dialog.js");
  const anchoredRecordControllerScript = createDesktopResponse("/features/anchored-records/anchored-record-controller.js");
  const dictionaryContextControllerScript = createDesktopResponse("/features/dictionary/dictionary-context-controller.js");
  const dictionaryLexiconServiceScript = createDesktopResponse("/features/dictionary/english-definition-lexicon-service.js");
  const dictionaryWindowScript = createDesktopResponse("/features/dictionary/dictionary-window.js");
  const dictionaryManifestData = createDesktopResponse("/features/dictionary/open-english-wordnet-2025/manifest.json");
  const dictionaryWShardData = createDesktopResponse("/features/dictionary/open-english-wordnet-2025/shards/w.json");
  const spellcheckContextControllerScript = createDesktopResponse("/features/spellcheck/spellcheck-context-controller.js");
  const spellcheckContextMenuScript = createDesktopResponse("/features/spellcheck/spellcheck-context-menu.js");
  const localAiTitleServiceScript = createDesktopResponse("/features/local-ai/local-ai-title-service.js");
  const localAiPanelScript = createDesktopResponse("/features/local-ai/local-ai-panel.js");
  const spotifyMusicServiceScript = createDesktopResponse("/features/spotify-music/spotify-music-service.js");
  const draftProofingServiceScript = createDesktopResponse("/features/draft-proofing/draft-proofing-service.js");
  const draftProofingPanelScript = createDesktopResponse("/features/draft-proofing/draft-proofing-panel.js");
  const draftProofingSettingsWindowScript = createDesktopResponse("/features/draft-proofing/draft-proofing-settings-window.js");
  const progressTrackerStripScript = createDesktopResponse("/features/progress-tracker.js");
  const stylesCss = readFileSync(path.join(repoRoot, "apps/editor/public/styles.css"), "utf8");
  assert.equal(appScript.statusCode, 200);
  assert.match(appScript.body, /const DEFAULT_BINDER_PANEL_WIDTH = 520;/);
  assert.match(appScript.body, /const DEFAULT_CONSOLE_PANEL_WIDTH = 520;/);
  assert.match(appScript.body, /const WORKSPACE_GRID_COLUMN_GAP = 12;/);
  assert.match(appScript.body, /function resolveWorkspaceGridAvailableWidth/);
  assert.match(stylesCss, /--binder-width: clamp\(320px, 34vw, 520px\);/);
  assert.match(stylesCss, /--console-dock-width: clamp\(320px, 34vw, 520px\);/);
  assert.match(
    appScript.body,
    /playBlob:\s*\(blob,\s*playbackOptions\)\s*=>\s*voiceRecordingPreviewController\.playBlob\(blob,\s*playbackOptions\)/,
  );
  assert.equal(textareaEditorHostScript.statusCode, 200);
  assert.equal(anchoredRecordNavigationControllerScript.statusCode, 200);
  assert.equal(manuscriptFindControllerScript.statusCode, 200);
  assert.equal(manuscriptInputControllerScript.statusCode, 200);
  assert.equal(manuscriptMarkHistoryServiceScript.statusCode, 200);
  assert.equal(manuscriptSelectionControllerScript.statusCode, 200);
  assert.equal(taskContextMenuScript.statusCode, 200);
  assert.equal(taskPanelScript.statusCode, 200);
  assert.equal(passageNotePanelScript.statusCode, 200);
  assert.equal(sidePanelCustomizationScript.statusCode, 200);
  assert.equal(customMetadataPanelScript.statusCode, 200);
  assert.equal(metadataSubgroupPanelScript.statusCode, 200);
  assert.equal(metadataSubgroupServiceScript.statusCode, 200);
  assert.equal(deleteConfirmationDialogScript.statusCode, 200);
  assert.equal(anchoredRecordControllerScript.statusCode, 200);
  assert.equal(dictionaryContextControllerScript.statusCode, 200);
  assert.equal(dictionaryLexiconServiceScript.statusCode, 200);
  assert.equal(dictionaryWindowScript.statusCode, 200);
  assert.equal(dictionaryManifestData.statusCode, 200);
  assert.equal(dictionaryWShardData.statusCode, 200);
  assert.equal(spellcheckContextControllerScript.statusCode, 200);
  assert.equal(spellcheckContextMenuScript.statusCode, 200);
  assert.equal(localAiTitleServiceScript.statusCode, 200);
  assert.equal(localAiPanelScript.statusCode, 200);
  assert.equal(spotifyMusicServiceScript.statusCode, 200);
  assert.equal(draftProofingServiceScript.statusCode, 200);
  assert.equal(draftProofingPanelScript.statusCode, 200);
  assert.equal(draftProofingSettingsWindowScript.statusCode, 200);
  assert.equal(progressTrackerStripScript.statusCode, 200);
  assert.match(appScript.body, /adapters\/storage\/project-file\.js/);
  assert.match(appScript.body, /adapters\/storage\/project-persistence-service\.js/);
  assert.doesNotMatch(appScript.body, /adapters\/storage\/autosave\.js/);
  assert.doesNotMatch(appScript.body, /adapters\/storage\/project-file-display\.js/);
  assert.doesNotMatch(appScript.body, /Add narration block/);
  assert.doesNotMatch(appScript.body, /Add dialogue block/);
  assert.doesNotMatch(appScript.body, /Scene Synopsis/);
  assert.match(appScript.body, /editor-document-input/);
  assert.match(appScript.body, /contextmenu/);
  assert.match(appScript.body, /setHighlightColorPreference/);
  assert.match(appScript.body, /setHighlightCustomRgbPreference/);
  assert.match(appScript.body, /scheduleHighlightColorPaletteHoverOpen/);
  assert.match(appScript.body, /toggleHighlightColorPalette/);
  assert.match(appScript.body, /beginPendingFormatDragSelection/);
  assert.match(appScript.body, /applyPendingFormatDragSelection/);
  assert.match(appScript.body, /beginDraftProofSelectionGesture/);
  assert.match(appScript.body, /applyDraftProofSelectionGesture/);
  assert.match(appScript.body, /captureDraftProofResumePoint/);
  assert.match(appScript.body, /navigateToDraftProofResumePoint/);
  assert.match(appScript.body, /state\.draftProofMarksVisible = true/);
  const startDraftProofRunBody = appScript.body.slice(
    appScript.body.indexOf("function startDraftProofRun"),
    appScript.body.indexOf("function toggleDraftProofRun"),
  );
  assert.match(startDraftProofRunBody, /result\.changed && result\.reason === "created-run"[\s\S]*state\.draftProofMarksVisible = true/);
  assert.match(appScript.body, /createGroupedManuscriptMarkHistoryFormatId/);
  assert.match(appScript.body, /suppressHistory: shouldGroupDecorationHistory/);
  assert.match(appScript.body, /executeManuscriptInlineFormatCommand\(formatId, \{[\s\S]*?applyOnly: true/);
  assert.match(appScript.body, /toggleAuthorMarkDecoration\(formatId, \{[\s\S]*?applyOnly: true/);
  const authorMarkCommandBody = appScript.body.slice(
    appScript.body.indexOf("function toggleAuthorMarkDecoration"),
    appScript.body.indexOf("function stopPendingUserHighlightDecoration"),
  );
  assert.match(authorMarkCommandBody, /restoreSceneEditorViewportSelection/);
  assert.doesNotMatch(authorMarkCommandBody, /takeToSceneRange/);
  const voiceRecordingOpenBody = appScript.body.slice(
    appScript.body.indexOf("function goToVoiceRecordingVerse"),
    appScript.body.indexOf("function createNarrationTakeSelectionFromRecordingPlan"),
  );
  assert.match(voiceRecordingOpenBody, /createNarrationTakeSelectionFromRecordingPlan\(plan\)/);
  assert.match(voiceRecordingOpenBody, /state\.activePane = "narration"/);
  assert.match(voiceRecordingOpenBody, /takeToSceneRange\(plan\.sceneId, startOffset, endOffset/);
  assert.match(appScript.body, /--editor-highlight-color/);
  assert.match(appScript.body, /function setAppearanceModePreference/);
  assert.match(appScript.body, /document\.documentElement\.dataset\.theme = resolvedTheme/);
  assert.match(appScript.body, /prefers-color-scheme: dark/);
  assert.match(appScript.body, /buildSpellcheckEditorContextMenu/);
  assert.match(spellcheckContextControllerScript.body, /getSpellcheckWordRangeFromLayerPoint\(textarea, event\)/);
  assert.match(textareaEditorHostScript.body, /editor-spellcheck-word is-misspelled/);
  assert.match(textareaEditorHostScript.body, /renderTextareaDiagnosticLayer/);
  assert.match(textareaEditorHostScript.body, /renderTextareaManuScriptInfographicLane/);
  assert.match(textareaEditorHostScript.body, /data-manuscript-infographic-lane-track/);
  assert.match(textareaEditorHostScript.body, /editor-diagnostic-range/);
  assert.match(appScript.body, /toggleManuScriptInfographicLaneVisibility/);
  assert.match(sceneEditorModuleScript, /data-action="toggle-ManuScriptInfographicLane"/);
  assert.match(draftProofingServiceScript.body, /startOrResumeDraftProofRun/);
  assert.match(draftProofingServiceScript.body, /startNewDraftProofRun/);
  assert.match(draftProofingServiceScript.body, /continueDraftProofRun/);
  assert.match(draftProofingServiceScript.body, /removeDraftProofCoverageRange/);
  assert.match(draftProofingServiceScript.body, /updateDraftProofCoverageForTextEdit/);
  assert.match(draftProofingServiceScript.body, /pruneDraftProofCoverageForScenes/);
  assert.match(draftProofingServiceScript.body, /updateDraftProofSettings/);
  assert.match(draftProofingServiceScript.body, /updateDraftProofRunSettings/);
  assert.match(draftProofingServiceScript.body, /resolveDraftProofSettingsRunId/);
  assert.match(draftProofingServiceScript.body, /clearDraftProofRunData/);
  assert.match(draftProofingServiceScript.body, /addRecentDraftProofBackdropColor/);
  assert.match(shellScript, /renderDraftProofPanel/);
  assert.match(shellScript, /renderProjectSettingsMenu/);
  assert.match(shellScript, /data-action="toggle-project-settings-menu"/);
  assert.match(shellScript, /data-action="open-proof-read-settings"/);
  assert.match(shellScript, /data-action="open-local-ai-panel"/);
  assert.match(shellScript, /renderChromeAutosaveIndicator/);
  assert.match(shellScript, /renderLocalAiSetting/);
  assert.match(shellScript, /renderAppearanceModeControl/);
  assert.match(shellScript, /data-action="set-appearance-mode"/);
  assert.match(shellScript, /developer-log-chip/);
  assert.match(progressTrackerStripScript.body, /leadingPanelHTML/);
  assert.doesNotMatch(progressTrackerStripScript.body, /project-autosave-indicator/);
  assert.doesNotMatch(progressTrackerStripScript.body, /open-developer-logs/);
  assert.match(draftProofingPanelScript.body, /draft-proof-panel/);
  assert.match(draftProofingPanelScript.body, /data-action="toggle-draft-proof-run"/);
  assert.match(draftProofingPanelScript.body, /data-action="start-draft-proof-run"/);
  assert.match(draftProofingPanelScript.body, /data-action="toggle-draft-proof-markers"/);
  assert.match(draftProofingPanelScript.body, /data-action="open-proof-read-settings"/);
  assert.match(draftProofingPanelScript.body, /Continue proof read run/);
  assert.match(draftProofingPanelScript.body, /data-action="complete-draft-proof-run"/);
  assert.match(draftProofingSettingsWindowScript.body, /renderDraftProofSettingsWindowHTML/);
  assert.match(draftProofingSettingsWindowScript.body, /data-draft-proof-settings-run/);
  assert.match(draftProofingSettingsWindowScript.body, /data-draft-proof-setting="backdropColor"/);
  assert.match(draftProofingSettingsWindowScript.body, /data-draft-proof-setting="highlightIntensity"/);
  assert.match(draftProofingSettingsWindowScript.body, /data-draft-proof-highlight-theme/);
  assert.match(draftProofingSettingsWindowScript.body, /activeTheme = "light"/);
  assert.match(draftProofingSettingsWindowScript.body, /buildHighlightIntensityControls\(\s*selectedSettings\.highlightIntensityByTheme,\s*resolvedActiveTheme/);
  assert.match(draftProofingSettingsWindowScript.body, /set-draft-proof-backdrop-preset/);
  assert.match(draftProofingSettingsWindowScript.body, /set-draft-proof-backdrop-recent/);
  assert.match(draftProofingSettingsWindowScript.body, /draft-proof-settings-window__recent-group/);
  assert.match(draftProofingSettingsWindowScript.body, /data-draft-proof-delete-run-id/);
  assert.match(draftProofingSettingsWindowScript.body, /delete-selected-draft-proof-runs/);
  assert.match(draftProofingSettingsWindowScript.body, /data-action="clear-draft-proof-data"/);
  assert.match(localAiPanelScript.body, /renderLocalAiPanelHTML/);
  assert.match(localAiPanelScript.body, /api\/local-ai\/models/);
  assert.match(localAiPanelScript.body, /Browse models/);
  assert.doesNotMatch(sceneEditorModuleScript, /data-action="toggle-draft-proof-run"/);
  assert.doesNotMatch(sceneEditorModuleScript, /data-action="complete-draft-proof-run"/);
  assert.match(sceneEditorModuleScript, /const includeDraftProofing = mode === "manuscript" && state\.draftProofMarksVisible === true/);
  assert.match(sceneEditorModuleScript, /const isDraftProofSelectionMode = mode === "manuscript" && hasActiveDraftProofRun\(state\.draftProofing\)/);
  assert.match(sceneEditorModuleScript, /isDraftProofSelectionMode \? "is-draft-proofing" : ""/);
  assert.match(sceneEditorModuleScript, /draftProofBackdropColor: includeDraftProofing \? state\.draftProofing\?\.settings\?\.backdropColor/);
  assert.match(textareaEditorHostScript.body, /data-draft-proof-layer/);
  assert.match(textareaEditorHostScript.body, /editor-draft-proof-range/);
  assert.match(textareaEditorHostScript.body, /draftProofBackdropColor/);
  assert.match(textareaEditorHostScript.body, /--editor-draft-proof-backdrop-color/);
  assert.match(appScript.body, /toggleDraftProofRun/);
  assert.match(appScript.body, /continueDraftProofRun/);
  assert.match(appScript.body, /startDraftProofRun/);
  assert.match(appScript.body, /beginDraftProofSelectionGesture/);
  assert.match(appScript.body, /applyDraftProofSelectionGesture/);
  assert.match(appScript.body, /recordDraftProofCoverageFromTextarea/);
  assert.match(appScript.body, /releaseDraftProofSelectionAfterCoverage/);
  assert.match(appScript.body, /navigateToDraftProofResumePoint/);
  assert.match(appScript.body, /toggleDraftProofMarkerVisibility/);
  assert.match(appScript.body, /toggleProjectSettingsMenu/);
  assert.match(appScript.body, /renderDraftProofSettingsWindow/);
  assert.match(appScript.body, /function showDraftProofMarksForSettingsPreview\(\)/);
  assert.match(appScript.body, /updateDraftProofBackdropColor/);
  assert.match(appScript.body, /updateDraftProofBackdropPreset/);
  assert.match(appScript.body, /setDraftProofRecentBackdropColor/);
  assert.match(
    appScript.body,
    /function updateDraftProofBackdropColor\(value, options = \{\}\) \{[\s\S]*?showDraftProofMarksForSettingsPreview\(\)/,
  );
  assert.match(
    appScript.body,
    /function updateDraftProofBackdropPreset\(index, value, options = \{\}\) \{[\s\S]*?showDraftProofMarksForSettingsPreview\(\)/,
  );
  assert.match(appScript.body, /function updateDraftProofHighlightIntensity\(theme, value\)/);
  assert.match(appScript.body, /draft-proof-highlight-intensity-updated/);
  assert.match(appScript.body, /activeTheme: resolveAppearanceTheme\(state\.editorPrefs\?\.appearanceMode\)/);
  assert.match(appScript.body, /clearAllDraftProofData/);
  assert.match(appScript.body, /deleteSelectedDraftProofRuns/);
  assert.match(appScript.body, /draftProofMarksVisible/);
  assert.match(appScript.body, /removeDraftProofCoverageRange/);
  assert.match(stylesCss, /\.editor-draft-proof-layer/);
  assert.match(stylesCss, /\.editor-draft-proof-range/);
  assert.match(stylesCss, /--editor-draft-proof-backdrop-color/);
  assert.match(stylesCss, /--editor-draft-proof-brightness-lift: 40%/);
  assert.match(stylesCss, /--editor-draft-proof-highlight-color/);
  assert.match(stylesCss, /--editor-draft-proof-fill-strength/);
  assert.match(stylesCss, /:root\[data-theme="light"\] \.editor-draft-proof-range/);
  assert.match(stylesCss, /--editor-draft-proof-light-fill-strength/);
  assert.match(stylesCss, /--editor-draft-proof-light-outline-strength/);
  assert.match(stylesCss, /--editor-draft-proof-light-edge-strength/);
  assert.match(stylesCss, /:root\[data-theme="dark"\] \.editor-draft-proof-range/);
  assert.match(stylesCss, /--editor-draft-proof-dark-fill-strength/);
  assert.match(stylesCss, /--editor-draft-proof-dark-outline-strength/);
  assert.match(stylesCss, /--editor-draft-proof-dark-edge-strength/);
  assert.match(stylesCss, /\.desktop-target-strip__leading/);
  assert.match(stylesCss, /\.draft-proof-panel/);
  assert.match(stylesCss, /\.draft-proof-panel__eye-button/);
  assert.match(stylesCss, /\.draft-proof-panel__pen-icon/);
  assert.match(stylesCss, /\.draft-proof-panel__play-icon/);
  assert.match(stylesCss, /\.draft-proof-panel__pause-icon/);
  assert.match(stylesCss, /\.draft-proof-panel__new-run-icon/);
  assert.match(stylesCss, /\.project-settings-menu/);
  assert.match(stylesCss, /\.draft-proof-settings-window/);
  assert.match(stylesCss, /--draft-proof-settings-brightness-lift: 40%/);
  assert.match(stylesCss, /--draft-proof-settings-visible-swatch/);
  assert.match(stylesCss, /--draft-proof-settings-visible-preset/);
  assert.match(stylesCss, /:root\[data-theme="dark"\] \.draft-proof-settings-window__colour-control span/);
  assert.match(stylesCss, /:root\[data-theme="dark"\] \.draft-proof-settings-window__preset-button span/);
  assert.match(stylesCss, /\.draft-proof-settings-window__iteration-control/);
  assert.match(stylesCss, /\.draft-proof-settings-window__recent-group/);
  assert.match(stylesCss, /\.draft-proof-settings-window__intensity-control/);
  assert.match(stylesCss, /\.draft-proof-settings-window__delete-list/);
  assert.match(stylesCss, /\.developer-log-chip/);
  assert.match(stylesCss, /\.desktop-stat-strip \.project-autosave-indicator/);
  assert.match(stylesCss, /\.desktop-menubar-center \.local-ai-setting/);
  assert.match(appScript.body, /renderSpellcheckContextMenuHTML/);
  assert.match(appScript.body, /renderDictionaryWindowHTML/);
  assert.match(spellcheckContextMenuScript.body, /data-action="apply-spellcheck-suggestion"/);
  assert.match(spellcheckContextMenuScript.body, /data-action="lookup-dictionary-word"/);
  assert.match(dictionaryWindowScript.body, /data-dictionary-window/);
  assert.match(dictionaryManifestData.body, /Open English WordNet 2025/);
  assert.match(dictionaryWShardData.body, /"wrote":\["write"/);
  assert.match(taskContextMenuScript.body, /Add task/);
  assert.match(taskContextMenuScript.body, /data-action="lookup-dictionary-word"/);
  assert.match(taskContextMenuScript.body, /Add inspiration/);
  assert.match(taskContextMenuScript.body, /Add research/);
  assert.match(taskContextMenuScript.body, /Task body/);
  assert.match(taskContextMenuScript.body, /passage-note-body/);
  assert.match(appScript.body, /openPassageNoteComposerFromContextMenu/);
  assert.match(appScript.body, /openPassageNoteEditorFromPanel/);
  assert.match(appScript.body, /inline-passage-note/);
  assert.match(appScript.body, /inline-passage-verse/);
  assert.match(appScript.body, /captureInlinePassageDraftDefaultsForSave/);
  assert.match(appScript.body, /commitInlinePassageNote/);
  assert.match(appScript.body, /edit-passage-note/);
  assert.match(passageNotePanelScript.body, /passage-note-edit-button/);
  assert.match(appScript.body, /editingNoteId/);
  assert.match(appScript.body, /requestDeletePassageNoteFromPanel/);
  assert.match(deleteConfirmationDialogScript.body, /delete-confirmation-modal/);
  assert.match(deleteConfirmationDialogScript.body, /Do not ask me again/);
  assert.match(appScript.body, /confirmDeleteConfirmationDialog/);
  assert.match(appScript.body, /insertInlinePassageVerse/);
  assert.match(anchoredRecordControllerScript.body, /seededSelection/);
  assert.match(anchoredRecordControllerScript.body, /getInlinePassageDraftExistingSelectionRange/);
  assert.match(appScript.body, /trackInlinePassageDraftTyping/);
  assert.match(appScript.body, /syncInlinePassageDraftLayout/);
  assert.match(appScript.body, /renderManuscriptPanelHTML/);
  assert.match(appScript.body, /Save this .* note against the verse typed in the manuscript field below/);
  assert.match(appScript.body, /typedStartOffset/);
  assert.match(appScript.body, /typedText/);
  assert.match(textareaEditorHostScript.body, /has-inspiration-preview/);
  assert.match(textareaEditorHostScript.body, /is-inspiration-previewing/);
  assert.match(textareaEditorHostScript.body, /showTextareaRuntimeSelectionPreview/);
  assert.match(appScript.body, /focusManuscriptFindMatchProjection/);
  assert.match(appScript.body, /createManuscriptFindController/);
  assert.match(appScript.body, /createManuscriptInputController/);
  assert.match(appScript.body, /createManuscriptSelectionController/);
  assert.match(appScript.body, /createAnchoredRecordNavigationController/);
  assert.doesNotMatch(appScript.body, /function getManuscriptFindMatches/);
  assert.match(manuscriptFindControllerScript.body, /buildAllReplacements/);
  assert.match(manuscriptInputControllerScript.body, /handleEditorTextInput/);
  assert.doesNotMatch(appScript.body, /updateInlineFormatRangesForTextEdit/);
  assert.match(manuscriptSelectionControllerScript.body, /resolveSelectionDefaultsForSave/);
  assert.match(anchoredRecordNavigationControllerScript.body, /findRecordAtSelection/);
  assert.match(anchoredRecordNavigationControllerScript.body, /buildPreview/);
  assert.doesNotMatch(appScript.body, /function findPassageNoteAtEditorSelection/);
  assert.doesNotMatch(appScript.body, /function findTaskAtEditorSelection/);
  assert.doesNotMatch(appScript.body, /function trimTextRange/);
  assert.match(appScript.body, /syncNarrationTakeSelectionPreview/);
  assert.match(appScript.body, /selectPassageNoteFromEditorClick/);
  assert.match(appScript.body, /anchoredRecordNavigationController\.findRecordAtSelection/);
  assert.match(appScript.body, /scrollSelectedPassageNoteIntoView/);
  assert.match(appScript.body, /scrollIntoView/);
  assert.match(appScript.body, /select-side-panel/);
  assert.match(taskContextMenuScript.body, /task-description-input/);
  assert.match(taskPanelScript.body, /data-task-preview-id/);
  assert.match(appScript.body, /togglePassageNoteSelection/);
  assert.match(appScript.body, /toggleTaskPreview/);
  assert.match(taskPanelScript.body, /task-chapter-list/);
  assert.match(passageNotePanelScript.body, /console-chapter-list/);
  assert.match(appScript.body, /previewTaskAnchor/);
  assert.match(appScript.body, /navigateTaskAnchor/);
  assert.match(appScript.body, /centerEditorOnCaret/);
  assert.match(appScript.body, /centerEditorOnOffset/);
  assert.match(appScript.body, /focusEditorWhitespace/);
  assert.match(appScript.body, /restoreInlinePassageDraftFromWorkspaceDefaults/);
  assert.doesNotMatch(appScript.body, /clickedBelowText/);
  assert.match(appScript.body, /setSelectionRange/);
  assert.match(appScript.body, /scrollTo/);
  assert.doesNotMatch(appScript.body, /window\.prompt/);
  assert.match(appScript.body, /load-project/);
  assert.match(appScript.body, /save-project/);
  assert.match(appScript.body, /save-project-file-as/);
  assert.match(appScript.body, /load-project-file/);
  assert.match(appScript.body, /create-project/);
  assert.match(appScript.body, /load-project-source/);
  assert.match(appScript.body, /handleGlobalKeyboardShortcut/);
  assert.match(appScript.body, /resolveKeyboardShortcutBehaviorIdForEvent/);
  assert.match(appScript.body, /MANUSCRIPT_INLINE_FORMAT_SHORTCUT_BEHAVIORS/);
  assert.match(appScript.body, /"format\.bold": "bold"/);
  assert.match(appScript.body, /"format\.highlight": "highlight"/);
  assert.match(appScript.body, /"format\.italic": "italic"/);
  assert.match(appScript.body, /handleManuscriptInlineFormatKeyboardShortcut/);
  assert.match(appScript.body, /resolveManuscriptShortcutTextarea/);
  assert.match(appScript.body, /isTextEditingTarget/);
  assert.match(appScript.body, /runNativeTextEditCommand/);
  assert.match(appScript.body, /handleManuscriptMarkHistoryKeyboardShortcut/);
  assert.match(appScript.body, /pushManuscriptMarkHistoryEntry/);
  assert.match(appScript.body, /restoreSelectionFromWorkspaceDefaults/);
  assert.match(appScript.body, /binderSceneMoveHistory/);
  assert.match(appScript.body, /undoBinderSceneMove\(\)/);
  assert.match(appScript.body, /redoBinderSceneMove\(\)/);
  assert.match(appScript.body, /function isMovableScene\(scene\)/);
  assert.match(appScript.body, /const canDragScene = isMovableScene\(scene\);/);
  assert.match(appScript.body, /moveDraftBinderScene\(sceneId, dropTarget, options\)/);
  assert.match(appScript.body, /sceneOrder: movableScenes\.map\(\(scene\) => scene\.sceneId\)/);
  assert.match(appScript.body, /captureSceneSelectionDefaultsForSave/);
  assert.match(appScript.body, /restoreSceneSelectionRange/);
  assert.match(manuscriptSelectionControllerScript.body, /sceneSelectionStart/);
  assert.match(manuscriptSelectionControllerScript.body, /sceneSelectionEnd/);
  assert.match(manuscriptSelectionControllerScript.body, /sceneSelectionScrollTop/);
  assert.match(manuscriptSelectionControllerScript.body, /sceneSelectionScrollLeft/);
  assert.match(manuscriptSelectionControllerScript.body, /sceneSelectionLineNumber/);
  assert.match(appScript.body, /mergedWorkspace\.selectionDefaults/);
  assert.match(appScript.body, /storedWorkspace\.selectionDefaults/);
  assert.match(appScript.body, /captureSceneEditorSelectionSnapshotFromTextarea/);
  assert.match(appScript.body, /updateSceneEditorSelectionSnapshotFromTextarea/);
  assert.match(appScript.body, /behaviorId === "history\.undo"/);
  assert.match(appScript.body, /behaviorId === "history\.redo"/);
  assert.match(appScript.body, /focusProjectFilePathInput/);
  assert.match(projectPersistenceServiceScript, /canUseBrowserSavePicker/);
  assert.match(projectPersistenceServiceScript, /canUseBrowserOpenPicker/);
  assert.match(projectPersistenceServiceScript, /chooseProjectSnapshotFileForLoad/);
  assert.match(projectPersistenceServiceScript, /promptForProjectFileFromInput/);
  assert.match(appScript.body, /downloadProjectLibrarySnapshot/);
  assert.match(appScript.body, /reconnectProjectFileDestinationOnBoot/);
  assert.match(projectPersistenceServiceScript, /buildProjectFilePathFromRoot/);
  assert.match(appScript.body, /getProjectRecordFilePath/);
  assert.match(appScript.body, /const mergedProjectFilePath = storedProjectFilePath \|\| seedProjectFilePath;/);
  assert.match(appScript.body, /shouldPreferBrowserCacheProjectLibraryOnBoot/);
  assert.match(appScript.body, /ignoredDesktopProjectFilePath/);
  assert.match(appScript.body, /projectFilePath: mergedProjectFilePath/);
  assert.match(appScript.body, /toggle-console-collapse/);
  assert.match(appScript.body, /console-dock-toggle/);
  assert.match(appScript.body, /Project sources/);
  assert.match(appScript.body, /Project archive/);
  assert.match(appScript.body, /source-archive/);
  assert.match(taskPanelScript.body, /task-source/);
  assert.match(shellScript, /Version: Test/);
  assert.match(shellScript, /aria-label="Project menu"/);
  assert.match(shellScript, />Autosave</);
  assert.match(shellScript, /Writing to JSON/);
  assert.match(shellScript, /Waiting for path/);
  assert.match(shellScript, /Saves after 5 seconds of idle editing\./);
  assert.match(appScript.body, /const PROJECT_FILE_AUTOSAVE_DELAY_MS = 5000;/);
  assert.match(projectPersistenceServiceScript, /Writing to JSON file:/);
  assert.doesNotMatch(sceneEditorModuleScript, /projectFileDisplay/);
  assert.match(shellScript, /class="file-menu project-file-tooltip/);
  assert.doesNotMatch(shellScript, /project-title-input/);
  assert.doesNotMatch(shellScript, /desktop-project-title-shell/);
  assert.match(shellScript, /data-file-path-tooltip="\$\{escapeHtml\(safeProjectFileDisplay\.tooltip\)\}"/);
  assert.match(shellScript, /project-file-path/);
  assert.match(shellScript, /project-file-status/);
  assert.match(projectFileAdapterScript, /writeProjectLibraryToDesktopPath/);
  assert.match(projectFileAdapterScript, /readProjectLibraryFromBrowserFile/);
  assert.match(projectFileDisplayScript, /resolveProjectFileDisplayState/);
  assert.match(projectFileDisplayScript, /resolveProjectFileDisplayPath/);
  assert.match(autosaveAdapterScript, /createProjectFileAutosaveController/);
  assert.match(shellScript, /data-action="load-project-file"/);
  assert.match(shellScript, /project-recent-menu/);
  assert.match(shellScript, /data-project-id="\$\{escapeHtml\(project\.id\)\}"/);
  assert.match(shellScript, /buildRecentProjectMenuItems/);
  assert.match(shellScript, /data-action="save-project"/);
  assert.match(shellScript, /data-action="create-project"/);
  assert.match(shellScript, /project-file-actions/);
  assert.match(appScript.body, /state\.projectLibrarySelectionId = target\.dataset\.projectId/);
  assert.doesNotMatch(shellScript, /Saved projects/);
  assert.doesNotMatch(shellScript, /Save as file/);
  assert.doesNotMatch(shellScript, /Load file/);
  assert.doesNotMatch(shellScript, /project-library-select/);
  assert.doesNotMatch(shellScript, /project-library-status/);
  assert.doesNotMatch(shellScript, /file-menu-shortcuts/);
  assert.doesNotMatch(shellScript, /Load Project Source/);
  assert.match(appScript.body, /EDITOR_PROJECT_LIBRARY_KEY/);
  assert.match(appScript.body, /EDITOR_ACTIVE_PROJECT_ID_KEY/);
  assert.match(appScript.body, /task-badge/);
  assert.match(appScript.body, /selectedTaskId/);
  assert.match(taskPanelScript.body, /task-body/);
  assert.match(taskPanelScript.body, /task-reference/);
  assert.match(taskPanelScript.body, /task-title-input/);
  assert.match(appScript.body, /function persistManuscriptTasksState\(options = \{\}\)/);
  assert.match(appScript.body, /domain: "manuscript-tasks"/);
  assert.doesNotMatch(appScript.body, /writeStoredJson\(EDITOR_TASKS_KEY/);
  assert.match(passageNotePanelScript.body, /Imported task/);
  assert.match(passageNotePanelScript.body, /Imported note/);
  assert.match(passageNotePanelScript.body, /passage-note-title-input/);
  assert.match(appScript.body, /function persistPassageNotesState\(options = \{\}\)/);
  assert.match(appScript.body, /domain: "passage-notes"/);
  assert.doesNotMatch(appScript.body, /writeStoredJson\(EDITOR_PASSAGE_NOTES_KEY/);
  assert.match(shellScript, /Local AI/);
  assert.match(appScript.body, /suggest-scene-title/);
  assert.match(appScript.body, /createLocalAiTitleService/);
  assert.match(localAiTitleServiceScript.body, /api\/local-ai\/generate-title/);
  assert.doesNotMatch(appScript.body, />Issues<\/h2>/);
  assert.doesNotMatch(appScript.body, /Inspiration Notes<\/h2>/);
  assert.doesNotMatch(appScript.body, /Research Notes<\/h2>/);
  assert.match(appScript.body, /renderSidePanelTabsHTML/);
  assert.match(appScript.body, /shouldOpenSidePanelCustomizationFromContextMenu/);
  assert.match(sidePanelCustomizationScript.body, /SIDE_PANEL_FEATURES/);
  assert.match(sidePanelCustomizationScript.body, /label: "Tasks"/);
  assert.doesNotMatch(sidePanelCustomizationScript.body, /id: "spotify"/);
  assert.doesNotMatch(sidePanelCustomizationScript.body, /label: "Music"/);
  assert.match(sidePanelCustomizationScript.body, /BENCHED: Spotify now lives in the top chrome/);
  assert.match(sidePanelCustomizationScript.body, /open-custom-metadata-form/);
  assert.match(sidePanelCustomizationScript.body, /data-side-panel-feature-toggle/);
  assert.match(spotifyMusicServiceScript.body, /createSpotifyMusicService/);
  assert.match(spotifyMusicServiceScript.body, /renderSpotifyMusicPanelHTML/);
  assert.match(spotifyMusicServiceScript.body, /renderSpotifyMusicChromeHTML/);
  assert.match(spotifyMusicServiceScript.body, /Sign in with Spotify/);
  assert.match(spotifyMusicServiceScript.body, /App setup/);
  assert.match(spotifyMusicServiceScript.body, /toggle-spotify-music-panel/);
  assert.match(spotifyMusicServiceScript.body, /spotify-queue-track/);
  assert.match(spotifyMusicServiceScript.body, /spotify-play-playlist/);
  assert.match(spotifyMusicServiceScript.body, /startPlaylistPlayback/);
  assert.match(shellScript, /renderSpotifyMusicChromeHTML/);
  assert.match(appScript.body, /spotifyMusicPanelOpen/);
  assert.match(appScript.body, /spotifyMusicDesktopClientId/);
  assert.match(appScript.body, /createDurableBrowserTokenStorage/);
  assert.match(appScript.body, /tokenStorage: spotifyMusicTokenStorage/);
  assert.match(browserStorageAdapterScript.body, /createDurableBrowserTokenStorage/);
  assert.match(browserStorageAdapterScript.body, /primaryStorageKeyspace = "localStorage"/);
  assert.match(browserStorageAdapterScript.body, /fallbackStorageKeyspace = "sessionStorage"/);
  assert.match(appScript.body, /toggleSpotifyMusicPanel/);
  assert.match(customMetadataPanelScript.body, /data-custom-metadata-icon/);
  assert.match(appScript.body, /validateCustomMetadataIconFile/);
  assert.doesNotMatch(sidePanelCustomizationScript.body, /side-panel-customize-button/);
  assert.doesNotMatch(sidePanelCustomizationScript.body, /open-side-panel-customization/);
  assert.doesNotMatch(sidePanelCustomizationScript.body, /label: "Issues"/);
  assert.match(appScript.body, /Metadata Console/);
  assert.doesNotMatch(appScript.body, /Task Console/);
  assert.match(appScript.body, /customMetadataDefinitions/);
  assert.match(appScript.body, /metadataSubgroups/);
  assert.match(appScript.body, /metadata-folders/);
  assert.match(metadataSubgroupPanelScript.body, /add-metadata-folder/);
  assert.match(metadataSubgroupPanelScript.body, /add-metadata-child-folder/);
  assert.match(metadataSubgroupPanelScript.body, /data-metadata-folder-drop-target/);
  assert.match(metadataSubgroupPanelScript.body, /New folder/);
  assert.match(metadataSubgroupPanelScript.body, /point-metadata-subgroup-note-to-selection/);
  assert.match(metadataSubgroupServiceScript.body, /normalizeMetadataSubgroups/);
  assert.match(appScript.body, /handleMetadataFolderDrop/);
  assert.doesNotMatch(appScript.body, /Issue Console/);
  assert.match(appScript.body, /project-source-path/);
  assert.match(shellScript, /select-pane/);
  assert.match(appScript.body, /formatChapterDisplayTitle/);
  assert.match(appScript.body, /binder-chapter-order/);
  assert.match(appScript.body, /binder-chapter-title/);
  assert.match(appScript.body, /binder-chapter-title-input/);
  assert.match(appScript.body, /data-chapter-title-id/);
  assert.match(appScript.body, /beginChapterTitleEdit/);
  assert.match(appScript.body, /updateChapterTitle/);
  assert.match(appScript.body, /updateSceneEditorChapterTitle/);
  assert.match(appScript.body, /if \(editField === "chapter-title"\) \{[\s\S]*?updateChapterTitle\(target\.dataset\.chapterId, target\.value\);[\s\S]*?return;/);
  assert.match(appScript.body, /binder-scene-title-input/);
  assert.match(appScript.body, /data-binder-scene-title-id/);
  assert.match(appScript.body, /beginSceneTitleEdit/);
  assert.match(appScript.body, /updateSceneEditorTitle/);
  assert.match(appScript.body, /if \(editField === "scene-title"\) \{[\s\S]*?updateSceneTitleLabel\(sceneId, target\.value\);[\s\S]*?updateSceneEditorTitle\(sceneId, target\.value\);/);
  assert.match(appScript.body, /function deleteSceneFromBinder\(sceneId\) \{[\s\S]*?const scene = getScene\(sceneId\);/);
  assert.match(appScript.body, /function deleteChapterFromBinder\(chapterId\) \{[\s\S]*?const chapterScenes = getScenesForChapter\(chapterId\);/);
  assert.match(appScript.body, /binder-nav-action-short/);
  assert.match(appScript.body, /toggle-writing-target-window/);
  assert.match(appScript.body, /toggle-revision-window/);
  assert.match(appScript.body, /renderRevisionWindow/);
  assert.match(appScript.body, /revision-window-slot/);
  assert.doesNotMatch(appScript.body, /renderSidePanelTab\("revisions"/);
  assert.doesNotMatch(appScript.body, /state\.sidePanelMode === "revisions"/);
  assert.doesNotMatch(appScript.body, /revision-panel-view\.js/);
  assert.match(shellScript, /toggle-revision-window/);
  assert.match(writingTargetWindowScript, /renderWritingTargetWindowHTML/);
  assert.match(writingTargetWindowScript, /writing-target-window/);
  assert.match(writingTargetWindowScript, /data-action="close-writing-target-window"/);
  assert.match(writingTargetWindowScript, /Writing Goals/);
  assert.match(writingTargetWindowScript, /writing-target-window-copy/);
  assert.match(revisionWindowScript, /renderRevisionWindowHTML/);
  assert.match(revisionWindowScript, /revision-window-compare-table/);
  assert.match(revisionWindowScript, /data-action="close-revision-window"/);
  assert.match(revisionWindowScript, /Changed files/);
  assert.match(revisionWindowScript, /Before/);
  assert.match(revisionWindowScript, /After/);
  assert.doesNotMatch(appScript.body, /renderStat\("Words", getCurrentManuscriptWordCount\(\), "words"\)/);
  assert.doesNotMatch(appScript.body, /renderStat\("Issues", workspace\.project\.stats\.issueCount, "issues"\)/);
  assert.doesNotMatch(appScript.body, /renderStat\("Events", workspace\.project\.stats\.eventCount, "events"\)/);
  assert.doesNotMatch(appScript.body, /renderStat\("Chars", workspace\.project\.stats\.characterCount, "chars"\)/);
  assert.match(appScript.body, /writingTargetPointerDownStartedInsideWindow/);
  assert.match(writingGoalsStateServiceScript, /sessionWordsPerHourLabel/);
  assert.match(writingGoalsStateServiceScript, /sessionMilestoneStatusText/);
  assert.match(writingGoalsStateServiceScript, /estimateRecentSessionWordsPerMinute/);
  assert.match(writingGoalsStateServiceScript, /const sessionIsLive = sessionLifecycle\.sessionDisplayActive === true;/);
  assert.match(writingGoalsStateServiceScript, /if \(!record\.sessionIsActive \|\| !lifecycle\.isConcluded\) \{/);
  assert.match(writingGoalsStateServiceScript, /touchWritingTargetSessionActivity/);
  assert.match(appScript.body, /syncHeaderLiveState/);
  assert.match(writingGoalsServiceScript, /if \(options\.immediate\)/);
  assert.match(writingGoalsStateServiceScript, /Idle/);
  assert.match(appScript.body, /WRITING_TARGET_SESSION_SEGMENT_CLOSE_BUFFER_MINUTES/);
  assert.match(appScript.body, /WRITING_TARGET_SESSION_NEW_SESSION_BUFFER_MINUTES/);
  assert.match(writingGoalsStateServiceScript, /buildWritingTargetSessionLifecycleSummaryText/);
  assert.match(writingGoalsStateServiceScript, /sessionLifecycleSummaryText/);
  assert.match(writingGoalsServiceScript, /data-session-tracker-start-time/);
  assert.match(writingGoalsServiceScript, /data-session-tracker-words-written/);
  assert.match(writingGoalsStateServiceScript, /sessionSamples/);
  assert.match(appScript.body, /WRITING_TARGET_SESSION_PACE_STALE_MINUTES/);
  assert.match(writingGoalsStateServiceScript, /sessionPaceActive/);
  assert.match(writingGoalsStateServiceScript, /createPassageExcerpt/);
  assert.match(writingGoalsStateServiceScript, /passageExcerpt/);
  assert.match(writingGoalsStateServiceScript, /getWritingTargetDailyBaselineWordCount/);
  assert.doesNotMatch(writingGoalsStateServiceScript, /todaysEntry/);
  assert.match(writingGoalsStateServiceScript, /filter\(\(entry\) => entry\.date < todayKey\)[\s\S]*?\.at\(-1\)/);
  assert.match(writingGoalsStateServiceScript, /dailyBaselineDateKey/);
  assert.match(writingGoalsStateServiceScript, /dailyBaselineWordCount/);
  assert.match(writingGoalsStateServiceScript, /clampWritingTargetDailyBaselineWordCount/);
  assert.match(writingGoalsStateServiceScript, /resolveWritingTargetDailyBaselineWordCount/);
  assert.match(writingGoalsStateServiceScript, /function getWritingTargetTodayHistoryEntry\(record, now = new Date\(\)\)/);
  assert.match(writingGoalsStateServiceScript, /function getWritingTargetPreviousHistoryEntry\(record, now = new Date\(\)\)/);
  assert.doesNotMatch(appScript.body, /function shouldRebaseWritingTargetDailyBaseline/);
  assert.doesNotMatch(appScript.body, /return Math\.min\(baseline, normalizedCurrentWordCount\);/);
  assert.match(writingGoalsStateServiceScript, /const sessionWordsDelta = currentWordCount - syncedRecord\.sessionBaselineWordCount;/);
  assert.match(writingGoalsStateServiceScript, /const dailyWords = currentWordCount - dailyBaselineWordCount;/);
  assert.match(writingGoalsStateServiceScript, /leftLabel: formatDisplayNumber\(signedSessionWords\),/);
  assert.match(writingGoalsStateServiceScript, /activeProjectRecord\?\.projectIndex\?\.scenes/);
  assert.match(writingGoalsStateServiceScript, /const indexedWordCountValue = Number\(indexedScene\.wordCount\);/);
  assert.match(writingGoalsStateServiceScript, /const shouldTrustDraftWordCount = draftWordCount > 0 \|\| sceneId === state\.selectedSceneId \|\| indexedWordCount <= 0;/);
  assert.match(appScript.body, /persistCurrentProjectRecord\(\{\s*changedSceneIds: \[sceneId\],[\s\S]*?\}\);/);
  assert.match(writingGoalsStateServiceScript, /progress: sessionTargetWords > 0 \? Math\.min\(1, Math\.max\(0, dailyWords\) \/ sessionTargetWords\) : 0,/);
  assert.match(appScript.body, /syncWritingTargetWindowLiveState\(\);[\s\S]*?queueWritingTargetSnapshot\(/);
  assert.match(writingGoalsStateServiceScript, /buildLiveWritingTargetHistoryEntry/);
  assert.match(appScript.body, /recordWritingTargetSnapshot/);
  assert.match(appScript.body, /commitWritingTargetDraft/);
  assert.match(writingGoalsStateServiceScript, /getProjectRecordById\(projectId\)/);
  assert.match(writingGoalsStateServiceScript, /projectRecord\?\.projectSettings\?\.writingTargetState \?\? store\[projectId\]/);
  assert.match(writingGoalsStateServiceScript, /function syncWritingTargetCanonicalState\(record\)/);
  assert.match(appScript.body, /writingTargetDraftBaseline/);
  assert.match(appScript.body, /function getProjectRecordWordCountForSettings\(recordLike\)/);
  assert.match(appScript.body, /projectActivationController\.applyProjectRecord\(record\)/);

  const sceneEditorScript = createDesktopResponse("/features/scene-editor.js");
  const grammarCheckPanelStateScript = createDesktopResponse("/state/grammar-check-panel-state.js");
  assert.equal(sceneEditorScript.statusCode, 200);
  assert.equal(grammarCheckPanelStateScript.statusCode, 200);
  assert.doesNotMatch(sceneEditorScript.body, /Scene Editor/);
  assert.doesNotMatch(sceneEditorScript.body, /Scene Editor Viewport/);
  assert.doesNotMatch(sceneEditorScript.body, /Suggest title/);
  assert.match(sceneEditorScript.body, /Text Width/);
  assert.match(sceneEditorScript.body, /scene-editor-context/);
  assert.match(sceneEditorScript.body, /scene-editor-masthead/);
  assert.match(sceneEditorScript.body, /grammar-check-compact/);
  assert.match(grammarCheckPanelStateScript.body, /normalizeGrammarCheckPanelBounds/);
  assert.match(grammarCheckPanelStateScript.body, /GRAMMAR_CHECK_PANEL_MIN_WIDTH/);
  assert.match(appScript.body, /createGrammarCheckPanelResizeController/);
  assert.match(appScript.body, /persistGrammarCheckPanelBoundsPreference/);
  assert.match(appScript.body, /grammarCheckPanelBounds/);
  assert.match(sceneEditorScript.body, /data-scene-editor-chapter-title/);
  assert.match(sceneEditorScript.body, /data-scene-editor-chapter-word-count/);
  assert.match(sceneEditorScript.body, /data-scene-editor-selection-word-count/);
  assert.match(sceneEditorScript.body, /data-scene-editor-scene-word-count/);
  assert.match(sceneEditorScript.body, /data-action="select-next-scene"/);
  assert.match(sceneEditorScript.body, /data-next-scene-id/);
  assert.match(sceneEditorScript.body, /scene-editor-footer__next-scene-icon/);
  assert.match(appScript.body, /function selectNextSceneFromSceneEditor\(sceneId, hintedNextSceneId = ""\)/);
  assert.match(appScript.body, /selectNextSceneFromSceneEditor\(target\.dataset\.sceneId, target\.dataset\.nextSceneId\);/);
  assert.match(sceneEditorScript.body, /data-scene-title-id/);
  assert.match(sceneEditorScript.body, /data-highlight-color-palette/);
  assert.match(sceneEditorScript.body, /data-action="set-highlight-color"/);
  assert.match(sceneEditorScript.body, /data-highlight-rgb-channel/);
  assert.match(sceneEditorScript.body, /highlight-color-rgb-controls/);
  assert.match(sceneEditorScript.body, /highlight-color-palette__recent/);
  assert.match(sceneEditorScript.body, /data-highlight-custom-rgb-index/);
  assert.match(sceneEditorScript.body, /--highlight-palette-left/);
  assert.match(sceneEditorScript.body, /right-click for colour/);
  const narrationMetadataPanelScript = createDesktopResponse("/features/narration/narration-metadata-panel.js");
  assert.equal(narrationMetadataPanelScript.statusCode, 200);
  assert.match(narrationMetadataPanelScript.body, /renderNarrationMetadataPanelHTML/);
  assert.match(narrationMetadataPanelScript.body, /NARRATION_AUDIO_PANEL_ID/);
  assert.match(narrationMetadataPanelScript.body, /Audio Metadata/);
  assert.match(narrationMetadataPanelScript.body, /toggle-narration-follow-scroll/);
  assert.match(appScript.body, /renderNarrationMetadataSidePanel/);
  assert.match(appScript.body, /NARRATION_AUDIO_PANEL_ID/);
  assert.match(appScript.body, /createBrowserWebSpeechTrackerProvider/);
  assert.match(appScript.body, /createNarrationSpeechRecognitionService/);
  assert.match(appScript.body, /createPrimaryLiveWithCleanupTrackerProvider/);
  assert.match(appScript.body, /primaryProvider: browserWebSpeechTrackerProvider/);
  assert.match(appScript.body, /cleanupProvider: desktopCleanupSpeechTrackerProvider/);
  assert.match(appScript.body, /function setHighlightRecentCustomColorPreference\(index\)/);
  assert.match(appScript.body, /highlightRecentCustomColors/);
  assert.match(sceneEditorScript.body, /Save to typed verse/);
  assert.match(sceneEditorScript.body, /Update .* note/);
  assert.match(appScript.body, /function applySceneTitle\(sceneId, title\) \{[\s\S]*?updateSceneEditorTitle\(sceneId, title\);[\s\S]*?updateFocusedLineCard\(\);/);
  assert.match(appScript.body, /const writingTargetState = state\.writingTargetState/);
  assert.match(
    writingGoalsServiceScript,
    /function saveWritingTargetGoals\(\) \{[\s\S]*?commitWritingTargetDraft\(\);[\s\S]*?if \(hasProjectFileDestination\(\)\) \{[\s\S]*?void saveCurrentProject\(\);/,
  );
  assert.match(
    writingGoalsServiceScript,
    /function closeWritingTargetWindow\(\) \{[\s\S]*?commitWritingTargetDraft\(\);/,
  );
  assert.match(
    appScript.body,
    /async function saveCurrentProject\(\{\s*waitForNarrationRecordingTranscriptAlignment = true,\s*\} = \{\}\) \{[\s\S]*?waitForNarrationRecordingTranscriptAlignmentJobs\(\{[\s\S]*?projectPersistenceService\.saveProjectSnapshot\(\{ reason: "save-project" \}\);/,
  );
  assert.match(
    appScript.body,
    /async function saveCurrentProjectFileAs\(\) \{[\s\S]*?projectPersistenceService\.saveProjectSnapshotAs\(\);/,
  );
  assert.match(appScript.body, /saveWritingTargetState/);
  assert.match(appScript.body, /syncWritingTargetWindowLiveState/);
  assert.match(writingGoalsServiceScript, /data-session-tracker-panel/);
  assert.match(appScript.body, /startWritingTargetWindowRefreshTimer/);
  assert.match(appScript.body, /stopWritingTargetWindowRefreshTimer/);
  assert.doesNotMatch(appScript.body, /Seed 30-day sample/);
  assert.doesNotMatch(appScript.body, /seed-writing-target-data/);
  assert.match(appScript.body, /EDITOR_WRITING_TARGETS_KEY/);
  assert.match(appScript.body, /writingGoalsLogger:\s*writingGoalsServiceLog/);
  assert.doesNotMatch(appScript.body, /toggle-writing-target-debug-terminal/);
  assert.doesNotMatch(appScript.body, /copy-writing-target-debug-log/);
  assert.doesNotMatch(appScript.body, /hydrateWritingTargetDebugEntriesFromDesktop/);
  assert.match(shellScript, /formatConfiguredKeyboardShortcut\(state, "writingTargets\.toggle"\)/);
  assert.match(appScript.body, /void saveCurrentProject\(\)/);
  assert.match(appScript.body, /void loadProjectLibraryFromFile\(\)/);
  assert.match(
    appScript.body,
    /async function loadProjectLibraryFromFile\(\) \{[\s\S]*?projectPersistenceService\.chooseProjectSnapshotFileForLoad\(\);/,
  );
  assert.match(appScript.body, /focusProjectFilePathInput/);
  assert.match(writingTargetWindowScript, /Words/);
  assert.match(writingTargetWindowScript, /Days to release/);
  assert.match(appScript.body, /const DEFAULT_SESSION_TIMEOUT_MINUTES = 20;/);
  assert.match(writingTargetWindowScript, /writing-target-dashboard-stats/);
  assert.match(writingTargetWindowScript, /writing-target-dashboard-body/);
  assert.match(writingTargetWindowScript, /writing-target-dashboard-settings/);
  assert.match(writingTargetWindowScript, /writing-target-dashboard-calendar/);
  assert.match(writingTargetWindowScript, /writing-target-dashboard-detail/);
  assert.match(writingTargetWindowScript, /writing-target-window-copy/);
  assert.match(writingTargetWindowScript, /writing-target-view-toggle/);
  assert.match(writingTargetWindowScript, /writing-target-calendar-grid/);
  assert.match(writingTargetWindowScript, /writing-target-calendar-day-progress/);
  assert.match(writingTargetWindowScript, /writing-target-calendar-day-indicators/);
  assert.match(writingTargetWindowScript, /writing-target-calendar-day-indicator-icon/);
  assert.match(writingTargetWindowScript, /writing-target-calendar-day-indicator-count/);
  assert.match(writingTargetWindowScript, /writing-target-week-grid/);
  assert.match(writingTargetWindowScript, /writing-target-day-overview/);
  assert.match(writingTargetWindowScript, /writing-target-day-points/);
  assert.match(writingTargetWindowScript, /writing-target-day-session-summary/);
  assert.match(writingTargetWindowScript, /writing-target-day-hero/);
  assert.match(writingTargetWindowScript, /writing-target-note-field/);
  assert.match(writingTargetWindowScript, /writing-target-footer-actions/);
  assert.match(writingTargetWindowScript, /writing-target-help-card/);
  assert.match(writingTargetWindowScript, /Goal settings/);
  assert.match(writingTargetWindowScript, /Calendar view/);
  assert.match(writingTargetWindowScript, /Selected day/);
  assert.match(writingTargetWindowScript, /Save goals/);
  assert.match(writingTargetWindowScript, /Cancel/);
  assert.match(writingTargetWindowScript, /Reset to defaults/);
  assert.match(writingTargetWindowScript, /Month/);
  assert.match(writingTargetWindowScript, /Week/);
  assert.match(writingTargetWindowScript, /List/);
  assert.match(writingTargetWindowScript, /writing-target-archive/);
  assert.match(writingTargetWindowScript, /YYYY-MM-DD or DD\/MM\/YYYY/);
  assert.match(writingTargetWindowScript, /targetCadence/);
  assert.match(writingTargetWindowScript, /writing-target-range/);
  assert.match(writingTargetWindowScript, /Daily target/);
  assert.match(writingTargetWindowScript, /data-metric-key="sessionTracker"/);
  assert.match(writingGoalsStateServiceScript, /goalSyncSource/);
  assert.match(writingGoalsStateServiceScript, /goalSyncHint/);
  assert.match(writingGoalsStateServiceScript, /syncWritingTargetGoalFields/);
  assert.match(writingTargetWindowScript, /sessionsPerDay/);
  assert.match(writingTargetWindowScript, /sessionTimeoutMinutes/);
  assert.match(writingTargetWindowScript, /Session time/);
  assert.match(appScript.body, /DEFAULT_SESSION_TARGETS_PER_DAY = 5/);
  assert.match(taskPanelScript.body, /toggle-console-chapter-collapse/);
  assert.match(appScript.body, /collapsedConsoleChapterIds/);
  assert.match(passageNotePanelScript.body, /console-chapter-group/);
  assert.match(passageNotePanelScript.body, /console-chapter-heading/);
  assert.match(taskPanelScript.body, /issueTasks/);
  assert.match(writingGoalsStateServiceScript, /On track/);
  assert.match(writingGoalsStateServiceScript, /Off track/);
  assert.match(appScript.body, /data-resize-handle="binder"/);
  assert.match(appScript.body, /data-resize-handle="console"/);
  assert.match(appScript.body, /syncLayoutWidths/);
  assert.match(appScript.body, /userSettingPanelResizerLeftPercent/);
  assert.match(appScript.body, /userSettingPanelResizerRightPercent/);
  assert.match(appScript.body, /panelResizerLayoutProfiles/);
  assert.match(appScript.body, /worldSpinePanelLayoutProfiles/);
  assert.match(appScript.body, /data-world-spine-resize-handle/);
  assert.match(appScript.body, /syncWorldSpinePanelLayout/);
  assert.match(appScript.body, /ensurePanelResizerFallbackProfile/);
  assert.match(appScript.body, /isPanelResizerLayoutProfileLikelyClamped/);
  assert.match(appScript.body, /resolvePanelResizerLayoutProfileKey/);
  assert.match(appScript.body, /persistPanelResizerUserSettings/);
  assert.match(appScript.body, /LayoutState/);
  assert.match(appScript.body, /persistProfileApplied: persistProfile/);
  assert.doesNotMatch(appScript.body, /syncLayoutWidths\(true\)/);
  assert.match(
    appScript.body,
    /function toggleChapterCollapse\(chapterId\) \{[\s\S]*?persistCollapsedChapterState\(state\.activeProjectId, state\.collapsedChapterIds\);[\s\S]*?persistCurrentProjectRecord\(\);[\s\S]*?renderBinderPanel\(\);[\s\S]*?\}/,
  );
  assert.match(appScript.body, />Manuscript<\/p>/);
  assert.doesNotMatch(appScript.body, />Binder<\/p>/);
  assert.doesNotMatch(appScript.body, /select-project/);
  assert.doesNotMatch(appScript.body, /Anchored Diagnostics/);
  assert.doesNotMatch(appScript.body, /Focused Passage/);
  assert.doesNotMatch(appScript.body, /Project Spine/);
  assert.match(appScript.body, /New chapter/);
  assert.match(appScript.body, /New scene/);
  assert.match(appScript.body, /\+C/);
  assert.match(appScript.body, /\+S/);
  assert.match(appScript.body, /world-spine-open-passage/);
  assert.match(appScript.body, /world-spine-edit-scene-metadata/);
  assert.doesNotMatch(appScript.body, /New template/);
  assert.match(appScript.body, /Dream Scaping/);
  assert.match(appScript.body, /scene line/);
  assert.match(appScript.body, /syncSceneDocumentLayout/);

  const sessionTrackerIcons = createDesktopResponse("/session-tracker-icons.js");
  assert.equal(sessionTrackerIcons.statusCode, 200);
  assert.match(sessionTrackerIcons.body, /renderSessionTrackerPenSvg/);
  assert.match(sessionTrackerIcons.body, /SESSION_TRACKER_FLAMING_PEN_SVG/);
  assert.match(sessionTrackerIcons.body, /--session-tracker-pen-body/);

  const progressTrackerModule = createDesktopResponse("/features/progress-tracker.js");
  assert.equal(progressTrackerModule.statusCode, 200);
  assert.match(progressTrackerModule.body, /renderWritingTargetStrip/);
  assert.match(progressTrackerModule.body, /buildSessionTrackerMetric/);
  assert.match(progressTrackerModule.body, /getSessionTrackerVisualState/);
  assert.match(progressTrackerModule.body, /renderSessionTrackerPaceRing/);
  assert.match(progressTrackerModule.body, /renderSessionTrackerPanel/);
  assert.match(progressTrackerModule.body, /renderSessionTrackerClockIcon/);
  assert.match(progressTrackerModule.body, /desktop-target-strip/);
  assert.match(progressTrackerModule.body, /session-tracker-panel/);
  assert.match(progressTrackerModule.body, /writing-target-card/);
  assert.match(progressTrackerModule.body, /writing-target-card-icon/);
  assert.match(progressTrackerModule.body, /Session tracker/);
  assert.match(progressTrackerModule.body, /session-tracker-panel__bar-meta/);
  assert.match(shellScript, /developer-log-chip/);
  assert.match(shellScript, /open-developer-logs/);

  const sharedUiUtilsModule = createDesktopResponse("/shared/ui-utils.js");
  assert.equal(sharedUiUtilsModule.statusCode, 200);
  assert.match(sharedUiUtilsModule.body, /function escapeHtml/);
  assert.match(sharedUiUtilsModule.body, /function formatDisplayNumber/);

  const developerLogsPage = createDesktopResponse("/developer-logs.html");
  assert.equal(developerLogsPage.statusCode, 200);
  assert.match(developerLogsPage.body, /Developer Logs/);
  assert.match(developerLogsPage.body, /source-filter/);
  assert.match(developerLogsPage.body, /category-filter/);
  assert.match(developerLogsPage.body, /Pause live/);

  const developerLogsScript = createDesktopResponse("/developer-logs.js");
  assert.equal(developerLogsScript.statusCode, 200);
  assert.match(developerLogsScript.body, /createDeveloperLogClient/);
  assert.match(developerLogsScript.body, /createBrowserStorageAdapter/);

  const developerLoggerModule = createDesktopResponse("/shared/developer-logger.js");
  assert.equal(developerLoggerModule.statusCode, 200);
  assert.match(developerLoggerModule.body, /createDeveloperLogger/);
  assert.match(developerLoggerModule.body, /createSource/);
  assert.match(developerLoggerModule.body, /callsite/);

  const editorModel = createDesktopResponse("/editor-model.js");
  assert.equal(editorModel.statusCode, 200);
  assert.match(editorModel.body, /buildSceneRecords/);
  assert.match(editorModel.body, /buildSceneLineMetrics/);
  assert.match(editorModel.body, /estimateWrappedLineCount/);
  assert.match(editorModel.body, /createPassageNote/);
  assert.match(editorModel.body, /normalizePassageNotes/);
  assert.match(editorModel.body, /createPassageNoteTitle/);
  assert.match(editorModel.body, /abe-project-library-v1/);
  assert.match(editorModel.body, /abe-active-project-id-v1/);
  assert.match(editorModel.body, /abe-project-source-path-v1/);

  const styles = createDesktopResponse("/styles.css");
  assert.equal(styles.statusCode, 200);
  assert.match(styles.body, /\.editor-document-gutter/);
  assert.match(styles.body, /\.editor-ManuScriptInfographicLane/);
  assert.match(styles.body, /\.editor-ManuScriptInfographicLane-toggle/);
  assert.match(styles.body, /\.editor-ManuScriptInfographicLane__track/);
  assert.match(styles.body, /\.editor-ManuScriptInfographicLane-marker--task/);
  assert.match(styles.body, /\.editor-ManuScriptInfographicLane-marker--research/);
  assert.match(styles.body, /\.file-menu-shortcuts/);
  assert.match(styles.body, /\.dream-suggestion/);
  assert.match(styles.body, /\.dream-panel-heading/);
  assert.match(styles.body, /\.dream-worldbuilding-lane/);
  assert.match(styles.body, /\.worldbuilding-entry-popover/);
  assert.match(styles.body, /\.worldbuilding-catalogue-popover/);
  assert.match(styles.body, /--worldbuilding-catalogue-max-height/);
  assert.match(styles.body, /\.worldbuilding-catalogue-list\s*{[\s\S]*?overflow-y: auto/);
  assert.match(styles.body, /\.worldbuilding-catalogue-detail/);
  assert.match(styles.body, /\.worldbuilding-catalogue-detail\s*{[\s\S]*?gap: 14px/);
  assert.match(styles.body, /\.worldbuilding-catalogue-detail__section dl > div\s*{[\s\S]*?padding-bottom: 8px/);
  assert.match(styles.body, /\.worldbuilding-catalogue-heading\s*{[\s\S]*?cursor: move/);
  assert.match(styles.body, /\.worldbuilding-catalogue-popover\.is-resizing/);
  assert.match(styles.body, /\.worldbuilding-catalogue-resize-handle/);
  assert.match(styles.body, /\.worldbuilding-catalogue-popover\s*{[\s\S]*?background: #fffcf7/);
  assert.match(styles.body, /\.worldbuilding-catalogue-add/);
  assert.match(styles.body, /\.worldbuilding-entry-popover\s*{[\s\S]*?position: fixed/);
  assert.match(styles.body, /\.worldbuilding-entry-popover\s*{[\s\S]*?left: var\(--worldbuilding-entry-center-x, 50vw\)/);
  assert.match(styles.body, /\.worldbuilding-entry-popover\s*{[\s\S]*?top: var\(--worldbuilding-entry-center-y, 50vh\)/);
  assert.match(styles.body, /\.worldbuilding-entry-popover\s*{[\s\S]*?transform: translate\(-50%, -50%\)/);
  assert.match(appScript.body, /function syncWorldbuildingEntryPopoverPosition\(\)/);
  assert.match(appScript.body, /function syncWorldbuildingEntryPopoverPortal\(\)/);
  assert.match(appScript.body, /function openWorldbuildingCatalogue\(/);
  assert.match(appScript.body, /function selectWorldbuildingCatalogueItem\(/);
  assert.match(appScript.body, /function beginWorldbuildingCatalogueDrag\(/);
  assert.match(appScript.body, /function beginWorldbuildingCatalogueResize\(/);
  assert.match(appScript.body, /function persistWorldbuildingCatalogueBoundsPreference\(/);
  assert.match(appScript.body, /function syncWorldbuildingCataloguePositionToViewport\(/);
  assert.match(appScript.body, /function resolveWorldbuildingCataloguePositionBounds\(/);
  assert.match(appScript.body, /function resolveWorldbuildingCatalogueToolbarBoundary\(/);
  assert.match(appScript.body, /worldbuildingCatalogueBounds/);
  assert.match(appScript.body, /worldbuildingCatalogueResizeState/);
  assert.match(appScript.body, /data-worldbuilding-catalogue-drag-handle/);
  assert.match(appScript.body, /data-worldbuilding-catalogue-resize-handle/);
  assert.match(appScript.body, /add-worldbuilding-catalogue-item/);
  assert.match(appScript.body, /if \(action === "add-worldbuilding-catalogue-item"\) \{\s*selectWorldbuildingStudioCategory/);
  assert.match(appScript.body, /select-worldbuilding-catalogue-item/);
  assert.match(appScript.body, /if \(action === "open-worldbuilding-catalogue"\) \{\s*openWorldbuildingCatalogue\(/);
  assert.match(appScript.body, /const worldbuildingCategoryContext = getWorldbuildingCategoryContextFromTarget\(clickTarget\);[\s\S]*?selectWorldbuildingStudioCategory\(worldbuildingCategoryContext\.categoryId\);/);
  assert.match(appScript.body, /getWorldbuildingCategoryContextFromTarget/);
  assert.match(appScript.body, /data-worldbuilding-catalogue-portal/);
  assert.match(appScript.body, /data-worldbuilding-entry-popover-portal/);
  assert.match(appScript.body, /portal\.replaceChildren\(sourcePopover\)/);
  assert.match(appScript.body, /document\.body\.appendChild\(portal\)/);
  assert.match(appScript.body, /document\.querySelector\("#app"\)/);
  assert.match(appScript.body, /getBoundingClientRect\(\)/);
  assert.match(styles.body, /\.task-context-menu/);
  assert.match(styles.body, /\.dictionary-lookup-window/);
  assert.match(styles.body, /\.task-composer/);
  assert.match(styles.body, /\.form-dismiss-button/);
  assert.match(styles.body, /\.side-panel-tabs/);
  assert.match(styles.body, /position: sticky/);
  assert.match(styles.body, /data-scroll-hint/);
  assert.match(styles.body, /\.custom-metadata-form/);
  assert.match(styles.body, /\.metadata-image-icon/);
  assert.match(styles.body, /\.metadata-subgroup-panel/);
  assert.match(styles.body, /\.metadata-subgroup-note/);
  assert.match(styles.body, /\.spotify-music-chrome/);
  assert.match(styles.body, /\.spotify-music-popover/);
  assert.match(styles.body, /\.spotify-music-panel/);
  assert.match(styles.body, /\.spotify-track-card/);
  assert.match(styles.body, /data-theme="dark"] \.spotify-music-chrome/);
  assert.match(styles.body, /data-theme="dark"] \.spotify-music-panel__section/);
  assert.match(styles.body, /\.editor-document-input\.has-metadata-preview::selection/);
  const editorDocumentInputRule = styles.body.match(/\.editor-document-input\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  assert.match(editorDocumentInputRule, /box-sizing: border-box/);
  assert.match(editorDocumentInputRule, /width: 100%/);
  assert.match(editorDocumentInputRule, /padding: 0 max\(0px, calc\(\(100% - var\(--editor-content-width\)\) \/ 2\)\)/);
  assert.match(styles.body, /\.passage-note-item/);
  assert.match(styles.body, /\.passage-note-title-input/);
  assert.match(styles.body, /\.passage-note-body/);
  assert.match(styles.body, /\.console-chapter-list/);
  assert.match(styles.body, /\.console-chapter-group/);
  assert.match(styles.body, /\.console-chapter-heading/);
  assert.match(styles.body, /\.console-chapter-disclosure/);
  assert.match(styles.body, /overflow-x: hidden/);
  assert.match(styles.body, /text-overflow: ellipsis/);
  assert.match(styles.body, /\.inline-passage-bubble/);
  assert.match(styles.body, /\.inline-passage-verse-field/);
  assert.match(styles.body, /rgba\(216, 244, 253, 0\.62\)/);
  assert.match(styles.body, /border: 3px solid rgba\(20, 22, 28, 0\.92\)/);
  assert.match(styles.body, /box-sizing: border-box/);
  assert.match(styles.body, /overflow-wrap: anywhere/);
  assert.match(styles.body, /white-space: pre-wrap/);
  assert.doesNotMatch(styles.body, /\.passage-note-editor/);
  assert.match(styles.body, /\.editor-document-input\.has-task-preview::selection/);
  assert.match(styles.body, /\.editor-document-input\.has-inspiration-preview::selection/);
  assert.match(styles.body, /\.editor-document-input\.has-search-preview::selection/);
  assert.match(styles.body, /\.editor-document-input\.has-narration-preview::selection/);
  assert.match(styles.body, /\.editor-document-input\.is-draft-proofing::selection/);
  assert.match(styles.body, /\.editor-document-input\.has-inline-format-projection\.is-draft-proofing::selection/);
  assert.match(styles.body, /\.editor-diagnostic-layer/);
  assert.match(styles.body, /\.editor-diagnostic-error/);
  const inlineDraftProofSelectionRule = styles.body.match(/\.editor-document-input\.has-inline-format-projection\.is-draft-proofing::selection\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  const darkInlineDraftProofSelectionRule = styles.body.match(/:root\[data-theme="dark"\] \.editor-document-input\.has-inline-format-projection\.is-draft-proofing::selection\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  const projectionLayerPaddingRule = styles.body.match(/\.editor-draft-proof-layer,\s*\.editor-narration-recording-layer,\s*(?:\.editor-narration-follow-layer,\s*)?\.editor-spellcheck-layer,\s*\.editor-diagnostic-layer\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  const inlineFormatLayerRule = styles.body.match(/\.editor-inline-format-layer\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  const inlineFormatContentRules = [...styles.body.matchAll(/\.editor-inline-format-layer__content\s*{(?<body>[\s\S]*?)}/g)]
    .map((match) => match.groups?.body ?? "");
  const inlineFormatContentRule = inlineFormatContentRules[inlineFormatContentRules.length - 1] ?? "";
  const boldInlineFormatRule = styles.body.match(/\.editor-inline-format-bold\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  const darkDraftProofRangeRule = styles.body.match(/:root\[data-theme="dark"\] \.editor-draft-proof-range\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  const darkInlineFormatContentRule = styles.body.match(/:root\[data-theme="dark"\] \.editor-inline-format-layer__content\.has-inline-format-projection\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  const darkBoldInlineFormatRule = styles.body.match(/:root\[data-theme="dark"\] \.editor-inline-format-bold\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  const italicInlineFormatRule = styles.body.match(/\.editor-inline-format-italic\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  const italicTokenRule = styles.body.match(/\.editor-inline-format-italic-token\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  const italicTokenPaintRule = styles.body.match(/\.editor-inline-format-italic-token::after\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  assert.match(inlineDraftProofSelectionRule, /color: transparent/);
  assert.match(inlineDraftProofSelectionRule, /text-shadow: none/);
  assert.match(darkInlineDraftProofSelectionRule, /color: transparent/);
  assert.match(darkInlineDraftProofSelectionRule, /text-shadow: none/);
  assert.match(projectionLayerPaddingRule, /box-sizing: border-box/);
  assert.match(projectionLayerPaddingRule, /padding: inherit/);
  assert.match(darkDraftProofRangeRule, /--editor-draft-proof-fill-strength: var\(--editor-draft-proof-dark-fill-strength, 100%\)/);
  assert.match(darkDraftProofRangeRule, /--editor-draft-proof-outline-strength: var\(--editor-draft-proof-dark-outline-strength, 100%\)/);
  assert.match(darkDraftProofRangeRule, /--editor-draft-proof-dark-edge-strength/);
  assert.match(darkDraftProofRangeRule, /var\(--editor-draft-proof-highlight-color\)/);
  assert.match(darkDraftProofRangeRule, /inset 0 -2px 0/);
  assert.doesNotMatch(darkDraftProofRangeRule, /#11100e/);
  assert.match(inlineFormatLayerRule, /display: flex/);
  assert.match(inlineFormatLayerRule, /padding: inherit/);
  assert.match(inlineFormatLayerRule, /z-index: 3/);
  assert.doesNotMatch(inlineFormatLayerRule, /display: none/);
  assert.match(inlineFormatContentRule, /color: transparent/);
  assert.match(styles.body, /\.editor-inline-format-layer__content\.has-inline-format-projection\s*{[\s\S]*?color: var\(--ink\)/);
  assert.match(styles.body, /\.editor-document-input\.has-inline-format-projection\s*{[\s\S]*?color: transparent/);
  assert.match(styles.body, /\.editor-document-input\.has-inline-format-projection::selection\s*{[\s\S]*?color: transparent/);
  assert.match(styles.body, /\.editor-document-input\.has-inline-format-projection::selection\s*{[\s\S]*?text-shadow: none/);
  assert.match(boldInlineFormatRule, /color: var\(--ink\)/);
  assert.match(boldInlineFormatRule, /font-weight: inherit/);
  assert.match(boldInlineFormatRule, /text-shadow:/);
  assert.doesNotMatch(boldInlineFormatRule, /font-weight: 700/);
  assert.match(darkInlineFormatContentRule, /color: rgba\(243, 234, 220, 0\.88\)/);
  assert.match(darkBoldInlineFormatRule, /color: var\(--ink-deep\)/);
  assert.match(darkBoldInlineFormatRule, /0\.035em/);
  assert.match(darkBoldInlineFormatRule, /text-shadow:/);
  assert.doesNotMatch(darkBoldInlineFormatRule, /font-weight: 700/);
  assert.match(italicInlineFormatRule, /font-style: normal/);
  assert.match(italicTokenRule, /position: relative/);
  assert.match(italicTokenRule, /color: transparent/);
  assert.match(italicTokenPaintRule, /content: attr\(data-italic-text\)/);
  assert.match(italicTokenPaintRule, /font-style: italic/);
  assert.doesNotMatch(italicTokenRule, /transform: skewX/);
  assert.doesNotMatch(italicInlineFormatRule, /--editor-inline-format-mask/);
  assert.match(styles.body, /\.highlight-color-palette\s*{/);
  assert.match(styles.body, /position: absolute/);
  assert.match(styles.body, /\.highlight-color-palette__swatches\s*{/);
  assert.match(styles.body, /\.highlight-color-palette__recent\s*{/);
  assert.match(styles.body, /\.highlight-color-rgb-row\s*{/);
  assert.match(styles.body, /\.inline-format-highlight-swatch\s*{/);
  assert.match(styles.body, /\.editor-inline-format-highlight\s*{[\s\S]*?background: var\(--editor-mark-highlight-color/);
  assert.match(styles.body, /\.editor-inline-format-highlight\s*{[\s\S]*?box-shadow: 0 0 0 2px var\(--editor-mark-highlight-outline/);
  assert.match(styles.body, /\.editor-inline-format-strikethrough\s*{[\s\S]*?text-decoration-line: line-through/);
  assert.match(styles.body, /rgba\(216, 244, 253, 0\.82\)/);
  assert.match(styles.body, /\.scene-editor-codeframe\.is-task-previewing/);
  assert.match(styles.body, /\.scene-editor-codeframe\.is-inspiration-previewing/);
  assert.match(styles.body, /\.scene-editor-codeframe\.is-search-previewing/);
  assert.match(styles.body, /\.scene-editor-codeframe\.is-narration-previewing/);
  assert.match(styles.body, /\.task-item:hover \.task-copy \.task-body/);
  assert.match(styles.body, /\.task-item:hover \.task-copy \.task-reference/);
  assert.match(styles.body, /\.passage-note-item\.is-previewing \.passage-note-body/);
  assert.match(styles.body, /#app\.is-binder-panel-compact/);
  assert.match(styles.body, /overscroll-behavior: contain/);
  assert.match(styles.body, /height: clamp\(440px, 68vh, 760px\)/);
  assert.match(styles.body, /cursor: text/);
  assert.match(styles.body, /--editor-font-stack/);
  assert.match(styles.body, /\.task-badge/);
  assert.match(styles.body, /\.task-copy \.task-body/);
  assert.match(styles.body, /\.task-copy \.task-reference/);
  assert.match(styles.body, /\.task-copy \.task-source/);
  assert.match(styles.body, /\.desktop-chrome/);
  assert.match(styles.body, /\.desktop-menubar/);
  assert.match(styles.body, /\.desktop-title-tools/);
  assert.match(styles.body, /\.desktop-title-tools \.appearance-mode-control/);
  assert.match(styles.body, /\.desktop-title-tools \.side-panels-focus-toggle/);
  assert.match(styles.body, /\.desktop-environment-badge/);
  assert.match(styles.body, /:root\[data-theme="dark"\]/);
  assert.match(styles.body, /--theme-page-bg/);
  assert.match(styles.body, /\.appearance-mode-control/);
  assert.match(styles.body, /\.appearance-mode-icon--dark/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.scene-editor-codeframe/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.editor-document-input\.has-inline-format-projection/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.editor-title-input,\s*:root\[data-theme="dark"\] \.scene-editor-title-input,\s*:root\[data-theme="dark"\] \.inline-title-input,\s*:root\[data-theme="dark"\] \.binder-chapter-title-input,\s*:root\[data-theme="dark"\] \.binder-scene-title-input,\s*:root\[data-theme="dark"\] \.editor-document-input\s*{[\s\S]*?background: transparent/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.editor-title-input:focus,\s*:root\[data-theme="dark"\] \.scene-editor-title-input:focus,\s*:root\[data-theme="dark"\] \.inline-title-input:focus,\s*:root\[data-theme="dark"\] \.binder-chapter-title-input:focus,\s*:root\[data-theme="dark"\] \.binder-scene-title-input:focus,\s*:root\[data-theme="dark"\] \.editor-document-input:focus\s*{[\s\S]*?background: transparent/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.editor-document-input\s*{[\s\S]*?background: transparent/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.narration-metadata-panel__title h2\s*{[\s\S]*?background: transparent/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.panel-heading\.manuscript-nav-heading/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.project-autosave-indicator/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.task-panel/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.task-item/);
  assert.match(styles.body, /#grammar-check-slot\.is-sized/);
  assert.match(styles.body, /\.manuscript-grammar-panel__resize-handle/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.manuscript-grammar-panel/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.manuscript-grammar-panel__resize-handle::before/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.grammar-check-item__suggestion-primary/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.grammar-check-item__dictionary-button:disabled/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.narration-recording-value/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.narration-tracker-monitor/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.narration-saved-takes\.is-empty/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.world-spine-workspace/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.world-spine-canvas/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.world-spine-event-list__item/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.world-spine-manuscript-scene h4/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.dream-suggestion/);
  const projectFileTooltipRule = styles.body.match(/\.project-file-tooltip::after\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  const fileButtonTooltipRule = styles.body.match(/\.file-menu\.project-file-tooltip::after\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  assert.match(projectFileTooltipRule, /background: rgba\(255, 250, 243, 0\.98\)/);
  assert.match(projectFileTooltipRule, /white-space: nowrap/);
  assert.match(projectFileTooltipRule, /text-overflow: ellipsis/);
  assert.doesNotMatch(projectFileTooltipRule, /background: rgba\(31, 36, 48/);
  assert.match(fileButtonTooltipRule, /left: 0/);
  assert.match(fileButtonTooltipRule, /top: calc\(100% \+ 8px\)/);
  const recentProjectPathRules = [...styles.body.matchAll(/\.project-recent-menu__item small\s*{(?<body>[\s\S]*?)}/g)]
    .map((match) => match.groups?.body ?? "");
  const recentProjectPathRule = recentProjectPathRules.find((rule) => /overflow-wrap: anywhere/.test(rule)) ?? "";
  const projectFileStatusRule = styles.body.match(/\.file-menu \.project-file-status\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  assert.match(recentProjectPathRule, /overflow-wrap: anywhere/);
  assert.match(recentProjectPathRule, /white-space: normal/);
  assert.match(projectFileStatusRule, /overflow-wrap: anywhere/);
  assert.match(styles.body, /\.workspace-tabs/);
  assert.match(styles.body, /\.workspace-tab/);
  assert.match(styles.body, /\.file-menu-panel/);
  assert.match(styles.body, /\.desktop-target-strip/);
  assert.match(styles.body, /\.writing-target-card/);
  assert.match(styles.body, /\.session-tracker-panel/);
  assert.match(styles.body, /\.session-tracker-panel__gauge/);
  assert.match(styles.body, /--session-tracker-gauge-backdrop/);
  assert.match(styles.body, /:root\[data-theme="dark"\] \.session-tracker-panel/);
  assert.match(styles.body, /--session-tracker-pen-body: #f8fbff/);
  assert.match(styles.body, /\.session-tracker-panel__footer/);
  assert.match(styles.body, /\.writing-target-window/);
  assert.match(styles.body, /\.writing-target-archive/);
  assert.match(styles.body, /\.writing-target-range/);
  assert.match(styles.body, /\.writing-target-hint/);
  assert.match(styles.body, /\.writing-target-help-card/);
  assert.match(styles.body, /\.writing-target-archive-excerpt/);
  assert.match(styles.body, /\.writing-target-dashboard-stats/);
  assert.match(styles.body, /\.writing-target-dashboard-body/);
  assert.match(styles.body, /\.writing-target-dashboard-settings/);
  assert.match(styles.body, /\.writing-target-dashboard-calendar/);
  assert.match(styles.body, /\.writing-target-dashboard-detail/);
  assert.match(styles.body, /\.writing-target-view-toggle/);
  assert.match(styles.body, /\.writing-target-calendar-grid/);
  assert.match(styles.body, /\.writing-target-week-grid/);
  assert.match(styles.body, /\.writing-target-day-overview/);
  assert.match(styles.body, /\.writing-target-day-points/);
  assert.match(styles.body, /\.writing-target-day-session-summary/);
  assert.match(styles.body, /\.writing-target-note-field/);
  assert.match(styles.body, /\.writing-target-footer-actions/);
  assert.match(styles.body, /\.binder-nav-action-short/);
  assert.match(styles.body, /\.chrome-target-toggle/);
  assert.match(styles.body, /\.panel-resizer/);
  assert.match(styles.body, /\.world-spine-panel-resizer/);
  assert.match(styles.body, /\.project-file-shell/);
  assert.match(styles.body, /\.project-menu-button/);
  const projectLoadMenuRule = styles.body.match(/\.project-load-menu\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  const projectRecentMenuRule = styles.body.match(/\.project-recent-menu\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  assert.match(projectLoadMenuRule, /justify-self: start/);
  assert.match(projectLoadMenuRule, /width: min\(220px, 100%\)/);
  assert.match(projectRecentMenuRule, /display: none/);
  assert.match(projectRecentMenuRule, /width: 100%/);
  assert.doesNotMatch(projectRecentMenuRule, /position:\s*absolute/);
  assert.doesNotMatch(projectRecentMenuRule, /top:/);
  assert.doesNotMatch(projectRecentMenuRule, /left:/);
  assert.match(styles.body, /\.project-load-menu:hover \.project-recent-menu/);
  assert.match(styles.body, /\.project-load-menu:focus-within \.project-recent-menu/);
  assert.match(styles.body, /\.project-recent-menu__item/);
  const loadSelectedProjectBody = appScript.body.slice(
    appScript.body.indexOf("function loadSelectedProject"),
    appScript.body.indexOf("// Intent: expose project-file labels"),
  );
  assert.match(loadSelectedProjectBody, /function loadSelectedProject\(requestedProjectId = null\)/);
  assert.ok(
    loadSelectedProjectBody.indexOf("const selectedProjectId") < loadSelectedProjectBody.indexOf("persistCurrentProjectRecord"),
  );
  assert.match(loadSelectedProjectBody, /state\.projectLibrarySelectionId = selectedProjectId/);
  assert.match(styles.body, /--dark-selected-inner-bg: var\(--theme-control\)/);
  assert.match(styles.body, /--dark-selected-edge-shadow:/);
  assert.match(
    styles.body,
    /:root\[data-theme="dark"\] \.file-menu\.is-open \.menu-button,[\s\S]*?:root\[data-theme="dark"\] \.project-recent-menu__item\.is-active,[\s\S]*?background: var\(--dark-selected-inner-bg\)/,
  );
  assert.match(
    styles.body,
    /:root\[data-theme="dark"\] \.line-card\.is-active,[\s\S]*?background: var\(--dark-selected-inner-bg\)/,
  );
  assert.match(
    styles.body,
    /:root\[data-theme="dark"\] \.worldbuilding-catalogue-item\.is-selected \.worldbuilding-catalogue-item__button\s*{[\s\S]*?background: var\(--dark-selected-inner-bg\)/,
  );
  assert.match(styles.body, /\.project-file-autosave-setting/);
  assert.doesNotMatch(styles.body, /\.project-library-select-shell/);
  assert.doesNotMatch(styles.body, /\.project-source-shell/);
  assert.match(styles.body, /\.console-dock/);
  assert.match(styles.body, /\.console-dock-toggle/);
  assert.match(styles.body, /cursor: col-resize/);
  assert.match(styles.body, /\.source-archive/);
  assert.match(styles.body, /\.source-archive-item/);
  assert.doesNotMatch(styles.body, /\.project-title-input/);
  assert.match(styles.body, /\.local-ai-setting/);
  assert.match(styles.body, /\.ai-title-button/);
  assert.match(styles.body, /\.inline-title-input/);
  assert.match(styles.body, /\.binder-chapter-title-input/);
  assert.match(styles.body, /\.binder-scene-title-input/);
  assert.match(styles.body, /\.binder-chapter-title-input\s*{[\s\S]*?background: transparent/);
  assert.match(styles.body, /\.binder-scene-title-input\s*{[\s\S]*?background: transparent/);
  assert.match(styles.body, /\.pane-section\[hidden\]/);
  assert.match(styles.body, /\.task-chapter-list/);
  assert.doesNotMatch(styles.body, /\.runtime-strip/);
  assert.match(styles.body, /\.task-copy/);
  assert.match(styles.body, /\.editor-document-input/);
  assert.match(styles.body, /\.editor-gutter-line/);
  assert.match(styles.body, /\.scene-editor-context/);
  assert.match(styles.body, /\.scene-editor-context__meta/);
  assert.match(styles.body, /\.scene-editor-context__meta--right/);
  assert.match(styles.body, /\.scene-editor-masthead/);
  assert.match(styles.body, /\.grammar-check-compact/);
  assert.match(styles.body, /\.scene-editor-context__count/);
  assert.match(styles.body, /\.scene-editor-footer/);
  assert.match(styles.body, /\.scene-editor-footer__scene/);
  assert.match(styles.body, /\.scene-editor-footer__next-scene/);
  assert.match(styles.body, /content: attr\(data-tooltip\);/);
  assert.match(styles.body, /\.scene-editor-footer__next-scene-icon/);
  assert.match(styles.body, /\.narration-metadata-panel/);
  assert.match(styles.body, /\.narration-metadata-panel__controls/);
  assert.match(styles.body, /\.narration-follow-toggle/);
  assert.match(styles.body, /\.narration-saved-takes\.is-empty/);
  assert.match(styles.body, /\.editor-narration-follow-layer/);
  // Intent: keep the read-ahead narration target visible without restoring the old yellow manuscript highlight.
  const liveFollowCurrentRule = styles.body.match(/\.editor-narration-follow-current-range\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  const darkLiveFollowCurrentRule = styles.body.match(/:root\[data-theme="dark"\] \.editor-narration-follow-current-range\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  assert.match(liveFollowCurrentRule, /background:\s*rgba\(92,\s*186,\s*218,\s*0\.32\)/);
  assert.match(liveFollowCurrentRule, /inset 0 -3px 0 rgba\(31,\s*110,\s*120,\s*0\.86\)/);
  assert.doesNotMatch(liveFollowCurrentRule, /yellow|255,\s*222,\s*99/i);
  assert.match(darkLiveFollowCurrentRule, /background:\s*rgba\(125,\s*213,\s*248,\s*0\.34\)/);
  assert.match(darkLiveFollowCurrentRule, /inset 0 -3px 0 rgba\(137,\s*225,\s*255,\s*0\.95\)/);
  assert.doesNotMatch(darkLiveFollowCurrentRule, /yellow|255,\s*222,\s*99/i);

  const goalsStyles = createDesktopResponse("/writing-goals-dashboard.css");
  assert.equal(goalsStyles.statusCode, 200);
  assert.match(goalsStyles.body, /\.writing-target-dashboard-stats/);
  assert.match(goalsStyles.body, /\.writing-target-calendar-day-progress/);
  assert.match(goalsStyles.body, /\.writing-target-calendar-day-indicators/);
  assert.match(goalsStyles.body, /\.writing-target-calendar-day-indicator-icon/);
  assert.match(goalsStyles.body, /\.writing-target-calendar-day-indicator-count/);
  assert.match(goalsStyles.body, /\.writing-target-card-icon/);
  assert.match(goalsStyles.body, /\.writing-target-day-hero/);
  assert.match(goalsStyles.body, /\.writing-target-day-status\.is-on-target/);
  assert.match(goalsStyles.body, /:root\[data-theme="dark"\] \.writing-target-window/);
  assert.match(goalsStyles.body, /:root\[data-theme="dark"\] \.writing-target-presets/);
  assert.match(goalsStyles.body, /:root\[data-theme="dark"\] \.writing-target-day-overview > div/);
  assert.match(goalsStyles.body, /:root\[data-theme="dark"\] \.writing-target-day-session-summary > div/);
  assert.match(goalsStyles.body, /:root\[data-theme="dark"\] \.writing-target-calendar-day-indicators span/);
  assert.match(goalsStyles.body, /:root\[data-theme="dark"\] \.writing-target-calendar-day\.no-writing/);
  assert.match(goalsStyles.body, /:root\[data-theme="dark"\] \.writing-target-range::-webkit-slider-runnable-track/);
  assert.match(goalsStyles.body, /:root\[data-theme="dark"\] \.writing-target-note-field textarea::placeholder/);
  assert.match(goalsStyles.body, /:root\[data-theme="dark"\] \.writing-target-archive-meta span/);
  assert.match(goalsStyles.body, /:root\[data-theme="dark"\] \.writing-target-window \.panel-action-button/);
  const darkWritingTargetSelectionRule = goalsStyles.body.match(/:root\[data-theme="dark"\] \.writing-target-view-toggle-button\.is-active,[\s\S]*?:root\[data-theme="dark"\] \.writing-target-list-item\.is-selected\s*{(?<body>[\s\S]*?)}/)?.groups?.body ?? "";
  assert.match(darkWritingTargetSelectionRule, /background: var\(--dark-selected-inner-bg/);
  assert.match(darkWritingTargetSelectionRule, /box-shadow: var\(/);
  assert.doesNotMatch(darkWritingTargetSelectionRule, /theme-control-hover/);

  const sessionTrackerSleepingPen = createDesktopResponse("/assets/icons/session-tracker-sleeping-pen.svg");
  assert.equal(sessionTrackerSleepingPen.statusCode, 200);
  assert.match(sessionTrackerSleepingPen.body, /<svg/);
  assert.match(sessionTrackerSleepingPen.body, /--session-tracker-pen-body/);

  const sessionTrackerWorkingPen = createDesktopResponse("/assets/icons/session-tracker-working-pen.svg");
  assert.equal(sessionTrackerWorkingPen.statusCode, 200);
  assert.match(sessionTrackerWorkingPen.body, /<svg/);
  assert.match(sessionTrackerWorkingPen.body, /--session-tracker-pen-body/);

  const sessionTrackerFlamingPen = createDesktopResponse("/assets/icons/session-tracker-flaming-pen.svg");
  assert.equal(sessionTrackerFlamingPen.statusCode, 200);
  assert.match(sessionTrackerFlamingPen.body, /<svg/);
  assert.match(sessionTrackerFlamingPen.body, /--session-tracker-pen-body/);

  const settings = createDesktopResponse("/api/settings");
  assert.equal(settings.statusCode, 200);
  assert.match(settings.body, /local-only/);

  const localAiStatus = await createDesktopResponseForRequest({
    method: "GET",
    pathname: "/api/local-ai/status",
  });
  assert.equal(localAiStatus.statusCode, 200);
  const localAiStatusBody = JSON.parse(localAiStatus.body);
  assert.equal(localAiStatusBody.providerName, "llama.cpp");
  assert.equal(localAiStatusBody.baseUrl, "http://127.0.0.1:8080");
  assert.deepEqual(localAiStatusBody.configuredTiers, ["tiny"]);
  assert.equal(typeof localAiStatusBody.available, "boolean");

  const localAiModels = await createDesktopResponseForRequest({
    method: "GET",
    pathname: "/api/local-ai/models",
  });
  assert.equal(localAiModels.statusCode, 200);
  const localAiModelsBody = JSON.parse(localAiModels.body);
  assert.equal(localAiModelsBody.ok, true);
  assert.equal(Array.isArray(localAiModelsBody.folders), true);
  assert.equal(Array.isArray(localAiModelsBody.models), true);
  assert.equal(localAiModelsBody.browseLinks.some((link) => /huggingface\.co\/models/.test(link.url)), true);

  const localAiGenerate = await createDesktopResponseForRequest({
    method: "POST",
    pathname: "/api/local-ai/generate-tags",
    body: JSON.stringify({
      userInput: "storm docking scene",
    }),
  });
  assert.equal(localAiGenerate.statusCode, 200);
  const localAiGenerateBody = JSON.parse(localAiGenerate.body);
  assert.equal(typeof localAiGenerateBody.ok, "boolean");

  const projectIntegrator = await createDesktopResponseForRequest({
    method: "POST",
    pathname: "/api/project-source",
    body: JSON.stringify({
      projectPath: path.join(
        repoRoot,
        "SaveTestFile",
        "project-serva-vitae.abe-project.json",
      ),
    }),
  });
  assert.equal(projectIntegrator.statusCode, 200);
  const importedProjectLibrary = JSON.parse(projectIntegrator.body);
  // Intent: project library order can contain older saved-project records, so validate the active source project.
  const importedProject =
    importedProjectLibrary.projects.find((entry) => entry.id === importedProjectLibrary.activeProjectId)
    ?? importedProjectLibrary.projects[0];
  assert.equal(importedProjectLibrary.projects.length >= 1, true);
  assert.equal(importedProject.source, "project-file");
  assert.equal(importedProject.workspace.project.stats.chapterCount, 5);
  assert.equal(importedProject.workspace.project.stats.sceneCount, 30);
  assert.equal(importedProject.workspace.world.templates.length, 7);

  const projectLibraryCors = await createDesktopResponseForRequest({
    method: "OPTIONS",
    pathname: "/api/project-library",
  });
  assert.equal(projectLibraryCors.statusCode, 204);
  assert.equal(projectLibraryCors.headers["Access-Control-Allow-Origin"], "*");

  const browserLog = await createDesktopResponseForRequest({
    method: "POST",
    pathname: "/api/log",
    body: JSON.stringify({
      level: "warn",
      scope: "tests",
      message: "desktop test log entry",
    }),
  });
  assert.equal(browserLog.statusCode, 204);

  const runtimeLogSession = await createDesktopResponseForRequest({
    method: "POST",
    pathname: "/api/log/session",
    body: JSON.stringify({}),
  });
  assert.equal(runtimeLogSession.statusCode, 200);
  const runtimeLogSessionBody = JSON.parse(runtimeLogSession.body);
  assert.equal(runtimeLogSessionBody.ok, true);
  assert.equal(typeof runtimeLogSessionBody.filePath, "string");
  assert.equal(runtimeLogSessionBody.filePath.startsWith(runtimeLogDirectory), true);
  assert.match(runtimeLogSessionBody.fileName, /^developer-runtime-session-\d{4}-.+\.txt$/);
  assert.equal(typeof runtimeLogSessionBody.sessionNumber, "number");
  assert.equal(runtimeLogSessionBody.keepLatestSessions, 20);

  const runtimeLogPruneSettings = await createDesktopResponseForRequest({
    method: "POST",
    pathname: "/api/log/prune-settings",
    body: JSON.stringify({
      enabled: true,
      keepLatestSessions: 20,
    }),
  });
  assert.equal(runtimeLogPruneSettings.statusCode, 200);
  const runtimeLogPruneSettingsBody = JSON.parse(runtimeLogPruneSettings.body);
  assert.equal(runtimeLogPruneSettingsBody.ok, true);
  assert.equal(runtimeLogPruneSettingsBody.autoPruneEnabled, true);
  assert.equal(runtimeLogPruneSettingsBody.keepLatestSessions, 20);

  const runtimeLogPruneNow = await createDesktopResponseForRequest({
    method: "POST",
    pathname: "/api/log/prune",
    body: JSON.stringify({
      keepLatestSessions: 20,
    }),
  });
  assert.equal(runtimeLogPruneNow.statusCode, 200);
  const runtimeLogPruneNowBody = JSON.parse(runtimeLogPruneNow.body);
  assert.equal(runtimeLogPruneNowBody.ok, true);
  assert.equal(runtimeLogPruneNowBody.keepLatestSessions, 20);

  const browserLogTail = await createDesktopResponseForRequest({
    method: "POST",
    pathname: "/api/log/read",
    body: JSON.stringify({
      limit: 20,
    }),
  });
  assert.equal(browserLogTail.statusCode, 200);
  const browserLogTailBody = JSON.parse(browserLogTail.body);
  assert.equal(browserLogTailBody.ok, true);
  assert.equal(typeof browserLogTailBody.filePath, "string");
  assert.equal(typeof browserLogTailBody.text, "string");

  const browserLogClear = await createDesktopResponseForRequest({
    method: "POST",
    pathname: "/api/log/clear",
    body: JSON.stringify({}),
  });
  assert.equal(browserLogClear.statusCode, 200);
  const browserLogClearBody = JSON.parse(browserLogClear.body);
  assert.equal(browserLogClearBody.ok, true);

  const writingTargetDebugGet = createDesktopResponse("/api/writing-target-log");
  assert.equal(writingTargetDebugGet.statusCode, 404);

  const settingsUpdate = await createDesktopResponseForRequest({
    method: "POST",
    pathname: "/api/settings",
    body: JSON.stringify({
      lastProjectFilePath: desktopSettings.lastProjectFilePath,
    }),
  });
  assert.equal(settingsUpdate.statusCode, 200);

  const missing = createDesktopResponse("/missing");
  assert.equal(missing.statusCode, 404);
  } finally {
    if (previousRuntimeLogDirectory === undefined) {
      delete process.env.ABE_DEVELOPER_RUNTIME_LOG_DIR;
    } else {
      process.env.ABE_DEVELOPER_RUNTIME_LOG_DIR = previousRuntimeLogDirectory;
    }
    if (previousDesktopLogPath === undefined) {
      delete process.env.ABE_LOG_PATH;
    } else {
      process.env.ABE_LOG_PATH = previousDesktopLogPath;
    }
    rmSync(runtimeLogDirectory, { recursive: true, force: true });
  }
}
