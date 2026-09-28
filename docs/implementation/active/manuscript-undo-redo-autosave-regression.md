# Manuscript Undo/Redo Autosave Durability Regression

Status: Active staged regression contract  
Date: 2026-09-28  
Branch authority: `feature/persistence-portability-harness`  
CASE ID: `manuscript-undo-redo-autosave-durability`  
Priority: P0 investigation  
Primary checklist owner: `8.4 Autosave and dirty-state control`  
Cross-feature surfaces: `1.10` manuscript undo/redo and formatting, `1.11` anchor drift, `1.9` revision banking, `1.8` writing targets/session metrics

## Execution contract

### Goal

Determine whether the current browser-host manuscript Ctrl+Z/Ctrl+Y path can ever leave the visible manuscript out of sync with ABE's canonical scene state, autosave dirty state, or durable project package. Separately measure effective browser undo/redo depth, grouping and memory behavior without confusing those measurements with package-generation churn.

This CASE is evidence-first. A possible durability failure has been identified by code review, but no defect is claimed until a controlled browser RUN reproduces it.

### Initial bounded reads

Read only:

1. `AGENTS.md`;
2. `agents/RepositoryWorkspaceAgent.md`;
3. the `8.4` and cross-linked `1.8`, `1.9`, `1.10`, and `1.11` sections in `features.md`;
4. `docs/implementation/active/persistence-cross-feature-regression-checklist.md`;
5. this document;
6. `docs/implementation/active/regression-workspace-logging.md`.

Only after the CASE requires implementation or diagnosis, read the narrow current undo/redo shortcut path, manuscript input controller, editor-host adapter, autosave controller, persistence service, and directly relevant tests.

### Required outcome

Produce a fresh attributable regression RUN that:

- proves or disproves visible-text -> canonical-state -> autosave -> durable-package convergence for ordinary text undo and redo;
- records whether the real supported Chrome runtime emits the expected input event for each undo/redo action and whether ABE commits the resulting text;
- measures effective undo/redo depth and grouping under deliberately separated author actions;
- measures browser memory behavior across history growth, undo, redo, editor-host replacement, and scene switching;
- distinguishes browser/runtime history limitations from save-reliability failures;
- records restart/reopen durability after successful autosaves;
- preserves exact branch/SHA, browser version/profile, project identity/path, logs and package evidence;
- stops for focused repair if a P0 durability divergence is reproduced.

A product fix is not part of the initial CASE. If a defect is reproduced, append the diagnosis and repair/recheck requirements rather than rewriting the original evidence.

### Explicit non-goals

- Do not redesign the editor, adopt ProseMirror, or introduce an application-owned text history before evidence requires it.
- Do not treat a particular browser undo depth as a product guarantee before measurement and a separate product decision.
- Do not weaken autosave verification, transition barriers, package authority, or atomic package generation to make the CASE pass.
- Do not equate whole-package byte/hash stability with semantic stability across successful saves; package saves intentionally create generation-specific files.
- Do not start with 1,000 save cycles. First isolate browser history from persistence I/O so a failure remains diagnosable.
- Do not use the real Serva Vitae project as disposable regression data.

## Current implementation findings

These findings describe the current portability-harness build and are the reason for the CASE.

### Text undo/redo command path

For a text-editing target, the current keyboard shortcut path:

1. resolves `history.undo` or `history.redo`;
2. gives app-owned manuscript mark history first opportunity to handle the command;
3. otherwise prevents the browser's default shortcut;
4. invokes `document.execCommand("undo")` or `document.execCommand("redo")`.

The command helper returns the browser result, but the current shortcut caller does not use that return value to prove that a text edit occurred or to trigger persistence directly.

This is distinct from app-owned decoration history. Bold/Highlight mark undo/redo has its own bounded ABE history and persistence path.

### Canonical/autosave path when an input event is received

The document-level manuscript `input` handler sends the current textarea value to `ManuscriptInputController.handleEditorTextInput`. The controller compares the current canonical scene text with the editor value, updates revision/anchor-related collaborators, and calls the shell's scene-text commit path.

That commit path updates the scene draft and then calls the canonical project persistence boundary with:

- `changedSceneIds: [sceneId]`;
- domain `manuscript`;
- dirty reason `user-edit`.

The persistence boundary marks autosave dirty and schedules the normal durability path.

Therefore, if the browser emits the expected input event after undo/redo, the existing ABE path is designed to make the result durable.

### Risk under investigation

The unproven risk is a boundary failure where:

```text
visible textarea changes through browser undo/redo
but
no corresponding manuscript input commit reaches canonical ABE state
```

If that occurs, the author could see one version while autosave/restart preserves another. That is a P0 save-reliability risk even if it is rare.

The CASE must prove this behavior in a real supported browser rather than assuming that `execCommand` always emits the event sequence ABE requires.

### Editor-host lifetime observation

Normal typing refresh uses the existing textarea and synchronizes layout/projection layers in place. That path should not itself replace the editing control.

A broader manuscript render uses `slot.innerHTML = ...`, which destroys and recreates the manuscript textarea. Because the browser owns ordinary text history, the CASE must measure what history survives host replacement, scene switching, and browser refresh. Loss of volatile history is not automatically a durability defect if the author's final visible state remains canonical and durable.

### Existing test gap

Current automated coverage establishes pieces of the pipeline but not the full browser boundary:

- static desktop-application assertions prove the undo/redo shortcut and native command helper exist;
- manuscript-input-controller tests prove that an input delivered to the controller is committed through its collaborators;
- autosave/persistence tests prove dirty/revision/save behavior behind their service boundaries.

There is no current Playwright, Puppeteer, Selenium, WebDriver, or equivalent real-browser regression proving:

```text
type -> autosave -> Ctrl+Z -> canonical mutation -> autosave -> restart
```

or the redo equivalent.

The existing Regression Run Controller deliberately does not open or drive a browser. Preserve that responsibility split.

## Acceptance invariant

For each successful text-changing edit, undo, or redo:

```text
visible editor text
= canonical active scene text
= active project record/scene-store text
= durable scene text after successful autosave
= reopened scene text after process restart
```

Temporary differences while an autosave is pending are allowed only while dirty state correctly advertises that the durable package is not yet synchronized.

A successful save may change package generations, manifest references, timestamps, selection snapshots, or other allowed save metadata. Those physical changes do not fail this CASE when manuscript identity/content/destination remain correct.

## Staged regression plan

### Stage 0 - Small durability proof

Start with one Fresh package outside every worktree and one unmistakable scene marker.

Minimum sequence:

1. Establish `ALPHA-000` and allow a verified durable save.
2. Type a deterministic suffix such as ` EDIT-001`.
3. Allow a verified autosave and record visible/canonical/durable values.
4. Invoke Ctrl+Z through the real browser.
5. Record browser command result if observable, input event/input type, visible text, canonical text, autosave revision/dirty state and target.
6. Allow autosave to complete.
7. cold-restart the host/browser as the CASE defines and reopen the package.
8. Require the reopened text to match the author's post-undo visible text.
9. Invoke redo, repeat the same convergence checks, save, restart and verify.

Stop immediately as **Broken / P0** if visible text changes but canonical state does not, or if a successful autosave/restart preserves text different from the author's final visible state.

### Stage 1 - History depth and grouping measurement

Do not save after every action.

Generate deliberately separated author edit transactions so the browser cannot trivially coalesce one long typing run into a single undo unit. Use deterministic markers and record exact expected text after each action.

Initial scale:

- 100 actions for harness validation;
- 250 and 500 once evidence capture is stable;
- 1,000 actions for the bounded stress measurement.

Then undo until the editor stops changing and redo until it stops changing.

Record:

- authored action count;
- successful text-changing undo count;
- successful text-changing redo count;
- unexpected coalescing/grouping;
- command success/failure where observable;
- presence and type of input events;
- canonical equality checkpoints;
- elapsed time per checkpoint.

The measured depth is an observation, not an acceptance threshold, unless a later product decision defines one.

### Stage 2 - Memory characterization

At 0, 100, 250, 500, 750 and 1,000 authored actions, and again during undo/redo, capture both:

- JavaScript heap metrics available through the browser debugging protocol;
- renderer/process memory, because browser editing history may consume memory outside the JavaScript heap.

Also capture memory after:

- all available undo operations;
- all available redo operations;
- deliberate editor-host replacement;
- scene A -> B -> A switching;
- a defined idle/GC opportunity when available without changing product behavior.

The purpose is to identify growth shape, retained memory and leaks. Do not invent a hard memory budget in this CASE. A separate design decision may set one after baseline measurements exist.

### Stage 3 - Autosave cycling stress

Only after Stage 0 passes and Stage 1 can reliably identify browser edits.

Run deterministic cycles:

```text
edit N
-> verified autosave
-> undo
-> verified autosave
-> redo
-> verified autosave
```

Start with 50 cycles, then 100. Scale toward 1,000 only if the smaller run remains clean and evidence remains attributable.

At regular checkpoints, cold-restart and reopen the same package. Verify the package manifest's referenced scene body, not merely the browser UI/cache.

This stage intentionally includes package-generation churn. Keep its results separate from Stage 1 so save-generation file growth cannot be mistaken for browser history memory.

### Stage 4 - Editor-host lifetime boundaries

With a known undo history present, measure these boundaries separately:

1. ordinary typing/layout refresh that keeps the current textarea;
2. an operation that causes a full manuscript-panel rerender;
3. scene A -> B -> A;
4. workspace/pane switch where relevant;
5. browser refresh;
6. process restart.

For each boundary, record:

- whether native text undo history remains;
- whether canonical manuscript state remains correct;
- whether autosave dirty/clean state remains correct;
- whether reopening restores the final author-visible state.

History loss at a lifecycle boundary is a product limitation/design question unless it also causes canonical/durable divergence.

### Stage 5 - Cross-feature integrity

Use a smaller deterministic edit/undo/redo sequence with:

- one anchor-backed record before/inside/after the edit;
- active revision-session evidence where supported;
- writing-target/session metrics.

Verify that successful text undo/redo does not leave anchors, revision evidence, word counts or writing-session state describing a manuscript version that is no longer canonical.

Do not use this stage to redesign those features. Record any independent failure under its owning feature while preserving this CASE's evidence.

## Browser automation shape

Keep the existing Regression Run Controller as the source/RUN/provenance/logging authority. Do not teach the controller generic browser semantics merely for this CASE.

The preferred shape is:

```text
Regression Run Controller
  -> exact worktree/SHA + host + external evidence/project locations
Focused browser driver
  -> real supported Chrome profile
  -> real keyboard Ctrl+Z/Ctrl+Y
  -> browser event and memory checkpoints
ABE logs/state probes
  -> canonical/autosave identity
Disk verifier
  -> project.json + referenced durable scene body
```

The repository currently has no browser-driving framework. A focused Playwright/Chrome DevTools Protocol driver is a reasonable candidate because it can send real keyboard input and inspect Chrome runtime/process metrics, but adding that dependency/tooling is an implementation decision for the CASE, not an assumption embedded in the product.

Do not replace the real-browser stage with synthetic JavaScript `input` dispatch and claim browser undo acceptance.

## Evidence contract

Use a fresh Regression Run Controller RUN:

```text
CASE manuscript-undo-redo-autosave-durability
```

Suggested retained result files under that RUN's `manual-test-results/` or a future case-owned automated-results subfolder:

- `stage-0-durability.json`;
- `stage-1-history-depth.json`;
- `stage-2-memory.json`;
- `stage-3-autosave-stress.json`;
- `stage-4-host-lifetime.json`;
- `stage-5-cross-feature-integrity.json`;
- restart/package inspections and screenshots only where they materially prove a checkpoint.

Every stage must record:

- branch and exact SHA;
- browser name/version/profile isolation;
- CASE/RUN;
- project ID and authoritative package root;
- initial and final canonical/durable text hashes plus short safe markers;
- autosave revision/dirty/target state when relevant;
- browser action counts and event counts;
- source identity unchanged at RUN completion.

Generated evidence stays outside the source worktree.

## Classification and stop rules

### Broken / P0

Classify the CASE Broken and stop the durability sequence when any of these reproduce:

- a browser undo/redo visibly changes manuscript text without the canonical scene receiving that text;
- canonical text changes but the mutation is not marked/scheduled for durability when autosave is enabled and a valid target exists;
- a successful autosave writes manuscript text different from the current canonical/visible state;
- restart/reopen after a reported successful durable save restores a different manuscript version;
- undo/redo corrupts project identity, package destination, another project's package, or anchor-owned semantic data.

### Investigation result, not automatically a defect

Record without inventing a failure verdict when:

- effective undo depth is lower or higher than expected but stable;
- contiguous typing is grouped into fewer undo units;
- full editor-host replacement or refresh clears volatile browser undo history while manuscript durability remains correct;
- memory grows with retained history but plateaus/reclaims acceptably, pending an explicit budget decision.

### Follow-up repair only after reproduction

Potential repair directions may include better command-result/event diagnostics, an explicit host transaction confirmation, a safer shortcut fallback, or eventually an application/editor-owned history engine. Do not select or implement one solely from this code review.

## Relationship to the main persistence sweep

This CASE is owned by `8.4` because the acceptance question is ultimately whether an author-visible manuscript state enters the canonical dirty/autosave/durable pipeline.

It should run immediately after the current `8.2` package-authority/recent-project blocker is closed or safely isolated, and before the broader `8.3` cache sweep and remaining `8.4` autosave campaign. A reproduced undo/autosave divergence could invalidate later manual persistence evidence, so it should not be left until the ordinary `1.10` formatting pass.

The ordinary `1.10` regression still owns app-owned decoration undo/redo. Passing Bold/Highlight history does not prove browser text undo/redo durability.
