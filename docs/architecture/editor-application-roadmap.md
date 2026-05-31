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

The browser shell remains a high-coupling migration surface. `app.js` is still responsible for broad rendering, event routing, activation wiring, manuscript browser effects, and several feature workflows even though state hydration and effect coordination have been extracted.

Completed or active slices:

- `apps/editor/public/shell/editor-chrome.js` owns the top editor chrome and the writing-goals/revisions launch surfaces.
- `apps/editor/public/features/writing-targets/writing-target-window.js` owns the writing-goals window markup.
- `apps/editor/public/features/revisions/revision-window.js` owns the standalone revision comparison window markup.
- `apps/editor/public/features/scene-editor.js` owns central scene-editor markup.
- `apps/editor/public/features/manuscript-editor/manuscript-command-controller.js` owns the first selection-aware inline formatting command path.
- `apps/editor/public/features/manuscript-editor/projection-selector.js` owns the current projection channels, mapping durable-derived inline-format compatibility ranges and active task/passage-note previews plus runtime-only spellcheck, search, and narration-follow findings into render descriptors.
- `apps/editor/public/features/manuscript-editor/editor-host-interface.js` owns the normalized render-only scene/projection input accepted by manuscript host adapters.
- `apps/editor/public/features/manuscript-editor/manuscript-find-controller.js` owns manuscript match derivation, find-panel view modeling, and replacement planning while the shell retains DOM focus and durable edit effects.
- `apps/editor/public/features/manuscript-editor/manuscript-input-controller.js` owns live scene text-input sequencing and inline-format range derivation while shell callbacks retain persistence, revision, and refresh effects.
- `apps/editor/public/features/manuscript-editor/manuscript-selection-controller.js` owns normalized selection text, context-range derivation, bookmark snapshots, and saved scene-selection policy while the shell retains browser focus and scroll effects.
- `apps/editor/public/features/manuscript-editor/anchored-record-navigation-controller.js` owns task/note selection matching and projection planning, with anchor-repair persistence kept behind explicit shell callbacks and disabled for hover-only previews.
- `apps/editor/public/features/spellcheck/grammar-check-panel.js` owns grammar-check panel view models, state transitions, drag sessions, and markup; `apps/editor/public/features/spellcheck/spellcheck-project-settings.js` owns project dictionary/exception list mutation rules; `apps/editor/public/features/spellcheck/spellcheck-context-menu.js` owns spellcheck context-menu view modeling/markup; `apps/editor/public/features/spellcheck/spellcheck-context-controller.js` owns context-menu record derivation; and `apps/editor/public/features/spellcheck/spellcheck-refresh-controller.js` owns spellcheck refresh debounce state while the shell still owns menu mounting, edit effects, and persistence effects.
- `apps/editor/public/adapters/editor-host/textarea-editor-host.js` owns the active textarea-overlay host markup, spellcheck/author-mark painting, anchored-record/search/narration selection preview styling, mirrored overlay styling, textarea command bridge, and the first focus/selection/viewport scrolling capabilities used by shell navigation.
- `apps/editor/public/state/project-library-state.js` owns project-library snapshot normalization, cache/seed merge policy, active-record resolution, and persisted selection-default normalization.
- `apps/editor/public/state/project-record-state.js` owns durable project-record normalization and construction from canonical workspace snapshots.
- `apps/editor/public/state/project-runtime-record-state.js` owns save-time assembly of the durable project record from live runtime state while receiving DOM selection capture through explicit callbacks.
- `apps/editor/public/state/project-activation-state.js` owns record-to-runtime state hydration before the activation controller coordinates effects.
- `apps/editor/public/state/project-activation-controller.js` owns project activation teardown, compatibility persistence, and shared post-activation refresh/render/snapshot orchestration.
- `apps/editor/public/adapters/storage/project-persistence-service.js` owns project-file save/load/autosave/import/export orchestration.
- `apps/editor/public/features/local-ai/local-ai-title-service.js` owns the editor-side Local AI title endpoint payload, default generation policy, title sanitization, and unavailable-provider response mapping.
- `apps/editor/public/adapters/storage/project-source-service.js` owns project-source desktop loading, source library normalization, merge, active-project selection, and project-library save orchestration.
- `apps/editor/public/features/anchored-records/anchored-record-service.js` owns anchored task/note collection mutations, dirty reasons, and persistence callback calls while the shell retains DOM reads and render scheduling.
- `apps/editor/public/features/narration/narration-media-service.js` owns project-media save/load endpoint calls and base64/blob conversion used by narration recording saves and voice preview loading.
- `apps/editor/public/features/narration/narration-metadata-sync-service.js` owns narration session, alignment job, saved voice recording, and voice render-job metadata sync after manuscript structure changes.
- `apps/editor/public/features/narration/narration-media-recorder-service.js` owns MediaRecorder construction and event handling for captured audio chunks, recorder errors, and stop finalization dispatch.
- `apps/editor/public/features/narration/narration-recording-command-service.js` owns narration recording start/stop command sequencing, capability gates, microphone request ordering, recorder attachment, speech tracker attachment, and stop fallback finalization dispatch through injected browser/shell callbacks.
- `apps/editor/public/features/narration/narration-recording-finalization-service.js` owns stopped-runtime cleanup, project-media save result mapping, saved/failed take record creation, final paused session options, and recording failure/stop-error logging.
- `apps/editor/public/features/narration/narration-recording-runtime-service.js` owns shared cleanup for in-flight browser narration recorder timers, speech recognition, and media streams.
- `apps/editor/public/features/narration/narration-selection-service.js` owns armed narration verse selection derivation from scene/block/offset context.
- `apps/editor/public/features/narration/narration-speech-recognition-service.js` owns Web Speech API tracker setup and transcript/error/end event interpretation.
- `apps/editor/public/features/narration/narration-take-service.js` owns narration runtime DTO construction, initial session state, finalization context, recording blob creation, transcript/status normalization, elapsed-time labels, media MIME fallback, recording IDs, and project-media naming policy.
- `apps/editor/public/features/voice/voice-workflow-service.js` owns editor voice profile/job normalization, placeholder render-job transitions, and voice narration preference snapshot load/save.
- `apps/editor/public/features/voice/voice-recording-preview-service.js` owns browser audio/object-URL lifecycle for saved voice recording previews.
- `apps/editor/public/features/voice/voice-recording-service.js` owns saved voice/narration recording collection initialization, active-project filtering, lookup, and upsert mutation.
- `apps/editor/public/features/voice/voice-recording-action-service.js` owns saved recording preview orchestration and manuscript verse navigation planning.
- `apps/editor/public/adapters/storage/project-repository.js` preserves the scene-level inline formatting compatibility field through persistence.

Immediate constraint:

- Do not expand major editor workflows in `app.js`; extract ownership or add a small compatibility call into an existing boundary.
- Treat `inlineFormatRanges` as compatibility data while canonical anchor-backed marks and render projections are designed and tested.
- Treat the active `.abe-project.json` snapshot as durable truth until a desktop folder-backed adapter is implemented.

## Remote Review Checkpoint

Use this as the short status view when reviewing progress from GitHub on a phone.

Checkpoint date: `2026-05-28`

Backed-up implementation commit: `c9c6ce0` (`Refactor editor projection and project state boundaries`)

Current phase: `Phase 2 - Establish Manuscript Projection And Command Boundaries`

Completed in the current checkpoint:

- Phase 1 project persistence and activation state ownership is extracted behind `ProjectPersistenceService` and `apps/editor/public/state/*`.
- Scene editor compatibility rendering now runs through `editor-host-interface.js` and `textarea-editor-host.js`.
- Find/replace derivation, scene input sequencing, selection policy, anchored-record preview planning, and projection selection have feature-owned controller modules.
- Projection channels currently implemented are `author-mark`, `diagnostic`, `task`, `note`, `spellcheck`, `search`, and `narration-follow`.
- Targeted tests cover the extracted state modules, manuscript controllers, projection selector, and textarea host adapter; the full test harness passed `35` tests at the checkpoint.

Next refactor command:

- Continue Phase 2 by keeping `diagnostic` projections derived from stable issue anchors, then wire any future manuscript `suggestion` source only after the staged `AnchoredManuscriptSuggestion` DTO has a dedicated queue and accept/reject commands.

Still intentionally deferred:

- Canonical `ManuscriptMark` schema migration from compatibility `inlineFormatRanges`.
- Remaining non-host panel focus/scroll effects behind their appropriate feature or shell boundaries.
- CodeMirror adapter evaluation until projection and command contracts are complete.

### Next Slice Contract

The next Phase 2 change must use the following boundary:

- `diagnostic` projections derive from accepted, anchor-backed manuscript `IssueRecord` data already carried by `state.workspace.project.issues`; the projection is visual output only and must reference the durable issue ID.
- The existing `state.workspace.analysis.suggestionQueue` is currently for world-template/entity/link proposals and Dream Scaping proposals. It is not a manuscript-range suggestion source and must not be painted on manuscript text.
- A `suggestion` manuscript projection may be added only from `AnchoredManuscriptSuggestion` data, after a dedicated review queue and explicit accept/reject commands exist.
- The first implementation has added diagnostic projection selection, adapter rendering, and focused tests for anchor filtering, deterministic priority, suggestion-queue exclusion, and exclusion of projection objects from persistence.

Completion evidence for that slice:

- Issue console navigation continues to operate from the same durable issue records.
- Wrong-scene, invalid-range, or unresolved diagnostics do not render.
- World and Dream Scaping suggestion queues do not become manuscript highlights.
- `npm test` includes tests for the new diagnostic projection path.

## Architecture Principles

- Feature slices own their own UI, local state, and event handlers.
- Derived state should be computed in selectors, not duplicated in persistent state.
- Render functions should be as close to pure as possible.
- Event handlers should dispatch actions; they should not mutate cross-cutting global state directly.
- Browser-side adapter code can talk to storage and the desktop host, but repo-root service logic stays outside the editor bundle.
- No generic `utils` or `misc` bucket should be used as a dumping ground.
- Cross-feature imports should be minimized; shared helpers belong in `shared/` or a true platform adapter.

## Service Call Internalization

The refactor must not only move markup and selectors out of `app.js`. Service calls should move to the service level whenever they represent a repeatable workflow, a domain capability, retry/error policy, provider selection, persistence boundary, or cross-feature side effect. The shell may initiate a command and schedule renders, but it should not construct service-specific payloads, call desktop endpoints directly for feature workflows, or interpret service failure details.

### Internalize These Calls

| Current shell concern | Service-level owner | Internalized responsibility | Shell responsibility after extraction |
| --- | --- | --- | --- |
| Project save/load/autosave/import/export | `adapters/storage/project-persistence-service.js` | choose save/load route, clear stale cache, normalize loaded records, report persistence failures | invoke `ProjectPersistenceService` command, update active UI state, render |
| Project source loading | future `adapters/storage/project-source-service.js` or existing persistence service if kept project-file scoped | call `/api/project-source`, normalize source provenance, create reportable import errors | pass selected source path/options, render import result |
| Local AI title generation for scenes/tasks/notes | `features/local-ai/local-ai-title-service.js` plus feature-local request builders | call `/api/local-ai/generate-title`, apply title sanitization, normalize unavailable-provider failures, enforce max-token/default-temperature policy | request a title for a known record and commit the returned accepted title through feature state |
| Spellcheck lexicon refresh and project dictionary persistence | `features/spellcheck/*` plus a spellcheck service wrapper | load base/reference lexicons, derive misspellings, debounce refresh, mutate dictionary/exception lists, normalize failures | dispatch text/settings changes and render projections/panels |
| Anchored task/passage-note persistence after record mutations | `features/anchored-records/anchored-record-service.js` | update task/note collections, persist with workflow-specific dirty reasons, return changed records for UI follow-up | dispatch user intent and refresh selected panels/projections |
| Revision banking and revision package writes | `features/revisions/revision-service.js` plus revision storage adapter | construct revision events, bank sessions, normalize persisted revision state, write reloadable revision artifacts | start/choose revision commands and render revision windows |
| Writing target state updates | `features/writing-targets/writing-goals-service.js` and `writing-goals-state-service.js` | compute targets, archive snapshots, session timing, goal sync hints, persistence-ready records | dispatch user edits and render header/window |
| Narration take recording and project media writes | `features/narration/narration-media-service.js` now owns media save/load calls; `features/narration/narration-media-recorder-service.js` owns recorder construction/events; `features/narration/narration-recording-command-service.js` owns start/stop command sequencing; `features/narration/narration-recording-finalization-service.js` owns final media-save result mapping; `features/narration/narration-recording-runtime-service.js` owns recorder resource cleanup; `features/narration/narration-speech-recognition-service.js` owns speech tracker events; `features/narration/narration-take-service.js` owns runtime/take/session/final-record DTOs, recording blobs, finalization context, and media naming | save/load `/api/project-media/*`, convert blobs/base64, release recorder timers/speech/media streams, collect audio chunks, normalize recorder/speech tracker events, normalize transcript/status/session/record DTOs, derive recording IDs and media paths, create initial recording runtime/session state, create final saved/failed take records, coordinate start/stop capability checks and microphone/recorder/speech setup, map media save failures to failed take records and paused sessions | arm/stop/clear commands, commit returned take records, show selected take state, render projections |
| Voice recording preview and narration render jobs | `features/narration/narration-media-service.js`, `features/voice/voice-recording-preview-service.js`, and `features/voice/voice-workflow-service.js` | load media blobs, manage preview audio URLs, normalize voice profiles/jobs, and apply placeholder render-job transitions; later enforce live provider/profile contracts | choose profile/recording/job action and render voice surfaces |
| World template/entity AI suggestions | future `features/world/world-suggestion-service.js` backed by `services/analysis` outputs | keep suggestions reviewable, trace evidence anchors, apply accepted mutations only through world-schema commands | open review UI and render accepted world changes |

### Do Not Internalize Into Services

- DOM focus, pointer capture, element measurements, and `scrollIntoView` calls belong behind host adapters or shell/browser boundaries, not domain services.
- Feature markup belongs in feature view modules, not service modules.
- Pure canonical data models belong in `packages/*`, not editor services.
- Repo-root `services/analysis`, `services/audio`, and `services/voice` remain runtime/service-contract owners; editor services should call them through explicit adapters rather than reimplementing their engines.

### Extraction Rule

When a shell function does two or more of the following, create or extend a service-level owner before continuing the roadmap:

- builds a desktop API payload
- calls `fetchJsonFromDesktopApi`
- normalizes service success/error shapes
- performs retry, fallback, provider, or unavailable-state policy
- mutates multiple state buckets as one workflow
- logs under a service domain
- persists project data as part of a feature command
- creates or updates long-running job/session state

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
- Checkpoint complete: persistence service, round-trip guardrails, project-library normalization, seed/cache merge policy, active-record lookup, saved selection-default normalization, durable project-record construction, runtime-to-record save assembly, record-to-runtime state hydration, and shared activation effect orchestration are extracted.
- Transition note: browser DOM reads remain in the manuscript surface, but save-time scene-selection normalization now routes through the manuscript selection controller rather than persistence ownership.

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
- In progress: scene-editor extraction, inline-format command control, find derivation/replacement planning, live scene text-input routing, selection/context snapshot policy, anchor-aware task/note projection routing, anchored task/note context-menu rendering, the `author-mark`/`diagnostic`/`task`/`note`/`spellcheck`/`search`/`narration-follow` projection channels, the textarea compatibility host boundary, and host-owned manuscript focus/selection/viewport scrolling helpers are present; the manuscript `suggestion` source and residual non-host DOM focus/scroll effects remain.

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

Status:
- Active: `features/spellcheck/grammar-check-panel.js` owns grammar-check summary, grouped-entry modeling, panel state transitions, drag sessions, and panel markup. `features/spellcheck/spellcheck-project-settings.js` owns dictionary/exception word normalization and mutation planning. `features/spellcheck/spellcheck-context-menu.js` owns the spellcheck context-menu model and markup. `features/spellcheck/spellcheck-context-controller.js` owns selection, grammar-panel item, and editor word-range context-menu record derivation. `features/spellcheck/spellcheck-refresh-controller.js` owns debounce timer state for refresh scheduling. The shell still owns persistence effects, menu mounting/event dispatch, and host-specific projection refresh effects.

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

Status:
- Active: `features/anchored-records/task-context-menu.js` owns anchored task/passage-note context-menu and composer view modeling/markup. `features/anchored-records/anchored-record-controller.js` owns task composer planning, inline passage-note draft seeding, composer-backed task/note record creation, inline passage-note typing range policy, panel model grouping, and Local AI title request planning/guard checks. `features/anchored-records/passage-note-panel.js`, `features/anchored-records/task-panel.js`, and `features/anchored-records/delete-confirmation-dialog.js` own anchored-record panel, console item, chapter-group, empty-state, and delete-confirmation rendering. `features/manuscript-editor/anchored-record-navigation-controller.js` already owns anchor-aware task/note preview selection. Inline note manuscript insertion, persistence effects, async AI title calls, and event dispatch remain shell-owned.

### Phase 5: Reduce The Shell And Introduce The Store Facade

Goal:
- reduce `app.js` to bootstrap, composition, compatibility wiring, and global effect scheduling

Deliverables:
- a central editor bootstrap module
- a store or store-like facade for editor state
- explicit selectors for derived UI state
- a single place where render orchestration happens
- service-level command wrappers for feature workflows that currently call desktop APIs or persistence from `app.js`

Exit criteria:
- feature modules can read state without directly mutating unrelated global objects
- new feature-specific logic is no longer added to `app.js`
- `app.js` no longer builds desktop API payloads for feature workflows; it calls service commands and handles render scheduling
- `app.js` is reduced toward a composition/compatibility target of approximately 3,000 lines or fewer

Status:
- Started: `state/editor-ui-state.js` owns pure collapse-state normalization, binder chapter collapse toggling, console chapter collapse toggling, and removed-chapter pruning. `features/local-ai/local-ai-title-service.js` owns Local AI title endpoint calls and response policy. `adapters/storage/project-source-service.js` owns project-source endpoint loading plus project-library merge/save orchestration. `features/anchored-records/anchored-record-service.js` owns anchored task/note mutation persistence. `features/narration/narration-media-service.js` owns project-media save/load calls and base64/blob conversion. `features/narration/narration-media-recorder-service.js` owns MediaRecorder construction and event handling. `features/narration/narration-recording-command-service.js` owns start/stop command sequencing and browser capability gates through injected callbacks. `features/narration/narration-recording-finalization-service.js` owns stopped-runtime cleanup, media-save result mapping, final take record creation, and final paused session options. `features/narration/narration-recording-runtime-service.js` owns the shared cleanup boundary for recorder timers, speech recognition, and media streams used by stop/fail/project-activation paths. `features/narration/narration-speech-recognition-service.js` owns Web Speech API tracker setup and event interpretation. `features/narration/narration-take-service.js` owns narration runtime/take/session/final-record DTOs, elapsed labels, MIME fallback, recording IDs, media naming, finalization context, and recording blob construction. The shell still owns persistence writes and render scheduling after UI-state transitions and still commits accepted title/source-load/media results into runtime UI state.
- Next service-call candidates: full narration take recorder/session lifecycle, voice render-job commands, and remaining voice surface event orchestration.

### Phase 6: Extract Narration, Voice, and Worldbuilding Surfaces

Goal:
- isolate the larger domain surfaces that should evolve independently

Deliverables:
- narration follow feature
- voice routing and preview feature
- world spine feature
- world template and entity feature
- narration, voice, and world suggestion service wrappers that own runtime calls, job/session state, provider errors, and evidence-linked mutation commands

Exit criteria:
- these surfaces use shared workspace data and services, but do not rely on the manuscript shell for core behavior
- editor UI code calls narration/voice/world command services rather than direct desktop endpoints or ad hoc job mutations

Status:
- Started: `features/narration/narration-media-service.js` owns project-media save/load calls for narration recordings and voice preview loading. `features/narration/narration-metadata-sync-service.js` owns narration and voice metadata resync after manuscript structure changes. `features/narration/narration-media-recorder-service.js` owns MediaRecorder construction, chunk collection, recorder errors, and stop finalization dispatch. `features/narration/narration-recording-command-service.js` owns start/stop command sequencing, microphone request ordering, recorder attachment, speech tracker attachment, and stop fallback finalization dispatch. `features/narration/narration-recording-finalization-service.js` owns final media-save orchestration, stopped-runtime cleanup, saved/failed take record creation, and final paused session options. `features/narration/narration-recording-runtime-service.js` owns recorder cleanup for normal finalization, failed-start abort, and project activation teardown. `features/narration/narration-selection-service.js` owns armed narration verse selection derivation. `features/narration/narration-speech-recognition-service.js` owns speech tracker setup and transcript/error/end event interpretation. `features/narration/narration-take-service.js` owns runtime/take/session/final-record DTO construction, initial recording session state, recording blob construction, finalization context, media naming, and fallback policy. `features/voice/voice-workflow-service.js` owns editor voice profile/job normalization, placeholder render-job transitions, and voice narration preference snapshot load/save. `features/voice/voice-recording-preview-service.js` owns audio preview object-URL cleanup and playback lifecycle. `features/voice/voice-recording-service.js` owns saved recording collection mutation and active-project lookup. `features/voice/voice-recording-action-service.js` owns saved recording preview load/play policy and manuscript verse navigation plans. The shell still owns persistence/render scheduling and broader voice surface event/render orchestration.

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

## Parallel Product Track: MobileFriendlyArchitecture

The mobile-friendly version is planned as a voice-first companion surface for an author who needs to speak new prose into a phone, optionally while viewing manuscript context. Its full architecture, adaptive layout rules, native capability boundaries, feature parity limits, and delivery phases are specified in [MobileFriendlyArchitecture](./mobile-friendly-architecture.md).

This track does not require a second manuscript model or mobile-only business logic. It depends on the same anchor-aware manuscript commands, audio service boundaries, and project persistence contract being made stable by the editor refactor.

### Mobile Sequencing Constraints

- Do not implement mobile speech-to-writing as narration-follow state; dictated prose is a reviewable proposed manuscript edit, while narration follows existing text.
- Establish a host-neutral persistence/command boundary before a phone host writes accepted manuscript content.
- Route microphone, speech recognition, device storage, lifecycle, safe-area, and transfer APIs through mobile adapters.
- Preserve Local AI Only behavior by making the locality of speech-to-text providers visible and enforceable.
- Design compact layouts from viewport constraints, touch input, keyboard visibility, and orientation rather than shrinking the full desktop workspace.

### Mobile Roadmap Summary

| Mobile Phase | Outcome |
| --- | --- |
| `0 - Contracts And Separation` | Define dictation sessions, transcript candidates, anchor-backed insertion targets, revision provenance, and provider locality rules. |
| `1 - Responsive Read And Navigate Surface` | Deliver phone-sized manuscript reading, scene navigation, insertion targeting, and touch/accessibility layout behavior. |
| `2 - Offline Dictation Capture And Transcript Review` | Capture speech durably, transcribe through an explicit provider, review text, and commit accepted anchored prose. |
| `3 - Project Transfer And Conflict Review` | Move work between phone and desktop without silent overwrites or unresolved anchor loss. |
| `4 - Adapted Feature Parity` | Add compact issues/tasks/events/targets and feasible narration, voice, analysis, and world workflows. |
| `5 - Native Host Evaluation` | Select installable web or native packaging from recording, offline, resume, and transfer evidence. |

### Mobile Exit Criteria

- A phone user can read a scene, dictate additional prose, review it, and accept it at an anchored insertion target.
- Interrupted and offline capture state is recoverable through persistence adapters.
- Concurrent phone/desktop changes are surfaced as reviewable conflicts rather than silently merged.
- Dense desktop-first views are intentionally adapted or deferred, while all mobile data remains compatible with canonical project records.

## Suggested File Map

This is the first-pass directory plan for the browser app.

```text
apps/editor/public/
  app.js
  bootstrap/
  shell/
  state/
    project-activation-controller.js
    project-activation-state.js
    project-library-state.js
    project-record-state.js
    project-runtime-record-state.js
  features/
    manuscript-editor/
      manuscript-controller.js
      manuscript-input-controller.js
      manuscript-selection-controller.js
      anchored-record-navigation-controller.js
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
| project-library normalization, seed merge, and active-record lookup inside `app.js` | `state/project-library-state.js` | completed first state slice; it keeps cache/seed resolution and durable selection defaults outside shell effects |
| project record construction/normalization inside `app.js` | `state/project-record-state.js` | completed state slice; it builds persistent records without taking ownership of live editor effects |
| runtime-to-project save record assembly inside `app.js` | `state/project-runtime-record-state.js` | completed state slice; it projects live state plus explicitly captured selection defaults into the durable record builder |
| project-record hydration assignments inside `app.js` | `state/project-activation-state.js` | completed state slice; it replaces live durable state on activation while the shell retains cross-service effects |
| project activation teardown and refresh effects inside `app.js` | `state/project-activation-controller.js` | completed state slice; it coordinates activation callbacks while the shell provides browser and feature dependencies |
| `apps/editor/public/spellcheck.js` | `features/spellcheck/spellcheck-core.js` | pure grammar logic should stay DOM-free and testable |
| `apps/editor/public/features/scene-editor.js` | `features/manuscript-editor/manuscript-view.js` | scene editor rendering already has a clear slice boundary |
| `apps/editor/public/features/progress-tracker.js` | `features/writing-targets/progress-tracker-view.js` | writing-target UI should be isolated from manuscript shell code |
| `apps/editor/public/session-tracker-icons.js` | `features/writing-targets/session-tracker-icons.js` | feature-local asset helper |
| `apps/editor/public/serva-vitae-project-library.js` | `adapters/storage/project-library.js` | project library persistence belongs with storage and load/save code |
| save/load and autosave helpers inside `app.js` | `adapters/storage/project-file.js` and `adapters/storage/autosave.js` | persistence should be moved out of the shell |
| grammar check panel helpers inside `app.js` | `features/spellcheck/grammar-check-panel.js` | active Phase 3 extraction; view modeling, state transitions, drag sessions, and markup are feature-owned while shell persistence effects remain |
| dictionary/exception mutation rules inside `app.js` | `features/spellcheck/spellcheck-project-settings.js` | active Phase 3 extraction; project word normalization, duplicate handling, and target-list mutation planning are feature-owned while shell persistence and refresh effects remain |
| spellcheck context-menu markup and context derivation inside `app.js` | `features/spellcheck/spellcheck-context-menu.js`, `features/spellcheck/spellcheck-context-controller.js` | active Phase 3 extraction; menu positioning, word/suggestion view modeling, markup, and context records are feature-owned while shell menu mounting and edit/persistence effects remain |
| spellcheck refresh debounce state inside `app.js` | `features/spellcheck/spellcheck-refresh-controller.js` | active Phase 3 extraction; timer scheduling and clear semantics are feature-owned while shell host projection refresh effects remain |
| task/note anchor matching and preview-projection planning inside `app.js` | `features/manuscript-editor/anchored-record-navigation-controller.js` | completed Phase 2 projection/navigation slice; durable anchor repairs are explicit callbacks and hover-only previews remain non-mutating |
| inline range and visual overlay selection inside `app.js` | `features/manuscript-editor/projection-selector.js` | completed Phase 2 selector slice; durable-derived and runtime-only visual channels use one deterministic render contract |
| textarea overlay markup, mirrored layer rendering, and command DOM access inside the scene/shell path | `features/manuscript-editor/editor-host-interface.js`, `adapters/editor-host/textarea-editor-host.js` | completed Phase 2 host slice; the active textarea implementation now consumes projections behind a replaceable adapter |
| manuscript editor focus, selection range, bookmark, viewport, and offset centering effects inside shell flows | `adapters/editor-host/textarea-editor-host.js` | active Phase 2 host slice; shell callers now use host capabilities while feature controllers keep owning selection policy and record navigation |
| active task, inspiration, and research preview classes/range painting inside `app.js` | `features/manuscript-editor/projection-selector.js`, `adapters/editor-host/textarea-editor-host.js` | completed Phase 2 anchored-preview slice; durable anchored records now derive disposable host previews with typed record references |
| find-result and narration-verse selection styling inside shell flows | `features/manuscript-editor/projection-selector.js`, `adapters/editor-host/textarea-editor-host.js` | completed Phase 2 runtime-preview slice; transient search and narration visuals are explicit runtime-only projections |
| manuscript match derivation, find-panel modeling, and replacement planning inside `app.js` | `features/manuscript-editor/manuscript-find-controller.js` | completed Phase 2 controller slice; durable edit effects and DOM focus remain explicit shell callbacks |
| manuscript selection text, context-range, bookmark, and saved-selection normalization inside `app.js` | `features/manuscript-editor/manuscript-selection-controller.js` | completed Phase 2 policy slice; browser focus/scroll operations and scene mutation effects remain shell-owned |
| live `editor-text` mutation sequencing and inline-format text-edit range derivation inside `app.js` | `features/manuscript-editor/manuscript-input-controller.js` | completed Phase 2 controller slice; revision/persistence/render effects are explicit shell callbacks while browser interaction remains compatible |
| anchored task/note context-menu and composer markup inside `app.js` | `features/anchored-records/task-context-menu.js` | active Phase 4 extraction; view models and markup are feature-owned while shell event dispatch and persistence effects remain |
| anchored task/note composer planning and typed inline-note range policy inside `app.js` | `features/anchored-records/anchored-record-controller.js` | active Phase 4 extraction; record/draft planning, panel grouping models, and AI title request DTO planning are feature-owned while shell still owns DOM fields, manuscript mutation effects, persistence, and async title calls |
| anchored task/note console item and delete confirmation markup inside `app.js` | `features/anchored-records/task-panel.js`, `features/anchored-records/passage-note-panel.js`, `features/anchored-records/delete-confirmation-dialog.js` | active Phase 4 extraction; repeated item/dialog/chapter-group/empty-state markup is feature-owned while shell delete effects remain |
| collapsed binder and console chapter state mutation inside `app.js` | `state/editor-ui-state.js` | started Phase 5 store-facade extraction; pure UI-state transitions are state-owned while shell persistence and render effects remain explicit |
| desktop API calls for Local AI title generation inside `app.js` | `features/local-ai/local-ai-title-service.js` | completed Phase 5 service-call extraction; title endpoint payloads, default generation policy, sanitization, and unavailable-provider errors are service-owned while shell commits accepted titles |
| desktop API calls for project-source import inside `app.js` | `adapters/storage/project-source-service.js` | completed Phase 5 service-call extraction; source loading/provenance/error normalization and project-library merge/save orchestration are service-owned while shell coordinates activation/rendering |
| anchored-record task/note mutation persistence inside `app.js` | `features/anchored-records/anchored-record-service.js` | completed Phase 5 service-call extraction; task/note collection mutation, dirty reasons, and persistence callbacks are feature-service owned while shell keeps DOM reads/rendering |
| narration project-media save/load calls inside `app.js` | `features/narration/narration-media-service.js` | completed Phase 6 service-call extraction; `/api/project-media/save` and `/api/project-media/load` calls plus blob/base64 conversion are service-owned while shell keeps recorder and preview UI lifecycle |
| narration/voice metadata resync after scene changes inside `app.js` | `features/narration/narration-metadata-sync-service.js` | completed Phase 6 partial extraction; narration sessions, alignment jobs, saved voice recordings, and voice render jobs are re-anchored through feature-service helpers |
| MediaRecorder construction/event handling inside `app.js` | `features/narration/narration-media-recorder-service.js` | completed Phase 6 partial extraction; recorder construction, chunk collection, recorder error status, and stop finalization dispatch are feature-service owned |
| narration recording start/stop command sequencing inside `app.js` | `features/narration/narration-recording-command-service.js` | completed Phase 6 partial extraction; active-runtime guard, selection/capability gate handling, microphone request order, recorder/speech attachment, recorder start, stop eligibility, and stop fallback finalization are feature-service owned through injected shell/browser callbacks |
| narration recording finalization and media-save result mapping inside `app.js` | `features/narration/narration-recording-finalization-service.js` | completed Phase 6 partial extraction; stopped-runtime cleanup, recording blob save, saved/failed record mapping, final paused session options, and recording failure logs are feature-service owned |
| narration recording runtime cleanup inside `app.js` and project activation | `features/narration/narration-recording-runtime-service.js` | completed Phase 6 partial extraction; recorder timer, speech-recognition, and media-stream cleanup are service-owned for finalization, abort, and project-switch teardown |
| armed narration verse selection derivation inside `app.js` | `features/narration/narration-selection-service.js` | completed Phase 6 partial extraction; scene/block/offset selection records, default scene selection, and textarea context selection derivation are feature-service owned while shell keeps DOM reads and render effects |
| Web Speech API tracker event handling inside `app.js` | `features/narration/narration-speech-recognition-service.js` | completed Phase 6 partial extraction; speech-recognition setup, transcript extraction, error status, paused status, and active-runtime guards are feature-service owned |
| narration runtime/take/session/finalization DTO and media naming helpers inside `app.js` | `features/narration/narration-take-service.js` | completed Phase 6 partial extraction; initial recorder runtime/session state, transcript/status normalization, elapsed labels, MIME fallback, recording IDs, media names/paths, recording blob construction, finalization context, session snapshots, and final saved/failed take records are feature-service owned |
| narration/voice recording collection mutation inside `app.js` | `features/voice/voice-recording-service.js` | completed Phase 6 partial extraction; saved recording collection initialization, active-project filtering, lookup, and upsert mutation are feature-service owned while shell schedules project persistence |
| saved recording preview/open actions inside `app.js` | `features/voice/voice-recording-action-service.js` | completed Phase 6 partial extraction; saved recording media load/play policy, preview error logging, and manuscript verse navigation planning are feature-service owned while shell applies selected scene/block and renders |
| narration recording project persistence side effects inside `app.js` | future persistence command wrapper plus `ProjectPersistenceService` | planned Phase 6/Phase 5 follow-up; final take persistence scheduling should be narrowed while project file writes remain behind `ProjectPersistenceService` |
| voice recording preview lifecycle inside `app.js` | `features/voice/voice-recording-preview-service.js` | completed Phase 6 extraction; audio object construction, object URL cleanup, and preview teardown are service-owned |
| voice profile/job normalization and placeholder render-job mutation inside `app.js` | `features/voice/voice-workflow-service.js` | completed Phase 6 extraction; profile/job normalization, placeholder job transitions, and preference snapshot load/save are service-owned |
| live voice provider/render command orchestration inside `app.js` | `features/voice/voice-workflow-service.js` plus voice service contracts | planned Phase 6 extraction; provider/profile validation and real render-job transitions should be service-owned when live voice generation is wired |
| world/template/entity AI proposal queues inside `app.js` | `features/world/world-suggestion-service.js` plus analysis/world schema contracts | planned Phase 6 extraction; reviewable suggestion intake, evidence anchors, and accepted mutation commands should be service-owned |

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
