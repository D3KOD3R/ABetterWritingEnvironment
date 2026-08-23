// Intent: own lightweight browser sound feedback for author milestones without persisting audio runtime state.

export const MILESTONE_SOUND_EFFECT_TYPES = Object.freeze({
  CATALOGUE_ITEM: "catalogue-item",
  SESSION_GOAL: "session-goal",
  DAILY_TARGET: "daily-target",
});

const SOUND_SEQUENCES = Object.freeze({
  [MILESTONE_SOUND_EFFECT_TYPES.CATALOGUE_ITEM]: [
    { frequency: 660, offset: 0, duration: 0.08, gain: 0.035 },
    { frequency: 880, offset: 0.075, duration: 0.11, gain: 0.04 },
  ],
  [MILESTONE_SOUND_EFFECT_TYPES.SESSION_GOAL]: [
    { frequency: 523.25, offset: 0, duration: 0.07, gain: 0.032 },
    { frequency: 659.25, offset: 0.065, duration: 0.08, gain: 0.036 },
    { frequency: 783.99, offset: 0.135, duration: 0.12, gain: 0.04 },
  ],
  [MILESTONE_SOUND_EFFECT_TYPES.DAILY_TARGET]: [
    { frequency: 587.33, offset: 0, duration: 0.08, gain: 0.034 },
    { frequency: 739.99, offset: 0.08, duration: 0.09, gain: 0.038 },
    { frequency: 987.77, offset: 0.165, duration: 0.14, gain: 0.042 },
  ],
});

const CADENCE_DAYS = Object.freeze({
  daily: 1,
  weekly: 7,
});

export function normalizeMilestoneSoundEffectsEnabled(candidate, fallback = true) {
  if (typeof candidate === "boolean") {
    return candidate;
  }
  return fallback !== false;
}

export function isMilestoneSoundEffectsEnabled(editorPrefs = {}) {
  return normalizeMilestoneSoundEffectsEnabled(editorPrefs?.milestoneSoundEffectsEnabled, true);
}

// Intent: detect writing-goal threshold crossings from stable word counts rather than render labels.
export function selectWritingGoalMilestoneSoundEffects({
  previousRecord = null,
  currentRecord = null,
  previousWordCount = 0,
  currentWordCount = 0,
  todayKey = "",
} = {}) {
  const previousCount = normalizeWordCount(previousWordCount);
  const currentCount = normalizeWordCount(currentWordCount);
  if (currentCount <= previousCount) {
    return [];
  }

  const record = normalizeMilestoneWritingTargetRecord(currentRecord ?? previousRecord);
  const events = [];
  const sessionMilestone = selectSessionGoalMilestone({
    record,
    previousWordCount: previousCount,
    currentWordCount: currentCount,
  });
  if (sessionMilestone) {
    events.push(sessionMilestone);
  }

  const dailyMilestone = selectDailyTargetMilestone({
    record,
    previousWordCount: previousCount,
    currentWordCount: currentCount,
    todayKey,
  });
  if (dailyMilestone) {
    events.push(dailyMilestone);
  }

  return events;
}

export function createMilestoneSoundEffectsService({
  AudioContextConstructor = null,
  logger = null,
} = {}) {
  let audioContext = null;

  function getAudioContext() {
    if (audioContext) {
      return audioContext;
    }

    const Constructor = resolveAudioContextConstructor(AudioContextConstructor);
    if (!Constructor) {
      return null;
    }

    audioContext = new Constructor();
    return audioContext;
  }

  function playMilestoneSoundEffect(type, options = {}) {
    const enabled = normalizeMilestoneSoundEffectsEnabled(options.enabled, true);
    if (!enabled) {
      return { played: false, reason: "disabled", type: normalizeMilestoneSoundEffectType(type) };
    }

    const normalizedType = normalizeMilestoneSoundEffectType(type);
    const sequence = SOUND_SEQUENCES[normalizedType];
    if (!sequence) {
      return { played: false, reason: "unknown-type", type: normalizedType };
    }

    const context = getAudioContext();
    if (!context) {
      return { played: false, reason: "audio-unavailable", type: normalizedType };
    }

    try {
      if (context.state === "suspended" && typeof context.resume === "function") {
        Promise.resolve(context.resume()).catch((error) => {
          logger?.warn?.("runtime", "milestone-sound.resume-failed", "Milestone sound context could not resume.", {
            error: error?.message ?? String(error),
          });
        });
      }
      scheduleSoundSequence(context, sequence, Number(options.startOffset) || 0);
      return { played: true, reason: "played", type: normalizedType, noteCount: sequence.length };
    } catch (error) {
      logger?.warn?.("runtime", "milestone-sound.play-failed", "Milestone sound could not play.", {
        type: normalizedType,
        error: error?.message ?? String(error),
      });
      return { played: false, reason: "play-failed", type: normalizedType };
    }
  }

  function playMilestoneSoundEffects(effects = [], options = {}) {
    return normalizeMilestoneSoundEffectList(effects).map((effect, index) =>
      playMilestoneSoundEffect(effect.type ?? effect, {
        ...options,
        startOffset: (Number(options.startOffset) || 0) + (index * 0.24),
      }),
    );
  }

  return {
    playMilestoneSoundEffect,
    playMilestoneSoundEffects,
  };
}

function selectSessionGoalMilestone({ record, previousWordCount, currentWordCount }) {
  const sessionTargetWords = normalizePositiveNumber(record.sessionTargetWords, 0);
  if (sessionTargetWords <= 0) {
    return null;
  }

  const sessionsPerDay = Math.max(1, Math.round(normalizePositiveNumber(record.sessionsPerDay, 1)));
  const targetPerSession = Math.max(1, Math.round(sessionTargetWords / sessionsPerDay));

  const sessionBaseline = normalizeWordCount(record.sessionBaselineWordCount);
  const previousSessionWords = Math.max(0, previousWordCount - sessionBaseline);
  const currentSessionWords = Math.max(0, currentWordCount - sessionBaseline);
  const previousCompleted = Math.min(sessionsPerDay, Math.floor(previousSessionWords / targetPerSession));
  const currentCompleted = Math.min(sessionsPerDay, Math.floor(currentSessionWords / targetPerSession));
  if (currentCompleted <= previousCompleted) {
    return null;
  }

  return {
    type: MILESTONE_SOUND_EFFECT_TYPES.SESSION_GOAL,
    milestoneIndex: currentCompleted,
    targetWords: targetPerSession,
    currentWords: currentSessionWords,
  };
}

function selectDailyTargetMilestone({ record, previousWordCount, currentWordCount, todayKey }) {
  const cadenceDays = CADENCE_DAYS[normalizeString(record.targetCadence)] ?? CADENCE_DAYS.daily;
  const sessionTargetWords = normalizePositiveNumber(record.sessionTargetWords, 0);
  if (sessionTargetWords <= 0) {
    return null;
  }

  const dailyTargetWords = Math.max(1, Math.round(sessionTargetWords / cadenceDays));

  const normalizedTodayKey = normalizeString(todayKey);
  const storedBaselineDateKey = normalizeString(record.dailyBaselineDateKey);
  const dailyBaseline = storedBaselineDateKey && storedBaselineDateKey === normalizedTodayKey
    ? normalizeWordCount(record.dailyBaselineWordCount)
    : previousWordCount;
  const previousDailyWords = Math.max(0, previousWordCount - dailyBaseline);
  const currentDailyWords = Math.max(0, currentWordCount - dailyBaseline);
  if (previousDailyWords >= dailyTargetWords || currentDailyWords < dailyTargetWords) {
    return null;
  }

  return {
    type: MILESTONE_SOUND_EFFECT_TYPES.DAILY_TARGET,
    targetWords: dailyTargetWords,
    currentWords: currentDailyWords,
  };
}

function scheduleSoundSequence(context, sequence, startOffset = 0) {
  const startTime = Math.max(0, Number(context.currentTime) || 0) + Math.max(0, startOffset);
  sequence.forEach((note) => {
    scheduleTone(context, {
      frequency: note.frequency,
      startTime: startTime + note.offset,
      duration: note.duration,
      gain: note.gain,
    });
  });
}

function scheduleTone(context, { frequency, startTime, duration, gain }) {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  oscillator.type = "sine";
  setAudioParamValue(oscillator.frequency, frequency, startTime);
  setAudioParamValue(gainNode.gain, 0.0001, startTime);
  rampAudioParamValue(gainNode.gain, gain, startTime + 0.014);
  rampAudioParamValue(gainNode.gain, 0.0001, startTime + duration);
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.025);
}

function setAudioParamValue(param, value, time) {
  if (typeof param?.setValueAtTime === "function") {
    param.setValueAtTime(value, time);
    return;
  }
  if (param && "value" in param) {
    param.value = value;
  }
}

function rampAudioParamValue(param, value, time) {
  if (typeof param?.exponentialRampToValueAtTime === "function") {
    param.exponentialRampToValueAtTime(Math.max(0.0001, value), time);
    return;
  }
  setAudioParamValue(param, value, time);
}

function normalizeMilestoneWritingTargetRecord(record = {}) {
  const source = record && typeof record === "object" && !Array.isArray(record) ? record : {};
  return {
    sessionTargetWords: normalizePositiveNumber(source.sessionTargetWords, 0),
    sessionsPerDay: normalizePositiveNumber(source.sessionsPerDay, 1),
    sessionBaselineWordCount: normalizeWordCount(source.sessionBaselineWordCount),
    dailyBaselineDateKey: normalizeString(source.dailyBaselineDateKey),
    dailyBaselineWordCount: normalizeWordCount(source.dailyBaselineWordCount),
    targetCadence: normalizeString(source.targetCadence) === "weekly" ? "weekly" : "daily",
  };
}

function normalizeMilestoneSoundEffectType(type) {
  const normalized = normalizeString(type);
  return Object.values(MILESTONE_SOUND_EFFECT_TYPES).includes(normalized)
    ? normalized
    : "";
}

function normalizeMilestoneSoundEffectList(effects = []) {
  return (Array.isArray(effects) ? effects : [effects])
    .map((effect) => {
      const type = normalizeMilestoneSoundEffectType(effect?.type ?? effect);
      return type ? { ...(effect && typeof effect === "object" ? effect : {}), type } : null;
    })
    .filter(Boolean);
}

function resolveAudioContextConstructor(explicitConstructor = null) {
  if (explicitConstructor) {
    return explicitConstructor;
  }
  return globalThis?.AudioContext ?? globalThis?.webkitAudioContext ?? null;
}

function normalizePositiveNumber(candidate, fallback = 0) {
  const value = Math.round(Number(candidate));
  if (!Number.isFinite(value) || value <= 0) {
    return Math.max(0, Math.round(Number(fallback) || 0));
  }
  return value;
}

function normalizeWordCount(candidate) {
  const value = Math.round(Number(candidate));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizeString(value) {
  return String(value ?? "").trim();
}
