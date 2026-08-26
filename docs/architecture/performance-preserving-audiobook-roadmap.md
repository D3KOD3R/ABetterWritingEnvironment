# Performance-Preserving Audiobook Architecture Roadmap

**Status:** Deferred design specification  
**Implementation priority:** Later / not currently scheduled  
**Primary workspace:** Narration + Voice  
**Related workstreams:** Narration Follow Mode, Character Voice / Audiobook Production, Local Writing Assistant, project persistence, external voice-conversion R&D

## Why This Exists

The current application already has most of the foundations needed for a human-performed, character-voice audiobook workflow:

- Narration Follow tracks a live read against canonical manuscript anchors and keeps the manuscript positioned for the narrator.
- Human recordings can be saved as manuscript-linked takes.
- The manuscript schema supports characters and speaker assignments.
- The voice layer supports voice profiles, speaker bindings, and render jobs behind provider-independent contracts.
- The audiobook schema already distinguishes human-source, narrator-master, character-conversion, speech-synthesis, and rendered-master production lanes.

What is not yet explicit enough is the bridge between those pieces. This roadmap defines that bridge without changing current implementation priorities.

The intended product is **not** an expressive TTS system that reconstructs a performance from text. The intended performance-conversion workflow starts with the author's or narrator's real spoken performance and preserves that performance while changing the perceived vocal identity for narrator or character roles.

This document is therefore a future architecture contract. It should guide later implementation once higher-priority work is ready, but it should not trigger near-term feature development by itself.

---

## Current Priority Context

This roadmap is deliberately deferred while the project remains focused on higher-value enabling work:

1. Make the World Spine efficient, reliable, and easier to reason about.
2. Continue integrating the local AI/provider foundation that can later support speaker attribution and other reviewable manuscript intelligence.
3. Continue Narration Follow and audiobook-recording foundations where useful, especially canonical source recording and persistence boundaries.
4. Continue isolated R&D where technology is not yet proven enough for production integration, including voice-conversion experiments and other accessibility/input research.

No part of this specification should displace those priorities.

---

## Core Product Invariant

> **In performance-conversion mode, the recorded human take is the authoritative source of timing, pacing, phrasing, emphasis, pauses, prosody, and emotional delivery. Voice conversion changes vocal identity while preserving the performed delivery. The system must not reconstruct or regenerate that performance from manuscript text.**

This invariant is the primary architectural rule for the future workflow.

Consequences:

- Speech-to-text is used for manuscript tracking, alignment, recovery, and metadata. It is not the source of emotion or delivery.
- Local AI may identify or suggest who is speaking, but it does not decide how the line should be performed.
- Character voice conversion consumes source human audio.
- Text-to-speech remains a separate, explicit production mode and must never silently replace performance conversion.
- Original human-source recordings are immutable production assets. Derived character/narrator outputs must retain provenance back to the source take.

---

## Goals

The eventual architecture should support a workflow where one person can perform an audiobook naturally, including the desired emotion and delivery, while the application later maps manuscript passages to narrator/character identities and converts the corresponding portions of the recording into selected voices.

The architecture should:

- preserve the original recording as the authoritative performance source;
- identify narrator and character passages from canonical manuscript structure;
- allow local AI to propose missing speaker assignments without making irreversible changes;
- keep speaker identity separate from voice-profile selection;
- map manuscript spans to precise time ranges in the human recording;
- create non-destructive performance segments rather than cutting source files in place;
- convert each segment using the target narrator/character voice profile;
- retain traceable provenance from every derived output back to its source clip, manuscript range, speaker assignment, voice profile, conversion profile, and provider/model version;
- allow rerendering when a voice model or assignment changes without rerecording the human performance;
- allow rerecording when the performance itself needs improvement without corrupting previous takes;
- compose selected derived clips into scene, chapter, and book masters through the audiobook timeline model;
- keep TTS available as a separate fallback or deliberate production lane rather than conflating it with voice conversion.

---

## Non-Goals

This roadmap does not currently propose:

- implementing a voice-conversion engine;
- selecting a final RVC, diffusion, speech-to-speech, or hosted voice provider;
- performing emotional inference from speech-to-text;
- having an LLM direct or rewrite the narrator's performance;
- automatically accepting speaker assignments without author review;
- replacing Narration Follow with diarization or semantic speech understanding;
- moving audiobook state into editor DOM state;
- coupling project data to a particular local model runtime;
- destructive waveform editing of original source recordings;
- making this workstream higher priority than current World Spine, local AI, persistence, or R&D work.

---

# Target Architecture

## High-Level Flow

```text
CANONICAL MANUSCRIPT
Characters + dialogue/narration blocks + speaker assignments
            │
            │ optional local-AI attribution proposals
            ▼
REVIEWED SPEAKER IDENTITY
Narrator / Character A / Character B / ...
            │
            ├──────────────────────────────────────┐
            │                                      │
            ▼                                      ▼
HUMAN NARRATION                         CHARACTER VOICE BINDINGS
Microphone performance                  Character A -> Voice Profile A
            │                            Character B -> Voice Profile B
            ├─ Live ASR -> follow only   Narrator   -> Voice Profile N/original
            │
            ▼
HUMAN SOURCE TAKE
Durable source WAV + manuscript anchor
            │
            ▼
POST-TAKE ALIGNMENT
Manuscript ranges <-> audio time ranges
            │
            ▼
PERFORMANCE SEGMENTS
Non-destructive sourceClip + time range + manuscript range + speaker
            │
            ▼
PERFORMANCE-CONVERSION JOBS
source performance segment + voice binding + conversion profile
            │
            ▼
DERIVED AUDIO CLIPS
narrator-master / character-conversion lanes
            │
            ▼
TAKE REVIEW + AUDIOBOOK TIMELINE
select / approve / trim / gain / fade / pause
            │
            ▼
RENDERED MASTER
scene -> chapter -> book
```

---

# Architectural Boundaries

The existing application layering should remain intact.

## `packages/manuscript-schema`

Owns durable manuscript identity:

- characters;
- character aliases;
- narration/dialogue block identity;
- canonical manuscript anchors;
- accepted speaker assignments.

It should not own AI suggestions, audio files, provider models, waveform state, or render jobs.

## `packages/audiobook-schema`

Owns durable audiobook-production structure:

- audiobook sections;
- source and derived clips;
- take state;
- performance-segment provenance;
- production lanes;
- non-destructive timeline items;
- playback/mastering metadata.

It should remain provider-neutral.

## `services/analysis` / Local AI Provider Layer

Owns future speaker-attribution proposals and confidence/evidence metadata.

It must not directly mutate canonical speaker assignments. It emits reviewable suggestions that the manuscript command path may accept or reject.

## `services/audio`

Owns recording, live follow-session state, transcript/alignment processing, and mapping audio timing evidence back to manuscript anchors.

It should not decide character identity or choose voice models.

## `services/voice`

Owns voice profiles, bindings, conversion-provider adapters, conversion jobs, render lifecycle, and provider-specific execution.

It should not own manuscript identity, editor rendering, or source recording mutation.

## `apps/editor/public/features/narration/*`

Owns Narration + Voice recording/follow/review UI behavior and browser-side orchestration through service contracts.

## `apps/editor/public/features/voice/*`

Owns voice-binding, conversion review, render-job UI, and provider-neutral user actions.

## `app.js`

Must remain orchestration only. This future workflow must not be implemented as a new block of feature logic in `app.js`.

---

# Added Architecture Components

## 1. Speaker Attribution Suggestions

### Purpose

Identify who is speaking in manuscript passages when canonical speaker assignments are absent, incomplete, or stale.

This is a manuscript-analysis task, not an audio-emotion task.

### Proposed Record

```ts
interface SpeakerAttributionSuggestion {
  id: string;
  projectId: string;
  anchor: ManuscriptAnchor;
  role: "narrator" | "character";
  proposedCharacterId?: string;
  proposedSpeakerLabel: string;
  confidence: number;
  rationale: string;
  evidenceExcerpt: string;
  sourceProviderId: string;
  sourceModelId?: string;
  sourceTextFingerprint: string;
  reviewState: "pending" | "accepted" | "rejected";
  createdAt: string;
  reviewedAt?: string;
}
```

### Rules

- AI output remains advisory.
- Accepted suggestions are converted into canonical `SpeakerAssignment` records through manuscript-owned commands.
- Rejected suggestions remain inspectable where useful but do not affect voice rendering.
- Assignment confidence must not be silently reused after the source text changes materially.
- Narrator is a first-class role rather than a fallback character.

---

## 2. Performance Segments

### Purpose

Map a non-destructive portion of a human source take to a canonical manuscript range and an accepted speaker identity.

A single long take may contain many alternating narrator/character segments. The system should not physically cut or overwrite the source recording merely to represent those boundaries.

### Proposed Record

```ts
interface AudiobookPerformanceSegment {
  id: string;
  sectionId: string;
  sourceClipId: string;
  manuscriptAnchor: ManuscriptAnchor;
  sourceTextFingerprint: string;
  startMs: number;
  endMs: number;
  speakerAssignmentId: string;
  characterId?: string;
  role: "narrator" | "character";
  alignmentConfidence: number;
  boundaryStatus: "aligned" | "needs-review" | "manually-adjusted" | "stale";
  createdAt: string;
  updatedAt: string;
}
```

### Rules

- `sourceClipId` must refer to a human-source or deliberately imported performance clip.
- Segment boundaries are metadata only; the original source media is not rewritten.
- Segments may overlap temporarily during review but cannot both be approved for the same production slot unless the timeline explicitly permits layering.
- Low-confidence speaker or word-timing boundaries should remain reviewable.
- Manual correction must never destroy original automatic alignment evidence.

---

## 3. Performance-Conversion Job

### Purpose

Represent voice conversion as a source-audio transformation rather than a text-generation job.

### Proposed Contract

```ts
interface PerformanceConversionJob {
  id: string;
  projectId: string;
  sectionId: string;
  performanceSegmentId: string;
  sourceClipId: string;
  sourceStartMs: number;
  sourceEndMs: number;
  speakerAssignmentId: string;
  voiceProfileId: string;
  conversionProfileId?: string;
  providerId: string;
  providerModelId?: string;
  status: "draft" | "queued" | "rendering" | "rendered" | "failed" | "cancelled";
  progress: number;
  outputClipId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Required Inputs

Performance-conversion mode must require:

- a human source clip;
- a bounded source-audio range or source segment;
- an accepted speaker assignment;
- a selected voice profile;
- a provider/conversion profile.

Manuscript text may be included as alignment/context metadata, but it is not the performance source.

---

## 4. Conversion Provider Contract

The application should not hard-code RVC or any other engine into canonical records.

A future adapter should approximately expose:

```ts
interface VoiceConversionProvider {
  descriptor: VoiceConversionProviderDescriptor;
  validateProfile(profileId: string): Promise<ValidationResult>;
  convertPerformance(input: PerformanceConversionInput): Promise<PerformanceConversionResult>;
}
```

Provider-specific settings belong in provider/config records, not manuscript or audiobook identity records.

The first implementation may be local-first, but the contract should not make local execution mandatory if a future user deliberately enables a hosted provider.

---

## 5. Derived Clip Provenance

The existing audiobook clip production references should be extended or used consistently so every conversion output can answer:

- Which human source clip created this?
- Which exact audio range was used?
- Which manuscript passage did it represent?
- Which speaker assignment was authoritative?
- Which character was assigned?
- Which target voice profile was used?
- Which conversion profile/provider/model version rendered it?
- Is the output stale because the source take, assignment, or voice profile changed?

The generated clip belongs in a derived production lane such as `character-conversion` or `narrator-master`; it must never replace the source clip record.

---

# Narration + Voice Workspace Design

Narration and Voice remain one top-level workspace because they form one author-facing production workflow. They should still have explicit sub-workflows so implementation boundaries remain understandable.

Suggested page regions:

1. **Narration Follow** — live manuscript tracking and viewport control.
2. **Record Performance** — microphone/source take capture.
3. **Take Review** — waveform, transcript timing, source take approval/rerecord.
4. **Speaker Attribution** — narrator/character assignment review.
5. **Character Voices** — speaker-to-voice profile selection.
6. **Conversion Review** — source vs converted playback, failures, rerender.
7. **Sections / Takes** — section and take manager.
8. **Audiobook Timeline** — selected clip sequencing and non-destructive mastering.
9. **Render** — scene/chapter/book master jobs.

These are workflow regions, not additional top-level application pages.

---

# Local AI Role

The future local AI capability is an enabling dependency for this roadmap, not its product owner.

Potential future tasks:

- speaker attribution from manuscript context;
- alias resolution;
- ambiguity detection;
- stale-assignment review after manuscript edits;
- potentially suggesting section boundaries or identifying passage transitions.

Local AI must return structured, reviewable results. It must not:

- infer or generate performance emotion;
- rewrite source audio;
- choose character voices without user intent;
- automatically commit ambiguous speaker identity;
- become a hard dependency for opening or playing an audiobook project.

A deterministic/manual fallback must remain possible for core production records.

---

# Source Recording Policy

Human source recordings are production originals.

Preferred eventual source format remains the existing audiobook target:

- WAV;
- 48 kHz;
- 24-bit;
- mono unless a future production requirement explicitly changes this.

Rules:

- never destructively trim or normalize the only source recording;
- edits belong to timeline metadata or new derived media;
- rerecording creates a new take;
- conversion creates a new clip;
- approved/selected status chooses which clip participates in production rather than deleting alternatives;
- project-media deletion of a source clip requires explicit reference checks against performance segments and derived clips;
- project save/load must preserve provider/model/version provenance without requiring the provider to be installed merely to reopen the project.

---

# R&D Integration Strategy

Voice conversion remains a provider behind a contract until an implementation proves itself.

Existing/historical RVC or audiobook repositories may be audited for useful components, but they should not become production dependencies merely because they already exist.

## R&D Questions to Prove Before Integration

A candidate conversion engine should be evaluated for:

- intelligibility;
- target-speaker identity consistency;
- preservation of phrase timing and pauses;
- preservation of relative emphasis and performed dynamics;
- continuity across adjacent short converted segments;
- artifact rate around consonants, breaths, laughter, whispers, shouting, and rapid speech;
- acceptable local latency/throughput on target hardware;
- deterministic/reproducible model configuration where possible;
- licensing and distribution compatibility;
- offline/local-first operation where required by product direction;
- predictable failure behavior.

## R&D Exit Gate

Do not integrate a voice-conversion provider into the production editor until it can consume a source performance clip through a stable adapter and return a traceable derived output without forcing provider-specific fields into canonical audiobook/manuscript schemas.

---

# Implementation Roadmap — Deferred

## Phase 0 — Architecture Record Only

**Status: now / documentation only**

- Record this design.
- Add no production code solely because the spec exists.
- Continue current World Spine, local AI, narration, persistence, and R&D priorities.

**Exit:** architecture is available as a future source of truth.

## Phase 1 — Canonical Speaker Attribution Workflow

**Start only when local AI reviewable-suggestion/provider infrastructure is mature enough.**

- define `SpeakerAttributionSuggestion` contract;
- implement deterministic accept/reject into `SpeakerAssignment`;
- support aliases and narrator role;
- add stale detection after manuscript edits;
- add review UI;
- start with manual/rule fixtures before relying on a model.

**Exit:** speaker identity can be reviewed and persisted independently of voice conversion.

## Phase 2 — Recorder-to-Audiobook Canonical Source Wiring

- make saved human recordings first-class `human-source` audiobook clips;
- prefer project-owned source WAV path where production recording pipeline is ready;
- retain legacy compatibility during migration;
- connect section/take state to existing take review UI.

**Exit:** human performances are durable audiobook source clips rather than legacy-only recordings.

## Phase 3 — Performance Segmentation

- add `AudiobookPerformanceSegment`;
- derive manuscript/audio ranges from word-level alignment plus accepted speaker assignments;
- flag low-confidence boundaries;
- support manual boundary correction;
- persist non-destructive segment metadata.

**Exit:** one human take can safely map to multiple narrator/character ranges.

## Phase 4 — Performance Conversion Contract

- add `PerformanceConversionJob`;
- add provider adapter interface;
- add provenance fields;
- add explicit failure/stale handling;
- use a deterministic fake/placeholder provider for contract tests first.

**Exit:** application architecture can execute audio-source conversion jobs without depending on a specific engine.

## Phase 5 — First Proven Voice-Conversion Provider

**Start only after R&D exit gate is satisfied.**

- integrate one proven provider behind the contract;
- convert one reviewed performance segment;
- save derived clip to `character-conversion` lane;
- A/B source and output;
- retain source performance unchanged.

**Exit:** smallest production vertical slice proves the core product invariant.

## Phase 6 — Character/Narrator Production Workflow

- resolve voice bindings across a scene;
- queue multiple conversion jobs;
- review failures/ambiguities;
- approve/select derived takes;
- rerender after voice-binding changes;
- preserve narrator-original option.

**Exit:** one recorded scene can be produced into multiple character voices without rerecording.

## Phase 7 — Timeline and Mastering Integration

- assemble approved source/converted clips through `TimelineItem` records;
- handle transitions, pauses, fades, gain, and continuity;
- scene/chapter playback;
- chapter/book render orchestration;
- preserve end-to-end provenance.

**Exit:** complete audiobook production path from human take to rendered chapter/book master.

---

# Readiness Gates

This roadmap should remain deferred until enough of the following are true:

### Gate A — World Spine / Current Product Priorities

Current high-priority authoring work is no longer being displaced by basic World Spine reliability or architecture issues.

### Gate B — Local AI Foundation

- model provider routing is stable;
- installed-model discovery/runtime management is usable;
- structured reviewable outputs are established;
- model tasks can be added without coupling features directly to a model process.

### Gate C — Narration Source Recording

- recorder and project-media persistence are reliable;
- source take identity and canonical manuscript anchors are stable;
- recorder-to-audiobook schema migration has a clear path;
- word-level timing/alignment is reliable enough to create reviewable ranges.

### Gate D — Voice Conversion R&D

At least one candidate engine demonstrates acceptable performance preservation and can fit behind a provider contract.

### Gate E — Persistence / Project Safety

- source and derived media can be safely promoted, saved, reopened, and deleted with reference checks;
- stale source/assignment/derived states are representable without data loss.

These gates are readiness criteria, not a promise that the feature becomes the next priority as soon as they pass.

---

# Testing Strategy — Future

## Schema / Unit Tests

- speaker-attribution suggestion normalization;
- accept/reject command behavior;
- performance-segment range validation;
- stale fingerprint detection;
- source/derived provenance;
- conversion-job lifecycle;
- voice-binding rerender invalidation;
- timeline selection of derived clips.

## Contract Tests

Use a fake performance-conversion provider before real R&D integration.

Validate:

- source audio is mandatory for conversion mode;
- TTS cannot masquerade as conversion;
- provider metadata is retained;
- failed jobs do not mutate source clips;
- rerender creates new derived output rather than overwriting source.

## Integration Fixtures

Create a small deterministic manuscript fixture containing:

- narrator prose;
- two characters;
- repeated speaker switches;
- one ambiguous line;
- one corrected assignment;
- one human source recording with known timing map.

Use it to test manuscript -> attribution -> segment -> binding -> conversion -> timeline behavior.

## End-to-End Production Test

When a real conversion provider is ready:

1. record one short scene naturally;
2. confirm live follow remains only a tracking aid;
3. approve speaker assignments;
4. derive performance segments;
5. convert two character segments;
6. compare source and output timing/performance;
7. change one character voice and rerender without rerecording;
8. render a scene master;
9. reopen the project and prove all provenance and playback links survive.

---

# Architectural Decisions to Preserve

1. **Human performance is authoritative.**
2. **STT tracks/aligned manuscript position; it does not author performance.**
3. **Speaker identity is canonical manuscript data after explicit acceptance.**
4. **AI speaker attribution is advisory.**
5. **Voice binding is separate from speaker identity.**
6. **Performance conversion requires source audio.**
7. **TTS is an explicit separate lane.**
8. **Source recordings are immutable; editing and conversion are non-destructive.**
9. **Derived output retains complete provenance.**
10. **Provider/model technology stays behind contracts.**
11. **Canonical data belongs in packages; services own workflows/providers; editor features own UI; `app.js` stays thin.**
12. **This roadmap remains deferred until current higher-priority work and readiness gates justify implementation.**

---

# Relationship to Existing Architecture

This specification extends rather than replaces the current design:

- Narration Follow keeps its existing alignment and viewport responsibility.
- `SpeakerAssignment` remains the canonical manuscript representation of speaker identity.
- `SpeakerVoiceBinding` remains the bridge from speaker to voice profile.
- `AudiobookProductionKind` and `AudiobookProductionLane` remain the production taxonomy.
- `human-source` remains the immutable performed source.
- `character-conversion` and `narrator-master` remain derived lanes.
- `speech-synthesis` remains explicitly separate.
- existing non-destructive timeline/take-state concepts remain valid.

The principal additions are:

1. a first-class reviewable speaker-attribution workflow;
2. a first-class performance-segment record linking manuscript identity to source-audio time ranges;
3. a first-class performance-conversion job whose input is human audio rather than text;
4. a hard architecture invariant that prevents future implementations from substituting expressive TTS for performance-preserving voice conversion.

---

## Future Source-of-Truth Update

When this roadmap becomes active, the implementation task should update together:

- this architecture roadmap;
- `features.md` Feature 05 with new testable subfeatures;
- `docs/PROJECT-STATUS.md` priority/current-state/next-action entry;
- shared/audiobook schema contracts;
- the relevant local-AI and voice provider contracts;
- targeted tests and supervisor routing.

Until then, this document should remain a design reference only.
