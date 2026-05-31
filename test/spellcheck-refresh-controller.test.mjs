// Intent: verify spellcheck refresh scheduling is feature-owned and effect-injected.
import assert from "node:assert/strict";

import {
  createSpellcheckRefreshController,
} from "../apps/editor/public/features/spellcheck/spellcheck-refresh-controller.js";

export function runSpellcheckRefreshControllerTest() {
  const clearedTimers = [];
  const scheduledTimers = [];
  const flushedScenes = [];
  let nextTimerId = 1;
  const controller = createSpellcheckRefreshController({
    delayMs: 180,
    setTimeoutRef: (callback, delayMs) => {
      const timer = {
        id: nextTimerId,
        callback,
        delayMs,
      };
      nextTimerId += 1;
      scheduledTimers.push(timer);
      return timer.id;
    },
    clearTimeoutRef: (timerId) => {
      clearedTimers.push(timerId);
    },
    onFlush: (sceneId) => {
      flushedScenes.push(sceneId);
    },
  });

  assert.equal(controller.schedule("scene-1"), true);
  assert.deepEqual(controller.getSnapshot(), {
    hasPendingRefresh: true,
    sceneId: "scene-1",
  });
  assert.equal(scheduledTimers[0].delayMs, 180);

  assert.equal(controller.schedule("scene-2"), true);
  assert.deepEqual(clearedTimers, [1]);
  assert.equal(controller.getSnapshot().sceneId, "scene-2");

  scheduledTimers[1].callback();
  assert.deepEqual(flushedScenes, ["scene-2"]);
  assert.deepEqual(controller.getSnapshot(), {
    hasPendingRefresh: false,
    sceneId: "scene-2",
  });

  assert.equal(controller.schedule("scene-3", { enabled: false }), false);
  assert.equal(controller.getSnapshot().sceneId, "scene-2");

  controller.schedule("scene-4");
  controller.clear();
  assert.deepEqual(clearedTimers, [1, 3]);
  assert.equal(controller.getSnapshot().hasPendingRefresh, false);
}
