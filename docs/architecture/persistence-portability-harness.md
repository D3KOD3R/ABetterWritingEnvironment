# Persistence Portability Harness

## Purpose

This branch exists to establish a deterministic persistence-portability harness before changing project storage architecture. The harness must prove that project save/load/autosave/media workflows can operate against an explicitly selected project root outside the repository without creating or mutating project/runtime artifacts in the worktree.

The first implementation slice is the harness itself. Do not begin with a broad persistence refactor and do not move the real Serva Vitae project as part of the first harness commit.

## Codex start sequence

1. Confirm this worktree is on `feature/persistence-portability-harness` and is clean with `npm --silent run repo -- status --base main --json` and `git status --short`.
2. Read `AGENTS.md`, then `agents/PersistenceAgent.md` and `agents/DesktopAgent.md` because this task crosses project persistence and desktop filesystem integration.
3. Do not read `agents/TestSupervisorAgent.md` unless supervisor routing, test groups, registration, or verification policy must change. A new `*.test.mjs` file is auto-discovered by `test/test-registry.mjs`.
4. Do not broadly read the large repo-root Serva Vitae snapshots, `SaveTestFile`, logs, or project data. They are legacy baseline material, not default harness context.
5. Use the supervisor handoff/compact report as the normal verification authority.

## Baseline architecture relevant to the harness

- `apps/editor/public/adapters/storage/project-persistence-service.js` is the author-facing save/load/autosave orchestration boundary.
- `apps/desktop/src/http-app.ts` already supports folder-backed project packages and can save/load a package at an explicit filesystem path.
- The package scaffold already contains manuscript, metadata, assets/audio, assets/images, transcripts, and cache locations.
- `/api/project-media/*` accepts supplied filesystem paths, so callers are responsible for providing a correctly rooted project-owned path.
- `apps/editor/public/features/narration/narration-take-service.js` currently derives recording paths as relative `project-media/<project>/<take>` paths. This is a known portability risk to expose with the harness; do not patch it before the harness captures the behaviour.
- `apps/desktop/src/workspace.ts` still bootstraps from a repo-root Serva Vitae project snapshot with a bundled fallback. Treat that as legacy bootstrap behaviour to be decoupled after the harness establishes the storage contract.
- `test/desktop-application.test.mjs` already uses OS temporary directories for project and media integration checks. Reuse that pattern rather than creating repo-local test output.

## First harness slice

Add a focused test named `test/project-persistence-portability.test.mjs`. The `project-` prefix keeps it in the existing `project` test group without changing test registration or routing.

The harness should use a synthetic/minimal project snapshot and an OS temporary root created with `mkdtemp`/`tmpdir`. It must not use the real Serva Vitae project as its writable test target.

The first test should establish these invariants:

1. **Explicit external project root** — save a project package beneath a temporary directory outside the worktree and confirm the returned/root path is the selected destination.
2. **Round-trip persistence** — save, reload, and verify representative durable project state survives.
3. **Project-owned artifact containment** — scene chunks, metadata files, recordings/media, images, transcripts, and other durable project artifacts must resolve beneath the selected project root.
4. **Working-directory independence** — running from the repository/worktree must not make `process.cwd()` an implicit project storage root.
5. **Repository non-mutation** — capture repository Git/filesystem state before the tested workflow and verify the workflow does not add or modify project/runtime artifacts in the worktree.
6. **Safe failure cleanup** — any temporary or deliberately exposed leak created while proving current behaviour must be removed in `finally` cleanup so a failed harness run does not leave the worktree dirty.
7. **External diagnostic output** — set desktop/runtime log environment variables to an OS temporary log directory during the harness so diagnostics do not become repository artifacts.

A failing assertion that exposes current repo-coupled path behaviour is acceptable during development on this branch, but the branch is not ready to merge until the harness and the relevant affected verification pass.

## Evidence the harness should report

Keep failure messages compact and deterministic. Prefer reporting:

- selected project root;
- offending path relative to the worktree or project root;
- persistence operation that produced it;
- expected containment rule;
- whether reload/round-trip state matched.

Do not dump full project snapshots or large log files into test output.

## Refactor sequence after the failing baseline exists

Once the harness has captured the current boundary failures, refactor in small slices:

1. Establish one authoritative active-project storage context/root.
2. Route folder package save/load and autosave through that authority.
3. Route narration/media paths through project-owned asset roots instead of cwd-relative paths.
4. Remove explicit-load fallback behaviour that silently substitutes bundled project data for a user-selected project that failed to load.
5. Separate user/application settings from project-owned durable state; keep legacy reads only as needed for migration compatibility.
6. Re-run the portability harness after every slice.
7. Only after the harness is green, migrate/create the real external project and remove obsolete live-project/runtime artifacts from the repository in a separate cleanup step.

## Storage ownership target

The intended ownership model is:

- **repository/worktree**: source, tests, intentional small fixtures, tracked documentation/tooling;
- **project root**: manuscript, world/project data, project metadata, project media and recordings, project-specific assets;
- **user/app settings store**: panel layout, widths, application preferences, last-opened project and other user-level preferences;
- **session/runtime state**: ephemeral selection, cursor, scroll, in-flight recorder/runtime caches;
- **developer logs**: external to the repository/worktree;
- **automated test artifacts**: OS temp or an explicitly configured external artifact root, never the repository by default;
- **`.tools/reports/`**: ignored, compact supervisor/Codex reports and handoff state only.

## Guardrails

- Never commit a developer-specific absolute path.
- Do not add a broad ignore rule for project packages or `project-media` merely to make Git look clean. The harness must be able to detect accidental repo-local project artifacts as a storage failure.
- Do not use `git clean`, reset unrelated work, or mutate other worktrees.
- Do not remove the tracked legacy Serva Vitae/bootstrap material until the harness demonstrates that startup/tests no longer depend on it or a deliberate minimal fixture replacement is in place.
- Prefer synthetic fixtures and deterministic temp roots over copies of the real manuscript.

## Verification

During harness construction:

```text
npm --silent run repo -- test --name project-persistence-portability --base main --json
```

After production persistence/storage code changes:

```text
npm --silent run repo -- test --changed --base main --json
```

Run the full suite when the supervisor escalates or before final integration.
