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
- recording-session word counts
- narration-mode recording-goals UI backed by voice metrics rather than manuscript writing goals
- audiobook release metrics separate from manuscript release planning

## Next Responsibilities

- TTS generation jobs
- voice conversion jobs
- scene and chapter render orchestration against real providers
- audio output persistence
- narration alignment handoff

## Boundary

Voice providers may vary, but render jobs and narration metrics must remain tied to canonical manuscript locations, explicit speaker assignments, and voice-owned audiobook targets rather than borrowing the manuscript goal state.
