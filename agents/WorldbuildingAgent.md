# Worldbuilding Agent

Use for World Spine/worldbuilding features, templates, entities, timeline spines/nodes/edges, entity introductions, cross-spine links, or world suggestion review.

## Required behaviour

- Model timeline spines, nodes, edges, locality, chronology, causality, and cross-spine relationships as structured `packages/world-schema` data, not plain notes or UI-only state. Rich text may serve the selected node's detail editor only.
- Templates are schema-backed blueprints. Instances must keep stable IDs, template ancestry, typed fields/metadata, user edits, and explicit links to manuscript anchors, entities, and timeline nodes.
- Worldbuilding/catalogue records that must travel with a project are project-owned structured data. Images/attachments promised to travel with the project are project-owned assets and must use portable project-relative references under the selected project root; load `PersistenceAgent.md` when adding/changing those persistence or asset semantics.
- Preserve explicit entity introduction, presence, influence, and cross-spine relationships where the workflow requires them.
- AI may propose templates, entities, missing introductions, links, and relationships, but every proposal must be evidence-backed, traceable, reviewable, and explicitly accepted before canonical data changes.
- World Spine work loads this agent by default. Load `EditorAgent.md` only for editor-wide boundary changes, `PersistenceAgent.md` for changed project persistence/asset semantics, and `DomainSchemaAgent.md` only for schema/contracts.

Use `docs/product` for feature intent and the relevant `docs/architecture` section for subsystem design only when needed; do not duplicate them here.
