// Intent: manage a ComfyUI-style local model folder without letting editor UI inspect files directly.
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { basename, join, resolve as resolvePath } from "node:path";

import type { AiModelTier, AiTaskType } from "./local-ai-types.ts";

export type LocalAiModelCategory = "llm" | "embeddings" | "speech" | "voice";
export type LocalAiModelRuntime =
  | "llama.cpp"
  | "whisper.cpp"
  | "onnxruntime-web"
  | "transformers.js"
  | "unknown";
export type LocalAiModelFormat = "gguf" | "onnx" | "bin" | "safetensors" | "unknown";
export type LocalAiModelStatus = "registered" | "unregistered" | "invalid";

export interface LocalAiModelSource {
  type: "huggingface" | "local" | "manual";
  repoId?: string;
  revision?: string;
  url?: string;
}

export interface LocalAiModelDescriptor {
  id: string;
  displayName: string;
  category: LocalAiModelCategory;
  folderName: string;
  modelPath: string;
  manifestPath: string;
  artifactPaths: string[];
  runtime: LocalAiModelRuntime;
  format: LocalAiModelFormat;
  tier: AiModelTier | "";
  taskTypes: AiTaskType[];
  contextWindow: number | null;
  checksum: string;
  source: LocalAiModelSource;
  status: LocalAiModelStatus;
  validationMessages: string[];
}

export interface LocalAiModelFolderRecord {
  category: LocalAiModelCategory;
  label: string;
  path: string;
  exists: boolean;
  modelCount: number;
  registeredCount: number;
  unregisteredCount: number;
  invalidCount: number;
}

export interface LocalAiModelBrowseLink {
  id: string;
  label: string;
  url: string;
  description: string;
  categories: LocalAiModelCategory[];
}

export interface LocalAiModelLibrarySnapshot {
  ok: true;
  modelRoot: string;
  rootExists: boolean;
  manifestFileName: string;
  folders: LocalAiModelFolderRecord[];
  models: LocalAiModelDescriptor[];
  browseLinks: LocalAiModelBrowseLink[];
}

export const LOCAL_AI_MODEL_MANIFEST_FILE_NAME = "abe-model.json";

export const LOCAL_AI_MODEL_CATEGORY_FOLDERS: Array<{
  category: LocalAiModelCategory;
  label: string;
}> = [
  { category: "llm", label: "Language models" },
  { category: "embeddings", label: "Embeddings" },
  { category: "speech", label: "Speech recognition" },
  { category: "voice", label: "Voice and narration" },
];

export const LOCAL_AI_MODEL_BROWSE_LINKS: LocalAiModelBrowseLink[] = [
  {
    id: "hugging-face-models",
    label: "Hugging Face Models",
    url: "https://huggingface.co/models",
    description: "Browse the public model catalog before downloading local artifacts.",
    categories: ["llm", "embeddings", "speech", "voice"],
  },
  {
    id: "hugging-face-gguf",
    label: "GGUF language models",
    url: "https://huggingface.co/models?library=gguf",
    description: "Find GGUF files that can be placed under the llm folder for llama.cpp.",
    categories: ["llm"],
  },
  {
    id: "hugging-face-text-generation",
    label: "Text generation",
    url: "https://huggingface.co/models?pipeline_tag=text-generation",
    description: "Compare local text models for titles, tags, summaries, and reviews.",
    categories: ["llm"],
  },
  {
    id: "hugging-face-embeddings",
    label: "Embedding models",
    url: "https://huggingface.co/models?pipeline_tag=sentence-similarity",
    description: "Browse models useful for local search, similarity, and continuity retrieval.",
    categories: ["embeddings"],
  },
  {
    id: "hugging-face-asr",
    label: "Speech recognition",
    url: "https://huggingface.co/models?pipeline_tag=automatic-speech-recognition",
    description: "Browse ASR models that can later back narration follow and transcript workflows.",
    categories: ["speech"],
  },
];

const SUPPORTED_ARTIFACT_EXTENSIONS = new Set([".gguf", ".onnx", ".bin", ".safetensors"]);

// Intent: expose a stable snapshot that the browser can render without filesystem access.
export async function createLocalAiModelLibrarySnapshot(modelRoot: string): Promise<LocalAiModelLibrarySnapshot> {
  const normalizedRoot = normalizeModelRoot(modelRoot);
  const rootExists = await directoryExists(normalizedRoot);
  const folderResults = await Promise.all(
    LOCAL_AI_MODEL_CATEGORY_FOLDERS.map((folder) => scanModelCategory(normalizedRoot, folder.category, folder.label)),
  );
  const models = folderResults.flatMap((result) => result.models);
  const folders = folderResults.map((result) => ({
    category: result.category,
    label: result.label,
    path: result.path,
    exists: result.exists,
    modelCount: result.models.length,
    registeredCount: result.models.filter((model) => model.status === "registered").length,
    unregisteredCount: result.models.filter((model) => model.status === "unregistered").length,
    invalidCount: result.models.filter((model) => model.status === "invalid").length,
  }));

  return {
    ok: true,
    modelRoot: normalizedRoot,
    rootExists,
    manifestFileName: LOCAL_AI_MODEL_MANIFEST_FILE_NAME,
    folders,
    models,
    browseLinks: LOCAL_AI_MODEL_BROWSE_LINKS.map((link) => ({ ...link, categories: [...link.categories] })),
  };
}

// Intent: create only the top-level folders that the model manager owns.
export async function ensureLocalAiModelLibraryFolders(modelRoot: string): Promise<LocalAiModelLibrarySnapshot> {
  const normalizedRoot = normalizeModelRoot(modelRoot);
  await mkdir(normalizedRoot, { recursive: true });
  await Promise.all(
    LOCAL_AI_MODEL_CATEGORY_FOLDERS.map((folder) => mkdir(join(normalizedRoot, folder.category), { recursive: true })),
  );
  return createLocalAiModelLibrarySnapshot(normalizedRoot);
}

export function normalizeModelRoot(candidate: string): string {
  const normalized = typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : "C:\\Models\\AuthorSuite";
  return resolvePath(normalized);
}

async function scanModelCategory(
  modelRoot: string,
  category: LocalAiModelCategory,
  label: string,
): Promise<{
  category: LocalAiModelCategory;
  label: string;
  path: string;
  exists: boolean;
  models: LocalAiModelDescriptor[];
}> {
  // Intent: scan one model category without following arbitrary nested code trees.
  const categoryPath = join(modelRoot, category);
  const exists = await directoryExists(categoryPath);
  if (!exists) {
    return {
      category,
      label,
      path: categoryPath,
      exists: false,
      models: [],
    };
  }

  const entries = await safeReadDir(categoryPath);
  const models: LocalAiModelDescriptor[] = [];
  for (const entry of entries) {
    const entryPath = join(categoryPath, entry.name);
    if (entry.isDirectory()) {
      models.push(await scanModelDirectory(entryPath, category));
      continue;
    }

    if (entry.isFile() && isSupportedArtifactName(entry.name)) {
      models.push(createLooseArtifactDescriptor(entryPath, category));
    }
  }

  return {
    category,
    label,
    path: categoryPath,
    exists: true,
    models: models.sort((left, right) => left.displayName.localeCompare(right.displayName)),
  };
}

async function scanModelDirectory(
  modelPath: string,
  category: LocalAiModelCategory,
): Promise<LocalAiModelDescriptor> {
  const manifestPath = join(modelPath, LOCAL_AI_MODEL_MANIFEST_FILE_NAME);
  const artifactPaths = await listSupportedArtifacts(modelPath);
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    return normalizeManifestDescriptor(manifest, {
      category,
      folderName: basename(modelPath),
      modelPath,
      manifestPath,
      artifactPaths,
    });
  } catch (error) {
    const fallback = createLooseDirectoryDescriptor(modelPath, category, artifactPaths);
    if (artifactPaths.length > 0) {
      return fallback;
    }

    return {
      ...fallback,
      status: "invalid",
      validationMessages: [
        error instanceof SyntaxError
          ? `${LOCAL_AI_MODEL_MANIFEST_FILE_NAME} is not valid JSON.`
          : `Missing ${LOCAL_AI_MODEL_MANIFEST_FILE_NAME} or supported model artifact.`,
      ],
    };
  }
}

function normalizeManifestDescriptor(
  manifest: any,
  fallback: {
    category: LocalAiModelCategory;
    folderName: string;
    modelPath: string;
    manifestPath: string;
    artifactPaths: string[];
  },
): LocalAiModelDescriptor {
  // Intent: accept repository-owned model metadata while preserving scan evidence for validation.
  const validationMessages: string[] = [];
  const inferred = inferModelRuntimeAndFormat(fallback.artifactPaths[0] ?? "");
  const id = normalizeRequiredString(manifest?.id, fallback.folderName, validationMessages, "id");
  const displayName = normalizeOptionalString(manifest?.displayName) || id;
  const runtime = normalizeRuntime(manifest?.runtime) || inferred.runtime;
  const format = normalizeFormat(manifest?.format) || inferred.format;
  const tier = normalizeTier(manifest?.tier);
  const taskTypes = normalizeTaskTypes(manifest?.taskTypes);
  const checksum = normalizeOptionalString(manifest?.checksum);
  const contextWindow = normalizeContextWindow(manifest?.contextWindow);

  if (!tier) {
    validationMessages.push("Missing model tier.");
  }
  if (taskTypes.length === 0) {
    validationMessages.push("Missing taskTypes.");
  }
  if (fallback.artifactPaths.length === 0) {
    validationMessages.push("No supported model artifact found.");
  }

  return {
    id,
    displayName,
    category: fallback.category,
    folderName: fallback.folderName,
    modelPath: fallback.modelPath,
    manifestPath: fallback.manifestPath,
    artifactPaths: fallback.artifactPaths,
    runtime,
    format,
    tier,
    taskTypes,
    contextWindow,
    checksum,
    source: normalizeSource(manifest?.source),
    status: validationMessages.length > 0 ? "invalid" : "registered",
    validationMessages,
  };
}

function createLooseDirectoryDescriptor(
  modelPath: string,
  category: LocalAiModelCategory,
  artifactPaths: string[],
): LocalAiModelDescriptor {
  const folderName = basename(modelPath);
  const inferred = inferModelRuntimeAndFormat(artifactPaths[0] ?? "");
  return {
    id: folderName,
    displayName: folderName,
    category,
    folderName,
    modelPath,
    manifestPath: join(modelPath, LOCAL_AI_MODEL_MANIFEST_FILE_NAME),
    artifactPaths,
    runtime: inferred.runtime,
    format: inferred.format,
    tier: "",
    taskTypes: [],
    contextWindow: null,
    checksum: "",
    source: { type: "manual" },
    status: "unregistered",
    validationMessages: [`Add ${LOCAL_AI_MODEL_MANIFEST_FILE_NAME} to register this model for tasks.`],
  };
}

function createLooseArtifactDescriptor(
  artifactPath: string,
  category: LocalAiModelCategory,
): LocalAiModelDescriptor {
  const inferred = inferModelRuntimeAndFormat(artifactPath);
  const fileName = basename(artifactPath);
  return {
    id: fileName,
    displayName: fileName,
    category,
    folderName: "",
    modelPath: artifactPath,
    manifestPath: "",
    artifactPaths: [artifactPath],
    runtime: inferred.runtime,
    format: inferred.format,
    tier: "",
    taskTypes: [],
    contextWindow: null,
    checksum: "",
    source: { type: "manual" },
    status: "unregistered",
    validationMessages: [`Move this artifact into its own folder with ${LOCAL_AI_MODEL_MANIFEST_FILE_NAME}.`],
  };
}

async function listSupportedArtifacts(modelPath: string): Promise<string[]> {
  const entries = await safeReadDir(modelPath);
  return entries
    .filter((entry) => entry.isFile() && isSupportedArtifactName(entry.name))
    .map((entry) => join(modelPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function inferModelRuntimeAndFormat(filePath: string): {
  runtime: LocalAiModelRuntime;
  format: LocalAiModelFormat;
} {
  const lowerPath = filePath.toLowerCase();
  if (lowerPath.endsWith(".gguf")) {
    return { runtime: "llama.cpp", format: "gguf" };
  }
  if (lowerPath.endsWith(".onnx")) {
    return { runtime: "onnxruntime-web", format: "onnx" };
  }
  if (lowerPath.endsWith(".bin")) {
    return { runtime: "whisper.cpp", format: "bin" };
  }
  if (lowerPath.endsWith(".safetensors")) {
    return { runtime: "transformers.js", format: "safetensors" };
  }
  return { runtime: "unknown", format: "unknown" };
}

function normalizeSource(candidate: any): LocalAiModelSource {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return { type: "manual" };
  }

  const sourceType = candidate.type === "huggingface" || candidate.type === "local"
    ? candidate.type
    : "manual";
  return {
    type: sourceType,
    repoId: normalizeOptionalString(candidate.repoId),
    revision: normalizeOptionalString(candidate.revision),
    url: normalizeOptionalString(candidate.url),
  };
}

function normalizeRuntime(candidate: unknown): LocalAiModelRuntime | "" {
  return ["llama.cpp", "whisper.cpp", "onnxruntime-web", "transformers.js", "unknown"].includes(String(candidate))
    ? String(candidate) as LocalAiModelRuntime
    : "";
}

function normalizeFormat(candidate: unknown): LocalAiModelFormat | "" {
  return ["gguf", "onnx", "bin", "safetensors", "unknown"].includes(String(candidate))
    ? String(candidate) as LocalAiModelFormat
    : "";
}

function normalizeTier(candidate: unknown): AiModelTier | "" {
  return ["tiny", "standard", "large"].includes(String(candidate))
    ? String(candidate) as AiModelTier
    : "";
}

function normalizeTaskTypes(candidate: unknown): AiTaskType[] {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return [...new Set(candidate
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean))] as AiTaskType[];
}

function normalizeContextWindow(candidate: unknown): number | null {
  const value = Number(candidate);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value);
}

function normalizeRequiredString(
  candidate: unknown,
  fallback: string,
  validationMessages: string[],
  fieldName: string,
): string {
  const value = normalizeOptionalString(candidate);
  if (value) {
    return value;
  }

  validationMessages.push(`Missing ${fieldName}.`);
  return fallback;
}

function normalizeOptionalString(candidate: unknown): string {
  return typeof candidate === "string" ? candidate.trim() : "";
}

function isSupportedArtifactName(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return [...SUPPORTED_ARTIFACT_EXTENSIONS].some((extension) => lowerName.endsWith(extension));
}

async function directoryExists(pathname: string): Promise<boolean> {
  try {
    const details = await stat(pathname);
    return details.isDirectory();
  } catch {
    return false;
  }
}

async function safeReadDir(pathname: string) {
  try {
    return await readdir(pathname, { withFileTypes: true });
  } catch {
    return [];
  }
}
