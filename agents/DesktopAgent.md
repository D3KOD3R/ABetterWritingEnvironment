# Desktop Agent

Use only for `apps/desktop` responsibilities: desktop/Tauri shell and lifecycle, filesystem integration, local desktop settings, model/asset path integration, packaging, and distribution.

## Required boundaries

- Keep manuscript/domain rules in packages/services, AI analysis business logic in analysis services, audio alignment logic in audio services, and voice/provider business logic in voice services—not in `apps/desktop`.
- Keep cross-host and domain behaviour behind services, packages, and adapters where appropriate. The desktop shell owns integration, not core business rules.
- Load `PersistenceAgent.md` only when project save/load/autosave or other persistence semantics change; filesystem integration alone does not require it.
