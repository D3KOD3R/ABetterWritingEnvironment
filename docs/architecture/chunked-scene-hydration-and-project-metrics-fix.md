# Chunked Scene Hydration and Project Metrics Correctness

Status: Diagnosed — implementation pending
Date: 2026-08-29
Branch reviewed: `feature/world-spine/unplaced-events-dock`

## Purpose

This document records a set of related defects uncovered while diagnosing World Spine location-row persistence and earlier reports of manuscript bodies and project word counts appearing to disappear after browser reload.

The underlying problem is broader than World Spine. The current chunked-storage architecture intentionally separates the project manifest from individual scene chunks and may hydrate only the active scene into `record.sceneDrafts`. That is valid for lazy loading, but several runtime and metric paths still assume that hydrated scene drafts represent the complete manuscript.

The fixes below must preserve chunked/lazy loading. The goal is to restore a correct logical model of the complete project without loading every manuscript body into active runtime state.

## Executive summary

Two primary defects have been identified:

1. **Browser reload loses the all-scene runtime handoff.** Persisted non-active scene chunks exist, but `loadProjectLibrarySnapshot()` hydrates only the active scene and currently returns an empty `sceneStore`. Runtime activation therefore reconstructs the project from an incomplete scene set.
2. **Project-wide word-count resolution can treat partially hydrated scene drafts as the whole manuscript.** `getProjectRecordWordCountForSettings()` prefers a non-zero subtotal from `record.sceneDrafts` before falling back to the complete `projectIndex`, so one loaded scene can incorrectly become the reported total manuscript word count.

These defects can explain several historical symptoms:

- all scene/chapter structure remains visible while only one scene body appears populated;
- World Spine location rows or scene placements disappear after refresh even though scene chunks were persisted;
- manuscript word count drops dramatically after reload;
- writing-goal baselines/progress can be calculated from an incomplete manuscript total.

A separate refactor is also required: project-wide metric authority is currently spread across `app.js` and `project-index.js`. Metric-resolution functions should move out of `app.js` into a focused, pure project-metrics module that reads the existing project index and overlays live dirty-scene values. This is a consolidation refactor, not a new parallel metrics model.

## Required architectural invariants

### Invariant 1 — Hydration does not define project completeness

Scene hydration state must never redefine the logical contents of the manuscript.

Changing which scene bodies are loaded into memory must not change:

- project word count;
- chapter word counts;
- scene count;
- chapter count;
- World Spine placement;
- writing-target baseline or progress;
- persisted project structure.

### Invariant 2 — Lazy loading remains intentional

Do not fix these defects by hydrating every scene body into `state.sceneDrafts` or by placing manuscript bodies back into the project manifest.

Chunked scene storage and active-scene/lazy loading remain desired architecture.

### Invariant 3 — Project metrics are hydration-independent

Project-wide metrics must be derived from the complete persisted project index plus any current live/dirty scene overrides.

The set of currently hydrated scene drafts must never be interpreted as the full manuscript.

### Invariant 4 — Non-active scene metadata remains globally available

Global projections such as World Spine must be able to access persisted metadata for non-active scenes after browser reload without requiring those scenes to be opened in the editor.

### Invariant 5 — Writing goals consume authoritative project totals

Writing-target baselines, session deltas, daily progress, project progress, pace calculations, and history must consume the same hydration-safe current manuscript word count used elsewhere in the application.

### Invariant 6 — No duplicate metric authority

Do not introduce a second persisted project-metrics model beside `projectIndex`.

`project-index.js` already stores complete per-scene and per-chapter counts and was designed to survive lazy loading. The required refactor should consolidate existing metric-resolution logic around that model.

## Current architecture

### Project manifest and scene chunks

The repository intentionally stores manuscript scene bodies separately from the project manifest.

Conceptually:

```text
Project manifest
  - project metadata
  - project index
  - structure
  - settings
  - sceneDrafts intentionally omitted/cleared

Scene chunk store
  - scene-1 body + scene metadata
  - scene-2 body + scene metadata
  - scene-3 body + scene metadata
  - ...
```

`buildManifestRecord()` clears `record.sceneDrafts` and strips scene body text from workspace lines. This is intentional chunked-storage behavior.

`project-repository.js` preserves World Spine scene metadata in each scene chunk, including fields such as:

- `location`;
- `locationRowLabel`;
- `locationRowKey`;
- `locationScope`;
- `worldSpineMetadata`.

The writer path is therefore not the primary defect. Scene chunks can contain the correct metadata and body while the runtime still appears incomplete after reload.

### Runtime scene collections

The runtime currently has two conceptually different scene sources:

```text
state.sceneDrafts
  active/current runtime drafts

state.loadedProjectSceneStore
  retained scene chunks for the complete loaded project

          +
          |
          v
buildSceneDraftsWithLoadedSceneStoreBodies()
          |
          v
refreshScenes()
          |
          v
state.scenes
```

This is a valid pattern for lazy loading only if the retained project scene store is populated correctly.

### Project index

`project-index.js` already acts as the complete-project structural/metric index. It contains per-scene values such as:

- scene ID;
- chapter ID;
- line count;
- word count;

and chapter-level rollups including scene IDs, line counts, and word counts.

Its implementation explicitly derives chapter totals from persisted scene totals so the index can remain useful under lazy scene loading.

This makes `projectIndex` the correct persisted authority for complete-project metrics.

## Defect A — Browser reload drops the all-scene runtime handoff

### Observed symptoms

- Rows named in World Spine disappear after browser refresh.
- Scene/event placements into location rows disappear after browser refresh.
- Historical behavior: binder/chapter structure can remain populated while most scene bodies appear empty and only one scene remains visibly loaded.

### Confirmed save-side behavior

World Spine location metadata is written into scene records and scene chunks correctly.

The repository supports separate scene records and preserves World Spine metadata when normalizing/writing chunks.

### Reload path

The current flow is approximately:

```text
persist scene mutation
    |
    v
scene chunk written correctly
    |
    v
manifest stores sceneDrafts = {}
    |
    v
browser reload
    |
    v
loadProjectLibrarySnapshot()
    |
    v
hydrateProjectRecord()
    |
    +--> active scene chunk loaded into record.sceneDrafts
    |
    `--> non-active scene chunks remain in storage

loadProjectLibrarySnapshot()
    |
    `--> returns sceneStore: {}

boot
    |
    v
state.loadedProjectSceneStore = {}
    |
    v
refreshScenes()
    |
    v
runtime only has active-scene draft metadata/body
```

### Root cause

`hydrateProjectRecord()` intentionally hydrates only the active scene into `record.sceneDrafts`.

That is not inherently wrong.

The defect is that the browser library snapshot does not also hand the retained non-active scene chunks to runtime via `sceneStore`. `loadProjectLibrarySnapshot()` currently returns an empty `sceneStore`, even though repository helpers already exist for loading stored scene chunks.

After activation:

```text
state.sceneDrafts = active scene only
state.loadedProjectSceneStore = {}
```

`refreshScenes()` therefore reconstructs `state.scenes` from an incomplete project.

### Why World Spine rows disappear

Normal World Spine location rows are projections from scene/event metadata; they are not standalone canonical `LocationRow` entities.

Example:

```text
Scene A -> Earth
Scene B -> Earth
Scene C -> Mars

projection:
Earth row: A, B
Mars row: C
```

If Scene A/B/C metadata is not present in runtime after reload, the corresponding projected rows and placements disappear even if their scene chunks remain persisted.

### Fix direction

Preserve active-scene/lazy hydration, but ensure the runtime receives a complete retained scene store or an equivalent complete metadata store after browser reload.

The smallest coherent fix should first evaluate the existing intended role of `state.loadedProjectSceneStore`.

Likely direction:

```text
loadProjectLibrarySnapshot()
    |
    +--> projects: active-scene hydrated records
    |
    `--> sceneStore: complete retained scene records by project ID
```

If loading every full scene body into the retained store conflicts with memory goals, implement a metadata-capable retained representation or lazy repository-backed access. Do not silently replace chunked loading with eager active-state hydration.

## Defect B — Partial scene drafts can become the project word count

### Observed symptom

Historical project word counts have dropped drastically after reload at the same time that only one scene body appeared loaded.

### Current problematic resolver

`app.js` currently contains `getProjectRecordWordCountForSettings(record)` and related metric helpers.

The effective precedence is:

```text
1. count workspace manuscript body
   if > 0 -> return it

2. count record.sceneDrafts
   if > 0 -> return it

3. otherwise sum projectIndex scene word counts
```

Under lazy loading, step 2 is unsafe.

Example:

```text
actual manuscript total: 87,400
projectIndex total:      87,400
active scene draft:       3,200

record.sceneDrafts subtotal > 0
    -> resolver returns 3,200
```

The complete `projectIndex` value is never reached.

### Consequences

This can feed an incomplete project total into:

- header manuscript word count;
- project statistics;
- writing-target initialization;
- daily baseline calculations;
- session baseline calculations;
- target progress;
- writing history snapshots;
- release/pace projections.

The writing-goals state service already accepts `getCurrentManuscriptWordCount()` as a dependency, which is a useful boundary. The writing-goals implementation should not need to be rewritten if that dependency is made authoritative and hydration-safe.

## Refactor — move project metric authority out of app.js

### Problem

`app.js` currently contains project-wide metric-resolution logic such as:

- `getWorkspaceManuscriptWordCount()`;
- `getProjectRecordWordCountForSettings()`;
- `getProjectIndexSceneWordCount()`;
- chapter word-count lookup/resolution;
- `buildWorkspaceStatsFromProjectIndex()`;
- ad-hoc `indexedWordTotal` calculations.

This makes `app.js` both an application orchestrator and a project-metric authority.

The file itself is intended to bootstrap/orchestrate the browser editor while feature logic moves outward, so these pure calculations should not remain there.

### Existing ownership that must be preserved

Do not duplicate these existing responsibilities:

```text
project-index.js
  persisted complete-project scene/chapter metrics and structure

writing-goals-state-service.js
  writing-goal domain state, baselines, sessions, history, pace, targets

writing-goals-service.js
  writing-goals UI/browser orchestration

project-persistence-service.js
  canonical mutation/save policy

project-repository.js
  physical manifest + scene-chunk storage
```

### Proposed metric calculation layer

Extract/consolidate the pure metric-resolution functions from `app.js` into a focused module, preferably something like:

```text
project-metrics.js
```

Use a `-service` suffix only if the implementation genuinely owns state/orchestration. A stateless pure-function module is preferred.

The module should read the existing project index and optionally overlay live dirty-scene values.

Illustrative API only:

```js
getProjectWordCount(projectIndex, liveSceneOverrides)
getSceneWordCount(projectIndex, sceneId, liveSceneOverrides)
getChapterWordCount(projectIndex, chapterId, liveSceneOverrides)
buildProjectMetrics(projectIndex, liveSceneOverrides)
```

Codex should choose final names based on existing conventions and call sites.

### Authority rule

```text
Scene body
  -> scene chunk / live scene draft

Complete scene list
  -> projectIndex

Persisted scene word count
  -> projectIndex.scenes[n].wordCount

Current dirty scene word count
  -> live override for that scene

Current project word count
  -> complete projectIndex totals with live dirty-scene overrides

Writing-goal baseline/history
  -> WritingGoalsStateService

Hydration state
  -> never evidence of project completeness
```

### Expected live-edit calculation

```text
projectIndex:
scene-1 = 2,000
scene-2 = 3,000
scene-3 = 4,000
scene-4 = 1,000

live dirty scene-3 = 4,150

current project total:
2,000 + 3,000 + 4,150 + 1,000 = 10,150
```

Scenes 1, 2, and 4 do not need to be hydrated for this calculation.

## World Spine secondary defects discovered during diagnosis

These are separate from the two primary architecture defects but should remain in scope for the current World Spine branch after the underlying load/metric work is understood.

### Delete-row UI eligibility mismatch

The delete handler accepts a populated row when any of the following exist:

- primary node IDs;
- scene IDs;
- world node IDs.

The UI visibility predicate is narrower and requires primary/row node IDs.

Result: a legitimate populated row can be deletable by the handler but never expose the Delete action to the user.

Fix by aligning the UI eligibility rule with the handler's actual supported membership model.

### Drag + binder reorder persistence boundary

The World Spine scene reorder/location-drop path applies location metadata and then may also call binder scene movement logic.

The explicit `persistCurrentProjectRecord({ changedSceneIds, ... })` path is currently skipped in one branch when the binder move reports success, leaving persistence to the binder move path.

Verify the exact `moveBinderScene()` persistence behavior before changing it, but preserve this invariant:

> Every World Spine row assignment/unplacement mutation must carry its affected `changedSceneIds` through the canonical persistence boundary regardless of whether the same gesture also reorders binder structure.

## Implementation order

### Phase 1 — Characterisation tests first

Before changing architecture, add failing tests that reproduce the diagnosed behavior.

Required cases:

1. active scene is Scene 1; persist metadata/body for non-active Scene 2; reload project library; verify Scene 2 remains available through the retained project scene store or equivalent complete-project access path;
2. project index contains a complete multi-scene word count while only one scene is hydrated; verify project total remains the complete total;
3. change which scene is hydrated without changing manuscript text; verify project total does not change;
4. writing-target current count/baseline does not collapse after hydration-only reload.

### Phase 2 — Repair browser reload scene handoff

- preserve chunked storage;
- preserve active-scene/lazy runtime semantics;
- make persisted non-active scene metadata/body retrievable after reload through the intended retained scene path;
- verify `refreshScenes()` can reconstruct the logical project without requiring each scene to be opened.

### Phase 3 — Extract and consolidate project metrics

- move project metric calculation logic out of `app.js`;
- use `projectIndex` as complete persisted metric authority;
- support live dirty-scene overrides;
- replace existing app-level/ad-hoc calculations rather than retaining duplicate implementations;
- keep writing-goal domain calculations in `writing-goals-state-service.js` and feed them the corrected current manuscript count.

### Phase 4 — World Spine local fixes

- align Delete-row action availability with handler eligibility;
- verify drag + binder reorder persists `changedSceneIds` correctly;
- verify row naming, movement, deletion, and unplacement all survive browser reload.

### Phase 5 — Regression verification

Run the repository supervisor using the changed-file path first:

```text
npm run repo -- test --changed
```

Only broaden to canonical/full verification if supervisor routing escalates or the changed architecture warrants it.

## Acceptance criteria

The implementation is not complete until all of the following hold.

### Hydration

- A project with many scenes may hydrate only one active scene without losing the logical existence of any other scene.
- Non-active scene bodies remain retrievable after browser reload.
- Non-active scene World Spine metadata remains available to World Spine projection after browser reload.

### Metrics

- Total project word count is identical before and after a hydration-only reload.
- Changing the active/hydrated scene changes project word count by exactly zero.
- Editing one scene by +N words changes project total by exactly +N.
- Deleting N words from one scene changes project total by exactly -N.
- Chapter totals remain correct when only one scene body is hydrated.

### Writing goals

- Daily baseline is unchanged by hydration-only reload.
- Session baseline is unchanged by hydration-only reload.
- Daily/session/project progress does not collapse to the active scene's word count.
- Existing writing-target history remains valid when scenes are lazily loaded.

### World Spine

- Name a populated row, refresh, row remains.
- Drag a non-active scene/event into a row, refresh, placement remains.
- Drag while also reordering binder structure, refresh, placement remains.
- Delete a populated row, contents become `Unplaced location`, refresh, contents remain unplaced.
- Delete action is reachable for every row type the handler supports.

## Do not fix it by

Do not:

- introduce canonical standalone `LocationRow` entities;
- place all scene bodies back into the manifest;
- eagerly hydrate every scene into `state.sceneDrafts` solely to make metrics or World Spine work;
- calculate project-wide metrics from DOM state;
- derive project totals from the currently hydrated subset of scene drafts;
- create a second persisted project-metrics model beside `projectIndex`;
- create a new generic metrics service while leaving the existing `app.js` metric calculations in place;
- move writing-goal baselines/history into the project index;
- perform a broad persistence rewrite without evidence that the smaller retained-scene handoff fix is insufficient.

## Codex review instructions

When implementing this document:

1. Treat the invariants and acceptance criteria above as authoritative.
2. Re-read the current implementation before editing; this diagnosis reflects the reviewed branch state but implementation may have moved.
3. Start with characterisation/regression tests that fail for the diagnosed reasons.
4. Preserve chunked/lazy loading.
5. Prefer the smallest coherent fix to the scene-store handoff rather than eager hydration.
6. Consolidate project metric logic around `projectIndex`; do not introduce duplicate metric authority.
7. Move project-wide metric calculations out of `app.js` into a focused pure module where practical.
8. Keep writing-goal domain state/history in the existing writing-goals state service.
9. Verify `moveBinderScene()` persistence before changing the World Spine drag branch; do not assume it is broken without tracing it.
10. Keep unrelated feature architecture out of scope.
11. Run `npm run repo -- test --changed` first and consume the compact supervisor report before manually broadening test exploration.

## Suggested implementation branch

The current diagnosis document lives on:

```text
feature/world-spine/unplaced-events-dock
```

Because the primary hydration/metrics defects are broader than World Spine, implementation may be cleaner on a dedicated branch such as:

```text
fix/chunked-scene-hydration-metrics
```

If a separate fix branch is created, base it on the commit containing this diagnosis so the document remains the implementation contract. Merge/rebase the resulting underlying fix into the World Spine feature work before finalizing the dock-specific issues.
