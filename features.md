# Features

Single merged feature reference and process tracker for [An AI augmented author writing environment. .docx](<./An AI augmented author writing environment. .docx>).

This file merges the Word-document feature definitions with the implementation process headers and progress notes. Use this as the active reference when working through numbered features.

## Feature ID Rule

Feature IDs use a parent number plus a testable workflow number, then a lowercase letter for individual checks, for example `Feature 1.3c`. The parent number keeps the workflow tied to the original product feature area, the middle number identifies a specific feature workflow, and the letter identifies a precise interaction that can be tested, debugged, ported, or reported independently.

When a workflow grows large enough to need separate testing, add a new numbered feature set with indented lettered checks instead of folding it into a broad progress paragraph. Keep the same ID in:
- the parent feature's `Testable Subfeatures` list
- the `Feature Implementation Index`
- bug reports, porting notes, and manual test checklists

## Feature Confirmation Rule

When the user says `Feature working`, that phrase confirms the current feature or workflow is accepted and must be documented immediately. Update the relevant numbered feature section and the implementation index in this file before moving on to unrelated work.

The update must:
- describe the feature in product terms, not only as a code change
- place it under the closest numbered feature area
- assign or update the most specific feature/check ID, for example `Feature 1.6b`
- add or revise the `Feature Implementation Index` entry with code locations and line numbers
- include the execution flow from user action to state update, persistence, rendering, logging, or tests where relevant
- note any classification decision if the feature spans more than one feature area

## Feature 01 - Manuscript Issue Console

### Feature Definition

Gives the writer a structured, code-like review panel that logs detected issues in a clear event window and links each one directly to the relevant line or section of the manuscript. With optional AI augmentation, the system can analyse passages, explain what may need attention, and visually guide the user to exactly where changes should be made. The suite can also be used in an IDE-like mode, where manuscript lines are indexed and addressable, allowing the author to jump directly to flagged passages, navigate issues more easily, and work through revisions with software-development-style precision.

### Process Header

The writer reviews manuscript problems as structured diagnostics, with each issue linked to a stable manuscript anchor rather than vague prose feedback.

### Testable Subfeatures

1.1 Anchored manuscript diagnostics console

   The writer sees manuscript problems as structured issue records rather than loose comments. The code keeps each issue tied to a canonical manuscript anchor so clicking an issue can resolve back to a scene, block, line, or span even after the editor rerenders.
   1.1a Issue records include severity, category, source, confidence, and anchor data.
   1.1b Issue panel rows render as actionable diagnostics.
   1.1c Clicking an issue navigates back to the flagged manuscript location.

1.2 Context-aware scene insertion

   When the author is actively editing scene `x`, pressing New Scene inserts the new draft scene immediately after that scene instead of appending it to the end of the binder. The code captures the active editor scene from pointer, focus, and typing events, then writes the resulting order into `structureDrafts.sceneOrder` so autosave and refresh preserve the placement.
   1.2a Pointer/focus/input events mark the scene currently being edited.
   1.2b New Scene resolves the active scene as the insertion anchor.
   1.2c The new scene is inserted at `x + 1` in the same chapter and selected immediately.

1.3 Manuscript spellcheck and project dictionary

   The manuscript editor underlines local spelling issues while the author writes and lets them resolve a word from an app-owned context menu or grammar-check panel. The code builds a project-aware lexicon from the base word lists, manuscript terms, project dictionary entries, and exception lists so invented names and world terms can become trusted project vocabulary.
   1.3a Right-clicking a misspelled word opens a suggestions dropdown.
   1.3b Selecting a suggestion replaces the exact flagged word range in the scene draft.
   1.3c Add-to-dictionary and exception actions update project-scoped spellcheck settings.
   1.3d The grammar-check list supports batch approval of selected words.
   1.3e When a word is flagged, there is a red underline squiggle showing the user.
   1.3f The user can turn on and off the spell check feature with the grammar checkbox built into the UI.

1.4 Manuscript find and replace

   Ctrl+F opens a manuscript find panel that searches structured scene text without treating the editor as a flat browser document. The code preserves caret and scroll state while navigating matches, then applies replacements through scene-draft mutation paths so word counts, dirty state, and persistence stay consistent.
   1.4a Opening the find panel can preload selected text.
   1.4b Next/previous navigation selects and centers the matching scene range.
   1.4c Replace Current changes only the active match.
   1.4d Replace All mutates all matching scene drafts through the editor model path.

1.5 Anchored task, inspiration, and research notes

   The author can select manuscript text and turn it into a task, inspiration note, or research note that remains linked to the passage. The code stores scene IDs, offsets, selected text, source type, and note/task metadata, then uses exact and fuzzy matching to recover the range if nearby text changes.
   1.5a Selected text can create a scene-linked task.
   1.5b Selected text can create an inline inspiration or research note.
   1.5c Side-panel note/task clicks navigate back to the saved manuscript range.
   1.5d Fuzzy drift recovery attempts to relocate a note when text has shifted.

1.6 Binder scene and chapter management

   The binder lets the author manage chapters and scenes as story structure, including creation, title editing, ordering, collapse state, trimming, and deletion. The code mutates draft structure overlays and cleans scene-linked metadata so tasks, notes, narration, voice jobs, and selected state do not point at deleted or moved scene records.
   1.6a Chapter and scene titles can be edited from binder/editor surfaces.
   1.6b Scene drag/drop writes an explicit `sceneOrder` overlay.
   1.6c Scene deletion cleans linked task, note, narration, voice, and selection metadata.
   1.6d Scene trimming normalizes whitespace while preserving the draft scene identity.

1.7 Scene editor focus, viewport, and line-aware navigation

   The scene editor remembers where the author is working so navigation, refreshes, and diagnostics land in useful manuscript positions instead of resetting the writing surface. The code captures selection offsets, viewport scroll, line metrics, and layout measurements, then restores them after rerenders or targeted navigation.
   1.7a Selection changes capture scene, offsets, line number, and viewport state.
   1.7b Issue/task/note navigation restores the intended caret and scroll location.
   1.7c Gutter, textarea, underline layer, and line metrics are synchronized.
   1.7d Clicking editor whitespace moves focus into the nearest useful writing position.

1.8 Writing targets, daily progress, and session tracker

   The writing target system turns manuscript edits into live progress, pacing, session, and calendar history rather than a simple static word count. The code separates total manuscript words from words written today, records session samples and baselines, and persists dashboard state with the project record.
   1.8a Header metrics show selectable writing target, projected-days, and pacing data.
   1.8b The session tracker records active, idle, split, and resumed writing sessions.
   1.8c The writing-goals dashboard shows calendar, streak, selected-day, and note views.
   1.8d Per-day history archives chapter, scene, issue, inspiration, and progress data.

1.9 Revision session banking

   Revision banking records a structured revision session around manuscript changes so future undo, review, and export workflows can inspect what changed. The code normalizes stored revision state, builds project digests, records events, stages diffs, and renders grouped banked sessions through a dedicated revision history model and a standalone revisions window mockup.
   1.9a Starting a session captures a baseline project digest.
   1.9b Revision events aggregate into a session ledger.
   1.9c Staging a session produces changed-entity and summary data.
   1.9d Banked sessions persist through the revision storage adapter.
   1.9e The revisions window opens beside the writing-goals control and presents a developer-style before/after compare surface.

1.10 Manuscript inline formatting commands

   The scene editor routes bold, italic, underline, and highlight through a shared command controller so toolbar actions affect only the selected manuscript span or the active insertion point. Inline style state is stored as scene-draft range metadata and rendered through the editor overlay, keeping literal markup out of the manuscript body.
   1.10a Selecting text and pressing a format control toggles only that selected span in structured range metadata.
   1.10b Pressing a format control at a collapsed caret creates a pending insertion point for newly typed formatted text.
   1.10c Bold, italic, underline, and highlight share the same command controller, selection resolver, range mutation path, toolbar state update, render layer, and tests.

### Progress

- Status: Foundation implemented.
- Repository coverage: `IssueRecord`, `ManuscriptAnchor`, local analysis issue suggestions, issue console records, editor navigation to flagged scene lines, simplified issue-console headings, collapsible chapter groups in the issue, inspiration, research, and task consoles, chapter-grouped open task lists, collapsible manuscript chapter tabs, double-click editable binder chapter titles, double-click editable binder scene titles, double-click editable manuscript scene titles, scene-editor chapter breadcrumb sync, resizable left and right sidebar splitters, browser keyboard shortcuts for save/new/open/writing-goals/pane switching, right-click selected-text task creation with generated scene-order task titles, blue task-body instructions, thumbnail-hover task expansion, click-only manuscript references, draft-only inline editor inspiration/research bubbles with a normal manuscript verse field that preloads selected text or saves against the inserted typed verse, two-way inspiration/research navigation between saved manuscript ranges and side-panel note items, hover previews that glow the selected manuscript range, task-click navigation back to the editor range with fuzzy selected-text drift recovery, whitespace-click writing focus, caret-centering while typing, pane-local editor scrolling, scene task completion, app-owned Grammar Check underlines with an app-owned suggestions popup in the manuscript editor, now backed by a SCOWL-derived default wordlist plus the prior supplemental alpha list and contraction-aware matching, plus project-scoped dictionary and exception lists stored on each project save file, bulk-add actions from multi-word selections, and a movable grammar-check list panel with per-word checkboxes for batch project-dictionary approval, Ctrl+F manuscript find/replace that preserves the editor caret and scroll position when the panel opens, remaining-task chapter badges in the Manuscript panel, live manuscript word counts with release-date-aware projected-days forecasting and on-track/off-track hints, a Ctrl+Alt+T writing-target utility window, selectable top-header writing metrics, linked release-date and daily-target goal syncing, a session-split and inactivity timer panel with a 20-minute session time default, a 15-minute segment-close window, a 30-minute new-session window, resumable session history, and an idle session indicator that flips back to active on the first new manuscript edit, plus recent-snapshot words/minute pacing, red-to-blue-to-green progress signaling, and pulsing over-target glow, plus a full writing-goals dashboard modal with top summary cards, a month/week/list calendar, streak summary, selected-day detail panel, notes, and explicit save/cancel/reset actions, with the daily target tracker now counting words written today separately from the session tracker, a per-day progress archive with chapter/scene/issue/inspiration breakdown, a 30-day believable sample-history seeding action for tracker testing, a project save-file load command that emits manuscript, world, task, timeline, and template data with source provenance, nested source template sheets, full source-path provenance, retained source sheet text, file-backed desktop/browser logging, a saved-project library with browser load/save/create controls and file-backed Save As/load routes, and a documented project save model for the Serva Vitae reference fixture. The revision drafting UI is currently benched from the scene editor while a new revision-history service, diff/event/model modules, revision storage adapter, and standalone revisions window mockup preserve the bookkeeping and review path for future undo/redo and banking workflows. The right-hand console now stays focused on Tasks, Inspiration, and Research; revision review has moved out of that dock. Modal dismissal is deliberate: a single outside click closes the writing-target window, but a pointer that starts inside the modal and is released outside should leave the window open; the revisions window now follows the same deliberate close behavior.
- Process update (2026-05-21): confirmed context-aware scene insertion. When the author is editing scene `x`, the New Scene action creates the next draft scene at `x + 1` in the same chapter and persists that placement through the scene-order overlay instead of appending to the end of the binder.
- Revisions window testing now includes a repeatable fixture seeder and on-disk revision package writer for `revision.json`, `events.json`, `project.diff.json`, and `summary.md` outputs derived from `SaveTestFile/RevisionsTest/RevisionsTestOriginFileproject-serva-vitae.abe-project.json`, and that source fixture now carries seeded `REVISIONSTEST` manuscript text plus banked revision sessions for window inspection.
- Process update (2026-05-21): revision review now lives in a standalone window mockup opened from the top chrome beside Writing Goals, and the right-hand console no longer has a Revisions tab. The UI presents session filters, a changed-file rail, changed entities, and side-by-side before/after digest operations so the author can review banked revisions with developer diff ergonomics before final design implementation.
- Process update (2026-05-22): manuscript inline formatting now stores bold, italic, underline, and highlight as scene-draft range metadata rendered by the editor overlay, replacing literal inserted HTML tags and the older scene-wide italic preference path.
- Process update (2026-05-23): established the manuscript mark/decoration projection boundary in `docs/architecture/manuscript-decoration-layer.md`. Author-applied inline formatting remains a scene-record compatibility field during the browser slice, now survives project JSON save/load and refresh through scene normalization, and must later be promoted to canonical anchor-backed manuscript marks rather than combined with spellcheck, AI-suggestion, hover, or narration visuals.
- Process update (2026-05-28): completed the current refactor checkpoint without changing the author-facing workflow contract. Manuscript find/replace derivation, input sequencing, selection policy, anchored task/note preview planning, projection selection, and textarea host rendering now have explicit feature/adapter owners; project-library normalization, project-record assembly, and activation orchestration now have explicit state owners. The visible workflows remain Features `1.3`, `1.4`, `1.5`, `1.7`, `1.10`, and `8.2-8.5`, with runtime projections kept outside durable project data.
- Note: The session tracker now renders as the full inline metrics panel with a circular WPM tracker, and its stateful pen artwork lives at `apps/editor/public/assets/icons/session-tracker-sleeping-pen.svg`, `apps/editor/public/assets/icons/session-tracker-working-pen.svg`, and `apps/editor/public/assets/icons/session-tracker-flaming-pen.svg`.
- Next work: promote local selected-text tasks into canonical anchored task records, add host-seeded passage-note/research records, persist task resolution with project data, and move the saved-project library from browser storage into a host-backed project store if needed later.

## Feature 02 - Local Writing Assistant

### Feature Definition

Provides real-time writing support by identifying potential issues as the author works, such as awkward phrasing, repetition, clarity problems, pacing concerns, or structural inconsistencies. It can run in a Local AI Only mode, where all analysis is performed directly on the user's own machine using their GPU, allowing the author to receive private, immediate feedback without sending manuscript content to any external service.

### Process Header

The writing assistant runs behind provider boundaries and returns local-first, anchored feedback that can be reviewed without making cloud execution a core dependency.

### Testable Subfeatures

2.1 Local AI provider routing

   The assistant routes local writing requests through provider contracts instead of calling a model directly from the editor. The code selects a model tier, builds a provider-safe prompt, and returns structured fallback results when a local provider is unavailable.
   2.1a Provider descriptors define local model capabilities.
   2.1b Routing policy selects Tiny, Standard, or Large model tiers.
   2.1c Unavailable providers return structured non-destructive failures.

2.2 Local AI editor preference

   The Local AI Only toggle lets the author control whether writing assistance should stay on the local machine. The code persists the preference with editor/project state so UI actions can respect local-first behavior after refresh or project reload.
   2.2a The Local AI toggle is exposed in the editor chrome.
   2.2b Preference state persists with project/editor settings.
   2.2c Local AI UI actions check the current preference before invoking assistance.

2.3 Local AI scene-title suggestion

   The author can request a scene title suggestion from the active scene editor. The code sends scene context through the local AI router and applies the returned title through normal scene-draft update logic so persistence, rendering, and dirty state stay consistent.
   2.3a The scene editor exposes a title suggestion action.
   2.3b Scene text and context are converted into a local AI request.
   2.3c Accepted title output updates the current scene draft title.

2.4 Anchored writing analysis suggestions

   Local analysis can identify writing issues and event candidates while preserving manuscript addressability. The code translates analysis output into issue/event suggestions with canonical anchors so the editor can navigate the author back to the relevant scene text.
   2.4a Rule analysis emits anchored issue suggestions.
   2.4b Event evidence emits anchored event suggestions.
   2.4c Suggestions remain reviewable and do not silently mutate manuscript structure.

### Progress

- Status: Foundation implemented.
- Repository coverage: local rule analysis provider, provider descriptors, analysis job contracts, anchored issue/event suggestions, Local AI Only settings, provider-bounded Local AI Router service, `llama.cpp` OpenAI-compatible provider route, Tiny/Standard/Large routing policy, selected `Qwen/Qwen3-0.6B-GGUF` via `llama.cpp` as the first lightweight model-adapter target, desktop local-AI HTTP routes, Local AI title toggle, scene title suggestion button, editable task/inspiration/research titles, and top-level workspace pane tabs that replace status-card navigation.
- Next work: add incremental changed-block analysis, richer editor UI affordances for local AI actions, and configured Standard/Large local model adapters.

## Feature 03 - Event Pinning

### Feature Definition

Lets the program automatically detect and mark major story moments throughout a manuscript, such as deaths, first encounters, character introductions, key interactions, and other important plot developments. The writer can also describe a specific event in plain language, and the AI will locate the matching passage in the manuscript and place a user-defined tag directly on the relevant line, making it easier to track structure, revisit important beats, and navigate complex narratives.

### Process Header

Important story beats are modeled as anchored event tags that can be searched, navigated, and reused by continuity and worldbuilding workflows.

### Testable Subfeatures

3.1 Anchored event detection

   Event detection scans manuscript blocks for major story moments and returns suggestions rather than silently tagging the project. The code packages each suggestion with an excerpt and manuscript anchor so it can be reviewed, searched, and later reused by continuity or worldbuilding tools.
   3.1a Analysis detects candidate story events from manuscript text.
   3.1b Event suggestions include excerpt, kind, confidence, and anchor data.
   3.1c Detection remains advisory until accepted into canonical project data.

3.2 Event tag persistence model

   Accepted or seeded events use canonical `EventTag` objects instead of plain highlights. The code stores event kind, source, confidence, and anchor fields so timeline, issue-console, and worldbuilding workflows can resolve the same story beat consistently.
   3.2a `EventTag` records preserve source and kind metadata.
   3.2b Event tags attach to canonical manuscript anchors.
   3.2c Persisted tags can be reused by later continuity and timeline systems.

3.3 Event console navigation foundation

   Event suggestions share the same addressable navigation principle as manuscript issues. The code renders event-like records through the console path and relies on anchors to navigate back to the appropriate scene line or passage.
   3.3a Event rows can be rendered beside issue-console records.
   3.3b Clicking an event resolves the target manuscript location.
   3.3c Event navigation avoids screen-coordinate or DOM-only references.

### Progress

- Status: Foundation implemented.
- Repository coverage: `EventTag`, event source typing, local event detection, event console records, and scene-line navigation.
- Next work: add author-defined event tagging from selected spans and richer event taxonomy controls.

## Feature 04 - Narration Follow Mode

### Feature Definition

Is a live reading view that listens to the narrator's voice, matches the spoken words against the manuscript in real time, and automatically keeps the current line or sentence centered on screen as the text scrolls smoothly ahead. Designed for audiobook recording, rehearsed narration, and long-form manuscript review, it reduces manual scrolling and page hunting, helping the reader stay locked onto the script with minimal interruption even if they pause, repeat a phrase, or momentarily lose their place.

### Process Header

Narration follow tracks a live read-through against canonical manuscript spans, keeping alignment state separate from editor rendering state.

### Testable Subfeatures

4.1 Narration session service

   Narration follow state is represented as session and alignment data rather than being hidden inside the editor UI. The code keeps audio-session state separate from rendering state so a future live follow engine can pause, recover, and align against canonical manuscript spans.
   4.1a Narration sessions are explicit service records.
   4.1b Alignment jobs use typed request/status/result data.
   4.1c Session state can evolve independently from editor layout.

4.2 Anchored narration take recording

   The author can select or arm a manuscript verse and record a take linked to that passage. The code records scene, block, and span metadata with the take so saved audio remains traceable after the editor rerenders or metadata is synchronized.
   4.2a Verse selection arms a passage for recording.
   4.2b Record, stop, and finalize actions create a take session.
   4.2c Saved takes retain manuscript anchor and media pointer data.

4.3 Narration recording tools UI

   The narration controls live inside the manuscript-oriented scene editor instead of a detached audio tool. The code renders armed verse state, recording status, narration chips, and saved take cards so the author can work from the script while recording.
   4.3a Narration mode displays recording controls near the manuscript.
   4.3b Recording status updates as the take moves through runtime states.
   4.3c Saved take cards expose preview/open actions where available.

4.4 Narration metadata synchronization

   Narration records must survive ordinary manuscript edits where their original scene and block still resolve. The code synchronizes session and alignment metadata against current manuscript structure to keep take records tied to usable anchors.
   4.4a Session metadata is reconciled with current scene/block records.
   4.4b Alignment job metadata is synchronized after manuscript structure changes.
   4.4c Broken or stale references are isolated for later recovery handling.

### Progress

- Status: Foundation implemented.
- Repository coverage: narration session snapshots, alignment jobs, audio service contract, local alignment monitor, manuscript-style narration panel reuse, narration tool chips that arm a verse for recording, voice recording records with project-media pointers, a low-overhead browser capture path with optional speech-tracker state, the first modular extraction of the writing-target/session-tracker view into `apps/editor/public/features/progress-tracker.js` plus shared formatting helpers in `apps/editor/public/shared/ui-utils.js`, and the manuscript scene editor now split into `apps/editor/public/features/scene-editor.js` with the desktop host serving modular editor files generically from `apps/editor/public`.
- Next work: add pause/recover state transitions, better spoken-word-to-verse tracking, Whisper-based streaming alignment, follow-cursor recovery, and continue splitting the manuscript shell into feature-owned modules so parallel work can happen without editing the same monolith.

## Feature 05 - Character Voice Narration

### Feature Definition

Allows the author to produce full audiobook performances directly inside the writing suite by assigning distinct voices to different characters and narration roles across the manuscript. The system can either generate speech from text or convert the author's own spoken performance into selected character voices, making it possible for a single user to voice an entire cast while keeping dialogue delivery, speaker identity, and audio production linked directly to the manuscript structure.

### Process Header

Character voice narration maps manuscript speaker assignments to voice profiles and render jobs without hardwiring the editor to a specific speech engine.

### Testable Subfeatures

5.1 Voice profile and speaker binding model

   Character voice narration starts by separating manuscript speaker identity from the audio engine that may eventually render it. The code normalizes voice profiles and speaker bindings through provider-neutral service contracts so narrator, character, and future conversion voices can be swapped without changing manuscript data.
   5.1a Voice profiles normalize names, roles, and provider references.
   5.1b Speaker bindings map manuscript speakers to voice profiles.
   5.1c Provider details remain behind service boundaries.

5.2 Voice render job lifecycle

   Voice output is modeled as explicit jobs rather than hidden async UI state. The code moves preview and chapter render jobs through draft, queued, rendering, rendered, failed, and cancelled states so long-running audio work can be inspected and retried.
   5.2a Preview and chapter render jobs are created from manuscript context.
   5.2b Queue transitions are explicit and status-bearing.
   5.2c Failed and cancelled jobs remain inspectable.

5.3 Voice narration storage

   Generated or recorded voice assets need to remain traceable to the manuscript locations that produced them. The code stores local voice narration records with output pointers and metadata so project media can be reopened or reconciled later.
   5.3a Voice narration records persist profile/job/output metadata.
   5.3b Stored outputs retain project-media pointers.
   5.3c Storage normalizes legacy and current voice record shapes.

5.4 Editor voice narration controls

   The editor exposes voice controls where the author can inspect bindings, create previews, and review saved narration records. The code keeps those controls connected to voice services while avoiding direct coupling to a specific TTS or conversion engine.
   5.4a The right-side voice rail exposes voice narration actions.
   5.4b Saved recording cards display preview/open actions.
   5.4c Editor job helpers create service-backed narration jobs.

### Progress

- Status: Foundation implemented.
- Repository coverage: characters, speaker assignments, legacy voice routing, narration voice profiles, narration jobs, queue transitions, placeholder rendering, local voice narration storage, right-side voice rail controls, speaker bindings, preview jobs, chapter render jobs, the editor Voice Narration foundation panel, and saved voice-recording cards with preview/open actions.
- Next work: add editable voice-profile assignment, per-verse voice selection, provider configuration, richer media persistence, and later alignment handoff.

## Feature 06 - World Spine View

### Feature Definition

Gives the author an interactive worldbuilding workspace built around visual timeline spines rather than flat notes pages. Events are placed as nodes along horizontal timelines, while selecting a node opens a linked vertical editing pane where the user can refine the reasoning, references, implications, and supporting notes behind that event. Multiple spines can be stacked for different planets, factions, characters, or story threads, with visual links showing where events intersect or influence one another, making large-scale chronology and causality easier to build, understand, and revise. Timeline nodes that affect other event nodes are shown in the timeline spine, with links between nodes across spines when events take place in another locality.

### Process Header

The world spine view represents chronology, locality, and causality as structured spines, nodes, and edges rather than flat notes.

### Testable Subfeatures

6.1 Structured world model

   Worldbuilding data is stored as typed templates, entities, spines, nodes, edges, and links instead of decorative notes. The code gives chronology and locality stable IDs so world events can be filtered, linked, and reused by manuscript and continuity workflows.
   6.1a World models contain typed templates, entities, spines, nodes, and edges.
   6.1b Timeline nodes and edges preserve stable IDs.
   6.1c World links can reference manuscript and timeline anchors.

6.2 Template-driven entity instantiation

   Templates act as blueprints for reusable world entities such as planets, factions, cultures, or technologies. The code preserves template ancestry, typed fields, and user-edited values so created entities remain structured and portable.
   6.2a Templates define typed entity fields.
   6.2b Instantiated entities get stable IDs and template ancestry.
   6.2c User-edited field data stays attached to the entity record.

6.3 Timeline spine rendering

   The world spine view renders horizontal timeline lanes and supporting inspection panels so the author can reason about chronology visually. The code reads structured spine/node data and renders selected node, entity, template, and suggestion context without flattening the model into notes.
   6.3a Spine lanes render from timeline spine records.
   6.3b Selected node/entity panels show structured context.
   6.3c World inspector cards expose templates, entities, and suggestions.

6.4 Cross-spine causality links

   Events on different spines can influence one another and should be represented as explicit links. The code models timeline edges and entity introductions so causality, locality, and presence can be followed across planets, factions, characters, or story threads.
   6.4a Timeline edges connect events across spines.
   6.4b Entity introductions link entities to timeline/manuscript anchors.
   6.4c Link rendering foundations expose cross-spine relationships.

6.5 Reviewable world suggestions

   AI worldbuilding assistance can suggest templates, entities, and links but must not mutate canonical world data by itself. The code keeps suggestions advisory and evidence-linked so the author can accept or reject structural changes deliberately.
   6.5a Analysis can suggest world templates and entities.
   6.5b Suggested cross-spine links remain reviewable.
   6.5c Canonical world data changes only after explicit acceptance.

### Progress

- Status: Foundation implemented.
- Repository coverage: `TimelineSpine`, `TimelineNode`, `TimelineEdge`, entity introduction links, cross-spine edges, world inspector, and timeline navigation.
- Next work: add direct node editing, filters, and visual edge drawing across lanes.

## Feature 07 - Dream Scaping

### Feature Definition

Dream Scaping is an outlier feature for moments where the writer has an idea or scene they feel is powerful and wants to integrate it into the story. Dream Scaping uses the AI assistant to inspect the overarching story and suggest how the idea might fit into the current manuscript. Later iterations can work with the worldbuilding spine.

### Process Header

Dream Scaping lets an author submit a powerful loose idea or scene and receive reviewable story-fit proposals against the current manuscript and world spine evidence.

### Testable Subfeatures

7.1 Dream-scaping request and result contracts

   Dream Scaping starts with a loose author idea and turns it into structured suggestion data. The code records the idea input, fit classification, placement target, and suggestion status so later UI and acceptance flows can handle it predictably.
   7.1a Idea input is represented as a typed request.
   7.1b Fit and placement results classify where the idea may belong.
   7.1c Suggestion status stays explicit and reviewable.

7.2 Reviewable story-fit suggestion generation

   The analysis service compares the loose idea against manuscript and world evidence before proposing how it could fit. The code returns evidence-linked suggestions instead of directly inserting scenes or timeline nodes, preserving author control over story structure.
   7.2a Analysis builds story-fit suggestions from the idea text.
   7.2b Suggestions include evidence records and placement reasoning.
   7.2c No manuscript or world mutation happens during suggestion generation.

7.3 Dream Scaping panel rendering

   The editor panel presents pending Dream Scaping suggestions for review. The code renders fit, placement, and evidence summary data so the author can inspect the proposal before future accept/reject actions are added.
   7.3a Pending suggestions render as review cards.
   7.3b Fit and placement labels are visible in the panel.
   7.3c Evidence summaries remain tied to the suggestion record.

### Progress

- Status: Foundation implemented on 2026-04-24.
- Repository coverage: `DreamScapeSuggestion`, `DreamScapeIdeaInput`, local `exploreDreamScape` analysis flow, dream-scaping job trigger, desktop workspace snapshot, editor Dream Scaping panel, and tests.
- Next work: add an author-facing idea submission form, accept/reject actions, and optional creation of reviewed timeline nodes or scene drafts.

## Feature 08 - Project Save File Loader

### Feature Definition

Allows a writer to open a local project save file or project folder into this application's canonical saved-project format. The loader preserves manuscript hierarchy, chapter and scene ordering, template sheets, source provenance, and whitespace in the loaded text so the manuscript can be loaded, reviewed, and revised locally without depending on any external source format at runtime.

### Process Header

The project loader imports a user-owned project save file, translates it into the app's normal project model, and stores it as a regular saved project while keeping the original source file untouched.

### Testable Subfeatures

8.1 Source project file import

   The author can load a local `.abe-project.json` or supported source project file into the application's canonical project model. The code preserves provenance, source path, retained template text, manuscript hierarchy, and project metrics while leaving the original file untouched.
   8.1a Desktop/browser load actions read project files through controlled routes.
   8.1b Imported records preserve source provenance and path details.
   8.1c Loaded manuscript hierarchy becomes the active project model.

8.2 Project persistence service boundary

   All project save, load, autosave, import, export, restore, and canonical mutation behavior must route through `ProjectPersistenceService`. The code centralizes persistence so UI features do not write directly to browser storage, file handles, or ad hoc JSON blobs.
   8.2a Editor save/load commands call `ProjectPersistenceService`.
   8.2b Canonical project mutations go through the persistence boundary.
   8.2c Restore-last-opened behavior is owned by the persistence service.

8.3 Disposable browser cache policy

   Browser storage is treated as a temporary convenience cache, not the desktop source of truth. The code clears stale project-content cache when loading or switching projects and repopulates active state from the selected JSON project file.
   8.3a Loading a JSON project clears stale project-content storage.
   8.3b Cache hydration does not merge old project data into the new project.
   8.3c Active project cache reflects only the current manuscript version.

8.4 Autosave and dirty-state control

   Autosave should only mark work clean after a real save path succeeds. The code reports save failures, falls back deliberately when permissions are unavailable, and reschedules dirty work instead of silently treating failed writes as successful.
   8.4a Autosave calls the persistence service rather than direct storage writes.
   8.4b Failed saves keep dirty state active.
   8.4c Permission fallback behavior is explicit and test-covered.

8.5 Project metrics derivation

   Project counts and dashboard metrics must be calculated from the loaded project record rather than stale browser cache. The code derives manuscript, world, task, timeline, template, and note metrics from canonical JSON data so refreshes and project switches show the current project accurately.
   8.5a Project index metrics are rebuilt from loaded project content.
   8.5b Passage-note counts derive from canonical notes.
   8.5c Metrics update after load, save, refresh, and project switch flows.

### Progress

- Status: Foundation implemented.
- Repository coverage: host-backed `/api/project-source` route, browser project-path input and load button, whitespace-preserving project text conversion, generic save-file path resolution, project-library merge/load flow for loaded projects, and file-backed load logging.
- Process update (2026-05-14): introduced a browser storage adapter + repository + `projectService` boundary with schema-versioned snapshot migration and a lightweight project index so UI flows can keep evolving while persistence can move to folder/SQLite/native backends later.
- Process update (2026-05-14): migrated persistence toward a chunked project package model where `project.json` holds manifest/index data and scene bodies are stored as per-scene records/files, with legacy monolithic `.abe-project.json` treated as migration input.
- Process update (2026-05-15): project-file save/load now treats `.abe-project.json` as a single active file-backed project, derives the canonical project ID/title from the loaded filename, remaps the active scene store under that identity, and recalculates workspace chapter/scene stats from the project index.
- Process update (2026-05-16): `ProjectPersistenceService` now owns browser file-handle recovery, filename display hydration before manuscript render, write-permission checks for Ctrl+S/autosave, and durable typed-path precedence so refreshes do not silently lose the active project identity.
- Next work: add a folder/file picker, surface richer load diagnostics, and build a dedicated retained-template browser for loaded source template sheets.

## Feature Implementation Index

This index is the code-map anchor for debugging, extraction work, and the future desktop port. Update it during `finalise work` when a feature or workflow is implemented, completed, meaningfully changed, or moved.

Also update this index immediately when the user says `Feature working`; that confirmation is the trigger that the workflow should be recorded with its current implementation lines.

### Entry Template

- Feature: `Feature N.N - Specific workflow name`, for example `Feature 1.3 - Manuscript spellcheck and project dictionary`
- Workflow: concise workflow name, for example `Scene drag/drop reorder`
- Status: `Planned`, `In Progress`, `Implemented`, `Partially Implemented`, `Needs Review`, or `Deprecated`
- Code locations: `path:start-end` with the main function or block name
- Execution flow: functions/blocks in chronological order from user action to state update
- Flow-on effects: render updates, persistence, autosave, dirty-state, logging, tests, and related service calls
- Extraction/port notes: ownership target such as feature slice, adapter, service, shared helper, or desktop bridge

### Indexed Workflows

- Feature: `Feature 1.2 - Context-aware scene insertion`
- Workflow: Context-aware scene insertion
- Status: `Implemented`
- Code locations: `apps/editor/public/app.js:7547-7561` (`markSceneEditorAsCurrent`), `apps/editor/public/app.js:11104-11148` (`addSceneDraft`, `getSceneIdForNewSceneDraftAnchor`), `apps/editor/public/editor-model.js:400-455` (`insertStructureSceneDraftAfterAnchor`), `test/editor-model.test.mjs:203-222` (scene-order insertion coverage)
- Execution flow: the manuscript editor records the active scene on pointer, focus, and typing -> `addSceneDraft` resolves the active editor scene as the insertion anchor -> `insertStructureSceneDraftAfterAnchor` creates a complete `structureDrafts.sceneOrder` with the new draft scene inserted immediately after that anchor -> the editor writes `EDITOR_STRUCTURE_KEY`, refreshes scene records, and selects the new scene
- Flow-on effects: the new scene stays in the same chapter as the active scene, binder order survives refresh/autosave/project persistence through `structureDrafts.sceneOrder`, the manuscript render selects the new scene after creation, and automated editor-model coverage verifies the persisted order
- Extraction/port notes: classified under Feature 1.2 because it is a manuscript editor/binder workflow that preserves author navigation and scene addressability; the insertion-order helper already lives in `editor-model.js`, while the UI event capture should move with the future scene-editor feature slice

- Feature: `Feature 1.1 - Anchored manuscript diagnostics console`
- Workflow: Anchored manuscript diagnostics console
- Status: `Implemented`
- Code locations: `packages/manuscript-schema/src/index.ts:125-157` (`ManuscriptAnchor`, `IssueRecord`, `EventTag`), `packages/manuscript-schema/src/index.ts:529-701` (anchor and issue/event mutation APIs), `services/analysis/src/index.ts:31-176` (`createLocalAnalysisService`, `analyze`), `apps/editor/public/app.js:3167-3187` (`renderManuscriptPanel`), `apps/editor/public/app.js:4277-4299` (`renderIssuePanelBody`), `apps/editor/public/features/scene-editor.js:84-139` (`renderManuscriptPanelHTML`), `test/manuscript-schema.test.mjs:17-132` and `test/analysis-service.test.mjs:21-213` (anchored record evidence)
- Execution flow: manuscript content is modeled as projects, chapters, scenes, blocks, and anchors -> local analysis returns issue and event suggestions with canonical anchors -> editor state renders the manuscript scene panel and the issue/task console -> issue/task navigation resolves anchors back to the relevant scene text
- Flow-on effects: diagnostics remain line/span addressable, issue and event records can survive rendering changes, and schema plus analysis tests verify anchor creation, resolution, issue records, and event records
- Extraction/port notes: Feature 1.1 spans `packages/manuscript-schema`, `services/analysis`, and the editor scene/console surfaces; future extraction should move remaining issue-console orchestration out of `app.js` into a dedicated feature slice

- Feature: `Feature 1.3 - Manuscript spellcheck and project dictionary`
- Workflow: Manuscript spellcheck and project dictionary
- Status: `Implemented`
- Code locations: `apps/editor/public/spellcheck.js:17-538` (lexicon, token, suggestion, and misspelling rules), `apps/editor/public/features/manuscript-editor/projection-selector.js:4-123` (`spellcheck` runtime projection channel), `apps/editor/public/adapters/editor-host/textarea-editor-host.js:106-148` and `292-318` (spellcheck projection layer and active-typing suppression), `apps/editor/public/state/project-activation-state.js:26-132` (loaded spellcheck settings hydration), `apps/editor/public/app.js:3629-3639` and `11645-11658` (finding generation and host projection orchestration), `test/spellcheck.test.mjs`, `test/manuscript-projection-selector.test.mjs:10-144`, and `test/manuscript-editor-host.test.mjs:18-91` (rules, projection separation, and adapter rendering)
- Execution flow: editor boot loads base and reference word lists -> the active project lexicon produces runtime spelling findings -> `selectManuscriptProjections` maps findings to `spellcheck` projections -> `renderTextareaSpellcheckLayer` paints the active host without writing decoration data to the project -> context-menu actions edit text or update persisted project dictionary/exception settings through normal project paths
- Flow-on effects: spelling feedback remains local and project-scoped, user-added names and world terms are preserved in project settings, the movable grammar panel can bulk-select words for the dictionary, underlines stay aligned to textarea offsets, and tests cover contractions, inflections, edit-distance suggestions, resilient word-list loading, and duplicate-normalized dictionary entries
- Extraction/port notes: spellcheck rules and projection painting are now separated; panel/context-menu actions and refresh scheduling remain shell-owned and are the Phase 3 extraction target

- Feature: `Feature 1.4 - Manuscript find and replace`
- Workflow: Manuscript find and replace
- Status: `Implemented`
- Code locations: `apps/editor/public/features/manuscript-editor/manuscript-find-controller.js:4-289` (`createManuscriptFindController`, panel modeling, match derivation, replacement plans), `apps/editor/public/features/manuscript-editor/projection-selector.js:4-123` (`search` runtime projection channel), `apps/editor/public/adapters/editor-host/textarea-editor-host.js:194-238` (runtime selection preview), `apps/editor/public/app.js:3225-3256` and `3849-4090` (panel mount, shell focus/edit effects, controller calls), `test/manuscript-find-controller.test.mjs:6-59` and `test/manuscript-projection-selector.test.mjs:10-144` (controller and projection behavior)
- Execution flow: Ctrl+F opens find state using selected text -> `ManuscriptFindController` derives structured scene matches and panel output -> navigation turns the active match into a runtime `search` projection rendered by the editor host -> replacement plans are committed through existing scene-draft mutation effects so durable text and metrics remain in normal persistence flow
- Flow-on effects: search operates across structured scenes rather than a flat DOM document, replacement participates in draft persistence and word-count updates, panel position and focused field selection are preserved across rerenders, and leaving the manuscript pane closes the find state
- Extraction/port notes: derivation and replacement planning are extracted; DOM focus, panel drag behavior, and durable edit effects intentionally remain injected shell concerns for now

- Feature: `Feature 1.5 - Anchored task, inspiration, and research notes`
- Workflow: Anchored task, inspiration, and research notes
- Status: `Implemented`
- Code locations: `apps/editor/public/editor-model.js:569-723` (task and passage-note record construction), `apps/editor/public/features/manuscript-editor/anchored-record-navigation-controller.js:7-114` (`findRecordAtSelection`, `buildPreview`), `apps/editor/public/features/manuscript-editor/projection-selector.js:4-123` (`task`/`note` projection channels), `apps/editor/public/adapters/editor-host/textarea-editor-host.js:151-191` and `241-258` (anchored preview painting/cleanup), `apps/editor/public/app.js:9275-9336` and `10094-10211` (shell navigation effects and feature-controller calls), `test/anchored-record-navigation-controller.test.mjs:6-76` and `test/manuscript-projection-selector.test.mjs:10-144` (navigation/projection evidence)
- Execution flow: author creates or selects an anchored task/note -> durable record retains its scene/range/evidence metadata -> `AnchoredRecordNavigationController` resolves or repairs the record range through injected callbacks -> `selectManuscriptProjections` emits an active `task` or `note` preview -> the textarea host paints/focuses the matching manuscript range without making the visual preview durable
- Flow-on effects: review items are actionable diagnostics rather than disconnected notes, passage notes are grouped into inspiration and research panels, deleting or moving scenes synchronizes linked metadata, and note/task edits persist through the project record
- Extraction/port notes: navigation and preview projection derivation are extracted; task/note creation panels and canonical anchor promotion remain later anchored-record slice work

- Feature: `Feature 1.6 - Binder scene and chapter management`
- Workflow: Binder scene and chapter management
- Status: `Implemented`
- Code locations: `apps/editor/public/app.js:11064-11148` (`resetSceneDraft`, `addChapterDraft`, `addSceneDraft`, insertion anchor), `apps/editor/public/app.js:11290-11310` (`toggleChapterCollapse`), `apps/editor/public/app.js:11476-11603` (chapter/scene title editing), `apps/editor/public/app.js:12275-12376` (`buildStructureDraftScenesFromOrderedScenes`, `moveDraftBinderScene`), `apps/editor/public/app.js:12417-12699` (`deleteSceneFromBinder`, `trimSceneWhitespace`), `test/desktop-application.test.mjs:315-402` (binder behavior assertions)
- Execution flow: binder actions mutate draft structure rather than canonical imported source text directly -> title edits update scene/chapter drafts and labels -> drag/drop writes an explicit `sceneOrder` overlay -> delete and trim synchronize scene-linked tasks, notes, narration, voice, local AI title status, and selected state -> persistence routes through current project-record saves
- Flow-on effects: the binder remains an author-facing structural editor, empty draft scenes can be ordered between canonical scenes, chapter collapse state persists per project, and scene-linked metadata is cleaned or rebuilt when structure changes
- Extraction/port notes: this should become a manuscript-binder feature slice; ordering helpers already started moving into `editor-model.js`, but drag/drop, deletion, and metadata synchronization still sit in the app shell

- Feature: `Feature 1.7 - Scene editor focus, viewport, and line-aware navigation`
- Workflow: Scene editor focus, viewport, and line-aware navigation
- Status: `Implemented`
- Code locations: `apps/editor/public/features/manuscript-editor/manuscript-selection-controller.js:3-215` (selection, context range, bookmark, and persisted defaults policy), `apps/editor/public/adapters/editor-host/textarea-editor-host.js:74-94` (textarea host selection/mutation capability), `apps/editor/public/app.js:3890`, `4090`, `7316-7352`, `7525`, and `8924` (browser orchestration calls), `test/manuscript-selection-controller.test.mjs:6-91` and `test/manuscript-editor-host.test.mjs:18-91` (policy and host behavior)
- Execution flow: editor interaction captures browser selection through the compatibility host -> `ManuscriptSelectionController` normalizes selected text, context ranges, bookmarks, and persisted scene selection defaults -> shell effects restore focus/scroll or invoke anchored navigation -> project saves receive normalized defaults rather than transient DOM objects
- Flow-on effects: autosave and reload can preserve author context, issue/task/note navigation lands in useful manuscript positions, pane-local scrolling avoids browser-page jumps, and line-aware metrics support diagnostics, narration, and world links
- Extraction/port notes: selection policy is extracted; residual line-layout and DOM focus/scroll work should move behind the editor-host boundary during the remaining Phase 2 work

- Feature: `Feature 1.8 - Writing targets, daily progress, and session tracker`
- Workflow: Writing targets, daily progress, and session tracker
- Status: `Implemented`
- Code locations: `apps/editor/public/features/progress-tracker.js:6-307` (`renderWritingTargetStrip`, session tracker card and metric cards), `apps/editor/public/features/writing-targets/writing-target-window.js:6-120` (`renderWritingTargetWindowHTML` dashboard shell), `apps/editor/public/features/writing-targets/writing-goals-service.js:8-104` (`createWritingGoalsService`, `renderWritingTargetWindow`), `apps/editor/public/features/writing-targets/writing-goals-state-service.js:1910-2488` (snapshot, session lifecycle, WPM, and baseline state), `test/writing-goals-state-service.test.mjs:6-261` and `test/desktop-application.test.mjs:405-540` (dashboard/session/daily baseline coverage)
- Execution flow: scene edits update manuscript word count -> writing-target state records current word count, session samples, daily baseline, and per-day history -> the header strip and dashboard render live progress, release-date target pacing, WPM, session phases, calendar entries, notes, and selected-day detail -> saves commit canonical writing-target state into the project record
- Flow-on effects: daily target progress is separated from total manuscript word count, sessions can idle/conclude/resume without losing history, project save files carry progress data, and tests cover deletion scenarios, implausible baselines, session lifecycle text, dashboard structure, and persistence wiring
- Extraction/port notes: most rendering/state logic is already in `features/progress-tracker.js` and `features/writing-targets/*`; remaining shell wiring in `app.js` should be limited to project persistence callbacks and scene-edit notifications

- Feature: `Feature 1.9 - Revision session banking`
- Workflow: Revision session banking
- Status: `Partially Implemented - standalone window mockup added`
- Code locations: `apps/editor/public/adapters/storage/revision-storage-service.js:1-241` (`createRevisionStorageService`, state normalization/read/write), `apps/editor/public/features/revisions/revision-diff-service.js:1-443`, `revision-event-service.js:1-110`, `revision-service.js:1-465`, `revision-panel-controller.js:1-76`, and `revision-window.js:1-405` (revision slice), `apps/editor/public/shell/editor-chrome.js:388-407` (top-chrome action), `apps/editor/public/app.js:4327-4375` (revision window orchestration), `test/revision-panel.test.mjs` and `test/revision-storage.test.mjs` (renderer/storage evidence)
- Execution flow: a host shell wires project-record and revision-state callbacks into `RevisionService` -> `RevisionStorageService.readRevisionState` normalizes stored history when present -> `RevisionService.loadRevisionHistory` hydrates in-memory state -> `startSession` creates a baseline digest from `buildRevisionProjectDigest` -> `recordEvent` aggregates revision ledger entries -> `stageSession` computes the diff, changed entities, and summary -> `finaliseSession` or `bankCurrentRevision` writes the banked session back into revision state -> `RevisionPanelController` filters and groups sessions -> `RevisionWindow` renders the model as a standalone session/file rail with before/after digest comparison
- Flow-on effects: normalized revision records in project-shaped state, banked-session logging, diff preview generation, grouped session summaries, session status transitions, a developer-style review mockup for user feedback, and a benched scene-editor overlay path that still reads from revision stats in code
- Extraction/port notes: `apps/editor/public/features/revisions/*` and `apps/editor/public/adapters/storage/revision-storage-service.js` own the slice; the wiring should remain behind `ProjectPersistenceService` or an equivalent storage boundary when connected

- Feature: `Feature 1.10 - Manuscript inline formatting commands`
- Workflow: Selection-aware bold, italic, underline, and highlight controls
- Status: `Implemented browser slice; canonical mark promotion planned`
- Code locations: `apps/editor/public/features/manuscript-editor/manuscript-command-controller.js:3-453` (format command and compatibility range mutation policy), `apps/editor/public/features/manuscript-editor/manuscript-input-controller.js:7-85` (live typing sequence), `apps/editor/public/features/manuscript-editor/projection-selector.js:4-123` (author-mark projection source), `apps/editor/public/features/manuscript-editor/editor-host-interface.js:7-47` (render-only host contract), `apps/editor/public/adapters/editor-host/textarea-editor-host.js:50-94` and `261-318` (compatibility textarea markup, command bridge, and painting), `apps/editor/public/features/scene-editor.js:174-273` (scene host mount), `apps/editor/public/adapters/storage/project-repository.js:47-84` (compatibility range round-trip), `test/manuscript-command-controller.test.mjs`, `test/manuscript-input-controller.test.mjs:6-66`, `test/manuscript-projection-selector.test.mjs:10-144`, `test/manuscript-editor-host.test.mjs:18-91`, and `test/project-refresh-persistence.test.mjs` (command, input, visual-channel, host, and persistence evidence)
- Execution flow: author applies a format command -> command controller mutates scene compatibility `inlineFormatRanges` or pending insertion state -> manuscript input controller advances those ranges while dispatching injected revision/persistence/render effects -> projection selector derives `author-mark` render descriptors -> textarea host paints the author marks while persistent saves retain only compatibility range data, never runtime projection objects
- Flow-on effects: literal `<strong>`, `<em>`, and `<u>` tags are no longer inserted into manuscript text, highlight is implemented beside the other inline controls, the old scene-wide italic CSS class is no longer applied, current author formatting survives JSON-backed scene storage, and the editor has a dedicated manuscript-editor feature slice for future rich inline mark storage
- Extraction/port notes: this is classified under Feature 1 because it is core scene-editor authoring behavior; the Phase 2 host/projection/input boundaries are now present, while the next schema pass must promote `inlineFormatRanges` into canonical anchor-backed manuscript marks

- Feature: `Feature 2.1/2.2/2.3 - Local AI routing, preference, and scene-title suggestion`
- Workflow: Local AI scene-title and provider routing
- Status: `Implemented`
- Code locations: `services/local-ai/local-ai-types.ts:2-59` (`AiRequest`, `AiResult`, `LocalAiProvider`), `services/local-ai/model-routing-policy.ts:5-26` (`selectModelTier`), `services/local-ai/prompt-builder.ts:5-48` (`buildLocalAiPrompt`), `services/local-ai/local-ai-router.ts:12-76` (`LocalAiRouter`), `services/local-ai/providers/llama-cpp-provider.ts:25-145` (`LlamaCppProvider`), `apps/editor/public/app.js:2198-2203` (Local AI toggle), `apps/editor/public/app.js:10309-10349` (`suggestSceneTitle`), `apps/editor/public/features/scene-editor.js:159-273` (`renderSceneEditorHTML` title suggestion control), `test/local-ai-service.test.mjs:13-115` and `test/local-ai-router.test.mjs:36-66` (routing, prompt, provider fallback coverage)
- Execution flow: the author enables Local AI in editor preferences -> the scene title button sends scene context through `suggestSceneTitle` -> the Local AI router chooses a model tier and prompt -> provider output updates the scene draft title through normal manuscript state and render paths
- Flow-on effects: local-first behavior is preserved behind provider contracts, unavailable providers return structured fallback results, editor preferences persist with project state, and tests cover model-tier routing, prompt shape, successful responses, unavailable providers, and unconfigured tiers
- Extraction/port notes: local AI routing already lives in `services/local-ai`; editor-specific invocation remains in `app.js` and should move into a Local Writing Assistant feature controller when the shell is split

- Feature: `Feature 3.1/3.2/3.3 - Anchored event detection, event tags, and navigation foundation`
- Workflow: Anchored event detection and tagging foundation
- Status: `Implemented`
- Code locations: `packages/manuscript-schema/src/index.ts:12-18` (`EventTagKind`, `EventSource`), `packages/manuscript-schema/src/index.ts:149-157` (`EventTag`), `packages/manuscript-schema/src/index.ts:662-701` (`addEventTag`), `services/analysis/src/index.ts:53-176` (`analyze` event suggestions), `services/analysis/src/index.ts:240-259` (`createEvent`), `apps/editor/public/app.js:4277-4299` (`renderIssuePanelBody` shares anchored console flow), `test/manuscript-schema.test.mjs:130-132` and `test/analysis-service.test.mjs:202-213` (event evidence)
- Execution flow: analysis scans manuscript blocks for event evidence -> `createEvent` emits a structured event suggestion with a manuscript anchor and excerpt -> schema APIs can add an `EventTag` to the canonical project -> editor navigation uses the same anchor-backed console pattern as issue records
- Flow-on effects: detected events remain tied to project/chapter/scene/block/span references, event records can be reused by world and continuity systems, and tests verify event suggestions and persisted event tags
- Extraction/port notes: event records belong in `packages/manuscript-schema`; richer user-authored pinning should get a dedicated editor feature slice instead of adding more event workflow code to `app.js`

- Feature: `Feature 4.1/4.2/4.3/4.4 - Narration service, take recording, tools UI, and metadata sync`
- Workflow: Anchored narration take recording and alignment service foundation
- Status: `Partially Implemented`
- Code locations: `services/audio/src/index.ts:11-86` (`createInMemoryAudioService`), `apps/editor/public/features/scene-editor.js:159-273` and `387-431` (narration editor mode and controls), `apps/editor/public/app.js:5195-5306` (selection/session/projection helpers), `apps/editor/public/app.js:5565-5799` (`createNarrationTakeSession`, start/stop/finalize recording), `apps/editor/public/app.js:12107-12163` (`syncNarrationSessionMetadata`), `test/audio-service.test.mjs:13-64` (session and alignment service coverage)
- Execution flow: narration pane reuses the manuscript scene editor -> author selects a verse and starts recording -> recording runtime stores a scene/block/span-aware take session -> optional speech tracking updates transcript/status -> stop/finalize saves the take and synchronizes narration metadata against current manuscript anchors
- Flow-on effects: narration state is separate from editor rendering state, recorded takes remain tied to manuscript anchors, alignment jobs have typed service coverage, and the current implementation supports recording/recovery scaffolding before full live follow mode is added
- Extraction/port notes: recording runtime still lives in `app.js`; the service boundary exists in `services/audio`, and the UI/runtime orchestration should move into a narration feature slice or desktop bridge as the follow engine matures

- Feature: `Feature 5.1/5.2/5.3/5.4 - Voice profiles, render jobs, storage, and editor controls`
- Workflow: Voice profile, binding, render-job, and recording foundation
- Status: `Implemented`
- Code locations: `services/voice/src/index.ts:50-121` (`createInMemoryVoiceService`), `services/voice/src/voice-profile.ts:49-193`, `narration-job.ts:51-214`, `voice-queue.ts:22-83`, `placeholder-renderer.ts:5-7`, and `voice-storage.ts:7-128` (profile/job/queue/render/storage boundaries), `apps/editor/public/app.js:6055-6532` (voice recording preview, job creation, and state normalization), `apps/editor/public/app.js:12165-12207` (`syncVoiceRecordingsMetadata`, `syncVoiceRenderJobsMetadata`), `test/voice-service.test.mjs:14-79` and `test/voice-narration-foundation.test.mjs:25-188` (voice evidence)
- Execution flow: voice profiles and speaker bindings are normalized through service contracts -> editor creates anchored narration jobs from manuscript scene/block references -> queue transitions move jobs through draft, queued, rendering, rendered, failed, and cancelled states -> placeholder rendering and storage keep outputs traceable to manuscript locations
- Flow-on effects: character/narrator voice data is decoupled from provider implementation, render jobs are explicit and inspectable, recording metadata survives scene edits where anchors still resolve, and tests cover voice profiles, bindings, previews, job transitions, placeholder rendering, and local storage
- Extraction/port notes: provider-neutral service code is already under `services/voice`; editor job/recording orchestration should be extracted from `app.js` into a voice/narration feature controller before real TTS or conversion providers are attached

- Feature: `Feature 6.1/6.2/6.3/6.4/6.5 - World model, entities, rendering, links, and suggestions`
- Workflow: Structured world spine, entity, template, and link model
- Status: `Implemented`
- Code locations: `packages/world-schema/src/index.ts:20-153` (`WorldModel`, templates, entities, spines, nodes, edges, links), `packages/world-schema/src/index.ts:227-574` (world construction/link APIs), `services/analysis/src/index.ts:266-313` (`buildWorldSuggestions`), `apps/editor/public/app.js:4949-5088` (`renderWorldPanel`, `renderSpine`, `renderEdge`, `renderEntityPanel`), `test/world-schema.test.mjs:21-173` (world template/entity/timeline/link coverage)
- Execution flow: world data is modeled as typed templates, entities, spines, nodes, edges, and links -> analysis can suggest templates/entities/cross-spine links without mutating canonical data -> editor renders spine lanes, edges, selected node/entity context, templates, entities, and suggestion cards
- Flow-on effects: chronology and worldbuilding remain structured rather than note-only, entity introductions can link to manuscript and timeline anchors, cross-spine causality is represented explicitly, and tests verify template instantiation, timeline nodes, entity introduction links, and edge relationships
- Extraction/port notes: schema ownership is correctly in `packages/world-schema`; editor rendering is still in `app.js` and should move into world-spine/entity feature slices with reviewable suggestion acceptance flows

- Feature: `Feature 7.1/7.2/7.3 - Dream-scaping contracts, suggestions, and panel rendering`
- Workflow: Reviewable dream-scaping story-fit suggestions
- Status: `Implemented`
- Code locations: `packages/shared-types/src/index.ts:134-168` (`DreamScapeFit`, `DreamScapePlacement`, `DreamScapeSuggestion`), `services/analysis/src/index.ts:47-50` (`exploreDreamScape` service entry), `services/analysis/src/index.ts:178-214` (`exploreDreamScape` job wrapper), `services/analysis/src/index.ts:315-424` (`buildDreamScapeSuggestions`, fit, placement, prompt helpers), `apps/editor/public/app.js:5109-5163` (`renderDreamScapingPanel`, `renderDreamSuggestion`), `test/analysis-service.test.mjs:224-233` (dream-scaping suggestion coverage)
- Execution flow: author idea input is represented as a dream-scaping request -> analysis builds a pending, evidence-linked story-fit suggestion -> proposed placement describes whether the idea belongs in manuscript, timeline, or world history -> editor renders the dream-scaping panel and pending suggestions for review
- Flow-on effects: dream-scaping does not silently mutate manuscript or world data, evidence records stay traceable, suggestion review state is explicit, and tests verify the dream-scaping job, fit classification, placement target, and evidence list
- Extraction/port notes: the analysis side is service-owned; the current editor panel is display-only in `app.js` and should become a dedicated feature slice when author input and accept/reject actions are added

- Feature: `Feature 8.1/8.2/8.3/8.4/8.5 - Project import, persistence, cache policy, autosave, and metrics`
- Workflow: Local project-file load/save, autosave, and source import boundary
- Status: `Implemented`
- Code locations: `apps/desktop/src/project-source.ts:17-105` and `apps/desktop/src/http-app.ts:338-363` (host-backed source import route), `apps/editor/public/app.js:8041-8075` (`loadProjectSource`), `apps/editor/public/adapters/storage/project-persistence-service.js:358-411` and `554-1741` (persistence contract and load/save/restore flows), `apps/editor/public/state/project-library-state.js:44-334` (selection defaults, cache/seed merge, active record lookup), `apps/editor/public/state/project-record-state.js:11-246` (durable record normalization/construction), `apps/editor/public/state/project-runtime-record-state.js:11-114` (runtime-to-record save assembly), `apps/editor/public/state/project-activation-state.js:26-132` and `apps/editor/public/state/project-activation-controller.js:3-215` (record hydration and activation effects), `apps/editor/public/app.js:441-477`, `610-637`, and `701-823` (composition wiring), `test/project-source.test.mjs`, `test/project-persistence-service.test.mjs`, `test/project-library-state.test.mjs:10-149`, `test/project-record-state.test.mjs:7-69`, `test/project-runtime-record-state.test.mjs:6-91`, `test/project-activation-state.test.mjs:6-75`, and `test/project-activation-controller.test.mjs:6-121` (persistence/state boundary evidence)
- Execution flow: desktop or browser load action enters `ProjectPersistenceService` -> project-library state normalization replaces stale browser cache and resolves an active durable record -> activation state hydrates runtime project data and activation controller coordinates shell refresh/render effects -> save/autosave assembles a durable record from runtime state and routes it through the persistence service to the active project file or explicit compatibility cache fallback
- Flow-on effects: project JSON is the source of truth for desktop-style workflows, browser cache is disposable and failure-aware, project metrics are derived from loaded records, autosave dirty state is explicit, and tests cover source provenance, imported counts, save/load/restore flows, and cache replacement behavior
- Extraction/port notes: Phase 1 ownership extraction is complete for the current browser host; remaining editor calls must continue routing through `ProjectPersistenceService`, while broader shell/state facade work is scheduled in the refactor roadmap

## Feature Code Index Checklist

Use this compact checklist when testing or porting individual feature IDs. The detailed implementation notes above explain the full flow; this checklist gives the fastest code entry points for each feature.

- Feature 1.1 - Anchored manuscript diagnostics console: `packages/manuscript-schema/src/index.ts:125-157`, `packages/manuscript-schema/src/index.ts:529-701`, `services/analysis/src/index.ts:31-176`, `apps/editor/public/app.js:4277-4299`, `test/manuscript-schema.test.mjs:17-132`, `test/analysis-service.test.mjs:21-213`.
- Feature 1.2 - Context-aware scene insertion: `apps/editor/public/app.js:7547-7561`, `apps/editor/public/app.js:11104-11148`, `apps/editor/public/editor-model.js:400-455`, `test/editor-model.test.mjs:203-222`.
- Feature 1.3 - Manuscript spellcheck and project dictionary: `apps/editor/public/spellcheck.js:17-538`, `apps/editor/public/features/manuscript-editor/projection-selector.js:4-123`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:106-148`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:292-318`, `test/spellcheck.test.mjs`, `test/manuscript-editor-host.test.mjs`.
- Feature 1.4 - Manuscript find and replace: `apps/editor/public/features/manuscript-editor/manuscript-find-controller.js:4-289`, `apps/editor/public/features/manuscript-editor/projection-selector.js:4-123`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:194-238`, `apps/editor/public/app.js:3849-4090`, `test/manuscript-find-controller.test.mjs`.
- Feature 1.5 - Anchored task, inspiration, and research notes: `apps/editor/public/features/manuscript-editor/anchored-record-navigation-controller.js:7-114`, `apps/editor/public/features/manuscript-editor/projection-selector.js:4-123`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:151-258`, `apps/editor/public/app.js:9275-9336`, `apps/editor/public/app.js:10094-10211`, `test/anchored-record-navigation-controller.test.mjs`.
- Feature 1.6 - Binder scene and chapter management: `apps/editor/public/app.js:11064-11148`, `apps/editor/public/app.js:11290-11310`, `apps/editor/public/app.js:11476-11603`, `apps/editor/public/app.js:12275-12699`, `test/desktop-application.test.mjs:315-402`.
- Feature 1.7 - Scene editor focus, viewport, and line-aware navigation: `apps/editor/public/features/manuscript-editor/manuscript-selection-controller.js:3-215`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:74-94`, `apps/editor/public/app.js:7316-7352`, `apps/editor/public/app.js:7525`, `apps/editor/public/app.js:8924`, `test/manuscript-selection-controller.test.mjs`.
- Feature 1.8 - Writing targets, daily progress, and session tracker: `apps/editor/public/features/progress-tracker.js:6-307`, `apps/editor/public/features/writing-targets/writing-target-window.js:6-120`, `apps/editor/public/features/writing-targets/writing-goals-service.js:8-104`, `apps/editor/public/features/writing-targets/writing-goals-state-service.js:1910-2488`, `test/writing-goals-state-service.test.mjs:6-261`.
- Feature 1.9 - Revision session banking: `apps/editor/public/adapters/storage/revision-storage-service.js:1-241`, `apps/editor/public/features/revisions/revision-service.js:1-465`, `apps/editor/public/features/revisions/revision-window.js:1-405`, `apps/editor/public/app.js:4327-4375`, `apps/editor/public/shell/editor-chrome.js:388-407`.
- Feature 1.10 - Manuscript inline formatting commands: `apps/editor/public/features/manuscript-editor/manuscript-command-controller.js:3-453`, `apps/editor/public/features/manuscript-editor/manuscript-input-controller.js:7-85`, `apps/editor/public/features/manuscript-editor/projection-selector.js:4-123`, `apps/editor/public/features/manuscript-editor/editor-host-interface.js:7-47`, `apps/editor/public/adapters/editor-host/textarea-editor-host.js:50-318`, `apps/editor/public/features/scene-editor.js:174-273`, `test/manuscript-command-controller.test.mjs`, `test/manuscript-input-controller.test.mjs`, `test/manuscript-projection-selector.test.mjs`.
- Feature 2.1 - Local AI provider routing: `services/local-ai/local-ai-types.ts:2-59`, `services/local-ai/model-routing-policy.ts:5-26`, `services/local-ai/prompt-builder.ts:5-48`, `services/local-ai/local-ai-router.ts:12-76`, `services/local-ai/providers/llama-cpp-provider.ts:25-145`, `test/local-ai-router.test.mjs:36-66`.
- Feature 2.2 - Local AI editor preference: `apps/editor/public/app.js:2198-2203`, `apps/editor/public/shell/editor-chrome.js:235-236`, `test/desktop-application.test.mjs`.
- Feature 2.3 - Local AI scene-title suggestion: `apps/editor/public/app.js:10309-10349`, `apps/editor/public/features/scene-editor.js:159-273`, `test/local-ai-service.test.mjs:13-115`.
- Feature 2.4 - Anchored writing analysis suggestions: `services/analysis/src/index.ts:31-176`, `packages/manuscript-schema/src/index.ts:125-157`, `test/analysis-service.test.mjs:21-213`.
- Feature 3.1 - Anchored event detection: `services/analysis/src/index.ts:53-176`, `services/analysis/src/index.ts:240-259`, `test/analysis-service.test.mjs:202-213`.
- Feature 3.2 - Event tag persistence model: `packages/manuscript-schema/src/index.ts:12-18`, `packages/manuscript-schema/src/index.ts:149-157`, `packages/manuscript-schema/src/index.ts:662-701`, `test/manuscript-schema.test.mjs:130-132`.
- Feature 3.3 - Event console navigation foundation: `apps/editor/public/app.js:4277-4299`, `packages/manuscript-schema/src/index.ts:529-626`.
- Feature 4.1 - Narration session service: `services/audio/src/index.ts:11-86`, `test/audio-service.test.mjs:13-64`.
- Feature 4.2 - Anchored narration take recording: `apps/editor/public/app.js:5195-5306`, `apps/editor/public/app.js:5565-5799`.
- Feature 4.3 - Narration recording tools UI: `apps/editor/public/features/scene-editor.js:159-273`, `apps/editor/public/features/scene-editor.js:387-431`.
- Feature 4.4 - Narration metadata synchronization: `apps/editor/public/app.js:12107-12163`, `services/audio/src/index.ts:11-86`.
- Feature 5.1 - Voice profile and speaker binding model: `services/voice/src/index.ts:50-121`, `services/voice/src/voice-profile.ts:49-193`, `test/voice-service.test.mjs:14-79`.
- Feature 5.2 - Voice render job lifecycle: `services/voice/src/narration-job.ts:51-214`, `services/voice/src/voice-queue.ts:22-83`, `apps/editor/public/app.js:6137-6532`.
- Feature 5.3 - Voice narration storage: `services/voice/src/voice-storage.ts:7-128`, `apps/editor/public/app.js:6256-6532`, `apps/editor/public/app.js:12165-12207`.
- Feature 5.4 - Editor voice narration controls: `apps/editor/public/app.js:6055-6532`, `test/voice-narration-foundation.test.mjs:25-188`.
- Feature 6.1 - Structured world model: `packages/world-schema/src/index.ts:20-153`, `packages/world-schema/src/index.ts:227-574`, `test/world-schema.test.mjs:21-173`.
- Feature 6.2 - Template-driven entity instantiation: `packages/world-schema/src/index.ts:227-574`, `test/world-schema.test.mjs:21-173`.
- Feature 6.3 - Timeline spine rendering: `apps/editor/public/app.js:4949-5088`.
- Feature 6.4 - Cross-spine causality links: `packages/world-schema/src/index.ts:20-153`, `packages/world-schema/src/index.ts:227-574`, `apps/editor/public/app.js:4949-5088`.
- Feature 6.5 - Reviewable world suggestions: `services/analysis/src/index.ts:266-313`, `apps/editor/public/app.js:5007-5088`.
- Feature 7.1 - Dream-scaping request and result contracts: `packages/shared-types/src/index.ts:134-168`, `services/analysis/src/index.ts:47-50`.
- Feature 7.2 - Reviewable story-fit suggestion generation: `services/analysis/src/index.ts:178-214`, `services/analysis/src/index.ts:315-424`, `test/analysis-service.test.mjs:224-233`.
- Feature 7.3 - Dream Scaping panel rendering: `apps/editor/public/app.js:5109-5163`.
- Feature 8.1 - Source project file import: `apps/desktop/src/project-source.ts:17-105`, `apps/desktop/src/http-app.ts:338-363`, `apps/editor/public/app.js:8041-8075`, `test/project-source.test.mjs:14-132`.
- Feature 8.2 - Project persistence service boundary: `apps/editor/public/adapters/storage/project-persistence-service.js:358-1741`, `apps/editor/public/state/project-record-state.js:11-246`, `apps/editor/public/state/project-runtime-record-state.js:11-114`, `apps/editor/public/app.js:610-637`, `test/project-persistence-service.test.mjs`, `test/project-record-state.test.mjs`, `test/project-runtime-record-state.test.mjs`.
- Feature 8.3 - Disposable browser cache policy: `apps/editor/public/state/project-library-state.js:44-334`, `apps/editor/public/adapters/storage/project-persistence-service.js:1019-1179`, `test/project-library-state.test.mjs`, `test/project-refresh-persistence.test.mjs`.
- Feature 8.4 - Autosave and activation control: `apps/editor/public/adapters/storage/autosave.js:2-103`, `apps/editor/public/state/project-activation-state.js:26-132`, `apps/editor/public/state/project-activation-controller.js:3-215`, `test/project-activation-state.test.mjs`, `test/project-activation-controller.test.mjs`.
- Feature 8.5 - Project metrics and record derivation: `apps/editor/public/adapters/storage/project-index.js`, `apps/editor/public/state/project-record-state.js:11-246`, `test/project-record-state.test.mjs`, `test/project-service-storage.test.mjs`.
