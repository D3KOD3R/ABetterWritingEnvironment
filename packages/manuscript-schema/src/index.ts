// Intent: define canonical manuscript identity, anchors, issues, events, characters, and speaker mappings.
export type ManuscriptBlockKind = "narration" | "dialogue";
export type IssueSeverity = "info" | "warning" | "error";
export type IssueCategory =
  | "clarity"
  | "continuity"
  | "pacing"
  | "structure"
  | "style"
  | "custom";
export type IssueSource = "manual" | "rule" | "local-ai" | "hosted-ai";
export type EventTagKind =
  | "character-introduction"
  | "first-meeting"
  | "death"
  | "plot-turn"
  | "custom";
export type EventSource = "manual" | "analysis";
export type CharacterAliasKind = "primary" | "title" | "short-name" | "callsign";
export type SpeakerAssignmentRole = "narrator" | "character";
export type ManuscriptMarkKind = "bold" | "italic" | "underline" | "strikethrough" | "highlight";
export type ManuscriptMarkSource = "author" | "accepted-suggestion";
export type ManuscriptMarkPurpose = "emphasis" | "reference" | "revision";
export type ManuscriptAnchorStatus =
  | "resolved"
  | "shifted"
  | "contentChanged"
  | "approximate"
  | "stale"
  | "orphaned"
  | "deleted";
export type ManuscriptAnchorEvidenceMode = "full" | "hash-context";

const DEFAULT_MARK_CONTEXT_LIMIT = 64;
const DEFAULT_MARK_PREVIEW_LIMIT = 180;
const DEFAULT_MARK_FULL_EVIDENCE_LIMIT = 240;

export interface Project {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  chapters: Chapter[];
  characters: Character[];
  speakerAssignments: SpeakerAssignment[];
  issues: IssueRecord[];
  eventTags: EventTag[];
  marks: ManuscriptMark[];
  sequences: ManuscriptSequences;
}

export interface ManuscriptSequences {
  chapter: number;
  scene: number;
  block: number;
  paragraph: number;
  issue: number;
  event: number;
  mark: number;
  character: number;
  alias: number;
  speakerAssignment: number;
}

export interface Chapter {
  id: string;
  title: string;
  order: number;
  scenes: Scene[];
  summary: string;
}

export interface Scene {
  id: string;
  chapterId: string;
  title: string;
  order: number;
  synopsis: string;
  blocks: ManuscriptBlock[];
}

export interface BaseBlock {
  id: string;
  paragraphId: string;
  kind: ManuscriptBlockKind;
  order: number;
  text: string;
}

export interface NarrationBlock extends BaseBlock {
  kind: "narration";
}

export interface DialogueBlock extends BaseBlock {
  kind: "dialogue";
  speakerId?: string;
}

export type ManuscriptBlock = NarrationBlock | DialogueBlock;

export interface CharacterAlias {
  id: string;
  kind: CharacterAliasKind;
  value: string;
}

export interface Character {
  id: string;
  name: string;
  aliases: CharacterAlias[];
  notes: string;
}

export interface SpeakerAssignment {
  id: string;
  blockId: string;
  role: SpeakerAssignmentRole;
  speakerLabel: string;
  characterId?: string;
}

export interface BinderNode {
  id: string;
  kind: "project" | "chapter" | "scene";
  refId: string;
  title: string;
  order: number;
  children: BinderNode[];
}

export interface ManuscriptIndexEntry {
  chapterId: string;
  sceneId: string;
  blockId: string;
  paragraphId: string;
  chapterOrder: number;
  sceneOrder: number;
  blockOrder: number;
  lineNumber: number;
  kind: ManuscriptBlockKind;
}

export interface ManuscriptAnchor {
  projectId: string;
  chapterId: string;
  sceneId: string;
  blockId: string;
  paragraphId: string;
  startOffset: number;
  endOffset: number;
}

export interface IssueRecord {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  summary: string;
  detail?: string;
  source: IssueSource;
  confidence: number;
  lifecycle: "open";
  anchor: ManuscriptAnchor;
  evidenceExcerpt: string;
  createdAt: string;
}

export interface EventTag {
  id: string;
  kind: EventTagKind;
  label: string;
  source: EventSource;
  anchor: ManuscriptAnchor;
  evidenceExcerpt: string;
  createdAt: string;
  notes?: string;
}

export interface ManuscriptMarkMetadata {
  colorToken?: string;
  highlightColor?: ManuscriptMarkHighlightColor;
  purpose?: ManuscriptMarkPurpose;
}

export interface ManuscriptMarkHighlightColor {
  id?: string;
  label?: string;
  color: string;
  outline: string;
  rgb?: {
    red: number;
    green: number;
    blue: number;
  };
}

export interface ManuscriptMark {
  id: string;
  kind: ManuscriptMarkKind;
  anchor: ManuscriptAnchor;
  source: ManuscriptMarkSource;
  anchorStatus: ManuscriptAnchorStatus;
  anchorDirtyReason: string;
  evidenceMode: ManuscriptAnchorEvidenceMode;
  evidenceExcerpt: string;
  originalHash: string;
  originalLength: number;
  selectedTextPreview: string;
  prefixContext: string;
  suffixContext: string;
  createdAt: string;
  updatedAt: string;
  anchorLastTouchedAt?: string;
  anchorLastTouchedByEditId?: string;
  metadata?: ManuscriptMarkMetadata;
}

export interface CreateProjectInput {
  id?: string;
  title: string;
  now?: string;
}

export interface AddChapterInput {
  title: string;
  summary?: string;
}

export interface AddSceneInput {
  title: string;
  synopsis?: string;
}

export type AddBlockInput =
  | {
      kind: "narration";
      text: string;
    }
  | {
      kind: "dialogue";
      text: string;
      speakerId?: string;
    };

export interface AddCharacterInput {
  name: string;
  aliases?: Array<{
    kind?: CharacterAliasKind;
    value: string;
  }>;
  notes?: string;
}

export interface AssignSpeakerInput {
  role: SpeakerAssignmentRole;
  speakerLabel: string;
  characterId?: string;
}

export interface AnchorInput {
  blockId: string;
  startOffset?: number;
  endOffset?: number;
}

export interface AddIssueInput {
  category: IssueCategory;
  severity: IssueSeverity;
  summary: string;
  detail?: string;
  source?: IssueSource;
  confidence?: number;
  anchor: ManuscriptAnchor;
}

export interface AddEventTagInput {
  kind: EventTagKind;
  label: string;
  source?: EventSource;
  notes?: string;
  anchor: ManuscriptAnchor;
}

export interface AddManuscriptMarkInput {
  kind: ManuscriptMarkKind;
  source?: ManuscriptMarkSource;
  anchor: ManuscriptAnchor;
  metadata?: ManuscriptMarkMetadata;
}

export interface ResolvedManuscriptAnchor {
  chapter: Chapter;
  scene: Scene;
  block: ManuscriptBlock;
  excerpt: string;
  index: ManuscriptIndexEntry;
}

const DEFAULT_SEQUENCES: ManuscriptSequences = {
  chapter: 0,
  scene: 0,
  block: 0,
  paragraph: 0,
  issue: 0,
  event: 0,
  mark: 0,
  character: 0,
  alias: 0,
  speakerAssignment: 0,
};

// Intent: create the canonical project container that all editor and service anchors resolve against.
export function createProject(input: CreateProjectInput): Project {
  const title = nonEmpty(input.title, "Project title");
  const now = resolveNow(input.now);

  return {
    id: input.id ?? "project-0001",
    title,
    createdAt: now,
    updatedAt: now,
    chapters: [],
    characters: [],
    speakerAssignments: [],
    issues: [],
    eventTags: [],
    marks: [],
    sequences: { ...DEFAULT_SEQUENCES },
  };
}

export function addChapter(
  project: Project,
  input: AddChapterInput,
  now?: string,
): { project: Project; chapter: Chapter } {
  const chapter: Chapter = {
    id: formatId("chapter", project.sequences.chapter + 1),
    title: nonEmpty(input.title, "Chapter title"),
    order: project.chapters.length + 1,
    scenes: [],
    summary: input.summary?.trim() ?? "",
  };

  return {
    project: touch(project, now, {
      chapters: [...project.chapters, chapter],
      sequences: {
        ...project.sequences,
        chapter: project.sequences.chapter + 1,
      },
    }),
    chapter,
  };
}

export function addScene(
  project: Project,
  chapterId: string,
  input: AddSceneInput,
  now?: string,
): { project: Project; scene: Scene } {
  const chapterIndex = project.chapters.findIndex((chapter) => chapter.id === chapterId);

  if (chapterIndex === -1) {
    throw new Error(`Unknown chapter '${chapterId}'.`);
  }

  const chapter = project.chapters[chapterIndex];
  const scene: Scene = {
    id: formatId("scene", project.sequences.scene + 1),
    chapterId,
    title: nonEmpty(input.title, "Scene title"),
    order: chapter.scenes.length + 1,
    synopsis: input.synopsis?.trim() ?? "",
    blocks: [],
  };

  const chapters = project.chapters.map((candidate, index) =>
    index === chapterIndex
      ? {
          ...candidate,
          scenes: [...candidate.scenes, scene],
        }
      : candidate,
  );

  return {
    project: touch(project, now, {
      chapters,
      sequences: {
        ...project.sequences,
        scene: project.sequences.scene + 1,
      },
    }),
    scene,
  };
}

// Intent: append addressable manuscript blocks while preserving chapter, scene, paragraph, and speaker targets.
export function addBlock(
  project: Project,
  sceneId: string,
  input: AddBlockInput,
  now?: string,
): { project: Project; block: ManuscriptBlock } {
  const location = findSceneLocation(project, sceneId);

  if (!location) {
    throw new Error(`Unknown scene '${sceneId}'.`);
  }

  const text = nonEmpty(input.text, "Block text");
  const blockId = formatId("block", project.sequences.block + 1);
  const paragraphId = formatId("paragraph", project.sequences.paragraph + 1);
  const baseBlock = {
    id: blockId,
    paragraphId,
    order: location.scene.blocks.length + 1,
    text,
  };

  const block: ManuscriptBlock =
    input.kind === "dialogue"
      ? {
          ...baseBlock,
          kind: "dialogue",
          ...(input.speakerId?.trim() ? { speakerId: input.speakerId.trim() } : {}),
        }
      : {
          ...baseBlock,
          kind: "narration",
        };

  const chapters = project.chapters.map((chapter, chapterIndex) =>
    chapterIndex === location.chapterIndex
      ? {
          ...chapter,
          scenes: chapter.scenes.map((scene, sceneIndex) =>
            sceneIndex === location.sceneIndex
              ? {
                  ...scene,
                  blocks: [...scene.blocks, block],
                }
              : scene,
          ),
        }
      : chapter,
  );

  return {
    project: touch(project, now, {
      chapters,
      sequences: {
        ...project.sequences,
        block: project.sequences.block + 1,
        paragraph: project.sequences.paragraph + 1,
      },
    }),
    block,
  };
}

export function addCharacter(
  project: Project,
  input: AddCharacterInput,
  now?: string,
): { project: Project; character: Character } {
  const name = nonEmpty(input.name, "Character name");
  const nextAliasSequence = { value: project.sequences.alias };
  const aliases = (input.aliases ?? []).map((alias, index) => {
    nextAliasSequence.value += 1;
    return {
      id: formatId("alias", nextAliasSequence.value),
      kind: alias.kind ?? (index === 0 ? "primary" : "short-name"),
      value: nonEmpty(alias.value, "Character alias"),
    } satisfies CharacterAlias;
  });

  const character: Character = {
    id: formatId("character", project.sequences.character + 1),
    name,
    aliases,
    notes: input.notes?.trim() ?? "",
  };

  return {
    project: touch(project, now, {
      characters: [...project.characters, character],
      sequences: {
        ...project.sequences,
        character: project.sequences.character + 1,
        alias: nextAliasSequence.value,
      },
    }),
    character,
  };
}

export function assignSpeaker(
  project: Project,
  blockId: string,
  input: AssignSpeakerInput,
  now?: string,
): { project: Project; speakerAssignment: SpeakerAssignment } {
  const location = findBlock(project, blockId);

  if (!location) {
    throw new Error(`Unknown block '${blockId}'.`);
  }

  if (project.speakerAssignments.some((assignment) => assignment.blockId === blockId)) {
    throw new Error(`Block '${blockId}' already has a speaker assignment.`);
  }

  if (input.role === "character") {
    if (!input.characterId) {
      throw new Error("Character speaker assignments require a characterId.");
    }

    if (!project.characters.some((character) => character.id === input.characterId)) {
      throw new Error(`Unknown character '${input.characterId}'.`);
    }
  }

  const speakerAssignment: SpeakerAssignment = {
    id: formatId("speaker", project.sequences.speakerAssignment + 1),
    blockId,
    role: input.role,
    speakerLabel: nonEmpty(input.speakerLabel, "Speaker label"),
    ...(input.characterId ? { characterId: input.characterId } : {}),
  };

  const chapters = project.chapters.map((chapter, chapterIndex) =>
    chapterIndex === location.chapterIndex
      ? {
          ...chapter,
          scenes: chapter.scenes.map((scene, sceneIndex) =>
            sceneIndex === location.sceneIndex
              ? {
                  ...scene,
                  blocks: scene.blocks.map((block) =>
                    block.id === blockId && block.kind === "dialogue" && input.characterId
                      ? {
                          ...block,
                          speakerId: input.characterId,
                        }
                      : block,
                  ),
                }
              : scene,
          ),
        }
      : chapter,
  );

  return {
    project: touch(project, now, {
      chapters,
      speakerAssignments: [...project.speakerAssignments, speakerAssignment],
      sequences: {
        ...project.sequences,
        speakerAssignment: project.sequences.speakerAssignment + 1,
      },
    }),
    speakerAssignment,
  };
}

// Intent: project manuscript hierarchy into binder nodes without losing canonical IDs.
export function buildBinderTree(project: Project): BinderNode {
  return {
    id: `binder-${project.id}`,
    kind: "project",
    refId: project.id,
    title: project.title,
    order: 1,
    children: project.chapters.map((chapter) => ({
      id: `binder-${chapter.id}`,
      kind: "chapter",
      refId: chapter.id,
      title: chapter.title,
      order: chapter.order,
      children: chapter.scenes.map((scene) => ({
        id: `binder-${scene.id}`,
        kind: "scene",
        refId: scene.id,
        title: scene.title,
        order: scene.order,
        children: [],
      })),
    })),
  };
}

export function buildManuscriptIndex(project: Project): ManuscriptIndexEntry[] {
  const entries: ManuscriptIndexEntry[] = [];
  let lineNumber = 1;

  for (const chapter of project.chapters) {
    for (const scene of chapter.scenes) {
      for (const block of scene.blocks) {
        entries.push({
          chapterId: chapter.id,
          sceneId: scene.id,
          blockId: block.id,
          paragraphId: block.paragraphId,
          chapterOrder: chapter.order,
          sceneOrder: scene.order,
          blockOrder: block.order,
          lineNumber,
          kind: block.kind,
        });
        lineNumber += 1;
      }
    }
  }

  return entries;
}

// Intent: create validated manuscript anchors for diagnostics, event tags, narration, and notes.
export function createManuscriptAnchor(
  project: Project,
  input: AnchorInput,
): ManuscriptAnchor {
  const location = findBlock(project, input.blockId);

  if (!location) {
    throw new Error(`Unknown block '${input.blockId}'.`);
  }

  const startOffset = input.startOffset ?? 0;
  const endOffset = input.endOffset ?? location.block.text.length;

  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset)) {
    throw new Error("Anchor offsets must be integers.");
  }

  if (startOffset < 0 || endOffset < startOffset || endOffset > location.block.text.length) {
    throw new Error(
      `Invalid anchor range ${startOffset}-${endOffset} for block '${location.block.id}'.`,
    );
  }

  return {
    projectId: project.id,
    chapterId: location.chapter.id,
    sceneId: location.scene.id,
    blockId: location.block.id,
    paragraphId: location.block.paragraphId,
    startOffset,
    endOffset,
  };
}

export function resolveManuscriptAnchor(
  project: Project,
  anchor: ManuscriptAnchor,
): ResolvedManuscriptAnchor {
  if (anchor.projectId !== project.id) {
    throw new Error(
      `Anchor project '${anchor.projectId}' does not match project '${project.id}'.`,
    );
  }

  const location = findBlock(project, anchor.blockId);

  if (!location) {
    throw new Error(`Unknown block '${anchor.blockId}'.`);
  }

  if (
    location.chapter.id !== anchor.chapterId ||
    location.scene.id !== anchor.sceneId ||
    location.block.paragraphId !== anchor.paragraphId
  ) {
    throw new Error("Anchor does not match the current manuscript hierarchy.");
  }

  const index = buildManuscriptIndex(project).find((entry) => entry.blockId === anchor.blockId);

  if (!index) {
    throw new Error(`Unable to build index entry for block '${anchor.blockId}'.`);
  }

  return {
    chapter: location.chapter,
    scene: location.scene,
    block: location.block,
    excerpt: location.block.text.slice(anchor.startOffset, anchor.endOffset),
    index,
  };
}

export function addIssueRecord(
  project: Project,
  input: AddIssueInput,
  now?: string,
): { project: Project; issue: IssueRecord } {
  const resolved = resolveManuscriptAnchor(project, input.anchor);
  const issue: IssueRecord = {
    id: formatId("issue", project.sequences.issue + 1),
    category: input.category,
    severity: input.severity,
    summary: nonEmpty(input.summary, "Issue summary"),
    ...(input.detail?.trim() ? { detail: input.detail.trim() } : {}),
    source: input.source ?? "manual",
    confidence: normalizeConfidence(input.confidence ?? 1),
    lifecycle: "open",
    anchor: input.anchor,
    evidenceExcerpt: resolved.excerpt,
    createdAt: resolveNow(now),
  };

  return {
    project: touch(project, now, {
      issues: [...project.issues, issue],
      sequences: {
        ...project.sequences,
        issue: project.sequences.issue + 1,
      },
    }),
    issue,
  };
}

// Intent: store event pins as structured, anchor-backed story events.
export function addEventTag(
  project: Project,
  input: AddEventTagInput,
  now?: string,
): { project: Project; eventTag: EventTag } {
  const resolved = resolveManuscriptAnchor(project, input.anchor);
  const eventTag: EventTag = {
    id: formatId("event", project.sequences.event + 1),
    kind: input.kind,
    label: nonEmpty(input.label, "Event label"),
    source: input.source ?? "manual",
    anchor: input.anchor,
    evidenceExcerpt: resolved.excerpt,
    createdAt: resolveNow(now),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  };

  return {
    project: touch(project, now, {
      eventTags: [...project.eventTags, eventTag],
      sequences: {
        ...project.sequences,
        event: project.sequences.event + 1,
      },
    }),
    eventTag,
  };
}

// Intent: store durable author marks as anchored manuscript data rather than editor decoration state.
export function addManuscriptMark(
  project: Project,
  input: AddManuscriptMarkInput,
  now?: string,
): { project: Project; mark: ManuscriptMark } {
  const resolved = resolveManuscriptAnchor(project, input.anchor);
  const timestamp = resolveNow(now);
  const sequence = resolveSequence(project.sequences.mark);
  const evidence = createManuscriptMarkEvidence(resolved.block.text, input.anchor);
  const mark: ManuscriptMark = {
    id: formatId("mark", sequence + 1),
    kind: input.kind,
    anchor: input.anchor,
    source: input.source ?? "author",
    anchorStatus: "resolved",
    anchorDirtyReason: "",
    evidenceMode: evidence.evidenceMode,
    evidenceExcerpt: evidence.evidenceExcerpt,
    originalHash: evidence.originalHash,
    originalLength: evidence.originalLength,
    selectedTextPreview: evidence.selectedTextPreview,
    prefixContext: evidence.prefixContext,
    suffixContext: evidence.suffixContext,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(input.metadata ? { metadata: normalizeManuscriptMarkMetadata(input.metadata) } : {}),
  };

  return {
    project: touch(project, now, {
      marks: [...(project.marks ?? []), mark],
      sequences: {
        ...project.sequences,
        mark: sequence + 1,
      },
    }),
    mark,
  };
}

interface SceneLocation {
  chapterIndex: number;
  sceneIndex: number;
  chapter: Chapter;
  scene: Scene;
}

interface BlockLocation extends SceneLocation {
  block: ManuscriptBlock;
}

// Intent: keep hierarchy lookup helpers private so callers use validated public anchor APIs.
function findSceneLocation(project: Project, sceneId: string): SceneLocation | null {
  for (let chapterIndex = 0; chapterIndex < project.chapters.length; chapterIndex += 1) {
    const chapter = project.chapters[chapterIndex];
    const sceneIndex = chapter.scenes.findIndex((scene) => scene.id === sceneId);

    if (sceneIndex !== -1) {
      return {
        chapterIndex,
        sceneIndex,
        chapter,
        scene: chapter.scenes[sceneIndex],
      };
    }
  }

  return null;
}

function findBlock(project: Project, blockId: string): BlockLocation | null {
  for (let chapterIndex = 0; chapterIndex < project.chapters.length; chapterIndex += 1) {
    const chapter = project.chapters[chapterIndex];

    for (let sceneIndex = 0; sceneIndex < chapter.scenes.length; sceneIndex += 1) {
      const scene = chapter.scenes[sceneIndex];
      const block = scene.blocks.find((candidate) => candidate.id === blockId);

      if (block) {
        return {
          chapterIndex,
          sceneIndex,
          chapter,
          scene,
          block,
        };
      }
    }
  }

  return null;
}

function touch(project: Project, now: string | undefined, patch: Partial<Project>): Project {
  return {
    ...project,
    ...patch,
    updatedAt: resolveNow(now),
  };
}

function resolveNow(now?: string): string {
  return now ?? new Date().toISOString();
}

function nonEmpty(value: string, label: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${label} cannot be empty.`);
  }

  return trimmed;
}

function formatId(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}

function resolveSequence(sequence: number | undefined): number {
  return Number.isInteger(sequence) && sequence >= 0 ? sequence : 0;
}

function normalizeConfidence(confidence: number): number {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("Issue confidence must be between 0 and 1.");
  }

  return Number(confidence.toFixed(4));
}

function normalizeManuscriptMarkMetadata(metadata: ManuscriptMarkMetadata): ManuscriptMarkMetadata {
  const normalized: ManuscriptMarkMetadata = {};

  if (metadata.colorToken?.trim()) {
    normalized.colorToken = metadata.colorToken.trim();
  }

  if (metadata.purpose) {
    normalized.purpose = metadata.purpose;
  }

  const highlightColor = normalizeManuscriptMarkHighlightColor(metadata.highlightColor);
  if (highlightColor) {
    normalized.highlightColor = highlightColor;
  }

  return normalized;
}

function normalizeManuscriptMarkHighlightColor(
  candidate: ManuscriptMarkHighlightColor | undefined,
): ManuscriptMarkHighlightColor | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const color = normalizeRgbaColor(candidate.color);
  const outline = normalizeRgbaColor(candidate.outline);
  if (!color || !outline) {
    return null;
  }

  const id = candidate.id?.trim() ?? "";
  const label = candidate.label?.trim() ?? "";
  return {
    ...(id ? { id } : {}),
    ...(label ? { label } : {}),
    color,
    outline,
    ...(candidate.rgb ? {
      rgb: {
        red: clampColorChannel(candidate.rgb.red),
        green: clampColorChannel(candidate.rgb.green),
        blue: clampColorChannel(candidate.rgb.blue),
      },
    } : {}),
  };
}

function normalizeRgbaColor(value: string | undefined): string {
  const source = String(value ?? "").trim();
  const match = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/i.exec(source);
  if (!match) {
    return "";
  }

  const red = clampColorChannel(Number(match[1]));
  const green = clampColorChannel(Number(match[2]));
  const blue = clampColorChannel(Number(match[3]));
  const alpha = Math.max(0, Math.min(1, Number(match[4])));
  return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(3)).toString()})`;
}

function clampColorChannel(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(255, Math.round(value)));
}

function createManuscriptMarkEvidence(
  text: string,
  anchor: ManuscriptAnchor,
): {
  evidenceMode: ManuscriptAnchorEvidenceMode;
  evidenceExcerpt: string;
  originalHash: string;
  originalLength: number;
  selectedTextPreview: string;
  prefixContext: string;
  suffixContext: string;
} {
  const selectedText = text.slice(anchor.startOffset, anchor.endOffset);
  const evidenceMode =
    selectedText.length <= DEFAULT_MARK_FULL_EVIDENCE_LIMIT ? "full" : "hash-context";

  return {
    evidenceMode,
    evidenceExcerpt: evidenceMode === "full" ? selectedText : "",
    originalHash: createStableTextHash(selectedText),
    originalLength: selectedText.length,
    selectedTextPreview: selectedText.slice(0, DEFAULT_MARK_PREVIEW_LIMIT),
    prefixContext: text.slice(Math.max(0, anchor.startOffset - DEFAULT_MARK_CONTEXT_LIMIT), anchor.startOffset),
    suffixContext: text.slice(anchor.endOffset, Math.min(text.length, anchor.endOffset + DEFAULT_MARK_CONTEXT_LIMIT)),
  };
}

function createStableTextHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
}
