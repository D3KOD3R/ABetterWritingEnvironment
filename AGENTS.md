# Repository Agent Router

This repository is a local-first, open-source authoring environment: a writer's IDE for structured manuscripts, diagnostics, worldbuilding, narration, and character-voice audiobook production. Preserve that identity; do not design it as a generic document editor, notes app, chatbot shell, or voice-cloning frontend.

## Universal rules

- Preserve unrelated user work. Inspect the working tree before changing files; do not reset, clean, rebase, force-pull, delete, stage, commit, or overwrite work outside the task without explicit authorization.
- Make the smallest coherent change. Keep production, domain, UI, and provider responsibilities separated; do not add dependencies without a concrete need and justification.
- Preserve existing contracts unless a migration is intentional. Avoid speculative shared-schema renames; when evidence is insufficient, do not invent unsupported behaviour.
- Add concise intent comments before new modules and major logical blocks; do not use comments as line-by-line narration.
- Keep routine narration terse. Use targeted searches, diffs, symbols, and bounded reads. Do not broadly read `features.md`, `apps/editor/public/app.js`, architecture roadmaps, logs, or project data unless a specific task requires a bounded section.
- Use deterministic Git and the repository supervisor as authority for changed-file state, test selection, pass/fail, and verification freshness. Escalate evidence in this order: supervisor handoff → compact report → failure excerpt → relevant diff → relevant source/test region → full log or broad source only as a last resort.
- Keep author-facing behaviour location-aware and durable where it affects structured project data. Keep UI rendering and model/provider mechanics behind the appropriate service, schema, or adapter boundaries.

## Scoped instruction routing

Read only the narrowest agent file for the responsibility being **modified**. Add another agent only when that responsibility also changes. Do not read unrelated agent files pre-emptively, and do not load an agent merely because code calls or reads that domain.

| Responsibility being modified | Read |
| --- | --- |
| Author-facing feature addition or behaviour change, `Feature working`, or `bench` | `agents/FeatureWorkAgent.md` |
| Editor shell, host boundary, feature slice, editor state, or adapter | `agents/EditorAgent.md` |
| Save/load/autosave/import/export or project-cache semantics | `agents/PersistenceAgent.md` |
| Canonical schema, IDs, anchors, DTOs, or shared contracts | `agents/DomainSchemaAgent.md` |
| World Spine, templates, entities, timeline nodes/edges, or world suggestions | `agents/WorldbuildingAgent.md` |
| `services/analysis`, diagnostics, issue/event/continuity analysis, or extraction/suggestion analysis | `agents/AnalysisAgent.md` |
| Narration, recording, ASR/alignment, audio takes, TTS, voice conversion, or provider boundary | `agents/AudioVoiceAgent.md` |
| Product Local AI (`services/local-ai` or author-facing local-AI features) | `agents/LocalAiAgent.md` |
| Desktop/Tauri shell, lifecycle, filesystem integration, local desktop settings, packaging, or distribution | `agents/DesktopAgent.md` |
| Changing repository-supervisor implementation, routing configuration, test-group definitions/registration, verification policy, or supervisor architecture | `agents/TestSupervisorAgent.md` |
| Documentation architecture, source-of-truth placement, or public/product/architecture docs | `agents/DocumentationAgent.md` |

Examples: read-only World Spine navigation loads `WorldbuildingAgent.md`; implementing an author-facing World Spine behaviour loads `WorldbuildingAgent.md` + `FeatureWorkAgent.md`; changing which tests World Spine routes to loads `TestSupervisorAgent.md`. Add `PersistenceAgent.md` only when persistence semantics change. Narration/voice work loads `AudioVoiceAgent.md`, not automatically `EditorAgent.md`. Product Local AI work loads `LocalAiAgent.md`; developer tooling is not product Local AI. Feature documentation does not by itself require `DocumentationAgent.md`.

Do not load `TestSupervisorAgent.md` merely to use or run the existing supervisor, consume a supervisor handoff/report, inspect existing tests, identify existing coverage for ordinary feature work, or run focused tests.

## Special workflows

- `fix issues`: read `voiceissues/VoiceIssuesAgent.md` before the active issue list and follow it.
- `finalise work`: read `finalisework/FinaliseWorkAgent.md` before closeout and follow it.
- `retrace steps on task ...`: read `agentContextRetrace.md` and follow its recovery procedure before continuing.
- `Feature working` and `bench`: read `agents/FeatureWorkAgent.md` before acting.

Agent files state what Codex must or must not do. Architecture documents explain how a subsystem works. Product documents explain what a feature is meant to accomplish. Keep each rule in its owning location wherever practical.
