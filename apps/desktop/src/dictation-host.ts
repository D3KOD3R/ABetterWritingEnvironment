// Host composition pins models and runtime commands; browser requests cannot supply executable code.
import { createSpeechModelStore } from "../../../services/local-ai/speech-model-store.ts";
import { createDictationEngine, probeDictationRuntime } from "../../../services/audio/src/dictation-engine.ts";
import { createDesktopSettingsSnapshot, updateDesktopSettingsSnapshot } from "./settings.ts";

const engine = createDictationEngine();
let store: ReturnType<typeof createSpeechModelStore> | null = null;
let storeRoot = "";
let packageContext: { root: string; projectId: string } | null = null;
let stopped: any = null;
function getStore() {
  const root = process.env.ABE_DICTATION_TEST_MODEL_ROOT || createDesktopSettingsSnapshot().modelRoot;
  if (storeRoot !== root) {
    if (engine.isActive()) throw new Error("Stop Dictation before changing the model root.");
    store = createSpeechModelStore({ modelRoot: root }); storeRoot = root;
  }
  return store!;
}
export const dictationHost = {
  isActive: () => engine.isActive(),
  async handle(action: string, body: any, storage: { validatePackage: (root: string, projectId: string) => Promise<void>; publish: (root: string, result: any) => Promise<void> }) {
    const models = getStore();
    if (action === "models") return { models: await models.snapshot(), runtime: await probeDictationRuntime(process.env.ABE_DICTATION_PYTHON || "python"), settings: createDesktopSettingsSnapshot().speech ?? {} };
    if (action === "install") return models.install(body.modelId);
    if (action === "retry") return models.retry(body.modelId);
    if (action === "cancel") { await models.cancel(body.modelId); return {}; }
    if (action === "remove") {
      const settings = createDesktopSettingsSnapshot().speech;
      if (settings?.liveModelId === body.modelId || settings?.refinementModelId === body.modelId) throw new Error("Unassign the model before removal.");
      await models.remove(body.modelId); return {};
    }
    if (action === "settings") {
      if (engine.isActive()) throw new Error("Stop capture before changing Dictation settings.");
      const speech = { ...createDesktopSettingsSnapshot().speech };
      for (const role of ["live", "refinement"] as const) {
        const key = `${role}ModelId` as const;
        if (!(key in body)) continue;
        if (body[key]) {
          const installed = await models.snapshot();
          if (!installed.some((model) => model.id === body[key] && model.installed && model.roles.includes(role))) throw new Error("Select an installed compatible model.");
        }
        speech[key] = String(body[key] || "");
      }
      if (typeof body.deviceId === "string") speech.deviceId = body.deviceId.slice(0, 512);
      if (Number.isInteger(body.channel) && body.channel >= 0 && body.channel < 32) speech.channel = body.channel;
      updateDesktopSettingsSnapshot({ speech }); return { settings: speech };
    }
    if (action === "start") {
      if (engine.isActive()) throw new Error("Dictation already active.");
      if (!body.projectId || !body.sceneId) throw new Error("A saved project and scene are required.");
      await storage.validatePackage(body.activeProjectRoot, body.projectId);
      const capability = await probeDictationRuntime(process.env.ABE_DICTATION_PYTHON || "python");
      if (!capability.ready || !capability.recordingReady) throw new Error(capability.message || capability.recordingMessage || "Install the speech runtime and FLAC encoder before recording.");
      const id = createDesktopSettingsSnapshot().speech?.liveModelId || "moonshine_tiny_streaming_en";
      const lease = await models.acquire(id);
      if (!lease.model.roles.includes("live")) { lease.release(); throw new Error("Selected model is not a live recognizer."); }
      const result = await engine.start({ projectId: body.projectId, sceneId: body.sceneId, saveRecording: body.saveRecording === true, lease, python: process.env.ABE_DICTATION_PYTHON || "python" });
      packageContext = { root: body.activeProjectRoot, projectId: body.projectId }; stopped = null;
      return result;
    }
    if (action === "audio") return engine.audio(body);
    if (action === "stop") {
      if (!stopped || stopped.record.id !== body.sessionId) stopped = await engine.stop(body.sessionId, typeof body.errorMessage === "string" ? body.errorMessage.slice(0, 500) : "");
      if (!packageContext || stopped.record.projectId !== packageContext.projectId) throw new Error("Lost original project authority.");
      // File publication may be retried; inference is never rerun and the original package remains authority.
      await storage.publish(packageContext.root, stopped);
      return { record: stopped.record, message: stopped.message };
    }
    throw new Error("Unknown Dictation operation.");
  },
};
