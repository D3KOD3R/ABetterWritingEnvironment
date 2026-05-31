// Intent: verify narration recorder resource cleanup is owned outside app.js.
import assert from "node:assert/strict";

import { createNarrationRecordingRuntimeService } from "../apps/editor/public/features/narration/narration-recording-runtime-service.js";

export function runNarrationRecordingRuntimeServiceTest() {
  const events = [];
  const speechRecognition = {
    onresult: () => {},
    onerror: () => {},
    onend: () => {},
    stop() {
      events.push("speech.stop");
    },
  };
  const stream = {
    getTracks() {
      return [
        {
          stop() {
            events.push("track.one.stop");
          },
        },
        {
          stop() {
            events.push("track.two.stop");
          },
        },
      ];
    },
  };
  const service = createNarrationRecordingRuntimeService({
    clearIntervalFn: (timerId) => events.push(`timer.clear:${timerId}`),
  });

  const result = service.cleanupRuntime({
    timerId: 42,
    speechRecognition,
    stream,
  }, {
    additionalStream: stream,
  });

  assert.deepEqual(result, {
    clearedTimer: true,
    stoppedSpeechRecognition: true,
    stoppedTracks: 2,
  });
  assert.equal(speechRecognition.onresult, null);
  assert.equal(speechRecognition.onerror, null);
  assert.equal(speechRecognition.onend, null);
  assert.deepEqual(events, [
    "timer.clear:42",
    "speech.stop",
    "track.one.stop",
    "track.two.stop",
  ]);

  const externalStream = {
    getTracks() {
      return [{
        stop() {
          events.push("external.track.stop");
        },
      }];
    },
  };
  const externalOnly = service.cleanupRuntime(null, {
    additionalStream: externalStream,
  });
  assert.equal(externalOnly.clearedTimer, false);
  assert.equal(externalOnly.stoppedSpeechRecognition, false);
  assert.equal(externalOnly.stoppedTracks, 1);
}
