# Local-First Project Model

## Purpose

The editor UI should stay browser-friendly today while core project workflows remain portable to future desktop stacks such as Tauri, Electron, Avalonia, or native shells.

For the runtime direction and browser-compatibility guardrails, see [Browser Prototype, Desktop Future](./browser-prototype-desktop-future.md).

This note defines the boundary:

- UI events call a `projectService`.
- `projectService` calls repositories.
- repositories call storage adapters.
- only storage adapters touch browser storage APIs.

## Why UI Must Not Touch `localStorage` Directly

Direct storage calls from UI code create hard coupling between rendering logic and storage mechanics. That blocks portability and makes migrations risky.

Keeping storage inside adapters gives us:

- one place to handle serialization errors
- one place to apply schema migrations
- one contract to replace when moving to filesystem folders, SQLite, or host APIs

## Browser Runtime Layers

Current browser implementation:

- `apps/editor/public/adapters/storage/browser-storage-adapter.js`
- `apps/editor/public/adapters/storage/project-repository.js`
- `apps/editor/public/adapters/storage/preferences-repository.js`
- `apps/editor/public/adapters/storage/project-service.js`
- `apps/editor/public/adapters/storage/project-migrations.js`
- `apps/editor/public/adapters/storage/project-index.js`

Core project-service operations:

- `openProject()`
- `createProject()`
- `saveProject()`
- `saveScene(sceneId, content)`
- `loadScene(sceneId)`
- `listScenes()`
- `updateSceneMetadata(sceneId, metadata)`
- `registerAsset(asset)`
- `getProjectIndex()`
- `saveUserPreference(key, value)`
- `loadUserPreference(key)`

## Schema and Migration

Saved project library snapshots and project records now carry `schemaVersion`.

- current version: `2`
- migration entrypoint: `migrateProjectData(rawData)`

This supports forward evolution while preserving older project snapshots.

## Lightweight Project Index

Each project record includes a `projectIndex` with:

- `projectId`
- `projectTitle`
- `chapters`
- `scenes`
- `sceneOrder`
- per-scene metrics (`wordCount`) used by writing-target calculations before scene bodies are lazily loaded
- `assetIds`
- `assets` (with scene linkage + path/file refs)
- `fileRefs` (`projectFilePath`, `projectSourcePath`)
- timestamps
- `schemaVersion`

The index is lightweight, deterministic, and safe to regenerate.

## Scene-First Manuscript Access

The service exposes scene-level operations (`saveScene`, `loadScene`, `listScenes`) so the UI does not need to load or rewrite one giant manuscript blob for every edit.

The browser adapter now simulates a folder package by storing:

- one manifest record
- one logical record per scene

The desktop host writes a real package directory with `project.json` plus per-scene files.

## Future Folder Mapping

The active storage model is a folder-based project layout:

```text
project/
  project.json
  manuscript/
    chapters/
    scenes/
  assets/
    audio/
    images/
  transcripts/
  cache/
    waveforms/
    ai-index/
```

Legacy single-file `.abe-project.json` snapshots are read for migration only. New saves should target the chunked project package model.
