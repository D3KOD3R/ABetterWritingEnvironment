# Proof-Read Active Run Interaction, Visual Continuity, and Coverage Overlap Design

Status: proposed follow-up to the Proof-Read Run History and Safe Reversal implementation at `734caa555987981ed58477626ff93d4ed2db3fc1`.

This document defines intended behaviour and implementation boundaries only. It does not implement the feature changes.

## Purpose

The current proof-read workflow successfully turns manuscript selection into durable proof-read coverage and now records proof-read run history, but testing the implementation has exposed several interaction and visual-continuity issues.

This follow-up should make active proof-reading feel like normal manuscript editing with an additional review layer, rather than a separate editor mode that takes ownership of selection, viewport position, or familiar editing behaviour.

The author should be able to:

- select text during an active proof-read and still copy that text normally;
- begin a new proof-read without losing their position in the manuscript;
- visually distinguish every proof-read run by colour;
- keep the highlight intensity they have already chosen as comfortable for the current theme;
- see where earlier proof-read runs have already covered the manuscript while working in a new run;
- understand overlap between runs through a deterministic mixed colour;
- turn previous-run coverage on or off without changing or deleting any proof-read data.

The current manuscript remains authoritative. Proof-read coverage remains metadata/projection state and must never interfere with normal text ownership.

---

## Current implementation findings

### Selection is deliberately collapsed after a proof-read coverage gesture

The active proof-read gesture currently reads the textarea selection, records coverage, and then collapses the textarea selection to the end of the covered range. This was introduced to prevent the previously selected passage from becoming the browser's next native text-drag source.

That solves a drag ambiguity, but it also changes normal editor semantics: after proof-read highlighting, the selected text is no longer selected, so the author cannot immediately use normal selection-dependent operations such as Copy.

The better boundary is:

> Proof-read coverage may observe a manuscript selection, but it must not own or clear the manuscript selection.

The browser-drag ambiguity should be handled as a proof-read gesture-routing concern rather than by destroying the user's selection.

### New runs currently inherit project defaults rather than the previous run

`startNewDraftProofRun(...)` currently creates a new run from the normalized project-level proof-read settings. Per-run visual edits are intentionally stored on the run without updating future project defaults.

This means an author can tune the previous run to a comfortable intensity, create a new run, and receive a different/default visual configuration. That is not the desired workflow.

### Current project intensity defaults are opposite to the requested visual baseline

The current defaults are:

```text
Light: 42%
Dark: 100%
```

The desired first-project/first-run defaults are:

```text
Light / Day: 100%
Dark:        25%
```

Once the author changes intensity, subsequent runs should inherit the previous run's two saved theme values rather than returning to these initial defaults.

### Proof-read UI actions can cause a full manuscript render

Opening/closing Proof Read settings and several proof-read run/settings mutations can cause the manuscript panel to be rendered again. Replacing the textarea/editor DOM can disturb manuscript viewport position, textarea scroll, focus, caret, and selection.

Proof-read chrome interaction should not itself be manuscript navigation.

### Coverage projection already has a multi-run concept, but the active workflow does not expose it

The proof-read coverage service can derive coverage from completed runs when requested. The normal manuscript projection path currently resolves the ordinary proof-read coverage without an author-facing active-run preference for showing prior runs.

This makes the requested behaviour an extension of the existing projection architecture rather than a new persistence system.

### The textarea proof-read renderer currently resolves one active proof-read projection per rendered segment

When multiple proof-read run ranges overlap, the renderer currently resolves one applicable proof-read projection for that text segment. To display a mathematically mixed run colour, the renderer must instead consider all distinct contributing proof-read runs for the segment.

---

# Non-negotiable interaction invariants

The implementation should preserve these rules.

1. **Normal text selection remains normal.** An active proof-read run does not disable Copy, keyboard selection, context-menu Copy, or ordinary selection persistence.
2. **Coverage is derived from selection, not substituted for selection.** Committing coverage must not collapse the user's selected range.
3. **Proof-read UI is non-navigational by default.** Starting, pausing, finishing, configuring, opening, closing, or toggling proof-read display settings must not move the manuscript workarea.
4. **Explicit navigation remains explicit.** Actions such as `Go to change` and an intentional `Continue at resume point` may navigate because navigation is their purpose.
5. **Every automatically created run receives a colour not already assigned to another run in the project.**
6. **New runs inherit visual intensity from the immediately preceding run.** Initial defaults only apply when there is no previous run from which to inherit.
7. **Previous-run coverage is visible during an active run by default, but the author can turn it off.**
8. **Overlapping coverage is a visual composition state, not a proof-read history conflict.**
9. **All overlap colour calculation is deterministic and order-independent.**
10. **Coverage display never mutates durable coverage merely because display settings change.**

---

# 1. Preserve manuscript selection and Copy during Proof Read

## Desired behaviour

Example:

```text
Author begins Proofread 3
Author drags across a sentence
→ Proofread 3 coverage is recorded for that range
→ proof-read colour appears behind the sentence
→ the native manuscript selection remains selected

Author presses Ctrl+C / Cmd+C
→ selected manuscript text is copied normally

Author clicks elsewhere
→ selection behaves exactly as normal manuscript selection behaves
```

The user should not need a special proof-read Copy command.

## Proposed change

Remove the post-coverage selection-collapse behaviour.

Do not call `setSelectionRange(end, end)` merely because proof-read coverage was committed.

Instead, protect the next proof-read gesture from the native selected-text drag behaviour at the interaction boundary.

### Gesture-routing policy

When an active proof-read run exists in the manuscript textarea:

- a completed selection gesture may create/update proof-read coverage;
- the selection remains intact afterward;
- `Ctrl/Cmd+C` and context-menu Copy operate normally;
- starting a fresh pointer selection inside an already-selected range must be treated as a new proof-read selection gesture rather than allowing the browser to interpret the existing selected text as a draggable payload;
- native text drag/move should be suppressed only for the ambiguous proof-read pointer gesture, not globally for all selection behaviour.

A small proof-read interaction controller is preferable to keeping this policy spread across general manuscript handlers.

Conceptually:

```text
pointer down in manuscript while proof-read active
    ↓
resolve whether this begins proof-read selection
    ↓
if yes, establish a fresh selection gesture
and prevent native selected-text drag ownership
    ↓
selection changes normally
    ↓
pointer up / selection commit
    ↓
record coverage
    ↓
leave selection untouched
```

This preserves the normal editing contract and solves the original drag problem at its source.

## Keyboard behaviour

The proof-read feature should not intercept:

- `Ctrl+C` / `Cmd+C`;
- `Ctrl+X` / `Cmd+X` unless ordinary editor policy already does;
- Shift+Arrow selection;
- Ctrl/Cmd+Shift+Arrow selection;
- Home/End selection;
- context-menu Copy.

Any text edit made while a proof-read run is active continues to flow through the existing manuscript edit transaction and proof-read change-history path.

---

# 2. New-run colour allocation and intensity inheritance

## Initial project defaults

For a project with no prior proof-read run/settings history, use:

```text
highlightIntensityByTheme.light = 100
highlightIntensityByTheme.dark  = 25
```

These are starting defaults, not values that should be forcibly reapplied to every run.

## Intensity inheritance

When creating Proofread N where a previous run exists:

```text
newRun.settings.highlightIntensityByTheme =
    clone(previousRun.settings.highlightIntensityByTheme)
```

Both theme values should be inherited, regardless of which theme is currently active.

Example:

```text
Proofread 2
Light = 82%
Dark  = 31%

Create Proofread 3
→ Light = 82%
→ Dark  = 31%
```

This means the author can change themes later without discovering that the new run inherited only the theme that happened to be active at creation time.

If no previous run exists, use the project defaults of Light 100% / Dark 25%.

## Unique automatic run colours

A newly created proof-read run must automatically receive a backdrop colour not already assigned to any prior run in the project.

The allocator should consider **all runs**, not only the most recent run.

### Proposed allocation order

1. Collect normalized backdrop colours from all existing runs.
2. Walk the project's configured proof-read preset colours in stable order and choose the first unused colour.
3. Then consider appropriate recent/custom palette colours that are unused, if they represent deliberate project palette choices.
4. If all available palette colours have been used, generate a deterministic new colour using hue rotation rather than repeating an existing colour.
5. Reject an automatically generated candidate if its normalized hex value is already used; continue until a unique candidate is found.

A golden-angle hue sequence or equivalent deterministic hue spacing is suitable once the finite preset palette is exhausted. Exact algorithm is an implementation detail, but it should aim for perceptual separation rather than generating trivially different near-duplicates.

### Automatic uniqueness versus manual editing

Automatic run creation must guarantee uniqueness.

A later manual colour edit should remain possible. The first implementation does not need to prohibit the author from intentionally making two runs the same colour, although the UI may warn that the colour is already used. Historical run identity must always remain based on run ID, never colour alone.

## Recommended service boundary

Add one proof-read-owned helper such as:

```text
deriveNextDraftProofRunSettings(state)
```

or equivalent, responsible for:

- locating the immediately preceding run;
- inheriting intensity values;
- allocating an unused run colour;
- preserving the project's preset/recent palette configuration;
- falling back to the first-run defaults when required.

`startNewDraftProofRun(...)` should consume the result rather than embedding colour-allocation policy in UI code.

---

# 3. Proof-read panel/settings interaction must preserve manuscript position

## Desired behaviour

The author may be halfway down a long scene with a selection/caret at a particular sentence.

These actions must leave the manuscript visually and interactively where it was:

- open Proof Read settings;
- close Proof Read settings;
- toggle previous-run coverage;
- toggle all proof-read marks;
- change backdrop colour;
- change highlight intensity;
- start a new proof-read run;
- pause a run;
- resume a paused run without an explicit resume-navigation request;
- finish a run;
- select visual settings for the current run.

The manuscript should not jump to the top, recenter, change scene, lose textarea scroll, or silently move the caret.

## Preferred implementation: do not re-render the manuscript

Most proof-read UI operations alter either:

- proof-read data;
- proof-read chrome/settings markup; or
- proof-read projection appearance.

They should therefore update only what changed:

```text
proof-read state mutation
    ↓
render/update Proof Read chrome if required
render/update Proof Read settings if required
sync proof-read projection layer for active editor
    ↓
leave manuscript editor DOM intact
```

A visual proof-read setting should not call a full `renderManuscriptPanel()` merely to repaint a coverage layer.

## Fallback when a full editor render is genuinely required

If a structural operation cannot avoid a full manuscript render, preserve and restore a manuscript interaction snapshot around it.

Minimum snapshot:

```text
sceneId
manuscript workarea scroll position
textarea scrollTop
textarea scrollLeft
selectionStart
selectionEnd
selectionDirection
whether textarea owned focus
```

Restoration should occur after layout synchronization without smooth scrolling.

The preferred design remains avoiding the destructive render entirely. Snapshot restoration is a safety net, not the primary mechanism.

## Explicit navigation exception

The following may intentionally move the manuscript:

- `Go to change` from proof-read history;
- an explicit history comparison navigation action;
- an explicit `Continue at last proof-read position` command if the product exposes that semantics.

Those commands should be named/structured as navigation so the movement is not surprising.

---

# 4. Show previous proof-read runs while an active run is in progress

## New setting

Add a project-level proof-read visual preference:

```text
showPreviousRunCoverage: true
```

Default: **on**.

This preference belongs to the proof-read workflow/display settings, not to an individual historical run, because it controls how the active proof-reading workspace is composed.

## Behaviour

When there is an active Proofread N:

### Setting ON

Display:

- coverage from the active run using its own run colour;
- coverage from all earlier runs using each earlier run's saved colour;
- mathematically mixed colour where two or more run coverages overlap.

### Setting OFF

Display:

- active run coverage only.

Do not delete, alter, merge, or otherwise mutate earlier coverage records.

### Master proof-read eye

The existing proof-read mark visibility control remains the master switch.

Conceptually:

```text
Master marks OFF
→ no ordinary proof-read coverage displayed

Master marks ON + Previous runs OFF
→ active/current run only

Master marks ON + Previous runs ON
→ active/current run + earlier run coverage + overlap mixing
```

Historical review mode in Project Settings remains a separate feature with its own review/change/unsafe-conflict semantics.

## UI location

Because this preference is useful repeatedly during active proofreading, expose it close to the active Proof Read panel rather than burying it exclusively inside Project Settings.

Recommended compact control:

```text
Previous runs  [on/off]
```

It may also be mirrored in Proof Read settings if useful, but there should be one persisted source of truth.

When no active run exists, the control may be disabled or omitted to reduce ambiguity.

---

# 5. Mathematical colour mixing for overlapping proof-read coverage

## Terminology

Use **coverage overlap** or **mixed coverage** internally and in implementation documentation.

Do **not** use `conflict` for this state.

The history/safe-reversal feature already uses `conflict` to mean:

> a historical undo/redo operation is unsafe because current manuscript text no longer matches the expected historical text.

Coverage overlap is not unsafe and is not an error. It simply means the same passage was proof-read in multiple runs.

## Arithmetic RGB averaging

For every rendered text segment, collect the distinct proof-read run coverage projections that contain that segment.

If exactly one run contributes, render its saved colour normally.

If N distinct runs contribute, convert each run colour from hex to RGB and calculate:

```text
Rmix = round((R1 + R2 + ... + RN) / N)
Gmix = round((G1 + G2 + ... + GN) / N)
Bmix = round((B1 + B2 + ... + BN) / N)
```

Then convert `(Rmix, Gmix, Bmix)` back to the rendered colour.

The formula is:

- deterministic;
- commutative/order-independent;
- naturally extensible from two runs to three or more runs.

### Important visual consequence

Arithmetic RGB averaging is not painterly/subtractive colour mixing.

For example, mathematically averaging pure blue `#0000FF` and pure yellow `#FFFF00` produces approximately:

```text
#808080
```

which is grey, not green.

That is the correct result under the requested channel-average rule. If future UX testing decides that authors expect physical-paint mixing instead, that would be a different colour model and should be specified separately rather than silently changing the mathematics.

## Intensity on overlap

Colour and intensity should remain separate concepts.

For overlapping runs, calculate the base RGB mix from the run colours, then resolve the display intensity for the active theme.

Recommended rule when participating runs have different saved intensities:

```text
Imix = round((I1 + I2 + ... + IN) / N)
```

and render the mixed colour at `Imix`.

In the normal new-run workflow, consecutive runs will usually have equal intensities because the newest run inherits the preceding run's values. The averaging rule keeps legacy/manually adjusted runs deterministic.

Do not average already-composited screen pixels against the page background. Mixing the durable colour values first keeps the result independent of light/dark page background colour and rendering order.

## Dedupe by run identity

A run may contain adjacent/overlapping internal coverage spans that normalize into the same rendered segment.

Colour mixing should count a run once per segment, keyed by durable run ID. It should not make a colour heavier merely because one run contributes multiple internal span records to the same piece of text.

## Projection/rendering boundary

The durable proof-read model continues to store each run's own colour and coverage independently.

Do not persist a mixed colour onto either run.

Mixed colours are derived render state:

```text
Run 1 coverage + Run 2 coverage
        ↓
projection composition
        ↓
derived mixed segment colour
        ↓
textarea proof-read underlay
```

This means changing a run's colour can immediately recalculate all affected overlap visuals without rewriting coverage data.

---

# 6. Projection model changes

The existing coverage service should continue to own range normalization and run coverage lookup.

Extend the manuscript projection request so the caller can express active-workflow visibility explicitly, for example:

```text
includeDraftProofing: true
includePreviousDraftProofRuns: true | false
activeDraftProofRunId: ...
```

Exact names may differ, but the selector should not infer this from DOM state.

When the active-run previous-coverage preference is enabled, ordinary draft-proof projections should include the active run and all prior runs relevant to the current scene.

Each projection must retain enough source metadata to identify at least:

```text
runId
run colour
run theme intensity
range
```

The renderer can then group all projections active over each segment and derive the visual mix.

Historical review projections (`review`, `changed-later`, `conflict`) remain semantically separate from ordinary coverage composition and should continue to take an explicit review treatment rather than being accidentally folded into the coverage colour average.

---

# 7. Persistence and migration

## Existing runs

Do not rewrite existing run colours or intensities merely because the defaults change.

Existing saved per-run settings remain authoritative.

## Existing projects with no explicit new preference

When normalizing an older project that does not contain `showPreviousRunCoverage`, resolve it to `true`.

## First new run after upgrade

If an older project already has at least one run:

- inherit intensity from the latest preceding run;
- allocate a new colour not used by any existing run;
- leave all earlier runs unchanged.

If there are no existing runs:

- use Light 100%;
- use Dark 25%;
- allocate the first run colour from the normal project palette.

## Schema handling

If adding the previous-run display preference changes the persisted proof-read settings shape, update/normalize the proof-read schema in the existing backwards-compatible normalization path. Missing fields should migrate by default rather than requiring destructive project conversion.

---

# 8. Proposed active-run user flow

Example:

```text
Proofread 1
Colour: blue
Light intensity: 100%
Dark intensity: 25%
Coverage exists across several passages

Author finishes Proofread 1.

Author remains halfway through the current manuscript scene.
Author starts Proofread 2.

System:
- does not move manuscript viewport/caret/selection;
- assigns Proofread 2 an unused colour, for example yellow;
- copies Proofread 1's Light/Dark intensity settings;
- keeps Previous runs = ON;
- displays Proofread 1's blue coverage;
- records new Proofread 2 selection coverage as yellow.

Author proof-reads a passage already covered in Proofread 1.

System:
- retains both durable run coverage records;
- renders the overlap using arithmetic RGB averaging of blue + yellow;
- does not label the overlap an undo/redo conflict.

Author selects a sentence during Proofread 2.

System:
- records the Proofread 2 coverage;
- leaves the sentence selected;
- Ctrl+C copies it normally.

Author turns Previous runs OFF.

System:
- leaves Proofread 1 data untouched;
- removes earlier-run projections from the active view;
- shows Proofread 2 coverage only;
- does not move the manuscript.
```

---

# 9. Acceptance criteria

## Selection and copying

- Creating proof-read coverage from a selection leaves `selectionStart` and `selectionEnd` unchanged after the coverage commit.
- `Ctrl+C` / `Cmd+C` immediately after a proof-read selection copies the same selected manuscript text.
- Context-menu Copy remains available.
- A new proof-read selection gesture can begin inside an existing selection without the browser turning that selection into an unintended drag payload.
- Normal selection semantics return immediately when no active proof-read run exists.

## New-run settings

- First-run default intensity is 100% in Light mode and 25% in Dark mode.
- If the previous run is Light 73% / Dark 29%, the next run starts at Light 73% / Dark 29%.
- A newly auto-created run never receives a backdrop colour already assigned to another run in the same project.
- Once the preset palette is exhausted, automatic allocation still returns a unique deterministic colour.

## Workarea preservation

For every non-navigational proof-read panel/settings action, tests verify preservation of:

- active scene;
- manuscript workarea scroll position;
- textarea internal scroll position;
- selection range/caret;
- focus where appropriate.

Opening and closing Proof Read settings must not itself call navigation.

## Previous-run display

- `showPreviousRunCoverage` defaults to true for new and legacy projects when absent.
- Active proof-read + preference ON displays current and previous coverage.
- Active proof-read + preference OFF displays current run coverage only.
- Master proof-read marks OFF suppresses ordinary coverage regardless of the previous-run preference.
- Toggling the preference changes only display/projections and does not mutate stored coverage.

## Overlap mixing

- One contributing run renders its own saved colour.
- Two contributing runs render the channel arithmetic mean.
- Three or more runs render the arithmetic mean across all distinct contributing run IDs.
- Projection ordering does not change the mixed result.
- Duplicate spans from the same run do not weight that run twice.
- Theme intensity is averaged across participating run intensities when they differ.
- Ordinary coverage overlap never receives the historical unsafe-reversal `conflict` semantic.

---

# 10. Test plan

Extend the existing proof-read/manuscript suites rather than creating a separate integration mechanism.

Primary suites:

```text
test/draft-proofing-service.test.mjs
  - initial intensity defaults
  - next-run intensity inheritance
  - unique colour allocation
  - palette exhaustion
  - preference normalization/migration

 test/draft-proofing-panel.test.mjs
  - Previous runs control model/markup
  - default-on state
  - disabled/hidden behaviour without an active run

 test/draft-proofing-settings-window.test.mjs
  - mirrored setting if exposed there
  - run visual settings remain stable

 test/manuscript-projection-selector.test.mjs
  - active-only coverage
  - active + earlier-run coverage
  - separation from history review projections

 test/manuscript-editor-host.test.mjs
  - multi-projection segment collection
  - two-run RGB average
  - N-run average
  - intensity average
  - run-ID deduplication
  - order independence

 test/manuscript-selection-controller.test.mjs
 test/manuscript-input-controller.test.mjs
  - preserve selection after proof-read coverage
  - start a fresh gesture from an already-selected passage
  - normal copy/selection behaviour remains available
```

Add an interaction-level regression test around the app/controller boundary for manuscript position preservation if the current DOM test harness can represent scroll/focus state. At minimum, code paths that only change proof-read projection/display state should be testable without invoking a full manuscript panel render.

---

# 11. Suggested implementation sequence

Implement in small, reviewable stages.

### Stage A — Selection ownership

- remove post-coverage selection collapse;
- introduce proof-read-specific selected-text drag/gesture guard;
- add selection/copy regression tests.

### Stage B — Run settings policy

- change first-project intensity defaults to Light 100 / Dark 25;
- add next-run settings derivation;
- inherit previous run intensities;
- implement unique automatic colour allocation;
- add service tests.

### Stage C — Non-destructive proof-read UI updates

- remove unnecessary manuscript full renders from proof-read chrome/settings actions;
- update projection layer directly;
- use editor bookmark/viewport restoration only where a full render is unavoidable;
- add position-preservation regression coverage.

### Stage D — Previous-run visibility

- add/persist `showPreviousRunCoverage`, default true;
- expose compact active-run control;
- extend projection selection to include earlier run coverage when enabled.

### Stage E — Coverage overlap rendering

- collect all distinct active coverage projections per rendered segment;
- arithmetic-average RGB colours;
- average theme intensities where necessary;
- keep history review/conflict rendering separate;
- add deterministic renderer tests.

This order deliberately fixes interaction ownership before adding more visual layers, then adds run policy, then multi-run display and mixing.

---

# 12. Out of scope for this follow-up

The following are not required by this proposal:

- changing safe historical undo/redo semantics;
- force-overwriting an unsafe historical conflict;
- merging durable proof-read runs into one run;
- deleting overlap from either run;
- permanently baking mixed colours into project data;
- replacing the existing proof-read history review UI;
- changing ordinary manuscript author highlight colours;
- implementing painterly/subtractive colour mixing.

---

# Design summary

The central architecture rule is:

> Proof Read should add durable review metadata and derived visual context without taking ownership of the manuscript editor's selection, viewport, or navigation.

The active run owns its own colour and coverage. Earlier runs keep theirs. New runs inherit the author's visual intensity preference while receiving a new unused colour. When earlier-run display is enabled, projection composition derives overlap colours mathematically at render time. None of those visual operations should require moving or replacing the author's manuscript workspace.