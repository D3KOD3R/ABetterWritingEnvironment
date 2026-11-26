import { selectFirstInstalledLive } from "../../../services/local-ai/speech-model-selection.ts";
import { spawn } from "node:child_process";
import { stat, realpath } from "node:fs/promises";
import { pickDesktopDirectory } from "./directory-picker.ts";
import { fileURLToPath } from "node:url";
import { createSpeechStorageCopy } from "../../../services/local-ai/speech-storage-copy.ts";
import { createSpeechRuntimeStore } from "../../../services/local-ai/speech-runtime-store.ts";
// Host composition pins models and runtime commands; browser requests cannot supply executable code.
import { createSpeechModelStore } from "../../../services/local-ai/speech-model-store.ts";
import { createDictationEngine, probeDictationRuntime, probeDictationModel } from "../../../services/audio/src/dictation-engine.ts";
import { createDesktopSettingsSnapshot, updateDesktopSettingsSnapshot, setSpeechSettingsLock } from "./settings.ts";

const engine = createDictationEngine();
const relocation = createSpeechStorageCopy();
const runtimes = createSpeechRuntimeStore({
  root: process.env.ABE_DICTATION_RUNTIME_ROOT || fileURLToPath(new URL("../.speech-runtime", import.meta.url)),
  probe: python => probeDictationRuntime(python, true),
});
async function runtimeChoice() {
  if (process.env.ABE_DICTATION_PYTHON) return { python: process.env.ABE_DICTATION_PYTHON, privateCodec: false };
  const python = await runtimes.selected();
  return { python: python || "python", privateCodec: Boolean(python) };
}
let starting = false, pendingPublication = false;
let cachedProbe: any = null, probeKey = "", probeTime = 0;
const locked = () => starting || engine.isActive() || pendingPublication || runtimes.isBusy() || relocation.isBusy();
setSpeechSettingsLock(patch => locked() || Boolean(patch.modelRoot && store?.isBusy()));
// Cache probes briefly and never reload an engine during capture; start always revalidates files.
async function readiness(models: ReturnType<typeof createSpeechModelStore>) {
  if (runtimes.isBusy() || relocation.isBusy()) return { runtime: { ready: false, message: "Wait for the setup operation to finish." }, model: { ready: false, message: "Model checks resume after setup." } };
  const settings = createDesktopSettingsSnapshot();
  const key = `${settings.modelRoot}/${settings.speech?.liveModelId}`;
  if (!cachedProbe || key !== probeKey || (!locked() && Date.now() - probeTime > 15000)) {
    probeKey = key; probeTime = Date.now();
    cachedProbe = (async () => {
      let choice;
      try { choice = await runtimeChoice(); }
      catch (error) { return { runtime: { ready: false, message: (error as Error).message }, model: { ready: false } }; }
      const runtime = await probeDictationRuntime(choice.python, choice.privateCodec);
      let model = { ready: false, message: "Select an installed Live Dictation model." };
      if (settings.speech?.liveModelId && runtime.ready) {
        let lease;
        try {
          lease = await models.acquire(settings.speech.liveModelId);
          if (!lease.model.roles.includes("live")) throw new Error("Selected model is not compatible with Live Dictation.");
          model = await probeDictationModel(lease.path, choice.python);
        } catch (error) { model = { ready: false, message: (error as Error).message }; }
        finally { lease?.release(); }
      }
      return { runtime: { ...runtime, source: choice.privateCodec ? "ABE-managed private runtime" : "Existing local runtime" }, model };
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
    if (action === "dependency-plan") return runtimes.plan();
    if (action === "runtime-cancel") { const result = await runtimes.cancel(); cachedProbe = null; return result; }
    if (action === "storage-cancel") { const result = await relocation.cancel(); cachedProbe = null; return result; }
    if (action === "runtime-install") {
      if (locked() || models.isBusy()) throw new Error("Stop capture and wait for model operations before runtime installation.");
      const result = await runtimes.install(body.consent);
      void runtimes.wait().then(() => { cachedProbe = null; });
      return result;
    }
    if (action === "storage-copy") {
      if (locked() || models.isBusy()) throw new Error("Stop capture and wait for model operations before copying.");
      if (await realpath(storeRoot) !== relocation.snapshot()?.source) throw new Error("Storage location changed. Choose and review a fresh preview.");
      // Recheck after filesystem awaits so recording/root changes cannot slip into the copy lock.
      if (locked() || models.isBusy() || storeRoot !== (process.env.ABE_DICTATION_TEST_MODEL_ROOT || createDesktopSettingsSnapshot().modelRoot)) throw new Error("Configuration changed. Stop operations and review relocation again.");
      const result = await relocation.start(body.id, body.consent);
      void relocation.wait().then(() => { cachedProbe = null; });
      return result;
    }
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
      return relocation.plan(storeRoot, choice.path);
    }
    if (action === "models") {
      const capability = await readiness(models);
      return { models: await models.snapshot(), ...capability, locked: locked(), modelRoot: storeRoot, settings: createDesktopSettingsSnapshot().speech ?? {}, runtimeInstall: runtimes.snapshot(), storageCopy: relocation.snapshot() };
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
      const choice = await runtimeChoice();
      const capability = await probeDictationRuntime(choice.python, choice.privateCodec);
      if (!capability.ready || !capability.recordingReady) throw new Error(capability.message || capability.recordingMessage || "Install the speech runtime and FLAC encoder before recording.");
      const id = createDesktopSettingsSnapshot().speech?.liveModelId;
      if (!id) throw new Error("Select a Live Dictation model first.");
      const lease = await models.acquire(id);
      if (!lease.model.roles.includes("live")) { lease.release(); throw new Error("Selected model is not a live recognizer."); }
      const result = await engine.start({ projectId: body.projectId, sceneId: body.sceneId, saveRecording: body.saveRecording === true, lease, ...choice });
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
