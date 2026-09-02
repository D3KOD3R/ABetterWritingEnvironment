# World Spine Acceptance Follow-up

Status: Active acceptance-fix spec
Revision: 4
Date: 2026-08-29
Branch: `feature/world-spine/unplaced-events-dock`
Implementation baseline: `2cd5fc92e55556056821cd38ce54c9732b7aee31` (`fix: preserve lazy project metadata and metrics`)

## Codex execution contract — read only this section first

The hydration/project-metrics implementation in `2cd5fc9` is already implemented, tested, pushed, and code-reviewed. **Do not re-investigate or redesign hydration, project metrics, writing goals, or the completed Delete-eligibility fix unless a new focused regression test proves they are causal.**

Manual browser verification has identified four remaining acceptance failures. Fix these with one focused failing regression per failure before changing implementation. Keep reads bounded to the named functions below.

### Failure 1 — sequential World Spine location assignments do not accumulate

Browser reproduction:

1. Start with several scenes/events in `Unplaced location`.
2. Drag scene/event A to `Earth`.
3. Drag scene/event B to `Earth`.
4. Optionally drag scene/event C to `Mars`.
5. Before refresh, all placements render correctly.
6. Refresh the browser.

Observed: the first assignment survives; later assignments revert to `Unplaced location`.

Required invariant:

```text
save(A -> Earth)
save(B -> Earth)
save(C -> Mars)
refresh

A -> Earth
B -> Earth
C -> Mars
```

A later metadata-only save must never discard an earlier scene-placement mutation.

Initial reads only:

- `apps/editor/public/app.js`
  - `worldSpineController.onSceneNodeReorder`
  - `applyWorldSpineLocationToSceneRows()`
  - `persistCurrentProjectRecord()` call site only
- `apps/editor/public/features/world-spine/world-spine-location-row-service.js`
  - `createWorldSpineSceneDropPersistenceOptions()`
- `apps/editor/public/state/project-runtime-record-state.js`
  - `getCurrentProjectIndexRecord()`
  - `createProjectRecordFromRuntimeState()`
- `apps/editor/public/adapters/storage/project-persistence-service.js`
  - canonical project mutation/save function and in-memory project-library replacement after persistence
- `apps/editor/public/adapters/storage/project-service.js`
  - `buildStableProjectIndex()` / save path only
- `apps/editor/public/adapters/storage/project-metrics.js`
  - `mergeProjectIndexWithLiveSceneOverrides()` only if the failing sequential-save test points there
- `apps/editor/public/adapters/storage/project-repository.js`
  - `saveProjectLibrarySnapshot()` only if the failure survives the preceding boundary

Primary hypothesis to prove or reject: save #2 is built from a stale `state.projectLibrary[*].projectIndex` or otherwise merges against a pre-save index, so successive metadata-only mutations do not accumulate.

Required regression: perform at least three sequential location metadata saves for different scene IDs **without reloading between saves**, then reload and verify every scene retains its assigned row in persisted project-index metadata and the reconstructed World Spine model.

### Failure 2 — unplaced events still render in the normal World Spine canvas

Browser reproduction: load the current project with many unplaced events. They appear as ordinary primary cards floating through the normal timeline area instead of only in the fixed bottom `Unplaced location` dock.

Required behavior:

- unplaced primary events are absent from the normal canvas projection;
- each unplaced primary event renders exactly once, in the viewport-level bottom dock;
- the dock remains pinned to the bottom of the World Spine viewport;
- global chronological X placement is retained in the dock track;
- normal canvas markup does not retain orphan child/reference nodes/connectors belonging only to a docked primary;
- do not reimplement the dock architecture.

Initial reads only:

- `apps/editor/public/features/world-spine/world-spine-panel.js`
  - `buildWorldSpineTimelineModel()`
  - `createWorldSpineCanvasProjection()`
  - `renderWorldSpinePanelHTML()`
  - `renderWorldSpineUnplacedDockHTML()`
- focused `test/world-spine-panel.test.mjs` coverage only

Required regression: prove an unplaced primary node is absent from `canvasPrimaryNodes` / normal-canvas markup and appears exactly once in dock markup. Cover child/reference/connectors if they can otherwise leak into the normal projection.

### Failure 3 — attach/replace location image, then Save location, can remove the row

Browser reproduction:

1. Open an existing populated location row with an image.
2. Attach a new image.
3. The application performs the image/world save.
4. Click `Save location` in the still-open row form.
5. The location row disappears.

This is a correctness bug. Image mutation must not alter or erase row membership.

Initial reads only:

- `apps/editor/public/app.js`
  - `attachWorldSpineLocationRowImage()`
  - `saveWorldSpineLocationRowFromForm()`
  - location-form context reconstruction after image attach
- `apps/editor/public/features/world-spine/worldbuilding-studio.js`
  - `applyWorldSpineLocationImageToWorld()`
  - existing location-image lookup only
- canonical persistence functions only if the focused test proves the form/world mutation is correct before persistence

Required regression:

```text
populated Earth row
+ existing image
-> attach new image
-> save location form
-> refresh

Earth row still exists
all prior scene/world memberships remain
image update remains
```

Do not recreate row membership from the Location catalogue entity. Normal rows remain projections of canonical scene/world placement metadata.

### Failure 4 — vertical location-row drag has no row-aware drop indicator

Browser reproduction:

1. Drag a scene/event card that is currently on one location row, for example `Earth`.
2. Move the pointer vertically toward another row, for example `Europa`.
3. The event ghost moves with the pointer, but the cyan insertion/drop indicator remains at the source-row height or otherwise only indicates horizontal before/after placement.
4. The user therefore cannot visually confirm which location row will receive the drop.

Required behavior:

- horizontal before/after reorder feedback continues to work;
- when the pointer resolves to a different location row, the active drop preview must visually extend/move to that row;
- the preview must make the target row unambiguous before pointer-up;
- the preview position must be derived from the same location-row target that will be passed to persistence, not from an independent approximate calculation;
- dragging from `Earth` down to `Europa` must visibly indicate `Europa` before drop;
- crossing back to `Earth` or another row must update the indicator immediately;
- cancelling/ending the drag must remove both horizontal and row-target preview state.

Initial reads only:

- `apps/editor/public/features/world-spine/world-spine-panel.js`
  - `createWorldSpineInteractionController()`
  - `resolveNodeBlockLocationRowDropTarget(event)`
  - `resolveNodeBlockDropTarget(event)`
  - `updateNodeBlockDropPreview(event)`
  - `clearNodeBlockDropPreview()`
  - `moveNodeBlockDragPreview(event)` only if needed to understand coordinates
- corresponding drop-preview CSS selectors in `apps/editor/public/styles.css` only after the JS target model is understood
- focused `test/world-spine-panel.test.mjs` interaction/controller coverage only

Current code already has separate concepts for binder reorder target and location-row drop target. The likely UI gap is that `updateNodeBlockDropPreview()` appears to render only the reorder before/after classes, while `resolveNodeBlockLocationRowDropTarget(event)` is consulted for the eventual drop. Prove this with a focused test rather than broad-reading the renderer.

Required regression: simulate a scene-card drag from row A into row B and prove the preview state/markup identifies row B before pointer-up, while the final resolved drop target uses the same row B identity. Also verify moving the pointer back to row A updates/clears the row-B preview.

### Image-library scope boundary

Current implementation supports one `image` field per catalogue entity; attaching a second image replaces that field. Multi-image support is **not required to fix Failure 3**.

Do not expand this acceptance-fix pass into a gallery unless the existing single-image model itself is required to prevent the row-loss bug. If not required, leave the future design as:

```text
Location entity
  images[]
    id / asset reference / caption / attachedAt
  primaryImageId
```

Future UI semantics: `Add image`, `Set/Replace primary image`, `Remove image`; World Spine renders the selected primary image. Existing single-`image` records must remain backward compatible when that feature is implemented later.

### Do not

- do not redo the `2cd5fc9` hydration or project-metrics refactor;
- do not broaden into unrelated manuscript/persistence architecture;
- do not create canonical `LocationRow` entities;
- do not create a fake `Unplaced location` catalogue item;
- do not eagerly hydrate all scene bodies;
- do not read archived implementation specs;
- do not inspect Git history unless current source contradicts this execution contract;
- do not implement multi-image galleries as part of the row-loss bug unless proven necessary;
- do not redesign drag/drop architecture if extending the existing preview state is sufficient;
- do not run broad tests first.

### Verification order

For each failure:

1. add focused failing regression;
2. make the smallest coherent fix;
3. rerun that focused test;
4. continue to the next failure.

After all four pass:

```text
npm run repo -- test --changed
```

Broaden only if the repository supervisor explicitly escalates.

## Acceptance checklist for manual browser verification

- sequential placements A/B/C all survive a single refresh;
- repeated assignments to the same row and to different rows both survive;
- a drag that also reorders binder structure retains both binder order and location after refresh;
- unplaced primary cards do not appear in the normal canvas;
- unplaced cards appear once in the fixed bottom dock;
- existing populated row -> attach/replace image -> Save location does not remove the row;
- image update survives refresh;
- row members survive image attach/save and refresh;
- dragging vertically between named rows gives clear row-aware preview feedback before drop;
- moving the drag pointer between rows updates the preview to the currently resolved row;
- ending/cancelling the drag removes preview state;
- Delete remains reachable for populated scene-only/world-only rows and still unplaces rather than deletes contents;
- project word count/writing goals remain unchanged by these fixes.

## Baseline already completed in `2cd5fc9`

Do not spend implementation context rediscovering these unless a new failing test points back to them:

- active-scene body hydration remains lazy;
- non-active World Spine metadata is exposed through metadata-only project-index/scene-store projection;
- `project-metrics.js` resolves project totals from `projectIndex` plus live scene overrides;
- writing-goal totals use the corrected metric authority;
- Delete-row eligibility is shared between UI and handler;
- `changedSceneIds` can be forwarded through binder reorder persistence;
- focused tests and supervisor FULL verification passed at implementation time.

The baseline still failed manual acceptance because sequential saves, dock projection rendering, image/form interaction, and vertical row-target drag feedback were not fully covered by those tests.

## Durable architecture rules

- hydration state is never evidence of project completeness;
- `projectIndex` remains the persisted complete-project summary/metric authority;
- scene bodies remain chunked/lazy;
- normal World Spine location rows remain projections, not canonical row objects;
- `Unplaced location` remains a special placement state and viewport dock projection;
- deleting a populated row unplaces its contents and preserves manuscript/catalogue data;
- catalogue image mutation must be independent from location-row membership;
- drag preview and final drop must resolve the same target-row identity.

## Revision history

### Revision 4 — 2026-08-29

Added the fourth manual acceptance failure: the vertical scene/event drag resolves a new location row for drop but does not provide matching row-aware visual feedback. The execution contract now names only the existing interaction-controller functions involved in drag preview and location-row target resolution, so Codex should not need to rediscover the World Spine renderer.

### Revision 3 — 2026-08-29

Post-implementation manual acceptance report based on commit `2cd5fc92e55556056821cd38ce54c9732b7aee31`.

Confirmed browser failures added:

1. only the first of several sequential location assignments survives refresh;
2. unplaced primary events still render in the normal canvas instead of exclusively in the fixed bottom dock;
3. replacing/attaching an image to an already-imaged populated location and then saving the row can remove the row.

Revision 3 deliberately narrows Codex context: the completed hydration/metrics work is treated as baseline, exact initial symbols are named per failure, and broad re-investigation is prohibited unless a focused regression proves it necessary.

### Revision 2 — 2026-08-29

Consolidated the original unplaced-events dock spec and chunked-hydration/project-metrics diagnosis into one active implementation authority. Superseded the earlier architecture-side implementation notes while retaining their durable invariants.

### Revision 1 — 2026-08-29

Initial diagnosis of chunked scene hydration and project-metrics correctness defects.
