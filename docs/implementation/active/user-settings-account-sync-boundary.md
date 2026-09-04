# User Settings, Device State, and Account Sync Boundary

## Status

Design-only implementation specification. No production behaviour is changed by this branch.

This document is intentionally parked on `feature/user-settings-account-sync-design` so persistence regression work can continue independently on `feature/persistence-portability-harness`.

Fork point:

- base branch: `feature/persistence-portability-harness`
- base commit: `2a14d6b79b1b93dc3bb3c30bd5a11608af4daf26`

Do not merge this design branch merely to obtain runtime behaviour. When implementation begins, first rebase/reconcile the design against the then-current persistence architecture.

## Purpose

Establish a durable ownership boundary for application settings before authentication, account profiles, and cross-device settings sync are implemented.

The design must satisfy two goals at the same time:

1. the application must work fully offline with durable local settings owned by the desktop host and stored outside the repository, install/source tree, and project package;
2. a future signed-in account must be able to synchronize only portable user preferences to another device without copying machine-specific paths, device state, secrets, or project content.

The local store and the future account store are therefore complementary layers, not competing persistence systems.

## Non-goals for the first implementation

Do not implement the following as part of the first settings-boundary slice:

- authentication or account creation;
- a cloud settings backend;
- OAuth/OIDC flows;
- multi-profile UI;
- wholesale migration of every existing browser preference;
- project-package schema redesign unrelated to removing machine/user state leakage;
- secrets storage beyond defining the boundary that will own it later.

The first implementation should establish the local boundary and prove it with one narrow device-state feature.

## Existing architecture findings

### 1. Project persistence already defines the required ownership split

The project-storage contract and portability harness distinguish semantic project data, project-scoped preferences, application/machine state, and runtime/recovery state. The settings design must extend that split rather than introduce an alternate storage authority.

A selected project package remains authoritative only for project-owned state. A default project-library location or last-opened path is application/device state, not a project asset root.

### 2. Current desktop settings persistence is transitional

`apps/desktop/src/settings.ts` currently persists `DesktopSettingsSnapshot` to a source-adjacent `.desktop-state.json` path.

That storage location must be treated as legacy/transitional. Mutable user or device state must not live inside the repository, source tree, installed application directory, or active project package.

The existing snapshot also mixes several concerns: runtime/application configuration, machine-specific filesystem roots, provider configuration, and last-project state. It must not become the template for future `UserPreferences`.

### 3. The editor already has a useful storage seam

The browser storage adapter is documented as a replaceable compatibility adapter, and `preferences-repository.js` already provides a narrow repository contract over it.

Preserve that direction. Feature code should consume logical settings services/repositories rather than read operating-system files, `localStorage`, or desktop HTTP routes directly.

### 4. The current `/api/settings` route mixes concerns

Desktop settings updates currently share one route for runtime mode, local roots, project root, and public provider configuration. Future work should narrow this boundary rather than keep expanding one generic settings object.

### 5. Project-package dialog state is correctly runtime-only

`project-package-dialog.js` explicitly owns dialog state without persistence side effects. Keep that invariant. Remembered directories should be supplied by lifecycle/settings orchestration, not loaded or written by the dialog component itself.

## Ownership taxonomy

Every durable value must have exactly one primary scope before a persistence location is chosen.

| Scope | Meaning | Durable owner | Cross-device sync |
| --- | --- | --- | --- |
| `project` | Semantic project content or project-specific workspace preference | Selected project package | Travels with the project, not settings sync |
| `user` | Portable preference expressing how the signed-in person wants the application to behave | Local user-preference store, optionally account sync | Yes, when explicitly syncable |
| `device` | Installation/machine-specific state or path | Local device-state store | No |
| `session` | Ephemeral interaction/runtime state | Memory/recovery subsystem only when deliberate | No |
| `secret` | Tokens, credentials, private keys or equivalent | Platform credential store | Never through ordinary settings sync |

### Guardrail

A value may be synchronized through the future settings-sync service only when its registered scope is `user` and it is explicitly marked syncable.

`device`, `project`, `session`, and `secret` values must be rejected from the user-settings sync payload.

## Proposed logical architecture

```text
Feature / lifecycle code
        |
        v
+----------------------------+
| UserSettingsService        |
|                            |
|  SettingsRegistry          |
|  get / set / subscribe     |
+-------------+--------------+
              |
       +------+------+----------------+----------------+
       |             |                |                |
       v             v                v                v
UserPreferences  DeviceState   SettingsSyncService  CredentialStore
Store            Store         (future)             (future)
       |             |                |                |
       +------ local desktop ---------+                |
                     |                                 |
                     v                                 v
             host-owned user data              OS secure storage
                     |
                     v
            future account sync
            for user scope only
```

The editor should not need to know which operating-system directory backs a store, whether a user is signed in, or whether sync is currently online.

## Settings registry

Introduce an explicit registry/schema so scope and sync policy are architectural metadata rather than conventions remembered by individual features.

Illustrative shape:

```ts
type SettingScope = "user" | "device" | "project" | "session" | "secret";

interface SettingDefinition<T> {
  key: string;
  scope: SettingScope;
  sync: boolean;
  defaultValue: T;
  validate(value: unknown): T;
}
```

Registry validation rules:

- `sync: true` is valid only for `scope: "user"`;
- secrets cannot be registered into a JSON settings store;
- project values must route through project persistence, not user/device stores;
- absolute filesystem paths are device-scoped unless a separate portable abstraction is deliberately defined;
- feature code should use registered logical keys, not raw storage keys or file paths.

Illustrative entries:

```ts
"appearance.theme" = {
  scope: "user",
  sync: true,
  defaultValue: "system",
}

"projectLifecycle.lastCreateParentDirectory" = {
  scope: "device",
  sync: false,
  defaultValue: "",
}
```

## Local desktop storage boundary

### Path authority

Desktop host code must resolve a platform-owned application-data root. No production fallback may point into `process.cwd()`, the repository, a worktree, source directories, or the selected project package.

The exact product/application directory name should be decided when implementation begins, but the resolver should target the platform-standard per-user application-data/state location:

- Windows: per-user application data under the operating system's user-data conventions;
- macOS: the user's Application Support/state conventions;
- Linux: XDG configuration/state/data conventions as appropriate.

Feature/editor code receives logical store APIs only. It never constructs these paths.

### Logical local stores

Initial logical stores:

```text
profile/<profile-id>/user-preferences.v1.json
device-state.v1.json
```

Caches, logs, recovery material, and credentials are separate concerns and must not be placed inside either document merely because they are local.

Use `local` as the initial profile identity before authentication exists. A future account/profile identity can be mapped behind the same service boundary without changing feature call sites.

Do not assume that the eventual on-disk directory structure must exactly match the logical names above. The API contract is more important than the physical layout.

### Store requirements

Both persistent JSON stores should support:

- explicit `schemaVersion`;
- validation and normalization on read;
- versioned migrations;
- atomic replacement writes rather than destructive partial overwrite;
- serialized/concurrency-safe updates;
- safe defaults when the store does not yet exist;
- corruption handling that logs a warning and preserves/quarantines malformed state where practical instead of preventing application startup;
- dependency injection of the storage root for tests.

## Future account and settings-sync layer

The local store remains the immediate working copy even after accounts exist.

Expected flow:

```text
user changes portable preference
        |
        v
validate through SettingsRegistry
        |
        v
write local UserPreferencesStore immediately
        |
        +----> notify UI/subscribers
        |
        v
mark syncable change pending
        |
        v
SettingsSyncService pushes when authenticated/online
```

On another signed-in device:

```text
authenticate
   |
   v
resolve account/profile
   |
   v
pull portable preference revision
   |
   v
validate + migrate
   |
   v
merge/apply to local UserPreferencesStore
   |
   v
notify UI/subscribers
```

### Cloud contract rule

Do not synchronize the local JSON file as an opaque filesystem artifact.

The future cloud contract should operate on a versioned logical preference document or preference mutations. This keeps the cloud model independent from whether the local implementation later uses JSON, SQLite, or another durable store.

Conceptually:

```text
account
  profile
    settings schema version
    settings revision
    portable preferences
```

### Offline behaviour

Portable preference changes must remain functional offline. A disconnected device writes locally and records pending synchronization state. Network availability must not block ordinary preference reads/writes or application startup.

### Conflict policy

For an initial sync implementation, scalar preferences may use a simple revision/server-order last-write-wins rule, provided the rule is deterministic and covered by tests.

Structured collections such as keyboard maps, profiles, templates, or richer customization state should not be forced into scalar last-write-wins if that would silently discard meaningful edits. Their merge/conflict strategy can be designed when those categories are onboarded.

Conflict metadata belongs to the sync subsystem, not in feature-facing preference values.

## Credential boundary

Authentication refresh tokens, access credentials, API secrets, and equivalent sensitive values must not be written to `user-preferences.v1.json`, `device-state.v1.json`, a project package, or ordinary browser preference storage in the desktop implementation.

Define a future `CredentialStore` interface backed by platform secure storage/keychain facilities. Authentication can be implemented later without changing the settings ownership model.

Public provider configuration that is not secret still requires an explicit scope decision; it must not be placed in credential storage merely because it relates to an integration.

## Current `DesktopSettingsSnapshot` migration classification

Do not blindly rename the existing desktop snapshot to `UserPreferences`.

Initial classification for implementation planning:

| Current field | Proposed scope | Sync | Notes |
| --- | --- | --- | --- |
| `executionMode` | `device` / application runtime config | No | Depends on local capabilities |
| `modelRoot` | `device` | No | Absolute/local model path |
| `assetRoot` | `device` pending semantic audit | No initially | Current root semantics must be confirmed before migration |
| `projectRoot` | `device` | No | Default project-library location, not active project authority |
| `spotifyClientId` | application/provider config pending audit | No initially | Public ID, not a secret; decide install/device/user ownership separately |
| `lastProjectFilePath` | `device` | No | Machine-specific absolute path |
| `lastProjectFilePathExplicit` | `device` | No | State associated with local last-project path |

The migration should preserve current behaviour before deleting the legacy source-adjacent state file.

## Existing browser preferences require classification before migration

Current browser/local-storage keys are not automatically `user` preferences. The editor storage layer currently contains a mixture of preferences, UI state, caches, derived metrics, draft-layout state, AI-indexing data, and recovery-oriented material.

Before migrating a key, classify it using the ownership taxonomy and document the result.

Candidate areas requiring audit include:

- keyboard shortcut settings;
- draft-proofing settings;
- narration-follow settings;
- side-panel customization;
- top-panel customization;
- editor UI state;
- spellcheck/project proofing settings;
- local-AI configuration and indexes;
- layout snapshots and baseline metrics.

Do not bulk-copy the browser storage namespace into a desktop user-preference file.

## First vertical slice: remember New Project location

Use one narrow feature to prove the device-state boundary before migrating broader settings.

### Key

```text
projectLifecycle.lastCreateParentDirectory
```

Classification:

```text
scope: device
sync: false
```

### Required behaviour

1. When New Project opens, lifecycle orchestration asks the settings service for the remembered parent directory.
2. The value seeds `locationPath` before the dialog/browser is rendered and before the native directory picker is invoked.
3. Existing path validation/browser logic remains authoritative for whether the path is currently usable.
4. The remembered value is updated only after a project has been created successfully at that destination.
5. Browsing to another folder and then cancelling must not change durable device state.
6. Closing the dialog must not change durable device state.
7. A missing, inaccessible, or invalid remembered path must fail softly and fall back to the existing safe location-selection behaviour.
8. No copy of the absolute remembered path is written into the created project as semantic/project preference data merely to support this feature.
9. A second device has its own independent remembered directory.

Do not make `project-package-dialog.js` a persistence client. It should continue to own runtime-only dialog state. Lifecycle/settings orchestration supplies the seed and records successful completion.

## Candidate setting classifications

These are starting decisions, not permission to migrate them without checking current semantics.

| Example | Likely scope | Sync policy |
| --- | --- | --- |
| Application theme | `user` | Yes |
| Global editor font/size | `user` | Yes |
| Global accessibility choices | `user` | Yes |
| Global writing/editor defaults | `user` | Yes |
| Keyboard shortcuts | `user` | Yes, with platform-binding policy to define |
| Global proofing language/defaults | `user` | Yes if truly global |
| Project-specific proofing configuration | `project` | Via project package |
| Project-specific World Spine view/filter/layout | `project` | Via project package |
| Project metadata definitions/model classes | `project` semantic data | Via project package |
| Window bounds/maximized state | `device` | No |
| Monitor selection | `device` | No |
| Audio input/output device IDs | `device` | No |
| Local AI/model filesystem roots | `device` | No |
| Default project-library directory | `device` | No |
| Last Create/Open/Save As parent directories | `device` | No |
| Current hover/drag/transient selection | `session` | No |
| Authentication tokens/API secrets | `secret` | No ordinary settings sync |

A global default and a project override may coexist. They must remain separately owned rather than one overwriting the other.

## Desktop/editor API boundary

Long term, avoid continuing to widen a single generic `/api/settings` endpoint.

Prefer narrow logical desktop APIs or an equivalent desktop bridge, for example:

```text
/api/user-settings/preferences
/api/user-settings/device-state
```

Exact route names are not fixed by this design. Required properties are:

- editor code cannot select arbitrary host filesystem destinations for the settings store;
- reads/writes are validated against registered keys/scopes;
- device state and portable user preferences remain distinct contracts;
- authentication/sync transport is a separate concern from local persistence;
- browser-only mode can retain an adapter implementation without forcing desktop storage semantics into feature code.

## Implementation phases

### Phase 0 — design and audit

- keep this branch documentation-only;
- finish persistence regressions independently;
- classify existing settings/preference-like state before migration.

### Phase 1 — local user-data foundation

- add platform user-data path resolver owned by desktop host;
- add registry and typed preference/device-state contracts;
- add versioned local stores with test-root injection;
- migrate legacy `.desktop-state.json` without changing visible behaviour;
- retain compatibility long enough to avoid losing existing user state.

### Phase 2 — New Project device-state proof

- implement `projectLifecycle.lastCreateParentDirectory`;
- seed the dialog through lifecycle orchestration;
- persist only after successful creation;
- add restart/cancel/invalid-path tests.

### Phase 3 — preference audit and incremental migration

- classify existing browser-storage keys;
- migrate only true global user preferences to `UserPreferencesStore`;
- move device state to `DeviceStateStore`;
- leave project preferences in project persistence;
- leave caches/recovery data in their proper subsystems.

### Phase 4 — account/profile abstraction

- introduce account/profile identity behind `UserSettingsService`;
- keep `local` profile behaviour working without authentication;
- define future sync revision metadata without changing feature call sites.

### Phase 5 — cloud sync and credentials

- implement authentication separately;
- implement secure credential storage;
- implement account-backed portable settings sync;
- test offline edits, two-device convergence, conflicts, sign-out, and account switching.

## Verification contract

### Local storage tests

Use an injected temporary user-data root. Tests must never write real developer AppData or source/worktree state.

Prove:

- first-run defaults;
- durable restart persistence;
- atomic update behaviour;
- schema migration;
- malformed/corrupt settings recovery;
- concurrent/serialized updates do not lose unrelated keys;
- no settings artifact is created inside the repository/worktree;
- no user/device settings artifact is created inside a project package;
- absolute machine paths cannot enter a syncable user-preference payload.

### New Project tests

Prove:

- successful Create Project remembers its parent directory;
- opening New Project again uses that directory;
- Browse then Cancel does not change it;
- dialog Close does not change it;
- failed project creation does not change it;
- invalid remembered paths fall back safely;
- each injected device-state store retains its own directory.

### Future account-sync tests

Before cross-device sync is considered complete, prove:

- user-scoped portable settings roam to a second device;
- device-scoped settings never roam;
- project-scoped data is absent from the settings-sync payload;
- secrets are absent from the settings-sync payload;
- offline preference edits survive restart and later synchronize;
- deterministic conflict handling is applied;
- signing out does not expose another account's synchronized profile state.

## Architectural guardrails

1. Mutable user/device state must never use the repository, source tree, installation directory, or `process.cwd()` as its production storage root.
2. A project package must never contain account credentials, account identity solely for settings sync, machine-absolute user paths, or global user preferences.
3. The user-data store must never become an alternate home for manuscript, World Spine, characters, tasks, notes, project metadata definitions, or other semantic project content.
4. Feature code must not read/write operating-system settings files directly.
5. The project-package dialog remains runtime UI state, not persistence authority.
6. Only registered `user` settings explicitly marked syncable may enter the future cloud settings payload.
7. `device` values must remain independently meaningful on every installation.
8. Secrets use a credential boundary, not ordinary settings JSON.
9. Local settings must continue to work when no account exists or the network is unavailable.
10. Browser compatibility must remain adapter-driven rather than allowing browser storage to define the desktop architecture.

## Open decisions for implementation start

Resolve these when the design branch is reactivated against the then-current code:

- final application identifier and exact platform directory names;
- whether configuration and state use separate platform directories on Linux/macOS or one host abstraction with logical sub-stores;
- exact local file layout versus SQLite or another store if requirements grow;
- precise ownership of `assetRoot` and public provider IDs;
- whether keyboard shortcuts synchronize as raw platform bindings, normalized intents, or per-platform variants;
- account/auth provider and backend architecture;
- cloud preference mutation/document API shape;
- revision granularity and conflict UX;
- whether multiple named user profiles are exposed in the first account release or remain an internal capability;
- sign-out/account-switch retention policy for locally cached synced preferences.

## Reactivation checklist

When implementation is ready to begin:

1. rebase or recreate the implementation branch from the current persistence/mainline architecture;
2. reread `AGENTS.md`, `agents/DesktopAgent.md`, persistence/storage architecture docs, and this specification;
3. rerun the settings/preference ownership audit against current code rather than assuming the candidate table is still complete;
4. confirm persistence regression suite is green before changing the legacy desktop state store;
5. implement Phase 1 independently of authentication/cloud sync;
6. use New Project remembered-directory behaviour as the first end-to-end proof;
7. promote stable ownership rules into `docs/architecture` once the runtime implementation makes them current-system truth.
