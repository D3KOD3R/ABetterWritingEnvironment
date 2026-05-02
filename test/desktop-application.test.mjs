import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDesktopResponse,
  createDesktopResponseForRequest,
} from "../apps/desktop/src/http-app.ts";
import { createDesktopWorkspaceSnapshot } from "../apps/desktop/src/workspace.ts";

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
    const savedProjectFile = JSON.parse(readFileSync(savedProjectPath, "utf8"));
    assert.equal(savedProjectFile.activeProjectId, projectLibrary.activeProjectId);
    assert.equal(savedProjectFile.projects.length, 1);
    assert.equal(savedProjectFile.projects[0].title, "Project Serva Vitae");
    assert.equal(savedProjectFile.projects[0].projectSettings.writingTargetViewMode, "month");
    assert.equal(savedProjectFile.projects[0].projectSettings.consoleDockCollapsed, false);
    assert.equal(typeof savedProjectFile.projects[0].projectSettings.projectSourcePath, "string");

    const loadProjectFileResponse = await createDesktopResponseForRequest({
      method: "POST",
      pathname: "/api/project-file/load",
      body: JSON.stringify({
        filePath: savedProjectPath,
      }),
    });
    assert.equal(loadProjectFileResponse.statusCode, 200);
    const loadedProjectFile = JSON.parse(loadProjectFileResponse.body);
    assert.equal(loadedProjectFile.activeProjectId, projectLibrary.activeProjectId);
    assert.equal(loadedProjectFile.projects[0].title, "Project Serva Vitae");
    assert.equal(loadedProjectFile.projects[0].projectSettings.writingTargetViewMode, "month");
    assert.equal(typeof loadedProjectFile.projects[0].projectSettings.projectSourcePath, "string");
  } finally {
    rmSync(tempProjectDir, { recursive: true, force: true });
  }

  const bundledProjectLibrary = createDesktopResponse("/serva-vitae-project-library.js");
  assert.equal(bundledProjectLibrary.statusCode, 200);
  assert.match(bundledProjectLibrary.body, /window\.__ABE_SERVA_VITAE_PROJECT_LIBRARY__/);
  assert.match(bundledProjectLibrary.body, /project-serva-vitae/);

  const appScript = createDesktopResponse("/app.js");
  assert.equal(appScript.statusCode, 200);
  assert.doesNotMatch(appScript.body, /Add narration block/);
  assert.doesNotMatch(appScript.body, /Add dialogue block/);
  assert.doesNotMatch(appScript.body, /Scene Synopsis/);
  assert.match(appScript.body, /editor-document-input/);
  assert.match(appScript.body, /contextmenu/);
  assert.match(appScript.body, /Add task/);
  assert.match(appScript.body, /Inspiration/);
  assert.match(appScript.body, /Research/);
  assert.match(appScript.body, /Task body/);
  assert.match(appScript.body, /passage-note-body/);
  assert.match(appScript.body, /openPassageNoteComposerFromContextMenu/);
  assert.match(appScript.body, /inline-passage-note/);
  assert.match(appScript.body, /inline-passage-verse/);
  assert.match(appScript.body, /commitInlinePassageNote/);
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
  assert.match(appScript.body, /focusProjectLibrarySelect/);
  assert.match(appScript.body, /Saved projects/);
  assert.match(appScript.body, /Project file/);
  assert.match(appScript.body, /project-file-path/);
  assert.match(appScript.body, /project-file-status/);
  assert.match(appScript.body, /Save as file/);
  assert.match(appScript.body, /Load file/);
  assert.match(appScript.body, /canUseBrowserSavePicker/);
  assert.match(appScript.body, /canUseBrowserOpenPicker/);
  assert.match(appScript.body, /promptForProjectFileFromInput/);
  assert.match(appScript.body, /downloadProjectLibrarySnapshot/);
  assert.match(appScript.body, /project-library-select/);
  assert.match(appScript.body, /project-library-status/);
  assert.match(appScript.body, /file-menu-shortcuts/);
  assert.match(appScript.body, /toggle-console-collapse/);
  assert.match(appScript.body, /console-dock-toggle/);
  assert.match(appScript.body, /Load Project Source/);
  assert.match(appScript.body, /Project sources/);
  assert.match(appScript.body, /Project archive/);
  assert.match(appScript.body, /source-archive/);
  assert.match(appScript.body, /task-source/);
  assert.match(appScript.body, /EDITOR_PROJECT_LIBRARY_KEY/);
  assert.match(appScript.body, /EDITOR_ACTIVE_PROJECT_ID_KEY/);
  assert.match(appScript.body, /task-badge/);
  assert.match(appScript.body, /selectedTaskId/);
  assert.match(appScript.body, /task-body/);
  assert.match(appScript.body, /task-reference/);
  assert.match(appScript.body, /task-title-input/);
  assert.match(appScript.body, /passage-note-title-input/);
  assert.match(appScript.body, /Local AI/);
  assert.match(appScript.body, /suggest-scene-title/);
  assert.match(appScript.body, /api\/local-ai\/generate-title/);
  assert.doesNotMatch(appScript.body, />Issues<\/h2>/);
  assert.doesNotMatch(appScript.body, /Inspiration Notes<\/h2>/);
  assert.doesNotMatch(appScript.body, /Research Notes<\/h2>/);
  assert.match(appScript.body, /project-title-input/);
  assert.match(appScript.body, /project-source-path/);
  assert.match(appScript.body, /select-pane/);
  assert.match(appScript.body, /formatChapterDisplayTitle/);
  assert.match(appScript.body, /binder-chapter-order/);
  assert.match(appScript.body, /binder-chapter-title/);
  assert.match(appScript.body, /binder-nav-action-short/);
  assert.match(appScript.body, /toggle-writing-target-window/);
  assert.match(appScript.body, /writing-target-window/);
  assert.match(appScript.body, /data-action="close-writing-target-window"/);
  assert.match(appScript.body, /Writing Goals/);
  assert.match(appScript.body, /writingTargetPointerDownStartedInsideWindow/);
  assert.match(appScript.body, /sessionWordsPerHourLabel/);
  assert.match(appScript.body, /sessionMilestoneStatusText/);
  assert.match(appScript.body, /estimateRecentSessionWordsPerMinute/);
  assert.match(appScript.body, /const sessionIsLive = sessionLifecycle\.sessionDisplayActive === true;/);
  assert.match(appScript.body, /if \(!record\.sessionIsActive \|\| !lifecycle\.isConcluded\) \{/);
  assert.match(appScript.body, /touchWritingTargetSessionActivity/);
  assert.match(appScript.body, /syncHeaderLiveState/);
  assert.match(appScript.body, /const shouldCaptureImmediately = options\.immediate === true/);
  assert.match(appScript.body, /Idle/);
  assert.match(appScript.body, /WRITING_TARGET_SESSION_SEGMENT_CLOSE_BUFFER_MINUTES/);
  assert.match(appScript.body, /WRITING_TARGET_SESSION_NEW_SESSION_BUFFER_MINUTES/);
  assert.match(appScript.body, /buildWritingTargetSessionLifecycleSummaryText/);
  assert.match(appScript.body, /sessionLifecycleSummaryText/);
  assert.match(appScript.body, /data-session-tracker-start-time/);
  assert.match(appScript.body, /data-session-tracker-words-written/);
  assert.match(appScript.body, /sessionSamples/);
  assert.match(appScript.body, /createPassageExcerpt/);
  assert.match(appScript.body, /passageExcerpt/);
  assert.match(appScript.body, /getWritingTargetDailyBaselineWordCount/);
  assert.doesNotMatch(appScript.body, /todaysEntry/);
  assert.match(appScript.body, /filter\(\(entry\) => entry\.date < todayKey\)[\s\S]*?\.at\(-1\)/);
  assert.match(appScript.body, /dailyBaselineDateKey/);
  assert.match(appScript.body, /dailyBaselineWordCount/);
  assert.match(appScript.body, /const dailyWords = currentWordCount - dailyBaselineWordCount;/);
  assert.match(appScript.body, /progress: sessionTargetWords > 0 \? Math\.min\(1, Math\.max\(0, dailyWords\) \/ sessionTargetWords\) : 0,/);
  assert.match(appScript.body, /syncWritingTargetWindowLiveState\(\);[\s\S]*?queueWritingTargetSnapshot\(/);
  assert.match(appScript.body, /buildLiveWritingTargetHistoryEntry/);
  assert.match(appScript.body, /recordWritingTargetSnapshot/);
  assert.match(appScript.body, /commitWritingTargetDraft/);
  assert.match(appScript.body, /getProjectRecordById\(projectId\)/);
  assert.match(appScript.body, /projectRecord\?\.projectSettings\?\.writingTargetState \?\? store\[projectId\]/);
  assert.match(appScript.body, /function syncWritingTargetCanonicalState\(record\)/);
  assert.match(appScript.body, /writingTargetDraftBaseline/);

  const sceneEditorScript = createDesktopResponse("/features/scene-editor.js");
  assert.equal(sceneEditorScript.statusCode, 200);
  assert.match(sceneEditorScript.body, /Scene Editor Viewport/);
  assert.match(sceneEditorScript.body, /Text Width/);
  assert.match(sceneEditorScript.body, /Save to typed verse/);
  assert.match(appScript.body, /const writingTargetWorkingRecord = getWritingTargetWorkingRecord\(\);/);
  assert.match(
    appScript.body,
    /function saveWritingTargetGoals\(\) \{[\s\S]*?commitWritingTargetDraft\(\);[\s\S]*?if \(hasProjectFileDestination\(\)\) \{[\s\S]*?void saveCurrentProject\(\);/,
  );
  assert.match(
    appScript.body,
    /function closeWritingTargetWindow\(\) \{[\s\S]*?commitWritingTargetDraft\(\);/,
  );
  assert.match(
    appScript.body,
    /async function saveCurrentProject\(\) \{[\s\S]*?commitWritingTargetDraft\(\);/,
  );
  assert.match(
    appScript.body,
    /async function saveCurrentProjectFileAs\(\) \{[\s\S]*?commitWritingTargetDraft\(\);/,
  );
  assert.match(appScript.body, /saveWritingTargetState/);
  assert.match(appScript.body, /syncWritingTargetWindowLiveState/);
  assert.match(appScript.body, /data-session-tracker-panel/);
  assert.match(appScript.body, /startWritingTargetWindowRefreshTimer/);
  assert.match(appScript.body, /stopWritingTargetWindowRefreshTimer/);
  assert.doesNotMatch(appScript.body, /Seed 30-day sample/);
  assert.doesNotMatch(appScript.body, /seed-writing-target-data/);
  assert.match(appScript.body, /EDITOR_WRITING_TARGETS_KEY/);
  assert.match(appScript.body, /Ctrl\+Alt\+T/);
  assert.match(appScript.body, /Ctrl\+S save/);
  assert.match(appScript.body, /Ctrl\+Shift\+S save as/);
  assert.match(appScript.body, /Ctrl\+Shift\+O load file/);
  assert.match(appScript.body, /Ctrl\+N new/);
  assert.match(appScript.body, /Ctrl\+O file/);
  assert.match(appScript.body, /Ctrl\+1-4 panes/);
  assert.match(appScript.body, /Esc close/);
  assert.match(appScript.body, /Words/);
  assert.match(appScript.body, /Days to release/);
  assert.match(appScript.body, /writing-target-dashboard-stats/);
  assert.match(appScript.body, /writing-target-dashboard-body/);
  assert.match(appScript.body, /writing-target-dashboard-settings/);
  assert.match(appScript.body, /writing-target-dashboard-calendar/);
  assert.match(appScript.body, /writing-target-dashboard-detail/);
  assert.match(appScript.body, /writing-target-window-copy/);
  assert.match(appScript.body, /writing-target-view-toggle/);
  assert.match(appScript.body, /writing-target-calendar-grid/);
  assert.match(appScript.body, /writing-target-calendar-day-progress/);
  assert.match(appScript.body, /writing-target-calendar-day-indicators/);
  assert.match(appScript.body, /writing-target-calendar-day-indicator-icon/);
  assert.match(appScript.body, /writing-target-calendar-day-indicator-count/);
  assert.match(appScript.body, /writing-target-week-grid/);
  assert.match(appScript.body, /writing-target-day-overview/);
  assert.match(appScript.body, /writing-target-day-points/);
  assert.match(appScript.body, /writing-target-day-session-summary/);
  assert.match(appScript.body, /writing-target-day-hero/);
  assert.match(appScript.body, /writing-target-note-field/);
  assert.match(appScript.body, /writing-target-footer-actions/);
  assert.match(appScript.body, /writing-target-help-card/);
  assert.match(appScript.body, /Goal settings/);
  assert.match(appScript.body, /Calendar view/);
  assert.match(appScript.body, /Selected day/);
  assert.match(appScript.body, /Save goals/);
  assert.match(appScript.body, /Cancel/);
  assert.match(appScript.body, /Reset to defaults/);
  assert.match(appScript.body, /Month/);
  assert.match(appScript.body, /Week/);
  assert.match(appScript.body, /List/);
  assert.match(appScript.body, /writing-target-archive/);
  assert.match(appScript.body, /YYYY-MM-DD or DD\/MM\/YYYY/);
  assert.match(appScript.body, /targetCadence/);
  assert.match(appScript.body, /writing-target-range/);
  assert.match(appScript.body, /Daily target/);
  assert.match(appScript.body, /goalSyncSource/);
  assert.match(appScript.body, /goalSyncHint/);
  assert.match(appScript.body, /syncWritingTargetGoalFields/);
  assert.match(appScript.body, /sessionsPerDay/);
  assert.match(appScript.body, /sessionTimeoutMinutes/);
  assert.match(appScript.body, /DEFAULT_SESSION_TARGETS_PER_DAY = 5/);
  assert.match(appScript.body, /toggle-console-chapter-collapse/);
  assert.match(appScript.body, /collapsedConsoleChapterIds/);
  assert.match(appScript.body, /console-chapter-group/);
  assert.match(appScript.body, /console-chapter-heading/);
  assert.match(appScript.body, /issueTasks/);
  assert.match(appScript.body, /On track/);
  assert.match(appScript.body, /Off track/);
  assert.match(appScript.body, /data-resize-handle="binder"/);
  assert.match(appScript.body, /data-resize-handle="console"/);
  assert.match(appScript.body, /syncLayoutWidths/);
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

  const sharedUiUtilsModule = createDesktopResponse("/shared/ui-utils.js");
  assert.equal(sharedUiUtilsModule.statusCode, 200);
  assert.match(sharedUiUtilsModule.body, /function escapeHtml/);
  assert.match(sharedUiUtilsModule.body, /function formatDisplayNumber/);

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
  assert.match(styles.body, /\.pane-section\[hidden\]/);
  assert.match(styles.body, /\.task-chapter-list/);
  assert.doesNotMatch(styles.body, /\.runtime-strip/);
  assert.match(styles.body, /\.task-copy/);
  assert.match(styles.body, /\.editor-document-input/);
  assert.match(styles.body, /\.editor-gutter-line/);

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
      ),
    }),
  });
  assert.equal(projectIntegrator.statusCode, 200);
  const importedProjectLibrary = JSON.parse(projectIntegrator.body);
  assert.equal(importedProjectLibrary.projects.length, 1);
  assert.equal(importedProjectLibrary.projects[0].source, "project-file");
  assert.equal(importedProjectLibrary.projects[0].workspace.project.stats.chapterCount, 4);
  assert.equal(importedProjectLibrary.projects[0].workspace.project.stats.sceneCount, 29);
  assert.equal(importedProjectLibrary.projects[0].workspace.world.templates.length, 7);

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

  const localAiUnsupportedMethod = await createDesktopResponseForRequest({
    method: "POST",
    pathname: "/api/settings",
    body: "{}",
  });
  assert.equal(localAiUnsupportedMethod.statusCode, 405);

  const missing = createDesktopResponse("/missing");
  assert.equal(missing.statusCode, 404);
}
