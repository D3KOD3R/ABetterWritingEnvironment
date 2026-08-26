# Voice Pipeline

Voice services will manage synthesis and conversion through provider adapters.

The Narration + Voice workspace is one author-facing audiobook workflow even though narration tracking/recording and voice rendering remain separate service responsibilities. The long-term performance-conversion direction is defined in [Performance-Preserving Audiobook Architecture Roadmap](./performance-preserving-audiobook-roadmap.md).

## Product Invariant

For performance-conversion audiobook production, the recorded human take is the authoritative source of timing, pacing, phrasing, emphasis, pauses, prosody, and emotional delivery. Voice conversion changes vocal identity while preserving that performed delivery. Speech-to-text and local AI may provide alignment, attribution, and reviewable metadata, but they must not reconstruct the performance from manuscript text.

Text-to-speech remains a separate production mode. A TTS job must never silently stand in for performance conversion.

## Current Responsibilities

- voice profile lookup
- speaker assignment resolution
- preview render jobs
- chapter render planning
- narration voice profile persistence
- narration job queue state
- placeholder render simulation

## Next Responsibilities

- TTS generation jobs
- voice conversion jobs
- scene and chapter render orchestration against real providers
- audio output persistence
- narration alignment handoff

## Deferred Performance-Conversion Responsibilities

These are documented future responsibilities and are not current implementation priority:

- consume reviewed human-source audiobook clips rather than text alone for performance-conversion jobs;
- map accepted speaker assignments to target voice profiles through explicit speaker bindings;
- preserve source-clip and manuscript provenance for every derived narrator/character clip;
- keep source recordings immutable and create derived outputs in narrator-master or character-conversion production lanes;
- retain provider/model/conversion-profile provenance so outputs can be rerendered safely;
- integrate a real voice-conversion provider only after the R&D exit gate in the performance-preserving audiobook roadmap is satisfied.

## Boundary

Voice providers may vary, but render jobs must remain tied to canonical manuscript locations and explicit speaker assignments.

Performance conversion must additionally be tied to a source human-audio clip or bounded performance segment. Provider-specific model/runtime fields must not leak into canonical manuscript or audiobook identity records.
