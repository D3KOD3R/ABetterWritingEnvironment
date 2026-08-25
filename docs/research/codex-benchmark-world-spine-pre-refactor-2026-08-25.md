# Codex Benchmark — World Spine Navigation — Pre Agent Refactor

Date: 2026-08-25

Purpose: preserve the raw pre-refactor benchmark evidence used to compare Codex context/read behaviour before and after the scoped-agent refactor.

## Benchmark conditions

- Task: read-only trace for a future World Spine location-row delete workflow.
- Reported wall time: **1m 37s**.
- Reported HEAD: `bc5d72f1042f9f040ef6397c0f7054f5c89bd868`.
- Root `AGENTS.md` baseline at that commit: **35,487 bytes**.
- Exact Codex usage/token/credit metric: **Not available**.
- Context compaction/retrace: **No**.
- Repository modifications by benchmark: **None**.

Note: this local HEAD predates the subsequent documentation-only tracker/audit commits. This does not invalidate the instruction baseline because the root `AGENTS.md` being measured was unchanged, but the local repo must sync/pull current `main` before implementing the refactor so the committed audit and project-status files are available.

## Codex result summary

Codex correctly identified the World Spine location-row path as a render-time projection rather than a canonical `LocationRow` domain record.

Execution path reported:

1. `apps/editor/public/features/world-spine/world-spine-panel.js`
   - `buildWorldSpineTimelineModel()` derives timeline location rows.
   - `createWorldSpineTimelineLocationRows()` groups primary nodes by resolved location.
   - `renderWorldSpinePanelHTML()` includes row UI.
   - `renderTimelineLocationRowGuides()` emits the clickable `world-spine-edit-location-row` labels.
2. `apps/editor/public/app.js`
   - routes the row action to `openWorldSpineLocationRowFormFromLabel()`.
   - the form captures row/spine/node/scene identifiers in runtime state.
   - `saveWorldSpineLocationRowFromForm()` is the existing row mutation path; no delete action exists yet.
3. Canonical ownership is distributed across `state.workspace.world` and scene/draft records rather than a standalone `LocationRow` record.
4. `persistCurrentProjectRecord()` delegates through `ProjectPersistenceService.commitCanonicalProjectMutation()` and project runtime/record state into durable project state.
5. Future deletion must define policy for scene location fields/metadata, event tags, world spines/nodes, row imagery/catalogue data, entity links, UI-only filter/context state, and whether nodes themselves are retained or removed.
6. Relevant tests identified:
   - `test/world-spine-panel.test.mjs`
   - `test/project-persistence-service.test.mjs`
   - `test/worldbuilding-studio.test.mjs`
   - `test/world-spine-implication-service.test.mjs`
7. Closest full delete pattern identified:
   - `deleteWorldbuildingCatalogueItem()` in `apps/editor/public/app.js`
   - backed by `deleteWorldbuildingCatalogueItemFromWorld()` in `worldbuilding-studio.js`.

## Read-behaviour observations

Codex reported intentionally reading bounded/relevant regions in:

- `apps/editor/public/app.js`
- `apps/editor/public/features/world-spine/world-spine-panel.js`
- `apps/editor/public/features/world-spine/world-spine-location-row-service.js`
- `apps/editor/public/features/world-spine/worldbuilding-studio.js`
- `apps/editor/public/features/world-spine/world-spine-implication-service.js`
- `apps/editor/public/adapters/storage/project-persistence-service.js`
- project runtime/record state modules
- `packages/world-schema/src/index.ts`
- the four relevant test files listed above

Reported context/read discipline:

- broad very-large-file read: **No**;
- `features.md` opened: **No**;
- all/large portion of `apps/editor/public/app.js` opened: **No**;
- architecture roadmap opened: **No**;
- specialised instruction files beyond root: **No**;
- context compaction/retrace: **No**.

## Baseline interpretation

This is a **strong read-discipline baseline**. Codex did not exhibit the large-file or architecture-document over-reading that the refactor is intended to guard against.

Therefore the main expected gain from the first agent refactor is not necessarily fewer source-file reads on this particular task. It is the reduction in **standing injected repository instructions**: the current large root `AGENTS.md` is loaded as repository instruction context before task-specific navigation. Post-refactor evaluation should therefore compare:

- root instruction footprint;
- root + only relevant scoped-agent footprint;
- whether unrelated agent files fan out;
- whether bounded source-read discipline remains at least as good;
- wall time as a secondary workflow metric;
- exact Codex usage only if the client exposes a comparable value.

A successful post-refactor run should preserve this benchmark's correctness and bounded-read behaviour while materially shrinking the standing instruction payload.

## Matched post-refactor prompt

Repeat the same World Spine inspection prompt used for this run, using the same model/reasoning configuration where practical. Do not change the production feature as part of the benchmark.

Related audit: `docs/research/agent-refactor-context-audit.md`.
