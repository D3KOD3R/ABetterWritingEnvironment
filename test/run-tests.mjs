// Intent: run the repository's focused contract tests as one lightweight Node test harness.
import { runAnalysisServiceTest } from "./analysis-service.test.mjs";
import { runAnchoredRecordControllerTest } from "./anchored-record-controller.test.mjs";
import { runAnchoredRecordNavigationControllerTest } from "./anchored-record-navigation-controller.test.mjs";
import { runAnchoredRecordServiceTest } from "./anchored-record-service.test.mjs";
import { runAudioServiceTest } from "./audio-service.test.mjs";
import { runDesktopApplicationTest } from "./desktop-application.test.mjs";
import { runDeveloperLoggerTest } from "./developer-logger.test.mjs";
import { runDeleteConfirmationDialogTest } from "./delete-confirmation-dialog.test.mjs";
import { runEditorStorageTest } from "./editor-storage.test.mjs";
import { runEditorUiStateTest } from "./editor-ui-state.test.mjs";
import { runEditorModelTest } from "./editor-model.test.mjs";
import { runGrammarCheckPanelTest } from "./grammar-check-panel.test.mjs";
import { runLocalAiTitleServiceTest } from "./local-ai-title-service.test.mjs";
import { runLocalAiRouterContractTest } from "./local-ai-router.test.mjs";
import { runLocalAiServiceTest } from "./local-ai-service.test.mjs";
import { runManuscriptSchemaTest } from "./manuscript-schema.test.mjs";
import { runManuscriptCommandControllerTest } from "./manuscript-command-controller.test.mjs";
import { runManuscriptEditorHostTest } from "./manuscript-editor-host.test.mjs";
import { runManuscriptFindControllerTest } from "./manuscript-find-controller.test.mjs";
import { runManuscriptInputControllerTest } from "./manuscript-input-controller.test.mjs";
import { runManuscriptProjectionSelectorTest } from "./manuscript-projection-selector.test.mjs";
import { runManuscriptSelectionControllerTest } from "./manuscript-selection-controller.test.mjs";
import { runNarrationMediaServiceTest } from "./narration-media-service.test.mjs";
import { runNarrationMetadataSyncServiceTest } from "./narration-metadata-sync-service.test.mjs";
import { runNarrationMediaRecorderServiceTest } from "./narration-media-recorder-service.test.mjs";
import { runNarrationRecordingCommandServiceTest } from "./narration-recording-command-service.test.mjs";
import { runNarrationRecordingFinalizationServiceTest } from "./narration-recording-finalization-service.test.mjs";
import { runNarrationRecordingRuntimeServiceTest } from "./narration-recording-runtime-service.test.mjs";
import { runNarrationSelectionServiceTest } from "./narration-selection-service.test.mjs";
import { runNarrationSpeechRecognitionServiceTest } from "./narration-speech-recognition-service.test.mjs";
import { runNarrationTakeServiceTest } from "./narration-take-service.test.mjs";
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
import { runRuntimePortabilityGuardrailsTest } from "./runtime-portability-guardrails.test.mjs";
import { runRevisionWindowTest } from "./revision-panel.test.mjs";
import { runRevisionStorageTest } from "./revision-storage.test.mjs";
import { runSpellcheckContextControllerTest } from "./spellcheck-context-controller.test.mjs";
import { runSpellcheckContextMenuTest } from "./spellcheck-context-menu.test.mjs";
import { runSpellcheckProjectSettingsTest } from "./spellcheck-project-settings.test.mjs";
import { runSpellcheckRefreshControllerTest } from "./spellcheck-refresh-controller.test.mjs";
import { runSpellcheckTest } from "./spellcheck.test.mjs";
import { runTaskContextMenuTest } from "./task-context-menu.test.mjs";
import { runTaskPanelTest } from "./task-panel.test.mjs";
import { runVoiceNarrationFoundationTest } from "./voice-narration-foundation.test.mjs";
import { runVoiceRecordingActionServiceTest } from "./voice-recording-action-service.test.mjs";
import { runVoiceRecordingPreviewServiceTest } from "./voice-recording-preview-service.test.mjs";
import { runVoiceRecordingServiceTest } from "./voice-recording-service.test.mjs";
import { runVoiceServiceTest } from "./voice-service.test.mjs";
import { runVoiceWorkflowServiceTest } from "./voice-workflow-service.test.mjs";
import { runWritingGoalsStateServiceTest } from "./writing-goals-state-service.test.mjs";
import { runWorldSchemaTest } from "./world-schema.test.mjs";

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
    name: "audio service tracks narration sessions and alignment jobs",
    run: runAudioServiceTest,
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
    name: "manuscript projection selector separates durable marks from runtime visuals",
    run: runManuscriptProjectionSelectorTest,
  },
  {
    name: "manuscript selection controller keeps selection policy outside the shell",
    run: runManuscriptSelectionControllerTest,
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
    name: "runtime portability guardrails keep browser-only APIs inside adapters",
    run: runRuntimePortabilityGuardrailsTest,
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
