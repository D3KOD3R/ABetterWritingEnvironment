# Editor Application

## Purpose

`apps/editor` is the author-facing manuscript and worldbuilding surface. It renders the workbench state provided by the desktop host without owning domain composition, model execution, or local runtime setup.

## Responsibilities

- rendering binder navigation and the editable scene viewport
- deriving IDE-style visual line gutters from editor width preferences for the active scene
- managing local scene draft state and editor presentation preferences inside the UI shell
- exposing binder-side local draft creation for chapters and scenes
- exposing world-side local draft creation for templates
- composing local anchored task, inspiration, and research note interactions in the scene editor
- presenting issue console and event pin data
- visualizing world spine lanes, nodes, and cross-spine edges
- presenting narration follow state
- presenting the combined narration follow viewport and right-side voice routing
- presenting character voice routing and render queues

## Boundaries

- `apps/editor` does not create manuscript or world invariants on its own.
- `apps/editor` does not host the runtime or local settings layer.
- The browser UI consumes a serialized workspace snapshot from `apps/desktop`.
- Selection, local draft edits, and editor preferences stay in the UI; diagnostics, narration state, and voice jobs remain service-owned data.
- Browser-local drafts are advisory editing state until a later persistence layer writes accepted scene changes back through canonical manuscript workflows.
- The file menu can round-trip the current saved-project library to a local JSON project file through the desktop host, but the browser UI does not own the file I/O itself.
- Draft chapters, scenes, and templates are local overlays until a persistence path is added through canonical packages and services.
- Diagnostics are overlays on scene documents. They reference scene-local line positions derived from canonical anchors; they do not define editor segmentation or create manuscript structure.

## Current Flow

1. `apps/desktop` composes canonical manuscript and world data with analysis, audio, and voice services.
2. The desktop host serializes that composition into shared workspace DTOs.
3. The browser fetches `/api/workspace`, derives scene records, overlays any browser-local draft edits, and computes width-driven visual line gutters for the active scene viewport.
4. Diagnostics remain anchored to the scene document and resolve to scene-local line references in the UI instead of driving manuscript structure.
5. The narration follow pane centers the current reading line and keeps the voice rail beside it, but the UI still only renders the state that the audio and voice services own.
6. User selections, scene text edits, typography preferences, and draft structure/template additions stay in UI state and never rewrite canonical data implicitly.

## Anchored Author Notes

Tasks, inspiration notes, and research notes are documented in [Anchored Editor Notes](./anchored-editor-notes.md). Tasks save with selected manuscript text as recovery evidence, but they behave as location-first markers that should return the user to the same manuscript area even if the selected text changes. Inspiration and research use a draft-only blue inline bubble first; the note is not persisted until the user types the related verse in the bubble's normal manuscript field and explicitly saves the note against the inserted typed range.

Project save-file requirements are tracked in [Project Save Model](./project-save-model.md). The save path must treat source-linked comments as tasks, preserve manuscript/worldbuilding provenance, and support media-aware research cards before a loaded project can fully replace the seeded demo workspace.

## Refactor Roadmap

The step-by-step editor split plan is documented in [Editor Application Refactor Roadmap](./editor-application-roadmap.md). Use that roadmap when extracting feature slices, state modules, and persistence services out of `apps/editor/public/app.js`.
