# Browser Prototype, Desktop Future

## Architectural Rule

"Browser mode is a workflow prototype and compatibility layer. Core app logic must not depend directly on browser-only APIs."

## Why We Are Still Developing Workflow in Browser

- Fast iteration on writing, issue-console, worldbuilding, narration, and voice workflows.
- Lower friction for UI prototyping and behavior testing before runtime lock-in.
- Easy contributor onboarding without requiring a desktop shell build pipeline for every change.

## Why Browser/`localStorage` Is Not the Final Storage Model

- Browser storage has quota and durability limits that are not suitable for long-form manuscript and audio projects.
- Browser storage does not represent the final desktop-first local filesystem ownership model.
- The product direction is a local-first manuscript/audio authoring application, not a browser SaaS editor.

## Current Simulation vs Future Runtime

- Current runtime: browser prototype.
- Current storage behavior:
  - `manifest` record + `scene records` are stored as separate logical records.
  - browser `localStorage` is used only through storage adapters (`browser-adapter`).
- Future runtime: desktop-first local application (`desktop-storage`), with real project package folders.

## Expected Desktop Project Package Structure

```text
project/
  project.json
  manuscript/
    scenes/
  assets/
    audio/
  transcripts/
  cache/
    waveforms/
    ai-index/
  exports/
```

## Portability Requirements

The following must remain portable across browser prototype and future desktop shells (Avalonia/C#, Electron, Tauri, Qt, or another native shell):

- manuscript chunking (`manifest` + `scene records`)
- project save/load orchestration
- autosave and project lifecycle rules
- issue/event/world/narration/voice domain logic
- service contracts and DTO shapes

## Runtime Boundary Labels

- `browser-adapter`: compatibility layer for browser-only capabilities.
- `desktop-storage`: future real project-folder package implementation.
- `projectService`: stable application boundary used by UI workflows.
- `scene records`: per-scene manuscript chunks portable across runtimes.
- `manifest`: project index and metadata, not full manuscript body.

## APIs Not Allowed in UI/Business Logic

UI and core workflow logic must not directly call:

- `window.localStorage`
- `window.showOpenFilePicker` / `window.showSaveFilePicker`
- `indexedDB` APIs
- future native shell APIs (Tauri/Electron/Qt/Avalonia bindings)

These calls must remain inside adapters/repositories/services so runtime replacement does not require workflow rewrites.

## Implementation Constraint

- Keep UI behavior development in browser for now.
- Do not treat browser runtime as final architecture.
- Continue adding features through `projectService` and storage adapters so desktop migration is incremental, not a rewrite.
