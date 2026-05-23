# agentContextRetrace.md

## Purpose

Use this procedure when Codex, ChatGPT, or any AI coding agent fails during context compaction, loses thread continuity, disconnects mid-task, or appears to continue from stale/partial context.

The goal is to safely reconstruct the working state from the repository itself before continuing. The repository is the source of truth. Prior chat context, agent memory, or partially compacted summaries are only advisory.

---

## When to Run This

Run this retrace procedure when any of the following occurs:

- The agent reports a compaction failure, context summarisation failure, stream disconnect, or backend interruption.
- The agent stopped mid-refactor and may have partially edited files.
- The agent claims work is complete but the thread was interrupted.
- A new Codex thread is being started to continue unfinished work.
- The agent appears confused about what files were changed or what design decision was already made.
- The task touches project save/load/autosave, schema, repository services, annotations, editor projections, or any other durable project data path.

---

## Core Principle

Do not trust the previous conversation state.

Before continuing work, inspect the repository, current git diff, tests, and relevant documentation. Continue only from verified files and explicit project rules.

Durable product truth belongs in:

- committed source files
- project schema
- repository services
- tests
- documentation files
- current git diff

Transient truth may exist in:

- editor runtime state
- cursor/layout state
- temporary projections
- unsaved browser state
- previous agent assumptions

Transient truth must not override durable repository state.

---

## Required First Response From Agent

Before modifying files, the agent must produce a short retrace report with these sections:

1. **Current Git State**
   - branch name
   - clean/dirty status
   - changed files
   - untracked files

2. **Recent Work Detected**
   - what the current diff appears to be doing
   - which files look intentionally modified
   - which files look accidental, stale, generated, or risky

3. **Task Continuity Assessment**
   - what the previous task was likely trying to achieve
   - what appears complete
   - what appears incomplete
   - what assumptions are unsafe

4. **Risk Areas**
   - save/load/autosave logic
   - project JSON/schema changes
   - editor projection/runtime behaviour
   - annotations/domain records
   - tests that are missing or failing

5. **Recommended Next Step**
   - the smallest safe continuation step
   - files expected to be touched
   - tests expected to be run

The agent must not edit files until this report has been produced.

---

## Required Commands

The agent should run or request equivalent inspection commands before continuing.

```bash
git branch --show-current
git status --short
git diff --stat
git diff
git ls-files --others --exclude-standard
```

If the repository has package scripts, inspect them before assuming test commands:

```bash
cat package.json
```

Then run the most relevant available checks, for example:

```bash
npm test
npm run test
npm run lint
npm run typecheck
```

Only run commands that exist in the project.

---

## File Review Checklist

The agent must inspect the files most relevant to the interrupted task.

For authoring/project persistence work, check:

- root project documentation
- `AGENTS.md` or `agents.md`
- feature planning documents such as `features.md`
- project schema packages
- repository service files
- save/load/autosave service files
- editor state management files
- manuscript/scene storage files
- annotation/domain record files
- test files covering persistence or editor behaviour

For UI/editor projection work, check:

- editor components
- CSS/layout files
- cursor/selection/range handling
- rendered projection adapters
- runtime-only state containers
- tests around editing, undo/redo, paste, selection, and rendering

---

## Durable vs Projection Rule

The agent must preserve this architectural distinction:

### Durable author-applied data

These belong in repository services and schema:

- manuscript text
- scene/chapter structure
- author-created annotations
- comments
- revision records
- semantic links
- research notes attached to project records
- persistent issue markers
- project settings that are currently stored in project JSON
- future split-file project metadata when desktop storage is introduced

### Runtime/editor projection data

These belong in editor runtime state only unless explicitly promoted to durable records:

- cursor position
- active selection
- rendered CSS ranges
- temporary highlights
- scroll position
- open panels
- hover state
- layout measurements
- DOM range objects
- editor-only decoration objects

The editor may project durable records into visual ranges, but visual ranges are not the canonical source of truth.

---

## Current Design Direction To Preserve

The interrupted design decision should be treated as a guiding constraint:

> The critical design distinction is that persisted author-applied annotations, durable anchored domain records that produce visual projections, and ephemeral session visuals must not be one bag of CSS ranges. An editor engine is useful only as a cursor/layout/runtime host for these projections; the canonical data and policies belong in repository services and schema.

The agent should implement toward this direction unless the current repository already contains a newer contradictory design document.

---

## Continuation Rules

After the retrace report, the agent may continue only by following these rules:

1. Prefer the smallest safe patch.
2. Do not rewrite broad systems in one pass.
3. Do not mix schema changes, repository changes, UI rendering changes, and tests unless necessary.
4. Add or update tests for every persistence rule changed.
5. Keep runtime projections separate from durable records.
6. Preserve browser-MVP compatibility unless explicitly moving to desktop code.
7. Avoid adding new dependencies unless clearly justified.
8. Update documentation when the architecture changes.
9. Do not delete existing files unless the diff proves they are obsolete.
10. Do not assume the previous agent completed anything that is not visible in the repo.

---

## Suggested Recovery Workflow

### Step 1: Inspect

Read git state, current diff, untracked files, and relevant documentation.

### Step 2: Report

Produce the required retrace report. Do not edit files yet.

### Step 3: Stabilise

If the diff contains valuable but incomplete work, either:

- finish the smallest safe missing piece, or
- isolate the incomplete work behind tests/docs, or
- recommend reverting a risky section before continuing.

### Step 4: Test

Run the smallest relevant test set first. Then run broader tests if available.

### Step 5: Continue

Proceed with the next small implementation slice only after the repository state is understood.

---

## Prompt To Use In A New Codex Thread

Paste this into Codex when recovering from a failed context compaction:

```text
The previous agent task failed during context compaction or stream disconnection.

Before making any changes, read agentContextRetrace.md and follow it exactly.

Treat the repository as the source of truth. Do not rely on the previous chat context except as advisory.

First inspect git status, git diff, untracked files, relevant docs, schema, repository services, editor projection code, and tests.

Then produce the required retrace report from agentContextRetrace.md.

Do not modify files until after that report.

The interrupted design direction was:

“Persisted author-applied annotations, durable anchored domain records that produce visual projections, and ephemeral session visuals must not be one bag of CSS ranges. An editor engine is useful only as a cursor/layout/runtime host for these projections; the canonical data and policies belong in repository services and schema.”

After the retrace report, recommend the smallest safe continuation step.
```

---

## Expected Agent Output Format

The first response after running this file should look like:

```text
# Context Retrace Report

## Current Git State
...

## Recent Work Detected
...

## Task Continuity Assessment
...

## Risk Areas
...

## Recommended Next Step
...

No files have been modified during this retrace.
```

Only after this should implementation continue.

---

## Notes For Future Desktop Migration

The current project may still store most project data in a single project JSON file during the browser MVP stage.

That is acceptable as a temporary storage container.

However, the code should still be structured as if future desktop storage may split data into multiple files. This means:

- access project data through service boundaries
- avoid direct scattered mutation of the project JSON
- separate schema/domain records from UI projection records
- avoid tying durable project concepts to browser-only APIs
- keep save/load/autosave logic behind a clear persistence boundary

The storage container can change later. The domain ownership rules should not.
