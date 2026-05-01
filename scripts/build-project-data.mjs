#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const indexPath = requireArg(args.index, "--index");
const dataRoot = requireArg(args.dataRoot, "--data-root");
const outputPath = requireArg(args.output, "--output");
const now = args.now ?? new Date().toISOString();
const projectTitle = typeof args.projectTitle === "string" && args.projectTitle.trim()
  ? args.projectTitle.trim()
  : inferProjectTitle(indexPath);
const projectId = typeof args.projectId === "string" && args.projectId.trim()
  ? args.projectId.trim()
  : `project-${slugify(projectTitle)}`;
const worldId = typeof args.worldId === "string" && args.worldId.trim()
  ? args.worldId.trim()
  : `world-${slugify(projectTitle)}`;

const binder = parseBinder(readFileSync(indexPath, "utf8"));
const manuscriptRoot = findDirectChildByTitle(binder, "Manuscript") ?? findByTitle(binder, "Manuscript");
if (!manuscriptRoot) {
  throw new Error("Unable to find a Manuscript binder root.");
}

const novelFormatRoot = findDirectChildByTitle(binder, "Novel Format") ?? findByTitle(binder, "Novel Format");
const worldRoot = findDirectChildByTitle(binder, "WorldBuilding") ?? findByTitle(binder, "WorldBuilding");
const timelineRoot = findDirectChildByTitle(binder, "Timeline") ?? findByTitle(binder, "Timeline");
const researchRoot = findDirectChildByTitle(binder, "Research") ?? findByTitle(binder, "Research");
const trashRoot = findDirectChildByTitle(binder, "Trash") ?? findByTitle(binder, "Trash");
const worldNotesRoot = worldRoot ? findDirectChildByTitle(worldRoot, "Notes") : null;
const WORLD_CATEGORY_TEMPLATES = {
  Characters: "Character",
  Ships: "Ship",
  Weapons: "Weapon",
  Planets: "Planet",
  Stations: "Station",
  Fauna: "Fauna",
  Flora: "Flora",
};

const { project, manuscriptTasks, report } = buildProject(manuscriptRoot);
const world = buildWorldModel(worldRoot, timelineRoot);
const importedMaterials = buildImportedSourceMaterials({
  novelFormatRoot,
  researchRoot,
  worldRoot,
  worldNotesRoot,
  trashRoot,
});
const projectData = {
  schemaVersion: 1,
  generatedAt: now,
  project,
  world,
  manuscriptTasks,
  passageNotes: importedMaterials.passageNotes,
  sourceArchive: importedMaterials.sourceArchive,
  importReport: {
    ...report,
    ...importedMaterials.report,
  },
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(projectData, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  outputPath,
  chapters: project.chapters.length,
  scenes: project.chapters.reduce((count, chapter) => count + chapter.scenes.length, 0),
  blocks: project.sequences.block,
  tasks: manuscriptTasks.length,
  passageNotes: importedMaterials.passageNotes.length,
  worldEntities: world.entities.length,
  worldTemplates: world.templates.length,
  timelineNodes: world.nodes.length,
  archivedItems: importedMaterials.sourceArchive.length,
}, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    parsed[key] = argv[index + 1];
    index += 1;
  }
  return parsed;
}

function requireArg(value, label) {
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return path.resolve(value);
}

function parseBinder(xml) {
  const root = {
    uuid: "root",
    type: "Root",
    title: "Root",
    includeInCompile: true,
    children: [],
  };
  const stack = [root];
  const tokenPattern =
    /<BinderItem\b([^>]*)>|<\/BinderItem>|<Title>([\s\S]*?)<\/Title>|<IncludeInCompile>([\s\S]*?)<\/IncludeInCompile>/g;

  for (const match of xml.matchAll(tokenPattern)) {
    if (match[1] !== undefined) {
      const attributes = parseAttributes(match[1]);
      const node = {
        uuid: attributes.UUID,
        type: attributes.Type,
        title: "",
        includeInCompile: true,
        children: [],
      };
      stack.at(-1).children.push(node);
      stack.push(node);
      continue;
    }

    if (match[0].startsWith("</")) {
      stack.pop();
      continue;
    }

    if (match[2] !== undefined) {
      stack.at(-1).title = decodeXml(match[2].trim());
      continue;
    }

    if (match[3] !== undefined) {
      stack.at(-1).includeInCompile = match[3].trim().toLowerCase() !== "no";
    }
  }

  return root;
}

function parseAttributes(value) {
  const attributes = {};
  for (const match of value.matchAll(/([A-Za-z]+)="([^"]*)"/g)) {
    attributes[match[1]] = decodeXml(match[2]);
  }
  return attributes;
}

function decodeXml(value) {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

function findByTitle(node, title) {
  if (node.title === title) {
    return node;
  }

  for (const child of node.children) {
    const found = findByTitle(child, title);
    if (found) {
      return found;
    }
  }

  return null;
}

function findDirectChildByTitle(node, title) {
  return node.children.find((child) => child.title === title) ?? null;
}

function buildProject(manuscriptRoot) {
  const paragraphSeparator = "\n\n";
  const project = {
    id: projectId,
    title: projectTitle,
    createdAt: now,
    updatedAt: now,
    chapters: [],
    characters: [],
    speakerAssignments: [],
    issues: [],
    eventTags: [],
    sequences: {
      chapter: 0,
      scene: 0,
      block: 0,
      paragraph: 0,
      issue: 0,
      event: 0,
      character: 0,
      alias: 0,
      speakerAssignment: 0,
    },
  };
  const manuscriptTasks = [];
  const skippedItems = [];
  const taskAnchorCounts = {
    active: 0,
    recovered: 0,
    approximate: 0,
    orphaned: 0,
  };
  let textItemCount = 0;
  let emptyTextItemCount = 0;
  let commentCount = 0;

  for (const child of manuscriptRoot.children) {
    if (child.type !== "Folder" && child.type !== "DraftFolder") {
      const text = readDocumentText(child.uuid);
      if (text.trim()) {
        skippedItems.push({ title: child.title, reason: "top-level text outside chapter folders" });
      }
      continue;
    }

    const textItems = collectTextItems(child, [manuscriptRoot.title, child.title]);
    if (!textItems.length) {
      continue;
    }

    const chapter = addChapter(project, child.title || `Chapter ${project.sequences.chapter + 1}`);
    chapter.source = "scrivener-manuscript";
    chapter.scrivenerDocumentId = child.uuid;
    chapter.scrivenerBinderPath = formatBinderPath([manuscriptRoot.title, child.title]);

    for (const item of textItems) {
      const sourcePath = formatBinderPath(item.path);
      const paragraphs = readDocumentParagraphs(item.uuid);
      if (!paragraphs.length) {
        emptyTextItemCount += 1;
        continue;
      }

      textItemCount += 1;
      const sceneTitle = item.title || `Scene ${project.sequences.scene + 1}`;
      const scene = addScene(project, chapter, sceneTitle);
      scene.scrivenerDocumentId = item.uuid;
      scene.scrivenerBinderPath = sourcePath;
      const editorOffsetByParagraph = [];
      let editorOffset = 0;

      for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
        const block = addBlock(project, scene, paragraph);
        block.scrivenerDocumentId = item.uuid;
        block.scrivenerBinderPath = sourcePath;
        block.scrivenerParagraphIndex = paragraphIndex;
        editorOffsetByParagraph.push({
          blockId: block.id,
          startOffset: editorOffset,
          endOffset: editorOffset + paragraph.length,
          text: paragraph,
        });
        editorOffset += paragraph.length + paragraphSeparator.length;
      }

      const sceneText = paragraphs.join(paragraphSeparator);
      const tasks = readDocumentTasks(item, chapter, scene, sceneText, editorOffsetByParagraph);
      commentCount += tasks.length;
      manuscriptTasks.push(...tasks);
      for (const task of tasks) {
        taskAnchorCounts[task.anchorStatus] += 1;
      }
    }
  }

  return {
    project,
    manuscriptTasks,
    report: {
      importedChapters: project.chapters.length,
      importedScenes: project.sequences.scene,
      importedBlocks: project.sequences.block,
      importedTextItems: textItemCount,
      emptyTextItems: emptyTextItemCount,
      importedTasks: commentCount,
      taskAnchorCounts,
      skippedItems,
    },
  };
}

function collectTextItems(root, currentPath = []) {
  const items = [];

  for (const child of root.children) {
    const childPath = [...currentPath, child.title].filter(Boolean);
    if (child.type === "Text") {
      items.push({
        uuid: child.uuid,
        title: child.title,
        path: childPath,
      });
    }

    if (child.children?.length) {
      items.push(...collectTextItems(child, childPath));
    }
  }

  return items;
}

function addChapter(project, title) {
  project.sequences.chapter += 1;
  const chapter = {
    id: formatId("chapter", project.sequences.chapter),
    title: title.trim() || `Chapter ${project.sequences.chapter}`,
    order: project.chapters.length + 1,
    scenes: [],
    summary: "",
  };
  project.chapters.push(chapter);
  return chapter;
}

function addScene(project, chapter, title) {
  project.sequences.scene += 1;
  const scene = {
    id: formatId("scene", project.sequences.scene),
    chapterId: chapter.id,
    title: title.trim() || `Scene ${project.sequences.scene}`,
    order: chapter.scenes.length + 1,
    synopsis: "",
    blocks: [],
  };
  chapter.scenes.push(scene);
  return scene;
}

function addBlock(project, scene, text) {
  project.sequences.block += 1;
  project.sequences.paragraph += 1;
  const block = {
    id: formatId("block", project.sequences.block),
    paragraphId: formatId("paragraph", project.sequences.paragraph),
    kind: guessBlockKind(text),
    order: scene.blocks.length + 1,
    text,
  };
  scene.blocks.push(block);
  return block;
}

function guessBlockKind(text) {
  const trimmed = text.trim();
  return /^["'\u201c]/.test(trimmed) ? "dialogue" : "narration";
}

function readDocumentParagraphs(uuid) {
  return splitParagraphs(readDocumentText(uuid));
}

function readDocumentText(uuid) {
  const rtfPath = path.join(dataRoot, uuid, "content.rtf");
  if (!existsSync(rtfPath)) {
    return "";
  }
  return rtfToText(readFileSync(rtfPath, "utf8"));
}

function splitParagraphs(text) {
  const normalized = String(text ?? "").replace(/\r\n?/g, "\n");
  const paragraphs = [];
  let current = [];

  for (const line of normalized.split("\n")) {
    if (!line.trim()) {
      if (current.length) {
        paragraphs.push(current.join("\n"));
        current = [];
      }
      continue;
    }

    current.push(line);
  }

  if (current.length) {
    paragraphs.push(current.join("\n"));
  }

  return paragraphs;
}

function readDocumentTasks(item, chapter, scene, sceneText, paragraphOffsets) {
  const commentsPath = path.join(dataRoot, item.uuid, "content.comments");
  if (!existsSync(commentsPath)) {
    return [];
  }

  const commentsXml = readFileSync(commentsPath, "utf8");
  const contentRtfPath = path.join(dataRoot, item.uuid, "content.rtf");
  const contentRtf = existsSync(contentRtfPath) ? readFileSync(contentRtfPath, "utf8") : "";
  const tasks = [];
  const sourcePath = formatBinderPath(item.path);

  for (const [commentIndex, comment] of parseComments(commentsXml).entries()) {
    const extractedText = extractFieldResult(contentRtf, comment.id);
    const fallbackParagraphIndex = paragraphOffsets.length > 0 ? 0 : -1;
    const range = findRange(sceneText, extractedText || "");
    const paragraphIndex = range
      ? findParagraphIndex(paragraphOffsets, range.startOffset)
      : fallbackParagraphIndex;
    const referenceParagraph = paragraphIndex >= 0 ? paragraphOffsets[paragraphIndex] : null;
    const selectedText =
      (range ? sceneText.slice(range.startOffset, range.endOffset) : "") ||
      referenceParagraph?.text ||
      extractedText ||
      "";
    const startOffset = range?.startOffset ?? referenceParagraph?.startOffset ?? 0;
    const endOffset = range?.endOffset ?? referenceParagraph?.endOffset ?? Math.min(startOffset + selectedText.length, sceneText.length);
    const anchorStatus = range?.matchType === "exact"
      ? "active"
      : range?.matchType === "normalized"
        ? "recovered"
        : referenceParagraph
          ? "approximate"
          : "orphaned";
    const nearbyBefore = paragraphIndex > 0 ? paragraphOffsets[paragraphIndex - 1].text : "";
    const nearbyAfter =
      paragraphIndex >= 0 && paragraphIndex < paragraphOffsets.length - 1
        ? paragraphOffsets[paragraphIndex + 1].text
        : "";
    tasks.push({
      id: `scrivener-comment-${item.uuid.toLowerCase()}-${comment.id.toLowerCase()}`,
      source: "scrivener-comment",
      scrivenerDocumentId: item.uuid,
      scrivenerCommentId: comment.id,
      scrivenerBinderPath: sourcePath,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      sceneId: scene.id,
      sceneTitle: scene.title,
      taskNumber: commentIndex + 1,
      title: createTaskTitle(comment.body, scene.title, tasks.length + 1),
      body: comment.body,
      description: comment.body,
      selectedText: selectedText.slice(0, 240),
      startOffset,
      endOffset,
      lineIndex: paragraphIndex,
      paragraphIndex,
      nearbyBefore,
      nearbyAfter,
      anchorMode: "location",
      anchorStatus,
      status: "open",
      createdAt: now,
    });
  }

  return tasks;
}

function parseComments(xml) {
  const comments = [];
  const pattern = /<Comment\b[^>]*\bID="([^"]+)"[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/Comment>/g;
  for (const match of xml.matchAll(pattern)) {
    const body = rtfToText(match[2]).replace(/\s+/g, " ").trim();
    if (body) {
      comments.push({ id: match[1], body });
    }
  }
  return comments;
}

function extractFieldResult(rtf, id) {
  const idIndex = rtf.indexOf(id);
  if (idIndex === -1) {
    return "";
  }

  const resultIndex = rtf.indexOf("\\fldrslt", idIndex);
  if (resultIndex === -1) {
    return "";
  }

  const groupStart = rtf.lastIndexOf("{", resultIndex);
  const groupEnd = findMatchingBrace(rtf, groupStart);
  if (groupStart === -1 || groupEnd === -1) {
    return "";
  }

  return rtfToText(rtf.slice(groupStart, groupEnd + 1)).replace(/\s+/g, " ").trim();
}

function findMatchingBrace(text, startIndex) {
  let depth = 0;
  for (let index = startIndex; index < text.length; index += 1) {
    if (text[index] === "{") {
      depth += 1;
    } else if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function findRange(content, selectedText) {
  const cleanSelectedText = String(selectedText ?? "").trim();
  if (!cleanSelectedText) {
    return null;
  }

  const exactIndex = content.indexOf(cleanSelectedText);
  if (exactIndex !== -1) {
    return {
      startOffset: exactIndex,
      endOffset: exactIndex + cleanSelectedText.length,
      matchType: "exact",
    };
  }

  const normalizedContent = normalizeSearchText(content);
  const normalizedNeedle = normalizeSearchText(cleanSelectedText);
  const normalizedIndex = normalizedContent.indexOf(normalizedNeedle);
  if (normalizedIndex === -1) {
    return null;
  }

  const startOffset = mapNormalizedOffset(content, normalizedIndex);
  const endOffset = mapNormalizedOffset(content, normalizedIndex + normalizedNeedle.length);
  return { startOffset, endOffset, matchType: "normalized" };
}

function findParagraphIndex(paragraphOffsets, offset) {
  if (!paragraphOffsets.length) {
    return -1;
  }

  for (let index = 0; index < paragraphOffsets.length; index += 1) {
    const paragraph = paragraphOffsets[index];
    if (offset >= paragraph.startOffset && offset <= paragraph.endOffset) {
      return index;
    }
  }

  return 0;
}

function normalizeSearchText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function mapNormalizedOffset(content, normalizedOffset) {
  let normalizedIndex = 0;
  let previousWasSpace = true;
  for (let index = 0; index < content.length; index += 1) {
    const isSpace = /\s/.test(content[index]);
    if (isSpace) {
      if (!previousWasSpace) {
        if (normalizedIndex >= normalizedOffset) {
          return index;
        }
        normalizedIndex += 1;
      }
      previousWasSpace = true;
      continue;
    }

    if (normalizedIndex >= normalizedOffset) {
      return index;
    }
    normalizedIndex += 1;
    previousWasSpace = false;
  }
  return content.length;
}

function createTaskTitle(body, sceneTitle, taskNumber) {
  const words = body
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7)
    .join(" ");
  return words ? `${words}${words.length < body.length ? "..." : ""}` : `${sceneTitle} task ${taskNumber}`;
}

function cleanImportedText(text) {
  const lines = String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const cleaned = [];
  let skippingMetadata = true;

  for (const line of lines) {
    if (!line.trim()) {
      if (cleaned.length > 0) {
        cleaned.push("");
      }
      continue;
    }

    if (skippingMetadata && isImportedMetadataLine(line.trim())) {
      continue;
    }

    skippingMetadata = false;
    cleaned.push(line);
  }

  return trimBlankLines(cleaned.join("\n"));
}

function isImportedMetadataLine(line) {
  return (
    /^[A-Za-z0-9]+(?:;[A-Za-z0-9-]+)+;?$/.test(line) ||
    /^•+$/.test(line) ||
    /^;+$/.test(line)
  );
}

function buildWorldModel(worldRoot, timelineRoot) {
  const world = {
    id: worldId,
    title: `${projectTitle} World`,
    createdAt: now,
    updatedAt: now,
    templates: [],
    entities: [],
    spines: [],
    nodes: [],
    edges: [],
    entityLinks: [],
    sequences: {
      template: 0,
      field: 0,
      entity: 0,
      spine: 0,
      node: 0,
      edge: 0,
      introduction: 0,
      link: 0,
    },
  };

  if (worldRoot) {
    const templateSheetsRoot = findDirectChildByTitle(worldRoot, "Template Sheets");
    const templateSheetItems = templateSheetsRoot
      ? collectTextItems(templateSheetsRoot, [worldRoot.title, templateSheetsRoot.title])
      : [];
    const templateCache = new Map();
    const findTemplateSheet = (templateName) =>
      templateSheetItems.find((item) => item.title === templateName) ?? null;
    const getTemplate = (templateName) => {
      const cachedTemplate = templateCache.get(templateName);
      if (cachedTemplate) {
        return cachedTemplate;
      }

      const templateSheet = findTemplateSheet(templateName);
      const templateSourceText = templateSheet ? readDocumentText(templateSheet.uuid) : "";
      const template = addTemplate(world, templateName, templateSourceText, {
        source: templateSheet ? "scrivener-template" : "manual",
        scrivenerDocumentId: templateSheet?.uuid,
        scrivenerBinderPath: templateSheet ? formatBinderPath(templateSheet.path) : undefined,
      });
      templateCache.set(templateName, template);
      return template;
    };

    for (const category of ["Characters", "Ships", "Weapons", "Planets", "Fauna", "Flora"]) {
      const categoryRoot = findDirectChildByTitle(worldRoot, category);
      if (!categoryRoot) {
        continue;
      }

      for (const item of collectTextItems(categoryRoot, [worldRoot.title, category])) {
        const notes = cleanImportedText(readDocumentText(item.uuid));
        if (!notes) {
          continue;
        }

        const templateName = resolveWorldTemplateName(category, item);
        const template = getTemplate(templateName);
        addEntity(world, template, item, notes);
      }
    }
  }

  if (timelineRoot) {
    const spine = addSpine(world, "Story Timeline", "thread", "Timeline material converted into project-native story sequence records.");
    for (const item of collectTextItems(timelineRoot, [timelineRoot.title])) {
      const summary = cleanImportedText(readDocumentText(item.uuid));
      if (!summary) {
        continue;
      }
      addNode(world, spine, item, summary.slice(0, 800));
    }
  }

  return world;
}

function buildImportedSourceMaterials({ novelFormatRoot, researchRoot, worldRoot, worldNotesRoot, trashRoot }) {
  const passageNotes = [];
  const sourceArchive = [];
  const report = {
    importedResearchNotes: 0,
    importedWorldNotes: 0,
    importedFrontMatterNotes: 0,
    importedAssetNotes: 0,
    archivedItems: 0,
    skippedTrashItems: 0,
  };

  if (novelFormatRoot) {
    const text = cleanImportedText(readDocumentText(novelFormatRoot.uuid));
    if (text) {
      sourceArchive.push({
        id: `scrivener-meta-${novelFormatRoot.uuid.toLowerCase()}`,
        title: novelFormatRoot.title || "Novel Format",
        kind: "meta",
        binderPath: formatBinderPath([novelFormatRoot.title]) || "Novel Format",
        scrivenerDocumentId: novelFormatRoot.uuid,
        bodyPreview: text.slice(0, 200),
      });
      report.archivedItems += 1;
    }
  }

  if (researchRoot) {
    for (const item of collectTextItems(researchRoot, [researchRoot.title])) {
      const text = cleanImportedText(readDocumentText(item.uuid));
      if (!text) {
        continue;
      }

      passageNotes.push(createImportedPassageNote(item, {
        noteType: "research",
        source: "scrivener-research",
        binderPath: formatBinderPath(item.path),
        groupTitle: formatBinderPath(item.path.slice(0, -1)) || researchRoot.title || "Research",
        now,
        body: text,
      }));
      report.importedResearchNotes += 1;
    }
  }

  if (worldNotesRoot) {
    for (const item of collectTextItems(worldNotesRoot, [worldRoot?.title, worldNotesRoot.title])) {
      const text = cleanImportedText(readDocumentText(item.uuid));
      if (!text) {
        continue;
      }

      passageNotes.push(createImportedPassageNote(item, {
        noteType: "research",
        source: "scrivener-world-note",
        binderPath: formatBinderPath(item.path),
        groupTitle: formatBinderPath(item.path.slice(0, -1)) || "WorldBuilding / Notes",
        now,
        body: text,
      }));
      report.importedWorldNotes += 1;
    }
  }

  const frontMatterRoot = worldRoot ? findDirectChildByTitle(worldRoot, "Front Matter") : null;
  if (frontMatterRoot) {
    for (const item of collectTextItems(frontMatterRoot, [worldRoot?.title, frontMatterRoot.title])) {
      const text = cleanImportedText(readDocumentText(item.uuid));
      if (!text) {
        continue;
      }

      passageNotes.push(createImportedPassageNote(item, {
        noteType: "research",
        source: "scrivener-front-matter",
        binderPath: formatBinderPath(item.path),
        groupTitle: formatBinderPath(item.path.slice(0, -1)) || "Front Matter",
        now,
        body: text,
      }));
      report.importedFrontMatterNotes += 1;
    }

    for (const asset of collectAssetItems(frontMatterRoot, [worldRoot?.title, frontMatterRoot.title])) {
      sourceArchive.push({
        id: `scrivener-asset-${asset.uuid.toLowerCase()}`,
        title: asset.title || "Front Matter Asset",
        kind: asset.type.toLowerCase(),
        binderPath: formatBinderPath(asset.path),
        scrivenerDocumentId: asset.uuid,
        assetPath: getAssetPath(asset.uuid),
      });
      report.importedAssetNotes += 1;
    }
  }

  if (trashRoot) {
    for (const item of collectTextItems(trashRoot, [trashRoot.title])) {
      const text = cleanImportedText(readDocumentText(item.uuid));
      if (!text) {
        report.skippedTrashItems += 1;
        continue;
      }

      sourceArchive.push({
        id: `scrivener-trash-${item.uuid.toLowerCase()}`,
        title: item.title || "Untitled trash item",
        kind: "trash",
        binderPath: formatBinderPath(item.path),
        scrivenerDocumentId: item.uuid,
        bodyPreview: text.slice(0, 200),
      });
      report.archivedItems += 1;
    }

    for (const asset of collectAssetItems(trashRoot, [trashRoot.title])) {
      sourceArchive.push({
        id: `scrivener-trash-asset-${asset.uuid.toLowerCase()}`,
        title: asset.title || "Trash asset",
        kind: asset.type.toLowerCase(),
        binderPath: formatBinderPath(asset.path),
        scrivenerDocumentId: asset.uuid,
        assetPath: getAssetPath(asset.uuid),
      });
      report.archivedItems += 1;
    }
  }

  return {
    passageNotes,
    sourceArchive,
    report: {
      ...report,
      importedNotes: passageNotes.length,
      archivedItems: sourceArchive.length,
    },
  };
}

function addTemplate(world, name, sourceText = "", options = {}) {
  world.sequences.template += 1;
  world.sequences.field += 1;
  const key = slugify(name);
  const fieldDefinitions = buildTemplateFieldDefinitions(sourceText);
  const template = {
    id: formatId("template", world.sequences.template),
    key,
    name,
    description: sourceText.trim()
      ? `${name} template sheet imported from Scrivener.`
      : `${name} reference records imported into the project-native world model.`,
    source: String(options.source ?? (sourceText.trim() ? "scrivener-template" : "")).trim() || undefined,
    scrivenerDocumentId: String(options.scrivenerDocumentId ?? "").trim() || undefined,
    scrivenerBinderPath: String(options.scrivenerBinderPath ?? "").trim() || undefined,
    sourceText,
    fields: [
      {
        id: formatId("field", world.sequences.field),
        key: "category",
        label: "Category",
        valueType: "text",
        required: false,
        description: "World reference category.",
      },
      ...fieldDefinitions.map((field) => {
        world.sequences.field += 1;
        return {
          id: formatId("field", world.sequences.field),
          key: field.key,
          label: field.label,
          valueType: "text",
          required: false,
          description: field.description,
        };
      }),
    ],
    createdAt: now,
  };
  world.templates.push(template);
  return template;
}

function buildTemplateFieldDefinitions(sourceText) {
  const lines = String(sourceText ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  const definitions = [];
  const seenKeys = new Set();

  for (const line of lines) {
    if (!/[:]\s*$/.test(line)) {
      continue;
    }

    const label = line.replace(/:\s*$/, "").trim();
    if (!label) {
      continue;
    }

    const key = slugify(label);
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    definitions.push({
      key,
      label,
      description: `${label} field imported from the Scrivener template sheet.`,
    });
  }

  return definitions;
}

function createImportedPassageNote(item, options) {
  const body = trimBlankLines(String(options.body ?? ""));
  const selectedText = body.replace(/\s+/g, " ").trim().slice(0, 160);
  const title = item.title?.trim() || createImportedNoteTitle(body, options.noteType);
  const groupTitle = String(options.groupTitle ?? "Scrivener Import").trim() || "Scrivener Import";

  return {
    id: `scrivener-${options.source}-${item.uuid.toLowerCase()}`,
    noteType: options.noteType ?? "research",
    chapterId: `scrivener-${slugify(groupTitle)}-${item.uuid.toLowerCase()}`,
    chapterTitle: groupTitle,
    sceneId: `scrivener-${slugify(title)}-${item.uuid.toLowerCase()}`,
    sceneTitle: title,
    selectedText: selectedText || title,
    startOffset: 0,
    endOffset: Math.max(0, selectedText.length),
    body,
    title,
    createdAt: options.now,
    updatedAt: options.now,
    source: options.source,
    scrivenerDocumentId: item.uuid,
    scrivenerBinderPath: options.binderPath,
    attachmentConfidence: options.source === "scrivener-front-matter" ? 0.2 : 0.5,
  };
}

function createImportedNoteTitle(body, fallbackType) {
  const text = String(body ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    return fallbackType === "research" ? "Research import" : "Imported note";
  }

  const words = text.split(" ").filter(Boolean).slice(0, 7).join(" ");
  return words.length < text.length ? `${words}...` : words;
}

function trimBlankLines(text) {
  return String(text ?? "")
    .replace(/^(?:[ \t]*\n)+/g, "")
    .replace(/(?:\n[ \t]*)+$/g, "");
}

function collectAssetItems(root, currentPath = []) {
  const items = [];

  for (const child of root.children) {
    const childPath = [...currentPath, child.title].filter(Boolean);
    if (child.type === "Image" || child.type === "PDF") {
      items.push({
        uuid: child.uuid,
        title: child.title,
        type: child.type,
        path: childPath,
      });
    }

    if (child.children?.length) {
      items.push(...collectAssetItems(child, childPath));
    }
  }

  return items;
}

function getAssetPath(uuid) {
  const candidates = [
    path.join(dataRoot, uuid, "content.png"),
    path.join(dataRoot, uuid, "content.jpg"),
    path.join(dataRoot, uuid, "content.jpeg"),
    path.join(dataRoot, uuid, "content.pdf"),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? "";
}

function addEntity(world, template, item, notes) {
  world.sequences.entity += 1;
  world.entities.push({
    id: `scrivener-entity-${item.uuid.toLowerCase()}`,
    name: item.title.trim() || `Entity ${world.sequences.entity}`,
    notes,
    fields: {
      category: template.name,
    },
    templateOrigin: {
      templateId: template.id,
      templateKey: template.key,
    },
    source: "scrivener-worldbuilding",
    scrivenerDocumentId: item.uuid,
    scrivenerBinderPath: formatBinderPath(item.path),
    createdAt: now,
    updatedAt: now,
  });
}

function addSpine(world, label, kind, description) {
  world.sequences.spine += 1;
  const spine = {
    id: formatId("spine", world.sequences.spine),
    key: slugify(label),
    label,
    kind,
    description,
    nodeIds: [],
    createdAt: now,
  };
  world.spines.push(spine);
  return spine;
}

function addNode(world, spine, item, summary) {
  world.sequences.node += 1;
  const node = {
    id: `scrivener-node-${item.uuid.toLowerCase()}`,
    spineId: spine.id,
    label: item.title || `Timeline ${world.sequences.node}`,
    summary,
    order: spine.nodeIds.length + 1,
    linkedEntityIds: [],
    manuscriptAnchors: [],
    source: "scrivener-timeline",
    scrivenerDocumentId: item.uuid,
    scrivenerBinderPath: formatBinderPath(item.path),
    createdAt: now,
  };
  spine.nodeIds.push(node.id);
  world.nodes.push(node);
}

function resolveWorldTemplateName(category, item) {
  const pathSegments = item.path.map((segment) => String(segment ?? "").toLowerCase());
  const itemTitle = String(item.title ?? "").trim().toLowerCase();
  if (pathSegments.includes("stations") || itemTitle === "station") {
    return "Station";
  }

  return WORLD_CATEGORY_TEMPLATES[category] ?? category;
}

function formatBinderPath(pathParts) {
  return pathParts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" / ");
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function formatId(prefix, value) {
  return `${prefix}-${String(value).padStart(4, "0")}`;
}

function rtfToText(rtf) {
  let output = "";
  const stack = [{ skip: false }];
  let index = 0;
  let ucSkip = 1;

  while (index < rtf.length) {
    const char = rtf[index];
    const state = stack.at(-1);

    if (char === "{") {
      stack.push({ skip: state.skip });
      index += 1;
      continue;
    }

    if (char === "}") {
      if (stack.length > 1) {
        stack.pop();
      }
      index += 1;
      continue;
    }

    if (char !== "\\") {
      if (!state.skip) {
        output += char;
      }
      index += 1;
      continue;
    }

    const next = rtf[index + 1];
    if (next === "\\" || next === "{" || next === "}") {
      if (!state.skip) {
        output += next;
      }
      index += 2;
      continue;
    }

    if (next === "'") {
      if (!state.skip) {
        const hex = rtf.slice(index + 2, index + 4);
        output += decodeCodePageByte(hex);
      }
      index += 4;
      continue;
    }

    const match = /^\\([a-zA-Z*]+)(-?\d+)? ?/.exec(rtf.slice(index));
    if (!match) {
      index += 1;
      continue;
    }

    const word = match[1];
    const numeric = match[2] === undefined ? null : Number(match[2]);
    index += match[0].length;

    if (word === "*") {
      state.skip = true;
      continue;
    }

    if (["fonttbl", "colortbl", "stylesheet", "info", "pict", "object", "fldinst"].includes(word)) {
      state.skip = true;
      continue;
    }

    if (state.skip) {
      continue;
    }

    if (word === "uc" && Number.isInteger(numeric)) {
      ucSkip = Math.max(0, numeric);
      continue;
    }

    if (word === "u" && Number.isInteger(numeric)) {
      output += String.fromCodePoint(numeric < 0 ? numeric + 65536 : numeric);
      index = skipUnicodeFallback(rtf, index, ucSkip);
      continue;
    }

    if (word === "par" || word === "line") {
      output += "\n";
      continue;
    }

    if (word === "tab") {
      output += "\t";
      continue;
    }

    const replacements = {
      endash: "\u2013",
      emdash: "\u2014",
      bullet: "\u2022",
      lquote: "\u2018",
      rquote: "\u2019",
      ldblquote: "\u201c",
      rdblquote: "\u201d",
    };

    if (replacements[word]) {
      output += replacements[word];
    }
  }

  return output
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function inferProjectTitle(indexFilePath) {
  const projectRoot = path.dirname(indexFilePath);
  const folderName = path.basename(projectRoot).replace(/\.scriv$/i, "").trim();
  return folderName || "Imported Scrivener Project";
}

function skipUnicodeFallback(text, startIndex, fallbackLength) {
  let index = startIndex;
  for (let skipped = 0; skipped < fallbackLength && index < text.length; skipped += 1) {
    if (text[index] === "\\" && text[index + 1] === "'") {
      index += 4;
    } else {
      index += 1;
    }
  }
  return index;
}

function decodeCodePageByte(hex) {
  const value = Number.parseInt(hex, 16);
  if (!Number.isFinite(value)) {
    return "";
  }

  const replacements = {
    0x91: "\u2018",
    0x92: "\u2019",
    0x93: "\u201c",
    0x94: "\u201d",
    0x95: "\u2022",
    0x96: "\u2013",
    0x97: "\u2014",
    0x85: "\u2026",
  };

  return replacements[value] ?? String.fromCharCode(value);
}
