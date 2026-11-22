import { escapeHtml as e } from "../../shared/ui-utils.js";

export function renderNarrationSubpanels(state) {
  return `<nav aria-label="Narration workflow" class="dictation-tabs"><button data-action="dictation-follow" aria-pressed="${state.narrationSubpanel !== "stt"}">Narration Follow</button><button data-action="dictation-stt" aria-pressed="${state.narrationSubpanel === "stt"}">STT · Dictation</button></nav>`;
}
export function renderDictationPanel(view = {}, sessions = []) {
  const busy = view.active || view.busy;
  return `<section data-dictation-panel class="dictation-panel" aria-label="Local Dictation">
    <h3>Local Dictation <small>Transcript preview</small></h3>
    <p>Final speech stays in this transcript. Automatic manuscript insertion awaits shared history and persistence verification.</p>
    <p data-dictation-status role="status">${e(view.status || "Stopped. Select an installed model and test your microphone.")}</p>
    <p>Live STT: ${e(view.models?.find((model) => model.id === (view.settings?.liveModelId || "moonshine_tiny_streaming_en"))?.displayName || "Moonshine Tiny")} · ${view.runtime?.ready ? "CPU runtime ready" : "runtime unavailable"} · utterance timing; word timing unavailable.</p>
    <div class="dictation-controls">
      <label>Microphone <select data-dictation-input="deviceId" ${busy ? "disabled" : ""}><option value="">System default</option>${(view.devices || []).map((d) => `<option value="${e(d.deviceId)}" ${view.deviceId === d.deviceId ? "selected" : ""}>${e(d.label || "Microphone (permission required)")}</option>`).join("")}</select></label>
      <label>Input channel <input data-dictation-input="channel" type="number" min="1" max="32" value="${(view.channel || 0) + 1}" ${busy ? "disabled" : ""}></label>
      <button data-action="dictation-devices" ${busy ? "disabled" : ""}>Refresh inputs</button>
      <button data-action="dictation-test" ${busy ? "disabled" : ""}>Test input</button>
      <label>Level <meter data-dictation-level min="0" max="1" value="0"></meter><span data-dictation-clipping></span></label>
    </div>
    <div class="dictation-controls">
      <label><input type="checkbox" data-dictation-input="saveRecording" ${view.saveRecording ? "checked" : ""} ${busy ? "disabled" : ""}> Save Recording until manual deletion</label>
      <button data-action="dictation-record" ${busy || !view.runtime?.ready || !view.runtime?.recordingReady || !view.models?.some((m) => m.roles.includes("live") && m.installed) ? "disabled" : ""}>Record</button>
      <button data-action="dictation-stop" ${!busy && !view.finalizationPending ? "disabled" : ""}>${view.finalizationPending ? "Retry finalization" : "Stop"}</button>
      <button data-action="dictation-copy">Copy finalized transcript</button>
      ${view.pending ? '<button data-action="dictation-save">Retry session save</button>' : ""}
    </div>
    <p><span data-dictation-duration>${(Number(view.sampleCount || 0) / 16000).toFixed(2)}</span> seconds · mono 16 kHz PCM16 → FLAC · checkpoint limit: 4 minutes.</p>
    <p>Without Save Recording, audio remains protected pending durable manuscript insertion. Automatic cleanup is not enabled in this preview checkpoint.</p>
    <p data-dictation-partial class="dictation-partial" aria-label="Provisional transcription">${e((view.events || []).filter((x) => x.status === "partial").map((x) => x.text).join(" "))}</p>
    <div data-dictation-finals>${renderEvents(view.events || [])}</div>
    <details ${view.manageOpen ? "open" : ""} data-dictation-models><summary>Manage speech models</summary>${renderDictationModels(view)}</details>
    <h4>Saved sessions</h4>
    ${sessions.length ? sessions.map((record) => `<article class="dictation-saved"><strong>${e(record.startedAt)}</strong><p>${(record.sampleCount / 16000).toFixed(2)} s · ${record.recording?.bytes?.toLocaleString() || 0} bytes · FLAC · ${e(record.retention)}</p><p>${e(record.recording?.projectRelativePath || "Recording unavailable")}</p>${renderEvents(record.events)}<button data-action="dictation-play" data-session-id="${e(record.id)}">Load recording for playback</button><div data-dictation-playback="${e(record.id)}"></div></article>`).join("") : "<p>No saved sessions for this scene.</p>"}
  </section>`;
}
export function renderEvents(events) {
  return events.filter((x) => x.status === "final").map((x) => `<p><small>${(x.startSample / 16000).toFixed(2)}–${(x.endSample / 16000).toFixed(2)} s · ${e(x.timestampGranularity)} / ${e(x.timestampSource)}</small><br>${e(x.text)}</p>`).join("");
}
export function renderDictationModels(view) {
  return `<p>Moonshine CPU runtime: ${view.runtime?.ready ? `ready (${e(view.runtime.runtime)})` : e(view.runtime?.message || "Not checked")}. GPU execution is not enabled.</p>
    <p>FLAC encoder: ${view.runtime?.recordingReady ? "validated" : e(view.runtime?.recordingMessage || "not checked")}.</p>
    <p>Install runtime separately: <code>python -m pip install moonshine-voice==0.1.6</code>. FLAC recording requires ffmpeg on PATH. Model installation does not install either runtime.</p>
    <button data-action="dictation-refresh">Check models and runtime</button>
    ${(view.models || []).map((model) => `<article class="dictation-model"><strong>${e(model.displayName)}</strong><p>${e(model.description)} · ${e(model.license)} · ${model.artifacts.reduce((n, a) => n + a.bytes, 0).toLocaleString()} bytes</p><p>${e(model.runtime)}${model.roles.includes("refinement") ? " (refinement execution deferred)" : ""} · ${e(model.timing)} timing · ${model.installed ? "Installed" : "Not installed"}</p>${!model.installed && model.message && !model.message.includes("ENOENT") ? `<p>${e(model.message)}</p>` : ""}
      ${model.progress ? `<p>${e(model.progress.state)}: ${model.progress.downloadedBytes.toLocaleString()} downloaded / ${model.progress.verifiedBytes.toLocaleString()} verified bytes ${e(model.progress.message || "")}</p>` : ""}
      ${!model.installed ? `<button data-action="dictation-install" data-model-id="${e(model.id)}" ${["downloading", "verifying"].includes(model.progress?.state) ? "disabled" : ""}>${model.progress ? "Retry install" : "Install"}</button><button data-action="dictation-cancel" data-model-id="${e(model.id)}" ${!["downloading", "verifying"].includes(model.progress?.state) ? "disabled" : ""}>Cancel download</button>` : `${model.roles.map((role) => `<button data-action="dictation-select" data-model-id="${e(model.id)}" data-role="${role}">${view.settings?.[`${role}ModelId`] === model.id ? "Selected for" : "Use for"} ${role} STT</button>`).join("")}<button data-action="dictation-unassign" data-model-id="${e(model.id)}">Unassign</button><button data-action="dictation-remove" data-model-id="${e(model.id)}">Remove unused model</button>`}
      <a href="${e(model.licenseUrl)}" target="_blank" rel="noreferrer">Licence</a>
    </article>`).join("")}`;
}

export function renderDictationSidebar(view = {}) {
  return `<section class="dictation-panel"><h3>Dictation</h3><p data-dictation-status>${e(view.status || "Stopped")}</p><p>Record, microphone, model management and saved sessions are in the STT panel, including when this sidebar is collapsed.</p></section>`;
}
