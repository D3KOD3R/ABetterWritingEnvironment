// Intent: run the repository's focused contract tests as one lightweight Node test harness.
import { runAnalysisServiceTest } from "./analysis-service.test.mjs";
import { runAudioServiceTest } from "./audio-service.test.mjs";
import { runDesktopApplicationTest } from "./desktop-application.test.mjs";
import { runEditorModelTest } from "./editor-model.test.mjs";
import { runLocalAiRouterContractTest } from "./local-ai-router.test.mjs";
import { runLocalAiServiceTest } from "./local-ai-service.test.mjs";
import { runManuscriptSchemaTest } from "./manuscript-schema.test.mjs";
import { runProjectFileStorageAdaptersTest } from "./project-file-storage-adapters.test.mjs";
import { runProjectSourceTest } from "./project-source.test.mjs";
import { runSpellcheckTest } from "./spellcheck.test.mjs";
import { runVoiceNarrationFoundationTest } from "./voice-narration-foundation.test.mjs";
import { runVoiceServiceTest } from "./voice-service.test.mjs";
import { runWorldSchemaTest } from "./world-schema.test.mjs";

const tests = [
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
    name: "project file storage adapters isolate save paths and autosave state",
    run: runProjectFileStorageAdaptersTest,
  },
  {
    name: "project source loader produces reportable project data and provenance",
    run: runProjectSourceTest,
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
