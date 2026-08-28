// Intent: own the World Spine node-map render model, markup, and explicit detail-card interaction.
import { escapeHtml } from "../../shared/ui-utils.js";
import {
  getWorldSpinePickerOptionsForField,
  resolveWorldSpinePickerTypeForField,
} from "./world-spine-character-options.js";
import { buildWorldSpineEntityPresenceIndex } from "./world-spine-catalogue-assignment-service.js";
import { normalizeWorldSpineEdges } from "./world-spine-implication-service.js";
import {
  buildWorldSpineLocationFilterModel,
  resolveWorldSpineConnectionFilterClass,
  resolveWorldSpineLocationFilterClass,
} from "./world-spine-location-filter-service.js";
import {
  buildWorldSpineLocationImageIndex,
  createWorldbuildingCatalogueImageSource,
} from "./worldbuilding-studio.js";

export const WORLD_SPINE_DETAIL_CLOSE_DELAY_MS = 100;
export const WORLD_SPINE_TIMELINE_ZOOM_DEFAULT = 1;
export const WORLD_SPINE_TIMELINE_ZOOM_MIN = 0.7;
export const WORLD_SPINE_TIMELINE_ZOOM_MAX = 1.6;
export const WORLD_SPINE_TIMELINE_ZOOM_STEP = 0.1;
export const WORLD_SPINE_RIGHT_PANE_MODE_MANUSCRIPT = "manuscript";
export const WORLD_SPINE_RIGHT_PANE_MODE_EVENT_SECTION = "event-section";
export const WORLD_SPINE_RIGHT_PANE_MODE_RELATED_CARDS = "related-cards";

const PRIMARY_NODE_WIDTH = 184;
const PRIMARY_NODE_HEIGHT = 76;
const CHILD_NODE_WIDTH = 146;
const CHILD_NODE_HEIGHT = 56;
const REFERENCE_NODE_WIDTH = 126;
const REFERENCE_NODE_HEIGHT = 46;
const SCENE_GAP = 250;
const CANVAS_PADDING_X = 120;
// Intent: keep event cards vertically centered in the timeline viewport while preserving room for child nodes.
const EVENT_BLOCK_ROW_Y = 230;
const MAIN_SPINE_Y = 420;
const AXIS_Y = 446;
const IMPLICATION_ROUTE_ABOVE_GAP = 30;
const IMPLICATION_ROUTE_BELOW_GAP = 36;
const IMPLICATION_ROUTE_LANE_GAP = 18;
const IMPLICATION_ROUTE_MIN_Y = 44;
const IMPLICATION_ROUTE_LOWER_BUFFER = 102;
const IMPLICATION_ROUTE_MIN_TURN_DISTANCE = 64;
const IMPLICATION_ROUTE_MAX_TURN_DISTANCE = 148;
const IMPLICATION_ROUTE_MIN_HANDLE_DISTANCE = 34;
const IMPLICATION_ROUTE_MAX_HANDLE_DISTANCE = 110;
const NODE_BLOCK_DRAG_PREVIEW_THRESHOLD_PX = 4;
const WORLD_SPINE_IMPLICATION_COMPOSER_SELECTOR = "[data-world-spine-implication-composer]";
const WORLD_SPINE_CONTEXT_MENU_WIDTH = 248;
const WORLD_SPINE_CONTEXT_MENU_HEIGHT = 184;
const WORLD_SPINE_EVENT_CATEGORY_MENU_WIDTH = 340;
const WORLD_SPINE_EVENT_CONTEXT_MENU_WIDTH = 620;
const WORLD_SPINE_EVENT_CONTEXT_MENU_HEIGHT = 500;
const WORLD_SPINE_PARALLEL_TIMELINE_FORM_WIDTH = 340;
const WORLD_SPINE_PARALLEL_TIMELINE_FORM_HEIGHT = 390;
const WORLD_SPINE_DETAIL_CARD_MIN_WIDTH = 220;
const WORLD_SPINE_DETAIL_CARD_MAX_WIDTH = 320;
const WORLD_SPINE_DETAIL_CARD_MIN_HEIGHT = 110;
const WORLD_SPINE_DETAIL_CARD_MAX_HEIGHT = 260;
const WORLD_SPINE_DETAIL_CARD_GAP = 10;
const MULTI_TIER_ROW_GAP = 150;
const MULTI_TIER_BOTTOM_PADDING = 140;
const LOCATION_ROW_GAP = 150;
const LOCATION_ROW_ARTWORK_WIDTH = 168;
const LOCATION_ROW_ARTWORK_HEIGHT = 108;
const LOCATION_ROW_LABEL_HEIGHT = 26;
const LOCATION_ROW_HEADER_GAP = 8;
const LOCATION_ROW_BOUNDARY_GAP = 10;
const DEFAULT_WORLD_SPINE_ID = "spine-0001";
const DEFAULT_LOCATION_LABEL = "Unplaced location";
const DEFAULT_LOCATION_ROW_PROMPT = "Insert Location Name";
const DEFAULT_LOCATION_SCOPE = "planetary";
const UNPLACED_DOCK_EXPANDED_SAFE_AREA = 132;
const UNPLACED_DOCK_COLLAPSED_SAFE_AREA = 42;
const DEFAULT_CORE_LOCATION_CATEGORIES = Object.freeze(["planet"]);
const DEFAULT_SUBLOCATION_CATEGORIES = Object.freeze(["location", "vehicle"]);
const EVENT_SECTION_CONTEXT_BEFORE_BLOCKS = 2;
const EVENT_SECTION_CONTEXT_AFTER_BLOCKS = 3;
const WORLD_SPINE_RIGHT_PANE_MODES = new Set([
  WORLD_SPINE_RIGHT_PANE_MODE_MANUSCRIPT,
  WORLD_SPINE_RIGHT_PANE_MODE_EVENT_SECTION,
  WORLD_SPINE_RIGHT_PANE_MODE_RELATED_CARDS,
]);
// Intent: treat primary scene blocks and scene-owned child beats as assignable timeline events, while reference nodes stay read-only.
const WORLD_SPINE_ASSIGNABLE_EVENT_NODE_KINDS = new Set(["event", "world", "scene", "beat", "location-change"]);

// Intent: derive a compact chronological node graph from manuscript scenes and structured world records.
export function buildWorldSpineTimelineModel({
  workspace = {},
  scenes = [],
  selectedNodeId = "",
  selectedBlockId = "",
  customMetadataDefinitions = [],
} = {}) {
  const safeScenes = Array.isArray(scenes) ? scenes.filter(Boolean) : [];
  const project = workspace?.project && typeof workspace.project === "object" ? workspace.project : {};
  const world = workspace?.world && typeof workspace.world === "object" ? workspace.world : {};
  const eventTags = Array.isArray(project.eventTags) ? project.eventTags.filter(Boolean) : [];
  const characters = Array.isArray(project.characters) ? project.characters.filter(Boolean) : [];
  const worldEntities = Array.isArray(world.entities) ? world.entities.filter(Boolean) : [];
  const worldSpines = Array.isArray(world.spines) ? world.spines.filter(Boolean) : [];
  const entityPresenceByNodeId = buildWorldSpineEntityPresenceIndex(world);
  const timelineTiers = createWorldSpineTimelineTiers(worldSpines);
  const locationImageIndex = buildWorldSpineLocationImageIndex(world);
  const locationTheme = normalizeWorldSpineLocationThemeSettings(world);
  const locationHierarchyIndex = buildWorldSpineLocationHierarchyIndex(worldEntities, locationTheme);
  const explicitLocationRowIndex = buildExplicitWorldSpineLocationRowIndex({
    scenes: safeScenes,
    worldSpines,
    locationHierarchyIndex,
  });
  const locationContext = {
    explicitLocationRowIndex,
    locationHierarchyIndex,
    locationTheme,
  };
  const sceneCustomMetadataDefinitions = normalizeCustomMetadataDefinitionsForTimeline(customMetadataDefinitions);
  const blockSceneIndex = createBlockSceneIndex(safeScenes);
  const eventsBySceneId = groupRecordsBySceneId(eventTags, blockSceneIndex, "blockId");
  const worldNodesBySceneId = groupRecordsBySceneId(flattenWorldSpineNodes(worldSpines), blockSceneIndex, "primaryBlockId");
  const entitiesBySceneId = groupRecordsBySceneId(worldEntities, blockSceneIndex, "introductionBlockId");

  const primaryNodes = [];
  const childNodes = [];
  const referenceNodes = [];
  const connections = [];
  const ticks = [];

  safeScenes.forEach((scene, index) => {
    const sceneEvents = eventsBySceneId.get(scene.sceneId) ?? [];
    const sceneWorldNodes = worldNodesBySceneId.get(scene.sceneId) ?? [];
    const sceneEntities = entitiesBySceneId.get(scene.sceneId) ?? [];
    const metadata = deriveSceneTimelineMetadata(scene, {
      events: sceneEvents,
      characters,
      entities: sceneEntities,
      customMetadataDefinitions: sceneCustomMetadataDefinitions,
    });
    const firstBlock = Array.isArray(scene.blocks) ? scene.blocks[0] : null;
    const x = CANVAS_PADDING_X + (index * SCENE_GAP);
    const primaryNode = createPrimarySceneNode(scene, metadata, {
      index,
      x,
      selectedNodeId,
      selectedBlockId,
      firstBlock,
      timelineTier: timelineTiers[0],
      entityPresenceByNodeId,
      locationContext,
    });

    primaryNodes.push(primaryNode);

    addSceneChildEventNodes(childNodes, connections, primaryNode, scene, sceneEvents, {
      selectedNodeId,
      selectedBlockId,
      entityPresenceByNodeId,
    });
    addSceneMetadataChildNodes(childNodes, connections, primaryNode, metadata, {
      selectedNodeId,
      entityPresenceByNodeId,
    });
    addSceneWorldChildNodes(childNodes, connections, primaryNode, sceneWorldNodes, {
      selectedNodeId,
      selectedBlockId,
      entityPresenceByNodeId,
    });
    addSceneReferenceNodes(referenceNodes, connections, primaryNode, metadata, sceneEntities, {
      selectedNodeId,
      selectedBlockId,
    });
  });

  const scenePrimaryNodeCount = primaryNodes.length;
  const worldOnlyNodes = createWorldOnlyNodes(worldSpines, blockSceneIndex, {
    selectedNodeId,
    selectedBlockId,
    startX: CANVAS_PADDING_X + (safeScenes.length * SCENE_GAP),
    sceneCount: safeScenes.length,
    timelineTiers,
    entityPresenceByNodeId,
    locationContext,
  });
  primaryNodes.push(...worldOnlyNodes.nodes);
  connections.push(...worldOnlyNodes.connections);

  const timelineLocationRows = createWorldSpineTimelineLocationRows(primaryNodes, timelineTiers, {
    locationImageIndex,
  });
  const timelineMetrics = resolveWorldSpineTimelineMetrics(timelineTiers, timelineLocationRows);
  const orderedPrimaryNodes = layoutPrimaryTimelineNodes(primaryNodes, childNodes, referenceNodes, connections, {
    timelineTiers,
    timelineLocationRows,
  });
  ticks.push(...orderedPrimaryNodes.map(createPrimaryNodeTimelineTick));

  const nodes = [...orderedPrimaryNodes, ...childNodes, ...referenceNodes];
  const implicationConnections = createTimelineImplicationConnections(world.edges, nodes);
  connections.push(...implicationConnections);
  const unplacedPrimaryNodes = orderedPrimaryNodes.filter(isTimelineNodeUnplaced);
  const canvasProjection = createWorldSpineCanvasProjection({
    nodes,
    primaryNodes: orderedPrimaryNodes,
    connections,
    unplacedPrimaryNodes,
  });
  const width = Math.max(900, CANVAS_PADDING_X * 2 + Math.max(1, orderedPrimaryNodes.length) * SCENE_GAP);
  const height = timelineMetrics.height;
  const dropZones = createTimelineDropZones(orderedPrimaryNodes, width, timelineTiers, timelineLocationRows);
  const manuscript = buildCompactManuscriptModel(safeScenes, selectedBlockId);
  const eventManuscriptSection = buildWorldSpineEventManuscriptSection({
    scenes: safeScenes,
    nodes,
    selectedNodeId,
    selectedBlockId,
  });

  return {
    title: normalizeString(world.title) || "Story Timeline",
    stats: {
      sceneCount: scenePrimaryNodeCount,
      childNodeCount: childNodes.length,
      sceneBeatCount: childNodes.filter((node) => node.kind === "beat").length,
      referenceNodeCount: referenceNodes.length,
      implicationEdgeCount: implicationConnections.length,
    },
    eventRail: orderedPrimaryNodes,
    eventRailItems: buildWorldSpineEventRailItems(orderedPrimaryNodes),
    timeline: {
      width,
      height,
      mainSpineY: timelineMetrics.mainSpineY,
      axisY: timelineMetrics.axisY,
      tiers: timelineTiers,
      locationRows: timelineLocationRows,
      unplacedDock: {
        primaryNodes: unplacedPrimaryNodes,
        primaryNodeIds: unplacedPrimaryNodes.map((node) => node.id),
        count: unplacedPrimaryNodes.length,
      },
      primaryNodes: orderedPrimaryNodes,
      childNodes,
      referenceNodes,
      nodes,
      connections,
      ticks,
      dropZones,
      canvasPrimaryNodes: canvasProjection.primaryNodes,
      canvasNodes: canvasProjection.nodes,
      canvasConnections: canvasProjection.connections,
      canvasTicks: canvasProjection.primaryNodes.map(createPrimaryNodeTimelineTick),
    },
    manuscript,
    eventManuscriptSection,
    selectedNodeId: normalizeString(selectedNodeId),
    selectedBlockId: normalizeString(selectedBlockId),
  };
}

// Intent: render the fixed rails and the horizontally scrolling central canvas as one world workspace.
export function renderWorldSpinePanelHTML(model, {
  layout = {},
  implicationComposer = null,
  history = {},
  timelineZoom = 1,
  rightPaneMode = WORLD_SPINE_RIGHT_PANE_MODE_MANUSCRIPT,
  relatedCards = null,
  relatedCardExpandedKey = "",
  sublocationComposer = null,
  locationFilter = {},
  locationFilterOpen = false,
  unplacedDockCollapsed = false,
} = {}) {
  const sourceTimeline = model?.timeline ?? {};
  const sourcePrimaryNodes = Array.isArray(sourceTimeline.primaryNodes) ? sourceTimeline.primaryNodes : [];
  const locationFilterModel = buildWorldSpineLocationFilterModel(sourceTimeline, locationFilter);
  const timeline = projectWorldSpineTimelineForLocationFilterViewport(sourceTimeline, locationFilterModel);
  const nodes = Array.isArray(timeline.canvasNodes) ? timeline.canvasNodes : [];
  const primaryNodes = Array.isArray(timeline.primaryNodes) ? timeline.primaryNodes : [];
  const width = Number.isFinite(timeline.width) ? timeline.width : 900;
  const height = Number.isFinite(timeline.height) ? timeline.height : 520;
  const axisY = Number.isFinite(timeline.axisY) ? timeline.axisY : AXIS_Y;
  const eventRailWidth = normalizePanelWidth(layout.eventRailWidth, 224);
  const manuscriptPaneWidth = normalizePanelWidth(layout.manuscriptPaneWidth, 330);
  const historyControls = normalizeWorldSpineHistoryControls(history);
  const normalizedTimelineZoom = normalizeWorldSpineTimelineZoom(timelineZoom);
  const normalizedRightPaneMode = normalizeWorldSpineRightPaneMode(rightPaneMode);
  const zoomFrameSize = resolveWorldSpineTimelineZoomFrameSize(width, height, normalizedTimelineZoom);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const unplacedDock = timeline?.unplacedDock ?? sourceTimeline?.unplacedDock ?? {};
  const showUnplacedDock = !locationFilterModel.active && Number(unplacedDock.count) > 0;
  const unplacedDockSafeArea = showUnplacedDock
    ? (unplacedDockCollapsed ? UNPLACED_DOCK_COLLAPSED_SAFE_AREA : UNPLACED_DOCK_EXPANDED_SAFE_AREA)
    : 0;
  const filterCanvasClass = [
    locationFilterModel.active ? "is-world-spine-location-filtered" : "",
    timeline.locationFilterViewportFit ? "is-world-spine-location-fit" : "",
  ].filter(Boolean).map((className) => ` ${className}`).join("");

  return `
    <div
      class="world-spine-workspace"
      data-world-spine-root
      data-world-spine-location-filter-active="${locationFilterModel.active ? "true" : "false"}"
      data-world-spine-location-filter-open="${locationFilterOpen ? "true" : "false"}"
      data-world-spine-location-filter-fit="${timeline.locationFilterViewportFit ? "true" : "false"}"
      data-world-spine-unplaced-dock-visible="${showUnplacedDock ? "true" : "false"}"
      style="--world-spine-event-rail-width:${eventRailWidth}px; --world-spine-manuscript-pane-width:${manuscriptPaneWidth}px; --world-spine-timeline-zoom:${normalizedTimelineZoom}; --world-spine-unplaced-dock-safe-area:${unplacedDockSafeArea}px; --world-spine-timeline-scroll-left:0px;"
    >
      ${renderEventRail(model)}
      ${renderWorldSpinePanelResizer("event-rail", "Resize event rail")}
      <section class="world-spine-center" aria-label="World Spine chronological node map">
        <div class="world-spine-center__header">
          <div>
            <p class="panel-kicker">World Spine</p>
            <h2>${escapeHtml(model?.title || "Story Timeline")}</h2>
          </div>
          <div class="world-spine-center__header-actions">
            ${renderWorldSpineLocationFilterControl(locationFilterModel, {
              isOpen: locationFilterOpen,
              stats: model?.stats ?? {},
              primaryNodeCount: sourcePrimaryNodes.length,
            })}
            ${renderWorldSpineHistoryControls(historyControls)}
          </div>
        </div>
        <div class="world-spine-timeline-viewport" data-world-spine-timeline-viewport>
          ${renderWorldSpineChapterAnchorHTML(resolveWorldSpineViewportChapterAnchor({
            nodes: primaryNodes,
            scrollLeft: 0,
            viewportWidth: 0,
          }))}
          <div
            class="world-spine-timeline-scroll"
            data-world-spine-timeline-scroll
            data-world-spine-timeline-zoom="${normalizedTimelineZoom}"
            tabindex="0"
            aria-label="Horizontally scroll the story timeline"
          >
            <div
              class="world-spine-canvas-frame"
              data-world-spine-timeline-zoom-frame
              style="width:${zoomFrameSize.width}px; height:${zoomFrameSize.height}px;"
            >
              <div
                class="world-spine-canvas${filterCanvasClass}"
                data-world-spine-canvas
                data-world-spine-canvas-width="${width}"
                data-world-spine-canvas-height="${height}"
                style="width:${width}px; height:${height}px;"
              >
              <svg class="world-spine-connections" viewBox="0 0 ${width} ${height}" style="width:${width}px; height:${height}px;" aria-hidden="true" focusable="false">
                ${renderConnections(timeline.canvasConnections ?? timeline.connections, {
                  includeImplications: false,
                  locationFilterModel,
                  nodesById,
                })}
              </svg>
              ${renderTimelineTierGuides(timeline.tiers, width, locationFilterModel)}
              ${renderTimelineLocationRowGuides(timeline.locationRows, width, locationFilterModel)}
              ${renderTimelineDropZones(timeline.dropZones, locationFilterModel)}
              ${renderTimelineLocationRowArtwork(timeline.locationRows, locationFilterModel)}
              <div class="world-spine-node-layer" data-world-spine-node-layer>
                  <svg
                    class="world-spine-node-layer__implications"
                    data-world-spine-implication-connections
                    viewBox="0 0 ${width} ${height}"
                    style="width:${width}px; height:${height}px;"
                    aria-hidden="true"
                    focusable="false"
                  >
                    ${renderWorldSpineImplicationMarkerDefs()}
                    ${renderConnections(timeline.canvasConnections ?? timeline.connections, {
                      onlyImplications: true,
                      locationFilterModel,
                      nodesById,
                    })}
                  </svg>
                  ${nodes.map((node) => renderTimelineNode(node, locationFilterModel)).join("")}
                </div>
                <div class="world-spine-axis" style="left:${CANVAS_PADDING_X - 40}px; top:${axisY}px; width:${Math.max(240, width - (CANVAS_PADDING_X * 2) + 80)}px;">
                  ${renderTimelineTicks(timeline.canvasTicks ?? timeline.ticks)}
                </div>
              </div>
            </div>
          </div>
          ${showUnplacedDock ? renderWorldSpineUnplacedDockHTML(unplacedDock, {
            collapsed: unplacedDockCollapsed,
            width,
            zoomFrameWidth: zoomFrameSize.width,
          }) : ""}
          <div class="world-spine-detail-overlay" data-world-spine-card-overlay></div>
          <div class="world-spine-implication-overlay" data-world-spine-implication-overlay>
            ${renderWorldSpineImplicationComposerHTML(implicationComposer, model)}
          </div>
        </div>
      </section>
      ${renderWorldSpinePanelResizer("manuscript-pane", "Resize right pane")}
      ${renderWorldSpineRightPane(model, {
        mode: normalizedRightPaneMode,
        relatedCards,
        relatedCardExpandedKey,
        sublocationComposer,
      })}
    </div>
  `;
}

// Intent: expose the same fitted location-filter viewport used by renderers to pointer/controller callers.
export function createWorldSpineLocationFilterViewportModel(model = {}, locationFilter = {}) {
  const sourceModel = model && typeof model === "object" ? model : {};
  const sourceTimeline = sourceModel.timeline ?? {};
  const locationFilterModel = buildWorldSpineLocationFilterModel(sourceTimeline, locationFilter);
  const timeline = projectWorldSpineTimelineForLocationFilterViewport(sourceTimeline, locationFilterModel);
  if (timeline === sourceTimeline) {
    return sourceModel;
  }

  return {
    ...sourceModel,
    timeline,
    eventRail: Array.isArray(timeline.primaryNodes) ? timeline.primaryNodes : sourceModel.eventRail,
  };
}

// Intent: fit selected location timelines into the viewport without rewriting source world/timeline records.
function projectWorldSpineTimelineForLocationFilterViewport(timeline = {}, locationFilterModel = {}) {
  if (timeline?.locationFilterViewportFit === true || locationFilterModel?.active !== true) {
    return timeline;
  }

  const sourceRows = normalizeTimelineLocationRowsForViewport(timeline.locationRows);
  const selectedRows = sourceRows.filter((row) => isWorldSpineLocationSelectedForViewport(row, locationFilterModel));
  if (!selectedRows.length || selectedRows.length === sourceRows.length) {
    return timeline;
  }

  const rowProjection = createLocationFilterViewportRowProjection(sourceRows, selectedRows);
  const projectedRows = sourceRows.map((row, index) => projectLocationFilterViewportRow(row, index, rowProjection));
  const projectedNodes = projectLocationFilterViewportNodes(timeline.nodes, sourceRows, rowProjection);
  const nodesById = new Map(projectedNodes.map((node) => [node.id, node]));
  const projectedCanvasNodes = projectLocationFilterViewportNodeList(timeline.canvasNodes, nodesById);
  const canvasNodesById = new Map(projectedCanvasNodes.map((node) => [node.id, node]));
  const projectedTiers = projectLocationFilterViewportTiers(timeline.tiers, projectedRows);
  const projectedPrimaryNodes = projectLocationFilterViewportNodeList(timeline.primaryNodes, nodesById);
  const width = Number.isFinite(Number(timeline.width)) ? Number(timeline.width) : 900;
  const visibleRowCount = Math.max(1, selectedRows.length);
  const height = resolveLocationFilterViewportHeight(visibleRowCount);

  return {
    ...timeline,
    height,
    mainSpineY: height - 100,
    axisY: height - 74,
    tiers: projectedTiers,
    locationRows: projectedRows,
    primaryNodes: projectedPrimaryNodes,
    childNodes: projectLocationFilterViewportNodeList(timeline.childNodes, nodesById),
    referenceNodes: projectLocationFilterViewportNodeList(timeline.referenceNodes, nodesById),
    nodes: projectedNodes,
    connections: projectLocationFilterViewportConnections(timeline.connections, nodesById),
    canvasPrimaryNodes: projectLocationFilterViewportNodeList(timeline.canvasPrimaryNodes, nodesById),
    canvasNodes: projectedCanvasNodes,
    canvasConnections: projectLocationFilterViewportConnections(timeline.canvasConnections, canvasNodesById),
    dropZones: createTimelineDropZones(projectedPrimaryNodes, width, projectedTiers, projectedRows),
    locationFilterViewportFit: true,
    locationFilterViewportRowCount: visibleRowCount,
  };
}

function normalizeTimelineLocationRowsForViewport(locationRows = []) {
  return (Array.isArray(locationRows) ? locationRows : [])
    .filter(Boolean)
    .map((row, index) => ({
      ...row,
      locationRowIndex: Number.isFinite(Number(row?.locationRowIndex)) ? Number(row.locationRowIndex) : index,
      locationLabel: normalizeLocationLabel(row?.locationLabel),
      locationKey: resolveLocationRowKey(row?.locationLabel, row?.locationKey),
      eventBlockRowY: Number.isFinite(Number(row?.eventBlockRowY))
        ? Number(row.eventBlockRowY)
        : EVENT_BLOCK_ROW_Y + (index * LOCATION_ROW_GAP),
    }));
}

function isWorldSpineLocationSelectedForViewport(row, locationFilterModel = {}) {
  return locationFilterModel.selectedLocationKeySet instanceof Set
    ? locationFilterModel.selectedLocationKeySet.has(resolveLocationRowKey(row?.locationLabel, row?.locationKey))
    : false;
}

function createLocationFilterViewportRowProjection(sourceRows = [], selectedRows = []) {
  const selectedIdentitySet = new Set(selectedRows.map(createLocationFilterViewportRowIdentity));
  const projectedEventBlockYByRow = new Map();
  const projectedLocationRowIndexByRow = new Map();
  let visibleIndex = 0;
  let hiddenIndex = selectedRows.length;

  sourceRows.forEach((row) => {
    const rowIdentity = createLocationFilterViewportRowIdentity(row);
    const projectedIndex = selectedIdentitySet.has(rowIdentity) ? visibleIndex++ : hiddenIndex++;
    projectedLocationRowIndexByRow.set(rowIdentity, projectedIndex);
    projectedEventBlockYByRow.set(rowIdentity, EVENT_BLOCK_ROW_Y + (projectedIndex * LOCATION_ROW_GAP));
  });

  return {
    projectedEventBlockYByRow,
    projectedLocationRowIndexByRow,
  };
}

function projectLocationFilterViewportRow(row, index = 0, rowProjection = {}) {
  const rowIdentity = createLocationFilterViewportRowIdentity(row);
  const eventBlockRowY = rowProjection.projectedEventBlockYByRow?.get(rowIdentity) ?? row.eventBlockRowY;
  return {
    ...row,
    originalLocationRowIndex: Number.isFinite(Number(row.locationRowIndex)) ? Number(row.locationRowIndex) : index,
    originalEventBlockRowY: row.eventBlockRowY,
    locationRowIndex: rowProjection.projectedLocationRowIndexByRow?.get(rowIdentity) ?? row.locationRowIndex,
    eventBlockRowY,
  };
}

function projectLocationFilterViewportNodes(nodes = [], sourceRows = [], rowProjection = {}) {
  return (Array.isArray(nodes) ? nodes : []).filter(Boolean).map((node) => {
    const row = resolveTimelineLocationRowForNode(node, sourceRows);
    const rowIdentity = row ? createLocationFilterViewportRowIdentity(row) : "";
    const projectedEventBlockRowY = rowIdentity ? rowProjection.projectedEventBlockYByRow?.get(rowIdentity) : null;
    const deltaY = Number.isFinite(Number(projectedEventBlockRowY)) && Number.isFinite(Number(row?.eventBlockRowY))
      ? Number(projectedEventBlockRowY) - Number(row.eventBlockRowY)
      : 0;
    return {
      ...node,
      y: round((Number(node.y) || 0) + deltaY),
      locationFilterViewportDeltaY: deltaY,
    };
  });
}

function projectLocationFilterViewportNodeList(nodes = [], nodesById = new Map()) {
  return (Array.isArray(nodes) ? nodes : [])
    .filter(Boolean)
    .map((node) => nodesById.get(node.id) ?? node);
}

function projectLocationFilterViewportTiers(tiers = [], projectedRows = []) {
  return (Array.isArray(tiers) ? tiers : []).filter(Boolean).map((tier, index) => {
    const normalizedTier = normalizeTimelineTier(tier, index);
    const tierRow =
      projectedRows.find((row) => normalizeString(row?.spineId) === normalizedTier.spineId && normalizeLocationKey(row?.locationLabel) === normalizeLocationKey(normalizedTier.locationLabel)) ||
      projectedRows.find((row) => normalizeString(row?.spineId) === normalizedTier.spineId);
    return tierRow
      ? {
          ...normalizedTier,
          eventBlockRowY: tierRow.eventBlockRowY,
          locationLabel: tierRow.locationLabel,
        }
      : normalizedTier;
  });
}

function projectLocationFilterViewportConnections(connections = [], nodesById = new Map()) {
  return (Array.isArray(connections) ? connections : [])
    .filter(Boolean)
    .map((connection, index) => {
      if (connection.kind === "implication") {
        return projectLocationFilterViewportImplicationConnection(connection, index, nodesById);
      }

      const fromNode = nodesById.get(connection.fromNodeId);
      const toNode = nodesById.get(connection.toNodeId);
      return fromNode && toNode
        ? createConnection(fromNode, toNode, connection.kind, connection.dashed)
        : null;
    })
    .filter(Boolean);
}

function projectLocationFilterViewportImplicationConnection(connection = {}, index = 0, nodesById = new Map()) {
  const sourceNode = nodesById.get(connection.originalFromNodeId || connection.fromNodeId);
  const targetNode = nodesById.get(connection.originalToNodeId || connection.toNodeId);
  const fromNode = resolveImplicationDisplayNode(sourceNode, nodesById);
  const toNode = resolveImplicationDisplayNode(targetNode, nodesById);
  if (!fromNode || !toNode) {
    return null;
  }

  return createImplicationConnection(fromNode, toNode, {
    id: connection.id,
    fromNodeId: connection.fromNodeId,
    toNodeId: connection.toNodeId,
    label: connection.label,
  }, index, {
    sourceNode,
    targetNode,
    routeNodes: [...nodesById.values()],
  });
}

function resolveLocationFilterViewportHeight(visibleRowCount = 1) {
  const rowCount = Math.max(1, Number(visibleRowCount) || 1);
  return Math.max(520, Math.ceil(EVENT_BLOCK_ROW_Y + ((rowCount - 1) * LOCATION_ROW_GAP) + MULTI_TIER_BOTTOM_PADDING));
}

function createLocationFilterViewportRowIdentity(row = {}) {
  return [
    normalizeString(row?.spineId),
    resolveLocationRowKey(row?.locationLabel, row?.locationKey),
    String(Number.isFinite(Number(row?.locationRowIndex)) ? Number(row.locationRowIndex) : 0),
  ].join("::");
}

export function normalizeWorldSpineRightPaneMode(mode = WORLD_SPINE_RIGHT_PANE_MODE_MANUSCRIPT) {
  const normalizedMode = normalizeString(mode);
  return WORLD_SPINE_RIGHT_PANE_MODES.has(normalizedMode)
    ? normalizedMode
    : WORLD_SPINE_RIGHT_PANE_MODE_MANUSCRIPT;
}

export function findWorldSpineNode(model, nodeId) {
  const normalizedNodeId = normalizeString(nodeId);
  if (!normalizedNodeId) {
    return null;
  }

  return (model?.timeline?.nodes ?? []).find((node) => node.id === normalizedNodeId) ?? null;
}

export function resolveWorldSpineWhitespaceContextFromPoint({
  timeline = {},
  canvasX = 0,
  canvasY = 0,
  clientX = 0,
  clientY = 0,
} = {}) {
  const normalizedCanvasX = Math.max(0, Number(canvasX) || 0);
  const normalizedCanvasY = Math.max(0, Number(canvasY) || 0);
  const tiers = Array.isArray(timeline?.tiers) ? timeline.tiers.filter(Boolean) : createWorldSpineTimelineTiers([]);
  const locationRows = Array.isArray(timeline?.locationRows) ? timeline.locationRows.filter(Boolean) : [];
  const locationRow = resolveTimelineLocationRowForCanvasY(locationRows, normalizedCanvasY);
  const tier = locationRow ?? resolveTimelineTierForCanvasY(tiers, normalizedCanvasY);
  const dropZone = resolveTimelineDropZoneForContextPoint({
    dropZones: timeline?.dropZones,
    canvasX: normalizedCanvasX,
    canvasY: normalizedCanvasY,
    tier,
  });

  return {
    x: round(Number(clientX) || 0),
    y: round(Number(clientY) || 0),
    canvasX: round(normalizedCanvasX),
    canvasY: round(normalizedCanvasY),
    dropIndex: Number.isFinite(Number(dropZone?.index)) ? Number(dropZone.index) : 0,
    spineId: normalizeString(dropZone?.spineId) || normalizeString(tier?.spineId) || DEFAULT_WORLD_SPINE_ID,
    spineLabel: normalizeString(dropZone?.spineLabel) || normalizeString(tier?.label) || "World Spine",
    tierIndex: Number.isFinite(Number(dropZone?.tierIndex)) ? Number(dropZone.tierIndex) : Number(tier?.tierIndex) || 0,
    locationKey: resolveLocationRowKey(dropZone?.locationLabel || locationRow?.locationLabel, dropZone?.locationKey || locationRow?.locationKey),
    locationLabel: normalizeLocationLabel(dropZone?.locationLabel || locationRow?.locationLabel),
    locationRowIndex: Number.isFinite(Number(dropZone?.locationRowIndex))
      ? Number(dropZone.locationRowIndex)
      : Number(locationRow?.locationRowIndex) || 0,
  };
}

export function renderWorldSpineWhitespaceContextMenuHTML(menu, { width = 0, height = 0 } = {}) {
  if (!menu || typeof menu !== "object") {
    return "";
  }

  const menuType = normalizeString(menu.menuType);
  if (menuType === "implication") {
    return renderWorldSpineImplicationContextMenuHTML(menu, { width, height });
  }
  if (menuType === "event") {
    return renderWorldSpineEventContextMenuHTML(menu, { width, height });
  }
  if (menuType === "timeline-form") {
    return renderWorldSpineParallelTimelineFormHTML(menu, { width, height });
  }
  if (menuType === "location-form") {
    return renderWorldSpineParallelTimelineFormHTML(menu, { width, height });
  }

  const viewportWidth = Math.max(WORLD_SPINE_CONTEXT_MENU_WIDTH + 16, Number(width) || 0);
  const viewportHeight = Math.max(WORLD_SPINE_CONTEXT_MENU_HEIGHT + 16, Number(height) || 0);
  const left = clamp(
    Math.round(Number(menu.x) || 0),
    8,
    Math.max(8, viewportWidth - WORLD_SPINE_CONTEXT_MENU_WIDTH - 8),
  );
  const top = clamp(
    Math.round(Number(menu.y) || 0),
    8,
    Math.max(8, viewportHeight - WORLD_SPINE_CONTEXT_MENU_HEIGHT - 8),
  );
  const dropIndex = Number.isFinite(Number(menu.dropIndex)) ? Math.max(0, Number(menu.dropIndex)) : 0;
  const tierIndex = Number.isFinite(Number(menu.tierIndex)) ? Math.max(0, Number(menu.tierIndex)) : 0;
  const spineId = normalizeString(menu.spineId) || DEFAULT_WORLD_SPINE_ID;
  const spineLabel = normalizeString(menu.spineLabel) || "World Spine";
  const locationKey = normalizeLocationKey(menu.locationKey);
  const locationLabel = normalizeLocationLabel(menu.locationLabel);

  return `
    <div
      class="task-context-menu world-spine-context-menu"
      data-world-spine-context-menu
      style="left:${left}px; top:${top}px;"
      role="menu"
      aria-label="World Spine timeline options"
    >
      <p>${escapeHtml(locationLabel ? `${spineLabel} / ${locationLabel}` : spineLabel)}</p>
      <button
        class="task-menu-item"
        data-action="world-spine-insert-event-here"
        data-world-spine-drop-index="${escapeHtml(String(dropIndex))}"
        data-world-spine-id="${escapeHtml(spineId)}"
        data-world-spine-tier-index="${escapeHtml(String(tierIndex))}"
        data-world-spine-location-key="${escapeHtml(locationKey)}"
        data-world-spine-location-label="${escapeHtml(locationLabel)}"
        role="menuitem"
      >
        <span class="task-menu-icon" aria-hidden="true">+</span>
        <span>Insert event here</span>
      </button>
      <button class="task-menu-item" data-action="world-spine-add-parallel-timeline" role="menuitem">
        <span class="task-menu-icon" aria-hidden="true">=</span>
        <span>Add parallel timeline</span>
      </button>
      <button class="task-menu-item" data-action="close-world-spine-context-menu" role="menuitem">
        <span class="task-menu-icon" aria-hidden="true">x</span>
        <span>Cancel</span>
      </button>
      <p>Place timeline events by location without changing manuscript order.</p>
    </div>
  `;
}

export function renderWorldSpineParallelTimelineFormHTML(menu, { width = 0, height = 0 } = {}) {
  if (!menu || typeof menu !== "object") {
    return "";
  }

  const isLocationRowForm = normalizeString(menu.menuType) === "location-form";
  const canDeleteLocationRow = isWorldSpineLocationRowDeleteEligible(menu);
  const viewportWidth = Math.max(WORLD_SPINE_PARALLEL_TIMELINE_FORM_WIDTH + 16, Number(width) || 0);
  const viewportHeight = Math.max(WORLD_SPINE_PARALLEL_TIMELINE_FORM_HEIGHT + 16, Number(height) || 0);
  const left = clamp(
    Math.round(Number(menu.x) || 0),
    8,
    Math.max(8, viewportWidth - WORLD_SPINE_PARALLEL_TIMELINE_FORM_WIDTH - 8),
  );
  const top = clamp(
    Math.round(Number(menu.y) || 0),
    8,
    Math.max(8, viewportHeight - WORLD_SPINE_PARALLEL_TIMELINE_FORM_HEIGHT - 8),
  );
  const hasFormLocation = Object.prototype.hasOwnProperty.call(menu, "location");
  const locationLabel = hasFormLocation
    ? normalizeString(menu.location)
    : normalizeLocationLabel(menu.locationLabel);
  const participants = normalizeString(menu.participants ?? menu.keyActors);
  const startMarker = normalizeString(menu.startMarker);
  const notes = normalizeString(menu.notes);
  const error = normalizeString(menu.error);
  const pickerOptionSets = menu.pickerOptionSets && typeof menu.pickerOptionSets === "object"
    ? menu.pickerOptionSets
    : {};
  const locationField = {
    key: "location",
    label: "Location",
    value: locationLabel,
    placeholder: "Planet, city, ship, region, realm",
    required: true,
  };
  const participantsField = {
    key: "participants",
    label: "Characters",
    value: participants,
    placeholder: "Type to search characters",
  };
  const locationPickerListId = getWorldSpineParallelTimelinePickerListId(locationField, pickerOptionSets);
  const participantsPickerListId = getWorldSpineParallelTimelinePickerListId(participantsField, pickerOptionSets);

  return `
    <form
      class="task-context-menu world-spine-context-menu world-spine-context-menu--timeline-form has-form-dismiss"
      data-world-spine-context-menu
      data-world-spine-context-kind="${isLocationRowForm ? "location-form" : "timeline-form"}"
      data-world-spine-parallel-timeline-form
      style="left:${left}px; top:${top}px;"
      aria-label="${isLocationRowForm ? "Timeline location details" : "New parallel timeline details"}"
    >
      <button
        class="form-dismiss-button world-spine-context-menu__dismiss"
        type="button"
        data-action="close-world-spine-context-menu"
        aria-label="${isLocationRowForm ? "Cancel location form" : "Cancel parallel timeline form"}"
        title="Cancel"
      >&times;</button>
      <div class="world-spine-timeline-form__heading">
        <span>${isLocationRowForm ? "Location row" : "Parallel timeline"}</span>
      </div>
      ${renderWorldSpineParallelTimelineTextField({
        ...locationField,
        pickerListId: locationPickerListId,
      })}
      ${isLocationRowForm ? "" : renderWorldSpineParallelTimelineTextField({
        ...participantsField,
        pickerListId: participantsPickerListId,
      })}
      ${isLocationRowForm ? "" : renderWorldSpineParallelTimelineTextField({
        key: "startMarker",
        label: "Starting marker",
        value: startMarker,
        placeholder: "Date, chapter, scene, or inciting event",
      })}
      ${renderWorldSpineParallelTimelinePickerDatalists([
        { field: locationField, listId: locationPickerListId },
        ...(isLocationRowForm ? [] : [{ field: participantsField, listId: participantsPickerListId }]),
      ], pickerOptionSets)}
      ${isLocationRowForm ? "" : `<label class="world-spine-timeline-form__field">
        <span>Notes</span>
        <textarea
          data-world-spine-parallel-timeline-field="notes"
          rows="3"
          maxlength="220"
          placeholder="Constraints, parallel stakes, or locality rules"
        >${escapeHtml(notes)}</textarea>
      </label>`}
      ${error ? `<p class="world-spine-timeline-form__error" role="alert">${escapeHtml(error)}</p>` : ""}
      <div class="world-spine-timeline-form__actions">
        ${canDeleteLocationRow ? `
          <button
            type="button"
            class="tag-button panel-action-button"
            data-action="delete-world-spine-location-row"
          >Delete row</button>
        ` : ""}
        ${isLocationRowForm ? `
          <button
            type="button"
            class="tag-button panel-action-button"
            data-action="attach-world-spine-location-row-image"
            data-world-spine-location-label="${escapeHtml(locationLabel)}"
          >Attach image</button>
        ` : ""}
        <button type="button" class="tag-button panel-action-button" data-action="${isLocationRowForm ? "save-world-spine-location-row" : "save-world-spine-parallel-timeline"}">${isLocationRowForm ? "Save location" : "Create timeline"}</button>
      </div>
    </form>
  `;
}

function renderWorldSpineParallelTimelineTextField({
  key = "",
  label = "",
  value = "",
  placeholder = "",
  required = false,
  pickerListId = "",
} = {}) {
  const fieldKey = normalizeString(key);
  const listAttribute = pickerListId
    ? ` list="${escapeHtml(pickerListId)}"`
    : "";
  return `
    <label class="world-spine-timeline-form__field">
      <span>${escapeHtml(label)}</span>
      <input
        type="text"
        data-world-spine-parallel-timeline-field="${escapeHtml(fieldKey)}"
        value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}"
        autocomplete="off"
        spellcheck="false"
        maxlength="120"
        ${listAttribute}
        ${required ? "required" : ""}
      >
    </label>
  `;
}

// Intent: give compact World Spine forms the same catalogue-backed quick reference behavior as studio entry forms.
function renderWorldSpineParallelTimelinePickerDatalists(fieldEntries = [], pickerOptionSets = {}) {
  return (Array.isArray(fieldEntries) ? fieldEntries : [])
    .map(({ field, listId }) => renderWorldSpineParallelTimelinePickerDatalist(
      listId,
      getWorldSpinePickerOptionsForField(field, pickerOptionSets),
    ))
    .join("");
}

function renderWorldSpineParallelTimelinePickerDatalist(listId = "", options = []) {
  const normalizedOptions = uniqueStrings((Array.isArray(options) ? options : []).map(normalizeString).filter(Boolean));
  if (!listId || !normalizedOptions.length) {
    return "";
  }

  return `
    <datalist id="${escapeHtml(listId)}" data-world-spine-parallel-timeline-picker-options>
      ${normalizedOptions.map((option) => `<option value="${escapeHtml(option)}"></option>`).join("")}
    </datalist>
  `;
}

function getWorldSpineParallelTimelinePickerListId(field = {}, pickerOptionSets = {}) {
  const pickerType = resolveWorldSpinePickerTypeForField(field);
  return pickerType && getWorldSpinePickerOptionsForField(field, pickerOptionSets).length
    ? `world-spine-parallel-${slugify(pickerType) || "catalogue"}-options`
    : "";
}

function renderWorldSpineEventContextMenuHTML(menu, { width = 0, height = 0 } = {}) {
  const nodeId = normalizeString(menu.nodeId);
  const nodeTitle = normalizeString(menu.nodeTitle ?? menu.assignmentModel?.node?.title) || "Timeline event";
  const nodeTypeLabel = normalizeString(menu.nodeTypeLabel ?? menu.assignmentModel?.node?.typeLabel) || "World Spine event";
  const groups = normalizeWorldSpineAssignmentGroups(menu.assignmentModel?.groups);
  const selectedCategoryId = resolveWorldSpineAssignmentCategoryId(menu.assignmentCategoryId, groups);
  const selectedGroup = groups.find((group) => group.id === selectedCategoryId) ?? null;
  const eventMenuWidth = selectedGroup
    ? WORLD_SPINE_EVENT_CONTEXT_MENU_WIDTH
    : WORLD_SPINE_EVENT_CATEGORY_MENU_WIDTH;
  const viewportWidth = Math.max(eventMenuWidth + 16, Number(width) || 0);
  const viewportHeight = Math.max(WORLD_SPINE_EVENT_CONTEXT_MENU_HEIGHT + 16, Number(height) || 0);
  const left = clamp(
    Math.round(Number(menu.x) || 0),
    8,
    Math.max(8, viewportWidth - eventMenuWidth - 8),
  );
  const top = clamp(
    Math.round(Number(menu.y) || 0),
    8,
    Math.max(8, viewportHeight - WORLD_SPINE_EVENT_CONTEXT_MENU_HEIGHT - 8),
  );

  return `
    <div
      class="task-context-menu world-spine-context-menu world-spine-context-menu--event has-form-dismiss ${selectedGroup ? "has-assignment-selection" : ""}"
      data-world-spine-context-menu
      data-world-spine-context-kind="event"
      data-world-spine-node-id="${escapeHtml(nodeId)}"
      style="left:${left}px; top:${top}px;"
      role="menu"
      aria-label="World Spine event options"
    >
      <button
        class="form-dismiss-button world-spine-context-menu__dismiss"
        type="button"
        data-action="close-world-spine-context-menu"
        aria-label="Cancel assignment form"
        title="Cancel"
        role="menuitem"
      >&times;</button>
      <p>${escapeHtml(`${nodeTypeLabel}: ${nodeTitle}`)}</p>
      <section class="world-spine-assignment-picker" aria-label="Assign catalogue item">
        <span class="world-spine-assignment-picker__label">Assign catalogue item</span>
        ${groups.length
          ? renderWorldSpineAssignmentBrowserHTML(groups, selectedGroup, nodeId)
          : `<p class="world-spine-assignment-empty">No catalogue items are available yet.</p>`}
      </section>
      <p>Manual event assignments are stored as reviewed timeline presence links for later AI passes.</p>
    </div>
  `;
}

function renderWorldSpineAssignmentBrowserHTML(groups, selectedGroup, nodeId) {
  return `
    <div class="world-spine-assignment-browser ${selectedGroup ? "has-selection" : ""}">
      <div class="world-spine-assignment-categories" role="listbox" aria-label="Catalogue categories">
        ${groups.map((group) => renderWorldSpineAssignmentCategoryButtonHTML(group, selectedGroup?.id, nodeId)).join("")}
      </div>
      ${selectedGroup
        ? `<div class="world-spine-assignment-items-pane" data-world-spine-assignment-items-pane role="group" aria-label="${escapeHtml(`${selectedGroup.label || "Catalogue"} items`)}">
            ${renderWorldSpineAssignmentFilterHTML(selectedGroup)}
            ${renderWorldSpineAssignmentItemsPaneHTML(selectedGroup, nodeId)}
          </div>`
        : ""}
    </div>
  `;
}

function renderWorldSpineAssignmentCategoryButtonHTML(group, selectedCategoryId, nodeId) {
  const isSelected = group.id === selectedCategoryId;
  return `
    <button
      type="button"
      class="world-spine-assignment-category ${isSelected ? "is-selected" : ""}"
      data-action="world-spine-select-catalogue-assignment-category"
      data-world-spine-assignment-category-id="${escapeHtml(group.id)}"
      role="option"
      aria-selected="${isSelected ? "true" : "false"}"
      aria-expanded="${isSelected ? "true" : "false"}"
    >
      <span class="task-menu-icon" aria-hidden="true">${escapeHtml(createAssignmentGroupIcon(group.label))}</span>
      <span>${escapeHtml(group.label || "Catalogue")}</span>
      <strong>${escapeHtml(String(group.items.length))}</strong>
    </button>
  `;
}

function renderWorldSpineAssignmentFilterHTML(group) {
  const label = group.label || "Catalogue";
  return `
    <div class="world-spine-assignment-filter">
      <input
        type="search"
        class="world-spine-assignment-filter__input"
        data-world-spine-assignment-filter
        data-world-spine-assignment-filter-category-id="${escapeHtml(group.id)}"
        aria-label="${escapeHtml(`Filter ${label}`)}"
        placeholder="${escapeHtml(`Type to filter ${label}`)}"
        autocomplete="off"
        spellcheck="false"
      >
    </div>
  `;
}

function renderWorldSpineAssignmentItemsPaneHTML(group, nodeId) {
  const items = Array.isArray(group.items) ? group.items : [];
  return `
    <div class="world-spine-assignment-list" data-world-spine-assignment-list>
      ${items.length
        ? items.map((item) => renderWorldSpineAssignmentItemHTML(item, nodeId)).join("")
        : `<p class="world-spine-assignment-empty">No ${escapeHtml((group.label || "catalogue items").toLowerCase())} yet</p>`}
    </div>
    <p class="world-spine-assignment-empty" data-world-spine-assignment-filter-empty hidden>No matching ${escapeHtml((group.label || "catalogue items").toLowerCase())}.</p>
  `;
}

function renderWorldSpineAssignmentItemHTML(item, nodeId) {
  const isAssigned = item.isAssigned === true;
  const searchText = normalizeString([
    item.title,
    item.meta,
    item.detail,
    item.categoryId,
  ].filter(Boolean).join(" "));
  return `
    <button
      class="world-spine-assignment-item"
      data-action="world-spine-assign-catalogue-item"
      data-world-spine-assignment-item
      data-world-spine-assignment-search-text="${escapeHtml(searchText)}"
      data-world-spine-node-id="${escapeHtml(nodeId)}"
      data-world-spine-catalogue-item-id="${escapeHtml(item.id)}"
      data-world-spine-catalogue-category-id="${escapeHtml(item.categoryId || "")}"
      role="menuitem"
      ${isAssigned ? "disabled" : ""}
    >
      <span>
        <strong>${escapeHtml(item.title || "Untitled item")}</strong>
        ${item.meta ? `<em>${escapeHtml(item.meta)}</em>` : ""}
        ${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ""}
      </span>
      ${isAssigned ? `<b aria-label="Already assigned">Assigned</b>` : ""}
    </button>
  `;
}

function normalizeWorldSpineAssignmentGroups(groups = []) {
  return (Array.isArray(groups) ? groups : [])
    .map((group) => ({
      id: normalizeString(group?.id),
      label: normalizeString(group?.label) || "Catalogue",
      items: (Array.isArray(group?.items) ? group.items : [])
        .map((item) => ({
          id: normalizeString(item?.id ?? item?.entityId),
          categoryId: normalizeString(item?.categoryId),
          title: normalizeString(item?.title ?? item?.name),
          meta: normalizeString(item?.meta),
          detail: normalizeString(item?.detail),
          isAssigned: item?.isAssigned === true,
        }))
        .filter((item) => item.id && item.title),
    }))
    .filter((group) => group.id || group.label);
}

function resolveWorldSpineAssignmentCategoryId(categoryId = "", groups = []) {
  const normalizedCategoryId = normalizeString(categoryId);
  return groups.some((group) => group.id === normalizedCategoryId)
    ? normalizedCategoryId
    : "";
}

function createAssignmentGroupIcon(label = "") {
  const text = normalizeString(label);
  return text ? text[0].toUpperCase() : "C";
}

function renderWorldSpineImplicationContextMenuHTML(menu, { width = 0, height = 0 } = {}) {
  const viewportWidth = Math.max(WORLD_SPINE_CONTEXT_MENU_WIDTH + 16, Number(width) || 0);
  const viewportHeight = Math.max(WORLD_SPINE_CONTEXT_MENU_HEIGHT + 16, Number(height) || 0);
  const left = clamp(
    Math.round(Number(menu.x) || 0),
    8,
    Math.max(8, viewportWidth - WORLD_SPINE_CONTEXT_MENU_WIDTH - 8),
  );
  const top = clamp(
    Math.round(Number(menu.y) || 0),
    8,
    Math.max(8, viewportHeight - WORLD_SPINE_CONTEXT_MENU_HEIGHT - 8),
  );
  const edgeId = normalizeString(menu.edgeId);
  const label = normalizeString(menu.label) || "Implication";

  return `
    <div
      class="task-context-menu world-spine-context-menu"
      data-world-spine-context-menu
      data-world-spine-context-kind="implication"
      style="left:${left}px; top:${top}px;"
      role="menu"
      aria-label="World Spine implication options"
    >
      <p>${escapeHtml(label)}</p>
      <button
        class="task-menu-item"
        data-action="world-spine-edit-implication"
        data-world-spine-edge-id="${escapeHtml(edgeId)}"
        role="menuitem"
      >
        <span class="task-menu-icon" aria-hidden="true">E</span>
        <span>Edit implication</span>
      </button>
      <button
        class="task-menu-item"
        data-action="world-spine-delete-implication"
        data-world-spine-edge-id="${escapeHtml(edgeId)}"
        role="menuitem"
      >
        <span class="task-menu-icon" aria-hidden="true">x</span>
        <span>Delete implication</span>
      </button>
      <button class="task-menu-item" data-action="close-world-spine-context-menu" role="menuitem">
        <span class="task-menu-icon" aria-hidden="true">x</span>
        <span>Cancel</span>
      </button>
      <p>Modify this reviewed causal link without changing timeline nodes.</p>
    </div>
  `;
}

// Intent: keep World Spine timeline zoom bounded and deterministic across render and wheel paths.
export function normalizeWorldSpineTimelineZoom(value) {
  const numericValue = Number(value);
  const resolvedValue = Number.isFinite(numericValue)
    ? numericValue
    : WORLD_SPINE_TIMELINE_ZOOM_DEFAULT;
  return Math.round(
    clamp(
      resolvedValue,
      WORLD_SPINE_TIMELINE_ZOOM_MIN,
      WORLD_SPINE_TIMELINE_ZOOM_MAX,
    ) * 100,
  ) / 100;
}

// Intent: translate Ctrl-wheel direction into the next timeline magnification without relying on browser zoom.
export function resolveWorldSpineTimelineZoomFromWheel(currentZoom, delta) {
  const safeDelta = Number(delta);
  const normalizedZoom = normalizeWorldSpineTimelineZoom(currentZoom);
  if (!Number.isFinite(safeDelta) || safeDelta === 0) {
    return normalizedZoom;
  }

  const direction = safeDelta < 0 ? 1 : -1;
  return normalizeWorldSpineTimelineZoom(
    normalizedZoom + (direction * WORLD_SPINE_TIMELINE_ZOOM_STEP),
  );
}

// Intent: map World Spine wheel gestures to one canvas scroll axis while modifiers choose the mode.
export function resolveWorldSpineTimelineWheelScrollPlan(event = {}) {
  const deltaX = Number(event?.deltaX) || 0;
  const deltaY = Number(event?.deltaY) || 0;
  const delta = Math.abs(deltaX) >= Math.abs(deltaY)
    ? deltaX
    : deltaY;
  if (!delta) {
    return {
      axis: "none",
      delta: 0,
    };
  }

  return {
    axis: event?.shiftKey ? "vertical" : "horizontal",
    delta,
  };
}

function resolveWorldSpineTimelineZoomFrameSize(width, height, zoom) {
  const normalizedZoom = normalizeWorldSpineTimelineZoom(zoom);
  return {
    width: Math.max(1, Math.round((Number(width) || 0) * normalizedZoom)),
    height: Math.max(1, Math.round((Number(height) || 0) * normalizedZoom)),
  };
}

export function renderWorldSpineDetailCardHTML(node) {
  if (!node) {
    return "";
  }

  const nodeTypeLabel = normalizeString(node.typeLabel) || "Event";
  const summary = normalizeString(node.summary) || "No event summary recorded yet.";

  return `
    <article
      class="world-spine-detail-card"
      data-world-spine-detail-card
      data-world-spine-node-id="${escapeHtml(node.id)}"
      role="region"
      aria-label="${escapeHtml(`${node.title} event summary`)}"
    >
      <div class="world-spine-detail-card__heading">
        <p>${escapeHtml(nodeTypeLabel)}</p>
        <h3>${escapeHtml(node.title)}</h3>
      </div>
      <div class="world-spine-detail-card__body" tabindex="0">
        <p>${escapeHtml(summary)}</p>
      </div>
    </article>
  `;
}

export function renderWorldSpineImplicationComposerHTML(composer, model) {
  if (!composer || typeof composer !== "object") {
    return "";
  }

  const fromNodeId = normalizeString(composer.fromNodeId);
  const toNodeId = normalizeString(composer.toNodeId);
  const fromNode = findWorldSpineNode(model, fromNodeId);
  const toNode = findWorldSpineNode(model, toNodeId);
  if (!fromNode || !toNode || fromNode.id === toNode.id) {
    return "";
  }

  const left = normalizePanelCoordinate(composer.x, 16);
  const top = normalizePanelCoordinate(composer.y, 16);
  const width = normalizePanelWidth(composer.width, 276);
  const error = normalizeString(composer.error);
  const edgeId = normalizeString(composer.edgeId);
  return `
    <form
      class="world-spine-implication-composer has-form-dismiss"
      data-world-spine-implication-composer
      data-world-spine-edge-id="${escapeHtml(edgeId)}"
      data-from-node-id="${escapeHtml(fromNode.id)}"
      data-to-node-id="${escapeHtml(toNode.id)}"
      style="left:${left}px; top:${top}px; width:${width}px;"
    >
      <button
        class="form-dismiss-button world-spine-implication-composer__dismiss"
        type="button"
        data-action="world-spine-cancel-implication"
        aria-label="Cancel implication form"
        title="Cancel"
      >&times;</button>
      <div class="world-spine-implication-composer__heading">
        <span>${escapeHtml(fromNode.title)}</span>
        <strong>${escapeHtml(toNode.title)}</strong>
      </div>
      <label class="world-spine-implication-composer__field">
        <span>Implication</span>
        <textarea
          data-world-spine-implication-input
          rows="3"
          maxlength="180"
          placeholder="Effect on the target event"
        >${escapeHtml(composer.effect || "")}</textarea>
      </label>
      ${error ? `<p class="world-spine-implication-composer__error">${escapeHtml(error)}</p>` : ""}
      <div class="world-spine-implication-composer__actions">
        <button type="button" class="tag-button panel-action-button" data-action="world-spine-save-implication">Save</button>
      </div>
    </form>
  `;
}

// Intent: resolve the manuscript chapter represented near the center of the visible event pane.
export function resolveWorldSpineViewportChapterAnchor({
  nodes = [],
  scrollLeft = 0,
  viewportWidth = 0,
} = {}) {
  const sceneNodes = (Array.isArray(nodes) ? nodes : [])
    .filter((node) =>
      node &&
      normalizeString(node.level) === "primary" &&
      normalizeString(node.kind) === "scene" &&
      normalizeString(node.id)
    )
    .sort((left, right) => resolveNodeLeft(left) - resolveNodeLeft(right));
  if (!sceneNodes.length) {
    return null;
  }

  const safeScrollLeft = Math.max(0, Number(scrollLeft) || 0);
  const safeViewportWidth = Math.max(0, Number(viewportWidth) || 0);
  const viewportLeft = safeScrollLeft;
  const viewportRight = safeViewportWidth > 0 ? safeScrollLeft + safeViewportWidth : safeScrollLeft;
  const viewportCenter = safeViewportWidth > 0
    ? safeScrollLeft + (safeViewportWidth / 2)
    : safeScrollLeft;
  const visibleNodes = safeViewportWidth > 0
    ? sceneNodes.filter((node) => {
        const left = resolveNodeLeft(node);
        const right = left + resolveNodeWidth(node);
        return right >= viewportLeft && left <= viewportRight;
      })
    : [];
  const candidates = visibleNodes.length ? visibleNodes : sceneNodes;
  const activeNode = candidates.reduce((nearest, node) => {
    const nodeDistance = Math.abs(resolveNodeCenterX(node) - viewportCenter);
    const nearestDistance = Math.abs(resolveNodeCenterX(nearest) - viewportCenter);
    return nodeDistance < nearestDistance ? node : nearest;
  }, candidates[0]);
  const chapterTitle = formatWorldSpineChapterAnchorTitle(activeNode);
  const sceneTitle = normalizeString(activeNode.sceneTitle) || normalizeString(activeNode.title) || "Untitled scene";

  return {
    nodeId: normalizeString(activeNode.id),
    sceneId: normalizeString(activeNode.sceneId),
    chapterId: normalizeString(activeNode.chapterId),
    chapterTitle,
    sceneTitle,
    label: `Looking over ${chapterTitle}`,
  };
}

// Intent: calculate a card position that stays attached to the node inside the central viewport.
export function calculateWorldSpineDetailCardPlacement({
  viewportRect,
  nodeRect,
  cardSize,
  gap = WORLD_SPINE_DETAIL_CARD_GAP,
  margin = 8,
} = {}) {
  const viewport = normalizeRect(viewportRect);
  const node = normalizeRect(nodeRect);
  const rawCardWidth = Number.isFinite(cardSize?.width) ? cardSize.width : WORLD_SPINE_DETAIL_CARD_MAX_WIDTH;
  const rawCardHeight = Number.isFinite(cardSize?.height) ? cardSize.height : WORLD_SPINE_DETAIL_CARD_MAX_HEIGHT;
  const viewportWidth = Math.max(1, viewport.width - (margin * 2));
  const viewportHeight = Math.max(1, viewport.height - (margin * 2));
  const width = Math.min(
    Math.max(WORLD_SPINE_DETAIL_CARD_MIN_WIDTH, rawCardWidth),
    WORLD_SPINE_DETAIL_CARD_MAX_WIDTH,
    viewportWidth,
  );
  const nodeCenterX = node.left - viewport.left + (node.width / 2);
  const rawLeft = nodeCenterX - (width / 2);
  const left = clamp(rawLeft, margin, Math.max(margin, viewport.width - width - margin));

  const minimumHeight = Math.min(WORLD_SPINE_DETAIL_CARD_MIN_HEIGHT, viewportHeight);
  const spaceBelow = Math.max(0, viewport.bottom - node.bottom - gap - margin);
  const spaceAbove = Math.max(0, node.top - viewport.top - gap - margin);
  const side = spaceBelow >= minimumHeight || spaceBelow >= spaceAbove ? "bottom" : "top";
  const sideSpace = side === "bottom" ? spaceBelow : spaceAbove;
  const maxHeight = Math.min(
    WORLD_SPINE_DETAIL_CARD_MAX_HEIGHT,
    viewportHeight,
    Math.max(minimumHeight, sideSpace || viewportHeight),
  );
  const measuredHeight = Math.min(Math.max(1, rawCardHeight), maxHeight);
  const height = side === "top" ? maxHeight : measuredHeight;
  const rawTop = side === "bottom"
    ? node.bottom - viewport.top + gap
    : node.top - viewport.top - gap - height;
  const top = clamp(rawTop, margin, Math.max(margin, viewport.height - height - margin));

  return {
    side,
    left,
    top,
    width,
    maxHeight,
  };
}

// Intent: place the implication text composer near the visual midpoint of the two linked nodes.
export function calculateWorldSpineImplicationComposerPlacement({
  viewportRect,
  fromNodeRect,
  toNodeRect,
  composerSize,
  margin = 12,
} = {}) {
  const viewport = normalizeRect(viewportRect);
  const fromNode = normalizeRect(fromNodeRect);
  const toNode = normalizeRect(toNodeRect);
  const rawComposerWidth = Number.isFinite(composerSize?.width) ? composerSize.width : 276;
  const rawComposerHeight = Number.isFinite(composerSize?.height) ? composerSize.height : 176;
  const width = Math.min(Math.max(220, rawComposerWidth), Math.max(220, viewport.width - (margin * 2)));
  const height = Math.min(Math.max(140, rawComposerHeight), Math.max(140, viewport.height - (margin * 2)));
  const fromCenterX = fromNode.left + (fromNode.width / 2);
  const toCenterX = toNode.left + (toNode.width / 2);
  const fromCenterY = fromNode.top + (fromNode.height / 2);
  const toCenterY = toNode.top + (toNode.height / 2);
  const midpointX = ((fromCenterX + toCenterX) / 2) - viewport.left;
  const midpointY = ((fromCenterY + toCenterY) / 2) - viewport.top;
  return {
    left: clamp(midpointX - (width / 2), margin, Math.max(margin, viewport.width - width - margin)),
    top: clamp(midpointY - (height / 2), margin, Math.max(margin, viewport.height - height - margin)),
    width,
  };
}

// Intent: keep post-drag click suppression from swallowing deliberate composer actions.
export function shouldConsumeWorldSpineSuppressedClick(target) {
  const closest = target && typeof target.closest === "function"
    ? target.closest.bind(target)
    : null;
  return !closest || !closest(WORLD_SPINE_IMPLICATION_COMPOSER_SELECTOR);
}

// Intent: convert a dragged scene-node pointer position into the binder-compatible before/after target.
export function resolveWorldSpineSceneReorderDropTarget({
  sourceNodeId = "",
  targetNodeId = "",
  pointerX = 0,
  nodes = [],
} = {}) {
  const normalizedSourceNodeId = normalizeString(sourceNodeId);
  const sourceNode = (Array.isArray(nodes) ? nodes : [])
    .find((node) => normalizeString(node?.id) === normalizedSourceNodeId);
  if (!isWorldSpineSceneReorderNode(sourceNode)) {
    return null;
  }

  const candidates = (Array.isArray(nodes) ? nodes : [])
    .filter((node) =>
      isWorldSpineSceneReorderNode(node) &&
      normalizeString(node?.id) !== normalizedSourceNodeId
    )
    .map((node) => ({
      node,
      centerX: resolveWorldSpineSceneReorderNodeCenterX(node),
    }))
    .filter((candidate) => Number.isFinite(candidate.centerX))
    .sort((left, right) => left.centerX - right.centerX);
  if (!candidates.length) {
    return null;
  }

  const normalizedTargetNodeId = normalizeString(targetNodeId);
  const directCandidate = normalizedTargetNodeId
    ? candidates.find((candidate) => normalizeString(candidate.node?.id) === normalizedTargetNodeId)
    : null;
  const numericPointerX = Number(pointerX);
  const safePointerX = Number.isFinite(numericPointerX)
    ? numericPointerX
    : candidates[0].centerX;

  if (directCandidate) {
    return createWorldSpineSceneReorderDropTarget(
      directCandidate.node,
      safePointerX < directCandidate.centerX ? "before" : "after",
    );
  }

  const previous = [...candidates].reverse()
    .find((candidate) => candidate.centerX <= safePointerX) ?? null;
  const next = candidates.find((candidate) => candidate.centerX > safePointerX) ?? null;
  if (!previous && next) {
    return createWorldSpineSceneReorderDropTarget(next.node, "before");
  }
  if (previous && !next) {
    return createWorldSpineSceneReorderDropTarget(previous.node, "after");
  }
  if (!previous || !next) {
    return null;
  }

  return safePointerX - previous.centerX <= next.centerX - safePointerX
    ? createWorldSpineSceneReorderDropTarget(previous.node, "after")
    : createWorldSpineSceneReorderDropTarget(next.node, "before");
}

function isWorldSpineSceneReorderNode(node) {
  return Boolean(
    node &&
    normalizeString(node.level) === "primary" &&
    normalizeString(node.kind) === "scene" &&
    normalizeString(node.id) &&
    normalizeString(node.sceneId),
  );
}

function resolveWorldSpineSceneReorderNodeCenterX(node) {
  const centerX = Number(node?.centerX);
  if (Number.isFinite(centerX)) {
    return centerX;
  }

  const left = Number(node?.left);
  const width = Number(node?.width);
  if (Number.isFinite(left) && Number.isFinite(width)) {
    return left + (width / 2);
  }

  const x = Number(node?.x);
  if (Number.isFinite(x) && Number.isFinite(width)) {
    return x + (width / 2);
  }

  return Number.NaN;
}

function createWorldSpineSceneReorderDropTarget(node, type) {
  return {
    type: type === "after" ? "after" : "before",
    nodeId: normalizeString(node?.id),
    sceneId: normalizeString(node?.sceneId),
    chapterId: normalizeString(node?.chapterId),
    chapterTitle: normalizeString(node?.chapterTitle),
  };
}

// Intent: keep focus, scroll, link, and drag behavior close to the World Spine DOM it controls.
export function createWorldSpineInteractionController({
  getModel,
  getRoot = () => document.querySelector("[data-world-spine-root]"),
  onTimelineScroll = () => {},
  onManuscriptScroll = () => {},
  onImplicationLinkDraft = () => {},
  onImplicationContextMenu = () => {},
  onImplicationNavigate = () => {},
  onEventContextMenu = () => {},
  onWhitespaceContextMenu = () => {},
  onSelectionClear = () => {},
  onSceneNodeReorder = () => {},
  onTimelineZoom = () => {},
  closeDelayMs = WORLD_SPINE_DETAIL_CLOSE_DELAY_MS,
} = {}) {
  let activeNodeId = "";
  let closeTimer = null;
  let dragSession = null;
  let linkSession = null;
  let nodeBlockDragSession = null;
  let suppressNextClick = false;
  let timelineZoom = WORLD_SPINE_TIMELINE_ZOOM_DEFAULT;

  function getOverlay() {
    return getRoot()?.querySelector("[data-world-spine-card-overlay]") ?? null;
  }

  function getTimelineScroll() {
    return getRoot()?.querySelector("[data-world-spine-timeline-scroll]") ?? null;
  }

  function getTimelineZoom() {
    const scroll = getTimelineScroll();
    if (scroll instanceof HTMLElement) {
      timelineZoom = normalizeWorldSpineTimelineZoom(scroll.dataset.worldSpineTimelineZoom);
    }

    return timelineZoom;
  }

  // Intent: keep the transformed canvas and scrollbar extent in sync after wheel zooms and panel rerenders.
  function applyTimelineZoomValue(nextZoom) {
    timelineZoom = normalizeWorldSpineTimelineZoom(nextZoom);
    const root = getRoot();
    const scroll = getTimelineScroll();
    if (!(scroll instanceof HTMLElement)) {
      return timelineZoom;
    }

    const frame = scroll.querySelector("[data-world-spine-timeline-zoom-frame]");
    const unplacedTrackFrame = root?.querySelector("[data-world-spine-unplaced-track-frame]");
    const canvas = scroll.querySelector("[data-world-spine-canvas]");
    const width = Number(canvas?.dataset?.worldSpineCanvasWidth) || Number(canvas?.offsetWidth) || 900;
    const height = Number(canvas?.dataset?.worldSpineCanvasHeight) || Number(canvas?.offsetHeight) || 520;
    const frameSize = resolveWorldSpineTimelineZoomFrameSize(width, height, timelineZoom);

    scroll.dataset.worldSpineTimelineZoom = String(timelineZoom);
    root?.style.setProperty("--world-spine-timeline-zoom", String(timelineZoom));
    if (frame instanceof HTMLElement) {
      frame.style.width = `${frameSize.width}px`;
      frame.style.height = `${frameSize.height}px`;
    }
    if (unplacedTrackFrame instanceof HTMLElement) {
      unplacedTrackFrame.style.width = `${frameSize.width}px`;
    }

    return timelineZoom;
  }

  function applyTimelineZoomFromWheel(scroll, event) {
    const previousZoom = getTimelineZoom();
    const wheelDelta = Number(event?.deltaY) || Number(event?.deltaX) || 0;
    const nextZoom = resolveWorldSpineTimelineZoomFromWheel(previousZoom, wheelDelta);
    if (nextZoom === previousZoom) {
      return false;
    }

    const rect = scroll.getBoundingClientRect();
    const pointerX = Number.isFinite(event.clientX)
      ? clamp(event.clientX - rect.left, 0, rect.width || scroll.clientWidth)
      : (scroll.clientWidth / 2);
    const pointerY = Number.isFinite(event.clientY)
      ? clamp(event.clientY - rect.top, 0, rect.height || scroll.clientHeight)
      : (scroll.clientHeight / 2);
    const modelX = (scroll.scrollLeft + pointerX) / previousZoom;
    const modelY = (scroll.scrollTop + pointerY) / previousZoom;
    const previousScrollLeft = scroll.scrollLeft;
    const previousScrollTop = scroll.scrollTop;

    applyTimelineZoomValue(nextZoom);
    scroll.scrollLeft = clamp(
      (modelX * nextZoom) - pointerX,
      0,
      Math.max(0, scroll.scrollWidth - scroll.clientWidth),
    );
    scroll.scrollTop = clamp(
      (modelY * nextZoom) - pointerY,
      0,
      Math.max(0, scroll.scrollHeight - scroll.clientHeight),
    );
    onTimelineScroll(scroll.scrollLeft);
    onTimelineZoom({
      previousZoom,
      nextZoom,
      previousScrollLeft,
      previousScrollTop,
      nextScrollLeft: scroll.scrollLeft,
      nextScrollTop: scroll.scrollTop,
    });
    syncLocationRowHeaderOffset(scroll);
    syncUnplacedDockTrackOffset(scroll);
    syncChapterAnchorToTimelineViewport();
    syncImplicationConnectionsToEventBlocks();
    updateCardPosition();
    return true;
  }

  function getViewport() {
    return getRoot()?.querySelector("[data-world-spine-timeline-viewport]") ?? null;
  }

  function getChapterAnchor() {
    return getRoot()?.querySelector("[data-world-spine-chapter-anchor]") ?? null;
  }

  function getCard() {
    return getRoot()?.querySelector("[data-world-spine-detail-card]") ?? null;
  }

  function getImplicationComposer() {
    return getRoot()?.querySelector(WORLD_SPINE_IMPLICATION_COMPOSER_SELECTOR) ?? null;
  }

  function getNodeElement(nodeId = activeNodeId) {
    const root = getRoot();
    if (!root || !nodeId) {
      return null;
    }

    return root.querySelector(`[data-world-spine-node-id="${cssEscape(nodeId)}"].world-spine-node`);
  }

  // Intent: keep the fixed corner chapter label aligned with the visible timeline viewport.
  function syncChapterAnchorToTimelineViewport() {
    const anchorElement = getChapterAnchor();
    const scroll = getTimelineScroll();
    if (!(anchorElement instanceof HTMLElement) || !(scroll instanceof HTMLElement)) {
      return;
    }

    const anchor = resolveWorldSpineViewportChapterAnchor({
      nodes: getModel()?.timeline?.primaryNodes ?? [],
      scrollLeft: scroll.scrollLeft / getTimelineZoom(),
      viewportWidth: scroll.clientWidth / getTimelineZoom(),
    });
    updateWorldSpineChapterAnchorElement(anchorElement, anchor);
  }

  // Intent: make location row labels and artwork behave like sticky row headers inside the transformed canvas.
  function syncLocationRowHeaderOffset(scroll = getTimelineScroll()) {
    if (!(scroll instanceof HTMLElement)) {
      return;
    }

    const zoom = getTimelineZoom();
    const modelScrollLeft = zoom > 0 ? scroll.scrollLeft / zoom : scroll.scrollLeft;
    scroll.style.setProperty("--world-spine-location-row-sticky-x", `${round(modelScrollLeft)}px`);
  }

  // Intent: keep the fixed dock's chronological card track aligned to the single timeline scrollbar.
  function syncUnplacedDockTrackOffset(scroll = getTimelineScroll()) {
    if (!(scroll instanceof HTMLElement)) {
      return;
    }

    getRoot()?.style.setProperty("--world-spine-timeline-scroll-left", `${round(scroll.scrollLeft)}px`);
  }

  // Intent: align saved implication paths to the actual rendered event-block buttons after browser layout.
  function syncImplicationConnectionsToEventBlocks() {
    const root = getRoot();
    const svg = root?.querySelector("[data-world-spine-implication-connections]");
    if (!(root instanceof HTMLElement) || !(svg instanceof SVGElement)) {
      return;
    }

    const groups = [...svg.querySelectorAll("[data-world-spine-connection-kind=\"implication\"]")];
    groups.forEach((group, index) => {
      const path = group.querySelector("[data-world-spine-connection-path]");
      if (!(path instanceof SVGPathElement)) {
        return;
      }

      const fromNode = resolveImplicationEventBlockElement(group.getAttribute("data-world-spine-render-from-node-id"));
      const toNode = resolveImplicationEventBlockElement(group.getAttribute("data-world-spine-render-to-node-id"));
      if (!(fromNode instanceof HTMLElement) || !(toNode instanceof HTMLElement)) {
        return;
      }

      const fromSide = group.getAttribute("data-world-spine-from-handle-side") || "right";
      const toSide = group.getAttribute("data-world-spine-to-handle-side") || "left";
      const fromPoint = resolveRenderedNodeHandlePoint(fromNode, fromSide);
      const toPoint = resolveRenderedNodeHandlePoint(toNode, toSide);
      const route = resolveRenderedImplicationSplineRoute(fromNode, toNode, index, {
        preferredDirection: group.getAttribute("data-world-spine-route-direction"),
      });
      const labelPoint = resolveImplicationLabelPoint(fromPoint, toPoint, route);
      const label = group.querySelector("[data-world-spine-connection-label]");

      path.setAttribute("d", createNodeGraphCurvePath(fromPoint.x, fromPoint.y, toPoint.x, toPoint.y, {
        ...route,
      }));
      group.setAttribute("data-world-spine-from-x", String(round(fromPoint.x)));
      group.setAttribute("data-world-spine-from-y", String(round(fromPoint.y)));
      group.setAttribute("data-world-spine-to-x", String(round(toPoint.x)));
      group.setAttribute("data-world-spine-to-y", String(round(toPoint.y)));
      group.setAttribute("data-world-spine-route-direction", route.routeDirection || "inline");
      group.setAttribute("data-world-spine-obstacle-count", String(route.obstacleCount || 0));
      if (Number.isFinite(route.routeY)) {
        group.setAttribute("data-world-spine-route-y", String(round(route.routeY)));
      } else {
        group.removeAttribute("data-world-spine-route-y");
      }

      if (label instanceof SVGTextElement) {
        label.setAttribute("x", String(round(labelPoint.x)));
        label.setAttribute("y", String(round(labelPoint.y)));
      }

    });
  }

  // Intent: make DOM-side implication alignment use event blocks, not child/reference node rows.
  function resolveImplicationEventBlockElement(nodeId) {
    const node = getNodeElement(normalizeString(nodeId));
    if (!(node instanceof HTMLElement)) {
      return null;
    }

    if (node.dataset.worldSpineNodeLevel === "primary") {
      return node;
    }

    const parentNode = getNodeElement(node.dataset.worldSpineParentNodeId || "");
    if (parentNode instanceof HTMLElement && parentNode.dataset.worldSpineNodeLevel === "primary") {
      return parentNode;
    }

    const sceneNode = normalizeString(node.dataset.worldSpineSceneId)
      ? getNodeElement(`scene:${normalizeString(node.dataset.worldSpineSceneId)}`)
      : null;
    if (sceneNode instanceof HTMLElement && sceneNode.dataset.worldSpineNodeLevel === "primary") {
      return sceneNode;
    }

    return findNearestPrimaryNodeElement(node);
  }

  // Intent: recover visual event-block ownership for older saved endpoints with incomplete node metadata.
  function findNearestPrimaryNodeElement(node) {
    const root = getRoot();
    const primaryNodes = root
      ? [...root.querySelectorAll("[data-world-spine-node-level=\"primary\"].world-spine-node")]
      : [];
    if (!(node instanceof HTMLElement) || !primaryNodes.length) {
      return null;
    }

    const nodeCenterX = node.offsetLeft + (node.offsetWidth / 2);
    return primaryNodes.reduce((nearest, candidate) => {
      const candidateCenterX = candidate.offsetLeft + (candidate.offsetWidth / 2);
      const nearestCenterX = nearest.offsetLeft + (nearest.offsetWidth / 2);
      return Math.abs(candidateCenterX - nodeCenterX) < Math.abs(nearestCenterX - nodeCenterX)
        ? candidate
        : nearest;
    }, primaryNodes[0]);
  }

  // Intent: derive handle coordinates from the rendered button box the author sees.
  function resolveRenderedNodeHandlePoint(node, side) {
    return {
      x: side === "right" ? node.offsetLeft + node.offsetWidth : node.offsetLeft,
      y: node.offsetTop + (node.offsetHeight / 2),
    };
  }

  // Intent: route browser-corrected saved links around intervening event blocks in the rendered node layer.
  function resolveRenderedImplicationSplineRoute(fromNode, toNode, index = 0, { preferredDirection = "" } = {}) {
    const root = getRoot();
    const routeNodes = root
      ? [...root.querySelectorAll("[data-world-spine-node-level=\"primary\"].world-spine-node")]
        .map(createRenderedRouteNodeBox)
        .filter(Boolean)
      : [];
    return resolveImplicationSplineRoute(
      createRenderedRouteNodeBox(fromNode),
      createRenderedRouteNodeBox(toNode),
      index,
      routeNodes,
      { preferredDirection },
    );
  }

  // Intent: expose rendered node boxes to the shared route planner without coupling it to DOM APIs.
  function createRenderedRouteNodeBox(node) {
    if (!(node instanceof HTMLElement)) {
      return null;
    }

    const id = node.dataset.worldSpineNodeId || node.dataset.nodeId || "";
    return {
      id,
      level: node.dataset.worldSpineNodeLevel || "",
      x: node.offsetLeft,
      y: node.offsetTop,
      width: node.offsetWidth,
      height: node.offsetHeight,
    };
  }

  function clearCloseTimer() {
    if (closeTimer === null) {
      return;
    }

    window.clearTimeout(closeTimer);
    closeTimer = null;
  }

  function openNode(nodeId) {
    const node = findWorldSpineNode(getModel(), nodeId);
    const overlay = getOverlay();
    if (!node || !overlay) {
      close();
      return;
    }

    clearCloseTimer();
    activeNodeId = node.id;
    overlay.innerHTML = renderWorldSpineDetailCardHTML(node);
    updateOpenNodeClass();
    updateCardPosition();
  }

  function close() {
    clearCloseTimer();
    activeNodeId = "";
    const overlay = getOverlay();
    if (overlay) {
      overlay.innerHTML = "";
    }
    updateOpenNodeClass();
  }

  function scheduleClose(relatedTarget = null) {
    clearCloseTimer();
    if (isInsideActiveDetailRegion(relatedTarget)) {
      return;
    }

    closeTimer = window.setTimeout(() => {
      closeTimer = null;
      close();
    }, closeDelayMs);
  }

  function isInsideActiveDetailRegion(target) {
    if (!(target instanceof Element) || !activeNodeId) {
      return false;
    }

    const node = getNodeElement(activeNodeId);
    const card = getCard();
    const composer = getImplicationComposer();
    return Boolean(
      (node && node.contains(target)) ||
      (card && card.contains(target)) ||
      (composer && composer.contains(target)),
    );
  }

  // Intent: treat a plain blank-canvas click as deselection while preserving node, link, and drop-zone actions.
  function isTimelineWhitespaceClick(event, target = null) {
    if (!(target instanceof Element)) {
      return false;
    }

    if (
      target.closest(
        "[data-world-spine-node-id].world-spine-node, [data-world-spine-detail-card], [data-world-spine-implication-composer], [data-world-spine-link-handle], [data-world-spine-context-menu], [data-world-spine-connection-kind], [data-world-spine-drop-zone], [data-world-spine-location-row-label]",
      )
    ) {
      return false;
    }

    const root = getRoot();
    const scroll = target.closest("[data-world-spine-timeline-scroll]");
    if (!(root instanceof HTMLElement) || !(scroll instanceof HTMLElement) || !root.contains(scroll)) {
      return false;
    }

    const canvas = scroll.querySelector(".world-spine-canvas");
    if (!(canvas instanceof HTMLElement)) {
      return false;
    }

    const canvasRect = canvas.getBoundingClientRect();
    return (
      event.clientX >= canvasRect.left &&
      event.clientX <= canvasRect.right &&
      event.clientY >= canvasRect.top &&
      event.clientY <= canvasRect.bottom
    );
  }

  function updateOpenNodeClass() {
    const root = getRoot();
    if (!root) {
      return;
    }

    root.querySelectorAll(".world-spine-node.is-card-open").forEach((element) => {
      element.classList.remove("is-card-open");
    });

    const node = getNodeElement(activeNodeId);
    if (node) {
      node.classList.add("is-card-open");
    }
  }

  function updateCardPosition() {
    if (!activeNodeId) {
      return;
    }

    const viewport = getViewport();
    const node = getNodeElement(activeNodeId);
    const card = getCard();
    if (!(viewport instanceof HTMLElement) || !(node instanceof HTMLElement) || !(card instanceof HTMLElement)) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    if (
      nodeRect.right <= viewportRect.left ||
      nodeRect.left >= viewportRect.right ||
      nodeRect.bottom <= viewportRect.top ||
      nodeRect.top >= viewportRect.bottom
    ) {
      close();
      return;
    }

    const cardRect = card.getBoundingClientRect();
    const placement = calculateWorldSpineDetailCardPlacement({
      viewportRect,
      nodeRect,
      cardSize: {
        width: cardRect.width || 248,
        height: cardRect.height || 300,
      },
    });
    card.style.left = `${placement.left}px`;
    card.style.top = `${placement.top}px`;
    card.style.width = `${placement.width}px`;
    card.style.maxHeight = `${placement.maxHeight}px`;
    card.dataset.side = placement.side;
  }

  function handlePointerOver(event) {
    const target = event.target instanceof Element ? event.target : null;
    const card = target?.closest("[data-world-spine-detail-card]");
    if (card) {
      clearCloseTimer();
    }
  }

  function handlePointerOut(event) {
    if (linkSession || nodeBlockDragSession?.started) {
      return;
    }

    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("[data-world-spine-node-id].world-spine-node, [data-world-spine-detail-card]")) {
      return;
    }

    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    scheduleClose(related);
  }

  function handleFocusIn(event) {
    if (linkSession || nodeBlockDragSession?.started) {
      return;
    }

    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[data-world-spine-detail-card]")) {
      clearCloseTimer();
      return;
    }

    const node = target?.closest("[data-world-spine-node-id].world-spine-node");
    if (node instanceof HTMLElement) {
      openNode(node.dataset.worldSpineNodeId || node.dataset.nodeId || "");
    }
  }

  function handleFocusOut(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("[data-world-spine-node-id].world-spine-node, [data-world-spine-detail-card]")) {
      return;
    }

    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    scheduleClose(related);
  }

  function handleClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (suppressNextClick) {
      suppressNextClick = false;
      if (shouldConsumeWorldSpineSuppressedClick(target)) {
        event.preventDefault();
        return true;
      }
    }

    if (isInsideActiveDetailRegion(target)) {
      return false;
    }

    const implicationConnection = target?.closest("[data-world-spine-connection-kind=\"implication\"]");
    if (implicationConnection instanceof SVGElement) {
      event.preventDefault();
      close();
      onImplicationNavigate({
        edgeId: implicationConnection.getAttribute("data-world-spine-connection-id") || "",
        fromNodeId: implicationConnection.getAttribute("data-world-spine-from-node-id") || "",
        toNodeId: implicationConnection.getAttribute("data-world-spine-to-node-id") || "",
      });
      return true;
    }

    if (isTimelineWhitespaceClick(event, target)) {
      close();
      onSelectionClear();
      return true;
    }

    if (!activeNodeId) {
      return false;
    }

    close();
    return false;
  }

  function handleContextMenu(event) {
    const target = event.target instanceof Element ? event.target : null;
    const root = getRoot();
    const scroll = target?.closest("[data-world-spine-timeline-scroll]");
    if (!(root instanceof HTMLElement) || !(scroll instanceof HTMLElement) || !root.contains(scroll)) {
      return false;
    }

    const implicationConnection = target?.closest("[data-world-spine-connection-kind=\"implication\"]");
    if (implicationConnection instanceof SVGElement) {
      const viewport = getViewport();
      const viewportRect = viewport instanceof HTMLElement
        ? viewport.getBoundingClientRect()
        : { left: 0, top: 0 };
      event.preventDefault();
      close();
      onImplicationContextMenu({
        menuType: "implication",
        x: event.clientX,
        y: event.clientY,
        composerX: Math.max(0, Math.round(event.clientX - viewportRect.left)),
        composerY: Math.max(0, Math.round(event.clientY - viewportRect.top)),
        edgeId: implicationConnection.getAttribute("data-world-spine-connection-id") || "",
        label: implicationConnection.getAttribute("data-world-spine-connection-label-text") || "",
        fromNodeId: implicationConnection.getAttribute("data-world-spine-from-node-id") || "",
        toNodeId: implicationConnection.getAttribute("data-world-spine-to-node-id") || "",
      });
      return true;
    }

    const eventNodeElement = target?.closest("[data-world-spine-node-id].world-spine-node");
    if (eventNodeElement instanceof HTMLElement) {
      const nodeId = eventNodeElement.dataset.worldSpineNodeId || eventNodeElement.dataset.nodeId || "";
      const node = findWorldSpineNode(getModel(), nodeId);
      if (!isWorldSpineAssignableEventNode(node)) {
        return false;
      }

      event.preventDefault();
      close();
      onEventContextMenu({
        menuType: "event",
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        nodeTitle: node.title,
        nodeTypeLabel: node.typeLabel,
        nodeKind: node.kind,
      });
      return true;
    }

    if (
      target?.closest(
        "[data-world-spine-node-id].world-spine-node, [data-world-spine-detail-card], [data-world-spine-implication-composer], [data-world-spine-link-handle]",
      )
    ) {
      return false;
    }

    const canvas = scroll.querySelector(".world-spine-canvas");
    if (!(canvas instanceof HTMLElement)) {
      return false;
    }

    const canvasRect = canvas.getBoundingClientRect();
    if (
      event.clientX < canvasRect.left ||
      event.clientX > canvasRect.right ||
      event.clientY < canvasRect.top ||
      event.clientY > canvasRect.bottom
    ) {
      return false;
    }

    event.preventDefault();
    close();
    // Intent: convert from the transformed canvas pixels back into stable timeline model coordinates.
    const zoom = getTimelineZoom();
    onWhitespaceContextMenu(resolveWorldSpineWhitespaceContextFromPoint({
      timeline: getModel()?.timeline ?? {},
      canvasX: (event.clientX - canvasRect.left) / zoom,
      canvasY: (event.clientY - canvasRect.top) / zoom,
      clientX: event.clientX,
      clientY: event.clientY,
    }));
    return true;
  }

  function handleKeyDown(event) {
    if (event.key === "Escape" && linkSession) {
      event.preventDefault();
      clearImplicationLinkSession();
      return;
    }

    if (event.key === "Escape" && activeNodeId) {
      event.preventDefault();
      close();
    }
  }

  function handleScroll(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.matches("[data-world-spine-timeline-scroll]")) {
      onTimelineScroll(target.scrollLeft);
      syncLocationRowHeaderOffset(target);
      syncUnplacedDockTrackOffset(target);
      syncChapterAnchorToTimelineViewport();
      updateCardPosition();
    }

    if (target.matches("[data-world-spine-manuscript-scroll]")) {
      onManuscriptScroll(target.scrollTop);
    }
  }

  function handleWheel(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[data-world-spine-detail-card], [data-world-spine-implication-composer]")) {
      if (event.ctrlKey) {
        event.preventDefault();
      }
      event.stopPropagation();
      return;
    }

    const shouldResolveTimelineFromRoot = (event.ctrlKey || event.shiftKey) && target?.closest("[data-world-spine-root]");
    const scroll = target?.closest("[data-world-spine-timeline-scroll]") ??
      (shouldResolveTimelineFromRoot ? getTimelineScroll() : null);
    if (!(scroll instanceof HTMLElement)) {
      return;
    }

    if (event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      if (linkSession || nodeBlockDragSession?.started || dragSession) {
        return;
      }
      applyTimelineZoomFromWheel(scroll, event);
      return;
    }

    const scrollPlan = resolveWorldSpineTimelineWheelScrollPlan(event);
    if (!scrollPlan.delta || scrollPlan.axis === "none") {
      return;
    }

    event.preventDefault();
    if (scrollPlan.axis === "vertical") {
      scroll.scrollTop += scrollPlan.delta;
    } else {
      scroll.scrollLeft += scrollPlan.delta;
      onTimelineScroll(scroll.scrollLeft);
    }
    syncLocationRowHeaderOffset(scroll);
    syncUnplacedDockTrackOffset(scroll);
    syncChapterAnchorToTimelineViewport();
    updateCardPosition();
  }

  function beginImplicationLink(handle, event) {
    if (event.button !== 0) {
      return false;
    }

    const node = handle.closest("[data-world-spine-node-id].world-spine-node");
    const viewport = getViewport();
    const sourceNodeId = node instanceof HTMLElement
      ? node.dataset.worldSpineNodeId || node.dataset.nodeId || ""
      : "";
    if (!(node instanceof HTMLElement) || !(viewport instanceof HTMLElement) || !findWorldSpineNode(getModel(), sourceNodeId)) {
      return false;
    }

    event.preventDefault();
    close();
    dragSession = null;
    linkSession = {
      pointerId: Number.isInteger(event.pointerId) ? event.pointerId : null,
      sourceNodeId,
      sourceNode: node,
      sourceSide: handle.dataset.worldSpineLinkHandle,
      targetNodeId: "",
      targetNode: null,
      viewport,
      preview: createImplicationLinkPreview(viewport),
    };
    getRoot()?.classList.add("is-linking-world-spine");
    node.classList.add("is-link-source");
    if (Number.isInteger(event.pointerId) && typeof handle.setPointerCapture === "function") {
      handle.setPointerCapture(event.pointerId);
    }
    updateImplicationLinkPreview(event);
    return true;
  }

  function createImplicationLinkPreview(viewport) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.setAttribute("class", "world-spine-link-preview");
    svg.setAttribute("aria-hidden", "true");
    path.setAttribute("class", "world-spine-link-preview__path");
    svg.append(path);
    viewport.append(svg);
    return { svg, path };
  }

  function updateImplicationLinkPreview(event) {
    if (!linkSession) {
      return;
    }

    const viewportRect = linkSession.viewport.getBoundingClientRect();
    const sourceRect = linkSession.sourceNode.getBoundingClientRect();
    const sourceCenterY = sourceRect.top + (sourceRect.height / 2);
    const sourceX = linkSession.sourceSide === "right"
      ? sourceRect.right - viewportRect.left
      : sourceRect.left - viewportRect.left;
    const sourceY = sourceCenterY - viewportRect.top;
    const targetX = event.clientX - viewportRect.left;
    const targetY = event.clientY - viewportRect.top;
    const curve = createNodeGraphCurvePath(sourceX, sourceY, targetX, targetY);
    linkSession.preview.svg.setAttribute("viewBox", `0 0 ${Math.max(1, viewportRect.width)} ${Math.max(1, viewportRect.height)}`);
    linkSession.preview.path.setAttribute("d", curve);

    updateImplicationTargetNode(event.clientX, event.clientY);
  }

  function updateImplicationTargetNode(clientX, clientY) {
    if (!linkSession) {
      return;
    }

    const targetNode = resolveNodeElementFromPoint(clientX, clientY);
    const targetNodeId = targetNode instanceof HTMLElement
      ? targetNode.dataset.worldSpineNodeId || targetNode.dataset.nodeId || ""
      : "";
    if (targetNodeId === linkSession.targetNodeId) {
      return;
    }

    if (linkSession.targetNode) {
      linkSession.targetNode.classList.remove("is-link-target");
    }

    const canTarget = targetNode instanceof HTMLElement &&
      targetNodeId &&
      targetNodeId !== linkSession.sourceNodeId &&
      findWorldSpineNode(getModel(), targetNodeId);
    linkSession.targetNode = canTarget ? targetNode : null;
    linkSession.targetNodeId = canTarget ? targetNodeId : "";
    if (linkSession.targetNode) {
      linkSession.targetNode.classList.add("is-link-target");
    }
  }

  function resolveNodeElementFromPoint(clientX, clientY) {
    const target = document.elementFromPoint(clientX, clientY);
    return target instanceof Element
      ? target.closest("[data-world-spine-node-id].world-spine-node")
      : null;
  }

  function finishImplicationLink(event) {
    if (!linkSession) {
      return false;
    }

    const pointerId = Number.isInteger(event?.pointerId) ? event.pointerId : null;
    if (linkSession.pointerId !== null && pointerId !== null && linkSession.pointerId !== pointerId) {
      return true;
    }

    if (event?.type === "pointercancel") {
      clearImplicationLinkSession();
      return true;
    }

    updateImplicationTargetNode(event.clientX, event.clientY);
    const session = linkSession;
    const targetNode = session.targetNode;
    const targetNodeId = session.targetNodeId;
    const placement = targetNode instanceof HTMLElement
      ? calculateWorldSpineImplicationComposerPlacement({
          viewportRect: session.viewport.getBoundingClientRect(),
          fromNodeRect: session.sourceNode.getBoundingClientRect(),
          toNodeRect: targetNode.getBoundingClientRect(),
        })
      : null;
    clearImplicationLinkSession();

    if (targetNodeId && targetNodeId !== session.sourceNodeId && placement) {
      suppressNextClick = true;
      onImplicationLinkDraft({
        fromNodeId: session.sourceNodeId,
        toNodeId: targetNodeId,
        x: placement.left,
        y: placement.top,
        width: placement.width,
      });
    }
    return true;
  }

  function clearImplicationLinkSession() {
    if (!linkSession) {
      return;
    }

    linkSession.sourceNode?.classList.remove("is-link-source");
    linkSession.targetNode?.classList.remove("is-link-target");
    linkSession.preview?.svg?.remove();
    getRoot()?.classList.remove("is-linking-world-spine");
    linkSession = null;
  }

  function beginNodeBlockDrag(node, event) {
    if (event.button !== 0) {
      return false;
    }

    const nodeId = node.dataset.worldSpineNodeId || node.dataset.nodeId || "";
    const model = getModel();
    const modelNode = findWorldSpineNode(model, nodeId);
    const viewport = getViewport();
    if (!(viewport instanceof HTMLElement) || !modelNode) {
      return false;
    }

    const rect = node.getBoundingClientRect();
    nodeBlockDragSession = {
      pointerId: Number.isInteger(event.pointerId) ? event.pointerId : null,
      nodeId,
      sourceSceneId: normalizeString(modelNode.sceneId),
      canReorderScene: isWorldSpineSceneReorderNode(modelNode),
      node,
      viewport,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      started: false,
      ghost: null,
      dropTarget: null,
    };
    if (Number.isInteger(event.pointerId) && typeof node.setPointerCapture === "function") {
      node.setPointerCapture(event.pointerId);
    }
    return true;
  }

  function updateNodeBlockDragPreview(event) {
    if (!nodeBlockDragSession) {
      return false;
    }

    const pointerId = Number.isInteger(event.pointerId) ? event.pointerId : null;
    if (nodeBlockDragSession.pointerId !== null && pointerId !== null && nodeBlockDragSession.pointerId !== pointerId) {
      return true;
    }

    const distance = Math.hypot(event.clientX - nodeBlockDragSession.startX, event.clientY - nodeBlockDragSession.startY);
    if (!nodeBlockDragSession.started && distance < NODE_BLOCK_DRAG_PREVIEW_THRESHOLD_PX) {
      return true;
    }

    event.preventDefault();
    if (!nodeBlockDragSession.started) {
      startNodeBlockDragPreview();
    }

    moveNodeBlockDragPreview(event);
    updateNodeBlockDropPreview(event);
    return true;
  }

  function startNodeBlockDragPreview() {
    if (!nodeBlockDragSession) {
      return;
    }

    close();
    const ghost = nodeBlockDragSession.node.cloneNode(true);
    if (!(ghost instanceof HTMLElement)) {
      return;
    }

    // The block ghost is for event placement feedback; connector dots remain implication-only controls.
    ghost.querySelectorAll("[data-world-spine-link-handle]").forEach((handle) => handle.remove());
    ghost.classList.add("world-spine-node-drag-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.setAttribute("role", "presentation");
    ghost.removeAttribute("id");
    ghost.removeAttribute("tabindex");
    ghost.removeAttribute("data-action");
    ghost.style.width = `${round(nodeBlockDragSession.width)}px`;
    ghost.style.height = `${round(nodeBlockDragSession.height)}px`;
    nodeBlockDragSession.viewport.append(ghost);
    nodeBlockDragSession.ghost = ghost;
    nodeBlockDragSession.started = true;
    nodeBlockDragSession.node.classList.add("is-node-drag-source");
    getRoot()?.classList.add("is-dragging-world-spine-node");
    if (nodeBlockDragSession.canReorderScene) {
      getRoot()?.classList.add("is-reordering-world-spine-scene");
    }
  }

  function moveNodeBlockDragPreview(event) {
    if (!nodeBlockDragSession?.ghost) {
      return;
    }

    const viewportRect = nodeBlockDragSession.viewport.getBoundingClientRect();
    const maxLeft = Math.max(8, viewportRect.width - nodeBlockDragSession.width - 8);
    const maxTop = Math.max(8, viewportRect.height - nodeBlockDragSession.height - 8);
    const left = clamp(event.clientX - viewportRect.left - nodeBlockDragSession.offsetX, 8, maxLeft);
    const top = clamp(event.clientY - viewportRect.top - nodeBlockDragSession.offsetY, 8, maxTop);
    nodeBlockDragSession.ghost.style.left = `${round(left)}px`;
    nodeBlockDragSession.ghost.style.top = `${round(top)}px`;
  }

  function finishNodeBlockDrag(event) {
    if (!nodeBlockDragSession) {
      return false;
    }

    const pointerId = Number.isInteger(event?.pointerId) ? event.pointerId : null;
    if (nodeBlockDragSession.pointerId !== null && pointerId !== null && nodeBlockDragSession.pointerId !== pointerId) {
      return true;
    }

    if (nodeBlockDragSession.started) {
      event?.preventDefault?.();
      commitNodeBlockReorderDrop(event);
      suppressNextClick = true;
    }
    clearNodeBlockDragSession();
    return true;
  }

  function commitNodeBlockReorderDrop(event) {
    if (!nodeBlockDragSession?.canReorderScene) {
      return false;
    }

    const dropTarget = nodeBlockDragSession.dropTarget ?? resolveNodeBlockDropTarget(event);
    const locationDropTarget = resolveNodeBlockLocationRowDropTarget(event);
    if (!dropTarget && !locationDropTarget) {
      return false;
    }

    return onSceneNodeReorder({
      sourceNodeId: nodeBlockDragSession.nodeId,
      sourceSceneId: nodeBlockDragSession.sourceSceneId,
      targetNodeId: dropTarget?.nodeId ?? "",
      targetSceneId: dropTarget?.sceneId ?? "",
      placement: dropTarget?.type ?? "location-row",
      dropTarget: {
        ...(dropTarget ?? { type: "location-row" }),
        ...(locationDropTarget ?? {}),
      },
    }) === true;
  }

  function updateNodeBlockDropPreview(event) {
    if (!nodeBlockDragSession?.started || !nodeBlockDragSession.canReorderScene) {
      return;
    }

    const dropTarget = resolveNodeBlockDropTarget(event);
    clearNodeBlockDropPreview();
    nodeBlockDragSession.dropTarget = dropTarget;
    const targetElement = dropTarget ? getNodeElement(dropTarget.nodeId) : null;
    if (!(targetElement instanceof HTMLElement)) {
      return;
    }

    targetElement.classList.add(dropTarget.type === "after" ? "is-reorder-drop-after" : "is-reorder-drop-before");
  }

  function resolveNodeBlockDropTarget(event) {
    if (!nodeBlockDragSession?.canReorderScene) {
      return null;
    }

    const viewport = getViewport();
    if (!(viewport instanceof HTMLElement)) {
      return null;
    }

    const pointerX = Number(event?.clientX);
    const pointerY = Number(event?.clientY);
    if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
      return null;
    }

    const viewportRect = viewport.getBoundingClientRect();
    if (
      pointerX < viewportRect.left ||
      pointerX > viewportRect.right ||
      pointerY < viewportRect.top ||
      pointerY > viewportRect.bottom
    ) {
      return null;
    }

    return resolveWorldSpineSceneReorderDropTarget({
      sourceNodeId: nodeBlockDragSession.nodeId,
      targetNodeId: resolveNodeBlockReorderTargetNodeId(pointerX, pointerY),
      pointerX,
      nodes: createRenderedSceneReorderNodes(),
    });
  }

  // Intent: when a scene card is dragged vertically, resolve the target row so the shell can persist location.
  function resolveNodeBlockLocationRowDropTarget(event) {
    const scroll = getTimelineScroll();
    const canvas = scroll instanceof HTMLElement
      ? scroll.querySelector(".world-spine-canvas")
      : null;
    if (!(canvas instanceof HTMLElement)) {
      return null;
    }

    const pointerX = Number(event?.clientX);
    const pointerY = Number(event?.clientY);
    if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
      return null;
    }

    const canvasRect = canvas.getBoundingClientRect();
    if (
      pointerX < canvasRect.left ||
      pointerX > canvasRect.right ||
      pointerY < canvasRect.top ||
      pointerY > canvasRect.bottom
    ) {
      return null;
    }

    const zoom = getTimelineZoom();
    const canvasY = (pointerY - canvasRect.top) / zoom;
    const row = resolveTimelineLocationRowForCanvasY(getModel()?.timeline?.locationRows ?? [], canvasY);
    if (!row) {
      return null;
    }

    const locationLabel = normalizeLocationLabel(row.locationLabel);
    if (normalizeLocationKey(locationLabel) === normalizeLocationKey(DEFAULT_LOCATION_LABEL)) {
      return null;
    }

    return {
      locationLabel,
      locationKey: resolveLocationRowKey(locationLabel, row.locationKey),
      locationRowIndex: Number.isFinite(Number(row.locationRowIndex)) ? Number(row.locationRowIndex) : 0,
      spineId: normalizeString(row.spineId),
      spineLabel: normalizeString(row.spineLabel),
      tierIndex: Number.isFinite(Number(row.tierIndex)) ? Number(row.tierIndex) : 0,
    };
  }

  function resolveNodeBlockReorderTargetNodeId(pointerX, pointerY) {
    if (typeof document === "undefined" || typeof document.elementFromPoint !== "function") {
      return "";
    }

    const target = document.elementFromPoint(pointerX, pointerY);
    const node = target instanceof Element
      ? target.closest("[data-world-spine-node-id].world-spine-node")
      : null;
    return node instanceof HTMLElement
      ? node.dataset.worldSpineNodeId || node.dataset.nodeId || ""
      : "";
  }

  function createRenderedSceneReorderNodes() {
    const root = getRoot();
    const modelNodesById = new Map(
      (getModel()?.timeline?.nodes ?? [])
        .filter((node) => node?.id)
        .map((node) => [node.id, node]),
    );
    const nodeElements = root
      ? [...root.querySelectorAll("[data-world-spine-node-id].world-spine-node")]
      : [];

    return nodeElements
      .map((element) => {
        if (!(element instanceof HTMLElement)) {
          return null;
        }

        const nodeId = element.dataset.worldSpineNodeId || element.dataset.nodeId || "";
        const modelNode = modelNodesById.get(nodeId) ?? {};
        const rect = element.getBoundingClientRect();
        return {
          ...modelNode,
          id: normalizeString(modelNode.id) || nodeId,
          level: normalizeString(modelNode.level) || normalizeString(element.dataset.worldSpineNodeLevel),
          kind: normalizeString(modelNode.kind) || normalizeString(element.dataset.worldSpineNodeKind),
          sceneId: normalizeString(modelNode.sceneId) || normalizeString(element.dataset.worldSpineSceneId),
          chapterId: normalizeString(modelNode.chapterId),
          chapterTitle: normalizeString(modelNode.chapterTitle),
          left: rect.left,
          width: rect.width,
          centerX: rect.left + (rect.width / 2),
        };
      })
      .filter(Boolean);
  }

  function clearNodeBlockDropPreview() {
    getRoot()
      ?.querySelectorAll(".world-spine-node.is-reorder-drop-before, .world-spine-node.is-reorder-drop-after")
      .forEach((element) => {
        element.classList.remove("is-reorder-drop-before", "is-reorder-drop-after");
      });

    if (nodeBlockDragSession) {
      nodeBlockDragSession.dropTarget = null;
    }
  }

  function clearNodeBlockDragSession() {
    if (!nodeBlockDragSession) {
      return;
    }

    clearNodeBlockDropPreview();
    nodeBlockDragSession.ghost?.remove();
    nodeBlockDragSession.node?.classList.remove("is-node-drag-source");
    getRoot()?.classList.remove("is-dragging-world-spine-node", "is-reordering-world-spine-scene");
    nodeBlockDragSession = null;
  }

  function handlePointerDown(event) {
    const target = event.target instanceof Element ? event.target : null;
    const linkHandle = target?.closest("[data-world-spine-link-handle]");
    if (linkHandle instanceof HTMLElement && beginImplicationLink(linkHandle, event)) {
      return;
    }

    const timelineNode = target?.closest("[data-world-spine-node-id].world-spine-node");
    if (timelineNode instanceof HTMLElement && beginNodeBlockDrag(timelineNode, event)) {
      return;
    }

    const scroll = target?.closest("[data-world-spine-timeline-scroll]");
    if (
      !(scroll instanceof HTMLElement) ||
      event.button !== 0 ||
      target?.closest("button, a, input, textarea, select, [data-world-spine-detail-card], [data-world-spine-location-row-label]")
    ) {
      dragSession = null;
      return;
    }

    dragSession = {
      pointerId: Number.isInteger(event.pointerId) ? event.pointerId : null,
      startX: event.clientX,
      startScrollLeft: scroll.scrollLeft,
      scroll,
    };
    scroll.classList.add("is-dragging");
  }

  function handlePointerMove(event) {
    if (linkSession) {
      event.preventDefault();
      updateImplicationLinkPreview(event);
      return;
    }

    if (nodeBlockDragSession && updateNodeBlockDragPreview(event)) {
      return;
    }

    if (!dragSession) {
      return;
    }

    const pointerId = Number.isInteger(event.pointerId) ? event.pointerId : null;
    if (dragSession.pointerId !== null && pointerId !== null && dragSession.pointerId !== pointerId) {
      return;
    }

    event.preventDefault();
    dragSession.scroll.scrollLeft = dragSession.startScrollLeft - (event.clientX - dragSession.startX);
    syncChapterAnchorToTimelineViewport();
    updateCardPosition();
  }

  function handlePointerEnd(event) {
    if (linkSession && finishImplicationLink(event)) {
      return;
    }

    if (nodeBlockDragSession && finishNodeBlockDrag(event)) {
      return;
    }

    if (!dragSession) {
      return;
    }

    const pointerId = Number.isInteger(event?.pointerId) ? event.pointerId : null;
    if (dragSession.pointerId !== null && pointerId !== null && dragSession.pointerId !== pointerId) {
      return;
    }

    dragSession.scroll.classList.remove("is-dragging");
    dragSession = null;
  }

  function syncAfterRender() {
    applyTimelineZoomValue(timelineZoom);
    syncLocationRowHeaderOffset();
    syncUnplacedDockTrackOffset();
    syncChapterAnchorToTimelineViewport();
    syncImplicationConnectionsToEventBlocks();

    if (!activeNodeId) {
      return;
    }

    openNode(activeNodeId);
  }

  function scrollNodeIntoView(nodeId, { behavior = "smooth" } = {}) {
    const node = getNodeElement(nodeId);
    const scroll = getTimelineScroll();
    if (!(node instanceof HTMLElement) || !(scroll instanceof HTMLElement)) {
      return false;
    }

    const zoom = getTimelineZoom();
    const targetLeft = (node.offsetLeft * zoom) - Math.max(24, (scroll.clientWidth / 2) - ((node.offsetWidth * zoom) / 2));
    const targetTop = (node.offsetTop * zoom) - Math.max(24, (scroll.clientHeight / 2) - ((node.offsetHeight * zoom) / 2));
    scroll.scrollTo({
      left: Math.max(0, targetLeft),
      top: Math.max(0, targetTop),
      behavior,
    });
    return true;
  }

  function scrollLocationIntoView(locationKey, { behavior = "smooth" } = {}) {
    const normalizedLocationKey = normalizeLocationKey(locationKey);
    const root = getRoot();
    const scroll = getTimelineScroll();
    if (!(root instanceof HTMLElement) || !(scroll instanceof HTMLElement) || !normalizedLocationKey) {
      return false;
    }

    const locationTarget =
      root.querySelector(`.world-spine-node[data-world-spine-location-key="${cssEscape(normalizedLocationKey)}"].is-filter-target`) ??
      root.querySelector(`.world-spine-node[data-world-spine-location-key="${cssEscape(normalizedLocationKey)}"]`) ??
      root.querySelector(`[data-world-spine-location-row-label][data-world-spine-location-key="${cssEscape(normalizedLocationKey)}"]`);
    if (!(locationTarget instanceof HTMLElement)) {
      return false;
    }

    const zoom = getTimelineZoom();
    const targetLeft = (locationTarget.offsetLeft * zoom) - Math.max(24, (scroll.clientWidth / 2) - ((locationTarget.offsetWidth * zoom) / 2));
    const targetTop = (locationTarget.offsetTop * zoom) - Math.max(24, (scroll.clientHeight / 2) - ((locationTarget.offsetHeight * zoom) / 2));
    scroll.scrollTo({
      left: Math.max(0, targetLeft),
      top: Math.max(0, targetTop),
      behavior,
    });
    syncChapterAnchorToTimelineViewport();
    return true;
  }

  function scrollPassageIntoView(blockId, { behavior = "smooth" } = {}) {
    const root = getRoot();
    const block = root?.querySelector(`[data-world-spine-manuscript-block-id="${cssEscape(blockId)}"]`);
    if (!(block instanceof HTMLElement)) {
      return false;
    }

    block.scrollIntoView({ block: "center", behavior });
    block.classList.add("is-jump-highlight");
    window.setTimeout(() => {
      block.classList.remove("is-jump-highlight");
    }, 900);
    return true;
  }

  return {
    close,
    getTimelineZoom,
    setTimelineZoom: applyTimelineZoomValue,
    openNode,
    scheduleClose,
    syncAfterRender,
    scrollNodeIntoView,
    scrollLocationIntoView,
    scrollPassageIntoView,
    handlePointerOver,
    handlePointerOut,
    handleFocusIn,
    handleFocusOut,
    handleClick,
    handleContextMenu,
    handleKeyDown,
    handleScroll,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
  };
}

// Intent: share the event-context eligibility rule between the panel controller, shell validation, and tests.
export function isWorldSpineAssignableEventNode(node) {
  const kind = normalizeString(node?.kind).toLowerCase();
  const typeLabel = normalizeString(node?.typeLabel).toLowerCase();
  return WORLD_SPINE_ASSIGNABLE_EVENT_NODE_KINDS.has(kind) || typeLabel.includes("event");
}

// Intent: render the fixed event-pane chapter anchor without making it part of the scrollable canvas.
function renderWorldSpineChapterAnchorHTML(anchor) {
  const normalizedAnchor = anchor && typeof anchor === "object" ? anchor : null;
  return `
    <div
      class="world-spine-chapter-anchor ${normalizedAnchor ? "" : "is-empty"}"
      data-world-spine-chapter-anchor
      data-world-spine-anchor-node-id="${escapeHtml(normalizedAnchor?.nodeId || "")}"
      data-world-spine-anchor-scene-id="${escapeHtml(normalizedAnchor?.sceneId || "")}"
      aria-live="polite"
      ${normalizedAnchor ? "" : "hidden"}
    >
      ${renderWorldSpineChapterAnchorBodyHTML(normalizedAnchor)}
    </div>
  `;
}

function renderWorldSpineChapterAnchorBodyHTML(anchor) {
  if (!anchor) {
    return "";
  }

  return `
    <span>Looking over</span>
    <strong>${escapeHtml(anchor.chapterTitle || "Untitled chapter")}</strong>
    <em>${escapeHtml(anchor.sceneTitle || "Untitled scene")}</em>
  `;
}

function updateWorldSpineChapterAnchorElement(element, anchor) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  if (!anchor) {
    element.hidden = true;
    element.classList.add("is-empty");
    element.dataset.worldSpineAnchorNodeId = "";
    element.dataset.worldSpineAnchorSceneId = "";
    element.innerHTML = "";
    return;
  }

  if (
    !element.hidden &&
    element.dataset.worldSpineAnchorNodeId === (anchor.nodeId || "") &&
    element.dataset.worldSpineAnchorSceneId === (anchor.sceneId || "")
  ) {
    return;
  }

  element.hidden = false;
  element.classList.remove("is-empty");
  element.dataset.worldSpineAnchorNodeId = anchor.nodeId || "";
  element.dataset.worldSpineAnchorSceneId = anchor.sceneId || "";
  element.innerHTML = renderWorldSpineChapterAnchorBodyHTML(anchor);
}

function renderEventRail(model) {
  const events = Array.isArray(model?.eventRail) ? model.eventRail : [];
  const railItems = Array.isArray(model?.eventRailItems) && model.eventRailItems.length
    ? model.eventRailItems
    : buildWorldSpineEventRailItems(events);
  return `
    <aside class="world-spine-event-rail" aria-label="Timeline events">
      <div class="world-spine-event-rail__heading">
        <p class="panel-kicker">Events</p>
        <h3>Story Timeline</h3>
      </div>
      <div class="world-spine-event-list">
        ${railItems.map(renderEventRailItem).join("")}
      </div>
    </aside>
  `;
}

// Intent: separate manuscript chapter boundaries from selectable timeline events in the fixed story rail.
function renderEventRailItem(item) {
  if (item?.type === "chapter") {
    return `
      <div
        class="world-spine-event-list__chapter"
        data-world-spine-rail-chapter-id="${escapeHtml(item.chapterId)}"
        aria-label="${escapeHtml(`Chapter boundary: ${item.title}`)}"
      >
        <strong>${escapeHtml(item.title)}</strong>
      </div>
    `;
  }

  const node = item?.node && typeof item.node === "object" ? item.node : item;
  const eventNumber = Number.isFinite(Number(item?.eventNumber)) ? Number(item.eventNumber) : 0;
  return `
    <button
      type="button"
      class="world-spine-event-list__item ${node.isSelected ? "is-selected" : ""}"
      data-action="select-node"
      data-node-id="${escapeHtml(node.id)}"
    >
      <span>${escapeHtml(String(eventNumber || 1).padStart(2, "0"))}</span>
      <strong>${escapeHtml(node.title)}</strong>
      <small>${escapeHtml(compactNodeMeta(node))}</small>
    </button>
  `;
}

function renderCompactManuscriptPane(model) {
  const scenes = Array.isArray(model?.manuscript?.scenes) ? model.manuscript.scenes : [];
  return `
    <aside class="world-spine-manuscript-pane world-spine-right-pane world-spine-right-pane--manuscript" aria-label="Compact manuscript">
      <div class="world-spine-manuscript-pane__heading">
        <div>
          <p class="panel-kicker">Manuscript</p>
          <h3>Linked Passages</h3>
        </div>
        ${renderWorldSpineRightPaneModeToggle(WORLD_SPINE_RIGHT_PANE_MODE_MANUSCRIPT)}
      </div>
      <div class="world-spine-manuscript-scroll" data-world-spine-manuscript-scroll tabindex="0">
        ${scenes.map((scene) => `
          <section class="world-spine-manuscript-scene" data-world-spine-manuscript-scene-id="${escapeHtml(scene.sceneId)}">
            <h4>${escapeHtml(scene.sceneTitle)}</h4>
            ${scene.blocks.map((block) => `
              <button
                type="button"
                class="world-spine-manuscript-block ${block.isSelected ? "is-selected" : ""}"
                data-action="select-line"
                data-line-id="${escapeHtml(block.blockId)}"
                data-world-spine-manuscript-block-id="${escapeHtml(block.blockId)}"
              >
                <span>${escapeHtml(block.lineLabel)}</span>
                <em>${escapeHtml(block.kindLabel)}</em>
                <strong>${escapeHtml(block.text)}</strong>
              </button>
            `).join("")}
          </section>
        `).join("")}
      </div>
    </aside>
  `;
}

function renderWorldSpineRightPane(model, {
  mode = WORLD_SPINE_RIGHT_PANE_MODE_MANUSCRIPT,
  relatedCards = null,
  relatedCardExpandedKey = "",
  sublocationComposer = null,
} = {}) {
  const normalizedMode = normalizeWorldSpineRightPaneMode(mode);
  if (normalizedMode === WORLD_SPINE_RIGHT_PANE_MODE_EVENT_SECTION) {
    return renderWorldSpineEventSectionPane(model);
  }

  if (normalizedMode === WORLD_SPINE_RIGHT_PANE_MODE_RELATED_CARDS) {
    return renderWorldSpineRelatedCardsPane(relatedCards, {
      expandedKey: relatedCardExpandedKey,
      sublocationComposer,
    });
  }

  return renderCompactManuscriptPane(model);
}

function renderWorldSpineRightPaneModeToggle(activeMode = WORLD_SPINE_RIGHT_PANE_MODE_MANUSCRIPT) {
  const normalizedActiveMode = normalizeWorldSpineRightPaneMode(activeMode);
  const modes = [
    { id: WORLD_SPINE_RIGHT_PANE_MODE_MANUSCRIPT, label: "Passages" },
    { id: WORLD_SPINE_RIGHT_PANE_MODE_EVENT_SECTION, label: "Section" },
    { id: WORLD_SPINE_RIGHT_PANE_MODE_RELATED_CARDS, label: "Cards" },
  ];

  return `
    <div class="world-spine-right-pane-toggle" aria-label="Right pane mode">
      ${modes.map((mode) => `
        <button
          type="button"
          class="world-spine-right-pane-toggle__button ${mode.id === normalizedActiveMode ? "is-active" : ""}"
          data-action="set-world-spine-right-pane-mode"
          data-world-spine-right-pane-mode="${escapeHtml(mode.id)}"
          aria-pressed="${mode.id === normalizedActiveMode ? "true" : "false"}"
        >${escapeHtml(mode.label)}</button>
      `).join("")}
    </div>
  `;
}

// Intent: render the selected event's anchored manuscript context as a focused RHS view.
function renderWorldSpineEventSectionPane(model) {
  const section = model?.eventManuscriptSection && typeof model.eventManuscriptSection === "object"
    ? model.eventManuscriptSection
    : createEmptyWorldSpineEventManuscriptSection();
  const hasBlocks = Array.isArray(section.blocks) && section.blocks.length > 0;
  return `
    <aside class="world-spine-manuscript-pane world-spine-right-pane world-spine-right-pane--event-section" aria-label="Selected event manuscript section">
      <div class="world-spine-manuscript-pane__heading world-spine-event-section-pane__heading">
        <div>
          <p class="panel-kicker">Manuscript</p>
          <h3>Event Section</h3>
          ${section.scopeLabel ? `<small>${escapeHtml(section.scopeLabel)}</small>` : ""}
        </div>
        ${renderWorldSpineRightPaneModeToggle(WORLD_SPINE_RIGHT_PANE_MODE_EVENT_SECTION)}
      </div>
      <div class="world-spine-event-section-scroll" data-world-spine-event-section-scroll tabindex="0">
        ${hasBlocks
          ? renderWorldSpineEventSection(section)
          : `<p class="world-spine-related-cards-empty">${escapeHtml(section.emptyReason || "Select a timeline event to view its manuscript section.")}</p>`}
      </div>
    </aside>
  `;
}

function renderWorldSpineEventSection(section = {}) {
  const blocks = Array.isArray(section.blocks) ? section.blocks : [];
  return `
    <section
      class="world-spine-event-section"
      data-world-spine-event-section-node-id="${escapeHtml(section.nodeId || "")}"
      data-world-spine-event-section-scene-id="${escapeHtml(section.sceneId || "")}"
      data-world-spine-event-section-block-id="${escapeHtml(section.blockId || "")}"
    >
      <div class="world-spine-event-section__meta">
        <span>${escapeHtml(section.chapterTitle || "Untitled chapter")}</span>
        <strong>${escapeHtml(section.sceneTitle || "Untitled scene")}</strong>
        ${section.location ? `<em>${escapeHtml(section.location)}</em>` : ""}
      </div>
      ${section.omittedBeforeCount ? `<p class="world-spine-event-section__omission">${escapeHtml(`${section.omittedBeforeCount} earlier line${section.omittedBeforeCount === 1 ? "" : "s"} omitted`)}</p>` : ""}
      <div class="world-spine-event-section__blocks">
        ${blocks.map((block) => renderWorldSpineEventSectionBlock(block)).join("")}
      </div>
      ${section.omittedAfterCount ? `<p class="world-spine-event-section__omission">${escapeHtml(`${section.omittedAfterCount} later line${section.omittedAfterCount === 1 ? "" : "s"} omitted`)}</p>` : ""}
    </section>
  `;
}

function renderWorldSpineEventSectionBlock(block = {}) {
  return `
    <button
      type="button"
      class="world-spine-event-section-block ${block.isAnchor ? "is-anchor" : ""}"
      data-action="select-line"
      data-line-id="${escapeHtml(block.blockId || "")}"
      data-world-spine-manuscript-block-id="${escapeHtml(block.blockId || "")}"
    >
      <span>${escapeHtml(block.lineLabel || "Draft")}</span>
      <em>${escapeHtml(block.kindLabel || "Narration")}</em>
      <strong>${escapeHtml(block.text || "Blank passage")}</strong>
    </button>
  `;
}

function renderWorldSpineRelatedCardsPane(relatedCards = null, {
  expandedKey = "",
  sublocationComposer = null,
} = {}) {
  const cardsModel = relatedCards && typeof relatedCards === "object"
    ? relatedCards
    : { hasScope: false, groups: [], totalItemCount: 0, scopeLabel: "" };
  const groups = Array.isArray(cardsModel.groups) ? cardsModel.groups : [];
  const hasCards = groups.some((group) => Array.isArray(group.items) && group.items.length > 0);

  return `
    <aside class="world-spine-manuscript-pane world-spine-right-pane world-spine-right-pane--related" aria-label="Related catalogue cards">
      <div class="world-spine-manuscript-pane__heading world-spine-related-cards-pane__heading">
        <div>
          <p class="panel-kicker">Catalogue</p>
          <h3>Related Cards</h3>
          ${cardsModel.scopeLabel ? `<small>${escapeHtml(cardsModel.scopeLabel)}</small>` : ""}
        </div>
        ${renderWorldSpineRightPaneModeToggle(WORLD_SPINE_RIGHT_PANE_MODE_RELATED_CARDS)}
      </div>
      <div class="world-spine-related-cards-scroll" data-world-spine-related-cards-scroll tabindex="0">
        ${cardsModel.hasScope
          ? hasCards
            ? groups.map((group) => renderWorldSpineRelatedCardGroup(group, { expandedKey, sublocationComposer })).join("")
            : `<p class="world-spine-related-cards-empty">No related catalogue cards yet.</p>`
          : `<p class="world-spine-related-cards-empty">Select a timeline event to view related catalogue cards.</p>`}
      </div>
    </aside>
  `;
}

function renderWorldSpineRelatedCardGroup(group = {}, {
  expandedKey = "",
  sublocationComposer = null,
} = {}) {
  const items = Array.isArray(group.items) ? group.items : [];
  if (!items.length) {
    return "";
  }
  const nodeId = normalizeString(group.nodeId);
  const canAddSublocation = group.canAddSublocation === true && nodeId;
  const normalizedComposer = normalizeWorldSpineSublocationComposer(sublocationComposer);
  const isSublocationFormOpen = canAddSublocation && normalizedComposer.nodeId === nodeId;

  return `
    <section class="world-spine-related-card-group">
      <div class="world-spine-related-card-group__heading">
        <h4>${escapeHtml(group.label || "Catalogue")}</h4>
        <div class="world-spine-related-card-group__actions">
          ${canAddSublocation ? `
            <button
              type="button"
              class="world-spine-related-card-group__add-button"
              data-action="open-world-spine-sublocation-composer"
              data-world-spine-node-id="${escapeHtml(nodeId)}"
              data-scene-id="${escapeHtml(group.sceneId || "")}"
              data-world-spine-location-label="${escapeHtml(group.locationLabel || "")}"
              aria-label="${escapeHtml(`Add child location to ${group.label || "this event"}`)}"
              title="Add child location"
            >+</button>
          ` : ""}
          <span>${escapeHtml(String(items.length))}</span>
        </div>
      </div>
      ${isSublocationFormOpen ? renderWorldSpineSublocationComposerForm(group, normalizedComposer) : ""}
      <div class="world-spine-related-card-group__items">
        ${items.map((item) => renderWorldSpineRelatedCatalogueCard(item, { expandedKey })).join("")}
      </div>
    </section>
  `;
}

// Intent: keep the RHS child-location draft render-only until the shell commits it through the World Spine service.
function renderWorldSpineSublocationComposerForm(group = {}, composer = {}) {
  const nodeId = normalizeString(group.nodeId);
  const locationLabel = normalizeString(group.locationLabel);
  const sceneId = normalizeString(group.sceneId);
  const value = normalizeString(composer.sublocation);
  const error = normalizeString(composer.error);

  return `
    <form
      class="world-spine-related-sublocation-form"
      data-world-spine-sublocation-form
      data-world-spine-node-id="${escapeHtml(nodeId)}"
      data-scene-id="${escapeHtml(sceneId)}"
      data-world-spine-location-label="${escapeHtml(locationLabel)}"
    >
      <label>
        <span>Child location</span>
        <input
          type="text"
          data-world-spine-sublocation-field="sublocation"
          value="${escapeHtml(value)}"
          placeholder="Child place, ship, room, facility, orbit"
          autocomplete="off"
        >
      </label>
      ${error ? `<p class="world-spine-related-sublocation-form__error">${escapeHtml(error)}</p>` : ""}
      <div class="world-spine-related-sublocation-form__actions">
        <button
          type="button"
          data-action="cancel-world-spine-sublocation-composer"
        >Cancel</button>
        <button
          type="submit"
          data-action="save-world-spine-sublocation"
        >Add</button>
      </div>
    </form>
  `;
}

function normalizeWorldSpineSublocationComposer(composer = null) {
  if (!composer || typeof composer !== "object" || Array.isArray(composer)) {
    return {
      nodeId: "",
      sublocation: "",
      error: "",
    };
  }

  return {
    nodeId: normalizeString(composer.nodeId),
    sublocation: normalizeString(composer.sublocation),
    error: normalizeString(composer.error),
  };
}

function renderWorldSpineRelatedCatalogueCard(item = {}, {
  expandedKey = "",
} = {}) {
  const detailRows = (Array.isArray(item.detailRows) ? item.detailRows : [])
    .filter((row) => !/^(entity id|draft id)$/i.test(normalizeString(row?.label)))
    .slice(0, 6);
  const title = normalizeString(item.title) || "Untitled item";
  const cardKey = createWorldSpineRelatedCardKey(item);
  const isExpanded = cardKey && cardKey === normalizeString(expandedKey);
  const summary = normalizeString(item.detailSummary) || normalizeString(item.detail);
  const canAttachImage = item.canAttachImage !== false && normalizeString(item.itemKind) === "entity";
  const canEditSceneMetadata = item.canEditSceneMetadata === true && normalizeString(item.sceneId);

  return `
    <article
      class="world-spine-related-card ${isExpanded ? "is-expanded" : ""}"
      data-worldbuilding-catalogue-item-id="${escapeHtml(item.id)}"
      data-worldbuilding-catalogue-item-kind="${escapeHtml(item.itemKind)}"
      data-world-spine-related-card-key="${escapeHtml(cardKey)}"
    >
      <div class="world-spine-related-card__topline">
        <button
          type="button"
          class="world-spine-related-card__summary-button"
          data-action="toggle-world-spine-related-card"
          data-world-spine-related-card-key="${escapeHtml(cardKey)}"
          data-worldbuilding-catalogue-item-id="${escapeHtml(item.id)}"
          data-worldbuilding-catalogue-item-kind="${escapeHtml(item.itemKind)}"
          aria-expanded="${isExpanded ? "true" : "false"}"
        >
          ${renderWorldSpineRelatedCardMedia(item)}
          <span class="world-spine-related-card__summary-text">
            <strong>${escapeHtml(title)}</strong>
            ${item.meta ? `<span>${escapeHtml(item.meta)}</span>` : ""}
          </span>
          <span class="world-spine-related-card__expand-indicator" aria-hidden="true">${isExpanded ? "-" : "+"}</span>
        </button>
        ${canEditSceneMetadata ? `
          <button
            type="button"
            class="world-spine-related-card__edit-button"
            data-action="world-spine-edit-scene-metadata"
            data-scene-id="${escapeHtml(item.sceneId)}"
            aria-label="${escapeHtml(`Edit location details for ${title}`)}"
            title="Edit location details"
          >
            <span class="worldbuilding-catalogue-action-icon worldbuilding-catalogue-action-icon--edit" aria-hidden="true"></span>
          </button>
        ` : ""}
        ${canAttachImage ? `
          <button
            type="button"
            class="world-spine-related-card__image-button"
            data-action="attach-worldbuilding-catalogue-image"
            data-worldbuilding-catalogue-item-id="${escapeHtml(item.id)}"
            data-worldbuilding-catalogue-item-kind="${escapeHtml(item.itemKind)}"
            aria-label="${escapeHtml(`Attach image to ${title}`)}"
            title="Attach image"
          >
            <span class="worldbuilding-catalogue-action-icon worldbuilding-catalogue-action-icon--image" aria-hidden="true"></span>
          </button>
        ` : ""}
      </div>
      ${isExpanded ? `
        <div class="world-spine-related-card__details">
          ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
        ${detailRows.length ? `
          <dl class="world-spine-related-card__fields">
            ${detailRows.map((row) => `
              <div>
                <dt>${escapeHtml(row.label)}</dt>
                <dd>${escapeHtml(row.value)}</dd>
              </div>
            `).join("")}
          </dl>
        ` : ""}
        </div>
      ` : ""}
    </article>
  `;
}

function createWorldSpineRelatedCardKey(item = {}) {
  const itemId = normalizeString(item.id);
  const itemKind = normalizeString(item.itemKind);
  return itemId && itemKind ? `${itemKind}:${itemId}` : "";
}

function renderWorldSpineRelatedCardMedia(item = {}) {
  const image = item.image && typeof item.image === "object" ? item.image : null;
  const imageSource = createWorldbuildingCatalogueImageSource(image);
  if (imageSource) {
    return `
      <span class="world-spine-related-card__media">
        <img src="${escapeHtml(imageSource)}" alt="${escapeHtml(`${item.title || "Catalogue item"} reference image`)}" loading="lazy">
      </span>
    `;
  }

  const initials = createWorldSpineRelatedCardInitials(item);
  return `
    <span class="world-spine-related-card__media world-spine-related-card__media--empty" aria-hidden="true">
      <span>${escapeHtml(initials)}</span>
    </span>
  `;
}

function createWorldSpineRelatedCardInitials(item = {}) {
  const category = normalizeString(item.meta || item.categoryId || item.itemKind);
  const title = normalizeString(item.title);
  const source = category || title || "Catalogue";
  const words = source.split(/\s+/).filter(Boolean);
  return words.length > 1
    ? `${words[0][0]}${words[1][0]}`.toUpperCase()
    : source.slice(0, 2).toUpperCase();
}

function renderWorldSpineLocationFilterControl(filterModel = {}, {
  isOpen = false,
  stats = {},
  primaryNodeCount = 0,
} = {}) {
  const options = Array.isArray(filterModel?.options) ? filterModel.options : [];
  const activeClass = filterModel?.active === true ? " is-active" : "";
  const openClass = isOpen ? " is-open" : "";
  const summary = normalizeString(filterModel?.summaryLabel) || "All locations";
  return `
    <div class="world-spine-location-filter${activeClass}${openClass}" data-world-spine-filter>
      <button
        type="button"
        class="world-spine-location-filter__tab"
        data-action="toggle-world-spine-location-filter-pane"
        aria-haspopup="true"
        aria-expanded="${isOpen ? "true" : "false"}"
      >
        <span aria-hidden="true">${renderWorldSpineFilterGlyph()}</span>
        <strong>Filter</strong>
        <em>${escapeHtml(summary)}</em>
      </button>
      ${isOpen ? renderWorldSpineLocationFilterPane(filterModel, {
        stats,
        primaryNodeCount,
      }) : ""}
    </div>
  `;
}

function renderWorldSpineFilterGlyph() {
  return `
    <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
      <path d="M2 3h12l-4.7 5.2v4.2l-2.6 1V8.2L2 3z"></path>
    </svg>
  `;
}

function renderWorldSpineLocationFilterPane(filterModel = {}, {
  stats = {},
  primaryNodeCount = 0,
} = {}) {
  const options = Array.isArray(filterModel?.options) ? filterModel.options : [];
  const metricItems = [
    `${stats.sceneCount ?? primaryNodeCount} scenes`,
    `${stats.sceneBeatCount ?? 0} beats`,
    `${stats.childNodeCount ?? 0} in-scene`,
    `${stats.referenceNodeCount ?? 0} refs`,
    `${stats.implicationEdgeCount ?? 0} links`,
  ];
  return `
    <div class="world-spine-location-filter__pane" data-world-spine-location-filter-pane>
      <div class="world-spine-location-filter__pane-heading">
        <span>Timeline Filter</span>
        <button type="button" data-action="clear-world-spine-location-filter">Show all</button>
      </div>
      <div class="world-spine-location-filter__metrics" aria-label="Timeline counts">
        ${metricItems.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      <div class="world-spine-location-filter__options" role="group" aria-label="Timeline locations">
        ${options.length
          ? options.map(renderWorldSpineLocationFilterOption).join("")
          : `<p class="world-spine-location-filter__empty">No timeline locations yet.</p>`}
      </div>
    </div>
  `;
}

function renderWorldSpineLocationFilterOption(option = {}) {
  const checked = option.checked ? " checked" : "";
  const activeClass = option.checked ? " is-checked" : "";
  const mutedClass = option.filteredOut ? " is-filtered-out" : "";
  const nodeCount = Number.isFinite(Number(option.nodeCount)) ? Number(option.nodeCount) : 0;
  const spineContext = Array.isArray(option.spineLabels) && option.spineLabels.length
    ? option.spineLabels.join(", ")
    : "Timeline";
  return `
    <label class="world-spine-location-filter__option${activeClass}${mutedClass}">
      <input
        type="checkbox"
        data-world-spine-location-filter-key="${escapeHtml(option.locationKey || "")}"
        ${checked}
      >
      <span class="world-spine-location-filter__check" aria-hidden="true"></span>
      <span class="world-spine-location-filter__option-copy">
        <strong>${escapeHtml(option.label || "Timeline location")}</strong>
        <small>${escapeHtml(`${nodeCount} event${nodeCount === 1 ? "" : "s"} - ${spineContext}`)}</small>
      </span>
    </label>
  `;
}

function renderWorldSpinePanelResizer(handleId, label) {
  return `
    <div
      class="world-spine-panel-resizer"
      data-world-spine-resize-handle="${escapeHtml(handleId)}"
      role="separator"
      aria-orientation="vertical"
      aria-label="${escapeHtml(label)}"
      tabindex="0"
    ></div>
  `;
}

function renderWorldSpineHistoryControls(history = {}) {
  const undoDisabled = history.canUndo ? "" : " disabled";
  const redoDisabled = history.canRedo ? "" : " disabled";
  return `
    <div class="world-spine-history-controls" aria-label="World Spine history controls">
      <button
        type="button"
        class="world-spine-history-button"
        data-action="world-spine-undo"
        title="Undo World Spine change"
        aria-label="Undo World Spine change"
        ${undoDisabled}
      >Undo</button>
      <button
        type="button"
        class="world-spine-history-button"
        data-action="world-spine-redo"
        title="Redo World Spine change"
        aria-label="Redo World Spine change"
        ${redoDisabled}
      >Redo</button>
    </div>
  `;
}

function renderConnections(connections = [], {
  includeImplications = true,
  onlyImplications = false,
  locationFilterModel = {},
  nodesById = new Map(),
} = {}) {
  return connections
    .filter((connection) => {
      const isImplication = connection?.kind === "implication";
      return onlyImplications ? isImplication : includeImplications || !isImplication;
    })
    .map((connection, index) => {
      const className = [
        "world-spine-connection",
        `world-spine-connection--${connection.kind}`,
        connection.dashed ? "is-dashed" : "",
      ].filter(Boolean).join(" ");
      const marker = connection.kind === "implication" ? ' marker-end="url(#world-spine-implication-arrow)"' : "";
      const label = normalizeString(connection.label);
      const labelX = Number.isFinite(connection.labelX) ? connection.labelX : 0;
      const labelY = Number.isFinite(connection.labelY) ? connection.labelY : 0;
      const isImplication = connection.kind === "implication";
      const filterClass = resolveWorldSpineConnectionFilterClass(connection, {
        filterModel: locationFilterModel,
        nodesById,
      });
      const connectionAttributes = [
        `data-world-spine-connection-id="${escapeHtml(connection.id || `connection-${index + 1}`)}"`,
        `data-world-spine-connection-kind="${escapeHtml(connection.kind || "link")}"`,
        isImplication ? `data-world-spine-from-node-id="${escapeHtml(connection.fromNodeId || "")}"` : "",
        isImplication ? `data-world-spine-to-node-id="${escapeHtml(connection.toNodeId || "")}"` : "",
        isImplication ? `data-world-spine-connection-label-text="${escapeHtml(label)}"` : "",
        isImplication ? `data-world-spine-render-from-node-id="${escapeHtml(connection.renderFromNodeId || connection.fromNodeId || "")}"` : "",
        isImplication ? `data-world-spine-render-to-node-id="${escapeHtml(connection.renderToNodeId || connection.toNodeId || "")}"` : "",
        isImplication ? `data-world-spine-from-handle-side="${escapeHtml(connection.fromHandleSide || "right")}"` : "",
        isImplication ? `data-world-spine-to-handle-side="${escapeHtml(connection.toHandleSide || "left")}"` : "",
        isImplication ? `data-world-spine-route-direction="${escapeHtml(connection.routeDirection || "inline")}"` : "",
        isImplication && Number.isFinite(connection.routeY) ? `data-world-spine-route-y="${round(connection.routeY)}"` : "",
        isImplication ? `data-world-spine-obstacle-count="${escapeHtml(String(connection.obstacleCount || 0))}"` : "",
      ].filter(Boolean).join(" ");
      return `
        <g class="world-spine-connection-group world-spine-connection-group--${escapeHtml(connection.kind || "link")} ${filterClass}" ${connectionAttributes}>
          ${isImplication ? `<path class="world-spine-connection-hit-area" data-world-spine-connection-hit-path d="${escapeHtml(connection.path)}"></path>` : ""}
          <path class="${className}" data-world-spine-connection-path d="${escapeHtml(connection.path)}"${marker}></path>
          ${label ? `
            <text class="world-spine-connection__label" data-world-spine-connection-label x="${round(labelX)}" y="${round(labelY)}">
              <tspan>${escapeHtml(label)}</tspan>
            </text>
          ` : ""}
        </g>
      `;
    }).join("");
}

function normalizeWorldSpineHistoryControls(history = {}) {
  return {
    canUndo: history?.canUndo === true,
    canRedo: history?.canRedo === true,
  };
}

function renderWorldSpineImplicationMarkerDefs() {
  return `
    <defs>
      <marker id="world-spine-implication-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path class="world-spine-implication-arrow" d="M 0 0 L 8 4 L 0 8 z"></path>
      </marker>
    </defs>
  `;
}

function renderTimelineTicks(ticks = []) {
  return ticks.map((tick) => `
    <span class="world-spine-axis__tick" style="left:${tick.left}px;">
      <span></span>
      <strong>${escapeHtml(tick.primaryLabel)}</strong>
      <em>${escapeHtml(tick.secondaryLabel)}</em>
    </span>
  `).join("");
}

// Intent: expose Delete for every populated projected-row membership shape accepted by the delete transaction.
export function isWorldSpineLocationRowDeleteEligible(menu = {}) {
  if (normalizeString(menu?.menuType) !== "location-form") {
    return false;
  }

  return !isDefaultLocationIdentity(
    menu?.locationLabel ?? menu?.location
  );
}

// Intent: render unplaced primary events on a fixed viewport surface while preserving global timeline X coordinates.
function renderWorldSpineUnplacedDockHTML(unplacedDock = {}, {
  collapsed = false,
  width = 900,
  zoomFrameWidth = 900,
} = {}) {
  const primaryNodes = Array.isArray(unplacedDock?.primaryNodes) ? unplacedDock.primaryNodes.filter(Boolean) : [];
  const count = Number.isFinite(Number(unplacedDock?.count)) ? Number(unplacedDock.count) : primaryNodes.length;
  if (!count) {
    return "";
  }

  return `
    <section
      class="world-spine-unplaced-dock${collapsed ? " is-collapsed" : ""}"
      data-world-spine-unplaced-dock
      data-world-spine-unplaced-dock-collapsed="${collapsed ? "true" : "false"}"
      data-world-spine-unplaced-count="${escapeHtml(String(count))}"
      aria-label="Unplaced location events"
    >
      <div class="world-spine-unplaced-dock__header">
        <strong>Unplaced location <span aria-hidden="true">&middot;</span> ${escapeHtml(String(count))}</strong>
        <button
          type="button"
          class="world-spine-unplaced-dock__toggle"
          data-action="toggle-world-spine-unplaced-dock"
          aria-expanded="${collapsed ? "false" : "true"}"
          aria-controls="world-spine-unplaced-dock-track"
          title="${collapsed ? "Expand" : "Collapse"} unplaced events"
        >${collapsed ? "Expand" : "Collapse"}</button>
      </div>
      ${collapsed ? "" : `
        <div class="world-spine-unplaced-dock__track-viewport" id="world-spine-unplaced-dock-track">
          <div
            class="world-spine-unplaced-dock__track-frame"
            data-world-spine-unplaced-track-frame
            style="width:${zoomFrameWidth}px;"
          >
            <div
              class="world-spine-unplaced-dock__track"
              style="width:${width}px; transform:scale(var(--world-spine-timeline-zoom, 1));"
            >
              ${primaryNodes.map((node) => renderTimelineNode({ ...node, y: 0 }, {}, {
                surface: "unplaced-dock",
              })).join("")}
            </div>
          </div>
        </div>
      `}
    </section>
  `;
}

function renderTimelineTierGuides(tiers = [], width = 900, locationFilterModel = {}) {
  const safeTiers = Array.isArray(tiers) ? tiers.filter(Boolean) : [];
  if (safeTiers.length <= 1) {
    return "";
  }

  return safeTiers.map((tier) => {
    const normalizedTier = normalizeTimelineTier(tier, 0);
    const guideTop = normalizedTier.eventBlockRowY + (PRIMARY_NODE_HEIGHT / 2) + 28;
    return `
      <div
        class="world-spine-tier-guide ${resolveWorldSpineLocationFilterClass(locationFilterModel, normalizedTier.locationLabel)}"
        data-world-spine-tier-guide
        data-world-spine-tier-index="${escapeHtml(String(normalizedTier.tierIndex))}"
        data-world-spine-id="${escapeHtml(normalizedTier.spineId)}"
        data-world-spine-location-key="${escapeHtml(normalizeLocationKey(normalizedTier.locationLabel))}"
        data-world-spine-location-label="${escapeHtml(normalizeLocationLabel(normalizedTier.locationLabel))}"
        style="left:${CANVAS_PADDING_X - 40}px; top:${round(guideTop)}px; width:${Math.max(240, width - (CANVAS_PADDING_X * 2) + 80)}px;"
        aria-hidden="true"
      >
        <span>${escapeHtml(normalizedTier.label)}</span>
      </div>
    `;
  }).join("");
}

function renderTimelineLocationRowGuides(locationRows = [], width = 900, locationFilterModel = {}) {
  const rows = Array.isArray(locationRows) ? locationRows.filter(Boolean) : [];
  if (!rows.length) {
    return "";
  }

  return rows.map((row, index) => {
    const rowLayout = resolveTimelineLocationRowHeaderLayout(row, index, rows);
    const displayLabel = formatLocationRowChipLabel(row.locationLabel || row.label);
    const locationKey = resolveLocationRowKey(row.locationLabel, row.locationKey);
    const filterClass = resolveWorldSpineLocationFilterClass(locationFilterModel, locationKey);
    const isPromptLabel = isDefaultLocationIdentity(row.locationLabel);
    return `
      <button
        type="button"
        class="world-spine-location-row-label ${filterClass}"
        data-action="world-spine-edit-location-row"
        data-world-spine-location-row-label
        data-world-spine-id="${escapeHtml(row.spineId || "")}"
        data-world-spine-spine-label="${escapeHtml(row.spineLabel || "")}"
        data-world-spine-tier-index="${escapeHtml(String(row.tierIndex ?? 0))}"
        data-world-spine-location-row-index="${escapeHtml(String(row.locationRowIndex ?? index))}"
        data-world-spine-location-key="${escapeHtml(locationKey)}"
        data-world-spine-location-label="${escapeHtml(normalizeLocationLabel(row.locationLabel))}"
        data-world-spine-location-row-prompt="${isPromptLabel ? "true" : "false"}"
        data-world-spine-row-node-ids="${serializeWorldSpineDatasetList(row.primaryNodeIds)}"
        data-world-spine-row-scene-ids="${serializeWorldSpineDatasetList(row.sceneIds)}"
        data-world-spine-row-world-node-ids="${serializeWorldSpineDatasetList(row.worldNodeIds)}"
        style="left:${round(rowLayout.left)}px; top:${round(rowLayout.labelTop)}px;"
        aria-label="${escapeHtml(`${isPromptLabel ? "Name" : "Edit"} location row: ${displayLabel}`)}"
        title="${escapeHtml(`${isPromptLabel ? "Name" : "Edit"} location row`)}"
      >
        <strong>${escapeHtml(displayLabel)}</strong>
      </button>
      <div
        class="world-spine-tier-guide world-spine-location-row-guide ${filterClass}"
        data-world-spine-location-row-guide
        data-world-spine-tier-index="${escapeHtml(String(row.tierIndex ?? 0))}"
        data-world-spine-location-key="${escapeHtml(locationKey)}"
        data-world-spine-location-label="${escapeHtml(normalizeLocationLabel(row.locationLabel))}"
        style="left:${CANVAS_PADDING_X - 40}px; top:${round(rowLayout.guideTop)}px; width:${Math.max(240, width - (CANVAS_PADDING_X * 2) + 80)}px;"
        aria-hidden="true"
      >
      </div>
    `;
  }).join("");
}

// Intent: render assigned place artwork as a passive left-side scene reference beneath location row banners.
function renderTimelineLocationRowArtwork(locationRows = [], locationFilterModel = {}) {
  const rows = Array.isArray(locationRows) ? locationRows.filter(Boolean) : [];
  if (!rows.length) {
    return "";
  }

  return rows.map((row, index) => {
    const imageRecord = normalizeTimelineLocationRowImage(row.locationImage);
    if (!imageRecord) {
      return "";
    }

    const rowLayout = resolveTimelineLocationRowHeaderLayout(row, index, rows);
    const locationLabel = normalizeLocationLabel(row.locationLabel);
    const locationKey = resolveLocationRowKey(locationLabel, row.locationKey);
    const filterClass = resolveWorldSpineLocationFilterClass(locationFilterModel, locationKey);
    return `
      <div
        class="world-spine-location-row-artwork ${filterClass}"
        data-world-spine-location-row-artwork
        data-world-spine-location-key="${escapeHtml(locationKey)}"
        data-world-spine-location-label="${escapeHtml(locationLabel)}"
        data-world-spine-location-row-artwork-height="${escapeHtml(String(round(rowLayout.artworkHeight)))}"
        style="left:${round(rowLayout.left)}px; top:${round(rowLayout.artworkTop)}px; width:${LOCATION_ROW_ARTWORK_WIDTH}px; height:${round(rowLayout.artworkHeight)}px;"
        aria-label="${escapeHtml(`${locationLabel} reference image`)}"
      >
        <img
          src="${escapeHtml(imageRecord.src)}"
          alt=""
          loading="lazy"
        >
      </div>
    `;
  }).join("");
}

// Intent: keep a row's floating location reference inside the lane before the next row banner starts.
function resolveTimelineLocationRowHeaderLayout(row, index = 0, rows = []) {
  const eventBlockRowY = Number.isFinite(Number(row?.eventBlockRowY))
    ? Number(row.eventBlockRowY)
    : EVENT_BLOCK_ROW_Y + (index * LOCATION_ROW_GAP);
  const nextRow = Array.isArray(rows) ? rows[index + 1] : null;
  const nextEventBlockRowY = Number.isFinite(Number(nextRow?.eventBlockRowY))
    ? Number(nextRow.eventBlockRowY)
    : eventBlockRowY + LOCATION_ROW_GAP;
  const labelTop = Math.max(12, eventBlockRowY - (PRIMARY_NODE_HEIGHT / 2) - 58);
  const nextLabelTop = Math.max(12, nextEventBlockRowY - (PRIMARY_NODE_HEIGHT / 2) - 58);
  const artworkTop = labelTop + LOCATION_ROW_LABEL_HEIGHT + LOCATION_ROW_HEADER_GAP;
  const artworkBottom = nextLabelTop - LOCATION_ROW_BOUNDARY_GAP;
  const artworkHeight = clamp(artworkBottom - artworkTop, 0, LOCATION_ROW_ARTWORK_HEIGHT);
  return {
    left: CANVAS_PADDING_X - 88,
    labelTop,
    guideTop: eventBlockRowY + (PRIMARY_NODE_HEIGHT / 2) + 28,
    artworkTop,
    artworkHeight,
  };
}

function normalizeTimelineLocationRowImage(locationImage = null) {
  const image = locationImage?.image && typeof locationImage.image === "object"
    ? locationImage.image
    : locationImage;
  const source = createWorldbuildingCatalogueImageSource(image);
  if (!source) {
    return null;
  }

  return {
    src: source,
    name: normalizeString(image?.name) || "location-image",
  };
}

function renderTimelineDropZones(dropZones = [], locationFilterModel = {}) {
  return (Array.isArray(dropZones) ? dropZones : []).map((zone) => `
    <div
      class="world-spine-drop-zone ${resolveWorldSpineLocationFilterClass(locationFilterModel, zone.locationKey || zone.locationLabel)}"
      data-world-spine-drop-index="${escapeHtml(String(zone.index))}"
      data-world-spine-drop-spine-id="${escapeHtml(zone.spineId || "")}"
      data-world-spine-drop-tier-index="${escapeHtml(String(zone.tierIndex ?? 0))}"
      data-world-spine-drop-location-key="${escapeHtml(zone.locationKey || "")}"
      data-world-spine-drop-location-label="${escapeHtml(zone.locationLabel || "")}"
      style="left:${zone.left}px; top:${zone.top}px; width:${zone.width}px; height:${zone.height}px;"
      aria-label="${escapeHtml(zone.label || "Drop event here")}"
    >
      <span>${escapeHtml(zone.label || "Drop")}</span>
    </div>
  `).join("");
}

function serializeWorldSpineDatasetList(values = []) {
  return escapeHtml(JSON.stringify(normalizeStringList(values)));
}

function renderTimelineNode(node, locationFilterModel = {}, { surface = "canvas" } = {}) {
  const rowLocationKey = resolveTimelineNodeRowLocationKey(node);
  const rowLocationLabel = resolveTimelineNodeRowLocationLabel(node);
  const filterClass = resolveWorldSpineLocationFilterClass(locationFilterModel, rowLocationKey);
  const className = [
    "world-spine-node",
    `world-spine-node--${node.level}`,
    `world-spine-node--${node.kind}`,
    node.isSelected ? "is-selected" : "",
    node.hasPassage ? "has-passage" : "",
    node.locationWarning ? "has-location-warning" : "",
    filterClass,
    surface === "unplaced-dock" ? "world-spine-node--unplaced-dock" : "",
  ].filter(Boolean).join(" ");

  return `
    <button
      type="button"
      class="${className}"
      style="left:${node.x}px; top:${node.y}px; width:${node.width}px; height:${node.height}px;"
      data-action="select-node"
      data-node-id="${escapeHtml(node.id)}"
      data-world-spine-node-id="${escapeHtml(node.id)}"
      data-world-spine-node-level="${escapeHtml(node.level || "")}"
      data-world-spine-node-kind="${escapeHtml(node.kind || "")}"
      data-world-spine-parent-node-id="${escapeHtml(node.parentNodeId || "")}"
      data-world-spine-scene-id="${escapeHtml(node.sceneId || "")}"
      data-world-spine-id="${escapeHtml(node.spineId || "")}"
      data-world-spine-tier-index="${escapeHtml(String(node.tierIndex ?? 0))}"
      data-world-spine-location-key="${escapeHtml(rowLocationKey)}"
      data-world-spine-location-label="${escapeHtml(rowLocationLabel)}"
      data-world-spine-event-location-key="${escapeHtml(node.eventLocationKey || "")}"
      data-world-spine-event-location-label="${escapeHtml(node.eventLocationLabel || "")}"
      data-world-spine-sublocation-label="${escapeHtml(node.sublocationLabel || "")}"
      data-world-spine-orbital-band="${escapeHtml(node.orbitalBand || "")}"
      data-world-spine-location-warning-kind="${escapeHtml(node.locationWarning?.kind || "")}"
      data-world-spine-node-surface="${escapeHtml(surface)}"
      aria-label="${escapeHtml(`${node.title} timeline node`)}"
    >
      <span class="world-spine-node__title">${escapeHtml(node.title)}</span>
      <span class="world-spine-node__meta">${escapeHtml(compactNodeMeta(node, {
        suppressDefaultRowLocation: surface === "unplaced-dock",
      }))}</span>
      <span class="world-spine-node__icons" aria-label="${escapeHtml(describeNodeBadges(node))}">
        ${renderNodeBadge(node.locationWarning, "!", node.locationWarning?.message || "Location row mismatch", "is-location-warning")}
        ${renderNodeBadge(node.hasPassage, "A", "Anchored passage")}
        ${renderNodeBadge(node.location, "L", "Location")}
        ${renderNodeBadge(node.childLocationLabel || node.sublocationLabel || node.orbitalBand, "C", "Child location")}
        ${renderNodeBadge(node.people.length, "P", "People present")}
        ${renderNodeBadge(normalizeStringList(node.sceneBeats).length, "B", "Scene beat")}
        ${renderNodeBadge(node.criticalEvents.length, "C", "Critical event")}
        ${renderNodeBadge(normalizeCustomMetadataRows(node.customMetadata).length, "M", "Custom metadata")}
      </span>
      <span
        class="world-spine-node__link-handle world-spine-node__link-handle--left"
        data-world-spine-link-handle="left"
        title="Link event implication"
        aria-hidden="true"
      ></span>
      <span
        class="world-spine-node__link-handle world-spine-node__link-handle--right"
        data-world-spine-link-handle="right"
        title="Link event implication"
        aria-hidden="true"
      ></span>
    </button>
  `;
}

function renderNodeBadge(condition, label, title, className = "") {
  return condition
    ? `<span${className ? ` class="${escapeHtml(className)}"` : ""} title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${escapeHtml(label)}</span>`
    : "";
}

function mergeWorldSpinePresenceEntityNames(existingNames = [], entityPresenceByNodeId = null, nodeId = "") {
  const presence = entityPresenceByNodeId instanceof Map
    ? entityPresenceByNodeId.get(normalizeString(nodeId))
    : null;
  return uniqueStrings([
    ...normalizeStringList(existingNames),
    ...normalizeStringList(presence?.entityNames),
  ]);
}

function createPrimarySceneNode(scene, metadata, {
  index,
  x,
  selectedNodeId,
  selectedBlockId,
  firstBlock,
  timelineTier,
  entityPresenceByNodeId,
  locationContext,
}) {
  const lineNumbers = (Array.isArray(scene.blocks) ? scene.blocks : [])
    .map((block) => Number(block?.lineNumber))
    .filter(Number.isFinite);
  const primaryBlockId = normalizeString(firstBlock?.blockId);
  const tier = normalizeTimelineTier(timelineTier, 0);
  const locationPlacement = resolveTimelineNodeLocationPlacement({
    record: scene,
    metadata,
    tier,
    locationContext,
  });
  const displayLocationLabel = resolveTimelineNodeDisplayLocationLabel(locationPlacement);

  const nodeId = `scene:${scene.sceneId}`;

  return {
    id: nodeId,
    sourceId: scene.sceneId,
    spineId: tier.spineId,
    spineLabel: tier.label,
    tierIndex: tier.tierIndex,
    level: "primary",
    kind: "scene",
    typeLabel: "Scene",
    title: normalizeString(scene.sceneTitle) || `Scene ${index + 1}`,
    summary: normalizeString(scene.sceneSynopsis) || firstMeaningfulBlockText(scene),
    sequenceRank: index,
    sceneId: normalizeString(scene.sceneId),
    chapterId: normalizeString(scene.chapterId),
    sceneTitle: normalizeString(scene.sceneTitle) || `Scene ${index + 1}`,
    chapterTitle: normalizeString(scene.chapterTitle),
    location: displayLocationLabel,
    locationLabel: displayLocationLabel,
    locationKey: normalizeLocationKey(displayLocationLabel),
    locationRowLabel: locationPlacement.locationLabel,
    locationRowKey: locationPlacement.locationKey,
    eventLocationLabel: locationPlacement.eventLocationLabel,
    eventLocationKey: locationPlacement.eventLocationKey,
    coreLocationLabel: locationPlacement.coreLocationLabel,
    childLocation: locationPlacement.sublocationLabel,
    childLocationLabel: locationPlacement.sublocationLabel,
    sublocation: locationPlacement.sublocationLabel,
    sublocationLabel: locationPlacement.sublocationLabel,
    orbitalBand: locationPlacement.orbitalBand,
    locationScope: locationPlacement.locationScope,
    locationWarning: locationPlacement.warning,
    date: metadata.date,
    time: metadata.time,
    people: metadata.people,
    sceneBeats: metadata.sceneBeats,
    criticalEvents: metadata.criticalEvents,
    customMetadata: metadata.customMetadata,
    linkedEntityNames: mergeWorldSpinePresenceEntityNames(metadata.linkedEntityNames, entityPresenceByNodeId, nodeId),
    primaryBlockId,
    lineNumbers,
    hasPassage: Boolean(primaryBlockId),
    x,
    y: EVENT_BLOCK_ROW_Y - (PRIMARY_NODE_HEIGHT / 2),
    width: PRIMARY_NODE_WIDTH,
    height: PRIMARY_NODE_HEIGHT,
    isSelected: selectedNodeId === `scene:${scene.sceneId}` || (primaryBlockId && selectedBlockId === primaryBlockId),
  };
}

function addSceneChildEventNodes(nodes, connections, parent, scene, events, {
  selectedNodeId,
  selectedBlockId,
  entityPresenceByNodeId,
}) {
  const safeEvents = Array.isArray(events) ? events : [];
  safeEvents.slice(0, 5).forEach((eventTag, index) => {
    const above = index % 2 === 0;
    const x = parent.x + 26 + (index * 58);
    const y = above
      ? parent.y - 92 - (Math.floor(index / 2) * 22)
      : parent.y + parent.height + 44 + (Math.floor(index / 2) * 22);
    const primaryBlockId = normalizeString(eventTag.blockId) || parent.primaryBlockId;
    const locationLabel = resolveEventTagLocationLabel(eventTag, parent);
    const locationKey = normalizeLocationKey(locationLabel);
    const nodeId = `event:${eventTag.id}`;
    const node = {
      id: nodeId,
      sourceId: normalizeString(eventTag.id),
      parentNodeId: parent.id,
      spineId: parent.spineId,
      spineLabel: parent.spineLabel,
      tierIndex: parent.tierIndex,
      level: "child",
      kind: "event",
      typeLabel: "In-scene event",
      title: normalizeString(eventTag.label) || normalizeString(eventTag.kind) || "Scene event",
      summary: normalizeString(eventTag.notes) || normalizeString(eventTag.evidenceExcerpt),
      sceneId: parent.sceneId,
      sceneTitle: parent.sceneTitle,
      chapterTitle: parent.chapterTitle,
      location: locationLabel,
      locationLabel,
      locationKey,
      locationRowLabel: parent.locationRowLabel,
      locationRowKey: parent.locationRowKey,
      eventLocationLabel: locationLabel,
      eventLocationKey: locationKey,
      coreLocationLabel: parent.coreLocationLabel,
      sublocation: parent.sublocation,
      sublocationLabel: parent.sublocationLabel,
      orbitalBand: parent.orbitalBand,
      locationScope: parent.locationScope,
      locationWarning: parent.locationWarning,
      date: parent.date,
      time: "",
      people: parent.people,
      sceneBeats: [],
      criticalEvents: [normalizeString(eventTag.kind) || "event"].filter(Boolean),
      customMetadata: parent.customMetadata.slice(),
      linkedEntityNames: mergeWorldSpinePresenceEntityNames([], entityPresenceByNodeId, nodeId),
      primaryBlockId,
      lineNumbers: Number.isFinite(Number(eventTag.lineNumber)) ? [Number(eventTag.lineNumber)] : [],
      hasPassage: Boolean(primaryBlockId),
      x,
      y,
      width: CHILD_NODE_WIDTH,
      height: CHILD_NODE_HEIGHT,
      isSelected: selectedNodeId === `event:${eventTag.id}` || (primaryBlockId && selectedBlockId === primaryBlockId),
    };
    nodes.push(node);
    connections.push(createConnection(parent, node, "child", false));
  });
}

function addSceneMetadataChildNodes(nodes, connections, parent, metadata, {
  selectedNodeId,
  entityPresenceByNodeId,
}) {
  const sceneBeatEvents = normalizeStringList(metadata?.sceneBeats).map((label) => ({
    kind: "metadata-beat",
    typeLabel: "Scene beat",
    title: label,
    summary: "Author-entered beat inside this scene.",
    location: parent.location,
  }));
  const sceneEvents = normalizeStringList(metadata?.authoredCriticalEvents).map((label) => ({
    kind: "metadata-event",
    typeLabel: "In-scene event",
    title: label,
    summary: "Author-entered World Spine scene event.",
    location: parent.location,
  }));
  const locationEvents = normalizeStringList(metadata?.locationChanges).map((label) => ({
    kind: "metadata-location",
    typeLabel: "Location change",
    title: label,
    summary: "Author-entered location shift inside the scene.",
    location: label,
  }));
  const metadataEvents = [...sceneBeatEvents, ...sceneEvents, ...locationEvents].slice(0, 8);

  metadataEvents.forEach((metadataEvent, index) => {
    const x = parent.x + 10 + (index * 46);
    const y = resolveSceneMetadataChildNodeY(parent, metadataEvent, index);
    const nodeId = `metadata:${metadataEvent.kind}:${parent.sceneId}:${slugify(metadataEvent.title)}`;
    const node = {
      id: nodeId,
      sourceId: nodeId,
      parentNodeId: parent.id,
      spineId: parent.spineId,
      spineLabel: parent.spineLabel,
      tierIndex: parent.tierIndex,
      level: "child",
      kind: metadataEvent.kind === "metadata-location"
        ? "location-change"
        : metadataEvent.kind === "metadata-beat"
          ? "beat"
          : "event",
      typeLabel: metadataEvent.typeLabel,
      title: metadataEvent.title,
      summary: metadataEvent.summary,
      sceneId: parent.sceneId,
      sceneTitle: parent.sceneTitle,
      chapterTitle: parent.chapterTitle,
      location: metadataEvent.location,
      locationLabel: normalizeLocationLabel(metadataEvent.location),
      locationKey: normalizeLocationKey(metadataEvent.location),
      locationRowLabel: parent.locationRowLabel,
      locationRowKey: parent.locationRowKey,
      eventLocationLabel: normalizeLocationLabel(metadataEvent.location),
      eventLocationKey: normalizeLocationKey(metadataEvent.location),
      coreLocationLabel: parent.coreLocationLabel,
      sublocation: parent.sublocation,
      sublocationLabel: parent.sublocationLabel,
      orbitalBand: parent.orbitalBand,
      locationScope: parent.locationScope,
      locationWarning: parent.locationWarning,
      date: parent.date,
      time: parent.time,
      people: parent.people,
      sceneBeats: metadataEvent.kind === "metadata-beat" ? [metadataEvent.title] : [],
      criticalEvents: metadataEvent.kind === "metadata-event" ? [metadataEvent.title] : [],
      customMetadata: parent.customMetadata.slice(),
      linkedEntityNames: mergeWorldSpinePresenceEntityNames([], entityPresenceByNodeId, nodeId),
      primaryBlockId: parent.primaryBlockId,
      lineNumbers: parent.lineNumbers.slice(0, 1),
      hasPassage: Boolean(parent.primaryBlockId),
      x,
      y,
      width: CHILD_NODE_WIDTH,
      height: CHILD_NODE_HEIGHT,
      isSelected: selectedNodeId === nodeId,
    };
    nodes.push(node);
    connections.push(createConnection(parent, node, "child", false));
  });
}

// Intent: keep scene beats close to their parent scene while other metadata rows keep the established split.
function resolveSceneMetadataChildNodeY(parent, metadataEvent, index) {
  if (metadataEvent.kind === "metadata-beat") {
    return parent.y - 96 - (index * 4);
  }

  if (metadataEvent.kind === "metadata-event") {
    return parent.y - 154 - (index * 4);
  }

  return parent.y + parent.height + 84 + (index * 4);
}

function addSceneWorldChildNodes(nodes, connections, parent, worldNodes, {
  selectedNodeId,
  selectedBlockId,
  entityPresenceByNodeId,
}) {
  const safeWorldNodes = Array.isArray(worldNodes) ? worldNodes : [];
  safeWorldNodes.slice(0, 4).forEach((worldNode, index) => {
    const above = index % 2 !== 0;
    const x = parent.x + 42 + (index * 52);
    const y = above
      ? parent.y - 156
      : parent.y + parent.height + 104;
    const primaryBlockId = normalizeString(worldNode.primaryBlockId) || parent.primaryBlockId;
    const nodeId = normalizeString(worldNode.id) || `world-node:${parent.id}:${index}`;
    const node = {
      id: nodeId,
      sourceId: normalizeString(worldNode.id),
      parentNodeId: parent.id,
      spineId: parent.spineId,
      spineLabel: parent.spineLabel,
      tierIndex: parent.tierIndex,
      level: "child",
      kind: "world",
      typeLabel: "World event",
      title: normalizeString(worldNode.label) || "World node",
      summary: normalizeString(worldNode.summary),
      sceneId: parent.sceneId,
      sceneTitle: parent.sceneTitle,
      chapterTitle: parent.chapterTitle,
      location: parent.location,
      locationLabel: parent.locationLabel,
      locationKey: parent.locationKey,
      locationRowLabel: parent.locationRowLabel,
      locationRowKey: parent.locationRowKey,
      eventLocationLabel: parent.eventLocationLabel,
      eventLocationKey: parent.eventLocationKey,
      coreLocationLabel: parent.coreLocationLabel,
      sublocation: parent.sublocation,
      sublocationLabel: parent.sublocationLabel,
      orbitalBand: parent.orbitalBand,
      locationScope: parent.locationScope,
      locationWarning: parent.locationWarning,
      date: parent.date,
      time: "",
      people: parent.people,
      sceneBeats: [],
      criticalEvents: [],
      customMetadata: parent.customMetadata.slice(),
      linkedEntityNames: mergeWorldSpinePresenceEntityNames(
        worldNode.linkedEntityNames,
        entityPresenceByNodeId,
        nodeId,
      ),
      primaryBlockId,
      lineNumbers: normalizeNumberList(worldNode.lineNumbers),
      hasPassage: Boolean(primaryBlockId),
      x,
      y,
      width: CHILD_NODE_WIDTH,
      height: CHILD_NODE_HEIGHT,
      isSelected: selectedNodeId === normalizeString(worldNode.id) || (primaryBlockId && selectedBlockId === primaryBlockId),
    };
    nodes.push(node);
    connections.push(createConnection(parent, node, "world", false));
  });
}

function addSceneReferenceNodes(nodes, connections, parent, metadata, entities, { selectedNodeId, selectedBlockId }) {
  const references = [];
  if (metadata.location) {
    references.push({
      id: `ref:location:${parent.sceneId}:${slugify(metadata.location)}`,
      kind: "location",
      typeLabel: "Location reference",
      title: metadata.location,
      summary: "Location record attached to this scene node.",
      linkedEntityNames: [],
    });
  }

  metadata.people.slice(0, 2).forEach((person) => {
    references.push({
      id: `ref:person:${parent.sceneId}:${slugify(person)}`,
      kind: "person",
      typeLabel: "Character reference",
      title: person,
      summary: "Character record present in this scene.",
      linkedEntityNames: [person],
    });
  });

  (Array.isArray(entities) ? entities : []).slice(0, 2).forEach((entity) => {
    references.push({
      id: `ref:entity:${parent.sceneId}:${normalizeString(entity.id) || slugify(entity.name)}`,
      kind: classifyEntityReferenceKind(entity),
      typeLabel: "World reference",
      title: normalizeString(entity.name) || "World entity",
      summary: normalizeString(entity.notes),
      linkedEntityNames: [normalizeString(entity.name)].filter(Boolean),
    });
  });

  references.slice(0, 4).forEach((reference, index) => {
    const above = index % 2 !== 0;
    const x = parent.x - 70 + (index * 88);
    const y = above ? parent.y - 64 : parent.y + parent.height + 18;
    const node = {
      ...reference,
      sourceId: reference.id,
      parentNodeId: parent.id,
      spineId: parent.spineId,
      spineLabel: parent.spineLabel,
      tierIndex: parent.tierIndex,
      level: "reference",
      sceneId: parent.sceneId,
      sceneTitle: parent.sceneTitle,
      chapterTitle: parent.chapterTitle,
      location: reference.kind === "location" ? reference.title : parent.location,
      locationLabel: reference.kind === "location" ? normalizeLocationLabel(reference.title) : parent.locationLabel,
      locationKey: reference.kind === "location" ? normalizeLocationKey(reference.title) : parent.locationKey,
      locationRowLabel: parent.locationRowLabel,
      locationRowKey: parent.locationRowKey,
      eventLocationLabel: reference.kind === "location" ? reference.title : parent.eventLocationLabel,
      eventLocationKey: reference.kind === "location" ? normalizeLocationKey(reference.title) : parent.eventLocationKey,
      coreLocationLabel: parent.coreLocationLabel,
      sublocation: parent.sublocation,
      sublocationLabel: parent.sublocationLabel,
      orbitalBand: parent.orbitalBand,
      locationScope: parent.locationScope,
      locationWarning: parent.locationWarning,
      date: parent.date,
      time: parent.time,
      people: reference.kind === "person" ? [reference.title] : parent.people,
      sceneBeats: [],
      criticalEvents: [],
      customMetadata: parent.customMetadata.slice(),
      primaryBlockId: parent.primaryBlockId,
      lineNumbers: parent.lineNumbers.slice(0, 1),
      hasPassage: Boolean(parent.primaryBlockId),
      x,
      y,
      width: REFERENCE_NODE_WIDTH,
      height: REFERENCE_NODE_HEIGHT,
      isSelected: selectedNodeId === reference.id || (parent.primaryBlockId && selectedBlockId === parent.primaryBlockId),
    };
    nodes.push(node);
    connections.push(createConnection(parent, node, "reference", true));
  });
}

function createWorldOnlyNodes(worldSpines, blockSceneIndex, {
  selectedNodeId,
  selectedBlockId,
  startX,
  sceneCount = 0,
  timelineTiers = [],
  entityPresenceByNodeId,
  locationContext,
}) {
  const nodes = [];
  const connections = [];
  const tiersBySpineId = createTimelineTierMap(timelineTiers);
  const worldNodes = flattenWorldSpineNodes(worldSpines)
    .filter((node) => !blockSceneIndex.has(normalizeString(node.primaryBlockId)));

  worldNodes.slice(0, 8).forEach((worldNode, index) => {
    const metadata = deriveWorldOnlyNodeMetadata(worldNode);
    const primaryBlockId = resolveWorldOnlyPrimaryBlockId(worldNode);
    const tier = tiersBySpineId.get(normalizeString(worldNode.spineId)) ?? normalizeTimelineTier(timelineTiers[0], 0);
    const locationPlacement = resolveTimelineNodeLocationPlacement({
      record: worldNode,
      metadata,
      tier,
      locationContext,
    });
    const displayLocationLabel = resolveTimelineNodeDisplayLocationLabel(locationPlacement);
    const nodeId = normalizeString(worldNode.id) || `world-only:${index + 1}`;
    const node = {
      id: nodeId,
      sourceId: normalizeString(worldNode.id),
      spineId: tier.spineId,
      spineLabel: tier.label,
      tierIndex: tier.tierIndex,
      level: "primary",
      kind: "world",
      typeLabel: "World event",
      title: normalizeString(worldNode.label) || "World event",
      summary: normalizeString(worldNode.summary),
      sequenceRank: resolveWorldOnlySequenceRank(worldNode, sceneCount + index),
      sceneId: "",
      sceneTitle: "",
      chapterTitle: "",
      location: displayLocationLabel,
      locationLabel: displayLocationLabel,
      locationKey: normalizeLocationKey(displayLocationLabel),
      locationRowLabel: locationPlacement.locationLabel,
      locationRowKey: locationPlacement.locationKey,
      eventLocationLabel: locationPlacement.eventLocationLabel,
      eventLocationKey: locationPlacement.eventLocationKey,
      coreLocationLabel: locationPlacement.coreLocationLabel,
      childLocation: locationPlacement.sublocationLabel,
      childLocationLabel: locationPlacement.sublocationLabel,
      sublocation: locationPlacement.sublocationLabel,
      sublocationLabel: locationPlacement.sublocationLabel,
      orbitalBand: locationPlacement.orbitalBand,
      locationScope: locationPlacement.locationScope,
      locationWarning: locationPlacement.warning,
      date: metadata.date,
      time: metadata.time,
      people: metadata.people,
      sceneBeats: metadata.sceneBeats,
      criticalEvents: metadata.criticalEvents,
      customMetadata: metadata.customMetadata,
      linkedEntityNames: mergeWorldSpinePresenceEntityNames(
        worldNode.linkedEntityNames,
        entityPresenceByNodeId,
        nodeId,
      ),
      primaryBlockId,
      lineNumbers: normalizeNumberList(worldNode.lineNumbers),
      hasPassage: Boolean(primaryBlockId),
      x: startX + (index * SCENE_GAP),
      y: EVENT_BLOCK_ROW_Y - (PRIMARY_NODE_HEIGHT / 2),
      width: PRIMARY_NODE_WIDTH,
      height: PRIMARY_NODE_HEIGHT,
      isSelected: selectedNodeId === normalizeString(worldNode.id) || (primaryBlockId && selectedBlockId === primaryBlockId),
    };
    nodes.push(node);
  });

  return { nodes, connections };
}

function resolveWorldOnlySequenceRank(worldNode, fallbackRank) {
  const sequenceRank = Number(worldNode?.sequenceRank);
  if (Number.isFinite(sequenceRank)) {
    return sequenceRank;
  }

  const timelineSlotIndex = Number(worldNode?.timelineSlotIndex);
  if (Number.isFinite(timelineSlotIndex)) {
    return timelineSlotIndex - 0.5;
  }

  return Number.isFinite(Number(fallbackRank)) ? Number(fallbackRank) : Number.MAX_SAFE_INTEGER;
}

function deriveWorldOnlyNodeMetadata(worldNode) {
  const location = readMetadataString(worldNode, ["location", "locationLabel", "eventLocationLabel", "place", "setting"]);
  const sublocation = readMetadataString(worldNode, ["childLocation", "childLocationLabel", "sublocation", "subLocation", "sublocationLabel", "specificLocation", "localPlace", "ship", "vehicle"]);
  const orbitalBand = readMetadataString(worldNode, ["orbitalBand", "orbit", "orbitalPosition", "position"]);
  const date = readMetadataString(worldNode, ["date", "storyDate", "eventDate"]);
  const time = readMetadataString(worldNode, ["time", "storyTime", "eventTime"]);
  const people = readMetadataList(worldNode, ["people", "characters", "charactersPresent", "peoplePresent"]);
  const sceneBeats = readMetadataList(worldNode, ["sceneBeats", "sceneBeat", "beats", "storyBeats"]);
  const criticalEvents = readMetadataList(worldNode, ["criticalEvents", "criticalEvent", "importantEvents", "majorEvents"]);
  const deaths = readMetadataList(worldNode, ["deaths", "casualties"]);
  const customMetadata = [
    ...buildWorldNodeCustomMetadataRows(worldNode),
    ...deaths.map((death, index) => ({
      id: `death-${index + 1}`,
      label: "Death",
      value: death,
    })),
  ];
  return {
    location,
    sublocation,
    orbitalBand,
    locationRowLabel: readMetadataString(worldNode, ["locationRowLabel", "timelineRowLabel", "assignedLocationRow"]),
    locationRowKey: readMetadataString(worldNode, ["locationRowKey", "timelineRowKey", "assignedLocationRowKey"]),
    locationScope: readMetadataString(worldNode, ["locationScope", "timelineLocationScope"]),
    date,
    time,
    people,
    sceneBeats,
    criticalEvents,
    customMetadata,
  };
}

function buildWorldNodeCustomMetadataRows(worldNode) {
  const metadata = worldNode?.metadata && typeof worldNode.metadata === "object" ? worldNode.metadata : {};
  const customMetadata = worldNode?.customMetadata && typeof worldNode.customMetadata === "object" && !Array.isArray(worldNode.customMetadata)
    ? worldNode.customMetadata
    : {};
  const rows = [];

  for (const source of [metadata.customMetadata, customMetadata].filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))) {
    for (const [key, value] of Object.entries(source)) {
      const id = normalizeString(key);
      const text = normalizeString(value);
      if (id && text) {
        rows.push({
          id,
          label: formatCustomMetadataLabel(id),
          value: text,
        });
      }
    }
  }

  for (const key of ["newCharacters", "consequence", "reversibility"]) {
    const values = normalizeStringList(metadata[key] ?? worldNode?.[key]);
    values.forEach((value, index) => {
      rows.push({
        id: `${key}-${index + 1}`,
        label: formatCustomMetadataLabel(key),
        value,
      });
    });
  }

  return rows;
}

function resolveWorldOnlyPrimaryBlockId(worldNode) {
  return (
    normalizeString(worldNode?.primaryBlockId) ||
    normalizeString(worldNode?.eventStartAnchor?.blockId) ||
    normalizeString(worldNode?.eventEndAnchor?.blockId) ||
    normalizeString(worldNode?.manuscriptAnchors?.[0]?.blockId)
  );
}

function deriveSceneTimelineMetadata(scene, { events = [], characters = [], entities = [], customMetadataDefinitions = [] } = {}) {
  const explicitPeople = readMetadataList(scene, [
    "people",
    "peoplePresent",
    "characters",
    "charactersPresent",
    "cast",
  ]);
  const speakerPeople = normalizeStringList(
    (Array.isArray(scene.blocks) ? scene.blocks : []).map((block) => block?.speakerLabel),
  ).filter((speaker) => !/^unnamed speaker$/i.test(speaker));
  const titlePeople = parseTitlePeople(scene.sceneTitle);
  const characterNames = characters
    .map((character) => normalizeString(character.name))
    .filter((name) => name && sceneMentionsText(scene, name));
  const people = uniqueStrings([
    ...explicitPeople,
    ...speakerPeople,
    ...titlePeople,
    ...characterNames,
  ]).slice(0, 8);
  const linkedEntityNames = uniqueStrings(
    (Array.isArray(entities) ? entities : [])
      .map((entity) => normalizeString(entity.name))
      .filter(Boolean),
  );
  const authoredCriticalEvents = uniqueStrings(readMetadataList(scene, [
    "criticalEvents",
    "criticalEvent",
    "importantEvents",
    "majorEvents",
  ])).slice(0, 6);
  const sceneBeats = uniqueStrings(readMetadataList(scene, [
    "sceneBeats",
    "sceneBeat",
    "beats",
    "beatSheet",
    "storyBeats",
  ])).slice(0, 8);

  return {
    location: readMetadataString(scene, [
      "location",
      "locationLabel",
      "eventLocationLabel",
      "storyLocation",
      "place",
      "setting",
      "locality",
    ]) || inferLocationFromEntities(entities),
    sublocation: readMetadataString(scene, [
      "childLocation",
      "childLocationLabel",
      "sublocation",
      "subLocation",
      "sublocationLabel",
      "specificLocation",
      "localPlace",
      "ship",
      "vehicle",
    ]),
    orbitalBand: readMetadataString(scene, [
      "orbitalBand",
      "orbit",
      "orbitalPosition",
      "position",
    ]),
    locationRowLabel: readMetadataString(scene, [
      "locationRowLabel",
      "timelineRowLabel",
      "assignedLocationRow",
    ]),
    locationRowKey: readMetadataString(scene, [
      "locationRowKey",
      "timelineRowKey",
      "assignedLocationRowKey",
    ]),
    locationScope: readMetadataString(scene, [
      "locationScope",
      "timelineLocationScope",
    ]),
    date: readMetadataString(scene, [
      "date",
      "storyDate",
      "timelineDate",
      "chronologyDate",
    ]) || inferDateFromText(scene),
    time: readMetadataString(scene, [
      "time",
      "storyTime",
      "timelineTime",
      "chronologyTime",
    ]) || inferTimeFromText(scene),
    people,
    sceneBeats,
    criticalEvents: uniqueStrings([
      ...authoredCriticalEvents,
      ...events.map((eventTag) => normalizeString(eventTag.label)),
    ]).slice(0, 6),
    authoredCriticalEvents,
    locationChanges: readMetadataList(scene, [
      "locationChanges",
      "locationChange",
      "settingChanges",
      "placeChanges",
    ]).slice(0, 6),
    customMetadata: buildSceneCustomMetadataRows(scene, customMetadataDefinitions),
    linkedEntityNames,
  };
}

function buildCompactManuscriptModel(scenes, selectedBlockId) {
  return {
    scenes: (Array.isArray(scenes) ? scenes : []).map((scene) => ({
      sceneId: normalizeString(scene.sceneId),
      sceneTitle: normalizeString(scene.sceneTitle) || "Untitled scene",
      blocks: (Array.isArray(scene.blocks) ? scene.blocks : []).map((block) => {
        const text = normalizeWhitespace(block?.text).slice(0, 220);
        const kind = normalizeString(block?.kind);
        const lineNumber = Number(block?.lineNumber);
        return {
          blockId: normalizeString(block?.blockId),
          lineLabel: Number.isFinite(lineNumber) ? `L${lineNumber}` : "Draft",
          kindLabel: kind === "dialogue" ? normalizeString(block?.speakerLabel) || "Dialogue" : "Narration",
          text: text || "Blank passage",
          isSelected: normalizeString(block?.blockId) === normalizeString(selectedBlockId),
        };
      }),
    })),
  };
}

// Intent: derive a focused manuscript window from the clicked event's stable block anchor.
function buildWorldSpineEventManuscriptSection({
  scenes = [],
  nodes = [],
  selectedNodeId = "",
  selectedBlockId = "",
} = {}) {
  const safeScenes = Array.isArray(scenes) ? scenes.filter(Boolean) : [];
  const safeNodes = Array.isArray(nodes) ? nodes.filter(Boolean) : [];
  const normalizedSelectedNodeId = normalizeString(selectedNodeId);
  const normalizedSelectedBlockId = normalizeString(selectedBlockId);
  const selectedNode = normalizedSelectedNodeId
    ? safeNodes.find((node) => normalizeString(node?.id) === normalizedSelectedNodeId)
    : null;
  const blockId = resolveWorldSpineEventSectionBlockId(selectedNode, normalizedSelectedBlockId);
  const scene = resolveWorldSpineEventSectionScene(safeScenes, selectedNode, blockId);
  const baseSection = createEmptyWorldSpineEventManuscriptSection(selectedNode, blockId);

  if (!selectedNode && !normalizedSelectedBlockId) {
    return baseSection;
  }

  if (!scene) {
    return {
      ...baseSection,
      hasSelection: true,
      emptyReason: "This event is not linked to a manuscript section yet.",
    };
  }

  const blocks = Array.isArray(scene.blocks) ? scene.blocks.filter(Boolean) : [];
  if (!blocks.length) {
    return {
      ...baseSection,
      hasSelection: true,
      sceneId: normalizeString(scene.sceneId),
      sceneTitle: normalizeString(scene.sceneTitle) || "Untitled scene",
      chapterId: normalizeString(scene.chapterId),
      chapterTitle: normalizeString(scene.chapterTitle) || normalizeString(selectedNode?.chapterTitle),
      emptyReason: "This scene has no manuscript blocks yet.",
    };
  }

  const explicitBlockIndex = blockId
    ? blocks.findIndex((block) => normalizeString(block?.blockId) === blockId)
    : -1;
  const anchorIndex = explicitBlockIndex >= 0 ? explicitBlockIndex : 0;
  const startIndex = Math.max(0, anchorIndex - EVENT_SECTION_CONTEXT_BEFORE_BLOCKS);
  const endIndex = Math.min(blocks.length, anchorIndex + EVENT_SECTION_CONTEXT_AFTER_BLOCKS + 1);
  const anchorBlockId = normalizeString(blocks[anchorIndex]?.blockId) || blockId;

  return {
    ...baseSection,
    hasSelection: true,
    hasPassage: true,
    nodeId: normalizeString(selectedNode?.id),
    blockId: anchorBlockId,
    chapterId: normalizeString(scene.chapterId),
    chapterTitle: normalizeString(scene.chapterTitle) || normalizeString(selectedNode?.chapterTitle),
    sceneId: normalizeString(scene.sceneId),
    sceneTitle: normalizeString(scene.sceneTitle) || normalizeString(selectedNode?.sceneTitle) || "Untitled scene",
    location: normalizeString(selectedNode?.location) || readMetadataString(scene, ["location", "storyLocation", "place", "setting", "locality"]),
    omittedBeforeCount: startIndex,
    omittedAfterCount: Math.max(0, blocks.length - endIndex),
    blocks: blocks.slice(startIndex, endIndex).map((block, index) =>
      createWorldSpineEventSectionBlockModel(block, {
        isAnchor: normalizeString(block?.blockId) === anchorBlockId || (!anchorBlockId && startIndex + index === anchorIndex),
      }),
    ),
  };
}

function createEmptyWorldSpineEventManuscriptSection(selectedNode = null, blockId = "") {
  const title = normalizeString(selectedNode?.title);
  const typeLabel = normalizeString(selectedNode?.typeLabel);
  return {
    hasSelection: Boolean(selectedNode),
    hasPassage: false,
    nodeId: normalizeString(selectedNode?.id),
    blockId: normalizeString(blockId),
    scopeLabel: title ? `${typeLabel || "Event"}: ${title}` : "",
    chapterId: "",
    chapterTitle: normalizeString(selectedNode?.chapterTitle),
    sceneId: normalizeString(selectedNode?.sceneId),
    sceneTitle: normalizeString(selectedNode?.sceneTitle),
    location: normalizeString(selectedNode?.location),
    omittedBeforeCount: 0,
    omittedAfterCount: 0,
    blocks: [],
    emptyReason: selectedNode
      ? "This event is not linked to a manuscript section yet."
      : "Select a timeline event to view its manuscript section.",
  };
}

function resolveWorldSpineEventSectionBlockId(selectedNode = null, selectedBlockId = "") {
  return (
    normalizeString(selectedNode?.primaryBlockId) ||
    normalizeString(selectedNode?.eventStartAnchor?.blockId) ||
    normalizeString(selectedNode?.eventEndAnchor?.blockId) ||
    normalizeString(selectedNode?.manuscriptAnchors?.[0]?.blockId) ||
    normalizeString(selectedBlockId)
  );
}

function resolveWorldSpineEventSectionScene(scenes = [], selectedNode = null, blockId = "") {
  const normalizedBlockId = normalizeString(blockId);
  if (normalizedBlockId) {
    const sceneByBlock = scenes.find((scene) =>
      (Array.isArray(scene?.blocks) ? scene.blocks : [])
        .some((block) => normalizeString(block?.blockId) === normalizedBlockId),
    );
    if (sceneByBlock) {
      return sceneByBlock;
    }
  }

  const selectedSceneId = normalizeString(selectedNode?.sceneId);
  return selectedSceneId
    ? scenes.find((scene) => normalizeString(scene?.sceneId) === selectedSceneId) ?? null
    : null;
}

function createWorldSpineEventSectionBlockModel(block = {}, { isAnchor = false } = {}) {
  const kind = normalizeString(block?.kind);
  const lineNumber = Number(block?.lineNumber);
  const text = normalizeWhitespace(block?.text);
  return {
    blockId: normalizeString(block?.blockId),
    lineLabel: Number.isFinite(lineNumber) ? `L${lineNumber}` : "Draft",
    kindLabel: kind === "dialogue" ? normalizeString(block?.speakerLabel) || "Dialogue" : "Narration",
    text: text || "Blank passage",
    isAnchor: Boolean(isAnchor),
  };
}

function createPrimaryNodeTimelineTick(node) {
  return {
    left: node.x + (node.width / 2) - CANVAS_PADDING_X + 40,
    primaryLabel: node.time || node.date || createTimelineNodeFallbackLabel(node),
    secondaryLabel: node.location || node.title,
  };
}

function createTimelineNodeFallbackLabel(node) {
  const suffix = String((node.sourceId || node.id || "").split("-").pop() || "").replace(/^0+/, "");
  return node.kind === "scene" ? `S${suffix}` : `W${suffix}`;
}

function formatWorldSpineChapterAnchorTitle(node) {
  const title = normalizeString(node?.chapterTitle);
  if (title) {
    return title;
  }

  const chapterId = normalizeString(node?.chapterId);
  const numericSuffix = chapterId.match(/\d+/g)?.pop();
  return numericSuffix ? `Chapter ${Number(numericSuffix)}` : "Untitled chapter";
}

function resolveNodeLeft(node) {
  const left = Number(node?.x ?? node?.left);
  return Number.isFinite(left) ? left : 0;
}

function resolveNodeWidth(node) {
  const width = Number(node?.width);
  return Number.isFinite(width) && width > 0 ? width : PRIMARY_NODE_WIDTH;
}

function resolveNodeCenterX(node) {
  const centerX = Number(node?.centerX);
  return Number.isFinite(centerX)
    ? centerX
    : resolveNodeLeft(node) + (resolveNodeWidth(node) / 2);
}

function createWorldSpineTimelineTiers(worldSpines = []) {
  const normalizedSpines = (Array.isArray(worldSpines) ? worldSpines : [])
    .map((spine, index) => normalizeSpineAsTimelineTierSource(spine, index))
    .filter(Boolean);
  const sources = normalizedSpines.length
    ? normalizedSpines
    : [normalizeSpineAsTimelineTierSource({
      id: DEFAULT_WORLD_SPINE_ID,
      label: "World Spine",
      kind: "thread",
    }, 0)];
  const hasMultipleTiers = sources.length > 1;

  return sources.map((source, index) => normalizeTimelineTier({
    ...source,
    tierIndex: index,
    eventBlockRowY: hasMultipleTiers
      ? EVENT_BLOCK_ROW_Y + (index * MULTI_TIER_ROW_GAP)
      : EVENT_BLOCK_ROW_Y,
  }, index));
}

function normalizeSpineAsTimelineTierSource(spine, index = 0) {
  const label = normalizeString(spine?.label ?? spine?.name) || (index === 0 ? "World Spine" : `Timeline ${index + 1}`);
  const id = normalizeString(spine?.id) || (index === 0 ? DEFAULT_WORLD_SPINE_ID : `spine-${String(index + 1).padStart(4, "0")}`);
  if (!id) {
    return null;
  }

  return {
    spineId: id,
    label,
    kind: normalizeString(spine?.kind) || "thread",
    locationLabel: normalizeString(spine?.localityLabel ?? spine?.location),
  };
}

function normalizeTimelineTier(tier, fallbackIndex = 0) {
  const tierIndex = Number.isFinite(Number(tier?.tierIndex)) ? Number(tier.tierIndex) : fallbackIndex;
  return {
    spineId: normalizeString(tier?.spineId ?? tier?.id) || (tierIndex === 0 ? DEFAULT_WORLD_SPINE_ID : `spine-${String(tierIndex + 1).padStart(4, "0")}`),
    label: normalizeString(tier?.label ?? tier?.spineLabel) || (tierIndex === 0 ? "World Spine" : `Timeline ${tierIndex + 1}`),
    kind: normalizeString(tier?.kind) || "thread",
    locationLabel: normalizeString(tier?.locationLabel ?? tier?.localityLabel ?? tier?.location),
    tierIndex,
    eventBlockRowY: Number.isFinite(Number(tier?.eventBlockRowY))
      ? Number(tier.eventBlockRowY)
      : EVENT_BLOCK_ROW_Y + (tierIndex * MULTI_TIER_ROW_GAP),
  };
}

// Intent: let theme settings define which catalogue categories act as core planetary rows versus scoped sublocations.
function normalizeWorldSpineLocationThemeSettings(world = {}) {
  const source = [
    world?.timelineSettings?.locationTheme,
    world?.locationTheme,
    world?.settings?.locationTheme,
  ].find((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate)) ?? {};
  return {
    locationScope: normalizeString(source.locationScope ?? source.coreLocationScope) || DEFAULT_LOCATION_SCOPE,
    coreLocationCategories: normalizeStringList(source.coreLocationCategories ?? source.coreCategories).length
      ? normalizeStringList(source.coreLocationCategories ?? source.coreCategories)
      : [...DEFAULT_CORE_LOCATION_CATEGORIES],
    sublocationCategories: normalizeStringList(source.sublocationCategories ?? source.subLocationCategories).length
      ? normalizeStringList(source.sublocationCategories ?? source.subLocationCategories)
      : [...DEFAULT_SUBLOCATION_CATEGORIES],
  };
}

function buildWorldSpineLocationHierarchyIndex(entities = [], locationTheme = {}) {
  const coreCategories = new Set(normalizeStringList(locationTheme.coreLocationCategories).map((item) => item.toLowerCase()));
  const sublocationCategories = new Set(normalizeStringList(locationTheme.sublocationCategories).map((item) => item.toLowerCase()));
  const coreLocationsByKey = new Map();
  const sublocationsByKey = new Map();

  for (const entity of Array.isArray(entities) ? entities : []) {
    const categoryId = normalizeWorldSpineEntityCategoryId(entity);
    const label = normalizeString(entity?.name);
    const key = normalizeLocationKey(label);
    if (!label || !key) {
      continue;
    }

    const entry = {
      label,
      key,
      categoryId,
      parentLabel: readWorldSpineEntityFieldString(entity, [
        "parentPlace",
        "parentLocation",
        "planet",
        "world",
        "homeWorld",
        "homePort",
        "orbitalBody",
      ]),
    };
    if (coreCategories.has(categoryId)) {
      coreLocationsByKey.set(key, entry);
    }
    if (sublocationCategories.has(categoryId)) {
      sublocationsByKey.set(key, entry);
    }
  }

  return {
    coreLocationsByKey,
    sublocationsByKey,
  };
}

// Intent: support both built-in and user-defined catalogue category labels when resolving location hierarchy.
function normalizeWorldSpineEntityCategoryId(entity = {}) {
  const explicitCategory = normalizeString(entity?.categoryId ?? entity?.category ?? entity?.type);
  if (explicitCategory) {
    return slugify(explicitCategory);
  }

  const text = [
    entity?.templateName,
    entity?.templateId,
    entity?.categoryLabel,
    entity?.kind,
  ].map(normalizeString).join(" ").toLowerCase();
  if (/\b(planets?|worlds?|moons?)\b/.test(text)) {
    return "planet";
  }
  if (/\b(ships?|vehicles?|vessels?|craft|shuttles?|rovers?)\b/.test(text)) {
    return "vehicle";
  }
  if (/\b(locations?|settlements?|stations?|facilities?|docks?|cities?|regions?|places?)\b/.test(text)) {
    return "location";
  }
  return "custom";
}

// Intent: read structured catalogue fields regardless of whether they were saved as field arrays, maps, or top-level keys.
function readWorldSpineEntityFieldString(entity = {}, keys = []) {
  const normalizedKeys = new Set((Array.isArray(keys) ? keys : []).map(normalizeKey));
  const directValue = readMetadataString(entity, keys);
  if (directValue) {
    return directValue;
  }

  const fieldValueMaps = [
    entity?.fieldValues,
    entity?.values,
    entity?.fields && !Array.isArray(entity.fields) ? entity.fields : null,
    entity?.metadata?.fieldValues,
  ].filter((source) => source && typeof source === "object" && !Array.isArray(source));
  for (const source of fieldValueMaps) {
    for (const [key, value] of Object.entries(source)) {
      if (normalizedKeys.has(normalizeKey(key))) {
        return normalizeString(value);
      }
    }
  }

  for (const field of Array.isArray(entity?.fields) ? entity.fields : []) {
    const fieldKeys = [field?.key, field?.id, field?.name, field?.label].map(normalizeKey);
    if (fieldKeys.some((key) => normalizedKeys.has(key))) {
      return normalizeString(field?.value ?? field?.text);
    }
  }

  return "";
}

function buildExplicitWorldSpineLocationRowIndex({
  scenes = [],
  worldSpines = [],
  locationHierarchyIndex = {},
} = {}) {
  const rowsByKey = new Map();
  const addRow = (label, source = "") => {
    const rowLabel = normalizeLocationLabel(label);
    const rowKey = normalizeLocationKey(rowLabel);
    if (!rowKey || rowKey === normalizeLocationKey(DEFAULT_LOCATION_LABEL)) {
      return;
    }
    if (!rowsByKey.has(rowKey)) {
      rowsByKey.set(rowKey, { key: rowKey, label: rowLabel, source });
    }
  };

  for (const spine of Array.isArray(worldSpines) ? worldSpines : []) {
    addRow(spine?.localityLabel ?? spine?.location ?? spine?.metadata?.location, "spine");
    for (const node of Array.isArray(spine?.nodes) ? spine.nodes : []) {
      const rowAssignment = readTimelineLocationRowAssignment(node);
      addRow(rowAssignment.label, "world-node-row-assignment");
    }
  }

  for (const scene of Array.isArray(scenes) ? scenes : []) {
    const rowAssignment = readTimelineLocationRowAssignment(scene);
    addRow(rowAssignment.label, "scene-row-assignment");
  }

  return {
    rowsByKey,
    hasExplicitRows: rowsByKey.size > 0,
    locationHierarchyIndex,
  };
}

// Intent: extract explicit row placement without treating granular event location as a row assignment.
function readTimelineLocationRowAssignment(record = {}, metadata = null) {
  const sources = [
    metadata,
    record,
    record?.locationPlacement,
    record?.metadata,
    record?.worldSpineMetadata,
    record?.timelineMetadata,
    record?.metadata?.worldSpine,
    record?.metadata?.timeline,
  ].filter((source) => source && typeof source === "object" && !Array.isArray(source));
  for (const source of sources) {
    const objectAssignment = source.locationRow && typeof source.locationRow === "object" && !Array.isArray(source.locationRow)
      ? source.locationRow
      : source.timelineRow && typeof source.timelineRow === "object" && !Array.isArray(source.timelineRow)
        ? source.timelineRow
        : null;
    const label = normalizeString(
      source.locationRowLabel ??
      source.timelineRowLabel ??
      source.assignedLocationRow ??
      objectAssignment?.label,
    );
    const key = normalizeString(
      source.locationRowKey ??
      source.timelineRowKey ??
      source.assignedLocationRowKey ??
      objectAssignment?.key,
    );
    const scope = normalizeString(
      source.locationScope ??
      source.timelineLocationScope ??
      objectAssignment?.scope,
    );
    if (label || key || scope) {
      return {
        label,
        key: resolveLocationRowKey(label, key),
        scope,
      };
    }
  }

  return { label: "", key: "", scope: "" };
}

// Intent: resolve a node's rendered row separately from the event's own physical or local setting.
function resolveTimelineNodeLocationPlacement({
  record = null,
  metadata = {},
  tier = {},
  locationContext = {},
} = {}) {
  const assignment = readTimelineLocationRowAssignment(record, metadata);
  const explicitRows = locationContext?.explicitLocationRowIndex?.rowsByKey instanceof Map
    ? locationContext.explicitLocationRowIndex.rowsByKey
    : new Map();
  const locationTheme = locationContext?.locationTheme && typeof locationContext.locationTheme === "object"
    ? locationContext.locationTheme
    : {};
  const hierarchy = resolveWorldSpineLocationHierarchy({
    record,
    metadata,
    locationHierarchyIndex: locationContext?.locationHierarchyIndex,
  });
  const eventLocationLabel = normalizeString(metadata?.location) || readMetadataString(record, [
    "location",
    "locationLabel",
    "eventLocationLabel",
    "storyLocation",
    "place",
    "setting",
    "locality",
  ]);
  const eventLocationKey = eventLocationLabel ? normalizeLocationKey(eventLocationLabel) : "";
  const tierLocationLabel = normalizeString(tier?.locationLabel);
  const assignedRowKey = resolveLocationRowKey(assignment.label, assignment.key);
  const assignedRow = assignedRowKey ? explicitRows.get(assignedRowKey) : null;
  const eventRow = eventLocationKey ? explicitRows.get(eventLocationKey) : null;
  const coreRow = hierarchy.coreLocationKey ? explicitRows.get(hierarchy.coreLocationKey) : null;
  const rowLabel = normalizeLocationLabel(
    assignment.label ||
    assignedRow?.label ||
    eventRow?.label ||
    coreRow?.label ||
    hierarchy.coreLocationLabel ||
    eventLocationLabel ||
    tierLocationLabel,
  );
  const rowKey = resolveLocationRowKey(rowLabel, assignment.key);
  return {
    locationLabel: rowLabel,
    locationKey: rowKey,
    eventLocationLabel,
    eventLocationKey,
    coreLocationLabel: hierarchy.coreLocationLabel,
    coreLocationKey: hierarchy.coreLocationKey,
    sublocationLabel: hierarchy.sublocationLabel,
    sublocationKey: hierarchy.sublocationKey,
    orbitalBand: hierarchy.orbitalBand,
    locationScope: assignment.scope || normalizeString(locationTheme.locationScope) || DEFAULT_LOCATION_SCOPE,
    warning: createTimelineLocationWarning({
      rowLabel,
      eventLocationLabel,
      hierarchy,
      assignment,
    }),
  };
}

// Intent: use catalogue parent fields and scene sublocation fields to explain granular locations under planetary rows.
function resolveWorldSpineLocationHierarchy({
  record = null,
  metadata = {},
  locationHierarchyIndex = {},
} = {}) {
  const coreLocationsByKey = locationHierarchyIndex?.coreLocationsByKey instanceof Map
    ? locationHierarchyIndex.coreLocationsByKey
    : new Map();
  const sublocationsByKey = locationHierarchyIndex?.sublocationsByKey instanceof Map
    ? locationHierarchyIndex.sublocationsByKey
    : new Map();
  const eventLocationLabel = normalizeString(metadata?.location) || readMetadataString(record, [
    "location",
    "locationLabel",
    "eventLocationLabel",
    "storyLocation",
    "place",
    "setting",
    "locality",
  ]);
  const sublocationLabel = normalizeString(metadata?.childLocation ?? metadata?.childLocationLabel ?? metadata?.sublocation) || readMetadataString(record, [
    "childLocation",
    "childLocationLabel",
    "sublocation",
    "subLocation",
    "sublocationLabel",
    "specificLocation",
    "localPlace",
    "ship",
    "vehicle",
  ]);
  const orbitalBand = normalizeString(metadata?.orbitalBand) || readMetadataString(record, [
    "orbitalBand",
    "orbit",
    "orbitalPosition",
    "position",
  ]);
  const explicitCoreLabel = normalizeString(metadata?.coreLocation) || readMetadataString(record, [
    "coreLocation",
    "coreLocationLabel",
    "planet",
    "parentPlace",
    "parentLocation",
    "world",
    "primaryLocation",
  ]);
  const eventLocationKey = eventLocationLabel ? normalizeLocationKey(eventLocationLabel) : "";
  const sublocationKey = sublocationLabel ? normalizeLocationKey(sublocationLabel) : "";
  const eventCore = eventLocationKey ? coreLocationsByKey.get(eventLocationKey) : null;
  const eventSublocationRecord = eventLocationKey ? sublocationsByKey.get(eventLocationKey) : null;
  const eventSublocation = eventSublocationRecord?.parentLabel ? eventSublocationRecord : null;
  const explicitSublocation = sublocationKey ? sublocationsByKey.get(sublocationKey) : null;
  const parentLabel = explicitCoreLabel ||
    eventSublocation?.parentLabel ||
    explicitSublocation?.parentLabel ||
    "";
  const parentKey = parentLabel ? normalizeLocationKey(parentLabel) : "";
  const parentCore = parentKey ? coreLocationsByKey.get(parentKey) : null;
  const embeddedCore = !parentCore && !eventCore
    ? findCoreLocationMention(eventLocationLabel, coreLocationsByKey)
    : null;
  const coreLocationLabel = normalizeString(
    eventCore?.label ||
    parentCore?.label ||
    parentLabel ||
    embeddedCore?.label,
  );
  const resolvedSublocationLabel = normalizeString(
    sublocationLabel ||
    eventSublocation?.label ||
    (!eventCore && coreLocationLabel && eventLocationLabel && normalizeLocationKey(eventLocationLabel) !== normalizeLocationKey(coreLocationLabel)
      ? eventLocationLabel
      : ""),
  );

  return {
    coreLocationLabel,
    coreLocationKey: coreLocationLabel ? normalizeLocationKey(coreLocationLabel) : "",
    sublocationLabel: resolvedSublocationLabel,
    sublocationKey: resolvedSublocationLabel ? normalizeLocationKey(resolvedSublocationLabel) : "",
    orbitalBand,
    hasHierarchyMatch: Boolean(eventCore || parentCore || explicitSublocation || eventSublocation || embeddedCore || explicitCoreLabel),
  };
}

function findCoreLocationMention(value = "", coreLocationsByKey = new Map()) {
  const text = normalizeString(value).toLowerCase();
  if (!text || !(coreLocationsByKey instanceof Map)) {
    return null;
  }

  for (const entry of coreLocationsByKey.values()) {
    const label = normalizeString(entry?.label);
    if (label && text.includes(label.toLowerCase())) {
      return entry;
    }
  }
  return null;
}

// Intent: surface unresolved row/event mismatches without forcibly moving the author's event to a new row.
function createTimelineLocationWarning({
  rowLabel = "",
  eventLocationLabel = "",
  hierarchy = {},
  assignment = {},
} = {}) {
  const rowKey = normalizeLocationKey(rowLabel);
  const eventKey = eventLocationLabel ? normalizeLocationKey(eventLocationLabel) : "";
  if (!eventKey || !rowKey || rowKey === eventKey || rowKey === normalizeLocationKey(DEFAULT_LOCATION_LABEL)) {
    return null;
  }

  const hierarchyExplainsRow = Boolean(
    hierarchy?.hasHierarchyMatch &&
    hierarchy?.coreLocationKey &&
    normalizeLocationKey(hierarchy.coreLocationKey) === rowKey,
  );
  if (hierarchyExplainsRow) {
    return null;
  }

  const message = assignment?.label
    ? `Event location "${eventLocationLabel}" is assigned to the "${rowLabel}" row but no catalogue hierarchy links them yet.`
    : `Event location "${eventLocationLabel}" does not match the "${rowLabel}" row.`;
  return {
    kind: "location-row-mismatch",
    message,
  };
}

function createTimelineTierMap(tiers = []) {
  return new Map(
    (Array.isArray(tiers) ? tiers : [])
      .map((tier, index) => normalizeTimelineTier(tier, index))
      .map((tier) => [tier.spineId, tier]),
  );
}

function createWorldSpineTimelineLocationRows(primaryNodes = [], tiers = [], {
  locationImageIndex = new Map(),
} = {}) {
  const normalizedTiers = (Array.isArray(tiers) && tiers.length ? tiers : createWorldSpineTimelineTiers([]))
    .map(normalizeTimelineTier);
  const safePrimaryNodes = Array.isArray(primaryNodes) ? primaryNodes.filter(Boolean) : [];
  const rows = [];

  normalizedTiers.forEach((tier) => {
    const tierNodes = safePrimaryNodes
      .filter((node) => (
        normalizeString(node?.spineId) === tier.spineId ||
        Number(node?.tierIndex) === tier.tierIndex
      ))
      .sort(comparePrimaryTimelineNodes);
    const rowsForTier = new Map();

    tierNodes.forEach((node) => {
      const locationRowLabel = resolveTimelineNodeRowLocationLabel(node);
      const locationRowKey = resolveTimelineNodeRowLocationKey(node);
      node.locationRowLabel = locationRowLabel;
      node.locationRowKey = locationRowKey;
      if (isDefaultLocationIdentity(locationRowKey)) {
        return;
      }
      if (!rowsForTier.has(locationRowKey)) {
        const locationRowIndex = rows.length + rowsForTier.size;
        rowsForTier.set(locationRowKey, {
          spineId: tier.spineId,
          spineLabel: tier.label,
          tierIndex: tier.tierIndex,
          tierLocationIndex: rowsForTier.size,
          locationRowIndex,
          locationKey: locationRowKey,
          locationLabel: locationRowLabel,
          label: createLocationRowDisplayLabel(tier, locationRowLabel, normalizedTiers.length),
          locationImage: resolveWorldSpineLocationRowImage(locationImageIndex, locationRowLabel),
          eventBlockRowY: EVENT_BLOCK_ROW_Y + (locationRowIndex * LOCATION_ROW_GAP),
          primaryNodeIds: [],
          sceneIds: [],
          worldNodeIds: [],
        });
      }

      appendPrimaryNodeToLocationRow(rowsForTier.get(locationRowKey), node);
    });

    if (!rowsForTier.size && !tierNodes.length) {
      const locationRowIndex = rows.length;
      const locationLabel = normalizeLocationLabel(tier.locationLabel);
      rows.push({
        spineId: tier.spineId,
        spineLabel: tier.label,
        tierIndex: tier.tierIndex,
        tierLocationIndex: 0,
        locationRowIndex,
        locationKey: normalizeLocationKey(locationLabel),
        locationLabel,
        label: createLocationRowDisplayLabel(tier, locationLabel, normalizedTiers.length),
        locationImage: resolveWorldSpineLocationRowImage(locationImageIndex, locationLabel),
        eventBlockRowY: EVENT_BLOCK_ROW_Y + (locationRowIndex * LOCATION_ROW_GAP),
        primaryNodeIds: [],
        sceneIds: [],
        worldNodeIds: [],
        isEmptyLocationPrompt: true,
      });
    } else {
      rows.push(...rowsForTier.values());
    }
  });

  return normalizeWorldSpineTimelineLocationRows(rows);
}

// Intent: keep main location rows canonical when an empty parallel tier mirrors an already-populated location.
function normalizeWorldSpineTimelineLocationRows(rows = []) {
  const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const populatedLocationKeys = new Set(
    safeRows
      .filter(hasWorldSpineLocationRowContent)
      .map((row) => resolveLocationRowKey(row.locationLabel, row.locationKey))
      .filter(Boolean),
  );
  const defaultLocationKey = normalizeLocationKey(DEFAULT_LOCATION_LABEL);
  const visibleRows = safeRows.filter((row) => {
    const locationKey = resolveLocationRowKey(row.locationLabel, row.locationKey);
    if (locationKey === defaultLocationKey && hasWorldSpineLocationRowContent(row)) {
      return false;
    }
    if (!locationKey || locationKey === defaultLocationKey || hasWorldSpineLocationRowContent(row)) {
      return true;
    }
    return !populatedLocationKeys.has(locationKey);
  });

  return visibleRows.map((row, index) => ({
    ...row,
    locationRowIndex: index,
    eventBlockRowY: EVENT_BLOCK_ROW_Y + (index * LOCATION_ROW_GAP),
  }));
}

function hasWorldSpineLocationRowContent(row = {}) {
  return (
    normalizeStringList(row.primaryNodeIds).length > 0 ||
    normalizeStringList(row.sceneIds).length > 0 ||
    normalizeStringList(row.worldNodeIds).length > 0
  );
}

function resolveWorldSpineLocationRowImage(locationImageIndex = new Map(), locationLabel = "") {
  if (!(locationImageIndex instanceof Map)) {
    return null;
  }

  return locationImageIndex.get(normalizeLocationKey(locationLabel)) ?? null;
}

// Intent: preserve the source records behind a rendered location row so naming it can mutate the right domain records.
function appendPrimaryNodeToLocationRow(row, node) {
  if (!row || !node) {
    return;
  }

  row.primaryNodeIds = uniqueStrings([...(Array.isArray(row.primaryNodeIds) ? row.primaryNodeIds : []), node.id]);
  if (node.kind === "scene" && normalizeString(node.sceneId)) {
    row.sceneIds = uniqueStrings([...(Array.isArray(row.sceneIds) ? row.sceneIds : []), node.sceneId]);
  }
  if (node.kind === "world" && normalizeString(node.sourceId)) {
    row.worldNodeIds = uniqueStrings([...(Array.isArray(row.worldNodeIds) ? row.worldNodeIds : []), node.sourceId]);
  }
}

function createLocationRowDisplayLabel(tier, locationLabel, tierCount = 1) {
  return formatLocationRowChipLabel(locationLabel);
}

function formatLocationRowChipLabel(locationLabel) {
  const safeLocationLabel = normalizeLocationLabel(locationLabel);
  return isDefaultLocationIdentity(safeLocationLabel)
    ? DEFAULT_LOCATION_ROW_PROMPT
    : safeLocationLabel;
}

function normalizeLocationLabel(value) {
  return normalizeString(value) || DEFAULT_LOCATION_LABEL;
}

function normalizeLocationKey(value) {
  return slugify(normalizeLocationLabel(value)) || "unplaced-location";
}

// Intent: recover row identity from the author-visible label when stale default keys survive reload.
function resolveLocationRowKey(label = "", key = "") {
  const labelKey = normalizeString(label) ? normalizeLocationKey(label) : "";
  const explicitKey = normalizeString(key) ? normalizeLocationKey(key) : "";
  if (labelKey && !isDefaultLocationIdentity(labelKey)) {
    return labelKey;
  }
  if (explicitKey && !isDefaultLocationIdentity(explicitKey)) {
    return explicitKey;
  }
  return normalizeLocationKey(DEFAULT_LOCATION_LABEL);
}

function isDefaultLocationIdentity(value = "") {
  const key = normalizeLocationKey(value);
  return (
    key === normalizeLocationKey(DEFAULT_LOCATION_LABEL) ||
    key === normalizeLocationKey(DEFAULT_LOCATION_ROW_PROMPT)
  );
}

function isTimelineNodeUnplaced(node = {}) {
  return isDefaultLocationIdentity(resolveTimelineNodeRowLocationKey(node));
}

// Intent: keep canonical graph records complete while limiting the scrolling canvas to visible real-row records.
function createWorldSpineCanvasProjection({
  nodes = [],
  primaryNodes = [],
  connections = [],
  unplacedPrimaryNodes = [],
} = {}) {
  const hiddenPrimaryNodeIds = new Set(
    (Array.isArray(unplacedPrimaryNodes) ? unplacedPrimaryNodes : [])
      .map((node) => normalizeString(node?.id))
      .filter(Boolean),
  );
  const hiddenNodeIds = new Set(hiddenPrimaryNodeIds);
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (hiddenPrimaryNodeIds.has(normalizeString(node?.parentNodeId))) {
      hiddenNodeIds.add(normalizeString(node?.id));
    }
  }

  const canvasNodes = (Array.isArray(nodes) ? nodes : [])
    .filter((node) => !hiddenNodeIds.has(normalizeString(node?.id)));
  const canvasNodeIds = new Set(canvasNodes.map((node) => normalizeString(node?.id)).filter(Boolean));
  return {
    primaryNodes: (Array.isArray(primaryNodes) ? primaryNodes : [])
      .filter((node) => !hiddenPrimaryNodeIds.has(normalizeString(node?.id))),
    nodes: canvasNodes,
    connections: (Array.isArray(connections) ? connections : [])
      .filter((connection) => (
        canvasNodeIds.has(normalizeString(connection?.fromNodeId)) &&
        canvasNodeIds.has(normalizeString(connection?.toNodeId))
      )),
  };
}

// Intent: keep the card's event setting separate from the row used to stack timeline lanes.
function resolveTimelineNodeDisplayLocationLabel(locationPlacement = {}) {
  return normalizeLocationLabel(locationPlacement.eventLocationLabel || locationPlacement.locationLabel);
}

// Intent: centralize row identity so layout, filters, and drop zones do not read the event location by mistake.
function resolveTimelineNodeRowLocationLabel(node = {}) {
  return normalizeLocationLabel(node?.locationRowLabel || node?.locationLabel || node?.location);
}

function resolveTimelineNodeRowLocationKey(node = {}) {
  return resolveLocationRowKey(resolveTimelineNodeRowLocationLabel(node), node?.locationRowKey);
}

function resolveEventTagLocationLabel(eventTag, parent) {
  return normalizeLocationLabel(
    eventTag?.locality?.label ??
    eventTag?.localityLabel ??
    eventTag?.location ??
    eventTag?.metadata?.localityLabel ??
    eventTag?.metadata?.location ??
    parent?.eventLocationLabel ??
    parent?.locationLabel ??
    parent?.location,
  );
}

function resolveWorldSpineTimelineMetrics(tiers = [], locationRows = []) {
  const normalizedRows = (Array.isArray(locationRows) ? locationRows : [])
    .map((row, index) => ({
      ...row,
      locationRowIndex: Number.isFinite(Number(row?.locationRowIndex)) ? Number(row.locationRowIndex) : index,
      eventBlockRowY: Number.isFinite(Number(row?.eventBlockRowY))
        ? Number(row.eventBlockRowY)
        : EVENT_BLOCK_ROW_Y + (index * LOCATION_ROW_GAP),
    }));
  if (normalizedRows.length) {
    const lastRowY = Math.max(...normalizedRows.map((row) => row.eventBlockRowY));
    const height = Math.max(520, Math.ceil(lastRowY + MULTI_TIER_BOTTOM_PADDING));
    return {
      height,
      mainSpineY: height - 100,
      axisY: height - 74,
    };
  }

  const normalizedTiers = (Array.isArray(tiers) && tiers.length ? tiers : createWorldSpineTimelineTiers([]))
    .map(normalizeTimelineTier);
  if (normalizedTiers.length <= 1) {
    return {
      height: 520,
      mainSpineY: MAIN_SPINE_Y,
      axisY: AXIS_Y,
    };
  }

  const lastRowY = Math.max(...normalizedTiers.map((tier) => tier.eventBlockRowY));
  const height = Math.max(520, Math.ceil(lastRowY + MULTI_TIER_BOTTOM_PADDING));
  return {
    height,
    mainSpineY: height - 100,
    axisY: height - 74,
  };
}

function resolveTimelineTierEventBlockRowY(node, timelineTiers = [], locationRows = []) {
  const row = resolveTimelineLocationRowForNode(node, locationRows);
  if (row) {
    return row.eventBlockRowY;
  }

  const tiers = Array.isArray(timelineTiers) && timelineTiers.length
    ? timelineTiers.map(normalizeTimelineTier)
    : createWorldSpineTimelineTiers([]);
  const nodeSpineId = normalizeString(node?.spineId);
  const nodeTierIndex = Number(node?.tierIndex);
  const tier =
    (nodeSpineId ? tiers.find((candidate) => candidate.spineId === nodeSpineId) : null) ||
    (Number.isFinite(nodeTierIndex) ? tiers.find((candidate) => candidate.tierIndex === nodeTierIndex) : null) ||
    tiers[0];
  return Number.isFinite(Number(tier?.eventBlockRowY)) ? Number(tier.eventBlockRowY) : EVENT_BLOCK_ROW_Y;
}

function resolveTimelineLocationRowForNode(node, locationRows = []) {
  const rows = Array.isArray(locationRows) ? locationRows : [];
  const nodeSpineId = normalizeString(node?.spineId);
  const nodeTierIndex = Number(node?.tierIndex);
  const nodeLocationKey = resolveTimelineNodeRowLocationKey(node);
  return rows.find((row) => (
    normalizeString(row?.spineId) === nodeSpineId &&
    resolveLocationRowKey(row?.locationLabel, row?.locationKey) === nodeLocationKey
  )) ?? rows.find((row) => (
    Number.isFinite(nodeTierIndex) &&
    Number(row?.tierIndex) === nodeTierIndex &&
    resolveLocationRowKey(row?.locationLabel, row?.locationKey) === nodeLocationKey
  )) ?? null;
}

function resolveTimelineLocationRowForCanvasY(locationRows = [], canvasY = 0) {
  const rows = (Array.isArray(locationRows) ? locationRows : [])
    .filter(Boolean)
    .map((row, index) => ({
      ...row,
      locationRowIndex: Number.isFinite(Number(row?.locationRowIndex)) ? Number(row.locationRowIndex) : index,
      eventBlockRowY: Number.isFinite(Number(row?.eventBlockRowY))
        ? Number(row.eventBlockRowY)
        : EVENT_BLOCK_ROW_Y + (index * LOCATION_ROW_GAP),
    }));
  if (!rows.length) {
    return null;
  }

  const safeCanvasY = Number(canvasY) || 0;
  return rows.reduce((nearest, row) => {
    const nearestDistance = Math.abs(nearest.eventBlockRowY - safeCanvasY);
    const rowDistance = Math.abs(row.eventBlockRowY - safeCanvasY);
    return rowDistance < nearestDistance ? row : nearest;
  }, rows[0]);
}

function resolveTimelineTierForCanvasY(tiers = [], canvasY = 0) {
  const normalizedTiers = (Array.isArray(tiers) && tiers.length ? tiers : createWorldSpineTimelineTiers([]))
    .map(normalizeTimelineTier);
  const safeCanvasY = Number(canvasY) || 0;
  return normalizedTiers.reduce((nearest, tier) => {
    const nearestDistance = Math.abs(nearest.eventBlockRowY - safeCanvasY);
    const tierDistance = Math.abs(tier.eventBlockRowY - safeCanvasY);
    return tierDistance < nearestDistance ? tier : nearest;
  }, normalizedTiers[0]);
}

function resolveTimelineDropZoneForContextPoint({
  dropZones = [],
  canvasX = 0,
  canvasY = 0,
  tier = null,
} = {}) {
  const normalizedTier = normalizeTimelineTier({
    ...tier,
    label: normalizeString(tier?.spineLabel) || tier?.label,
  }, 0);
  const tierLocationKey = normalizeString(tier?.locationKey)
    ? resolveLocationRowKey(tier.locationLabel, tier.locationKey)
    : normalizeString(tier?.locationLabel)
      ? normalizeLocationKey(tier.locationLabel)
      : "";
  const zones = (Array.isArray(dropZones) ? dropZones : [])
    .filter((zone) => normalizeString(zone?.spineId) === normalizedTier.spineId)
    .filter((zone) => !tierLocationKey || resolveLocationRowKey(zone?.locationLabel, zone?.locationKey) === tierLocationKey)
    .filter((zone) => Number.isFinite(Number(zone?.left)) && Number.isFinite(Number(zone?.width)));
  const safeCanvasX = Number(canvasX) || 0;
  const safeCanvasY = Number(canvasY) || 0;
  const directZone = zones.find((zone) => (
    safeCanvasX >= Number(zone.left) &&
    safeCanvasX <= Number(zone.left) + Number(zone.width) &&
    safeCanvasY >= Number(zone.top) &&
    safeCanvasY <= Number(zone.top) + Number(zone.height)
  ));
  if (directZone) {
    return directZone;
  }

  return zones.reduce((nearest, zone) => {
    const zoneCenterX = Number(zone.left) + (Number(zone.width) / 2);
    const nearestCenterX = Number(nearest.left) + (Number(nearest.width) / 2);
    return Math.abs(zoneCenterX - safeCanvasX) < Math.abs(nearestCenterX - safeCanvasX) ? zone : nearest;
  }, zones[0] ?? {
    index: 0,
    spineId: normalizedTier.spineId,
    spineLabel: normalizedTier.label,
    tierIndex: normalizedTier.tierIndex,
  });
}

function layoutPrimaryTimelineNodes(primaryNodes = [], childNodes = [], referenceNodes = [], connections = [], {
  timelineTiers = [],
  timelineLocationRows = [],
} = {}) {
  const originalPositionByNodeId = new Map(primaryNodes.map((node) => [node.id, {
    x: node.x,
    y: node.y,
  }]));
  const orderedPrimaryNodes = [...primaryNodes].sort(comparePrimaryTimelineNodes);
  const deltaByPrimaryNodeId = new Map();

  orderedPrimaryNodes.forEach((node, index) => {
    const previousPosition = originalPositionByNodeId.get(node.id) ?? {
      x: node.x,
      y: node.y,
    };
    node.x = CANVAS_PADDING_X + (index * SCENE_GAP);
    node.y = resolveTimelineTierEventBlockRowY(node, timelineTiers, timelineLocationRows) - (node.height / 2);
    deltaByPrimaryNodeId.set(node.id, {
      x: node.x - previousPosition.x,
      y: node.y - previousPosition.y,
    });
  });

  const deltaByDependentNodeId = new Map();
  for (const connection of connections) {
    const delta = deltaByPrimaryNodeId.get(connection.fromNodeId);
    if (!delta || (!delta.x && !delta.y)) {
      continue;
    }
    deltaByDependentNodeId.set(connection.toNodeId, delta);
  }

  for (const node of [...childNodes, ...referenceNodes]) {
    const delta = deltaByDependentNodeId.get(node.id);
    if (delta) {
      node.x += delta.x;
      node.y += delta.y;
    }
  }

  const nodesById = new Map([...orderedPrimaryNodes, ...childNodes, ...referenceNodes].map((node) => [node.id, node]));
  connections.splice(0, connections.length, ...connections
    .map((connection) => {
      const fromNode = nodesById.get(connection.fromNodeId);
      const toNode = nodesById.get(connection.toNodeId);
      return fromNode && toNode
        ? createConnection(fromNode, toNode, connection.kind, connection.dashed)
        : null;
    })
    .filter(Boolean));

  return orderedPrimaryNodes;
}

function comparePrimaryTimelineNodes(left, right) {
  return (
    resolvePrimaryTimelineRank(left) - resolvePrimaryTimelineRank(right) ||
    left.x - right.x ||
    normalizeString(left.id).localeCompare(normalizeString(right.id))
  );
}

function resolvePrimaryTimelineRank(node) {
  const sequenceRank = Number(node?.sequenceRank);
  return Number.isFinite(sequenceRank) ? sequenceRank : Number.MAX_SAFE_INTEGER;
}

function createTimelineDropZones(primaryNodes = [], width = 900, timelineTiers = [], locationRows = []) {
  const rows = Array.isArray(locationRows) ? locationRows.filter(Boolean) : [];
  if (!rows.length) {
    return [];
  }
  return rows.flatMap((row) => createTimelineDropZonesForLocationRow(primaryNodes, width, row));
}

function createTimelineDropZonesForLocationRow(primaryNodes = [], width = 900, row = null) {
  const normalizedTier = normalizeTimelineTier({
    ...row,
    label: normalizeString(row?.spineLabel) || row?.label,
  }, 0);
  const locationLabel = normalizeString(row?.locationLabel) ? normalizeLocationLabel(row.locationLabel) : "";
  const locationKey = locationLabel || normalizeString(row?.locationKey)
    ? resolveLocationRowKey(locationLabel, row?.locationKey)
    : "";
  const locationRowIndex = Number.isFinite(Number(row?.locationRowIndex)) ? Number(row.locationRowIndex) : normalizedTier.tierIndex;
  const eventBlockRowY = Number.isFinite(Number(row?.eventBlockRowY)) ? Number(row.eventBlockRowY) : normalizedTier.eventBlockRowY;
  const sortedNodes = [...(Array.isArray(primaryNodes) ? primaryNodes : [])]
    .filter((node) => Number.isFinite(node?.x) && Number.isFinite(node?.width))
    .filter((node) => normalizeString(node?.spineId) === normalizedTier.spineId)
    .filter((node) => !locationKey || resolveTimelineNodeRowLocationKey(node) === locationKey)
    .sort((left, right) => (left.x + (left.width / 2)) - (right.x + (right.width / 2)));
  const top = eventBlockRowY - 82;
  const height = 148;

  if (!sortedNodes.length) {
    return [{
      index: 0,
      left: CANVAS_PADDING_X - 70,
      top,
      width: 140,
      height,
      spineId: normalizedTier.spineId,
      spineLabel: normalizedTier.label,
      tierIndex: normalizedTier.tierIndex,
      locationRowIndex,
      locationKey,
      locationLabel,
      label: "Drop event",
    }];
  }

  const zones = [];
  for (let index = 0; index <= sortedNodes.length; index += 1) {
    const previous = sortedNodes[index - 1] ?? null;
    const next = sortedNodes[index] ?? null;
    const previousCenter = previous ? previous.x + (previous.width / 2) : CANVAS_PADDING_X - 82;
    const nextCenter = next ? next.x + (next.width / 2) : Math.min(width - CANVAS_PADDING_X + 82, previousCenter + SCENE_GAP);
    const center = previous && next
      ? previousCenter + ((nextCenter - previousCenter) / 2)
      : index === 0
        ? previousCenter
        : nextCenter;
    zones.push({
      index,
      left: Math.max(16, round(center - 42)),
      top,
      width: 84,
      height,
      spineId: normalizedTier.spineId,
      spineLabel: normalizedTier.label,
      tierIndex: normalizedTier.tierIndex,
      locationRowIndex,
      locationKey,
      locationLabel,
      label: index === sortedNodes.length ? "Drop after" : "Drop here",
    });
  }
  return zones;
}

function createTimelineImplicationConnections(edges = [], nodes = []) {
  const nodesById = new Map(
    (Array.isArray(nodes) ? nodes : [])
      .filter((node) => node?.id)
      .map((node) => [node.id, node]),
  );

  return normalizeWorldSpineEdges(edges)
    .map((edge, index) => {
      const sourceNode = nodesById.get(edge.fromNodeId);
      const targetNode = nodesById.get(edge.toNodeId);
      const fromNode = resolveImplicationDisplayNode(sourceNode, nodesById);
      const toNode = resolveImplicationDisplayNode(targetNode, nodesById);
      if (!fromNode || !toNode) {
        return null;
      }

      return createImplicationConnection(fromNode, toNode, edge, index, {
        sourceNode,
        targetNode,
        routeNodes: [...nodesById.values()],
      });
    })
    .filter(Boolean);
}

// Intent: draw saved cross-node links through the main event row even when stored endpoints are child/reference nodes.
function resolveImplicationDisplayNode(node, nodesById) {
  if (!node) {
    return null;
  }

  if (node.level === "primary") {
    return node;
  }

  const parentNodeId = normalizeString(node.parentNodeId);
  const sceneNodeId = normalizeString(node.sceneId) ? `scene:${normalizeString(node.sceneId)}` : "";
  return (
    (parentNodeId ? nodesById.get(parentNodeId) : null) ||
    (sceneNodeId ? nodesById.get(sceneNodeId) : null) ||
    findNearestPrimaryImplicationNode(node, nodesById) ||
    node
  );
}

// Intent: keep legacy or incomplete edge endpoints visually attached to the closest event block.
function findNearestPrimaryImplicationNode(node, nodesById) {
  const primaryNodes = [...nodesById.values()].filter((candidate) => candidate?.level === "primary");
  if (!primaryNodes.length) {
    return null;
  }

  const nodeCenterX = Number(node?.x) + (Number(node?.width) / 2);
  if (!Number.isFinite(nodeCenterX)) {
    return null;
  }

  return primaryNodes.reduce((nearest, candidate) => {
    const candidateCenterX = candidate.x + (candidate.width / 2);
    const nearestCenterX = nearest.x + (nearest.width / 2);
    return Math.abs(candidateCenterX - nodeCenterX) < Math.abs(nearestCenterX - nodeCenterX)
      ? candidate
      : nearest;
  }, primaryNodes[0]);
}

function createImplicationConnection(fromNode, toNode, edge, index = 0, source = {}) {
  const fromCenterX = fromNode.x + (fromNode.width / 2);
  const toCenterX = toNode.x + (toNode.width / 2);
  const leftToRight = toCenterX >= fromCenterX;
  const fromHandleSide = leftToRight ? "right" : "left";
  const toHandleSide = leftToRight ? "left" : "right";
  const fromPoint = resolveNodeLinkHandlePoint(fromNode, fromHandleSide);
  const toPoint = resolveNodeLinkHandlePoint(toNode, toHandleSide);
  const route = resolveImplicationSplineRoute(fromNode, toNode, index, source.routeNodes);
  const labelPoint = resolveImplicationLabelPoint(fromPoint, toPoint, route);

  return {
    id: edge.id,
    kind: "implication",
    dashed: false,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    renderFromNodeId: fromNode.id,
    renderToNodeId: toNode.id,
    originalFromNodeId: source.sourceNode?.id || edge.fromNodeId,
    originalToNodeId: source.targetNode?.id || edge.toNodeId,
    fromHandleSide,
    toHandleSide,
    fromPoint,
    toPoint,
    routeDirection: route.routeDirection,
    routeY: route.routeY,
    routeLane: route.routeLane,
    obstacleCount: route.obstacleCount,
    label: edge.label || edge.effect || "",
    labelX: labelPoint.x,
    labelY: labelPoint.y,
    path: createNodeGraphCurvePath(fromPoint.x, fromPoint.y, toPoint.x, toPoint.y, {
      ...route,
    }),
  };
}

// Intent: anchor saved implication paths to the visible connector-dot positions on timeline event blocks.
function resolveNodeLinkHandlePoint(node, side) {
  return {
    x: side === "right" ? node.x + node.width : node.x,
    y: node.y + (node.height / 2),
  };
}

// Intent: fan repeated saved implication curves inside the event-card row, not down on the lower time axis.
function resolveImplicationCurveOffset(fromNode, toNode, index = 0) {
  const sameRow = Math.abs(resolveEventBlockCenterY(fromNode) - resolveEventBlockCenterY(toNode)) <= 6;
  if (!sameRow) {
    return 0;
  }

  const fanOffsets = [-14, 0, 14];
  return fanOffsets[Math.abs(index) % fanOffsets.length];
}

// Intent: turn long implication edges into splines that travel around skipped primary event blocks.
function resolveImplicationSplineRoute(fromNode, toNode, index = 0, routeNodes = [], { preferredDirection = "" } = {}) {
  const fromBox = normalizeRouteNodeBox(fromNode);
  const toBox = normalizeRouteNodeBox(toNode);
  if (!fromBox || !toBox) {
    return {
      routeDirection: "inline",
      obstacleCount: 0,
      verticalOffset: 0,
    };
  }

  const obstacles = findIntermediatePrimaryRouteObstacles(fromBox, toBox, routeNodes);
  if (!obstacles.length) {
    return {
      routeDirection: "inline",
      obstacleCount: 0,
      verticalOffset: resolveImplicationCurveOffset(fromBox, toBox, index),
    };
  }

  const routeDirection = normalizeImplicationRouteDirection(preferredDirection) || resolveImplicationRouteDirection(index);
  const routeLane = Math.floor(Math.abs(index) / 2) % 3;
  return {
    routeDirection,
    routeLane,
    routeY: resolveImplicationRouteY(routeDirection, [fromBox, toBox, ...obstacles], routeLane),
    obstacleCount: obstacles.length,
    verticalOffset: 0,
  };
}

// Intent: compare timeline boxes by event-block geometry without requiring real DOM nodes.
function normalizeRouteNodeBox(node) {
  if (!node || typeof node !== "object") {
    return null;
  }

  const x = Number(node.x);
  const y = Number(node.y);
  const width = Number(node.width);
  const height = Number(node.height);
  if (![x, y, width, height].every(Number.isFinite)) {
    return null;
  }

  return {
    id: normalizeString(node.id),
    level: normalizeString(node.level),
    x,
    y,
    width,
    height,
  };
}

// Intent: identify only primary event blocks that sit between the visible source and target handles.
function findIntermediatePrimaryRouteObstacles(fromNode, toNode, routeNodes = []) {
  const fromCenterX = resolveRouteNodeCenterX(fromNode);
  const toCenterX = resolveRouteNodeCenterX(toNode);
  if (!Number.isFinite(fromCenterX) || !Number.isFinite(toCenterX) || Math.abs(toCenterX - fromCenterX) < SCENE_GAP * 1.15) {
    return [];
  }

  const leftCenterX = Math.min(fromCenterX, toCenterX);
  const rightCenterX = Math.max(fromCenterX, toCenterX);
  const endpointIds = new Set([fromNode.id, toNode.id].filter(Boolean));
  return (Array.isArray(routeNodes) ? routeNodes : [])
    .map(normalizeRouteNodeBox)
    .filter((node) => (
      node &&
      node.level === "primary" &&
      !endpointIds.has(node.id) &&
      resolveRouteNodeCenterX(node) > leftCenterX &&
      resolveRouteNodeCenterX(node) < rightCenterX
    ));
}

function resolveRouteNodeCenterX(node) {
  return Number(node?.x) + (Number(node?.width) / 2);
}

function resolveImplicationRouteDirection(index = 0) {
  return Math.abs(index) % 2 === 0 ? "below" : "above";
}

function normalizeImplicationRouteDirection(value) {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === "above" || normalized === "below" ? normalized : "";
}

function resolveImplicationRouteY(routeDirection, nodes, routeLane = 0) {
  const safeNodes = (Array.isArray(nodes) ? nodes : []).map(normalizeRouteNodeBox).filter(Boolean);
  const laneOffset = Math.max(0, Number(routeLane) || 0) * IMPLICATION_ROUTE_LANE_GAP;
  if (!safeNodes.length) {
    return EVENT_BLOCK_ROW_Y;
  }

  if (routeDirection === "above") {
    const minTop = Math.min(...safeNodes.map((node) => node.y));
    return Math.max(IMPLICATION_ROUTE_MIN_Y, minTop - IMPLICATION_ROUTE_ABOVE_GAP - laneOffset);
  }

  const maxBottom = Math.max(...safeNodes.map((node) => node.y + node.height));
  const lowerLimit = Math.max(EVENT_BLOCK_ROW_Y + 24, MAIN_SPINE_Y - IMPLICATION_ROUTE_LOWER_BUFFER);
  return Math.min(lowerLimit, maxBottom + IMPLICATION_ROUTE_BELOW_GAP + laneOffset);
}

// Intent: compare implication display rows using the event-card row instead of child/reference node rows.
function resolveEventBlockCenterY(node) {
  return node?.level === "primary" ? node.y + (node.height / 2) : EVENT_BLOCK_ROW_Y;
}

// Intent: keep saved implication labels between connected event blocks instead of near the lower timeline rail.
function resolveImplicationLabelPoint(fromPoint, toPoint, route = {}) {
  const midpointY = fromPoint.y + ((toPoint.y - fromPoint.y) / 2);
  if (Number.isFinite(route.routeY)) {
    return {
      x: fromPoint.x + ((toPoint.x - fromPoint.x) / 2),
      y: route.routeY + (route.routeDirection === "above" ? -10 : 18),
    };
  }

  const curveOffset = Number.isFinite(Number(route.verticalOffset)) ? Number(route.verticalOffset) : 0;
  const labelOffset = curveOffset < 0 ? curveOffset - 8 : curveOffset + 16;
  return {
    x: fromPoint.x + ((toPoint.x - fromPoint.x) / 2),
    y: midpointY + labelOffset,
  };
}

function createNodeGraphCurvePath(fromX, fromY, toX, toY, options = {}) {
  // Draw ComfyUI-style handle curves between nodes instead of routing through the time axis.
  const routeY = Number.isFinite(Number(options.routeY)) ? Number(options.routeY) : null;
  if (routeY !== null) {
    return createRoutedNodeGraphSplinePath(fromX, fromY, toX, toY, routeY);
  }

  const horizontalDistance = Math.abs(toX - fromX);
  const controlOffset = Math.min(180, Math.max(58, horizontalDistance * 0.5));
  const direction = toX >= fromX ? 1 : -1;
  const verticalOffset = Number.isFinite(Number(options.verticalOffset))
    ? Number(options.verticalOffset)
    : 0;
  const controlOneX = fromX + (controlOffset * direction);
  const controlTwoX = toX - (controlOffset * direction);
  return `M ${round(fromX)} ${round(fromY)} C ${round(controlOneX)} ${round(fromY + verticalOffset)}, ${round(controlTwoX)} ${round(toY + verticalOffset)}, ${round(toX)} ${round(toY)}`;
}

// Intent: give long skipped-event links enough curve segments to travel around intervening blocks.
function createRoutedNodeGraphSplinePath(fromX, fromY, toX, toY, routeY) {
  const horizontalDistance = Math.abs(toX - fromX);
  const verticalDistance = Math.max(Math.abs(routeY - fromY), Math.abs(routeY - toY));
  const direction = toX >= fromX ? 1 : -1;
  const turnDistance = Math.min(
    IMPLICATION_ROUTE_MAX_TURN_DISTANCE,
    Math.max(IMPLICATION_ROUTE_MIN_TURN_DISTANCE, horizontalDistance * 0.22, verticalDistance * 0.78),
  );
  const rawHandleDistance = Math.min(
    IMPLICATION_ROUTE_MAX_HANDLE_DISTANCE,
    Math.max(IMPLICATION_ROUTE_MIN_HANDLE_DISTANCE, turnDistance * 0.64, verticalDistance * 0.42),
  );
  const rawRouteHandleDistance = Math.min(rawHandleDistance, Math.max(18, turnDistance * 0.28));
  const maxTurnHandleDistance = Math.max(24, turnDistance * 0.9);
  const turnHandleScale = rawHandleDistance + rawRouteHandleDistance > maxTurnHandleDistance
    ? maxTurnHandleDistance / (rawHandleDistance + rawRouteHandleDistance)
    : 1;
  const handleDistance = rawHandleDistance * turnHandleScale;
  const routeHandleDistance = rawRouteHandleDistance * turnHandleScale;
  const fromTurnX = fromX + (turnDistance * direction);
  const toTurnX = toX - (turnDistance * direction);
  const bridgeDistance = Math.abs(toTurnX - fromTurnX);
  const bridgeHandle = Math.max(42, bridgeDistance * 0.32);

  return [
    `M ${round(fromX)} ${round(fromY)}`,
    `C ${round(fromX + (handleDistance * direction))} ${round(fromY)}, ${round(fromTurnX - (routeHandleDistance * direction))} ${round(routeY)}, ${round(fromTurnX)} ${round(routeY)}`,
    `C ${round(fromTurnX + (bridgeHandle * direction))} ${round(routeY)}, ${round(toTurnX - (bridgeHandle * direction))} ${round(routeY)}, ${round(toTurnX)} ${round(routeY)}`,
    `C ${round(toTurnX + (routeHandleDistance * direction))} ${round(routeY)}, ${round(toX - (handleDistance * direction))} ${round(toY)}, ${round(toX)} ${round(toY)}`,
  ].join(" ");
}

function createConnection(fromNode, toNode, kind, dashed) {
  const fromX = fromNode.x + (fromNode.width / 2);
  const fromY = fromNode.y + (fromNode.height / 2);
  const toX = toNode.x + (toNode.width / 2);
  const toY = toNode.y + (toNode.height / 2);
  const midY = fromY + ((toY - fromY) * 0.42);
  return {
    kind,
    dashed,
    fromNodeId: fromNode.id,
    toNodeId: toNode.id,
    path: `M ${round(fromX)} ${round(fromY)} C ${round(fromX)} ${round(midY)}, ${round(toX)} ${round(midY)}, ${round(toX)} ${round(toY)}`,
  };
}

function createBlockSceneIndex(scenes) {
  const index = new Map();
  for (const scene of Array.isArray(scenes) ? scenes : []) {
    for (const block of Array.isArray(scene?.blocks) ? scene.blocks : []) {
      const blockId = normalizeString(block?.blockId);
      if (blockId) {
        index.set(blockId, scene);
      }
    }
  }
  return index;
}

function groupRecordsBySceneId(records, blockSceneIndex, blockField) {
  const groups = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const blockId = normalizeString(record?.[blockField]);
    const scene = blockSceneIndex.get(blockId);
    if (!scene) {
      continue;
    }
    const list = groups.get(scene.sceneId) ?? [];
    list.push(record);
    groups.set(scene.sceneId, list);
  }
  return groups;
}

function flattenWorldSpineNodes(spines) {
  return (Array.isArray(spines) ? spines : []).flatMap((spine) =>
    (Array.isArray(spine?.nodes) ? spine.nodes : []).map((node) => ({
      ...node,
      spineId: normalizeString(node?.spineId) || normalizeString(spine?.id),
      spineLabel: normalizeString(spine?.label),
    })),
  );
}

// Intent: keep the left Story Timeline rail grouped by canonical manuscript chapters without changing node order.
function buildWorldSpineEventRailItems(nodes = []) {
  const items = [];
  const seenChapterKeys = new Set();
  let lastChapterKey = "";
  let eventNumber = 0;

  for (const node of Array.isArray(nodes) ? nodes : []) {
    const chapter = resolveWorldSpineRailChapter(node);
    if (chapter && chapter.key !== lastChapterKey && !seenChapterKeys.has(chapter.key)) {
      items.push({
        type: "chapter",
        id: `chapter:${chapter.key}`,
        chapterId: chapter.chapterId,
        title: chapter.title,
      });
      seenChapterKeys.add(chapter.key);
      lastChapterKey = chapter.key;
    } else if (chapter) {
      lastChapterKey = chapter.key;
    }

    eventNumber += 1;
    items.push({
      type: "event",
      id: normalizeString(node?.id) || `event-rail-${eventNumber}`,
      eventNumber,
      node,
    });
  }

  return items;
}

function resolveWorldSpineRailChapter(node) {
  if (
    !node ||
    normalizeString(node.level) !== "primary" ||
    normalizeString(node.kind) !== "scene"
  ) {
    return null;
  }

  const chapterId = normalizeString(node.chapterId);
  const explicitTitle = normalizeString(node.chapterTitle);
  if (!chapterId && !explicitTitle) {
    return null;
  }

  const title = explicitTitle || formatWorldSpineChapterAnchorTitle(node);
  return {
    key: chapterId || slugify(title),
    chapterId,
    title,
  };
}

function compactNodeMeta(node, { suppressDefaultRowLocation = false } = {}) {
  const sceneBeats = normalizeStringList(node.sceneBeats);
  return [
    node.time || node.date,
    formatTimelineNodeLocationMeta(node, { suppressDefaultRowLocation }),
    node.people.length ? `${node.people.length} people` : "",
    sceneBeats.length ? `${sceneBeats.length} beats` : "",
  ].filter(Boolean).join(" / ") || (node.hasPassage ? "Linked passage" : "World-only");
}

// Intent: summarize planetary row placement together with optional ship, facility, orbital, or child-location detail.
function formatTimelineNodeLocationMeta(node = {}, { suppressDefaultRowLocation = false } = {}) {
  const rowLabel = normalizeString(node.locationRowLabel);
  const eventLocationLabel = normalizeString(node.eventLocationLabel || node.locationLabel || node.location);
  const sublocationLabel = normalizeString(node.childLocationLabel || node.childLocation || node.sublocationLabel || node.sublocation);
  const orbitalBand = normalizeString(node.orbitalBand);
  const details = [];
  if (rowLabel && !(suppressDefaultRowLocation && isDefaultLocationIdentity(rowLabel))) {
    details.push(rowLabel);
  }
  if (
    eventLocationLabel &&
    !(suppressDefaultRowLocation && isDefaultLocationIdentity(eventLocationLabel)) &&
    !details.some((detail) => normalizeLocationKey(detail) === normalizeLocationKey(eventLocationLabel))
  ) {
    details.push(eventLocationLabel);
  }
  if (sublocationLabel && !details.some((detail) => normalizeLocationKey(detail) === normalizeLocationKey(sublocationLabel))) {
    details.push(sublocationLabel);
  }
  if (orbitalBand && !details.some((detail) => normalizeLocationKey(detail) === normalizeLocationKey(orbitalBand))) {
    details.push(orbitalBand);
  }
  return details.join(" / ");
}

function describeNodeBadges(node) {
  const sceneBeats = normalizeStringList(node.sceneBeats);
  return [
    node.locationWarning ? "location row mismatch" : "",
    node.hasPassage ? "anchored passage" : "",
    node.location ? "location" : "",
    node.childLocationLabel || node.sublocationLabel || node.orbitalBand ? "child location" : "",
    node.people.length ? "people present" : "",
    sceneBeats.length ? "scene beat" : "",
    node.criticalEvents.length ? "critical event" : "",
    normalizeCustomMetadataRows(node.customMetadata).length ? "custom metadata" : "",
  ].filter(Boolean).join(", ") || "no timeline badges";
}

function buildSceneCustomMetadataRows(scene, definitions = []) {
  const customMetadata = readSceneCustomMetadataMap(scene);
  const normalizedDefinitions = normalizeCustomMetadataDefinitionsForTimeline(definitions);
  const definitionById = new Map(normalizedDefinitions.map((definition) => [definition.id, definition]));
  const orderedIds = uniqueStrings([
    ...normalizedDefinitions.map((definition) => definition.id),
    ...Object.keys(customMetadata),
  ]);

  return orderedIds
    .map((id) => {
      const value = normalizeString(customMetadata[id]);
      if (!value) {
        return null;
      }

      return {
        id,
        label: definitionById.get(id)?.label ?? formatCustomMetadataLabel(id),
        value,
      };
    })
    .filter(Boolean);
}

function readSceneCustomMetadataMap(scene) {
  const sources = [
    scene?.metadata?.customMetadata,
    scene?.metadata?.worldSpine?.customMetadata,
    scene?.worldSpineMetadata?.customMetadata,
    scene?.customMetadata,
  ].filter((source) => source && typeof source === "object" && !Array.isArray(source));
  const result = {};

  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      const id = normalizeString(key);
      const text = normalizeString(value);
      if (id && text) {
        result[id] = text;
      }
    }
  }

  return result;
}

function normalizeCustomMetadataRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      id: normalizeString(row?.id),
      label: normalizeString(row?.label),
      value: normalizeString(row?.value),
    }))
    .filter((row) => row.id && row.label && row.value);
}

function normalizeCustomMetadataDefinitionsForTimeline(definitions = []) {
  const usedIds = new Set();
  const result = [];
  for (const definition of Array.isArray(definitions) ? definitions : []) {
    const id = normalizeString(definition?.id);
    const label = normalizeString(definition?.label ?? definition?.name);
    if (!id || !label || usedIds.has(id)) {
      continue;
    }

    usedIds.add(id);
    result.push({ id, label });
  }
  return result;
}

function formatCustomMetadataLabel(id) {
  const label = normalizeString(id)
    .replace(/^metadata-/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return label || "Metadata";
}

function firstMeaningfulBlockText(scene) {
  return normalizeWhitespace(
    (Array.isArray(scene?.blocks) ? scene.blocks : [])
      .map((block) => block?.text)
      .find((text) => normalizeString(text).length > 0),
  ).slice(0, 180);
}

function sceneMentionsText(scene, text) {
  const needle = normalizeString(text).toLowerCase();
  if (!needle) {
    return false;
  }

  const haystack = [
    scene?.sceneTitle,
    scene?.sceneSynopsis,
    ...(Array.isArray(scene?.blocks) ? scene.blocks.map((block) => block?.text) : []),
  ].map(normalizeString).join(" ").toLowerCase();
  return haystack.includes(needle);
}

function inferLocationFromEntities(entities) {
  const entity = (Array.isArray(entities) ? entities : []).find((candidate) =>
    classifyEntityReferenceKind(candidate) === "location"
  );
  return normalizeString(entity?.name);
}

function inferDateFromText(scene) {
  const text = [scene?.sceneTitle, scene?.sceneSynopsis].map(normalizeString).join(" ");
  const isoMatch = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (isoMatch) {
    return isoMatch[0];
  }

  const yearMatch = text.match(/\b(?:19|20|21)\d{2}\b/);
  return yearMatch?.[0] ?? "";
}

function inferTimeFromText(scene) {
  const text = [scene?.sceneTitle, scene?.sceneSynopsis].map(normalizeString).join(" ");
  return text.match(/\b\d{1,2}:\d{2}\b/)?.[0] ?? "";
}

function parseTitlePeople(title) {
  const match = normalizeString(title).match(/^\(([^)]+)\)/);
  if (!match) {
    return [];
  }

  return normalizeStringList(match[1].split(/\s*(?:\+|&|,|\/|\band\b)\s*/i));
}

function readMetadataString(record, keys) {
  const value = readMetadataValue(record, keys);
  if (Array.isArray(value)) {
    return normalizeString(value[0]);
  }
  return normalizeString(value);
}

function readMetadataList(record, keys) {
  return normalizeStringList(readMetadataValue(record, keys));
}

function readMetadataValue(record, keys) {
  const normalizedKeys = new Set(keys.map(normalizeKey));
  const sources = [
    record,
    record?.locationPlacement,
    record?.metadata,
    record?.worldSpineMetadata,
    record?.worldMetadata,
    record?.timelineMetadata,
    record?.storyMetadata,
    record?.customMetadata,
    record?.metadata?.worldSpine,
    record?.metadata?.world,
    record?.metadata?.timeline,
    record?.metadata?.story,
  ].filter((source) => source && typeof source === "object" && !Array.isArray(source));

  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (normalizedKeys.has(normalizeKey(key))) {
        return value;
      }
    }
  }

  return "";
}

function classifyEntityReferenceKind(entity) {
  const text = `${normalizeString(entity?.templateName)} ${normalizeString(entity?.name)}`.toLowerCase();
  if (/(location|planet|region|station|dock|facility|city|ship|place)/.test(text)) {
    return "location";
  }
  if (/(character|person|crew|cast)/.test(text)) {
    return "person";
  }
  return "entity";
}

function normalizeStringList(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;|]+/)
      : [];
  return uniqueStrings(source.map(normalizeString).filter(Boolean));
}

function normalizeNumberList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => Number(item))
    .filter(Number.isFinite);
}

function uniqueStrings(values) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = normalizeString(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function normalizeWhitespace(value) {
  return normalizeString(value).replace(/\s+/g, " ");
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizePanelWidth(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? Math.round(number)
    : fallback;
}

function normalizePanelCoordinate(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? Math.round(number)
    : fallback;
}

function normalizeKey(value) {
  return normalizeString(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slugify(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "reference";
}

function normalizeRect(rect) {
  const left = Number.isFinite(rect?.left) ? rect.left : 0;
  const top = Number.isFinite(rect?.top) ? rect.top : 0;
  const width = Number.isFinite(rect?.width) ? rect.width : Math.max(0, Number(rect?.right) - left);
  const height = Number.isFinite(rect?.height) ? rect.height : Math.max(0, Number(rect?.bottom) - top);
  return {
    left,
    top,
    width,
    height,
    right: Number.isFinite(rect?.right) ? rect.right : left + width,
    bottom: Number.isFinite(rect?.bottom) ? rect.bottom : top + height,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function cssEscape(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value ?? ""));
  }

  return String(value ?? "").replace(/["\\]/g, "\\$&");
}
