// Intent: run the repository's focused contract tests as one lightweight Node test harness.
import { runAnalysisServiceTest } from "./analysis-service.test.mjs";
import { runAnchoredRecordNavigationControllerTest } from "./anchored-record-navigation-controller.test.mjs";
import { runAudioServiceTest } from "./audio-service.test.mjs";
import { runDesktopApplicationTest } from "./desktop-application.test.mjs";
import { runDeveloperLoggerTest } from "./developer-logger.test.mjs";
import { runEditorStorageTest } from "./editor-storage.test.mjs";
import { runEditorModelTest } from "./editor-model.test.mjs";
import { runLocalAiRouterContractTest } from "./local-ai-router.test.mjs";
import { runLocalAiServiceTest } from "./local-ai-service.test.mjs";
import { runManuscriptSchemaTest } from "./manuscript-schema.test.mjs";
import { runManuscriptCommandControllerTest } from "./manuscript-command-controller.test.mjs";
import { runManuscriptEditorHostTest } from "./manuscript-editor-host.test.mjs";
import { runManuscriptFindControllerTest } from "./manuscript-find-controller.test.mjs";
import { runManuscriptInputControllerTest } from "./manuscript-input-controller.test.mjs";
import { runManuscriptProjectionSelectorTest } from "./manuscript-projection-selector.test.mjs";
import { runManuscriptSelectionControllerTest } from "./manuscript-selection-controller.test.mjs";
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
import { runRuntimePortabilityGuardrailsTest } from "./runtime-portability-guardrails.test.mjs";
import { runRevisionWindowTest } from "./revision-panel.test.mjs";
import { runRevisionStorageTest } from "./revision-storage.test.mjs";
import { runSpellcheckTest } from "./spellcheck.test.mjs";
import { runVoiceNarrationFoundationTest } from "./voice-narration-foundation.test.mjs";
import { runVoiceServiceTest } from "./voice-service.test.mjs";
import { runWritingGoalsStateServiceTest } from "./writing-goals-state-service.test.mjs";
import { runWorldSchemaTest } from "./world-schema.test.mjs";

const tests = [
  {
    name: "anchored record navigation derives projections without owning browser effects",
    run: runAnchoredRecordNavigationControllerTest,
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
    name: "editor storage keeps canonical and legacy key compatibility",
    run: runEditorStorageTest,
  },
  {
    name: "editor model builds editable scene drafts and normalizes preferences",
    run: runEditorModelTest,
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
    name: "spellcheck utilities extract words and propose alternatives",
    run: runSpellcheckTest,
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
