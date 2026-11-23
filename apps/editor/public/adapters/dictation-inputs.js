// Permission discovery uses a short-lived stream only after an explicit setup gesture.
export function createDictationInputs({ mediaDevices = globalThis.navigator?.mediaDevices, permissions = globalThis.navigator?.permissions, changed = () => {} } = {}) {
  const state = { permission: "unknown", devices: [], channels: null, error: "" };
  let permission, serial = 0, authorizing;
  async function refresh() {
    const version = ++serial;
    try {
      if (!mediaDevices?.enumerateDevices) throw new Error("Microphone access requires a supported local browser.");
      if (!permission && permissions?.query) {
        try { permission = await permissions.query({ name: "microphone" }); permission.addEventListener?.("change", refresh); } catch {}
      }
      const devices = await mediaDevices.enumerateDevices();
      if (version !== serial) return state;
      state.permission = permission?.state || state.permission;
      state.devices = devices.filter(d => d.kind === "audioinput").map(d => ({ deviceId: d.deviceId, label: d.label }));
      state.error = state.permission === "denied" ? "Microphone permission denied. Allow access in browser site settings, then choose Set up microphone." : "";
    } catch (error) { state.error = error.message; }
    changed(state); return state;
  }
  function authorize(deviceId = "") {
    if (authorizing) return authorizing;
    authorizing = (async () => {
      let stream;
      try {
        stream = await mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true });
        state.permission = "granted"; state.error = "";
        state.channels = stream.getAudioTracks()[0]?.getSettings?.().channelCount || 1;
      } catch (error) { state.permission = error.name === "NotAllowedError" ? "denied" : "unknown"; state.channels = null; state.error = `Microphone unavailable: ${error.message}. Check browser permission and reconnect the device.`; changed(state); throw error; }
      finally { stream?.getTracks().forEach(track => track.stop()); }
      return refresh();
    })().finally(() => { authorizing = null; });
    return authorizing;
  }
  mediaDevices?.addEventListener?.("devicechange", refresh);
  return { state, refresh, authorize, dispose() { serial++; mediaDevices?.removeEventListener?.("devicechange", refresh); permission?.removeEventListener?.("change", refresh); } };
}
