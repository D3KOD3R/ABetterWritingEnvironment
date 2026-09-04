// Intent: import Scrivener project packages into the app's canonical local-first project shape.

import { normalizeMetadataNoteTitle } from "../../shared/metadata-note-title.js";

const TEXT_EXTENSIONS = new Set([".rtf", ".txt", ".md", ".markdown", ".html", ".htm"]);
const SCRIVENER_COMMENTS_METADATA_GROUP_ID = "metadata-comments-and-footnotes";
const SCRIVENER_COMMENTS_METADATA_LABEL = "Comments and Footnotes";
const SCRIVENER_COMMENTS_METADATA_HIGHLIGHT_COLOR = "#ffd166";
const SCRIVENER_PROJECT_PREFERENCES_PATH = "settings/projectpreferences.xml";
const SCRIVENER_WORLDBUILDING_CATEGORY_ALIASES = Object.freeze([
  {
    categoryId: "character",
    categoryLabel: "Character",
    templateName: "Character",
    patterns: [/\bcharacters?\b/i, /\bpeople\b/i, /\bcast\b/i, /\bcrew\b/i, /\bperson\b/i],
  },
  {
    categoryId: "faction",
    categoryLabel: "Faction",
    templateName: "Faction",
    patterns: [/\bfactions?\b/i, /\borganizations?\b/i, /\borganisations?\b/i, /\borders?\b/i, /\bgovernments?\b/i],
  },
  {
    categoryId: "culture",
    categoryLabel: "Culture",
    templateName: "Culture",
    patterns: [/\bcultures?\b/i, /\breligions?\b/i, /\bsocieties?\b/i],
  },
  {
    categoryId: "planet",
    categoryLabel: "Planet",
    templateName: "Planet",
    patterns: [/\bplanets?\b/i, /\bmoons?\b/i, /\bworlds?\b/i],
  },
  {
    categoryId: "location",
    categoryLabel: "Location",
    templateName: "Location",
    patterns: [/\blocations?\b/i, /\bplaces?\b/i, /\bstations?\b/i, /\bfacilit(?:y|ies)\b/i, /\bcities\b/i, /\bregions?\b/i, /\bsettlements?\b/i],
  },
  {
    categoryId: "flora",
    categoryLabel: "Flora",
    templateName: "Flora",
    patterns: [/\bfloras?\b/i, /\bplants?\b/i, /\bfung(?:us|i)\b/i, /\bbotany\b/i],
  },
  {
    categoryId: "fauna",
    categoryLabel: "Fauna",
    templateName: "Fauna",
    patterns: [/\bfaunas?\b/i, /\bcreatures?\b/i, /\banimals?\b/i, /\bspecies\b/i, /\bbeasts?\b/i],
  },
  {
    categoryId: "weapon",
    categoryLabel: "Weapon",
    templateName: "Weapon",
    patterns: [/\bweapons?\b/i, /\brifles?\b/i, /\bguns?\b/i, /\bordnance\b/i],
  },
  {
    categoryId: "outfit",
    categoryLabel: "Outfit",
    templateName: "Outfit",
    patterns: [/\boutfits?\b/i, /\bsuits?\b/i, /\barmou?r\b/i, /\bclothing\b/i, /\buniforms?\b/i],
  },
  {
    categoryId: "technology",
    categoryLabel: "Technology",
    templateName: "Technology",
    patterns: [/\btechnolog(?:y|ies)\b/i, /\bdevices?\b/i, /\bsystems?\b/i, /\bengines?\b/i, /\bgates?\b/i, /\btools?\b/i],
  },
  {
    categoryId: "vehicle",
    categoryLabel: "Vehicle",
    templateName: "Vehicle",
    patterns: [/\bvehicles?\b/i, /\bships?\b/i, /\bvessels?\b/i, /\brovers?\b/i, /\bcraft\b/i, /\bshuttles?\b/i],
  },
  {
    categoryId: "artifact",
    categoryLabel: "Artifact",
    templateName: "Artifact",
    patterns: [/\bartifacts?\b/i, /\bartefacts?\b/i, /\brelics?\b/i, /\bkeys?\b/i, /\bdocuments?\b/i],
  },
]);
const SKIPPED_RTF_DESTINATIONS = new Set([
  "fonttbl",
  "colortbl",
  "stylesheet",
  "info",
  "pict",
  "object",
  "header",
  "footer",
  "generator",
]);

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizePath(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
}

function getPathFileName(pathValue) {
  return normalizePath(pathValue).split("/").filter(Boolean).at(-1) ?? "";
}

function getPathExtension(pathValue) {
  const fileName = getPathFileName(pathValue).toLowerCase();
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex) : "";
}

function stripFileExtension(fileName) {
  return String(fileName ?? "").replace(/\.[^.]+$/, "");
}

function createSlug(value, fallback = "imported") {
  const slug = String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || fallback;
}

function countWords(text) {
  const value = String(text ?? "").trim();
  return value ? value.split(/\s+/).filter(Boolean).length : 0;
}

function createIdSequence(prefix) {
  let index = 0;
  return () => {
    index += 1;
    return `${prefix}-${String(index).padStart(4, "0")}`;
  };
}

function createImportTimestamp(options = {}) {
  return typeof options.now === "string" && options.now.trim()
    ? options.now
    : new Date().toISOString();
}

function normalizeScrivenerFileEntry(entry) {
  if (!entry) {
    return null;
  }

  const fileName = typeof entry.name === "string" && entry.name.trim()
    ? entry.name.trim()
    : getPathFileName(entry.path ?? entry.relativePath ?? entry.webkitRelativePath);
  const pathValue = normalizePath(entry.path ?? entry.relativePath ?? entry.webkitRelativePath ?? fileName);
  if (!fileName || !pathValue) {
    return null;
  }

  return {
    file: entry.file ?? entry,
    name: fileName,
    path: pathValue,
    size: Number.isFinite(Number(entry.size)) ? Number(entry.size) : Number(entry.file?.size) || 0,
    type: typeof entry.type === "string" ? entry.type : typeof entry.file?.type === "string" ? entry.file.type : "",
    lastModified: Number.isFinite(Number(entry.lastModified))
      ? Number(entry.lastModified)
      : Number.isFinite(Number(entry.file?.lastModified))
        ? Number(entry.file.lastModified)
        : null,
  };
}

async function readEntryText(entry) {
  if (!entry) {
    return "";
  }

  if (typeof entry.text === "function") {
    return entry.text();
  }

  if (entry.file && typeof entry.file.text === "function") {
    return entry.file.text();
  }

  if (typeof entry.content === "string") {
    return entry.content;
  }

  return "";
}

function createScrivenerXmlParseError(message) {
  return new Error(`Scrivener project file could not be parsed: ${message}`);
}

function decodeXmlEntities(value) {
  return String(value ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseXmlAttributes(rawAttributes = "") {
  const attributes = {};
  const attributePattern = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match = attributePattern.exec(rawAttributes);
  while (match) {
    attributes[match[1]] = decodeXmlEntities(match[3] ?? match[4] ?? "");
    match = attributePattern.exec(rawAttributes);
  }
  return attributes;
}

// Intent: provide a small XML reader that works in browser and Node tests without adding a dependency.
export function parseScrivenerXml(xmlText) {
  const source = String(xmlText ?? "").replace(/^\uFEFF/, "");
  const root = {
    name: "#document",
    attributes: {},
    children: [],
  };
  const stack = [root];
  const tokenPattern = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<\/?[^>]+>|[^<]+/g;
  let tokenMatch = tokenPattern.exec(source);

  while (tokenMatch) {
    const token = tokenMatch[0];
    const current = stack.at(-1);
    if (token.startsWith("<!--") || token.startsWith("<?") || token.startsWith("<!DOCTYPE")) {
      tokenMatch = tokenPattern.exec(source);
      continue;
    }

    if (token.startsWith("<![CDATA[")) {
      current.children.push({
        name: "#text",
        text: token.slice(9, -3),
        children: [],
        attributes: {},
      });
      tokenMatch = tokenPattern.exec(source);
      continue;
    }

    if (token.startsWith("</")) {
      const closeName = token.slice(2, -1).trim().split(/\s+/)[0];
      const open = stack.pop();
      if (!open || localName(open.name).toLowerCase() !== localName(closeName).toLowerCase()) {
        throw createScrivenerXmlParseError(`unexpected closing tag ${closeName || "(blank)"}`);
      }
      tokenMatch = tokenPattern.exec(source);
      continue;
    }

    if (token.startsWith("<")) {
      const selfClosing = /\/\s*>$/.test(token);
      const tagBody = token.slice(1, selfClosing ? token.replace(/\/\s*>$/, "").length : -1).trim();
      const nameMatch = /^([^\s/>]+)/.exec(tagBody);
      if (!nameMatch) {
        tokenMatch = tokenPattern.exec(source);
        continue;
      }

      const name = nameMatch[1];
      const attributes = parseXmlAttributes(tagBody.slice(name.length));
      const node = {
        name,
        attributes,
        children: [],
      };
      current.children.push(node);
      if (!selfClosing) {
        stack.push(node);
      }
      tokenMatch = tokenPattern.exec(source);
      continue;
    }

    current.children.push({
      name: "#text",
      text: decodeXmlEntities(token),
      children: [],
      attributes: {},
    });
    tokenMatch = tokenPattern.exec(source);
  }

  if (stack.length !== 1) {
    throw createScrivenerXmlParseError(`unclosed tag ${stack.at(-1)?.name ?? "(blank)"}`);
  }

  return root;
}

function localName(name) {
  return String(name ?? "").split(":").at(-1) ?? "";
}

function nodeNameEquals(node, name) {
  return localName(node?.name).toLowerCase() === String(name ?? "").toLowerCase();
}

function childElements(node) {
  return Array.isArray(node?.children)
    ? node.children.filter((child) => child?.name !== "#text")
    : [];
}

function findChild(node, names = []) {
  const normalizedNames = new Set(names.map((name) => String(name).toLowerCase()));
  return childElements(node).find((child) => normalizedNames.has(localName(child.name).toLowerCase())) ?? null;
}

function findDescendants(node, names = [], results = []) {
  const normalizedNames = new Set(names.map((name) => String(name).toLowerCase()));
  for (const child of childElements(node)) {
    if (normalizedNames.has(localName(child.name).toLowerCase())) {
      results.push(child);
    }
    findDescendants(child, names, results);
  }
  return results;
}

function getNodeText(node) {
  if (!node) {
    return "";
  }

  let text = "";
  for (const child of Array.isArray(node.children) ? node.children : []) {
    if (child.name === "#text") {
      text += child.text ?? "";
    } else {
      const nestedText = getNodeText(child);
      if (nestedText) {
        text += text ? ` ${nestedText}` : nestedText;
      }
    }
  }
  return normalizeString(text);
}

function getNodeRawText(node) {
  if (!node) {
    return "";
  }

  let text = "";
  for (const child of Array.isArray(node.children) ? node.children : []) {
    if (child.name === "#text") {
      text += child.text ?? "";
    } else {
      text += getNodeRawText(child);
    }
  }
  return text;
}

function getChildText(node, names = []) {
  const child = findChild(node, names);
  return getNodeText(child);
}

function getAttribute(node, names = []) {
  const attributes = node?.attributes && typeof node.attributes === "object" ? node.attributes : {};
  const wanted = names.map((name) => String(name).toLowerCase());
  for (const [key, value] of Object.entries(attributes)) {
    if (wanted.includes(key.toLowerCase())) {
      return String(value ?? "").trim();
    }
  }
  return "";
}

function flattenElementMetadata(node, depth = 0) {
  if (!node || depth > 6) {
    return null;
  }

  const elements = childElements(node);
  if (!elements.length) {
    return getNodeText(node);
  }

  const record = {};
  for (const [key, value] of Object.entries(node.attributes ?? {})) {
    record[`@${key}`] = value;
  }

  for (const child of elements) {
    const key = localName(child.name);
    const value = flattenElementMetadata(child, depth + 1);
    if (value === null || value === "" || value === undefined) {
      continue;
    }

    if (Object.hasOwn(record, key)) {
      record[key] = Array.isArray(record[key]) ? [...record[key], value] : [record[key], value];
    } else {
      record[key] = value;
    }
  }

  const text = getNodeText(node);
  if (text && !Object.keys(record).length) {
    return text;
  }
  return record;
}

function collectCustomMetadataDefinitions(xmlRoot) {
  const definitions = new Map();
  const candidateNodes = findDescendants(xmlRoot, [
    "MetaDataField",
    "MetadataField",
    "CustomMetaDataField",
    "CustomMetadataField",
  ]);

  for (const node of candidateNodes) {
    const fieldId = getAttribute(node, ["ID", "Id", "FieldID", "FieldId", "UUID", "Key"]) ||
      getChildText(node, ["ID", "FieldID", "UUID", "Key"]);
    const label = getAttribute(node, ["Name", "Title", "Label"]) ||
      getChildText(node, ["Name", "Title", "Label"]);
    if (!fieldId || !label) {
      continue;
    }

    definitions.set(fieldId, {
      sourceId: fieldId,
      label,
      id: `metadata-${createSlug(label, "scrivener-field")}`,
      highlightColor: pickMetadataColor(definitions.size),
    });
  }

  return definitions;
}

function pickMetadataColor(index) {
  const colors = ["#8bd3c7", "#ffd166", "#7fb7ff", "#ef9a9a", "#b7a6ff", "#9bd67d", "#f4a261"];
  return colors[Math.max(0, index) % colors.length];
}

function extractCustomMetadataValues(node, definitionMap) {
  const values = {};
  const rawValues = [];
  const itemNodes = findDescendants(node, ["MetaDataItem", "MetadataItem", "CustomMetaDataItem", "CustomMetadataItem"]);

  for (const itemNode of itemNodes) {
    const fieldId = getAttribute(itemNode, ["FieldID", "FieldId", "ID", "Id", "Key", "Name"]) ||
      getChildText(itemNode, ["FieldID", "ID", "Key"]);
    const explicitLabel = getAttribute(itemNode, ["Label", "Title", "Name"]) ||
      getChildText(itemNode, ["Label", "Title", "Name"]);
    const value = getChildText(itemNode, ["Value", "Text", "String"]) || getNodeText(itemNode);
    if (!fieldId || !value) {
      continue;
    }

    const definition = definitionMap.get(fieldId) ?? {
      sourceId: fieldId,
      label: explicitLabel || fieldId,
      id: `metadata-${createSlug(explicitLabel || fieldId, "scrivener-field")}`,
      highlightColor: pickMetadataColor(definitionMap.size),
    };
    if (!definitionMap.has(fieldId)) {
      definitionMap.set(fieldId, definition);
    }

    values[definition.id] = value;
    rawValues.push({
      fieldId,
      label: definition.label,
      value,
    });
  }

  return {
    values,
    rawValues,
  };
}

function extractKeywordValues(node) {
  const keywords = [];
  const keywordNodes = findDescendants(node, ["Keyword", "KeyWord"]);
  for (const keywordNode of keywordNodes) {
    const keyword = getAttribute(keywordNode, ["Title", "Name"]) || getNodeText(keywordNode);
    if (keyword && !keywords.includes(keyword)) {
      keywords.push(keyword);
    }
  }
  return keywords;
}

function extractBinderItemMetadata(node, definitionMap) {
  const metadataNode = findChild(node, ["MetaData", "Metadata"]) ?? node;
  const custom = extractCustomMetadataValues(metadataNode, definitionMap);
  const label = getChildText(metadataNode, ["Label", "LabelID", "LabelId"]) || getAttribute(metadataNode, ["Label", "LabelID"]);
  const status = getChildText(metadataNode, ["Status", "StatusID", "StatusId"]) || getAttribute(metadataNode, ["Status", "StatusID"]);
  const synopsis = getChildText(metadataNode, ["Synopsis", "Synopses"]) || getChildText(node, ["Synopsis"]);
  const notes = getChildText(metadataNode, ["Notes", "DocumentNotes", "ProjectNotes"]) || getChildText(node, ["Notes"]);
  const includeInCompileText = getChildText(metadataNode, ["IncludeInCompile", "Compile"]) ||
    getAttribute(metadataNode, ["IncludeInCompile", "Compile"]);

  return {
    synopsis,
    notes,
    label,
    status,
    keywords: extractKeywordValues(metadataNode),
    includeInCompile: normalizeBoolean(includeInCompileText),
    customMetadata: custom.values,
    rawCustomMetadata: custom.rawValues,
    raw: flattenElementMetadata(metadataNode),
  };
}

function normalizeBoolean(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["yes", "true", "1"].includes(normalized)) {
    return true;
  }
  if (["no", "false", "0"].includes(normalized)) {
    return false;
  }
  return null;
}

function parseBinderItemNode(node, definitionMap, parentPath = []) {
  const uuid = getAttribute(node, ["UUID", "Uuid", "ID", "Id"]) || getChildText(node, ["UUID", "ID"]);
  const title = getChildText(node, ["Title", "Name"]) || getAttribute(node, ["Title", "Name"]) || "Untitled";
  const type = getChildText(node, ["Type"]) || getAttribute(node, ["Type", "Kind"]) || "";
  const childrenContainer = findChild(node, ["Children"]) ?? node;
  const children = childElements(childrenContainer)
    .filter((child) => nodeNameEquals(child, "BinderItem"))
    .map((child) => parseBinderItemNode(child, definitionMap, [...parentPath, title]));

  return {
    uuid,
    title,
    type,
    binderPath: [...parentPath, title],
    metadata: extractBinderItemMetadata(node, definitionMap),
    children,
  };
}

function parseScrivenerBinder(xmlRoot, definitionMap) {
  const binder = findDescendants(xmlRoot, ["Binder"])[0] ?? xmlRoot;
  const rootItems = childElements(binder)
    .filter((child) => nodeNameEquals(child, "BinderItem"))
    .map((child) => parseBinderItemNode(child, definitionMap, []));
  if (rootItems.length) {
    return rootItems;
  }

  return findDescendants(xmlRoot, ["BinderItem"])
    .filter((itemNode) => !findDescendants(itemNode, ["BinderItem"]).includes(itemNode))
    .map((itemNode) => parseBinderItemNode(itemNode, definitionMap, []));
}

function findDraftRoot(items = []) {
  const queue = [...items];
  while (queue.length) {
    const item = queue.shift();
    const type = String(item?.type ?? "").toLowerCase();
    const title = String(item?.title ?? "").toLowerCase();
    if (type.includes("draft") || title === "draft" || title === "manuscript") {
      return item;
    }
    queue.push(...(item?.children ?? []));
  }
  return null;
}

function isTrashItem(item) {
  const type = String(item?.type ?? "").toLowerCase();
  const title = String(item?.title ?? "").toLowerCase();
  return type.includes("trash") || title === "trash";
}

function isFolderLike(item) {
  const type = String(item?.type ?? "").toLowerCase();
  return type.includes("folder") || Boolean(item?.children?.length);
}

function collectManuscriptItems(items, contentByUuid) {
  const draftRoot = findDraftRoot(items);
  const manuscriptRoots = draftRoot ? draftRoot.children : items.filter((item) => !isTrashItem(item));
  const records = [];

  function visit(item, chapterStack = [], depth = 0) {
    if (!item || isTrashItem(item)) {
      return;
    }

    const hasContent = Boolean(findContentForBinderItem(item, contentByUuid));
    const folderLike = isFolderLike(item);
    const nextChapterStack = folderLike && !hasContent
      ? [...chapterStack, item]
      : chapterStack;

    if (hasContent) {
      records.push({
        item,
        depth,
        chapterStack,
      });
    }

    const childStack = folderLike
      ? [...chapterStack, item]
      : chapterStack;
    for (const child of item.children ?? []) {
      visit(child, childStack, depth + 1);
    }

    if (!draftRoot && !hasContent && !item.children?.length && !folderLike && depth === 0) {
      records.push({
        item,
        depth,
        chapterStack: nextChapterStack,
      });
    }
  }

  for (const root of manuscriptRoots) {
    visit(root, [], 0);
  }

  return records;
}

function flattenBinderItems(items = [], records = []) {
  for (const item of items) {
    records.push(item);
    flattenBinderItems(item.children ?? [], records);
  }
  return records;
}

// Intent: promote recognized Scrivener Research/WorldBuilding reference documents into structured catalogue records.
async function collectWorldbuildingReferenceEntities(items, contentLookup, manuscriptItems, now) {
  const manuscriptItemIds = new Set(
    (Array.isArray(manuscriptItems) ? manuscriptItems : [])
      .map((record) => normalizeString(record?.item?.uuid).toLowerCase())
      .filter(Boolean),
  );
  const usedIds = new Set();
  const entities = [];
  const sourceRecords = [];

  for (const item of flattenBinderItems(items)) {
    const uuid = normalizeString(item?.uuid);
    if (!item || isTrashItem(item) || !uuid || manuscriptItemIds.has(uuid.toLowerCase()) || item.children?.length) {
      continue;
    }

    const category = resolveScrivenerWorldbuildingReferenceCategory(item);
    if (!category) {
      continue;
    }

    const contentEntry = findContentForBinderItem(item, contentLookup);
    if (!contentEntry) {
      continue;
    }

    const text = await readContentText(contentEntry);
    if (!normalizeString(text)) {
      continue;
    }

    entities.push(createWorldbuildingEntityFromScrivenerReference({
      item,
      contentEntry,
      text,
      category,
      now,
      usedIds,
    }));
    sourceRecords.push(buildSourceArchiveRecord(item, contentEntry, text));
  }

  return {
    entities,
    sourceRecords,
  };
}

function resolveScrivenerWorldbuildingReferenceCategory(item) {
  const pathSegments = Array.isArray(item?.binderPath)
    ? item.binderPath.map(normalizeString).filter(Boolean)
    : [];
  const pathText = pathSegments.join(" / ");
  const lowerPath = pathText.toLowerCase();
  if (!/(worldbuilding|world building|research|reference|references)/i.test(pathText)) {
    return null;
  }
  if (/(template sheets?|front matter|trash|sample output|compile)/i.test(pathText)) {
    return null;
  }

  const categorySource = [
    ...pathSegments.slice(0, -1),
    item?.type,
    item?.title,
  ].join(" ");
  const matched = SCRIVENER_WORLDBUILDING_CATEGORY_ALIASES.find((alias) =>
    alias.patterns.some((pattern) => pattern.test(categorySource))
  );
  if (!matched) {
    return null;
  }

  const categoryPathSegment = pathSegments
    .slice(0, -1)
    .reverse()
    .find((segment) => matched.patterns.some((pattern) => pattern.test(segment)));
  return {
    ...matched,
    sourceCategoryLabel: categoryPathSegment || matched.templateName,
    sourcePath: pathText,
    isResearchRoot: lowerPath.includes("research") || lowerPath.includes("reference"),
  };
}

function createWorldbuildingEntityFromScrivenerReference({
  item,
  contentEntry,
  text,
  category,
  now,
  usedIds,
}) {
  const title = normalizeString(item?.title) || firstNonEmptyTextLine(text) || "Reference Item";
  const id = createUniqueReferenceEntityId(item?.uuid || title, usedIds);
  const extractedFields = extractScrivenerReferenceFields(text);
  return {
    id,
    name: title,
    templateName: category.templateName,
    categoryId: category.categoryId,
    categoryLabel: category.categoryLabel,
    notes: text,
    fields: [
      {
        key: "category",
        label: "Category",
        value: category.sourceCategoryLabel,
      },
      ...extractedFields,
    ],
    source: "scrivener-reference",
    sourceDocumentId: normalizeString(item?.uuid),
    sourcePath: category.sourcePath,
    sourceContentFilePath: contentEntry?.path ?? "",
    createdAt: now,
    updatedAt: now,
    scrivenerMetadata: {
      uuid: item?.uuid,
      type: item?.type,
      binderPath: item?.binderPath,
      contentFilePath: contentEntry?.path ?? "",
      label: item?.metadata?.label,
      status: item?.metadata?.status,
      keywords: item?.metadata?.keywords,
      includeInCompile: item?.metadata?.includeInCompile,
    },
  };
}

function extractScrivenerReferenceFields(text) {
  const usedKeys = new Set(["category"]);
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.match(/^([^:]{2,48}):\s*(.+)$/))
    .filter(Boolean)
    .map((match) => {
      const label = normalizeString(match[1]);
      const value = normalizeString(match[2]);
      const key = createSlug(label, "field");
      if (!key || !label || !value || usedKeys.has(key)) {
        return null;
      }
      usedKeys.add(key);
      return {
        key,
        label,
        value,
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

function firstNonEmptyTextLine(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? "";
}

function createUniqueReferenceEntityId(value, usedIds) {
  const base = `scrivener-reference-${createSlug(value, "item")}`;
  if (!usedIds.has(base)) {
    usedIds.add(base);
    return base;
  }

  let suffix = 2;
  while (usedIds.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  const id = `${base}-${suffix}`;
  usedIds.add(id);
  return id;
}

function buildContentLookup(entries) {
  const textEntries = entries.filter((entry) => TEXT_EXTENSIONS.has(getPathExtension(entry.path)));
  const commentEntries = entries.filter((entry) => getPathFileName(entry.path).toLowerCase() === "content.comments");
  return {
    entries: textEntries,
    commentEntries,
    byLowerPath: new Map([...textEntries, ...commentEntries].map((entry) => [entry.path.toLowerCase(), entry])),
  };
}

function findEntryByScrivenerRelativePath(contentLookup, relativePath) {
  const normalizedRelativePath = normalizePath(relativePath).toLowerCase();
  if (!normalizedRelativePath) {
    return null;
  }

  return contentLookup.byLowerPath.get(normalizedRelativePath) ??
    [...contentLookup.byLowerPath.entries()]
      .find(([path]) => path.endsWith(`/${normalizedRelativePath}`))?.[1] ??
    null;
}

function findContentForBinderItem(item, contentLookup) {
  const uuid = String(item?.uuid ?? "").trim();
  if (!uuid) {
    return null;
  }

  const normalizedUuid = uuid.toLowerCase();
  const exactCandidates = [
    `files/data/${normalizedUuid}/content.rtf`,
    `files/data/${normalizedUuid}/content.txt`,
    `files/data/${normalizedUuid}/content.md`,
    `files/docs/${normalizedUuid}.rtf`,
    `files/docs/${normalizedUuid}.txt`,
    `files/docs/${normalizedUuid}.md`,
  ];

  for (const candidate of exactCandidates) {
    const entry = findEntryByScrivenerRelativePath(contentLookup, candidate);
    if (entry) {
      return entry;
    }
  }

  return contentLookup.entries.find((entry) => {
    const path = entry.path.toLowerCase();
    const fileName = getPathFileName(path).toLowerCase();
    return path.includes(`/${normalizedUuid}/content.`) ||
      path.endsWith(`/docs/${normalizedUuid}${getPathExtension(path)}`) ||
      fileName === `${normalizedUuid}${getPathExtension(path)}`;
  }) ?? null;
}

function findCommentSidecarForBinderItem(item, contentLookup) {
  const uuid = String(item?.uuid ?? "").trim();
  if (!uuid) {
    return null;
  }

  const normalizedUuid = uuid.toLowerCase();
  const exactEntry = findEntryByScrivenerRelativePath(
    contentLookup,
    `files/data/${normalizedUuid}/content.comments`,
  );
  if (exactEntry) {
    return exactEntry;
  }

  return contentLookup.commentEntries.find((entry) => {
    const path = entry.path.toLowerCase();
    return path.includes(`/${normalizedUuid}/content.comments`);
  }) ?? null;
}

async function readContentText(entry) {
  const rawText = await readEntryText(entry);
  return convertContentTextForEntry(entry, rawText);
}

function convertContentTextForEntry(entry, rawText) {
  const extension = getPathExtension(entry.path).toLowerCase();
  if (extension === ".rtf") {
    return convertRtfToPlainText(rawText);
  }
  if (extension === ".html" || extension === ".htm") {
    return convertHtmlToPlainText(rawText);
  }
  return String(rawText ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function convertHtmlToPlainText(htmlText) {
  return String(htmlText ?? "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Intent: recover readable manuscript text from Scrivener RTF without claiming full rich-text fidelity.
export function convertRtfToPlainText(rtfText) {
  const source = String(rtfText ?? "");
  if (!source.trim().startsWith("{\\rtf")) {
    return source.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  }

  return convertRtfMarkupToPlainText(source);
}

function convertRtfFragmentToPlainText(rtfText) {
  return convertRtfMarkupToPlainText(String(rtfText ?? ""));
}

function convertRtfMarkupToPlainText(source) {
  const stack = [{
    ignorable: false,
    destination: "",
  }];
  let output = "";

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const state = stack.at(-1);

    if (character === "{") {
      stack.push({ ...state });
      continue;
    }

    if (character === "}") {
      if (stack.length > 1) {
        stack.pop();
      }
      continue;
    }

    if (character !== "\\") {
      if (!state.ignorable && character !== "\r" && character !== "\n") {
        output += character;
      }
      continue;
    }

    const nextCharacter = source[index + 1];
    if (["\\", "{", "}"].includes(nextCharacter)) {
      if (!state.ignorable) {
        output += nextCharacter;
      }
      index += 1;
      continue;
    }

    if (nextCharacter === "'") {
      const hex = source.slice(index + 2, index + 4);
      if (!state.ignorable && /^[0-9a-f]{2}$/i.test(hex)) {
        output += decodeRtfHexByte(hex);
      }
      index += 3;
      continue;
    }

    const controlMatch = /^\\([a-zA-Z*]+)(-?\d+)? ?/.exec(source.slice(index));
    if (!controlMatch) {
      continue;
    }

    const control = controlMatch[1];
    const parameter = controlMatch[2];
    index += controlMatch[0].length - 1;
    const current = stack.at(-1);
    const splitControl = splitRtfControlWordText(control);
    const normalizedControl = splitControl.control;

    if (normalizedControl === "*") {
      current.ignorable = true;
      continue;
    }

    if (SKIPPED_RTF_DESTINATIONS.has(normalizedControl)) {
      current.ignorable = true;
      current.destination = normalizedControl;
      continue;
    }

    if (current.ignorable) {
      continue;
    }

    if (normalizedControl === "par") {
      output += "\n\n";
    } else if (normalizedControl === "line") {
      output += "\n";
    } else if (normalizedControl === "tab") {
      output += "\t";
    } else if (normalizedControl === "emdash") {
      output += "—";
    } else if (normalizedControl === "endash") {
      output += "–";
    } else if (normalizedControl === "bullet") {
      output += "*";
    } else if (normalizedControl === "u" && parameter !== undefined) {
      let codePoint = Number.parseInt(parameter, 10);
      if (codePoint < 0) {
        codePoint += 65536;
      }
      if (Number.isFinite(codePoint)) {
        output += String.fromCharCode(codePoint);
      }
      index = skipRtfUnicodeFallback(source, index);
    }

    if (splitControl.trailingText) {
      output += splitControl.trailingText;
      if (controlMatch[0].endsWith(" ")) {
        output += " ";
      }
    }
  }

  return output
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitRtfControlWordText(control) {
  const value = String(control ?? "");
  if (value.startsWith("fldrslt") && value.length > "fldrslt".length) {
    return {
      control: "fldrslt",
      trailingText: value.slice("fldrslt".length),
    };
  }

  return {
    control: value,
    trailingText: "",
  };
}

function skipRtfUnicodeFallback(source, index) {
  const fallbackIndex = index + 1;
  const fallback = source[fallbackIndex];
  if (!fallback) {
    return index;
  }

  if (
    fallback === "\\" &&
    source[fallbackIndex + 1] === "'" &&
    /^[0-9a-f]{2}$/i.test(source.slice(fallbackIndex + 2, fallbackIndex + 4))
  ) {
    return index + 4;
  }

  if (fallback === "\\" && ["\\", "{", "}"].includes(source[fallbackIndex + 1])) {
    return index + 2;
  }

  return ["\\", "{", "}"].includes(fallback) ? index : index + 1;
}

function decodeRtfHexByte(hex) {
  const byte = Number.parseInt(hex, 16);
  const windows1252 = {
    0x80: 0x20ac,
    0x82: 0x201a,
    0x83: 0x0192,
    0x84: 0x201e,
    0x85: 0x2026,
    0x86: 0x2020,
    0x87: 0x2021,
    0x88: 0x02c6,
    0x89: 0x2030,
    0x8a: 0x0160,
    0x8b: 0x2039,
    0x8c: 0x0152,
    0x8e: 0x017d,
    0x91: 0x2018,
    0x92: 0x2019,
    0x93: 0x201c,
    0x94: 0x201d,
    0x95: 0x2022,
    0x96: 0x2013,
    0x97: 0x2014,
    0x98: 0x02dc,
    0x99: 0x2122,
    0x9a: 0x0161,
    0x9b: 0x203a,
    0x9c: 0x0153,
    0x9e: 0x017e,
    0x9f: 0x0178,
  };
  return String.fromCodePoint(windows1252[byte] ?? byte);
}

// Intent: map Scrivener's project text preference onto the editor's constrained appearance options.
async function readScrivenerEditorPrefs(entries) {
  const preferencesEntry = entries.find((entry) =>
    normalizePath(entry.path).toLowerCase().endsWith(SCRIVENER_PROJECT_PREFERENCES_PATH)
  );
  if (!preferencesEntry) {
    return {};
  }

  const preferencesText = await readEntryText(preferencesEntry);
  const preferencesRoot = parseScrivenerXml(preferencesText);
  const textFormatNode = findDescendants(preferencesRoot, ["TextFormatRTFData"])[0];
  const rtfFormat = getNodeRawText(textFormatNode);
  const fontName = extractPrimaryRtfFontName(rtfFormat);
  const fontSize = extractPrimaryRtfFontSize(rtfFormat);
  const editorPrefs = {};
  if (/times/i.test(fontName)) {
    editorPrefs.fontFamilyId = "manuscript-serif";
  }
  if (fontSize) {
    editorPrefs.fontSize = fontSize;
  }
  return editorPrefs;
}

function extractPrimaryRtfFontName(rtfText) {
  const match = String(rtfText ?? "").match(/\\f0(?:\\[a-zA-Z]+-?\d*)*\s+([^;{}]+);/);
  return normalizeString(match?.[1]);
}

function extractPrimaryRtfFontSize(rtfText) {
  const match = String(rtfText ?? "").match(/\\fs(\d+)/);
  const halfPoints = Number.parseInt(match?.[1] ?? "", 10);
  if (!Number.isFinite(halfPoints) || halfPoints <= 0) {
    return null;
  }

  const pixelSize = (halfPoints / 2) * (96 / 72);
  const allowedSizes = [16, 18, 20, 22];
  return allowedSizes.reduce((closest, candidate) =>
    Math.abs(candidate - pixelSize) < Math.abs(closest - pixelSize) ? candidate : closest,
  allowedSizes[0]);
}

// Intent: import Scrivener inspector comments as project metadata notes while retaining scene anchors.
async function collectScrivenerCommentNoteImports({
  item,
  commentEntry,
  rawContentText,
  editorText,
  sceneId,
  chapterId,
  chapterTitle,
  sceneTitle,
  now,
  noteStartIndex = 0,
} = {}) {
  if (!commentEntry) {
    return [];
  }

  const commentsText = await readEntryText(commentEntry);
  const comments = parseScrivenerCommentSidecar(commentsText);
  if (!comments.length) {
    return [];
  }

  const anchorsByCommentId = collectScrivenerCommentAnchors(rawContentText, editorText);
  const noteImports = [];
  for (const comment of comments) {
    const anchors = anchorsByCommentId.get(comment.sourceCommentId.toLowerCase()) ?? [null];
    for (const anchor of anchors) {
      const noteIndex = noteStartIndex + noteImports.length + 1;
      noteImports.push({
        sourceDocumentId: item.uuid,
        sourcePath: item.binderPath.join(" / "),
        kind: comment.kind,
        sceneId,
        chapterId,
        chapterTitle,
        sceneTitle,
        note: createScrivenerCommentMetadataNote({
          comment,
          anchor,
          sceneId,
          chapterId,
          chapterTitle,
          sceneTitle,
          sourceDocumentId: item.uuid,
          sourcePath: item.binderPath.join(" / "),
          now,
          noteIndex,
        }),
      });
    }
  }

  return noteImports;
}

function parseScrivenerCommentSidecar(commentsXmlText) {
  const xmlRoot = parseScrivenerXml(commentsXmlText);
  return findDescendants(xmlRoot, ["Comment"])
    .map((node) => {
      const sourceCommentId = getAttribute(node, ["ID", "Id"]);
      const rawBody = getNodeRawText(node);
      const body = convertRtfToPlainText(rawBody);
      if (!sourceCommentId || !body) {
        return null;
      }

      const isFootnote = normalizeBoolean(getAttribute(node, ["Footnote"])) === true;
      return {
        sourceCommentId,
        kind: isFootnote ? "footnote" : "comment",
        body,
      };
    })
    .filter(Boolean);
}

function collectScrivenerCommentAnchors(rawContentText, editorText) {
  const anchorsByCommentId = new Map();
  const rawAnchors = extractScrivenerCommentAnchorFields(rawContentText);
  let searchFrom = 0;

  for (const rawAnchor of rawAnchors) {
    const selectedText = normalizeImportedAnchorText(rawAnchor.selectedText);
    if (!selectedText) {
      continue;
    }

    const range = findImportedAnchorRange(editorText, selectedText, searchFrom);
    if (range) {
      searchFrom = range.endOffset;
    }

    const key = rawAnchor.sourceCommentId.toLowerCase();
    const anchors = anchorsByCommentId.get(key) ?? [];
    anchors.push({
      sourceCommentId: rawAnchor.sourceCommentId,
      selectedText,
      startOffset: range?.startOffset ?? 0,
      endOffset: range?.endOffset ?? selectedText.length,
      resolved: Boolean(range),
    });
    anchorsByCommentId.set(key, anchors);
  }

  return anchorsByCommentId;
}

function extractScrivenerCommentAnchorFields(rawContentText) {
  const source = String(rawContentText ?? "");
  const anchors = [];

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "{" || !source.slice(index + 1).startsWith("\\field")) {
      continue;
    }

    const endIndex = findMatchingRtfGroupEnd(source, index);
    if (endIndex <= index) {
      continue;
    }

    const fieldGroup = source.slice(index, endIndex + 1);
    const commentIds = [...fieldGroup.matchAll(/scrivcmt:\/\/([a-z0-9-]+)/gi)]
      .map((match) => match[1])
      .filter(Boolean);
    if (!commentIds.length) {
      index = endIndex;
      continue;
    }

    const resultGroup = extractFirstRtfDestinationGroup(fieldGroup, "fldrslt");
    const selectedText = convertRtfFragmentToPlainText(resultGroup);
    for (const sourceCommentId of commentIds) {
      anchors.push({
        sourceCommentId,
        selectedText,
      });
    }
    index = endIndex;
  }

  return anchors;
}

function findMatchingRtfGroupEnd(source, startIndex) {
  let depth = 0;
  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\\") {
      index += 1;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function extractFirstRtfDestinationGroup(source, destination) {
  const prefix = `\\${destination}`;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "{" || !source.slice(index + 1).startsWith(prefix)) {
      continue;
    }

    const endIndex = findMatchingRtfGroupEnd(source, index);
    if (endIndex > index) {
      return source.slice(index, endIndex + 1);
    }
  }

  return "";
}

function normalizeImportedAnchorText(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findImportedAnchorRange(editorText, selectedText, preferredStart = 0) {
  const content = String(editorText ?? "");
  const directFromCursor = content.indexOf(selectedText, Math.max(0, preferredStart));
  if (directFromCursor >= 0) {
    return {
      startOffset: directFromCursor,
      endOffset: directFromCursor + selectedText.length,
    };
  }

  const direct = content.indexOf(selectedText);
  if (direct >= 0) {
    return {
      startOffset: direct,
      endOffset: direct + selectedText.length,
    };
  }

  const normalizedContent = createImportedNormalizedTextMap(content);
  const normalizedNeedle = createImportedNormalizedTextMap(selectedText).normalized;
  const normalizedStart = normalizedContent.normalized.indexOf(normalizedNeedle);
  if (normalizedStart < 0) {
    return null;
  }

  const normalizedEnd = normalizedStart + normalizedNeedle.length - 1;
  return {
    startOffset: normalizedContent.sourceOffsets[normalizedStart] ?? 0,
    endOffset: (normalizedContent.sourceOffsets[normalizedEnd] ?? 0) + 1,
  };
}

function createImportedNormalizedTextMap(text) {
  let normalized = "";
  const sourceOffsets = [];
  let previousWasSpace = true;

  for (let sourceOffset = 0; sourceOffset < String(text ?? "").length; sourceOffset += 1) {
    const character = String(text ?? "")[sourceOffset];
    const normalizedCharacter = /[\p{L}\p{N}]/u.test(character)
      ? character.toLocaleLowerCase()
      : " ";
    if (normalizedCharacter === " ") {
      if (!previousWasSpace && normalized.length) {
        normalized += " ";
        sourceOffsets.push(sourceOffset);
        previousWasSpace = true;
      }
      continue;
    }

    normalized += normalizedCharacter;
    sourceOffsets.push(sourceOffset);
    previousWasSpace = false;
  }

  return {
    normalized: normalized.trimEnd(),
    sourceOffsets,
  };
}

function createScrivenerCommentMetadataNote({
  comment,
  anchor,
  sceneId,
  chapterId,
  chapterTitle,
  sceneTitle,
  sourceDocumentId,
  sourcePath,
  now,
  noteIndex,
}) {
  const kindLabel = comment.kind === "footnote" ? "Footnote" : "Comment";
  const selectedText = anchor?.selectedText ?? "";
  const note = {
    id: `metadata-folder-note-scrivener-${createSlug(comment.sourceCommentId, "comment")}-${noteIndex}`,
    title: createScrivenerCommentNoteTitle(kindLabel, sceneTitle, selectedText, noteIndex),
    body: [
      comment.body,
      `Source: Scrivener ${kindLabel.toLowerCase()} ${comment.sourceCommentId}`,
      sourcePath ? `Binder path: ${sourcePath}` : "",
    ].filter(Boolean).join("\n\n"),
    createdAt: now,
    updatedAt: now,
    anchor: null,
  };

  if (anchor?.resolved && selectedText) {
    note.anchor = {
      sceneId,
      sceneTitle,
      chapterId,
      chapterTitle,
      selectedText,
      startOffset: anchor.startOffset,
      endOffset: anchor.endOffset,
      createdAt: now,
    };
  }

  note.sourceDocumentId = sourceDocumentId;
  note.sourceCommentId = comment.sourceCommentId;
  note.sourceKind = comment.kind;
  return note;
}

function createScrivenerCommentNoteTitle(kindLabel, sceneTitle, selectedText, noteIndex) {
  const anchorPreview = normalizeMetadataNoteTitle(selectedText);
  if (anchorPreview) {
    // Slicing a preview can expose trailing whitespace even after the source was trimmed.
    return normalizeMetadataNoteTitle(`${kindLabel}: ${anchorPreview.slice(0, 52)}`);
  }

  return normalizeMetadataNoteTitle(`${kindLabel}: ${sceneTitle || `Imported note ${noteIndex}`}`);
}

function buildScrivenerCommentMetadataSubgroups(commentImports, now) {
  const foldersBySceneId = new Map();
  for (const record of commentImports) {
    let folder = foldersBySceneId.get(record.sceneId);
    if (!folder) {
      folder = {
        id: `metadata-folder-scrivener-${createSlug(record.sceneId, "scene")}`,
        groupId: SCRIVENER_COMMENTS_METADATA_GROUP_ID,
        title: record.sceneTitle || "Imported Scrivener scene",
        createdAt: now,
        updatedAt: now,
        notes: [],
        folders: [],
      };
      foldersBySceneId.set(record.sceneId, folder);
    }

    folder.notes.push(record.note);
  }

  return [...foldersBySceneId.values()];
}

function createScrivenerCommentsMetadataDefinition(now) {
  return {
    id: SCRIVENER_COMMENTS_METADATA_GROUP_ID,
    label: SCRIVENER_COMMENTS_METADATA_LABEL,
    highlightColor: SCRIVENER_COMMENTS_METADATA_HIGHLIGHT_COLOR,
    createdAt: now,
    updatedAt: now,
  };
}

function createBlockRecords(text, sceneId, chapterId, chapterTitle, sceneTitle) {
  const paragraphs = String(text ?? "").split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const safeParagraphs = paragraphs.length ? paragraphs : [""];
  return safeParagraphs.map((paragraph, index) => ({
    id: `block-${sceneId}-${String(index + 1).padStart(4, "0")}`,
    blockId: `block-${sceneId}-${String(index + 1).padStart(4, "0")}`,
    paragraphId: `paragraph-${sceneId}-${String(index + 1).padStart(4, "0")}`,
    lineNumber: index + 1,
    sceneLineNumber: index + 1,
    kind: "narration",
    speakerLabel: "",
    text: paragraph,
    chapterId,
    chapterTitle,
    sceneId,
    sceneTitle,
    sceneSynopsis: "",
    startsChapter: index === 0,
    startsScene: index === 0,
    issueIds: [],
    eventTagIds: [],
  }));
}

function createProjectBinder(projectId, title, chapters) {
  return {
    id: projectId,
    kind: "project",
    refId: projectId,
    title,
    order: 1,
    children: chapters.map((chapter, chapterIndex) => ({
      id: `binder-${chapter.chapterId}`,
      kind: "chapter",
      refId: chapter.chapterId,
      title: chapter.chapterTitle,
      order: chapterIndex + 1,
      children: chapter.scenes.map((scene, sceneIndex) => ({
        id: `binder-${scene.sceneId}`,
        kind: "scene",
        refId: scene.sceneId,
        title: scene.sceneTitle,
        order: sceneIndex + 1,
        children: [],
      })),
    })),
  };
}

function buildWorkspaceSnapshot({
  projectId,
  title,
  now,
  chapters,
  lines,
}) {
  const firstLine = lines[0] ?? {
    blockId: "block-scene-0001-0001",
    paragraphId: "paragraph-scene-0001-0001",
    lineNumber: 1,
    chapterId: "chapter-0001",
    chapterTitle: "Imported Manuscript",
    sceneId: "scene-0001",
    sceneTitle: "Imported Scene",
    text: "",
  };
  const navigationTargets = {
    [projectId]: {
      refId: projectId,
      kind: "project",
      title,
      lineId: firstLine.blockId,
      lineNumber: 1,
    },
  };

  for (const chapter of chapters) {
    const chapterFirstScene = chapter.scenes[0];
    navigationTargets[chapter.chapterId] = {
      refId: chapter.chapterId,
      kind: "chapter",
      title: chapter.chapterTitle,
      lineId: chapterFirstScene?.blocks?.[0]?.blockId ?? firstLine.blockId,
      lineNumber: chapterFirstScene?.blocks?.[0]?.lineNumber ?? 1,
    };
    for (const scene of chapter.scenes) {
      navigationTargets[scene.sceneId] = {
        refId: scene.sceneId,
        kind: "scene",
        title: scene.sceneTitle,
        lineId: scene.blocks?.[0]?.blockId ?? firstLine.blockId,
        lineNumber: scene.blocks?.[0]?.lineNumber ?? 1,
      };
    }
  }

  return {
    generatedAt: now,
    workspaceTitle: "ABetterNovelAuthoringEnvironment",
    settings: {
      executionMode: "local-only",
      modelRoot: "",
      assetRoot: "",
      projectRoot: "",
    },
    project: {
      id: projectId,
      title,
      binder: createProjectBinder(projectId, title, chapters),
      stats: {
        chapterCount: chapters.length,
        sceneCount: chapters.reduce((total, chapter) => total + chapter.scenes.length, 0),
        lineCount: lines.length,
        issueCount: 0,
        eventCount: 0,
        characterCount: 0,
      },
      navigationTargets,
      lines,
      issues: [],
      eventTags: [],
      characters: [],
      marks: [],
    },
    world: {
      id: `world-${projectId}`,
      title: `${title} World`,
      stats: {
        templateCount: 0,
        entityCount: 0,
        spineCount: 0,
        nodeCount: 0,
        edgeCount: 0,
      },
      templates: [],
      entities: [],
      spines: [],
      edges: [],
    },
    analysis: {
      provider: {
        id: "local-rule-analysis",
        label: "Local Rule Analysis",
        availability: "ready",
        executionMode: "local-only",
      },
      lastJob: {
        id: `analysis-${projectId}`,
        type: "analysis",
        status: "completed",
        createdAt: now,
        updatedAt: now,
        request: {
          projectId,
          trigger: "scrivener-import",
        },
        result: {
          providerId: "local-rule-analysis",
          issueCount: 0,
          eventCount: 0,
          suggestionCount: 0,
        },
      },
      suggestionQueue: [],
    },
    narration: {
      provider: {
        id: "local-audio-service",
        label: "Local Audio",
        availability: "ready",
        alignmentStrategy: "line-based",
      },
      session: {
        id: `narration-${projectId}`,
        projectId,
        providerId: "local-audio-service",
        sessionLabel: title,
        status: "paused",
        currentAnchor: {
          projectId,
          chapterId: firstLine.chapterId,
          sceneId: firstLine.sceneId,
          blockId: firstLine.blockId,
          paragraphId: firstLine.paragraphId,
          startOffset: 0,
          endOffset: 0,
        },
        currentLineNumber: 1,
        currentText: "",
        updatedAt: now,
      },
      alignmentJobs: [],
    },
    voice: {
      provider: {
        id: "local-voice-service",
        label: "Local Voice",
        availability: "ready",
        synthesisMode: "local",
      },
      profiles: [],
      bindings: [],
      renderJobs: [],
      recordings: [],
    },
    selectionDefaults: {
      lineId: firstLine.blockId,
      sceneId: firstLine.sceneId,
    },
  };
}

function normalizeChapterTitle(manuscriptRecord) {
  const chapterCandidate = manuscriptRecord.chapterStack.at(0);
  return normalizeString(chapterCandidate?.title) || "Imported Manuscript";
}

function buildCustomMetadataDefinitions(definitionMap, usedMetadataValues, now) {
  const definitions = [];
  const usedIds = new Set();
  for (const definition of definitionMap.values()) {
    if (!usedMetadataValues.has(definition.id)) {
      continue;
    }

    let id = definition.id;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${definition.id}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    definitions.push({
      id,
      label: definition.label,
      highlightColor: definition.highlightColor,
      createdAt: now,
      updatedAt: now,
    });
  }
  return definitions;
}

function buildSourceArchiveRecord(item, contentEntry, text) {
  return {
    id: `scrivener-${createSlug(item.uuid || item.title, "binder-item")}`,
    source: "scrivener",
    kind: "binder-item",
    sourceDocumentId: item.uuid,
    title: item.title,
    type: item.type,
    binderPath: item.binderPath,
    contentFilePath: contentEntry?.path ?? "",
    wordCount: countWords(text),
    metadata: cloneValue(item.metadata),
  };
}

function createFileManifest(entries) {
  return entries.map((entry) => ({
    path: entry.path,
    name: entry.name,
    size: entry.size,
    type: entry.type,
    lastModified: entry.lastModified,
  }));
}

export async function buildScrivenerProjectSnapshotFromFiles(files = [], options = {}) {
  const entries = files.map(normalizeScrivenerFileEntry).filter(Boolean);
  const scrivxEntry = entries.find((entry) => getPathExtension(entry.path).toLowerCase() === ".scrivx");
  if (!scrivxEntry) {
    throw new Error("Choose a Scrivener project package that contains a .scrivx file.");
  }

  const now = createImportTimestamp(options);
  const projectTitle = normalizeString(options.projectTitle) ||
    stripFileExtension(scrivxEntry.name) ||
    "Imported Scrivener Project";
  const projectId = `scrivener-${createSlug(projectTitle, "project")}`;
  const xmlText = await readEntryText(scrivxEntry);
  const xmlRoot = parseScrivenerXml(xmlText);
  const customDefinitionMap = collectCustomMetadataDefinitions(xmlRoot);
  const binderItems = parseScrivenerBinder(xmlRoot, customDefinitionMap);
  const flatItems = flattenBinderItems(binderItems);
  const contentLookup = buildContentLookup(entries);
  const scrivenerEditorPrefs = await readScrivenerEditorPrefs(entries);
  const manuscriptItems = collectManuscriptItems(binderItems, contentLookup);
  const nextSceneId = createIdSequence("scene");
  const nextChapterId = createIdSequence("chapter");
  const chaptersByTitle = new Map();
  const sceneDrafts = {};
  const sceneOrder = [];
  const structureScenes = [];
  const sourceArchive = [];
  const workspaceLines = [];
  const scrivenerCommentNoteImports = [];
  const usedMetadataValues = new Set();
  let importedTextDocumentCount = 0;

  for (const manuscriptRecord of manuscriptItems) {
    const item = manuscriptRecord.item;
    const contentEntry = findContentForBinderItem(item, contentLookup);
    const rawContentText = contentEntry ? await readEntryText(contentEntry) : "";
    const editorText = contentEntry ? convertContentTextForEntry(contentEntry, rawContentText) : "";
    if (!editorText.trim() && item.children?.length) {
      continue;
    }

    const chapterTitle = normalizeChapterTitle(manuscriptRecord);
    let chapter = chaptersByTitle.get(chapterTitle);
    if (!chapter) {
      chapter = {
        chapterId: nextChapterId(),
        chapterTitle,
        scenes: [],
      };
      chaptersByTitle.set(chapterTitle, chapter);
    }

    const sceneId = nextSceneId();
    const sceneTitle = normalizeString(item.title) || `Scene ${sceneOrder.length + 1}`;
    const blocks = createBlockRecords(editorText, sceneId, chapter.chapterId, chapter.chapterTitle, sceneTitle);
    const commentEntry = findCommentSidecarForBinderItem(item, contentLookup);
    const importedCommentNotes = await collectScrivenerCommentNoteImports({
      item,
      commentEntry,
      rawContentText,
      editorText,
      sceneId,
      chapterId: chapter.chapterId,
      chapterTitle: chapter.chapterTitle,
      sceneTitle,
      now,
      noteStartIndex: scrivenerCommentNoteImports.length,
    });
    scrivenerCommentNoteImports.push(...importedCommentNotes);
    const sceneDraft = {
      sceneId,
      chapterId: chapter.chapterId,
      chapterTitle: chapter.chapterTitle,
      sceneTitle,
      sceneSynopsis: item.metadata.synopsis,
      editorText,
      blocks,
      worldSpineMetadata: {
        customMetadata: cloneValue(item.metadata.customMetadata),
      },
      customMetadata: cloneValue(item.metadata.customMetadata),
      scrivenerMetadata: {
        uuid: item.uuid,
        type: item.type,
        binderPath: item.binderPath,
        contentFilePath: contentEntry?.path ?? "",
        label: item.metadata.label,
        status: item.metadata.status,
        notes: item.metadata.notes,
        keywords: item.metadata.keywords,
        includeInCompile: item.metadata.includeInCompile,
        rawCustomMetadata: item.metadata.rawCustomMetadata,
        raw: item.metadata.raw,
      },
    };
    for (const metadataId of Object.keys(item.metadata.customMetadata)) {
      usedMetadataValues.add(metadataId);
    }

    sceneDrafts[sceneId] = sceneDraft;
    sceneOrder.push(sceneId);
    structureScenes.push({
      sceneId,
      chapterId: chapter.chapterId,
      chapterTitle: chapter.chapterTitle,
      sceneTitle,
      sceneSynopsis: item.metadata.synopsis,
      initialText: editorText,
      scrivenerSource: {
        uuid: item.uuid,
        type: item.type,
        binderPath: item.binderPath,
        contentFilePath: contentEntry?.path ?? "",
      },
    });
    chapter.scenes.push({
      sceneId,
      sceneTitle,
      blocks,
    });
    workspaceLines.push(...blocks);
    sourceArchive.push(buildSourceArchiveRecord(item, contentEntry, editorText));
    if (contentEntry) {
      importedTextDocumentCount += 1;
    }
  }

  const worldbuildingReferences = await collectWorldbuildingReferenceEntities(
    binderItems,
    contentLookup,
    manuscriptItems,
    now,
  );
  sourceArchive.push(...worldbuildingReferences.sourceRecords);

  if (!sceneOrder.length) {
    const chapterId = nextChapterId();
    const sceneId = nextSceneId();
    const blocks = createBlockRecords("", sceneId, chapterId, "Imported Manuscript", "Imported Scene");
    chaptersByTitle.set("Imported Manuscript", {
      chapterId,
      chapterTitle: "Imported Manuscript",
      scenes: [{
        sceneId,
        sceneTitle: "Imported Scene",
        blocks,
      }],
    });
    sceneDrafts[sceneId] = {
      sceneId,
      chapterId,
      chapterTitle: "Imported Manuscript",
      sceneTitle: "Imported Scene",
      sceneSynopsis: "",
      editorText: "",
      blocks,
      scrivenerMetadata: {
        importWarning: "No Scrivener text documents were found in the Draft/Manuscript binder.",
      },
    };
    sceneOrder.push(sceneId);
    structureScenes.push({
      sceneId,
      chapterId,
      chapterTitle: "Imported Manuscript",
      sceneTitle: "Imported Scene",
      sceneSynopsis: "",
      initialText: "",
    });
    workspaceLines.push(...blocks);
  }

  const chapters = [...chaptersByTitle.values()];
  const customMetadataDefinitions = buildCustomMetadataDefinitions(customDefinitionMap, usedMetadataValues, now);
  if (
    scrivenerCommentNoteImports.length &&
    !customMetadataDefinitions.some((definition) => definition.id === SCRIVENER_COMMENTS_METADATA_GROUP_ID)
  ) {
    customMetadataDefinitions.push(createScrivenerCommentsMetadataDefinition(now));
  }
  const metadataSubgroups = buildScrivenerCommentMetadataSubgroups(scrivenerCommentNoteImports, now);
  const workspace = buildWorkspaceSnapshot({
    projectId,
    title: projectTitle,
    now,
    chapters,
    lines: workspaceLines,
  });
  workspace.world = {
    ...workspace.world,
    entities: worldbuildingReferences.entities,
    stats: {
      ...(workspace.world.stats ?? {}),
      entityCount: worldbuildingReferences.entities.length,
    },
  };
  const importReport = {
    kind: "scrivener",
    sourceLabel: options.sourceLabel ?? getPathFileName(scrivxEntry.path),
    sourcePath: options.sourcePath ?? "",
    scrivxPath: scrivxEntry.path,
    importedAt: now,
    binderItemCount: flatItems.length,
    manuscriptSceneCount: sceneOrder.length,
    importedTextDocumentCount,
    worldCatalogueEntityCount: worldbuildingReferences.entities.length,
    customMetadataFieldCount: customMetadataDefinitions.length,
    scrivenerCommentCount: scrivenerCommentNoteImports.filter((noteImport) => noteImport.kind === "comment").length,
    scrivenerFootnoteCount: scrivenerCommentNoteImports.filter((noteImport) => noteImport.kind === "footnote").length,
    scrivenerCommentAnchorCount: scrivenerCommentNoteImports.filter((noteImport) => noteImport.note.anchor).length,
    fileManifest: createFileManifest(entries),
    warnings: sceneOrder.length ? [] : ["No Scrivener text documents were found in the Draft/Manuscript binder."],
  };
  const record = {
    id: projectId,
    title: projectTitle,
    source: "scrivener-import",
    createdAt: now,
    updatedAt: now,
    workspace,
    sceneDrafts,
    structureDrafts: {
      scenes: structureScenes,
      sceneOrder,
      scrivenerBinder: binderItems.map((item) => ({
        uuid: item.uuid,
        title: item.title,
        type: item.type,
        binderPath: item.binderPath,
        children: cloneValue(item.children ?? []),
      })),
    },
    templateDrafts: [],
    manuscriptTasks: [],
    passageNotes: [],
    metadataSubgroups,
    draftProofing: {
      schemaVersion: 1,
      activeRunId: "",
      runs: [],
    },
    sourceArchive,
    importReport,
    projectSettings: {
      customMetadataDefinitions,
      editorPrefs: scrivenerEditorPrefs,
      projectFilePath: "",
      projectSourcePath: options.sourcePath ?? options.sourceLabel ?? "",
    },
    editorPrefs: scrivenerEditorPrefs,
    localAiPrefs: {},
  };

  return {
    schemaVersion: Number(options.schemaVersion) || 2,
    activeProjectId: projectId,
    projects: [record],
    sceneStore: {
      [projectId]: sceneDrafts,
    },
  };
}

export function canUseBrowserDirectoryPicker(windowRef = globalThis.window) {
  return typeof windowRef?.showDirectoryPicker === "function";
}

async function collectFilesFromDirectoryHandle(directoryHandle, parentPath = "") {
  const entries = [];
  for await (const [name, handle] of directoryHandle.entries()) {
    const relativePath = normalizePath(parentPath ? `${parentPath}/${name}` : name);
    if (handle.kind === "directory") {
      entries.push(...await collectFilesFromDirectoryHandle(handle, relativePath));
      continue;
    }
    if (handle.kind === "file") {
      const file = await handle.getFile();
      entries.push({
        file,
        name: file.name || name,
        path: relativePath,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      });
    }
  }
  return entries;
}

export async function pickScrivenerProjectPackageFromDirectory({
  windowRef = globalThis.window,
} = {}) {
  if (!canUseBrowserDirectoryPicker(windowRef)) {
    throw new Error("Directory picker API is unavailable.");
  }

  const handle = await windowRef.showDirectoryPicker({
    id: "scrivener-project-import",
    mode: "read",
  });
  if (!handle) {
    return null;
  }

  const files = await collectFilesFromDirectoryHandle(handle);
  return {
    files,
    sourceLabel: handle.name ?? "Scrivener project",
    sourcePath: handle.name ?? "",
  };
}

export function promptForScrivenerProjectPackageFromInput({
  documentRef = globalThis.document,
  windowRef = globalThis.window,
} = {}) {
  return new Promise((resolve, reject) => {
    if (!documentRef?.body) {
      resolve(null);
      return;
    }

    const input = documentRef.createElement("input");
    let settled = false;

    const cleanup = () => {
      input.removeEventListener("change", handleChange);
      input.removeEventListener("cancel", handleCancel);
      windowRef.removeEventListener("focus", handleWindowFocus);
      input.remove();
    };

    const finish = (packageRecord) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(packageRecord);
    };

    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const collectInputFiles = () => {
      const files = Array.from(input.files ?? []).map((file) => ({
        file,
        name: file.name,
        path: normalizePath(file.webkitRelativePath || file.name),
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      }));
      const firstPath = files[0]?.path ?? "";
      const sourceLabel = firstPath.includes("/")
        ? firstPath.split("/")[0]
        : "Scrivener project";
      return files.length
        ? {
          files,
          sourceLabel,
          sourcePath: sourceLabel,
        }
        : null;
    };

    function handleChange() {
      finish(collectInputFiles());
    }

    function handleCancel() {
      finish(null);
    }

    function handleWindowFocus() {
      windowRef.removeEventListener("focus", handleWindowFocus);
      windowRef.setTimeout(() => {
        if (!settled) {
          finish(collectInputFiles());
        }
      }, 50);
    }

    input.type = "file";
    input.multiple = true;
    input.webkitdirectory = true;
    input.tabIndex = -1;
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "-9999px";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0";

    input.addEventListener("change", handleChange);
    input.addEventListener("cancel", handleCancel);
    windowRef.addEventListener("focus", handleWindowFocus);
    documentRef.body.appendChild(input);

    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.click();
      }
    } catch (error) {
      fail(error);
    }
  });
}
