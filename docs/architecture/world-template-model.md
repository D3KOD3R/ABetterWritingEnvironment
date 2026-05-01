# World Template Model

## Template Blueprint

A `WorldTemplate` defines a reusable entity shape with typed `TemplateField` records. Fields are validated at instantiation time and may declare defaults or enum options.

Imported Scrivener template sheets are preserved as template records with source provenance, including the original binder path and source text, so the application can render or edit them later without re-reading the Scrivener package.

## Instantiated Entities

A `WorldEntity` preserves:

- a stable entity ID
- template ancestry
- typed field values
- optional notes
- an explicit introduction record

## Introduction and Linking

Entity introductions are reviewable structured records. They connect an entity to:

- a canonical manuscript anchor
- an optional timeline node

Supporting `EntityLink` records make cross-package reasoning inspectable and avoid hidden mutations.

## AI Boundary

Future analysis systems may suggest templates, instances, or missing links, but canonical world data changes remain explicit mutations to these structured models.

## Review Queue

The current bootstrap surfaces reviewable world suggestions through the analysis layer rather than mutating `packages/world-schema` directly. That queue may propose:

- a missing template shape
- an entity instantiation
- a missing introduction or cross-spine relationship

Each suggestion must carry manuscript evidence and remain pending until the user explicitly accepts it.
