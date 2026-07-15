# Feature Map

Feature reference and process tracker: [features.md](../../features.md)

## Core Authoring

- The pane to the left is referred to as the Manuscript Overview. 
- There are notifications that pop up on scenes within the manuscript area. 
	- When local AI picks up issues, it can flag tasks in the scene that need attending to.
	- The user can also assign tasks to a section by right clicking in the edit area, the task is assigned to a highlighted text selected by the user. 
	- The user can mark tasks off as complete. 
- Scene editor viewport with local draft editing, cumulative manuscript line numbers, a compact chapter/scene masthead with one grammar-check control, typography controls, binder-side draft chapter/scene creation, resizable left/right side panels, browser keyboard shortcuts for save/new/open/writing-goals/pane switching, live manuscript word counts, release-date-aware projected-days forecasting, linked release-date and daily-target goal syncing, selectable top-header writing metrics, a Ctrl+Alt+T floating writing-target window, a session-split and inactivity timer panel with a 5-minute idle cutoff, a 15-minute segment-close window, a 30-minute new-session window, resumable session history, and an idle session indicator that returns to active on the first new manuscript edit, a top-header session tracker card with recent-snapshot words/minute pacing, red-to-blue-to-green progress signaling, and pulsing over-target glow, while the daily target card tracks words written today separately from the session bar, and the goals modal expands into a full dashboard with summary cards, calendar month/week/list views, streaks, selected-day details, notes, and save/cancel/reset actions, plus a per-day progress archive and a 30-day sample-history seeding action for tracker testing. Modal dismissal is deliberate: a single outside click closes the writing-target window, but a pointer that starts inside the modal and is released outside should not close it.
- Revision-history banking plumbing with session aggregation, diff previews, a standalone revisions window, a revision-history model controller, and a storage adapter behind the benched scene-editor revision overlay.
- Manuscript issue console backed by anchored issue records, simplified headings, collapsible chapter groups for tasks, issues, inspiration, and research, chapter-grouped task review, and right-panel list modes for Issues, Inspiration, and Research.
- Selected-text task creation with a themed in-editor task-body composer, generated scene-order task titles, blue task-body instructions in task lists, thumbnail-hover task expansion, click-only manuscript reference excerpts, inline editor inspiration/research bubbles with a normal manuscript verse field that preloads selected text or stays draft-only until saved against the inserted typed verse, two-way inspiration/research navigation between saved manuscript ranges and side-panel note items, hover-to-glow manuscript previews, fuzzy task-click navigation, whitespace-click writing focus, caret-centering while typing, pane-local editor scrolling, chapter-level remaining-task badges in the Manuscript panel, and collapsible manuscript chapter tabs.
- Inline manuscript formatting is kept separate from render-only decorations: user highlights and selected Bold marks now write canonical manuscript marks, and author marks render through author-mark projections without adding a separate Decorations right-panel tab; italic, underline, and strikethrough still start from scene compatibility ranges that synchronize into schema-shaped marks on scene persistence, while spellcheck, AI proposals, hover previews, and narration tracking remain projected visual channels.
- Draft proof-read runs live in a dedicated top proof-read panel beside Developer Logs, letting the author activate a manuscript pass and recall which spans were read during that pass. The editor expands proof-read coverage from viewport movement, selection/caret activity, and active edits, persists the run with the project record, keeps the latest completed pass visible when no run is active, and renders it as a soft transparent underlay beneath stronger author highlights.
- The primary manuscript editor is scheduled to migrate from the textarea-overlay compatibility host to a direct ProseMirror host. ProseMirror will own runtime editing, selection, history, DOM rendering, and decorations for one open scene; canonical manuscript structure, stable IDs, anchors, marks, feature records, revision banking, and project persistence remain application-owned. Cutover is gated feature by feature across binder operations, metrics, navigation, spellcheck, anchored records, AI review, events, narration, voice, find/replace, and persistence.
- Project save-file loading for local `.abe-project.json` files or project folders, including a host-backed load route, browser path input, whitespace-preserving manuscript persistence, template retention, saved-project library merging, file-backed Save As/load support, and desktop-style resizable side panes.
- Project save planning for the Serva Vitae reference fixture, including the load command that now emits manuscript chapters/scenes, source-linked comments as tasks, worldbuilding documents, nested station/fauna sheets, preserved source template sheets, timeline records, media-aware research notes with source provenance, full source-path logging, and a saved-project seed that can be loaded, saved, and recreated from the browser UI.
- Top-level workspace pane tabs for Manuscript, World, Narration, and Voice, with the active project file identity exposed from the File button hover instead of consuming persistent chrome space.
- Local writing assistant backed by provider-agnostic analysis services and a Local AI Router with Tiny, Standard, and Large capability tiers. `Qwen/Qwen3-0.6B-GGUF` through `llama.cpp` is selected as the first Tiny-tier local model adapter target. The editor includes a Local AI title toggle, scene title suggestion button, and editable generated titles for tasks, inspiration, and research notes.
- Event pinning backed by anchored event tags.
- Dream Scaping backed by reviewable, evidence-linked story-fit proposals.

## Worldbuilding

- World templates with typed fields.
- World template draft creation from the world inspector.
- Entity instantiation with stable IDs and template ancestry.
- World spine timelines with nodes, edges, and introduction links.
- Reviewable world suggestion queue for missing templates, entities, and cross-spine links.

## Audio Production

- Narration follow mode backed by alignment services, Whisper-shaped chunked STT, and the manuscript-style narration panel with verse-armed recording controls.
- Character voice narration backed by speaker assignments and render jobs, plus a local-first voice narration foundation for profiles, queue state, placeholder rendering, right-side voice rail controls, saved take cards, preview/open actions, and local media pointers.

## Mobile Authoring (Planned)

- `MobileFriendlyArchitecture` defines a phone-first, voice-first companion surface for dictating new prose while the writer is away from the desktop, with optional manuscript context before or after capture.
- Dictated writing is separate from narration recording: speech creates a reviewable transcript and anchor-backed insertion proposal, and only accepted text becomes canonical manuscript content.
- Compact layouts prioritize a single manuscript/capture surface, touch-sized recording controls, bottom navigation, safe-area and keyboard handling, offline recovery, and explicit project transfer or conflict review.
- The mobile companion should expose adapted issues, tasks, events, targets, analysis, narration, voice, and world views where practical, while keeping dense production and timeline interactions desktop/tablet-first initially.
- Architecture source: [MobileFriendlyArchitecture](../architecture/mobile-friendly-architecture.md).
