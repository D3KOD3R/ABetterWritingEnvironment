import type { ManuscriptAnchor } from "../../manuscript-schema/src/index.ts";

export type TemplateFieldType = "text" | "number" | "boolean" | "enum" | "list";
export type TemplateValue = string | number | boolean | string[];
export type TimelineSpineKind =
  | "planet"
  | "faction"
  | "character"
  | "region"
  | "thread"
  | "custom";
export type TimelineEdgeKind = "causes" | "references" | "overlaps" | "reveals";
export type EntityLinkKind =
  | "manuscript-reference"
  | "timeline-introduction"
  | "timeline-presence"
  | "entity-relationship";

export interface WorldModel {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  templates: WorldTemplate[];
  entities: WorldEntity[];
  spines: TimelineSpine[];
  nodes: TimelineNode[];
  edges: TimelineEdge[];
  entityLinks: EntityLink[];
  sequences: WorldSequences;
}

export interface WorldSequences {
  template: number;
  field: number;
  entity: number;
  spine: number;
  node: number;
  edge: number;
  introduction: number;
  link: number;
}

export interface TemplateField {
  id: string;
  key: string;
  label: string;
  valueType: TemplateFieldType;
  required: boolean;
  description: string;
  defaultValue?: TemplateValue;
  options?: string[];
}

export interface WorldTemplate {
  id: string;
  key: string;
  name: string;
  description: string;
  fields: TemplateField[];
  source?: string;
  scrivenerDocumentId?: string;
  scrivenerBinderPath?: string;
  sourceText?: string;
  createdAt: string;
}

export interface TemplateOrigin {
  templateId: string;
  templateKey: string;
}

export interface EntityIntroduction {
  id: string;
  entityId: string;
  anchor: ManuscriptAnchor;
  timelineNodeId?: string;
  notes?: string;
  createdAt: string;
}

export interface WorldEntity {
  id: string;
  name: string;
  notes: string;
  fields: Record<string, TemplateValue>;
  templateOrigin: TemplateOrigin;
  createdAt: string;
  updatedAt: string;
  introduction?: EntityIntroduction;
}

export interface TimelineSpine {
  id: string;
  key: string;
  label: string;
  kind: TimelineSpineKind;
  description: string;
  nodeIds: string[];
  createdAt: string;
}

export interface TimelineNode {
  id: string;
  spineId: string;
  label: string;
  summary: string;
  order: number;
  linkedEntityIds: string[];
  manuscriptAnchors: ManuscriptAnchor[];
  createdAt: string;
}

export interface TimelineEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  kind: TimelineEdgeKind;
  label?: string;
  createdAt: string;
}

export interface EntityManuscriptLink {
  id: string;
  entityId: string;
  kind: "manuscript-reference";
  anchor: ManuscriptAnchor;
  createdAt: string;
}

export interface EntityTimelineLink {
  id: string;
  entityId: string;
  kind: "timeline-introduction" | "timeline-presence";
  nodeId: string;
  createdAt: string;
}

export interface EntityRelationshipLink {
  id: string;
  entityId: string;
  kind: "entity-relationship";
  targetEntityId: string;
  relationship: string;
  createdAt: string;
}

export type EntityLink =
  | EntityManuscriptLink
  | EntityTimelineLink
  | EntityRelationshipLink;

export interface CreateWorldModelInput {
  id?: string;
  title: string;
  now?: string;
}

export interface AddTemplateFieldInput {
  key?: string;
  label: string;
  valueType: TemplateFieldType;
  required?: boolean;
  description?: string;
  defaultValue?: TemplateValue;
  options?: string[];
}

export interface AddWorldTemplateInput {
  key?: string;
  name: string;
  description?: string;
  fields: AddTemplateFieldInput[];
  source?: string;
  scrivenerDocumentId?: string;
  scrivenerBinderPath?: string;
  sourceText?: string;
}

export interface InstantiateWorldEntityInput {
  name: string;
  notes?: string;
  fieldValues?: Record<string, TemplateValue>;
}

export interface AddTimelineSpineInput {
  key?: string;
  label: string;
  kind: TimelineSpineKind;
  description?: string;
}

export interface AddTimelineNodeInput {
  label: string;
  summary?: string;
  linkedEntityIds?: string[];
  manuscriptAnchors?: ManuscriptAnchor[];
}

export interface LinkTimelineNodesInput {
  fromNodeId: string;
  toNodeId: string;
  kind: TimelineEdgeKind;
  label?: string;
}

export interface RegisterEntityIntroductionInput {
  entityId: string;
  anchor: ManuscriptAnchor;
  timelineNodeId?: string;
  notes?: string;
}

const DEFAULT_SEQUENCES: WorldSequences = {
  template: 0,
  field: 0,
  entity: 0,
  spine: 0,
  node: 0,
  edge: 0,
  introduction: 0,
  link: 0,
};

export function createWorldModel(input: CreateWorldModelInput): WorldModel {
  const title = nonEmpty(input.title, "World model title");
  const now = resolveNow(input.now);

  return {
    id: input.id ?? "world-0001",
    title,
    createdAt: now,
    updatedAt: now,
    templates: [],
    entities: [],
    spines: [],
    nodes: [],
    edges: [],
    entityLinks: [],
    sequences: { ...DEFAULT_SEQUENCES },
  };
}

export function addWorldTemplate(
  world: WorldModel,
  input: AddWorldTemplateInput,
  now?: string,
): { world: WorldModel; template: WorldTemplate } {
  const name = nonEmpty(input.name, "Template name");
  const key = normalizeKey(input.key ?? input.name);

  if (world.templates.some((template) => template.key === key)) {
    throw new Error(`A template with key '${key}' already exists.`);
  }

  if (input.fields.length === 0) {
    throw new Error("World templates require at least one field.");
  }

  const seenKeys = new Set<string>();
  let fieldSequence = world.sequences.field;
  const fields = input.fields.map((field) => {
    const label = nonEmpty(field.label, "Template field label");
    const fieldKey = normalizeKey(field.key ?? field.label);

    if (seenKeys.has(fieldKey)) {
      throw new Error(`Duplicate template field key '${fieldKey}'.`);
    }

    seenKeys.add(fieldKey);
    validateDefaultValue(field.valueType, field.defaultValue, field.options);
    fieldSequence += 1;

    return {
      id: formatId("field", fieldSequence),
      key: fieldKey,
      label,
      valueType: field.valueType,
      required: field.required ?? false,
      description: field.description?.trim() ?? "",
      defaultValue: cloneTemplateValue(field.defaultValue),
      options: field.options ? [...field.options] : undefined,
    } satisfies TemplateField;
  });

  const timestamp = resolveNow(now);
  const template: WorldTemplate = {
    id: formatId("template", world.sequences.template + 1),
    key,
    name,
    description: input.description?.trim() ?? "",
    fields,
    source: input.source?.trim() || undefined,
    scrivenerDocumentId: input.scrivenerDocumentId?.trim() || undefined,
    scrivenerBinderPath: input.scrivenerBinderPath?.trim() || undefined,
    sourceText: input.sourceText,
    createdAt: timestamp,
  };

  const updated = touch(world, now, {
    templates: [...world.templates, template],
    sequences: {
      ...world.sequences,
      template: world.sequences.template + 1,
      field: fieldSequence,
    },
  });

  return { world: updated, template };
}

export function instantiateWorldEntity(
  world: WorldModel,
  templateId: string,
  input: InstantiateWorldEntityInput,
  now?: string,
): { world: WorldModel; entity: WorldEntity } {
  const template = world.templates.find((candidate) => candidate.id === templateId);

  if (!template) {
    throw new Error(`Unknown template '${templateId}'.`);
  }

  const name = nonEmpty(input.name, "Entity name");
  const providedValues = input.fieldValues ?? {};
  const fields: Record<string, TemplateValue> = {};

  for (const field of template.fields) {
    const provided = providedValues[field.key];
    const resolved =
      provided === undefined ? cloneTemplateValue(field.defaultValue) : cloneTemplateValue(provided);

    if (resolved === undefined && field.required) {
      throw new Error(`Required field '${field.key}' is missing for entity '${name}'.`);
    }

    validateResolvedValue(field, resolved);

    if (resolved !== undefined) {
      fields[field.key] = resolved;
    }
  }

  const timestamp = resolveNow(now);
  const entity: WorldEntity = {
    id: formatId("entity", world.sequences.entity + 1),
    name,
    notes: input.notes?.trim() ?? "",
    fields,
    templateOrigin: {
      templateId: template.id,
      templateKey: template.key,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const updated = touch(world, now, {
    entities: [...world.entities, entity],
    sequences: {
      ...world.sequences,
      entity: world.sequences.entity + 1,
    },
  });

  return { world: updated, entity };
}

export function addTimelineSpine(
  world: WorldModel,
  input: AddTimelineSpineInput,
  now?: string,
): { world: WorldModel; spine: TimelineSpine } {
  const label = nonEmpty(input.label, "Timeline spine label");
  const key = normalizeKey(input.key ?? input.label);

  if (world.spines.some((spine) => spine.key === key)) {
    throw new Error(`A timeline spine with key '${key}' already exists.`);
  }

  const spine: TimelineSpine = {
    id: formatId("spine", world.sequences.spine + 1),
    key,
    label,
    kind: input.kind,
    description: input.description?.trim() ?? "",
    nodeIds: [],
    createdAt: resolveNow(now),
  };

  const updated = touch(world, now, {
    spines: [...world.spines, spine],
    sequences: {
      ...world.sequences,
      spine: world.sequences.spine + 1,
    },
  });

  return { world: updated, spine };
}

export function addTimelineNode(
  world: WorldModel,
  spineId: string,
  input: AddTimelineNodeInput,
  now?: string,
): { world: WorldModel; node: TimelineNode } {
  const spineIndex = world.spines.findIndex((spine) => spine.id === spineId);

  if (spineIndex === -1) {
    throw new Error(`Unknown timeline spine '${spineId}'.`);
  }

  const label = nonEmpty(input.label, "Timeline node label");
  const linkedEntityIds = input.linkedEntityIds ? [...input.linkedEntityIds] : [];

  for (const entityId of linkedEntityIds) {
    ensureEntity(world, entityId);
  }

  const node: TimelineNode = {
    id: formatId("node", world.sequences.node + 1),
    spineId,
    label,
    summary: input.summary?.trim() ?? "",
    order: world.spines[spineIndex].nodeIds.length + 1,
    linkedEntityIds,
    manuscriptAnchors: input.manuscriptAnchors ? [...input.manuscriptAnchors] : [],
    createdAt: resolveNow(now),
  };

  const spines = world.spines.map((spine, index) =>
    index === spineIndex
      ? {
          ...spine,
          nodeIds: [...spine.nodeIds, node.id],
        }
      : spine,
  );

  const updated = touch(world, now, {
    spines,
    nodes: [...world.nodes, node],
    sequences: {
      ...world.sequences,
      node: world.sequences.node + 1,
    },
  });

  return { world: updated, node };
}

export function linkTimelineNodes(
  world: WorldModel,
  input: LinkTimelineNodesInput,
  now?: string,
): { world: WorldModel; edge: TimelineEdge } {
  ensureNode(world, input.fromNodeId);
  ensureNode(world, input.toNodeId);

  if (input.fromNodeId === input.toNodeId) {
    throw new Error("Timeline edges must connect two distinct nodes.");
  }

  const edge: TimelineEdge = {
    id: formatId("edge", world.sequences.edge + 1),
    fromNodeId: input.fromNodeId,
    toNodeId: input.toNodeId,
    kind: input.kind,
    label: input.label?.trim() || undefined,
    createdAt: resolveNow(now),
  };

  const updated = touch(world, now, {
    edges: [...world.edges, edge],
    sequences: {
      ...world.sequences,
      edge: world.sequences.edge + 1,
    },
  });

  return { world: updated, edge };
}

export function registerEntityIntroduction(
  world: WorldModel,
  input: RegisterEntityIntroductionInput,
  now?: string,
): { world: WorldModel; introduction: EntityIntroduction } {
  const entityIndex = world.entities.findIndex((entity) => entity.id === input.entityId);

  if (entityIndex === -1) {
    throw new Error(`Unknown entity '${input.entityId}'.`);
  }

  if (world.entities[entityIndex].introduction) {
    throw new Error(`Entity '${input.entityId}' already has an introduction.`);
  }

  if (input.timelineNodeId) {
    ensureNode(world, input.timelineNodeId);
  }

  const timestamp = resolveNow(now);
  const introduction: EntityIntroduction = {
    id: formatId("introduction", world.sequences.introduction + 1),
    entityId: input.entityId,
    anchor: input.anchor,
    timelineNodeId: input.timelineNodeId,
    notes: input.notes?.trim() || undefined,
    createdAt: timestamp,
  };

  const manuscriptLink: EntityManuscriptLink = {
    id: formatId("link", world.sequences.link + 1),
    entityId: input.entityId,
    kind: "manuscript-reference",
    anchor: input.anchor,
    createdAt: timestamp,
  };

  const timelineLink = input.timelineNodeId
    ? ({
        id: formatId("link", world.sequences.link + 2),
        entityId: input.entityId,
        kind: "timeline-introduction",
        nodeId: input.timelineNodeId,
        createdAt: timestamp,
      } satisfies EntityTimelineLink)
    : undefined;

  const entities = world.entities.map((entity, index) =>
    index === entityIndex
      ? {
          ...entity,
          introduction,
          updatedAt: timestamp,
        }
      : entity,
  );

  const nodes =
    input.timelineNodeId === undefined
      ? world.nodes
      : world.nodes.map((node) =>
          node.id === input.timelineNodeId && !node.linkedEntityIds.includes(input.entityId)
            ? {
                ...node,
                linkedEntityIds: [...node.linkedEntityIds, input.entityId],
              }
            : node,
        );

  const updated = touch(world, now, {
    entities,
    nodes,
    entityLinks: timelineLink
      ? [...world.entityLinks, manuscriptLink, timelineLink]
      : [...world.entityLinks, manuscriptLink],
    sequences: {
      ...world.sequences,
      introduction: world.sequences.introduction + 1,
      link: world.sequences.link + (timelineLink ? 2 : 1),
    },
  });

  return { world: updated, introduction };
}

function ensureEntity(world: WorldModel, entityId: string): WorldEntity {
  const entity = world.entities.find((candidate) => candidate.id === entityId);

  if (!entity) {
    throw new Error(`Unknown entity '${entityId}'.`);
  }

  return entity;
}

function ensureNode(world: WorldModel, nodeId: string): TimelineNode {
  const node = world.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    throw new Error(`Unknown timeline node '${nodeId}'.`);
  }

  return node;
}

function touch(world: WorldModel, now: string | undefined, patch: Partial<WorldModel>): WorldModel {
  return {
    ...world,
    ...patch,
    updatedAt: resolveNow(now),
  };
}

function resolveNow(now?: string): string {
  return now ?? new Date().toISOString();
}

function nonEmpty(value: string, label: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${label} cannot be empty.`);
  }

  return trimmed;
}

function normalizeKey(value: string): string {
  return nonEmpty(value, "Key")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatId(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}

function validateDefaultValue(
  valueType: TemplateFieldType,
  value: TemplateValue | undefined,
  options: string[] | undefined,
): void {
  if (value === undefined) {
    return;
  }

  validateValueType(valueType, value, options);
}

function validateResolvedValue(field: TemplateField, value: TemplateValue | undefined): void {
  if (value === undefined) {
    return;
  }

  validateValueType(field.valueType, value, field.options);
}

function validateValueType(
  valueType: TemplateFieldType,
  value: TemplateValue,
  options: string[] | undefined,
): void {
  if (valueType === "text" && typeof value !== "string") {
    throw new Error("Text fields require string values.");
  }

  if (valueType === "number" && typeof value !== "number") {
    throw new Error("Number fields require numeric values.");
  }

  if (valueType === "boolean" && typeof value !== "boolean") {
    throw new Error("Boolean fields require boolean values.");
  }

  if (valueType === "enum") {
    if (typeof value !== "string") {
      throw new Error("Enum fields require string values.");
    }

    if (!options || options.length === 0) {
      throw new Error("Enum fields require option values.");
    }

    if (!options.includes(value)) {
      throw new Error(`Enum value '${value}' is not in the allowed option list.`);
    }
  }

  if (valueType === "list") {
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
      throw new Error("List fields require an array of strings.");
    }
  }
}

function cloneTemplateValue(value: TemplateValue | undefined): TemplateValue | undefined {
  return Array.isArray(value) ? [...value] : value;
}
