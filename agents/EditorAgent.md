# Editor Agent

Use only when changing `apps/editor` architecture, editor shell/host boundaries, feature slices, editor state, adapters, or reusable editor helpers.

## Required boundaries

- Keep `apps/editor/public/app.js` a thin bootstrap and orchestration shell. Put feature behaviour in `public/features/*`, state in `public/state`, browser bridges in `public/adapters`, and reusable helpers in `public/shared`.
- Prefer explicit contracts and small modules. Avoid direct imports between feature slices when a shared helper or selector boundary is appropriate.
- Keep persistence, autosave, spellcheck, and panel orchestration independently owned. UI components render state and dispatch actions; they do not own manuscript, timeline, alignment, entity-resolution, template-instantiation, or provider logic.
- Treat manuscript rendering as a projection of canonical state. Preserve stable scene/block identities and anchors; do not make DOM positions, CSS ranges, selections, or screen coordinates durable data.
- For editor-roadmap work, read only the relevant section of `docs/architecture/editor-application-roadmap.md`. For `app.js`, use symbol search and bounded regions before a broad read.

## Current checkpoint

The current roadmap phase is Phase 2, establishing manuscript projection and command boundaries. The next planned slice is accepted-anchor-backed diagnostic projection, followed by an anchored manuscript-suggestion DTO; do not project world or Dream Scaping proposal queues onto manuscript text. Load `DomainSchemaAgent.md` only if canonical records/contracts change.
