# Project Save Model

## Canonical Save Package

The browser/desktop-prototype workflow currently treats the `.abe-project.json` snapshot routed through `ProjectPersistenceService` as durable project truth. Internally, that JSON uses a chunk-aware shape:

- project manifest records in `projects[]`
- scene content carried separately in `sceneStore`

A future desktop storage adapter may materialize that same boundary as `project.json` plus per-scene files under `manuscript/scenes/`, or another local storage backend. This is a transport migration, not permission for feature code to bypass `ProjectPersistenceService`.

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

Scene bodies are logically stored separately from manifest records. In the current JSON export/load flow they travel in `sceneStore`; a desktop folder-backed adapter may later store each scene as its own file. Manifest records keep scene order and scene-file references.

Manifest `projectIndex.scenes[]` also stores last-known per-scene metrics such as `wordCount` so writing-target dashboards can bootstrap from the master file before lazy-loading scene bodies.

## Workspace Metadata

Each manifest project keeps workspace metadata with:

- project structure and line-addressable manuscript indexes
- world templates, entities, spines, and edges
- analysis suggestion state
- narration session state
- voice profile and render state
- selection defaults for the UI

Revision history currently lives on the project record as `project.revisions`, where session metadata, event ledgers, diff summaries, and changed-entity lists can be normalized in-browser now and later mapped to a desktop `/revisions` folder without changing the service boundary.

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

The current host loads or saves a project snapshot through `ProjectPersistenceService`, which hydrates manifest/index state and scene content without merging stale browser project data into a newly loaded file. When folder-backed desktop storage is introduced, the host can load `project.json` first and resolve scene files separately while preserving the same service contract.

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

Any future migration between snapshot and folder-backed project shapes must be an explicit normalization step before data reaches the editor shell. The current `.abe-project.json` flow remains the active durable write target until a desktop storage migration is implemented and tested.
