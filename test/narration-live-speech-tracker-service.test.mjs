// Intent: verify narration recording selects local speech providers without binding commands to browser ASR.
import assert from "node:assert/strict";

import {
  createNarrationLiveSpeechTrackerService,
  createPrimaryLiveWithCleanupTrackerProvider,
} from "../apps/editor/public/features/narration/narration-live-speech-tracker-service.js";

export async function runNarrationLiveSpeechTrackerServiceTest() {
  const logs = [];
  const tracker = {
    start() {},
    stop() {},
  };
  const service = createNarrationLiveSpeechTrackerService({
    providers: [
      {
        id: "local-sherpa-onnx",
        label: "Local sherpa-onnx Streaming",
        kind: "local-sherpa-onnx",
        availability: "disabled",
        unavailableReason: "No local sidecar.",
        createTracker: () => null,
      },
      {
        id: "local-sherpa-onnx",
        label: "Local sherpa-onnx Streaming",
        kind: "local-sherpa-onnx",
        availability: "ready",
        createTracker(recordingId) {
          tracker.recordingId = recordingId;
          return tracker;
        },
      },
    ],
    logger: {
      isEnabled: () => true,
      debug: (...entry) => logs.push(entry),
    },
  });

  const providers = service.listProviders();
  assert.equal(providers[0].id, "local-sherpa-onnx");
  assert.equal(providers[0].availability, "disabled");
  assert.equal(providers[1].id, "local-sherpa-onnx");
  assert.equal(typeof providers[1].createTracker, "undefined");

  const selected = await service.createTracker("take-1");
  assert.equal(selected, tracker);
  assert.equal(selected.recordingId, "take-1");
  assert.equal(selected.providerId, "local-sherpa-onnx");
  assert.equal(selected.providerLabel, "Local sherpa-onnx Streaming");
  assert.equal(logs.some((entry) => entry[1] === "narration-follow.live-speech-provider-skipped"), true);
  assert.equal(logs.some((entry) => entry[1] === "narration-follow.live-speech-provider-selected"), true);

  const missingService = createNarrationLiveSpeechTrackerService({
    providers: [
      {
        id: "local-sherpa-onnx",
        label: "Local sherpa-onnx Streaming",
        kind: "local-sherpa-onnx",
        availability: "disabled",
        createTracker: () => null,
      },
    ],
    logger: {
      isEnabled: () => true,
      debug: (...entry) => logs.push(entry),
    },
  });
  assert.equal(await missingService.createTracker("take-2"), null);
  assert.equal(logs.some((entry) => entry[1] === "narration-follow.live-speech-provider-missing"), true);

  const compositeEvents = [];
  const compositeService = createNarrationLiveSpeechTrackerService({
    providers: [
      createPrimaryLiveWithCleanupTrackerProvider({
        primaryProvider: {
          id: "browser-web-speech",
          label: "Browser Web Speech",
          kind: "browser-web-speech",
          availability: "ready",
          createTracker: () => ({
            start: () => compositeEvents.push("primary.start"),
            stop: () => compositeEvents.push("primary.stop"),
            finalizeTranscript: async () => "browser transcript",
          }),
        },
        cleanupProvider: {
          id: "local-sherpa-onnx",
          label: "Local sherpa-onnx Streaming",
          kind: "local-sherpa-onnx",
          availability: "ready",
          createTracker: () => ({
            start: () => compositeEvents.push("cleanup.start"),
            stop: () => compositeEvents.push("cleanup.stop"),
            finalizeTranscript: async () => "cleanup transcript",
          }),
        },
        label: "Browser Web Speech + local cleanup",
      }),
    ],
  });
  const compositeTracker = await compositeService.createTracker("take-3");
  assert.equal(compositeTracker.providerId, "browser-web-speech");
  assert.equal(compositeTracker.providerLabel, "Browser Web Speech + local cleanup");
  compositeTracker.start();
  compositeTracker.stop();
  assert.equal(await compositeTracker.finalizeTranscript(), "cleanup transcript");
  assert.deepEqual(compositeEvents, ["cleanup.start", "primary.start", "primary.stop", "cleanup.stop"]);
}
