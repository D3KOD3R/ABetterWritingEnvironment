# Regression workspace logging prototype

Status: the bounded infrastructure is integrated into `feature/persistence-portability-harness`. Use the task-designated worktree/build containing this integration; the original infra branch/baseline below is historical implementation provenance, not the current operating starting point.

## Execution contract

Goal: prepare and exercise one attributable ABE regression RUN using the existing developer logging system. CASE meaning and acceptance come from the caller's applicable checklist/feature definition; the persistence checklist is one such caller, not a prerequisite for every CASE.

Initial bounded reads: root `AGENTS.md`, `agents/RepositoryWorkspaceAgent.md`, applicable external workspace constraints and the caller's CASE definition, then this document's External CASE input contract, Operator workflow and layout, and relevant limits. Read implementation source/tests only when changing or diagnosing those mechanisms.

## Historical implementation contract

The original prototype started from persistence harness `42dd764be05ed75224249015df73c4da70e92953` on `infra/regression-workspace-logging`. The outcomes and verification gates below record that implementation/integration task; they are not mandatory steps for routine tool use or documentation-only changes.

Required outcome: fresh external sandbox and evidence paths, captured source identity, explicitly configured developer-log gates, an attributable existing host log session, and two harmless smoke runs proving isolation.

Non-goals: diagnose 8.2e; change persistence or browser project-cache semantics; isolate desktop application state; migrate repositories, worktrees or historical evidence; replace the supervisor; build a second event logger.

Verification route: focused `desktop-logger`, `developer-logger-regression-session`, and `desktop-regression-workspace` tests; `npm run repo -- test --changed --base HEAD`; `npm test` when routing requires FULL; two retained external smoke runs. Supervisor reports remain authoritative under `.tools/reports`. The harness already has two failing full-suite tests (`desktop-application`, `project-source`, chapter count `4 !== 5`); compare failures with that baseline rather than diagnosing persistence here.

For the final integration candidate, rerun focused tests before committing, then run the FULL supervisor and `npm test` once on the final commit SHA and compare with those known baseline failures.

## Existing infrastructure and actual gaps

| Existing component | Available behavior / reuse |
| --- | --- |
| `apps/editor/public/shared/developer-logger.js` | Structured ID/time/level/source/category/event/message/context/callsite plus applicable project/scene/chapter/block IDs; bounded context and a 3,000-entry default ring; source gates default OFF; global gate; storage/BroadcastChannel synchronization. Its public event API is unchanged. |
| Editor bootstrap and runtime bridge | Registers persistence/autosave/storage/load/save sources; forwards structured entries to `/api/log`; exposes live entries and gates through `__ABE_DEVELOPER_LOG_RUNTIME__`. The editor already disables entry persistence to browser storage. |
| `apps/editor/public/developer-logs.js` | Uses the opener bridge, falling back to the shared client; source/category/level/text filters, pause, copy/export, gate controls and session/prune controls. These controls and event formats are retained. |
| `apps/desktop/src/logger.ts` | Best-effort, synchronous JSON-lines desktop logging, Error serialization, `ABE_LOG_PATH` override; default `cwd/logs/desktop.log`. |
| `apps/desktop/src/http-app.ts` | Existing `/api/log` writes the desktop log and asynchronously appends a developer-runtime session file. Session/read/clear/prune APIs, numbered timestamped sessions, default retention of 20 sessions (configurable up to 500), preservation of the active session. `ABE_DEVELOPER_RUNTIME_LOG_DIR` overrides the default `cwd/logs`. |
| Repository supervisor | Existing deterministic Git collection and machine-local `developmentLogging.externalLogRoot` setting, with the repository/worktree/test/run layout contract. Compact reports stay in `.tools/reports`. |

Persistence logging already covers dirty marking and flush requests (`project.persist.mark-dirty`, `project.persist.flush-requested`), save begin/cache/file verification, staged package verification/discard, file-handle persistence, load begin/completion, and related failures. Relevant code lives in `adapters/storage/project-persistence-service.js`, `adapters/storage/autosave.js`, and bounded bootstrap load/save gates. Sources identify the emitter; categories such as `persistence`, `autosave`, `filesystem`, `validation`, `user-action` and `lifecycle` identify the operation class; dotted event names identify specific checkpoints. Existing event context carries relevant IDs and paths when emitted. No new persistence diagnostics were required for this task.

Existing tests cover default gates and cross-window settings in `developer-logger.test.mjs`. Logging routes/UI controls also have assertions in `desktop-application.test.mjs`, but its baseline failure occurs before those later assertions; the new independent integration test makes logging verification reachable.

The gaps were run/checklist identity, worktree/build attribution (especially dirty builds), requested versus observed gate settings, an explicit log-file-to-run relationship, and destination isolation during launch. Browser preferences/channels were global across runs. The Developer Logs window used a fixed host port; browser log fallback could reach another host. An old browser tab could also send to a later process reusing the same port.

## Added boundaries and provenance

The Regression Run Controller (`tools/regression-workspace/regression-run-controller.mjs`) coordinates operations and governs the RUN lifecycle/state transitions. It allocates fresh locations, captures the existing supervisor Git facts, starts only its own Node desktop host, and finalizes the manifest on graceful stop. It never opens a browser or invokes project persistence. It uses `ABE_LOG_PATH` and `ABE_DEVELOPER_RUNTIME_LOG_DIR` unchanged. The optional `ABE_REGRESSION_RUN_MANIFEST` adds a pointer to run metadata, not another log destination setting.

| Location | Information |
| --- | --- |
| `run-manifest.json` | `schemaVersion: 2`, CASE/RUN, repository/worktree, branch/HEAD, clean state, supervisor fingerprint, full source-delta hash and source identity hash, sandbox and `allocatedProjectLocations`, caller-supplied `expectedRegressionInvariant` (or null), log destinations, requested gates, app/Node/platform version, preparation/start/end status and times, PID/URL/session path, `runtime.launchCwd`, `runtime.requestedPort` and actual `runtime.boundPort`, source check at shutdown, known environment limits. |
| `source-changes.json` | Binary-capable tracked diff against HEAD plus base64 contents of non-ignored untracked files. This preserves the uncommitted implementation used by an explicitly allowed dirty run. Source delta is limited to 8 MiB. It does not preserve Git index arrangement, ignored state or external inputs. |
| `runtime-logs/log-session.json` | Run/manifest linkage, source identity hash and HEAD, actual runtime worktree and `runtimeCwd`, process/runtime identity, desktop and runtime session file paths/number/time, requested gates and observed gate configurations. Gate history is bounded to 100 observations with an omitted count. |
| Existing event lines | Existing operation identity, context, time and IDs. No repeated branch, HEAD or path manifest is added to every event. |
| HTTP transport | `X-ABE-Regression-Run` is checked before log write/read/clear/prune/session operations. It prevents stale tabs from affecting a later host even when a port is reused; it is not stored in event lines. |

Run format revision: the original prototype used `schemaVersion: 1` with `projectFolderPaths` and `project-folders/project-a` naming. New runs use `schemaVersion: 2` with `allocatedProjectLocations` and `project-locations/location-a` naming; smoke results use `projectLocationsEmpty`. The controller and desktop host accept version 2 only. Missing or unsupported versions require a fresh run, not an in-place migration. Existing version 1 evidence remains unchanged. The separate log-session metadata retains its own `schemaVersion: 1`.

**Source-content handling:** `source-changes.json` may contain actual uncommitted source contents, including tracked patches and complete non-ignored untracked files encoded in base64. Base64 is not redaction. This file must not be automatically committed, uploaded or shared as ordinary regression evidence, including through a blanket run-directory attachment or archive. Keep it local by default; review the contents and obtain explicit authorization before sharing. The controller does not commit, upload or share it.

The desktop serves inert run JSON to both editor and Developer Logs pages. A small shared adapter namespaces existing log storage keys/channels per RUN, initializes requested gates before source registration, preserves UI changes on refresh within that RUN, and records changed enabled-gate settings. Both browser logging transports use only their current origin in regression mode. Opener bridges must match the page's run. Normal launches retain their existing log configuration and event contracts.

Preparation rejects conflicts and dirty builds unless `--allow-dirty` is explicit. It rejects destinations inside or containing any linked worktree, resolving existing ancestors/junctions before allocation. Start checks source identity and the saved delta hash again, requires empty unredirected runtime-log directories, and creates an exclusive start receipt. A completed or already-started RUN cannot be reused. Shutdown checks source identity again; source change, abnormal exit or failed smoke marks the run failed. An IPC disconnect closes the owned host if its controller disappears; the interrupted manifest can remain `running` and must be treated as incomplete.

## External CASE input contract

The controller treats `caseId` as an opaque, path-safe attribution/layout identifier. It never interprets a checklist number, title or substring and has no CASE map, switch or registry. A caller supplies optional `expectedRegressionInvariant` text to `prepareRun`; the controller validates string-or-null shape and preserves the value unchanged in the manifest through launch and finalization. Omission records null. The CLI exposes the same input as `--expected-invariant <text>`. The authoritative checklist or caller owns what the CASE means and which log sources it needs.

```js
await prepareRun({
  caseId: "new-case-from-external-input",
  expectedRegressionInvariant: "Caller-defined acceptance condition.",
  workspaceRoot,
  worktree,
  enabledSources,
});
```

External CASE identity/invariant and worktree/logging inputs flow into the existing RUN lifecycle, which outputs source provenance, allocated project locations, evidence and log/session manifests, host allocation and lifecycle status. Adding a new CASE requires new input data, not controller source changes. This interface does not add a case-definition framework. For persistence 8.2e, obtain any supplied invariant from the active persistence regression checklist; passing that identifier alone derives no semantics.

## Launch-directory audit

The normal development entry point is `npm run desktop` in the selected worktree's package root (`package.json` launches `apps/desktop/server.mjs`). The initial prototype instead forked with the sandbox as cwd. The bounded production audit found material differences beyond redirected logging:

| Runtime path | Cwd dependency and consequence |
| --- | --- |
| `apps/desktop/src/realtime-speech-bridge.ts`: `createDesktopRealtimeSpeechBridge`, `createDefaultModelRoots`, `detectWhisperCppRuntime`, `createWhisperCppCapability` | Defaults derive from `process.cwd()`. Whisper searches `.tools/whisper`; Sherpa searches repo-local roots and has existing sibling fallback paths. Changing cwd can change available providers/models. The audit inspected those path expressions, not unrelated sibling directory contents. |
| Same speech bridge: sidecar launch and scratch output | The sidecar inherits the resolved repo cwd. Audio scratch uses `.tmp/realtime-speech`, including word timings. A sandbox cwd changes both launch context and scratch locations. |
| `project-source.ts:resolveProjectSourcePath`; legacy package/media helpers in `http-app.ts`; `services/local-ai/model-library.ts:normalizeModelRoot` | Relative caller paths pass through `path.resolve`; a changed cwd changes their meaning. Existing absolute-root/containment guards in newer project routes remain unchanged. No persistence operations were exercised or modified for this audit. |
| Editor assets in `http-app.ts`, bundled workspace sources in `workspace.ts`, desktop settings in `settings.ts` | Module-relative URL resolution makes these independent of cwd. Moving cwd does not isolate desktop state. |
| Desktop logger and developer-runtime session directory | Both have cwd-based defaults, but existing absolute `ABE_LOG_PATH` and `ABE_DEVELOPER_RUNTIME_LOG_DIR` overrides already keep these logs in the current run. |

The controller now explicitly forks from `sourceWorktreePath`, preserving normal development launch semantics even when the CLI itself is invoked elsewhere. It records that choice in `runtime.launchCwd`; host session metadata independently records actual `runtimeCwd`. Absolute run log overrides, evidence paths and allocated project locations remain external. No production path-resolution or persistence logic was changed.

This isolates controller-owned outputs, not all application resources. Speech scratch files and sidecar resources retain their normal worktree/runtime locations, and desktop state remains module-relative. Record those inputs/resources when a future CASE uses them; this task adds no scratch-directory migration or sidecar allocator. The focused test checks actual host cwd and the read-only `/api/whisper-cpp/capability` root, so a successful HTML/log smoke cannot conceal a changed model-discovery root.

## Synchronous writer decision

The browser-facing runtime file path was already asynchronous, one append per received HTTP event. The desktop diagnostic file was synchronous, with directory creation repeated on every event. The smallest change caches successful directory setup, retains synchronous append, retries a removed directory once on `ENOENT`, and resets setup after errors. The existing best-effort/non-throwing contract remains.

| Concern | Original synchronous writer | Retained synchronous writer | Queued asynchronous candidate (not implemented) |
| --- | --- | --- | --- |
| Ordering | Call order within one process | Same | Requires one serialized drain; concurrent independent appends are insufficient |
| Filesystem calls for N successful events | N mkdir + N append helper calls | One mkdir + N append calls | Could batch lines into fewer appends after one setup |
| Responsiveness | Caller blocks for both operations | Removes redundant setup; append still blocks | Would move I/O off the caller, but serialization still costs time; benefit depends on volume and disk |
| Shutdown | No application queue to flush | Same | Requires awaited flush, integration with all shutdown paths, and timeout policy |
| Failure handling | Swallows write failures | Same; retries directory loss once | Requires async failure reporting/retry/drop policy without recursive logging |
| Crash-adjacent diagnostics | Submitted before return; no fsync guarantee | Same | Buffered diagnostics can be lost on immediate exit/crash |
| Memory/backpressure | No pending event queue | Same | Must bound bytes and choose blocking, dropping or fallback behavior at capacity |
| Public API / UI | Synchronous void API, unchanged event shape | Same | Could retain void API but would change when logs become readable and require flush-aware tests/UI expectations |

`desktop-logger.test.mjs` instruments filesystem helper calls: 1,000 events produce one mkdir call, 1,000 ordered appends, and correct recovery after ENOENT/EIO. A child process logs then calls `process.exit(17)`; its last diagnostic is readable without a flush hook. These are deterministic behavior/call-count measurements, not a throughput or UI-latency benchmark. No demonstrated workload justifies the additional queue/backpressure/shutdown machinery yet. A later responsiveness investigation should measure real event rates and event-loop delay before choosing batching parameters.

The existing runtime sink remains best-effort and asynchronous. Concurrent browser HTTP requests do not guarantee original emission order; browser timestamps/IDs remain useful. The smoke awaits each POST to test a defined order. Neither file writer promises survival of power loss or disk failure.

## Operator workflow and layout

Run from the implementation worktree with Node 24+. Replace the example absolute external workspace path with the local one. Do not point the controller at a source checkout lacking this integration.

```powershell
node --experimental-strip-types tools/regression-workspace/regression-run-controller.mjs prepare --workspace C:/path/ABE-Workspace --case 8.2e-recent-project-activation
# Preparation prints manifestPath. Start it only when ready to execute that new RUN:
node --experimental-strip-types tools/regression-workspace/regression-run-controller.mjs start --manifest C:/path/to/run-manifest.json
```

`prepare` only allocates and records. Add `--allow-dirty` to capture an uncommitted build explicitly; otherwise a dirty checkout is rejected. Source changes after preparation require a fresh RUN. `start` prints the owned host URL; open that URL manually and stop the controller with Ctrl+C when finished. Both programmatic and CLI `start` default to port `0`, letting the OS assign an available HTTP port. The printed URL contains the bound port. Use `--port 4310` (or another explicit port) only when a CASE needs that exact origin; an occupied explicit port fails rather than reusing another host. Port allocation does not allocate sidecar resources or guarantee that a released port is never reused. Record browser starting state for the selected origin. `completed` describes successful host shutdown with unchanged source, not regression acceptance; record actual acceptance in `manual-test-results`.

Controlled `start` reports a human-facing URL such as `http://127.0.0.1:51827/?abe-case=outline-cards&abe-run=a31f92bc`. The opaque CASE is shown verbatim via URL encoding; the RUN label is the existing `runId`'s final eight characters (its random suffix), not a new identity. `startRun` returns this as `launchUrl`, and the manifest records the derived URL under the same name for operator reference. Existing `hostUrl`/`baseUrl` remain the bare transport origin. The labels are presentation only: editing or removing them cannot select source, sandbox, evidence or logging destinations, establish runtime identity, or grant authorization. Injected session metadata and existing RUN-header validation remain authoritative.

Ordinary editor interactions and refresh preserve the query labels; no browser routing changes were added. Spotify's external authorization redirect deliberately drops query/fragment context, and opening the separate Developer Logs page does not copy the editor query. Reopen the reported launch URL if needed. Normal launches remain unchanged; the controller still does not open a browser.

For a harmless logging exercise:

```powershell
node --experimental-strip-types tools/regression-workspace/regression-run-controller.mjs smoke --workspace C:/path/ABE-Workspace --case infra-logging-smoke --allow-dirty
```

The smoke serves both real HTML pages, exercises the existing shared developer logger and real `/api/log` routes, records observed gates, checks three ordered events, verifies session metadata and active-session pruning, confirms empty allocated project locations, and stops the owned host. It does not execute browser JavaScript in a GUI or run 8.2e. Its result explicitly records `regressionExecuted: false`.

Defaults enable `AutosaveCoordinator`, `ProjectPersistenceService`, `ProjectLoadGate`, `ProjectSaveGate`, `DesktopFileSystemAdapter`, and `SceneStorageService`. Override with `--sources SourceA,SourceB`; an empty quoted value is not accepted by the CLI, so use the Developer Logs UI to disable all sources during a manual run. Gate settings do not suppress the existing independent desktop diagnostics or important browser fallback warnings/errors.

Log-root precedence is `--external-log-root`, then the existing ignored `.tools/config/local-development.json` key `developmentLogging.externalLogRoot`, then `<workspace>/regression-evidence`. The existing tracked example is `tools/repo-supervisor/local-development.example.json`. The controller uses its layout contract; it does not rewrite supervisor report storage.

```text
<workspace>/sandboxes/<CASE>/<RUN>/project-locations/
  location-a/  location-b/  location-c/
<externalLogRoot>/<repository>/<worktree>/<CASE>/<RUN>/
  run-manifest.json
  source-changes.json
  run-start.json
  runtime-logs/
    desktop.log
    developer-runtime-session-0001-<timestamp>.txt
    log-session.json
    host-output.log
  manual-test-results/
    logging-smoke.json                 # smoke only
```

Add project-folder checks or captures only when the case needs them. An ALLOCATED PROJECT LOCATION is an empty directory reserved for future project creation. It is not an initialized PROJECT FOLDER and does not establish a logical PROJECT identity. The manifest records these locations under `allocatedProjectLocations` with `locationA`, `locationB` and `locationC` keys. Use a new, unoccupied child destination beneath a location when normal New Project requires one; that child becomes a PROJECT FOLDER only after ABE initializes it. Logical PROJECT IDs and authoritative PROJECT FOLDER paths belong in actual checkpoint evidence/events after initialization, never invented during preparation.

## Limits and next 8.2e use

Source identity is provenance-aware, not OS-immutable. Before/after checks cannot detect a change that is reverted during execution. The retained HEAD plus delta can reconstruct captured source content, but ignored build inputs, browser state and external runtime dependencies require separate recording when relevant. Manifests/evidence are writable by the user; completion is a convention, not filesystem permission enforcement. A host killed forcibly can leave an incomplete run. No automatic recovery, cleanup, evidence migration or same-run restart is attempted.

Desktop state still lives at module-relative `apps/desktop/.desktop-state.json`; browser project library/cache remains shared for its origin. Log settings namespacing does not isolate those product states. Control and record them before a future manual regression; do not infer clean project state from a fresh log session. Browser gate observations are best-effort metadata and may be absent if the browser cannot reach the host. The smoke supplies them through the shared logger exercise and makes no claim to GUI testing.

Next, prepare a fresh `8.2e-recent-project-activation` RUN from the chosen integrated source build, supply any expected invariant explicitly from the checklist, record the desktop/browser starting environment, initialize only its intended project folders using real ABE operations, then follow the active persistence checklist. Record logical IDs, selected PROJECT LIBRARY RECORD, active folder authority, and checkpoint file changes using existing events and captures. The earlier manually prepared baseline RUN and campaign remain untouched. This infrastructure task does not mark 8.2e Working, Fixed or Rechecked.


## Automated manual test process

Use this process when asked to "use the automated manual test process". It means browser-driven execution of author workflows, with real keyboard input and filesystem verification. It supplements, never replaces, repository supervisor checks and caller-owned CASE acceptance.

### Execution contract

Goal: exercise the requested author workflow in isolated Chrome and retain attributable source, browser, project and disk evidence. Read `AGENTS.md`, `agents/RepositoryWorkspaceAgent.md`, this guide, the external workspace's `WORKSPACE.md`, and the specific CASE/feature acceptance criteria. Load domain agents only for responsibilities being changed.

Use `tools/regression-workspace/browser-acceptance.mjs` for the implemented reliability scenario. It covers native manuscript undo/redo, Recent A/B switching, cold host/browser restart, browser refresh, configurable history depth/autosave cycles, and blocked-import Cancel/explicit discard. Other requested workflows need a focused driver using the same RUN controller and evidence boundaries; do not claim that this scenario covers them.

Non-goals: desktop mouse/keyboard control, real author-project testing, native Windows folder-picker acceptance, cloud upload, branch/commit/push, or modifying the RUN controller to encode CASE meaning.

### Setup and invocation

Node 24+ and installed Google Chrome are required. Install Playwright in an external tooling directory, not the product package. The driver uses Chrome headlessly with a separate browser context; it does not control the user's normal Chrome tabs or foreground keyboard.

```powershell
npm install --prefix <external-tooling-directory> playwright
node --experimental-strip-types tools/regression-workspace/browser-acceptance.mjs --workspace <external-workspace> --playwright-root <external-tooling-directory> --allow-dirty --history-actions 100 --autosave-cycles 3
```

Use `--allow-dirty` only intentionally: each RUN captures HEAD plus local source delta. Omit it for a clean commit. Start with the small case; for measured history use `--history-actions 1000`; for the first sustained autosave stage use `--autosave-cycles 50`, then 100 if required by the CASE. Three cycles are a smoke test, not acceptance of the 50/100-cycle stage. Each edit/undo/redo waits for the real five-second autosave timer; 50 cycles take roughly 13 minutes plus setup/history/restart checks. Counts are bounded to 0–1000.

Run the existing supervisor for source/test changes. Browser results are supplementary evidence with their own explicit verdict. Do not run another app instance or tests that modify this worktree's desktop settings concurrently.

### Isolation and provenance

The existing controller allocates every RUN, external sandbox/evidence directory, host and runtime logs. Restart allocates a new RUN and preserves the test browser storage state on the same host port. If that port is occupied, fail rather than connect to another host. The runner snapshots the worktree-local `.desktop-state.json`, clears its last-project pointer before initial boot, and restores its exact original bytes in `finally`. Never use the bundled/real manuscript as test input: replace the disposable bootstrap view with a newly created test package before editing.

All projects are created by the normal app UI in external allocated locations. Old test packages are retained as explicit inputs for restart RUNs. A read-only function appended to the browser-served `app.js` exposes a cloned canonical/autosave state; repository production code is unchanged. Compare real textarea text, canonical scene text, project identity, autosave target, and `project.json`'s referenced scene file. Dirty state must remain true during pending saves. Physical generation/hash changes alone are not semantic corruption.

The import scenario substitutes the native folder-picker HTTP response with the synthetic fixture path and injects HTTP 500 at the outgoing save-stage boundary. The real import parser, filesystem reads, staging, verification and commit run normally. Record these substitutions; this does not test the operating-system picker or a real device failure. Install the picker substitution before clicking Import so a native modal cannot take over the user's desktop.

### Results and stop rules

The runner prints PASS checkpoints and a final status/evidence directory. Inspect `manual-test-results/browser-acceptance.json`, all linked `run-manifest.json` files, and the corresponding `runtime-logs/log-session.json`. Require each completed RUN's `sourceIdentityUnchanged: true`. A controller's `completed` status alone does not mean CASE acceptance. Report exact counts and source identity, and distinguish clean commit from HEAD plus uncommitted delta.

The runner records text checkpoints, history counts/JS heap samples, cycle results, screenshots and limits. Do not call JS heap measurements renderer-memory/leak acceptance; the full undo/redo CASE additionally owns renderer-memory characterization, editor-host/scene lifetime boundaries and anchor/revision/metrics checks. Stop and retain evidence on visible/canonical/durable mismatch, wrong destination, cross-project writes or unexpected replacement. Diagnose before continuing, and use a fresh RUN after any source change. Do not substitute JavaScript `input` dispatch or direct state mutation for native keyboard acceptance.

Keep `source-changes.json`, browser storage snapshots and machine-state backups local. They are not ordinary shareable artifacts. Reconcile acceptance into the caller's existing checklist rather than creating competing status documents.

### Interruption and recovery

Do not edit source during a RUN. Prefer letting the runner finish so its `finally` closes browser/host and restores settings. A hard stop, tool timeout or killed parent may leave an incomplete RUN and settings backup; never label it completed or restart it in place. Inspect only the owned processes, preserve evidence, restore the exact backed-up worktree settings after the owned host stops, then allocate a fresh RUN. Do not kill unrelated browsers/hosts or clear the user's browser profile. Record a prior RUN's packages/storage as explicit restart inputs if reusing them.

For interactive Playwright debugging, use bounded calls and save checkpoints after each operation. A REPL reset can close its browser contexts; reconnecting does not restore lost in-memory history. Rebind helpers after replacing a page/context. The standalone runner avoids REPL-lifetime dependence and uses graceful controller shutdown.
