# Features

Single merged feature reference and process tracker for [An AI augmented author writing environment. .docx](<./An AI augmented author writing environment. .docx>).

This file merges the Word-document feature definitions with the implementation process headers and progress notes. Use this as the active reference when working through numbered features.

## Feature ID Rule

Feature IDs use a parent number plus a testable workflow number, then a lowercase letter for individual checks, for example `Feature 1.3c`. The parent number keeps the workflow tied to the original product feature area, the middle number identifies a specific feature workflow, and the letter identifies a precise interaction that can be tested, debugged, ported, or reported independently.

When a workflow grows large enough to need separate testing, add a new numbered feature set with indented lettered checks instead of folding it into a broad progress paragraph. Keep the same ID in:
- the parent feature's `Testable Subfeatures` list
- the `Feature Implementation Index`
- bug reports, porting notes, and manual test checklists

## Feature Confirmation Rule

When the user says `Feature working`, that phrase confirms the current feature or workflow is accepted and must be documented immediately. Update the relevant numbered feature section and the implementation index in this file before moving on to unrelated work.

The update must:
- describe the feature in product terms, not only as a code change
- place it under the closest numbered feature area
- assign or update the most specific feature/check ID, for example `Feature 1.6b`
- add or revise the `Feature Implementation Index` entry with code locations and line numbers
- include the execution flow from user action to state update, persistence, rendering, logging, or tests where relevant
- note any classification decision if the feature spans more than one feature area

## Feature 01 - Manuscript Issue Console

### Feature Definition

Gives the writer a structured, code-like review panel that logs detected issues in a clear event window and links each one directly to the relevant line or section of the manuscript. With optional AI augmentation, the system can analyse passages, explain what may need attention, and visually guide the user to exactly where changes should be made. The suite can also be used in an IDE-like mode, where manuscript lines are indexed and addressable, allowing the author to jump directly to flagged passages, navigate issues more easily, and work through revisions with software-development-style precision.

### Process Header

The writer reviews manuscript problems as structured diagnostics, with each issue linked to a stable manuscript anchor rather than vague prose feedback.

### Testable Subfeatures

1.1 Anchored manuscript diagnostics console

   The writer sees manuscript problems as structured issue records rather than loose comments. The code keeps each issue tied to a canonical manuscript anchor so clicking an issue can resolve back to a scene, block, line, or span even after the editor rerenders.
   1.1a Issue records include severity, category, source, confidence, and anchor data.
   1.1b Issue panel rows render as actionable diagnostics.
   1.1c Clicking an issue navigates back to the flagged manuscript location.
   1.1d Accepted issue records render as disposable manuscript diagnostics only when their anchors still resolve in the active scene.

1.2 Context-aware scene insertion

   When the author is actively editing scene `x`, pressing New Scene inserts the new draft scene immediately after that scene instead of appending it to the end of the binder. The code captures the active editor scene from pointer, focus, and typing events, then writes the resulting order into `structureDrafts.sceneOrder` so autosave and refresh preserve the placement.
   1.2a Pointer/focus/input events mark the scene currently being edited.
   1.2b New Scene resolves the active scene as the insertion anchor.
   1.2c The new scene is inserted at `x + 1` in the same chapter and selected immediately.

1.3 Manuscript spellcheck and project dictionary

   The manuscript editor underlines local spelling issues while the author writes and lets them resolve a word from an app-owned context menu or grammar-check panel. The code builds a project-aware lexicon from the base word lists, manuscript terms, project dictionary entries, and exception lists so invented names and world terms can become trusted project vocabulary.
   1.3a Right-clicking a misspelled word opens a suggestions dropdown.
   1.3b Selecting a suggestion replaces the exact flagged word range in the scene draft.
   1.3c Add-to-dictionary and exception actions update project-scoped spellcheck settings.
   1.3d The grammar-check list supports batch approval of selected words.
   1.3e When a word is flagged, there is a red underline squiggle showing the user.
   1.3f The user can turn on and off the spell check feature with the grammar checkbox built into the UI.

1.4 Manuscript find and replace

   Ctrl+F opens a manuscript find panel that searches structured scene text without treating the editor as a flat browser document. The code preserves caret and scroll state while navigating matches, then applies replacements through scene-draft mutation paths so word counts, dirty state, and persistence stay consistent.
   1.4a Opening the find panel can preload selected text.
   1.4b Next/previous navigation selects and centers the matching scene range.
   1.4c Replace Current changes only the active match.
   1.4d Replace All mutates all matching scene drafts through the editor model path.

1.5 Anchored task, inspiration, and research notes

   The author can select manuscript text and turn it into a task, inspiration note, or research note that remains linked to the passage. The code stores scene IDs, offsets, selected text, source type, and note/task metadata, then uses exact and fuzzy matching to recover the range if nearby text changes.
   1.5a Selected text can create a scene-linked task.
   1.5b Selected text can create an inline inspiration or research note.
   1.5c Side-panel note/task clicks navigate back to the saved manuscript range.
   1.5d Fuzzy drift recovery attempts to relocate a note when text has shifted.

1.6 Binder scene and chapter management

   The binder lets the author manage chapters and scenes as story structure, including creation, title editing, ordering, collapse state, trimming, and deletion. The code mutates draft structure overlays and cleans scene-linked metadata so tasks, notes, narration, voice jobs, and selected state do not point at deleted or moved scene records.
   1.6a Chapter and scene titles can be edited from binder/editor surfaces.
   1.6b Scene drag/drop writes an explicit `sceneOrder` overlay.
   1.6c Scene deletion cleans linked task, note, narration, voice, and selection metadata.
   1.6d Scene trimming normalizes whitespace while preserving the draft scene identity.

1.7 Scene editor focus, viewport, and line-aware navigation

   The scene editor remembers where the author is working so navigation, refreshes, and diagnostics land in useful manuscript positions instead of resetting the writing surface. The code captures selection offsets, viewport scroll, line metrics, and layout measurements, then restores them after rerenders or targeted navigation.
   1.7a Selection changes capture scene, offsets, line number, and viewport state.
   1.7b Issue/task/note navigation restores the intended caret and scroll location.
   1.7c Gutter, textarea, underline layer, and line metrics are synchronized.
   1.7d Clicking editor whitespace moves focus into the nearest useful writing position.

1.8 Writing targets, daily progress, and session tracker

   The writing target system turns manuscript edits into live progress, pacing, session, and calendar history rather than a simple static word count. The code separates total manuscript words from words written today, records session samples and baselines, and persists dashboard state with the project record.
   1.8a Header metrics show selectable writing target, projected-days, and pacing data.
   1.8b The session tracker records active, idle, split, and resumed writing sessions.
   1.8c The writing-goals dashboard shows calendar, streak, selected-day, and note views.
   1.8d Per-day history archives chapter, scene, issue, inspiration, and progress data.

1.9 Revision session banking

   Revision banking records a structured revision session around manuscript changes so future undo, review, and export workflows can inspect what changed. The code normalizes stored revision state, builds project digests, records events, stages diffs, and renders grouped banked sessions through a dedicated revision history model and a standalone revisions window mockup.
   1.9a Starting a session captures a baseline project digest.
   1.9b Revision events aggregate into a session ledger.
   1.9c Staging a session produces changed-entity and summary data.
   1.9d Banked sessions persist through the revision storage adapter.
   1.9e The revisions window opens beside the writing-goals control and presents a developer-style before/after compare surface.

1.10 Manuscript inline formatting commands

   The scene editor routes bold, italic, underline, strikethrough, and highlight through a shared command controller so toolbar actions affect only the selected manuscript span or the active insertion point. Inline style state is stored as scene-draft range metadata and rendered through the editor overlay, keeping literal markup out of the manuscript body.
   1.10a Selecting text and pressing a format control toggles only that selected span in structured range metadata.
   1.10b Pressing a format control at a collapsed caret creates a pending insertion point for newly typed formatted text.
   1.10c Bold, italic, underline, strikethrough, and highlight share the same command controller, selection resolver, range mutation path, toolbar state update, render layer, and tests.
   1.10d Highlight toolbar clicks recover the active manuscript selection captured before focus leaves the editor, so selected passages can be converted into user highlights from the toolbar.
   1.10e Pressing Highlight at a collapsed caret acts as a switch for incoming manuscript text, using the post-input caret to anchor typed highlight ranges before they are promoted into canonical marks.
   1.10f Pressing Bold uses the same author-mark behavior as Highlight: selected manuscript text becomes a canonical bold mark, collapsed Bold toggles pending bold typing, and typed insertions split or extend existing bold marks based on the switch state.
   1.10g Text-style author marks render visibly in the textarea overlay while unmarked overlay text stays transparent, so Bold can be seen without breaking highlight backgrounds.
   1.10h Newly created draft scenes reconcile visible editor text into addressable draft blocks before Bold or Highlight marks are applied.
   1.10i Applying a selected Highlight preserves earlier same-scene highlights that were originally created through pending/compatibility ranges.
   1.10j Planned host migration replaces visible text-format overlays with ProseMirror marks on the actual editable manuscript text while keeping canonical marks and anchors application-owned.

1.11 Anchor-aware decoration drift pipeline

   The manuscript editor keeps issue, task, note, revision, event, narration, and future decoration anchors attached to the intended text while the author edits. The code treats live edit transactions as the primary way to shift or dirty anchors, uses hashes to validate saved anchors on project load, and uses bounded context/preview evidence to recover stale offsets without storing large manuscript excerpts in the project file.
   1.11a Scene edits produce explicit edit transactions before decorations are rerendered.
   1.11b Anchors before, after, inside, overlapping, or deleted by an edit receive deterministic offset/status updates.
   1.11c Load-time validation uses hash and bounded context recovery instead of relying on full selected-text excerpts.
   1.11d Render-only projections are regenerated from validated anchors and are never persisted as decoration objects.
   1.11e Revision-pass decoration tests use the shared anchor pipeline rather than a feature-specific highlight store.
   1.11f Canonical manuscript marks are schema-owned, anchor-backed, and compatible with the shared anchor index/drift path before editor writes migrate.
   1.11g User highlights write canonical manuscript marks, render through author-mark projections, and support pending highlight typing from a collapsed caret without adding a separate right-console panel.

1.12 Draft proof-read coverage runs

   The manuscript editor lets the author activate a proof-read run that records the manuscript spans they have actively read through during that pass. Coverage expands from viewport movement, selection/caret activity, and edits made while the run is active, so edits are treated as part of the current proof-read iteration rather than as weaker warnings or notes. The visible proof-read mark is a soft transparent underlay beneath author highlights.
   1.12a The top proof-read panel starts, pauses/resumes, and finishes a durable proof-read run.
   1.12b Active viewport, selection, caret-line, and edit activity expand the current run's scene coverage.
   1.12c Scene text edits shift existing proof-read spans and add the edited range to the active run.
   1.12d Proof-read coverage renders through a low-priority `draft-proof` projection channel beneath author highlights, persists with the project record, and keeps the latest completed pass visible for recall when no run is active.
   1.12e Scene deletion prunes proof-read coverage for removed scene IDs.

### Progress

- Status: Foundation implemented.
- Repository coverage: `IssueRecord`, `ManuscriptAnchor`, local analysis issue suggestions, issue console records, editor navigation to flagged scene lines, simplified issue-console headings, collapsible chapter groups in the issue, inspiration, research, and task consoles, chapter-grouped open task lists, collapsible manuscript chapter tabs, double-click editable binder chapter titles, double-click editable binder scene titles, double-click editable manuscript scene titles, scene-editor chapter breadcrumb sync, resizable left and right sidebar splitters, browser keyboard shortcuts for save/new/open/writing-goals/pane switching, right-click selected-text task creation with generated scene-order task titles, blue task-body instructions, thumbnail-hover task expansion, click-only manuscript references, draft-only inline editor inspiration/research bubbles with a normal manuscript verse field that preloads selected text or saves against the inserted typed verse, two-way inspiration/research navigation between saved manuscript ranges and side-panel note items, hover previews that glow the selected manuscript range, task-click navigation back to the editor range with fuzzy selected-text drift recovery, whitespace-click writing focus, caret-centering while typing, pane-local editor scrolling, scene task completion, app-owned Grammar Check underlines with an app-owned suggestions popup in the manuscript editor, now backed by a SCOWL-derived default wordlist plus the prior supplemental alpha list and contraction-aware matching, plus project-scoped dictionary and exception lists stored on each project save file, bulk-add actions from multi-word selections, and a movable grammar-check list panel with per-word checkboxes for batch project-dictionary approval, Ctrl+F manuscript find/replace that preserves the editor caret and scroll position when the panel opens, remaining-task chapter badges in the Manuscript panel, live manuscript word counts with release-date-aware projected-days forecasting and on-track/off-track hints, a Ctrl+Alt+T writing-target utility window, selectable top-header writing metrics, linked release-date and daily-target goal syncing, a session-split and inactivity timer panel with a 20-minute session time default, a 15-minute segment-close window, a 30-minute new-session window, resumable session history, and an idle session indicator that flips back to active on the first new manuscript edit, plus recent-snapshot words/minute pacing, red-to-blue-to-green progress signaling, and pulsing over-target glow, plus a full writing-goals dashboard modal with top summary cards, a month/week/list calendar, streak summary, selected-day detail panel, notes, and explicit save/cancel/reset actions, with the daily target tracker now counting words written today separately from the session tracker, a per-day progress archive with chapter/scene/issue/inspiration breakdown, a 30-day believable sample-history seeding action for tracker testing, a project save-file load command that emits manuscript, world, task, timeline, and template data with source provenance, nested source template sheets, full source-path provenance, retained source sheet text, file-backed desktop/browser logging, a saved-project library with browser load/save/create controls and file-backed Save As/load routes, and a documented project save model for the Serva Vitae reference fixture. The revision drafting UI is currently benched from the scene editor while a new revision-history service, diff/event/model modules, revision storage adapter, and standalone revisions window mockup preserve the bookkeeping and review path for future undo/redo and banking workflows. The right-hand console now stays focused on Tasks, Inspiration, and Research; revision review has moved out of that dock. Modal dismissal is deliberate: a single outside click closes the writing-target window, but a pointer that starts inside the modal and is released outside should leave the window open; the revisions window now follows the same deliberate close behavior.
- Process update (2026-05-21): confirmed context-aware scene insertion. When the author is editing scene `x`, the New Scene action creates the next draft scene at `x + 1` in the same chapter and persists that placement through the scene-order overlay instead of appending to the end of the binder.
- Revisions window testing now includes a repeatable fixture seeder and on-disk revision package writer for `revision.json`, `events.json`, `project.diff.json`, and `summary.md` outputs derived from `SaveTestFile/RevisionsTest/RevisionsTestOriginFileproject-serva-vitae.abe-project.json`, and that source fixture now carries seeded `REVISIONSTEST` manuscript text plus banked revision sessions for window inspection.
- Process update (2026-05-21): revision review now lives in a standalone window mockup opened from the top chrome beside Writing Goals, and the right-hand console no longer has a Revisions tab. The UI presents session filters, a changed-file rail, changed entities, and side-by-side before/after digest operations so the author can review banked revisions with developer diff ergonomics before final design implementation.
- Process update (2026-05-22): manuscript inline formatting now stores bold, italic, underline, strikethrough, and highlight as scene-draft range metadata rendered by the editor overlay, replacing literal inserted HTML tags and the older scene-wide italic preference path.
- Process update (2026-05-23): established the manuscript mark/decoration projection boundary in `docs/architecture/manuscript-decoration-layer.md`. Author-applied inline formatting remains a scene-record compatibility field during the browser slice, now survives project JSON save/load and refresh through scene normalization, and must later be promoted to canonical anchor-backed manuscript marks rather than combined with spellcheck, AI-suggestion, hover, or narration visuals.
- Process update (2026-05-28): completed the current refactor checkpoint without changing the author-facing workflow contract. Manuscript find/replace derivation, input sequencing, selection policy, anchored task/note preview planning, projection selection, and textarea host rendering now have explicit feature/adapter owners; project-library normalization, project-record assembly, and activation orchestration now have explicit state owners. The visible workflows remain Features `1.3`, `1.4`, `1.5`, `1.7`, `1.10`, and `8.2-8.5`, with runtime projections kept outside durable project data.
- Process update (2026-05-28): completed the anchored diagnostic projection slice for Feature `1.1d`. The scene editor now derives `diagnostic` projections from open, anchor-backed issue records, the textarea host paints those diagnostics as disposable overlays, invalid or stale anchors do not render, and world/Dream Scaping suggestion queues remain excluded from manuscript highlights. `packages/shared-types` now stages an `AnchoredManuscriptSuggestion` DTO for later manuscript-range AI proposals without adding a `suggestion` projection channel.
- Process update (2026-05-28): continued Phase 2 by moving manuscript editor focus, range selection, bookmark, viewport, and offset-centering effects behind the textarea editor-host adapter for Feature `1.7`. Shell workflows still decide when navigation happens, but the textarea-specific DOM operations now sit behind host capabilities that a future editor adapter can replace.
- Process update (2026-06-14): selected ProseMirror as the target primary manuscript host and added `docs/architecture/prosemirror-editor-roadmap.md`. A full feature-set review now gates the migration by deterministic canonical scene/mark round trips, application-owned split/merge/paste identity rules, repository-owned transaction DTOs with provenance, scene and project lifecycle flushing, anchor-service synchronization, projection persistence exclusion, numeric performance budgets, feature-specific parity evidence, and a retained textarea fallback. ProseMirror owns only runtime document, DOM, selection, history, transactions, and decorations for one open scene; project structure, anchors, marks, records, revisions, metrics, and persistence remain application-owned.
- Process update (2026-05-28): continued Phase 3 for Feature `1.3` by moving grammar-check panel summary modeling, grouped misspelling entries, panel state transitions, drag sessions, and panel markup into `features/spellcheck/grammar-check-panel.js`. Project dictionary and exception word normalization plus target-list mutation planning live in `features/spellcheck/spellcheck-project-settings.js`; spellcheck context-menu view modeling/markup lives in `features/spellcheck/spellcheck-context-menu.js`; selection, grammar-panel item, and editor word-range context-menu record derivation live in `features/spellcheck/spellcheck-context-controller.js`; and debounce timer state for refresh scheduling lives in `features/spellcheck/spellcheck-refresh-controller.js`. The shell still owns persistence effects, menu mounting/event dispatch, and host-specific projection refresh effects.
- Process update (2026-05-28): continued Phase 4 for Feature `1.5` by moving anchored task/passage-note context-menu and composer view modeling/markup into `features/anchored-records/task-context-menu.js`; task composer planning, inline passage-note draft seeding, composer-backed task/note record creation, inline passage-note typed-range policy, panel model grouping, and Local AI title request DTO/guard planning into `features/anchored-records/anchored-record-controller.js`; task and passage-note panel/chapter-group/item markup into `features/anchored-records/task-panel.js` and `features/anchored-records/passage-note-panel.js`; and delete-confirmation rendering/preferences normalization into `features/anchored-records/delete-confirmation-dialog.js`. The shell still owns context-menu event dispatch, inline manuscript insertion effects, persistence effects, and async AI title calls.
- Process update (2026-05-28): started Phase 5 store-facade work by moving collapsed binder/console chapter normalization, toggle transitions, and removed-chapter pruning into `state/editor-ui-state.js`. `app.js` still owns the persistence writes and render scheduling around those transitions.
- Process update (2026-05-31): continued Phase 5 service-call internalization by moving Local AI title endpoint payload construction, default generation policy, title sanitization, and unavailable-provider mapping into `features/local-ai/local-ai-title-service.js`; project-source desktop loading, imported library normalization, merge, active-project selection, and save orchestration now live in `adapters/storage/project-source-service.js`. `app.js` still decides when to request these workflows and how to render/activate accepted results.
- Process update (2026-05-31): continued service-call internalization by moving anchored task/note collection mutations, workflow dirty reasons, and persistence callback calls into `features/anchored-records/anchored-record-service.js`; narration/voice recording media save/load endpoint calls and blob/base64 conversion now live in `features/narration/narration-media-service.js`. `app.js` still owns DOM reads, recorder lifecycle, audio preview URL lifecycle, and render scheduling.
- Process update (2026-05-31): continued Phase 6 voice extraction by moving editor voice profile/job normalization, placeholder render-job transitions, and voice narration preference snapshot load/save into `features/voice/voice-workflow-service.js`; saved voice recording preview audio/object-URL lifecycle now lives in `features/voice/voice-recording-preview-service.js`. The shell still owns voice surface event routing and full narration recorder/speech-recognition lifecycle.
- Process update (2026-05-31): continued Phase 6 narration extraction by moving recorder runtime cleanup into `features/narration/narration-recording-runtime-service.js`. Normal recording finalization, failed-start aborts, and project activation teardown now share the same service-owned release path for recorder timers, speech recognition, and microphone streams while `app.js` still owns start policy, transcript event handling, and final take-record assembly.
- Process update (2026-05-31): continued Phase 6 narration extraction by moving narration take DTO construction, transcript/status normalization, elapsed labels, MIME fallback, recording IDs, media filenames/paths, and final saved/failed recording records into `features/narration/narration-take-service.js`. The shell now calls feature-owned helpers while it continues to coordinate browser recording start/stop and persistence/render side effects.
- Process update (2026-05-31): continued Phase 6 narration extraction by moving MediaRecorder construction/event handling into `features/narration/narration-media-recorder-service.js` and Web Speech API tracker setup/event interpretation into `features/narration/narration-speech-recognition-service.js`. The shell still sequences microphone permission, recording start/stop, final persistence, and renders, but recorder chunks/errors/stops and speech transcripts/errors/paused state now pass through feature-owned services.
- Process update (2026-05-31): continued Phase 6 narration extraction by moving final recording blob construction, finalization context derivation, and saved/failed take record assembly into `features/narration/narration-take-service.js`. `app.js` now performs the project-media save and persistence/render side effects while final take metadata remains service-owned.
- Process update (2026-05-31): continued Phase 6 narration extraction by moving initial narration recording runtime construction and initial "requesting microphone" session options into `features/narration/narration-take-service.js`. `app.js` still starts browser timers and requests microphone access, but it no longer hand-builds the runtime/session DTO.
- Process update (2026-05-31): continued Phase 6 narration extraction by moving recording start/stop command sequencing into `features/narration/narration-recording-command-service.js`. The service now owns active-runtime guards, no-selection and missing-capability paused sessions, microphone request order, recorder and speech tracker attachment, recorder start, stop eligibility, and stop fallback finalization through injected shell/browser callbacks.
- Process update (2026-05-31): continued Phase 6 narration extraction by moving stopped-runtime cleanup, final media-save result mapping, saved/failed take record creation, final paused session options, and recording failure logs into `features/narration/narration-recording-finalization-service.js`. `app.js` now commits the returned record to project state and schedules persistence.
- Process update (2026-05-31): continued Phase 6 voice/narration extraction by moving saved recording collection initialization, active-project filtering, lookup, and upsert mutation into `features/voice/voice-recording-service.js`. Preview/open actions and final take commits now call the feature service rather than manipulating `workspace.voice.recordings` directly in `app.js`.
- Process update (2026-05-31): continued Phase 6 voice/narration extraction by moving saved recording preview orchestration and manuscript verse navigation planning into `features/voice/voice-recording-action-service.js`. `app.js` now applies the returned scene/block selection and render only after the feature service resolves the recording anchor.
- Process update (2026-05-31): continued Phase 6 narration extraction by moving armed verse selection derivation into `features/narration/narration-selection-service.js`. Scene/block/default selection and textarea context selection now produce feature-owned selection records while `app.js` keeps DOM reads, selected-state assignment, and render effects.
- Process update (2026-05-31): continued Phase 6 narration/voice extraction by moving narration session, alignment job, saved voice recording, and voice render-job metadata synchronization into `features/narration/narration-metadata-sync-service.js`. Scene moves/deletes still trigger the same synchronization, but the re-anchoring rules are no longer embedded in `app.js`.
- Process update (2026-06-01): added planned Feature `1.11` and updated the refactor roadmap for an app-owned anchor-aware decoration drift pipeline before any editor-library experiment. The next phase will use `Design notes/anchor-decoration-drift-handling-design.md` as the source design: live edit transactions update anchors first, load-time hashes validate stored offsets, bounded context recovers stale offsets, and render-only projections remain disposable.
- Process update (2026-06-01): started Feature `1.11` by adding the first `features/manuscript-anchors` service slice. Anchor DTO/evidence helpers, runtime-only edit transactions, live anchor mutation, hash/context validation, active-scene anchor indexing, and decoration projection helpers now have DOM-free services and focused tests. Current spellcheck underline projections now route through the decoration projection service while remaining runtime-only and excluded from project persistence.
- Process update (2026-06-01): continued Feature `1.11` by wiring live scene text commits into the anchor drift pipeline for offset-backed tasks and passage notes. `ManuscriptInputController` now has an injected anchor-update step before scene draft persistence; when manuscript text changes, the app derives a runtime edit transaction, shifts affected task/note offsets cheaply, and only refreshes bounded context/hash metadata when the edit overlaps, replaces, or deletes the anchored content. Pure shifts preserve existing evidence until lazy validation. The edit transaction text itself remains runtime-only and is not saved as anchor metadata.
- Process update (2026-06-01): continued Feature `1.11` by adding the load/lazy task/note validation path. Project activation and anchor navigation now resolve through `manuscript-anchor-record-service.js`, which can validate stored hashes, recover legacy selected-text anchors through the shared fallback path, emit record patches for bounded evidence/status repair, and mark stale anchors as non-renderable. Newly created task and passage-note records now receive bounded hash/context metadata at creation, while hover previews still avoid persistence writes.
- Process update (2026-06-13): corrected Feature `8.4` after runtime evidence showed a browser-cache fallback was clearing project-file dirty state when the browser rejected the real file write. Cache-only preservation now leaves autosave blocked and the JSON file explicitly out of sync, avoids repeated idle retries against the blocked target, and clears the state only after a successful file write. A passage-note regression serializes an edited inspiration note and verifies its body is present in the external JSON payload before autosave becomes clean.
- Process update (2026-06-03): completed the current Phase 7 anchor-owner slice for Feature `1.11`. The shared anchor record service now live-shifts canonical `{ anchor }` records as well as offset-backed task/note records; `app.js` maps scene-level textarea edits back into block-local issue, event-tag, narration-session, and narration-alignment anchors before scene persistence. The same canonical update helper and anchor index path are ready for future revision-pass marker records when that durable collection exists. Idle validation is debounced, activation validation covers current anchor owners, and the test harness now covers canonical drift, nested narration anchors, generic revision-marker records, idle scheduler behavior, hash/context recovery, and runtime-only projection persistence boundaries.
- Process update (2026-06-03): continued Feature `1.11` by staging canonical manuscript marks in `packages/manuscript-schema`. `ManuscriptMark` records now have stable IDs, canonical anchors, source metadata, anchor status, bounded evidence fields, and an `addManuscriptMark` mutation with tests; the Phase 7 anchor index accepts `marks` as a named owner collection and canonical drift tests cover `manuscriptMark` records. The browser command path still writes `inlineFormatRanges` until the next migration slice moves author formatting writes and project JSON normalization to canonical marks.
- Process update (2026-06-03): continued Feature `1.11` by moving author-mark projections onto schema-shaped manuscript marks while keeping legacy writes intact. `manuscript-mark-service.js` derives anchor-backed marks from `inlineFormatRanges`, splits cross-block ranges into block-local anchors, uses bounded evidence for long ranges, and reports unmapped ranges back to the legacy path. `projection-selector.js` now prefers explicit `workspace.project.marks`, derives marks from compatibility ranges when marks are absent, and only falls back to `inlineFormatRange` projections when a stable block anchor cannot be created. Scene records and chunked scene normalization now preserve `paragraphId` when available so mark anchors can resolve more cleanly.
- Process update (2026-06-04): continued Feature `1.11` by synchronizing scene compatibility inline ranges into canonical `workspace.project.marks` before scene persistence. `manuscript-mark-service.js` now replaces only `mark-inline-*` compatibility marks for the edited scene, preserves future canonical marks, and reports unmapped ranges for the legacy path; `projection-selector.js` avoids deriving duplicate legacy projections when compatibility marks already exist. Project migration now defaults older save files to `workspace.project.marks: []`, so projection and migration code can inspect a stable canonical marks collection while direct formatting commands are still migrated off `inlineFormatRanges`.
- Process update (2026-06-04): prepared the manuscript marks mutation stage by adding a DOM-free direct mark toggle planner to `manuscript-mark-service.js`. The planner maps a scene selection into canonical `ManuscriptMark` additions/removals, allocates schema-style `mark-0001` IDs from project sequence state, preserves non-target marks, creates cross-block marks, removes fully covered marks, and splits partially toggled marks with refreshed bounded evidence. The toolbar still writes compatibility ranges until the next slice wires commands through this planner.
- Process update (2026-06-04): implemented canonical user highlights without a separate right-console panel. The editor Highlight control writes canonical `ManuscriptMark` records through the direct mark planner, removes highlight ranges from the scene compatibility field, persists marks through the project record path, and repaints the author-mark overlay after layout refresh without persisting runtime projection objects.
- Process update (2026-06-06): repaired the user-highlight toolbar workflow so a selected manuscript passage remains available when the author clicks Highlight. `user-highlight-command-service.js` now prefers the live textarea selection and falls back to the last scene-editor selection snapshot captured on toolbar pointerdown, while rejecting stale cached selections from other scenes. The regression test harness now covers live selection, toolbar-collapsed cached selection, clamped cached ranges, and stale-cache rejection.
- Process update (2026-06-06): repaired drag-selected manuscript Highlight commands through the toolbar path rather than a separate panel. The command routes through the same canonical user-highlight mutation path, and scene-editor drag selections refresh on pointerup before toolbar commands run.
- Process update (2026-06-06): fixed the visible render failure for user highlights. The textarea author-mark overlay was still hidden by `.editor-inline-format-layer { display: none; }`; it now renders as an aligned transparent-text layer so canonical highlight marks show as yellow backgrounds behind the manuscript text. `desktop-application.test.mjs` now guards against hiding the inline-format layer again.
- Process update (2026-06-06): fixed the remaining saved-project mapping failure for user highlights. `manuscript-mark-service.js` now maps selections against the actual loaded editor text even when saved scene blocks use a different separator than the current editor composer, then falls back to a scene-wide stable block anchor instead of returning `unmapped-selection`. `manuscript-mark-service.test.mjs` now covers the Serva Vitae `scene-0023` screenshot passage from `SaveTestFile/OriginFileproject-serva-vitae.abe-project.json`.
- Process update (2026-06-06): added switch-style user highlights for incoming typed text. `user-highlight-command-service.js` now resolves highlight commands into either a selected-range mutation or a collapsed-caret pending-format toggle, and `app.js` routes the pending case through the shared inline command controller so newly typed text receives a highlight range before the compatibility sync promotes it into canonical `ManuscriptMark` records.
- Process update (2026-07-15): fixed a textarea-overlay selection drift in Feature `1.10`. Italic author marks now use metric-neutral range layout with normal-width hidden tokens plus a true italic paint layer, so previously decorated text does not reflow away from the hidden textarea hit-testing surface or read as a faux-bold skew. Author-mark developer logs now include applied offsets plus a short selected-text preview.

- Process update (2026-07-15): refined Feature `1.10` decoration command behavior. Clicking bold, italic, underline, strikethrough, or highlight with manuscript text selected applies that decoration to the selected text and leaves that decoration setting active for future typing and paint-style range application. Active decoration settings stack, so turning on italic does not turn off bold, highlight, underline, or strikethrough. A decoration setting turns off only when the user explicitly toggles that same utility at a collapsed caret or uses a matching shortcut. The manuscript editor handles editor-scoped `Ctrl+B`, `Ctrl+I`, and `Ctrl+H` shortcuts for bold, italic, and highlight.
- Process update (2026-06-06): fixed pending-highlight anchor drift while typing. `manuscript-command-controller.js` now uses the browser's post-input caret to disambiguate inserted text when nearby characters repeat, and `manuscript-input-controller.js` passes the textarea selection offsets into that resolver. Tests now cover the repeated-prefix drift case and verify the corrected range still promotes into a canonical highlight mark and author-mark projection.
- Process update (2026-06-06): fixed selected-highlight drift during later typing. Existing `workspace.project.marks` now participate in the live canonical anchor update pass alongside issues and event tags, and `manuscript-block-text-service.js` keeps draft block text synchronized with textarea edits so block-local mark anchors keep receiving accurate edit contexts across repeated keystrokes.
- Process update (2026-06-06): migrated the Bold toolbar control onto the same author-mark behavior as user highlights. `app.js` now routes Bold through the canonical mark command path, the toolbar treats Bold as a true pending switch rather than caret-style state, and `manuscript-mark-service.js` splits or extends canonical bold marks during typing according to `pendingFormats.bold`.
- Process update (2026-06-07): fixed the browser rendering path for Bold author marks. The author-mark overlay now keeps base mirrored text transparent but gives text-style mark spans their own ink color, so `.editor-inline-format-bold` is visible instead of inheriting the transparent highlight-layer color. A follow-up centering fix replaced real `font-weight: 700` in the mirrored textarea layer with symmetric text-shadow faux-bold, preserving character metrics so the bold overlay stays aligned with the editable textarea text. Host and stylesheet tests now guard the Bold class, explicit Bold projection, and metric-preserving text-style overlay rule.
- Process update (2026-06-07): fixed Bold/Highlight application in newly created chapter/scene drafts. The author-mark command now reconciles the visible textarea text into scene draft text and stable draft blocks before running the canonical mark planner, and normalized paste always dispatches the editor input pipeline so pasted fresh-scene text does not remain model-empty. Regression tests cover no-block draft scenes, stale single-block reconciliation, and fresh-scene Bold/Highlight projection.
- Process update (2026-06-07): fixed selected Highlight removing earlier highlights in the same scene. Before the direct selected-mark command deletes legacy highlight ranges, retained same-kind `mark-inline-*` compatibility marks are promoted to durable `mark-000x` records, so the follow-up scene compatibility sync no longer treats previous highlights as disposable migration output. Regression coverage adds the exact earlier-highlight plus later-selected-highlight sequence.
- Process update (2026-07-15): implemented Feature `1.12` draft proof-read coverage runs. The top proof-read panel now starts, pauses/resumes, and finishes a proof-read run from the desktop target strip; active viewport, selection, caret-line, and edit activity expand the current run's covered spans; scene edits shift and expand proof-read coverage through the shared edit-transaction path; deleted scenes prune dead coverage; the latest completed run remains visible for recall when no run is active; and the textarea host renders coverage as a soft transparent `draft-proof` underlay beneath stronger author highlights.
- Process update (2026-07-15): tightened the top chrome layout around Feature `1.12`. Proof-read controls now share the left target strip with Developer Logs, autosave status sits beside Lines in the top stat strip, Local AI sits beside the Narration + Voice tab, and the writing-target/session-tracker metrics stay together in the right target-strip row.
- Process update (2026-07-15): tightened the Feature `1.7` scene editor masthead and top chrome. The project file path is now a hover-only File-button tooltip, the scene editor no longer spends a row on the project file name or `Scene Editor` label, the chapter title owns the top manuscript masthead row, the scene title sits between one compact Grammar Check control and the chapter word count, and the typography/highlight/revert controls share a single settings row.
- Note: The session tracker now renders as the full inline metrics panel with a circular WPM tracker, and its stateful pen artwork lives at `apps/editor/public/assets/icons/session-tracker-sleeping-pen.svg`, `apps/editor/public/assets/icons/session-tracker-working-pen.svg`, and `apps/editor/public/assets/icons/session-tracker-flaming-pen.svg`.
- Next work: promote local selected-text tasks into canonical anchored task records, add host-seeded passage-note/research records, persist task resolution with project data, and move the saved-project library from browser storage into a host-backed project store if needed later.

## Feature 02 - Local Writing Assistant

### Feature Definition

Provides real-time writing support by identifying potential issues as the author works, such as awkward phrasing, repetition, clarity problems, pacing concerns, or structural inconsistencies. It can run in a Local AI Only mode, where all analysis is performed directly on the user's own machine using their GPU, allowing the author to receive private, immediate feedback without sending manuscript content to any external service.

### Process Header

The writing assistant runs behind provider boundaries and returns local-first, anchored feedback that can be reviewed without making cloud execution a core dependency.

### Testable Subfeatures

2.1 Local AI provider routing

   The assistant routes local writing requests through provider contracts instead of calling a model directly from the editor. The code selects a model tier, builds a provider-safe prompt, and returns structured fallback results when a local provider is unavailable.
   2.1a Provider descriptors define local model capabilities.
   2.1b Routing policy selects Tiny, Standard, or Large model tiers.
   2.1c Unavailable providers return structured non-destructive failures.

2.2 Local AI editor preference

   The Local AI Only toggle lets the author control whether writing assistance should stay on the local machine. The code persists the preference with editor/project state so UI actions can respect local-first behavior after refresh or project reload.
   2.2a The Local AI toggle is exposed in the editor chrome.
   2.2b Preference state persists with project/editor settings.
   2.2c Local AI UI actions check the current preference before invoking assistance.

2.3 Local AI scene-title suggestion

   The author can request a scene title suggestion from the active scene editor. The code sends scene context through the local AI router and applies the returned title through normal scene-draft update logic so persistence, rendering, and dirty state stay consistent.
   2.3a The scene editor exposes a title suggestion action.
   2.3b Scene text and context are converted into a local AI request.
   2.3c Accepted title output updates the current scene draft title.

2.4 Anchored writing analysis suggestions

   Local analysis can identify writing issues and event candidates while preserving manuscript addressability. The code translates analysis output into issue/event suggestions with canonical anchors so the editor can navigate the author back to the relevant scene text.
   2.4a Rule analysis emits anchored issue suggestions.
   2.4b Event evidence emits anchored event suggestions.
   2.4c Suggestions remain reviewable and do not silently mutate manuscript structure.

### Progress

- Status: Foundation implemented.
- Repository coverage: local rule analysis provider, provider descriptors, analysis job contracts, anchored issue/event suggestions, Local AI Only settings, provider-bounded Local AI Router service, `llama.cpp` OpenAI-compatible provider route, Tiny/Standard/Large routing policy, selected `Qwen/Qwen3-0.6B-GGUF` via `llama.cpp` as the first lightweight model-adapter target, desktop local-AI HTTP routes, Local AI title toggle, scene title suggestion button, editable task/inspiration/research titles, and top-level workspace pane tabs that replace status-card navigation.
- Next work: add incremental changed-block analysis, richer editor UI affordances for local AI actions, and configured Standard/Large local model adapters.

## Feature 03 - Event Pinning

### Feature Definition

Lets the program automatically detect and mark major story moments throughout a manuscript, such as deaths, first encounters, character introductions, key interactions, and other important plot developments. The writer can also describe a specific event in plain language, and the AI will locate the matching passage in the manuscript and place a user-defined tag directly on the relevant line, making it easier to track structure, revisit important beats, and navigate complex narratives.

### Process Header

Important story beats are modeled as anchored event tags that can be searched, navigated, and reused by continuity and worldbuilding workflows.

### Testable Subfeatures

3.1 Anchored event detection

   Event detection scans manuscript blocks for major story moments and returns suggestions rather than silently tagging the project. The code packages each suggestion with an excerpt and manuscript anchor so it can be reviewed, searched, and later reused by continuity or worldbuilding tools.
   3.1a Analysis detects candidate story events from manuscript text.
   3.1b Event suggestions include excerpt, kind, confidence, and anchor data.
   3.1c Detection remains advisory until accepted into canonical project data.

3.2 Event tag persistence model

   Accepted or seeded events use canonical `EventTag` objects instead of plain highlights. The code stores event kind, source, confidence, and anchor fields so timeline, issue-console, and worldbuilding workflows can resolve the same story beat consistently.
   3.2a `EventTag` records preserve source and kind metadata.
   3.2b Event tags attach to canonical manuscript anchors.
   3.2c Persisted tags can be reused by later continuity and timeline systems.

3.3 Event console navigation foundation

   Event suggestions share the same addressable navigation principle as manuscript issues. The code renders event-like records through the console path and relies on anchors to navigate back to the appropriate scene line or passage.
   3.3a Event rows can be rendered beside issue-console records.
   3.3b Clicking an event resolves the target manuscript location.
   3.3c Event navigation avoids screen-coordinate or DOM-only references.

### Progress

- Status: Foundation implemented.
- Repository coverage: `EventTag`, event source typing, local event detection, event console records, and scene-line navigation.
- Next work: add author-defined event tagging from selected spans and richer event taxonomy controls.

## Feature 04 - Narration Follow Mode

### Feature Definition

Is a live reading view that listens to the narrator's voice, matches the spoken words against the manuscript in real time, and automatically keeps the current line or sentence centered on screen as the text scrolls smoothly ahead. Designed for audiobook recording, rehearsed narration, and long-form manuscript review, it reduces manual scrolling and page hunting, helping the reader stay locked onto the script with minimal interruption even if they pause, repeat a phrase, or momentarily lose their place.

### Process Header

Narration follow tracks a live read-through against canonical manuscript spans, keeping alignment state separate from editor rendering state.

### Testable Subfeatures

4.1 Narration session service

   Narration follow state is represented as session and alignment data rather than being hidden inside the editor UI. The code keeps audio-session state separate from rendering state so a future live follow engine can pause, recover, and align against canonical manuscript spans.
   4.1a Narration sessions are explicit service records.
   4.1b Alignment jobs use typed request/status/result data.
   4.1c Session state can evolve independently from editor layout.

4.2 Anchored narration take recording

   The author can select or arm a manuscript verse and record a take linked to that passage. The code records scene, block, and span metadata with the take so saved audio remains traceable after the editor rerenders or metadata is synchronized.
   4.2a Verse selection arms a passage for recording.
   4.2b Record, stop, and finalize actions create a take session.
   4.2c Saved takes retain manuscript anchor and media pointer data.

4.3 Narration recording tools UI

   The narration controls live inside the manuscript-oriented scene editor instead of a detached audio tool. The code renders armed verse state, recording status, narration chips, and saved take cards so the author can work from the script while recording.
   4.3a Narration mode displays recording controls near the manuscript.
   4.3b Recording status updates as the take moves through runtime states.
   4.3c Saved take cards expose preview/open actions where available.

4.4 Narration metadata synchronization

   Narration records must survive ordinary manuscript edits where their original scene and block still resolve. The code synchronizes session and alignment metadata against current manuscript structure to keep take records tied to usable anchors.
   4.4a Session metadata is reconciled with current scene/block records.
   4.4b Alignment job metadata is synchronized after manuscript structure changes.
   4.4c Broken or stale references are isolated for later recovery handling.

4.5 Mobile dictated writing companion (planned architecture)

   A phone-oriented companion lets the author speak new prose while away from the desktop, optionally review nearby manuscript context before recording or when placing the transcript, and accept it into an anchor-backed manuscript insertion target. This is classified under the closest audio/manuscript pillar because it relies on phone microphone capture and transcription, but unlike narration follow it creates new author-reviewed text rather than aligning or rendering existing text.
   4.5a Compact and medium mobile layouts prioritize readable scene context, touch-safe recording controls, and transcript review without requiring desktop side panels.
   4.5b Dictation sessions save audio/transcript drafts through local-first adapter boundaries and identify whether speech recognition is on-device, desktop-local, or explicitly hosted.
   4.5c Accepted transcript text becomes a canonical manuscript edit only through an anchored insertion command and persistence/revision path.
   4.5d Concurrent desktop/mobile edits or unresolved anchors produce reviewable insertion conflicts rather than silent text overwrites.
   4.5e Existing issue, task, target, narration, voice, and world workflows are adapted for phone screens where usable, with dense production surfaces remaining desktop/tablet-first initially.

### MobileFriendlyArchitecture Process Header (Planned)

The mobile companion is a local-first, voice-first writing surface: the writer captures spoken prose through device capability adapters, optionally uses an addressable scene for context or placement, reviews the transcript as a proposed insertion, and deliberately commits accepted prose back to the canonical manuscript.

### Progress

- Status: Foundation implemented.
- Repository coverage: narration session snapshots, alignment jobs, audio service contract, local alignment monitor, manuscript-style narration panel reuse, narration tool chips that arm a verse for recording, voice recording records with project-media pointers, a low-overhead browser capture path with optional speech-tracker state, the first modular extraction of the writing-target/session-tracker view into `apps/editor/public/features/progress-tracker.js` plus shared formatting helpers in `apps/editor/public/shared/ui-utils.js`, and the manuscript scene editor now split into `apps/editor/public/features/scene-editor.js` with the desktop host serving modular editor files generically from `apps/editor/public`.
- Process update (2026-05-28): documented `MobileFriendlyArchitecture` as a planned mobile authoring companion. It separates new-prose dictation from narration takes, defines viewport-based phone/tablet layouts and native capability adapters, and requires transcript review, anchored insertion, local-first recovery, and mobile/desktop conflict handling before implementation.
- Next work: add pause/recover state transitions, better spoken-word-to-verse tracking, Whisper-based streaming alignment, follow-cursor recovery, and continue splitting the manuscript shell into feature-owned modules so parallel work can happen without editing the same monolith. For Feature `4.5`, begin only after dictation contracts and host-neutral manuscript command/persistence boundaries are defined.

## Feature 05 - Character Voice Narration

### Feature Definition

Allows the author to produce full audiobook performances directly inside the writing suite by assigning distinct voices to different characters and narration roles across the manuscript. The system can either generate speech from text or convert the author's own spoken performance into selected character voices, making it possible for a single user to voice an entire cast while keeping dialogue delivery, speaker identity, and audio production linked directly to the manuscript structure.

### Process Header

Character voice narration maps manuscript speaker assignments to voice profiles and render jobs without hardwiring the editor to a specific speech engine.

### Testable Subfeatures

5.1 Voice profile and speaker binding model

   Character voice narration starts by separating manuscript speaker identity from the audio engine that may eventually render it. The code normalizes voice profiles and speaker bindings through provider-neutral service contracts so narrator, character, and future conversion voices can be swapped without changing manuscript data.
   5.1a Voice profiles normalize names, roles, and provider references.
   5.1b Speaker bindings map manuscript speakers to voice profiles.
   5.1c Provider details remain behind service boundaries.

5.2 Voice render job lifecycle

   Voice output is modeled as explicit jobs rather than hidden async UI state. The code moves preview and chapter render jobs through draft, queued, rendering, rendered, failed, and cancelled states so long-running audio work can be inspected and retried.
   5.2a Preview and chapter render jobs are created from manuscript context.
   5.2b Queue transitions are explicit and status-bearing.
   5.2c Failed and cancelled jobs remain inspectable.

5.3 Voice narration storage

   Generated or recorded voice assets need to remain traceable to the manuscript locations that produced them. The code stores local voice narration records with output pointers and metadata so project media can be reopened or reconciled later.
   5.3a Voice narration records persist profile/job/output metadata.
   5.3b Stored outputs retain project-media pointers.
   5.3c Storage normalizes legacy and current voice record shapes.

5.4 Editor voice narration controls

   The editor exposes voice controls where the author can inspect bindings, create previews, and review saved narration records. The code keeps those controls connected to voice services while avoiding direct coupling to a specific TTS or conversion engine.
   5.4a The right-side voice rail exposes voice narration actions.
   5.4b Saved recording cards display preview/open actions.
   5.4c Editor job helpers create service-backed narration jobs.

### Progress

- Status: Foundation implemented.
- Repository coverage: characters, speaker assignments, legacy voice routing, narration voice profiles, narration jobs, queue transitions, placeholder rendering, local voice narration storage, right-side voice rail controls, speaker bindings, preview jobs, chapter render jobs, the editor Voice Narration foundation panel, and saved voice-recording cards with preview/open actions.
- Next work: add editable voice-profile assignment, per-verse voice selection, provider configuration, richer media persistence, and later alignment handoff.

## Feature 06 - World Spine View

### Feature Definition

Gives the author an interactive worldbuilding workspace built around visual timeline spines rather than flat notes pages. Events are placed as nodes along horizontal timelines, while selecting a node opens a linked vertical editing pane where the user can refine the reasoning, references, implications, and supporting notes behind that event. Multiple spines can be stacked for different planets, factions, characters, or story threads, with visual links showing where events intersect or influence one another, making large-scale chronology and causality easier to build, understand, and revise. Timeline nodes that affect other event nodes are shown in the timeline spine, with links between nodes across spines when events take place in another locality.

### Process Header

The world spine view represents chronology, locality, and causality as structured spines, nodes, and edges rather than flat notes.

### Testable Subfeatures

6.1 Structured world model

   Worldbuilding data is stored as typed templates, entities, spines, nodes, edges, and links instead of decorative notes. The code gives chronology and locality stable IDs so world events can be filtered, linked, and reused by manuscript and continuity workflows.
   6.1a World models contain typed templates, entities, spines, nodes, and edges.
   6.1b Timeline nodes and edges preserve stable IDs.
   6.1c World links can reference manuscript and timeline anchors.

6.2 Template-driven entity instantiation

   Templates act as blueprints for reusable world entities such as planets, factions, cultures, or technologies. The code preserves template ancestry, typed fields, and user-edited values so created entities remain structured and portable.
   6.2a Templates define typed entity fields.
   6.2b Instantiated entities get stable IDs and template ancestry.
   6.2c User-edited field data stays attached to the entity record.

6.3 Timeline spine rendering

   The world spine view renders horizontal timeline lanes and supporting inspection panels so the author can reason about chronology visually. The code reads structured spine/node data and renders selected node, entity, template, and suggestion context without flattening the model into notes.
   6.3a Spine lanes render from timeline spine records.
   6.3b Selected node/entity panels show structured context.
   6.3c World inspector cards expose templates, entities, and suggestions.

6.4 Cross-spine causality links

   Events on different spines can influence one another and should be represented as explicit links. The code models timeline edges and entity introductions so causality, locality, and presence can be followed across planets, factions, characters, or story threads.
   6.4a Timeline edges connect events across spines.
   6.4b Entity introductions link entities to timeline/manuscript anchors.
   6.4c Link rendering foundations expose cross-spine relationships.

6.5 Reviewable world suggestions

   AI worldbuilding assistance can suggest templates, entities, and links but must not mutate canonical world data by itself. The code keeps suggestions advisory and evidence-linked so the author can accept or reject structural changes deliberately.
   6.5a Analysis can suggest world templates and entities.
   6.5b Suggested cross-spine links remain reviewable.
   6.5c Canonical world data changes only after explicit acceptance.

### Progress

- Status: Foundation implemented.
- Repository coverage: `TimelineSpine`, `TimelineNode`, `TimelineEdge`, entity introduction links, cross-spine edges, world inspector, and timeline navigation.
- Next work: add direct node editing, filters, and visual edge drawing across lanes.

## Feature 07 - Dream Scaping

### Feature Definition

Dream Scaping is an outlier feature for moments where the writer has an idea or scene they feel is powerful and wants to integrate it into the story. Dream Scaping uses the AI assistant to inspect the overarching story and suggest how the idea might fit into the current manuscript. Later iterations can work with the worldbuilding spine.

### Process Header

Dream Scaping lets an author submit a powerful loose idea or scene and receive reviewable story-fit proposals against the current manuscript and world spine evidence.

### Testable Subfeatures

7.1 Dream-scaping request and result contracts

   Dream Scaping starts with a loose author idea and turns it into structured suggestion data. The code records the idea input, fit classification, placement target, and suggestion status so later UI and acceptance flows can handle it predictably.
   7.1a Idea input is represented as a typed request.
   7.1b Fit and placement results classify where the idea may belong.
   7.1c Suggestion status stays explicit and reviewable.

7.2 Reviewable story-fit suggestion generation

   The analysis service compares the loose idea against manuscript and world evidence before proposing how it could fit. The code returns evidence-linked suggestions instead of directly inserting scenes or timeline nodes, preserving author control over story structure.
   7.2a Analysis builds story-fit suggestions from the idea text.
   7.2b Suggestions include evidence records and placement reasoning.
   7.2c No manuscript or world mutation happens during suggestion generation.

7.3 Dream Scaping panel rendering

   The editor panel presents pending Dream Scaping suggestions for review. The code renders fit, placement, and evidence summary data so the author can inspect the proposal before future accept/reject actions are added.
   7.3a Pending suggestions render as review cards.
   7.3b Fit and placement labels are visible in the panel.
   7.3c Evidence summaries remain tied to the suggestion record.

### Progress

- Status: Foundation implemented on 2026-04-24.
- Repository coverage: `DreamScapeSuggestion`, `DreamScapeIdeaInput`, local `exploreDreamScape` analysis flow, dream-scaping job trigger, desktop workspace snapshot, editor Dream Scaping panel, and tests.
- Next work: add an author-facing idea submission form, accept/reject actions, and optional creation of reviewed timeline nodes or scene drafts.

## Feature 08 - Project Save File Loader

### Feature Definition

Allows a writer to open a local project save file or project folder into this application's canonical saved-project format. The loader preserves manuscript hierarchy, chapter and scene ordering, template sheets, source provenance, and whitespace in the loaded text so the manuscript can be loaded, reviewed, and revised locally without depending on any external source format at runtime.

### Process Header

The project loader imports a user-owned project save file, translates it into the app's normal project model, and stores it as a regular saved project while keeping the original source file untouched.

### Testable Subfeatures

8.1 Source project file import

   The author can load a local `.abe-project.json` or supported source project file into the application's canonical project model. The code preserves provenance, source path, retained template text, manuscript hierarchy, and project metrics while leaving the original file untouched.
   8.1a Desktop/browser load actions read project files through controlled routes.
   8.1b Imported records preserve source provenance and path details.
   8.1c Loaded manuscript hierarchy becomes the active project model.

8.2 Project persistence service boundary

   All project save, load, autosave, import, export, restore, and canonical mutation behavior must route through `ProjectPersistenceService`. The code centralizes persistence so UI features do not write directly to browser storage, file handles, or ad hoc JSON blobs.
   8.2a Editor save/load commands call `ProjectPersistenceService`.
   8.2b Canonical project mutations go through the persistence boundary.
   8.2c Restore-last-opened behavior is owned by the persistence service.

8.3 Disposable browser cache policy

   Browser storage is treated as a temporary convenience cache, not the desktop source of truth. The code clears stale project-content cache when loading or switching projects and repopulates active state from the selected JSON project file.
   8.3a Loading a JSON project clears stale project-content storage.
   8.3b Cache hydration does not merge old project data into the new project.
   8.3c Active project cache reflects only the current manuscript version.

8.4 Autosave and dirty-state control

   Autosave only marks work clean after a real save path succeeds. The code reports save failures, preserves the latest snapshot in browser cache when permissions are unavailable, retains an explicit blocked/out-of-sync state, and waits for a user-authorized retry instead of silently treating fallback storage as a synchronized project file.
   8.4a Autosave calls the persistence service rather than direct storage writes.
   8.4b Failed or cache-only saves keep dirty state active and report the JSON file as out of sync.
   8.4c Permission fallback behavior is explicit, avoids retry loops, and is test-covered.

8.5 Project metrics derivation

   Project counts and dashboard metrics must be calculated from the loaded project record rather than stale browser cache. The code derives manuscript, world, task, timeline, template, and note metrics from canonical JSON data so refreshes and project switches show the current project accurately.
   8.5a Project index metrics are rebuilt from loaded project content.
   8.5b Passage-note counts derive from canonical notes.
   8.5c Metrics update after load, save, refresh, and project switch flows.

### Progress

- Status: Foundation implemented.
- Repository coverage: host-backed `/api/project-source` route, browser project-path input and load button, whitespace-preserving project text conversion, generic save-file path resolution, project-library merge/load flow for loaded projects, and file-backed load logging.
- Process update (2026-05-14): introduced a browser storage adapter + repository + `projectService` boundary with schema-versioned snapshot migration and a lightweight project index so UI flows can keep evolving while persistence can move to folder/SQLite/native backends later.
- Process update (2026-05-14): migrated persistence toward a chunked project package model where `project.json` holds manifest/index data and scene bodies are stored as per-scene records/files, with legacy monolithic `.abe-project.json` treated as migration input.
- Process update (2026-05-15): project-file save/load now treats `.abe-project.json` as a single active file-backed project, derives the canonical project ID/title from the loaded filename, remaps the active scene store under that identity, and recalculates workspace chapter/scene stats from the project index.
- Process update (2026-05-16): `ProjectPersistenceService` now owns browser file-handle recovery, filename display hydration before manuscript render, write-permission checks for Ctrl+S/autosave, and durable typed-path precedence so refreshes do not silently lose the active project identity.
- Next work: add a folder/file picker, surface richer load diagnostics, and build a dedicated retained-template browser for loaded source template sheets.

## Feature Implementation Index

This index is the code-map anchor for debugging, extraction work, and the future desktop port. Update it during `finalise work` when a feature or workflow is implemented, completed, meaningfully changed, or moved.

Also update this index immediately when the user says `Feature working`; that confirmation is the trigger that the workflow should be recorded with its current implementation lines.

### Entry Template

- Feature: `Feature N.N - Specific workflow name`, for example `Feature 1.3 - Manuscript spellcheck and project dictionary`
- Workflow: concise workflow name, for example `Scene drag/drop reorder`
- Status: `Planned`, `In Progress`, `Implemented`, `Partially Implemented`, `Needs Review`, or `Deprecated`
- Code locations: `path:start-end` with the main function or block name
- Execution flow: functions/blocks in chronological order from user action to state update
- Flow-on effects: render updates, persistence, autosave, dirty-state, logging, tests, and related service calls
- Extraction/port notes: ownership target such as feature slice, adapter, service, shared helper, or desktop bridge

### Indexed Workflows

- Feature: `Feature 1.2 - Context-aware scene insertion`
- Workflow: Context-aware scene insertion
- Status: `Implemented`
- Code locations: `apps/editor/public/app.js:7547-7561` (`markSceneEditorAsCurrent`), `apps/editor/public/app.js:11104-11148` (`addSceneDraft`, `getSceneIdForNewSceneDraftAnchor`), `apps/editor/public/editor-model.js:400-455` (`insertStructureSceneDraftAfterAnchor`), `test/editor-model.test.mjs:203-222` (scene-order insertion coverage)
- Execution flow: the manuscript editor records the active scene on pointer, focus, and typing -> `addSceneDraft` resolves the active editor scene as the insertion anchor -> `insertStructureSceneDraftAfterAnchor` creates a complete `structureDrafts.sceneOrder` with the new draft scene inserted immediately after that anchor -> the editor writes `EDITOR_STRUCTURE_KEY`, refreshes scene records, and selects the new scene
- Flow-on effects: the new scene stays in the same chapter as the active scene, binder order survives refresh/autosave/project persistence through `structureDrafts.sceneOrder`, the manuscript render selects the new scene after creation, and automated editor-model coverage verifies the persisted order
- Extraction/port notes: classified under Feature 1.2 because it is a manuscript editor/binder workflow that preserves author navigation and scene addressability; the insertion-order helper already lives in `editor-model.js`, while the UI event capture should move with the future scene-editor feature slice

- Feature: `Feature 1.1 - Anchored manuscript diagnostics console`
- Workflow: Anchored manuscript diagnostics console
- Status: `Implemented`
- Code locations: `packages/manuscript-schema/src/index.ts:125-157` (`ManuscriptAnchor`, `IssueRecord`, `EventTag`), `packages/manuscript-schema/src/index.ts:529-701` (anchor and issue/event mutation APIs), `services/analysis/src/index.ts:31-176` (`createLocalAnalysisService`, `analyze`), `apps/editor/public/features/manuscript-editor/projection-selector.js:4-225` (`diagnostic` projection channel and anchor filtering), `apps/editor/public/adapters/editor-host/textarea-editor-host.js:58-118` and `318-350` (diagnostic overlay markup/rendering), `apps/editor/public/features/scene-editor.js:148-273` (scene render projection input), `apps/editor/public/app.js:6622-6644` (`syncDiagnosticLayer`), `apps/editor/public/app.js:4277-4299` (`renderIssuePanelBody`), `packages/shared-types/src/index.ts:164-238` (`AnchoredManuscriptSuggestion` staged DTO), `test/manuscript-schema.test.mjs:17-132`, `test/analysis-service.test.mjs:21-213`, `test/manuscript-projection-selector.test.mjs:80-219`, `test/manuscript-editor-host.test.mjs:19-112`, and `test/project-refresh-persistence.test.mjs:292-300` (anchored record, projection, host, and persistence evidence)
- Execution flow: manuscript content is modeled as projects, chapters, scenes, blocks, and anchors -> local analysis returns issue and event suggestions with canonical anchors -> accepted issues are stored as durable project issue records -> `selectManuscriptProjections` filters open issue records to the active project/scene/block and evidence excerpt -> `renderTextareaDiagnosticLayer` paints the active scene overlay without saving projection objects -> issue/task navigation continues to resolve anchors back to the relevant scene text
- Flow-on effects: diagnostics remain line/span addressable, issue and event records can survive rendering changes, invalid or stale anchors do not render, world and Dream Scaping suggestions are not manuscript highlights, schema plus analysis tests verify anchor creation and issue records, projection tests cover priority and suggestion exclusion, and persistence tests guard against saving projection objects
- Extraction/port notes: Feature 1.1 spans `packages/manuscript-schema`, `services/analysis`, shared suggestion contracts, and the editor scene/console surfaces; future extraction should move remaining issue-console orchestration out of `app.js` into a dedicated feature slice, and any future `suggestion` channel must use `AnchoredManuscriptSuggestion` with explicit accept/reject commands

- Feature: `Feature 1.3 - Manuscript spellcheck and project dictionary`
- Workflow: Manuscript spellcheck and project dictionary
- Status: `Implemented`
- Code locations: `apps/editor/public/spellcheck.js:17-538` (lexicon, token, suggestion, and misspelling rules), `apps/editor/public/features/spellcheck/grammar-check-panel.js` (grammar panel summary, entry modeling, state transitions, drag sessions, and markup), `apps/editor/public/features/spellcheck/spellcheck-project-settings.js:1-71` (project dictionary/exception word normalization and mutation planning), `apps/editor/public/features/spellcheck/spellcheck-context-menu.js:1-85` (spellcheck context-menu model and markup), `apps/editor/public/features/spellcheck/spellcheck-context-controller.js` (selection and word-range context-menu record derivation), `apps/editor/public/features/spellcheck/spellcheck-refresh-controller.js` (refresh debounce timer state), `apps/editor/public/features/manuscript-editor/projection-selector.js:4-142` (`spellcheck` runtime projection channel), `apps/editor/public/adapters/editor-host/textarea-editor-host.js:362-407` and `587-613` (spellcheck projection layer and active-typing suppression), `apps/editor/public/state/project-activation-state.js:26-132` (loaded spellcheck settings hydration), `apps/editor/public/app.js` (shell menu mounting, panel orchestration, persistence effects, and host projection refresh), `test/spellcheck.test.mjs`, `test/grammar-check-panel.test.mjs`, `test/spellcheck-project-settings.test.mjs`, `test/spellcheck-context-menu.test.mjs`, `test/spellcheck-context-controller.test.mjs`, `test/spellcheck-refresh-controller.test.mjs`, `test/manuscript-projection-selector.test.mjs:10-144`, and `test/manuscript-editor-host.test.mjs:18-123` (rules, panel model, project settings mutation, context menu rendering/derivation, refresh scheduling, projection separation, and adapter rendering)
- Execution flow: editor boot loads base and reference word lists -> the active project lexicon produces runtime spelling findings -> `selectManuscriptProjections` maps findings to `spellcheck` projections -> `renderTextareaSpellcheckLayer` paints the active host without writing decoration data to the project -> `GrammarCheckPanel` derives grouped flagged-word entries and movable panel markup -> context-menu and panel actions edit text or update persisted project dictionary/exception settings through normal project paths
- Flow-on effects: spelling feedback remains local and project-scoped, user-added names and world terms are preserved in project settings, the movable grammar panel can bulk-select words for the dictionary, panel rendering is testable without the full shell, underlines stay aligned to textarea offsets, and tests cover contractions, inflections, edit-distance suggestions, resilient word-list loading, duplicate-normalized dictionary entries, panel grouping, and panel actions markup
- Extraction/port notes: spellcheck rules, projection painting, grammar panel rendering/state/drag behavior, dictionary/exception mutation planning, spellcheck context-menu rendering, spellcheck context-menu record derivation, and refresh debounce state are now separated; menu mounting/event dispatch, persistence effects, and host-specific projection refresh effects remain shell-owned and are the remaining Phase 3 extraction target

- Feature: `Feature 1.4 - Manuscript find and replace`
- Workflow: Manuscript find and replace
- Status: `Implemented`
- Code locations: `apps/editor/public/features/manuscript-editor/manuscript-find-controller.js:4-289` (`createManuscriptFindController`, panel modeling, match derivation, replacement plans), `apps/editor/public/features/manuscript-editor/projection-selector.js:4-123` (`search` runtime projection channel), `apps/editor/public/adapters/editor-host/textarea-editor-host.js:194-238` (runtime selection preview), `apps/editor/public/app.js:3225-3256` and `3849-4090` (panel mount, shell focus/edit effects, controller calls), `test/manuscript-find-controller.test.mjs:6-59` and `test/manuscript-projection-selector.test.mjs:10-144` (controller and projection behavior)
- Execution flow: Ctrl+F opens find state using selected text -> `ManuscriptFindController` derives structured scene matches and panel output -> navigation turns the active match into a runtime `search` projection rendered by the editor host -> replacement plans are committed through existing scene-draft mutation effects so durable text and metrics remain in normal persistence flow
- Flow-on effects: search operates across structured scenes rather than a flat DOM document, replacement participates in draft persistence and word-count updates, panel position and focused field selection are preserved across rerenders, and leaving the manuscript pane closes the find state
- Extraction/port notes: derivation and replacement planning are extracted; DOM focus, panel drag behavior, and durable edit effects intentionally remain injected shell concerns for now

- Feature: `Feature 1.5 - Anchored task, inspiration, and research notes`
- Workflow: Anchored task, inspiration, and research notes
- Status: `Implemented`
- Code locations: `apps/editor/public/editor-model.js:569-723` (task and passage-note record construction), `apps/editor/public/features/anchored-records/task-context-menu.js` (anchored task/note context-menu and composer markup), `apps/editor/public/features/anchored-records/anchored-record-controller.js` (composer planning, inline note draft seeding, record creation planning, typed-range policy, panel model grouping, and Local AI title request/guard planning), `apps/editor/public/features/anchored-records/task-panel.js` and `apps/editor/public/features/anchored-records/passage-note-panel.js` (panel, chapter-group, empty-state, and console item markup), `apps/editor/public/features/anchored-records/delete-confirmation-dialog.js` (delete confirmation rendering and preference normalization), `apps/editor/public/features/manuscript-editor/anchored-record-navigation-controller.js:7-114` (`findRecordAtSelection`, `buildPreview`), `apps/editor/public/features/manuscript-editor/projection-selector.js:4-123` (`task`/`note` projection channels), `apps/editor/public/adapters/editor-host/textarea-editor-host.js:151-191` and `241-258` (anchored preview painting/cleanup), `apps/editor/public/app.js` (shell navigation, persistence, async AI title, and inline insertion effects), `test/task-context-menu.test.mjs`, `test/anchored-record-controller.test.mjs`, `test/task-panel.test.mjs`, `test/passage-note-panel.test.mjs`, `test/delete-confirmation-dialog.test.mjs`, `test/anchored-record-navigation-controller.test.mjs:6-76`, and `test/manuscript-projection-selector.test.mjs:10-144` (context-menu, record planning, panel rendering, navigation, and projection evidence)
- Execution flow: author creates or selects an anchored task/note -> durable record retains its scene/range/evidence metadata -> `AnchoredRecordNavigationController` resolves or repairs the record range through injected callbacks -> `selectManuscriptProjections` emits an active `task` or `note` preview -> the textarea host paints/focuses the matching manuscript range without making the visual preview durable
- Flow-on effects: review items are actionable diagnostics rather than disconnected notes, passage notes are grouped into inspiration and research panels, deleting or moving scenes synchronizes linked metadata, and note/task edits persist through the project record
- Extraction/port notes: navigation and preview projection derivation, task/note context-menu rendering, composer planning, typed inline-note range policy, panel grouping/rendering, AI title request DTO planning, console item markup, and delete-confirmation rendering are extracted; inline manuscript insertion, persistence effects, async AI title calls, and canonical anchor promotion remain later anchored-record slice work

- Feature: `Feature 1.6 - Binder scene and chapter management`
- Workflow: Binder scene and chapter management
- Status: `Implemented`
- Code locations: `apps/editor/public/app.js:11064-11148` (`resetSceneDraft`, `addChapterDraft`, `addSceneDraft`, insertion anchor), `apps/editor/public/app.js:11290-11310` (`toggleChapterCollapse`), `apps/editor/public/app.js:11476-11603` (chapter/scene title editing), `apps/editor/public/app.js:12275-12376` (`buildStructureDraftScenesFromOrderedScenes`, `moveDraftBinderScene`), `apps/editor/public/app.js:12417-12699` (`deleteSceneFromBinder`, `trimSceneWhitespace`), `test/desktop-application.test.mjs:315-402` (binder behavior assertions)
- Execution flow: binder actions mutate draft structure rather than canonical imported source text directly -> title edits update scene/chapter drafts and labels -> drag/drop writes an explicit `sceneOrder` overlay -> delete and trim synchronize scene-linked tasks, notes, narration, voice, local AI title status, and selected state -> persistence routes through current project-record saves
- Flow-on effects: the binder remains an author-facing structural editor, empty draft scenes can be ordered between canonical scenes, chapter collapse state persists per project, and scene-linked metadata is cleaned or rebuilt when structure changes
- Extraction/port notes: this should become a manuscript-binder feature slice; ordering helpers already started moving into `editor-model.js`, but drag/drop, deletion, and metadata synchronization still sit in the app shell

- Feature: `Feature 1.7 - Scene editor focus, viewport, and line-aware navigation`
- Workflow: Scene editor focus, viewport, and line-aware navigation
- Status: `Implemented`
- Code locations: `apps/editor/public/features/manuscript-editor/manuscript-selection-controller.js:3-215` (selection, context range, bookmark, and persisted defaults policy), `apps/editor/public/adapters/editor-host/textarea-editor-host.js:127-326` (host focus, selection range, bookmark, viewport, offset-centering, and wrap metrics), `apps/editor/public/adapters/editor-host/textarea-editor-host.js:703-740` (pure visual-line offset helpers), `apps/editor/public/features/scene-editor.js:85-241` (compact chapter/scene masthead, grammar-check control, and one-row editor settings), `apps/editor/public/shell/editor-chrome.js:7-70` (File-button project-file hover identity), `apps/editor/public/app.js:3884-3996`, `apps/editor/public/app.js:3981-4008`, `apps/editor/public/app.js:7430-7609`, `apps/editor/public/app.js:9192-9419`, `apps/editor/public/app.js:9460-9468`, and `apps/editor/public/app.js:9886-9913` (shell orchestration calls through host capabilities and compact grammar-header syncing), `apps/editor/public/styles.css:199-216` and `apps/editor/public/styles.css:2569-2680` (File tooltip and masthead layout), `test/manuscript-selection-controller.test.mjs:6-91`, `test/manuscript-editor-host.test.mjs:18-123`, and `test/desktop-application.test.mjs:449-593` plus `test/desktop-application.test.mjs:897-912` (policy, host, and chrome/masthead assertions)
- Execution flow: editor interaction resolves the active textarea host -> host helpers capture selection, bookmark, viewport, wrap metrics, and offset scrolling -> `ManuscriptSelectionController` normalizes selected text, context ranges, bookmarks, and persisted scene selection defaults -> shell workflows invoke host range/scroll capabilities for find results, workspace defaults, task/note navigation, whitespace focus, and note deletion restore -> project saves receive normalized defaults rather than transient DOM objects
- Flow-on effects: autosave and reload can preserve author context, issue/task/note navigation lands in useful manuscript positions, pane-local scrolling avoids browser-page jumps, visual-line math is testable outside `app.js`, the scene editor keeps manuscript metadata and writing controls visible without a redundant project-file row, and a later editor adapter can provide equivalent navigation capabilities without rewriting feature controllers
- Extraction/port notes: selection policy and textarea host mechanics are extracted; residual non-host focus/scroll work belongs with individual panels or shell chrome rather than the manuscript editor host

- Feature: `Feature 1.8 - Writing targets, daily progress, and session tracker`
- Workflow: Writing targets, daily progress, and session tracker
- Status: `Implemented`
- Code locations: `apps/editor/public/features/progress-tracker.js:6-307` (`renderWritingTargetStrip`, session tracker card and metric cards), `apps/editor/public/features/writing-targets/writing-target-window.js:6-120` (`renderWritingTargetWindowHTML` dashboard shell), `apps/editor/public/features/writing-targets/writing-goals-service.js:8-104` (`createWritingGoalsService`, `renderWritingTargetWindow`), `apps/editor/public/features/writing-targets/writing-goals-state-service.js:1910-2488` (snapshot, session lifecycle, WPM, and baseline state), `test/writing-goals-state-service.test.mjs:6-261` and `test/desktop-application.test.mjs:405-540` (dashboard/session/daily baseline coverage)
- Execution flow: scene edits update manuscript word count -> writing-target state records current word count, session samples, daily baseline, and per-day history -> the header strip and dashboard render live progress, release-date target pacing, WPM, session phases, calendar entries, notes, and selected-day detail -> saves commit canonical writing-target state into the project record
- Flow-on effects: daily target progress is separated from total manuscript word count, sessions can idle/conclude/resume without losing history, project save files carry progress data, and tests cover deletion scenarios, implausible baselines, session lifecycle text, dashboard structure, and persistence wiring
- Extraction/port notes: most rendering/state logic is already in `features/progress-tracker.js` and `features/writing-targets/*`; remaining shell wiring in `app.js` should be limited to project persistence callbacks and scene-edit notifications

- Feature: `Feature 1.9 - Revision session banking`
- Workflow: Revision session banking
- Status: `Partially Implemented - standalone window mockup added`
- Code locations: `apps/editor/public/adapters/storage/revision-storage-service.js:1-241` (`createRevisionStorageService`, state normalization/read/write), `apps/editor/public/features/revisions/revision-diff-service.js:1-443`, `revision-event-service.js:1-110`, `revision-service.js:1-465`, `revision-panel-controller.js:1-76`, and `revision-window.js:1-405` (revision slice), `apps/editor/public/shell/editor-chrome.js:388-407` (top-chrome action), `apps/editor/public/app.js:4327-4375` (revision window orchestration), `test/revision-panel.test.mjs` and `test/revision-storage.test.mjs` (renderer/storage evidence)
- Execution flow: a host shell wires project-record and revision-state callbacks into `RevisionService` -> `RevisionStorageService.readRevisionState` normalizes stored history when present -> `RevisionService.loadRevisionHistory` hydrates in-memory state -> `startSession` creates a baseline digest from `buildRevisionProjectDigest` -> `recordEvent` aggregates revision ledger entries -> `stageSession` computes the diff, changed entities, and summary -> `finaliseSession` or `bankCurrentRevision` writes the banked session back into revision state -> `RevisionPanelController` filters and groups sessions -> `RevisionWindow` renders the model as a standalone session/file rail with before/after digest comparison
- Flow-on effects: normalized revision records in project-shaped state, banked-session logging, diff preview generation, grouped session summaries, session status transitions, a developer-style review mockup for user feedback, and a benched scene-editor overlay path that still reads from revision stats in code
- Extraction/port notes: `apps/editor/public/features/revisions/*` and `apps/editor/public/adapters/storage/revision-storage-service.js` own the slice; the wiring should remain behind `ProjectPersistenceService` or an equivalent storage boundary when connected

- Feature: `Feature 1.10 - Manuscript inline formatting commands`
- Workflow: Selection-aware bold, italic, underline, strikethrough, and highlight controls
- Status: `Implemented browser slice; user-highlight and bold decorations implemented`
- Code locations: `apps/editor/public/features/manuscript-editor/manuscript-command-controller.js:3-518` (format command, pending-format switch state, caret-anchored inserted-text resolution, and compatibility range mutation policy), `apps/editor/public/features/manuscript-editor/manuscript-input-controller.js:7-89` (live typing sequence with post-input caret offsets), `apps/editor/public/features/manuscript-editor/manuscript-block-text-service.js:1-221` (draft block text synchronization and fresh-scene block fallback from flat textarea edits), `apps/editor/public/features/manuscript-editor/manuscript-mark-service.js:1-821` (legacy range to schema-shaped mark conversion, compatibility mark sync, direct mark mutation planning, block-local anchor splitting, tolerant saved-project text mapping, bounded evidence, and projection bridge), `apps/editor/public/features/manuscript-editor/projection-selector.js:1-359` (author-mark projection source now prefers explicit/derived marks before legacy ranges and suppresses duplicate compatibility derivation), `apps/editor/public/features/manuscript-decorations/user-highlight-command-service.js:1-172` (selected-range versus pending-caret command intent and live/cached selection recovery for toolbar-triggered highlights), `apps/editor/public/features/manuscript-editor/editor-host-interface.js:7-47`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:50-94`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:333-349`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:517-545`, `apps/editor/public/features/scene-editor.js:172-273`, `apps/editor/public/app.js`, `apps/editor/public/styles.css:2907-2941`, `apps/editor/public/editor-model.js:255-361`, `apps/editor/public/adapters/storage/project-repository.js:57-70`, `apps/editor/public/adapters/storage/project-repository.js:181-190`, `apps/editor/public/adapters/storage/project-migrations.js:120-131`, `packages/manuscript-schema/src/index.ts:21-55`, `packages/manuscript-schema/src/index.ts:178-211`, `packages/manuscript-schema/src/index.ts:745-783`, `packages/manuscript-schema/src/index.ts:890-918`, `test/manuscript-command-controller.test.mjs`, `test/manuscript-input-controller.test.mjs`, `test/manuscript-anchor-services.test.mjs`, `test/manuscript-mark-service.test.mjs`, `test/manuscript-projection-selector.test.mjs`, `test/user-highlight-command-service.test.mjs`, `test/desktop-application.test.mjs`, `test/project-service-storage.test.mjs`, `test/manuscript-editor-host.test.mjs`, `test/project-refresh-persistence.test.mjs`, `test/editor-model.test.mjs`, and `test/manuscript-schema.test.mjs`.
- Supplemental code locations (2026-06-06/2026-06-07 Bold mark switch and rendering): `apps/editor/public/app.js:249`, `apps/editor/public/app.js:4072-4096`, `apps/editor/public/app.js:9590-9596`, and `apps/editor/public/app.js:9966-10161` (Bold/Highlight decoration routing, pending-only toolbar state, generic author-mark command, pending-off helper, and mark metadata), `apps/editor/public/features/manuscript-decorations/user-highlight-command-service.js:9-92` (mark-neutral command aliases for shared selection/pending intent), `apps/editor/public/features/manuscript-editor/manuscript-mark-service.js:127-170` and `apps/editor/public/features/manuscript-editor/manuscript-mark-service.js:725-837` (canonical mark edit updates and pending-format split/extend policy), `apps/editor/public/styles.css:2921-2951` (transparent base author-mark overlay with visible text-style mark spans and highlight backgrounds), `test/manuscript-command-controller.test.mjs:100-300`, `test/manuscript-mark-service.test.mjs:633-690`, `test/manuscript-projection-selector.test.mjs:111-161`, `test/manuscript-editor-host.test.mjs:82-110`, and `test/desktop-application.test.mjs:759-770` (Bold selected text, pending typed ranges, canonical bold split/extend, explicit Bold projection, host rendering, and CSS visibility regression coverage)
- Supplemental code locations (2026-06-07 fresh-scene decorations): `apps/editor/public/features/manuscript-editor/manuscript-block-text-service.js:7-70`, `apps/editor/public/app.js:507-522`, `apps/editor/public/app.js:2921-2955`, `apps/editor/public/app.js:9978-10164`, `test/manuscript-input-controller.test.mjs:111-140`, and `test/manuscript-mark-service.test.mjs:299-370` cover no-block draft scene fallback, stale single-block reconciliation, paste input dispatch, live author-mark scene reconciliation, and fresh-scene Bold/Highlight projection.
- Supplemental code locations (2026-06-07 highlight preservation): `apps/editor/public/features/manuscript-editor/manuscript-mark-service.js:332-382`, `apps/editor/public/app.js:10188-10224`, and `test/manuscript-mark-service.test.mjs:374-464` cover compatibility-mark promotion before highlight range cleanup and the earlier-highlight plus later-selected-highlight regression.
- Execution flow: author drag-selects manuscript text and presses toolbar Bold or Highlight -> shell captures the current scene-editor selection before browser focus changes and refreshes drag selections on pointerup -> the mark command reconciles visible textarea text into scene draft text/blocks when a fresh draft scene is ahead of state -> the mark command prefers the live textarea selection and falls back to the cached same-scene selection if the click collapsed the live range -> selected Bold/Highlight routes to the canonical mark planner, while collapsed Bold/Highlight toggles the pending switch for incoming text -> retained same-kind compatibility marks are promoted to durable IDs before legacy ranges for that mark kind are removed -> `workspace.project.marks` receives added/removed/split/promoted `ManuscriptMark` records and updated mark sequence state -> project persistence records the mark mutation through the existing scene/project save path -> projection selector emits author-mark projections from canonical marks -> textarea host repaints the author-mark layer.
- Flow-on effects: literal `<strong>`, `<em>`, and `<u>` tags are no longer inserted into manuscript text, italic/underline/strikethrough remain implemented beside the canonical Bold/Highlight controls, the old scene-wide italic CSS class is no longer applied, current author formatting survives JSON-backed scene storage, user highlights and selected Bold marks are canonical marks rather than legacy ranges, future non-compatibility marks are preserved during scene sync, and the direct mutation planner is now exercised by two author-facing mark workflows
- Extraction/port notes: this is classified under Feature 1 because it is core scene-editor authoring behavior; user highlights and Bold now use the Phase 7 mark/projection/persistence boundary end to end, while italic/underline/strikethrough still need migration from `inlineFormatRanges` to direct `ManuscriptMark` mutations

- Feature: `Feature 1.11 - Anchor-aware decoration drift pipeline`
- Workflow: Anchor-aware decoration drift pipeline
- Status: `Implemented for current anchor owners; user-highlight decorations implemented`
- Code locations: `Design notes/anchor-decoration-drift-handling-design.md` (source design), `docs/architecture/editor-application-roadmap.md` (Phase 7 roadmap), `docs/architecture/manuscript-decoration-layer.md` (anchor drift contract and implementation sequence), `packages/manuscript-schema/src/index.ts:21-55`, `packages/manuscript-schema/src/index.ts:178-211`, `packages/manuscript-schema/src/index.ts:745-783`, and `packages/manuscript-schema/src/index.ts:890-918` (canonical `ManuscriptMark` DTO, sequence, evidence/status fields, bounded evidence helper, and mutation), `apps/editor/public/features/manuscript-editor/manuscript-mark-service.js:1-821`, `apps/editor/public/features/manuscript-decorations/user-highlight-command-service.js:1-172`, `apps/editor/public/adapters/storage/project-migrations.js:120-131`, `apps/editor/public/features/manuscript-anchors/*`, `apps/editor/public/features/anchored-records/*`, `apps/editor/public/features/manuscript-editor/anchored-record-navigation-controller.js`, `apps/editor/public/features/manuscript-editor/manuscript-input-controller.js`, `apps/editor/public/features/manuscript-editor/projection-selector.js`, `apps/editor/public/features/scene-editor.js`, `apps/editor/public/app.js`, `test/manuscript-anchor-services.test.mjs`, `test/manuscript-mark-service.test.mjs`, `test/manuscript-projection-selector.test.mjs`, `test/user-highlight-command-service.test.mjs`, `test/desktop-application.test.mjs`, `test/project-service-storage.test.mjs`, `test/manuscript-schema.test.mjs`, `test/anchored-record-controller.test.mjs`, `test/anchored-record-navigation-controller.test.mjs`, `test/anchored-record-service.test.mjs`, and `test/manuscript-input-controller.test.mjs`.
- Supplemental code locations: `apps/editor/public/features/manuscript-editor/manuscript-block-text-service.js:1-221`, `apps/editor/public/app.js:507-522`, `apps/editor/public/app.js:9978-10164`, `test/manuscript-anchor-services.test.mjs:441-469`, `test/manuscript-input-controller.test.mjs:94-140`, and `test/manuscript-mark-service.test.mjs:299-370` cover live `ManuscriptMark` drift, draft block-text synchronization, fresh-scene block fallback, live author-mark scene reconciliation, and fresh-scene Bold/Highlight projection added after the initial Phase 1.11 index entry.
- Execution flow: manuscript input captures previous and next scene text -> edit transaction derivation identifies the changed range -> active task/note records shift through offset-backed record APIs while issue, event-tag, narration-session, and narration-alignment anchors map the same scene edit into block-local canonical anchor patches -> changed anchor status/evidence is committed to normal project state before scene draft persistence -> scene draft update synchronizes compatibility inline ranges into canonical `workspace.project.marks` -> activation, idle validation, and task/note navigation validate or recover records through the shared anchor service -> accepted repair patches persist updated bounded evidence/status through `ProjectPersistenceService` -> projection selection regenerates disposable decorations from renderable validated anchors and canonical marks
- Flow-on effects: revision-pass and future highlight/decorations work have a shared anchor lifecycle, pure offset shifts stay cheap during typing, current durable owners carry bounded hash/context metadata where needed, stale load/navigation results are not painted, long ranges use hash plus bounded context instead of giant excerpts, idle validation uses one debounced scheduler, generic revision-marker records can use the canonical update helper when their durable collection is introduced, schema-shaped manuscript marks now use the same projection/index/drift path, user highlights are synchronized and directly mutated as project data, and runtime-only spellcheck/search/narration-follow visuals stay outside project persistence
- Extraction/port notes: this refactor phase now has direct canonical mark writes for user highlights and Bold without a separate Decorations right-console panel. Next decoration work should stay behind canonical mark/record DTOs and avoid adding new right-console surfaces unless explicitly requested.

- Feature: `Feature 1.12 - Draft proof-read coverage runs`
- Workflow: Proof-read run coverage tracking
- Status: `Implemented`
- Code locations: `apps/editor/public/features/draft-proofing/draft-proofing-service.js:55-477` (run lifecycle, coverage merge/edit/prune, and projection DTOs), `apps/editor/public/features/draft-proofing/draft-proofing-panel.js:1-70` (top proof-read panel model and markup), `apps/editor/public/shell/editor-chrome.js:3-77` (panel placement in the desktop target strip), `apps/editor/public/features/progress-tracker.js:6-34` (target-strip leading slot), `apps/editor/public/app.js:1547-1553`, `apps/editor/public/app.js:5627-5666`, `apps/editor/public/app.js:6840-7100`, `apps/editor/public/app.js:7155-7178`, and `apps/editor/public/app.js:12102-12108` (event routing, overlay sync, persistence, coverage capture, edit expansion, and deletion cleanup), `apps/editor/public/features/manuscript-editor/projection-selector.js:19-83` (`draft-proof` projection channel), `apps/editor/public/adapters/editor-host/textarea-editor-host.js:89-94`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:344-356`, and `apps/editor/public/adapters/editor-host/textarea-editor-host.js:602-622` (underlay markup and rendering), `apps/editor/public/styles.css:285-386` and `2963-3024` (top panel layout and soft proof-read underlay styling), `apps/editor/public/state/project-record-state.js:134` and `223`, `apps/editor/public/state/project-runtime-record-state.js:102`, `apps/editor/public/state/project-activation-state.js:84`, `apps/editor/public/adapters/storage/project-persistence-service.js:155-197` and `338-370`, `apps/editor/public/adapters/storage/project-migrations.js:88-114`, `test/draft-proofing-service.test.mjs`, `test/draft-proofing-panel.test.mjs`, `test/manuscript-projection-selector.test.mjs:168-181`, `test/manuscript-editor-host.test.mjs:135-146`, `test/project-record-state.test.mjs:54-87`, `test/project-runtime-record-state.test.mjs:34-90`, `test/project-activation-state.test.mjs:59-79`, and `test/desktop-application.test.mjs:300-318`
- Execution flow: the author presses `Start proof read` or `Resume proof` in the top proof-read panel -> `toggleDraftProofRun` starts or resumes a durable run -> viewport scrolling, selection changes, focus, and caret activity call coverage capture helpers -> `draft-proofing-service.js` merges coverage intervals by scene -> active text edits call `updateDraftProofCoverageForTextEdit`, shifting existing spans and adding the edited range -> project persistence stores `draftProofing` with the durable record -> `selectManuscriptProjections` derives a `draft-proof` projection for the active scene -> the textarea host paints a transparent underlay below author-highlight projections
- Flow-on effects: proof-read coverage is simple durable run state rather than a notes/warnings layer, author highlights remain visually stronger, autosave/project save/load preserve the run, the latest completed run remains recallable, scene deletion removes dead scene coverage, and `npm test` covers lifecycle, edit expansion, projection, host rendering, state hydration, persistence shape, and desktop module exposure
- Extraction/port notes: classified under Feature 1 because it is a manuscript review workflow. Domain state lives in `features/draft-proofing`; the shell still owns DOM observation and persistence scheduling until a future scene-editor controller can absorb those orchestration callbacks.

- Feature: `Feature 2.1/2.2/2.3 - Local AI routing, preference, and scene-title suggestion`
- Workflow: Local AI scene-title and provider routing
- Status: `Implemented`
- Code locations: `services/local-ai/local-ai-types.ts:2-59` (`AiRequest`, `AiResult`, `LocalAiProvider`), `services/local-ai/model-routing-policy.ts:5-26` (`selectModelTier`), `services/local-ai/prompt-builder.ts:5-48` (`buildLocalAiPrompt`), `services/local-ai/local-ai-router.ts:12-76` (`LocalAiRouter`), `services/local-ai/providers/llama-cpp-provider.ts:25-145` (`LlamaCppProvider`), `apps/editor/public/app.js:2198-2203` (Local AI toggle), `apps/editor/public/app.js:10309-10349` (`suggestSceneTitle`), `apps/editor/public/features/scene-editor.js:159-273` (`renderSceneEditorHTML` title suggestion control), `test/local-ai-service.test.mjs:13-115` and `test/local-ai-router.test.mjs:36-66` (routing, prompt, provider fallback coverage)
- Execution flow: the author enables Local AI in editor preferences -> the scene title button sends scene context through `suggestSceneTitle` -> the Local AI router chooses a model tier and prompt -> provider output updates the scene draft title through normal manuscript state and render paths
- Flow-on effects: local-first behavior is preserved behind provider contracts, unavailable providers return structured fallback results, editor preferences persist with project state, and tests cover model-tier routing, prompt shape, successful responses, unavailable providers, and unconfigured tiers
- Extraction/port notes: local AI routing already lives in `services/local-ai`; editor-specific invocation remains in `app.js` and should move into a Local Writing Assistant feature controller when the shell is split

- Feature: `Feature 3.1/3.2/3.3 - Anchored event detection, event tags, and navigation foundation`
- Workflow: Anchored event detection and tagging foundation
- Status: `Implemented`
- Code locations: `packages/manuscript-schema/src/index.ts:12-18` (`EventTagKind`, `EventSource`), `packages/manuscript-schema/src/index.ts:149-157` (`EventTag`), `packages/manuscript-schema/src/index.ts:662-701` (`addEventTag`), `services/analysis/src/index.ts:53-176` (`analyze` event suggestions), `services/analysis/src/index.ts:240-259` (`createEvent`), `apps/editor/public/app.js:4277-4299` (`renderIssuePanelBody` shares anchored console flow), `test/manuscript-schema.test.mjs:130-132` and `test/analysis-service.test.mjs:202-213` (event evidence)
- Execution flow: analysis scans manuscript blocks for event evidence -> `createEvent` emits a structured event suggestion with a manuscript anchor and excerpt -> schema APIs can add an `EventTag` to the canonical project -> editor navigation uses the same anchor-backed console pattern as issue records
- Flow-on effects: detected events remain tied to project/chapter/scene/block/span references, event records can be reused by world and continuity systems, and tests verify event suggestions and persisted event tags
- Extraction/port notes: event records belong in `packages/manuscript-schema`; richer user-authored pinning should get a dedicated editor feature slice instead of adding more event workflow code to `app.js`

- Feature: `Feature 4.1/4.2/4.3/4.4 - Narration service, take recording, tools UI, and metadata sync`
- Workflow: Anchored narration take recording and alignment service foundation
- Status: `Partially Implemented`
- Code locations: `services/audio/src/index.ts:11-86` (`createInMemoryAudioService`), `apps/editor/public/features/scene-editor.js:159-273` and `387-431` (narration editor mode and controls), `apps/editor/public/features/narration/narration-media-service.js:1-93` (project-media save/load and blob conversion), `apps/editor/public/features/narration/narration-metadata-sync-service.js:1-107` (narration/voice metadata re-anchoring), `apps/editor/public/features/narration/narration-media-recorder-service.js:1-76` (MediaRecorder construction and event handling), `apps/editor/public/features/narration/narration-recording-command-service.js:1-200` (start/stop command sequencing), `apps/editor/public/features/narration/narration-recording-finalization-service.js:1-101` (final media-save mapping and paused-session result), `apps/editor/public/features/narration/narration-recording-runtime-service.js:1-86` (recorder timer/speech/media cleanup), `apps/editor/public/features/narration/narration-selection-service.js:1-127` (armed verse selection derivation), `apps/editor/public/features/narration/narration-speech-recognition-service.js:1-91` (speech tracker setup and events), `apps/editor/public/features/narration/narration-take-service.js:1-255` (runtime/take/session/final-record DTOs, transcript normalization, blob construction, finalization context, media naming), `apps/editor/public/features/voice/voice-recording-action-service.js:1-83` (recording preview and manuscript navigation actions), `apps/editor/public/features/voice/voice-recording-service.js:1-85` (saved recording collection access/mutation), `apps/editor/public/app.js:4734-4849` and `4916-5160` (selection wrappers, finalize/abort persistence orchestration, and command-service wrapper calls), `apps/editor/public/state/project-activation-controller.js:87-91` (project-switch recorder cleanup callback), `test/audio-service.test.mjs:13-64`, `test/narration-media-service.test.mjs:1-53`, `test/narration-metadata-sync-service.test.mjs:1-79`, `test/narration-media-recorder-service.test.mjs:1-62`, `test/narration-recording-command-service.test.mjs:1-125`, `test/narration-recording-finalization-service.test.mjs:1-70`, `test/narration-recording-runtime-service.test.mjs:1-74`, `test/narration-selection-service.test.mjs:1-81`, `test/narration-speech-recognition-service.test.mjs:1-62`, `test/narration-take-service.test.mjs:1-110`, `test/voice-recording-action-service.test.mjs:1-78`, and `test/voice-recording-service.test.mjs:1-52` (session, media, metadata sync, recorder, command, finalization, speech, cleanup, selection, take DTO, recording actions, and recording-store coverage)
- Execution flow: narration pane reuses the manuscript scene editor -> author selects a verse and starts recording -> recording runtime stores a scene/block/span-aware take session -> optional speech tracking updates transcript/status -> stop/finalize saves the take and synchronizes narration metadata against current manuscript anchors
- Flow-on effects: narration state is separate from editor rendering state, recorded takes remain tied to manuscript anchors, alignment jobs have typed service coverage, media persistence is service-owned, recorder resource cleanup is shared across normal stop, failed start, and project switching, armed verse selection is feature-owned, take/session/final-record data now come from feature-owned DTO helpers, recorder/speech events no longer mutate runtime state directly from shell-defined handlers, start/stop command sequencing has focused service tests, final media-save failures are mapped outside the shell, saved recording collection mutation is feature-owned, preview/navigation actions resolve through service plans, and structure-change metadata re-anchoring is feature-owned
- Extraction/port notes: project persistence side effects still live in `app.js`; the service boundary exists in `services/audio`, and remaining persistence scheduling should move into a narration or voice-recording command before real alignment/follow engines are attached

- Feature: `Feature 4.5 - Mobile dictated writing companion`
- Workflow: Phone voice-first authoring with reviewable anchored manuscript insertion
- Status: `Planned - architecture documented; not implemented`
- Architecture locations: `docs/architecture/mobile-friendly-architecture.md` (`MobileFriendlyArchitecture` plan), `docs/architecture/editor-application-roadmap.md` (`Parallel Product Track: MobileFriendlyArchitecture`), `docs/product/feature-map.md` (`Mobile Authoring (Planned)`)
- Planned execution flow: mobile host loads a local project snapshot through a persistence adapter -> writer selects a scene/span insertion target and records speech through a capability adapter -> audio service returns a transcript candidate under an explicit locality policy -> writer edits or accepts the candidate -> accepted prose routes through an anchored manuscript edit and revision/persistence path -> stale revisions or unresolved anchors remain reviewable conflicts for phone or desktop resolution
- Flow-on effects: mobile can extend the authoring environment without inventing flat phone-only manuscript data, mandatory cloud speech processing, or unsafe synchronization behavior
- Classification note: this is tracked under Feature 04 because microphone/STT orchestration is audio-service-owned, while its accepted output is a new manuscript edit rather than Narration Follow Mode alignment

- Feature: `Feature 5.1/5.2/5.3/5.4 - Voice profiles, render jobs, storage, and editor controls`
- Workflow: Voice profile, binding, render-job, and recording foundation
- Status: `Implemented`
- Code locations: `services/voice/src/index.ts:50-121` (`createInMemoryVoiceService`), `services/voice/src/voice-profile.ts:49-193`, `narration-job.ts:51-214`, `voice-queue.ts:22-83`, `placeholder-renderer.ts:5-7`, and `voice-storage.ts:7-128` (profile/job/queue/render/storage boundaries), `apps/editor/public/app.js:6055-6532` (voice recording preview, job creation, and state normalization), `apps/editor/public/app.js:12165-12207` (`syncVoiceRecordingsMetadata`, `syncVoiceRenderJobsMetadata`), `test/voice-service.test.mjs:14-79` and `test/voice-narration-foundation.test.mjs:25-188` (voice evidence)
- Execution flow: voice profiles and speaker bindings are normalized through service contracts -> editor creates anchored narration jobs from manuscript scene/block references -> queue transitions move jobs through draft, queued, rendering, rendered, failed, and cancelled states -> placeholder rendering and storage keep outputs traceable to manuscript locations
- Flow-on effects: character/narrator voice data is decoupled from provider implementation, render jobs are explicit and inspectable, recording metadata survives scene edits where anchors still resolve, and tests cover voice profiles, bindings, previews, job transitions, placeholder rendering, and local storage
- Extraction/port notes: provider-neutral service code is already under `services/voice`; editor job/recording orchestration should be extracted from `app.js` into a voice/narration feature controller before real TTS or conversion providers are attached

- Feature: `Feature 6.1/6.2/6.3/6.4/6.5 - World model, entities, rendering, links, and suggestions`
- Workflow: Structured world spine, entity, template, and link model
- Status: `Implemented`
- Code locations: `packages/world-schema/src/index.ts:20-153` (`WorldModel`, templates, entities, spines, nodes, edges, links), `packages/world-schema/src/index.ts:227-574` (world construction/link APIs), `services/analysis/src/index.ts:266-313` (`buildWorldSuggestions`), `apps/editor/public/app.js:4949-5088` (`renderWorldPanel`, `renderSpine`, `renderEdge`, `renderEntityPanel`), `test/world-schema.test.mjs:21-173` (world template/entity/timeline/link coverage)
- Execution flow: world data is modeled as typed templates, entities, spines, nodes, edges, and links -> analysis can suggest templates/entities/cross-spine links without mutating canonical data -> editor renders spine lanes, edges, selected node/entity context, templates, entities, and suggestion cards
- Flow-on effects: chronology and worldbuilding remain structured rather than note-only, entity introductions can link to manuscript and timeline anchors, cross-spine causality is represented explicitly, and tests verify template instantiation, timeline nodes, entity introduction links, and edge relationships
- Extraction/port notes: schema ownership is correctly in `packages/world-schema`; editor rendering is still in `app.js` and should move into world-spine/entity feature slices with reviewable suggestion acceptance flows

- Feature: `Feature 7.1/7.2/7.3 - Dream-scaping contracts, suggestions, and panel rendering`
- Workflow: Reviewable dream-scaping story-fit suggestions
- Status: `Implemented`
- Code locations: `packages/shared-types/src/index.ts:134-168` (`DreamScapeFit`, `DreamScapePlacement`, `DreamScapeSuggestion`), `services/analysis/src/index.ts:47-50` (`exploreDreamScape` service entry), `services/analysis/src/index.ts:178-214` (`exploreDreamScape` job wrapper), `services/analysis/src/index.ts:315-424` (`buildDreamScapeSuggestions`, fit, placement, prompt helpers), `apps/editor/public/app.js:5109-5163` (`renderDreamScapingPanel`, `renderDreamSuggestion`), `test/analysis-service.test.mjs:224-233` (dream-scaping suggestion coverage)
- Execution flow: author idea input is represented as a dream-scaping request -> analysis builds a pending, evidence-linked story-fit suggestion -> proposed placement describes whether the idea belongs in manuscript, timeline, or world history -> editor renders the dream-scaping panel and pending suggestions for review
- Flow-on effects: dream-scaping does not silently mutate manuscript or world data, evidence records stay traceable, suggestion review state is explicit, and tests verify the dream-scaping job, fit classification, placement target, and evidence list
- Extraction/port notes: the analysis side is service-owned; the current editor panel is display-only in `app.js` and should become a dedicated feature slice when author input and accept/reject actions are added

- Feature: `Feature 8.1/8.2/8.3/8.4/8.5 - Project import, persistence, cache policy, autosave, and metrics`
- Workflow: Local project-file load/save, autosave, and source import boundary
- Status: `Implemented`
- Code locations: `apps/desktop/src/project-source.ts:17-105` and `apps/desktop/src/http-app.ts:338-363` (host-backed source import route), `apps/editor/public/app.js:8041-8075` (`loadProjectSource`), `apps/editor/public/adapters/storage/project-persistence-service.js:358-411` and `554-1741` (persistence contract and load/save/restore flows), `apps/editor/public/state/project-library-state.js:44-334` (selection defaults, cache/seed merge, active record lookup), `apps/editor/public/state/project-record-state.js:11-246` (durable record normalization/construction), `apps/editor/public/state/project-runtime-record-state.js:11-114` (runtime-to-record save assembly), `apps/editor/public/state/project-activation-state.js:26-132` and `apps/editor/public/state/project-activation-controller.js:3-215` (record hydration and activation effects), `apps/editor/public/app.js:441-477`, `610-637`, and `701-823` (composition wiring), `test/project-source.test.mjs`, `test/project-persistence-service.test.mjs`, `test/project-library-state.test.mjs:10-149`, `test/project-record-state.test.mjs:7-69`, `test/project-runtime-record-state.test.mjs:6-91`, `test/project-activation-state.test.mjs:6-75`, and `test/project-activation-controller.test.mjs:6-121` (persistence/state boundary evidence)
- Execution flow: desktop or browser load action enters `ProjectPersistenceService` -> project-library state normalization replaces stale browser cache and resolves an active durable record -> activation state hydrates runtime project data and activation controller coordinates shell refresh/render effects -> save/autosave assembles a durable record from runtime state and routes it through the persistence service to the active project file or explicit compatibility cache fallback
- Flow-on effects: project JSON is the source of truth for desktop-style workflows, browser cache is disposable and failure-aware, project metrics are derived from loaded records, autosave dirty state is explicit, and tests cover source provenance, imported counts, save/load/restore flows, and cache replacement behavior
- Extraction/port notes: Phase 1 ownership extraction is complete for the current browser host; remaining editor calls must continue routing through `ProjectPersistenceService`, while broader shell/state facade work is scheduled in the refactor roadmap

## Feature Code Index Checklist

Use this compact checklist when testing or porting individual feature IDs. The detailed implementation notes above explain the full flow; this checklist gives the fastest code entry points for each feature.

- Feature 1.1 - Anchored manuscript diagnostics console: `packages/manuscript-schema/src/index.ts:125-157`, `packages/manuscript-schema/src/index.ts:529-701`, `services/analysis/src/index.ts:31-176`, `apps/editor/public/features/manuscript-editor/projection-selector.js:4-225`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:58-118`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:318-350`, `apps/editor/public/features/scene-editor.js:148-273`, `apps/editor/public/app.js:6622-6644`, `apps/editor/public/app.js:4277-4299`, `packages/shared-types/src/index.ts:164-238`, `test/manuscript-projection-selector.test.mjs:80-219`, `test/manuscript-editor-host.test.mjs:19-112`, `test/project-refresh-persistence.test.mjs:292-300`.
- Feature 1.2 - Context-aware scene insertion: `apps/editor/public/app.js:7547-7561`, `apps/editor/public/app.js:11104-11148`, `apps/editor/public/editor-model.js:400-455`, `test/editor-model.test.mjs:203-222`.
- Feature 1.3 - Manuscript spellcheck and project dictionary: `apps/editor/public/spellcheck.js:17-538`, `apps/editor/public/features/spellcheck/grammar-check-panel.js`, `apps/editor/public/features/spellcheck/spellcheck-project-settings.js:1-71`, `apps/editor/public/features/spellcheck/spellcheck-context-menu.js:1-85`, `apps/editor/public/features/spellcheck/spellcheck-context-controller.js`, `apps/editor/public/features/spellcheck/spellcheck-refresh-controller.js`, `apps/editor/public/features/manuscript-editor/projection-selector.js:4-142`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:362-407`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:587-613`, `apps/editor/public/app.js`, `test/spellcheck.test.mjs`, `test/grammar-check-panel.test.mjs`, `test/spellcheck-project-settings.test.mjs`, `test/spellcheck-context-menu.test.mjs`, `test/spellcheck-context-controller.test.mjs`, `test/spellcheck-refresh-controller.test.mjs`, `test/manuscript-editor-host.test.mjs`.
- Feature 1.4 - Manuscript find and replace: `apps/editor/public/features/manuscript-editor/manuscript-find-controller.js:4-289`, `apps/editor/public/features/manuscript-editor/projection-selector.js:4-123`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:194-238`, `apps/editor/public/app.js:3849-4090`, `test/manuscript-find-controller.test.mjs`.
- Feature 1.5 - Anchored task, inspiration, and research notes: `apps/editor/public/features/anchored-records/task-context-menu.js`, `apps/editor/public/features/anchored-records/anchored-record-controller.js`, `apps/editor/public/features/anchored-records/task-panel.js`, `apps/editor/public/features/anchored-records/passage-note-panel.js`, `apps/editor/public/features/anchored-records/delete-confirmation-dialog.js`, `apps/editor/public/features/manuscript-editor/anchored-record-navigation-controller.js:7-114`, `apps/editor/public/features/manuscript-editor/projection-selector.js:4-123`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:151-258`, `apps/editor/public/app.js`, `test/task-context-menu.test.mjs`, `test/anchored-record-controller.test.mjs`, `test/task-panel.test.mjs`, `test/passage-note-panel.test.mjs`, `test/delete-confirmation-dialog.test.mjs`, `test/anchored-record-navigation-controller.test.mjs`.
- Feature 1.x - Editor service-call boundaries: `apps/editor/public/features/local-ai/local-ai-title-service.js`, `apps/editor/public/adapters/storage/project-source-service.js`, `apps/editor/public/features/anchored-records/anchored-record-service.js`, `apps/editor/public/features/narration/narration-media-service.js`, `apps/editor/public/features/narration/narration-metadata-sync-service.js`, `apps/editor/public/features/narration/narration-media-recorder-service.js`, `apps/editor/public/features/narration/narration-recording-command-service.js`, `apps/editor/public/features/narration/narration-recording-finalization-service.js`, `apps/editor/public/features/narration/narration-recording-runtime-service.js`, `apps/editor/public/features/narration/narration-selection-service.js`, `apps/editor/public/features/narration/narration-speech-recognition-service.js`, `apps/editor/public/features/narration/narration-take-service.js`, `apps/editor/public/features/voice/voice-workflow-service.js`, `apps/editor/public/features/voice/voice-recording-action-service.js`, `apps/editor/public/features/voice/voice-recording-preview-service.js`, `apps/editor/public/features/voice/voice-recording-service.js`, `apps/editor/public/state/editor-ui-state.js`, `apps/editor/public/state/project-activation-controller.js`, `apps/editor/public/app.js`, `test/local-ai-title-service.test.mjs`, `test/project-source-service.test.mjs`, `test/anchored-record-service.test.mjs`, `test/narration-media-service.test.mjs`, `test/narration-metadata-sync-service.test.mjs`, `test/narration-media-recorder-service.test.mjs`, `test/narration-recording-command-service.test.mjs`, `test/narration-recording-finalization-service.test.mjs`, `test/narration-recording-runtime-service.test.mjs`, `test/narration-selection-service.test.mjs`, `test/narration-speech-recognition-service.test.mjs`, `test/narration-take-service.test.mjs`, `test/voice-recording-action-service.test.mjs`, `test/voice-recording-service.test.mjs`, `test/voice-workflow-service.test.mjs`, `test/voice-recording-preview-service.test.mjs`, `test/editor-ui-state.test.mjs`.
- Feature 1.6 - Binder scene and chapter management: `apps/editor/public/app.js:11064-11148`, `apps/editor/public/app.js:11290-11310`, `apps/editor/public/app.js:11476-11603`, `apps/editor/public/app.js:12275-12699`, `test/desktop-application.test.mjs:315-402`.
- Feature 1.7 - Scene editor focus, viewport, and line-aware navigation: `apps/editor/public/features/manuscript-editor/manuscript-selection-controller.js:3-215`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:127-326`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:703-740`, `apps/editor/public/app.js:3884-3996`, `apps/editor/public/app.js:7430-7609`, `apps/editor/public/app.js:9192-9419`, `apps/editor/public/app.js:9460-9468`, `apps/editor/public/app.js:9886-9913`, `test/manuscript-selection-controller.test.mjs`, `test/manuscript-editor-host.test.mjs`.
- Feature 1.8 - Writing targets, daily progress, and session tracker: `apps/editor/public/features/progress-tracker.js:6-307`, `apps/editor/public/features/writing-targets/writing-target-window.js:6-120`, `apps/editor/public/features/writing-targets/writing-goals-service.js:8-104`, `apps/editor/public/features/writing-targets/writing-goals-state-service.js:1910-2488`, `test/writing-goals-state-service.test.mjs:6-261`.
- Feature 1.9 - Revision session banking: `apps/editor/public/adapters/storage/revision-storage-service.js:1-241`, `apps/editor/public/features/revisions/revision-service.js:1-465`, `apps/editor/public/features/revisions/revision-window.js:1-405`, `apps/editor/public/app.js:4327-4375`, `apps/editor/public/shell/editor-chrome.js:388-407`.
- Feature 1.10 - Manuscript inline formatting commands: `apps/editor/public/features/manuscript-editor/manuscript-command-controller.js:3-518`, `apps/editor/public/features/manuscript-editor/manuscript-input-controller.js:7-89`, `apps/editor/public/features/manuscript-editor/manuscript-mark-service.js:1-821`, `apps/editor/public/features/manuscript-editor/projection-selector.js:1-359`, `apps/editor/public/features/manuscript-decorations/user-highlight-command-service.js:1-172`, `apps/editor/public/features/manuscript-editor/editor-host-interface.js:7-47`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:50-94`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:333-349`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:517-545`, `apps/editor/public/features/scene-editor.js:172-273`, `apps/editor/public/app.js`, `apps/editor/public/styles.css:2907-2941`, `apps/editor/public/editor-model.js:255-361`, `apps/editor/public/adapters/storage/project-repository.js:57-70`, `apps/editor/public/adapters/storage/project-repository.js:181-190`, `apps/editor/public/adapters/storage/project-migrations.js:120-131`, `packages/manuscript-schema/src/index.ts:21-55`, `packages/manuscript-schema/src/index.ts:178-211`, `packages/manuscript-schema/src/index.ts:745-783`, `packages/manuscript-schema/src/index.ts:890-918`, `test/manuscript-command-controller.test.mjs`, `test/manuscript-input-controller.test.mjs`, `test/manuscript-mark-service.test.mjs`, `test/manuscript-projection-selector.test.mjs`, `test/user-highlight-command-service.test.mjs`, `test/desktop-application.test.mjs`, `test/project-service-storage.test.mjs`, `test/manuscript-schema.test.mjs`.
- Feature 1.11 - Anchor-aware decoration drift pipeline: `Design notes/anchor-decoration-drift-handling-design.md`, `docs/architecture/editor-application-roadmap.md`, `docs/architecture/manuscript-decoration-layer.md`, `packages/manuscript-schema/src/index.ts:21-55`, `packages/manuscript-schema/src/index.ts:178-211`, `packages/manuscript-schema/src/index.ts:745-783`, `packages/manuscript-schema/src/index.ts:890-918`, `apps/editor/public/features/manuscript-editor/manuscript-mark-service.js:1-821`, `apps/editor/public/features/manuscript-decorations/user-highlight-command-service.js:1-172`, `apps/editor/public/adapters/storage/project-migrations.js:120-131`, `apps/editor/public/features/manuscript-anchors/*`, `apps/editor/public/features/anchored-records/*`, `apps/editor/public/features/manuscript-editor/anchored-record-navigation-controller.js:31-124`, `apps/editor/public/features/manuscript-editor/projection-selector.js:1-359`, `apps/editor/public/features/scene-editor.js:172-179`, `apps/editor/public/app.js`, `test/manuscript-anchor-services.test.mjs`, `test/manuscript-mark-service.test.mjs`, `test/manuscript-projection-selector.test.mjs`, `test/user-highlight-command-service.test.mjs`, `test/desktop-application.test.mjs`, `test/project-service-storage.test.mjs`, `test/manuscript-schema.test.mjs`, `test/anchored-record-controller.test.mjs`, `test/anchored-record-navigation-controller.test.mjs`, `test/anchored-record-service.test.mjs`.
- Feature 1.12 - Draft proof-read coverage runs: `apps/editor/public/features/draft-proofing/draft-proofing-service.js:55-477`, `apps/editor/public/features/draft-proofing/draft-proofing-panel.js:1-70`, `apps/editor/public/shell/editor-chrome.js:3-77`, `apps/editor/public/features/progress-tracker.js:6-34`, `apps/editor/public/features/manuscript-editor/projection-selector.js:19-83`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:89-94`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:344-356`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:602-622`, `apps/editor/public/app.js:1547-1553`, `apps/editor/public/app.js:5627-5666`, `apps/editor/public/app.js:6840-7100`, `apps/editor/public/app.js:7155-7178`, `apps/editor/public/app.js:12102-12108`, `apps/editor/public/styles.css:285-386`, `apps/editor/public/styles.css:2963-3024`, `test/draft-proofing-service.test.mjs`, `test/draft-proofing-panel.test.mjs`, `test/manuscript-projection-selector.test.mjs`, `test/manuscript-editor-host.test.mjs`, `test/project-record-state.test.mjs`, `test/project-runtime-record-state.test.mjs`, `test/project-activation-state.test.mjs`, `test/desktop-application.test.mjs`.
- Feature 2.1 - Local AI provider routing: `services/local-ai/local-ai-types.ts:2-59`, `services/local-ai/model-routing-policy.ts:5-26`, `services/local-ai/prompt-builder.ts:5-48`, `services/local-ai/local-ai-router.ts:12-76`, `services/local-ai/providers/llama-cpp-provider.ts:25-145`, `test/local-ai-router.test.mjs:36-66`.
- Feature 2.2 - Local AI editor preference: `apps/editor/public/app.js:2198-2203`, `apps/editor/public/shell/editor-chrome.js:235-236`, `test/desktop-application.test.mjs`.
- Feature 2.3 - Local AI scene-title suggestion: `apps/editor/public/app.js:10309-10349`, `apps/editor/public/features/scene-editor.js:159-273`, `test/local-ai-service.test.mjs:13-115`.
- Feature 2.4 - Anchored writing analysis suggestions: `services/analysis/src/index.ts:31-176`, `packages/manuscript-schema/src/index.ts:125-157`, `test/analysis-service.test.mjs:21-213`.
- Feature 3.1 - Anchored event detection: `services/analysis/src/index.ts:53-176`, `services/analysis/src/index.ts:240-259`, `test/analysis-service.test.mjs:202-213`.
- Feature 3.2 - Event tag persistence model: `packages/manuscript-schema/src/index.ts:12-18`, `packages/manuscript-schema/src/index.ts:149-157`, `packages/manuscript-schema/src/index.ts:662-701`, `test/manuscript-schema.test.mjs:130-132`.
- Feature 3.3 - Event console navigation foundation: `apps/editor/public/app.js:4277-4299`, `packages/manuscript-schema/src/index.ts:529-626`.
- Feature 4.1 - Narration session service: `services/audio/src/index.ts:11-86`, `test/audio-service.test.mjs:13-64`.
- Feature 4.2 - Anchored narration take recording: `apps/editor/public/features/narration/narration-media-service.js:1-93`, `apps/editor/public/features/narration/narration-media-recorder-service.js:1-76`, `apps/editor/public/features/narration/narration-recording-command-service.js:1-200`, `apps/editor/public/features/narration/narration-recording-finalization-service.js:1-101`, `apps/editor/public/features/narration/narration-recording-runtime-service.js:1-86`, `apps/editor/public/features/narration/narration-selection-service.js:1-127`, `apps/editor/public/features/narration/narration-speech-recognition-service.js:1-91`, `apps/editor/public/features/narration/narration-take-service.js:1-255`, `apps/editor/public/features/voice/voice-recording-action-service.js:1-83`, `apps/editor/public/features/voice/voice-recording-service.js:1-85`, `apps/editor/public/app.js:4734-4849`, `apps/editor/public/app.js:4916-5160`, `apps/editor/public/state/project-activation-controller.js:87-91`, `test/narration-media-service.test.mjs`, `test/narration-media-recorder-service.test.mjs`, `test/narration-recording-command-service.test.mjs`, `test/narration-recording-finalization-service.test.mjs`, `test/narration-recording-runtime-service.test.mjs`, `test/narration-selection-service.test.mjs`, `test/narration-speech-recognition-service.test.mjs`, `test/narration-take-service.test.mjs`, `test/voice-recording-action-service.test.mjs`, `test/voice-recording-service.test.mjs`.
- Feature 4.3 - Narration recording tools UI: `apps/editor/public/features/scene-editor.js:159-273`, `apps/editor/public/features/scene-editor.js:387-431`.
- Feature 4.4 - Narration metadata synchronization: `apps/editor/public/app.js:12107-12163`, `services/audio/src/index.ts:11-86`.
- Feature 4.5 - Mobile dictated writing companion (planned): `docs/architecture/mobile-friendly-architecture.md`, `docs/architecture/editor-application-roadmap.md`, `docs/product/feature-map.md`.
- Feature 5.1 - Voice profile and speaker binding model: `services/voice/src/index.ts:50-121`, `services/voice/src/voice-profile.ts:49-193`, `test/voice-service.test.mjs:14-79`.
- Feature 5.2 - Voice render job lifecycle: `services/voice/src/narration-job.ts:51-214`, `services/voice/src/voice-queue.ts:22-83`, `apps/editor/public/app.js:6137-6532`.
- Feature 5.3 - Voice narration storage: `services/voice/src/voice-storage.ts:7-128`, `apps/editor/public/app.js:6256-6532`, `apps/editor/public/app.js:12165-12207`.
- Feature 5.4 - Editor voice narration controls: `apps/editor/public/app.js:6055-6532`, `test/voice-narration-foundation.test.mjs:25-188`.
- Feature 6.1 - Structured world model: `packages/world-schema/src/index.ts:20-153`, `packages/world-schema/src/index.ts:227-574`, `test/world-schema.test.mjs:21-173`.
- Feature 6.2 - Template-driven entity instantiation: `packages/world-schema/src/index.ts:227-574`, `test/world-schema.test.mjs:21-173`.
- Feature 6.3 - Timeline spine rendering: `apps/editor/public/app.js:4949-5088`.
- Feature 6.4 - Cross-spine causality links: `packages/world-schema/src/index.ts:20-153`, `packages/world-schema/src/index.ts:227-574`, `apps/editor/public/app.js:4949-5088`.
- Feature 6.5 - Reviewable world suggestions: `services/analysis/src/index.ts:266-313`, `apps/editor/public/app.js:5007-5088`.
- Feature 7.1 - Dream-scaping request and result contracts: `packages/shared-types/src/index.ts:134-168`, `services/analysis/src/index.ts:47-50`.
- Feature 7.2 - Reviewable story-fit suggestion generation: `services/analysis/src/index.ts:178-214`, `services/analysis/src/index.ts:315-424`, `test/analysis-service.test.mjs:224-233`.
- Feature 7.3 - Dream Scaping panel rendering: `apps/editor/public/app.js:5109-5163`.
- Feature 8.1 - Source project file import: `apps/desktop/src/project-source.ts:17-105`, `apps/desktop/src/http-app.ts:338-363`, `apps/editor/public/app.js:8041-8075`, `test/project-source.test.mjs:14-132`.
- Feature 8.2 - Project persistence service boundary: `apps/editor/public/adapters/storage/project-persistence-service.js:358-1741`, `apps/editor/public/state/project-record-state.js:11-246`, `apps/editor/public/state/project-runtime-record-state.js:11-114`, `apps/editor/public/app.js:610-637`, `test/project-persistence-service.test.mjs`, `test/project-record-state.test.mjs`, `test/project-runtime-record-state.test.mjs`.
- Feature 8.3 - Disposable browser cache policy: `apps/editor/public/state/project-library-state.js:44-334`, `apps/editor/public/adapters/storage/project-persistence-service.js:1019-1179`, `test/project-library-state.test.mjs`, `test/project-refresh-persistence.test.mjs`.
- Feature 8.4 - Autosave and activation control: `apps/editor/public/adapters/storage/autosave.js`, `apps/editor/public/adapters/storage/project-persistence-service.js`, `apps/editor/public/shared/project-autosave-status.js`, `apps/editor/public/shell/editor-chrome.js`, `apps/editor/public/features/writing-targets/writing-goals-service.js`, `apps/editor/public/state/project-activation-state.js`, `apps/editor/public/state/project-activation-controller.js`, `test/project-file-storage-adapters.test.mjs`, `test/project-persistence-service.test.mjs`, `test/project-activation-state.test.mjs`, `test/project-activation-controller.test.mjs`.
- Feature 8.5 - Project metrics and record derivation: `apps/editor/public/adapters/storage/project-index.js`, `apps/editor/public/state/project-record-state.js:11-246`, `test/project-record-state.test.mjs`, `test/project-service-storage.test.mjs`.
