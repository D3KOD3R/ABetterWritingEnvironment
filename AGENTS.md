# AGENTS.md

First rule: if the user asks or types `fix issues` in Codex, read `voiceissues/VoiceIssuesAgent.md` before working from `voiceissues/voice-issues.md`.

## Purpose

This repository is for a local-first, open-source, AI-augmented authoring and audiobook-generation environment.

The product is a story-building IDE for long-form fiction, worldbuilding, manuscript analysis, narration, and character-voice audiobook production.

This is not a generic document editor.
This is not a generic note-taking app.
This is not a generic chatbot shell.
This is not a generic voice-cloning tool.

Codex must preserve the product identity of this repository when proposing architecture, writing code, creating folders, adding dependencies, or designing data models.

The product should feel closer to:
- a writer's IDE
- a worldbuilding workstation
- a manuscript diagnostics environment
- a narration and audiobook production suite

and less like:
- a traditional word processor
- a generic WYSIWYG document app
- a generic transcription tool
- a generic TTS frontend

---

## Working through feature sets. 
Each feature of the program is underpinned and numbered in the word doc named "An AI augmented author writing environment." 
- As you work through each feature, you should create a process header which explains the feature and updates the features.md list. 

## Project work rules. 
- Whenever you are working on the project you should think in terms of service levels by observing the current project architecture. 
- When you are working on features, you should decide what level or service the feature is implemented at. If the feature doesn't fall under an existing service, a new service branch should be created. 
- Do not just continue adding code to the app.js file. This should call services, with logging, so that as features are rolled out, the developer can follow the log trail and fix issues. 
- Always comment intent before code blocks. 


## Core product pillars

All work in this repository should support one or more of these pillars.

### 1. Manuscript Issue Console
The suite provides a code-like issue console for writers.

It should:
- log issues in a structured review panel
- link each issue to a precise line, span, paragraph, scene, or section
- support AI-assisted explanations and revision guidance
- support IDE-like navigation to flagged passages
- treat manuscript problems as actionable diagnostics, not vague comments

Architectural implication:
- issue records must be structured, typed, and location-aware
- issue records must resolve back to canonical manuscript anchors
- issue severity, category, source, confidence, and lifecycle should be representable in data

### 2. Local Writing Assistant
The suite provides local AI-assisted writing feedback.

It should:
- identify phrasing, repetition, clarity, pacing, and structural issues
- operate incrementally while the author writes
- support Local AI Only mode using the user's own machine and GPU
- preserve privacy by default
- avoid forcing cloud execution for core writing analysis

Architectural implication:
- analysis pipelines must support local execution
- model providers must be abstracted behind interfaces
- editor features must not assume online connectivity

### 3. Event Pinning
The suite can detect and tag major story events.

It should:
- detect important manuscript events such as deaths, first meetings, introductions, and key plot turns
- allow the user to describe an event in plain language
- locate the relevant passage in the manuscript
- apply user-defined tags to the correct line or span
- make important beats searchable, navigable, and reusable in story structure tools

Architectural implication:
- event tags must be structured objects, not just text highlights
- event tags must anchor to canonical manuscript spans
- event tags should be reusable by worldbuilding and continuity systems

### 4. Narration Follow Mode
The suite provides real-time read-along narration tracking.

It should:
- listen to the narrator's voice
- match spoken words to the manuscript in real time
- keep the current line or sentence centered or otherwise clearly tracked on screen
- recover when the narrator pauses, repeats, skips, or loses place
- reduce manual scrolling during recording or read-through

Architectural implication:
- narration tracking must operate against canonical manuscript spans
- live tracking state must be separate from editor rendering state
- speech recognition and alignment must be modeled as services, not embedded UI logic

### 5. Character Voice Narration
The suite supports full audiobook-style performance production.

It should:
- assign different voices to narrator and characters
- generate speech from text
- convert the author's own performance into character voices
- link speaker identity and output audio directly to manuscript structure
- support chapter, scene, and line-level audio workflows

Architectural implication:
- speaker identity must be modeled as structured data
- voice profiles must be decoupled from manuscript entities through explicit mappings
- generation and conversion pipelines must use provider abstractions
- render outputs must remain traceable to manuscript locations

### 6. World Spine View
The suite provides an interactive worldbuilding timeline workspace.

It should:
- display horizontal timeline spines rather than only vertical notes pages
- represent events as nodes on one or more spines
- open a linked vertical editing pane for the selected node
- support multiple stacked spines for planets, factions, characters, ships, regions, or threads
- show cross-spine links where one event influences another
- support chronology, causality, overlap, and locality-aware reasoning
- show timeline nodes that affect other nodes on the timeline spine
- draw explicit links between nodes on different spines when events are connected across localities

Architectural implication:
- timeline nodes are structured domain objects, not plain rich-text fragments
- spines, node links, and event dependencies must be modeled explicitly
- timeline data must support graph-like relationships and filtering
- the detail editor for a node may be rich text, but the timeline model itself must be structured

### 7. World Templates and Entity Instantiation
The suite supports reusable worldbuilding templates that create structured entities.

It should:
- allow the user to define templates such as Planet, Faction, Character Archetype, Culture, Ship Class, Religion, Technology, or Location
- let the user create new entities from those templates
- preserve typed fields and metadata from the template
- allow created entities to be linked to manuscript events, timeline nodes, world spines, and other entities
- support timeline introduction points, such as the first known appearance or introduction of a planet, faction, or technology
- allow the local AI service to suggest:
  - creating a template from repeated story patterns
  - instantiating an entity from an existing template
  - linking an entity to an existing or missing timeline node
  - linking related nodes across spines when story evidence suggests they are connected

Architectural implication:
- templates are structured schema-backed blueprints, not just text snippets
- instantiated entities must have stable IDs and explicit template ancestry
- timeline links must support entity introduction, influence, and presence across one or more spines
- AI suggestions must remain advisory and traceable, not silently mutate structured world data

---

## Product philosophy

This repository should evolve toward a local-first creative operating environment for authors.

The author should be able to:
- write and revise a manuscript
- inspect issues like a programmer reviews compiler warnings
- navigate directly to flagged lines and sections
- track key narrative events
- manage worldbuilding on visual timelines
- create reusable structured templates for world entities
- instantiate those templates into canonical project entities
- link entities to timeline introductions, cross-spine events, and manuscript references
- narrate against the manuscript in real time
- assign and render different voices for characters
- produce audiobook assets from structured manuscript data

Codex should favor architectures that make these workflows stronger over time.

---

## Repository architecture

The repository is organized by domain responsibility.

### `apps/desktop`
Owns:
- Tauri shell
- desktop lifecycle
- filesystem integration
- local settings
- model and asset path integration
- packaging and distribution concerns

Does not own:
- manuscript domain rules
- model-specific business logic
- audio alignment logic
- AI analysis rules

### `apps/editor`
Owns:
- manuscript editor UI
- project binder UI
- issue console UI
- IDE-like navigation UI
- worldbuilding UI
- world spine interaction UI
- line-indexing presentation
- author-facing workflow surfaces

Does not own:
- canonical manuscript schema
- direct model execution
- speech engine internals
- voice engine internals

## Editor shell maintenance rules

When changing `apps/editor`, follow the refactor roadmap in `docs/architecture/editor-application-roadmap.md`.

- Keep `apps/editor/public/app.js` as a thin bootstrap and orchestration shell.
- Put new feature logic into `apps/editor/public/features/*`, state logic into `apps/editor/public/state`, browser bridge code into `apps/editor/public/adapters`, and reusable helpers into `apps/editor/public/shared`.
- Do not add new feature-specific behavior to `app.js` when a slice, adapter, or shared helper can own it.
- Avoid direct imports between feature slices unless there is a clear shared helper or selector boundary.
- Treat persistence, autosave, spellcheck, and panel orchestration as separate concerns with their own owners.
- Prefer small feature modules with explicit contracts over adding more top-level functions to the shell.
- When extracting code, preserve the dependency direction defined in the roadmap: bootstrap -> shell -> feature slices -> shared helpers -> packages.

### Project persistence boundary rules

- All project save/load/autosave/import/export behavior must route through `ProjectPersistenceService`.
- UI code and feature modules must not directly write project data to `localStorage`, filesystem APIs, file handles, or ad hoc JSON blobs.
- Autosave workflows must call `ProjectPersistenceService` APIs and must not bypass the service with direct file writes.
- Persistence modules must use contextual names (for example `saveProjectSnapshot`, `loadProjectSnapshotFromFile`, `restoreLastOpenedProject`) instead of vague names like `save`, `load`, or `sync`.
- Any persistence behavior change requires automated tests or a documented manual verification checklist in the PR/commit notes.

### Refactor checkpoint

Current roadmap phase:
- Phase 1: shell/store boundary extraction

Completed slice:
- `apps/editor/public/shell/editor-chrome.js` now owns the top editor chrome, file menu, pane tabs, autosave toggle, local AI toggle, and writing-goal CTA markup.
- `apps/editor/public/features/writing-targets/writing-target-window.js` now owns the full writing-goals window markup.
- `apps/editor/public/adapters/storage/project-persistence-service.js` now owns project-file save/load/autosave/import/export orchestration, and `app.js` calls it as the persistence boundary.

Next slice:
- Split remaining manuscript and side-panel runtime behavior out of `apps/editor/public/app.js` after the persistence boundary extraction.

Verification for the current slice:
- `node --check apps/editor/public/app.js`
- `node --check apps/editor/public/shell/editor-chrome.js`
- `node --check apps/editor/public/features/writing-targets/writing-target-window.js`
- `node --check test/desktop-application.test.mjs`
- `npm test`

### `services/analysis`
Owns:
- manuscript diagnostics
- local writing analysis orchestration
- issue generation
- event pinning
- continuity analysis
- character and entity extraction
- world-template suggestions
- world-entity link suggestions
- reasoning outputs that must link back to manuscript anchors

### `services/audio`
Owns:
- microphone/session capture orchestration
- narration follow orchestration
- speech recognition orchestration
- forced alignment orchestration
- playback and session state
- passage-linked recording workflows

### `services/voice`
Owns:
- voice profile resolution
- TTS orchestration
- voice conversion orchestration
- provider adapters
- model runtime boundaries
- chapter and scene render orchestration

### `packages/manuscript-schema`
Owns:
- canonical manuscript structures
- binder/project hierarchy
- scenes, chapters, paragraphs, dialogue, narration blocks
- stable IDs
- spans, anchors, and references
- speaker attribution structures
- event attachment points

This package is a core source of truth.

### `packages/world-schema`
Owns:
- world templates
- template field definitions
- instantiated world entities
- world entity metadata
- timeline spine structures
- timeline nodes and timeline edges
- entity-to-timeline links
- entity-to-manuscript links
- cross-spine causality and relationship structures

This package is a core source of truth for worldbuilding and timeline systems.

### `packages/shared-types`
Owns:
- cross-package DTOs
- service contracts
- analysis result shapes
- voice and audio request/response types
- shared enums and identifiers

### `packages/job-contracts`
Owns:
- long-running job request types
- job status/result contracts
- queue lifecycle contracts
- retry, cancel, pause, and resume state

### `docs/architecture`
Owns:
- architecture decisions
- diagrams
- subsystem relationships
- source-of-truth explanations for major patterns

### `docs/product`
Owns:
- feature definitions
- terminology
- UX expectations
- interaction notes
- product goals

---

## Core domain objects

Codex should prefer clear domain models around the product's real concepts.

Important domain objects include:
- Project
- BinderNode
- Chapter
- Scene
- ManuscriptBlock
- Paragraph
- DialogueBlock
- NarrationBlock
- ManuscriptSpan
- IssueRecord
- EventTag
- Character
- CharacterAlias
- VoiceProfile
- SpeakerAssignment
- NarrationSession
- AudioTake
- AlignmentResult
- TimelineSpine
- TimelineNode
- TimelineEdge
- WorldEntity
- WorldTemplate
- TemplateField
- TemplateInstance
- EntityLink
- EntityIntroduction
- AnalysisJob
- VoiceRenderJob

When adding features, prefer extending these kinds of domain objects rather than inventing ad hoc UI-only state.

---

## Architectural rules

### 1. Manuscript structure is first-class
The manuscript is not a flat string.
The manuscript is not a screen layout.
The manuscript is not just rich text.

The manuscript is a structured, addressable, persistent project model.

Codex must preserve:
- stable block IDs
- stable scene and chapter identities
- explicit manuscript spans
- resolvable anchors for diagnostics
- resolvable anchors for narration
- resolvable anchors for event pins
- speaker-aware structures where needed

Formatting-only changes should not casually destroy addressability.

### 2. All analysis must resolve back to canonical anchors
Every issue, event, tag, continuity warning, narration marker, voice segment, or suggested revision must resolve back to canonical content references.

Valid anchors include:
- project IDs
- chapter IDs
- scene IDs
- block IDs
- paragraph IDs
- span references
- timeline node IDs
- world entity IDs

Invalid durable references include:
- raw screen coordinates
- transient DOM positions
- temporary cursor positions without span mapping
- text-only descriptions with no anchor

If a feature produces a result the user must act on, that result must be location-aware.

### 3. Keep UI separate from engines
UI components should request capabilities, not implement providers.

The editor UI should not know:
- how a specific ASR model is loaded
- how a specific TTS model is invoked
- how a specific voice conversion checkpoint is selected
- where GPU memory is managed
- how audio model retries are handled

Use service interfaces and adapters.

### 4. Model-specific code must stay behind provider boundaries
Do not let a single AI model define the architecture.

Whisper, whisper.cpp, RVC, XTTS, local LLMs, or future providers may be swapped.

The repository should be able to support:
- local providers
- hosted providers
- experimental providers
- disabled-provider states

without changing the manuscript model, world model, or core editor logic.

### 5. Worldbuilding data is structured, not decorative
If a feature supports:
- timeline spines
- node relationships
- locality-aware chronology
- causality links
- cross-spine dependencies
- filtering by faction, planet, or thread
- template-driven world entities
- entity introduction and influence tracking

then the data model must reflect that.

Do not reduce interactive worldbuilding to plain notes if structured data is required.

### 6. Audio, voice, and rendering are job-driven
Long-running operations should be represented as explicit jobs.

Examples:
- transcription
- alignment
- voice preview generation
- voice conversion
- TTS synthesis
- chapter render
- audiobook export

Use:
- typed requests
- typed statuses
- typed results
- resumable workflows where useful
- explicit failures and retries

Avoid hidden async state.

### 7. Local-first by default
Default design assumptions:
- the manuscript should remain usable offline
- core writing workflows should not require cloud services
- local AI mode is a primary use case, not an afterthought
- model adapters may support cloud providers later, but core architecture must not depend on them

### 8. Open core now, commercial flexibility later
The current product is free and open source.

Future subscription features may include:
- hosted inference
- hosted sync
- premium voice services
- collaboration layers
- managed model delivery
- paid rendering services

Architect the repo so these can be added later through optional adapters or service boundaries without contaminating the open-source core.

### 9. Prefer deterministic systems where users need trust
The following systems should be as deterministic and inspectable as practical:
- manuscript addressing
- issue linking
- timeline linking
- template instantiation
- world entity linking
- session recording metadata
- alignment persistence
- render job tracking

LLM or model outputs may inform these systems, but should not replace explicit data integrity.

### 10. Templates create structured entities, not loose notes
Templates are domain blueprints for worldbuilding objects.

A template may represent:
- Planet
- Faction
- Culture
- Species
- Organization
- Technology
- Vehicle
- Location
- Artifact
- Character Archetype
- Custom user-defined world entity types

Entities created from templates must:
- have stable IDs
- preserve template origin
- support user-edited fields and notes
- support linking to timeline nodes and manuscript anchors
- support graph relationships with other entities

Do not implement templates as plain text macros if the user expects structured world models.

### 11. AI suggestions must be reviewable before changing structured world data
AI may suggest:
- new templates
- new entity instances
- missing introduction links
- missing timeline links
- probable cross-spine relationships
- likely entity-to-manuscript references

These suggestions must be:
- explicit
- reviewable
- traceable to evidence
- user-accepted before canonical data changes

Do not silently mutate world entities, templates, timeline structure, or manuscript anchors based on model output alone.

---

## Do-not rules, with rationale

### Do not turn the editor into a generic word processor architecture
Why:
This product is about structured story building, manuscript diagnostics, worldbuilding, and narration-linked authoring.
A word processor architecture tends to over-prioritize formatting and flat-document assumptions.
That would weaken:
- binder/project structures
- line-addressable navigation
- event pinning
- world spine modeling
- narration alignment
- character-linked audio workflows

Instead:
Design around structured project entities such as chapters, scenes, blocks, anchors, issues, events, timeline nodes, templates, and world entities.

### Do not couple manuscript schema directly to any one AI model
Why:
Models will change over time.
The manuscript must outlive any one local or hosted provider.

If schema is shaped around one model's quirks, the repo becomes fragile and hard to evolve.

Instead:
Translate model output into canonical repository-owned domain structures.

### Do not couple world-schema or template structures directly to any one AI model
Why:
World templates, entities, and timeline systems are source-of-truth data.
They must remain stable whether suggestions come from a local model, hosted model, or no model at all.

Instead:
Treat AI as an advisor that proposes canonical structures rather than defining them.

### Do not couple UI components directly to speech or voice model implementations
Why:
UI must remain stable even when runtime engines change.
Direct coupling creates brittle code, poor testability, duplicated logic, and painful provider swaps.

Instead:
Expose capability-based services such as:
- transcribePassage
- alignNarration
- generateVoicePreview
- convertPerformance
- renderChapterAudio

### Do not use raw screen coordinates as durable references
Why:
Pixels and layout positions change whenever:
- text reflows
- panes resize
- fonts change
- zoom changes
- content is edited

These are not durable references.

Instead:
Use stable manuscript anchors, timeline identifiers, and entity identifiers.

### Do not store analysis results without canonical manuscript anchors
Why:
Analysis is only useful if the user can navigate to what it refers to.
Unanchored analysis becomes vague commentary.

Instead:
Require issue, event, and warning records to reference resolvable manuscript spans, timeline nodes, or world entities.

### Do not bury domain logic inside presentation components
Why:
Presentation components should render state and dispatch actions.
They should not own core manuscript, timeline, alignment, entity-resolution, or template-instantiation logic.

Instead:
Place domain logic in services, controllers, packages, or clearly owned domain modules.

### Do not treat worldbuilding timelines as plain rich-text notes if they require structured interaction
Why:
Interactive timelines need nodes, edges, dates, relationships, filters, causality, and locality-aware links.
Plain notes will fail once the feature becomes truly interactive.

Instead:
Model timeline spines, nodes, links, and metadata as real data structures.
Use rich text only for the editable details pane of a selected node.

### Do not treat templates as simple text presets when they represent domain entities
Why:
A template like Planet or Faction is not just reusable wording.
It is a structured object definition that may later power timeline placement, relationship graphs, AI suggestions, filtering, and continuity checks.

Instead:
Model templates as typed blueprints with fields, metadata, and structured instance creation.

### Do not let AI silently create or relink world entities without explicit review
Why:
Entity and timeline structure becomes source-of-truth data for the project.
Silent mutation by AI would reduce trust and create continuity errors.

Instead:
AI may propose:
- template suggestions
- missing entity suggestions
- probable introduction links
- possible node-to-node links

but user acceptance should be explicit before canonical world data changes.

### Do not assume cloud dependency for core author workflows
Why:
Local-first writing and privacy-safe operation are primary product goals.
Cloud-only assumptions will conflict with Local AI Only mode and offline creative workflows.

Instead:
Make cloud augmentation optional and additive.

---

## Coding guidance for Codex

When making changes in this repository:

- preserve architectural boundaries
- plan before large refactors
- prefer small coherent modules
- preserve contracts unless migration is intentional
- avoid speculative renames of shared schema
- if the user has edited CSS or styling in this repo, treat those changes as intentional interface work and do not revert, normalize, or overwrite them unless the user explicitly asks
- add a brief intent comment at the top of each new module and before each major logical section so future readers know why the block exists
- keep intent comments concise and about ownership or purpose, not line-by-line narration of obvious code
- update or add types when introducing new cross-module behavior
- add tests around domain behavior, not only UI rendering
- document major decisions when they affect shared architecture
- prefer extensible provider interfaces before choosing one engine
- prefer explicit typed data over hidden implicit state

When uncertain:
- preserve existing contracts
- add extension points rather than hardwiring assumptions
- leave clear TODO notes rather than inventing unsupported behavior

---

## What success looks like

A change is successful when:
- it reinforces the product as a story-building author IDE
- it respects repo boundaries
- it keeps manuscript content addressable
- it keeps issues and events navigable
- it keeps world templates and world entities structured
- it preserves timeline and cross-spine link integrity
- it preserves local-first workflows
- it does not hardwire the product to one model or one provider
- it improves traceability between manuscript, analysis, worldbuilding, and audio
- it updates tests and docs where shared behavior changed

---

## Initial documentation expectations

If these files do not exist and a task requires them, create them before major subsystem expansion:

- `docs/architecture/overview.md`
- `docs/architecture/manuscript-model.md`
- `docs/architecture/world-spine-model.md`
- `docs/architecture/world-template-model.md`
- `docs/architecture/audio-pipeline.md`
- `docs/architecture/voice-pipeline.md`
- `docs/architecture/analysis-pipeline.md`
- `docs/product/feature-map.md`
- `docs/product/terminology.md`

---

## Source-of-truth principle

If behavior is disputed:
- canonical data structures in `packages/manuscript-schema` win for manuscript identity and anchors
- canonical data structures in `packages/world-schema` win for templates, entities, timeline nodes, and cross-spine relationships
- shared contracts in `packages/shared-types` and `packages/job-contracts` win for service boundaries
- architecture docs in `docs/architecture` win for intended subsystem design
- product docs in `docs/product` win for feature intent and terminology

Codex should update source-of-truth docs when making meaningful architectural changes.

<!-- voice-issues-pointer:start -->
## Voice Issues Pointer

This repo uses a Voice Issue Recorder checklist at `voiceissues/voice-issues.md`.

When the user asks to fix issues:
- Read `voiceissues/VoiceIssuesAgent.md` for the workflow.
- Open `voiceissues/voice-issues.md` as the task list.
- Work pending `[ ]` entries in order, use `[working on]` while active, and tick resolved items `[x]` with a short note.
- Do not delete checklist items unless the user explicitly asks.
<!-- voice-issues-pointer:end -->
