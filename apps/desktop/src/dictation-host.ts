import { selectFirstInstalledLive } from "../../../services/local-ai/speech-model-selection.ts";
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { pickDesktopDirectory } from "./directory-picker.ts";
import { planSpeechStorage } from "../../../services/local-ai/speech-storage-plan.ts";
// Host composition pins models and runtime commands; browser requests cannot supply executable code.
import { createSpeechModelStore } from "../../../services/local-ai/speech-model-store.ts";
import { createDictationEngine, probeDictationRuntime, probeDictationModel } from "../../../services/audio/src/dictation-engine.ts";
import { createDesktopSettingsSnapshot, updateDesktopSettingsSnapshot, setSpeechSettingsLock } from "./settings.ts";

const engine = createDictationEngine();
let starting = false, pendingPublication = false;
let cachedProbe: any = null, probeKey = "", probeTime = 0;
const locked = () => starting || engine.isActive() || pendingPublication;
setSpeechSettingsLock(patch => locked() || Boolean(patch.modelRoot && store?.isBusy()));
// Cache probes briefly and never reload an engine during capture; start always revalidates files.
async function readiness(models: ReturnType<typeof createSpeechModelStore>) {
  const settings = createDesktopSettingsSnapshot();
  const key = `${settings.modelRoot}/${settings.speech?.liveModelId}`;
  if (!cachedProbe || key !== probeKey || (!locked() && Date.now() - probeTime > 15000)) {
    probeKey = key; probeTime = Date.now();
    cachedProbe = (async () => {
      const runtime = await probeDictationRuntime(process.env.ABE_DICTATION_PYTHON || "python");
      let model = { ready: false, message: "Select an installed Live Dictation model." };
      if (settings.speech?.liveModelId && runtime.ready) {
        let lease;
        try {
          lease = await models.acquire(settings.speech.liveModelId);
          if (!lease.model.roles.includes("live")) throw new Error("Selected model is not compatible with Live Dictation.");
          model = await probeDictationModel(lease.path, process.env.ABE_DICTATION_PYTHON || "python");
        } catch (error) { model = { ready: false, message: (error as Error).message }; }
        finally { lease?.release(); }
      }
      return { runtime, model };
    })();
  }
  return cachedProbe;
}
let store: ReturnType<typeof createSpeechModelStore> | null = null;
let storeRoot = "";
let packageContext: { root: string; projectId: string } | null = null;
let stopped: any = null;
function getStore() {
  const root = process.env.ABE_DICTATION_TEST_MODEL_ROOT || createDesktopSettingsSnapshot().modelRoot;
  if (storeRoot !== root) {
    if (locked() || store?.isBusy()) throw new Error("Stop Dictation and model operations before changing the model root.");
    store = createSpeechModelStore({ modelRoot: root }); storeRoot = root;
  }
  return store!;
}
export const dictationHost = {
  isActive: locked,
  async handle(action: string, body: any, storage: { validatePackage: (root: string, projectId: string) => Promise<void>; publish: (root: string, result: any) => Promise<void> }) {
    const models = getStore();
    if (action === "dependency-plan") return { message: "Live STT uses Moonshine Tiny (MIT, 51,441,771 model bytes from the pinned Hugging Face catalogue), moonshine-voice 0.1.6 and a compatible FLAC encoder. Existing local runtimes are checked first. Model downloads require the separate Approve download action. Automatic runtime installation is not yet available: the complete Windows/Python/NumPy/native dependency and encoder distribution needs pinned hashes, license review and an isolated versioned install/rollback design. No executable is downloaded, no system Python is changed. Use Check models and runtime after an existing supported installation is repaired." };
    if (action === "open-folder") {
      if (!(await stat(storeRoot)).isDirectory()) throw new Error("The model-library folder does not exist yet.");
      if (process.platform !== "win32") throw new Error(`Open this folder in your file manager: ${storeRoot}`);
      await new Promise<void>((resolve, reject) => { const child = spawn("explorer.exe", [storeRoot], { windowsHide: true, stdio: "ignore" }); child.once("error", reject); child.once("spawn", () => { child.unref(); resolve(); }); });
      return {};
    }
    if (action === "storage-plan") {
      if (locked() || models.isBusy()) throw new Error("Stop capture and model operations before relocation planning.");
      const choice = await pickDesktopDirectory({ initialPath: storeRoot });
      if (choice.cancelled || !choice.path) return { message: "Relocation preview cancelled. Nothing changed." };
      return planSpeechStorage(storeRoot, choice.path);
    }
    if (action === "models") {
      const capability = await readiness(models);
      return { models: await models.snapshot(), ...capability, locked: locked(), modelRoot: storeRoot, settings: createDesktopSettingsSnapshot().speech ?? {} };
    }
    if (action === "acknowledge") {
      if (!stopped || stopped.record.id !== body.sessionId) throw new Error("Unknown saved session.");
      pendingPublication = false; return {};
    }
    if (["settings", "install", "retry", "remove", "storage-plan"].includes(action) && locked()) throw new Error("Stop and finalize recording before changing microphone or models.");
    if (action === "install" || action === "retry") {
      if (body.consent !== true) throw new Error("Review the download and explicitly approve installation.");
      const result = await models[action](body.modelId);
      // Only this successful install can auto-select; missing selections never silently fall back.
      void models.wait(body.modelId).then(async (progress) => {
        await selectFirstInstalledLive({ modelId: body.modelId, progress, models,
          isLocked: () => locked() || storeRoot !== createDesktopSettingsSnapshot().modelRoot,
          readSettings: () => createDesktopSettingsSnapshot().speech ?? {},
          writeSettings: (speech: any) => updateDesktopSettingsSnapshot({ speech }) });
        cachedProbe = null;
      }).catch(() => { cachedProbe = null; });
      return result;
    }
    if (action === "cancel") { await models.cancel(body.modelId); return {}; }
    if (action === "remove") {
      const settings = createDesktopSettingsSnapshot().speech;
      if (settings?.liveModelId === body.modelId || settings?.refinementModelId === body.modelId) throw new Error("Unassign the model before removal.");
      await models.remove(body.modelId); return {};
    }
    if (action === "settings") {
      if (engine.isActive()) throw new Error("Stop capture before changing Dictation settings.");
      const speech: NonNullable<ReturnType<typeof createDesktopSettingsSnapshot>["speech"]> = {};
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
      if (typeof body.setupComplete === "boolean") speech.setupComplete = body.setupComplete;
      if ([1, 2, 3].includes(body.setupStage)) speech.setupStage = body.setupStage;
      // Validation awaits may overlap another settings surface. Merge only this request's fields
      // into the latest machine snapshot; the common writer rechecks capture locking at commit.
      const updated = updateDesktopSettingsSnapshot({ speech: { ...createDesktopSettingsSnapshot().speech, ...speech } });
      cachedProbe = null; return { settings: updated.speech };
    }
    if (action === "start") {
      if (locked()) throw new Error("Dictation already active or awaiting verified save.");
      starting = true;
      try {
        if (!body.projectId || !body.sceneId) throw new Error("A saved project and scene are required.");
      await storage.validatePackage(body.activeProjectRoot, body.projectId);
      const capability = await probeDictationRuntime(process.env.ABE_DICTATION_PYTHON || "python");
      if (!capability.ready || !capability.recordingReady) throw new Error(capability.message || capability.recordingMessage || "Install the speech runtime and FLAC encoder before recording.");
      const id = createDesktopSettingsSnapshot().speech?.liveModelId;
      if (!id) throw new Error("Select a Live Dictation model first.");
      const lease = await models.acquire(id);
      if (!lease.model.roles.includes("live")) { lease.release(); throw new Error("Selected model is not a live recognizer."); }
      const result = await engine.start({ projectId: body.projectId, sceneId: body.sceneId, saveRecording: body.saveRecording === true, lease, python: process.env.ABE_DICTATION_PYTHON || "python" });
      packageContext = { root: body.activeProjectRoot, projectId: body.projectId }; stopped = null;
      return result;
      } finally { starting = false; }
    }
    if (action === "audio") return engine.audio(body);
    if (action === "stop") {
      if (!stopped || stopped.record.id !== body.sessionId) stopped = await engine.stop(body.sessionId, typeof body.errorMessage === "string" ? body.errorMessage.slice(0, 500) : "");
      pendingPublication = true;
      if (!packageContext || stopped.record.projectId !== packageContext.projectId) throw new Error("Lost original project authority.");
      // File publication may be retried; inference is never rerun and the original package remains authority.
      await storage.publish(packageContext.root, stopped);
      return { record: stopped.record, message: stopped.message };
    }
    throw new Error("Unknown Dictation operation.");
  },
};
