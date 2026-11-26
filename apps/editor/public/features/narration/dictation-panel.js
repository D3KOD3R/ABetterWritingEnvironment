import { escapeHtml as e } from "../../shared/ui-utils.js";

export function renderNarrationSubpanels(state) {
  return `<nav aria-label="Narration workflow" class="dictation-tabs"><button class="tag-button" data-action="dictation-follow" aria-pressed="${state.narrationSubpanel !== "stt"}">Narration Follow</button><button class="tag-button" data-action="dictation-stt" aria-pressed="${state.narrationSubpanel === "stt"}">STT · Dictation</button></nav>`;
}
export function renderDictationPanel(view = {}, sessions = []) {
  const busy = view.active || view.busy || view.locked;
  return `<section data-dictation-recovery class="dictation-panel"><h4>Recordings and transcript recovery</h4>
    <p>Recordings remain protected. Automatic audio deletion is not enabled.</p>
    <button data-action="dictation-recordings-folder">Open recordings folder</button>
    ${view.finalizationPending ? '<button data-action="dictation-stop" >Retry finalization</button>' : ""}
    ${view.pending ? '<button data-action="dictation-save">Retry session save</button>' : ""}
    <button data-action="dictation-copy">Copy finalized transcript</button>
    <details><summary>Recovered / imported transcript</summary><p>${e((view.events || []).filter(x => x.status === "final").map(x => x.text).join(" "))}</p></details>
    <h4>Transcribe recorded audio</h4><p>Preview only; Copy to retain. Up to 4 minutes / 50 MB. Source files stay unchanged.</p>
    <input type="file" aria-label="Audio to transcribe" accept="audio/*,.wav,.flac,.mp3,.m4a" data-dictation-input="audioFile" ${busy || view.pending || view.finalizationPending || !view.model?.ready ? "disabled" : ""}>
    ${view.importing ? '<button data-action="dictation-cancel-file">Cancel file transcription</button>' : ""}
    ${sessions.map(record => `<article class="dictation-saved"><strong>${e(record.startedAt)}</strong><p>${(record.sampleCount / 16000).toFixed(1)} s · FLAC</p><button data-action="dictation-play" data-session-id="${e(record.id)}">Load recording for playback</button><div data-dictation-playback="${e(record.id)}"></div></article>`).join("")}
  </section>`;
}
export function dictationSetup(view = {}) {
  const inputAvailable = view.devices?.length && (!view.deviceId || view.devices.some(d => d.deviceId === view.deviceId)) && (!view.channels || view.channel < view.channels);
  const microphone = Boolean(inputAvailable && view.permission === "granted" && (view.inputTested || (view.settings?.setupStage || 1) > 1 || view.settings?.setupComplete));
  const model = view.readiness?.modelReady && view.runtime?.recordingReady;
  const refinement = view.refinementDeferred || view.settings?.setupStage === 3 || view.settings?.setupComplete;
  const stage = !microphone ? 1 : !model ? 2 : 3;
  return { stage, microphone, model, refinement, ready: Boolean(microphone && model && refinement && !view.active && !view.busy && !view.locked && !view.pending && !view.finalizationPending && !view.settingBusy) };
}
export function renderDictationTransport(view = {}) {
  const active = view.active || view.busy || view.finalizationPending;
  const ready = view.settings?.setupComplete && view.readiness?.ready && !view.setupOpen;
  const retrySave = view.pending && !view.busy;
  const message = view.pending || view.finalizationPending ? view.status : !active && !ready ? (view.readiness?.reasons || []).map(r => r.text).join(" ") || "Complete speech setup in Narration + Voice." : view.status || "Click in the manuscript, then record.";
  const label = retrySave ? "Retry saving" : view.finalizationPending && !view.busy ? "Retry finalization" : active ? (view.active ? view.testing ? "Testing input · Stop" : "Recording · Stop" : "Preparing / finalizing…") : ready ? "Ready to record" : "Setup / readiness required";
  return `<div data-dictation-transport><button class="dictation-microphone ${active ? "is-recording" : ready ? "is-ready" : ""}" data-action="${retrySave ? "dictation-save" : active ? "dictation-stop" : "dictation-record"}" ${!active && !ready && !retrySave ? "disabled" : ""} title="${e(message)}"><span aria-hidden="true">🎙</span> ${label}</button><small data-dictation-status>${e(message)}</small></div>`;
}

export function renderReadiness(view) {
  if (view.active || view.busy) return `<div data-dictation-readiness role="status"><strong>${view.testing ? "Testing microphone" : view.active ? "Recording" : "Preparing / finalizing"}</strong><p>Stop capture before editing the manuscript or changing speech configuration.</p></div>`;
  return `<div data-dictation-readiness role="status"><strong>${view.readiness?.modelReady ? "Model Ready" : "Model not ready"} · ${view.readiness?.ready ? "Ready to Record" : "Not ready to record"}</strong>
    ${(view.readiness?.reasons || []).map(r => `<p>${e(r.text)}</p>`).join("")}</div>`;
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
  return `<section data-dictation-settings="${surface}" class="dictation-settings"><h3>Speech-to-Text</h3>${renderReadiness(view)}
    <div data-dictation-guide="microphone" class="${(!view.settings?.setupComplete || view.setupOpen) && dictationSetup(view).stage === 1 ? "dictation-attention" : ""}">${renderMicrophone(view)}</div>
    <div class="${(!view.settings?.setupComplete || view.setupOpen) && dictationSetup(view).stage === 2 ? "dictation-attention" : ""}">
    <p>Live STT: ${e(view.models?.find(m => m.id === view.settings?.liveModelId)?.displayName || "Select a model")}</p>
    <button data-action="dictation-manage-models">Select / manage speech model</button><button data-action="dictation-dependencies">Set up speech runtime</button></div>
    <div class="${(!view.settings?.setupComplete || view.setupOpen) && dictationSetup(view).stage === 3 && !dictationSetup(view).refinement ? "dictation-attention" : ""}"><p>Refinement · optional · execution deferred</p><button data-action="dictation-defer-refinement" ${locked || dictationSetup(view).stage !== 3 ? "disabled" : ""}>${dictationSetup(view).refinement ? "Refinement deferred" : "Defer refinement (recommended)"}</button></div>
    <label><input type="checkbox" data-dictation-input="saveRecording" ${view.saveRecording ? "checked" : ""} ${locked ? "disabled" : ""}> Save Recording until manual deletion</label>
    <details ${view.manageOpen ? "open" : ""}><summary>Manage speech models</summary>${renderDictationModels(view)}</details>
    <details><summary>Runtime and model storage</summary><p>Model library: ${e(view.modelRoot || "Checking…")}</p>
    <button data-action="dictation-open-folder">Open Model Folder</button>
    <button data-action="dictation-storage-plan" ${locked ? "disabled" : ""}>Choose Storage Location / Preview copy</button>
    ${renderStorageCopy(view, locked)}
    <p>Runtime: ${e(view.runtime?.ready ? `${view.runtime.source || "Moonshine CPU"} ready` : view.runtime?.message || "Not checked")} · Encoder: ${view.runtime?.recordingReady ? "FLAC ready" : "Unavailable"}</p>
    </details><button data-action="dictation-refresh" ${locked ? "disabled" : ""}>Check models and runtime</button>${renderRuntimeSetup(view, locked)}
    <button data-action="dictation-setup" ${locked ? "disabled" : ""}>Reopen Setup</button>
    <p data-dictation-status>${e(view.status || "Stopped")}</p></section>`;
}
export function renderSetup(view) {
  const setup = dictationSetup(view);
  const downloading = view.models?.some(m => ["downloading", "verifying"].includes(m.progress?.state));
  const status = view.testing ? "Speak into the selected microphone, then Stop Test" : !setup.microphone ? "Awaiting microphone setup and input test" : !setup.model ? (view.runtimeInstall?.busy ? "Installing speech runtime" : downloading ? "Downloading / verifying speech model" : view.settingBusy ? "Loading and verifying speech model" : "Awaiting a ready Live STT model") : !setup.refinement ? "Choose a refinement preference in the console" : "Ready to record";
  return `<div data-dictation-wizard class="dictation-wizard-shade"><section class="dictation-wizard" role="region" aria-label="STT setup"><h2>Set up Speech-to-Text Dictation</h2><p>Follow the highlighted control in the Narration Console.</p>
    ${setup.ready ? '<button class="dictation-wizard-close" data-action="dictation-finish" aria-label="Finish setup">×</button>' : ""}
    <ol class="dictation-steps">${["Microphone", "Model", "Refinement"].map((name,i) => `<li class="${[setup.microphone,setup.model,setup.refinement][i] ? "is-complete" : setup.stage === i+1 ? "is-current" : ""}"><span>${[setup.microphone,setup.model,setup.refinement][i] ? "✓" : i+1}</span>${name}</li>`).join("")}</ol>
    <p class="dictation-wizard-status ${setup.ready ? "is-ready" : ""}" role="status">● ${e(status)}</p><small>Closing setup leaves the microphone off. Click in the manuscript, then Record.</small>
  </section></div>`;
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
