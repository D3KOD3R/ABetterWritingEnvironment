# Features

Single merged feature reference and process tracker for [An AI augmented author writing environment. .docx](<./An AI augmented author writing environment. .docx>).

This file merges the Word-document feature definitions with the implementation process headers and progress notes. Use this as the active reference when working through numbered features.

## Feature 01 - Manuscript Issue Console

### Feature Definition

Gives the writer a structured, code-like review panel that logs detected issues in a clear event window and links each one directly to the relevant line or section of the manuscript. With optional AI augmentation, the system can analyse passages, explain what may need attention, and visually guide the user to exactly where changes should be made. The suite can also be used in an IDE-like mode, where manuscript lines are indexed and addressable, allowing the author to jump directly to flagged passages, navigate issues more easily, and work through revisions with software-development-style precision.

### Process Header

The writer reviews manuscript problems as structured diagnostics, with each issue linked to a stable manuscript anchor rather than vague prose feedback.

### Progress

- Status: Foundation implemented.
- Repository coverage: `IssueRecord`, `ManuscriptAnchor`, local analysis issue suggestions, issue console records, editor navigation to flagged scene lines, simplified issue-console headings, collapsible chapter groups in the issue, inspiration, research, and task consoles, chapter-grouped open task lists, collapsible manuscript chapter tabs, double-click editable binder chapter titles, double-click editable binder scene titles, double-click editable manuscript scene titles, scene-editor chapter breadcrumb sync, resizable left and right sidebar splitters, browser keyboard shortcuts for save/new/open/writing-goals/pane switching, right-click selected-text task creation with generated scene-order task titles, blue task-body instructions, thumbnail-hover task expansion, click-only manuscript references, draft-only inline editor inspiration/research bubbles with a normal manuscript verse field that preloads selected text or saves against the inserted typed verse, two-way inspiration/research navigation between saved manuscript ranges and side-panel note items, hover previews that glow the selected manuscript range, task-click navigation back to the editor range with fuzzy selected-text drift recovery, whitespace-click writing focus, caret-centering while typing, pane-local editor scrolling, scene task completion, app-owned Grammar Check underlines with an app-owned suggestions popup in the manuscript editor, now backed by a SCOWL-derived default wordlist plus the prior supplemental alpha list and contraction-aware matching, plus project-scoped dictionary and exception lists stored on each project save file, bulk-add actions from multi-word selections, and a movable grammar-check list panel with per-word checkboxes for batch project-dictionary approval, Ctrl+F manuscript find/replace that preserves the editor caret and scroll position when the panel opens, remaining-task chapter badges in the Manuscript panel, live manuscript word counts with release-date-aware projected-days forecasting and on-track/off-track hints, a Ctrl+Alt+T writing-target utility window, selectable top-header writing metrics, linked release-date and daily-target goal syncing, a session-split and inactivity timer panel with a 20-minute session time default, a 15-minute segment-close window, a 30-minute new-session window, resumable session history, and an idle session indicator that flips back to active on the first new manuscript edit, plus recent-snapshot words/minute pacing, red-to-blue-to-green progress signaling, and pulsing over-target glow, plus a full writing-goals dashboard modal with top summary cards, a month/week/list calendar, streak summary, selected-day detail panel, notes, and explicit save/cancel/reset actions, with the daily target tracker now counting words written today separately from the session tracker, a per-day progress archive with chapter/scene/issue/inspiration breakdown, a 30-day believable sample-history seeding action for tracker testing, a project save-file load command that emits manuscript, world, task, timeline, and template data with source provenance, nested source template sheets, full source-path provenance, retained source sheet text, file-backed desktop/browser logging, a saved-project library with browser load/save/create controls and file-backed Save As/load routes, and a documented project save model for the Serva Vitae reference fixture. The revision drafting UI is currently benched from the scene editor while its edit-history bookkeeping stays available in code for future undo/redo work. Modal dismissal is deliberate: a single outside click closes the writing-target window, but a pointer that starts inside the modal and is released outside should leave the window open.
- Note: The session tracker now renders as the full inline metrics panel with a circular WPM tracker, and its stateful pen artwork lives at `apps/editor/public/assets/icons/session-tracker-sleeping-pen.svg`, `apps/editor/public/assets/icons/session-tracker-working-pen.svg`, and `apps/editor/public/assets/icons/session-tracker-flaming-pen.svg`.
- Next work: promote local selected-text tasks into canonical anchored task records, add host-seeded passage-note/research records, persist task resolution with project data, and move the saved-project library from browser storage into a host-backed project store if needed later.

## Feature 02 - Local Writing Assistant

### Feature Definition

Provides real-time writing support by identifying potential issues as the author works, such as awkward phrasing, repetition, clarity problems, pacing concerns, or structural inconsistencies. It can run in a Local AI Only mode, where all analysis is performed directly on the user's own machine using their GPU, allowing the author to receive private, immediate feedback without sending manuscript content to any external service.

### Process Header

The writing assistant runs behind provider boundaries and returns local-first, anchored feedback that can be reviewed without making cloud execution a core dependency.

### Progress

- Status: Foundation implemented.
- Repository coverage: local rule analysis provider, provider descriptors, analysis job contracts, anchored issue/event suggestions, Local AI Only settings, provider-bounded Local AI Router service, `llama.cpp` OpenAI-compatible provider route, Tiny/Standard/Large routing policy, selected `Qwen/Qwen3-0.6B-GGUF` via `llama.cpp` as the first lightweight model-adapter target, desktop local-AI HTTP routes, Local AI title toggle, scene title suggestion button, editable task/inspiration/research titles, and top-level workspace pane tabs that replace status-card navigation.
- Next work: add incremental changed-block analysis, richer editor UI affordances for local AI actions, and configured Standard/Large local model adapters.

## Feature 03 - Event Pinning

### Feature Definition

Lets the program automatically detect and mark major story moments throughout a manuscript, such as deaths, first encounters, character introductions, key interactions, and other important plot developments. The writer can also describe a specific event in plain language, and the AI will locate the matching passage in the manuscript and place a user-defined tag directly on the relevant line, making it easier to track structure, revisit important beats, and navigate complex narratives.

### Process Header

Important story beats are modeled as anchored event tags that can be searched, navigated, and reused by continuity and worldbuilding workflows.

### Progress

- Status: Foundation implemented.
- Repository coverage: `EventTag`, event source typing, local event detection, event console records, and scene-line navigation.
- Next work: add author-defined event tagging from selected spans and richer event taxonomy controls.

## Feature 04 - Narration Follow Mode

### Feature Definition

Is a live reading view that listens to the narrator's voice, matches the spoken words against the manuscript in real time, and automatically keeps the current line or sentence centered on screen as the text scrolls smoothly ahead. Designed for audiobook recording, rehearsed narration, and long-form manuscript review, it reduces manual scrolling and page hunting, helping the reader stay locked onto the script with minimal interruption even if they pause, repeat a phrase, or momentarily lose their place.

### Process Header

Narration follow tracks a live read-through against canonical manuscript spans, keeping alignment state separate from editor rendering state.

### Progress

- Status: Foundation implemented.
- Repository coverage: narration session snapshots, alignment jobs, audio service contract, local alignment monitor, manuscript-style narration panel reuse, narration tool chips that arm a verse for recording, voice recording records with project-media pointers, a low-overhead browser capture path with optional speech-tracker state, the first modular extraction of the writing-target/session-tracker view into `apps/editor/public/features/progress-tracker.js` plus shared formatting helpers in `apps/editor/public/shared/ui-utils.js`, and the manuscript scene editor now split into `apps/editor/public/features/scene-editor.js` with the desktop host serving modular editor files generically from `apps/editor/public`.
- Next work: add pause/recover state transitions, better spoken-word-to-verse tracking, Whisper-based streaming alignment, follow-cursor recovery, and continue splitting the manuscript shell into feature-owned modules so parallel work can happen without editing the same monolith.

## Feature 05 - Character Voice Narration

### Feature Definition

Allows the author to produce full audiobook performances directly inside the writing suite by assigning distinct voices to different characters and narration roles across the manuscript. The system can either generate speech from text or convert the author's own spoken performance into selected character voices, making it possible for a single user to voice an entire cast while keeping dialogue delivery, speaker identity, and audio production linked directly to the manuscript structure.

### Process Header

Character voice narration maps manuscript speaker assignments to voice profiles and render jobs without hardwiring the editor to a specific speech engine.

### Progress

- Status: Foundation implemented.
- Repository coverage: characters, speaker assignments, legacy voice routing, narration voice profiles, narration jobs, queue transitions, placeholder rendering, local voice narration storage, right-side voice rail controls, speaker bindings, preview jobs, chapter render jobs, the editor Voice Narration foundation panel, and saved voice-recording cards with preview/open actions.
- Next work: add editable voice-profile assignment, per-verse voice selection, provider configuration, richer media persistence, and later alignment handoff.

## Feature 06 - World Spine View

### Feature Definition

Gives the author an interactive worldbuilding workspace built around visual timeline spines rather than flat notes pages. Events are placed as nodes along horizontal timelines, while selecting a node opens a linked vertical editing pane where the user can refine the reasoning, references, implications, and supporting notes behind that event. Multiple spines can be stacked for different planets, factions, characters, or story threads, with visual links showing where events intersect or influence one another, making large-scale chronology and causality easier to build, understand, and revise. Timeline nodes that affect other event nodes are shown in the timeline spine, with links between nodes across spines when events take place in another locality.

### Process Header

The world spine view represents chronology, locality, and causality as structured spines, nodes, and edges rather than flat notes.

### Progress

- Status: Foundation implemented.
- Repository coverage: `TimelineSpine`, `TimelineNode`, `TimelineEdge`, entity introduction links, cross-spine edges, world inspector, and timeline navigation.
- Next work: add direct node editing, filters, and visual edge drawing across lanes.

## Feature 07 - Dream Scaping

### Feature Definition

Dream Scaping is an outlier feature for moments where the writer has an idea or scene they feel is powerful and wants to integrate it into the story. Dream Scaping uses the AI assistant to inspect the overarching story and suggest how the idea might fit into the current manuscript. Later iterations can work with the worldbuilding spine.

### Process Header

Dream Scaping lets an author submit a powerful loose idea or scene and receive reviewable story-fit proposals against the current manuscript and world spine evidence.

### Progress

- Status: Foundation implemented on 2026-04-24.
- Repository coverage: `DreamScapeSuggestion`, `DreamScapeIdeaInput`, local `exploreDreamScape` analysis flow, dream-scaping job trigger, desktop workspace snapshot, editor Dream Scaping panel, and tests.
- Next work: add an author-facing idea submission form, accept/reject actions, and optional creation of reviewed timeline nodes or scene drafts.

## Feature 08 - Project Save File Loader

### Feature Definition

Allows a writer to open a local project save file or project folder into this application's canonical saved-project format. The loader preserves manuscript hierarchy, chapter and scene ordering, template sheets, source provenance, and whitespace in the loaded text so the manuscript can be loaded, reviewed, and revised locally without depending on any external source format at runtime.

### Process Header

The project loader imports a user-owned project save file, translates it into the app's normal project model, and stores it as a regular saved project while keeping the original source file untouched.

### Progress

- Status: Foundation implemented.
- Repository coverage: host-backed `/api/project-source` route, browser project-path input and load button, whitespace-preserving project text conversion, generic save-file path resolution, project-library merge/load flow for loaded projects, and file-backed load logging.
- Next work: add a folder/file picker, surface richer load diagnostics, and build a dedicated retained-template browser for loaded source template sheets.
