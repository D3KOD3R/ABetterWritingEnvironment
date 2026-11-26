// One projection drives transport, onboarding and settings; completion never implies readiness.
export function dictationReadiness(view, context = {}) {
  const reasons = [];
  const modelReady = Boolean(view.model?.ready && view.runtime?.ready && view.settings?.liveModelId);
  if (!modelReady) reasons.push({ text: view.model?.message || "Choose and verify a Live Dictation model.", action: "dictation-refresh", label: "Check models and runtime" });
  if (!view.runtime?.ready) reasons.push({ text: view.runtime?.message || "Local inference runtime unavailable.", action: "dictation-dependencies", label: "Set up speech runtime" });
  if (!view.runtime?.recordingReady) reasons.push({ text: view.runtime?.recordingMessage || "FLAC encoder is unavailable.", action: "dictation-dependencies", label: "Set up speech runtime" });
  if (view.permission !== "granted") reasons.push({ text: view.inputError || "Authorize a microphone before recording.", action: "dictation-authorize", label: "Set up microphone" });
  else if (!view.devices?.length || (view.deviceId && !view.devices.some(d => d.deviceId === view.deviceId))) reasons.push({ text: "Selected microphone is unavailable. Reconnect it or select another input.", action: "dictation-devices", label: "Check inputs" });
  if (view.channels && view.channel >= view.channels) reasons.push({ text: "Selected channel is unavailable on this microphone.", action: "dictation-authorize", label: "Check microphone channels" });
  if (!context.saved) reasons.push({ text: "Save this project as a folder package using File Ã¢â€ â€™ Save As.", label: "Save a folder project" });
  if (!context.scene) reasons.push({ text: "Select a scene in the manuscript binder.", label: "Select a scene" });
  if (context.follow || view.settingBusy || view.active || view.busy || view.locked || view.pending || view.finalizationPending) reasons.push({ text: "Stop and finalize the active microphone workflow or retry its save.", label: "Stop / retry save" });
  return { modelReady, ready: reasons.length === 0, reasons };
}
