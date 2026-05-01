import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  addBlock,
  addCharacter,
  addChapter,
  addEventTag,
  addIssueRecord,
  addScene,
  assignSpeaker,
  buildBinderTree,
  buildManuscriptIndex,
  createManuscriptAnchor,
  createProject,
  resolveManuscriptAnchor,
  type ManuscriptAnchor,
  type Project,
} from "../../../packages/manuscript-schema/src/index.ts";
import {
  addTimelineNode,
  addTimelineSpine,
  addWorldTemplate,
  createWorldModel,
  instantiateWorldEntity,
  linkTimelineNodes,
  registerEntityIntroduction,
  type TemplateValue,
  type TimelineEdge,
  type TimelineNode,
  type TimelineSpine,
  type WorldEntity,
  type WorldModel,
  type WorldTemplate,
} from "../../../packages/world-schema/src/index.ts";
import {
  formatCharacterRecord,
} from "../../../packages/shared-types/src/index.ts";
import type {
  AnalysisSuggestion,
  EditorWorkspaceSnapshot,
  IssueConsoleRecord,
  SuggestionQueueRecord,
  TimelineEdgeRecord,
  TimelineNodeRecord,
  TimelineSpineRecord,
  VoiceWorkspaceSnapshot,
  WorldEntityRecord,
  WorldWorkspaceSnapshot,
  WorkspaceLineRecord,
  WorkspaceNavigationTarget,
} from "../../../packages/shared-types/src/index.ts";
import { createLocalAnalysisService } from "../../../services/analysis/src/index.ts";
import { createInMemoryAudioService } from "../../../services/audio/src/index.ts";
import { createInMemoryVoiceService } from "../../../services/voice/src/index.ts";
import { createDesktopSettingsSnapshot } from "./settings.ts";
import {
  logDesktopError,
  logDesktopInfo,
} from "./logger.ts";

export interface ImportedProjectData {
  schemaVersion: number;
  generatedAt: string;
  project: Project;
  world: WorldModel;
  manuscriptTasks: any[];
  passageNotes: any[];
  sourceArchive?: ImportedSourceArchiveItem[];
  importReport: Record<string, unknown>;
}

export interface ImportedSourceArchiveItem {
  id: string;
  title: string;
  kind: string;
  binderPath: string;
  scrivenerDocumentId?: string;
  assetPath?: string;
  bodyPreview?: string;
}

export interface ProjectSettingsSnapshot {
  editorPrefs: Record<string, unknown>;
  localAiPrefs: Record<string, unknown>;
  binderPanelWidth: number;
  consoleDockWidth: number;
  consoleDockCollapsed: boolean;
  collapsedChapterIds: string[];
  collapsedConsoleChapterIds: {
    issueTasks: string[];
    issues: string[];
    inspiration: string[];
    research: string[];
  };
  projectFilePath: string;
  projectIntegratorPath: string;
  writingTargetState: Record<string, unknown>;
  writingTargetViewMode: string;
  writingTargetSelectedDateKey: string;
  writingTargetCalendarMonthKey: string;
}

export interface ProjectLibrarySeedRecord {
  id: string;
  title: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  workspace: EditorWorkspaceSnapshot;
  sceneDrafts: Record<string, unknown>;
  structureDrafts: { scenes: unknown[] };
  templateDrafts: unknown[];
  manuscriptTasks: any[];
  passageNotes: any[];
  sourceArchive: ImportedSourceArchiveItem[];
  importReport: Record<string, unknown>;
  projectSettings: ProjectSettingsSnapshot;
  editorPrefs: Record<string, unknown>;
  localAiPrefs: Record<string, unknown>;
}

export interface ProjectLibrarySeedSnapshot {
  activeProjectId: string;
  projects: ProjectLibrarySeedRecord[];
}

const SERVA_VITAE_IMPORT_SCRIPT_PATH = fileURLToPath(
  new URL("../../../scripts/build-project-data.mjs", import.meta.url),
);
const SERVA_VITAE_IMPORT_INDEX_PATH = fileURLToPath(
  new URL(
    "../../../Project Serva Vitae Novel & WoldBuild Combined Cloud.scriv/Project Serva Vitae Novel & WoldBuild Combined Cloud.scrivx",
    import.meta.url,
  ),
);
const SERVA_VITAE_IMPORT_DATA_ROOT = fileURLToPath(
  new URL(
    "../../../Project Serva Vitae Novel & WoldBuild Combined Cloud.scriv/Files/Data",
    import.meta.url,
  ),
);
const SERVA_VITAE_IMPORT_OUTPUT_PATH = path.join(
  tmpdir(),
  "abe-serva-vitae-project-data.json",
);

let cachedServaVitaeImportBundle: ImportedProjectData | null = null;
let cachedServaVitaeProjectLibrarySeed: ProjectLibrarySeedSnapshot | null = null;

interface ProjectAnchors {
  khepriAnchor: ManuscriptAnchor;
  vossAnchor: ManuscriptAnchor;
  treatyAnchor: ManuscriptAnchor;
  corridorAnchor: ManuscriptAnchor;
  warTheoryAnchor: ManuscriptAnchor;
}

const DREAM_SCAPE_IDEA = {
  title: "Signal under the ice",
  text:
    "A powerful scene where an old corridor beacon wakes beneath Khepri and makes the treaty silence feel staged rather than accidental.",
};

function createDefaultProjectSettingsSnapshot(generatedAt: string): ProjectSettingsSnapshot {
  const parsedDate = new Date(generatedAt);
  const effectiveDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const dateKey = effectiveDate.toISOString().slice(0, 10);

  return {
    editorPrefs: {},
    localAiPrefs: { enabled: true },
    binderPanelWidth: 320,
    consoleDockWidth: 320,
    consoleDockCollapsed: false,
    collapsedChapterIds: [],
    collapsedConsoleChapterIds: {
      issueTasks: [],
      issues: [],
      inspiration: [],
      research: [],
    },
    projectFilePath: "",
    projectIntegratorPath: "",
    writingTargetState: {},
    writingTargetViewMode: "month",
    writingTargetSelectedDateKey: dateKey,
    writingTargetCalendarMonthKey: dateKey.slice(0, 7),
  };
}

export function createDesktopWorkspaceSnapshot(): EditorWorkspaceSnapshot {
  const seededProject = buildSeedProject();
  let project = seededProject.project;
  const world = buildSeedWorld(project, seededProject.anchors);
  const analysisService = createLocalAnalysisService();
  const analysisBatch = analysisService.analyzeWorkspace(
    project,
    world,
    "2026-04-21T06:00:00.000Z",
  );
  const dreamScapeBatch = analysisService.exploreDreamScape({
    project,
    world,
    ideaTitle: DREAM_SCAPE_IDEA.title,
    ideaText: DREAM_SCAPE_IDEA.text,
    now: "2026-04-21T06:00:30.000Z",
  });

  for (const issue of analysisBatch.issues) {
    project = addIssueRecord(
      project,
      {
        category: issue.category,
        severity: issue.severity,
        summary: issue.summary,
        detail: issue.detail,
        source: issue.source,
        confidence: issue.confidence,
        anchor: issue.anchor,
      },
      "2026-04-21T06:01:00.000Z",
    ).project;
  }

  for (const event of analysisBatch.events) {
    project = addEventTag(
      project,
      {
        kind: event.kind,
        label: event.label,
        source: event.source,
        notes: event.notes,
        anchor: event.anchor,
      },
      "2026-04-21T06:02:00.000Z",
    ).project;
  }

  const binder = buildBinderTree(project);
  const manuscriptIndex = buildManuscriptIndex(project);
  const projectSnapshot = buildProjectSnapshot(project, binder, manuscriptIndex);
  const worldSnapshot = buildWorldSnapshot(project, world);
  const suggestionQueue = buildSuggestionQueue(project, [
    ...analysisBatch.suggestions,
    ...dreamScapeBatch.suggestions,
  ]);

  const audioService = createInMemoryAudioService();
  const startLine = projectSnapshot.lines.find((line) => line.blockId === seededProject.treatyBlockId);

  if (!startLine) {
    throw new Error("Unable to resolve narration start line.");
  }

  const narrationSession = audioService.startNarrationSession({
    project,
    sessionLabel: "Chapter 1 read-through",
    anchor: seededProject.anchors.treatyAnchor,
    currentLineNumber: startLine.lineNumber,
    currentText: startLine.text,
    now: "2026-04-21T06:03:00.000Z",
  });
  const alignment = audioService.alignNarration({
    session: narrationSession,
    projectId: project.id,
    anchor: seededProject.anchors.treatyAnchor,
    transcript: "Auren heard the word treaty and felt the bridge go still",
    resolvedText: startLine.text,
    matchedLineNumber: startLine.lineNumber,
    confidence: 0.91,
    now: "2026-04-21T06:04:00.000Z",
  });

  const voiceService = createInMemoryVoiceService();
  const profiles = voiceService.listProfiles();
  const bindings = voiceService.createSpeakerBindings({
    project,
    assignments: project.speakerAssignments,
  });
  const previewJob = voiceService.queueVoicePreview({
    projectId: project.id,
    sceneId: "scene-0002",
    bindingIds: bindings.slice(0, 2).map((binding) => binding.id),
    now: "2026-04-21T06:05:00.000Z",
  });
  const chapterRenderJob = voiceService.queueChapterRender({
    projectId: project.id,
    chapterId: "chapter-0002",
    bindingIds: bindings.map((binding) => binding.id),
    now: "2026-04-21T06:06:00.000Z",
  });

  const voiceSnapshot: VoiceWorkspaceSnapshot = {
    provider: voiceService.provider,
    profiles,
    bindings,
    renderJobs: [previewJob, chapterRenderJob],
    recordings: [],
  };

  return {
    generatedAt: "2026-04-21T06:10:00.000Z",
    workspaceTitle: "ABetterNovelAuthoringEnvironment",
    settings: createDesktopSettingsSnapshot(),
    project: projectSnapshot,
    world: worldSnapshot,
    analysis: {
      provider: analysisService.provider,
      lastJob: analysisBatch.job,
      suggestionQueue,
      dreamScaping: {
        ideaTitle: DREAM_SCAPE_IDEA.title,
        ideaText: DREAM_SCAPE_IDEA.text,
        suggestionIds: dreamScapeBatch.suggestions.map((suggestion) => suggestion.id),
      },
    },
    narration: {
      provider: audioService.provider,
      session: alignment.session,
      alignmentJobs: [alignment.job],
    },
    voice: voiceSnapshot,
    selectionDefaults: {
      lineId: projectSnapshot.issues[0]?.blockId ?? projectSnapshot.lines[0].blockId,
      issueId: projectSnapshot.issues[0]?.id,
      nodeId: worldSnapshot.spines[0]?.nodes[0]?.id,
      entityId: worldSnapshot.entities[0]?.id,
    },
  };
}

export function createServaVitaeProjectLibrarySeed(): ProjectLibrarySeedSnapshot {
  if (cachedServaVitaeProjectLibrarySeed) {
    return cachedServaVitaeProjectLibrarySeed;
  }

  const imported = loadServaVitaeImportBundle();
  const seed = createProjectLibrarySeedFromImportedData(imported, {
    sourceLabel: "Serva Vitae",
  });
  cachedServaVitaeProjectLibrarySeed = seed;
  return seed;
}

export function createProjectLibrarySeedFromImportedData(
  imported: ImportedProjectData,
  options: { sourceLabel?: string } = {},
): ProjectLibrarySeedSnapshot {
  logDesktopInfo("import", `Loaded the ${options.sourceLabel ?? imported.project.title} Scrivener import bundle.`, {
    projectId: imported.project.id,
    projectTitle: imported.project.title,
    chapters: imported.project.chapters.length,
    scenes: imported.project.chapters.reduce((count, chapter) => count + chapter.scenes.length, 0),
    templates: imported.world.templates.length,
    manuscriptTasks: imported.manuscriptTasks.length,
    passageNotes: imported.passageNotes.length,
    archivedItems: imported.sourceArchive?.length ?? 0,
  });
  let project = cloneImportProject(imported.project);
  let world = cloneImportWorld(imported.world);
  const analysisService = createLocalAnalysisService();
  const analysisBatch = analysisService.analyzeWorkspace(
    project,
    world,
    imported.generatedAt,
  );
  const dreamScapeBatch = analysisService.exploreDreamScape({
    project,
    world,
    ideaTitle: DREAM_SCAPE_IDEA.title,
    ideaText: DREAM_SCAPE_IDEA.text,
    now: imported.generatedAt,
  });

  for (const issue of analysisBatch.issues) {
    project = addIssueRecord(
      project,
      {
        category: issue.category,
        severity: issue.severity,
        summary: issue.summary,
        detail: issue.detail,
        source: issue.source,
        confidence: issue.confidence,
        anchor: issue.anchor,
      },
      imported.generatedAt,
    ).project;
  }

  for (const event of analysisBatch.events) {
    project = addEventTag(
      project,
      {
        kind: event.kind,
        label: event.label,
        source: event.source,
        notes: event.notes,
        anchor: event.anchor,
      },
      imported.generatedAt,
    ).project;
  }

  const binder = buildBinderTree(project);
  const manuscriptIndex = buildManuscriptIndex(project);
  const projectSnapshot = buildProjectSnapshot(project, binder, manuscriptIndex);
  const worldSnapshot = buildWorldSnapshot(project, world);
  const suggestionQueue = buildSuggestionQueue(project, [
    ...analysisBatch.suggestions,
    ...dreamScapeBatch.suggestions,
  ]);
  const firstLine = projectSnapshot.lines[0];
  if (!firstLine) {
    throw new Error(`Unable to resolve a seed narration line for ${projectSnapshot.title}.`);
  }

  const audioService = createInMemoryAudioService();
  const narrationSession = audioService.startNarrationSession({
    project,
    sessionLabel: `${projectSnapshot.title} seed read-through`,
    anchor: createProjectNarrationAnchor(project, firstLine),
    currentLineNumber: firstLine.lineNumber,
    currentText: firstLine.text,
    now: imported.generatedAt,
  });
  const alignment = audioService.alignNarration({
    session: narrationSession,
    projectId: project.id,
    anchor: createProjectNarrationAnchor(project, firstLine),
    transcript: firstLine.text.slice(0, 96),
    resolvedText: firstLine.text,
    matchedLineNumber: firstLine.lineNumber,
    confidence: 0.95,
    now: imported.generatedAt,
  });

  const voiceService = createInMemoryVoiceService();
  const bindings = voiceService.createSpeakerBindings({
    project,
    assignments: project.speakerAssignments,
  });
  const firstScene = projectSnapshot.lines.find((line) => line.sceneId === firstLine.sceneId) ?? firstLine;
  const previewJob = voiceService.queueVoicePreview({
    projectId: project.id,
    sceneId: firstScene.sceneId,
    bindingIds: bindings.slice(0, 2).map((binding) => binding.id),
    now: imported.generatedAt,
  });
  const chapterRenderJob = voiceService.queueChapterRender({
    projectId: project.id,
    chapterId: firstLine.chapterId,
    bindingIds: bindings.map((binding) => binding.id),
    now: imported.generatedAt,
  });

  const workspace: EditorWorkspaceSnapshot = {
    generatedAt: imported.generatedAt,
    workspaceTitle: "ABetterNovelAuthoringEnvironment",
    settings: createDesktopSettingsSnapshot(),
    project: projectSnapshot,
    world: worldSnapshot,
    analysis: {
      provider: analysisService.provider,
      lastJob: analysisBatch.job,
      suggestionQueue,
      dreamScaping: {
        ideaTitle: DREAM_SCAPE_IDEA.title,
        ideaText: DREAM_SCAPE_IDEA.text,
        suggestionIds: dreamScapeBatch.suggestions.map((suggestion) => suggestion.id),
      },
    },
    narration: {
      provider: audioService.provider,
      session: alignment.session,
      alignmentJobs: [alignment.job],
    },
    voice: {
      provider: voiceService.provider,
      profiles: voiceService.listProfiles(),
      bindings,
      renderJobs: [previewJob, chapterRenderJob],
      recordings: [],
    },
    selectionDefaults: {
      lineId: firstLine.blockId,
      issueId: projectSnapshot.issues[0]?.id,
      nodeId: worldSnapshot.spines[0]?.nodes[0]?.id,
      entityId: worldSnapshot.entities[0]?.id,
    },
  };

  return {
    activeProjectId: projectSnapshot.id,
    projects: [
      {
        id: projectSnapshot.id,
        title: projectSnapshot.title,
        source: "scrivener-import",
        createdAt: imported.generatedAt,
        updatedAt: imported.generatedAt,
        workspace,
        sceneDrafts: {},
        structureDrafts: { scenes: [] },
        templateDrafts: [],
        manuscriptTasks: imported.manuscriptTasks,
        passageNotes: imported.passageNotes,
        sourceArchive: imported.sourceArchive ?? [],
        importReport: imported.importReport,
        projectSettings: createDefaultProjectSettingsSnapshot(imported.generatedAt),
        editorPrefs: {},
        localAiPrefs: { enabled: true },
      },
    ],
  };
}

function loadServaVitaeImportBundle(): ImportedProjectData {
  if (cachedServaVitaeImportBundle) {
    return cachedServaVitaeImportBundle;
  }

  const result = spawnSync(process.execPath, [
    SERVA_VITAE_IMPORT_SCRIPT_PATH,
    "--index",
    SERVA_VITAE_IMPORT_INDEX_PATH,
    "--data-root",
    SERVA_VITAE_IMPORT_DATA_ROOT,
    "--output",
    SERVA_VITAE_IMPORT_OUTPUT_PATH,
    "--now",
    "2026-04-21T05:00:00.000Z",
    "--project-title",
    "Project Serva Vitae",
    "--project-id",
    "project-serva-vitae",
    "--world-id",
    "world-serva-vitae",
  ], {
    encoding: "utf8",
  });

  if (result.error) {
    logDesktopError("import", "The Scrivener import script failed to spawn.", {
      error: result.error,
    });
    throw result.error;
  }

  if (result.status !== 0) {
    logDesktopError("import", "The Scrivener import script exited with an error.", {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    });
    throw new Error(
      `Scrivener import failed with status ${result.status}: ${result.stderr || result.stdout || "unknown error"}`,
    );
  }

  try {
    const payload = JSON.parse(readFileSync(SERVA_VITAE_IMPORT_OUTPUT_PATH, "utf8")) as ImportedProjectData;
    cachedServaVitaeImportBundle = payload;
    return payload;
  } catch (error) {
    logDesktopError("import", "Unable to read the Serva Vitae import output bundle.", {
      error,
      outputPath: SERVA_VITAE_IMPORT_OUTPUT_PATH,
    });
    throw error;
  }
}

function cloneImportProject(project: Project): Project {
  return cloneValue(project);
}

function cloneImportWorld(world: WorldModel): WorldModel {
  return cloneValue(world);
}

function createProjectNarrationAnchor(project: Project, line: WorkspaceLineRecord): ManuscriptAnchor {
  const paragraphId =
    project.chapters
      .flatMap((chapter) => chapter.scenes)
      .flatMap((scene) => scene.blocks)
      .find((block) => block.id === line.blockId)?.paragraphId ?? "";

  return {
    projectId: project.id,
    chapterId: line.chapterId,
    sceneId: line.sceneId,
    blockId: line.blockId,
    paragraphId,
    startOffset: 0,
    endOffset: line.text.length,
  };
}

function cloneValue(value: unknown) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function buildSeedProject(): {
  project: Project;
  anchors: ProjectAnchors;
  treatyBlockId: string;
} {
  let project = createProject({
    id: "project-quiet-index",
    title: "The Quiet Index",
    now: "2026-04-21T05:00:00.000Z",
  });

  const auren = addCharacter(
    project,
    {
      name: "Captain Auren Vale",
      aliases: [{ value: "Auren Vale" }, { kind: "title", value: "Captain Auren" }],
      notes: "Commanding officer of the inbound frigate.",
    },
    "2026-04-21T05:00:30.000Z",
  );
  project = auren.project;

  const voss = addCharacter(
    project,
    {
      name: "Inspector Voss",
      aliases: [{ value: "Voss" }],
      notes: "Halcyon customs authority contact.",
    },
    "2026-04-21T05:00:40.000Z",
  );
  project = voss.project;

  const mara = addCharacter(
    project,
    {
      name: "Mara Ell",
      aliases: [{ value: "Mara" }],
      notes: "Archive specialist tracking route history.",
    },
    "2026-04-21T05:00:50.000Z",
  );
  project = mara.project;

  const chapterArrival = addChapter(
    project,
    {
      title: "Arrival Vector",
      summary: "The frigate enters Halcyon Station with treaty pressure building.",
    },
    "2026-04-21T05:01:00.000Z",
  );
  project = chapterArrival.project;

  const sceneDocking = addScene(
    project,
    chapterArrival.chapter.id,
    {
      title: "Docking Approach",
      synopsis: "Auren guides the frigate through the station perimeter.",
    },
    "2026-04-21T05:02:00.000Z",
  );
  project = sceneDocking.project;

  const blockApproach = addBlock(
    project,
    sceneDocking.scene.id,
    {
      kind: "narration",
      text: "The frigate drifted toward Halcyon Station beneath a field of torn blue plasma.",
    },
    "2026-04-21T05:03:00.000Z",
  );
  project = blockApproach.project;

  const blockOrder = addBlock(
    project,
    sceneDocking.scene.id,
    {
      kind: "dialogue",
      text: "Keep the lights low until we clear the customs ring.",
    },
    "2026-04-21T05:04:00.000Z",
  );
  project = blockOrder.project;

  project = assignSpeaker(
    project,
    blockOrder.block.id,
    {
      role: "character",
      characterId: auren.character.id,
      speakerLabel: "Captain Auren Vale",
    },
    "2026-04-21T05:04:10.000Z",
  ).project;

  const blockKhepri = addBlock(
    project,
    sceneDocking.scene.id,
    {
      kind: "narration",
      text: "Below them, Khepri turned under bands of silver storm ice.",
    },
    "2026-04-21T05:05:00.000Z",
  );
  project = blockKhepri.project;

  const sceneCustoms = addScene(
    project,
    chapterArrival.chapter.id,
    {
      title: "Customs Ring",
      synopsis: "Station control delays entry and sharpens the treaty tension.",
    },
    "2026-04-21T05:06:00.000Z",
  );
  project = sceneCustoms.project;

  const blockVoss = addBlock(
    project,
    sceneCustoms.scene.id,
    {
      kind: "dialogue",
      text: "You are early, Captain. The treaty envoys have not docked.",
    },
    "2026-04-21T05:07:00.000Z",
  );
  project = blockVoss.project;

  project = assignSpeaker(
    project,
    blockVoss.block.id,
    {
      role: "character",
      characterId: voss.character.id,
      speakerLabel: "Inspector Voss",
    },
    "2026-04-21T05:07:10.000Z",
  ).project;

  const blockTreaty = addBlock(
    project,
    sceneCustoms.scene.id,
    {
      kind: "narration",
      text: "Auren heard the word treaty and felt the bridge go still.",
    },
    "2026-04-21T05:08:00.000Z",
  );
  project = blockTreaty.project;

  const chapterArchive = addChapter(
    project,
    {
      title: "Archive Heat",
      summary: "Mara uncovers a route record that reframes the war.",
    },
    "2026-04-21T05:09:00.000Z",
  );
  project = chapterArchive.project;

  const sceneVault = addScene(
    project,
    chapterArchive.chapter.id,
    {
      title: "Vault of Maps",
      synopsis: "An old chart reveals the Leviathan Corridor.",
    },
    "2026-04-21T05:10:00.000Z",
  );
  project = sceneVault.project;

  const blockCorridor = addBlock(
    project,
    sceneVault.scene.id,
    {
      kind: "narration",
      text: "In the archive vault, Mara found the first map that named the Leviathan Corridor.",
    },
    "2026-04-21T05:11:00.000Z",
  );
  project = blockCorridor.project;

  const blockTheory = addBlock(
    project,
    sceneVault.scene.id,
    {
      kind: "dialogue",
      text: "If the corridor is real, the war started here.",
    },
    "2026-04-21T05:12:00.000Z",
  );
  project = blockTheory.project;

  project = assignSpeaker(
    project,
    blockTheory.block.id,
    {
      role: "character",
      characterId: mara.character.id,
      speakerLabel: "Mara Ell",
    },
    "2026-04-21T05:12:10.000Z",
  ).project;

  return {
    project,
    anchors: {
      khepriAnchor: createManuscriptAnchor(project, {
        blockId: blockKhepri.block.id,
        startOffset: 12,
        endOffset: 18,
      }),
      vossAnchor: createManuscriptAnchor(project, {
        blockId: blockVoss.block.id,
        startOffset: 0,
        endOffset: 28,
      }),
      treatyAnchor: createManuscriptAnchor(project, {
        blockId: blockTreaty.block.id,
        startOffset: 21,
        endOffset: 27,
      }),
      corridorAnchor: createManuscriptAnchor(project, {
        blockId: blockCorridor.block.id,
        startOffset: 53,
        endOffset: 71,
      }),
      warTheoryAnchor: createManuscriptAnchor(project, {
        blockId: blockTheory.block.id,
        startOffset: 29,
        endOffset: 45,
      }),
    },
    treatyBlockId: blockTreaty.block.id,
  };
}

function buildSeedWorld(project: Project, anchors: ProjectAnchors): WorldModel {
  let world = createWorldModel({
    id: "world-quiet-index",
    title: "Halcyon Sector Reference",
    now: "2026-04-21T05:20:00.000Z",
  });

  const planetTemplate = addWorldTemplate(
    world,
    {
      name: "Planet",
      description: "Physical and political metadata for inhabited worlds.",
      fields: [
        { label: "Government", valueType: "text", required: true },
        { label: "Moons", valueType: "number", defaultValue: 0 },
        { label: "Climate", valueType: "text", defaultValue: "temperate" },
      ],
    },
    "2026-04-21T05:21:00.000Z",
  );
  world = planetTemplate.world;

  const factionTemplate = addWorldTemplate(
    world,
    {
      name: "Faction",
      description: "Political or institutional forces that shape the manuscript.",
      fields: [
        { label: "Seat", valueType: "text", required: true },
        { label: "Mandate", valueType: "text", required: true },
        {
          label: "Pressure Level",
          valueType: "enum",
          options: ["low", "rising", "critical"],
          defaultValue: "rising",
        },
      ],
    },
    "2026-04-21T05:22:00.000Z",
  );
  world = factionTemplate.world;

  const routeTemplate = addWorldTemplate(
    world,
    {
      name: "Stellar Route",
      description: "Named routes, corridors, and transit arteries in the world spine.",
      fields: [
        {
          label: "Status",
          valueType: "enum",
          options: ["stable", "contested", "sealed"],
          defaultValue: "contested",
        },
        { label: "Danger Rating", valueType: "number", defaultValue: 4 },
        {
          label: "Traits",
          valueType: "list",
          defaultValue: ["poorly charted"],
        },
      ],
    },
    "2026-04-21T05:23:00.000Z",
  );
  world = routeTemplate.world;

  const khepri = instantiateWorldEntity(
    world,
    planetTemplate.template.id,
    {
      name: "Khepri",
      notes: "Ice-world beneath the Halcyon customs lanes.",
      fieldValues: {
        government: "Consortium Protectorate",
        moons: 2,
        climate: "glacial storm belts",
      },
    },
    "2026-04-21T05:24:00.000Z",
  );
  world = khepri.world;

  const customsDirectorate = instantiateWorldEntity(
    world,
    factionTemplate.template.id,
    {
      name: "Customs Directorate",
      notes: "Station authority enforcing the treaty bottleneck.",
      fieldValues: {
        seat: "Halcyon Station",
        mandate: "Control traffic through the customs ring",
        "pressure-level": "critical",
      },
    },
    "2026-04-21T05:25:00.000Z",
  );
  world = customsDirectorate.world;

  const corridor = instantiateWorldEntity(
    world,
    routeTemplate.template.id,
    {
      name: "Leviathan Corridor",
      notes: "An archival route with possible wartime origins.",
      fieldValues: {
        status: "contested",
        "danger-rating": 5,
        traits: ["poorly charted", "politically sensitive"],
      },
    },
    "2026-04-21T05:26:00.000Z",
  );
  world = corridor.world;

  const orbitSpine = addTimelineSpine(
    world,
    {
      label: "Khepri Orbit",
      kind: "planet",
      description: "Planet-side chronology for the customs perimeter and approach lanes.",
    },
    "2026-04-21T05:27:00.000Z",
  );
  world = orbitSpine.world;

  const treatySpine = addTimelineSpine(
    world,
    {
      label: "Treaty Pressure",
      kind: "thread",
      description: "Political friction between docking control and the envoy schedule.",
    },
    "2026-04-21T05:28:00.000Z",
  );
  world = treatySpine.world;

  const corridorSpine = addTimelineSpine(
    world,
    {
      label: "Corridor Archive",
      kind: "region",
      description: "Archive and route-history beats that influence the larger conflict.",
    },
    "2026-04-21T05:29:00.000Z",
  );
  world = corridorSpine.world;

  const orbitNode = addTimelineNode(
    world,
    orbitSpine.spine.id,
    {
      label: "Khepri first seen",
      summary: "The ice world becomes a visual anchor beneath the station approach.",
      linkedEntityIds: [khepri.entity.id],
      manuscriptAnchors: [anchors.khepriAnchor],
    },
    "2026-04-21T05:30:00.000Z",
  );
  world = orbitNode.world;

  const delayNode = addTimelineNode(
    world,
    treatySpine.spine.id,
    {
      label: "Customs delay declared",
      summary: "Voss delays the envoys and turns docking into leverage.",
      linkedEntityIds: [customsDirectorate.entity.id],
      manuscriptAnchors: [anchors.vossAnchor],
    },
    "2026-04-21T05:31:00.000Z",
  );
  world = delayNode.world;

  const tensionNode = addTimelineNode(
    world,
    treatySpine.spine.id,
    {
      label: "Treaty silence spreads",
      summary: "The bridge reaction shows how much political pressure is already in the room.",
      linkedEntityIds: [customsDirectorate.entity.id],
      manuscriptAnchors: [anchors.treatyAnchor],
    },
    "2026-04-21T05:32:00.000Z",
  );
  world = tensionNode.world;

  const corridorNode = addTimelineNode(
    world,
    corridorSpine.spine.id,
    {
      label: "Leviathan map recovered",
      summary: "Mara finds a chart that turns a rumor into evidence.",
      linkedEntityIds: [corridor.entity.id],
      manuscriptAnchors: [anchors.corridorAnchor],
    },
    "2026-04-21T05:33:00.000Z",
  );
  world = corridorNode.world;

  const theoryNode = addTimelineNode(
    world,
    corridorSpine.spine.id,
    {
      label: "War-origin theory logged",
      summary: "Mara escalates the discovery into a causal claim about the war.",
      linkedEntityIds: [corridor.entity.id],
      manuscriptAnchors: [anchors.warTheoryAnchor],
    },
    "2026-04-21T05:34:00.000Z",
  );
  world = theoryNode.world;

  world = linkTimelineNodes(
    world,
    {
      fromNodeId: orbitNode.node.id,
      toNodeId: delayNode.node.id,
      kind: "references",
      label: "Orbital checkpoint context",
    },
    "2026-04-21T05:35:00.000Z",
  ).world;

  world = linkTimelineNodes(
    world,
    {
      fromNodeId: delayNode.node.id,
      toNodeId: tensionNode.node.id,
      kind: "causes",
      label: "Delay turns political",
    },
    "2026-04-21T05:36:00.000Z",
  ).world;

  world = linkTimelineNodes(
    world,
    {
      fromNodeId: corridorNode.node.id,
      toNodeId: theoryNode.node.id,
      kind: "reveals",
      label: "Evidence enables the claim",
    },
    "2026-04-21T05:37:00.000Z",
  ).world;

  world = registerEntityIntroduction(
    world,
    {
      entityId: khepri.entity.id,
      anchor: anchors.khepriAnchor,
      timelineNodeId: orbitNode.node.id,
      notes: "Planet enters the manuscript as environmental context.",
    },
    "2026-04-21T05:38:00.000Z",
  ).world;

  world = registerEntityIntroduction(
    world,
    {
      entityId: customsDirectorate.entity.id,
      anchor: anchors.vossAnchor,
      timelineNodeId: delayNode.node.id,
      notes: "Institutional authority becomes explicit through Voss.",
    },
    "2026-04-21T05:39:00.000Z",
  ).world;

  world = registerEntityIntroduction(
    world,
    {
      entityId: corridor.entity.id,
      anchor: anchors.corridorAnchor,
      timelineNodeId: corridorNode.node.id,
      notes: "Archive map marks the corridor's first canonical mention.",
    },
    "2026-04-21T05:40:00.000Z",
  ).world;

  return world;
}

function buildProjectSnapshot(
  project: Project,
  binder: ReturnType<typeof buildBinderTree>,
  manuscriptIndex: ReturnType<typeof buildManuscriptIndex>,
): EditorWorkspaceSnapshot["project"] {
  const indexByBlockId = new Map(manuscriptIndex.map((entry) => [entry.blockId, entry]));
  const speakerByBlockId = new Map(
    project.speakerAssignments.map((assignment) => [assignment.blockId, assignment]),
  );
  const lines: WorkspaceLineRecord[] = [];

  for (const chapter of project.chapters) {
    for (const scene of chapter.scenes) {
      for (const block of scene.blocks) {
        const indexEntry = indexByBlockId.get(block.id);

        if (!indexEntry) {
          throw new Error(`Missing index entry for block '${block.id}'.`);
        }

        lines.push({
          id: block.id,
          blockId: block.id,
          paragraphId: block.paragraphId,
          lineNumber: indexEntry.lineNumber,
          sceneLineNumber: block.order,
          kind: block.kind,
          speakerLabel: speakerByBlockId.get(block.id)?.speakerLabel,
          text: block.text,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          sceneId: scene.id,
          sceneTitle: scene.title,
          sceneSynopsis: scene.synopsis,
          startsChapter: scene.order === 1 && block.order === 1,
          startsScene: block.order === 1,
          issueIds: [],
          eventTagIds: [],
        });
      }
    }
  }

  const lineByBlockId = new Map(lines.map((line) => [line.blockId, line]));
  const issues: IssueConsoleRecord[] = project.issues.map((issue) => {
    const resolved = resolveManuscriptAnchor(project, issue.anchor);
    const line = lineByBlockId.get(issue.anchor.blockId);

    if (!line) {
      throw new Error(`Missing line for issue '${issue.id}'.`);
    }

    line.issueIds.push(issue.id);

    return {
      id: issue.id,
      category: issue.category,
      severity: issue.severity,
      summary: issue.summary,
      detail: issue.detail,
      source: issue.source,
      confidence: issue.confidence,
      evidenceExcerpt: resolved.excerpt,
      blockId: issue.anchor.blockId,
      lineNumber: resolved.index.lineNumber,
      sceneLineNumber: line.sceneLineNumber,
      chapterTitle: resolved.chapter.title,
      sceneTitle: resolved.scene.title,
    };
  });

  const eventTags = project.eventTags.map((eventTag) => {
    const resolved = resolveManuscriptAnchor(project, eventTag.anchor);
    const line = lineByBlockId.get(eventTag.anchor.blockId);

    if (!line) {
      throw new Error(`Missing line for event tag '${eventTag.id}'.`);
    }

    line.eventTagIds.push(eventTag.id);

    return {
      id: eventTag.id,
      kind: eventTag.kind,
      label: eventTag.label,
      source: eventTag.source,
      notes: eventTag.notes,
      evidenceExcerpt: resolved.excerpt,
      blockId: eventTag.anchor.blockId,
      lineNumber: resolved.index.lineNumber,
      sceneLineNumber: line.sceneLineNumber,
      chapterTitle: resolved.chapter.title,
      sceneTitle: resolved.scene.title,
    };
  });

  return {
    id: project.id,
    title: project.title,
    binder,
    stats: {
      chapterCount: project.chapters.length,
      sceneCount: project.chapters.reduce((count, chapter) => count + chapter.scenes.length, 0),
      lineCount: lines.length,
      issueCount: issues.length,
      eventCount: eventTags.length,
      characterCount: project.characters.length,
    },
    navigationTargets: buildNavigationTargets(project, lines),
    lines,
    issues,
    eventTags,
    characters: project.characters.map(formatCharacterRecord),
  };
}

function buildNavigationTargets(
  project: Project,
  lines: WorkspaceLineRecord[],
): Record<string, WorkspaceNavigationTarget> {
  const targets: Record<string, WorkspaceNavigationTarget> = {};
  const firstLine = lines[0];

  if (!firstLine) {
    return targets;
  }

  targets[project.id] = {
    refId: project.id,
    kind: "project",
    title: project.title,
    lineId: firstLine.blockId,
    lineNumber: firstLine.lineNumber,
  };

  for (const chapter of project.chapters) {
    const chapterLine = lines.find((line) => line.chapterId === chapter.id);

    if (chapterLine) {
      targets[chapter.id] = {
        refId: chapter.id,
        kind: "chapter",
        title: chapter.title,
        lineId: chapterLine.blockId,
        lineNumber: chapterLine.lineNumber,
      };
    }

    for (const scene of chapter.scenes) {
      const sceneLine = lines.find((line) => line.sceneId === scene.id);

      if (sceneLine) {
        targets[scene.id] = {
          refId: scene.id,
          kind: "scene",
          title: scene.title,
          lineId: sceneLine.blockId,
          lineNumber: sceneLine.lineNumber,
        };
      }
    }
  }

  return targets;
}

function buildWorldSnapshot(project: Project, world: WorldModel): WorldWorkspaceSnapshot {
  const nodeById = new Map(world.nodes.map((node) => [node.id, node]));
  const spineById = new Map(world.spines.map((spine) => [spine.id, spine]));
  const entityById = new Map(world.entities.map((entity) => [entity.id, entity]));
  const templateById = new Map(world.templates.map((template) => [template.id, template]));

  return {
    id: world.id,
    title: world.title,
    stats: {
      templateCount: world.templates.length,
      entityCount: world.entities.length,
      spineCount: world.spines.length,
      nodeCount: world.nodes.length,
      edgeCount: world.edges.length,
    },
    templates: world.templates.map((template) => ({
      id: template.id,
      name: template.name,
      key: template.key,
      description: template.description,
      fieldCount: template.fields.length,
      source: template.source,
      scrivenerDocumentId: template.scrivenerDocumentId,
      scrivenerBinderPath: template.scrivenerBinderPath,
      sourceText: template.sourceText,
    })),
    entities: world.entities.map((entity) =>
      buildEntityRecord(project, entity, templateById, nodeById),
    ),
    spines: world.spines.map((spine) =>
      buildSpineRecord(project, spine, world.nodes, entityById),
    ),
    edges: world.edges.map((edge) => buildEdgeRecord(edge, nodeById, spineById)),
  };
}

function buildSuggestionQueue(
  project: Project,
  suggestions: AnalysisSuggestion[],
): SuggestionQueueRecord[] {
  return suggestions.map((suggestion) => {
    const evidence = suggestion.evidence.map((anchor) => {
      const resolved = resolveManuscriptAnchor(project, anchor);
      const line = project.chapters
        .flatMap((chapter) => chapter.scenes)
        .flatMap((scene) => scene.blocks)
        .find((block) => block.id === anchor.blockId);

      return {
        blockId: anchor.blockId,
        lineNumber: resolved.index.lineNumber,
        sceneLineNumber: line?.order ?? 1,
        chapterTitle: resolved.chapter.title,
        sceneTitle: resolved.scene.title,
        excerpt: resolved.excerpt,
      };
    });

    if (suggestion.suggestionType === "template") {
      return {
        id: suggestion.id,
        suggestionType: suggestion.suggestionType,
        reviewState: suggestion.reviewState,
        title: `${suggestion.templateName} template suggestion`,
        rationale: suggestion.rationale,
        evidence,
        detailLines: suggestion.proposedFields.map(
          (field) =>
            `${field.label} (${field.valueType}${field.required ? ", required" : ""})`,
        ),
      };
    }

    if (suggestion.suggestionType === "entity") {
      return {
        id: suggestion.id,
        suggestionType: suggestion.suggestionType,
        reviewState: suggestion.reviewState,
        title: `${suggestion.entityName} entity suggestion`,
        rationale: suggestion.rationale,
        evidence,
        detailLines: [
          `Template: ${suggestion.templateName}`,
          ...suggestion.proposedFieldValues.map(
            (entry) => `${entry.key}: ${entry.value}`,
          ),
        ],
        entityName: suggestion.entityName,
      };
    }

    if (suggestion.suggestionType === "dream-scaping") {
      const placementLabel = formatDreamScapePlacement(suggestion.proposedPlacement);

      return {
        id: suggestion.id,
        suggestionType: suggestion.suggestionType,
        reviewState: suggestion.reviewState,
        title: `${suggestion.ideaTitle} story-fit proposal`,
        rationale: suggestion.rationale,
        evidence,
        detailLines: [
          `Fit: ${suggestion.fit}`,
          `Placement: ${placementLabel}`,
          suggestion.revisionPrompt,
        ],
        nodeId: suggestion.proposedPlacement.nodeId,
        nodeLabel: suggestion.proposedPlacement.nodeLabel,
        fit: suggestion.fit,
        placementLabel,
        revisionPrompt: suggestion.revisionPrompt,
      };
    }

    return {
      id: suggestion.id,
      suggestionType: suggestion.suggestionType,
      reviewState: suggestion.reviewState,
      title:
        suggestion.linkKind === "cross-spine-edge"
          ? "Cross-spine link suggestion"
          : "Entity introduction suggestion",
      rationale: suggestion.rationale,
      evidence,
      detailLines:
        suggestion.linkKind === "cross-spine-edge"
          ? [
              `From: ${suggestion.fromNodeLabel ?? suggestion.fromNodeId ?? "unknown"}`,
              `To: ${suggestion.toNodeLabel ?? suggestion.toNodeId ?? "unknown"}`,
              `Edge: ${suggestion.proposedEdgeKind ?? "unspecified"}`,
            ]
          : [
              `Entity: ${suggestion.entityName ?? suggestion.entityId ?? "unknown"}`,
              `Target node: ${suggestion.targetNodeLabel ?? suggestion.targetNodeId ?? "unknown"}`,
            ],
      entityId: suggestion.entityId,
      entityName: suggestion.entityName,
      nodeId: suggestion.targetNodeId ?? suggestion.fromNodeId,
      nodeLabel: suggestion.targetNodeLabel ?? suggestion.fromNodeLabel,
      fromNodeId: suggestion.fromNodeId,
      toNodeId: suggestion.toNodeId,
    };
  });
}

function formatDreamScapePlacement(
  placement: Extract<AnalysisSuggestion, { suggestionType: "dream-scaping" }>["proposedPlacement"],
): string {
  if (placement.nodeLabel && placement.spineLabel) {
    return `${placement.spineLabel} / ${placement.nodeLabel}`;
  }

  if (placement.sceneTitle && placement.chapterTitle) {
    return `${placement.chapterTitle} / ${placement.sceneTitle}`;
  }

  if (placement.spineLabel) {
    return placement.spineLabel;
  }

  return placement.target;
}

function buildEntityRecord(
  project: Project,
  entity: WorldEntity,
  templateById: Map<string, WorldTemplate>,
  nodeById: Map<string, TimelineNode>,
): WorldEntityRecord {
  const template = templateById.get(entity.templateOrigin.templateId);

  if (!template) {
    throw new Error(`Missing template '${entity.templateOrigin.templateId}'.`);
  }

  const introductionLineNumber = entity.introduction
    ? resolveManuscriptAnchor(project, entity.introduction.anchor).index.lineNumber
    : undefined;
  const introductionNodeLabel = entity.introduction?.timelineNodeId
    ? nodeById.get(entity.introduction.timelineNodeId)?.label
    : undefined;

  return {
    id: entity.id,
    name: entity.name,
    templateName: template.name,
    notes: entity.notes,
    introductionLineNumber,
    introductionBlockId: entity.introduction?.anchor.blockId,
    introductionNodeId: entity.introduction?.timelineNodeId,
    introductionNodeLabel,
    fields: template.fields
      .filter((field) => entity.fields[field.key] !== undefined)
      .map((field) => ({
        key: field.key,
        label: field.label,
        value: formatTemplateValue(entity.fields[field.key] as TemplateValue),
      })),
  };
}

function buildSpineRecord(
  project: Project,
  spine: TimelineSpine,
  allNodes: TimelineNode[],
  entityById: Map<string, WorldEntity>,
): TimelineSpineRecord {
  const nodes: TimelineNodeRecord[] = spine.nodeIds
    .map((nodeId) => {
      const node = allNodes.find((candidate) => candidate.id === nodeId);

      if (!node) {
        throw new Error(`Missing node '${nodeId}' for spine '${spine.id}'.`);
      }

      return {
        id: node.id,
        spineId: node.spineId,
        label: node.label,
        summary: node.summary,
        order: node.order,
        primaryBlockId: node.manuscriptAnchors[0]?.blockId,
        lineNumbers: node.manuscriptAnchors
          .map((anchor) => resolveManuscriptAnchor(project, anchor).index.lineNumber)
          .sort((left, right) => left - right),
        linkedEntityIds: [...node.linkedEntityIds],
        linkedEntityNames: node.linkedEntityIds.map((entityId) => entityById.get(entityId)?.name ?? entityId),
      };
    })
    .sort((left, right) => left.order - right.order);

  return {
    id: spine.id,
    label: spine.label,
    kind: spine.kind,
    description: spine.description,
    nodes,
  };
}

function buildEdgeRecord(
  edge: TimelineEdge,
  nodeById: Map<string, TimelineNode>,
  spineById: Map<string, TimelineSpine>,
): TimelineEdgeRecord {
  const fromNode = nodeById.get(edge.fromNodeId);
  const toNode = nodeById.get(edge.toNodeId);

  if (!fromNode || !toNode) {
    throw new Error(`Missing nodes for edge '${edge.id}'.`);
  }

  const fromSpine = spineById.get(fromNode.spineId);
  const toSpine = spineById.get(toNode.spineId);

  if (!fromSpine || !toSpine) {
    throw new Error(`Missing spines for edge '${edge.id}'.`);
  }

  return {
    id: edge.id,
    kind: edge.kind,
    label: edge.label,
    fromNodeId: fromNode.id,
    fromNodeLabel: fromNode.label,
    fromSpineLabel: fromSpine.label,
    toNodeId: toNode.id,
    toNodeLabel: toNode.label,
    toSpineLabel: toSpine.label,
  };
}

function formatTemplateValue(value: TemplateValue): string {
  return Array.isArray(value) ? value.join(", ") : String(value);
}
