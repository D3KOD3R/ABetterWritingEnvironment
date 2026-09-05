# Persistence Cross-Feature Regression Checklist

Status: Active manual verification contract
Date: 2026-09-05
Branch: `wip/persistence-project-transition-isolation`
Related authority: `docs/implementation/active/desktop-project-package-lifecycle.md`
Canonical feature definitions: `features.md`

## Execution contract

### Goal

Prove that the persistence/package refactor has not broken existing author-facing workflows. Work through every currently implemented numbered workflow in `features.md`, record reproduced failures for focused follow-up, and keep this checklist active until the application has completed a manual cross-feature regression pass.

This checklist does **not** duplicate the lettered acceptance definitions from `features.md`. A workflow may be marked `Working` only when every currently implemented lettered check under that workflow has either been exercised successfully or explicitly recorded as not applicable to the current build.

### Initial bounded reads

For a regression item, read only:

1. `AGENTS.md`;
2. this checklist;
3. the matching numbered workflow and lettered checks in `features.md`;
4. `docs/implementation/active/desktop-project-package-lifecycle.md` when the failure crosses New/Open/Save/Save As/package authority;
5. the narrow owning agent file and implementation-index entry required for the feature being debugged.

Do not broadly read unrelated features, archived implementation specs, real project snapshots, logs, or generated artifacts unless the focused failure requires them.

### Required outcome

For every implemented workflow below:

```text
exercise author interaction
-> confirm immediate UI/state result
-> Save
-> refresh and verify
-> close/reopen the package and verify
-> Save As to a second package when the workflow owns durable project data/assets
-> reopen the second package and verify
-> confirm another project does not inherit the state
-> mark Working, Broken, Fixed, or Rechecked
```

Asset-owning workflows must additionally prove that Package B remains usable after Package A is unavailable and that no project-owned file was created under the repository/worktree or another cwd/default-root fallback.

### Status vocabulary

- `Unchecked` — not manually exercised against the current persistence branch.
- `Working` — current author workflow and required persistence/reload checks pass.
- `Broken` — reproducible regression exists; add a concise symptom and debugging reference.
- `Fix in progress` — a focused repair is being worked.
- `Fixed - needs recheck` — code/tests changed, but the author-facing regression has not yet been manually reconfirmed.
- `Rechecked` — a previously broken workflow was manually reconfirmed after the fix.
- `Planned / not in regression scope` — `features.md` explicitly describes the workflow as planned rather than an implemented product surface.

When the user confirms `Feature working`, follow `agents/FeatureWorkAgent.md` and update the canonical feature tracker/implementation index as required; this checklist should then record the regression status as `Working` or `Rechecked`.

### Explicit non-goals

- Do not redesign a feature merely because this checklist exposes a bug.
- Do not mark a workflow working from unit tests alone.
- Do not treat render-only/session state as project data just to make a reload assertion pass.
- Do not test roadmap-only surfaces as if they were implemented product behavior.
- Do not use the real Serva Vitae package as disposable regression output; use a copy or dedicated test package.
- Do not create generated test/media/log artifacts in the repository worktree.

## Current sweep baseline

Branch: `feature/persistence-portability-harness`.

Tested code baseline (`CODE_BASELINE_SHA`): `d9f74e627446280af020b33e919f5715d8a7735b`. This commit contains the accepted Scrivener history and integrated untitled-scene, single-scene deletion and binder drag/drop fixes, including test registration. The separate documentation-only commit recording this baseline is not the tested code SHA. The user manually accepted the Scrivener workflow; Feature `8.6` remains Rechecked.

- Automated verification: focused editor-model, untitled-scene, binder, single-scene deletion, registration and persistence/package checks pass. Full repository supervisor **132/134 passed, 2 failed**; separate `npm test` **132/134 passed, 2 failed**. All four newly integrated regression tests execute in both full runs. Supervisor verification was repeated on the committed code baseline.
- Known unrelated failures: `desktop-application` and `project-source`, each with a fixture containing 4 chapters while the test expects 5 (`4 !== 5`).
- Every manual result must record the tested branch and SHA.
- Distinguish **Fresh** packages created on the tested build from **Legacy/pre-fix** packages; record cohorts separately.
- Cold-start the intended desktop worktree/build before GUI testing, rather than relying on an already running host process.

## Regression priority

`P0` means a failure can cause data loss, cross-project contamination, package relocation failure, or break a core authoring workflow. `P1` means important author-facing behavior or project preference regression. `P2` means lower-risk optional/local-runtime behavior.

Known manual failures at the start of this sweep:

| Feature | Priority | Status | Known symptom |
| --- | --- | --- | --- |
| `1.6b` Scene drag/drop reorder | P0 | **Fixed - needs recheck** | Movable draft/portable scene drop targets are integrated and automated coverage passes; manual GUI recheck is pending. |
| `8.6` Scrivener project import | P0 | **Rechecked** | Historical regression: source selection/conversion worked, but activation lacked folder-package authority, reported `No package selected`, could download `.abe-project.json` and block New Project. Rechecked: transactional package creation and activation after verification work; immediate Save/autosave, scene metadata/comments and source-path portability are fixed; repeated same-source imports have independent ABE IDs. |
| `8.2e` Recent-project activation | P0 | **Broken** | After using a Scrivener-backed package and creating a correct blank package, selecting an older normal project from Recent Projects appears to use the wrong physical path and displays the Scrivener-backed manuscript/folder structure. General activation/path regression; root cause undetermined. |
| `8.2d` Package dialog workflow | P0 | Needs recheck | Recent manual testing found weak/incorrect dialog presentation and path/browse interaction; later persistence commits changed this area, so recheck before closing it. |

## Recommended manual execution order

Run the next sweep by potential impact while retaining the canonical feature matrix order below:

1. `8.2` Project package lifecycle / recent-project activation
2. `8.3` Disposable browser cache policy
3. `8.4` Autosave and dirty-state control
4. `8.5` Project metrics
5. `1.6` Binder scene/chapter management
6. `1.2` Context-aware scene insertion
7. `1.5` Tasks/notes/custom metadata
8. `6.3` World Spine
9. `1.10` Inline formatting
10. `1.9` Revisions
11. Narration / project-owned assets
12. Remaining P1/P2 workflows

Normally record a discovered regression and continue testing unrelated features. Repair before continuing when the defect risks data loss or invalidates later test results; every bug need not be repaired immediately.

## Astra/code-audit support

Automated/static code review may identify potential regressions, map findings to checklist feature IDs, suggest focused tests and flag persistence invariants.

It may not mark an Unchecked manual feature Working, replace GUI/manual acceptance, or trigger broad refactors without a reproduced or strongly evidenced defect.

Prioritize data loss, project identity/path ownership, cross-project contamination, cache ownership, Save/Save As authority, autosave concurrency, portable DTO leakage and project-owned asset paths.

## Mandatory persistence pass pattern

Use this pattern for every durable feature unless the row below narrows it:

1. Start from a known package A outside the repository.
2. Make a small, unmistakable mutation for the feature under test.
3. Confirm the immediate rendered state.
4. Save and confirm autosave/dirty state becomes clean only after a durable write.
5. Refresh the application and reconfirm.
6. Close/reopen package A and reconfirm.
7. Save As package B where the feature owns semantic data or project assets.
8. Reopen B and reconfirm. For assets, make A unavailable and verify B again.
9. Open an unrelated package C and confirm A/B state does not leak into it.
10. Record the result in this document before moving to an unrelated regression.

For render-only or machine-local workflows, explicitly verify that their transient/runtime state is **not** serialized into the external package.

# Feature regression matrix

## Feature 01 - Manuscript / editor workflows

### 1.1 Anchored manuscript diagnostics console — P1 — `Unchecked`

Coverage: all currently implemented `1.1a-1.1d` checks in `features.md`.

Manual focus: create/use an anchored diagnostic; confirm the row is actionable; navigate to the correct manuscript span; edit around the anchor; refresh/reopen; verify an invalid/stale anchor does not paint an unrelated passage.

### 1.2 Context-aware scene insertion — P0 — `Unchecked`

Coverage: `1.2a-1.2c`.

Manual focus: activate scene X through click/focus/typing, create New Scene, confirm insertion at X+1 in the same chapter and immediate selection, then Save/refresh/reopen and verify exact order.

Automated integration: generated scene titles advance deterministically within the chapter (`Untitled Scene 1`, `Untitled Scene 2`, ...); sequencing and first-persistence fallback tests pass. Ordinary authored/imported placeholder-like titles and scene IDs are covered. Manual acceptance remains pending; this workflow stays Unchecked.

### 1.3 Manuscript spellcheck, grammar panel, project dictionary, dictionary lookup — P1 — `Unchecked`

Coverage: `1.3a-1.3k`.

Manual focus: flagged-word popup, exact replacement, project dictionary/exception persistence, batch grammar approval, underline visibility/toggle, alternate suggestions, row dictionary action, drag/resize grammar panel persistence, right-click and `Ctrl+T` dictionary lookup. Open another project and confirm project dictionary words do not leak; confirm transient dictionary lookup state is not saved.

### 1.4 Manuscript find and replace — P1 — `Unchecked`

Coverage: `1.4a-1.4d`.

Manual focus: selected-text preload, next/previous navigation, Replace Current, Replace All across structured scenes, caret/scroll behavior, Save/reopen, and canonical text/word-count consistency.

### 1.5 Anchored tasks, inspiration, research, custom metadata, folders and infographic lane — P0 — `Unchecked`

Coverage: `1.5a-1.5k`.

Manual focus: create task/inspiration/research/custom metadata from selected text; navigate both directions; edit before the anchor and test drift recovery; hide/restore console tabs without deleting records; create custom metadata definitions and image icons; create nested metadata folders and project-only notes; drag a loose anchored note into a folder; verify infographic markers and visibility preference; Save/reopen/Save As. For folder packages, confirm metadata files remain inside the active package. Scrivener comment/footnote coverage is also gated by `8.6`.

### 1.6 Binder scene and chapter management — P0 — `Fixed - needs recheck`

Coverage: `1.6a-1.6e`.

Manual focus: edit chapter/scene titles; drag scenes upward/downward and between positions; delete a scene and verify linked task/note/narration/voice/selection cleanup; trim whitespace; use next-scene footer navigation. Save/reload must preserve structure and linked-record integrity.

Regression note: `1.6b` movable scene drop targets and single-scene deletion preserving sibling drafts are integrated with passing automated regressions. Both fixes need manual recheck; do not mark the parent workflow Working or Rechecked from automated results alone.

### 1.7 Scene editor focus, viewport and line-aware navigation — P1 — `Unchecked`

Coverage: `1.7a-1.7i`.

Manual focus: selection/caret/scroll restoration, issue/task/note navigation, gutter/textarea/overlay alignment, whitespace-origin selection, side-panel width profiles across window sizes, cross-page side-panel focus toggle, centered text measure with infographic lane, default rail widths, and chapter-context rail rendering.

### 1.8 Writing targets, daily progress and session tracker — P0 — `Unchecked`

Coverage: `1.8a-1.8g`.

Manual focus: target/release date behavior, daily target projection, active/idle/split/resumed sessions, calendar/streak/day-note/history views, per-day archive, page-scoped top-card visibility, milestone sounds. Save/reopen must preserve semantic goal/history data without confusing today's words, total manuscript words, or session baselines.

### 1.9 Revision session banking — P0 — `Unchecked`

Coverage: `1.9a-1.9f`.

Manual focus: create a revision session/baseline, generate events, stage/inspect a diff, bank the session, open the revisions window, Save/reopen and Save As. Confirm project-owned `revisions/` data travels with the package and the benched local-draft revert control remains benched.

### 1.10 Manuscript inline formatting commands — P0 — `Unchecked`

Coverage: all currently implemented checks `1.10a-1.10i` and `1.10k-1.10p`; `1.10j` remains the planned ProseMirror migration note and is not a current parity test.

Manual focus: selected/caret Bold, Italic, Underline, Strikethrough, Highlight, pending typed formatting, stacked paint, Clear Decorations, custom recent colours, app-owned undo/redo, viewport preservation, and typing over selected text. Save/reopen/Save As must keep marks attached to the intended text.

### 1.11 Anchor-aware decoration drift pipeline — P0 — `Unchecked`

Coverage: `1.11a-1.11g`.

Manual focus: create anchored issue/task/note/event/narration/mark records; insert/delete/replace text before, inside and across anchors; Save/reopen; verify deterministic shift/recovery/stale behavior and confirm render-only projections never appear as durable decoration records.

### 1.12 Draft proof-read coverage runs and editor shortcuts — P0 — `Unchecked`

Coverage: `1.12a-1.12y`.

Manual focus: new run, drag-add coverage, Shift-drag removal, edit-driven coverage shift, pause/resume/finish/continue, resume navigation, visibility across refresh, per-iteration colours/intensity/recent swatches, selective delete/clear-all, light/dark rendering, click-away behavior, and configurable shortcuts. Save/reopen must preserve run/version/settings data while transient selection/window state remains transient.

### 1.13 Editor appearance theme — P1 — `Unchecked`

Coverage: `1.13a-1.13l`.

Manual focus: Light/Dark/System switching and persistence; inspect manuscript, binder, Metadata Console, Grammar Check, Writing Goals, World, Narration, selected states and inline-format layering. Theme changes must not mutate semantic project data.

### 1.14 Shared form dismissal behavior — P1 — `Unchecked`

Coverage: `1.14a-1.14d`.

Manual focus: top-right dismiss controls across task/note, custom metadata, scene World Spine metadata, Dream Scaping catalogue/event forms and implication composer; confirm fields remain interactive and Save/Create still reads live values before dismissal.

## Feature 02 - Local Writing Assistant

### 2.1 Local AI provider routing — P1 — `Unchecked`

Coverage: `2.1a-2.1c`. Confirm tier/provider descriptors and non-destructive unavailable-provider behavior; runtime provider state must not become portable project data.

### 2.2 Local AI editor preference — P1 — `Unchecked`

Coverage: `2.2a-2.2c`. Toggle Local AI, Save/reopen, verify expected project/editor preference behavior and no manuscript mutation from merely changing the setting.

### 2.3 Local AI scene-title suggestion — P1 — `Unchecked`

Coverage: `2.3a-2.3c`. Request a title, accept it, Save/reopen and verify the title follows the normal scene-draft persistence path.

### 2.4 Anchored writing analysis suggestions — P1 — `Unchecked`

Coverage: `2.4a-2.4c`. Generate reviewable issue/event suggestions, navigate their anchors, and confirm suggestion generation itself does not silently mutate manuscript structure.

### 2.5 Local AI model library/settings panel — P1 — `Unchecked`

Coverage: `2.5a-2.5c`. Check model scan/create-folder/UI validation, then Save As a project and verify model root/provider machine configuration is not serialized into the portable package.

## Feature 03 - Event Pinning

### 3.1 Anchored event detection — P1 — `Unchecked`

Coverage: `3.1a-3.1c`. Confirm detected suggestions contain evidence/anchor data and remain advisory until accepted.

### 3.2 Event tag persistence model — P0 — `Unchecked`

Coverage: `3.2a-3.2d`. Create/manual-pin an event from manuscript text, Save/reopen/Save As, verify metadata and canonical anchor survive and remain reusable in World Spine.

### 3.3 Event console navigation foundation — P1 — `Unchecked`

Coverage: `3.3a-3.3c`. Confirm event rows render and navigate by durable anchors rather than screen coordinates.

## Feature 04 - Narration Follow Mode

### 4.1 Narration session / live follow — P0 — `Unchecked`

Coverage: implemented `4.1a-4.1y`.

Manual focus: microphone/provider lifecycle, live matching, repeated-text recovery, bounded follow-scroll, current versus cumulative coverage, first-line behavior, recovery guards and long-take responsiveness. Refresh/reopen must **not** resurrect in-flight recorder/ASR/provider sessions or runtime follow selections.

### 4.2 Anchored narration take recording — P0 — `Unchecked`

Coverage: `4.2a-4.2k`.

Manual focus: arm exact line/selection, record/stop/finalize, anchor choice, saved range offsets, cleanup transcript separation, non-destructive re-recording. Save/reopen/Save As; make package A unavailable and prove take audio from package B still loads.

### 4.3 Narration recording tools UI / saved-take review — P0 — `Unchecked`

Coverage: `4.3a-4.3y`.

Manual focus: Audio tab state, Play/Stop/Delete, saved coverage overlays, review strip, seek/word click, waveform, pause/resume, durable transcript alignment, stale-span recovery, finalization wait-before-save, read-only Narration manuscript surface, and independent Manuscript/Narration decoration switches. Runtime waveform/playhead state must not be serialized.

### 4.4 Narration metadata synchronization — P0 — `Unchecked`

Coverage: `4.4a-4.4c`. Move/edit/delete manuscript structure around narration records and verify valid references reconcile while broken/stale references are isolated rather than silently redirected.

### 4.5 Mobile dictated writing companion — `Planned / not in regression scope`

Do not treat the planned architecture `4.5a-4.5e` as a current desktop regression surface.

## Feature 05 - Character Voice Narration

### 5.1 Voice profile and speaker binding model — P0 — `Unchecked`

Coverage: `5.1a-5.1c`. Save/reopen/Save As durable project-specific profiles/bindings while keeping provider implementation details behind runtime/service boundaries.

### 5.2 Voice render job lifecycle — P1 — `Unchecked`

Coverage: `5.2a-5.2c`. Verify job state transitions/inspection where surfaced, and confirm in-flight provider/job machinery is not incorrectly resurrected from a portable package.

### 5.3 Voice narration storage — P0 — `Unchecked`

Coverage: `5.3a-5.3c`. Verify durable voice narration metadata/output pointers survive Save/reopen/Save As and remain project-relative/portable.

### 5.4 Editor voice narration controls — P1 — `Unchecked`

Coverage: `5.4a-5.4c`. Inspect bindings/actions and saved recording preview/open paths after project reload.

### 5.5 Audiobook recording model foundation — P1 — `Unchecked foundation`

Coverage: `5.5a-5.5e`. This is a model foundation rather than a fully wired production UI. Verify only currently surfaced/migrated model behavior; do not claim the deferred performance-preserving conversion roadmap is implemented.

## Feature 06 - World Spine View

### 6.1 Structured world model — P0 — `Unchecked`

Coverage: `6.1a-6.1c`. Create/modify representative templates/entities/spines/nodes/edges/links; Save/reopen/Save As and verify stable IDs and manuscript/timeline references.

### 6.2 Template-driven entity instantiation — P0 — `Unchecked`

Coverage: `6.2a-6.2c`. Create an entity from a template, edit typed fields, Save/reopen/Save As and verify ancestry/ID/field values.

### 6.3 Timeline spine rendering and interaction — P0 — `Unchecked`

Coverage: every currently implemented lettered check under `6.3` in `features.md`, including `6.3a-6.3y` and `6.3aa-6.3af`.

Manual focus must include: scene metadata forms; side-panel profiles/focus mode; manuscript infographic earth markers; Dream Scaping catalogue/studio interactions; event-draft placement; scene-block drag reorder; scene beats; chapter anchor; Ctrl-wheel zoom and Shift-wheel tier scroll; location rows; catalogue assignment; Passages/Section/Cards modes; custom categories; location filtering; row naming; inserted-event manuscript scene shells; row images; child locations; Unplaced events dock; active World-pane persistence.

High-risk persistence sequence: move several events between named rows quickly, rename/delete rows, trigger overlapping saves, Save/refresh, then verify **all row placements and all manuscript scene bodies** survive. Also drag a primary World Spine scene before/after another and confirm Manuscript binder order matches after reload. This shares the scene-order path and still requires manual recheck after the automated `1.6b` fix.

### 6.4 Cross-spine causality links — P0 — `Unchecked`

Coverage: `6.4a-6.4j`. Create/edit/delete implication links, navigate endpoints, exercise World Spine undo/redo, Save/reopen/Save As and verify edge IDs/endpoints/effects survive without corrupting nodes or manuscript order.

### 6.5 Reviewable world suggestions — P1 — `Unchecked`

Coverage: `6.5a-6.5c`. Suggestions remain advisory/evidence-linked; canonical world state changes only after explicit acceptance.

### Worldbuilding / World Spine image package ownership — P0 — `Unchecked`

Cross-feature storage check tied to current World Spine catalogue/location-row imagery: attach an image, Save/reopen, Save As to B, make A unavailable, reopen B and verify the image. Confirm no image is written under cwd, repository `project-media`, a default library root, or an invented sibling derived from a legacy `.json` path.

## Feature 07 - Dream Scaping

### 7.1 Dream-scaping request/result contracts — P1 — `Unchecked`

Coverage: `7.1a-7.1c`. Verify request/result/status structure for currently reachable flows.

### 7.2 Reviewable story-fit suggestion generation — P1 — `Unchecked`

Coverage: `7.2a-7.2c`. Confirm evidence/placement reasoning and no automatic manuscript/world mutation during generation.

### 7.3 Dream Scaping panel / hosted World Spine studio — P1 — `Unchecked`

Coverage: `7.3a-7.3e`. Confirm suggestion cards/labels/evidence plus durable World Spine studio catalogue/event mutations. Milestone sound remains runtime feedback; durable data belongs to `workspace.world`.

## Feature 08 - Project Save File Loader / package persistence

### 8.1 Source project file import — P0 — `Unchecked`

Coverage: `8.1a-8.1d`. Load supported source/legacy project input, verify provenance, hierarchy and project metrics, and keep the source untouched. Scrivener-specific acceptance is gated by `8.6`.

### 8.2 Project persistence service boundary / package lifecycle — P0 — `Broken` because `8.2e` fails

Coverage: `8.2a-8.2i`.

Manual focus: New/Open/Save/Save As, read-only active location, recent-project activation, semantic readback verification, transactional authority adoption, portable DTO exclusions, safe runtime service-shell reconstruction, cancellation/failure behavior and package path selection. Test package dialog typing, Enter, parent/child navigation, Browse/native directory picker, Escape/Cancel, invalid destinations and light/dark presentation.

Required authority sequence: Project A active -> attempt/fail Save As B -> A must remain authoritative -> normal Save must still target A. Successful Save As B -> B becomes authoritative only after verified commit. New/Open transitions must refuse unsafe dirty/cache-only replacement where required.

Regression 2026-09-05 — `8.2e` Recent Projects

- Status: Broken — P0
- Test build: user-reported current implementation, `wip/persistence-project-transition-isolation` / `72527bfec2b7d7f731270407178c986279f77a73`; cold-start and record the actual build for the next reproduction.
- Package cohort: Fresh blank package plus older normal package (Legacy/pre-fix; originating build not recorded).
- Automated coverage: existing `test/project-persistence-service.test.mjs` and `test/project-library-state.test.mjs` cover related boundaries; no automated reproduction of this observed GUI failure is established.
- Reproduction: import/open a Scrivener-backed ABE package; create another normal blank ABE package (fresh New Project itself appears correct); later choose an older normal project from Recent Projects.
- Expected: clicked recent-project row -> exact intended project record -> exact intended project ID -> exact recorded package root -> exact corresponding rendered manuscript. No other package's path, content or cache may be substituted.
- Actual: the selected row appears associated with the wrong physical package path, and the GUI displays manuscript/folder structure belonging to the Scrivener-backed package.
- Suspected boundary: recent-project activation / projectFilePath authority / project-library identity / possibly browser cache. Exact root cause is not known.
- Debug reference: user-observed general persistence regression; cross-project scenario D below. Investigation is deferred.
- Recheck: cold-start the intended build; repeat the steps and scenario D, verifying row identity, recorded destination and rendered manuscript at every switch and after restart.

This is not currently classified as a Scrivener conversion failure. Feature `8.3` remains a separate Unchecked cache-isolation test; this observation alone does not establish cache participation.

### 8.3 Disposable browser cache policy — P0 — `Unchecked`

Coverage: `8.3a-8.3f`.

Manual focus: open A, edit/save; open B; refresh; return to A. No scene body, task, note, metadata, World state or project path from another project may bleed through browser cache. Explicit package authority must beat stale cached/bundled seed state.

### 8.4 Autosave and dirty-state control — P0 — `Unchecked`

Coverage: `8.4a-8.4g`.

Manual focus: normal autosave, failed/blocked write, out-of-sync cause display, no retry loop, metadata-only scene mutation without body collapse, atomic generation/manifest swap, edits arriving while a save is in flight, and transition drain. Dirty state must clear only after durable verified success.

### 8.5 Project metrics derivation — P0 — `Unchecked`

Coverage: `8.5a-8.5c`. Record chapter/scene/manuscript words/task/note/world/timeline counts before Save and compare after refresh/Open/Save As. Lazy/chunked hydration must not collapse totals merely because only an active body is loaded.

### 8.6 Scrivener project import — P0 — **`Rechecked`**

Coverage: `8.6a-8.6j` plus cross-feature `1.5k`.

Repeatable manual coverage for future sweeps: choose **Import Scrivener Project...** and select a real `.scriv`; confirm source selection/conversion does not replace the currently active project yet; confirm the existing project-package form opens with the imported title, editable project/folder name, read-only Scrivener source, and the same Location/Browse controls used by New Project; choose a destination and press **Import Project**; require the normal staged New Project package writer to create/verify/publish a folder-backed package before activation; confirm Project location immediately shows that package root and no legacy `.abe-project.json` download is used on the supported desktop path.

Then verify binder order/chapter grouping and manuscript text; custom metadata and scene metadata; Research/WorldBuilding catalogue entities; comments/footnotes and resolvable anchors; RTF paragraph/Unicode/dash fidelity; compatible editor font preference; source provenance; and that the original `.scriv` remains untouched. Save, refresh, close/reopen, Save As to package B, reopen B, and open unrelated package C to verify isolation. Finally create another New Project and confirm the imported project does not leave the no-durable-destination/autosave block behind.

Regression 2026-09-04
- Status: Fix in progress
- Reproduction: import a known Scrivener project on desktop; after conversion inspect File -> Project location, then attempt New Project.
- Expected: import is a project-creation workflow. The converted candidate remains transient until a named folder package is staged, verified and published; only that published package becomes active authority.
- Actual: source conversion now succeeds, but the legacy route activates the imported snapshot first and falls through to single-file/download Save As, leaving `No package selected`; subsequent New Project can be refused because the active imported project has dirty/blocked cache-only state with no durable destination.
- Suspected boundary: project lifecycle / package authority / activation ordering.
- Debug reference: `fix/persistence-scrivener-import-package-lifecycle`; `test/scrivener-import-package-lifecycle.test.mjs`.
- Recheck: import -> choose project name/folder/location -> publish -> Project location populated -> Save -> refresh -> reopen -> Save As B -> reopen B -> New Project succeeds -> unrelated C has no imported state.

Recheck result 2026-09-05

- Status: Rechecked — user manual acceptance of the current Scrivener import workflow.
- Test build: `wip/persistence-project-transition-isolation` / `72527bfec2b7d7f731270407178c986279f77a73`.
- Package cohort: Fresh imports accepted; Legacy/pre-fix packages must remain a separately recorded cohort in the next sweep.
- Result: transactional folder-package creation works and activation follows strict semantic verification. Immediate Save/autosave works; scene Scrivener metadata, comments/footnotes and their provenance survive. Absolute import-report source paths are removed at the portable boundary while relative provenance remains. Metadata-note semantic titles retain their full value independently of filename limits. Repeated same-source imports receive independent ABE project IDs and package ownership.
- Automated coverage: passing `test/scrivener-import-service.test.mjs`, `test/scrivener-import-package-lifecycle.test.mjs`, `test/scrivener-import-metadata-runtime-hydration.test.mjs`, `test/scrivener-import-portability.test.mjs`, `test/project-snapshot-scrivener-metadata-regression.test.mjs`, `test/metadata-note-package-roundtrip.test.mjs` and focused package/persistence tests; full baseline 128/130 with the two unrelated fixture-count failures.
- Debug reference: `docs/implementation/archive/scrivener-import-package-lifecycle.md`.
- Recheck: accepted by the user. Future sweeps should repeat import/Save/autosave/reopen and duplicate-source isolation, recording build and package cohort. The general Recent Projects failure remains separately open under `8.2e`.

The transition guard itself is not the regression: it correctly refuses to abandon dirty/cache-only work. The repair must prevent a new Scrivener import from becoming that cache-only active project in the first place. A project created by the older broken import path should be salvaged with Save As before switching projects rather than weakening the guard.

Disk-level lazy scene loading is a separate persistence task. Scrivener conversion necessarily reads the source once; after publication, the imported project must use the same chunked package/runtime behavior as a natively created project. Do not combine a desktop package lazy-loader rewrite into this repair.

## Feature 09 - External Music Integration

### 9.1 Spotify music playback / local-machine persistence boundary — P2 — `Unchecked`

Coverage: `9.1a-9.1k` when Spotify is configured and available.

Manual focus: chrome/player/popover, login continuity, search/playlists, track/playlist playback, queue behavior, seek/transport and refresh resume. Persistence boundary check is mandatory even if full online playback is not: Spotify credentials/tokens/device IDs/queue history/resume hints must not appear in external project snapshots or transfer merely because a project is Save As/copied.

# Cross-feature destructive/regression scenarios

These scenarios are required in addition to the workflow rows because they exercise failures that isolated feature tests can miss.

## A. Structure + anchored metadata

1. Create a task, research note, custom metadata note, manual event tag and narration take on different scenes.
2. Drag/reorder scenes, create a context-aware scene, rename scenes/chapters and delete one unrelated scene.
3. Edit text before several anchors.
4. Save/refresh/reopen.
5. Verify order, titles, surviving anchors, deleted-scene cleanup and narration references.

## B. World Spine + manuscript body preservation

1. Assign three scene-backed events to different location rows.
2. Rename a row and move another event while autosave is active.
3. Reorder a primary World Spine scene block.
4. Save immediately and refresh.
5. Verify every row assignment, binder order and full manuscript body for every affected scene.

## C. Package relocation

1. Package A contains manuscript formatting, tasks/notes/folders, World Spine nodes/edges, writing goals/revisions, one world image and one narration take.
2. Save As B.
3. Verify B semantically and inspect owned file trees.
4. Make A unavailable.
5. Reopen B.
6. Verify semantic state plus audio/image assets.
7. Search the worktree for new runtime project/media/log artifacts and require none.

## D. Cross-project isolation

1. Open A and change dictionary, panel preference, writing goals and World location filter.
2. Save A.
3. Open unrelated B.
4. Confirm A's semantic data and project-scoped preferences do not leak into B.
5. Confirm machine-local settings that are intentionally global/local (for example Local AI model root or Spotify account state) remain outside external package snapshots.

Recent Projects scenario for `8.2e`:

1. Create/open packages A and B at visibly different package roots and Save both.
2. Switch A -> B -> A through Recent Projects.
3. At every switch verify title, project ID where observable/logged, Project location, scene/chapter structure and package root against the clicked row's intended record and recorded destination.
4. Restart the app on the intended build and repeat one switch, checking the same values.
5. No row may activate another row's package destination.

## E. Transition/concurrency

1. Start a save for A.
2. Make another semantic mutation while the write is in flight.
3. Request Open/New/Save As.
4. Require drain/flush-through behavior before authority changes.
5. After B activates, edit B.
6. Completion of any stale A write must not clear B dirty state, alter B destination, or overwrite B data.

# Result recording

When a regression is found, replace only the affected workflow status and append a short note directly beneath it using this shape:

```text
Regression YYYY-MM-DD
- Status: Broken | Fix in progress | Fixed - needs recheck | Rechecked
- Test build: branch + SHA
- Package cohort: Fresh | Legacy/pre-fix
- Automated coverage: existing/new test reference or none
- Reproduction: shortest deterministic author steps
- Expected: product behavior from features.md
- Actual: observed failure
- Suspected boundary: UI | state | persistence | package asset | activation | cache | runtime
- Debug reference: commit/issue/test/log source if one exists
- Recheck: exact manual steps required after repair
```

Do not rewrite historical regression notes after a fix; append the recheck result so the failure and repair remain traceable.

# Completion gate

This regression sweep is complete only when:

- every implemented workflow above is `Working` or `Rechecked`;
- `1.6b` scene drag/drop is repaired and manually rechecked;
- `8.2e` recent-project activation/path regression is repaired and manually rechecked; it is an explicit unresolved P0 completion blocker;
- `8.6` Scrivener import remains Rechecked at the accepted baseline; it is no longer an unresolved blocker;
- package-dialog interaction is rechecked after the recent lifecycle changes;
- every P0 durable workflow survives Save, refresh, package reopen and relevant Save As;
- package B asset-owning workflows work with package A unavailable;
- cross-project isolation is manually demonstrated;
- transition/concurrency behavior is manually demonstrated;
- no machine/runtime-only state is found in the portable external DTO;
- no project/media/log artifacts are created in the repository worktree;
- automated focused/supervisor verification is green for each repair before its manual recheck;
- the active persistence lifecycle contract's completion gates are also satisfied.

Keep this checklist active until the manual sweep is complete. Archive it only after the persistence/package work has passed the full cross-feature regression pass and the known failures have been repaired and rechecked.
