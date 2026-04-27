# Audio Pipeline

Audio services will be job-driven and manuscript-anchor-aware.

## Current Responsibilities

- narration session creation
- alignment job tracking
- passage-linked session metadata

## Next Responsibilities

- microphone capture orchestration
- transcription jobs
- take storage linked to passages
- resumable recording metadata

## Boundary

The audio pipeline consumes manuscript anchors and emits structured alignment results. It does not own editor rendering or manuscript identity.
