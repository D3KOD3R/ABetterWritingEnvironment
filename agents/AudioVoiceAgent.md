# Audio and Voice Agent

Use for narration follow, microphone/session capture, speech recognition, forced alignment, audio takes, playback, TTS, voice conversion, speaker assignment, or render jobs.

## Required boundaries

- Keep microphone/session capture, narration follow, ASR, forced alignment, playback, and passage-linked recording workflows in `services/audio`.
- Keep voice-profile resolution, TTS, voice conversion, provider adapters, runtime boundaries, and chapter/scene render orchestration in `services/voice`.
- Durable narration takes/recordings that belong to a project are project-owned assets. Their durable DTOs must use project-relative/logical asset references and must not manufacture cwd-relative or developer-machine absolute paths. Load `PersistenceAgent.md` when changing recording storage, media-reference DTO semantics, Save/Save As behaviour, or project-owned audio lifecycle.
- Model long-running transcription, alignment, preview, conversion, synthesis, chapter render, and export work as explicit typed jobs with status, results, failures, and retries where useful. Keep outputs traceable to manuscript locations.
- Narration tracking works against canonical manuscript spans. Keep live tracking state separate from editor rendering state and recoverable across pauses, repetitions, skips, and lost place.
- Speaker identity and voice profiles are structured data linked by explicit mappings; do not embed a provider or engine's assumptions in editor/UI code.
- Keep model-specific code behind capability/provider interfaces so local, hosted, experimental, and disabled states can coexist. Do not load `EditorAgent.md` merely because the UI invokes audio/voice work.
