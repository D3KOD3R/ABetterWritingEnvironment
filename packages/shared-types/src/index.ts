import type {
  BinderNode,
  Character,
  EventTagKind,
  EventSource,
  IssueCategory,
  IssueSeverity,
  IssueSource,
  ManuscriptAnchor,
  Project,
  SpeakerAssignment,
} from "../../manuscript-schema/src/index.ts";
import type {
  TemplateFieldType,
  TimelineEdgeKind,
  WorldModel,
} from "../../world-schema/src/index.ts";
import type {
  AnalysisJob,
  AlignmentJob,
  VoiceRenderJob,
} from "../../job-contracts/src/index.ts";

export type ExecutionMode = "local-only" | "hybrid";
export type ProviderAvailability = "ready" | "disabled";

export interface DesktopSettingsSnapshot {
  executionMode: ExecutionMode;
  modelRoot: string;
  assetRoot: string;
  projectRoot: string;
}

export interface AnalysisProviderDescriptor {
  id: string;
  label: string;
  availability: ProviderAvailability;
  executionMode: ExecutionMode;
}

export interface AudioProviderDescriptor {
  id: string;
  label: string;
  availability: ProviderAvailability;
  alignmentStrategy: string;
}

export interface VoiceProviderDescriptor {
  id: string;
  label: string;
  availability: ProviderAvailability;
  synthesisMode: "local" | "hybrid";
}

export interface AnalysisIssueSuggestion {
  category: IssueCategory;
  severity: IssueSeverity;
  summary: string;
  detail?: string;
  source: IssueSource;
  confidence: number;
  anchor: ManuscriptAnchor;
  evidenceExcerpt: string;
}

export interface AnalysisEventSuggestion {
  kind: EventTagKind;
  label: string;
  source: EventSource;
  notes?: string;
  anchor: ManuscriptAnchor;
  evidenceExcerpt: string;
}

export type SuggestionReviewState = "pending" | "accepted" | "rejected";

export interface SuggestedTemplateField {
  key: string;
  label: string;
  valueType: TemplateFieldType;
  required: boolean;
  description: string;
}

export interface TemplateCreationSuggestion {
  id: string;
  suggestionType: "template";
  reviewState: SuggestionReviewState;
  templateName: string;
  rationale: string;
  evidence: ManuscriptAnchor[];
  proposedFields: SuggestedTemplateField[];
}

export interface EntityInstantiationSuggestion {
  id: string;
  suggestionType: "entity";
  reviewState: SuggestionReviewState;
  entityName: string;
  templateName: string;
  templateSuggestionId?: string;
  rationale: string;
  notes?: string;
  evidence: ManuscriptAnchor[];
  proposedFieldValues: Array<{
    key: string;
    value: string;
  }>;
}

export interface WorkspaceLinkSuggestion {
  id: string;
  suggestionType: "link";
  reviewState: SuggestionReviewState;
  linkKind: "entity-introduction" | "cross-spine-edge";
  rationale: string;
  evidence: ManuscriptAnchor[];
  entityId?: string;
  entityName?: string;
  targetNodeId?: string;
  targetNodeLabel?: string;
  fromNodeId?: string;
  fromNodeLabel?: string;
  toNodeId?: string;
  toNodeLabel?: string;
  proposedEdgeKind?: TimelineEdgeKind;
}

export type DreamScapeFit =
  | "plot-catalyst"
  | "character-arc"
  | "world-history"
  | "theme"
  | "scene-revision";

export interface DreamScapePlacement {
  target: "existing-scene" | "timeline-node" | "world-spine" | "new-scene";
  chapterTitle?: string;
  sceneTitle?: string;
  spineId?: string;
  spineLabel?: string;
  nodeId?: string;
  nodeLabel?: string;
}

export interface DreamScapeSuggestion {
  id: string;
  suggestionType: "dream-scaping";
  reviewState: SuggestionReviewState;
  ideaTitle: string;
  fit: DreamScapeFit;
  rationale: string;
  evidence: ManuscriptAnchor[];
  proposedPlacement: DreamScapePlacement;
  revisionPrompt: string;
}

export type AnalysisWorldSuggestion =
  | TemplateCreationSuggestion
  | EntityInstantiationSuggestion
  | WorkspaceLinkSuggestion;

export type AnalysisSuggestion = AnalysisWorldSuggestion | DreamScapeSuggestion;

export interface AnalysisBatch {
  provider: AnalysisProviderDescriptor;
  job: AnalysisJob;
  issues: AnalysisIssueSuggestion[];
  events: AnalysisEventSuggestion[];
  suggestions: AnalysisSuggestion[];
}

export interface DreamScapeIdeaInput {
  project: Project;
  world?: WorldModel;
  ideaTitle: string;
  ideaText: string;
  now?: string;
}

export interface StartNarrationSessionInput {
  project: Project;
  sessionLabel: string;
  anchor: ManuscriptAnchor;
  currentLineNumber: number;
  currentText: string;
  now?: string;
}

export interface AlignNarrationInput {
  session: NarrationSessionSnapshot;
  projectId: string;
  anchor: ManuscriptAnchor;
  transcript: string;
  resolvedText: string;
  matchedLineNumber: number;
  confidence: number;
  now?: string;
}

export interface NarrationSessionSnapshot {
  id: string;
  projectId: string;
  providerId: string;
  sessionLabel: string;
  status: "tracking" | "paused" | "stopped";
  currentAnchor: ManuscriptAnchor;
  currentLineNumber: number;
  currentText: string;
  updatedAt: string;
}

export interface VoiceProfile {
  id: string;
  label: string;
  providerId: string;
  role: "narrator" | "character";
  style: string;
}

export interface VoiceRecordingRecord {
  id: string;
  projectId: string;
  chapterId: string;
  chapterTitle: string;
  sceneId: string;
  sceneTitle: string;
  blockId: string;
  paragraphId: string;
  lineNumber: number;
  verseText: string;
  transcript: string;
  mediaPath?: string;
  mediaName?: string;
  mediaMimeType?: string;
  durationMs?: number;
  status: "recorded" | "saved" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface SpeakerVoiceBinding {
  id: string;
  speakerAssignmentId: string;
  speakerLabel: string;
  voiceProfileId: string;
  previewText: string;
}

export interface CreateSpeakerBindingsInput {
  project: Project;
  assignments: SpeakerAssignment[];
}

export interface VoicePreviewInput {
  projectId: string;
  sceneId?: string;
  bindingIds: string[];
  now?: string;
}

export interface VoiceChapterRenderInput {
  projectId: string;
  chapterId: string;
  bindingIds: string[];
  now?: string;
}

export interface AnalysisServiceContract {
  provider: AnalysisProviderDescriptor;
  analyzeProject(project: Project, now?: string): AnalysisBatch;
  analyzeWorkspace(project: Project, world: WorldModel, now?: string): AnalysisBatch;
  exploreDreamScape(input: DreamScapeIdeaInput): AnalysisBatch;
}

export interface AudioServiceContract {
  provider: AudioProviderDescriptor;
  startNarrationSession(input: StartNarrationSessionInput): NarrationSessionSnapshot;
  alignNarration(input: AlignNarrationInput): {
    session: NarrationSessionSnapshot;
    job: AlignmentJob;
  };
}

export interface VoiceServiceContract {
  provider: VoiceProviderDescriptor;
  listProfiles(): VoiceProfile[];
  createSpeakerBindings(input: CreateSpeakerBindingsInput): SpeakerVoiceBinding[];
  queueVoicePreview(input: VoicePreviewInput): VoiceRenderJob;
  queueChapterRender(input: VoiceChapterRenderInput): VoiceRenderJob;
}

export interface WorkspaceNavigationTarget {
  refId: string;
  kind: "project" | "chapter" | "scene";
  title: string;
  lineId: string;
  lineNumber: number;
}

export interface WorkspaceLineRecord {
  id: string;
  blockId: string;
  paragraphId: string;
  lineNumber: number;
  sceneLineNumber: number;
  kind: "narration" | "dialogue";
  speakerLabel?: string;
  text: string;
  chapterId: string;
  chapterTitle: string;
  sceneId: string;
  sceneTitle: string;
  sceneSynopsis: string;
  startsChapter: boolean;
  startsScene: boolean;
  issueIds: string[];
  eventTagIds: string[];
}

export interface IssueConsoleRecord {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  summary: string;
  detail?: string;
  source: IssueSource;
  confidence: number;
  evidenceExcerpt: string;
  blockId: string;
  lineNumber: number;
  sceneLineNumber: number;
  chapterTitle: string;
  sceneTitle: string;
}

export interface EventConsoleRecord {
  id: string;
  kind: EventTagKind;
  label: string;
  source: EventSource;
  notes?: string;
  evidenceExcerpt: string;
  blockId: string;
  lineNumber: number;
  sceneLineNumber: number;
  chapterTitle: string;
  sceneTitle: string;
}

export interface CharacterRecord {
  id: string;
  name: string;
  aliasList: string[];
  notes: string;
}

export interface ProjectWorkspaceSnapshot {
  id: string;
  title: string;
  binder: BinderNode;
  stats: {
    chapterCount: number;
    sceneCount: number;
    lineCount: number;
    issueCount: number;
    eventCount: number;
    characterCount: number;
  };
  navigationTargets: Record<string, WorkspaceNavigationTarget>;
  lines: WorkspaceLineRecord[];
  issues: IssueConsoleRecord[];
  eventTags: EventConsoleRecord[];
  characters: CharacterRecord[];
}

export interface WorldTemplateRecord {
  id: string;
  name: string;
  key: string;
  description: string;
  fieldCount: number;
  source?: string;
  sourceDocumentId?: string;
  sourcePath?: string;
  sourceText?: string;
}

export interface WorldEntityRecord {
  id: string;
  name: string;
  templateName: string;
  notes: string;
  introductionLineNumber?: number;
  introductionBlockId?: string;
  introductionNodeId?: string;
  introductionNodeLabel?: string;
  fields: Array<{
    key: string;
    label: string;
    value: string;
  }>;
}

export interface TimelineNodeRecord {
  id: string;
  spineId: string;
  label: string;
  summary: string;
  order: number;
  primaryBlockId?: string;
  lineNumbers: number[];
  linkedEntityIds: string[];
  linkedEntityNames: string[];
}

export interface TimelineSpineRecord {
  id: string;
  label: string;
  kind: string;
  description: string;
  nodes: TimelineNodeRecord[];
}

export interface TimelineEdgeRecord {
  id: string;
  kind: string;
  label?: string;
  fromNodeId: string;
  fromNodeLabel: string;
  fromSpineLabel: string;
  toNodeId: string;
  toNodeLabel: string;
  toSpineLabel: string;
}

export interface WorldWorkspaceSnapshot {
  id: string;
  title: string;
  stats: {
    templateCount: number;
    entityCount: number;
    spineCount: number;
    nodeCount: number;
    edgeCount: number;
  };
  templates: WorldTemplateRecord[];
  entities: WorldEntityRecord[];
  spines: TimelineSpineRecord[];
  edges: TimelineEdgeRecord[];
}

export interface AnalysisWorkspaceSnapshot {
  provider: AnalysisProviderDescriptor;
  lastJob: AnalysisJob;
  suggestionQueue: SuggestionQueueRecord[];
  dreamScaping?: DreamScapingWorkspaceSnapshot;
}

export interface DreamScapingWorkspaceSnapshot {
  ideaTitle: string;
  ideaText: string;
  suggestionIds: string[];
}

export interface SuggestionEvidenceRecord {
  blockId: string;
  lineNumber: number;
  sceneLineNumber: number;
  chapterTitle: string;
  sceneTitle: string;
  excerpt: string;
}

export interface SuggestionQueueRecord {
  id: string;
  suggestionType: "template" | "entity" | "link" | "dream-scaping";
  reviewState: SuggestionReviewState;
  title: string;
  rationale: string;
  evidence: SuggestionEvidenceRecord[];
  detailLines: string[];
  entityId?: string;
  entityName?: string;
  nodeId?: string;
  nodeLabel?: string;
  fromNodeId?: string;
  toNodeId?: string;
  fit?: DreamScapeFit;
  placementLabel?: string;
  revisionPrompt?: string;
}

export interface NarrationWorkspaceSnapshot {
  provider: AudioProviderDescriptor;
  session: NarrationSessionSnapshot;
  alignmentJobs: AlignmentJob[];
}

export interface VoiceWorkspaceSnapshot {
  provider: VoiceProviderDescriptor;
  profiles: VoiceProfile[];
  bindings: SpeakerVoiceBinding[];
  renderJobs: VoiceRenderJob[];
  recordings: VoiceRecordingRecord[];
}

export interface WorkspaceSelectionDefaults {
  lineId: string;
  issueId?: string;
  nodeId?: string;
  entityId?: string;
}

export interface EditorWorkspaceSnapshot {
  generatedAt: string;
  workspaceTitle: string;
  settings: DesktopSettingsSnapshot;
  project: ProjectWorkspaceSnapshot;
  world: WorldWorkspaceSnapshot;
  analysis: AnalysisWorkspaceSnapshot;
  narration: NarrationWorkspaceSnapshot;
  voice: VoiceWorkspaceSnapshot;
  selectionDefaults: WorkspaceSelectionDefaults;
}

export function formatCharacterRecord(character: Character): CharacterRecord {
  return {
    id: character.id,
    name: character.name,
    aliasList: character.aliases.map((alias) => alias.value),
    notes: character.notes,
  };
}
