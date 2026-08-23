// Intent: run the repository's focused contract tests as one lightweight Node test harness.
import { runAnalysisServiceTest } from "./analysis-service.test.mjs";
import { runAnchoredRecordControllerTest } from "./anchored-record-controller.test.mjs";
import { runAnchoredRecordNavigationControllerTest } from "./anchored-record-navigation-controller.test.mjs";
import { runAnchoredRecordServiceTest } from "./anchored-record-service.test.mjs";
import { runApplicationSyntaxSmokeTest } from "./application-syntax-smoke.test.mjs";
import { runAudiobookSchemaTest } from "./audiobook-schema.test.mjs";
import { runAudioServiceTest } from "./audio-service.test.mjs";
import { runCustomMetadataServiceTest } from "./custom-metadata-service.test.mjs";
import { runDesktopApplicationTest } from "./desktop-application.test.mjs";
import { runDeveloperLoggerTest } from "./developer-logger.test.mjs";
import { runDeleteConfirmationDialogTest } from "./delete-confirmation-dialog.test.mjs";
import { runDictionaryContextControllerTest } from "./dictionary-context-controller.test.mjs";
import { runDictionaryLexiconServiceTest } from "./dictionary-lexicon-service.test.mjs";
import { runDictionaryWindowTest } from "./dictionary-window.test.mjs";
import { runDictionaryWordServiceTest } from "./dictionary-word-service.test.mjs";
import { runDraftProofingPanelTest } from "./draft-proofing-panel.test.mjs";
import { runDraftProofingServiceTest } from "./draft-proofing-service.test.mjs";
import { runDraftProofingSettingsWindowTest } from "./draft-proofing-settings-window.test.mjs";
import { runEditorChromeTest } from "./editor-chrome.test.mjs";
import { runEditorStorageTest } from "./editor-storage.test.mjs";
import { runEditorUiStateTest } from "./editor-ui-state.test.mjs";
import { runEditorModelTest } from "./editor-model.test.mjs";
import { runGrammarCheckPanelTest } from "./grammar-check-panel.test.mjs";
import { runKeyboardShortcutSettingsTest } from "./keyboard-shortcut-settings.test.mjs";
import { runLocalAiModelLibraryTest } from "./local-ai-model-library.test.mjs";
import { runLocalAiPanelTest } from "./local-ai-panel.test.mjs";
import { runLocalAiTitleServiceTest } from "./local-ai-title-service.test.mjs";
import { runLocalAiRouterContractTest } from "./local-ai-router.test.mjs";
import { runLocalAiServiceTest } from "./local-ai-service.test.mjs";
import { runManuscriptSchemaTest } from "./manuscript-schema.test.mjs";
import { runManuscriptCommandControllerTest } from "./manuscript-command-controller.test.mjs";
import { runManuscriptEditorHostTest } from "./manuscript-editor-host.test.mjs";
import { runManuscriptFindControllerTest } from "./manuscript-find-controller.test.mjs";
import { runManuscriptInputControllerTest } from "./manuscript-input-controller.test.mjs";
import { runManuscriptLayoutServiceTest } from "./manuscript-layout-service.test.mjs";
import { runManuscriptMarkHistoryServiceTest } from "./manuscript-mark-history-service.test.mjs";
import { runManuscriptMarkServiceTest } from "./manuscript-mark-service.test.mjs";
import { runManuscriptAnchorServicesTest } from "./manuscript-anchor-services.test.mjs";
import { runManuscriptProjectionSelectorTest } from "./manuscript-projection-selector.test.mjs";
import { runManuscriptSelectionControllerTest } from "./manuscript-selection-controller.test.mjs";
import { runManuScriptInfographicLaneSelectorTest } from "./ManuScriptInfographicLane-selector.test.mjs";
import { runMetadataSubgroupServiceTest } from "./metadata-subgroup-service.test.mjs";
import { runMilestoneSoundEffectsServiceTest } from "./milestone-sound-effects-service.test.mjs";
import { runNarrationMediaServiceTest } from "./narration-media-service.test.mjs";
import { runNarrationMetadataSyncServiceTest } from "./narration-metadata-sync-service.test.mjs";
import { runNarrationMediaRecorderServiceTest } from "./narration-media-recorder-service.test.mjs";
import { runNarrationFollowAlignmentServiceTest } from "./narration-follow-alignment-service.test.mjs";
import { runNarrationFollowDisplayServiceTest } from "./narration-follow-display-service.test.mjs";
import { runNarrationFollowSettingsServiceTest } from "./narration-follow-settings-service.test.mjs";
import { runNarrationFollowTranscriptWindowServiceTest } from "./narration-follow-transcript-window-service.test.mjs";
import { runNarrationFollowViewportMetricsServiceTest } from "./narration-follow-viewport-metrics-service.test.mjs";
import { runNarrationDesktopSpeechTrackerServiceTest } from "./narration-desktop-speech-tracker-service.test.mjs";
import { runNarrationLiveAudioFrameServiceTest } from "./narration-live-audio-frame-service.test.mjs";
import { runNarrationLiveSpeechTrackerServiceTest } from "./narration-live-speech-tracker-service.test.mjs";
import { runNarrationReadingRateServiceTest } from "./narration-reading-rate-service.test.mjs";
import { runNarrationRealtimeSpeechClientTest } from "./narration-realtime-speech-client.test.mjs";
import { runNarrationRecordingAlignmentJobServiceTest } from "./narration-recording-alignment-job-service.test.mjs";
import { runNarrationRecordingAlignmentServiceTest } from "./narration-recording-alignment-service.test.mjs";
import { runNarrationRecordingReviewServiceTest } from "./narration-recording-review-service.test.mjs";
import { runNarrationRecordingCommandServiceTest } from "./narration-recording-command-service.test.mjs";
import { runNarrationRecordingFinalizationServiceTest } from "./narration-recording-finalization-service.test.mjs";
import { runNarrationRecordingRuntimeServiceTest } from "./narration-recording-runtime-service.test.mjs";
import { runNarrationSelectionServiceTest } from "./narration-selection-service.test.mjs";
import { runNarrationSpeechRecognitionServiceTest } from "./narration-speech-recognition-service.test.mjs";
import { runNarrationTakeServiceTest } from "./narration-take-service.test.mjs";
import { runNarrationVisibleRangeServiceTest } from "./narration-visible-range-service.test.mjs";
import { runNarrationViewportTrackerServiceTest } from "./narration-viewport-tracker-service.test.mjs";
import { runPassageNotePanelTest } from "./passage-note-panel.test.mjs";
import { runProjectFileStorageAdaptersTest } from "./project-file-storage-adapters.test.mjs";
import { runProjectActivationControllerTest } from "./project-activation-controller.test.mjs";
import { runProjectActivationStateTest } from "./project-activation-state.test.mjs";
import { runProjectLibraryStateTest } from "./project-library-state.test.mjs";
import { runProjectRecordStateTest } from "./project-record-state.test.mjs";
import { runProjectRuntimeRecordStateTest } from "./project-runtime-record-state.test.mjs";
import { runProgressTrackerTest } from "./progress-tracker.test.mjs";
import { runProjectRefreshPersistenceTest } from "./project-refresh-persistence.test.mjs";
import { runProjectPersistenceServiceTest } from "./project-persistence-service.test.mjs";
import { runProjectServiceStorageTest } from "./project-service-storage.test.mjs";
import { runProjectSourceTest } from "./project-source.test.mjs";
import { runProjectSourceServiceTest } from "./project-source-service.test.mjs";
import { runRealtimeSpeechServiceTest } from "./realtime-speech-service.test.mjs";
import { runRealtimeSpeechBridgeTest } from "./realtime-speech-bridge.test.mjs";
import { runRuntimePortabilityGuardrailsTest } from "./runtime-portability-guardrails.test.mjs";
import { runSceneEditorTest } from "./scene-editor.test.mjs";
import { runSceneWorldSpineMetadataTest } from "./scene-world-spine-metadata.test.mjs";
import { runScrivenerImportServiceTest } from "./scrivener-import-service.test.mjs";
import { runRevisionWindowTest } from "./revision-panel.test.mjs";
import { runRevisionStorageTest } from "./revision-storage.test.mjs";
import { runSpotifyMusicServiceTest } from "./spotify-music-service.test.mjs";
import { runSpellcheckContextControllerTest } from "./spellcheck-context-controller.test.mjs";
import { runSpellcheckContextMenuTest } from "./spellcheck-context-menu.test.mjs";
import { runSpellcheckProjectSettingsTest } from "./spellcheck-project-settings.test.mjs";
import { runSpellcheckRefreshControllerTest } from "./spellcheck-refresh-controller.test.mjs";
import { runSpellcheckTest } from "./spellcheck.test.mjs";
import { runTaskContextMenuTest } from "./task-context-menu.test.mjs";
import { runTaskPanelTest } from "./task-panel.test.mjs";
import { runTestHarnessRegistrationTest } from "./test-harness-registration.test.mjs";
import { runTopPanelCustomizationTest } from "./top-panel-customization.test.mjs";
import { runUserHighlightCommandServiceTest } from "./user-highlight-command-service.test.mjs";
import { runVoiceNarrationFoundationTest } from "./voice-narration-foundation.test.mjs";
import { runVoiceRecordingActionServiceTest } from "./voice-recording-action-service.test.mjs";
import { runVoiceRecordingPreviewServiceTest } from "./voice-recording-preview-service.test.mjs";
import { runVoiceRecordingServiceTest } from "./voice-recording-service.test.mjs";
import { runVoiceRecordingWaveformServiceTest } from "./voice-recording-waveform-service.test.mjs";
import { runVoiceServiceTest } from "./voice-service.test.mjs";
import { runVoiceWorkflowServiceTest } from "./voice-workflow-service.test.mjs";
import { runWritingGoalsStateServiceTest } from "./writing-goals-state-service.test.mjs";
import { runWorldSchemaTest } from "./world-schema.test.mjs";
import { runWorldbuildingStudioTest } from "./worldbuilding-studio.test.mjs";
import { runWorldSpineCatalogueAssignmentServiceTest } from "./world-spine-catalogue-assignment-service.test.mjs";
import { runWorldSpineEventSceneServiceTest } from "./world-spine-event-scene-service.test.mjs";
import { runWorldSpineEventTagServiceTest } from "./world-spine-event-tag-service.test.mjs";
import { runWorldSpineHistoryServiceTest } from "./world-spine-history-service.test.mjs";
import { runWorldSpineImplicationServiceTest } from "./world-spine-implication-service.test.mjs";
import { runWorldSpineLayoutServiceTest } from "./world-spine-layout-service.test.mjs";
import { runWorldSpineLocationFilterServiceTest } from "./world-spine-location-filter-service.test.mjs";
import { runWorldSpinePanelTest } from "./world-spine-panel.test.mjs";

const tests = [
  {
    name: "anchored record controller plans task and note creation outside the shell",
    run: runAnchoredRecordControllerTest,
  },
  {
    name: "anchored record navigation derives projections without owning browser effects",
    run: runAnchoredRecordNavigationControllerTest,
  },
  {
    name: "anchored record service owns task and note persistence mutations",
    run: runAnchoredRecordServiceTest,
  },
  {
    name: "analysis service returns anchored issue and event suggestions",
    run: runAnalysisServiceTest,
  },
  {
    name: "application source files parse before feature regression tests run",
    run: runApplicationSyntaxSmokeTest,
  },
  {
    name: "audiobook schema migrates legacy narration takes into explicit sections and clips",
    run: runAudiobookSchemaTest,
  },
  {
    name: "audio service tracks narration sessions and alignment jobs",
    run: runAudioServiceTest,
  },
  {
    name: "custom metadata definitions normalize console tags",
    run: runCustomMetadataServiceTest,
  },
  {
    name: "desktop application exposes a composed workspace and HTTP responses",
    run: runDesktopApplicationTest,
  },
  {
    name: "developer logger keeps service source gates off by default",
    run: runDeveloperLoggerTest,
  },
  {
    name: "delete confirmation dialog renders outside the shell",
    run: runDeleteConfirmationDialogTest,
  },
  {
    name: "dictionary context controller derives lookup requests outside the shell",
    run: runDictionaryContextControllerTest,
  },
  {
    name: "dictionary lexicon service loads local English definitions",
    run: runDictionaryLexiconServiceTest,
  },
  {
    name: "dictionary window renders lookup state outside the shell",
    run: runDictionaryWindowTest,
  },
  {
    name: "dictionary word service resolves pointer and cursor words",
    run: runDictionaryWordServiceTest,
  },
  {
    name: "draft proofing service tracks active proof-read coverage",
    run: runDraftProofingServiceTest,
  },
  {
    name: "draft proofing settings window renders project controls",
    run: runDraftProofingSettingsWindowTest,
  },
  {
    name: "draft proofing panel renders top-chrome controls",
    run: runDraftProofingPanelTest,
  },
  {
    name: "editor chrome scopes manuscript-only controls by pane",
    run: runEditorChromeTest,
  },
  {
    name: "editor storage keeps canonical and legacy key compatibility",
    run: runEditorStorageTest,
  },
  {
    name: "editor UI state keeps collapse transitions outside the shell",
    run: runEditorUiStateTest,
  },
  {
    name: "editor model builds editable scene drafts and normalizes preferences",
    run: runEditorModelTest,
  },
  {
    name: "grammar check panel renders from spellcheck view models outside the shell",
    run: runGrammarCheckPanelTest,
  },
  {
    name: "keyboard shortcut settings normalize user keymaps",
    run: runKeyboardShortcutSettingsTest,
  },
  {
    name: "local AI model library scans registered and loose local artifacts",
    run: runLocalAiModelLibraryTest,
  },
  {
    name: "local AI panel owns model-library settings markup and requests",
    run: runLocalAiPanelTest,
  },
  {
    name: "local AI title service owns editor title endpoint policy",
    run: runLocalAiTitleServiceTest,
  },
  {
    name: "local AI router maps tiers and handles unavailable providers",
    run: runLocalAiServiceTest,
  },
  {
    name: "local AI router preserves provider boundaries and tier contracts",
    run: runLocalAiRouterContractTest,
  },
  {
    name: "manuscript schema keeps project content addressable for issue and event workflows",
    run: runManuscriptSchemaTest,
  },
  {
    name: "manuscript command controller scopes inline formatting to selections and carets",
    run: runManuscriptCommandControllerTest,
  },
  {
    name: "manuscript editor host keeps textarea projection rendering behind an adapter",
    run: runManuscriptEditorHostTest,
  },
  {
    name: "manuscript find controller derives matches and replacement plans outside the shell",
    run: runManuscriptFindControllerTest,
  },
  {
    name: "manuscript input controller routes live text edits outside the shell",
    run: runManuscriptInputControllerTest,
  },
  {
    name: "manuscript layout service stores panel widths per workspace size",
    run: runManuscriptLayoutServiceTest,
  },
  {
    name: "manuscript mark history service owns decoration undo and redo stacks",
    run: runManuscriptMarkHistoryServiceTest,
  },
  {
    name: "manuscript mark service derives canonical marks from legacy ranges",
    run: runManuscriptMarkServiceTest,
  },
  {
    name: "manuscript anchor services prepare drift-safe decoration pipelines",
    run: runManuscriptAnchorServicesTest,
  },
  {
    name: "manuscript projection selector separates durable marks from runtime visuals",
    run: runManuscriptProjectionSelectorTest,
  },
  {
    name: "manuscript selection controller keeps selection policy outside the shell",
    run: runManuscriptSelectionControllerTest,
  },
  {
    name: "ManuScriptInfographicLane selector derives manuscript margin markers",
    run: runManuScriptInfographicLaneSelectorTest,
  },
  {
    name: "metadata folder service stores project notes with optional anchors",
    run: runMetadataSubgroupServiceTest,
  },
  {
    name: "milestone sound effects detect author progress thresholds",
    run: runMilestoneSoundEffectsServiceTest,
  },
  {
    name: "narration media service owns project media save and load calls",
    run: runNarrationMediaServiceTest,
  },
  {
    name: "narration metadata sync service keeps narration and voice records anchored",
    run: runNarrationMetadataSyncServiceTest,
  },
  {
    name: "narration media recorder service owns recorder event handling",
    run: runNarrationMediaRecorderServiceTest,
  },
  {
    name: "narration follow alignment service resolves live transcripts to manuscript spans",
    run: runNarrationFollowAlignmentServiceTest,
  },
  {
    name: "narration follow display service keeps current spans on confirmed speech",
    run: runNarrationFollowDisplayServiceTest,
  },
  {
    name: "narration follow settings service owns scroll preferences",
    run: runNarrationFollowSettingsServiceTest,
  },
  {
    name: "narration follow transcript window service bounds live ASR history",
    run: runNarrationFollowTranscriptWindowServiceTest,
  },
  {
    name: "narration follow viewport metrics service caches line and word scans",
    run: runNarrationFollowViewportMetricsServiceTest,
  },
  {
    name: "narration desktop speech tracker service streams local ASR frames",
    run: runNarrationDesktopSpeechTrackerServiceTest,
  },
  {
    name: "narration live audio frame service produces local PCM frames",
    run: runNarrationLiveAudioFrameServiceTest,
  },
  {
    name: "narration live speech tracker service selects provider fallbacks",
    run: runNarrationLiveSpeechTrackerServiceTest,
  },
  {
    name: "narration reading rate service converts word progress to scroll pace",
    run: runNarrationReadingRateServiceTest,
  },
  {
    name: "narration realtime speech client calls local desktop routes",
    run: runNarrationRealtimeSpeechClientTest,
  },
  {
    name: "narration recording alignment job service waits before project saves",
    run: runNarrationRecordingAlignmentJobServiceTest,
  },
  {
    name: "narration recording alignment service maps transcript words to speech-active audio",
    run: runNarrationRecordingAlignmentServiceTest,
  },
  {
    name: "narration recording review service maps saved transcripts to playback cursor models",
    run: runNarrationRecordingReviewServiceTest,
  },
  {
    name: "narration recording command service owns start and stop sequencing",
    run: runNarrationRecordingCommandServiceTest,
  },
  {
    name: "narration recording finalization service owns media save result mapping",
    run: runNarrationRecordingFinalizationServiceTest,
  },
  {
    name: "narration recording runtime service owns recorder cleanup",
    run: runNarrationRecordingRuntimeServiceTest,
  },
  {
    name: "narration selection service owns armed verse derivation",
    run: runNarrationSelectionServiceTest,
  },
  {
    name: "narration speech recognition service owns tracker event handling",
    run: runNarrationSpeechRecognitionServiceTest,
  },
  {
    name: "narration take service owns recorder DTOs and media naming",
    run: runNarrationTakeServiceTest,
  },
  {
    name: "narration visible range service maps viewport lines to offsets",
    run: runNarrationVisibleRangeServiceTest,
  },
  {
    name: "narration viewport tracker paces read-along scrolling",
    run: runNarrationViewportTrackerServiceTest,
  },
  {
    name: "passage note panel renders console items outside the shell",
    run: runPassageNotePanelTest,
  },
  {
    name: "project file storage adapters isolate save paths and autosave state",
    run: runProjectFileStorageAdaptersTest,
  },
  {
    name: "project activation controller coordinates activation effects outside the shell",
    run: runProjectActivationControllerTest,
  },
  {
    name: "project activation state hydrates loaded records outside the shell",
    run: runProjectActivationStateTest,
  },
  {
    name: "project library state isolates activation and seed merge policy",
    run: runProjectLibraryStateTest,
  },
  {
    name: "project record state isolates durable project record normalization",
    run: runProjectRecordStateTest,
  },
  {
    name: "project runtime record state assembles save snapshots outside the shell",
    run: runProjectRuntimeRecordStateTest,
  },
  {
    name: "progress tracker hides inactive session carryover",
    run: runProgressTrackerTest,
  },
  {
    name: "project refresh persistence keeps autosaved editor text after refresh",
    run: runProjectRefreshPersistenceTest,
  },
  {
    name: "project persistence service owns save, load, autosave, and restore flows",
    run: runProjectPersistenceServiceTest,
  },
  {
    name: "project service keeps browser storage portable behind repository boundaries",
    run: runProjectServiceStorageTest,
  },
  {
    name: "project source loader produces reportable project data and provenance",
    run: runProjectSourceTest,
  },
  {
    name: "project source service owns desktop source loading policy",
    run: runProjectSourceServiceTest,
  },
  {
    name: "realtime speech service selects local streaming providers and normalizes snapshots",
    run: runRealtimeSpeechServiceTest,
  },
  {
    name: "realtime speech bridge detects local sherpa and whisper assets",
    run: runRealtimeSpeechBridgeTest,
  },
  {
    name: "runtime portability guardrails keep browser-only APIs inside adapters",
    run: runRuntimePortabilityGuardrailsTest,
  },
  {
    name: "scene editor gates manuscript-only projections by mode",
    run: runSceneEditorTest,
  },
  {
    name: "scene World Spine metadata menu builds draft-safe form models",
    run: runSceneWorldSpineMetadataTest,
  },
  {
    name: "Scrivener import service ports binder text and metadata",
    run: runScrivenerImportServiceTest,
  },
  {
    name: "Spotify music service owns account auth, playlists, tempo, playback, queue, and panel markup",
    run: runSpotifyMusicServiceTest,
  },
  {
    name: "revision window banks reloadable writing sessions",
    run: runRevisionWindowTest,
  },
  {
    name: "revision storage normalizes empty, legacy, and aggregated revision state",
    run: runRevisionStorageTest,
  },
  {
    name: "spellcheck context controller derives menu records outside the shell",
    run: runSpellcheckContextControllerTest,
  },
  {
    name: "spellcheck context menu renders outside the shell",
    run: runSpellcheckContextMenuTest,
  },
  {
    name: "spellcheck project settings mutate dictionary lists outside the shell",
    run: runSpellcheckProjectSettingsTest,
  },
  {
    name: "spellcheck refresh controller owns debounce timer state",
    run: runSpellcheckRefreshControllerTest,
  },
  {
    name: "spellcheck utilities extract words and propose alternatives",
    run: runSpellcheckTest,
  },
  {
    name: "task context menu renders anchored task and note actions outside the shell",
    run: runTaskContextMenuTest,
  },
  {
    name: "task panel renders task console items outside the shell",
    run: runTaskPanelTest,
  },
  {
    name: "test harness registers every focused test file",
    run: runTestHarnessRegistrationTest,
  },
  {
    name: "top panel customization opens from card right-click surfaces",
    run: runTopPanelCustomizationTest,
  },
  {
    name: "user highlight command recovers toolbar click selections",
    run: runUserHighlightCommandServiceTest,
  },
  {
    name: "voice service creates speaker bindings and render jobs",
    run: runVoiceServiceTest,
  },
  {
    name: "voice narration foundation supports profiles, queue state, and placeholder rendering",
    run: runVoiceNarrationFoundationTest,
  },
  {
    name: "voice recording preview service owns audio URL lifecycle",
    run: runVoiceRecordingPreviewServiceTest,
  },
  {
    name: "voice recording action service owns preview and verse navigation plans",
    run: runVoiceRecordingActionServiceTest,
  },
  {
    name: "voice recording service owns saved recording collection mutation",
    run: runVoiceRecordingServiceTest,
  },
  {
    name: "voice recording waveform service derives transient oscillogram peaks",
    run: runVoiceRecordingWaveformServiceTest,
  },
  {
    name: "voice workflow service owns editor voice profiles and jobs",
    run: runVoiceWorkflowServiceTest,
  },
  {
    name: "writing goals daily baseline avoids conflating total manuscript words with daily target progress",
    run: runWritingGoalsStateServiceTest,
  },
  {
    name: "world schema instantiates typed entities and preserves introduction links",
    run: runWorldSchemaTest,
  },
  {
    name: "worldbuilding studio creates catalogue items and draggable timeline drafts",
    run: runWorldbuildingStudioTest,
  },
  {
    name: "world spine catalogue assignment service persists event presence links",
    run: runWorldSpineCatalogueAssignmentServiceTest,
  },
  {
    name: "world spine inserted events materialize manuscript scene drafts",
    run: runWorldSpineEventSceneServiceTest,
  },
  {
    name: "world spine event tag service creates anchored event pins",
    run: runWorldSpineEventTagServiceTest,
  },
  {
    name: "world spine history service restores graph and layout snapshots",
    run: runWorldSpineHistoryServiceTest,
  },
  {
    name: "world spine implication service persists reviewed edge effects",
    run: runWorldSpineImplicationServiceTest,
  },
  {
    name: "world spine layout service stores rail widths per workspace size",
    run: runWorldSpineLayoutServiceTest,
  },
  {
    name: "world spine location filter service derives render-only location visibility",
    run: runWorldSpineLocationFilterServiceTest,
  },
  {
    name: "world spine panel renders chronological scene nodes and explicit detail cards",
    run: runWorldSpinePanelTest,
  },
];

let failures = 0;

for (const testCase of tests) {
  try {
    await testCase.run();
    console.log(`ok - ${testCase.name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${testCase.name}`);
    console.error(error instanceof Error ? error.stack : error);
  }
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n${tests.length} test(s) passed.`);
}
