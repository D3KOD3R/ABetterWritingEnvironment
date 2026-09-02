# Feature Work Agent

Use when implementing an author-facing feature addition or behaviour change, or when handling `Feature working` or `bench`. Do not load it for read-only inspection, navigation, or debugging that does not change author-facing behaviour.

## Required behaviour

- Treat the numbered feature set in `features.md` as the feature record. Find and read only the relevant numbered section and matching `Feature Implementation Index` entry; never preload the file.
- For an author-facing implementation/change, add a concise process header in the relevant bounded `features.md` section that states the author workflow and owning service level. Decide whether it belongs in an existing service or requires a new service boundary.
- Before implementing any new durable state/file, classify its ownership as **semantic project**, **project-scoped preference**, **app/machine**, **session/recovery**, **cache**, or **developer/test**. If it is semantic project data, a project-scoped preference, or a project-owned file/asset, load `agents/PersistenceAgent.md` and follow `docs/architecture/project-storage-contract.md` before designing persistence.
- For the current product stage, project-specific layout/navigation preferences may live inside the selected project package. Keep them logically separate from authored semantic content and never use that allowance to persist machine paths/provider configuration or transient jobs into the project.
- A project-owned feature must define how Save, autosave, Save As, reopen, project-folder relocation, replace/delete, and schema migration affect its durable data. Do not let a feature invent a cwd-relative path, direct desktop filesystem call, feature-specific localStorage key, or ad hoc sidecar policy.
- Custom metadata definitions/model classes, World Spine nodes/implications/locations/catalogue structures, tasks, notes, research and similar author-created schemas/content are semantic project data, not UI preferences.
- In the same work, update the matching numbered feature section with author-facing behaviour, persistence/rendering implications, and implementation location. If no exact section fits, use the closest product pillar and state the classification.
- When the user says `Feature working`, treat it as acceptance. Before proceeding, update the feature section and its Implementation Index entry. The index must use product language, name the main modules/functions and navigable line references, summarize user interaction through persistence/rendering, and record tests or manual verification.
- Do not add feature-specific logic to `apps/editor/public/app.js` when a feature slice, state module, adapter, shared helper, service, or package owns it. Load `EditorAgent.md` only if the editor boundary itself changes.

## Bench workflow

When the user says `bench` a feature or UI element, preserve the function/service logic unless deletion is explicit. Disable or omit only its live entry point or render path and put a concise `BENCHED:` intent comment immediately above it, explaining why it is parked and what remains available. Do not comment out the core function body.

Feature documentation is not a reason to load `DocumentationAgent.md`; load it only when documentation ownership or source-of-truth structure changes.
