import { requestDictation } from "../../adapters/dictation-client.js";
import { startDictationCapture } from "../../adapters/dictation-capture.js";
import { renderDictationPanel, renderEvents, renderDictationModels, renderDictationSidebar } from "./dictation-panel.js";

export function createDictationController({ state, persistence, mediaService, render, isFollowActive, request = requestDictation, beginCapture = startDictationCapture }) {
  const view = state.dictationView = { status: "Stopped", events: [], models: [], devices: [], deviceId: "", channel: 0, saveRecording: false, active: false, busy: false, sampleCount: 0, pending: null };
  let cancelStart = false, captureFailure = "", starting;
  let capture, session, tail = Promise.resolve(), queued = 0, stopping, originalRoot, poll, playbackUrl;
  const projectId = () => state.workspace?.project?.id;
  function panel() {
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
  }
  function sessions() { return (state.workspace?.speech?.sessions || []).filter((x) => x.sceneId === state.selectedSceneId && x.projectId === projectId()).slice().reverse(); }
  function update() {
    for (const element of document.querySelectorAll("[data-dictation-status]")) element.textContent = view.status;
    const duration = document.querySelector("[data-dictation-duration]"); if (duration) duration.textContent = (view.sampleCount / 16000).toFixed(2);
    const partial = document.querySelector("[data-dictation-partial]"); if (partial) partial.textContent = view.events.filter((x) => x.status === "partial").map((x) => x.text).join(" ");
    const finals = document.querySelector("[data-dictation-finals]"); if (finals) finals.innerHTML = renderEvents(view.events);
  }
  async function refresh() {
    const result = await request("models");
    Object.assign(view, { models: result.models, runtime: result.runtime, settings: result.settings });
    view.deviceId = result.settings.deviceId || ""; view.channel = result.settings.channel || 0;
    const details = document.querySelector("[data-dictation-models]");
    if (details) { const open = details.open; details.innerHTML = `<summary>Manage speech models</summary>${renderDictationModels(view)}`; details.open = open; }
    if (!view.active) panel();
    clearTimeout(poll);
    if (view.models.some((m) => ["downloading", "verifying"].includes(m.progress?.state))) poll = setTimeout(() => { refresh().catch(fail); }, 1000);
  }
  function fail(error) { captureFailure = String(error.message || error); view.status = `Failed: ${error.message || error}`; update(); if ((view.active || view.busy) && !stopping) void stop().catch((e) => { view.status = `Save failed: ${e.message}`; panel(); }); }
  async function devices() { view.devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput").map((d) => ({ deviceId: d.deviceId, label: d.label })); panel(); }
  function start(test = false) {
    const operation = beginStart(test);
    starting = operation;
    return operation.finally(() => { if (starting === operation) starting = null; });
  }
  async function beginStart(test) {
    if (view.active || view.busy || session || isFollowActive()) throw new Error("Stop the current microphone workflow first.");
    if (view.pending) throw new Error("Save the previous session before starting another.");
    if (state.activePane !== "narration" || state.narrationSubpanel !== "stt") throw new Error("Open Narration STT first.");
    if (!test && state.projectFileStorageMode !== "desktop-package") throw new Error("Save this project as a folder package before recording.");
    cancelStart = false; captureFailure = ""; view.busy = true; view.status = "Starting microphone…"; panel();
    originalRoot = state.projectFilePath; view.events = []; view.sampleCount = 0; tail = Promise.resolve(); queued = 0;
    try {
      if (!test) session = await request("start", { projectId: projectId(), sceneId: state.selectedSceneId, activeProjectRoot: originalRoot, saveRecording: view.saveRecording });
      capture = await beginCapture({ deviceId: view.deviceId, channel: view.channel,
        onLevel({ level, clipping }) { view.inputLevel = level; view.clipping = clipping; const meter = document.querySelector("[data-dictation-level]"); if (meter) meter.value = level; const label = document.querySelector("[data-dictation-clipping]"); if (label) label.textContent = clipping ? " Clipping" : ""; },
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
      view.deviceInfo = capture.device; view.active = true; view.busy = false; if (cancelStart) return; view.status = test ? "Testing input · microphone active · no transcription" : "Listening · microphone active · local CPU"; panel();
    } catch (error) {
      await capture?.stop(); capture = null; view.active = false; view.busy = false;
      if (session) { try { await request("stop", { sessionId: session.sessionId }); } catch {} session = null; }
      throw error;
    }
  }
  async function savePending() {
    if (!view.pending) return;
    const saved = await persistence.saveDictationSession(view.pending, originalRoot);
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
        } else view.status = "Input test stopped.";
      } finally { view.finalizationPending = Boolean(session); view.busy = false; stopping = null; panel(); }
    })();
    return stopping;
  }
  async function handle(action, target) {
    try {
      if (action === "dictation-stt") { await stop(); state.narrationSubpanel = "stt"; render(); await devices(); await refresh(); }
      else if (action === "dictation-follow") { await stop(); state.narrationSubpanel = "follow"; render(); }
      else if (action === "dictation-record") await start();
      else if (action === "dictation-test") await start(true);
      else if (action === "dictation-stop") await stop();
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
        if (action === "dictation-select") await request("settings", { [`${target.dataset.role}ModelId`]: modelId });
        else if (action === "dictation-unassign") await request("settings", Object.fromEntries(["liveModelId", "refinementModelId"].filter((key) => view.settings[key] === modelId).map((key) => [key, ""])));
        else await request(action.slice("dictation-".length) === "install" && view.models.find((m) => m.id === modelId)?.progress ? "retry" : action.slice("dictation-".length), { modelId });
        view.manageOpen = true; await refresh();
      }
    } catch (error) { view.status = `Failed: ${error.message}`; panel(); }
  }
  async function change(target) {
    const key = target.dataset.dictationInput;
    if (key === "saveRecording") view.saveRecording = target.checked;
    else { view[key] = key === "channel" ? Number(target.value) - 1 : target.value; await request("settings", { [key]: view[key] }); }
  }
  window.addEventListener("beforeunload", (event) => { if (view.active || view.busy || view.pending || session) { event.preventDefault(); event.returnValue = "Stop and save Dictation before closing."; } });
  return { handle, change, stop, renderSidebar: () => renderDictationSidebar(view), isActive: () => Boolean(view.active || view.busy || session), syncContext() { if (session && (projectId() !== session.projectId || state.selectedSceneId !== session.sceneId || state.activePane !== "narration" || state.narrationSubpanel !== "stt")) void stop().catch(fail); } };
}
