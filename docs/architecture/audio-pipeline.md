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

## Boundary

The audio pipeline consumes manuscript anchors and emits structured alignment results. It does not own editor rendering or manuscript identity, and it should not infer follow state from DOM layout or raw screen coordinates.
