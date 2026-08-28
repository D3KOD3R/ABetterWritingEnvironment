# Proof-Read Run Management and Navigator Window Design

Status: proposed companion to `proofread-run-history-and-safe-reversal-design.md` and `proofread-active-run-interaction-and-overlap-design.md` on `feature/manuscript/proofread-history-safe-reversal`.

This document defines intended behaviour and architecture only. It does not implement application code.

## Purpose

The current Proof Read settings surface now carries run selection, history summaries, per-change review, safe undo/redo, colour settings, intensity settings, and destructive version-data controls in one narrow panel. The feature has outgrown that surface.

This follow-up gives Proof Read its own larger review/navigation window and defines two run-management operations that need stronger semantics than the current safe-subset replay buttons:

- **Undo changes & remove run** — undo the selected proof-read run as one lineage-aware atomic operation, then delete that run only after the reversal succeeds completely;
- **Archive run** — preserve its manuscript changes and durable proof-read history while moving the run out of the normal active/completed history view.

The design also adds a code-editor-style manuscript change map so an author can see where changes belonging to a selected proof-read run occur across the manuscript and explicitly navigate to them.

The current manuscript remains authoritative. A run-management operation must never blindly restore an old project snapshot or overwrite later work merely to make historical state appear consistent.

---

# Current implementation observations

## Run cards place status beside the title

The current history card heading renders the run label and status together. This is the location shown as `Active` / `Completed` in the current Proof Read history screenshot.

For a compact card with several metadata lines, that placement makes the title row visually congested and competes with the run identity.

The status should move to the lower-right region of each run card, aligned with the card's trailing metadata/action area — the position indicated in the supplied UI annotation.

Conceptually:

```text
┌───────────────────────────────────────┐
│ Draft proof 4                         │
│ 29 Aug 2026 · 1 scene · 4 spans       │
│ 0 changes · 0 words changed    Active │
└───────────────────────────────────────┘
```

`Active`, `Paused`, `Completed`, and `Archived` are run-state metadata, not part of the title.

## Existing history already contains the right safety primitives

The proof-read history controller already distinguishes:

- applied versus reverted changes;
- later proof-read lineage;
- current unsafe conflicts;
- anchored current locations;
- preflighted text replacement rather than unconditional text replacement.

That means run removal should extend the existing safe-reversal/lineage model rather than introduce snapshot restoration.

## Existing Revisions window is a useful shell precedent, not the Proof Read data model

The Revisions feature already demonstrates a standalone, developer-style review window with a navigator, summary information, changed-item rail, and compare surface.

Proof Read should borrow the spatial idea and window-shell discipline, but it should continue to use proof-read runs, exact manuscript changes, anchors, coverage, and lineage as its source of truth.

Do not convert proof-read history into generic revision digest operations merely to reuse the Revisions UI.

---

# Non-negotiable run-management invariants

1. **Undo-and-remove is atomic.** Either every required reversal for the selected run passes preflight and the whole operation commits, or neither the manuscript nor the run record changes.
2. **No old snapshot restoration.** The operation derives inverses from proof-read change records, stable anchors, lineage, and the current manuscript.
3. **Later manuscript work wins.** A run cannot be removed by overwriting text that has since been changed in an incompatible way.
4. **Removing the latest change in a lineage restores the nearest preceding surviving state.**
5. **Removing an earlier change must not invalidate a later surviving proof-read change.** If a later change causally depends on the selected run and cannot be safely rebased, removal is blocked.
6. **Coverage-only runs can be removed without changing manuscript text.**
7. **Archived runs preserve their manuscript effects and durable audit/history data.**
8. **Archive is reversible; destructive removal is not.**
9. **Opening or browsing the Proof Read window does not navigate the main manuscript.** Navigation occurs only through an explicit change/marker click or another clearly named navigation command.
10. **Run colour is visual identity only.** Run IDs and change IDs remain the durable identity used for lineage and removal.

---

# 1. Run-card status placement

Move the run status from the title line to the lower-right of the card.

Recommended card information hierarchy:

```text
Draft proof 4
29 Aug 2026 · 1 scene · 4 spans
0 changes · 0 words changed                  Active
```

For runs with changed-later information:

```text
Draft proof 2
29 Aug 2026 · 1 scene · 1 span
3 changes · 37 words · 2 changed later    Completed
```

The status should be a compact semantic badge/text treatment rather than a large button. Selection of the card should remain visually distinct from run status.

Archived cards appear only when the Archived filter/view is selected and display `Archived` in this same position.

---

# 2. Replace ordinary run-level safe-subset undo with an explicit destructive operation

## User-facing action

For the selected run expose:

```text
[Undo changes & remove run]
```

This is intentionally different from the existing `Undo safe changes` action.

The current safe-subset behaviour is useful as an implementation primitive and possibly as an advanced per-change recovery tool, but it is not the right primary meaning for deleting a proof-read iteration. A user asking to remove Proofread 4 expects one comprehensible result:

> The manuscript no longer contains the changes attributable solely to Proofread 4, and Proofread 4 no longer exists as a run.

The operation must therefore be complete or not happen.

## Confirmation

Because this deletes durable run history after changing manuscript text, require explicit confirmation showing at least:

```text
Undo and remove Draft proof 4?

4 changes will be reversed.
Proof-read coverage and history for this run will be deleted.
Later work will not be overwritten.

[Cancel] [Undo changes & remove]
```

If preflight detects dependencies or conflicts, do not present a misleading final confirmation. Show the blockers first.

---

# 3. Run-removal preflight

Add a proof-read-owned planner such as:

```text
planDraftProofRunRemoval(state, manuscript, runId)
```

The exact function name is flexible. The important boundary is that UI code does not decide reversal safety.

The planner should inspect every durable logical change belonging to the selected run and classify it before any mutation occurs.

Recommended result shape:

```text
RunRemovalPlan
  runId
  safe

  mutations[]
    sceneId
    changeId
    resolvedRange
    expectedCurrentText
    replacementText
    predecessorChangeId?

  noOpChanges[]
  blockedChanges[]
    changeId
    reason
    laterRunId?
    laterChangeId?

  summary
    totalChanges
    reversibleChanges
    alreadyRevertedChanges
    dependentLaterChanges
    outsideEdits
    unresolvedAnchors
```

No manuscript edit occurs during planning.

## Change order

Within a selected run, derive the removal plan in reverse logical sequence order so that later edits made by that same run are unwound before earlier edits from that run.

Across scenes, the final mutation transaction may be grouped by scene for efficient persistence, but the logical safety result must be equivalent to reversing the run's own change sequence.

---

# 4. Predecessor-state rule

The target of a run removal is not always the literal `beforeText` stored on an isolated change. The operation must resolve the **nearest surviving predecessor state** for that logical manuscript lineage.

Example:

```text
Original
"The sea was still."

Proofread 1
"The sea was still."
→ "The sea lay still."

Proofread 2
"The sea lay still."
→ "The sea lay glass-smooth."
```

Removing Proofread 2 should produce:

```text
"The sea lay still."
```

That is the result left by Proofread 1.

Proofread 1 remains intact. Its coverage, history and change remain intact.

The same rule extends through longer chains:

```text
P1: A → B
P2: B → C
P3: C → D
```

Remove P3:

```text
D → C
```

Remove P2 after P3 has already been removed:

```text
C → B
```

The planner should derive this through lineage/run identity rather than by assuming adjacent run numbers always touched the same text.

---

# 5. Earlier-run dependency edge case

The dangerous case is deleting an earlier run while a later surviving run was authored from its result.

Example:

```text
P1: A → B
P2: B → C
```

If the author asks to remove P1 while P2 still survives, blindly applying `B → A` is wrong because the current manuscript is `C`, and rewriting history so that P2 appears to be `A → C` would be an implicit rebase.

## Initial product rule

**Block destructive removal of the earlier run when a later surviving proof-read change causally depends on it, unless a dedicated rebase preflight can prove the later change remains valid.**

The first implementation should prefer blocking over inventing meaning.

Suggested message:

```text
Draft proof 1 cannot be removed safely.

2 later changes in Draft proof 2 depend on text produced by this run.
Removing it would invalidate the later proof-read history.

[Go to dependent change] [Archive instead]
```

This preserves the core product rule that later work is never silently rewritten.

## Future optional rebase

A later feature may add a deliberate `Rebase later proof-read changes` workflow. That would need to:

1. construct the predecessor state with the selected run omitted;
2. replay/re-derive later changes against that predecessor;
3. verify resulting text and anchors;
4. rewrite the later change's historical before-state/lineage in an auditable transaction.

That is substantially more complex and should not be hidden inside the first `Undo changes & remove run` implementation.

---

# 6. Later non-proof-read edits

If the manuscript was edited after the selected proof-read outside an active proof-read run, lineage may not identify another run even though the current text no longer matches the expected state.

Example:

```text
P2: A → B
ordinary manuscript edit later: B → X
```

Removing P2 must **not** replace `X` with `A`.

The removal preflight should report:

```text
Manuscript changed after this proof-read.
```

and block the atomic removal until the incompatibility is resolved manually or by a future explicit rebase/merge tool.

---

# 7. Independent later changes are not blockers

A later proof-read run elsewhere in the manuscript does not prevent deletion of an earlier run.

Example:

```text
P1 changes scene A
P2 changes scene B
```

Removing P1 can safely reverse scene A while preserving P2 in scene B.

Similarly, two runs may both touch one scene but change disjoint anchored ranges. They do not become causally dependent merely because their scene IDs are the same.

Dependency should be based on the logical change lineage / overlapping replacement chain and current-text validation, not iteration number alone.

---

# 8. Already-reverted and coverage-only changes

## Already-reverted changes

If a change from the selected run is already in the `reverted` state and its reversal is still reflected in the current manuscript, it requires no additional manuscript mutation during run removal.

It still participates in dependency validation because a later change may refer to its historical lineage.

## Coverage-only run

A proof-read run may contain coverage but zero recorded manuscript changes.

For such a run:

```text
Undo changes & remove run
```

means:

- no manuscript text mutation;
- delete that run's coverage;
- delete that run's history record;
- clear it from active/selected run state;
- recompute overlap projections because one contributing run has disappeared.

This should be a straightforward valid case.

## Legacy run without detailed history

A legacy run whose `changeHistoryAvailable` is false cannot safely promise to undo its manuscript changes because the application does not know what they were.

For legacy runs:

- disable `Undo changes & remove run` if text reversal cannot be proven;
- allow `Archive`;
- if a separate `Delete proof-read metadata only` action is ever exposed, label it explicitly so the user understands manuscript text will remain unchanged.

Do not infer `0 changes` from missing historical data.

---

# 9. Atomic commit sequence

Only after the entire run-removal preflight reports safe should the application commit.

Recommended transaction order:

```text
1. freeze/close active logical change burst for target run
2. snapshot required current project/manuscript state for transaction rollback
3. preflight every planned inverse against the same current revision
4. apply all planned manuscript inverses
5. update scene blocks / inline formats / anchors through normal manuscript mutation services
6. update word counts/project index as ordinary manuscript edits require
7. suppress proof-read history recapture using proofread-history-replay/removal origin
8. remove target run coverage, changes and run record
9. remove lineage edges whose endpoint was the deleted run
10. preserve/re-normalize all surviving run/change lineage
11. clear selected/review/active IDs referencing the removed run
12. persist once as one project mutation boundary
13. refresh proof-read projections/window without moving manuscript viewport
```

If any mutation cannot be applied exactly as preflighted, abort and leave both manuscript and run data unchanged.

Do not partially reverse three changes and then report that the fourth failed.

---

# 10. Archive run

## User-facing action

Expose:

```text
[Archive run]
```

Archive is the non-destructive alternative when a run is no longer useful in the everyday history list but its provenance should remain available.

## Semantics

Archiving a run:

- does not change manuscript text;
- does not delete coverage;
- does not delete change history or lineage;
- records `archivedAt` and an archived state/flag;
- removes the run from the default Active/Completed history list;
- makes it available under an `Archived` filter/view;
- cannot make an archived run the current active proof-read run.

Recommended durable representation:

```text
archivedAt: ISO timestamp | ""
```

A dedicated boolean may be derived from that. Prefer keeping lifecycle status (`active`, `paused`, `completed`) conceptually separate from archival state if doing so avoids invalid combinations in existing run lifecycle code.

For example, a completed run can be archived without losing the fact that it completed.

## Active/paused run archival

If the user archives an active or paused run, make the action explicit:

```text
Archive and stop Draft proof 4?
```

The run should be sealed/completed before it becomes archived. Do not leave an archived `activeRunId`.

## Restore from archive

Archived view exposes:

```text
[Restore to history]
```

Restoring does not resume the run. It returns the run to ordinary historical visibility in its sealed/completed state.

## Archived coverage display

Archive should reduce clutter rather than silently remove historical information.

Recommended default display policy:

- archived runs are omitted from ordinary `Previous runs` coverage composition;
- the Proof Read window offers `Show archived coverage` when inspecting archived history;
- restoring the run makes it eligible for ordinary previous-run display again.

Its manuscript text changes remain present regardless of coverage visibility.

---

# 11. Proof Read grows into a dedicated window

The current narrow settings/history window should become a compact launcher into a larger Proof Read review environment.

This is analogous in spatial density to the Revisions window, but it is not the same feature and should not share revision persistence/state ownership.

## Compact top-panel role after this change

The manuscript top card should become deliberately small. It only needs the controls used during active writing/proof-reading, for example:

```text
Proof Read · Draft proof 4 · Active
[marks eye] [pause/resume] [new run] [open Proof Read]
```

Detailed history, archival, destructive run removal, per-change comparison and navigator functionality belong in the dedicated window.

The existing Project → Proof Read entry and/or pen/settings button should open this larger window.

---

# 12. Proposed Proof Read window layout

Recommended desktop layout:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ PROOF READ              Draft proof 4 ▼         Active              [×]    │
│ Run history, changes, coverage and navigation                               │
├────────────────┬────────────────────────────────────────────┬───────────────┤
│ RUNS           │ SELECTED RUN / MANUSCRIPT VIEW             │ PROOF MAP     │
│                │                                            │               │
│ Draft proof 4  │ Chapter 7 · Scene 3                        │ ▌             │
│ ...      Active│                                            │ ▌  ━ red      │
│                │ manuscript text / selected-run overlays    │ ▌             │
│ Draft proof 3  │                                            │ ▌      ━ red  │
│ ...   Completed│ selected change focused here               │ ▌             │
│                │                                            │ ▌  ━ red      │
│ Draft proof 2  │                                            │ ▌             │
│ ...   Completed│                                            │ ▌             │
│                ├────────────────────────────────────────────┤               │
│ [Archived]     │ CHANGE INSPECTOR                           │               │
│                │ Before | After | lineage | navigation      │               │
├────────────────┴────────────────────────────────────────────┴───────────────┤
│ [Archive run]                       [Undo changes & remove run]              │
└─────────────────────────────────────────────────────────────────────────────┘
```

The exact pane widths are implementation/UI tuning details. The important information architecture is:

1. run navigator;
2. selected-run manuscript/review view;
3. compact manuscript change map;
4. selected-change inspector/actions.

---

# 13. Run navigator rail

The left rail lists runs newest first with enough information to identify them without opening every card.

Each card shows:

- run label/iteration;
- date;
- coverage summary;
- change/word summary;
- changed-later count where relevant;
- run colour swatch;
- status in the **lower-right** position;
- selected state independent from status.

Filters at the top may be:

```text
Current | History | Archived
```

or a compact equivalent.

Selecting a run changes the review content inside the Proof Read window but must not move the main manuscript workarea.

---

# 14. Selected-run manuscript view

The central area should give the author manuscript context rather than only a list of abstract before/after records.

Recommended behaviour:

- render a read-oriented manuscript representation using the same canonical scene text;
- visually mark the selected run's changed passages;
- optionally show previous-run coverage according to the active Proof Read display preference;
- show `changed later` / conflict semantics distinctly from ordinary coverage overlap;
- allow ordinary scrolling within this window independently of the main manuscript workarea;
- do not allow this secondary view to become a second persistence owner.

The central view may be read-only in the first implementation. Editing should remain owned by the main manuscript editor unless a later design deliberately establishes shared-editor mutation semantics.

This avoids maintaining two simultaneous editable DOM surfaces over the same scene.

---

# 15. Proof Map: code-editor-style manuscript minimap

The narrow right rail should act like a code editor's minimap/change overview.

The user's VS Code example is the right mental model: the author should be able to glance at the vertical rail and immediately see clusters of edits from the selected proof-read run.

## What the map represents

The map represents the **selected proof-read run**, not all history indiscriminately.

Primary markers:

```text
red marker = manuscript text change recorded in selected run
```

A run with eight logical changes should therefore show eight resolved markers unless nearby changes are visually clustered at the current zoom/height.

Optional secondary information may later include coverage density in the run's colour, but red change markers remain the primary navigation signal.

## Position mapping

Do not map markers from stale original offsets or current window pixel positions.

Derive each marker from:

- current project chapter/scene order;
- the change's resolved current manuscript anchor;
- normalized position within that scene;
- the scene's normalized position within the selected project/run scope.

Conceptually:

```text
projectPosition =
  sceneStartFraction
  + (resolvedOffset / currentSceneLength) * sceneHeightFraction
```

The exact weighting can account for scene text length so a 5,000-word scene occupies more map space than a 100-word scene.

## Marker states

Keep red as the selected-run change language.

Semantic modifiers can communicate safety without replacing that core meaning:

- solid red — applied selected-run change;
- muted/outlined red — selected-run change currently reverted;
- red with amber edge/tick — changed by a later run;
- red warning treatment — unresolved/current unsafe conflict;
- brighter selected red — currently selected change.

Do not use mixed proof-read coverage colours as change-map markers. Coverage overlap and edit-history navigation are different concepts.

## Clustering

For very long manuscripts or dense editing bursts, several changes may map to the same few pixels.

Cluster visually adjacent markers rather than losing them. A cluster may show a thicker bar or small count and expands/selects the nearest contained changes when clicked.

The durable changes remain separate.

---

# 16. Change-marker navigation

Passive Proof Map rendering must never move the main manuscript.

**Clicking a marker is the explicit navigation action.**

On click:

1. identify the selected run + change ID;
2. resolve the change's current anchor;
3. select/open the owning scene if necessary;
4. center the main manuscript editor on the resolved passage;
5. emphasize that passage temporarily using the existing proof-read history review projection;
6. select the corresponding change in the Proof Read window's inspector;
7. scroll the window's central manuscript preview to the same passage;
8. keep the selected proof-read run active in the window.

This deliberately fits the earlier viewport rule:

```text
Browsing Proof Read UI → main manuscript stays put
Clicking a specific change marker → intentional navigation
```

The existing `Go to change` action should converge on the same navigation controller rather than maintain two independent location-resolution paths.

## Unresolved marker

If an anchor cannot be safely resolved because a scene was deleted or heavily restructured:

- retain the marker/history record in an unresolved section/state;
- do not guess a location;
- clicking it opens the change inspector and reports that the current manuscript location cannot be resolved;
- destructive run removal treats unresolved required changes as a blocker.

---

# 17. Change inspector

When a map marker or change list item is selected, show a focused inspector rather than exposing every control on every row.

Suggested content:

```text
Change 3 of 8
Chapter 7 · Scene 3
29 Aug 2026 14:42

BEFORE
The ocean was completely still.

AFTER
The ocean lay completely still.

Changed later in Draft proof 6   [Go to later change]

[Go to manuscript] [Compare]
```

Individual safe undo/redo can remain available here as an advanced/history operation if desired, but it should no longer dominate the top-level run overview.

This helps solve the congestion that prompted the larger window.

---

# 18. Selected-run actions

Keep destructive and lifecycle operations at run level, not repeated on every history card.

Recommended selected-run action area:

```text
Active run:
[Pause] [Finish] [Archive and stop] [Undo changes & remove]

Completed run:
[Archive] [Undo changes & remove]

Archived run:
[Restore to history]
```

Colour/intensity controls can live in a run settings drawer or compact toolbar rather than consuming the primary history column.

`Undo changes & remove` should be visually separated from ordinary navigation/settings because it is destructive.

---

# 19. Relationship to current safe undo/redo

Do not throw away the current history replay work.

The current functions that:

- resolve lineage;
- preflight current expected text;
- plan scene mutations;
- update blocks and inline formats through normal editor services;
- suppress recursive history recording;

are useful primitives for the new run-removal planner.

What changes is the product-level transaction semantics:

```text
Current run-level safe undo:
apply whatever subset is currently safe and report the rest

New Undo changes & remove run:
preflight the entire selected run
if every required inverse is safe → apply all + delete run
otherwise → apply none + explain blockers
```

The existing safe-subset action may remain available only under an advanced recovery UI if there is a genuine use case. It should not be confused with run deletion.

---

# 20. Relationship to active-run overlap design

The companion active-run design defines:

- preserved native text selection and Copy;
- unique automatic run colours;
- inherited intensity;
- Light 100% / Dark 25% initial defaults;
- previous-run coverage toggle;
- mathematical mixed coverage colours;
- no viewport movement during ordinary Proof Read interaction.

This navigator design does not replace those rules.

When a run is successfully removed:

- its colour stops contributing to ordinary previous-run coverage;
- any mixed coverage segments are recomputed from the remaining runs;
- previous surviving run colours remain unchanged.

When a run is archived:

- its text changes remain;
- its ordinary coverage contribution is hidden by default according to the archive display policy;
- it can still be inspected in the dedicated Proof Read window.

---

# 21. Persistence/model additions

Conceptual additions only; exact schema shape should follow existing normalization conventions.

Project proof-read state may need:

```text
runs[].archivedAt
```

Transient Proof Read window state may need:

```text
proofReadWindowOpen
selectedRunId
selectedChangeId
runFilter
previewSceneId
previewScrollState
```

The following should remain transient and not be persisted into manuscript decoration state:

- selected change;
- hovered change marker;
- open/closed inspector subsection;
- temporary conflict/preflight display;
- current minimap cluster expansion.

Archive state is durable because it is an author decision about history organization.

---

# 22. Recommended implementation boundaries

Prefer small proof-read-owned units rather than extending `app.js` with more feature policy.

Possible responsibilities:

```text
draft-proofing-run-removal-service.js
  plan atomic run removal
  resolve predecessor states
  validate dependencies
  return mutation plan / blockers

draft-proofing-archive-service.js
  archive / restore lifecycle normalization

draft-proofing-window.js
  render dedicated window

draft-proofing-window-controller.js
  transient run/change selection and actions

draft-proofing-change-map-service.js
  derive manuscript-scale marker positions/clusters
```

Names are illustrative. Existing feature files may absorb these responsibilities if they remain cohesive and testable.

Do not put dependency/reversal algorithms into the render module.

---

# 23. Test plan

At minimum extend/add tests around:

## Run-card/UI

- status renders lower-right rather than title row;
- Archived status is supported;
- selected state remains independent of status;
- compact Proof Read panel opens dedicated window;
- window run selection does not navigate main manuscript;
- change-marker click does navigate intentionally.

## Removal planner

- latest isolated run reverses and deletes successfully;
- latest run in `P1 A→B, P2 B→C` restores `B` when P2 is removed;
- after P2 removal, removing P1 restores `A`;
- deleting P1 while dependent P2 survives is blocked;
- unrelated later run does not block removal;
- later ordinary manuscript edit blocks unsafe removal;
- unresolved anchor blocks removal;
- already-reverted change becomes no-op where safe;
- coverage-only run removes without manuscript mutation;
- legacy run without history cannot claim safe text reversal;
- one unsafe change makes the entire removal plan non-committable;
- failed commit does not leave partial manuscript inverses;
- successful removal deletes only selected run and its lineage endpoints;
- surviving run IDs/settings/coverage remain unchanged;
- overlap colours recompute after removal.

## Archive

- completed run archives without manuscript mutation;
- active run cannot remain active after archive;
- archived run is omitted from normal history;
- archived run appears under Archived;
- restore returns it to sealed/completed history;
- archived history and lineage survive persistence refresh;
- archived coverage follows archive display policy.

## Proof Map

- marker order follows project/scene order;
- marker position uses current resolved anchor rather than stale original offset;
- changed-later marker modifier resolves correctly;
- unresolved change is retained but not falsely navigated;
- dense markers cluster deterministically;
- clicking cluster/change selects correct run/change;
- passive hover/scroll in Proof Read window does not disturb manuscript viewport.

---

# 24. Acceptance scenarios

## Scenario A — remove latest proof read

```text
P1 changes "was still" → "lay still"
P2 changes "lay still" → "lay glass-smooth"

User selects P2
User clicks Undo changes & remove run

Preflight succeeds
Current text "lay glass-smooth" → predecessor "lay still"
P2 coverage/history/run deleted
P1 remains
```

## Scenario B — unsafe earlier-run removal

```text
P1 A → B
P2 B → C

User selects P1
User clicks Undo changes & remove run

System finds surviving dependent P2 change
No text changes occur
P1 is not deleted
UI explains dependency and offers Go to dependent change / Archive instead
```

## Scenario C — independent runs

```text
P1 edits Scene 1
P2 edits Scene 9

Remove P1
→ Scene 1 reverses safely
→ P1 deleted
→ P2 untouched
```

## Scenario D — archive

```text
User selects completed P2
Archive run

Current manuscript unchanged
P2 disappears from ordinary history
P2 remains under Archived with complete changes/coverage/lineage
```

## Scenario E — code-style navigation

```text
User selects P4 in Proof Read window
Proof Map shows red ticks for P4 changes
Main manuscript remains where it was

User clicks red tick near lower third
→ selected P4 change resolved by anchor
→ owning scene opens/centers in main manuscript
→ central Proof Read preview and inspector select same change
```

---

# Recommended implementation sequence

1. Re-layout run cards and move status to the lower-right.
2. Introduce archival state + Archived filter/restore flow.
3. Extract/build whole-run removal preflight without any mutation.
4. Add predecessor-state and dependent-later-run tests.
5. Implement atomic commit/rollback boundary for safe whole-run removal.
6. Build dedicated Proof Read window shell using Revisions only as a layout precedent.
7. Move history/detail controls from the narrow settings surface into the dedicated window.
8. Add selected-run manuscript preview.
9. Add Proof Map marker derivation and clustering.
10. Route Proof Map click and existing `Go to change` through one anchored navigation controller.
11. Integrate the companion active-run colour/intensity/overlap and viewport-preservation changes.
12. Run proof-read, manuscript editor, persistence, projection, and revisions regression suites.

This order isolates the destructive data operation from the visual redesign and makes it possible to test the safety contract before the new window begins calling it.
