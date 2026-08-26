# World Spine Floating Unplaced Events Dock

Status: Approved design; implementation pending  
Date: 2026-08-26

## Decision

`Unplaced location` is a special World Spine placement state, not a normal location row.

Unplaced primary events render in one collapsible dock pinned to the bottom of the World Spine viewport. Deleting a populated location row unplaces its events; it does not delete events, scenes, manuscript text, anchors, catalogue locations, or images.

For compatibility, keep the existing internal default identity:

- label: `Unplaced location`
- key: `unplaced-location`

Do **not** add a canonical `LocationRow` object or schema migration for this feature. Instead, partition default/unplaced nodes out of normal location-row projection.

This extends the existing World Spine architecture in `apps/editor/public/features/world-spine/`; location rows remain render-time projections of canonical scene/world placement data.

## Author behaviour

| Situation | Result |
| --- | --- |
| Event has a real row placement | Renders in that normal location row. |
| Event resolves to the default/unplaced row identity | Renders only in the floating bottom dock. |
| User deletes a populated location row | Its members become unplaced and move to the dock in existing manuscript/timeline order. |
| Dock has no events | Dock is hidden. |
| Dock is expanded | Shows one `Unplaced location` header and normal-sized primary event cards. |
| Dock is collapsed | Shows only a compact `Unplaced location · N` header and expand control. |
| User filters to a real location | Hide the dock for this first implementation. |
| User chooses All locations | Show the dock when it has content. |

Dock cards use the same core primary-event card dimensions/treatment as normal World Spine cards. Do not build a second compact card system. Suppress redundant per-card `Unplaced location` copy because the dock header already communicates it once.

## Current implementation map — read this before rediscovering the feature

### `world-spine-panel.js`

Current model flow in `buildWorldSpineTimelineModel()` is:

```text
build primary nodes
-> createWorldSpineTimelineLocationRows(primaryNodes, ...)
-> resolveWorldSpineTimelineMetrics(...)
-> layoutPrimaryTimelineNodes(...)
-> build full nodes/connections/drop zones
-> renderWorldSpinePanelHTML(...)
```

Relevant existing behaviour:

- `DEFAULT_LOCATION_LABEL = "Unplaced location"`.
- `normalizeLocationLabel()`, `normalizeLocationKey()`, and `resolveLocationRowKey()` already normalize missing/default placement to the unplaced identity.
- `createWorldSpineTimelineLocationRows()` currently groups that default identity as an ordinary row.
- `normalizeWorldSpineTimelineLocationRows()` currently retains the default row.
- `comparePrimaryTimelineNodes()` / `resolvePrimaryTimelineRank()` establish chronology from `sequenceRank`, then existing fallbacks.
- `layoutPrimaryTimelineNodes()` currently assigns X globally with `CANVAS_PADDING_X + index * SCENE_GAP` and Y from the resolved location row.
- `renderWorldSpinePanelHTML()` currently renders the timeline node set inside the normal canvas.
- The viewport already owns the scrolling canvas plus detail/implication overlays; the dock belongs at this viewport level, not inside `locationRows`.
- A rendered location label already serializes `primaryNodeIds`, `sceneIds`, and `worldNodeIds` into `data-world-spine-row-*` attributes. The existing row-form context normalizes them back to the same three ID sets. Reuse them for deletion; do not invent a row ID.

### `world-spine-location-row-service.js`

Existing assignment helpers already cover scene-backed mirrors:

- `createWorldSpineLocationRowAssignment()`
- `applyWorldSpineLocationAssignmentToSceneRecord()`
- `applyWorldSpineLocationAssignmentToStructureDrafts()`
- `applyWorldSpineLocationAssignmentToSceneEventTags()`
- `upsertWorldSpineLocationAssignmentInSceneStore()`
- `applyWorldSpineLocationAssignmentToWorldPlaceLinks()`

Do not use empty-string assignment as deletion: current assignment helpers treat missing location as no-op. Add a purpose-specific **unplace** mutation that writes the default row identity to row-placement fields while preserving useful event-local semantic metadata where possible.

For scene/event records, the intended unplacement is conceptually:

```text
locationRowLabel = "Unplaced location"
locationRowKey   = "unplaced-location"
locationScope   = existing/default scope
```

Preserve `location`, child-location/sublocation, orbital, date/time, people, beats, and other event metadata when they represent useful event setting rather than only the deleted organizational row. The explicit default row identity must be authoritative enough that a preserved semantic `location` does not recreate the deleted normal row.

`applyWorldSpineLocationAssignmentToWorldPlaceLinks()` can likely be reused with the default sentinel assignment to remove stale real-place `timeline-presence` links. Only add a separate place-link unplacement helper if focused tests show the existing reconciler cannot express this safely. Never create a fake `Unplaced location` catalogue entity.

### `worldbuilding-studio.js`

`applyWorldSpineLocationRowNameToWorld()` is the existing world-backed row mutation path. Add its unplacement peer for `worldNodeIds`: preserve node ID/order/anchors/edges/event-local detail and change only row-placement identity needed to classify the node as unplaced.

Catalogue deletion remains separate. Row deletion must retain the real Location/Planet entity and its image.

### `app.js`

Do not broad-read this file. Use the existing bounded paths around:

- `world-spine-edit-location-row`
- `save-world-spine-location-row`
- `openWorldSpineLocationRowFormFromLabel()`
- `saveWorldSpineLocationRowFromForm()`
- `applyWorldSpineLocationToSceneRows()`

`saveWorldSpineLocationRowFromForm()` is the orchestration template: feature mutation -> place-link reconciliation -> `persistCurrentProjectRecord()` -> `pushWorldSpineHistoryChange()` -> rerender.

Add only thin action/confirmation/orchestration here. Field-level unplacement belongs in feature services.

### Persistence/history/filter precedents

- Persist dock collapse state beside existing World Spine UI settings, recommended key: `worldSpineUnplacedDockCollapsed`.
- `project-persistence-service.js` already compares `worldSpineEventRailWidth`, `worldSpineManuscriptPaneWidth`, `worldSpinePanelLayoutProfiles`, `worldSpineRightPaneMode`, and `worldSpineLocationFilter` in the `app-settings` domain. Follow that existing setting path; no new persistence mechanism.
- Use the existing World Spine snapshot/history path (`captureWorldSpineHistorySnapshot()` / `pushWorldSpineHistoryChange()`) so row deletion is one Undo/Redo transaction.
- Follow the existing render-only location-filter projection. A specific real-location filter hides the dock; All locations allows it.

## Model and layout contract

Partition primary events by **row identity**, not by whether they have other semantic location text:

```text
all primary nodes
      |
      +-- real row identity ------> normal locationRows
      |
      `-- default/unplaced -------> unplacedDock
```

Recommended projection shape (exact names may follow local conventions):

```js
timeline: {
  locationRows: [...],
  unplacedDock: {
    primaryNodes: [...],
    primaryNodeIds: [...],
    count: 0
  },
  ...
}
```

### One global chronology

Do not independently pack/sort dock cards.

Establish primary-node order/X coordinates from the **full** chronological primary-node set using the existing comparator. Then separate vertical/render surfaces. A node moving from Earth to unplaced should primarily drop vertically; it should not jump to a new X based on deletion order.

### No double/orphan rendering

Keep the complete model available for event rail, selection, detail panes, canonical edge lookup, and history, but the normal canvas render projection must exclude:

- unplaced primary nodes;
- child/reference display nodes owned by an unplaced primary event for this first implementation;
- normal canvas connector paths whose visible endpoints are excluded.

Otherwise the docked event or its children/lines will appear twice or leave orphan graphics in the normal canvas.

A `canvasNodes` / `canvasConnections` projection (or equivalent) is preferable to deleting those records from the full model.

Canonical child/reference records and implication edges remain intact. V1 does not need to draw cross-surface implication SVG curves between the scrolling canvas and fixed dock.

## Dock rendering contract

Render the dock as a sibling overlay inside `world-spine-timeline-viewport`, alongside the existing canvas/detail/implication surfaces.

Requirements:

- fixed to the viewport bottom during vertical World Spine scrolling;
- hidden when `count === 0`;
- one dock header with `Unplaced location`, optional count, and collapse/expand control;
- normal primary event-card size/core renderer where practical;
- cards preserve their global chronological X positions;
- dock card track shares the main timeline width/zoom coordinate system;
- main horizontal scrolling moves the dock track by the same offset; no second horizontal scrollbar;
- expanded dock reserves enough effective bottom safe area that the last real location row can scroll fully above it;
- collapsed dock keeps only the compact header and requires only the smaller corresponding safe area;
- collapse/expand changes UI state only and creates no World Spine content-history entry.

## Populated location-row delete transaction

Use the row form's existing member IDs.

```text
request delete
-> confirm
-> capture World Spine history snapshot
-> unplace affected scene-backed records
-> unplace affected world-backed nodes
-> reconcile stale real-place presence links
-> keep scenes/events/catalogue data intact
-> persist canonical project changes
-> push one World Spine history entry
-> rebuild/rerender
-> deleted row disappears; members render in dock
```

Recommended confirmation:

```text
Delete location row "Earth"?

Events and manuscript scenes in this row will not be deleted.
They will move to Unplaced location until you assign them to another location.
```

Undo restores the previous row placements and relevant place-presence links. Redo returns those members to the dock.

Preserve:

- manuscript scenes/text/anchors;
- event/world-node stable IDs and chronology;
- implication edges;
- non-place entity relationships;
- catalogue Location/Planet entities and images;
- child/sublocation/orbital and other semantic event data not solely owned by the deleted row.

## Edge cases / non-goals

- An empty parallel timeline can synthesize an empty location prompt even though it has no row members. Deleting a populated projected row must **not** delete its owning spine. Empty-spine deletion remains a separate operation if needed.
- V1 docks primary chronological event cards only; do not build a miniature child/reference graph in the dock.
- V1 may omit implication curves crossing between dock and normal canvas; keep canonical edges intact.
- No schema migration, standalone `LocationRow`, fake Unplaced catalogue entity, independent dock scrollbar, or bulk event deletion.
- No explicit `Unplaced` filter option is required in V1.

## Implementation order

1. Add focused model tests proving default/unplaced nodes are partitioned from normal location rows while retaining global chronological X order.
2. Add `unplacedDock` plus a normal-canvas render projection that prevents duplicate/orphan nodes/connections.
3. Render the viewport-level dock, horizontal sync, bottom safe area, empty state, and collapse state.
4. Persist `worldSpineUnplacedDockCollapsed` through the neighboring World Spine `app-settings` path.
5. Add the existing location-row form Delete action and confirmation.
6. Add scene-backed unplacement service mutations that preserve semantic event data but set explicit default row identity.
7. Add world-backed node unplacement and reuse/test place-link reconciliation.
8. Commit the delete as one World Spine history operation; verify Undo/Redo.
9. Verify real-location filter behaviour and the empty-parallel-timeline edge case.
10. Update bounded Feature `6.3ae` documentation plus its matching Feature Implementation Index entry after implementation, per `FeatureWorkAgent.md`.

## Focused test map

Start with only tests touched by the implementation:

- `test/world-spine-panel.test.mjs` — primary projection/layout/render/delete-result coverage.
- `test/worldbuilding-studio.test.mjs` — world-backed unplacement mutation if added there.
- `test/world-spine-location-filter-service.test.mjs` — only if filter service behaviour changes.
- `test/project-persistence-service.test.mjs` — dock collapse setting / comparable payload if touched.
- `test/world-spine-history-service.test.mjs` — only if the history service itself changes; otherwise exercise history through the existing feature/smoke path.
- `test/editor-ui-state.test.mjs` — only if collapse state is extracted there.

Then use the repository supervisor-selected verification. Do not start by running unrelated test groups.

Minimum acceptance assertions:

1. Default/unplaced nodes create no normal `Unplaced location` row.
2. Every unplaced primary event renders once in the dock and not in the normal canvas.
3. Dock cards retain existing manuscript/`sequenceRank` order and global X chronology.
4. Child/reference display nodes and normal connectors for docked primaries do not remain orphaned on the canvas.
5. Deleting a populated row preserves its events/scenes/text/IDs and moves its members to the dock.
6. Real catalogue locations/images and unrelated entity/edge relationships survive deletion.
7. Undo restores the row and placements; Redo returns them to the dock.
8. Dock is fixed vertically, synchronized horizontally, and does not obscure the final real row.
9. Collapse changes presentation only and survives rerender/reload.
10. Zero unplaced events hides the dock.
11. A specific real-location filter hides the dock; All locations shows it when populated.
12. Populated-row deletion does not accidentally remove an empty/parallel timeline spine.

## Codex bounded-read route

Follow `AGENTS.md`: this is author-facing World Spine feature work, so load `agents/WorldbuildingAgent.md` + `agents/FeatureWorkAgent.md`.

To minimize context, begin with:

1. this document;
2. the named functions above in `world-spine-panel.js`;
3. `world-spine-location-row-service.js` (small feature service);
4. the matching row-name mutation in `worldbuilding-studio.js`;
5. only the named row-save/action regions of `app.js`;
6. the named focused tests.

Do not broadly preload `app.js`, `features.md`, or `styles.css`. For `features.md`, the relevant product workflow is **Feature `6.3ae` Location-row assignment and child locations**; read/update that bounded section and its matching Implementation Index entry only.
