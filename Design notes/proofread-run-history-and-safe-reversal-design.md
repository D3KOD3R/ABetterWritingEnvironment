# Proof-Read Run History, Review, and Safe Reversal Design

Status: draft for review. This document defines intended behaviour and architecture only; it is not an implementation record.

Planned feature classification: Feature 1.15, following the existing Feature 1.12 proof-read coverage/highlighter workflow and Feature 1.14 shared form-dismissal workflow.

## Purpose

Evolve Proof Read from coverage-only run tracking into an intentional manuscript review history without turning the manuscript editor into a permanently annotated version-control surface.

The author should be able to answer:

- When did I perform this proof-read?
- What did I change during it?
- Where did those changes occur?
- How much text changed?
- Was this passage changed again in a later proof-read?
- Can I safely undo or redo an older proof-read change without overwriting newer manuscript work?

The current manuscript remains authoritative at all times.

## Non-Negotiable UX Rule: Historical Review Is Opt-In

Historical proof-read change, lineage, and conflict visuals must never appear during normal manuscript editing merely because the project contains old proof-read runs.

The normal Manuscript page remains distraction-free unless the author deliberately opens Proof Read settings and selects a proof-read run for historical review.

Historical review projections exist only while all of the following are true:

```text
Proof Read settings is open
AND
one durable proof-read run is selected for review
AND
the Manuscript page is active
```

Closing Proof Read settings, leaving the Manuscript page, clearing the selected historical run, or changing project must immediately clear all proof-read history-review and conflict projections.

This state is transient UI state. It is never persisted as a manuscript decoration or as a preference that silently reappears on next launch.

The existing Feature 1.12 proof-read coverage eye remains a separate control. Historical review does not change saved coverage or the author's ordinary proof-read mark visibility preference.

## Rolling Historical View

The selected proof-read run acts as the historical viewpoint.

As the author moves between Proofread 1, Proofread 2, Proofread 3, and later runs in Project Settings, the manuscript may temporarily show:

1. changes made during the selected run;
2. passages from that selected run that were modified again by later proof-read runs;
3. unsafe current-text conflicts relevant to an attempted undo or redo.

Example:

```text
Proofread 2
"The ocean was completely still."
→
"The ocean lay completely still."

Proofread 4
"The ocean lay completely still."
→
"The ocean lay glass-smooth beneath them."
```

When reviewing Proofread 4 there is no later Proofread 4 → future-run relationship to display.

When reviewing Proofread 2, the affected passage may carry a temporary `changed later` treatment identifying Proofread 4.

When Proof Read settings is closed, both historical treatments disappear.

## Later Modification Is Not Automatically a Conflict

The product must distinguish two concepts.

### Changed later

A later proof-read modified the logical manuscript region that an earlier proof-read changed.

This is provenance and history. It is not automatically an error.

### Undo/redo conflict

A requested historical reversal cannot be safely applied because the current manuscript no longer contains the expected text state at the resolved location.

This is an operation-safety result.

For example, if undoing Proofread 2 expects:

```text
The ocean lay completely still.
```

but the current manuscript contains:

```text
The ocean lay glass-smooth beneath them.
```

Better Novel must not replace the newer sentence with Proofread 2's older text. The undo is blocked as a conflict and the later proof-read provenance is shown where available.

The manuscript is never silently rolled backwards over later work.

## Proof-Read Run Model

Preserve the existing durable run identity, iteration number, status, timestamps, resume point, coverage, and per-run visual settings.

Extend new proof-read runs with durable change-history capability.

Conceptual run shape:

```text
ProofreadRun
  id
  iterationNumber
  status
  startedAt
  updatedAt
  completedAt
  resumePoint
  coverageByScene
  settings

  changeHistoryAvailable
  changes[]
  changeSummary
```

Legacy runs created before change-history support must remain readable. They must display:

> Detailed change history was not recorded for this proofread.

Do not report `0 changes` for legacy runs because the application does not know that to be true.

## Durable Proof-Read Change Ledger

The existing manuscript edit-transaction service remains the runtime source for exact text-edit deltas. It must not become a persistence owner.

While a proof-read run is active, the proof-read feature consumes eligible manuscript edit transactions and persists proof-read-owned logical change records.

Conceptual change record:

```text
ProofreadChange
  changeId
  runId
  iterationNumber
  sequence

  sceneId
  createdAt
  updatedAt

  beforeText
  afterText

  originalStartOffset
  originalEndOffset

  anchor
  beforeHash
  afterHash

  changeType
    insertion
    deletion
    replacement

  wordsAdded
  wordsRemoved
  wordsChanged
  netWordDelta

  state
    applied
    reverted
    conflict

  revertedAt
  reappliedAt

  lineage[]
```

The anchor must use the existing manuscript anchor/drift principles: current offsets are useful, but a durable change cannot depend only on a three-month-old numeric offset. Bounded context/hash evidence should support current-position validation and recovery.

## Logical Change Coalescing

Do not expose every keystroke as a separate proof-read history row.

Runtime edit transactions may remain granular, but the proof-read ledger and Project Settings UI should represent meaningful logical editing bursts.

The coalescer may combine adjacent or overlapping transactions when they:

- belong to the same active proof-read run;
- occur in the same scene;
- affect the same local editing region; and
- belong to one continuous author editing burst.

A logical change should flush when the author clearly moves to a different edit context, including scene change, non-adjacent caret movement, proof-read pause/finish, history replay, or another boundary chosen by the implementation.

The exact short idle/debounce duration is an implementation detail and should be selected through tests rather than made part of the author-facing product contract.

Undo/redo safety operates on the resulting logical before/after patch, not individual keypresses.

## Change Statistics

Each run should expose at least:

- logical change count;
- words added;
- words removed;
- words changed;
- net word delta;
- applied change count;
- reverted change count;
- changed-later count;
- current conflict count when a safety preflight is performed.

Recommended `wordsChanged` semantics:

- insertion: inserted word count;
- deletion: deleted word count;
- replacement: the greater of before-word count and after-word count.

This avoids double-counting both sides of a replacement while preserving separate added/removed totals.

Historical totals describe what occurred during the run even when changes are later reverted. Applied/reverted state describes the current status separately.

## Proof-Read Lineage

When a later proof-read edit overlaps or replaces the logical region affected by an earlier proof-read change, record durable provenance between those changes.

Conceptual lineage edge:

```text
ProofreadChangeRelationship
  earlierChangeId
  laterChangeId
  earlierRunId
  laterRunId
  relation
    overlaps
    replaces
    extends
    removes
  createdAt
```

The design must support chains, not only one later run:

```text
Proofread 2
  ↓ changed by
Proofread 4
  ↓ changed by
Proofread 5
  ↓ changed by
Proofread 8
```

A historical review hover can then show the chronological lineage while the current manuscript remains the endpoint and source of truth.

## Manuscript Changes Outside Proof Read

A later manuscript edit may occur while no proof-read run is active.

That edit does not need to become a permanent proof-read lineage edge, but it must still protect the current manuscript from unsafe historical reversal.

If an old undo expects text that no longer exists and no later proof-read provenance explains it, show a neutral safety result such as:

> Manuscript changed after this proofread.

Do not falsely attribute the change to another proof-read run.

## Project Settings → Proof Read

Project Settings becomes the primary review surface for durable proof-read history.

The existing visual settings remain available, but run history is no longer hidden behind only an iteration selector and destructive Version Data controls.

### Current run summary

Example:

```text
Proofread 6 — Active
Started 26 Aug 2026
18 / 27 scenes reviewed
23 changes · 51 words changed

[Continue]
```

### History list

Show runs newest first with:

- iteration label;
- started/completed date;
- status;
- coverage summary;
- logical change count;
- words changed;
- changed-later count when history is available.

Long histories may group by month/year.

### Selected run details

Selecting a run shows:

- iteration/status;
- started, last activity, and completed timestamps;
- scenes reviewed;
- changes;
- words changed/added/removed/net;
- applied/reverted counts;
- changed-later count;
- current conflict/preflight information when relevant;
- change list grouped by chapter/scene where practical.

Filters:

```text
All | Applied | Reverted | Changed later | Conflicts
```

## Selecting a Run Activates Temporary Review Mode

While Proof Read settings remains open, selecting a durable run sets transient `reviewRunId` state.

There is no requirement for a second persistent `show conflicts` preference.

The selected run drives the rolling manuscript view:

```text
Normal Manuscript
  → no proof-read history projections

Proof Read settings opens with Proofread 5 selected
  → transient Proofread 5 review projections

User selects Proofread 3
  → discard Proofread 5 review projections
  → derive Proofread 3 review projections
  → derive only later-run lineage relevant to Proofread 3

Proof Read settings closes
  → clear reviewRunId
  → remove all history/lineage/conflict projections
```

The review mode must not survive browser refresh or project activation as ambient manuscript UI.

## Review and Conflict Projections

Keep durable proof-read history separate from render-only manuscript projections.

Recommended semantic projection channels or equivalent typed variants:

```text
draft-proof
  existing Feature 1.12 coverage

draft-proof-review
  selected historical run's change locations

draft-proof-later-change
  portions of selected historical changes modified by later proof-read runs

draft-proof-conflict
  currently unsafe reversal target when a preflight has established a conflict
```

Exact channel naming may be adjusted during implementation if the projection system is better served by one review channel plus semantic `styleToken`s, but the persistence boundary must remain the same:

- proof-read ledger = durable data;
- review/conflict projection = disposable derived UI.

## Visual Treatment

Do not hard-code a particular conflict colour into the product contract because proof-read runs already have saved colours and Light/Dark display behaviour.

Define semantic visual states instead:

- selected-run change;
- changed later;
- unsafe conflict.

The stylesheet should provide accessible theme-aware treatments with enough distinction that an author can understand the historical relationship without making the manuscript look permanently marked up.

These treatments exist only in the opt-in settings review session.

## Hover and Hit Testing

The current proof-read underlay is a render-only textarea overlay. Do not turn the durable proof-read model into DOM ownership merely to support hover.

Use a small proof-read history/review controller or equivalent feature-owned policy that:

1. resolves the pointer to a manuscript offset or rendered review projection;
2. identifies the proof-read change and selected run;
3. resolves later lineage for that change;
4. builds transient hover-card data;
5. leaves manuscript persistence unchanged.

The existing spellcheck layer hit-testing pattern is a useful precedent: rendered overlay rectangles may assist pointer resolution without becoming the data source of truth.

### Hover content

For a passage changed again later, show concise provenance such as:

```text
Changed again in Proofread 4
26 Aug 2026

Proofread 2
before → after

Proofread 4
after → later text

[Go to Proofread 4 change]
```

If multiple later proofreads form a lineage chain, show them chronologically.

## Go To Change

Selecting a change from Project Settings or a hover card should:

1. resolve its current scene/location through the anchor/navigation boundary;
2. open/select that scene;
3. center the current location;
4. keep Proof Read settings review state active;
5. temporarily emphasize the selected change and relevant later-change relationship.

Navigation must not rely exclusively on original offsets.

Scene deletion or major restructuring must not silently delete proof-read history. If location cannot be safely resolved, retain the historical record and mark it unresolved for navigation/reversal purposes.

## Individual Undo Preflight

Historical undo is not the editor's ordinary Ctrl+Z stack.

Before mutating the manuscript, the proof-read history service must resolve the target and verify that current manuscript text matches the historical change's expected `afterText` state.

Safe case:

```text
Expected current text == actual current text
```

Undo may apply:

```text
afterText → beforeText
```

Conflict case:

```text
Expected current text != actual current text
```

Do not overwrite the current manuscript.

Show the later proof-read lineage when available. Otherwise show that the manuscript changed after the selected proof-read.

There is no force-overwrite action in the first implementation.

## Individual Redo Preflight

Redo follows the same rule in the opposite direction.

A reverted change may reapply only when the resolved current text matches the expected `beforeText` state:

```text
beforeText → afterText
```

If current text differs, block the operation and surface the conflict rather than forcing old text into the manuscript.

## Run-Level Undo and Redo

Project Settings may offer run-level actions after individual reversal works safely.

Before run-level undo, perform a complete dry-run preflight and report:

```text
61 changes in Proofread 2
52 safe to undo
6 changed by later proofreads
2 changed outside recorded proofreads
1 unresolved location
```

The author may choose to apply only the safe subset.

Run-level undo processes eligible changes in reverse sequence order.

Run-level redo processes eligible reverted changes in forward sequence order.

Conflicting/unresolved changes remain untouched and are reported after the operation.

Do not offer `Force overwrite all` in the initial feature.

## History Replay Must Not Recursively Record Itself

Historical undo/redo should flow through the normal manuscript mutation/persistence path so word counts, autosave, anchors, and rendering remain correct.

However, the mutation must carry an internal origin such as:

```text
origin: proofread-history-replay
sourceRunId
sourceChangeId
```

Proof-read change capture must suppress this origin so reversing a historical record does not create a new duplicate proof-read change in an active run.

Coverage is not erased when a change is reverted. Coverage means the author reviewed the passage; the change ledger describes what was edited during that review.

## Storage and Migration

For the first implementation, keep proof-read history within the existing project-local durable proof-read state so the `.abe-project.json` remains the canonical project snapshot.

Bump the draft-proofing schema version and migrate old runs explicitly.

Legacy run migration must preserve:

- run IDs;
- iteration numbers;
- status;
- timestamps;
- resume points;
- coverage;
- per-run proof-read visual settings.

Legacy runs receive `changeHistoryAvailable: false`.

New runs receive `changeHistoryAvailable: true` and an initially empty ledger.

If real projects later demonstrate unacceptable project-file growth, move verbose change storage behind a dedicated project-local history storage adapter without changing the feature/UI contract. Do not introduce a sidecar pre-emptively before measured need.

## Relationship to Existing Revisions Feature

The current Revisions subsystem contains useful concepts such as chronological sessions, date grouping, summary statistics, and before/after comparison surfaces.

Proof Read may reuse those interaction ideas, but the existing generic revision digest/diff representation must not be treated as the authoritative source for safe historical undo.

Proof Read has a stronger source: exact manuscript edit transactions captured during the intentional proof-read run.

Do not remove or deprecate Revisions as part of this initial feature. First prove the proof-read history UX and safe reversal model. A later design decision may determine whether Revisions should be rebuilt on common history primitives, narrowed, or retired.

## Existing Feature 1.12 Behaviour to Preserve

The new history feature must not regress:

- explicit new proof-read runs;
- sequential iterations;
- pause/resume/continue lifecycle;
- completed-run continuation;
- persisted resume points;
- proof-read coverage selection;
- Shift+drag coverage removal;
- coverage shifting/expansion during edits;
- latest completed run recall;
- proof-read eye visibility;
- per-run backdrop colours/presets/recent colours;
- Light/Dark highlight intensity;
- iteration-specific visual settings;
- selective run deletion;
- scene-deletion coverage pruning;
- Manuscript-only proof-read behaviour.

## Recommended Ownership

### `features/draft-proofing/draft-proofing-service.js`

Own:

- schema migration;
- durable run/change normalization;
- transaction-to-logical-change capture;
- summary statistics;
- lineage relationship updates;
- reversal preflight;
- individual undo/redo planning;
- run-level safe-subset planning;
- conflict/unresolved results.

Do not own DOM, pointer hit testing, or navigation effects.

### New proof-read history/review controller

Suggested location:

```text
features/draft-proofing/draft-proofing-history-controller.js
```

Own:

- selected review-run view model;
- review/later-change/conflict projection planning;
- hover target derivation;
- compare-card model;
- transient review selection policy.

### `draft-proofing-settings-window.js`

Own:

- current-run summary;
- proof-read history list;
- selected-run details;
- change rows and filters;
- compare/hover card markup where appropriate;
- undo/redo/preflight result presentation.

### Manuscript projection selector

Own only the render descriptors derived from the selected transient review state and durable proof-read history.

### Editor host adapter

Own rendering and host-specific hit-testing capabilities required by review projections.

Do not put history/conflict business rules into the textarea adapter.

### `app.js`

Keep orchestration thin:

- open/close Proof Read settings;
- hold transient review UI state until a smaller state owner is extracted;
- call feature commands;
- invoke navigation/persistence callbacks;
- schedule renders.

Do not implement change lineage, conflict calculation, or reversal logic directly in `app.js`.

## Implementation Sequence

### Phase A — Durable history foundation

1. bump proof-read schema;
2. migrate legacy runs;
3. capture/coalesce logical changes from existing edit transactions;
4. persist before/after text, anchors, hashes, and statistics;
5. persist proof-read-to-proof-read lineage;
6. add unit tests for capture, migration, reload, statistics, and overlap relationships.

No historical manuscript highlights are required to ship Phase A internally.

### Phase B — Safe reversal engine

1. resolve historical change locations against current manuscript;
2. implement exact expected-text preflight;
3. individual undo;
4. individual redo;
5. conflict/unresolved results;
6. replay-origin suppression;
7. run-level dry-run and safe-subset operations;
8. reload/regression tests.

### Phase C — Project Settings history UI

1. current run summary;
2. history list;
3. run detail view;
4. before/after change rows;
5. filters;
6. word/change statistics;
7. navigation actions;
8. reversal controls and preflight results.

### Phase D — Opt-in rolling manuscript review

1. transient `reviewRunId` bound to the open Proof Read settings session;
2. selected-run review projections;
3. later-change lineage projections only for the selected historical run;
4. conflict projection only after/while an unsafe preflight target is being inspected;
5. hover hit testing and lineage card;
6. immediate teardown on settings close, pane switch, project switch, or review clear.

This order deliberately builds the safety-critical history/reversal model before the richer visualization layer.

## Acceptance Criteria

1. New proof-read runs record durable logical manuscript changes rather than only coverage.
2. Logical history does not expose one row per keypress.
3. Change history survives project save/reload.
4. Legacy runs remain readable without fabricated change counts.
5. Project Settings shows proof-read dates, status, coverage, changes, and word statistics.
6. The author can inspect before/after text for each recorded logical change.
7. The author can navigate from a change to its current manuscript location when resolvable.
8. Later proof-read edits can be associated with earlier proof-read changes as durable lineage.
9. Multiple later proof-read runs may form a chronological lineage chain.
10. Opening the Manuscript page normally shows no new history/conflict decoration.
11. Historical review decoration appears only while Proof Read settings is open with a selected run on the Manuscript page.
12. Selecting a different run updates the rolling historical review without persisting that selection as an ambient manuscript preference.
13. Closing Proof Read settings immediately removes all history/later-change/conflict projections.
14. A selected historical run can show which of its passages were changed by later proof-read runs.
15. Hovering a changed-later passage identifies the responsible later proof-read run and before/after relationship.
16. Later modification is presented as provenance, not automatically as an unsafe conflict.
17. Individual undo applies only when current manuscript text matches the expected historical after-state.
18. Individual redo applies only when current manuscript text matches the expected historical before-state.
19. A historical reversal never silently overwrites later manuscript work.
20. If a later proof-read caused the mismatch, the conflict UI identifies that run/change.
21. If an unrecorded later manuscript edit caused the mismatch, the UI protects the manuscript without inventing proof-read provenance.
22. There is no force-overwrite path in the first implementation.
23. Run-level undo performs a complete preflight before mutation and may apply only the safe subset.
24. Run-level undo uses reverse sequence order; redo uses forward sequence order.
25. Historical replay does not recursively create new proof-read history records.
26. Reverting a change does not erase proof-read coverage.
27. Existing Feature 1.12 run, coverage, resume, visibility, colour, intensity, deletion, and Manuscript-only behaviour remains intact.
28. Historical review/conflict projections remain disposable UI and never enter durable manuscript decoration storage.
29. History/conflict business logic stays outside `app.js` and outside the editor-host adapter.
30. Focused tests cover migration, capture/coalescing, lineage, reload, safe undo/redo, conflict protection, review-state teardown, and projection visibility gating.

## Design Principle

Proof Read should become the author's intentional manuscript review history, but only when the author asks to inspect it.

Persist the knowledge required to explain and safely reverse old proof-read changes. Keep the normal writing surface quiet. Historical visualization is a temporary lens over the current manuscript, never a permanent layer of version-control noise.