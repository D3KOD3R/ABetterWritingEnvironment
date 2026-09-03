// Intent: verify top chrome only exposes manuscript-owned workflows on supported panes.
import assert from "node:assert/strict";

import { renderEditorChrome } from "../apps/editor/public/shell/editor-chrome.js";

function createChromeState(activePane, overrides = {}) {
  return {
    activePane,
    fileMenuOpen: false,
    projectSettingsMenuOpen: true,
    projectLibrary: [],
    projectFilePath: "",
    localAiPrefs: { enabled: false },
    editorPrefs: {},
    writingTargetWindowOpen: false,
    revisionWindowOpen: false,
    revisionState: { sessions: [] },
    draftProofing: { activeRunId: "", runs: [] },
    draftProofMarksVisible: false,
    ...overrides,
  };
}

function createWritingTargetSummary() {
  return {
    goalButtonLabel: "240 today",
    visibleMetrics: [{
      key: "wordTarget",
      label: "Word Target",
      value: "12,400",
      leftLabel: "12,400",
      rightLabel: "80,000",
      progress: 0.15,
      note: "67,600 remaining",
    }, {
      key: "sessionTracker",
      label: "Session tracker",
    }],
    debugTerminal: {
      entryCount: 4,
      recentErrorCount: 0,
      lastEventLabel: "Rendered",
    },
    currentSessionWords: 48,
    sessionTargetWordsPerSession: 600,
    sessionWordsPerMinute: 12,
    sessionRequiredWordsPerMinute: 10,
    sessionWordsPerMinuteLabel: "12/min",
    sessionRequiredWordsPerMinuteLabel: "10/min",
    sessionWordsPerMinuteRatio: 1,
    sessionWordsPerMinuteStatusText: "On track",
    sessionWordsPerMinuteBarColor: "rgb(113, 215, 177)",
    sessionCurrentTimeLabel: "12:30",
    sessionStartTimeLabel: "12:00",
    sessionMinutesLapsed: 30,
    sessionIsActive: true,
    sessionPaceActive: true,
  };
}

function renderChromeForPane(activePane, stateOverrides = {}) {
  const projectFilePath = stateOverrides.projectFilePath ?? "";
  return renderEditorChrome({
    state: createChromeState(activePane, stateOverrides),
    workspace: {
      settings: { executionMode: "local-only" },
      project: { stats: { lineCount: 42 } },
    },
    writingTargetSummary: createWritingTargetSummary(),
    projectFileAutosaveConnected: false,
    projectFileDisplay: {
      inputValue: projectFilePath,
      pathLabel: projectFilePath,
      tooltip: projectFilePath || "No project file selected",
    },
  });
}

export function runEditorChromeTest() {
  const manuscriptHtml = renderChromeForPane("manuscript");
  assert.match(manuscriptHtml, /draft-proof-panel/);
  assert.match(manuscriptHtml, /file-menu-actions project-settings-actions/);
  assert.match(manuscriptHtml, /data-action="open-proof-read-settings"/);
  assert.match(manuscriptHtml, /data-action="open-local-ai-panel"/);
  assert.match(manuscriptHtml, /User Settings/);
  assert.match(manuscriptHtml, /data-action="open-keyboard-shortcut-settings"/);
  assert.match(manuscriptHtml, /data-editor-pref="milestoneSoundEffectsEnabled"/);
  assert.match(manuscriptHtml, /Milestone sounds/);
  assert.match(manuscriptHtml, /session-tracker-panel/);
  assert.match(manuscriptHtml, /data-action="hide-top-panel-card"/);
  assert.match(
    manuscriptHtml,
    /class="desktop-title-cluster"[\s\S]*class="desktop-app-name"[\s\S]*class="desktop-title-tools"[\s\S]*class="desktop-environment-badge[^"]*"[\s\S]*class="appearance-mode-control"[\s\S]*class="side-panels-focus-toggle/,
  );
  assert.match(manuscriptHtml, /data-action="toggle-side-panels-hidden"/);
  assert.match(manuscriptHtml, /aria-label="Hide side panels"/);
  assert.match(manuscriptHtml, /data-action="toggle-developer-options-menu"/);
  assert.match(manuscriptHtml, /class="appearance-mode-control"/);
  assert.match(manuscriptHtml, /data-action="set-appearance-mode"/);
  assert.match(manuscriptHtml, /spotify-music-chrome/);
  assert.match(manuscriptHtml, /data-action="toggle-spotify-music-panel"/);
  assert.match(manuscriptHtml, /data-appearance-mode="light"[\s\S]*aria-pressed="true"/);
  assert.match(manuscriptHtml, /data-appearance-mode="dark"/);
  assert.match(manuscriptHtml, /data-appearance-mode="system"/);
  assert.doesNotMatch(manuscriptHtml, /data-stat-key="lines"/);

  const darkModeHtml = renderChromeForPane("manuscript", {
    editorPrefs: { appearanceMode: "dark" },
  });
  assert.match(darkModeHtml, /data-appearance-mode="dark"[\s\S]*aria-pressed="true"/);
  assert.match(darkModeHtml, /aria-label="Follow system appearance"/);

  const soundDisabledHtml = renderChromeForPane("manuscript", {
    editorPrefs: { milestoneSoundEffectsEnabled: false },
  });
  assert.match(soundDisabledHtml, /data-editor-pref="milestoneSoundEffectsEnabled"/);
  assert.match(soundDisabledHtml, /<strong>Off<\/strong>/);

  const sidePanelsHiddenHtml = renderChromeForPane("manuscript", {
    sidePanelsHidden: true,
  });
  assert.match(sidePanelsHiddenHtml, /data-action="toggle-side-panels-hidden"/);
  assert.match(sidePanelsHiddenHtml, /aria-pressed="true"/);
  assert.match(sidePanelsHiddenHtml, /aria-label="Show side panels"/);

  const spotifyOpenHtml = renderChromeForPane("manuscript", {
    spotifyMusicPanelOpen: true,
    spotifyMusic: {
      clientId: "client-1",
      redirectUri: "http://localhost/",
      token: { accessToken: "token", tokenType: "Bearer", refreshToken: "", expiresAt: Date.now() + 60000 },
      query: "scene score",
    },
  });
  assert.match(spotifyOpenHtml, /spotify-music-popover/);
  assert.match(spotifyOpenHtml, /data-action="close-spotify-music-panel"/);

  const developerOptionsHtml = renderChromeForPane("manuscript", {
    developerOptionsMenuOpen: true,
    spotifyMusic: {
      clientId: "client-1",
      redirectUri: "http://localhost/",
      clientIdDraft: "client-1",
    },
  });
  assert.match(developerOptionsHtml, /developer-options-menu-panel/);
  assert.match(developerOptionsHtml, /Spotify app setup/);
  assert.match(developerOptionsHtml, /data-spotify-client-id/);

  const narrationHtml = renderChromeForPane("narration");
  assert.doesNotMatch(narrationHtml, /draft-proof-panel/);
  assert.doesNotMatch(narrationHtml, /data-action="open-proof-read-settings"/);
  assert.match(narrationHtml, /data-action="open-keyboard-shortcut-settings"/);
  assert.match(narrationHtml, /data-action="open-local-ai-panel"/);
  assert.doesNotMatch(narrationHtml, /session-tracker-panel/);
  assert.match(narrationHtml, /developer-log-chip/);
  assert.match(narrationHtml, /data-writing-target-card="wordTarget"/);

  const worldHtml = renderChromeForPane("world");
  assert.doesNotMatch(worldHtml, /draft-proof-panel/);
  assert.doesNotMatch(worldHtml, /session-tracker-panel/);
  assert.match(worldHtml, /data-writing-target-card="wordTarget"/);

  const scopedWorldHiddenHtml = renderChromeForPane("world", {
    topPanelVisibility: {
      manuscript: { wordTarget: true },
      world: { wordTarget: false },
    },
  });
  assert.doesNotMatch(scopedWorldHiddenHtml, /data-writing-target-card="wordTarget"/);
  const scopedManuscriptShownHtml = renderChromeForPane("manuscript", {
    topPanelVisibility: {
      manuscript: { wordTarget: true },
      world: { wordTarget: false },
    },
  });
  assert.match(scopedManuscriptShownHtml, /data-writing-target-card="wordTarget"/);

  const hiddenCardHtml = renderChromeForPane("manuscript", {
    topPanelVisibility: {
      developerLogs: false,
      wordTarget: false,
      autosave: false,
    },
  });
  assert.doesNotMatch(hiddenCardHtml, /developer-log-chip/);
  assert.doesNotMatch(hiddenCardHtml, /data-writing-target-card="wordTarget"/);
  assert.doesNotMatch(hiddenCardHtml, /data-project-autosave-indicator/);
  assert.match(hiddenCardHtml, /data-top-panel-customization-region="target-strip"/);

  const restoredProofReadHtml = renderChromeForPane("manuscript", {
    topPanelVisibility: {
      draftProof: true,
      developerLogs: false,
    },
  });
  assert.match(restoredProofReadHtml, /draft-proof-panel/);
  assert.match(restoredProofReadHtml, /data-top-panel-card="draftProof"/);

  const allHiddenCardHtml = renderChromeForPane("manuscript", {
    topPanelVisibility: {
      draftProof: false,
      developerLogs: false,
      wordTarget: false,
      sessionTarget: false,
      forecast: false,
      sessionTracker: false,
      autosave: false,
      writingGoals: false,
      revisions: false,
    },
  });
  assert.match(allHiddenCardHtml, /class="desktop-stat-strip is-empty"/);
  assert.match(allHiddenCardHtml, /class="desktop-target-strip is-empty"/);
  assert.match(allHiddenCardHtml, /data-leading-empty="true"/);
  assert.match(allHiddenCardHtml, /data-metrics-empty="true"/);
  assert.match(allHiddenCardHtml, /data-top-panel-region-empty="true"/);
  assert.match(allHiddenCardHtml, /data-top-panel-restore-target="target-strip"/);
  assert.doesNotMatch(allHiddenCardHtml, /data-top-panel-restore-target="target-leading"/);
  assert.doesNotMatch(allHiddenCardHtml, /data-top-panel-restore-target="target-metrics"/);
  assert.match(allHiddenCardHtml, /data-top-panel-restore-target="chrome-stats"/);

  const popoverHtml = renderChromeForPane("manuscript", {
    topPanelCustomizationOpen: true,
    topPanelCustomizationGroupId: "target-strip",
    topPanelCustomizationPosition: { x: 128, y: 96 },
    topPanelVisibility: {
      wordTarget: false,
    },
  });
  assert.match(popoverHtml, /data-top-panel-customization/);
  assert.match(popoverHtml, /data-top-panel-customization-pane="manuscript"/);
  assert.match(popoverHtml, /Manuscript page only/);
  assert.match(popoverHtml, /data-top-panel-card-toggle="draftProof"/);
  assert.match(popoverHtml, /data-top-panel-card-toggle="developerLogs"/);
  assert.match(popoverHtml, /data-top-panel-card-toggle="wordTarget"/);
  assert.match(popoverHtml, /data-top-panel-card-toggle="sessionTracker"/);
  assert.match(popoverHtml, /data-action="reset-top-panel-customization"/);
  assert.match(popoverHtml, /data-action="hide-all-top-panel-customization"/);

  const fileMenuHtml = renderChromeForPane("manuscript", {
    fileMenuOpen: true,
    activeProjectId: "project-new",
    projectFilePath: "C:\\Projects\\Novel.abe-project.json",
    projectLibrary: [{
      id: "project-old",
      title: "Older Novel",
      updatedAt: "2026-07-10T09:00:00.000Z",
      projectSettings: { projectFilePath: "C:\\Projects\\Older.abe-project.json" },
    }, {
      id: "project-new",
      title: "Recent Novel",
      updatedAt: "2026-07-18T09:00:00.000Z",
      projectSettings: { projectFilePath: "C:\\Projects\\Recent.abe-project.json" },
    }],
  });
  assert.match(fileMenuHtml, /aria-label="Project menu"/);
  assert.match(fileMenuHtml, /file-menu-actions project-file-actions/);
  assert.match(fileMenuHtml, /Project location/);
  assert.match(fileMenuHtml, /C:\\Projects\\Novel\.abe-project\.json/);
  assert.match(fileMenuHtml, /data-action="create-project"[\s\S]*New Project\.\.\./);
  assert.match(fileMenuHtml, /data-action="load-project-file"[\s\S]*Open Project\.\.\./);
  assert.match(fileMenuHtml, /data-action="import-scrivener-project"[\s\S]*Port Scrivener\.\.\./);
  assert.match(fileMenuHtml, /class="project-recent-menu" role="menu" aria-label="Recent loaded projects"/);
  assert.match(fileMenuHtml, /data-action="load-project"[\s\S]*data-project-id="project-new"[\s\S]*Recent Novel/);
  assert.match(fileMenuHtml, /data-action="load-project"[\s\S]*data-project-id="project-old"[\s\S]*Older Novel/);
  assert.ok(fileMenuHtml.indexOf("Recent Novel") < fileMenuHtml.indexOf("Older Novel"));
  assert.match(fileMenuHtml, /data-action="save-project"[\s\S]*Save/);
  assert.match(fileMenuHtml, /data-action="save-project-file-as"[\s\S]*Save As\.\.\./);
  assert.match(fileMenuHtml, />Autosave</);
  assert.doesNotMatch(fileMenuHtml, /Saved projects/);
  assert.doesNotMatch(fileMenuHtml, /data-edit-field="project-file-path"/);
  assert.doesNotMatch(fileMenuHtml, /Load file/);
  assert.doesNotMatch(fileMenuHtml, /Load Project Source/);

  const pinnedActiveProjectMenuHtml = renderChromeForPane("manuscript", {
    fileMenuOpen: true,
    activeProjectId: "scrivener-imported-novel",
    projectLibrary: [
      {
        id: "scrivener-imported-novel",
        title: "Ported Scrivener Novel",
        updatedAt: "2026-07-01T09:00:00.000Z",
        projectSettings: { projectFilePath: "imported-novel.abe-project.json" },
      },
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `newer-project-${index + 1}`,
        title: `Newer Project ${index + 1}`,
        updatedAt: `2026-07-${String(index + 10).padStart(2, "0")}T09:00:00.000Z`,
        projectSettings: { projectFilePath: `C:\\Projects\\Newer-${index + 1}.abe-project.json` },
      })),
    ],
  });
  assert.match(pinnedActiveProjectMenuHtml, /Ported Scrivener Novel/);
  assert.ok(pinnedActiveProjectMenuHtml.indexOf("Ported Scrivener Novel") < pinnedActiveProjectMenuHtml.indexOf("Newer Project 6"));
}
