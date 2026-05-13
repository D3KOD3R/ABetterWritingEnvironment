# Editor Application Refactor Roadmap

## Why This Exists

`apps/editor/public/app.js` is currently the composition root, event router, state store, renderer, persistence layer, and feature controller for the browser editor. That makes the file hard to reason about, hard to test in isolation, and risky to change.

The repo already has the right long-term boundaries in the domain packages and architecture docs. This roadmap turns that intent into a practical migration order.

## Target Shape

The browser app should be organized by responsibility, not by "everything that happens in the editor."

### Proposed Layers

| Layer | Owns | Does Not Own |
| --- | --- | --- |
| `apps/editor/public/bootstrap` | boot sequence, DOM mount, host wiring, initial workspace fetch | feature logic, persistence rules |
| `apps/editor/public/state` | editor store, actions, selectors, normalization helpers, derived view state | DOM rendering, local storage calls |
| `apps/editor/public/features/*` | feature-specific rendering, event handlers, and local UI state | canonical manuscript rules, file I/O |
| `apps/editor/public/adapters/*` | browser-side host/storage adapters and bridge code | canonical domain rules, feature DOM |
| `apps/editor/public/shared` | small reusable UI helpers and formatting utilities | state mutation, persistence, analysis |
| `packages/*` | canonical manuscript, world, shared, and job contracts | browser UI implementation |

### What `app.js` Should Become

`app.js` should shrink to a thin shell that:

1. boots the editor
2. loads the workspace snapshot
3. wires top-level events
4. dispatches into feature modules
5. coordinates global renders when the store changes

It should not be the place where new feature logic is added.

## Architecture Principles

- Feature slices own their own UI, local state, and event handlers.
- Derived state should be computed in selectors, not duplicated in persistent state.
- Render functions should be as close to pure as possible.
- Event handlers should dispatch actions; they should not mutate cross-cutting global state directly.
- Browser-side adapter code can talk to storage and the desktop host, but repo-root service logic stays outside the editor bundle.
- No generic `utils` or `misc` bucket should be used as a dumping ground.
- Cross-feature imports should be minimized; shared helpers belong in `shared/` or a true platform adapter.

## Store Contract

The browser editor should move toward a single store facade:

- `getState()`
- `dispatch(action)`
- `subscribe(listener)`
- selectors for derived UI state
- an effect queue for asynchronous work like save, autosave, spellcheck, and layout refresh

Suggested state buckets:

- `workspaceSnapshot` for the server-owned workspace data
- `persistentEditorPrefs` for user preferences that survive reloads
- `featureState` for slice-specific UI state
- `transientUiState` for selections, open panels, drag state, and in-progress edits

## Module Contract

Each feature slice should expose some combination of:

- `initialState`
- `reducer`
- `selectors`
- `render`
- `bindEvents`
- `effects`
- `destroy`

Not every module needs all of these exports, but a slice should have an obvious owner and a small, predictable API.

## Current Pain Points

The current monolith mixes these concerns together:

- bootstrapping and global event listeners
- manuscript scene rendering
- binder rendering
- grammar check, spellcheck, and dictionary actions
- file open/save/autosave behavior
- writing target dashboards and session tracking
- tasks, notes, and right-click context workflows
- narration and voice UI
- worldbuilding UI
- project library persistence and local settings

That coupling means a simple UI fix can accidentally touch unrelated layout or persistence behavior.

## Dependency Rules

- `bootstrap -> shell -> feature slices -> shared helpers -> packages`
- Feature slices may depend on shared helpers and store selectors, but not on each other directly.
- Browser-side adapters may depend on the desktop host or storage APIs, but not on feature DOM structure.
- Repo-root `services/*` remain the home for analysis, audio, and voice runtimes.
- Editor-side adapters should never reimplement those service runtimes.
- Avoid circular imports by keeping feature ownership one-way.

## Recommended Migration Order

### Phase 1: Create a Real Editor Shell

Goal:
- reduce `app.js` to a composition root and event dispatcher
- create a predictable module boundary for the rest of the work

Deliverables:
- a central editor bootstrap module
- a store or store-like facade for editor state
- explicit selectors for derived UI state
- a single place where render orchestration happens

Exit criteria:
- feature modules can read state without directly mutating unrelated global objects
- `app.js` no longer contains new feature-specific logic

### Phase 2: Extract Persistence and Autosave

Goal:
- move all save/load and autosave behavior behind a service boundary

Deliverables:
- project file service
- autosave service
- local storage adapter for editor preferences and drafts
- clear separation between "dirty state" and "write to disk"

Exit criteria:
- saving a project does not require feature code to know file API details
- autosave can be tested without rendering the full editor

Status:
- Started: low-level project-file I/O now lives in `apps/editor/public/adapters/storage/project-file.js`.
- Started: project-file autosave timing and dirty-state transitions now live in `apps/editor/public/adapters/storage/autosave.js`.
- Remaining: move project-library snapshot normalization, local preference storage, and project-cache persistence out of `apps/editor/public/app.js`.

### Phase 3: Extract Grammar and Spellcheck

Goal:
- isolate the highest-churn editor feature first

Deliverables:
- spellcheck service/module
- grammar panel renderer
- grammar toggle control
- active-word typing suppression logic
- dictionary and exceptions workflow

Exit criteria:
- grammar UI can be refreshed without re-rendering the full manuscript shell
- spellcheck rules can be unit tested independently of the editor page

### Phase 4: Extract Manuscript Editing

Goal:
- separate the scene editor from global shell behavior

Deliverables:
- scene editor feature module
- line gutter and selection helpers
- binder and scene navigation helpers
- find/replace controller

Exit criteria:
- the manuscript viewport can render from a feature module without `app.js` constructing it directly
- text-edit interactions do not require unrelated shell re-renders

### Phase 5: Extract Tasks, Notes, and Workflow Panels

Goal:
- split the remaining authoring workflows into their own feature slices

Deliverables:
- task composer and task list feature
- anchored inspiration and research note feature
- writing target dashboard feature
- right-click context menus for manuscript actions

Exit criteria:
- each workflow panel has one obvious owner
- feature state changes do not cascade through the whole app

### Phase 6: Extract Narration, Voice, and Worldbuilding Surfaces

Goal:
- isolate the larger domain surfaces that should evolve independently

Deliverables:
- narration follow feature
- voice routing and preview feature
- world spine feature
- world template and entity feature

Exit criteria:
- these surfaces use shared workspace data and services, but do not rely on the manuscript shell for core behavior

## Suggested File Map

This is the first-pass directory plan for the browser app.

```text
apps/editor/public/
  app.js
  bootstrap/
  shell/
  state/
  features/
    manuscript/
    grammar/
    writing-targets/
    tasks/
    narration/
    voice/
    world/
  adapters/
    desktop-host/
    storage/
    workspace/
  shared/
```

## Suggested First Extractions

These are the lowest-risk extractions to start with:

| Current file | Likely target home | Why |
| --- | --- | --- |
| `apps/editor/public/app.js` | `bootstrap/editor-app.js`, `shell/editor-shell.js`, `state/editor-store.js` | split boot, render orchestration, and state ownership |
| `apps/editor/public/spellcheck.js` | `features/grammar/spellcheck-core.js` | pure grammar logic should stay DOM-free and testable |
| `apps/editor/public/features/scene-editor.js` | `features/manuscript/scene-editor-view.js` | scene editor rendering already has a clear slice boundary |
| `apps/editor/public/features/progress-tracker.js` | `features/writing-targets/progress-tracker-view.js` | writing-target UI should be isolated from manuscript shell code |
| `apps/editor/public/session-tracker-icons.js` | `features/writing-targets/session-tracker-icons.js` | feature-local asset helper |
| `apps/editor/public/serva-vitae-project-library.js` | `adapters/storage/project-library.js` | project library persistence belongs with storage and load/save code |
| save/load and autosave helpers inside `app.js` | `adapters/storage/project-file.js` and `adapters/storage/autosave.js` | persistence should be moved out of the shell |
| grammar check panel helpers inside `app.js` | `features/grammar/panel.js` | panel rendering and interactions should live with the feature |

Those pieces already have a clear responsibility and are easy to validate without changing the canonical manuscript model.

## Testing Strategy

Every extraction should bring tests with it.

- Unit tests for reducers, selectors, and pure helpers.
- DOM integration tests for feature controllers and panel interactions.
- Persistence round-trip tests for save/load and autosave.
- Schema migration tests for any change that affects local storage or project files.
- A small smoke test for each new feature slice before the next slice is extracted.

## Ownership Rules

- `packages/manuscript-schema` stays the source of truth for manuscript identity and anchors.
- `packages/world-schema` stays the source of truth for templates, entities, spines, and timeline links.
- `packages/shared-types` and `packages/job-contracts` stay the source of truth for service contracts and job state.
- `apps/desktop` owns filesystem integration, local settings, and workspace composition.
- `apps/editor` owns presentation, interaction, and feature orchestration.
- `apps/editor/public/app.js` should eventually be reduced to shell wiring and compatibility glue.

## Non-Goals

This roadmap is not:

- a framework rewrite
- a build-system rewrite
- a migration to a generic word processor architecture
- a removal of the current feature set

The goal is to improve maintainability while preserving the product identity of the repository.

## Success Criteria

The refactor is on track when:

- `app.js` is small enough to read in one sitting
- feature modules can be changed without cross-feature regressions
- persistence, autosave, and grammar checks are testable without the whole editor shell
- domain rules remain in the canonical packages, not in the UI layer
- new features have an obvious home before implementation starts
- there are no cross-feature import cycles in the browser app
- new slices are added through the established module contract instead of ad hoc globals
