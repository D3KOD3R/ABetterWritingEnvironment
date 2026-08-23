// Intent: turn a browser microphone stream into local PCM frames for the desktop sherpa-onnx bridge.

export function downsampleFloat32ToInt16(samples, inputSampleRate, outputSampleRate = 16000) {
  const source = samples instanceof Float32Array ? samples : new Float32Array(0);
  const safeInputRate = Math.max(1, Number(inputSampleRate) || outputSampleRate);
  const safeOutputRate = Math.max(1, Number(outputSampleRate) || 16000);
  if (!source.length) {
    return new Int16Array(0);
  }
  if (safeInputRate === safeOutputRate) {
    return float32ToInt16(source);
  }

  const ratio = safeInputRate / safeOutputRate;
  const outputLength = Math.max(1, Math.floor(source.length / ratio));
  const output = new Float32Array(outputLength);
  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(source.length, Math.floor((index + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      sum += source[sampleIndex];
      count += 1;
    }
    output[index] = count > 0 ? sum / count : source[Math.min(source.length - 1, start)] ?? 0;
  }
  return float32ToInt16(output);
}

export function float32ToInt16(samples) {
  const source = samples instanceof Float32Array ? samples : new Float32Array(0);
  const output = new Int16Array(source.length);
  for (let index = 0; index < source.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, source[index] ?? 0));
    output[index] = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
  }
  return output;
}

export function int16ArrayToBase64(samples) {
  const source = samples instanceof Int16Array ? samples : new Int16Array(0);
  if (!source.length) {
    return "";
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(source.buffer, source.byteOffset, source.byteLength).toString("base64");
  }
  const bytes = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function concatenateInt16Arrays(frames) {
  const sourceFrames = Array.isArray(frames)
    ? frames.filter((frame) => frame instanceof Int16Array && frame.length > 0)
    : [];
  const sampleLength = sourceFrames.reduce((sum, frame) => sum + frame.length, 0);
  const output = new Int16Array(sampleLength);
  let offset = 0;
  for (const frame of sourceFrames) {
    output.set(frame, offset);
    offset += frame.length;
  }
  return output;
}

function normalizePositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function resolveTimerFunction(candidate, fallbackName) {
  if (typeof candidate === "function") {
    return candidate;
  }
  return typeof globalThis !== "undefined" && typeof globalThis[fallbackName] === "function"
    ? globalThis[fallbackName].bind(globalThis)
    : null;
}

export function createNarrationPcmChunker({
  sampleRate = 16000,
  channelCount = 1,
  chunkDurationMs = 5000,
  maxBufferedAudioMs = 6500,
  nowMs = () => Date.now(),
  setTimer = null,
  clearTimer = null,
  onChunk = () => {},
} = {}) {
  const safeSampleRate = normalizePositiveNumber(sampleRate, 16000);
  const safeChannelCount = Math.max(1, Math.round(Number(channelCount) || 1));
  const safeChunkDurationMs = Math.max(250, normalizePositiveNumber(chunkDurationMs, 5000));
  const safeMaxBufferedAudioMs = Math.max(
    safeChunkDurationMs,
    normalizePositiveNumber(maxBufferedAudioMs, safeChunkDurationMs + 1500),
  );
  const scheduleTimer = resolveTimerFunction(setTimer, "setTimeout");
  const cancelTimer = resolveTimerFunction(clearTimer, "clearTimeout");

  let frames = [];
  let bufferedSampleCount = 0;
  let firstCapturedAtMs = null;
  let lastCapturedAtMs = null;
  let timerId = null;
  let sequence = 0;
  let stopped = false;

  function clearFlushTimer() {
    if (timerId === null || !cancelTimer) {
      timerId = null;
      return;
    }
    cancelTimer(timerId);
    timerId = null;
  }

  function getBufferedDurationMs() {
    return (bufferedSampleCount / safeSampleRate) * 1000;
  }

  function flush(reason = "manual") {
    clearFlushTimer();
    if (!frames.length || bufferedSampleCount <= 0) {
      return null;
    }

    const pcm16 = concatenateInt16Arrays(frames);
    const durationMs = getBufferedDurationMs();
    const capturedAtMs = firstCapturedAtMs ?? nowMs();
    const frameCount = frames.length;
    frames = [];
    bufferedSampleCount = 0;
    firstCapturedAtMs = null;
    lastCapturedAtMs = null;
    sequence += 1;

    const chunk = {
      sequence,
      pcm16,
      sampleRate: safeSampleRate,
      channelCount: safeChannelCount,
      capturedAtMs,
      flushedAtMs: nowMs(),
      durationMs,
      byteLength: pcm16.byteLength,
      frameCount,
      reason,
    };
    onChunk(chunk);
    return chunk;
  }

  function scheduleFlush() {
    if (!scheduleTimer || timerId !== null || stopped || !frames.length) {
      return;
    }

    const remainingMs = Math.max(0, safeChunkDurationMs - getBufferedDurationMs());
    timerId = scheduleTimer(() => {
      timerId = null;
      flush("timer");
    }, remainingMs);
  }

  function pushFrame(pcm16, metadata = {}) {
    if (stopped || !(pcm16 instanceof Int16Array) || !pcm16.length) {
      return null;
    }

    const capturedAtMs = Number.isFinite(Number(metadata.capturedAtMs))
      ? Number(metadata.capturedAtMs)
      : nowMs();
    if (firstCapturedAtMs === null) {
      firstCapturedAtMs = capturedAtMs;
    }
    lastCapturedAtMs = capturedAtMs;
    frames.push(pcm16);
    bufferedSampleCount += pcm16.length;

    const bufferedDurationMs = getBufferedDurationMs();
    if (bufferedDurationMs >= safeChunkDurationMs || bufferedDurationMs >= safeMaxBufferedAudioMs) {
      return flush("duration");
    }

    scheduleFlush();
    return null;
  }

  function stop() {
    stopped = true;
    return flush("stop");
  }

  return {
    pushFrame,
    flush,
    stop,
    getBufferedDurationMs,
    getLastCapturedAtMs: () => lastCapturedAtMs,
  };
}

function emitLiveAudioFrameDebug(logger, event, message, context = {}) {
  if (
    !logger ||
    typeof logger.debug !== "function" ||
    (typeof logger.isEnabled === "function" && !logger.isEnabled())
  ) {
    return;
  }

  logger.debug("live-audio-frame", event, message, context);
}

function resolveAudioContextConstructor(audioContextConstructor) {
  if (audioContextConstructor) {
    return audioContextConstructor;
  }
  if (typeof window === "undefined") {
    return null;
  }
  return window.AudioContext || window.webkitAudioContext || null;
}

export function createNarrationLiveAudioFrameService({
  audioContextConstructor = null,
  outputSampleRate = 16000,
  minFrameIntervalMs = 0,
  chunkDurationMs = 5000,
  maxBufferedAudioMs = 6500,
  logger = null,
  nowMs = () => Date.now(),
} = {}) {
  // Intent: own microphone PCM frame capture separately from recorder and speech-recognition policy.
  function start({
    stream = null,
    onFrame = () => {},
  } = {}) {
    const AudioContextConstructor = resolveAudioContextConstructor(audioContextConstructor);
    if (!stream || !AudioContextConstructor) {
      emitLiveAudioFrameDebug(
        logger,
        "narration-follow.local-audio-unavailable",
        "Local PCM frame capture is unavailable.",
        { hasStream: Boolean(stream), hasAudioContext: Boolean(AudioContextConstructor) },
      );
      return null;
    }

    const audioContext = new AudioContextConstructor();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const gain = typeof audioContext.createGain === "function" ? audioContext.createGain() : null;
    if (gain) {
      gain.gain.value = 0;
    }

    let sequence = 0;
    let lastFrameAtMs = Number.NEGATIVE_INFINITY;
    const chunker = createNarrationPcmChunker({
      sampleRate: outputSampleRate,
      channelCount: 1,
      chunkDurationMs,
      maxBufferedAudioMs,
      nowMs,
      onChunk(chunk) {
        const pcm16Base64 = int16ArrayToBase64(chunk.pcm16);
        if (!pcm16Base64) {
          return;
        }

        sequence += 1;
        emitLiveAudioFrameDebug(
          logger,
          "narration-follow.local-audio-chunk",
          "Flushed a local PCM chunk for narration follow.",
          {
            sequence,
            durationMs: Math.round(chunk.durationMs),
            byteLength: chunk.byteLength,
            frameCount: chunk.frameCount,
            reason: chunk.reason,
          },
        );
        onFrame({
          sequence,
          pcm16Base64,
          sampleRate: outputSampleRate,
          channelCount: 1,
          capturedAtMs: chunk.capturedAtMs,
          flushedAtMs: chunk.flushedAtMs,
          durationMs: chunk.durationMs,
          byteLength: chunk.byteLength,
          frameCount: chunk.frameCount,
          chunked: true,
        });
      },
    });
    processor.onaudioprocess = (event) => {
      const capturedAtMs = nowMs();
      if (minFrameIntervalMs > 0 && capturedAtMs - lastFrameAtMs < minFrameIntervalMs) {
        return;
      }
      lastFrameAtMs = capturedAtMs;
      const inputBuffer = event?.inputBuffer;
      if (!inputBuffer || typeof inputBuffer.getChannelData !== "function") {
        return;
      }

      const pcm16 = downsampleFloat32ToInt16(
        inputBuffer.getChannelData(0),
        audioContext.sampleRate,
        outputSampleRate,
      );
      chunker.pushFrame(pcm16, {
        capturedAtMs,
      });
    };

    source.connect(processor);
    if (gain) {
      processor.connect(gain);
      gain.connect(audioContext.destination);
    } else {
      processor.connect(audioContext.destination);
    }

    emitLiveAudioFrameDebug(
      logger,
      "narration-follow.local-audio-started",
      "Started local PCM chunk capture for narration follow.",
      { outputSampleRate, chunkDurationMs, maxBufferedAudioMs },
    );

    return {
      stop() {
        processor.onaudioprocess = null;
        chunker.stop();
        try {
          source.disconnect();
        } catch {
          // Audio graph disconnects are best-effort during recorder cleanup.
        }
        try {
          processor.disconnect();
        } catch {
          // Audio graph disconnects are best-effort during recorder cleanup.
        }
        try {
          gain?.disconnect();
        } catch {
          // Audio graph disconnects are best-effort during recorder cleanup.
        }
        if (typeof audioContext.close === "function") {
          void audioContext.close();
        }
      },
    };
  }

  return { start };
}
