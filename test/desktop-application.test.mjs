// Intent: smoke test the desktop host, project-file routes, editor modules, and bundled workspace assets.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDesktopResponse,
  createDesktopResponseForRequest,
} from "../apps/desktop/src/http-app.ts";
import { createDesktopWorkspaceSnapshot } from "../apps/desktop/src/workspace.ts";
import { resolveLoadedProjectFilePath } from "../apps/editor/public/shared/project-file-path.js";

export async function runDesktopApplicationTest() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const workspace = createDesktopWorkspaceSnapshot();

  assert.equal(workspace.workspaceTitle, "ABetterNovelAuthoringEnvironment");
  assert.equal(workspace.settings.executionMode, "local-only");
  assert.equal(workspace.project.lines.length, 7);
  assert.equal(workspace.project.lines[0].sceneLineNumber, 1);
  assert.equal(workspace.project.issues.length, 3);
  assert.equal(workspace.project.issues[0].sceneLineNumber, 2);
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
  assert.equal(typeof desktopSettings.lastProjectFilePath, "string");
  assert.equal(typeof desktopSettings.lastProjectFilePathExplicit, "boolean");
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
  try {
    const saveProjectFileResponse = await createDesktopResponseForRequest({
      method: "POST",
      pathname: "/api/project-file/save",
      body: JSON.stringify({
        filePath: savedProjectPath,
        snapshot: projectLibrary,
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
    assert.equal(Object.keys(savedProjectFile.projects[0].sceneDrafts ?? {}).length, 0);
    assert.equal(savedProjectFile.projects[0].workspace.project.lines.every((line) => line.text === ""), true);

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
    assert.equal(
      loadedProjectFile.sceneStore?.["project-serva-vitae"]?.[firstSceneId]?.sceneId,
      firstSceneId,
    );
  } finally {
    rmSync(tempProjectDir, { recursive: true, force: true });
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
  assert.equal(appScript.statusCode, 200);
  assert.match(appScript.body, /adapters\/storage\/project-file\.js/);
  assert.match(appScript.body, /adapters\/storage\/project-persistence-service\.js/);
  assert.doesNotMatch(appScript.body, /adapters\/storage\/autosave\.js/);
  assert.doesNotMatch(appScript.body, /adapters\/storage\/project-file-display\.js/);
  assert.doesNotMatch(appScript.body, /Add narration block/);
  assert.doesNotMatch(appScript.body, /Add dialogue block/);
  assert.doesNotMatch(appScript.body, /Scene Synopsis/);
  assert.match(appScript.body, /editor-document-input/);
  assert.match(appScript.body, /contextmenu/);
  assert.match(appScript.body, /getSpellcheckWordRangeFromLayerPoint\(textarea, event\)/);
  assert.match(appScript.body, /\.editor-spellcheck-word\.is-misspelled/);
  assert.match(appScript.body, /data-action="apply-spellcheck-suggestion"/);
  assert.match(appScript.body, /Add task/);
  assert.match(appScript.body, /Inspiration/);
  assert.match(appScript.body, /Research/);
  assert.match(appScript.body, /Task body/);
  assert.match(appScript.body, /passage-note-body/);
  assert.match(appScript.body, /openPassageNoteComposerFromContextMenu/);
  assert.match(appScript.body, /openPassageNoteEditorFromPanel/);
  assert.match(appScript.body, /inline-passage-note/);
  assert.match(appScript.body, /inline-passage-verse/);
  assert.match(appScript.body, /captureInlinePassageDraftDefaultsForSave/);
  assert.match(appScript.body, /commitInlinePassageNote/);
  assert.match(appScript.body, /edit-passage-note/);
  assert.match(appScript.body, /passage-note-edit-button/);
  assert.match(appScript.body, /editingNoteId/);
  assert.match(appScript.body, /requestDeletePassageNoteFromPanel/);
  assert.match(appScript.body, /delete-confirmation-modal/);
  assert.match(appScript.body, /Do not ask me again/);
  assert.match(appScript.body, /confirmDeleteConfirmationDialog/);
  assert.match(appScript.body, /insertInlinePassageVerse/);
  assert.match(appScript.body, /seededSelection/);
  assert.match(appScript.body, /getInlinePassageDraftExistingSelectionRange/);
  assert.match(appScript.body, /trackInlinePassageDraftTyping/);
  assert.match(appScript.body, /syncInlinePassageDraftLayout/);
  assert.match(appScript.body, /renderManuscriptPanelHTML/);
  assert.match(appScript.body, /Save this .* note against the verse typed in the manuscript field below/);
  assert.match(appScript.body, /typedStartOffset/);
  assert.match(appScript.body, /typedText/);
  assert.match(appScript.body, /has-inspiration-preview/);
  assert.match(appScript.body, /is-inspiration-previewing/);
  assert.match(appScript.body, /selectPassageNoteFromEditorClick/);
  assert.match(appScript.body, /findPassageNoteAtEditorSelection/);
  assert.match(appScript.body, /scrollSelectedPassageNoteIntoView/);
  assert.match(appScript.body, /scrollIntoView/);
  assert.match(appScript.body, /select-side-panel/);
  assert.match(appScript.body, /task-description-input/);
  assert.match(appScript.body, /data-task-preview-id/);
  assert.match(appScript.body, /togglePassageNoteSelection/);
  assert.match(appScript.body, /toggleTaskPreview/);
  assert.match(appScript.body, /task-chapter-list/);
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
  assert.match(appScript.body, /isTextEditingTarget/);
  assert.match(appScript.body, /runNativeTextEditCommand/);
  assert.match(appScript.body, /restoreSelectionFromWorkspaceDefaults/);
  assert.match(appScript.body, /binderSceneMoveHistory/);
  assert.match(appScript.body, /undoBinderSceneMove\(\)/);
  assert.match(appScript.body, /redoBinderSceneMove\(\)/);
  assert.match(appScript.body, /function isMovableScene\(scene\)/);
  assert.match(appScript.body, /const canDragScene = isMovableScene\(scene\);/);
  assert.match(appScript.body, /moveDraftBinderScene\(sceneId, dropTarget\)/);
  assert.match(appScript.body, /sceneOrder: movableScenes\.map\(\(scene\) => scene\.sceneId\)/);
  assert.match(appScript.body, /captureSceneSelectionDefaultsForSave/);
  assert.match(appScript.body, /restoreSceneSelectionRange/);
  assert.match(appScript.body, /sceneSelectionStart/);
  assert.match(appScript.body, /sceneSelectionEnd/);
  assert.match(appScript.body, /sceneSelectionScrollTop/);
  assert.match(appScript.body, /sceneSelectionScrollLeft/);
  assert.match(appScript.body, /sceneSelectionLineNumber/);
  assert.match(appScript.body, /mergedWorkspace\.selectionDefaults/);
  assert.match(appScript.body, /storedWorkspace\.selectionDefaults/);
  assert.match(appScript.body, /captureSceneEditorSelectionSnapshotFromTextarea/);
  assert.match(appScript.body, /updateSceneEditorSelectionSnapshotFromTextarea/);
  assert.match(appScript.body, /event\.shiftKey \? "redo" : "undo"/);
  assert.match(appScript.body, /focusProjectLibrarySelect/);
  assert.match(projectPersistenceServiceScript, /canUseBrowserSavePicker/);
  assert.match(projectPersistenceServiceScript, /canUseBrowserOpenPicker/);
  assert.match(projectPersistenceServiceScript, /promptForProjectFileFromInput/);
  assert.match(appScript.body, /downloadProjectLibrarySnapshot/);
  assert.match(appScript.body, /reconnectProjectFileDestinationOnBoot/);
  assert.match(projectPersistenceServiceScript, /buildProjectFilePathFromRoot/);
  assert.match(appScript.body, /getProjectRecordFilePath/);
  assert.match(appScript.body, /toggle-console-collapse/);
  assert.match(appScript.body, /console-dock-toggle/);
  assert.match(appScript.body, /Project sources/);
  assert.match(appScript.body, /Project archive/);
  assert.match(appScript.body, /source-archive/);
  assert.match(appScript.body, /task-source/);
  assert.match(shellScript, /Saved projects/);
  assert.match(shellScript, /Version: Test/);
  assert.match(shellScript, /Project file/);
  assert.match(shellScript, /Autosave project file/);
  assert.match(shellScript, /Writing to JSON file/);
  assert.match(shellScript, /Waiting for file/);
  assert.match(shellScript, /Saves after 5 seconds of idle editing\./);
  assert.match(appScript.body, /const PROJECT_FILE_AUTOSAVE_DELAY_MS = 5000;/);
  assert.match(projectPersistenceServiceScript, /Writing to JSON file:/);
  assert.match(sceneEditorModuleScript, /projectFileDisplay/);
  assert.match(sceneEditorModuleScript, /data-file-path-tooltip="\$\{escapeHtml\(safeProjectFileDisplay\.tooltip\)\}"/);
  assert.match(shellScript, /project-title-input/);
  assert.match(shellScript, /data-file-path-tooltip="\$\{escapeHtml\(safeProjectFileDisplay\.tooltip\)\}"/);
  assert.match(shellScript, /project-file-path/);
  assert.match(shellScript, /project-file-status/);
  assert.match(projectFileAdapterScript, /writeProjectLibraryToDesktopPath/);
  assert.match(projectFileAdapterScript, /readProjectLibraryFromBrowserFile/);
  assert.match(projectFileDisplayScript, /resolveProjectFileDisplayState/);
  assert.match(projectFileDisplayScript, /resolveProjectFileDisplayPath/);
  assert.match(autosaveAdapterScript, /createProjectFileAutosaveController/);
  assert.match(shellScript, /Save as file/);
  assert.match(shellScript, /Load file/);
  assert.match(shellScript, /project-library-select/);
  assert.match(shellScript, /project-library-status/);
  assert.match(shellScript, /file-menu-shortcuts/);
  assert.match(shellScript, /Load Project Source/);
  assert.match(appScript.body, /EDITOR_PROJECT_LIBRARY_KEY/);
  assert.match(appScript.body, /EDITOR_ACTIVE_PROJECT_ID_KEY/);
  assert.match(appScript.body, /task-badge/);
  assert.match(appScript.body, /selectedTaskId/);
  assert.match(appScript.body, /task-body/);
  assert.match(appScript.body, /task-reference/);
  assert.match(appScript.body, /task-title-input/);
  assert.match(appScript.body, /function persistManuscriptTasksState\(options = \{\}\)/);
  assert.match(appScript.body, /domain: "manuscript-tasks"/);
  assert.doesNotMatch(appScript.body, /writeStoredJson\(EDITOR_TASKS_KEY/);
  assert.match(appScript.body, /return "Imported task";/);
  assert.match(appScript.body, /return "Imported note";/);
  assert.match(appScript.body, /passage-note-title-input/);
  assert.match(appScript.body, /function persistPassageNotesState\(options = \{\}\)/);
  assert.match(appScript.body, /domain: "passage-notes"/);
  assert.doesNotMatch(appScript.body, /writeStoredJson\(EDITOR_PASSAGE_NOTES_KEY/);
  assert.match(shellScript, /Local AI/);
  assert.match(appScript.body, /suggest-scene-title/);
  assert.match(appScript.body, /api\/local-ai\/generate-title/);
  assert.doesNotMatch(appScript.body, />Issues<\/h2>/);
  assert.doesNotMatch(appScript.body, /Inspiration Notes<\/h2>/);
  assert.doesNotMatch(appScript.body, /Research Notes<\/h2>/);
  assert.match(appScript.body, /renderSidePanelTab\("issues", "Tasks", taskCount\)/);
  assert.doesNotMatch(appScript.body, /renderSidePanelTab\("issues", "Issues"/);
  assert.doesNotMatch(appScript.body, /Issue Console/);
  assert.match(shellScript, /project-source-path/);
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
  assert.match(appScript.body, /getProjectRecordWordCountForSettings\(record\)/);

  const sceneEditorScript = createDesktopResponse("/features/scene-editor.js");
  assert.equal(sceneEditorScript.statusCode, 200);
  assert.match(sceneEditorScript.body, /Scene Editor/);
  assert.doesNotMatch(sceneEditorScript.body, /Scene Editor Viewport/);
  assert.match(sceneEditorScript.body, /Text Width/);
  assert.match(sceneEditorScript.body, /scene-editor-context/);
  assert.match(sceneEditorScript.body, /data-scene-editor-chapter-title/);
  assert.match(sceneEditorScript.body, /data-scene-editor-chapter-word-count/);
  assert.match(sceneEditorScript.body, /data-scene-editor-selection-word-count/);
  assert.match(sceneEditorScript.body, /data-scene-editor-scene-word-count/);
  assert.match(sceneEditorScript.body, /data-scene-title-id/);
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
    /async function saveCurrentProject\(\) \{[\s\S]*?projectPersistenceService\.saveProjectSnapshot\(\{ reason: "save-project" \}\);/,
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
  assert.match(shellScript, /Ctrl\+Alt\+T/);
  assert.match(shellScript, /Ctrl\+S save/);
  assert.match(shellScript, /Ctrl\+Shift\+S save as/);
  assert.match(shellScript, /Ctrl\+Shift\+O load file/);
  assert.match(shellScript, /Ctrl\+N new/);
  assert.match(shellScript, /Ctrl\+O file/);
  assert.match(shellScript, /Ctrl\+1-4 panes/);
  assert.match(shellScript, /Esc close/);
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
  assert.match(appScript.body, /toggle-console-chapter-collapse/);
  assert.match(appScript.body, /collapsedConsoleChapterIds/);
  assert.match(appScript.body, /console-chapter-group/);
  assert.match(appScript.body, /console-chapter-heading/);
  assert.match(appScript.body, /issueTasks/);
  assert.match(writingGoalsStateServiceScript, /On track/);
  assert.match(writingGoalsStateServiceScript, /Off track/);
  assert.match(appScript.body, /data-resize-handle="binder"/);
  assert.match(appScript.body, /data-resize-handle="console"/);
  assert.match(appScript.body, /syncLayoutWidths/);
  assert.match(appScript.body, /userSettingPanelResizerLeftPercent/);
  assert.match(appScript.body, /userSettingPanelResizerRightPercent/);
  assert.match(appScript.body, /persistPanelResizerUserSettings/);
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
  assert.match(appScript.body, /New template/);
  assert.match(appScript.body, /Dream Scaping/);
  assert.match(appScript.body, /scene line/);
  assert.match(appScript.body, /syncSceneDocumentLayout/);

  const sessionTrackerIcons = createDesktopResponse("/session-tracker-icons.js");
  assert.equal(sessionTrackerIcons.statusCode, 200);
  assert.match(sessionTrackerIcons.body, /renderSessionTrackerPenSvg/);
  assert.match(sessionTrackerIcons.body, /SESSION_TRACKER_FLAMING_PEN_SVG/);

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
  assert.match(progressTrackerModule.body, /writing-target-debug-toggle/);
  assert.match(progressTrackerModule.body, /open-developer-logs/);

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
  assert.match(styles.body, /\.file-menu-shortcuts/);
  assert.match(styles.body, /\.dream-suggestion/);
  assert.match(styles.body, /\.task-context-menu/);
  assert.match(styles.body, /\.task-composer/);
  assert.match(styles.body, /\.side-panel-tabs/);
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
  assert.match(styles.body, /rgba\(216, 244, 253, 0\.82\)/);
  assert.match(styles.body, /\.scene-editor-codeframe\.is-task-previewing/);
  assert.match(styles.body, /\.scene-editor-codeframe\.is-inspiration-previewing/);
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
  assert.match(styles.body, /\.desktop-environment-badge/);
  assert.match(styles.body, /\.workspace-tabs/);
  assert.match(styles.body, /\.workspace-tab/);
  assert.match(styles.body, /\.file-menu-panel/);
  assert.match(styles.body, /\.desktop-target-strip/);
  assert.match(styles.body, /\.writing-target-card/);
  assert.match(styles.body, /\.session-tracker-panel/);
  assert.match(styles.body, /\.session-tracker-panel__gauge/);
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
  assert.match(styles.body, /\.project-library-select-shell/);
  assert.match(styles.body, /\.project-library-status/);
  assert.match(styles.body, /\.project-source-shell/);
  assert.match(styles.body, /\.console-dock/);
  assert.match(styles.body, /\.console-dock-toggle/);
  assert.match(styles.body, /cursor: col-resize/);
  assert.match(styles.body, /\.source-archive/);
  assert.match(styles.body, /\.source-archive-item/);
  assert.match(styles.body, /\.project-title-input/);
  assert.match(styles.body, /\.local-ai-setting/);
  assert.match(styles.body, /\.ai-title-button/);
  assert.match(styles.body, /\.inline-title-input/);
  assert.match(styles.body, /\.binder-chapter-title-input/);
  assert.match(styles.body, /\.binder-scene-title-input/);
  assert.match(styles.body, /\.pane-section\[hidden\]/);
  assert.match(styles.body, /\.task-chapter-list/);
  assert.doesNotMatch(styles.body, /\.runtime-strip/);
  assert.match(styles.body, /\.task-copy/);
  assert.match(styles.body, /\.editor-document-input/);
  assert.match(styles.body, /\.editor-gutter-line/);
  assert.match(styles.body, /\.scene-editor-context/);
  assert.match(styles.body, /\.scene-editor-context__count/);
  assert.match(styles.body, /\.scene-editor-footer/);
  assert.match(styles.body, /\.scene-editor-footer__scene/);

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

  const sessionTrackerSleepingPen = createDesktopResponse("/assets/icons/session-tracker-sleeping-pen.svg");
  assert.equal(sessionTrackerSleepingPen.statusCode, 200);
  assert.match(sessionTrackerSleepingPen.body, /<svg/);

  const sessionTrackerWorkingPen = createDesktopResponse("/assets/icons/session-tracker-working-pen.svg");
  assert.equal(sessionTrackerWorkingPen.statusCode, 200);
  assert.match(sessionTrackerWorkingPen.body, /<svg/);

  const sessionTrackerFlamingPen = createDesktopResponse("/assets/icons/session-tracker-flaming-pen.svg");
  assert.equal(sessionTrackerFlamingPen.statusCode, 200);
  assert.match(sessionTrackerFlamingPen.body, /<svg/);

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
  assert.equal(importedProject.workspace.project.stats.chapterCount, 4);
  assert.equal(importedProject.workspace.project.stats.sceneCount, 29);
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
}
