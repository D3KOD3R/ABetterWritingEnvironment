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
    <p>Live STT: ${e(view.models?.find((model) => model.id === view.settings?.liveModelId)?.displayName || "No live model selected")} · ${view.runtime?.ready ? "CPU runtime ready" : "runtime unavailable"} · utterance timing; word timing unavailable.</p>
    ${renderReadiness(view)}
    ${!view.settings?.setupComplete || view.setupOpen ? renderSetup(view) : ""}
    <details><summary>Microphone and model settings</summary>${renderDictationSettings(view, "central")}</details>
    <div class="dictation-controls">
      <label><input type="checkbox" data-dictation-input="saveRecording" ${view.saveRecording ? "checked" : ""} ${busy ? "disabled" : ""}> Save Recording until manual deletion</label>
      <button data-action="dictation-record" ${busy || !view.readiness?.ready ? "disabled" : ""}>Record</button>
      <button data-action="dictation-stop" ${!busy && !view.finalizationPending ? "disabled" : ""}>${view.finalizationPending ? "Retry finalization" : "Stop"}</button>
      <button data-action="dictation-copy">Copy finalized transcript</button>
      ${view.pending ? '<button data-action="dictation-save">Retry session save</button>' : ""}
    </div>
    <p><span data-dictation-duration>${(Number(view.sampleCount || 0) / 16000).toFixed(2)}</span> seconds · mono 16 kHz PCM16 → FLAC · checkpoint limit: 4 minutes.</p>
    <p>Without Save Recording, audio remains protected pending durable manuscript insertion. Automatic cleanup is not enabled in this preview checkpoint.</p>
    <p data-dictation-partial class="dictation-partial" aria-label="Provisional transcription">${e((view.events || []).filter((x) => x.status === "partial").map((x) => x.text).join(" "))}</p>
    <div data-dictation-finals>${renderEvents(view.events || [])}</div>

    <h4>Saved sessions</h4>
    ${sessions.length ? sessions.map((record) => `<article class="dictation-saved"><strong>${e(record.startedAt)}</strong><p>${(record.sampleCount / 16000).toFixed(2)} s · ${record.recording?.bytes?.toLocaleString() || 0} bytes · FLAC · ${e(record.retention)}</p><p>${e(record.recording?.projectRelativePath || "Recording unavailable")}</p>${renderEvents(record.events)}<button data-action="dictation-play" data-session-id="${e(record.id)}">Load recording for playback</button><div data-dictation-playback="${e(record.id)}"></div></article>`).join("") : "<p>No saved sessions for this scene.</p>"}
  </section>`;
}
export function renderEvents(events) {
  return events.filter((x) => x.status === "final").map((x) => `<p><small>${(x.startSample / 16000).toFixed(2)}–${(x.endSample / 16000).toFixed(2)} s · ${e(x.timestampGranularity)} / ${e(x.timestampSource)}</small><br>${e(x.text)}</p>`).join("");
}

export function renderReadiness(view) {
  return `<div data-dictation-readiness role="status"><strong>${view.readiness?.modelReady ? "Model Ready" : "Model not ready"} · ${view.readiness?.ready ? "Ready to Record · transcript preview" : "Not ready to record"}</strong>
    ${(view.readiness?.reasons || []).map(r => `<p>${e(r.text)} ${r.action ? `<button data-action="${r.action}" ${view.active || view.busy ? "disabled" : ""}>${e(r.label)}</button>` : ""}</p>`).join("")}</div>`;
}
export function renderMicrophone(view) {
  const locked = view.active || view.busy || view.locked || view.pending || view.finalizationPending || view.settingBusy;
  return `<p>Microphone: ${view.active ? (view.testing ? "Testing input" : "Recording") : "Off"} · Permission: ${e(view.permission || "unknown")}</p>
    ${view.inputError ? `<p role="alert">${e(view.inputError)}</p>` : ""}
    <div class="dictation-controls"><button data-action="dictation-authorize" ${locked ? "disabled" : ""}>Set up microphone</button>
    <label>Microphone <select data-dictation-input="deviceId" ${locked ? "disabled" : ""}><option value="">System default</option>${(view.devices || []).map(d => `<option value="${e(d.deviceId)}" ${view.deviceId === d.deviceId ? "selected" : ""}>${e(d.label || "Microphone (permission required)")}</option>`).join("")}</select></label>
    <label>Input channel <input data-dictation-input="channel" type="number" min="1" max="${view.channels || 32}" value="${(view.channel || 0) + 1}" ${locked ? "disabled" : ""}></label>
    <button data-action="dictation-test" ${locked ? "disabled" : ""}>Test Input</button>
    <button data-action="dictation-stop-test" ${!view.testing ? "disabled" : ""}>Stop Test</button>
    <label>Level <meter data-dictation-level min="0" max="1" value="${view.inputLevel || 0}"></meter><span data-dictation-clipping>${view.clipping ? "Clipping" : ""}</span></label></div>
    ${locked ? "<p>Stop and finalize capture to change microphone or model.</p>" : ""}`;
}
export function renderDictationModels(view, liveOnly = false) {
  const locked = view.active || view.busy || view.locked || view.pending || view.finalizationPending || view.settingBusy;
  const group = (role) => `<h4>${role === "live" ? "Live Dictation Models — required" : "Refinement Models — optional"}</h4>
    ${role === "refinement" ? "<p>Refinement execution is not available in this checkpoint. Whisper is not needed for live dictation.</p>" : "<p>Moonshine Tiny is the supported lightweight CPU model.</p>"}
    ${(view.models || []).filter(m => m.roles.includes(role)).map(model => `<article class="dictation-model"><strong>${e(model.displayName)}</strong>
    <p>${e(model.description)} · ${e(model.license)} · ${model.artifacts.reduce((n, a) => n + a.bytes, 0).toLocaleString()} bytes</p>
    <p>${model.installed ? (view.settings?.[`${role}ModelId`] === model.id ? (role === "live" && view.model?.ready ? "Ready · Selected" : "Selected") : "Installed") : "Not Installed"} · ${e(model.runtime)} · ${e(model.timing)} timing</p>
    ${model.path ? `<p>Location: ${e(model.path)}</p>` : ""}
    ${model.progress ? `<p>${e(model.progress.state)} · ${model.progress.downloadedBytes.toLocaleString()} downloaded / ${model.progress.verifiedBytes.toLocaleString()} verified bytes · ${e(model.progress.message || "")}</p>` : ""}
    ${!model.installed ? `<button data-action="dictation-install" data-model-id="${e(model.id)}" ${locked || ["downloading", "verifying"].includes(model.progress?.state) ? "disabled" : ""}>${model.progress ? "Retry install" : "Install"}</button><button data-action="dictation-cancel" data-model-id="${e(model.id)}" ${!["downloading", "verifying"].includes(model.progress?.state) ? "disabled" : ""}>Cancel download</button>` : `<button data-action="dictation-select" data-role="${role}" data-model-id="${e(model.id)}" ${locked ? "disabled" : ""}>${view.settings?.[`${role}ModelId`] === model.id ? "Selected for" : "Use for"} ${role} STT</button><button data-action="dictation-unassign" data-model-id="${e(model.id)}" ${locked ? "disabled" : ""}>Unassign</button><button data-action="dictation-remove" data-model-id="${e(model.id)}" ${locked ? "disabled" : ""}>Remove unused model</button>`}
    ${view.consentModel === model.id ? `<div role="alert"><p>Download from ${e(model.sourceUrl)} into ${e(view.modelRoot)}. Files will be verified before installation. No runtime or refinement installation is implied.</p><button data-action="dictation-confirm-install" data-model-id="${e(model.id)}" ${locked ? "disabled" : ""}>Approve download and install</button><button data-action="dictation-dismiss-consent">Cancel</button></div>` : ""}
    <a href="${e(model.licenseUrl)}" target="_blank" rel="noreferrer">Licence</a></article>`).join("")}`;
  return `${group("live")}${liveOnly ? "" : `<details><summary>Optional refinement models</summary>${group("refinement")}</details>`}`;
}
export function renderDictationSettings(view = {}, surface = "sidebar") {
  const locked = view.active || view.busy || view.locked || view.pending || view.finalizationPending;
  return `<section data-dictation-settings="${surface}" class="dictation-settings"><h3>Speech settings · this installation</h3>${renderMicrophone(view)}
    <details ${view.manageOpen ? "open" : ""}><summary>Manage speech models</summary>${renderDictationModels(view)}</details>
    <p>Model library: ${e(view.modelRoot || "Checking…")}</p>
    <button data-action="dictation-open-folder">Open Model Folder</button>
    <button data-action="dictation-storage-plan" ${locked ? "disabled" : ""}>Choose Storage Location / Preview copy</button>
    ${renderStorageCopy(view, locked)}
    <p>Runtime: ${e(view.runtime?.ready ? `${view.runtime.source || "Moonshine CPU"} ready` : view.runtime?.message || "Not checked")} · Encoder: ${view.runtime?.recordingReady ? "FLAC ready" : "Unavailable"}</p>
    <button data-action="dictation-refresh" ${locked ? "disabled" : ""}>Check models and runtime</button><button data-action="dictation-dependencies">Set up speech runtime</button>
    ${renderRuntimeSetup(view, locked)}
    <button data-action="dictation-setup" ${locked ? "disabled" : ""}>Reopen Setup</button>
    <p data-dictation-status>${e(view.status || "Stopped")}</p></section>`;
}
export function renderSetup(view) {
  const stage = view.settings?.setupStage || 1;
  return `<section class="dictation-setup" aria-label="STT setup"><h4>Set up STT · Stage ${stage} of 3</h4>
    ${stage === 1 ? `<p>Authorize your microphone, then explicitly test its input. Setup does not record audio.</p>${renderMicrophone(view)}` : stage === 2 ? `${renderDictationModels(view, true)}<button data-action="dictation-dependencies">Set up speech runtime</button>${renderRuntimeSetup(view, view.active || view.busy || view.locked)}` : renderReadiness(view)}
    ${stage > 1 ? '<button data-action="dictation-setup-back">Back</button>' : ""}
    ${stage < 3 ? `<button data-action="dictation-setup-next" ${view.active || view.busy || (stage === 1 ? !view.inputTested : !view.readiness?.modelReady) ? "disabled" : ""}>Next</button>` : `<button data-action="dictation-finish" ${!view.readiness?.modelReady || view.permission !== "granted" || view.active || view.busy ? "disabled" : ""}>Finish Setup</button><button data-action="dictation-start-setup" ${!view.readiness?.ready ? "disabled" : ""}>Start Dictating</button>`}
    <p>Finish Setup leaves the microphone off. Start Dictating begins a transcript preview only.</p></section>`;
}
export function renderDictationSidebar(view = {}) {
  return `<section data-dictation-sidebar>${renderDictationSettings(view)}</section>`;
}

export function renderRuntimeSetup(view, locked) {
  const job = view.runtimeInstall, plan = view.dependencyPlan;
  return `${job && job.state !== "idle" ? `<p role="status">Runtime ${e(job.state)} · ${Number(job.downloadedBytes).toLocaleString()} downloaded / ${Number(job.verifiedBytes).toLocaleString()} verified bytes · ${e(job.message)}</p>${job.busy ? '<button data-action="dictation-runtime-cancel">Cancel runtime installation</button>' : ""}` : ""}
    ${plan ? `<div role="region" aria-label="Runtime installation consent"><p>${e(plan.message)}</p><p>Location: ${e(plan.root)}</p>
    <details><summary>Sources, download sizes and licences</summary><ul>${(plan.artifacts || []).map(a => `<li><a href="${e(a.source)}" target="_blank" rel="noreferrer">${e(a.filename)}</a> · ${a.bytes.toLocaleString()} bytes · ${e(a.license)}</li>`).join("")}</ul><p>SoundFile includes libsndfile (LGPL-2.1-or-later). Bundled notices are retained.</p></details>
    ${plan.supported ? `<button data-action="dictation-runtime-install" ${locked ? "disabled" : ""}>Approve download and install private runtime</button>` : '<p>Automatic installation is available on Windows x64 only.</p>'}
    <button data-action="dictation-runtime-dismiss">Cancel</button></div>` : ""}`;
}
export function renderStorageCopy(view, locked) {
  const copy = view.storageCopy;
  if (!copy) return "";
  return `<div role="status"><p>${e(copy.message)}</p>${copy.state ? `<p>${e(copy.state)} · ${Number(copy.copiedBytes || 0).toLocaleString()} / ${Number(copy.bytes || 0).toLocaleString()} bytes</p>` : ""}
    ${copy.stage ? `<p>Staged copy: ${e(copy.stage)}</p>` : ""}
    ${copy.state === "planned" ? `<button data-action="dictation-storage-copy" ${locked ? "disabled" : ""}>Approve staged copy (keep current library)</button>` : ""}
    ${copy.busy ? '<button data-action="dictation-storage-cancel">Cancel library copy</button>' : ""}</div>`;
}
