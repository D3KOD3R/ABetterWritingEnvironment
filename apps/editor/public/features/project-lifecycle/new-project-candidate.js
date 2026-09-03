import {
  createDefaultEditorPrefs,
  createDefaultLocalAiPrefs,
  createStructureDrafts,
  createTemplateDrafts,
} from "../../editor-model.js";
import { PROJECT_SCHEMA_VERSION } from "../../adapters/storage/project-migrations.js";
import { createDefaultDraftProofingState } from "../draft-proofing/draft-proofing-service.js";

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function createRandomProjectId() {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("New Project requires collision-resistant UUID generation.");
  }
  return `project-${globalThis.crypto.randomUUID()}`;
}

export function createNewProjectCandidateBuilder({
  createProjectRecordFromWorkspace,
  exportProjectLibrarySnapshot,
  getBaseWorkspace = () => null,
  createProjectId = createRandomProjectId,
  now = () => new Date().toISOString(),
  clone = cloneValue,
} = {}) {
  if (typeof createProjectRecordFromWorkspace !== "function"
    || typeof exportProjectLibrarySnapshot !== "function") {
    throw new TypeError("NewProjectCandidateBuilder requires project record and export functions.");
  }

  function createBlankWorkspaceSnapshot(baseWorkspace, projectId, title, createdAt) {
    const templateWorkspace = clone(baseWorkspace ?? {});
    const workspaceTitle = typeof templateWorkspace.workspaceTitle === "string" && templateWorkspace.workspaceTitle.trim()
      ? templateWorkspace.workspaceTitle
      : "ABetterNovelAuthoringEnvironment";
    const chapterId = "chapter-0001";
    const sceneId = "scene-0001";
    const blockId = "block-0001";
    const paragraphId = "paragraph-0001";
    const chapterTitle = "Chapter 1";
    const sceneTitle = "Scene 1";
    const starterLine = {
      id: blockId,
      blockId,
      paragraphId,
      lineNumber: 1,
      sceneLineNumber: 1,
      kind: "narration",
      speakerLabel: "",
      text: "",
      chapterId,
      chapterTitle,
      sceneId,
      sceneTitle,
      sceneSynopsis: "",
      startsChapter: true,
      startsScene: true,
      issueIds: [],
      eventTagIds: [],
    };
    const project = {
      id: projectId,
      title,
      binder: {
        id: projectId,
        kind: "project",
        refId: projectId,
        title,
        order: 1,
        children: [{
          id: `binder-${chapterId}`,
          kind: "chapter",
          refId: chapterId,
          title: chapterTitle,
          order: 1,
          children: [{
            id: `binder-${sceneId}`,
            kind: "scene",
            refId: sceneId,
            title: sceneTitle,
            order: 1,
            children: [],
          }],
        }],
      },
      stats: { chapterCount: 1, sceneCount: 1, lineCount: 1, issueCount: 0, eventCount: 0, characterCount: 0 },
      navigationTargets: {
        [projectId]: { refId: projectId, kind: "project", title, lineId: blockId, lineNumber: 1 },
        [chapterId]: { refId: chapterId, kind: "chapter", title: chapterTitle, lineId: blockId, lineNumber: 1 },
        [sceneId]: { refId: sceneId, kind: "scene", title: sceneTitle, lineId: blockId, lineNumber: 1 },
      },
      lines: [starterLine],
      issues: [],
      eventTags: [],
      characters: [],
    };
    const world = {
      id: `world-${projectId}`,
      title: `${title} World`,
      stats: { templateCount: 0, entityCount: 0, spineCount: 0, nodeCount: 0, edgeCount: 0 },
      templates: [],
      entities: [],
      spines: [],
      edges: [],
    };
    const audioProvider = templateWorkspace?.narration?.provider ?? {
      id: "local-audio-service",
      label: "Local Audio",
      availability: "ready",
      alignmentStrategy: "line-based",
    };
    const voiceProvider = templateWorkspace?.voice?.provider ?? {
      id: "local-voice-service",
      label: "Local Voice",
      availability: "ready",
      synthesisMode: "local",
    };
    const analysisProvider = templateWorkspace?.analysis?.provider ?? {
      id: "local-rule-analysis",
      label: "Local Rule Analysis",
      availability: "ready",
      executionMode: "local-only",
    };

    return {
      generatedAt: createdAt,
      workspaceTitle,
      settings: clone(templateWorkspace.settings ?? {
        executionMode: "local-only",
        modelRoot: "",
        assetRoot: "",
        projectRoot: "",
      }),
      project,
      world,
      analysis: {
        provider: analysisProvider,
        lastJob: {
          id: `analysis-${projectId}`,
          type: "analysis",
          status: "completed",
          createdAt,
          updatedAt: createdAt,
          request: { projectId, trigger: "manual" },
          result: { providerId: analysisProvider.id, issueCount: 0, eventCount: 0, suggestionCount: 0 },
        },
        suggestionQueue: [],
      },
      narration: {
        provider: audioProvider,
        session: {
          id: `narration-${projectId}`,
          projectId,
          providerId: audioProvider.id,
          sessionLabel: title,
          status: "paused",
          currentAnchor: { projectId, chapterId, sceneId, blockId, paragraphId, startOffset: 0, endOffset: 0 },
          currentLineNumber: 1,
          currentText: "",
          updatedAt: createdAt,
        },
        alignmentJobs: [],
      },
      voice: {
        provider: voiceProvider,
        profiles: clone(templateWorkspace?.voice?.profiles ?? []),
        bindings: [],
        renderJobs: [],
        recordings: [],
      },
      selectionDefaults: { lineId: blockId },
    };
  }

  function buildNewProjectCandidateSnapshot(title) {
    const createdAt = now();
    const projectId = createProjectId();
    const workspace = createBlankWorkspaceSnapshot(getBaseWorkspace(), projectId, title, createdAt);
    const record = createProjectRecordFromWorkspace(workspace, {
      id: projectId,
      title,
      source: "user-created",
      createdAt,
      updatedAt: createdAt,
      sceneDrafts: {},
      structureDrafts: createStructureDrafts(),
      templateDrafts: createTemplateDrafts(),
      manuscriptTasks: [],
      passageNotes: [],
      metadataSubgroups: [],
      draftProofing: createDefaultDraftProofingState(),
      editorPrefs: createDefaultEditorPrefs(),
      localAiPrefs: createDefaultLocalAiPrefs(),
    });
    return exportProjectLibrarySnapshot({
      librarySnapshot: {
        schemaVersion: PROJECT_SCHEMA_VERSION,
        activeProjectId: projectId,
        projects: [record],
        sceneStore: {},
      },
    });
  }

  return { buildNewProjectCandidateSnapshot, createBlankWorkspaceSnapshot };
}
