// One microphone stream feeds both inference and retained PCM. Backpressure stops visibly rather than dropping speech.
export async function startDictationCapture({ deviceId = "", channel = 0, onFrame, onLevel, onFailure, mediaDevices = navigator.mediaDevices }) {
  if (!mediaDevices?.getUserMedia || !globalThis.AudioWorkletNode) throw new Error("AudioWorklet microphone capture is unavailable.");
  let stream, context, source, node, stopped = false, resolveStop;
  const released = () => { source?.disconnect(); node?.disconnect(); stream?.getTracks().forEach((track) => track.stop()); void context?.close(); };
  try {
    stream = await mediaDevices.getUserMedia({ audio: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), channelCount: { ideal: channel + 1 }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    context = new AudioContext();
    if (context.sampleRate < 16000) throw new Error("This input sample rate is below 16 kHz.");
    await context.audioWorklet.addModule(new URL("./dictation-pcm-worklet.js", import.meta.url));
    node = new AudioWorkletNode(context, "abe-dictation-pcm", { processorOptions: { channel }, numberOfInputs: 1, numberOfOutputs: 1 });
    node.port.onmessage = ({ data }) => {
      if (data.stopped) { resolveStop?.(); return; }
      if (data.error) { onFailure(new Error(data.error)); return; }
      if (data.level !== undefined) onLevel(data);
      else if (data.pcm) onFrame(data);
    };
    const track = stream.getAudioTracks()[0];
    track.addEventListener("ended", () => { if (!stopped) onFailure(new Error("Microphone disconnected.")); });
    source = context.createMediaStreamSource(stream); source.connect(node); node.connect(context.destination);
    await context.resume();
    return {
      device: { label: track.label, ...track.getSettings() },
      async stop() {
        if (stopped) return; stopped = true;
        try { await new Promise((resolve) => { const timer = setTimeout(resolve, 1000); resolveStop = () => { clearTimeout(timer); resolve(); }; node.port.postMessage("stop"); }); }
        finally { released(); }
      },
    };
  } catch (error) { released(); throw error; }
}
