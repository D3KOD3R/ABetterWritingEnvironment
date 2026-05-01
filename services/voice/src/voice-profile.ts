export type NarrationVoiceEngineType =
  | "local-placeholder"
  | "external-placeholder"
  | "rvc-placeholder"
  | "system-voice-placeholder";

export interface NarrationVoiceProfileSettings {
  [key: string]: unknown;
}

export interface VoiceProfile {
  id: string;
  displayName: string;
  engineType: NarrationVoiceEngineType;
  language: string;
  accent: string;
  genderLabel?: string;
  voiceStyleLabel?: string;
  description: string;
  sampleAudioRef?: string;
  settings: NarrationVoiceProfileSettings;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVoiceProfileInput {
  id: string;
  displayName: string;
  engineType: NarrationVoiceEngineType;
  language?: string;
  accent?: string;
  genderLabel?: string;
  voiceStyleLabel?: string;
  description?: string;
  sampleAudioRef?: string;
  settings?: NarrationVoiceProfileSettings;
  now?: string;
}

const ENGINE_TYPES = new Set<NarrationVoiceEngineType>([
  "local-placeholder",
  "external-placeholder",
  "rvc-placeholder",
  "system-voice-placeholder",
]);

export function createVoiceProfile(input: CreateVoiceProfileInput): VoiceProfile {
  const id = nonEmpty(input.id, "Voice profile id");
  const displayName = nonEmpty(input.displayName, "Voice profile display name");
  const engineType = normalizeEngineType(input.engineType);

  if (!engineType) {
    throw new Error("Voice profile engine type must be one of the supported placeholder engines.");
  }

  const createdAt = resolveNow(input.now);

  return {
    id,
    displayName,
    engineType,
    language: normalizeOptionalString(input.language) ?? "und",
    accent: normalizeOptionalString(input.accent) ?? "neutral",
    ...(normalizeOptionalString(input.genderLabel)
      ? { genderLabel: normalizeOptionalString(input.genderLabel) }
      : {}),
    ...(normalizeOptionalString(input.voiceStyleLabel)
      ? { voiceStyleLabel: normalizeOptionalString(input.voiceStyleLabel) }
      : {}),
    description: normalizeOptionalString(input.description) ?? "",
    ...(normalizeOptionalString(input.sampleAudioRef)
      ? { sampleAudioRef: normalizeOptionalString(input.sampleAudioRef) }
      : {}),
    settings: normalizeSettings(input.settings),
    createdAt,
    updatedAt: createdAt,
  };
}

export function createDemoVoiceProfiles(now?: string): VoiceProfile[] {
  return [
    createVoiceProfile({
      id: "voice-profile-lantern",
      displayName: "Lantern Narrator",
      engineType: "local-placeholder",
      language: "en",
      accent: "neutral",
      voiceStyleLabel: "Measured documentary warmth",
      description: "Local narration placeholder for long-form manuscript reading.",
      settings: {
        pace: 0.96,
        warmth: 0.72,
      },
      now,
    }),
    createVoiceProfile({
      id: "voice-profile-harbor",
      displayName: "Harbor External",
      engineType: "external-placeholder",
      language: "en",
      accent: "australian",
      voiceStyleLabel: "Bright provider placeholder",
      description: "Represents an external narration provider without real connectivity yet.",
      settings: {
        providerHint: "external-demo",
      },
      now,
    }),
    createVoiceProfile({
      id: "voice-profile-iron",
      displayName: "Iron System Voice",
      engineType: "system-voice-placeholder",
      language: "en",
      accent: "general",
      genderLabel: "neutral",
      voiceStyleLabel: "Plain OS fallback",
      description: "Uses the operating system voice slot as a placeholder contract.",
      settings: {
        fallback: true,
      },
      now,
    }),
    createVoiceProfile({
      id: "voice-profile-rift",
      displayName: "Rift Conversion",
      engineType: "rvc-placeholder",
      language: "en",
      accent: "neutral",
      voiceStyleLabel: "Performance conversion placeholder",
      description: "Represents a future voice-conversion pipeline without any model integration.",
      settings: {
        conversionMode: "stub",
      },
      now,
    }),
  ];
}

export function normalizeVoiceProfile(candidate: unknown): VoiceProfile | null {
  if (!isRecord(candidate)) {
    return null;
  }

  const id = normalizeRequiredString(candidate.id);
  const displayName = normalizeRequiredString(candidate.displayName);
  const engineType = normalizeEngineType(candidate.engineType);

  if (!id || !displayName || !engineType) {
    return null;
  }

  const createdAt = normalizeOptionalString(candidate.createdAt) ?? new Date(0).toISOString();
  const updatedAt = normalizeOptionalString(candidate.updatedAt) ?? createdAt;
  const profile: VoiceProfile = {
    id,
    displayName,
    engineType,
    language: normalizeOptionalString(candidate.language) ?? "und",
    accent: normalizeOptionalString(candidate.accent) ?? "neutral",
    ...(normalizeOptionalString(candidate.genderLabel)
      ? { genderLabel: normalizeOptionalString(candidate.genderLabel) }
      : {}),
    ...(normalizeOptionalString(candidate.voiceStyleLabel)
      ? { voiceStyleLabel: normalizeOptionalString(candidate.voiceStyleLabel) }
      : {}),
    description: normalizeOptionalString(candidate.description) ?? "",
    ...(normalizeOptionalString(candidate.sampleAudioRef)
      ? { sampleAudioRef: normalizeOptionalString(candidate.sampleAudioRef) }
      : {}),
    settings: normalizeSettings(candidate.settings),
    createdAt,
    updatedAt,
  };

  return cloneVoiceProfile(profile);
}

export function normalizeVoiceProfiles(candidate: unknown): VoiceProfile[] {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map((item) => normalizeVoiceProfile(item))
    .filter((item): item is VoiceProfile => item !== null)
    .map((profile) => cloneVoiceProfile(profile));
}

export function cloneVoiceProfile(profile: VoiceProfile): VoiceProfile {
  return {
    ...profile,
    settings: { ...profile.settings },
    ...(profile.genderLabel ? { genderLabel: profile.genderLabel } : {}),
    ...(profile.voiceStyleLabel ? { voiceStyleLabel: profile.voiceStyleLabel } : {}),
    ...(profile.sampleAudioRef ? { sampleAudioRef: profile.sampleAudioRef } : {}),
  };
}

function normalizeEngineType(candidate: unknown): NarrationVoiceEngineType | null {
  if (typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();
  return ENGINE_TYPES.has(trimmed as NarrationVoiceEngineType)
    ? (trimmed as NarrationVoiceEngineType)
    : null;
}

function normalizeOptionalString(candidate: unknown): string | undefined {
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}

function normalizeRequiredString(candidate: unknown): string | null {
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

function normalizeSettings(candidate: unknown): NarrationVoiceProfileSettings {
  if (!isRecord(candidate)) {
    return {};
  }

  return { ...candidate };
}

function nonEmpty(value: string, label: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${label} cannot be empty.`);
  }

  return trimmed;
}

function resolveNow(now?: string): string {
  return now ?? new Date().toISOString();
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return Boolean(candidate) && typeof candidate === "object" && !Array.isArray(candidate);
}
