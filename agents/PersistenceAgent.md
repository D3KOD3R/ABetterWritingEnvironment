# Persistence Agent

Use when changing project save/load/autosave/import/export, project package/file semantics, browser-cache semantics, Save As/project switching, or when a feature introduces new durable project state/preferences/files.

Read `docs/architecture/project-storage-contract.md` before changing durable behaviour. For concurrency work also read `docs/architecture/project-save-concurrency-findings.md`.

## Required boundaries

- Route structured project persistence through `ProjectPersistenceService`; UI/feature modules must not write project data directly to localStorage, filesystem APIs, file handles, desktop project-media routes or ad hoc JSON.
- Treat the **explicit active project package root** as the only filesystem authority for project-owned files.
- Do not confuse that root with the application's **default project-library root**. A default/suggested root is never a fallback asset destination for an already-open project.
- Legacy/browser `*.abe-project.json` is compatibility transport, not automatically a folder package. Feature code must not strip `.json` and invent a sibling asset directory. Package migration/Save As belongs to persistence.
- Never use `process.cwd()`, repository/worktree paths, default library roots, relative `project-media/...`, or developer paths as fallback project storage.
- Cache-only/browser recovery may preserve structured work when no package exists, but it is not package authority and must not provide a root for new project-owned binary assets.
- Persist project-owned file references as normalized project-relative logical paths. Runtime absolute paths may be derived transiently only from the active package context.
- Enforce project-root containment at the desktop/filesystem boundary for write, read, serve and delete. Reject traversal, absolute escape and fake-relative desktop roots.
- Do not infer file-vs-package semantics solely from a `.json` suffix; carry package-root semantics explicitly.
- Explicit project load must replace/ignore stale project caches before activation. Never borrow old scene bodies, goals, revisions, metadata or project records simply because IDs match.
- Explicit Open Project loads the selected project or fails visibly. Do not substitute a bundled/demo project after a user-directed load failure.
- Classify durable structured state as **semantic project data** or **project-scoped preference**. Project-specific layout/navigation preferences may remain in the project package for the current product stage.
- Custom metadata definitions/model classes, World Spine entities/nodes/implications, tasks, notes/research, revisions, writing goals/history and project dictionary are semantic project data, not generic app settings.
- Keep machine/application state outside portable project content: model/runtime paths, provider config, default project root, worktree/cwd values, last-opened pointer and active absolute package path.
- Keep transient provider/job/session state non-durable unless deliberately promoted to an explicit recovery/project-preference model.
- Converge away from whole-workspace cloning. New runtime fields do not gain durability automatically; the portable serializer should be an allowlist.
- Save As must create/verify the new package before adopting it as active authority. A failed Save As leaves the old package authoritative.
- Save As must materialize all required owned assets so the new package works without the old package.
- Overlapping durability requests must accumulate. An older in-flight save may not clear newer dirty state.
- Project open/switch is a persistence barrier: promised old-project mutations must be drained through the required revision or fail explicitly before runtime replacement.
- Bind async save completion to project identity + destination generation + revision. Numeric revision equality alone is not enough across project switches.
- For asset replacement/delete, preserve durability ordering: write new bytes, save new relative reference, then remove/garbage-collect the superseded asset.
- At the enforcement point, comment non-obvious persistence authority, forbidden fallbacks, containment, ordering/concurrency, and compatibility assumptions; name the invariant or failure being prevented rather than narrating the operation.
- Durable schema/path changes require normalization/migration and focused tests. File-backed features need round-trip + containment; portable assets need Save As/relocation; concurrency changes need overlap/transition tests.
- Use the supervisor's affected route before broad verification.

Do not load this agent merely because a feature reads an existing persistence API without changing durable semantics. Do load it whenever a feature creates new durable project state, a project-scoped preference, a project-owned file, or a new path/save policy.
