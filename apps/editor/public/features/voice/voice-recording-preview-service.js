// Intent: own browser audio/object-url lifecycle for saved voice recording previews.

export function createVoiceRecordingPreviewController({
  createObjectUrl,
  revokeObjectUrl,
  createAudio,
} = {}) {
  if (typeof createObjectUrl !== "function") {
    throw new TypeError("createVoiceRecordingPreviewController requires createObjectUrl.");
  }
  if (typeof revokeObjectUrl !== "function") {
    throw new TypeError("createVoiceRecordingPreviewController requires revokeObjectUrl.");
  }
  if (typeof createAudio !== "function") {
    throw new TypeError("createVoiceRecordingPreviewController requires createAudio.");
  }

  let previewAudio = null;
  let previewUrl = null;

  function clearPreview() {
    if (previewAudio) {
      try {
        previewAudio.pause();
      } catch {
        // Ignore preview cleanup failures.
      }
      previewAudio = null;
    }

    if (previewUrl) {
      revokeObjectUrl(previewUrl);
      previewUrl = null;
    }
  }

  async function playBlob(blob) {
    clearPreview();

    previewUrl = createObjectUrl(blob);
    previewAudio = createAudio(previewUrl);
    previewAudio.preload = "auto";
    previewAudio.onended = clearPreview;
    previewAudio.onerror = clearPreview;
    await previewAudio.play();

    return {
      audio: previewAudio,
      url: previewUrl,
    };
  }

  return {
    playBlob,
    clearPreview,
    getPreviewAudio: () => previewAudio,
    getPreviewUrl: () => previewUrl,
    setPreviewAudio: (audio) => {
      previewAudio = audio;
    },
    setPreviewUrl: (url) => {
      previewUrl = url;
    },
  };
}
