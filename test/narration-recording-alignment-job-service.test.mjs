// Intent: verify saved-take alignment jobs can be shared and awaited before project persistence.
import assert from "node:assert/strict";

import { createNarrationRecordingAlignmentJobService } from "../apps/editor/public/features/narration/narration-recording-alignment-job-service.js";

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

export async function runNarrationRecordingAlignmentJobServiceTest() {
  const alignmentDeferred = createDeferred();
  const logEntries = [];
  let runCount = 0;
  const service = createNarrationRecordingAlignmentJobService({
    runAlignment: async (recordingId, options) => {
      runCount += 1;
      assert.equal(recordingId, "take-1");
      assert.equal(options.force, true);
      return alignmentDeferred.promise;
    },
    reportLog: (level, scope, message, context) => {
      logEntries.push({ level, scope, message, context });
    },
  });

  const firstStart = service.start("take-1", { force: true });
  const secondStart = service.start(" take-1 ", { force: false });
  assert.deepEqual(service.getPendingRecordingIds(), ["take-1"]);
  assert.equal(runCount, 0);

  await Promise.resolve();
  assert.equal(runCount, 1);
  const waitPromise = service.waitForPending({ reason: "cleanup-save" });
  assert.equal(logEntries[0].message, "Waiting for saved take transcript word timing alignment before project save.");
  assert.deepEqual(logEntries[0].context.recordingIds, ["take-1"]);

  const alignment = { status: "ready", wordTimings: [{ text: "alpha" }] };
  alignmentDeferred.resolve(alignment);
  assert.equal(await firstStart, alignment);
  assert.equal(await secondStart, alignment);
  const waitResult = await waitPromise;
  assert.equal(waitResult.length, 1);
  assert.equal(waitResult[0].status, "fulfilled");
  assert.deepEqual(service.getPendingRecordingIds(), []);
  assert.equal(logEntries.at(-1).message, "Saved take transcript word timing alignment wait finished.");

  const failedService = createNarrationRecordingAlignmentJobService({
    runAlignment: async () => {
      throw new Error("alignment failed");
    },
  });
  await assert.rejects(() => failedService.start("take-failed"), /alignment failed/);
  assert.deepEqual(failedService.getPendingRecordingIds(), []);
}
