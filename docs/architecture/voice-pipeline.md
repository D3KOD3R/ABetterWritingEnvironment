# Voice Pipeline

Voice services will manage synthesis and conversion through provider adapters.

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

## Boundary

Voice providers may vary, but render jobs must remain tied to canonical manuscript locations and explicit speaker assignments.
