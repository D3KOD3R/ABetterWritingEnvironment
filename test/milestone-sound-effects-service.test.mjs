// Intent: verify milestone sound preferences, threshold detection, and browser-audio scheduling stay outside app shell code.
import assert from "node:assert/strict";

import {
  MILESTONE_SOUND_EFFECT_TYPES,
  createMilestoneSoundEffectsService,
  isMilestoneSoundEffectsEnabled,
  normalizeMilestoneSoundEffectsEnabled,
  selectWritingGoalMilestoneSoundEffects,
} from "../apps/editor/public/features/milestone-sounds/milestone-sound-effects-service.js";

export function runMilestoneSoundEffectsServiceTest() {
  assert.equal(normalizeMilestoneSoundEffectsEnabled(undefined), true);
  assert.equal(normalizeMilestoneSoundEffectsEnabled(false), false);
  assert.equal(isMilestoneSoundEffectsEnabled({ milestoneSoundEffectsEnabled: false }), false);
  assert.equal(isMilestoneSoundEffectsEnabled({}), true);

  const sessionEffects = selectWritingGoalMilestoneSoundEffects({
    currentRecord: {
      sessionTargetWords: 1000,
      sessionsPerDay: 2,
      sessionBaselineWordCount: 2000,
      dailyBaselineDateKey: "2026-07-21",
      dailyBaselineWordCount: 2000,
      targetCadence: "daily",
    },
    previousWordCount: 2498,
    currentWordCount: 2501,
    todayKey: "2026-07-21",
  });
  assert.deepEqual(sessionEffects.map((effect) => effect.type), [MILESTONE_SOUND_EFFECT_TYPES.SESSION_GOAL]);
  assert.equal(sessionEffects[0].targetWords, 500);
  assert.equal(sessionEffects[0].milestoneIndex, 1);

  const dailyEffects = selectWritingGoalMilestoneSoundEffects({
    currentRecord: {
      sessionTargetWords: 7000,
      sessionsPerDay: 1,
      sessionBaselineWordCount: 10000,
      dailyBaselineDateKey: "2026-07-21",
      dailyBaselineWordCount: 10000,
      targetCadence: "weekly",
    },
    previousWordCount: 10990,
    currentWordCount: 11005,
    todayKey: "2026-07-21",
  });
  assert.deepEqual(dailyEffects.map((effect) => effect.type), [MILESTONE_SOUND_EFFECT_TYPES.DAILY_TARGET]);
  assert.equal(dailyEffects[0].targetWords, 1000);

  const sameTargetEffects = selectWritingGoalMilestoneSoundEffects({
    currentRecord: {
      sessionTargetWords: 1000,
      sessionsPerDay: 1,
      sessionBaselineWordCount: 500,
      dailyBaselineDateKey: "2026-07-21",
      dailyBaselineWordCount: 500,
      targetCadence: "daily",
    },
    previousWordCount: 1501,
    currentWordCount: 1510,
    todayKey: "2026-07-21",
  });
  assert.deepEqual(sameTargetEffects, []);

  const unsetTargetEffects = selectWritingGoalMilestoneSoundEffects({
    currentRecord: {
      sessionTargetWords: 0,
      sessionsPerDay: 1,
      sessionBaselineWordCount: 0,
      dailyBaselineDateKey: "2026-07-21",
      dailyBaselineWordCount: 0,
      targetCadence: "daily",
    },
    previousWordCount: 0,
    currentWordCount: 3,
    todayKey: "2026-07-21",
  });
  assert.deepEqual(unsetTargetEffects, []);

  const disabledContext = new FakeAudioContext();
  const disabledService = createMilestoneSoundEffectsService({
    AudioContextConstructor: class extends FakeAudioContext {
      constructor() {
        super(disabledContext);
      }
    },
  });
  assert.deepEqual(
    disabledService.playMilestoneSoundEffect(MILESTONE_SOUND_EFFECT_TYPES.CATALOGUE_ITEM, { enabled: false }),
    { played: false, reason: "disabled", type: MILESTONE_SOUND_EFFECT_TYPES.CATALOGUE_ITEM },
  );
  assert.equal(disabledContext.oscillators.length, 0);

  const fakeContext = new FakeAudioContext();
  const service = createMilestoneSoundEffectsService({
    AudioContextConstructor: class extends FakeAudioContext {
      constructor() {
        super(fakeContext);
      }
    },
  });
  const results = service.playMilestoneSoundEffects([
    MILESTONE_SOUND_EFFECT_TYPES.CATALOGUE_ITEM,
    { type: MILESTONE_SOUND_EFFECT_TYPES.SESSION_GOAL },
  ]);
  assert.equal(results.every((result) => result.played), true);
  assert.equal(fakeContext.oscillators.length, 5);
  assert.equal(fakeContext.oscillators[0].type, "sine");
  assert.equal(fakeContext.oscillators[0].startedAt, 1);
  assert.equal(fakeContext.oscillators.at(-1).startedAt > fakeContext.oscillators[0].startedAt, true);
}

class FakeAudioParam {
  constructor() {
    this.events = [];
    this.value = 0;
  }

  setValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: "set", value, time });
  }

  exponentialRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: "ramp", value, time });
  }
}

class FakeAudioNode {
  constructor() {
    this.connections = [];
  }

  connect(target) {
    this.connections.push(target);
    return target;
  }
}

class FakeOscillatorNode extends FakeAudioNode {
  constructor() {
    super();
    this.frequency = new FakeAudioParam();
    this.type = "";
    this.startedAt = null;
    this.stoppedAt = null;
  }

  start(time) {
    this.startedAt = time;
  }

  stop(time) {
    this.stoppedAt = time;
  }
}

class FakeGainNode extends FakeAudioNode {
  constructor() {
    super();
    this.gain = new FakeAudioParam();
  }
}

class FakeAudioContext {
  constructor(shared = null) {
    if (shared) {
      return shared;
    }
    this.currentTime = 1;
    this.state = "running";
    this.destination = new FakeAudioNode();
    this.oscillators = [];
    this.gains = [];
  }

  createOscillator() {
    const oscillator = new FakeOscillatorNode();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain() {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain;
  }

  resume() {
    this.state = "running";
    return Promise.resolve();
  }
}
