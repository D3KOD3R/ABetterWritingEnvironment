# Documentation Agent

Use when changing documentation ownership, source-of-truth placement, public documentation, product documentation, or architecture documentation—not automatically for every feature.

## Required behaviour

- Keep one fact in its owning source wherever practical: agent files state required agent behaviour; architecture docs explain subsystem design; product docs define feature intent; `features.md` records numbered feature implementation and acceptance.
- Use existing documentation locations. Do not create broad duplicate status, architecture, changelog, todo, or handoff documents without user approval.
- Update architecture documentation only for genuine architectural change. Update public/setup documentation only for user-visible setup, workflow, or project-direction change.
- When a task includes feature behaviour, follow `FeatureWorkAgent.md` for the bounded `features.md` update and Implementation Index requirements.
- Prefer exact headings, searches, and bounded sections in large documents. Keep historical benchmarks and audit evidence intact; append measurements rather than rewriting prior records.

## Implementation-spec lifecycle

Use `docs/implementation/active/` for temporary implementation contracts, diagnosed bug/refactor plans, and acceptance criteria that Codex must act on. Use `docs/implementation/archive/` only for completed historical implementation records that remain useful for archaeology.

- An active implementation spec must begin with a concise execution contract: goal, initial bounded reads, required outcome, explicit non-goals, and verification route. Put deeper diagnosis/evidence after that contract so Codex can defer it unless needed.
- Prefer one active spec per coherent task. Before creating another, search for related active/product/architecture specs and merge overlapping requirements into the existing authority where practical.
- Do not place temporary implementation handoffs in `docs/architecture/`; architecture docs are durable current-system truth.
- When consolidating specs, record a short revision/supersession history and remove the superseded active duplicate once its still-relevant requirements are preserved.
- Ordinary implementation work must not read `docs/implementation/archive/`; archive material is opt-in for regression archaeology, design-history questions, or when current evidence is insufficient.
