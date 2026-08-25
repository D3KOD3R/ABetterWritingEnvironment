# Persistence Agent

Use only when changing project save, load, autosave, import/export, project-file, or browser-cache semantics.

## Required boundaries

- Route all project persistence through `ProjectPersistenceService`; UI and feature modules must not write project data directly to browser storage, filesystem APIs, file handles, or ad hoc JSON.
- In project-file workflows, `.abe-project.json` is the source of truth for manuscript content, metrics, writing targets, revisions, and critical project data.
- Loading a project JSON must replace or clear stale browser cache before activation. Never merge manuscript bodies, metrics, writing-target history, revisions, or project records from a previous cache into the loaded payload.
- Browser cache is disposable compatibility state and may retain only the active project snapshot. Detect and report failed cache writes; do not call in-memory state a successful persisted save.
- Use contextual API names such as `saveProjectSnapshot`, `loadProjectSnapshotFromFile`, and `restoreLastOpenedProject`, not vague `save`, `load`, or `sync` names.
- Every persistence behaviour change needs automated tests or a documented manual verification checklist. Use the supervisor's affected route before broader verification.

Do not load this agent merely because a feature calls an existing persistence API.
