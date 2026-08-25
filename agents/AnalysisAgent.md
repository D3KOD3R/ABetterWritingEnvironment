# Analysis Agent

Use for `services/analysis`, manuscript diagnostics/Issue Console analysis, issue generation, event pinning analysis, continuity analysis, character/entity extraction, and analysis-generated world template/entity/link suggestions.

## Required boundaries

- Results an author can act on must be structured, location-aware, and resolve to canonical manuscript or world anchors. Issue, event, and continuity records must not be vague text-only commentary.
- Analysis may propose diagnostics, events, entities, templates, and links, but must not silently mutate canonical manuscript or world data. Keep every AI/model result advisory, evidence-backed, traceable, and explicitly reviewable before acceptance.
- Keep analysis-domain contracts provider-neutral; model/runtime mechanics do not belong in analysis contracts. Do not redefine `services/analysis` as Local AI.
- Load `LocalAiAgent.md` only when local-AI runtime/provider semantics change. Load `DomainSchemaAgent.md` only when canonical structures, DTOs, or shared contracts change.
