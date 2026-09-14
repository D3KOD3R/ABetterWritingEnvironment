# User Account Integration Readiness

## Status

Design-only implementation specification. No production behaviour is changed by this document.

This document is intentionally parked on `feature/user-settings-account-sync-design` while persistence regression testing continues independently on `feature/persistence-portability-harness`.

It extends [User Settings, Device State, and Account Sync Boundary](./user-settings-account-sync-boundary.md). The two designs should be implemented together as complementary boundaries: accounts provide identity and online capabilities; local settings/project persistence remain authoritative for offline writing.

## Product decision

ABetterWritingEnvironment should support user accounts, but an account must not become a prerequisite for the core local writing application.

The intended product model is:

> Local-first editor, optional account, account-gated network capabilities.

A signed-out user must still be able to create, open, edit, autosave, save, import, export, and recover local projects. Authentication failure, server outage, expired remote credentials, or account deletion must not make local project files unavailable.

Account identity is therefore an additional capability layer. It is not the ownership layer for local project data.

## Why accounts are justified

Accounts become useful as soon as the product contains server-owned or multi-user capabilities. Expected examples include:

- public/private writer profiles and handles;
- community membership and social identity;
- live or asynchronous community writing sessions/rooms;
- participation history, challenges, groups, invitations, follows, blocks, and reports;
- moderation and abuse controls;
- cross-device portable user preference synchronization;
- hosted service entitlements, subscription state, quotas, or server-side AI credits;
- account-owned online data that genuinely needs continuity between devices.

None of these requirements imply that manuscripts should automatically become cloud documents.

## Costs and disadvantages of adding accounts

Accounts materially increase the security, privacy, operational, and UX surface of the application.

The product must now handle credential security, account recovery, session expiration, revoked sessions, duplicate identities, email verification if used, rate limiting, abusive users, profile deletion/export, server availability, database migrations, backups, monitoring, and eventually moderation policy.

There is also architectural risk. If account identity is allowed to leak into project storage, preferences, browser storage, or feature code indiscriminately, a local-first application can gradually become network-dependent. The design below prevents that coupling deliberately.

## Core invariants

### Local writing never depends on authentication

The desktop host starts the local application first. Account session resolution occurs asynchronously and cannot block the editor boot sequence.

Network-dependent features may be disabled or show a sign-in/offline state, but ordinary project operations continue.

### Signing in never means upload my manuscript

Authentication is not project synchronization consent.

Project packages remain local project truth unless the user deliberately enables a future cloud-project/collaboration feature with a separate contract and explicit user action.

### Signing out does not delete local work

Signing out clears/invalidates account credentials and disables account capabilities. It does not delete, hide, relocate, or re-key local project packages.

### Account deletion does not delete local files

Deleting an online account may delete server-owned account/community/settings data according to product policy, but it cannot silently delete independent local project files.

### Secrets never enter project or ordinary settings storage

Passwords, access tokens, refresh tokens, authorization codes, client secrets, private keys, or equivalent credentials must never be persisted in:

- `.abe-project.json` or project package sidecars;
- `UserPreferencesStore`;
- `DeviceStateStore`;
- `.desktop-state.json`;
- ordinary browser `localStorage` in the production desktop application;
- developer logs.

## Domain terminology

The current application already has a writing-goal session tracker, while authentication and the future community feature will also have concepts commonly called a session. Do not use an unqualified `Session` type across these domains.

Use explicit terminology:

```text
AuthSession
    login/credential/session lifecycle

WritingTargetSession
    existing local personal writing-goal/session-tracker lifecycle

CommunityWritingSession (or WritingRoom)
    future shared social writing event/room
```

This naming rule should be enforced in shared contracts and database schemas before community development begins.

## Separation of concerns

Account work should be split into independently replaceable layers.

### Authentication / identity provider

Proves an identity and produces an authenticated session. Password authentication, passkeys, OAuth/OIDC, or a managed identity provider belong here.

The application domain must not assume that a password row is the permanent definition of a user.

### Application account

Owns the stable internal account/user ID and application account status.

Email is a mutable contact/login identifier, not the domain primary key.

### Account profile

Owns display name, unique handle, avatar metadata, biography, and future public/community presentation state.

### Auth session

Owns credential refresh/revocation lifecycle for one signed-in installation/device session.

### User settings sync

Synchronizes only registry-approved portable `user` preferences. It must obey the separate settings ownership design and cannot become a generic cloud backup channel.

### Community domain

Owns social relationships, rooms/events, participation, blocks, reports, moderation, and other server-authoritative multi-user data.

### Future cloud project/collaboration domain

If implemented, this must be a separate explicit subsystem. Login alone does not make a local project account-owned or remotely synchronized.

## Current architecture findings

### The desktop host is already the correct security boundary

`apps/desktop` is the local composition root and exposes same-origin HTTP capabilities to the editor. This is the correct place to own account networking, credential storage, refresh behaviour, and offline/error normalization.

The browser editor should not call the Docker or production account API directly.

### The editor already uses replaceable adapters/services

Project persistence, browser storage, platform directory selection, and feature services already demonstrate the intended direction: UI/feature code calls an adapter/service and does not own native/runtime transport details.

Account integration should copy that pattern rather than adding raw remote `fetch` calls to editor feature modules.

### `app.js` is still a high-coupling migration surface

Do not implement registration/login workflow logic directly in `apps/editor/public/app.js`.

The account UI should be a feature slice with small shell/bootstrap wiring only.

### Current browser token storage is not the production account credential store

`createDurableBrowserTokenStorage` exists for browser-only integration continuity. Production desktop account refresh/access credentials must not reuse browser local/session storage.

### Current desktop settings storage is not credential storage

`.desktop-state.json` is transitional settings/device state and must not receive account credentials.

### Current desktop logging is not secret-aware enough for auth traffic

Desktop/browser logging currently sanitizes values structurally but does not provide a hard secret-key redaction contract. Secret redaction must be introduced before auth payloads are transported through these layers.

### The local HTTP API needs a security policy before sensitive routes

The current desktop API exposes permissive CORS headers, including `Access-Control-Allow-Origin: *`.

That is acceptable only for non-sensitive prototype surfaces. Sensitive account routes must not be added under a wildcard-origin policy. The local host needs an explicit same-origin/trusted-origin policy before credentials or authenticated account responses are introduced.

## Target architecture

```text
apps/editor
   |
   | same-origin, safe account view DTOs only
   v
apps/desktop
   |
   +-- ProjectPersistenceService / local services
   |       always available; no account dependency
   |
   +-- AccountSessionService
   |       |
   |       +-- AccountApiClient
   |       |       |
   |       |       v
   |       |   remote/dev account API
   |       |
   |       +-- CredentialStore
   |               |
   |               v
   |        OS secure storage in production
   |
   +-- UserSettingsService
           |
           +-- future SettingsSyncService

                         network
                           |
                           v
                   apps/account-api
                      |         |
                 identity     account/profile
                      |         |
                      +----+----+
                           |
                        PostgreSQL
```

The Docker API used during development should have the same conceptual contract as the eventual remote service. Only its base URL/deployment changes.

## Why the editor should not call the account API directly

Keeping the remote account API behind `apps/desktop` provides several benefits:

- refresh credentials never need to enter browser DOM/runtime storage;
- one place owns timeouts, retries, token refresh, revocation, and offline mapping;
- editor code sees a stable account state rather than HTTP/provider details;
- production native secure credential storage can be introduced without rewriting UI features;
- the account API base URL does not leak through every browser feature;
- local-first behaviour can be tested by replacing the account client with an unavailable/no-op implementation;
- it matches the repository's existing adapter/service direction.

## Safe editor-facing account contract

The editor needs only a presentation/capability view, not credentials.

Illustrative contract:

```ts
export type AccountAuthState =
  | "signed_out"
  | "signing_in"
  | "signed_in"
  | "signed_in_offline"
  | "refreshing"
  | "session_expired"
  | "account_disabled";

export interface AccountSummary {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string;
}

export interface AccountSessionView {
  state: AccountAuthState;
  account: AccountSummary | null;
  online: boolean;
  entitlements?: string[];
}
```

Do not include refresh tokens or access tokens.

Do not include email in every generic account DTO merely because it exists on the account. Supply private account-management details only to the feature that needs them.

Initial DTOs may live in `packages/shared-types`. If the external service contract grows independently, create `packages/account-contracts` rather than allowing `shared-types` to become an unbounded service API bucket.

## Desktop account boundary

Introduce a narrow desktop-owned account subsystem instead of adding credential/network logic directly to the already-large `http-app.ts`.

Suggested initial structure:

```text
apps/desktop/src/account/
  account-api-client.ts
  account-session-service.ts
  account-types.ts

apps/desktop/src/security/
  credential-store.ts

apps/desktop/src/routes/
  account-routes.ts
```

Exact paths can change during implementation; ownership must not.

### `AccountApiClient`

Responsibilities:

- call the configured external/dev account service;
- set bounded request timeouts;
- attach access authorization internally;
- normalize transport failures;
- never log password/token bodies;
- expose account-service operations independent from the UI.

### `AccountSessionService`

Responsibilities:

- maintain the local auth state machine;
- register/login/logout;
- restore a persisted refresh credential at startup;
- refresh access authorization when required;
- cache only a safe account summary needed for signed-in-offline presentation;
- expose capability state to the editor;
- invalidate credentials when revoked/disabled;
- ensure account API failures never become project persistence failures.

### `CredentialStore`

Define the interface before selecting the production implementation.

Illustrative minimum:

```ts
interface CredentialStore {
  getRefreshCredential(): Promise<string | null>;
  setRefreshCredential(value: string): Promise<void>;
  clearRefreshCredential(): Promise<void>;
}
```

Local integration tests may inject an in-memory or temporary isolated development implementation.

Production desktop builds should use the operating-system credential vault/keychain. Do not use `.desktop-state.json`, a project package, `UserPreferencesStore`, or browser storage as the production credential implementation.

## Desktop account routes

The editor-facing local API should expose safe commands/views, for example:

```text
GET  /api/account/session
POST /api/account/register
POST /api/account/login
POST /api/account/logout
GET  /api/account/profile        later if needed
PATCH /api/account/profile      later if needed
```

Token refresh should normally be an internal `AccountSessionService` concern, not a button/API call the editor has to coordinate.

All sensitive local routes must use the tightened local-origin security policy.

## Editor feature boundary

Suggested shape:

```text
apps/editor/public/features/account/
  account-service.js
  account-menu.js
  account-dialog.js

apps/editor/public/state/
  account-state.js

apps/editor/public/adapters/account/
  desktop-account-client.js
```

The feature should consume `AccountSessionView` and high-level commands only. It must not know token formats or the remote API base URL.

A first UI slice can be intentionally small: account status in the application chrome plus a login/register/logout dialog. Community UI should not be bundled into the first authentication implementation.

## Account state machine and offline behaviour

Required top-level behaviour:

```text
signed_out
   |
   +-- login/register --> signing_in --> signed_in
                                   \--> signed_out + surfaced error

signed_in
   |
   +-- transient API loss --> signed_in_offline
   +-- refresh required --> refreshing --> signed_in
   |                                  \--> session_expired
   +-- logout --> signed_out
   +-- remote disable/revoke --> account_disabled/session_expired

signed_in_offline
   |
   +-- connectivity returns --> refreshing/signed_in
   +-- logout --> signed_out
```

The application must not delay local workspace/project boot while waiting for this state machine to contact the server.

A safe cached profile summary may support `signed_in_offline`, but cached authorization must never allow server-only actions to be fabricated while disconnected.

## Development account API

Create the deployable service as a new composition root:

```text
apps/account-api/
  src/
    server.ts
    routes/
      auth.ts
      account.ts
    services/
    persistence/
  migrations/
  package.json
  Dockerfile
```

`apps/account-api` is preferred to `services/account-api` because it is an independently deployable HTTP composition root. Reusable identity/account rules can later be extracted into packages/services when there is a genuine second consumer.

### Initial endpoints

```text
GET  /health
POST /v1/auth/register
POST /v1/auth/login
POST /v1/auth/refresh
POST /v1/auth/logout
GET  /v1/me
```

Add profile mutation, email verification, password reset, OAuth/passkeys, and community endpoints in later slices.

### Initial database ownership

Minimum logical entities:

```text
accounts
  stable UUID primary identity
  status
  created/updated timestamps

auth_identities / password_credentials
  account_id
  provider
  provider subject/email as applicable
  password hash when password auth is enabled

account_profiles
  account_id
  handle
  display name
  avatar metadata

refresh_sessions
  id
  account_id
  refresh-token hash/session secret hash
  issued/expiry/revoked timestamps
  optional device label
```

Use stable random/UUID account IDs. Never use email address as the domain foreign key.

Password hashing and token generation must use mature, reviewed libraries. Do not implement password cryptography manually. If application-owned password auth is used, use a modern password KDF such as Argon2id through a maintained library and rotate/revoke refresh sessions deliberately.

The identity-provider boundary should remain replaceable so a managed/self-hosted OIDC provider can be adopted later without rewriting the community/account domain.

## Docker development stack

A first development stack should remain small:

```text
compose.accounts.dev.yaml
  account-api
  postgres
```

Add a local mail testing service only when verification/reset email is implemented. Do not introduce Redis, queues, or event infrastructure before a concrete need exists.

Suggested development configuration:

```text
Desktop host:
  ABE_ACCOUNT_API_BASE_URL=http://127.0.0.1:8081

Account API:
  DATABASE_URL=...
  auth signing/pepper/development secrets from ignored local environment
```

Bind the development API to loopback where practical. The database does not need a public host port unless a developer tool explicitly requires it.

Persist Postgres data in a named development volume; tests should use isolated/reset schemas or disposable containers so account tests cannot depend on developer data.

## Security prerequisites before first login test

### Replace wildcard local API CORS for sensitive surfaces

Before `/api/account/*` exists, define a local host origin policy. Production editor calls should be same-origin. If development requires another local origin, allowlist exact trusted loopback origins rather than `*`.

Do not rely on browser private-network behaviour as the security boundary.

### Add secret-aware log redaction

Both desktop and browser diagnostics must recursively redact well-known secret keys and authorization headers, including at minimum:

```text
authorization
cookie
password
accessToken / access_token
refreshToken / refresh_token
clientSecret / client_secret
authorizationCode / code when used for login exchange
```

Account networking should additionally avoid logging request/response bodies by default.

### Limit account request bodies

The desktop server currently accepts request bodies sized for much larger project/service operations. Auth/account routes should have small route-specific limits and explicit JSON/content validation.

### Remote API controls

The Docker/production API needs server-side input validation, credential-attempt rate limits, generic login failure responses, refresh revocation, and authorization checks independent of anything supplied by the editor.

## Relationship to user settings sync

Authentication should land before cloud settings synchronization, but the contracts should already align.

The existing local `UserSettingsService` remains the immediate preference owner. A future `SettingsSyncService` receives the authenticated account identity/session capability and synchronizes only registry-approved `user` settings.

Account sign-in must not cause device state, paths, project state, browser caches, or credentials to enter the settings sync payload.

## Community preparation

Do not build community tables/UI into the first authentication slice, but choose identity contracts that will support community cleanly.

Community entities should reference stable `accountId`, not email.

The first community release should include authorization, block/report semantics, and moderation/audit ownership as part of the design rather than treating abuse controls as a post-launch enhancement.

A future `CommunityWritingSession`/`WritingRoom` should be server-authoritative for membership/presence/session metadata, while the user's manuscript/project remains local unless a separate collaboration feature explicitly shares project content.

For example, a community writing room can share:

- room identity and participants;
- timer/session state;
- voluntarily published word-count deltas or progress signals;
- chat/community metadata if implemented;

without uploading the manuscript text being written.

## Implementation phases

### A0 — account readiness, no remote service dependency

- preserve the existing regression baseline;
- add shared safe account/session DTOs;
- add `CredentialStore`, `AccountApiClient`, and `AccountSessionService` interfaces/initial implementations;
- provide a no-op/signed-out account implementation;
- extract account routes behind a small route module rather than growing `http-app.ts` directly;
- tighten local API origin policy before sensitive routes;
- add secret-aware logging redaction;
- add editor `account-state` and desktop-account adapter boundaries;
- prove local project workflows are identical with account capability disabled.

### A1 — Docker account API

- add `apps/account-api`;
- add Dockerfile and `compose.accounts.dev.yaml`;
- add PostgreSQL and migrations;
- implement register/login/refresh/logout/me;
- add isolated account API integration tests;
- keep the server implementation independent from editor/project persistence.

### A2 — desktop sign-in wiring

- point `AccountApiClient` at the Docker API;
- add a test/development credential store;
- expose safe `/api/account/*` desktop routes;
- add login/register/logout UI in the account feature slice;
- restore an auth session asynchronously at desktop boot;
- prove API-down startup and mid-session behaviour.

### A3 — production credential and account hardening

- implement OS credential-vault storage;
- implement production TLS/deployment configuration;
- add verification/reset or connect the chosen external identity provider;
- add rate limiting, audit/security events, monitoring, backup/restore, and session-management UX;
- define account data export/deletion and retention behaviour.

### A4 — account-backed portable settings

- connect `SettingsSyncService` to authenticated account state;
- sync only `user`-scoped settings;
- test offline edits and deterministic conflict handling;
- test account switching without leaking one profile's settings into another.

### A5 — community foundation

- account profiles/handles;
- community discovery/relationships as required;
- `CommunityWritingSession`/writing-room contracts;
- membership/authorization;
- blocks/reports/moderation;
- explicit privacy contract for any progress/activity published from local writing.

## Verification contract

### Local-first regression gates

Run the complete existing project/persistence regression suite with:

- no account API configured;
- account API configured but offline;
- signed out;
- signed in then disconnected;
- signed in then logged out.

In every case local project create/open/edit/save/autosave/save-as/import/export behaviour must remain independent from account state unless the tested operation is explicitly an online/account feature.

### Account service unit tests

Prove:

- deterministic auth state transitions;
- timeout/offline mapping;
- refresh success and failure;
- revoked/expired session handling;
- logout clears credentials;
- safe cached account summary contains no secrets;
- one user's local auth state cannot bleed into another profile/test instance.

### Docker integration tests

Prove:

- register -> login -> `me`;
- duplicate identity rejection;
- wrong-password rejection without excessive account disclosure;
- refresh rotation/expiry/revocation policy;
- logout invalidates the relevant refresh session;
- disabled account is rejected;
- two accounts cannot access each other's private account-owned records;
- database migrations can create a clean environment.

### Secret-boundary tests

Automated tests should scan representative outputs and prove passwords/tokens do not appear in:

- project snapshots/packages;
- user preference/device-state documents;
- browser local storage used by ordinary app state;
- desktop/browser logs;
- safe `AccountSessionView` responses.

### Local API security tests

Prove sensitive routes reject untrusted origins according to the chosen local-host policy and never return credential material to the browser editor.

## First implementation recommendation

Do not start by adding a registration form.

The first runtime PR after persistence regression work is stable should implement **A0 only**. Its purpose is to make the current application account-ready without creating a new network dependency.

A0 is complete when:

```text
existing regression suite passes unchanged
local writing boots and works with no account service
AccountSessionService can be replaced by a fake in tests
editor receives only a safe signed-out AccountSessionView
local sensitive-route origin policy exists
secret-aware log redaction exists
no account credential can reach browser/project/settings/log storage
no new account workflow logic is embedded directly in app.js
```

The next PR can then introduce the Docker/PostgreSQL account API behind those boundaries. This sequencing lets account work proceed without destabilizing the project persistence system that is currently under regression testing.

## Decision summary

User accounts are appropriate for the final product because community and shared online writing features require persistent server identity. They should be introduced as an optional online capability layer around a fully functional local-first editor.

The current architecture is already close to supporting this cleanly because the desktop host can become the account/network/credential boundary and the editor already has adapter/service patterns. The most important preparation work is to formalize that boundary, harden the local HTTP/logging surfaces, isolate credentials, and keep project persistence completely independent from authenticated account state.
