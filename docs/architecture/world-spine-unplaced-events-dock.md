# World Spine Floating Unplaced Events Dock

Status: Approved design; implementation pending

Date: 2026-08-26

## Purpose

Define the World Spine behaviour for events that do not currently belong to a location row, including the result of deleting a populated location row.

The World Spine must not represent `Unplaced location` as an ordinary world location lane. Unplaced events belong in a dedicated floating dock pinned to the bottom of the World Spine viewport. The dock preserves manuscript chronology while allowing the author to continue organizing world locations above it.

This document extends the existing World Spine model rather than introducing a standalone canonical `LocationRow` domain record. Location rows remain render-time projections of canonical scene/world placement data.

Related architecture:

- `docs/architecture/world-spine-model.md`
- `apps/editor/public/features/world-spine/world-spine-panel.js`
- `apps/editor/public/features/world-spine/world-spine-location-row-service.js`
- `apps/editor/public/features/world-spine/worldbuilding-studio.js`

## Author-facing outcome

The World Spine viewport is divided conceptually into two placement surfaces:

```text
WORLD SPINE VIEWPORT
|
|-- LOCATION SPACE
|   |-- Earth
|   |-- Mars
|   |-- Ceres
|   `-- other placed location rows
|
`-- FLOATING UNPLACED EVENTS DOCK
    |-- Event A
    |-- Event B
    `-- Event C
```

The upper location space answers:

> Where in the world does this event occur?

The bottom dock answers:

> Which chronological events currently have no World Spine location-row placement?

The dock is not a location row, not a catalogue Location entity, and not a new timeline spine.

## Core interaction behaviour

### Normal state

Placed events continue to render in their normal location rows.

Unplaced primary events render in one floating dock at the bottom of the World Spine viewport. The dock displays the label `Unplaced location` once for the whole dock rather than repeating that text on every event card.

Event cards in the dock use the same visual scale and core card treatment as normal World Spine primary event cards. The hand-drawn sizing used during design discussion is illustrative only and must not create a second compact-card sizing system.

### Vertical scrolling

The dock remains pinned to the bottom of the World Spine viewport while the author scrolls vertically through location rows.

The dock therefore belongs to the viewport layer, not to the vertically laid-out World Spine canvas geography.

The expanded dock must reserve enough effective bottom safe area that the final real location row can still be scrolled fully above the dock instead of being hidden underneath it.

### Horizontal scrolling and chronology

Dock cards remain in the same chronological horizontal coordinate system as the normal World Spine.

When the main timeline scrolls horizontally, the dock card track follows the same horizontal scroll position. The dock must not introduce a second independent horizontal scrollbar.

When an event becomes unplaced, it should visually behave as though it drops vertically into the dock. Its manuscript/timeline order must not be recomputed from deletion order.

### Manuscript order

Unplaced events are ordered using the existing World Spine primary-node chronology, including the current `sequenceRank`-based ordering and established fallback ordering.

For example, if manuscript chronology is:

```text
1 Dream
2 Mission Brief
3 Mess
4 Training
5 Vacuum
6 Say Hello
7 Storm
```

and events 2, 4, and 7 are unplaced, the dock order must be:

```text
Mission Brief -> Training -> Storm
```

The order must not depend on which location row was deleted first.

## Location-row deletion behaviour

Deleting a populated location row is an **unplacement operation**, not an event deletion operation.

If the author deletes a row such as:

```text
Earth
|-- Scene A
|-- Scene C
`-- World Event F
```

then:

1. the Earth row placement is removed from those row members;
2. the scenes/events themselves remain intact;
3. manuscript text and anchors remain intact;
4. chronological order remains intact;
5. implication edges and non-place relationships remain intact;
6. the Earth catalogue Location entity and its image remain intact;
7. the rebuilt World Spine no longer derives an Earth row from those unplaced members;
8. Scene A, Scene C, and World Event F appear in the floating Unplaced Events Dock.

Deleting a location row must never implicitly delete manuscript scenes or timeline events.

Deleting the catalogue Location entity remains a separate explicit worldbuilding action.

## Canonical representation of unplaced state

### Compatibility decision for the first implementation

Do not introduce a new canonical `LocationRow` record or require a schema migration solely for this feature.

The codebase already has a default location identity:

- label: `Unplaced location`
- normalized key: `unplaced-location`

For the first implementation, treat that identity as an **internal row-placement sentinel**, not as a real world location.

The key architectural change is therefore:

> default/unplaced placement is partitioned out of normal location-row projection before normal rows are laid out.

Existing project data that currently resolves to the default location identity should automatically appear in the dock after this feature is implemented.

### Preserve event semantic location where possible

Row placement and event-local setting should remain conceptually separate.

If an event has useful semantic detail such as a child location, ship, room, orbital position, or other event-local setting, deleting its parent World Spine row should not erase unrelated semantic metadata merely to make the row disappear.

The unplacement mutation should change the row-placement identity to the default/unplaced sentinel while preserving event data that is not itself the row assignment.

This is preferable to globally blanking every location-related field and avoids data loss when an author deletes an organizational row.

Where legacy records currently mirror row location into a general `location` field, the implementation should preserve compatibility while moving toward the row-specific fields (`locationRowLabel`, `locationRowKey`, `locationScope`) as the placement authority.

## Model projection

The current model builds all primary nodes and then passes them into `createWorldSpineTimelineLocationRows()`. The new design should partition primary nodes before normal location-row construction.

Conceptually:

```text
all primary nodes
      |
      +-- placed nodes ----------------> normal locationRows
      |
      `-- default/unplaced nodes ------> unplacedDock
```

Recommended feature-owned helpers:

```text
partitionWorldSpinePrimaryNodesByLocationPlacement(...)
createWorldSpineUnplacedEventsDockModel(...)
```

A suitable model shape is:

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

The exact property naming may follow existing World Spine conventions, but the dock must remain a projection rather than canonical world data.

## Normal-row construction

`createWorldSpineTimelineLocationRows()` should receive only nodes that are considered normally placed.

Nodes whose row identity resolves to the default/unplaced identity must not create a normal `Unplaced location` row.

The current default fallback behaviour in helpers such as `normalizeLocationLabel()`, `normalizeLocationKey()`, and `resolveLocationRowKey()` can remain for compatibility, but default identity must be recognized as a special placement class before normal row layout.

Legacy records with a meaningful non-default location but no explicit row key must continue to derive their normal row from the existing fallback rules.

## Layout and rendering

### Keep one chronological X coordinate system

Do not create a separate ordering engine for the dock.

Use the existing primary-node ordering to establish each event's chronological X position. The dock uses those positions so an event moves vertically between a placed row and the dock without an unrelated horizontal jump.

### Separate canvas rendering from dock rendering

Unplaced primary nodes must not also render as ordinary primary cards in the main location canvas.

The model/render path therefore needs an explicit distinction between:

- primary nodes participating in normal canvas location-row rendering; and
- primary nodes participating in the floating dock.

Downstream code that still needs all primary nodes for selection, event rail, detail panes, chronology, history, or canonical edge lookup should retain access to the complete primary-node set.

Do not solve this by deleting unplaced nodes from the overall World Spine model.

### Dock DOM ownership

The dock should be rendered at the World Spine timeline viewport level, alongside the existing scroll canvas and overlay surfaces, rather than as another location-row guide inside the canvas.

Conceptually:

```text
world-spine-timeline-viewport
|-- world-spine-timeline-scroll
|   `-- world-spine canvas
|-- detail overlay
|-- implication overlay
`-- unplaced events dock
    |-- dock header
    `-- chronological card track
```

Suggested data hooks:

```text
data-world-spine-unplaced-dock
data-world-spine-unplaced-dock-header
data-world-spine-unplaced-dock-track
data-action="toggle-world-spine-unplaced-dock"
```

Use existing naming/style conventions if a nearby pattern is more appropriate.

### Card rendering

Prefer reuse of the normal primary event-card rendering path or a shared event-card renderer instead of maintaining a second copy of World Spine event-card markup.

The dock variant may suppress redundant location-row copy, because the dock header already communicates `Unplaced location` once.

Do not suppress other useful event information such as title, people, date/time, warning state, selection state, or other card metadata unless existing card rules require it.

### Child/reference nodes

The first implementation only needs to dock primary chronological event cards.

Child/reference records remain canonically linked and must not be deleted. They may continue to surface through the selected event/detail experience. Rendering a second miniature child/reference graph inside the floating dock is not required for the first implementation.

## Dock expanded/collapsed state

### Expanded

The expanded dock shows:

- one `Unplaced location` label;
- the count of unplaced primary events where useful;
- the normal-sized chronological event cards;
- a collapse/minimize control at the right-hand side of the dock header.

### Collapsed

Collapsed state shows only a small persistent header, for example:

```text
Unplaced location · 6                                  [expand]
```

No event data is changed by collapsing the dock.

### Persistence

Persist dock collapse state as project UI state, not canonical world data.

Recommended setting:

```text
worldSpineUnplacedDockCollapsed
```

This belongs with existing persisted World Spine UI settings such as panel layout, right-pane mode, and location filtering.

The setting should survive normal rerender/project reload without changing event placement.

## Empty-state behaviour

If there are zero unplaced primary events, hide the dock entirely.

Do not reserve a large empty strip at the bottom of the viewport.

Transitions should be automatic:

```text
0 -> 1 unplaced event: dock appears
1 -> 0 unplaced events: dock disappears
```

The stored collapsed preference may remain available even while the dock is hidden.

## Location filtering

The dock is not a normal location filter row.

Initial rules:

- `All locations`: show normal location rows plus the unplaced dock when it has content.
- a specific real location filter such as `Earth`: show the filtered real location view and hide the unplaced dock.
- a future explicit `Unplaced` filter may target the dock as a special filter mode, but is not required for the first implementation.

Do not create a fake catalogue Location entity merely so the existing location filter can select `Unplaced location`.

## Delete transaction and service boundaries

The existing row label already carries the source identifiers required to identify row members, including primary node IDs, scene IDs, and world-node IDs. Reuse those identifiers rather than inventing a standalone location-row ID.

The delete workflow should follow the existing World Spine mutation pattern:

```text
UI action
  -> feature-owned row unplacement mutation
  -> canonical state updates
  -> place-link reconciliation
  -> project persistence
  -> World Spine history entry
  -> rerender/model rebuild
```

`app.js` should orchestrate the operation but should not own feature-specific field mutation logic.

### Scene-backed records

Extend `world-spine-location-row-service.js` with an explicit unplacement operation rather than scattering field edits through `app.js`.

The service should update all scene-backed mirrors that currently participate in location-row assignment, including where applicable:

- scene draft row-placement metadata;
- structure drafts;
- scene event tags;
- loaded scene-store records.

Prefer a purpose-specific operation such as:

```text
unplaceWorldSpineLocationAssignmentFromSceneRecord(...)
unplaceWorldSpineLocationAssignmentFromStructureDrafts(...)
unplaceWorldSpineLocationAssignmentFromSceneEventTags(...)
unplaceWorldSpineLocationAssignmentInSceneStore(...)
```

Exact naming may follow existing conventions.

The operation should write the default/unplaced row-placement identity while preserving unrelated semantic event metadata.

### World-backed nodes

Add the corresponding world mutation in the World Spine/worldbuilding feature layer for world-only nodes.

The operation must retain the node itself, its stable ID, order, manuscript anchors, edges, and non-place links while moving its row placement to the unplaced sentinel.

### Place/entity link reconciliation

Deleting a row must remove or reconcile location-specific `timeline-presence` links that would falsely assert that the now-unplaced event remains placed at the deleted row location.

Do not delete:

- the catalogue Location entity;
- its image;
- characters;
- factions;
- artifacts;
- technologies;
- unrelated entity links;
- implication edges.

If the existing `applyWorldSpineLocationAssignmentToWorldPlaceLinks()` API cannot safely express unplacement without overwriting unrelated semantic data, add a purpose-specific unplacement reconciliation helper rather than overloading ambiguous empty-string behaviour.

## Undo and redo

Deleting a location row and moving its events to the dock is one World Spine history operation.

Suggested history label:

```text
Deleted World Spine location row
```

or, when the row label is available:

```text
Deleted location row "Earth"
```

Undo must restore:

- the original row placement for every affected scene/world node;
- affected place-presence links;
- the rendered location row;
- the events' previous vertical placement.

Redo must return those events to the floating dock.

Dock collapse/expand is UI state and does not need to create a World Spine content-history entry.

## Confirmation copy

Deleting a populated location row should clearly communicate that content is retained.

Recommended copy:

```text
Delete location row "Earth"?

Events and manuscript scenes in this row will not be deleted.
They will move to Unplaced location until you assign them to another location.
```

Do not reuse a delete-confirmation preference key intended for passage notes/tasks unless the confirmation preference model is deliberately extended for World Spine actions.

## Empty parallel timeline edge case

A rendered empty location prompt can exist because an empty timeline/spine may synthesize a row even when no primary nodes belong to it.

Deleting a populated projected location row and deleting an empty parallel timeline are different operations.

For an empty non-primary timeline/spine, removing the visible empty row may require deleting the underlying timeline/spine rather than unplacing row members that do not exist.

Do not make populated-row deletion accidentally remove a spine.

This edge case may remain a separate command if that produces clearer author behaviour.

## Implication connections across the dock boundary

Canonical implication edges involving unplaced events must remain intact.

The first implementation does not need to draw complex SVG implication curves from the vertically scrolling canvas into the fixed dock overlay. It is acceptable for docked events to retain canonical edges without rendering cross-surface curves until they are placed again or until a dedicated dock-aware connection renderer is designed.

Selection/detail views must continue to resolve the event and its relationships from canonical data.

## Persistence

No new persistence mechanism is required.

Canonical scene/world placement mutations continue through the existing project persistence service boundary.

The dock collapse preference is persisted with project UI settings.

Do not write directly to localStorage, project files, or desktop filesystem APIs from the dock renderer/controller.

## Suggested implementation sequence

1. Add tests that describe the desired unplaced projection before changing rendering.
2. Partition default/unplaced primary nodes from normally placed primary nodes in the World Spine model.
3. Stop `createWorldSpineTimelineLocationRows()` from receiving/rendering default/unplaced nodes as a normal row.
4. Add an `unplacedDock` projection model ordered by existing primary chronology.
5. Render the viewport-level floating dock using normal primary-card sizing.
6. Synchronize the dock card track with the main horizontal timeline scroll and zoom coordinate system.
7. Add expanded/collapsed dock UI state and project-setting persistence.
8. Add the row-delete UI action and confirmation.
9. Implement scene-backed row-unplacement service mutations.
10. Implement world-backed node unplacement.
11. Reconcile place-presence links.
12. Commit deletion as one World Spine history operation and verify Undo/Redo.
13. Verify location-filter interaction and bottom safe-area behaviour.
14. Run focused World Spine tests, persistence/settings tests where touched, then the repository supervisor-selected verification.

## Likely implementation locations

Primary files expected to change:

- `apps/editor/public/features/world-spine/world-spine-panel.js`
  - placed/unplaced partition;
  - dock model;
  - dock markup;
  - normal row construction changes;
  - viewport rendering;
  - card reuse/suppression of repeated unplaced location copy.

- `apps/editor/public/features/world-spine/world-spine-location-row-service.js`
  - feature-owned row-unplacement mutations for scene-backed records;
  - place-link unplacement/reconciliation if owned here.

- `apps/editor/public/features/world-spine/worldbuilding-studio.js`
  - world-backed node row unplacement where the current row-name/world mutation path lives.

- `apps/editor/public/app.js`
  - thin action routing/orchestration;
  - confirmation state wiring;
  - history/persistence call;
  - collapse-toggle state wiring if not extracted to a World Spine controller/state slice.

- `apps/editor/public/styles.css`
  - dock overlay layout;
  - expanded/collapsed states;
  - bottom safe area;
  - dock track positioning.

- `test/world-spine-panel.test.mjs`
  - projection, ordering, rendering, delete-result and dock tests.

Additional tests should be updated only where the implementation actually changes persistence/settings or worldbuilding mutation contracts.

## Acceptance criteria

1. Missing/default location placement does not generate a normal `Unplaced location` row in the World Spine location stack.
2. All unplaced primary events appear in one bottom floating dock.
3. The dock remains fixed while the author vertically scrolls through real location rows.
4. Dock events retain existing manuscript/`sequenceRank` chronology.
5. Dock cards remain horizontally aligned to the established World Spine chronology.
6. Event cards in the dock use normal World Spine primary-card dimensions and core styling.
7. `Unplaced location` appears once in the dock header rather than on every docked card.
8. Existing default/unplaced project data automatically projects into the dock without requiring a standalone `LocationRow` migration.
9. Deleting a populated location row does not delete scenes, manuscript content, event records, stable IDs, anchors, or canonical implication edges.
10. Deleting a row moves its affected members to unplaced row-placement state.
11. The deleted normal location row disappears after model rebuild when no placed members remain.
12. Former row members appear in the dock immediately after deletion.
13. Catalogue Location entities and their images survive row deletion.
14. Location-specific timeline-presence links are removed/reconciled without deleting unrelated entity links.
15. Undo restores the original row and every affected event placement.
16. Redo returns those events to the dock.
17. The dock can collapse to a compact bottom header.
18. Collapse/expand does not mutate event/world data.
19. Collapse state survives normal rerender/project reload.
20. If there are zero unplaced primary events, the dock is hidden.
21. The final real location row can still be scrolled fully above an expanded dock.
22. A specific real-location filter hides the dock for the first implementation.
23. Unplaced primary events do not render simultaneously in the main canvas and the dock.
24. Empty parallel-timeline deletion is not accidentally treated as populated row unplacement.
25. No fake catalogue entity named `Unplaced location` is created by this workflow.

## Non-goals for the first implementation

- introducing a canonical `LocationRow` entity;
- redesigning manuscript chronology;
- creating a second independent horizontal timeline for unplaced events;
- rendering a full child/reference mini-graph inside the dock;
- drawing cross-surface implication curves between dock cards and normal canvas cards;
- deleting catalogue Location records as a side effect of row deletion;
- deleting manuscript scenes/events as a side effect of row deletion;
- implementing a dedicated `Unplaced` location-filter option unless it falls out naturally from the existing filter architecture.

## Design principle

A location row is an organizational projection over structured story data. Deleting that projection must not destroy the story event.

The World Spine should therefore treat unplaced events as chronologically valid story events waiting for geographic placement, keeping them visible and actionable in a dedicated bottom dock until the author assigns them to a real location.
