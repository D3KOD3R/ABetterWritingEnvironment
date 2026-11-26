// Explicitly selected file bytes remain transient. No microphone, project writes or remote upload.
export async function transcribeAudioFile(file, { request, signal, progress, offlineContext = (...args) => new OfflineAudioContext(...args) }) {
  if (!file || file.size <= 0 || file.size > 50 * 1024 * 1024) throw new Error("Choose an audio file up to 50 MB.");
  signal.throwIfAborted();
  progress({ message: "Decoding selected audio…" });
  const decoder = offlineContext(1, 1, 16000);
  let decoded;
  try { decoded = await decoder.decodeAudioData(await file.arrayBuffer()); }
  catch { throw new Error("This audio format could not be decoded. Try WAV, FLAC, MP3 or M4A supported by your browser."); }
  if (!decoded.length || decoded.duration > 240) throw new Error("Choose audio between zero and four minutes long.");
  signal.throwIfAborted();
  const renderer = offlineContext(1, Math.ceil(decoded.duration * 16000), 16000);
  const source = renderer.createBufferSource(); source.buffer = decoded; source.connect(renderer.destination); source.start();
  const samples = (await renderer.startRendering()).getChannelData(0);
  signal.throwIfAborted();
  let session, result;
  try {
    session = await request("file-start");
    for (let offset = 0, sequence = 0; offset < samples.length; offset += 16000, sequence++) {
      signal.throwIfAborted();
      const length = Math.min(16000, samples.length - offset), bytes = new Uint8Array(length * 2), view = new DataView(bytes.buffer);
      for (let i = 0; i < length; i++) { const value = Math.max(-1, Math.min(1, samples[offset + i])); view.setInt16(i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true); }
      let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
      const response = await request("audio", { ...session, sequence, startSample: offset, endSample: offset + length, sourceStartSample: offset, sourceEndSample: offset + length, sampleRate: 16000, sourceSampleRate: 16000, pcm16Base64: btoa(binary) });
      progress({ ...response, message: `Transcribing ${Math.round((offset + length) / samples.length * 100)}%…` });
    }
  } finally {
    // Drain the recognizer and release its model lease even after cancel or a failed audio frame.
    if (session) { result = await request("file-finish", { sessionId: session.sessionId, cancelled: signal.aborted }); progress(result); }
  }
  signal.throwIfAborted();
  if (result?.message) throw new Error(result.message);
  return result;
}
