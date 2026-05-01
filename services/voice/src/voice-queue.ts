import { createNarrationJob, type CreateNarrationJobInput, type NarrationJob, type NarrationJobStatus, cancelNarrationJob, cloneNarrationJob, failNarrationJob, markNarrationJobRendered, queueNarrationJob, startNarrationJobRendering } from "./narration-job.ts";

export interface VoiceQueueListFilter {
  projectId?: string;
  status?: NarrationJobStatus | NarrationJobStatus[];
}

export interface VoiceQueueService {
  createJob(input: CreateNarrationJobInput): NarrationJob;
  queueJob(jobId: string, now?: string): NarrationJob;
  markJobRendering(jobId: string, now?: string): NarrationJob;
  markJobRendered(jobId: string, outputAudioRef: string, now?: string): NarrationJob;
  markJobFailed(jobId: string, error: string, now?: string): NarrationJob;
  cancelJob(jobId: string, now?: string): NarrationJob;
  listJobs(filter?: VoiceQueueListFilter): NarrationJob[];
  filterJobsByStatus(status: NarrationJobStatus | NarrationJobStatus[]): NarrationJob[];
  getJob(jobId: string): NarrationJob | null;
}

export function createVoiceQueue(initialJobs: NarrationJob[] = []): VoiceQueueService {
  const jobs = new Map<string, NarrationJob>();

  for (const job of initialJobs) {
    jobs.set(job.id, cloneNarrationJob(job));
  }

  function listJobs(filter?: VoiceQueueListFilter): NarrationJob[] {
    const statusFilter = normalizeStatusFilter(filter?.status);
    const projectId = typeof filter?.projectId === "string" && filter.projectId.trim()
      ? filter.projectId.trim()
      : null;

    return [...jobs.values()]
      .filter((job) => !projectId || job.projectId === projectId)
      .filter((job) => !statusFilter || statusFilter.has(job.status))
      .sort((left, right) => compareJobs(left, right))
      .map((job) => cloneNarrationJob(job));
  }

  return {
    createJob(input: CreateNarrationJobInput): NarrationJob {
      const job = createNarrationJob(input);
      jobs.set(job.id, cloneNarrationJob(job));
      return cloneNarrationJob(job);
    },
    queueJob(jobId: string, now?: string): NarrationJob {
      const next = queueNarrationJob(requireJob(jobs, jobId), now);
      jobs.set(jobId, cloneNarrationJob(next));
      return cloneNarrationJob(next);
    },
    markJobRendering(jobId: string, now?: string): NarrationJob {
      const next = startNarrationJobRendering(requireJob(jobs, jobId), now);
      jobs.set(jobId, cloneNarrationJob(next));
      return cloneNarrationJob(next);
    },
    markJobRendered(jobId: string, outputAudioRef: string, now?: string): NarrationJob {
      const next = markNarrationJobRendered(requireJob(jobs, jobId), outputAudioRef, now);
      jobs.set(jobId, cloneNarrationJob(next));
      return cloneNarrationJob(next);
    },
    markJobFailed(jobId: string, error: string, now?: string): NarrationJob {
      const next = failNarrationJob(requireJob(jobs, jobId), error, now);
      jobs.set(jobId, cloneNarrationJob(next));
      return cloneNarrationJob(next);
    },
    cancelJob(jobId: string, now?: string): NarrationJob {
      const next = cancelNarrationJob(requireJob(jobs, jobId), now);
      jobs.set(jobId, cloneNarrationJob(next));
      return cloneNarrationJob(next);
    },
    listJobs,
    filterJobsByStatus(status: NarrationJobStatus | NarrationJobStatus[]): NarrationJob[] {
      return listJobs({ status });
    },
    getJob(jobId: string): NarrationJob | null {
      const job = jobs.get(jobId);
      return job ? cloneNarrationJob(job) : null;
    },
  };
}

function requireJob(jobs: Map<string, NarrationJob>, jobId: string): NarrationJob {
  const job = jobs.get(jobId);

  if (!job) {
    throw new Error(`Unknown narration job '${jobId}'.`);
  }

  return job;
}

function normalizeStatusFilter(
  candidate?: VoiceQueueListFilter["status"],
): Set<NarrationJobStatus> | null {
  if (candidate === undefined) {
    return null;
  }

  const statuses = Array.isArray(candidate) ? candidate : [candidate];
  return new Set(statuses);
}

function compareJobs(left: NarrationJob, right: NarrationJob): number {
  const leftTime = Date.parse(left.createdAt);
  const rightTime = Date.parse(right.createdAt);

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  if (left.id < right.id) {
    return -1;
  }

  if (left.id > right.id) {
    return 1;
  }

  return 0;
}
