# A Better Writing Environment — Master Project Status

Last reviewed: 2026-08-26

This is the high-level progress checklist for the product, platform/tooling work, and external R&D that may later be integrated into the application.

This file is intentionally much smaller than `features.md`. Use `features.md` for detailed feature IDs, implementation locations, and testable subfeatures. Use this file to answer: **What are we working on, what state is it in, and what should happen next?**

## Status legend

- `DONE` — complete enough that it should only receive maintenance/regression work.
- `ACTIVE` — currently being developed or is a near-term product focus.
- `PROVING` — being tested or calibrated before production integration.
- `READY TO INTEGRATE` — external/isolated proof is strong enough for a production integration slice.
- `PLANNED` — agreed future work, not yet active.
- `DEFERRED` — deliberately postponed until dependencies are stable.
- `AUDIT` — potentially useful prior/external work that needs review before being treated as an active integration source.

## Current priority order

1. **Task-scoped deterministic finalise / commit / push** — remove mechanical Git closeout work from Codex.
2. **Return to high-value product work** — World Spine, local writing AI, narration, voice/audiobook, persistence/editor boundaries.
3. **Local Ollama developer advisory layer** — local summaries, failure triage, and commit-message suggestions after deterministic tooling is stable.
4. **Clean merge automation** — automate conflict-free merges; reserve Codex for actual semantic conflicts.

External TrOCR accessibility R&D can continue in parallel because it is deliberately isolated from the production application.

---

## Platform and developer-tooling work

| Workstream | Status | Current state | Next action | Priority |
| --- | --- | --- | --- | --- |
| Agent-file/context refactor | `DONE` | Matched final benchmark passed: root 35,487 → 4,969 bytes; read-only World Spine footprint 6,330 bytes; approximately 82.2% static reduction. Bounded-read quality retained and only `WorldbuildingAgent.md` loaded beyond root. | Maintenance only; separately measure task-generated search/tool context if useful. | Done |
| Repository/test supervisor | `DONE` | Deterministic changed-file routing, FAST/AFFECTED/FULL selection, compact reports, Git-state fingerprinting, stale-handoff protection, and canonical full test entry point are implemented and hardened. | Maintenance only unless a routing/test regression is found. | Done |
| Codex context/usage measurement | `ACTIVE` | The scoped-agent benchmark is complete; exact token/credit measurement was unavailable. Task-generated search, shell, tool, and bounded-source context remains a separate measurement concern. | Measure task-generated context separately while preserving bounded-read quality. | Ongoing |
| Deterministic finalise / commit / push | `PLANNED` | Design agreed; not implemented. Supervisor already knows Git state and verification freshness. | Add task-scope/baseline ownership, safe explicit staging, fresh-verification gate, commit, push, and remote-HEAD confirmation. | P1 |
| Compact Codex evidence ladder | `DONE` | The supervisor-first evidence ladder is encoded in root instructions and relevant special workflows: supervisor handoff → compact report → failure excerpt → relevant diff → relevant source/test region → full log/broad source last. | Maintenance only; separately measure task-generated search/tool context. | Done |
| Local Ollama developer advisory layer | `PLANNED` | Intentionally deferred while deterministic facts remain the supervisor's responsibility. | Use local AI for failure/log summaries, diff summaries, commit-message suggestions, and advisory triage only. | P4 |
| Clean merge automation | `PLANNED` | Concept agreed. | Node handles clean merge + verification + push; stop and hand only conflicting hunks/relevant context to Codex when conflicts exist. | P5 |
| Context-retrace workflow | `DONE` | The compact recovery workflow begins from deterministic repository evidence, avoids preloading large docs/source/logs, and loads only the scoped agents needed for the resumed responsibility. | Maintenance only. | Done |
| Finalise-work workflow | `DONE` | The instruction workflow starts from supervisor/Git evidence, conditionally reads feature/voice/docs information, and avoids broad closeout investigation. | Mechanical Git finalisation is tracked separately under Deterministic finalise / commit / push. | Done |
| Voice-issues workflow | `DONE` | The dedicated trigger is preserved and duplicated universal rules were reduced. | Maintenance only. | Done |

---

## Core product and architecture work

| Workstream | Status | Current state | Next action | Priority |
| --- | --- | --- | --- | --- |
| Editor architecture / `app.js` decomposition | `ACTIVE` | Significant extraction into feature/state/adapter/host boundaries; roadmap remains in Phase 2. | Continue extracting feature-owned behaviour and keep `app.js` as orchestration rather than a new feature destination. | High |
| Project persistence architecture | `ACTIVE` | `ProjectPersistenceService` owns save/load/autosave/import/export; project-file and browser-cache recovery has been hardened substantially. | Continue eliminating stale/collapsed-state edge cases and preserve the project file as canonical durable state. | High |
| Manuscript editor / Issue Console | `ACTIVE` | Broad functionality exists: anchored diagnostics, find/replace, metadata, tasks/notes, binder management, proofing/dictionary, writing targets, revisions, navigation, and decoration/projection work. | Continue canonical anchored-record work and move remaining shell behaviour behind stable feature/host boundaries. | Medium–High |
| Proof-read run history / safe reversal | `PLANNED` | Draft design defines durable logical change history per proof-read run, before/after review, word/change statistics, proof-read lineage, safe historical undo/redo, and an opt-in rolling manuscript review that exists only while Proof Read settings is open with a selected run. Normal manuscript editing remains free of historical conflict highlights. | Review `Design notes/proofread-run-history-and-safe-reversal-design.md`, then implement the durable history and reversal engine before the richer Project Settings and manuscript-review UI. | Near-term |
| Local Writing Assistant | `ACTIVE` | Foundation implemented: local provider abstraction, `llama.cpp` route, model library/settings, local-only modes, and Tiny/Standard/Large routing design. | Incremental changed-block analysis, installed-model routing, runtime start/stop controls, Standard/Large adapters. | High |
| Event Pinning | `ACTIVE` | Foundation implemented with structured event records, local detection, manual manuscript-to-World-Spine event creation, and navigation. | Richer taxonomy and later stronger AI detection/linking. | Medium |
| Narration Follow Mode | `ACTIVE` | Substantial recording/follow/alignment foundation and UI exist. Narration Follow is explicitly a tracking/alignment sub-workflow inside the combined Narration + Voice workspace; it does not own character identity or performed emotion. | Exercise real desktop microphone loop, tune Sherpa/Whisper behaviour, add pause/recovery, improve repeat/skip alignment. | High |
| Character Voice / Audiobook Production | `ACTIVE` | Voice profile/job foundations plus audiobook schema for sections, clips, production lanes, take state, playback metadata, and legacy migration. The long-term performance-preserving conversion architecture is documented separately and remains deferred. | Wire recorder into audiobook clips, build section/take manager, add safe source-WAV/temp promotion pipeline. Do not begin deferred speaker-attribution/performance-conversion phases yet. | High |
| Performance-preserving audiobook conversion roadmap | `DEFERRED` | Architecture is documented in `docs/architecture/performance-preserving-audiobook-roadmap.md`: human source performance remains authoritative; future local AI speaker attribution is advisory; performance segments bridge manuscript identity to source-audio ranges; TTS remains separate from voice conversion. | Keep as a design reference until World Spine/current product priorities, local AI, narration source recording, persistence safety, and voice-conversion R&D readiness gates are satisfied. | Later |
| World Spine | `ACTIVE` | Major functional timeline/worldbuilding system exists: structured nodes/events, location rows, split spines, scene metadata, world entities, catalogue links, scene reordering, zoom/scroll/panel behaviour. | Direct node editing, filters, accepted-suggestion application, edge editing, richer cross-spine filtering. | High |
| World Spine location-row CRUD | `ACTIVE` | Small near-term feature/learning slice; deletion is not being implemented by this tracker update. | Trace render → handler → canonical state → persistence → references → tests, then implement the delete behaviour manually with review support. | Good learning slice |
| Dream Scaping | `ACTIVE` | Foundation exists with suggestion/domain structures and World Spine studio integration. | Author-facing idea submission, accept/reject, optional reviewed promotion to timeline nodes or scene drafts. | Medium |
| Project loader / Scrivener import | `ACTIVE` | Mature canonical ABE loading and extensive Scrivener import/persistence support exist. | Richer load diagnostics and retained-template browser. | Medium |
| Spotify / writing-music integration | `ACTIVE` | Functional Web Playback integration, compact player, playlist/search flows, tempo reference, and browser-local playback resume. | Queue/current-playing readback, playlist pagination, first-run guidance, possible desktop redirect bridge. | Low–Medium |
| Mobile voice-first authoring | `DEFERRED` | Architecture is documented but production implementation is intentionally waiting. | Begin only after host-neutral manuscript commands, persistence boundaries, and dictation contracts are stable. | Later |
| ProseMirror/editor-host direction | `DEFERRED` | Historical migration planning exists; current architecture uses an editor-host boundary while Phase 2 continues. | Reassess only after projection/host boundaries are stable. Avoid another editor migration without a specific proven need. | Later |

Detailed feature status and implementation locations remain canonical in `features.md`.

---

## External R&D and future integration

| External workstream | Repository / location | Status | Proven so far | Integration target / next action | Priority |
| --- | --- | --- | --- | --- | --- |
| Handwriting accessibility / TrOCR | `D3KOD3R/TrOCR-Handwriting-Prototype` | `PROVING` | Webcam capture works; stage-gated Workbench works; Microsoft TrOCR runs locally and on CUDA; real handwriting recognition works; orientation materially affects recognition. | Continue focus/exposure/contrast/tight-ROI calibration. Then prove automatic orientation, page detection, stable capture, segmentation, and full-page OCR before production integration. | High external R&D |
| TrOCR → authoring-app accessibility input | Production integration target | `DEFERRED` | External prototype is intentionally proving the pipeline first. | After reliable recognition, add a small production vertical slice and later Handwriting/Accessibility Settings + Advanced/Diagnostics using the proven service boundaries. | After proof |
| AudioBookCurator | `D3KOD3R/AudioBookCurator` | `AUDIT` | Repository describes a local audiobook curation stack for narrators/character voices. | Compare useful components/lessons with the current in-app audiobook schema and voice services before porting anything. | Audit first |
| MovieNarrator / RVC UI work | `D3KOD3R/MovieNarrator` | `AUDIT` | External RVC-derived voice tooling exists. | Audit against current `services/voice` provider boundaries and the performance-preserving audiobook R&D exit gate; reuse only proven capabilities that preserve source performance and fit current architecture. | Audit first |
| Other historical voice/narration prototypes | Other D3KOD3R voice/narration repos | `AUDIT` | Potential prior experimentation exists, but integration relevance has not been verified in this status pass. | Do not treat as active dependencies until individually audited. | Later |

### TrOCR current checkpoint

The external TrOCR prototype is currently in the **manual acquisition/orientation/conditioning calibration phase**. Its active technical question is no longer whether TrOCR can run; it is whether the camera pipeline can reliably present an upright, focused, well-exposed, high-contrast, tightly cropped handwritten line to the recognizer and objectively measure improvements/degradation.

Do not prematurely merge the prototype into the main application. Integrate only after the input/recognition boundary is stable enough to survive a small production vertical slice.

---

## Current product-program view

Treat the work as three parallel programmes:

### PRODUCT

Author-facing value:
- manuscript/editor workflows
- World Spine/worldbuilding
- Local Writing Assistant
- narration follow
- character voice/audiobook production
- import/persistence
- selected companion integrations

### PLATFORM

Engineering leverage and reliability:
- editor decomposition
- persistence boundaries
- deterministic test supervisor
- scoped agent instructions
- context/usage measurement
- deterministic finalise/push
- later local advisory AI and clean merge automation

### R&D

High-uncertainty technology proven away from production first:
- TrOCR handwriting accessibility
- selected voice/audio experiments that still have clear production relevance
- future experimental model/input pipelines

Work on PLATFORM or R&D is not automatically product delay; it should, however, have an explicit production benefit or proof question and should not become an indefinitely maintained second application.

---

## Maintenance rules for this tracker

- Update this file when a workstream changes status, priority, current milestone, or next action.
- Do not duplicate detailed feature implementation notes from `features.md` here.
- Add external prototypes only when they have a credible path into this product; unrelated repositories do not belong in this tracker.
- When an external prototype becomes reliable enough for production work, move it from `PROVING` to `READY TO INTEGRATE` and define the smallest production vertical slice.
- When a platform optimization is complete, record its measured result rather than merely marking it done.
- Token/context optimization measurements belong in `docs/research/agent-refactor-context-audit.md`.
- Prefer one clear next action per workstream so this remains a usable checklist rather than another architecture document.

## Source-of-truth pointers

- Detailed product feature tracker: `features.md`
- Editor architecture/refactor: `docs/architecture/editor-application-roadmap.md`
- Proof-read run history / safe reversal design: `Design notes/proofread-run-history-and-safe-reversal-design.md`
- Narration Follow architecture: `docs/architecture/narration-follow-mode.md`
- Voice pipeline architecture: `docs/architecture/voice-pipeline.md`
- Deferred performance-preserving audiobook architecture: `docs/architecture/performance-preserving-audiobook-roadmap.md`
- Test supervisor architecture: `docs/architecture/test-harness-repo-supervisor-roadmap.md`
- Mobile architecture: `docs/architecture/mobile-friendly-architecture.md`
- Agent/context baseline and refactor research: `docs/research/agent-refactor-context-audit.md`
- External handwriting proof: `D3KOD3R/TrOCR-Handwriting-Prototype`
