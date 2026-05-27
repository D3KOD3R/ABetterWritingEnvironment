# Audio Pipeline

Audio services will be job-driven and manuscript-anchor-aware.

## Current Responsibilities

- narration session creation
- alignment job tracking
- passage-linked session metadata
- Whisper follow-track adapter planning
- manuscript-style narration selection and recording controls
- low-overhead speech-tracker state for live takes

## Next Responsibilities

- microphone capture orchestration
- transcription jobs
- take storage linked to passages
- project-media sidecar pointers for saved voice takes
- resumable recording metadata
- mobile dictated-writing session orchestration, including offline capture recovery and transcript candidates
- handoff of accepted dictated prose to anchor-backed manuscript edit commands without confusing it with narration alignment

## Boundary

The audio pipeline consumes manuscript anchors and emits structured alignment results. It does not own editor rendering or manuscript identity, and it should not infer follow state from DOM layout or raw screen coordinates.

For the planned mobile companion, audio services may also produce reviewable transcript candidates for new prose. They must not append transcript text to a manuscript directly; accepted insertion belongs to the canonical manuscript command and persistence path defined in [MobileFriendlyArchitecture](./mobile-friendly-architecture.md).
