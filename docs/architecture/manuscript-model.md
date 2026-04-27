# Manuscript Model

## Canonical Structure

A manuscript project is a nested hierarchy:

- `Project`
- `Chapter`
- `Scene`
- `ManuscriptBlock`

Each `ManuscriptBlock` is a stable addressable unit representing a narration or dialogue paragraph. Blocks own a distinct `paragraphId` so diagnostics, narration, and world links can refer to the same paragraph identity.

## Durable Addressing

Anchors are first-class domain objects with:

- `projectId`
- `chapterId`
- `sceneId`
- `blockId`
- `paragraphId`
- `startOffset`
- `endOffset`

UI line numbers are derived from project traversal and are not stored as durable identifiers.

## Review Records

`IssueRecord` and `EventTag` attach only through canonical anchors. They store excerpt evidence generated from the anchored span so downstream tooling can display immediate context without losing the durable reference.

## Binder Derivation

Binder data is derived from chapter and scene structure. That keeps a single source of truth for manuscript identity while still giving the editor an IDE-like navigation tree.
