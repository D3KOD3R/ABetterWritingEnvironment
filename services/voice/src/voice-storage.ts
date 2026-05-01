import type { NarrationJob } from "./narration-job.ts";
import { normalizeNarrationJobs } from "./narration-job.ts";
import type { VoiceProfile } from "./voice-profile.ts";
import { normalizeVoiceProfiles } from "./voice-profile.ts";

export const VOICE_NARRATION_STORAGE_KEY = "abe-voice-narration-v1";

export interface VoiceNarrationStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface VoiceNarrationStorageSnapshot {
  version: 1;
  voiceProfiles: VoiceProfile[];
  narrationJobs: NarrationJob[];
  selectedVoiceProfileId?: string;
  updatedAt: string;
}

export function loadVoiceProfiles(storage: VoiceNarrationStorageLike | undefined): VoiceProfile[] {
  return loadVoiceNarrationSnapshot(storage).voiceProfiles;
}

export function saveVoiceProfiles(
  storage: VoiceNarrationStorageLike | undefined,
  voiceProfiles: VoiceProfile[],
  now?: string,
): void {
  persistVoiceNarrationSnapshot(storage, {
    ...loadVoiceNarrationSnapshot(storage),
    voiceProfiles: normalizeVoiceProfiles(voiceProfiles),
    updatedAt: resolveNow(now),
  });
}

export function loadNarrationJobs(storage: VoiceNarrationStorageLike | undefined): NarrationJob[] {
  return loadVoiceNarrationSnapshot(storage).narrationJobs;
}

export function saveNarrationJobs(
  storage: VoiceNarrationStorageLike | undefined,
  narrationJobs: NarrationJob[],
  now?: string,
): void {
  persistVoiceNarrationSnapshot(storage, {
    ...loadVoiceNarrationSnapshot(storage),
    narrationJobs: normalizeNarrationJobs(narrationJobs),
    updatedAt: resolveNow(now),
  });
}

export function loadVoiceNarrationSnapshot(
  storage: VoiceNarrationStorageLike | undefined,
): VoiceNarrationStorageSnapshot {
  if (!storage) {
    return createEmptySnapshot();
  }

  const raw = safeRead(storage, VOICE_NARRATION_STORAGE_KEY);
  if (!raw) {
    return createEmptySnapshot();
  }

  try {
    const candidate = JSON.parse(raw);
    return normalizeSnapshot(candidate);
  } catch {
    return createEmptySnapshot();
  }
}

export function saveVoiceNarrationSnapshot(
  storage: VoiceNarrationStorageLike | undefined,
  snapshot: VoiceNarrationStorageSnapshot,
): void {
  persistVoiceNarrationSnapshot(storage, normalizeSnapshot(snapshot));
}

function persistVoiceNarrationSnapshot(
  storage: VoiceNarrationStorageLike | undefined,
  snapshot: VoiceNarrationStorageSnapshot,
): void {
  if (!storage) {
    return;
  }

  const safeSnapshot = normalizeSnapshot(snapshot);
  storage.setItem(VOICE_NARRATION_STORAGE_KEY, JSON.stringify(safeSnapshot));
}

function normalizeSnapshot(candidate: unknown): VoiceNarrationStorageSnapshot {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return createEmptySnapshot();
  }

  const voiceProfiles = normalizeVoiceProfiles((candidate as Record<string, unknown>).voiceProfiles);
  const narrationJobs = normalizeNarrationJobs((candidate as Record<string, unknown>).narrationJobs);
  const selectedVoiceProfileId = normalizeOptionalString(
    (candidate as Record<string, unknown>).selectedVoiceProfileId,
  );
  const updatedAt =
    typeof (candidate as Record<string, unknown>).updatedAt === "string" &&
    (candidate as Record<string, unknown>).updatedAt.trim()
      ? (candidate as Record<string, unknown>).updatedAt.trim()
      : new Date(0).toISOString();

  return {
    version: 1,
    voiceProfiles,
    narrationJobs,
    ...(selectedVoiceProfileId ? { selectedVoiceProfileId } : {}),
    updatedAt,
  };
}

function createEmptySnapshot(): VoiceNarrationStorageSnapshot {
  return {
    version: 1,
    voiceProfiles: [],
    narrationJobs: [],
    updatedAt: new Date(0).toISOString(),
  };
}

function safeRead(storage: VoiceNarrationStorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function resolveNow(now?: string): string {
  return now ?? new Date().toISOString();
}

function normalizeOptionalString(candidate: unknown): string | undefined {
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}
