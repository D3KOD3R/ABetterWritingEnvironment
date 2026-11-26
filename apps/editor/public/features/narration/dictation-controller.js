import { createDictationInputs } from "../../adapters/dictation-inputs.js";
import { dictationReadiness } from "../../shared/dictation-readiness.js";
import { requestDictation } from "../../adapters/dictation-client.js";
import { startDictationCapture } from "../../adapters/dictation-capture.js";
import { renderDictationPanel, renderEvents, renderDictationModels, renderDictationSidebar, renderDictationSettings } from "./dictation-panel.js";

export function createDictationController({ state, persistence, mediaService, render, isFollowActive, request = requestDictation, beginCapture = startDictationCapture, inputFactory = createDictationInputs }) {
  const view = state.dictationView = { status: "Stopped", events: [], models: [], devices: [], deviceId: "", channel: 0, saveRecording: false, active: false, busy: false, sampleCount: 0, pending: null };
  let cancelStart = false, captureFailure = "", starting;
  let capture, session, tail = Promise.resolve(), queued = 0, stopping, originalRoot, poll, playbackUrl;
  const projectId = () => state.workspace?.project?.id;
  function readiness() { view.readiness = dictationReadiness(view, { saved: state.projectFileStorageMode === "desktop-package", scene: state.selectedSceneId, follow: isFollowActive() }); return view.readiness; }
  const inputs = inputFactory({ changed(input) {
    Object.assign(view, { devices: input.devices, permission: input.permission, inputError: input.error, channels: input.channels });
    if (view.active && (input.permission === "denied" || (view.deviceId && !input.devices.some(d => d.deviceId === view.deviceId)))) fail(new Error("Microphone disconnected or permission revoked."));
    panel();
  } });
  function panel() {
    readiness();
    for (const status of document.querySelectorAll("[data-dictation-status]")) status.textContent = view.status;
    const element = document.querySelector("[data-dictation-panel]");
    if (element) {
      // Runtime/model refresh must not destroy a playing recording or reset its playhead.
      const players = [...element.querySelectorAll("[data-dictation-playback] audio")].map((audio) => ({ id: audio.parentElement.dataset.dictationPlayback, audio }));
      element.outerHTML = renderDictationPanel(view, sessions());
      for (const { id, audio } of players) {
        const slot = document.querySelector(`[data-dictation-playback="${CSS.escape(id)}"]`);
        if (slot) slot.append(audio); else audio.pause();
      }
    }
    const sidebar = document.querySelector("[data-dictation-sidebar]");
    if (sidebar) sidebar.innerHTML = renderDictationSettings(view);
    const settings = document.querySelector('[data-dictation-settings="user"]');
    if (settings) settings.outerHTML = renderDictationSettings(view, "user");
  }
  function sessions() { return (state.workspace?.speech?.sessions || []).filter((x) => x.sceneId === state.selectedSceneId && x.projectId === projectId()).slice().reverse(); }
  function update() {
    for (const element of document.querySelectorAll("[data-dictation-status]")) element.textContent = view.status;
    const duration = document.querySelector("[data-dictation-duration]"); if (duration) duration.textContent = (view.sampleCount / 16000).toFixed(2);
    const partial = document.querySelector("[data-dictation-partial]"); if (partial) partial.textContent = view.events.filter((x) => x.status === "partial").map((x) => x.text).join(" ");
    const finals = document.querySelector("[data-dictation-finals]"); if (finals) finals.innerHTML = renderEvents(view.events);
  }
  async function refresh() {
    const signature = () => JSON.stringify([view.models, view.settings, view.model, view.runtime, view.locked, view.modelRoot, view.runtimeInstall, view.storageCopy]);
    const before = signature();
    const result = await request("models");
    Object.assign(view, { models: result.models, runtime: result.runtime, model: result.model, locked: result.locked, modelRoot: result.modelRoot, settings: result.settings, runtimeInstall: result.runtimeInstall, storageCopy: result.storageCopy });
    view.deviceId = result.settings.deviceId || ""; view.channel = result.settings.channel || 0;
    const details = document.querySelector("[data-dictation-models]");
    if (details) { const open = details.open; details.innerHTML = `<summary>Manage speech models</summary>${renderDictationModels(view)}`; details.open = open; }
    if (!view.active && before !== signature()) panel();
    clearTimeout(poll);
    if (state.narrationSubpanel === "stt" && state.activePane === "narration" || state.keyboardShortcutSettingsWindowOpen)
      poll = setTimeout(() => { if (!view.active && !view.busy && !view.settingBusy) refresh().catch(fail); else poll = setTimeout(() => refresh().catch(fail), 5000); }, 5000);
  }
  function fail(error) { captureFailure = String(error.message || error); view.status = `Failed: ${error.message || error}`; update(); if ((view.active || view.busy) && !stopping) void stop().catch((e) => { view.status = `Save failed: ${e.message}`; panel(); }); }
  async function devices() { return inputs.refresh(); }
  function start(test = false) {
    const operation = beginStart(test);
    starting = operation;
    return operation.finally(() => { if (starting === operation) starting = null; });
  }
  async function beginStart(test) {
    if (view.active || view.busy || view.locked || view.settingBusy || session || isFollowActive()) throw new Error("Stop the current microphone workflow first.");
    if (view.pending) throw new Error("Save the previous session before starting another.");
    if (!test && (state.activePane !== "narration" || state.narrationSubpanel !== "stt")) throw new Error("Open Narration STT first.");
    if (!test && state.projectFileStorageMode !== "desktop-package") throw new Error("Save this project as a folder package before recording.");
    if (!test && !readiness().ready) throw new Error(readiness().reasons.map(r => r.text).join(" "));
    view.testing = test;
    cancelStart = false; captureFailure = ""; view.busy = true; view.status = "Starting microphone…"; panel();
    originalRoot = state.projectFilePath; view.events = []; view.sampleCount = 0; tail = Promise.resolve(); queued = 0;
    try {
      if (!test) session = await request("start", { projectId: projectId(), sceneId: state.selectedSceneId, activeProjectRoot: originalRoot, saveRecording: view.saveRecording });
      capture = await beginCapture({ deviceId: view.deviceId, channel: view.channel,
        onLevel({ level, clipping }) { view.inputLevel = level; view.clipping = clipping; for (const meter of document.querySelectorAll("[data-dictation-level]")) meter.value = level; for (const label of document.querySelectorAll("[data-dictation-clipping]")) label.textContent = clipping ? " Clipping" : ""; },
        onFailure: fail,
        onFrame(frame) {
          if (test) return;
          if (queued >= 8) { fail(new Error("Recognition cannot keep up; capture stopped at the bounded queue limit.")); return; }
          const bytes = new Uint8Array(frame.pcm.buffer); let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
          queued++;
          tail = tail.then(async () => {
            const result = await request("audio", { ...frame, pcm: undefined, ...session, sampleRate: 16000, pcm16Base64: btoa(binary) });
            view.events = result.events; view.sampleCount = result.sampleCount; view.status = view.events.some((x) => x.status === "partial") ? "Speech active · local CPU" : "Listening · microphone active"; update();
          }).catch(fail).finally(() => { queued--; });
          if (frame.endSample >= 16000 * 239.5) void stop().catch(fail);
        },
      });
      await devices();
      view.permission = "granted"; if (test) view.inputTested = true;
      view.deviceInfo = capture.device; view.active = true; view.busy = false; if (cancelStart) return; view.status = test ? "Testing input · microphone active · no transcription" : "Listening · microphone active · local CPU"; panel();
    } catch (error) {
      await capture?.stop(); capture = null; view.active = false; view.busy = false;
      if (session) { try { await request("stop", { sessionId: session.sessionId }); await request("acknowledge", { sessionId: session.sessionId }); } catch {} session = null; }
      throw error;
    }
  }
  async function savePending() {
    if (!view.pending) return;
    const saved = await persistence.saveDictationSession(view.pending, originalRoot);
    await request("acknowledge", { sessionId: view.pending.id }); view.locked = false;
    view.pending = null; view.status = `${saved.status === "failed" ? "Saved incomplete recording" : "Saved and verified"}: ${(saved.sampleCount / 16000).toFixed(2)} s · ${saved.recording.bytes.toLocaleString()} bytes FLAC`; panel();
  }
  async function stop() {
    // Navigation and Follow must wait for a pending permission/runtime start to release capture.
    if (starting) { cancelStart = true; try { await starting; } catch {} }
    if (stopping) return stopping;
    if (!view.active && !view.busy && !session) return;
    stopping = (async () => {
      view.status = "Stopping and finalizing…"; view.busy = true; update();
      try {
        await capture?.stop(); capture = null; view.active = false;
        await tail;
        if (session) {
          const result = await request("stop", { sessionId: session.sessionId, errorMessage: captureFailure });
          view.pending = result.record; view.events = result.record.events; session = null;
          await savePending();
        } else view.status = captureFailure ? `Input test stopped: ${captureFailure}` : "Input test stopped.";
      } finally { view.testing = false; view.finalizationPending = Boolean(session); view.busy = false; stopping = null; panel(); }
    })();
    return stopping;
  }
  async function handle(action, target) {
    try {
      if (action === "dictation-authorize") {
        if (view.active || view.busy || view.locked) throw new Error("Stop capture before setting up an input.");
        await inputs.authorize(view.deviceId); panel();
      }
      else if (action === "dictation-setup") { view.setupOpen = true; state.activePane = "narration"; state.narrationSubpanel = "stt"; render(); await devices(); await refresh(); }
      else if (action === "dictation-setup-next" || action === "dictation-setup-back") {
        if (view.active || view.busy) throw new Error("Stop input testing first.");
        const stage = view.settings?.setupStage || 1;
        if (action.endsWith("next") && (stage === 1 ? !view.inputTested : !readiness().modelReady)) throw new Error("Complete this setup stage first.");
        await request("settings", { setupStage: Math.max(1, Math.min(3, stage + (action.endsWith("next") ? 1 : -1))) }); await refresh();
      }
      else if (action === "dictation-finish" || action === "dictation-start-setup") {
        if (view.active || view.busy || !readiness().modelReady || view.permission !== "granted") throw new Error("Verify model and microphone readiness, then stop testing before finishing setup.");
        if (action === "dictation-start-setup" && !readiness().ready) throw new Error(readiness().reasons.map(r => r.text).join(" "));
        await request("settings", { setupComplete: true, setupStage: 3 }); view.setupOpen = false; await refresh();
        if (action === "dictation-start-setup") await start();
      }
      else if (action === "dictation-dependencies") { view.dependencyPlan = await request("dependency-plan"); panel(); }
      else if (action === "dictation-runtime-install") {
        if (!view.dependencyPlan?.supported) throw new Error("Review the supported runtime before installing.");
        await request("runtime-install", { consent: true }); view.dependencyPlan = null; await refresh();
      }
      else if (action === "dictation-runtime-dismiss") { view.dependencyPlan = null; panel(); }
      else if (action === "dictation-runtime-cancel") { await request("runtime-cancel"); await refresh(); }
      else if (action === "dictation-storage-copy") {
        await request("storage-copy", { id: view.storageCopy?.id, consent: true }); await refresh();
      }
      else if (action === "dictation-storage-cancel") { await request("storage-cancel"); await refresh(); }
      else if (action === "dictation-open-folder") await request("open-folder");
      else if (action === "dictation-storage-plan") { view.storageCopy = await request("storage-plan"); panel(); }
      else if (action === "dictation-install") { view.consentModel = target.dataset.modelId; view.manageOpen = true; panel(); }
      else if (action === "dictation-dismiss-consent") { view.consentModel = null; panel(); }
      else if (action === "dictation-confirm-install") {
        if (view.consentModel !== target.dataset.modelId) throw new Error("Review this model's download first.");
        const modelId = view.consentModel; view.consentModel = null;
        await request(view.models.find(m => m.id === modelId)?.progress ? "retry" : "install", { modelId, consent: true }); await refresh();
      }
      else if (action === "dictation-stt") { await stop(); state.narrationSubpanel = "stt"; render(); await devices(); await refresh(); }
      else if (action === "dictation-follow") { await stop(); state.narrationSubpanel = "follow"; render(); }
      else if (action === "dictation-record") await start();
      else if (action === "dictation-test") await start(true);
      else if (action === "dictation-stop" || action === "dictation-stop-test") await stop();
      else if (action === "dictation-save") await savePending();
      else if (action === "dictation-devices") await devices();
      else if (action === "dictation-refresh") await refresh();
      else if (action === "dictation-copy") await navigator.clipboard.writeText(view.events.filter((x) => x.status === "final").map((x) => x.text).join(" "));
      else if (action === "dictation-play") {
        const record = sessions().find((x) => x.id === target.dataset.sessionId);
        const media = await mediaService.loadMediaBlob({ filePath: record.recording.projectRelativePath, mediaMimeType: "audio/flac" });
        if (playbackUrl) URL.revokeObjectURL(playbackUrl); playbackUrl = URL.createObjectURL(media.blob);
        const slot = document.querySelector(`[data-dictation-playback="${CSS.escape(record.id)}"]`);
        const audio = document.createElement("audio"); audio.controls = true; audio.src = playbackUrl; slot.replaceChildren(audio); await audio.play();
      } else {
        const modelId = target.dataset.modelId;
        if (action === "dictation-select") {
          if (view.settingBusy) throw new Error("Wait for the current configuration change.");
          view.settingBusy = true; view.model = { ready: false, message: "Loading and verifying selected model…" }; panel();
          try { await request("settings", { [`${target.dataset.role}ModelId`]: modelId }); await refresh(); }
          finally { view.settingBusy = false; panel(); }
        }
        else if (action === "dictation-unassign") await request("settings", Object.fromEntries(["liveModelId", "refinementModelId"].filter((key) => view.settings[key] === modelId).map((key) => [key, ""])));
        else await request(action.slice("dictation-".length) === "install" && view.models.find((m) => m.id === modelId)?.progress ? "retry" : action.slice("dictation-".length), { modelId });
        view.manageOpen = true; await refresh();
      }
    } catch (error) { view.status = `Failed: ${error.message}`; panel(); }
  }
  async function change(target) {
    if (view.active || view.busy || view.locked || view.pending || view.finalizationPending || view.settingBusy) { panel(); throw new Error("Stop and finalize capture before changing settings."); }
    const key = target.dataset.dictationInput;
    if (key === "saveRecording") { view.saveRecording = target.checked; return; }
    if (!["deviceId", "channel"].includes(key)) return;
    view.settingBusy = true;
    try {
      const value = key === "channel" ? Number(target.value) - 1 : target.value;
      await request("settings", { [key]: value });
      view.inputTested = false;
      if (key === "deviceId") { view.channels = null; inputs.state.channels = null; }
      await refresh();
    } finally { view.settingBusy = false; panel(); }
  }
  window.addEventListener("beforeunload", (event) => { if (view.active || view.busy || view.pending || session) { event.preventDefault(); event.returnValue = "Stop and save Dictation before closing."; } });
  return { handle, change, stop, stopTest: async () => { if (view.testing) await stop(); }, refresh: async () => { try { await devices(); await refresh(); } catch (error) { fail(error); } }, renderSettings: () => { readiness(); return renderDictationSettings(view, "user"); }, renderSidebar: () => { readiness(); return renderDictationSidebar(view); }, isActive: () => Boolean(view.active || view.busy || session), syncContext() { readiness(); if (view.testing && state.activePane !== "narration" && !state.keyboardShortcutSettingsWindowOpen) void stop().catch(fail); if (session && (projectId() !== session.projectId || state.selectedSceneId !== session.sceneId || state.activePane !== "narration" || state.narrationSubpanel !== "stt")) void stop().catch(fail); } };
}
