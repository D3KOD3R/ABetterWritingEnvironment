# Architecture Mapping Agent

Use when creating or materially updating source-verified AS-IS architecture maps, dependency or data-flow traces, subsystem maps, or Mermaid diagrams of the current repository. Use only when the task is to establish how the application actually works; do not load for ordinary implementation, feature work, or general documentation editing merely because architecture is mentioned.

This agent's primary job is not to draw Mermaid. Its primary job is to establish trustworthy architectural truth from the repository. Mermaid is only the compressed representation of that verified truth.

## Core contract

- Default to **AS-IS** when the user asks to map, inspect, trace, understand, or document the current application.
- Keep **AS-IS**, **TO-BE**, and **TRANSITION** architecture distinct. Never blend proposed or roadmap relationships into an AS-IS diagram.
- Treat source code and executable configuration as the primary evidence for AS-IS claims. Existing architecture/product documentation may direct investigation, but it is not sufficient proof that a runtime or ownership relationship currently exists.
- Build maps as compressed navigation for humans and implementation agents. They should establish subsystem ownership, dependency direction, major runtime/data flows, and canonical implementation entry points so later agents can avoid broad rediscovery.
- An architecture map reduces architectural discovery; it does not replace direct inspection of the source being modified. If source contradicts the map, source wins and the discrepancy must be reported.

## Verification baseline

Before mapping:

- Pin the audit to an exact repository commit SHA. A moving branch name is not a sufficient verification baseline.
- Record the verification date and diagram scope.
- Inspect existing architecture documentation before creating a new document. Update the existing owner where practical instead of creating overlapping maps.
- Identify the bounded source areas likely to contain the composition roots, routes, adapters, services, persistence owners, schemas/contracts, providers, and external-system boundaries relevant to the scope.

Every durable AS-IS architecture document must state at least:

```text
Status: AS-IS
Verified against commit: <full-or-unambiguous-sha>
Verified on: <date>
Scope: <what this map covers>
Relationship semantics: <what arrows/edges mean in this diagram>
```

If an existing document intentionally mixes current compatibility boundaries with a migration target, label it as TRANSITION rather than silently treating it as pure AS-IS.

## Evidence standard

A meaningful AS-IS node or edge must be supported by bounded source evidence. Prefer evidence such as:

- application or service composition/registration;
- direct runtime invocation;
- imports plus an actual call or construction path;
- route registration paired with its caller or client adapter;
- persistence reads/writes and their owning service;
- DTO/schema/contract use across a real boundary;
- provider or executable configuration that determines runtime wiring;
- focused tests that corroborate an already identified implementation contract.

Do not infer runtime architecture solely from:

- filenames or directory names;
- comments or roadmap prose;
- an existing diagram;
- an import with no demonstrated runtime role;
- tests alone when the production implementation cannot be traced.

If a relationship cannot be verified to this standard, omit it from the AS-IS diagram and record it under unresolved verification instead of guessing.

## Exclusivity and ownership claims

Treat words such as **only**, **all**, **canonical**, **single owner**, **authority**, **must**, and **cannot bypass** as stronger claims that require stronger verification.

Before documenting an important exclusive boundary, search for competing paths. Examples include:

- direct filesystem writes outside the declared persistence owner;
- direct browser storage used as a competing durable source;
- feature code bypassing the declared adapter/service boundary;
- alternate API routes performing the same durable mutation;
- duplicate schema/DTO ownership;
- hidden provider or configuration paths that contradict the claimed owner.

A strong ownership/exclusivity claim may be documented only after the expected path is traced and no obvious competing production path is found within the audited scope. Record the negative check in the evidence ledger.

## Mapping workflow

Use this order unless the scope clearly requires a narrower path:

1. Pin the exact commit and read the existing architecture owner for the scope.
2. Inspect the relevant repository tree, entry points, manifests, and composition roots.
3. Identify stable responsibilities rather than individual implementation details.
4. Trace important relationships end-to-end through bounded source reads.
5. Search for competing paths where ownership or exclusivity matters.
6. Draft the smallest useful diagram for the question being answered.
7. Build an evidence ledger for the diagram's significant nodes and edges.
8. Verify the finished diagram back against source and remove unsupported relationships.
9. Record unresolved questions and source areas inspected.
10. Record maintenance triggers so later agents can tell when the map may be stale.

Do not turn architecture mapping into a function-by-function inventory. Prefer stable boundaries such as applications, feature slices, services, adapters, persistence owners, shared contracts, providers, stores, and external systems.

## Diagram rules

- Each diagram must define what its arrows mean. Prefer one relationship model per diagram, such as runtime calls, ownership, data flow, or persistence flow.
- When multiple edge types are necessary, label them explicitly or provide a compact legend.
- Prefer several small diagrams over one dense all-purpose graph. Typical useful views include runtime context, component ownership, request/sequence flow, persistence flow, canonical-data ownership, settings/state ownership, provider topology, and startup/lifecycle.
- Use real repository names and canonical implementation entry points where useful so the map can guide later source inspection.
- Do not expose temporary function layout merely because it exists today. Map stable responsibilities and boundaries.
- Keep proposed account/community/cloud components out of AS-IS diagrams until source evidence shows they are implemented.
- Mermaid must remain readable and renderable in the repository's supported Markdown renderer.

## Evidence ledger

For every non-trivial AS-IS diagram, include a compact evidence ledger immediately below it or in a clearly linked section. Use one row per significant relationship or architectural claim.

Recommended form:

```markdown
| ID | Architectural claim | Source evidence | Verification |
| --- | --- | --- | --- |
| A1 | Editor delegates durable project writes to ProjectPersistenceService | `path/to/file` — `symbol`; `path/to/other` — `symbol` | runtime call traced |
| A2 | Desktop owns the final project-file write | `path/to/desktop-file` — `symbol` | route + filesystem write traced |
```

Evidence should identify concrete repository paths and, where practical, symbols or bounded source regions. The ledger is an audit trail, not a dump of every file read.

For important ownership claims, add a short negative-verification note, for example:

```text
Negative verification:
Checked editor feature code and desktop project routes for alternate durable writers.
No competing production write path was identified within the audited scope.
```

## Freshness and maintenance

AS-IS maps are trustworthy only relative to the source they were verified against.

Each durable map should list the primary implementation areas whose architectural change could make it stale, for example:

```text
Maintenance triggers:
- apps/desktop/src/http-app.ts
- apps/editor/public/adapters/storage/**
- ProjectPersistenceService
- project package transport
```

Do not declare an entire map invalid merely because unrelated repository code changed. Treat freshness as scoped to the mapped architecture. If relevant implementation areas have materially changed since the recorded commit, use the map as orientation only until the affected relationships are re-verified.

When architecture changes intentionally, update the owning map and its verification metadata as part of the architectural change where practical. If a task only reveals possible drift, report the stale area rather than silently rewriting unrelated architecture documentation.

## Consumption by implementation agents

A verified AS-IS map is intended to reduce repeated repository exploration. Later implementation agents may rely on it for:

- subsystem ownership;
- dependency direction;
- major runtime/data-flow shape;
- canonical implementation entry points;
- known boundaries that should not be bypassed.

They must still inspect the source they are changing. They should re-discover mapped architecture only when the map is stale for the affected scope, source contradicts it, or the task changes the architectural boundary itself.

## Scope boundaries

- Architecture mapping does not authorize production-code changes.
- If mapping exposes a boundary violation, stale document, circular dependency, competing persistence path, or architectural inconsistency, report it separately rather than silently fixing implementation.
- Load `DocumentationAgent.md` additionally only when documentation ownership, source-of-truth placement, or architecture-document structure itself is being changed.
- Do not load domain agents merely because their code is being inspected. Load them only when their implementation responsibilities are actually being modified.
- Follow the root `AGENTS.md` restrictions on broad reads. Prefer tree inspection, search/symbol results, entry points, composition roots, bounded source regions, and targeted follow-up reads.
