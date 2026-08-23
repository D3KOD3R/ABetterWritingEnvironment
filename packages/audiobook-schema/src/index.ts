// Intent: define the audiobook recording data model without coupling live narration follow to editing/rendering workflows.
import type { ManuscriptAnchor } from "../../manuscript-schema/src/index.ts";

export type AudiobookChapterStatus =
  | "draft"
  | "recording"
  | "review"
  | "ready-to-render"
  | "rendered";

export type AudiobookSectionType =
  | "user-defined"
  | "scene"
  | "beat"
  | "paragraph"
  | "opening-credit"
  | "closing-credit";

export type AudiobookRecordingStatus =
  | "not-recorded"
  | "recorded"
  | "needs-review"
  | "approved"
  | "needs-rerecording";

export type AudiobookClipStatus =
  | "recording"
  | "saved"
  | "failed"
  | "rejected"
  | "deleted";

export type AudiobookProductionKind =
  | "human-recording"
  | "voice-conversion"
  | "speech-synthesis"
  | "imported";

export type AudiobookProductionLane =
  | "human-source"
  | "narrator-master"
  | "character-conversion"
  | "speech-synthesis"
  | "rendered-master";

export type AudiobookPlaybackScope = "section" | "scene" | "chapter" | "book";

export interface AudiobookAudioFormat {
  container: "wav" | "flac" | "webm" | "ogg" | "mp3" | "m4a" | "unknown";
  codec: string;
  sampleRate: number;
  bitDepth?: number;
  channelCount: number;
  mimeType?: string;
}

export interface AudiobookBookMetadata {
  id: string;
  projectId: string;
  title: string;
  author: string;
  narrator: string;
  description: string;
  coverImagePath?: string;
  defaultRecordingFormat: AudiobookAudioFormat;
  defaultExportProfileId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AudiobookChapter {
  id: string;
  bookId: string;
  manuscriptChapterId: string;
  title: string;
  order: number;
  status: AudiobookChapterStatus;
  estimatedDurationMs: number;
  renderedAudioPath?: string;
}

export interface ManuscriptAudioSection {
  id: string;
  chapterId: string;
  manuscriptChapterId: string;
  sceneId: string;
  blockId?: string;
  paragraphId?: string;
  order: number;
  sectionType: AudiobookSectionType;
  sourceText: string;
  sourceTextStart: number;
  sourceTextEnd: number;
  sourceTextFingerprint: string;
  sourceAnchor?: ManuscriptAnchor;
  recordingStatus: AudiobookRecordingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AudiobookClipProductionRef {
  sourceClipId?: string;
  speakerAssignmentId?: string;
  characterId?: string;
  voiceProfileId?: string;
  conversionProfileId?: string;
}

export interface RecordingClip {
  id: string;
  sectionId: string;
  takeNumber: number;
  productionKind: AudiobookProductionKind;
  productionLane: AudiobookProductionLane;
  filePath: string;
  fileName: string;
  durationMs: number;
  format: AudiobookAudioFormat;
  status: AudiobookClipStatus;
  notes: string;
  productionRef: AudiobookClipProductionRef;
  createdAt: string;
  updatedAt: string;
}

export interface SectionTakeState {
  sectionId: string;
  takeCount: number;
  latestClipId?: string;
  selectedClipId?: string;
  approvedClipId?: string;
  approvalStatus: AudiobookRecordingStatus;
  updatedAt: string;
}

export interface TimelineItem {
  id: string;
  chapterId: string;
  sectionId: string;
  clipId: string;
  order: number;
  productionLane: AudiobookProductionLane;
  trimStartMs: number;
  trimEndMs: number;
  gainDb: number;
  fadeInMs: number;
  fadeOutMs: number;
  pauseBeforeMs: number;
  pauseAfterMs: number;
}

export interface AudiobookPlaybackSettings {
  defaultScope: AudiobookPlaybackScope;
  continueAcrossSections: boolean;
  continueAcrossScenes: boolean;
  rollingPreloadItemCount: number;
  stopAtSceneBoundary: boolean;
}

export interface AudiobookProjectModel {
  schemaVersion: "audiobook-recording-v1";
  book: AudiobookBookMetadata;
  chapters: AudiobookChapter[];
  sections: ManuscriptAudioSection[];
  clips: RecordingClip[];
  sectionTakeStates: SectionTakeState[];
  timelineItems: TimelineItem[];
  playbackSettings: AudiobookPlaybackSettings;
}

export interface LegacyNarrationRecordingRecord {
  id: string;
  projectId: string;
  chapterId: string;
  chapterTitle?: string;
  sceneId: string;
  sceneTitle?: string;
  blockId?: string;
  paragraphId?: string;
  lineNumber?: number;
  verseText?: string;
  transcript?: string;
  cleanupTranscript?: string;
  mediaPath?: string;
  mediaName?: string;
  mediaMimeType?: string;
  durationMs?: number;
  status?: "recorded" | "saved" | "failed";
  createdAt?: string;
  updatedAt?: string;
  startOffset?: number;
  endOffset?: number;
}

export interface CreateAudiobookProjectModelInput {
  projectId: string;
  title: string;
  author?: string;
  narrator?: string;
  description?: string;
  coverImagePath?: string;
  now?: string;
}

export interface LegacyAudiobookMigrationInput extends CreateAudiobookProjectModelInput {
  recordings: LegacyNarrationRecordingRecord[];
}

export const DEFAULT_AUDIOBOOK_RECORDING_FORMAT: AudiobookAudioFormat = Object.freeze({
  container: "wav",
  codec: "pcm-s24le",
  sampleRate: 48000,
  bitDepth: 24,
  channelCount: 1,
  mimeType: "audio/wav",
});

export const DEFAULT_AUDIOBOOK_PLAYBACK_SETTINGS: AudiobookPlaybackSettings = Object.freeze({
  defaultScope: "scene",
  continueAcrossSections: true,
  continueAcrossScenes: false,
  rollingPreloadItemCount: 3,
  stopAtSceneBoundary: true,
});

// Intent: create an empty project-owned audiobook model that can be populated without touching live recording code.
export function createAudiobookProjectModel(input: CreateAudiobookProjectModelInput): AudiobookProjectModel {
  const now = normalizeTimestamp(input.now);
  const projectId = normalizeRequiredText(input.projectId, "project");

  return {
    schemaVersion: "audiobook-recording-v1",
    book: {
      id: `book-${normalizeIdPart(projectId)}`,
      projectId,
      title: normalizeRequiredText(input.title, "Untitled Book"),
      author: normalizeText(input.author),
      narrator: normalizeText(input.narrator),
      description: normalizeText(input.description),
      coverImagePath: normalizeOptionalText(input.coverImagePath),
      defaultRecordingFormat: { ...DEFAULT_AUDIOBOOK_RECORDING_FORMAT },
      defaultExportProfileId: "editing-master-wav",
      createdAt: now,
      updatedAt: now,
    },
    chapters: [],
    sections: [],
    clips: [],
    sectionTakeStates: [],
    timelineItems: [],
    playbackSettings: { ...DEFAULT_AUDIOBOOK_PLAYBACK_SETTINGS },
  };
}

// Intent: preserve existing saved takes by mapping legacy voice recording records into explicit sections and clips.
export function migrateLegacyNarrationRecordingsToAudiobookModel(
  input: LegacyAudiobookMigrationInput,
): AudiobookProjectModel {
  const model = createAudiobookProjectModel(input);
  const now = normalizeTimestamp(input.now);
  const recordings = [...(Array.isArray(input.recordings) ? input.recordings : [])].sort(
    compareLegacyNarrationRecords,
  );
  const chaptersById = new Map<string, AudiobookChapter>();
  const sectionsById = new Map<string, ManuscriptAudioSection>();
  const clipsBySection = new Map<string, RecordingClip[]>();

  for (const recording of recordings) {
    const chapter = ensureAudiobookChapter(model, chaptersById, recording, now);
    const sectionId = buildLegacySectionId(recording);
    let section = sectionsById.get(sectionId);
    if (!section) {
      section = createSectionFromLegacyRecording(recording, chapter, sectionsById.size + 1, now);
      sectionsById.set(section.id, section);
      model.sections.push(section);
    }

    const sectionClips = clipsBySection.get(section.id) ?? [];
    const clip = createClipFromLegacyRecording(recording, section.id, sectionClips.length + 1, now);
    sectionClips.push(clip);
    clipsBySection.set(section.id, sectionClips);
    model.clips.push(clip);
  }

  for (const section of model.sections) {
    const sectionClips = clipsBySection.get(section.id) ?? [];
    const takeState = createSectionTakeState(section.id, sectionClips, now);
    model.sectionTakeStates.push(takeState);
    section.recordingStatus = takeState.approvalStatus;
    section.updatedAt = takeState.updatedAt;
  }

  model.timelineItems = createTimelineItemsFromSelectedTakes({
    sections: model.sections,
    clips: model.clips,
    sectionTakeStates: model.sectionTakeStates,
  });

  return model;
}

// Intent: build a chapter preview timeline from selected takes without duplicating or rewriting source clips.
export function createTimelineItemsFromSelectedTakes(input: {
  sections: ManuscriptAudioSection[];
  clips: RecordingClip[];
  sectionTakeStates: SectionTakeState[];
  productionLane?: AudiobookProductionLane;
}): TimelineItem[] {
  const clipsById = new Map((input.clips ?? []).map((clip) => [clip.id, clip]));
  const stateBySectionId = new Map((input.sectionTakeStates ?? []).map((state) => [state.sectionId, state]));
  const selectedLane = input.productionLane;
  const items: TimelineItem[] = [];

  for (const section of [...(input.sections ?? [])].sort(compareSectionsByChapterAndOrder)) {
    const state = stateBySectionId.get(section.id);
    const selectedClipId = state?.selectedClipId;
    const clip = selectedClipId ? clipsById.get(selectedClipId) : undefined;
    if (!clip) {
      continue;
    }
    if (selectedLane && clip.productionLane !== selectedLane) {
      continue;
    }

    items.push({
      id: `timeline-${normalizeIdPart(section.chapterId)}-${String(items.length + 1).padStart(4, "0")}`,
      chapterId: section.chapterId,
      sectionId: section.id,
      clipId: clip.id,
      order: items.length + 1,
      productionLane: clip.productionLane,
      trimStartMs: 0,
      trimEndMs: Math.max(0, clip.durationMs),
      gainDb: 0,
      fadeInMs: 0,
      fadeOutMs: 0,
      pauseBeforeMs: 0,
      pauseAfterMs: 500,
    });
  }

  return items;
}

// Intent: give project packages stable source-recording paths while legacy project-media paths remain valid.
export function buildProjectOwnedRecordingPath(input: {
  chapterId: string;
  sectionId: string;
  clipId: string;
  extension?: string;
}): string {
  const extension = normalizeExtension(input.extension, "wav");
  return [
    "recordings",
    normalizeIdPart(input.chapterId, "chapter"),
    normalizeIdPart(input.sectionId, "section"),
    `${normalizeIdPart(input.clipId, "clip")}.${extension}`,
  ].join("/");
}

// Intent: create converted or synthesized clips as derived lanes that reference the human source take.
export function createDerivedRecordingClip(input: {
  id: string;
  sectionId: string;
  sourceClipId: string;
  filePath: string;
  fileName?: string;
  durationMs?: number;
  productionKind: Exclude<AudiobookProductionKind, "human-recording" | "imported">;
  productionLane: Extract<AudiobookProductionLane, "character-conversion" | "speech-synthesis" | "narrator-master">;
  voiceProfileId?: string;
  characterId?: string;
  speakerAssignmentId?: string;
  conversionProfileId?: string;
  format?: AudiobookAudioFormat;
  createdAt?: string;
  updatedAt?: string;
}): RecordingClip {
  const createdAt = normalizeTimestamp(input.createdAt);

  return {
    id: normalizeRequiredText(input.id, "derived-clip"),
    sectionId: normalizeRequiredText(input.sectionId, "section"),
    takeNumber: 1,
    productionKind: input.productionKind,
    productionLane: input.productionLane,
    filePath: normalizeRequiredText(input.filePath, ""),
    fileName: normalizeOptionalText(input.fileName) || getFileNameFromPath(input.filePath),
    durationMs: normalizeDurationMs(input.durationMs),
    format: input.format ? normalizeAudioFormat(input.format) : { ...DEFAULT_AUDIOBOOK_RECORDING_FORMAT },
    status: "saved",
    notes: "",
    productionRef: {
      sourceClipId: normalizeRequiredText(input.sourceClipId, "source-clip"),
      speakerAssignmentId: normalizeOptionalText(input.speakerAssignmentId),
      characterId: normalizeOptionalText(input.characterId),
      voiceProfileId: normalizeOptionalText(input.voiceProfileId),
      conversionProfileId: normalizeOptionalText(input.conversionProfileId),
    },
    createdAt,
    updatedAt: normalizeTimestamp(input.updatedAt, createdAt),
  };
}

function ensureAudiobookChapter(
  model: AudiobookProjectModel,
  chaptersById: Map<string, AudiobookChapter>,
  recording: LegacyNarrationRecordingRecord,
  now: string,
): AudiobookChapter {
  const manuscriptChapterId = normalizeRequiredText(recording.chapterId, "chapter");
  const chapterId = `chapter-${normalizeIdPart(manuscriptChapterId)}`;
  const existing = chaptersById.get(chapterId);
  if (existing) {
    return existing;
  }

  const chapter: AudiobookChapter = {
    id: chapterId,
    bookId: model.book.id,
    manuscriptChapterId,
    title: normalizeRequiredText(recording.chapterTitle, manuscriptChapterId),
    order: chaptersById.size + 1,
    status: "recording",
    estimatedDurationMs: 0,
  };
  chaptersById.set(chapter.id, chapter);
  model.chapters.push(chapter);
  model.book.updatedAt = now;
  return chapter;
}

function createSectionFromLegacyRecording(
  recording: LegacyNarrationRecordingRecord,
  chapter: AudiobookChapter,
  order: number,
  now: string,
): ManuscriptAudioSection {
  const sourceText = normalizeText(recording.verseText);
  const startOffset = normalizeOffset(recording.startOffset);
  const endOffset = normalizeOffset(recording.endOffset, sourceText.length);
  const anchor = createLegacySourceAnchor(recording, startOffset, endOffset);

  return {
    id: buildLegacySectionId(recording),
    chapterId: chapter.id,
    manuscriptChapterId: chapter.manuscriptChapterId,
    sceneId: normalizeRequiredText(recording.sceneId, "scene"),
    blockId: normalizeOptionalText(recording.blockId),
    paragraphId: normalizeOptionalText(recording.paragraphId),
    order,
    sectionType: "user-defined",
    sourceText,
    sourceTextStart: startOffset,
    sourceTextEnd: endOffset,
    sourceTextFingerprint: createSourceTextFingerprint(sourceText),
    sourceAnchor: anchor,
    recordingStatus: "recorded",
    createdAt: normalizeTimestamp(recording.createdAt, now),
    updatedAt: normalizeTimestamp(recording.updatedAt, now),
  };
}

function createClipFromLegacyRecording(
  recording: LegacyNarrationRecordingRecord,
  sectionId: string,
  takeNumber: number,
  now: string,
): RecordingClip {
  const createdAt = normalizeTimestamp(recording.createdAt, now);
  const status = recording.status === "failed" ? "failed" : "saved";
  const filePath = normalizeText(recording.mediaPath);

  return {
    id: normalizeRequiredText(recording.id, `take-${takeNumber}`),
    sectionId,
    takeNumber,
    productionKind: "human-recording",
    productionLane: "human-source",
    filePath,
    fileName: normalizeOptionalText(recording.mediaName) || getFileNameFromPath(filePath),
    durationMs: normalizeDurationMs(recording.durationMs),
    format: inferAudioFormatFromLegacyRecording(recording),
    status,
    notes: "",
    productionRef: {},
    createdAt,
    updatedAt: normalizeTimestamp(recording.updatedAt, createdAt),
  };
}

function createSectionTakeState(
  sectionId: string,
  clips: RecordingClip[],
  now: string,
): SectionTakeState {
  const orderedClips = [...clips].sort(compareClipsByCreatedAt);
  const latestClip = orderedClips.at(-1);
  const selectedClip = [...orderedClips].reverse().find((clip) => clip.status === "saved");
  const approvalStatus: AudiobookRecordingStatus = selectedClip ? "needs-review" : "needs-rerecording";

  return {
    sectionId,
    takeCount: orderedClips.length,
    latestClipId: latestClip?.id,
    selectedClipId: selectedClip?.id,
    approvalStatus,
    updatedAt: latestClip?.updatedAt ?? now,
  };
}

function buildLegacySectionId(recording: LegacyNarrationRecordingRecord): string {
  return [
    "section",
    normalizeIdPart(recording.chapterId, "chapter"),
    normalizeIdPart(recording.sceneId, "scene"),
    normalizeIdPart(recording.blockId, "block"),
    normalizeOffset(recording.startOffset),
    normalizeOffset(recording.endOffset),
  ].join("-");
}

function createLegacySourceAnchor(
  recording: LegacyNarrationRecordingRecord,
  startOffset: number,
  endOffset: number,
): ManuscriptAnchor | undefined {
  const projectId = normalizeOptionalText(recording.projectId);
  const chapterId = normalizeOptionalText(recording.chapterId);
  const sceneId = normalizeOptionalText(recording.sceneId);
  const blockId = normalizeOptionalText(recording.blockId);
  const paragraphId = normalizeOptionalText(recording.paragraphId);
  if (!projectId || !chapterId || !sceneId || !blockId || !paragraphId) {
    return undefined;
  }

  return {
    projectId,
    chapterId,
    sceneId,
    blockId,
    paragraphId,
    startOffset,
    endOffset,
  };
}

function inferAudioFormatFromLegacyRecording(recording: LegacyNarrationRecordingRecord): AudiobookAudioFormat {
  const mimeType = normalizeText(recording.mediaMimeType);
  const fileName = normalizeText(recording.mediaName || recording.mediaPath);
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const container = inferContainer(mimeType, extension);

  return normalizeAudioFormat({
    container,
    codec: inferCodec(mimeType, container),
    sampleRate: container === "wav" ? 48000 : 0,
    bitDepth: container === "wav" ? 24 : undefined,
    channelCount: container === "wav" ? 1 : 0,
    mimeType: mimeType || undefined,
  });
}

function normalizeAudioFormat(format: AudiobookAudioFormat): AudiobookAudioFormat {
  return {
    container: format.container || "unknown",
    codec: normalizeRequiredText(format.codec, "unknown"),
    sampleRate: normalizeNonNegativeInteger(format.sampleRate),
    bitDepth: typeof format.bitDepth === "number" ? normalizeNonNegativeInteger(format.bitDepth) : undefined,
    channelCount: normalizeNonNegativeInteger(format.channelCount),
    mimeType: normalizeOptionalText(format.mimeType),
  };
}

function inferContainer(mimeType: string, extension: string): AudiobookAudioFormat["container"] {
  if (mimeType.includes("wav") || extension === "wav") return "wav";
  if (mimeType.includes("flac") || extension === "flac") return "flac";
  if (mimeType.includes("webm") || extension === "webm") return "webm";
  if (mimeType.includes("ogg") || extension === "ogg") return "ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3") || extension === "mp3") return "mp3";
  if (mimeType.includes("mp4") || mimeType.includes("m4a") || extension === "m4a") return "m4a";
  return "unknown";
}

function inferCodec(mimeType: string, container: AudiobookAudioFormat["container"]): string {
  if (mimeType.includes("opus")) return "opus";
  if (container === "wav") return "pcm-s24le";
  if (container === "flac") return "flac";
  if (container === "mp3") return "mp3";
  if (container === "m4a") return "aac";
  return "unknown";
}

function compareLegacyNarrationRecords(
  left: LegacyNarrationRecordingRecord,
  right: LegacyNarrationRecordingRecord,
): number {
  return (
    normalizeText(left.chapterId).localeCompare(normalizeText(right.chapterId)) ||
    normalizeText(left.sceneId).localeCompare(normalizeText(right.sceneId)) ||
    normalizeText(left.blockId).localeCompare(normalizeText(right.blockId)) ||
    normalizeOffset(left.startOffset) - normalizeOffset(right.startOffset) ||
    normalizeOffset(left.endOffset) - normalizeOffset(right.endOffset) ||
    normalizeTimestamp(left.createdAt).localeCompare(normalizeTimestamp(right.createdAt)) ||
    normalizeText(left.id).localeCompare(normalizeText(right.id))
  );
}

function compareSectionsByChapterAndOrder(
  left: ManuscriptAudioSection,
  right: ManuscriptAudioSection,
): number {
  return (
    left.chapterId.localeCompare(right.chapterId) ||
    left.order - right.order ||
    left.id.localeCompare(right.id)
  );
}

function compareClipsByCreatedAt(left: RecordingClip, right: RecordingClip): number {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

function createSourceTextFingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRequiredText(value: unknown, fallback: string): string {
  return normalizeText(value) || fallback;
}

function normalizeOptionalText(value: unknown): string | undefined {
  const normalized = normalizeText(value);
  return normalized || undefined;
}

function normalizeTimestamp(value: unknown, fallback = "1970-01-01T00:00:00.000Z"): string {
  const normalized = normalizeText(value);
  return normalized || fallback;
}

function normalizeOffset(value: unknown, fallback = 0): number {
  return normalizeNonNegativeInteger(typeof value === "number" ? value : fallback);
}

function normalizeDurationMs(value: unknown): number {
  return normalizeNonNegativeInteger(typeof value === "number" ? value : 0);
}

function normalizeNonNegativeInteger(value: unknown): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(Number(value)));
}

function normalizeIdPart(value: unknown, fallback = "item"): string {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

function normalizeExtension(value: unknown, fallback: string): string {
  const normalized = normalizeIdPart(value, fallback);
  return normalized.replace(/-/g, "") || fallback;
}

function getFileNameFromPath(filePath: string): string {
  return normalizeText(filePath).split(/[\\/]/).pop() ?? "";
}
