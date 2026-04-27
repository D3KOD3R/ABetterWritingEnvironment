import {
  createManuscriptAnchor,
  resolveManuscriptAnchor,
  type ManuscriptAnchor,
  type ManuscriptBlock,
  type Project,
} from "../../../packages/manuscript-schema/src/index.ts";
import type {
  TimelineNode,
  WorldModel,
} from "../../../packages/world-schema/src/index.ts";
import { createCompletedJob } from "../../../packages/job-contracts/src/index.ts";
import type {
  AnalysisSuggestion,
  AnalysisBatch,
  AnalysisIssueSuggestion,
  AnalysisServiceContract,
  AnalysisEventSuggestion,
  AnalysisWorldSuggestion,
  DreamScapeFit,
  DreamScapeIdeaInput,
  DreamScapePlacement,
  DreamScapeSuggestion,
  EntityInstantiationSuggestion,
  TemplateCreationSuggestion,
  WorkspaceLinkSuggestion,
} from "../../../packages/shared-types/src/index.ts";

export function createLocalAnalysisService(): AnalysisServiceContract {
  const provider = {
    id: "local-rule-analysis",
    label: "Local Rule Analysis",
    availability: "ready" as const,
    executionMode: "local-only" as const,
  };

  return {
    provider,
    analyzeProject(project: Project, now?: string): AnalysisBatch {
      return analyze(project, undefined, now, provider);
    },
    analyzeWorkspace(project: Project, world: WorldModel, now?: string): AnalysisBatch {
      return analyze(project, world, now, provider);
    },
    exploreDreamScape(input: DreamScapeIdeaInput): AnalysisBatch {
      return exploreDreamScape(input, provider);
    },
  };
}

function analyze(
  project: Project,
  world: WorldModel | undefined,
  now: string | undefined,
  provider: AnalysisServiceContract["provider"],
): AnalysisBatch {
  const timestamp = now ?? new Date().toISOString();
  const issues: AnalysisIssueSuggestion[] = [];
  const events: AnalysisEventSuggestion[] = [];
  let sawKhepri = false;
  let sawVoss = false;
  let sawCorridor = false;

  for (const chapter of project.chapters) {
    for (const scene of chapter.scenes) {
      for (const block of scene.blocks) {
        const lower = block.text.toLowerCase();

        if (lower.includes("customs ring")) {
          issues.push(
            createIssue(project, block, "customs ring", {
              category: "clarity",
              severity: "warning",
              summary: "The customs ring reference needs one beat of grounding.",
              detail:
                "The checkpoint concept is useful, but the passage names the ring before the manuscript explains what the reader should picture.",
              source: "rule",
              confidence: 0.84,
            }),
          );
        }

        if (block.kind === "narration" && lower.includes("treaty")) {
          issues.push(
            createIssue(project, block, "treaty", {
              category: "pacing",
              severity: "info",
              summary: "The treaty reaction beat could carry one sharper visual.",
              detail:
                "The pause lands, but the scene can move faster if the bridge response shows a concrete physical tell before the next reveal.",
              source: "local-ai",
              confidence: 0.71,
            }),
          );
        }

        if (lower.includes("war started here")) {
          issues.push(
            createIssue(project, block, "war started here", {
              category: "continuity",
              severity: "error",
              summary: "The war-origin claim is firmer than the current evidence trail.",
              detail:
                "Mara's conclusion reads as settled fact, but the manuscript has not yet shown enough corroboration for certainty.",
              source: "local-ai",
              confidence: 0.93,
            }),
          );
        }

        if (!sawKhepri && block.text.includes("Khepri")) {
          sawKhepri = true;
          events.push(
            createEvent(project, block, "Khepri", {
              kind: "custom",
              label: "Khepri introduced",
              source: "analysis",
              notes: "Planetary reference suitable for world-entity introduction linking.",
            }),
          );
        }

        if (!sawVoss && getSpeakerLabel(project, block.id) === "Inspector Voss") {
          sawVoss = true;
          events.push(
            createEvent(project, block, block.text.slice(0, 28), {
              kind: "first-meeting",
              label: "Auren meets Inspector Voss",
              source: "analysis",
            }),
          );
        }

        if (!sawCorridor && block.text.includes("Leviathan Corridor")) {
          sawCorridor = true;
          events.push(
            createEvent(project, block, "Leviathan Corridor", {
              kind: "plot-turn",
              label: "Leviathan Corridor discovered",
              source: "analysis",
              notes: "Archive evidence reframes the diplomatic plot line.",
            }),
          );
        }
      }
    }
  }

  const suggestions = world ? buildWorldSuggestions(project, world) : [];
  const job = createCompletedJob(
    `analysis-job-${String(issues.length + events.length + suggestions.length).padStart(4, "0")}`,
    "analysis",
    {
      projectId: project.id,
      trigger: "manual",
    },
    {
      providerId: provider.id,
      issueCount: issues.length,
      eventCount: events.length,
      suggestionCount: suggestions.length,
    },
    timestamp,
  );

  return {
    provider,
    job,
    issues,
    events,
    suggestions,
  };
}

function exploreDreamScape(
  input: DreamScapeIdeaInput,
  provider: AnalysisServiceContract["provider"],
): AnalysisBatch {
  const timestamp = input.now ?? new Date().toISOString();
  const suggestions = buildDreamScapeSuggestions(
    input.project,
    input.world,
    input.ideaTitle,
    input.ideaText,
  );
  const job = createCompletedJob(
    `dream-scaping-job-${String(suggestions.length).padStart(4, "0")}`,
    "analysis",
    {
      projectId: input.project.id,
      trigger: "dream-scaping",
      ideaTitle: input.ideaTitle,
    },
    {
      providerId: provider.id,
      issueCount: 0,
      eventCount: 0,
      suggestionCount: suggestions.length,
    },
    timestamp,
  );

  return {
    provider,
    job,
    issues: [],
    events: [],
    suggestions,
  };
}

function createIssue(
  project: Project,
  block: ManuscriptBlock,
  needle: string,
  input: Omit<AnalysisIssueSuggestion, "anchor" | "evidenceExcerpt">,
): AnalysisIssueSuggestion {
  const lower = block.text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const startOffset = Math.max(lower.indexOf(lowerNeedle), 0);
  const endOffset = startOffset + needle.length;
  const anchor = createManuscriptAnchor(project, {
    blockId: block.id,
    startOffset,
    endOffset,
  });
  const resolved = resolveManuscriptAnchor(project, anchor);

  return {
    ...input,
    anchor,
    evidenceExcerpt: resolved.excerpt,
  };
}

function createEvent(
  project: Project,
  block: ManuscriptBlock,
  needle: string,
  input: Omit<AnalysisEventSuggestion, "anchor" | "evidenceExcerpt">,
): AnalysisEventSuggestion {
  const startOffset = Math.max(block.text.indexOf(needle), 0);
  const endOffset = Math.min(startOffset + needle.length, block.text.length);
  const anchor = createManuscriptAnchor(project, {
    blockId: block.id,
    startOffset,
    endOffset,
  });
  const resolved = resolveManuscriptAnchor(project, anchor);

  return {
    ...input,
    anchor,
    evidenceExcerpt: resolved.excerpt,
  };
}

function getSpeakerLabel(project: Project, blockId: string): string | undefined {
  return project.speakerAssignments.find((assignment) => assignment.blockId === blockId)?.speakerLabel;
}

function buildWorldSuggestions(project: Project, world: WorldModel): AnalysisWorldSuggestion[] {
  const suggestions: AnalysisWorldSuggestion[] = [];
  let sequence = 0;
  let stationTemplateSuggestionId: string | undefined;
  const stationAnchor = findAnchorByNeedle(project, "Halcyon Station");

  if (stationAnchor && !world.templates.some((template) => template.key === "station")) {
    sequence += 1;
    stationTemplateSuggestionId = `world-suggestion-${String(sequence).padStart(4, "0")}`;
    suggestions.push(
      createTemplateSuggestion(stationTemplateSuggestionId, stationAnchor),
    );
  }

  if (
    stationAnchor &&
    !world.entities.some((entity) => normalizeName(entity.name) === normalizeName("Halcyon Station"))
  ) {
    sequence += 1;
    suggestions.push(
      createStationEntitySuggestion(
        `world-suggestion-${String(sequence).padStart(4, "0")}`,
        stationAnchor,
        stationTemplateSuggestionId,
      ),
    );
  }

  const treatyNode = findNodeByLabel(world, "Treaty silence spreads");
  const corridorNode = findNodeByLabel(world, "Leviathan map recovered");
  const treatyAnchor = findAnchorByNeedle(project, "treaty");
  const corridorAnchor = findAnchorByNeedle(project, "Leviathan Corridor");

  if (treatyNode && corridorNode && treatyAnchor && corridorAnchor) {
    sequence += 1;
    suggestions.push(
      createCrossSpineSuggestion(
        `world-suggestion-${String(sequence).padStart(4, "0")}`,
        treatyNode,
        corridorNode,
        [treatyAnchor, corridorAnchor],
      ),
    );
  }

  return suggestions;
}

function buildDreamScapeSuggestions(
  project: Project,
  world: WorldModel | undefined,
  ideaTitle: string,
  ideaText: string,
): AnalysisSuggestion[] {
  const idea = `${ideaTitle} ${ideaText}`.toLowerCase();
  const evidence = [
    findAnchorByNeedle(project, "treaty"),
    findAnchorByNeedle(project, "Leviathan Corridor"),
    findAnchorByNeedle(project, "war started here"),
    findAnchorByNeedle(project, "Khepri"),
  ].filter((anchor): anchor is ManuscriptAnchor => Boolean(anchor));

  if (evidence.length === 0) {
    return [];
  }

  const fit = resolveDreamScapeFit(idea);
  const placement = resolveDreamScapePlacement(project, world, evidence);

  return [
    {
      id: "dream-scaping-0001",
      suggestionType: "dream-scaping",
      reviewState: "pending",
      ideaTitle: nonEmptyIdeaTitle(ideaTitle),
      fit,
      rationale:
        "The submitted idea can be tested as a reviewable story-fit proposal because the manuscript already has anchored pressure points around treaty silence, corridor evidence, and war-origin uncertainty.",
      evidence: evidence.slice(0, 3),
      proposedPlacement: placement,
      revisionPrompt: buildDreamScapePrompt(ideaTitle, ideaText, fit, placement),
    } satisfies DreamScapeSuggestion,
  ];
}

function resolveDreamScapeFit(idea: string): DreamScapeFit {
  if (idea.includes("character") || idea.includes("memory") || idea.includes("betray")) {
    return "character-arc";
  }

  if (
    idea.includes("world") ||
    idea.includes("planet") ||
    idea.includes("history") ||
    idea.includes("corridor") ||
    idea.includes("signal")
  ) {
    return "world-history";
  }

  if (idea.includes("theme") || idea.includes("symbol") || idea.includes("dream")) {
    return "theme";
  }

  if (idea.includes("rewrite") || idea.includes("scene")) {
    return "scene-revision";
  }

  return "plot-catalyst";
}

function resolveDreamScapePlacement(
  project: Project,
  world: WorldModel | undefined,
  evidence: ManuscriptAnchor[],
): DreamScapePlacement {
  const targetNode =
    world &&
    (findNodeByLabel(world, "War-origin theory logged") ??
      findNodeByLabel(world, "Leviathan map recovered") ??
      findNodeByLabel(world, "Treaty silence spreads"));

  if (targetNode && world) {
    const spine = world.spines.find((candidate) => candidate.id === targetNode.spineId);

    return {
      target: "timeline-node",
      spineId: spine?.id,
      spineLabel: spine?.label,
      nodeId: targetNode.id,
      nodeLabel: targetNode.label,
    };
  }

  const resolved = resolveManuscriptAnchor(project, evidence[0]);

  return {
    target: "existing-scene",
    chapterTitle: resolved.chapter.title,
    sceneTitle: resolved.scene.title,
  };
}

function buildDreamScapePrompt(
  ideaTitle: string,
  ideaText: string,
  fit: DreamScapeFit,
  placement: DreamScapePlacement,
): string {
  const placementLabel =
    placement.nodeLabel ??
    placement.sceneTitle ??
    placement.spineLabel ??
    "a new anchored scene";

  return `Test '${nonEmptyIdeaTitle(ideaTitle)}' as a ${fit} beat near ${placementLabel}. Keep it reviewable by linking the draft beat to manuscript evidence before creating or moving canonical timeline nodes. Idea note: ${ideaText.trim()}`;
}

function createTemplateSuggestion(
  id: string,
  evidence: ManuscriptAnchor,
): TemplateCreationSuggestion {
  return {
    id,
    suggestionType: "template",
    reviewState: "pending",
    templateName: "Station",
    rationale:
      "The manuscript treats Halcyon Station as more than scenery. A dedicated station template would keep customs, rings, and host-world links structured instead of leaving them as loose notes.",
    evidence: [evidence],
    proposedFields: [
      {
        key: "host-world",
        label: "Host World",
        valueType: "text",
        required: true,
        description: "Primary world or locality the station orbits or serves.",
      },
      {
        key: "governing-body",
        label: "Governing Body",
        valueType: "text",
        required: true,
        description: "Faction or institution that operates the station.",
      },
      {
        key: "ring-state",
        label: "Ring State",
        valueType: "enum",
        required: false,
        description: "Operational status of customs or docking rings.",
      },
    ],
  };
}

function createStationEntitySuggestion(
  id: string,
  evidence: ManuscriptAnchor,
  templateSuggestionId?: string,
): EntityInstantiationSuggestion {
  return {
    id,
    suggestionType: "entity",
    reviewState: "pending",
    entityName: "Halcyon Station",
    templateName: "Station",
    templateSuggestionId,
    rationale:
      "Halcyon Station anchors multiple manuscript beats and should exist as a first-class world entity for timeline and narration workflows.",
    notes: "Suggested from repeated station-centric manuscript references.",
    evidence: [evidence],
    proposedFieldValues: [
      { key: "host-world", value: "Khepri" },
      { key: "governing-body", value: "Customs Directorate" },
      { key: "ring-state", value: "restricted" },
    ],
  };
}

function createCrossSpineSuggestion(
  id: string,
  fromNode: TimelineNode,
  toNode: TimelineNode,
  evidence: ManuscriptAnchor[],
): WorkspaceLinkSuggestion {
  return {
    id,
    suggestionType: "link",
    reviewState: "pending",
    linkKind: "cross-spine-edge",
    rationale:
      "The treaty silence and the corridor archive discovery appear to belong in the same causal chain. A reviewable cross-spine edge would make that dependency explicit for continuity work.",
    evidence,
    fromNodeId: fromNode.id,
    fromNodeLabel: fromNode.label,
    toNodeId: toNode.id,
    toNodeLabel: toNode.label,
    proposedEdgeKind: "references",
  };
}

function findAnchorByNeedle(project: Project, needle: string): ManuscriptAnchor | undefined {
  const lowerNeedle = needle.toLowerCase();

  for (const chapter of project.chapters) {
    for (const scene of chapter.scenes) {
      for (const block of scene.blocks) {
        const index = block.text.toLowerCase().indexOf(lowerNeedle);

        if (index !== -1) {
          return createManuscriptAnchor(project, {
            blockId: block.id,
            startOffset: index,
            endOffset: index + needle.length,
          });
        }
      }
    }
  }

  return undefined;
}

function findNodeByLabel(world: WorldModel, label: string): TimelineNode | undefined {
  return world.nodes.find((node) => node.label === label);
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function nonEmptyIdeaTitle(value: string): string {
  const trimmed = value.trim();

  return trimmed || "Untitled dream-scape idea";
}
