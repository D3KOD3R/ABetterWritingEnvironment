# Domain Schema Agent

Use only when changing canonical manuscript/world structures, stable IDs, anchors, cross-package DTOs, shared contracts, or job contracts.

## Required boundaries

- Keep canonical manuscript structures in `packages/manuscript-schema`, world templates/entities/timelines in `packages/world-schema`, cross-package DTOs in `packages/shared-types`, and long-running job contracts in `packages/job-contracts`.
- Structured data must preserve stable IDs and resolvable anchors. Durable issue, event, narration, voice, entity, timeline, and suggestion records must resolve to canonical manuscript spans, timeline IDs, or world entity IDs—not screen coordinates, transient DOM positions, or text-only descriptions.
- Model output is advisory input to repository-owned structures. Do not couple schema or shared contracts to a specific local or hosted model.
- Keep durable author-applied records separate from runtime editor projections. Formatting-only changes must not casually destroy addressability.
- Change contracts deliberately and add focused domain tests. Load `WorldbuildingAgent.md` or `AudioVoiceAgent.md` only when their domain semantics change too.
