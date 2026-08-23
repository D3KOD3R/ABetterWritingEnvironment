// Intent: own project-level metadata folder records without requiring manuscript anchors.

export const BUILT_IN_METADATA_SUBGROUP_GROUP_IDS = Object.freeze(["inspiration", "research"]);

const CUSTOM_METADATA_GROUP_ID_PATTERN = /^metadata-[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

// Intent: keep group IDs constrained to metadata note panels instead of task or world panels.
export function isSupportedMetadataSubgroupGroupId(groupId = "", supportedGroupIds = []) {
  const normalizedGroupId = normalizeMetadataSubgroupGroupId(groupId);
  if (!normalizedGroupId) {
    return false;
  }

  const supported = normalizeMetadataSubgroupGroupIds(supportedGroupIds);
  if (supported.length) {
    return supported.includes(normalizedGroupId);
  }

  return BUILT_IN_METADATA_SUBGROUP_GROUP_IDS.includes(normalizedGroupId) ||
    CUSTOM_METADATA_GROUP_ID_PATTERN.test(normalizedGroupId);
}

export function normalizeMetadataSubgroupGroupIds(candidate = []) {
  const source = Array.isArray(candidate) ? candidate : [];
  return [...new Set(source
    .map(normalizeMetadataSubgroupGroupId)
    .filter(Boolean))];
}

export function normalizeMetadataSubgroups(candidate = [], supportedGroupIds = []) {
  const source = Array.isArray(candidate) ? candidate : [];
  const normalized = [];
  const usedIds = new Set();

  for (const item of source) {
    const subgroup = normalizeMetadataSubgroupRecord(item, {
      supportedGroupIds,
      usedIds,
      index: normalized.length,
    });
    if (subgroup) {
      normalized.push(subgroup);
    }
  }

  return normalized;
}

export function selectMetadataSubgroupsByGroupId(subgroups = [], groupId = "", supportedGroupIds = []) {
  const normalizedGroupId = normalizeMetadataSubgroupGroupId(groupId);
  return normalizeMetadataSubgroups(subgroups, supportedGroupIds)
    .filter((subgroup) => subgroup.groupId === normalizedGroupId);
}

export function findMetadataSubgroup(subgroups = [], subgroupId = "", supportedGroupIds = []) {
  const normalizedSubgroupId = normalizeMetadataSubgroupId(subgroupId);
  if (!normalizedSubgroupId) {
    return null;
  }

  return findMetadataSubgroupInTree(
    normalizeMetadataSubgroups(subgroups, supportedGroupIds),
    normalizedSubgroupId,
  );
}

export function countMetadataSubgroupNotesByGroup(subgroups = [], supportedGroupIds = []) {
  const counts = {};
  walkMetadataSubgroups(normalizeMetadataSubgroups(subgroups, supportedGroupIds), (subgroup) => {
    counts[subgroup.groupId] = (counts[subgroup.groupId] ?? 0) + subgroup.notes.length;
  });
  return counts;
}

// Intent: create folder records with stable IDs so notes can be edited without a manuscript range.
export function createMetadataSubgroup(input = {}, existingSubgroups = [], supportedGroupIds = [], now = new Date().toISOString()) {
  const normalizedExisting = normalizeMetadataSubgroups(existingSubgroups, supportedGroupIds);
  const parentSubgroupId = normalizeMetadataSubgroupId(input.parentSubgroupId ?? input.parentId);
  const parentSubgroup = parentSubgroupId
    ? findMetadataSubgroupInTree(normalizedExisting, parentSubgroupId)
    : null;
  const groupId = normalizeMetadataSubgroupGroupId(input.groupId ?? input.noteType ?? parentSubgroup?.groupId);

  if (!isSupportedMetadataSubgroupGroupId(groupId, supportedGroupIds)) {
    return {
      subgroup: null,
      subgroups: normalizedExisting,
      error: "group-required",
    };
  }

  if (parentSubgroupId && !parentSubgroup) {
    return {
      subgroup: null,
      subgroups: normalizedExisting,
      error: "parent-folder-not-found",
    };
  }

  const title = normalizeMetadataSubgroupTitle(input.title) || "New folder";
  const usedIds = collectMetadataSubgroupIds(normalizedExisting);
  const subgroup = {
    id: createUniqueSubgroupId(createSubgroupIdFromTitle(title), usedIds),
    groupId,
    title,
    createdAt: now,
    updatedAt: now,
    notes: [],
    folders: [],
  };

  if (!parentSubgroupId) {
    return {
      subgroup,
      subgroups: [...normalizedExisting, subgroup],
      error: "",
    };
  }

  const insertion = mapMetadataSubgroupTree(
    normalizedExisting,
    parentSubgroupId,
    (parent) => ({
      ...parent,
      updatedAt: now,
      folders: [...parent.folders, subgroup],
    }),
    { touchAncestorsAt: now },
  );

  return {
    subgroup,
    subgroups: insertion.subgroups,
    error: insertion.changed ? "" : "parent-folder-not-found",
  };
}

export function updateMetadataSubgroup(subgroups = [], subgroupId = "", patch = {}, supportedGroupIds = [], now = new Date().toISOString()) {
  const normalizedSubgroupId = normalizeMetadataSubgroupId(subgroupId);
  if (!normalizedSubgroupId) {
    return normalizeMetadataSubgroups(subgroups, supportedGroupIds);
  }

  const updated = mapMetadataSubgroupTree(
    normalizeMetadataSubgroups(subgroups, supportedGroupIds),
    normalizedSubgroupId,
    (subgroup) => ({
      ...subgroup,
      title: normalizeMetadataSubgroupTitle(patch.title) || subgroup.title,
      updatedAt: now,
    }),
    { touchAncestorsAt: now },
  );
  return updated.subgroups;
}

export function deleteMetadataSubgroup(subgroups = [], subgroupId = "", supportedGroupIds = []) {
  const normalizedSubgroupId = normalizeMetadataSubgroupId(subgroupId);
  if (!normalizedSubgroupId) {
    return normalizeMetadataSubgroups(subgroups, supportedGroupIds);
  }

  return deleteMetadataSubgroupFromTree(
    normalizeMetadataSubgroups(subgroups, supportedGroupIds),
    normalizedSubgroupId,
  ).subgroups;
}

// Intent: mutate notes inside one metadata folder while preserving project-only notes as valid records.
export function createMetadataSubgroupNote(input = {}, existingSubgroups = [], supportedGroupIds = [], now = new Date().toISOString()) {
  const subgroupId = normalizeMetadataSubgroupId(input.subgroupId);
  const normalizedSubgroups = normalizeMetadataSubgroups(existingSubgroups, supportedGroupIds);
  let createdNote = null;

  const result = mapMetadataSubgroupTree(
    normalizedSubgroups,
    subgroupId,
    (subgroup) => {
      const note = normalizeMetadataSubgroupNote({
        id: input.id || `metadata-folder-note-${createRandomIdSuffix()}`,
        title: input.title || "New note",
        body: input.body ?? "",
        anchor: input.anchor,
        createdAt: now,
        updatedAt: now,
      }, {
        groupId: subgroup.groupId,
        subgroupId: subgroup.id,
        subgroupCreatedAt: subgroup.createdAt,
      });
      createdNote = note;
      return {
        ...subgroup,
        updatedAt: now,
        notes: note ? [...subgroup.notes, note] : subgroup.notes,
      };
    },
    { touchAncestorsAt: now },
  );

  return {
    note: createdNote,
    subgroups: result.subgroups,
    error: createdNote ? "" : "subgroup-not-found",
  };
}

export function updateMetadataSubgroupNote(subgroups = [], subgroupId = "", noteId = "", patch = {}, supportedGroupIds = [], now = new Date().toISOString()) {
  const normalizedSubgroupId = normalizeMetadataSubgroupId(subgroupId);
  const normalizedNoteId = normalizeMetadataSubgroupNoteId(noteId);

  const result = mapMetadataSubgroupTree(
    normalizeMetadataSubgroups(subgroups, supportedGroupIds),
    normalizedSubgroupId,
    (subgroup) => {
      let changed = false;
      const notes = subgroup.notes.map((note) => {
        if (note.id !== normalizedNoteId) {
          return note;
        }

        changed = true;
        return normalizeMetadataSubgroupNote({
          ...note,
          ...patch,
          anchor: Object.prototype.hasOwnProperty.call(patch, "anchor") ? patch.anchor : note.anchor,
          updatedAt: now,
        }, {
          groupId: subgroup.groupId,
          subgroupId: subgroup.id,
          subgroupCreatedAt: subgroup.createdAt,
        });
      });

      return changed
        ? {
            ...subgroup,
            updatedAt: now,
            notes,
          }
        : subgroup;
    },
    { touchAncestorsAt: now },
  );
  return result.subgroups;
}

export function deleteMetadataSubgroupNote(subgroups = [], subgroupId = "", noteId = "", supportedGroupIds = [], now = new Date().toISOString()) {
  const normalizedSubgroupId = normalizeMetadataSubgroupId(subgroupId);
  const normalizedNoteId = normalizeMetadataSubgroupNoteId(noteId);

  const result = mapMetadataSubgroupTree(
    normalizeMetadataSubgroups(subgroups, supportedGroupIds),
    normalizedSubgroupId,
    (subgroup) => {
      const notes = subgroup.notes.filter((note) => note.id !== normalizedNoteId);
      return notes.length === subgroup.notes.length
        ? subgroup
        : {
            ...subgroup,
            updatedAt: now,
            notes,
          };
    },
    { touchAncestorsAt: now },
  );
  return result.subgroups;
}

export function findMetadataSubgroupNote(subgroups = [], subgroupId = "", noteId = "", supportedGroupIds = []) {
  const normalizedSubgroupId = normalizeMetadataSubgroupId(subgroupId);
  const normalizedNoteId = normalizeMetadataSubgroupNoteId(noteId);
  const subgroup = findMetadataSubgroupInTree(
    normalizeMetadataSubgroups(subgroups, supportedGroupIds),
    normalizedSubgroupId,
  );
  return subgroup?.notes.find((note) => note.id === normalizedNoteId) ?? null;
}

export function mergeMetadataSubgroupsById(storedSubgroups = [], seedSubgroups = [], supportedGroupIds = []) {
  const mergedById = new Map();
  for (const subgroup of normalizeMetadataSubgroups(seedSubgroups, supportedGroupIds)) {
    mergedById.set(subgroup.id, cloneValue(subgroup));
  }
  for (const subgroup of normalizeMetadataSubgroups(storedSubgroups, supportedGroupIds)) {
    mergedById.set(subgroup.id, cloneValue(subgroup));
  }
  return [...mergedById.values()];
}

export function createMetadataSubgroupNoteInputFromPassageNote(passageNote = {}, subgroupId = "") {
  const normalizedSubgroupId = normalizeMetadataSubgroupId(subgroupId);
  if (!normalizedSubgroupId || !passageNote || typeof passageNote !== "object") {
    return null;
  }

  const anchor = normalizeMetadataSubgroupNoteAnchor({
    sceneId: passageNote.sceneId,
    sceneTitle: passageNote.sceneTitle,
    chapterId: passageNote.chapterId,
    chapterTitle: passageNote.chapterTitle,
    selectedText: passageNote.selectedText,
    startOffset: passageNote.startOffset,
    endOffset: passageNote.endOffset,
    createdAt: passageNote.createdAt,
  });
  return {
    subgroupId: normalizedSubgroupId,
    title: normalizeMetadataSubgroupTitle(passageNote.title) || "Moved note",
    body: String(passageNote.body ?? ""),
    anchor,
  };
}

function normalizeMetadataSubgroupRecord(item, {
  supportedGroupIds = [],
  usedIds = new Set(),
  parentGroupId = "",
  index = 0,
} = {}) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const groupId = normalizeMetadataSubgroupGroupId(item.groupId ?? item.noteType ?? parentGroupId);
  if (!isSupportedMetadataSubgroupGroupId(groupId, supportedGroupIds)) {
    return null;
  }

  const id = createUniqueSubgroupId(
    normalizeMetadataSubgroupId(item.id) || createSubgroupIdFromTitle(item.title || `folder-${index + 1}`),
    usedIds,
  );
  usedIds.add(id);
  const createdAt = normalizeTimestamp(item.createdAt);
  const updatedAt = normalizeTimestamp(item.updatedAt);
  return {
    id,
    groupId,
    title: normalizeMetadataSubgroupTitle(item.title) || "Notes",
    createdAt,
    updatedAt,
    notes: normalizeMetadataSubgroupNotes(item.notes, {
      groupId,
      subgroupId: id,
      subgroupCreatedAt: createdAt,
    }),
    folders: normalizeMetadataSubgroupChildren(item, {
      supportedGroupIds,
      usedIds,
      parentGroupId: groupId,
    }),
  };
}

function normalizeMetadataSubgroupChildren(item, context = {}) {
  const source = Array.isArray(item?.folders)
    ? item.folders
    : Array.isArray(item?.subgroups)
      ? item.subgroups
      : Array.isArray(item?.children)
        ? item.children
        : [];
  const folders = [];
  for (const child of source) {
    const normalized = normalizeMetadataSubgroupRecord(child, {
      ...context,
      index: folders.length,
    });
    if (normalized) {
      folders.push(normalized);
    }
  }
  return folders;
}

function normalizeMetadataSubgroupNotes(candidate = [], context = {}) {
  const source = Array.isArray(candidate) ? candidate : [];
  const notes = [];
  const usedIds = new Set();

  for (const note of source) {
    const normalized = normalizeMetadataSubgroupNote(note, context);
    if (!normalized) {
      continue;
    }

    normalized.id = createUniqueNoteId(normalized.id, usedIds);
    usedIds.add(normalized.id);
    notes.push(normalized);
  }

  return notes;
}

function normalizeMetadataSubgroupNote(note, context = {}) {
  if (!note || typeof note !== "object") {
    return null;
  }

  const id = normalizeMetadataSubgroupNoteId(note.id) || `metadata-folder-note-${createRandomIdSuffix()}`;
  const title = normalizeMetadataSubgroupTitle(note.title) || "Note";
  const body = String(note.body ?? "");
  return {
    id,
    title,
    body,
    createdAt: normalizeTimestamp(note.createdAt) || context.subgroupCreatedAt || "",
    updatedAt: normalizeTimestamp(note.updatedAt),
    anchor: normalizeMetadataSubgroupNoteAnchor(note.anchor ?? note.manuscriptAnchor),
  };
}

export function normalizeMetadataSubgroupNoteAnchor(candidate = null) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const sceneId = normalizeMetadataText(candidate.sceneId);
  const selectedText = String(candidate.selectedText ?? "").trim();
  const startOffset = Number(candidate.startOffset);
  const endOffset = Number(candidate.endOffset);
  if (!sceneId || !selectedText || !Number.isInteger(startOffset) || !Number.isInteger(endOffset) || endOffset <= startOffset) {
    return null;
  }

  return {
    sceneId,
    sceneTitle: normalizeMetadataText(candidate.sceneTitle),
    chapterId: normalizeMetadataText(candidate.chapterId),
    chapterTitle: normalizeMetadataText(candidate.chapterTitle),
    selectedText,
    startOffset,
    endOffset,
    createdAt: normalizeTimestamp(candidate.createdAt),
  };
}

function mapMetadataSubgroupTree(subgroups = [], subgroupId = "", updater = null, {
  touchAncestorsAt = "",
} = {}) {
  let changed = false;
  const nextSubgroups = subgroups.map((subgroup) => {
    if (subgroup.id === subgroupId && typeof updater === "function") {
      changed = true;
      return updater(subgroup);
    }

    const nested = mapMetadataSubgroupTree(subgroup.folders, subgroupId, updater, {
      touchAncestorsAt,
    });
    if (!nested.changed) {
      return subgroup;
    }

    changed = true;
    return {
      ...subgroup,
      updatedAt: touchAncestorsAt || subgroup.updatedAt,
      folders: nested.subgroups,
    };
  });

  return {
    subgroups: nextSubgroups,
    changed,
  };
}

function deleteMetadataSubgroupFromTree(subgroups = [], subgroupId = "") {
  let removed = false;
  const nextSubgroups = [];
  for (const subgroup of subgroups) {
    if (subgroup.id === subgroupId) {
      removed = true;
      continue;
    }

    const nested = deleteMetadataSubgroupFromTree(subgroup.folders, subgroupId);
    if (nested.removed) {
      removed = true;
      nextSubgroups.push({
        ...subgroup,
        folders: nested.subgroups,
      });
      continue;
    }

    nextSubgroups.push(subgroup);
  }

  return {
    subgroups: nextSubgroups,
    removed,
  };
}

function findMetadataSubgroupInTree(subgroups = [], subgroupId = "") {
  for (const subgroup of subgroups) {
    if (subgroup.id === subgroupId) {
      return subgroup;
    }

    const nested = findMetadataSubgroupInTree(subgroup.folders, subgroupId);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function walkMetadataSubgroups(subgroups = [], visitor = null) {
  for (const subgroup of subgroups) {
    if (typeof visitor === "function") {
      visitor(subgroup);
    }
    walkMetadataSubgroups(subgroup.folders, visitor);
  }
}

function collectMetadataSubgroupIds(subgroups = []) {
  const ids = new Set();
  walkMetadataSubgroups(subgroups, (subgroup) => {
    ids.add(subgroup.id);
  });
  return ids;
}

function normalizeMetadataSubgroupGroupId(value) {
  return normalizeMetadataText(value);
}

function normalizeMetadataSubgroupId(value) {
  const normalized = normalizeMetadataText(value);
  return /^metadata-(?:folder|subgroup)-[a-z0-9-]+$/.test(normalized) ? normalized : "";
}

function normalizeMetadataSubgroupNoteId(value) {
  const normalized = normalizeMetadataText(value);
  return /^metadata-(?:folder|subgroup)-note-[a-z0-9-]+$/.test(normalized) ? normalized : "";
}

function normalizeMetadataSubgroupTitle(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
}

function normalizeMetadataText(value) {
  return String(value ?? "").trim();
}

function normalizeTimestamp(value) {
  return typeof value === "string" && value.trim() ? value : "";
}

function createSubgroupIdFromTitle(title) {
  const slug = normalizeMetadataSubgroupTitle(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `metadata-folder-${slug || createRandomIdSuffix()}`;
}

function createUniqueSubgroupId(baseId, usedIds) {
  const fallback = normalizeMetadataSubgroupId(baseId) || `metadata-folder-${createRandomIdSuffix()}`;
  let id = fallback;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${fallback.slice(0, Math.max("metadata-folder-x".length, 56 - String(suffix).length))}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function createUniqueNoteId(baseId, usedIds) {
  const fallback = normalizeMetadataSubgroupNoteId(baseId) || `metadata-folder-note-${createRandomIdSuffix()}`;
  let id = fallback;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${fallback.slice(0, Math.max("metadata-folder-note-x".length, 61 - String(suffix).length))}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function createRandomIdSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
