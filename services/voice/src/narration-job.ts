import type { ManuscriptAnchor } from "../../../packages/manuscript-schema/src/index.ts";

export type NarrationJobStatus = "draft" | "queued" | "rendering" | "rendered" | "failed" | "cancelled";

export interface NarrationBlockRange {
  startBlockId: string;
  endBlockId: string;
}

export interface NarrationJob {
  id: string;
  projectId: string;
  manuscriptRef: ManuscriptAnchor;
  chapterId?: string;
  sceneId?: string;
  blockRange?: NarrationBlockRange;
  sourceTextSnapshot: string;
  voiceProfileId: string;
  status: NarrationJobStatus;
  progress: number;
  outputAudioRef?: string;
  alignmentRef?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNarrationJobInput {
  id: string;
  projectId: string;
  manuscriptRef: ManuscriptAnchor;
  chapterId?: string;
  sceneId?: string;
  blockRange?: NarrationBlockRange;
  sourceTextSnapshot: string;
  voiceProfileId: string;
  now?: string;
}

const JOB_STATUSES = new Set<NarrationJobStatus>([
  "draft",
  "queued",
  "rendering",
  "rendered",
  "failed",
  "cancelled",
]);

export function createNarrationJob(input: CreateNarrationJobInput): NarrationJob {
  const id = nonEmpty(input.id, "Narration job id");
  const projectId = nonEmpty(input.projectId, "Narration job project id");
  const manuscriptRef = normalizeManuscriptAnchor(input.manuscriptRef);
  const voiceProfileId = nonEmpty(input.voiceProfileId, "Narration job voice profile id");
  const sourceTextSnapshot = assertNonBlankText(input.sourceTextSnapshot, "Narration job source text snapshot");
  const createdAt = resolveNow(input.now);
  const chapterId = normalizeOptionalString(input.chapterId);
  const sceneId = normalizeOptionalString(input.sceneId);
  const blockRange = input.blockRange ? normalizeBlockRange(input.blockRange) : undefined;

  if (!manuscriptRef) {
    throw new Error("Narration job manuscriptRef is invalid.");
  }

  if (chapterId && chapterId !== manuscriptRef.chapterId) {
    throw new Error("Narration job chapterId must match the manuscript reference chapter.");
  }

  if (sceneId && sceneId !== manuscriptRef.sceneId) {
    throw new Error("Narration job sceneId must match the manuscript reference scene.");
  }

  if (input.blockRange && !blockRange) {
    throw new Error("Narration job blockRange must include startBlockId and endBlockId.");
  }

  return {
    id,
    projectId,
    manuscriptRef,
    ...(chapterId ? { chapterId } : {}),
    ...(sceneId ? { sceneId } : {}),
    ...(blockRange ? { blockRange } : {}),
    sourceTextSnapshot,
    voiceProfileId,
    status: "draft",
    progress: 0,
    createdAt,
    updatedAt: createdAt,
  };
}

export function normalizeNarrationJob(candidate: unknown): NarrationJob | null {
  if (!isRecord(candidate)) {
    return null;
  }

  const id = normalizeRequiredString(candidate.id);
  const projectId = normalizeRequiredString(candidate.projectId);
  const manuscriptRef = normalizeManuscriptAnchor(candidate.manuscriptRef);
  const voiceProfileId = normalizeRequiredString(candidate.voiceProfileId);
  const sourceTextSnapshot =
    typeof candidate.sourceTextSnapshot === "string" && candidate.sourceTextSnapshot.trim()
      ? candidate.sourceTextSnapshot
      : null;
  const status = normalizeStatus(candidate.status);
  const progress = normalizeProgress(candidate.progress);

  if (!id || !projectId || !manuscriptRef || !voiceProfileId || !sourceTextSnapshot || !status) {
    return null;
  }

  const chapterId = normalizeOptionalString(candidate.chapterId);
  const sceneId = normalizeOptionalString(candidate.sceneId);
  const blockRange = candidate.blockRange ? normalizeBlockRange(candidate.blockRange) : undefined;
  if (candidate.blockRange && !blockRange) {
    return null;
  }
  const createdAt = normalizeOptionalString(candidate.createdAt) ?? new Date(0).toISOString();
  const updatedAt = normalizeOptionalString(candidate.updatedAt) ?? createdAt;

  return cloneNarrationJob({
    id,
    projectId,
    manuscriptRef,
    ...(chapterId ? { chapterId } : {}),
    ...(sceneId ? { sceneId } : {}),
    ...(blockRange ? { blockRange } : {}),
    sourceTextSnapshot,
    voiceProfileId,
    status,
    progress,
    ...(normalizeOptionalString(candidate.outputAudioRef)
      ? { outputAudioRef: normalizeOptionalString(candidate.outputAudioRef) }
      : {}),
    ...(normalizeOptionalString(candidate.alignmentRef)
      ? { alignmentRef: normalizeOptionalString(candidate.alignmentRef) }
      : {}),
    ...(normalizeOptionalString(candidate.error) ? { error: normalizeOptionalString(candidate.error) } : {}),
    createdAt,
    updatedAt,
  });
}

export function normalizeNarrationJobs(candidate: unknown): NarrationJob[] {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map((item) => normalizeNarrationJob(item))
    .filter((item): item is NarrationJob => item !== null)
    .map((job) => cloneNarrationJob(job));
}

export function queueNarrationJob(job: NarrationJob, now?: string): NarrationJob {
  assertTransition(job, ["draft", "failed"], "queue");

  return stripOptionalFields(withUpdatedJob(job, {
    status: "queued",
    progress: 0.15,
  }, now), ["error", "outputAudioRef", "alignmentRef"]);
}

export function startNarrationJobRendering(job: NarrationJob, now?: string): NarrationJob {
  assertTransition(job, ["queued"], "start rendering");

  return stripOptionalFields(withUpdatedJob(job, {
    status: "rendering",
    progress: 0.55,
  }, now), ["error"]);
}

export function markNarrationJobRendered(
  job: NarrationJob,
  outputAudioRef: string,
  now?: string,
): NarrationJob {
  assertTransition(job, ["rendering"], "complete");

  return stripOptionalFields(withUpdatedJob(job, {
    status: "rendered",
    progress: 1,
    outputAudioRef: nonEmpty(outputAudioRef, "Narration job output reference"),
  }, now), ["error"]);
}

export function failNarrationJob(
  job: NarrationJob,
  error: string,
  now?: string,
): NarrationJob {
  assertTransition(job, ["queued", "rendering"], "fail");

  return stripOptionalFields(withUpdatedJob(job, {
    status: "failed",
    progress: Math.max(job.progress, 0.5),
    error: nonEmpty(error, "Narration job error"),
  }, now), ["outputAudioRef"]);
}

export function cancelNarrationJob(job: NarrationJob, now?: string): NarrationJob {
  assertTransition(job, ["draft", "queued", "rendering"], "cancel");

  return stripOptionalFields(withUpdatedJob(job, {
    status: "cancelled",
    progress: job.progress,
  }, now), ["error", "outputAudioRef", "alignmentRef"]);
}

export function cloneNarrationJob(job: NarrationJob): NarrationJob {
  return {
    ...job,
    manuscriptRef: { ...job.manuscriptRef },
    ...(job.blockRange ? { blockRange: { ...job.blockRange } } : {}),
    ...(job.chapterId ? { chapterId: job.chapterId } : {}),
    ...(job.sceneId ? { sceneId: job.sceneId } : {}),
    ...(job.outputAudioRef ? { outputAudioRef: job.outputAudioRef } : {}),
    ...(job.alignmentRef ? { alignmentRef: job.alignmentRef } : {}),
    ...(job.error ? { error: job.error } : {}),
  };
}

function withUpdatedJob(
  job: NarrationJob,
  patch: Partial<NarrationJob>,
  now?: string,
): NarrationJob {
  return cloneNarrationJob({
    ...job,
    ...patch,
    updatedAt: resolveNow(now),
  });
}

function stripOptionalFields(job: NarrationJob, fields: Array<"error" | "outputAudioRef" | "alignmentRef">): NarrationJob {
  const next: NarrationJob = { ...job };

  for (const field of fields) {
    delete next[field];
  }

  return next;
}

function normalizeManuscriptAnchor(candidate: unknown): ManuscriptAnchor | null {
  if (!isRecord(candidate)) {
    return null;
  }

  const projectId = normalizeRequiredString(candidate.projectId);
  const chapterId = normalizeRequiredString(candidate.chapterId);
  const sceneId = normalizeRequiredString(candidate.sceneId);
  const blockId = normalizeRequiredString(candidate.blockId);
  const paragraphId = normalizeRequiredString(candidate.paragraphId);
  const startOffset = Number(candidate.startOffset);
  const endOffset = Number(candidate.endOffset);

  if (
    !projectId ||
    !chapterId ||
    !sceneId ||
    !blockId ||
    !paragraphId ||
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    startOffset < 0 ||
    endOffset < startOffset
  ) {
    return null;
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

function normalizeBlockRange(candidate: unknown): NarrationBlockRange | null {
  if (!isRecord(candidate)) {
    return null;
  }

  const startBlockId = normalizeRequiredString(candidate.startBlockId);
  const endBlockId = normalizeRequiredString(candidate.endBlockId);

  if (!startBlockId || !endBlockId) {
    return null;
  }

  return {
    startBlockId,
    endBlockId,
  };
}

function normalizeStatus(candidate: unknown): NarrationJobStatus | null {
  if (typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();
  return JOB_STATUSES.has(trimmed as NarrationJobStatus)
    ? (trimmed as NarrationJobStatus)
    : null;
}

function normalizeProgress(candidate: unknown): number {
  const numeric = Number(candidate);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(Math.max(Number(numeric.toFixed(4)), 0), 1);
}

function normalizeOptionalString(candidate: unknown): string | undefined {
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}

function normalizeRequiredString(candidate: unknown): string | null {
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

function assertTransition(
  job: NarrationJob,
  allowedStatuses: NarrationJobStatus[],
  action: string,
): void {
  if (!allowedStatuses.includes(job.status)) {
    throw new Error(`Cannot ${action} a narration job with status '${job.status}'.`);
  }
}

function assertNonBlankText(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} cannot be empty.`);
  }

  return value;
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
