# Feature Map

Feature reference and process tracker: [features.md](../../features.md)

## Core Authoring

- The pane to the left is referred to as the Manuscript Overview. 
- There are notifications that pop up on scenes within the manuscript area. 
	- When local AI picks up issues, it can flag tasks in the scene that need attending to.
	- The user can also assign tasks to a section by right clicking in the edit area, the task is assigned to a highlighted text selected by the user. 
	- The user can mark tasks off as complete. 
- Scene editor viewport with local draft editing, width-driven visual line numbers, typography controls, and binder-side draft chapter/scene creation.
- Manuscript issue console backed by anchored issue records, simplified headings, chapter-grouped task review, and right-panel list modes for Issues, Inspiration, and Research.
- Selected-text task creation with a themed in-editor task-body composer, generated scene-order task titles, blue task-body instructions in task lists, click-only manuscript reference excerpts, inline editor inspiration/research bubbles with a normal manuscript verse field that preloads selected text or stays draft-only until saved against the inserted typed verse, issue-style note navigation, hover-to-glow manuscript previews, fuzzy task-click navigation, whitespace-click writing focus, caret-centering while typing, pane-local editor scrolling, and chapter-level remaining-task badges in the Manuscript panel.
- Editable project title and top-level workspace pane tabs for Manuscript, World, Narration, and Voice.
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

- Narration follow mode backed by alignment services.
- Character voice narration backed by speaker assignments and render jobs.
