# Project Save Model

## Canonical Save File

The application treats `*.abe-project.json` as the canonical saved-project format. A project save file stores the active project selection, the project library, and the per-project workspace snapshots that power manuscript editing, worldbuilding, narration, voice rendering, and goal tracking.

## Top-Level Shape

The current project save format is organized around:

- `activeProjectId`
- `projects[]`

Each project record preserves:

- stable project identity
- project title
- source classification
- created/updated timestamps
- workspace snapshot data
- browser/editor preferences
- local AI preferences
- manuscript tasks
- passage notes
- source archive entries
- project settings
- import/load report data

## Workspace Snapshot

Each project stores a workspace snapshot with:

- project structure and line-addressable manuscript data
- world templates, entities, spines, and edges
- analysis suggestion state
- narration session state
- voice profile and render state
- selection defaults for the UI

## Source Provenance

Source provenance remains structured and reviewable. Records use generic source fields such as:

- `source`
- `sourceDocumentId`
- `sourceCommentId`
- `sourcePath`

These fields allow the app to preserve traceability without binding the schema to any external source format.

## Media and Archive Data

Source archive entries and project-media records point to app-owned asset locations rather than external source-package paths. That keeps the saved project standalone and portable across worktrees, launches, and future feature branches.

## Load and Save Flow

The desktop host loads a project save file or a project folder containing one, then normalizes the result into the in-memory project library snapshot used by the editor shell. Saving writes the current canonical project state back to the project file, while media assets remain project-owned and addressable by project-relative paths.

## Review Boundary

Any future migration from older project shapes should be handled as an explicit normalization step before the save file reaches the editor shell. The application should continue to treat the `.abe-project.json` file as the durable source of truth for the manuscript workspace.
