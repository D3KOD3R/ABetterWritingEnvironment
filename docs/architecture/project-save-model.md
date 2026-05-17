# Project Save Model

## Canonical Save Package

The application now treats the chunked project package as canonical storage:

- `project.json` manifest
- per-scene files under `manuscript/scenes/`

Legacy single-file `*.abe-project.json` payloads are supported as migration input only.

## Manifest Shape

`project.json` is organized around:

- `schemaVersion`
- `activeProjectId`
- `projects[]` (manifest-only records)

Each manifest project record preserves:

- stable project identity
- project title
- source classification
- created/updated timestamps
- workspace metadata/index data
- browser/editor preferences
- local AI preferences
- manuscript tasks
- passage notes
- source archive entries
- project settings
- import/load report data

## Scene Chunks

Scene bodies are stored separately as one file per scene. Manifest records keep scene order and scene-file references.

Manifest `projectIndex.scenes[]` also stores last-known per-scene metrics such as `wordCount` so writing-target dashboards can bootstrap from the master file before lazy-loading scene bodies.

## Workspace Metadata

Each manifest project keeps workspace metadata with:

- project structure and line-addressable manuscript indexes
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

The desktop host loads a project package directory, reads `project.json` first, then resolves scene files separately. The editor loads manifest/index state first and reads scene content on demand. Saving a scene writes that scene chunk instead of rewriting one monolithic manuscript blob.

## ProjectPersistenceService Boundary

All project file persistence workflows now route through `ProjectPersistenceService` in `apps/editor/public/adapters/storage/project-persistence-service.js`.

- manual save
- save-as
- load from picker/path
- autosave scheduling and flush
- last-opened project restoration
- project snapshot export/download

UI and feature modules should call service methods (for example `saveProjectSnapshot`, `loadProjectSnapshotFromFile`, `restoreLastOpenedProject`) and must not directly call file-picker APIs, file-handle APIs, or project JSON read/write adapters.

## Review Boundary

Any future migration from older project shapes should be handled as an explicit normalization step before data reaches the editor shell. Single-file `.abe-project.json` is legacy import data, not the active write target.
