# Editor Application

## Purpose

`apps/editor` is the author-facing manuscript and worldbuilding surface. It renders the workbench state provided by the desktop host without owning domain composition, model execution, or local runtime setup.

## Responsibilities

- rendering binder navigation and the editable scene viewport
- deriving IDE-style visual line gutters from editor width preferences for the active scene
- managing scene editing interactions and transient editor presentation preferences inside the UI shell
- exposing binder-side chapter and scene creation commands that commit through the project persistence boundary
- exposing world-side template editing interactions while preserving structured world ownership
- composing anchored task, inspiration, and research note interactions in the scene editor
- presenting issue console and event pin data
- visualizing world spine lanes, nodes, and cross-spine edges
- presenting narration follow state
- presenting the combined narration follow viewport and right-side voice routing
- presenting character voice routing and render queues

## Boundaries

- `apps/editor` does not create manuscript or world invariants on its own.
- `apps/editor` does not host the runtime or local settings layer.
- The browser UI consumes a serialized workspace snapshot from `apps/desktop`.
- Cursor, active selection, open panels, scroll position, and render-only decorations stay in UI state; durable scene edits, tasks, notes, and current formatting compatibility ranges belong to project data.
- The active `.abe-project.json` snapshot is current durable project truth for the browser/desktop prototype and all save, load, autosave, import, and export workflows route through `ProjectPersistenceService`.
- Browser cache is a disposable compatibility layer. Loading a project snapshot must replace stale cached author data rather than merge old scene content, tasks, notes, revisions, or metrics into the loaded record.
- Author formatting currently persists as scene-record `inlineFormatRanges` only as a compatibility representation; it must converge on canonical anchor-backed manuscript marks rather than an editor-owned decorations collection.
- Tasks and passage notes are durable anchored author records. Their visible highlights are projections, not storage records.
- Diagnostics must be rendered as overlays on scene documents. They reference scene-local line positions derived from canonical anchors; they do not define editor segmentation or create manuscript structure. The anchored `diagnostic` projection source is the next Phase 2 editor slice.

## Current Flow

1. `apps/desktop` composes canonical manuscript and world data with analysis, audio, and voice services.
2. The desktop host serializes that composition into shared workspace DTOs.
3. The browser fetches `/api/workspace`, activates the current project record, hydrates scene content through the persistence boundary, and computes width-driven visual line gutters for the active scene viewport.
4. User manuscript commands mutate the active scene/project record, mark relevant persistence domains dirty, and are committed through `ProjectPersistenceService` to cache and the configured project-file destination.
5. Tasks, notes, formatting compatibility ranges, spellcheck findings, search state, and narration follow state currently convert into distinct visual channels for the active scene; runtime-only channels are discarded and rebuilt rather than stored as project truth.
6. Diagnostics remain anchored to manuscript content and currently resolve through the issue console; Phase 2 next adds their derived manuscript projection without changing `IssueRecord` persistence or navigation ownership.
7. World and Dream Scaping suggestion queues remain review-panel records, not manuscript projections; a manuscript suggestion channel requires a separate anchored suggestion contract.
8. The narration follow pane centers the current reading line and keeps the voice rail beside it, but the UI only projects the session/alignment state owned by audio and voice services.

## Anchored Author Notes

Tasks, inspiration notes, and research notes are documented in [Anchored Editor Notes](./anchored-editor-notes.md). Tasks save with selected manuscript text as recovery evidence, but they behave as location-first markers that should return the user to the same manuscript area even if the selected text changes. Inspiration and research use a draft-only blue inline bubble first; the note is not persisted until the user types the related verse in the bubble's normal manuscript field and explicitly saves the note against the inserted typed range.

Project save-file requirements are tracked in [Project Save Model](./project-save-model.md). The save path treats source-linked comments as tasks, preserves manuscript/worldbuilding provenance, and must keep loaded project data isolated from stale browser cache.

Author marks, anchored author records, AI proposals, and transient rendering are distinguished in [Manuscript Marks And Decoration Projection Layer](./manuscript-decoration-layer.md). The corresponding component, sequence, and conceptual-domain views are maintained in [Editor Boundary Diagrams](./editor-boundary-diagrams.md).

## Refactor Roadmap

The step-by-step editor split plan is documented in [Editor Application Refactor Roadmap](./editor-application-roadmap.md). Use that roadmap when extracting feature slices, state modules, and persistence services out of `apps/editor/public/app.js`.
