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

## Current Checkpoint

The browser shell remains a high-coupling migration surface. `app.js` is still responsible for broad rendering, event routing, project activation glue, manuscript interactions, and several feature workflows even though extraction has begun.

Completed or active slices:

- `apps/editor/public/shell/editor-chrome.js` owns the top editor chrome and the writing-goals/revisions launch surfaces.
- `apps/editor/public/features/writing-targets/writing-target-window.js` owns the writing-goals window markup.
- `apps/editor/public/features/revisions/revision-window.js` owns the standalone revision comparison window markup.
- `apps/editor/public/features/scene-editor.js` owns central scene-editor markup.
- `apps/editor/public/features/manuscript-editor/manuscript-command-controller.js` owns the first selection-aware inline formatting command path.
- `apps/editor/public/adapters/storage/project-persistence-service.js` owns project-file save/load/autosave/import/export orchestration.
- `apps/editor/public/adapters/storage/project-repository.js` preserves the scene-level inline formatting compatibility field through persistence.

Immediate constraint:

- Do not expand major editor workflows in `app.js`; extract ownership or add a small compatibility call into an existing boundary.
- Treat `inlineFormatRanges` as compatibility data while canonical anchor-backed marks and render projections are designed and tested.
- Treat the active `.abe-project.json` snapshot as durable truth until a desktop folder-backed adapter is implemented.

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

### Phase 1: Stabilize Persistence And Project-State Ownership

Goal:
- prevent author data loss while shell extraction continues
- move remaining project activation, cache, normalization, and selection-default hydration behind state/persistence boundaries

Deliverables:
- completed project-file persistence service boundary
- completed task/note and inline-format compatibility round-trip coverage
- project snapshot/cache activation controller outside feature UI
- explicit selectors for active-project and persisted-scene state

Exit criteria:
- project-file load cannot merge stale cached author data into the activated project
- project features commit canonical mutations through `ProjectPersistenceService`
- project normalization and cache replacement are no longer embedded across `app.js`

Status:
- In progress: persistence service and round-trip guardrails exist; project activation/cache glue still remains in `app.js`.

### Phase 2: Establish Manuscript Projection And Command Boundaries

Goal:
- separate manuscript command state and visual channels from shell rendering
- keep author-approved data distinct from runtime-only editor visuals

Deliverables:
- manuscript controller for input actions, selection snapshots, find/replace, and inline command dispatch
- projection selector combining author marks/compatibility ranges, anchored records, diagnostics, suggestions, spellcheck, search, and narration channels
- editor-host interface with the textarea overlay as the compatibility adapter
- tests for projection priority/lifecycle and persistence exclusion of runtime-only channels

Exit criteria:
- editor rendering consumes projections without persisting editor decoration objects
- inline formatting mutations and anchored records route through durable project commands
- scene editing no longer depends on unrelated shell rerenders

Status:
- In progress: scene-editor extraction and inline-format command controller are present; centralized projection selection and editor-host interfaces remain.

### Phase 3: Extract Grammar And Spellcheck As A Projection Source

Goal:
- isolate the highest-churn editor feature first

Deliverables:
- spellcheck service/module
- spellcheck projection producer and grammar panel renderer
- grammar toggle control
- active-word typing suppression logic
- dictionary and exceptions workflow

Exit criteria:
- grammar UI can be refreshed without re-rendering the full manuscript shell
- spellcheck rules can be unit tested independently of the editor page
- spellcheck ranges are runtime projections and cannot enter project persistence

### Phase 4: Extract Anchored Records And Workflow Panels

Goal:
- give task, inspiration, and research workflows one anchor-aware owner

Deliverables:
- task controller and passage-note controller
- shared anchor recovery/navigation helpers
- writing-target dashboard ownership completion
- context-menu routing for anchored manuscript actions

Exit criteria:
- durable anchored records persist through project services
- side-panel navigation uses projection/anchor selectors rather than shell-specific range state

### Phase 5: Reduce The Shell And Introduce The Store Facade

Goal:
- reduce `app.js` to bootstrap, composition, compatibility wiring, and global effect scheduling

Deliverables:
- a central editor bootstrap module
- a store or store-like facade for editor state
- explicit selectors for derived UI state
- a single place where render orchestration happens

Exit criteria:
- feature modules can read state without directly mutating unrelated global objects
- new feature-specific logic is no longer added to `app.js`
- `app.js` is reduced toward a composition/compatibility target of approximately 3,000 lines or fewer

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

### Phase 7: Evaluate A CodeMirror Editor-Host Adapter

Goal:
- replace fragile textarea-overlay rendering only after manuscript ownership and projection contracts are enforceable

Deliverables:
- CodeMirror-backed editor-host experiment for one scene surface
- mapping from canonical anchors/projected channels into editor decorations
- parity checks for save/load, selection, IME input, spellcheck, autosave, navigation, and narration projection

Exit criteria:
- the adapter can be enabled without changing canonical project records or persistence paths
- the textarea host remains a viable fallback until the experiment satisfies behavior checks

## Suggested File Map

This is the first-pass directory plan for the browser app.

```text
apps/editor/public/
  app.js
  bootstrap/
  shell/
  state/
  features/
    manuscript-editor/
      manuscript-controller.js
      manuscript-view.js
      projection-selector.js
      editor-host-interface.js
    spellcheck/
      spellcheck-controller.js
      spellcheck-projection-source.js
    anchored-records/
      task-controller.js
      passage-note-controller.js
      anchor-recovery.js
    revisions/
    writing-targets/
    narration/
    voice/
    world/
  adapters/
    desktop-host/
    editor-host/
      textarea-editor-host.js
      codemirror-editor-host.js
    storage/
    workspace/
  shared/
```

## Suggested First Extractions

These are the lowest-risk extractions to start with:

| Current file | Likely target home | Why |
| --- | --- | --- |
| `apps/editor/public/app.js` | `bootstrap/editor-app.js`, `shell/editor-shell.js`, `state/editor-store.js` | split boot, render orchestration, and state ownership |
| `apps/editor/public/spellcheck.js` | `features/spellcheck/spellcheck-core.js` | pure grammar logic should stay DOM-free and testable |
| `apps/editor/public/features/scene-editor.js` | `features/manuscript-editor/manuscript-view.js` | scene editor rendering already has a clear slice boundary |
| `apps/editor/public/features/progress-tracker.js` | `features/writing-targets/progress-tracker-view.js` | writing-target UI should be isolated from manuscript shell code |
| `apps/editor/public/session-tracker-icons.js` | `features/writing-targets/session-tracker-icons.js` | feature-local asset helper |
| `apps/editor/public/serva-vitae-project-library.js` | `adapters/storage/project-library.js` | project library persistence belongs with storage and load/save code |
| save/load and autosave helpers inside `app.js` | `adapters/storage/project-file.js` and `adapters/storage/autosave.js` | persistence should be moved out of the shell |
| grammar check panel helpers inside `app.js` | `features/spellcheck/panel.js` | panel rendering and interactions should live with the feature |
| task/note anchor and navigation handlers inside `app.js` | `features/anchored-records/*` | persisted records and their navigation should have an anchor-aware owner |
| inline range and visual overlay selection inside `app.js` | `features/manuscript-editor/projection-selector.js` | durable and runtime visual channels need one deterministic render contract |

Those pieces already have a clear responsibility and are easy to validate without changing the canonical manuscript model.

## Testing Strategy

Every extraction should bring tests with it.

- Unit tests for reducers, selectors, and pure helpers.
- DOM integration tests for feature controllers and panel interactions.
- Persistence round-trip tests for save/load and autosave.
- Projection lifecycle tests ensuring runtime-only decoration channels are never persisted.
- Schema migration tests for any change that affects local storage or project files.
- A small smoke test for each new feature slice before the next slice is extracted.

## Ownership Rules

- `packages/manuscript-schema` stays the source of truth for manuscript identity and anchors.
- `packages/world-schema` stays the source of truth for templates, entities, spines, and timeline links.
- `packages/shared-types` and `packages/job-contracts` stay the source of truth for service contracts and job state.
- `apps/desktop` owns filesystem integration, local settings, and workspace composition.
- `apps/editor` owns presentation, interaction, and feature orchestration.
- `apps/editor/public/app.js` should eventually be reduced to shell wiring and compatibility glue.
- The diagrams in `docs/architecture/editor-boundary-diagrams.md` define migration ownership, not a permanent class inventory of the current monolith.

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
