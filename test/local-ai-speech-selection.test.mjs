import assert from "node:assert/strict";
import { selectFirstInstalledLive } from "../services/local-ai/speech-model-selection.ts";
export async function runLocalAiSpeechSelectionTest() {
  let settings = { liveModelId: "", refinementModelId: "refine" }, writes = 0;
  const options = { progress: { state: "installed" }, models: { snapshot: async () => [
    { id: "first", installed: true, roles: ["live"] }, { id: "second", installed: true, roles: ["live"] }, { id: "refine", installed: true, roles: ["refinement"] }] },
    readSettings: () => settings, writeSettings: value => { settings = value; writes++; }, isLocked: () => false };
  await selectFirstInstalledLive({ ...options, modelId: "refine" }); assert.equal(writes, 0);
  await Promise.all([selectFirstInstalledLive({ ...options, modelId: "first" }), selectFirstInstalledLive({ ...options, modelId: "second" })]);
  assert.equal(writes, 1); assert.equal(settings.liveModelId, "first"); assert.equal(settings.refinementModelId, "refine");
  settings.liveModelId = "missing-author-choice";
  await selectFirstInstalledLive({ ...options, modelId: "second" }); assert.equal(settings.liveModelId, "missing-author-choice");
  settings.liveModelId = "";
  await selectFirstInstalledLive({ ...options, modelId: "second", isLocked: () => true });
  await selectFirstInstalledLive({ ...options, modelId: "second", progress: { state: "failed" } });
  assert.equal(writes, 1);
}
