// Intent: define long-running job request, status, and result contracts shared by services.
import type { ManuscriptAnchor } from "../../manuscript-schema/src/index.ts";

export type JobType = "analysis" | "alignment" | "voice-preview" | "voice-render";
export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface BaseJob<TType extends JobType, TRequest, TResult> {
  id: string;
  type: TType;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  request: TRequest;
  result?: TResult;
  errorMessage?: string;
}

export interface AnalysisJobRequest {
  projectId: string;
  trigger: "manual" | "incremental" | "dream-scaping";
  changedBlockIds?: string[];
  ideaTitle?: string;
}

export interface AnalysisJobResult {
  providerId: string;
  issueCount: number;
  eventCount: number;
  suggestionCount: number;
}

export interface AlignmentJobRequest {
  sessionId: string;
  projectId: string;
  anchor: ManuscriptAnchor;
  transcript: string;
}

export interface AlignmentJobResult {
  matchedLineNumber: number;
  confidence: number;
  resolvedText: string;
}

export interface VoiceRenderJobRequest {
  projectId: string;
  chapterId?: string;
  sceneId?: string;
  mode: "preview" | "chapter";
  bindingIds: string[];
}

export interface VoiceRenderJobResult {
  providerId: string;
  outputLabel: string;
  clipCount: number;
}

export type AnalysisJob = BaseJob<"analysis", AnalysisJobRequest, AnalysisJobResult>;
export type AlignmentJob = BaseJob<"alignment", AlignmentJobRequest, AlignmentJobResult>;
export type VoiceRenderJob =
  | BaseJob<"voice-preview", VoiceRenderJobRequest, VoiceRenderJobResult>
  | BaseJob<"voice-render", VoiceRenderJobRequest, VoiceRenderJobResult>;

// Intent: create deterministic completed jobs for synchronous local providers while preserving async job shape.
export function createCompletedJob<TType extends JobType, TRequest, TResult>(
  id: string,
  type: TType,
  request: TRequest,
  result: TResult,
  now: string,
): BaseJob<TType, TRequest, TResult> {
  return {
    id,
    type,
    status: "completed",
    createdAt: now,
    updatedAt: now,
    request,
    result,
  };
}
