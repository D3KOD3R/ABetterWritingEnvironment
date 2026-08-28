# Chunked Scene Hydration, Project Metrics, and World Spine Follow-up

Status: Active implementation spec  
Revision: 2  
Date: 2026-08-29  
Branch reviewed: `feature/world-spine/unplaced-events-dock`

## Execution contract — read this first

### Goal

Fix the lazy-hydration correctness defect, make project-wide metrics independent of hydration state, move project metric resolution out of `app.js`, and close the two remaining World Spine persistence/delete gaps exposed by the unplaced-events dock work.

### Initial reads only

Start with these files/symbols. Do not broad-read `app.js`, architecture roadmaps, Git history, or unrelated tests unless the evidence below proves insufficient.

- `apps/editor/public/adapters/storage/project-repository.js`
  - `hydrateProjectRecord()`
  - `loadProjectLibrarySnapshot()`
- `apps/editor/public/adapters/storage/project-index.js`
- `apps/editor/public/app.js`
  - `getProjectRecordWordCountForSettings()`
  - current manuscript/project metric helpers and call sites only
  - World Spine row delete eligibility region
  - World Spine scene reorder/location-drop persistence region
- `apps/editor/public/features/writing-targets/writing-goals-state-service.js`
- `apps/editor/public/features/world-spine/world-spine-location-row-service.js` only if a World Spine follow-up test requires it
- focused existing tests for the named files

### Required outcome

1. Preserve chunked/lazy scene loading.
2. A hydration-only reload must not change logical project contents, project metrics, writing-goal progress, or World Spine placement.
3. Non-active persisted scene metadata must remain available to global projections after reload without requiring every scene body to become an active runtime draft.
4. Consolidate project-wide metric resolution around `projectIndex` plus live dirty-scene overrides.
5. Move the pure project metric calculations currently spread through `app.js` into one focused module such as `project-metrics.js`; move existing logic rather than duplicating it.
6. Keep `writing-goals-state-service.js` as the owner of goal baselines/history/progress, consuming the corrected authoritative manuscript count.
7. Align World Spine Delete-row UI eligibility with the handler's supported populated-row membership.
8. Ensure a World Spine location drop carries affected `changedSceneIds` through canonical persistence even when the same gesture also reorders binder structure.

### Do not

- do not hydrate every manuscript body into `state.sceneDrafts` as the fix;
- do not put scene bodies back into the project manifest;
- do not introduce a second persisted metrics model beside `projectIndex`;
- do not create a canonical `LocationRow` entity or schema migration;
- do not create a fake `Unplaced location` catalogue entity;
- do not rewrite writing-goals domain logic when correcting its manuscript-count dependency is sufficient;
- do not perform a broad persistence refactor unrelated to these defects;
- do not retain duplicate project-word-count implementations in `app.js` and the extracted metrics module;
- do not read `docs/implementation/archive/` during ordinary implementation.

### Verification

Start with failing characterisation tests, then run:

```text
npm run repo -- test --changed
```

Broaden only if supervisor routing escalates or focused evidence is insufficient.

## Architectural invariants

### Hydration is not project completeness

Which scene bodies happen to be hydrated must never change:

- project or chapter word counts;
- scene/chapter counts;
- persisted manuscript structure;
- World Spine row placement;
- writing-target baselines or progress.

### Project metric authority

```text
Complete scene list              -> projectIndex
Persisted scene/chapter metrics  -> projectIndex
Current dirty scene metric       -> live scene override
Current project metric           -> projectIndex + live overrides
Writing-goal state/history       -> WritingGoalsStateService
Hydration state                  -> never evidence of project completeness
```

`project-index.js` remains the persisted complete-project summary. A new pure calculation module may resolve current metrics from that index, but must not become a second stored metrics authority.

### World Spine location-row architecture

The earlier unplaced-events design remains authoritative where relevant:

- `Unplaced location` is a special placement state, not a normal world location row;
- internal compatibility identity remains label `Unplaced location`, key `unplaced-location`;
- normal location rows are render-time projections of canonical scene/world placement data, not standalone `LocationRow` objects;
- deleting a populated location row is an unplacement operation, not event/scene/catalogue deletion;
- manuscript text, scene/event IDs, chronology, anchors, implication edges, catalogue locations/images, and unrelated semantic metadata must survive row deletion;
- the unplaced dock is a viewport projection and must not become canonical world data.

The floating dock itself was implemented in commit `d51873ef637fdcc2e42c2614d148570da984381e`. This active spec concerns correctness/refactor follow-up, not reimplementation of the dock.

## Defect A — browser reload loses complete scene access

### Confirmed behavior

Scene chunks persist manuscript body and World Spine metadata correctly. The manifest intentionally clears `sceneDrafts` because scene data is chunked.

`hydrateProjectRecord()` currently hydrates only the active scene into `record.sceneDrafts`. That can be valid lazy-loading behavior.

The defect is the handoff after reload: `loadProjectLibrarySnapshot()` returns an empty `sceneStore`, so activation can end up with:

```text
state.sceneDrafts = active scene only
state.loadedProjectSceneStore = {}
```

`refreshScenes()` then reconstructs a logical project from an incomplete scene set.

### Resulting symptoms

- non-active scene bodies can appear missing after reload;
- projected World Spine rows/placements can disappear even though their scene chunks were saved;
- global consumers may behave as if only the active scene exists.

### Fix boundary

Preserve active-scene/lazy hydration but restore a complete-project access path for persisted non-active scene data required by global projections.

First determine the intended semantics of `loadedProjectSceneStore`. If retaining every full body there defeats the intended memory model, use a metadata-capable retained representation or repository-backed lazy access. Do not solve the problem by making active runtime drafts eager.

## Defect B — partial hydrated drafts can become the project word count

`getProjectRecordWordCountForSettings()` currently prefers a non-zero count from `record.sceneDrafts` before falling back to complete `projectIndex` totals.

Under lazy loading:

```text
actual/projectIndex total = 87,400
hydrated active scene      = 3,200
current resolver can return 3,200
```

Any non-zero hydrated subset is therefore capable of masquerading as the whole manuscript.

This can corrupt or visibly collapse:

- manuscript/project word count;
- chapter/project statistics;
- writing-target initialization;
- daily/session baselines;
- target progress and pace/history calculations.

## Refactor — remove project metric authority from app.js

`app.js` is intended to bootstrap/orchestrate the browser editor. It should not own the definition of project-wide metrics.

Audit and consolidate the current family of helpers/calculations, including the equivalents of:

- `getWorkspaceManuscriptWordCount()`;
- `getProjectRecordWordCountForSettings()`;
- `getProjectIndexSceneWordCount()`;
- chapter word-count resolution;
- `buildWorkspaceStatsFromProjectIndex()`;
- ad-hoc `indexedWordTotal` calculations.

Preferred boundary:

```text
project-index.js
  persisted complete-project index/metric values

project-metrics.js
  pure hydration-safe current metric resolution
  projectIndex + live dirty-scene overrides

writing-goals-state-service.js
  consumes current project metrics
  owns goal state/baselines/history/progress

app.js
  dependency wiring/orchestration only
```

Use a `-service` suffix only if the extracted module genuinely owns state/orchestration. Prefer pure functions otherwise.

Illustrative API only:

```js
getProjectWordCount(projectIndex, liveSceneOverrides)
getSceneWordCount(projectIndex, sceneId, liveSceneOverrides)
getChapterWordCount(projectIndex, chapterId, liveSceneOverrides)
buildProjectMetrics(projectIndex, liveSceneOverrides)
```

Final names should follow existing conventions. Replace old implementations rather than wrapping and retaining multiple authorities.

## World Spine follow-up defects

### Delete action eligibility mismatch

The delete handler considers a row populated when it has primary node IDs, scene IDs, or world node IDs. The UI visibility predicate is narrower and can hide Delete for a row the handler supports.

Align UI eligibility with the handler's actual supported membership model. Add an interaction-level regression test, not only a source-string/render-fragment assertion.

### Location drop + binder reorder persistence boundary

The scene reorder/location-drop path can update World Spine row metadata and also perform a binder move. In the branch where the binder move succeeds, explicit World Spine persistence with `changedSceneIds` can be skipped.

Inspect `moveBinderScene()` before changing behavior, but preserve this invariant:

> Every row assignment/unplacement mutation must carry its affected `changedSceneIds` through the canonical persistence boundary even when the same gesture also reorders binder structure.

## Implementation sequence

1. Add failing characterisation coverage for non-active scene reload access and hydration-independent project totals.
2. Repair the complete-scene reload/access boundary without defeating lazy loading.
3. Extract/consolidate current project metric calculation out of `app.js` around `projectIndex + live overrides`.
4. Route writing-goal/current project totals through that authority.
5. Fix Delete-row UI eligibility and the drag/reorder persistence boundary.
6. Verify World Spine row naming, movement, deletion and unplacement across browser reload.
7. Run repository-supervisor changed-file verification; broaden only when routed.

## Acceptance criteria

- A multi-scene project may hydrate one active scene while all other scenes remain logically present/retrievable.
- Refresh does not change total project or chapter word counts.
- Changing only the active/hydrated scene changes project total by exactly zero.
- Editing a scene by `+N` or `-N` changes project total by exactly that delta without loading all other bodies.
- Writing-goal daily/session baselines and progress remain unchanged across hydration-only reload.
- Non-active World Spine scene metadata remains projectable after reload.
- Naming a populated World Spine row survives refresh.
- Dragging a non-active scene/event into a row survives refresh.
- A location drop that also reorders binder structure still persists row metadata.
- Delete is reachable for every populated-row shape supported by the delete handler.
- Deleting a populated row preserves scenes/events/text/IDs/catalogue data and moves members to the unplaced state/dock.
- No duplicate project-wide word-count authority remains in `app.js` after extraction.

## Revision history and superseded specs

### Revision 2 — 2026-08-29

This document is now the single active implementation authority for the diagnosed hydration/metrics work plus the remaining correctness items exposed by the World Spine unplaced-events implementation.

It consolidates and supersedes:

- `docs/architecture/chunked-scene-hydration-and-project-metrics-fix.md` — diagnosis/refactor document created in commit `39fa222278808c5e0077b12de12cc4caf09bd91e`;
- `docs/architecture/world-spine-unplaced-events-dock.md` — approved implementation spec tightened in commit `fb2b4154a4471cc80985c58a29a93caa4d6509a2`.

The latter's already-implemented dock design is reduced here to the durable invariants still needed for follow-up correctness. Its implementation was delivered by `d51873ef637fdcc2e42c2614d148570da984381e`; this revision does not ask Codex to rebuild it.

### Revision 1 — 2026-08-29

Initial diagnosis of chunked scene hydration and project-metrics correctness defects.