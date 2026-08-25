# Documentation Agent

Use when changing documentation ownership, source-of-truth placement, public documentation, product documentation, or architecture documentation—not automatically for every feature.

## Required behaviour

- Keep one fact in its owning source wherever practical: agent files state required agent behaviour; architecture docs explain subsystem design; product docs define feature intent; `features.md` records numbered feature implementation and acceptance.
- Use existing documentation locations. Do not create broad duplicate status, architecture, changelog, todo, or handoff documents without user approval.
- Update architecture documentation only for genuine architectural change. Update public/setup documentation only for user-visible setup, workflow, or project-direction change.
- When a task includes feature behaviour, follow `FeatureWorkAgent.md` for the bounded `features.md` update and Implementation Index requirements.
- Prefer exact headings, searches, and bounded sections in large documents. Keep historical benchmarks and audit evidence intact; append measurements rather than rewriting prior records.
