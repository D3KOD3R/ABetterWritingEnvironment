// Intent: call the local desktop realtime speech API without exposing route details to narration commands.

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function createFailure(error, fallbackMessage) {
  return {
    ok: false,
    error: error instanceof Error ? error : new Error(String(error ?? fallbackMessage)),
    value: {
      ok: false,
      message: error instanceof Error ? error.message : fallbackMessage,
    },
  };
}

export function createNarrationRealtimeSpeechClient({
  fetchJson,
} = {}) {
  if (typeof fetchJson !== "function") {
    throw new TypeError("createNarrationRealtimeSpeechClient requires a fetchJson function.");
  }

  async function request(pathname, body = undefined) {
    const response = await fetchJson(pathname, body === undefined
      ? { method: "GET" }
      : {
        method: "POST",
        body,
      });
    if (!response.ok) {
      return createFailure(response.error, `Local realtime speech request failed for ${pathname}.`);
    }
    return {
      ok: true,
      value: response.value,
    };
  }

  return {
    async listProviders() {
      const response = await request("/api/realtime-speech/providers");
      return {
        ...response,
        providers: normalizeArray(response.value?.providers),
      };
    },
    startSession(input) {
      return request("/api/realtime-speech/session/start", input);
    },
    sendAudioFrame(input) {
      return request("/api/realtime-speech/session/audio", input);
    },
    stopSession(input) {
      return request("/api/realtime-speech/session/stop", input);
    },
    getWhisperCapability() {
      return request("/api/whisper-cpp/capability");
    },
    getWhisperWordTimings(input) {
      return request("/api/whisper-cpp/word-timings", input);
    },
  };
}
