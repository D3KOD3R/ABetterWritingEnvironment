# Persistence Agent

Use when changing project save, load, autosave, import/export, project-file/package semantics, browser-cache semantics, or when an author-facing feature introduces new durable project-owned state/files.

Read `docs/architecture/project-storage-contract.md` before changing project-owned storage/path behaviour.

## Required boundaries

- Route structured project persistence through `ProjectPersistenceService`; UI and feature modules must not write project data directly to browser storage, filesystem APIs, file handles, desktop project-media routes, or ad hoc JSON.
- Treat the selected project destination as the durable authority. On desktop this is the folder-backed project package (`project.json` plus project-owned sidecars/assets). Legacy/browser `.abe-project.json` is a compatibility transport, not a reason for new features to assume one monolithic file.
- Never use `process.cwd()`, the repository/worktree, or a developer absolute path as a fallback project storage root. If a project-owned file needs a durable destination and none exists, require Save As/selection or fail the durable write explicitly.
- Persist project-owned file references as normalized project-relative logical paths. Runtime absolute paths may be derived transiently by adapters but must not be the canonical serialized locator for project-owned assets.
- Enforce project-root containment at the filesystem/desktop adapter boundary for save, load, serve and delete; do not trust feature-produced paths. Reject traversal/absolute escape paths when a project-relative path is required.
- Loading an explicit project must replace or clear stale browser project cache before activation. Never merge manuscript bodies, metrics, writing-target history, revisions, or project records from a previous cache into the loaded payload.
- Browser cache is disposable compatibility state and may retain only the active project snapshot. Detect and report failed cache writes; do not call in-memory state a successful persisted save.
- Keep project-owned structured state separate from user/application settings and session/runtime state. In particular, do not classify project taxonomy/content such as custom metadata definitions as `app-settings` merely because its UI is configurable.
- For project-owned asset replacement/deletion, preserve durability ordering: write the new asset, save the new project-relative reference, then remove/garbage-collect the superseded asset. Do not delete the only durable file before the project-state update succeeds.
- Use contextual API names such as `saveProjectSnapshot`, `loadProjectSnapshotFromFile`, `resolveProjectAssetPath`, and `restoreLastOpenedProject`, not vague `save`, `load`, or `sync` names.
- Durable schema/path changes require normalization/migration and focused tests. File-backed features need round-trip plus containment tests; portable asset references should also be covered by relocation tests.
- Use the supervisor's affected route before broader verification.

Do not load this agent merely because a feature reads/calls an existing persistence API without changing durable behaviour. Do load it when a new feature creates durable project state or a project-owned file, because storage ownership is part of that feature's persistence semantics.
