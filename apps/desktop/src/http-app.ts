// Intent: expose the desktop HTTP surface that serves the editor, workspace data, settings, and local services.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { appendFile, copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, extname, isAbsolute, join, relative, resolve as resolvePath, sep as pathSeparator } from "node:path";
import { fileURLToPath } from "node:url";

import { createDesktopSettingsSnapshot, updateDesktopSettingsSnapshot } from "./settings.ts";
import {
  createDesktopWorkspaceSnapshot,
  createServaVitaeProjectLibrarySeed,
} from "./workspace.ts";
import {
  loadProjectLibrarySeedFromPath,
} from "./project-source.ts";
import {
  logDesktopError,
  logDesktopInfo,
  logDesktopWarn,
} from "./logger.ts";
import {
  createDesktopRealtimeSpeechBridge,
  createWhisperCppCapability,
} from "./realtime-speech-bridge.ts";
import {
  createLocalAiModelLibrarySnapshot,
  ensureLocalAiModelLibraryFolders,
  LlamaCppProvider,
  LocalAiRouter,
  type AiRequest,
} from "../../../services/local-ai/index.ts";

// Intent: resolve every editor asset relative to this module so desktop launchers can run from any cwd.
const INDEX_HTML_PATH = fileURLToPath(new URL("../../editor/public/index.html", import.meta.url));
const EDITOR_PUBLIC_ROOT = fileURLToPath(new URL("../../editor/public/", import.meta.url));
const SERVA_VITAE_PROJECT_LIBRARY_JS_PATH = fileURLToPath(
  new URL("../../editor/public/serva-vitae-project-library.js", import.meta.url),
);
const WRITING_GOALS_DASHBOARD_CSS_PATH = fileURLToPath(
  new URL("../../editor/public/writing-goals-dashboard.css", import.meta.url),
);
const SESSION_TRACKER_SLEEPING_PEN_SVG_PATH = fileURLToPath(
  new URL("../../editor/public/assets/icons/session-tracker-sleeping-pen.svg", import.meta.url),
);
const SESSION_TRACKER_WORKING_PEN_SVG_PATH = fileURLToPath(
  new URL("../../editor/public/assets/icons/session-tracker-working-pen.svg", import.meta.url),
);
const SESSION_TRACKER_FLAMING_PEN_SVG_PATH = fileURLToPath(
  new URL("../../editor/public/assets/icons/session-tracker-flaming-pen.svg", import.meta.url),
);
const METADATA_FOLDER_MANIFEST_FILE_NAME = "_folder.json";
const METADATA_NOTE_FILE_STEM_MAX_LENGTH = 69;
const SUPPORTED_PROJECT_SCHEMA_VERSION = 2;
const APP_JS_PATH = fileURLToPath(new URL("../../editor/public/app.js", import.meta.url));
const EDITOR_MODEL_JS_PATH = fileURLToPath(
  new URL("../../editor/public/editor-model.js", import.meta.url),
);
const SESSION_TRACKER_ICONS_JS_PATH = fileURLToPath(
  new URL("../../editor/public/session-tracker-icons.js", import.meta.url),
);
const STYLES_CSS_PATH = fileURLToPath(new URL("../../editor/public/styles.css", import.meta.url));
const DEVELOPER_RUNTIME_LOG_DIR = process.env.ABE_DEVELOPER_RUNTIME_LOG_DIR
  ?? resolvePath(process.cwd(), "logs");
const DEVELOPER_RUNTIME_LOG_FILE_PREFIX = "developer-runtime-session-";
const DEVELOPER_RUNTIME_LOG_FILE_EXTENSION = ".txt";
const DEVELOPER_RUNTIME_LOG_RETENTION_SESSIONS_DEFAULT = 20;
let developerRuntimeLogSessionStatePromise: Promise<DeveloperRuntimeLogSessionState> | null = null;
let developerRuntimeLogAutoPruneEnabled = true;
let developerRuntimeLogRetentionSessions = DEVELOPER_RUNTIME_LOG_RETENTION_SESSIONS_DEFAULT;

interface DeveloperRuntimeLogSessionState {
  logDirectory: string;
  fileName: string;
  filePath: string;
  sessionNumber: number;
  startedAt: string;
}

interface DeveloperRuntimeLogSessionFile {
  fileName: string;
  filePath: string;
  sessionNumber: number;
  createdAtToken: string;
  modifiedAtMs: number;
}

export interface DesktopHttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string | Buffer;
}

export interface DesktopHttpRequest {
  method?: string;
  pathname: string;
  body?: string;
}

export interface DesktopProjectPackageFaultInjector {
  afterStructuredSidecarWrite?: (details: { kind: "scene" | "metadata"; count: number; filePath: string }) => Promise<void> | void;
}

const localAiRouter = new LocalAiRouter(new LlamaCppProvider());
const realtimeSpeechBridge = createDesktopRealtimeSpeechBridge({
  getSettings: createDesktopSettingsSnapshot,
});

// Intent: serve local realtime speech capabilities from both desktop GET paths used by the host.
function createRealtimeSpeechProvidersResponse(): DesktopHttpResponse {
  const result = realtimeSpeechBridge.listProviders();
  logDesktopInfo("realtime-speech", "Served local realtime speech provider capabilities.", {
    providerCount: result.providers?.length ?? 0,
    sidecarUrl: result.sidecar?.url ?? "",
  });
  return jsonResponse(result.statusCode, result, apiCorsHeaders());
}

// Intent: expose stop-time whisper.cpp availability without requiring the editor to know filesystem paths.
function createWhisperCppCapabilityResponse(): DesktopHttpResponse {
  const result = createWhisperCppCapability(process.cwd());
  logDesktopInfo("whisper-cpp", "Served local whisper.cpp capability.", {
    available: result.available,
    binary: result.binary,
    model: result.model,
  });
  return jsonResponse(200, result, apiCorsHeaders());
}

// Intent: serve read-only editor assets and boot snapshots for simple GET requests.
export function createDesktopResponse(pathname: string): DesktopHttpResponse {
  if (pathname === "/" || pathname === "/index.html") {
    return textResponse(200, "text/html; charset=utf-8", readFileSync(INDEX_HTML_PATH, "utf8"));
  }

  if (pathname === "/app.js") {
    return textResponse(200, "text/javascript; charset=utf-8", readFileSync(APP_JS_PATH, "utf8"));
  }

  if (pathname === "/serva-vitae-project-library.js") {
    return textResponse(
      200,
      "text/javascript; charset=utf-8",
      readFileSync(SERVA_VITAE_PROJECT_LIBRARY_JS_PATH, "utf8"),
    );
  }

  if (pathname === "/editor-model.js") {
    return textResponse(
      200,
      "text/javascript; charset=utf-8",
      readFileSync(EDITOR_MODEL_JS_PATH, "utf8"),
    );
  }

  if (pathname === "/session-tracker-icons.js") {
    return textResponse(
      200,
      "text/javascript; charset=utf-8",
      readFileSync(SESSION_TRACKER_ICONS_JS_PATH, "utf8"),
    );
  }

  if (pathname === "/styles.css") {
    return textResponse(200, "text/css; charset=utf-8", readFileSync(STYLES_CSS_PATH, "utf8"));
  }

  if (pathname === "/writing-goals-dashboard.css") {
    return textResponse(
      200,
      "text/css; charset=utf-8",
      readFileSync(WRITING_GOALS_DASHBOARD_CSS_PATH, "utf8"),
    );
  }

  if (pathname === "/assets/icons/session-tracker-sleeping-pen.svg") {
    return textResponse(
      200,
      "image/svg+xml; charset=utf-8",
      readFileSync(SESSION_TRACKER_SLEEPING_PEN_SVG_PATH, "utf8"),
    );
  }

  if (pathname === "/assets/icons/session-tracker-working-pen.svg") {
    return textResponse(
      200,
      "image/svg+xml; charset=utf-8",
      readFileSync(SESSION_TRACKER_WORKING_PEN_SVG_PATH, "utf8"),
    );
  }

  if (pathname === "/assets/icons/session-tracker-flaming-pen.svg") {
    return textResponse(
      200,
      "image/svg+xml; charset=utf-8",
      readFileSync(SESSION_TRACKER_FLAMING_PEN_SVG_PATH, "utf8"),
    );
  }

  if (pathname === "/api/workspace") {
    try {
      const workspace = createDesktopWorkspaceSnapshot();
      logDesktopInfo("workspace", "Served desktop workspace snapshot.", {
        lineCount: workspace.project.stats.lineCount,
        sceneCount: workspace.project.stats.sceneCount,
      });
      return textResponse(200, "application/json; charset=utf-8", JSON.stringify(workspace), apiCorsHeaders());
    } catch (error) {
      logDesktopError("workspace", "Failed to build the desktop workspace snapshot.", {
        error,
      });
      return jsonResponse(500, {
        ok: false,
        message: "Unable to build the desktop workspace snapshot.",
      }, apiCorsHeaders());
    }
  }

  if (pathname === "/api/project-library") {
    try {
      const projectLibrary = createServaVitaeProjectLibrarySeed();
      logDesktopInfo("project-library", "Served the Serva Vitae project library seed.", {
        projectCount: projectLibrary.projects.length,
        activeProjectId: projectLibrary.activeProjectId,
      });
      return textResponse(200, "application/json; charset=utf-8", JSON.stringify(projectLibrary), apiCorsHeaders());
    } catch (error) {
      logDesktopError("project-library", "Failed to build the Serva Vitae project library seed.", {
        error,
      });
      return jsonResponse(500, {
        ok: false,
        message: "Unable to build the Serva Vitae project library seed.",
      }, apiCorsHeaders());
    }
  }

  if (pathname === "/api/settings") {
    return textResponse(
      200,
      "application/json; charset=utf-8",
      JSON.stringify(createDesktopSettingsSnapshot()),
      apiCorsHeaders(),
    );
  }

  if (pathname === "/api/realtime-speech/providers") {
    return createRealtimeSpeechProvidersResponse();
  }

  if (pathname === "/api/whisper-cpp/capability") {
    return createWhisperCppCapabilityResponse();
  }

  const editorPublicAsset = serveEditorPublicAsset(pathname);
  if (editorPublicAsset) {
    return editorPublicAsset;
  }

  return textResponse(
    404,
    "text/plain; charset=utf-8",
    "Not found. Try '/', '/app.js', '/serva-vitae-project-library.js', '/editor-model.js', '/session-tracker-icons.js', '/features/progress-tracker.js', '/shared/ui-utils.js', '/styles.css', '/writing-goals-dashboard.css', '/assets/icons/session-tracker-sleeping-pen.svg', '/assets/icons/session-tracker-working-pen.svg', '/assets/icons/session-tracker-flaming-pen.svg', '/api/workspace', '/api/project-library', '/api/project-source', '/api/project-file/save', '/api/project-file/load', '/api/settings', or '/api/local-ai/status'.",
  );
}

export async function createDesktopResponseForRequest(
  request: DesktopHttpRequest,
  { projectPackageFaultInjector }: { projectPackageFaultInjector?: DesktopProjectPackageFaultInjector } = {},
): Promise<DesktopHttpResponse> {
  // Intent: handle mutating desktop bridge routes separately from static asset requests.
  const method = (request.method ?? "GET").toUpperCase();

  if (method === "POST" && request.pathname === "/api/log") {
    const body = parseJsonBody(request.body);
    const level = normalizeLogLevel(body.level);
    const message = String(body.message ?? body.text ?? "Browser log entry");
    const scope = String(body.scope ?? "browser");
    const context = body.context && typeof body.context === "object" ? body.context : undefined;
    if (level === "error") {
      logDesktopError(scope, message, context);
    } else if (level === "warn") {
      logDesktopWarn(scope, message, context);
    } else {
      logDesktopInfo(scope, message, context);
    }
    await appendDeveloperRuntimeLogLine({
      timestamp: new Date().toISOString(),
      level,
      scope,
      message,
      context,
    });
    return textResponse(204, "text/plain; charset=utf-8", "", apiCorsHeaders());
  }

  if (method === "POST" && request.pathname === "/api/log/session") {
    const sessionState = await ensureDeveloperRuntimeLogSessionState();
    return jsonResponse(200, {
      ok: true,
      filePath: sessionState.filePath,
      fileName: sessionState.fileName,
      sessionNumber: sessionState.sessionNumber,
      startedAt: sessionState.startedAt,
      autoPruneEnabled: developerRuntimeLogAutoPruneEnabled,
      keepLatestSessions: developerRuntimeLogRetentionSessions,
    }, apiCorsHeaders());
  }

  if (method === "POST" && request.pathname === "/api/log/read") {
    const body = parseJsonBody(request.body);
    const limit = normalizeTailLimit(body.limit);
    const text = await readDeveloperRuntimeLogTail(limit);
    const sessionState = await ensureDeveloperRuntimeLogSessionState();
    return jsonResponse(200, {
      ok: true,
      filePath: sessionState.filePath,
      fileName: sessionState.fileName,
      sessionNumber: sessionState.sessionNumber,
      limit,
      text,
    }, apiCorsHeaders());
  }

  if (method === "POST" && request.pathname === "/api/log/prune-settings") {
    const body = parseJsonBody(request.body);
    if (Object.prototype.hasOwnProperty.call(body, "enabled")) {
      developerRuntimeLogAutoPruneEnabled = body.enabled === true;
    }
    if (Object.prototype.hasOwnProperty.call(body, "keepLatestSessions")) {
      developerRuntimeLogRetentionSessions = normalizeRetentionSessions(body.keepLatestSessions);
    }
    let deletedFiles: string[] = [];
    if (developerRuntimeLogAutoPruneEnabled) {
      deletedFiles = await pruneDeveloperRuntimeLogFiles(developerRuntimeLogRetentionSessions);
    }
    const sessionState = await ensureDeveloperRuntimeLogSessionState();
    return jsonResponse(200, {
      ok: true,
      filePath: sessionState.filePath,
      fileName: sessionState.fileName,
      sessionNumber: sessionState.sessionNumber,
      autoPruneEnabled: developerRuntimeLogAutoPruneEnabled,
      keepLatestSessions: developerRuntimeLogRetentionSessions,
      deletedCount: deletedFiles.length,
      deletedFiles,
    }, apiCorsHeaders());
  }

  if (method === "POST" && request.pathname === "/api/log/prune") {
    const body = parseJsonBody(request.body);
    const keepLatestSessions = normalizeRetentionSessions(body.keepLatestSessions ?? developerRuntimeLogRetentionSessions);
    const deletedFiles = await pruneDeveloperRuntimeLogFiles(keepLatestSessions);
    const sessionState = await ensureDeveloperRuntimeLogSessionState();
    return jsonResponse(200, {
      ok: true,
      filePath: sessionState.filePath,
      fileName: sessionState.fileName,
      sessionNumber: sessionState.sessionNumber,
      keepLatestSessions,
      deletedCount: deletedFiles.length,
      deletedFiles,
    }, apiCorsHeaders());
  }

  if (method === "POST" && request.pathname === "/api/log/clear") {
    try {
      const sessionState = await ensureDeveloperRuntimeLogSessionState();
      await mkdir(dirname(sessionState.filePath), { recursive: true });
      await writeFile(sessionState.filePath, "", "utf8");
      return jsonResponse(200, {
        ok: true,
        filePath: sessionState.filePath,
        fileName: sessionState.fileName,
        sessionNumber: sessionState.sessionNumber,
      }, apiCorsHeaders());
    } catch (error) {
      logDesktopError("log", "Failed to clear developer runtime log file.", { error });
      return jsonResponse(500, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to clear runtime log file.",
      }, apiCorsHeaders());
    }
  }

  if (method === "POST" && request.pathname === "/api/project-source") {
    const body = parseJsonBody(request.body);
    const projectPath = typeof body.projectPath === "string" ? body.projectPath.trim() : "";
    if (!projectPath) {
      return jsonResponse(400, {
        ok: false,
        message: "A local project source path is required.",
      }, apiCorsHeaders());
    }

    try {
      const projectLibrary = loadProjectLibrarySeedFromPath(projectPath);
      logDesktopInfo("project-source", "Loaded a project source into a saved-project seed.", {
        projectPath,
        projectCount: projectLibrary.projects.length,
        activeProjectId: projectLibrary.activeProjectId,
      });
      return textResponse(200, "application/json; charset=utf-8", JSON.stringify(projectLibrary), apiCorsHeaders());
    } catch (error) {
      logDesktopError("project-source", "Failed to load a project source.", {
        error,
        projectPath,
      });
      return jsonResponse(500, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load the project source.",
      }, apiCorsHeaders());
    }
  }

  if (method === "POST" && request.pathname === "/api/settings") {
    const body = parseJsonBody(request.body);
    const lastProjectFilePath = typeof body.lastProjectFilePath === "string"
      ? body.lastProjectFilePath.trim()
      : "";
    const lastProjectFilePathExplicit = body.lastProjectFilePathExplicit === true;
    const snapshot = updateDesktopSettingsSnapshot({
      lastProjectFilePath,
      lastProjectFilePathExplicit,
    });
    return textResponse(200, "application/json; charset=utf-8", JSON.stringify(snapshot), apiCorsHeaders());
  }

  if (method === "POST" && request.pathname === "/api/local-ai/model-settings") {
    const body = parseJsonBody(request.body);
    const modelRoot = typeof body.modelRoot === "string" ? body.modelRoot.trim() : "";
    const executionMode = body.executionMode === "hybrid" ? "hybrid" : "local-only";
    if (!modelRoot) {
      return jsonResponse(400, {
        ok: false,
        message: "A local model folder path is required.",
      }, apiCorsHeaders());
    }

    const settings = updateDesktopSettingsSnapshot({
      executionMode,
      modelRoot,
    });
    logDesktopInfo("local-ai", "Updated local AI model settings.", {
      modelRoot: settings.modelRoot,
      executionMode: settings.executionMode,
    });
    return jsonResponse(200, {
      ok: true,
      settings,
      modelLibrary: await createLocalAiModelLibrarySnapshot(settings.modelRoot),
    }, apiCorsHeaders());
  }

  if (method === "POST" && request.pathname === "/api/project-file/save") {
    const body = parseJsonBody(request.body);
    const filePath = normalizeFilePath(body.filePath);
    if (!filePath) {
      return jsonResponse(400, {
        ok: false,
        message: "A project file path is required.",
      }, apiCorsHeaders());
    }

    if (!Object.prototype.hasOwnProperty.call(body, "snapshot")) {
      return jsonResponse(400, {
        ok: false,
        message: "A project snapshot is required.",
      }, apiCorsHeaders());
    }

    try {
      const resolvedPath = await writeProjectPackage(filePath, body.snapshot);
      logDesktopInfo("project-file", "Saved a project file.", {
        filePath: resolvedPath,
      });
      return jsonResponse(200, {
        ok: true,
        filePath: resolvedPath,
      }, apiCorsHeaders());
    } catch (error) {
      logDesktopError("project-file", "Failed to save a project file.", {
        error,
        filePath,
      });
      return jsonResponse(500, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to save the project file.",
      }, apiCorsHeaders());
    }
  }

  if (method === "POST" && request.pathname === "/api/project-package/browse") {
    const body = parseJsonBody(request.body);
    try {
      return jsonResponse(200, {
        ok: true,
        ...await browseProjectPackageDirectories(body.path),
      });
    } catch (error) {
      return jsonResponse(400, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to browse project packages.",
      });
    }
  }

  if (method === "POST" && request.pathname === "/api/project-package/save-stage") {
    const body = parseJsonBody(request.body);
    if (!Object.prototype.hasOwnProperty.call(body, "snapshot")) {
      return jsonResponse(400, { ok: false, message: "A project snapshot is required." });
    }
    try {
      return jsonResponse(200, {
        ok: true,
        ...await stageExistingProjectPackageSave(body.rootPath, body.snapshot, projectPackageFaultInjector),
      });
    } catch (error) {
      return jsonResponse(400, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to stage the project package save.",
      });
    }
  }

  if (method === "POST" && request.pathname === "/api/project-package/save-load") {
    const body = parseJsonBody(request.body);
    try {
      return jsonResponse(200, { ok: true, ...await loadStagedProjectPackageSave(body.operationToken) });
    } catch (error) {
      return jsonResponse(400, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load the staged project package save.",
      });
    }
  }

  if (method === "POST" && request.pathname === "/api/project-package/save-commit") {
    const body = parseJsonBody(request.body);
    try {
      const rootPath = await commitStagedProjectPackageSave(body.operationToken);
      return jsonResponse(200, { ok: true, rootPath });
    } catch (error) {
      return jsonResponse(400, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to commit the project package save.",
      });
    }
  }

  if (method === "POST" && request.pathname === "/api/project-package/save-discard") {
    const body = parseJsonBody(request.body);
    try {
      await discardStagedProjectPackageSave(body.operationToken);
      return jsonResponse(200, { ok: true, discarded: true });
    } catch (error) {
      return jsonResponse(400, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to discard the staged project package save.",
      });
    }
  }

  if (method === "POST" && request.pathname === "/api/project-package/create") {
    const body = parseJsonBody(request.body);
    if (!Object.prototype.hasOwnProperty.call(body, "snapshot")) {
      return jsonResponse(400, { ok: false, message: "A project snapshot is required." });
    }
    try {
      const staged = await stageProjectPackagePublication({
        destinationParentPath: body.parentPath,
        folderName: body.folderName,
        snapshot: body.snapshot,
      });
      return jsonResponse(200, { ok: true, ...staged });
    } catch (error) {
      return jsonResponse(400, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to create the project package.",
      });
    }
  }

  if (method === "POST" && request.pathname === "/api/project-package/load") {
    const body = parseJsonBody(request.body);
    try {
      const rootPath = await requireExistingProjectPackageRoot(body.rootPath);
      const snapshot = await readProjectPackage(rootPath, { strictPackage: true });
      delete snapshot._meta;
      return jsonResponse(200, { ok: true, rootPath, snapshot });
    } catch (error) {
      return jsonResponse(400, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load the project package.",
      });
    }
  }

  if (method === "POST" && request.pathname === "/api/project-package/save-as") {
    const body = parseJsonBody(request.body);
    if (!Object.prototype.hasOwnProperty.call(body, "snapshot")) {
      return jsonResponse(400, { ok: false, message: "A project snapshot is required." });
    }
    try {
      const staged = await stageProjectPackagePublication({
        sourceRoot: body.sourceRoot,
        destinationParentPath: body.destinationParentPath,
        folderName: body.folderName,
        snapshot: body.snapshot,
      });
      return jsonResponse(200, { ok: true, ...staged });
    } catch (error) {
      return jsonResponse(400, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to save the project package.",
      });
    }
  }

  if (method === "POST" && request.pathname === "/api/project-package/commit") {
    const body = parseJsonBody(request.body);
    try {
      const rootPath = await commitStagedProjectPackagePublication(body.operationToken);
      return jsonResponse(200, { ok: true, rootPath });
    } catch (error) {
      return jsonResponse(400, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to publish the staged project package.",
      });
    }
  }

  if (method === "POST" && request.pathname === "/api/project-package/discard") {
    const body = parseJsonBody(request.body);
    try {
      await discardStagedProjectPackagePublication(body.operationToken);
      return jsonResponse(200, { ok: true, discarded: true });
    } catch (error) {
      return jsonResponse(400, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to discard the staged project package.",
      });
    }
  }

  if (method === "POST" && request.pathname === "/api/project-file/load") {
    const body = parseJsonBody(request.body);
    const filePath = normalizeFilePath(body.filePath);
    if (!filePath) {
      return jsonResponse(400, {
        ok: false,
        message: "A project file path is required.",
      }, apiCorsHeaders());
    }

    try {
      const snapshot = await readProjectPackage(filePath);
      logDesktopInfo("project-file", "Loaded a project file.", {
        filePath: snapshot._meta?.rootPath ?? resolvePath(filePath),
      });
      delete snapshot._meta;
      return jsonResponse(200, snapshot, apiCorsHeaders());
    } catch (error) {
      logDesktopError("project-file", "Failed to load a project file.", {
        error,
        filePath,
      });
      return jsonResponse(500, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load the project file.",
      }, apiCorsHeaders());
    }
  }

  if (method === "POST" && request.pathname === "/api/project-media/save") {
    const body = parseJsonBody(request.body);
    const mediaPath = await resolveProjectMediaRequestPath(body);
    const contentBase64 = typeof body.contentBase64 === "string" ? body.contentBase64.trim() : "";
    if (!mediaPath.filePath) {
      return jsonResponse(400, {
        ok: false,
        message: mediaPath.error,
      }, apiCorsHeaders());
    }

    if (!contentBase64) {
      return jsonResponse(400, {
        ok: false,
        message: "Media content is required.",
      }, apiCorsHeaders());
    }

    try {
      const binary = Buffer.from(contentBase64, "base64");
      const resolvedPath = await writeBinaryFile(mediaPath.filePath, binary);
      logDesktopInfo("project-media", "Saved a project media file.", {
        filePath: resolvedPath,
        byteLength: binary.byteLength,
      });
      return jsonResponse(200, {
        ok: true,
        filePath: resolvedPath,
      }, apiCorsHeaders());
    } catch (error) {
      logDesktopError("project-media", "Failed to save a project media file.", {
        error,
        filePath: mediaPath.filePath,
      });
      return jsonResponse(500, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to save the project media file.",
      }, apiCorsHeaders());
    }
  }

  if (method === "POST" && request.pathname === "/api/project-media/load") {
    const body = parseJsonBody(request.body);
    const mediaPath = await resolveProjectMediaRequestPath(body);
    if (!mediaPath.filePath) {
      return jsonResponse(400, {
        ok: false,
        message: mediaPath.error,
      }, apiCorsHeaders());
    }

    try {
      const resolvedPath = mediaPath.filePath;
      const content = await readFile(resolvedPath);
      logDesktopInfo("project-media", "Loaded a project media file.", {
        filePath: resolvedPath,
        byteLength: content.byteLength,
      });
      return jsonResponse(200, {
        ok: true,
        filePath: resolvedPath,
        contentBase64: content.toString("base64"),
        byteLength: content.byteLength,
      }, apiCorsHeaders());
    } catch (error) {
      logDesktopError("project-media", "Failed to load a project media file.", {
        error,
        filePath: mediaPath.filePath,
      });
      return jsonResponse(500, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load the project media file.",
      }, apiCorsHeaders());
    }
  }

  // Intent: let browser media elements lazy-load local project media by URL without embedding blobs in project JSON.
  if (method === "GET" && request.pathname.startsWith("/api/project-media/file/")) {
    const filePath = decodeProjectMediaFilePathFromRoute(request.pathname);
    if (!filePath) {
      return jsonResponse(400, {
        ok: false,
        message: "A media file path is required.",
      }, apiCorsHeaders());
    }

    try {
      const resolvedPath = resolvePath(filePath);
      const stats = await stat(resolvedPath);
      if (!stats.isFile()) {
        return jsonResponse(404, {
          ok: false,
          message: "The requested media path is not a file.",
        }, apiCorsHeaders());
      }

      const content = await readFile(resolvedPath);
      logDesktopInfo("project-media", "Served a project media file URL.", {
        filePath: resolvedPath,
        byteLength: content.byteLength,
      });
      return binaryResponse(200, contentTypeForMediaPath(resolvedPath), content, {
        ...apiCorsHeaders(),
        "Cache-Control": "private, max-age=3600",
      });
    } catch (error) {
      logDesktopError("project-media", "Failed to serve a project media file URL.", {
        error,
        filePath,
      });
      return jsonResponse(404, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to serve the project media file.",
      }, apiCorsHeaders());
    }
  }

  // Intent: let editor workflows remove obsolete local media while keeping missing files idempotent.
  if (method === "POST" && request.pathname === "/api/project-media/delete") {
    const body = parseJsonBody(request.body);
    const mediaPath = await resolveProjectMediaRequestPath(body);
    if (!mediaPath.filePath) {
      return jsonResponse(400, {
        ok: false,
        message: mediaPath.error,
      }, apiCorsHeaders());
    }

    try {
      const result = await deleteBinaryFile(mediaPath.filePath);
      logDesktopInfo("project-media", result.removed
        ? "Deleted a project media file."
        : "Project media file was already absent during delete.", {
        filePath: result.filePath,
        removed: result.removed,
      });
      return jsonResponse(200, {
        ok: true,
        filePath: result.filePath,
        removed: result.removed,
      }, apiCorsHeaders());
    } catch (error) {
      logDesktopError("project-media", "Failed to delete a project media file.", {
        error,
        filePath: mediaPath.filePath,
      });
      return jsonResponse(500, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to delete the project media file.",
      }, apiCorsHeaders());
    }
  }

  if (method === "GET" && request.pathname === "/api/realtime-speech/providers") {
    return createRealtimeSpeechProvidersResponse();
  }

  if (method === "GET" && request.pathname === "/api/whisper-cpp/capability") {
    return createWhisperCppCapabilityResponse();
  }

  if (method === "POST" && request.pathname === "/api/whisper-cpp/word-timings") {
    const result = await realtimeSpeechBridge.createWhisperCppWordTimings(parseJsonBody(request.body));
    if (result.ok) {
      logDesktopInfo("whisper-cpp", "Created local whisper.cpp word timings.", {
        providerId: result.providerId ?? "",
        wordCount: result.words?.length ?? 0,
        model: result.whisper?.model ?? "",
      });
    } else {
      logDesktopWarn("whisper-cpp", "Local whisper.cpp word timing request failed.", {
        message: result.message ?? "",
        whisperAvailable: result.whisper?.available === true,
        errorMessage: result.whisper?.errorMessage ?? "",
      });
    }
    return jsonResponse(result.statusCode, result, apiCorsHeaders());
  }

  if (method === "POST" && request.pathname === "/api/realtime-speech/session/start") {
    const result = await realtimeSpeechBridge.startSession(parseJsonBody(request.body));
    if (result.ok) {
      logDesktopInfo("realtime-speech", "Started local realtime speech session.", {
        sessionId: result.session?.id ?? "",
        providerId: result.session?.providerId ?? "",
        sidecarStarted: result.sidecar?.started === true,
      });
    } else {
      logDesktopWarn("realtime-speech", "Local realtime speech session could not start.", {
        message: result.message,
      });
    }
    return jsonResponse(result.statusCode, result, apiCorsHeaders());
  }

  if (method === "POST" && request.pathname === "/api/realtime-speech/session/audio") {
    const result = await realtimeSpeechBridge.acceptAudioFrame(parseJsonBody(request.body));
    const transcriptLength = result.transcriptSnapshot?.transcript.length ?? 0;
    if (result.ok && (transcriptLength > 0 || result.transcriptSnapshot?.isEndpoint === true)) {
      logDesktopInfo("realtime-speech", "Accepted local realtime speech transcript chunk.", {
        sessionId: result.session?.id ?? "",
        transcriptLength,
        isEndpoint: result.transcriptSnapshot?.isEndpoint === true,
      });
    } else if (!result.ok) {
      logDesktopWarn("realtime-speech", "Local realtime speech audio frame failed.", {
        sessionId: result.session?.id ?? "",
        message: result.message,
      });
    }
    return jsonResponse(result.statusCode, result, apiCorsHeaders());
  }

  if (method === "POST" && request.pathname === "/api/realtime-speech/session/stop") {
    const result = await realtimeSpeechBridge.stopSession(parseJsonBody(request.body));
    logDesktopInfo("realtime-speech", "Stopped local realtime speech session.", {
      sessionId: result.session?.id ?? "",
      status: result.session?.status ?? "",
      finalTranscriptLength: result.finalTranscript?.length ?? 0,
      whisperAvailable: result.whisper?.available === true,
      whisperError: result.whisper?.errorMessage ?? "",
    });
    return jsonResponse(result.statusCode, result, apiCorsHeaders());
  }

  if (method === "OPTIONS" && request.pathname.startsWith("/api/")) {
    return textResponse(204, "text/plain; charset=utf-8", "", apiCorsHeaders());
  }

  if (method === "GET" && request.pathname === "/api/local-ai/status") {
    return jsonResponse(200, await localAiRouter.status(), apiCorsHeaders());
  }

  if (method === "GET" && request.pathname === "/api/local-ai/models") {
    const settings = createDesktopSettingsSnapshot();
    return jsonResponse(200, await createLocalAiModelLibrarySnapshot(settings.modelRoot), apiCorsHeaders());
  }

  if (method === "POST" && request.pathname === "/api/local-ai/models/ensure-folders") {
    const body = parseJsonBody(request.body);
    const modelRoot = typeof body.modelRoot === "string" && body.modelRoot.trim()
      ? body.modelRoot.trim()
      : createDesktopSettingsSnapshot().modelRoot;
    const snapshot = await ensureLocalAiModelLibraryFolders(modelRoot);
    const settings = updateDesktopSettingsSnapshot({ modelRoot: snapshot.modelRoot });
    logDesktopInfo("local-ai", "Ensured local AI model library folders.", {
      modelRoot: settings.modelRoot,
      folderCount: snapshot.folders.length,
    });
    return jsonResponse(200, {
      ok: true,
      settings,
      modelLibrary: snapshot,
    }, apiCorsHeaders());
  }

  if (method === "POST" && request.pathname === "/api/local-ai/generate-title") {
    try {
      return jsonResponse(200, await localAiRouter.generate(createAiRouteRequest(request, {
        taskType: "generate_scene_labels",
        outputFormat: "text",
      })), apiCorsHeaders());
    } catch (error) {
      logDesktopError("local-ai", "Local AI title generation failed.", { error });
      return jsonResponse(500, {
        ok: false,
        message: "Local AI title generation failed.",
      }, apiCorsHeaders());
    }
  }

  if (method === "POST" && request.pathname === "/api/local-ai/generate-tags") {
    try {
      return jsonResponse(200, await localAiRouter.generate(createAiRouteRequest(request, {
        taskType: "generate_tags",
        outputFormat: "json",
      })), apiCorsHeaders());
    } catch (error) {
      logDesktopError("local-ai", "Local AI tag generation failed.", { error });
      return jsonResponse(500, {
        ok: false,
        message: "Local AI tag generation failed.",
      }, apiCorsHeaders());
    }
  }

  if (method === "POST" && request.pathname === "/api/local-ai/continuity-check") {
    try {
      return jsonResponse(200, await localAiRouter.generate(createAiRouteRequest(request, {
        taskType: "run_continuity_check",
        outputFormat: "text",
      })), apiCorsHeaders());
    } catch (error) {
      logDesktopError("local-ai", "Local AI continuity check failed.", { error });
      return jsonResponse(500, {
        ok: false,
        message: "Local AI continuity check failed.",
      }, apiCorsHeaders());
    }
  }

  if (method !== "GET") {
    return jsonResponse(405, {
      ok: false,
      message: `${method} is not supported for ${request.pathname}.`,
    }, apiCorsHeaders());
  }

  return createDesktopResponse(request.pathname);
}

function serveEditorPublicAsset(pathname: string): DesktopHttpResponse | null {
  // Intent: safely expose editor-public assets without allowing path traversal outside the public root.
  const normalizedPathname = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  if (!normalizedPathname || normalizedPathname.endsWith("/")) {
    return null;
  }

  const extension = extname(normalizedPathname).toLowerCase();
  if (![".js", ".mjs", ".css", ".html", ".svg", ".json", ".txt"].includes(extension)) {
    return null;
  }

  const resolvedPath = resolvePath(EDITOR_PUBLIC_ROOT, normalizedPathname);
  const relativePath = relative(EDITOR_PUBLIC_ROOT, resolvedPath);
  if (!relativePath || relativePath.startsWith("..") || relativePath.includes(":")) {
    return null;
  }

  try {
    return textResponse(200, contentTypeForExtension(extension), readFileSync(resolvedPath, "utf8"));
  } catch {
    return null;
  }
}

function textResponse(
  statusCode: number,
  contentType: string,
  body: string,
  extraHeaders: Record<string, string> = {},
): DesktopHttpResponse {
  // Intent: apply consistent no-store headers so local editor assets reflect current workspace changes.
  return {
    statusCode,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
    body,
  };
}

function binaryResponse(
  statusCode: number,
  contentType: string,
  body: Buffer,
  extraHeaders: Record<string, string> = {},
): DesktopHttpResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
    body,
  };
}

function jsonResponse(
  statusCode: number,
  value: unknown,
  extraHeaders: Record<string, string> = {},
): DesktopHttpResponse {
  return textResponse(statusCode, "application/json; charset=utf-8", JSON.stringify(value), extraHeaders);
}

function apiCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function contentTypeForExtension(extension: string): string {
  switch (extension) {
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".svg":
      return "image/svg+xml; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "text/plain; charset=utf-8";
  }
}

function contentTypeForMediaPath(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".webm":
      return "audio/webm";
    case ".ogg":
      return "audio/ogg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    default:
      return "application/octet-stream";
  }
}

function decodeProjectMediaFilePathFromRoute(pathname: string): string {
  const prefix = "/api/project-media/file/";
  if (!pathname.startsWith(prefix)) {
    return "";
  }

  const encodedPath = pathname.slice(prefix.length);
  if (!encodedPath) {
    return "";
  }

  try {
    return decodeURIComponent(encodedPath).trim();
  } catch {
    return "";
  }
}

function createAiRouteRequest(
  request: DesktopHttpRequest,
  defaults: Pick<AiRequest, "taskType" | "outputFormat">,
): AiRequest {
  // Intent: normalize browser AI payloads before they cross the local provider boundary.
  const body = parseJsonBody(request.body);
  return {
    taskType: body.taskType ?? defaults.taskType,
    userInput: String(body.userInput ?? body.text ?? ""),
    manuscriptContext: typeof body.manuscriptContext === "string" ? body.manuscriptContext : undefined,
    projectContext: typeof body.projectContext === "string" ? body.projectContext : undefined,
    preferredTier: body.preferredTier,
    maxTokens: Number.isFinite(Number(body.maxTokens)) ? Number(body.maxTokens) : undefined,
    temperature: Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : undefined,
    outputFormat: body.outputFormat ?? defaults.outputFormat,
    devAllowTinyContinuityCheck: body.devAllowTinyContinuityCheck === true,
  };
}

function parseJsonBody(body: string | undefined): Record<string, any> {
  if (!body) {
    return {};
  }

  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonText(body: string): unknown {
  const normalizedBody = body.replace(/^\uFEFF/, "");
  return JSON.parse(normalizedBody);
}

function normalizeFilePath(candidate: unknown): string {
  return typeof candidate === "string" ? candidate.trim() : "";
}

function normalizeTailLimit(candidate: unknown): number {
  const value = Number(candidate);
  if (!Number.isFinite(value) || value <= 0) {
    return 300;
  }
  return Math.max(1, Math.min(5000, Math.round(value)));
}

function normalizeRetentionSessions(candidate: unknown): number {
  const value = Number(candidate);
  if (!Number.isFinite(value) || value <= 0) {
    return DEVELOPER_RUNTIME_LOG_RETENTION_SESSIONS_DEFAULT;
  }
  return Math.max(1, Math.min(500, Math.round(value)));
}

function formatSessionNumber(sessionNumber: number): string {
  return String(Math.max(1, Math.round(sessionNumber))).padStart(4, "0");
}

function formatSessionTimestampToken(dateValue: Date): string {
  return dateValue.toISOString().replace(/[:.]/g, "-");
}

function parseDeveloperRuntimeLogFileName(fileName: string): {
  sessionNumber: number;
  createdAtToken: string;
} | null {
  if (!fileName.startsWith(DEVELOPER_RUNTIME_LOG_FILE_PREFIX) || !fileName.endsWith(DEVELOPER_RUNTIME_LOG_FILE_EXTENSION)) {
    return null;
  }

  const withoutPrefix = fileName.slice(DEVELOPER_RUNTIME_LOG_FILE_PREFIX.length);
  const withoutExtension = withoutPrefix.slice(0, withoutPrefix.length - DEVELOPER_RUNTIME_LOG_FILE_EXTENSION.length);
  const separatorIndex = withoutExtension.indexOf("-");
  if (separatorIndex <= 0) {
    return null;
  }

  const sessionToken = withoutExtension.slice(0, separatorIndex);
  const createdAtToken = withoutExtension.slice(separatorIndex + 1);
  if (!createdAtToken) {
    return null;
  }

  const sessionNumber = Number.parseInt(sessionToken, 10);
  if (!Number.isFinite(sessionNumber) || sessionNumber <= 0) {
    return null;
  }

  return {
    sessionNumber,
    createdAtToken: String(createdAtToken).trim(),
  };
}

async function listDeveloperRuntimeLogSessionFiles(): Promise<DeveloperRuntimeLogSessionFile[]> {
  try {
    await mkdir(DEVELOPER_RUNTIME_LOG_DIR, { recursive: true });
    const fileNames = await readdir(DEVELOPER_RUNTIME_LOG_DIR);
    const entries = await Promise.all(
      fileNames.map(async (fileName) => {
        const parsed = parseDeveloperRuntimeLogFileName(fileName);
        if (!parsed) {
          return null;
        }
        const filePath = join(DEVELOPER_RUNTIME_LOG_DIR, fileName);
        try {
          const details = await stat(filePath);
          if (!details.isFile()) {
            return null;
          }
          return {
            fileName,
            filePath,
            sessionNumber: parsed.sessionNumber,
            createdAtToken: parsed.createdAtToken,
            modifiedAtMs: details.mtimeMs,
          } as DeveloperRuntimeLogSessionFile;
        } catch {
          return null;
        }
      }),
    );

    return entries
      .filter((entry): entry is DeveloperRuntimeLogSessionFile => Boolean(entry))
      .sort((left, right) => right.sessionNumber - left.sessionNumber);
  } catch {
    return [];
  }
}

async function ensureDeveloperRuntimeLogSessionState(): Promise<DeveloperRuntimeLogSessionState> {
  if (developerRuntimeLogSessionStatePromise) {
    return developerRuntimeLogSessionStatePromise;
  }

  developerRuntimeLogSessionStatePromise = (async () => {
    await mkdir(DEVELOPER_RUNTIME_LOG_DIR, { recursive: true });
    const files = await listDeveloperRuntimeLogSessionFiles();
    const nextSessionNumber = (files[0]?.sessionNumber ?? 0) + 1;
    const timestampToken = formatSessionTimestampToken(new Date());
    const fileName = `${DEVELOPER_RUNTIME_LOG_FILE_PREFIX}${formatSessionNumber(nextSessionNumber)}-${timestampToken}${DEVELOPER_RUNTIME_LOG_FILE_EXTENSION}`;
    const filePath = join(DEVELOPER_RUNTIME_LOG_DIR, fileName);
    await appendFile(filePath, "", "utf8");
    if (developerRuntimeLogAutoPruneEnabled) {
      await pruneDeveloperRuntimeLogFiles(developerRuntimeLogRetentionSessions, {
        preserveFileName: fileName,
      });
    }

    return {
      logDirectory: DEVELOPER_RUNTIME_LOG_DIR,
      fileName,
      filePath,
      sessionNumber: nextSessionNumber,
      startedAt: new Date().toISOString(),
    };
  })();

  return developerRuntimeLogSessionStatePromise;
}

async function pruneDeveloperRuntimeLogFiles(
  keepLatestSessions = DEVELOPER_RUNTIME_LOG_RETENTION_SESSIONS_DEFAULT,
  options: {
    preserveFileName?: string;
  } = {},
): Promise<string[]> {
  const safeKeepLatest = normalizeRetentionSessions(keepLatestSessions);
  const files = await listDeveloperRuntimeLogSessionFiles();
  if (files.length <= safeKeepLatest) {
    return [];
  }

  const preservedFileName = typeof options.preserveFileName === "string" ? options.preserveFileName.trim() : "";
  const deleteCandidates = files
    .filter((entry) => !preservedFileName || entry.fileName !== preservedFileName)
    .slice(safeKeepLatest);
  const deletedFiles: string[] = [];
  for (const candidate of deleteCandidates) {
    try {
      await unlink(candidate.filePath);
      deletedFiles.push(candidate.filePath);
    } catch {
      // File cleanup failures should not fail log flows.
    }
  }

  return deletedFiles;
}

async function appendDeveloperRuntimeLogLine(entry: {
  timestamp: string;
  level: string;
  scope: string;
  message: string;
  context?: Record<string, unknown>;
}) {
  try {
    const sessionState = await ensureDeveloperRuntimeLogSessionState();
    await appendFile(sessionState.filePath, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // Developer-log mirroring must not break HTTP request handling.
  }
}

async function readDeveloperRuntimeLogTail(limit: number): Promise<string> {
  try {
    const sessionState = await ensureDeveloperRuntimeLogSessionState();
    const content = await readFile(sessionState.filePath, "utf8");
    if (!content.trim()) {
      return "";
    }
    const lines = content
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);
    return lines.slice(-limit).join("\n");
  } catch {
    return "";
  }
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeSceneId(candidate: unknown): string {
  return typeof candidate === "string" ? candidate.trim() : "";
}

function sanitizePathToken(candidate: unknown): string {
  return String(candidate ?? "")
    .trim()
    .replace(/[^0-9A-Za-z._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function composeEditorText(blocks: Array<{ text?: unknown }>): string {
  return blocks.map((block) => (typeof block?.text === "string" ? block.text : "")).join("\n\n");
}

function normalizeNullableLineNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function normalizeSceneDraft(sceneId: string, candidate: any): Record<string, any> {
  const fallbackId = normalizeSceneId(sceneId);
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
  const normalizedBlocks = Array.isArray(source.blocks)
    ? source.blocks.map((block: any, index: number) => {
      const lineNumber = normalizeNullableLineNumber(block?.lineNumber);
      return ({
      blockId: typeof block?.blockId === "string" && block.blockId.trim()
        ? block.blockId
        : `block-${fallbackId}-${index + 1}`,
      paragraphId: typeof block?.paragraphId === "string" ? block.paragraphId : "",
      lineNumber,
      kind: typeof block?.kind === "string" ? block.kind : "narration",
      speakerLabel: typeof block?.speakerLabel === "string" ? block.speakerLabel : "",
      text: typeof block?.text === "string" ? block.text : "",
      issueIds: Array.isArray(block?.issueIds) ? [...block.issueIds] : [],
      eventTagIds: Array.isArray(block?.eventTagIds) ? [...block.eventTagIds] : [],
      isDraft: block?.isDraft === true || lineNumber === null,
    });
    })
    : [];

  return {
    ...cloneValue(source),
    sceneId: fallbackId,
    chapterId: typeof source.chapterId === "string" ? source.chapterId : "",
    chapterTitle: typeof source.chapterTitle === "string" ? source.chapterTitle : "Untitled Chapter",
    sceneTitle: typeof source.sceneTitle === "string" ? source.sceneTitle : "Untitled Scene",
    sceneSynopsis: typeof source.sceneSynopsis === "string" ? source.sceneSynopsis : "",
    editorText: typeof source.editorText === "string" ? source.editorText : composeEditorText(normalizedBlocks),
    blocks: normalizedBlocks,
  };
}

function defaultSceneFilePath(projectId: string, sceneId: string): string {
  return `manuscript/scenes/${sanitizePathToken(projectId || "project")}/scene_${sanitizePathToken(sceneId || "scene")}.json`;
}

function normalizeMetadataText(candidate: unknown): string {
  return typeof candidate === "string" ? candidate.trim() : "";
}

function normalizeMetadataFolderId(candidate: unknown): string {
  const value = normalizeMetadataText(candidate);
  return /^metadata-(?:folder|subgroup)-[a-z0-9-]+$/.test(value) ? value : "";
}

function normalizeMetadataFolderNoteId(candidate: unknown): string {
  const value = normalizeMetadataText(candidate);
  return /^metadata-(?:folder|subgroup)-note-[a-z0-9-]+$/.test(value) ? value : "";
}

function normalizeMetadataFolderTitle(candidate: unknown, fallback: string): string {
  const title = String(candidate ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
  return title || fallback;
}

function readMetadataNoteTitle(candidate: unknown, fallback: string): string {
  return typeof candidate === "string" && candidate.length ? candidate : fallback;
}

function createMetadataFolderIdFromTitle(title: string): string {
  return `metadata-folder-${sanitizePathToken(title || "folder") || "folder"}`;
}

function createMetadataFolderNoteIdFromTitle(title: string): string {
  return `metadata-folder-note-${sanitizePathToken(title || "note") || "note"}`;
}

function normalizeMetadataNoteAnchor(candidate: unknown): Record<string, any> | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const source = candidate as Record<string, any>;
  const sceneId = normalizeMetadataText(source.sceneId);
  const selectedText = String(source.selectedText ?? "").trim();
  const startOffset = Number(source.startOffset);
  const endOffset = Number(source.endOffset);
  if (!sceneId || !selectedText || !Number.isInteger(startOffset) || !Number.isInteger(endOffset) || endOffset <= startOffset) {
    return null;
  }

  return {
    sceneId,
    sceneTitle: normalizeMetadataText(source.sceneTitle),
    chapterId: normalizeMetadataText(source.chapterId),
    chapterTitle: normalizeMetadataText(source.chapterTitle),
    selectedText,
    startOffset,
    endOffset,
    createdAt: normalizeMetadataText(source.createdAt),
  };
}

// Intent: metadata-note extensions are semantic project data; only sidecar coordinates and the migrated anchor alias are noncanonical.
function normalizeMetadataFolderNoteRecord(candidate: unknown, index = 0): Record<string, any> | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const source = candidate as Record<string, any>;
  // The editor/import boundary owns title canonicalization; package persistence must preserve semantic text exactly.
  const title = readMetadataNoteTitle(source.title, "Note");
  const normalized = {
    ...cloneValue(source),
    id: normalizeMetadataFolderNoteId(source.id) || createMetadataFolderNoteIdFromTitle(`${title}-${index + 1}`),
    title,
    body: typeof source.body === "string" ? source.body : "",
    createdAt: normalizeMetadataText(source.createdAt),
    updatedAt: normalizeMetadataText(source.updatedAt),
    anchor: normalizeMetadataNoteAnchor(source.anchor ?? source.manuscriptAnchor),
  };
  delete normalized.groupId;
  delete normalized.folderId;
  delete normalized.manuscriptAnchor;
  return normalized;
}

function normalizeMetadataFolderRecord(candidate: unknown, index = 0, parentGroupId = ""): Record<string, any> | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const source = candidate as Record<string, any>;
  const groupId = normalizeMetadataText(source.groupId ?? source.noteType ?? parentGroupId);
  if (!groupId) {
    return null;
  }

  const title = normalizeMetadataFolderTitle(source.title, "Notes");
  const notes = Array.isArray(source.notes)
    ? source.notes
      .map((note, noteIndex) => normalizeMetadataFolderNoteRecord(note, noteIndex))
      .filter((note): note is Record<string, any> => Boolean(note))
    : [];
  const childFolderSource = Array.isArray(source.folders)
    ? source.folders
    : Array.isArray(source.subgroups)
      ? source.subgroups
      : Array.isArray(source.children)
        ? source.children
        : [];
  const folders = childFolderSource
    .map((folder, folderIndex) => normalizeMetadataFolderRecord(folder, folderIndex, groupId))
    .filter((folder): folder is Record<string, any> => Boolean(folder));

  return {
    id: normalizeMetadataFolderId(source.id) || createMetadataFolderIdFromTitle(`${title}-${index + 1}`),
    groupId,
    title,
    createdAt: normalizeMetadataText(source.createdAt),
    updatedAt: normalizeMetadataText(source.updatedAt),
    notes,
    folders,
  };
}

function normalizeMetadataFolderRecords(candidate: unknown): Array<Record<string, any>> {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map((folder, index) => normalizeMetadataFolderRecord(folder, index))
    .filter((folder): folder is Record<string, any> => Boolean(folder));
}

function createUniqueFileName(baseName: string, usedNames: Set<string>): string {
  // Preserve the former bounded file-name footprint without applying that storage limit to the semantic note title.
  const safeBaseName = (sanitizePathToken(baseName || "note") || "note").slice(0, METADATA_NOTE_FILE_STEM_MAX_LENGTH);
  let fileName = `${safeBaseName}.json`;
  let suffix = 2;
  while (usedNames.has(fileName)) {
    fileName = `${safeBaseName}-${suffix}.json`;
    suffix += 1;
  }
  usedNames.add(fileName);
  return fileName;
}

function toProjectStoragePath(...segments: string[]): string {
  return segments
    .map((segment) => sanitizePathToken(segment))
    .filter(Boolean)
    .join("/");
}

function createUniqueMetadataFolderRelativePath(basePath: string, folderId: string, usedPaths: Set<string>): string {
  const safeBasePath = basePath || toProjectStoragePath("metadata", "project", "metadata", "folder");
  let folderPath = safeBasePath;
  let suffix = sanitizePathToken(folderId);
  let duplicateCount = 2;
  while (usedPaths.has(folderPath)) {
    folderPath = `${safeBasePath}-${suffix || duplicateCount}`;
    suffix = `${sanitizePathToken(folderId) || "folder"}-${duplicateCount}`;
    duplicateCount += 1;
  }
  usedPaths.add(folderPath);
  return folderPath;
}

function resolveProjectRelativeStoragePath(projectRoot: string, relativeStoragePath: unknown): string {
  const normalizedRoot = normalizeFilePath(projectRoot);
  const normalizedPath = String(relativeStoragePath ?? "").trim().replace(/\\/g, "/");
  if (
    !normalizedRoot
    || !isAbsolute(normalizedRoot)
    || !normalizedPath
    || normalizedPath.startsWith("/")
    || /^[A-Za-z]:/.test(normalizedPath)
    || normalizedPath.split("/").some((segment) => segment === ".." || segment === "." || segment === "")
  ) {
    return "";
  }

  const resolvedRoot = resolvePath(normalizedRoot);
  const resolvedPath = resolvePath(resolvedRoot, normalizedPath);
  const relativePath = relative(resolvedRoot, resolvedPath);
  if (
    !relativePath
    || relativePath === ".."
    || relativePath.startsWith(`..${pathSeparator}`)
    || isAbsolute(relativePath)
    || relativePath.includes(":")
  ) {
    return "";
  }

  return resolvedPath;
}

// Intent: bind project-relative media requests to a verified package while preserving absolute legacy callers until their migration slice.
async function resolveProjectMediaRequestPath(body: Record<string, any>): Promise<{ filePath: string; error: string }> {
  const hasProjectContext = Object.prototype.hasOwnProperty.call(body, "activeProjectRoot")
    || Object.prototype.hasOwnProperty.call(body, "projectRelativePath");
  if (!hasProjectContext) {
    const legacyFilePath = normalizeFilePath(body.filePath);
    if (!legacyFilePath || !isAbsolute(legacyFilePath)) {
      return {
        filePath: "",
        error: "An active folder-backed project root is required for relative project media paths.",
      };
    }
    return { filePath: resolvePath(legacyFilePath), error: "" };
  }

  const activeProjectRoot = normalizeFilePath(body.activeProjectRoot);
  if (!activeProjectRoot || !isAbsolute(activeProjectRoot)) {
    return {
      filePath: "",
      error: "An absolute active folder-backed project root is required for project media.",
    };
  }

  const resolvedRoot = resolvePath(activeProjectRoot);
  try {
    const [rootStats, manifestStats] = await Promise.all([
      stat(resolvedRoot),
      stat(join(resolvedRoot, "project.json")),
    ]);
    if (!rootStats.isDirectory() || !manifestStats.isFile()) {
      return {
        filePath: "",
        error: "The active project root must be an existing folder-backed project package.",
      };
    }
  } catch {
    return {
      filePath: "",
      error: "The active project root must be an existing folder-backed project package.",
    };
  }

  const resolvedPath = resolveProjectRelativeStoragePath(resolvedRoot, body.projectRelativePath);
  if (!resolvedPath) {
    return {
      filePath: "",
      error: "The project media path must be a contained project-relative path.",
    };
  }

  try {
    await requireRealProjectPathContainment(resolvedRoot, resolvedPath);
  } catch (error) {
    return {
      filePath: "",
      error: error instanceof Error ? error.message : "The project media path escaped the active package.",
    };
  }

  return { filePath: resolvedPath, error: "" };
}

// Intent: store metadata folders as inspectable project-package files while preserving the legacy project record field.
async function writeMetadataFolderFilesForProject(
  projectRoot: string,
  projectRecord: Record<string, any>,
  { generationId = "" }: { generationId?: string } = {},
) {
  const projectId = typeof projectRecord?.id === "string" && projectRecord.id.trim()
    ? projectRecord.id.trim()
    : "project";
  const metadataFolders = normalizeMetadataFolderRecords(projectRecord.metadataSubgroups);
  const metadataStorage: Record<string, any> = {
    format: "metadata-folder-package-v1",
    folderOrder: metadataFolders.map((folder) => folder.id),
    folderFiles: {},
    noteFiles: {},
  };
  const usedFolderPaths = new Set<string>();

  // Intent: mirror nested metadata folders as nested physical directories while retaining a flat lookup map for loads.
  const writeFolder = async (folder: Record<string, any>, baseRelativePath: string): Promise<string> => {
    const folderRelativePath = createUniqueMetadataFolderRelativePath(baseRelativePath, folder.id, usedFolderPaths);
    const folderPath = resolvePath(projectRoot, folderRelativePath);
    await requireRealProjectPathContainment(projectRoot, folderPath);
    await mkdir(folderPath, { recursive: true });

    const usedNoteFileNames = new Set<string>();
    const noteFiles: Record<string, string> = {};
    const noteOrder: string[] = [];
    for (const note of folder.notes) {
      const noteFileName = createUniqueFileName(`note-${note.title || note.id}`, usedNoteFileNames);
      const noteRelativePath = `${folderRelativePath}/${noteFileName}`;
      const notePath = resolvePath(projectRoot, noteRelativePath);
      await requireRealProjectPathContainment(projectRoot, notePath);
      noteFiles[note.id] = noteRelativePath;
      noteOrder.push(note.id);
      await writeFile(notePath, JSON.stringify({
        ...note,
        groupId: folder.groupId,
        folderId: folder.id,
      }, null, 2), "utf8");
    }

    const childFolderFiles: Record<string, string> = {};
    const childFolderOrder: string[] = [];
    for (const childFolder of Array.isArray(folder.folders) ? folder.folders : []) {
      const childBaseRelativePath = `${folderRelativePath}/${sanitizePathToken(childFolder.title || childFolder.id) || sanitizePathToken(childFolder.id) || "folder"}`;
      const childManifestRelativePath = await writeFolder(childFolder, childBaseRelativePath);
      childFolderFiles[childFolder.id] = childManifestRelativePath;
      childFolderOrder.push(childFolder.id);
    }

    const folderManifestRelativePath = `${folderRelativePath}/${METADATA_FOLDER_MANIFEST_FILE_NAME}`;
    const folderManifest = {
      id: folder.id,
      groupId: folder.groupId,
      title: folder.title,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      noteOrder,
      noteFiles,
      folderOrder: childFolderOrder,
      folderFiles: childFolderFiles,
    };
    const folderManifestPath = resolvePath(projectRoot, folderManifestRelativePath);
    await requireRealProjectPathContainment(projectRoot, folderManifestPath);
    await writeFile(
      folderManifestPath,
      JSON.stringify(folderManifest, null, 2),
      "utf8",
    );

    metadataStorage.folderFiles[folder.id] = folderManifestRelativePath;
    metadataStorage.noteFiles[folder.id] = noteFiles;
    return folderManifestRelativePath;
  };

  for (const folder of metadataFolders) {
    const folderRelativePath = toProjectStoragePath(
      "metadata",
      ...(generationId ? [".abe-generations", generationId] : []),
      projectId,
      folder.groupId,
      folder.title || folder.id,
    ) || toProjectStoragePath(
      "metadata",
      ...(generationId ? [".abe-generations", generationId] : []),
      projectId,
      "metadata",
      folder.id,
    );
    await writeFolder(folder, folderRelativePath);
  }

  return metadataStorage;
}

function mergeMetadataFoldersById(primaryFolders: Array<Record<string, any>>, fallbackFolders: Array<Record<string, any>>) {
  const merged = new Map<string, Record<string, any>>();
  for (const folder of fallbackFolders) {
    merged.set(folder.id, cloneValue(folder));
  }
  for (const folder of primaryFolders) {
    merged.set(folder.id, cloneValue(folder));
  }
  return [...merged.values()];
}

async function readMetadataFolderFromManifest(
  projectRoot: string,
  folderManifestPath: string,
  storage: Record<string, any>,
  fallbackIndex = 0,
): Promise<Record<string, any> | null> {
  try {
    await requireRealProjectPathContainment(projectRoot, folderManifestPath);
    const folderManifest = parseJsonText(await readFile(folderManifestPath, "utf8")) as Record<string, any>;
    const folderId = normalizeMetadataFolderId(folderManifest.id);
    const manifestNoteFiles = folderManifest.noteFiles && typeof folderManifest.noteFiles === "object" && !Array.isArray(folderManifest.noteFiles)
      ? folderManifest.noteFiles
      : {};
    const storageNoteFiles = folderId && storage.noteFiles?.[folderId] && typeof storage.noteFiles[folderId] === "object" && !Array.isArray(storage.noteFiles[folderId])
      ? storage.noteFiles[folderId]
      : {};
    const noteFiles = {
      ...storageNoteFiles,
      ...manifestNoteFiles,
    };
    const noteOrder = Array.isArray(folderManifest.noteOrder)
      ? folderManifest.noteOrder.map((noteId: unknown) => normalizeMetadataFolderNoteId(noteId)).filter(Boolean)
      : Object.keys(noteFiles).map((noteId) => normalizeMetadataFolderNoteId(noteId)).filter(Boolean);
    const notes: Array<Record<string, any>> = [];

    for (const noteId of noteOrder) {
      const notePath = resolveProjectRelativeStoragePath(projectRoot, noteFiles[noteId]);
      if (!notePath) {
        continue;
      }

      try {
        await requireRealProjectPathContainment(projectRoot, notePath);
        if (!(await pathExists(notePath))) continue;
        const noteRecord = normalizeMetadataFolderNoteRecord(parseJsonText(await readFile(notePath, "utf8")), notes.length);
        if (noteRecord) {
          notes.push(noteRecord);
        }
      } catch {
        // Skip malformed metadata note files while preserving manifest-backed fallback records.
      }
    }

    const manifestFolderFiles = folderManifest.folderFiles && typeof folderManifest.folderFiles === "object" && !Array.isArray(folderManifest.folderFiles)
      ? folderManifest.folderFiles
      : {};
    const storageFolderFiles = storage.folderFiles && typeof storage.folderFiles === "object" && !Array.isArray(storage.folderFiles)
      ? storage.folderFiles
      : {};
    const childFolderFiles = {
      ...storageFolderFiles,
      ...manifestFolderFiles,
    };
    const childFolderOrder = Array.isArray(folderManifest.folderOrder)
      ? folderManifest.folderOrder.map((childFolderId: unknown) => normalizeMetadataFolderId(childFolderId)).filter(Boolean)
      : Object.keys(manifestFolderFiles).map((childFolderId) => normalizeMetadataFolderId(childFolderId)).filter(Boolean);
    const folders: Array<Record<string, any>> = [];

    for (const childFolderId of childFolderOrder) {
      const childFolderManifestPath = resolveProjectRelativeStoragePath(projectRoot, childFolderFiles[childFolderId]);
      if (!childFolderManifestPath) {
        continue;
      }

      await requireRealProjectPathContainment(projectRoot, childFolderManifestPath);
      if (!(await pathExists(childFolderManifestPath))) continue;

      const childFolderRecord = await readMetadataFolderFromManifest(
        projectRoot,
        childFolderManifestPath,
        storage,
        folders.length,
      );
      if (childFolderRecord) {
        folders.push(childFolderRecord);
      }
    }

    return normalizeMetadataFolderRecord({
      ...folderManifest,
      notes,
      folders,
    }, fallbackIndex);
  } catch {
    return null;
  }
}

async function readMetadataFoldersForProject(projectRoot: string, projectRecord: Record<string, any>) {
  const storage = projectRecord?.projectStorage?.metadataFolders
    && typeof projectRecord.projectStorage.metadataFolders === "object"
    && !Array.isArray(projectRecord.projectStorage.metadataFolders)
    ? projectRecord.projectStorage.metadataFolders
    : null;
  if (!storage) {
    return normalizeMetadataFolderRecords(projectRecord.metadataSubgroups);
  }

  const folderFiles = storage.folderFiles && typeof storage.folderFiles === "object" && !Array.isArray(storage.folderFiles)
    ? storage.folderFiles
    : {};
  const folderOrder = Array.isArray(storage.folderOrder)
    ? storage.folderOrder.map((folderId: unknown) => normalizeMetadataFolderId(folderId)).filter(Boolean)
    : Object.keys(folderFiles).map((folderId) => normalizeMetadataFolderId(folderId)).filter(Boolean);
  const diskFolders: Array<Record<string, any>> = [];

  for (const folderId of folderOrder) {
    const folderManifestPath = resolveProjectRelativeStoragePath(projectRoot, folderFiles[folderId]);
    if (!folderManifestPath) {
      continue;
    }

    await requireRealProjectPathContainment(projectRoot, folderManifestPath);
    if (!(await pathExists(folderManifestPath))) continue;

    const folderRecord = await readMetadataFolderFromManifest(projectRoot, folderManifestPath, storage, diskFolders.length);
    if (folderRecord) {
      diskFolders.push(folderRecord);
    }
  }

  return mergeMetadataFoldersById(
    diskFolders,
    normalizeMetadataFolderRecords(projectRecord.metadataSubgroups),
  );
}

async function hydrateProjectMetadataFoldersFromPackage(projectRoot: string, manifestProjects: Array<Record<string, any>>) {
  const hydratedProjects: Array<Record<string, any>> = [];
  for (const project of manifestProjects) {
    const record = cloneValue(project);
    record.metadataSubgroups = await readMetadataFoldersForProject(projectRoot, record);
    hydratedProjects.push(record);
  }
  return hydratedProjects;
}

function normalizeProjectLibrarySnapshotCandidate(snapshot: unknown): {
  schemaVersion: number;
  activeProjectId: string | null;
  projects: Array<Record<string, any>>;
  sceneStore: Record<string, Record<string, any>>;
} {
  if (!snapshot || typeof snapshot !== "object") {
    return {
      schemaVersion: 2,
      activeProjectId: null,
      projects: [],
      sceneStore: {},
    };
  }

  const candidate = snapshot as Record<string, any>;
  const projects = Array.isArray(candidate.projects)
    ? candidate.projects.filter((project) => project && typeof project === "object")
    : [];
  const activeProjectId = typeof candidate.activeProjectId === "string" && candidate.activeProjectId.trim()
    ? candidate.activeProjectId
    : (projects[0]?.id ?? null);
  const sceneStore = candidate.sceneStore && typeof candidate.sceneStore === "object" && !Array.isArray(candidate.sceneStore)
    ? cloneValue(candidate.sceneStore)
    : {};
  const schemaVersion = Number(candidate.schemaVersion) || SUPPORTED_PROJECT_SCHEMA_VERSION;
  if (schemaVersion > SUPPORTED_PROJECT_SCHEMA_VERSION) {
    throw new Error(`Project snapshot schema version ${schemaVersion} is newer than this app supports (${SUPPORTED_PROJECT_SCHEMA_VERSION}).`);
  }
  for (const project of projects) {
    const projectSchemaVersion = Number(project?.schemaVersion) || schemaVersion;
    if (projectSchemaVersion > SUPPORTED_PROJECT_SCHEMA_VERSION) {
      throw new Error(`Project record schema version ${projectSchemaVersion} is newer than this app supports (${SUPPORTED_PROJECT_SCHEMA_VERSION}).`);
    }
  }

  return {
    schemaVersion,
    activeProjectId,
    projects: cloneValue(projects),
    sceneStore,
  };
}

function collectSceneStoreFromProjectRecord(projectRecord: Record<string, any>): Record<string, Record<string, any>> {
  const drafts = projectRecord?.sceneDrafts && typeof projectRecord.sceneDrafts === "object" && !Array.isArray(projectRecord.sceneDrafts)
    ? projectRecord.sceneDrafts
    : {};
  const draftEntries = Object.entries(drafts)
    .map(([sceneId, scene]) => [normalizeSceneId(sceneId), scene] as const)
    .filter(([sceneId]) => sceneId.length > 0);
  if (draftEntries.length > 0) {
    return Object.fromEntries(
      draftEntries.map(([sceneId, scene]) => [sceneId, normalizeSceneDraft(sceneId, scene)]),
    );
  }

  const lines = Array.isArray(projectRecord?.workspace?.project?.lines)
    ? projectRecord.workspace.project.lines
    : [];
  const sceneMap = new Map<string, Record<string, any>>();
  for (const line of lines) {
    const sceneId = normalizeSceneId(line?.sceneId);
    if (!sceneId) {
      continue;
    }

    let scene = sceneMap.get(sceneId);
    if (!scene) {
      scene = {
        sceneId,
        chapterId: typeof line?.chapterId === "string" ? line.chapterId : "",
        chapterTitle: typeof line?.chapterTitle === "string" ? line.chapterTitle : "Untitled Chapter",
        sceneTitle: typeof line?.sceneTitle === "string" ? line.sceneTitle : "Untitled Scene",
        sceneSynopsis: typeof line?.sceneSynopsis === "string" ? line.sceneSynopsis : "",
        blocks: [],
      };
      sceneMap.set(sceneId, scene);
    }

    const lineNumber = normalizeNullableLineNumber(line?.lineNumber);
    scene.blocks.push({
      blockId: typeof line?.blockId === "string" && line.blockId.trim()
        ? line.blockId
        : `block-${sceneId}-${scene.blocks.length + 1}`,
      paragraphId: typeof line?.paragraphId === "string" ? line.paragraphId : "",
      lineNumber,
      kind: typeof line?.kind === "string" ? line.kind : "narration",
      speakerLabel: typeof line?.speakerLabel === "string" ? line.speakerLabel : "",
      text: typeof line?.text === "string" ? line.text : "",
      issueIds: Array.isArray(line?.issueIds) ? [...line.issueIds] : [],
      eventTagIds: Array.isArray(line?.eventTagIds) ? [...line.eventTagIds] : [],
      isDraft: line?.isDraft === true || lineNumber === null,
    });
  }

  const normalized: Record<string, Record<string, any>> = {};
  for (const [sceneId, scene] of sceneMap.entries()) {
    normalized[sceneId] = normalizeSceneDraft(sceneId, {
      ...scene,
      editorText: composeEditorText(scene.blocks),
    });
  }

  return normalized;
}

function getSceneOrderFromProject(projectRecord: Record<string, any>, sceneStore: Record<string, Record<string, any>>) {
  const fromStorage = Array.isArray(projectRecord?.projectStorage?.sceneOrder)
    ? projectRecord.projectStorage.sceneOrder
    : [];
  const fromIndex = Array.isArray(projectRecord?.projectIndex?.sceneOrder)
    ? projectRecord.projectIndex.sceneOrder
    : [];
  const fromStructure = Array.isArray(projectRecord?.structureDrafts?.scenes)
    ? projectRecord.structureDrafts.scenes.map((scene: any) => scene?.sceneId)
    : [];
  const orderedCandidates = [...fromStorage, ...fromIndex, ...fromStructure, ...Object.keys(sceneStore)];

  return [...new Set(orderedCandidates.map((sceneId) => normalizeSceneId(sceneId)).filter(Boolean))];
}

// Current semantic declarations control membership; prior sidecars may backfill bodies but cannot resurrect deleted scenes.
function getCurrentDeclaredSceneOrder(
  projectRecord: Record<string, any>,
  extractedScenes: Record<string, Record<string, any>>,
  explicitScenes: Record<string, Record<string, any>>,
) {
  const fromIndex = Array.isArray(projectRecord?.projectIndex?.sceneOrder)
    ? projectRecord.projectIndex.sceneOrder
    : [];
  const fromStructureOrder = Array.isArray(projectRecord?.structureDrafts?.sceneOrder)
    ? projectRecord.structureDrafts.sceneOrder
    : [];
  const fromStructureScenes = Array.isArray(projectRecord?.structureDrafts?.scenes)
    ? projectRecord.structureDrafts.scenes.map((scene: any) => scene?.sceneId)
    : [];
  const fromWorkspaceLines = Array.isArray(projectRecord?.workspace?.project?.lines)
    ? projectRecord.workspace.project.lines.map((line: any) => line?.sceneId)
    : [];
  return [...new Set([
    ...fromIndex,
    ...fromStructureOrder,
    ...fromStructureScenes,
    ...fromWorkspaceLines,
    ...Object.keys(extractedScenes),
    ...Object.keys(explicitScenes),
  ].map((sceneId) => normalizeSceneId(sceneId)).filter(Boolean))];
}

function buildSceneFilesForProject(
  projectRecord: Record<string, any>,
  sceneOrder: string[],
  { generationId = "" }: { generationId?: string } = {},
) {
  const existingSceneFiles = projectRecord?.projectStorage?.sceneFiles
    && typeof projectRecord.projectStorage.sceneFiles === "object"
    && !Array.isArray(projectRecord.projectStorage.sceneFiles)
    ? projectRecord.projectStorage.sceneFiles
    : {};
  const sceneFiles: Record<string, string> = {};
  const projectId = typeof projectRecord.id === "string" ? projectRecord.id : "project";
  for (const sceneId of sceneOrder) {
    if (generationId) {
      sceneFiles[sceneId] = toProjectStoragePath(
        "manuscript",
        ".abe-generations",
        generationId,
        projectId,
        `scene_${sceneId}.json`,
      );
      continue;
    }
    const existingPath = typeof existingSceneFiles[sceneId] === "string" ? existingSceneFiles[sceneId].trim() : "";
    sceneFiles[sceneId] = existingPath || defaultSceneFilePath(projectId, sceneId);
  }

  return sceneFiles;
}

function stripWorkspaceLinesToIndex(lines: any[]) {
  if (!Array.isArray(lines)) {
    return [];
  }

  return lines.map((line) => ({
    ...cloneValue(line),
    text: "",
  }));
}

function buildProjectManifestRecord(
  projectRecord: Record<string, any>,
  sceneOrder: string[],
  sceneFiles: Record<string, string>,
  metadataFolderStorage: Record<string, any> | null = null,
): Record<string, any> {
  const record = cloneValue(projectRecord);
  record.schemaVersion = Number(record.schemaVersion) || 2;
  record.sceneDrafts = {};

  const workspaceProject = record.workspace?.project && typeof record.workspace.project === "object"
    ? record.workspace.project
    : null;
  if (workspaceProject) {
    workspaceProject.lines = stripWorkspaceLinesToIndex(workspaceProject.lines);
  }

  const projectSettings = record.projectSettings && typeof record.projectSettings === "object" && !Array.isArray(record.projectSettings)
    ? record.projectSettings
    : {};
  const activeSceneId = normalizeSceneId(
    projectSettings.activeSceneId
      ?? record?.projectStorage?.activeSceneId
      ?? sceneOrder[0]
      ?? "",
  );
  record.projectSettings = {
    ...projectSettings,
    activeSceneId: sceneOrder.includes(activeSceneId) ? activeSceneId : (sceneOrder[0] ?? ""),
  };
  record.projectStorage = {
    format: "chunked-project-package-v1",
    activeSceneId: record.projectSettings.activeSceneId,
    sceneOrder: [...sceneOrder],
    sceneFiles: cloneValue(sceneFiles),
  };
  if (metadataFolderStorage) {
    record.projectStorage.metadataFolders = cloneValue(metadataFolderStorage);
  }

  if (!record.structureDrafts || typeof record.structureDrafts !== "object" || Array.isArray(record.structureDrafts)) {
    record.structureDrafts = { scenes: [] };
  }
  if (!Array.isArray(record.structureDrafts.scenes)) {
    record.structureDrafts.scenes = [];
  }
  const structureBySceneId = new Map(
    record.structureDrafts.scenes
      .filter((scene: any) => scene && typeof scene === "object")
      .map((scene: any) => [normalizeSceneId(scene.sceneId), scene]),
  );
  const indexBySceneId = new Map(
    (Array.isArray(record.projectIndex?.scenes) ? record.projectIndex.scenes : [])
      .map((scene: any) => [normalizeSceneId(scene?.id), scene]),
  );
  record.structureDrafts.scenes = sceneOrder.map((sceneId, index) => {
    const existingScene = structureBySceneId.get(sceneId) ?? {};
    const indexScene = indexBySceneId.get(sceneId) ?? {};
    return {
      ...cloneValue(existingScene),
      sceneId,
      chapterId: typeof existingScene.chapterId === "string" ? existingScene.chapterId : (indexScene.chapterId ?? ""),
      chapterTitle: typeof existingScene.chapterTitle === "string" ? existingScene.chapterTitle : "Untitled Chapter",
      sceneTitle: typeof existingScene.sceneTitle === "string" ? existingScene.sceneTitle : (indexScene.title ?? "Untitled Scene"),
      sceneSynopsis: typeof existingScene.sceneSynopsis === "string" ? existingScene.sceneSynopsis : (indexScene.synopsis ?? ""),
      order: Number.isFinite(Number(existingScene.order)) ? Number(existingScene.order) : index + 1,
      initialText: typeof existingScene.initialText === "string" ? existingScene.initialText : "",
    };
  });

  return record;
}

const MANAGED_PROJECT_TREE_NAMES = Object.freeze(["assets", "transcripts", "revisions"]);
const PROJECT_PACKAGE_STAGING_PREFIX = ".abe-project-stage-";
const PROJECT_PACKAGE_SAVE_PREFIX = ".abe-project-save-";

interface StagedProjectPackagePublication {
  operationToken: string;
  parentPath: string;
  stagingRootPath: string;
  finalRootPath: string;
  stagingDevice: number;
  stagingInode: number;
}

const stagedProjectPackagePublications = new Map<string, StagedProjectPackagePublication>();

interface StagedProjectPackageSave {
  operationToken: string;
  projectRoot: string;
  projectDevice: number;
  projectInode: number;
  generationId: string;
  manifestFileName: string;
}

const stagedProjectPackageSaves = new Map<string, StagedProjectPackageSave>();

function normalizeAbsoluteDesktopPath(candidate: unknown, label: string): string {
  const normalized = normalizeFilePath(candidate);
  if (!normalized || !isAbsolute(normalized)) {
    throw new Error(`${label} must be an absolute path.`);
  }
  return resolvePath(normalized);
}

function isPathContainedBy(rootPath: string, candidatePath: string): boolean {
  const relativePath = relative(resolvePath(rootPath), resolvePath(candidatePath));
  return relativePath === "" || (
    relativePath !== ".."
    && !relativePath.startsWith(`..${pathSeparator}`)
    && !isAbsolute(relativePath)
  );
}

// Intent: lexical containment is insufficient when an existing package child is a symlink or Windows junction.
async function requireRealProjectPathContainment(projectRootValue: string, candidatePathValue: string): Promise<string> {
  const projectRoot = resolvePath(projectRootValue);
  const candidatePath = resolvePath(candidatePathValue);
  if (!isPathContainedBy(projectRoot, candidatePath)) {
    throw new Error("Project path escaped the active package.");
  }

  const rootStats = await lstat(projectRoot);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error("Project package root must be a real directory.");
  }
  const realProjectRoot = await realpath(projectRoot);
  const relativePath = relative(projectRoot, candidatePath);
  let currentPath = projectRoot;
  for (const segment of relativePath ? relativePath.split(pathSeparator) : []) {
    currentPath = join(currentPath, segment);
    try {
      const currentStats = await lstat(currentPath);
      if (currentStats.isSymbolicLink()) {
        throw new Error(`Project package paths must not traverse symlinks or junctions: ${currentPath}`);
      }
      const realCurrentPath = await realpath(currentPath);
      if (!isPathContainedBy(realProjectRoot, realCurrentPath)) {
        throw new Error(`Project package path escaped through an existing filesystem component: ${currentPath}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") break;
      throw error;
    }
  }
  return candidatePath;
}

async function requireExistingDirectory(candidate: unknown, label: string): Promise<string> {
  const resolvedPath = normalizeAbsoluteDesktopPath(candidate, label);
  const pathStats = await lstat(resolvedPath);
  if (pathStats.isSymbolicLink()) {
    throw new Error(`${label} must not be a symlink.`);
  }
  if (!pathStats.isDirectory()) {
    throw new Error(`${label} must be an existing directory.`);
  }
  return resolvedPath;
}

async function isProjectPackageRoot(candidate: string): Promise<boolean> {
  try {
    const rootStats = await lstat(candidate);
    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) return false;
    const manifestStats = await lstat(join(candidate, "project.json"));
    return manifestStats.isFile() && !manifestStats.isSymbolicLink();
  } catch {
    return false;
  }
}

async function requireExistingProjectPackageRoot(candidate: unknown): Promise<string> {
  const rootPath = await requireExistingDirectory(candidate, "Project package root");
  if (!(await isProjectPackageRoot(rootPath))) {
    throw new Error(`Project package is missing project.json at ${rootPath}.`);
  }
  return rootPath;
}

function sanitizeProjectPackageFolderName(candidate: unknown): string {
  const rawName = String(candidate ?? "").normalize("NFKC").trim();
  if (!rawName || /[\\/]/.test(rawName)) {
    throw new Error("Project folder name must not contain path separators.");
  }
  const sanitized = rawName
    .replace(/[<>:"|?*\u0000-\u001F]/g, "-")
    .replace(/-+/g, "-")
    .replace(/[. ]+$/g, "")
    .trim();
  if (!sanitized || sanitized === "." || sanitized === "..") {
    throw new Error("Project folder name is invalid.");
  }
  return sanitized;
}

async function browseProjectPackageDirectories(candidatePath: unknown) {
  let startPath = normalizeFilePath(candidatePath);
  if (!startPath) {
    const settingsRoot = normalizeFilePath(createDesktopSettingsSnapshot().projectRoot);
    startPath = settingsRoot && isAbsolute(settingsRoot) && await pathExists(settingsRoot)
      ? settingsRoot
      : homedir();
  }
  const rootPath = await requireExistingDirectory(startPath, "Browse path");
  const childEntries = await readdir(rootPath, { withFileTypes: true });
  const directories = [];
  for (const entry of childEntries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (
      !entry.isDirectory()
      || entry.isSymbolicLink()
      || entry.name.startsWith(PROJECT_PACKAGE_STAGING_PREFIX)
    ) continue;
    const childPath = join(rootPath, entry.name);
    directories.push({
      name: entry.name,
      path: childPath,
      isProjectPackage: await isProjectPackageRoot(childPath),
    });
  }
  const parentPath = dirname(rootPath);
  return {
    path: rootPath,
    parentPath: parentPath === rootPath ? "" : parentPath,
    isProjectPackage: await isProjectPackageRoot(rootPath),
    directories,
  };
}

async function resolveUnpublishedProjectRoot(parentPath: string, folderName: unknown): Promise<string> {
  const safeFolderName = sanitizeProjectPackageFolderName(folderName);
  const projectRoot = resolvePath(parentPath, safeFolderName);
  if (!isPathContainedBy(parentPath, projectRoot) || dirname(projectRoot) !== parentPath) {
    throw new Error("Project destination must be a direct child of the selected parent folder.");
  }
  if (await pathExists(projectRoot)) {
    throw new Error(`Project destination already exists at ${projectRoot}.`);
  }
  return projectRoot;
}

// Intent: allocate publication authority independently from the requested author-visible folder name.
async function createStagedProjectPackagePublication(
  parentPath: string,
  finalRootPath: string,
): Promise<StagedProjectPackagePublication> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const operationToken = randomUUID();
    const stagingRootPath = resolvePath(parentPath, `${PROJECT_PACKAGE_STAGING_PREFIX}${randomUUID()}`);
    if (dirname(stagingRootPath) !== parentPath || !isPathContainedBy(parentPath, stagingRootPath)) {
      throw new Error("Project staging root escaped the selected parent folder.");
    }
    try {
      await mkdir(stagingRootPath, { recursive: false });
      const stagingStats = await lstat(stagingRootPath);
      const stagedPublication = {
        operationToken,
        parentPath,
        stagingRootPath,
        finalRootPath,
        stagingDevice: stagingStats.dev,
        stagingInode: stagingStats.ino,
      };
      stagedProjectPackagePublications.set(operationToken, stagedPublication);
      return stagedPublication;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "EEXIST") throw error;
    }
  }
  throw new Error("Unable to allocate a unique project staging root.");
}

async function requireOwnedStagingRoot(stagedPublication: StagedProjectPackagePublication): Promise<string> {
  const resolvedRoot = resolvePath(stagedPublication.stagingRootPath);
  const resolvedParent = await requireExistingDirectory(stagedPublication.parentPath, "Project staging parent");
  if (
    dirname(resolvedRoot) !== resolvedParent
    || !isPathContainedBy(resolvedParent, resolvedRoot)
    || !resolvedRoot.startsWith(resolvePath(resolvedParent, PROJECT_PACKAGE_STAGING_PREFIX))
  ) {
    throw new Error("Project staging root is outside its host-owned boundary.");
  }
  const rootStats = await lstat(resolvedRoot);
  if (
    rootStats.isSymbolicLink()
    || !rootStats.isDirectory()
    || rootStats.dev !== stagedPublication.stagingDevice
    || rootStats.ino !== stagedPublication.stagingInode
  ) {
    throw new Error("Project staging root no longer matches the directory created by this operation.");
  }
  return resolvedRoot;
}

async function removeStagedProjectPackageRoot(stagedPublication: StagedProjectPackagePublication) {
  // Intent: deletion authority is bound to the host-created directory identity, never a caller-supplied path.
  const resolvedRoot = await requireOwnedStagingRoot(stagedPublication);
  await rm(resolvedRoot, { recursive: true, force: true });
}

async function copyManagedProjectTree(sourcePath: string, destinationPath: string, destinationRoot: string) {
  const sourceStats = await lstat(sourcePath);
  if (sourceStats.isSymbolicLink()) {
    throw new Error(`Managed project files must not use symlinks: ${sourcePath}`);
  }
  if (sourceStats.isDirectory()) {
    if (!isPathContainedBy(destinationRoot, destinationPath)) {
      throw new Error("Managed project copy escaped the destination package.");
    }
    await mkdir(destinationPath, { recursive: true });
    for (const entry of await readdir(sourcePath, { withFileTypes: true })) {
      await copyManagedProjectTree(
        join(sourcePath, entry.name),
        join(destinationPath, entry.name),
        destinationRoot,
      );
    }
    return;
  }
  if (!sourceStats.isFile()) {
    throw new Error(`Managed project entry is not a regular file: ${sourcePath}`);
  }
  if (!isPathContainedBy(destinationRoot, destinationPath)) {
    throw new Error("Managed project copy escaped the destination package.");
  }
  await mkdir(dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
}

async function copyManagedProjectTrees(sourceRoot: string, destinationRoot: string) {
  if (!(await isProjectPackageRoot(sourceRoot))) return;
  for (const treeName of MANAGED_PROJECT_TREE_NAMES) {
    const sourceTree = join(sourceRoot, treeName);
    if (!(await pathExists(sourceTree))) continue;
    await copyManagedProjectTree(sourceTree, join(destinationRoot, treeName), destinationRoot);
  }
}

// Intent: New and Save As share one staged writer so neither can publish before editor verification.
async function stageProjectPackagePublication({
  sourceRoot,
  destinationParentPath,
  folderName,
  snapshot,
}: {
  sourceRoot?: unknown;
  destinationParentPath: unknown;
  folderName: unknown;
  snapshot: unknown;
}) {
  const resolvedParent = await requireExistingDirectory(destinationParentPath, "Project destination parent");
  const finalRootPath = await resolveUnpublishedProjectRoot(resolvedParent, folderName);
  const normalizedSource = normalizeFilePath(sourceRoot);
  let resolvedSource = "";
  if (normalizedSource) {
    resolvedSource = normalizeAbsoluteDesktopPath(normalizedSource, "Source project path");
    const sourceStats = await lstat(resolvedSource);
    if (sourceStats.isSymbolicLink()) {
      throw new Error("Source project path must not be a symlink.");
    }
    if (sourceStats.isDirectory() && !(await isProjectPackageRoot(resolvedSource))) {
      throw new Error("Source project folder must contain project.json.");
    }
  }
  if (resolvedSource && (
    finalRootPath === resolvedSource
    || isPathContainedBy(resolvedSource, finalRootPath)
  )) {
    throw new Error("Save As destination must not equal or be nested inside the source project.");
  }
  const stagedPublication = await createStagedProjectPackagePublication(resolvedParent, finalRootPath);

  try {
    if (resolvedSource) {
      const sourceStats = await stat(resolvedSource);
      if (sourceStats.isDirectory()) {
        await copyManagedProjectTrees(resolvedSource, stagedPublication.stagingRootPath);
      }
    }
    await writeProjectPackageAtRoot(stagedPublication.stagingRootPath, snapshot);
    return {
      operationToken: stagedPublication.operationToken,
      stagingRootPath: stagedPublication.stagingRootPath,
      finalRootPath: stagedPublication.finalRootPath,
    };
  } catch (error) {
    stagedProjectPackagePublications.delete(stagedPublication.operationToken);
    await removeStagedProjectPackageRoot(stagedPublication);
    throw error;
  }
}

async function commitStagedProjectPackagePublication(operationTokenValue: unknown): Promise<string> {
  const operationToken = typeof operationTokenValue === "string" ? operationTokenValue.trim() : "";
  const stagedPublication = stagedProjectPackagePublications.get(operationToken);
  if (!stagedPublication) {
    throw new Error("Project package staging operation is invalid or expired.");
  }
  await requireOwnedStagingRoot(stagedPublication);
  await requireExistingProjectPackageRoot(stagedPublication.stagingRootPath);
  if (await pathExists(stagedPublication.finalRootPath)) {
    throw new Error(`Project destination already exists at ${stagedPublication.finalRootPath}.`);
  }

  // Intent: the final author-visible destination appears only after editor verification and is never overwritten.
  await rename(stagedPublication.stagingRootPath, stagedPublication.finalRootPath);
  stagedProjectPackagePublications.delete(operationToken);
  return stagedPublication.finalRootPath;
}

async function discardStagedProjectPackagePublication(operationTokenValue: unknown): Promise<void> {
  const operationToken = typeof operationTokenValue === "string" ? operationTokenValue.trim() : "";
  const stagedPublication = stagedProjectPackagePublications.get(operationToken);
  if (!stagedPublication) {
    throw new Error("Project package staging operation is invalid or expired.");
  }
  await removeStagedProjectPackageRoot(stagedPublication);
  stagedProjectPackagePublications.delete(operationToken);
}

async function ensureProjectPackageScaffold(projectRoot: string) {
  await mkdir(projectRoot, { recursive: true });
  const requiredDirectories = [
    join(projectRoot, "manuscript"),
    join(projectRoot, "manuscript", "chapters"),
    join(projectRoot, "manuscript", "scenes"),
    join(projectRoot, "assets"),
    join(projectRoot, "assets", "audio"),
    join(projectRoot, "assets", "images"),
    join(projectRoot, "metadata"),
    join(projectRoot, "transcripts"),
    join(projectRoot, "revisions"),
    join(projectRoot, "cache"),
    join(projectRoot, "cache", "waveforms"),
    join(projectRoot, "cache", "ai-index"),
  ];

  for (const directory of requiredDirectories) {
    await requireRealProjectPathContainment(projectRoot, directory);
    await mkdir(directory, { recursive: true });
  }
}

async function pathExists(targetPath: string) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveWritableProjectRoot(filePath: string) {
  const resolvedPath = resolvePath(filePath);
  if (!(await pathExists(resolvedPath))) {
    return resolvedPath;
  }

  const stats = await stat(resolvedPath);
  if (stats.isDirectory()) {
    return resolvedPath;
  }

  if (stats.isFile()) {
    const suffix = resolvedPath.toLowerCase().endsWith(".json") ? "" : ".package";
    return `${resolvedPath.replace(/\.json$/i, "")}${suffix}`;
  }

  return resolvedPath;
}

async function readSceneStoreFromManifest(
  projectRoot: string,
  manifestProjects: Array<Record<string, any>>,
  { strictPackage = false }: { strictPackage?: boolean } = {},
) {
  const sceneStore: Record<string, Record<string, any>> = {};
  for (const project of manifestProjects) {
    const projectId = typeof project?.id === "string" ? project.id.trim() : "";
    if (!projectId) {
      continue;
    }

    const sceneOrder = getSceneOrderFromProject(project, {});
    const sceneFiles = buildSceneFilesForProject(project, sceneOrder);
    const projectScenes: Record<string, Record<string, any>> = {};

    for (const sceneId of sceneOrder) {
      const relativeScenePath = sceneFiles[sceneId] || defaultSceneFilePath(projectId, sceneId);
      const scenePath = resolveProjectRelativeStoragePath(projectRoot, relativeScenePath);
      if (!scenePath) {
        if (strictPackage) throw new Error(`Scene sidecar path is invalid for ${projectId}/${sceneId}.`);
        continue;
      }
      await requireRealProjectPathContainment(projectRoot, scenePath);
      if (!(await pathExists(scenePath))) {
        if (strictPackage) throw new Error(`Scene sidecar is missing for ${projectId}/${sceneId}.`);
        continue;
      }

      try {
        const sceneStats = await lstat(scenePath);
        if (!sceneStats.isFile() || sceneStats.isSymbolicLink()) {
          throw new Error(`Scene sidecar must be a regular file for ${projectId}/${sceneId}.`);
        }
        const sceneContent = await readFile(scenePath, "utf8");
        projectScenes[sceneId] = normalizeSceneDraft(sceneId, parseJsonText(sceneContent));
      } catch (error) {
        if (strictPackage) throw error;
        // Skip malformed or unreadable scene chunks.
      }
    }

    if (Object.keys(projectScenes).length) {
      sceneStore[projectId] = projectScenes;
    }
  }

  return sceneStore;
}

function validateStrictPackageManifest(manifestSnapshot: Record<string, any>) {
  const projectIds = manifestSnapshot.projects
    .map((project: Record<string, any>) => (typeof project?.id === "string" ? project.id.trim() : ""));
  if (!projectIds.length || projectIds.some((projectId: string) => !projectId) || new Set(projectIds).size !== projectIds.length) {
    throw new Error("Project package manifest must contain projects with unique non-empty IDs.");
  }
  if (!manifestSnapshot.activeProjectId || !projectIds.includes(manifestSnapshot.activeProjectId)) {
    throw new Error("Project package activeProjectId must identify a manifest project.");
  }
}

async function readProjectPackageFromManifest(
  projectRoot: string,
  manifestPath: string,
  { strictPackage = false }: { strictPackage?: boolean } = {},
) {
  const manifestStats = await lstat(manifestPath);
  if (!manifestStats.isFile() || manifestStats.isSymbolicLink()) {
    throw new Error(`Project package manifest must be a regular file at ${manifestPath}.`);
  }
  const manifestContent = await readFile(manifestPath, "utf8");
  const manifestSnapshot = normalizeProjectLibrarySnapshotCandidate(parseJsonText(manifestContent));
  if (strictPackage) validateStrictPackageManifest(manifestSnapshot);
  const projects = await hydrateProjectMetadataFoldersFromPackage(projectRoot, manifestSnapshot.projects);
  const sceneStore = await readSceneStoreFromManifest(projectRoot, projects, { strictPackage });
  return {
    schemaVersion: manifestSnapshot.schemaVersion,
    activeProjectId: manifestSnapshot.activeProjectId,
    projects,
    sceneStore,
    _meta: { rootPath: projectRoot, manifestPath },
  };
}

async function readProjectPackage(
  filePath: string,
  { strictPackage = false }: { strictPackage?: boolean } = {},
): Promise<Record<string, any>> {
  const resolvedPath = resolvePath(filePath);
  const stats = await stat(resolvedPath);
  if (stats.isDirectory()) {
    const manifestPath = join(resolvedPath, "project.json");
    if (!(await pathExists(manifestPath))) {
      throw new Error(`Missing project manifest at ${manifestPath}.`);
    }
    return readProjectPackageFromManifest(resolvedPath, manifestPath, { strictPackage });
  }

  const fileContent = await readFile(resolvedPath, "utf8");
  const parsed = parseJsonText(fileContent) as Record<string, any>;
  if (resolvedPath.toLowerCase().endsWith("project.json")) {
    const rootPath = dirname(resolvedPath);
    const manifestSnapshot = normalizeProjectLibrarySnapshotCandidate(parsed);
    const projects = await hydrateProjectMetadataFoldersFromPackage(rootPath, manifestSnapshot.projects);
    const sceneStore = await readSceneStoreFromManifest(rootPath, projects);
    return {
      schemaVersion: manifestSnapshot.schemaVersion,
      activeProjectId: manifestSnapshot.activeProjectId,
      projects,
      sceneStore,
      _meta: {
        rootPath,
        manifestPath: resolvedPath,
      },
    };
  }

  const legacySnapshot = normalizeProjectLibrarySnapshotCandidate(parsed);
  if (!Object.keys(legacySnapshot.sceneStore).length) {
    const derivedSceneStore: Record<string, Record<string, any>> = {};
    for (const project of legacySnapshot.projects) {
      const projectId = typeof project?.id === "string" ? project.id.trim() : "";
      if (!projectId) {
        continue;
      }
      const projectScenes = collectSceneStoreFromProjectRecord(project);
      if (Object.keys(projectScenes).length) {
        derivedSceneStore[projectId] = projectScenes;
      }
    }
    legacySnapshot.sceneStore = derivedSceneStore;
  }

  return {
    schemaVersion: legacySnapshot.schemaVersion,
    activeProjectId: legacySnapshot.activeProjectId,
    projects: legacySnapshot.projects,
    sceneStore: legacySnapshot.sceneStore,
    _meta: {
      rootPath: resolvedPath,
      manifestPath: resolvedPath,
      legacy: true,
    },
  };
}

async function writeProjectPackageAtRoot(
  projectRootValue: string,
  snapshot: unknown,
  {
    generationId = "",
    manifestFileName = "project.json",
    afterStructuredSidecarWrite,
  }: {
    generationId?: string;
    manifestFileName?: string;
    afterStructuredSidecarWrite?: (details: { kind: "scene" | "metadata"; count: number; filePath: string }) => Promise<void> | void;
  } = {},
): Promise<string> {
  const projectRoot = normalizeAbsoluteDesktopPath(projectRootValue, "Project package root");
  if (await pathExists(projectRoot)) {
    const rootStats = await stat(projectRoot);
    if (!rootStats.isDirectory()) {
      throw new Error("Project package root must use explicit directory semantics.");
    }
  }
  const candidateSnapshot = normalizeProjectLibrarySnapshotCandidate(snapshot);
  const existingSnapshot = await (async () => {
    try {
      return await readProjectPackage(projectRoot);
    } catch {
      return null;
    }
  })();
  const existingSceneStore = existingSnapshot?.sceneStore ?? {};

  await ensureProjectPackageScaffold(projectRoot);

  const manifestProjects: Array<Record<string, any>> = [];
  let structuredSidecarWriteCount = 0;

  for (const projectRecord of candidateSnapshot.projects) {
    const projectId = typeof projectRecord?.id === "string" ? projectRecord.id.trim() : "";
    if (!projectId) {
      continue;
    }

    const existingScenes = existingSceneStore?.[projectId] && typeof existingSceneStore[projectId] === "object"
      ? cloneValue(existingSceneStore[projectId])
      : {};
    const explicitScenes = candidateSnapshot.sceneStore?.[projectId] && typeof candidateSnapshot.sceneStore[projectId] === "object"
      ? cloneValue(candidateSnapshot.sceneStore[projectId])
      : {};
    const extractedScenes = collectSceneStoreFromProjectRecord(projectRecord);
    const sceneOrder = getCurrentDeclaredSceneOrder(projectRecord, extractedScenes, explicitScenes);
    const mergedScenes: Record<string, Record<string, any>> = Object.fromEntries(sceneOrder.map((sceneId) => [
      sceneId,
      {
        ...(existingScenes[sceneId] ?? {}),
        ...(extractedScenes[sceneId] ?? {}),
        ...(explicitScenes[sceneId] ?? {}),
      },
    ]));
    const sceneFiles = buildSceneFilesForProject(projectRecord, sceneOrder, { generationId });

    for (const sceneId of sceneOrder) {
      const normalizedId = normalizeSceneId(sceneId);
      if (!normalizedId) {
        continue;
      }
      if (!mergedScenes[normalizedId]) {
        mergedScenes[normalizedId] = normalizeSceneDraft(normalizedId, {
          sceneId: normalizedId,
          blocks: [],
          editorText: "",
        });
      }

      const relativeScenePath = sceneFiles[normalizedId] || defaultSceneFilePath(projectId, normalizedId);
      const scenePath = resolveProjectRelativeStoragePath(projectRoot, relativeScenePath);
      if (!scenePath) {
        throw new Error(`Scene sidecar path is invalid for ${projectId}/${normalizedId}.`);
      }
      await requireRealProjectPathContainment(projectRoot, scenePath);
      await mkdir(dirname(scenePath), { recursive: true });
      await writeFile(scenePath, JSON.stringify(mergedScenes[normalizedId], null, 2), "utf8");
      structuredSidecarWriteCount += 1;
      await afterStructuredSidecarWrite?.({ kind: "scene", count: structuredSidecarWriteCount, filePath: scenePath });
    }

    const metadataFolderStorage = await writeMetadataFolderFilesForProject(projectRoot, projectRecord, { generationId });
    if (Object.keys(metadataFolderStorage.folderFiles).length) {
      structuredSidecarWriteCount += 1;
      await afterStructuredSidecarWrite?.({
        kind: "metadata",
        count: structuredSidecarWriteCount,
        filePath: join(projectRoot, "metadata", ...(generationId ? [".abe-generations", generationId] : [])),
      });
    }

    manifestProjects.push(
      buildProjectManifestRecord(projectRecord, sceneOrder, sceneFiles, metadataFolderStorage),
    );
  }

  const activeProjectId = typeof candidateSnapshot.activeProjectId === "string" && candidateSnapshot.activeProjectId.trim()
    ? candidateSnapshot.activeProjectId
    : manifestProjects[0]?.id ?? null;
  const manifestSnapshot = {
    schemaVersion: Number(candidateSnapshot.schemaVersion) || 2,
    activeProjectId,
    projects: manifestProjects,
  };
  const manifestPath = join(projectRoot, manifestFileName);
  await writeFile(manifestPath, JSON.stringify(manifestSnapshot, null, 2), "utf8");

  return projectRoot;
}

async function requireOwnedStagedProjectPackageSave(stagedSave: StagedProjectPackageSave) {
  const projectRoot = await requireExistingProjectPackageRoot(stagedSave.projectRoot);
  const rootStats = await lstat(projectRoot);
  if (rootStats.dev !== stagedSave.projectDevice || rootStats.ino !== stagedSave.projectInode) {
    throw new Error("Project package root changed during the staged save.");
  }
  const expectedManifestName = `${PROJECT_PACKAGE_SAVE_PREFIX}${stagedSave.operationToken}.json`;
  if (stagedSave.manifestFileName !== expectedManifestName) {
    throw new Error("Project package save manifest identity is invalid.");
  }
  return projectRoot;
}

async function removeFileIfPresent(filePath: string) {
  try {
    await unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error;
  }
}

async function discardStagedProjectPackageSaveFiles(stagedSave: StagedProjectPackageSave) {
  const projectRoot = await requireOwnedStagedProjectPackageSave(stagedSave);
  await removeFileIfPresent(join(projectRoot, stagedSave.manifestFileName));
  for (const generationRoot of [
    join(projectRoot, "manuscript", ".abe-generations", stagedSave.generationId),
    join(projectRoot, "metadata", ".abe-generations", stagedSave.generationId),
  ]) {
    if (!isPathContainedBy(projectRoot, generationRoot)) {
      throw new Error("Project save cleanup escaped the active package.");
    }
    await requireRealProjectPathContainment(projectRoot, generationRoot);
    await rm(generationRoot, { recursive: true, force: true });
  }
}

// Intent: normal Save publishes only an atomically replaced manifest after editor-side semantic verification.
async function stageExistingProjectPackageSave(
  projectRootValue: unknown,
  snapshot: unknown,
  faultInjector?: DesktopProjectPackageFaultInjector,
) {
  const projectRoot = await requireExistingProjectPackageRoot(projectRootValue);
  const rootStats = await lstat(projectRoot);
  const operationToken = randomUUID();
  const stagedSave: StagedProjectPackageSave = {
    operationToken,
    projectRoot,
    projectDevice: rootStats.dev,
    projectInode: rootStats.ino,
    generationId: randomUUID(),
    manifestFileName: `${PROJECT_PACKAGE_SAVE_PREFIX}${operationToken}.json`,
  };
  stagedProjectPackageSaves.set(operationToken, stagedSave);
  try {
    await writeProjectPackageAtRoot(projectRoot, snapshot, {
      generationId: stagedSave.generationId,
      manifestFileName: stagedSave.manifestFileName,
      afterStructuredSidecarWrite: faultInjector?.afterStructuredSidecarWrite,
    });
    return { operationToken, rootPath: projectRoot };
  } catch (error) {
    try {
      await discardStagedProjectPackageSaveFiles(stagedSave);
    } finally {
      stagedProjectPackageSaves.delete(operationToken);
    }
    throw error;
  }
}

async function loadStagedProjectPackageSave(operationTokenValue: unknown) {
  const operationToken = typeof operationTokenValue === "string" ? operationTokenValue.trim() : "";
  const stagedSave = stagedProjectPackageSaves.get(operationToken);
  if (!stagedSave) throw new Error("Project package save operation is invalid or expired.");
  const projectRoot = await requireOwnedStagedProjectPackageSave(stagedSave);
  const snapshot = await readProjectPackageFromManifest(
    projectRoot,
    join(projectRoot, stagedSave.manifestFileName),
    { strictPackage: true },
  );
  delete snapshot._meta;
  return { rootPath: projectRoot, snapshot };
}

async function commitStagedProjectPackageSave(operationTokenValue: unknown) {
  const operationToken = typeof operationTokenValue === "string" ? operationTokenValue.trim() : "";
  const stagedSave = stagedProjectPackageSaves.get(operationToken);
  if (!stagedSave) throw new Error("Project package save operation is invalid or expired.");
  const projectRoot = await requireOwnedStagedProjectPackageSave(stagedSave);
  const stagedManifestPath = join(projectRoot, stagedSave.manifestFileName);
  const stagedManifestStats = await lstat(stagedManifestPath);
  if (!stagedManifestStats.isFile() || stagedManifestStats.isSymbolicLink()) {
    throw new Error("Staged project manifest must be a regular file.");
  }
  await rename(stagedManifestPath, join(projectRoot, "project.json"));
  stagedProjectPackageSaves.delete(operationToken);
  return projectRoot;
}

async function discardStagedProjectPackageSave(operationTokenValue: unknown) {
  const operationToken = typeof operationTokenValue === "string" ? operationTokenValue.trim() : "";
  const stagedSave = stagedProjectPackageSaves.get(operationToken);
  if (!stagedSave) throw new Error("Project package save operation is invalid or expired.");
  await discardStagedProjectPackageSaveFiles(stagedSave);
  stagedProjectPackageSaves.delete(operationToken);
}

// Intent: retain legacy path inference only for compatibility callers using the old project-file route.
async function writeProjectPackage(filePath: string, snapshot: unknown): Promise<string> {
  const projectRoot = await resolveWritableProjectRoot(filePath);
  return writeProjectPackageAtRoot(projectRoot, snapshot);
}

async function writeBinaryFile(filePath: string, content: Buffer): Promise<string> {
  const resolvedPath = resolvePath(filePath);
  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, content);
  return resolvedPath;
}

// Intent: delete a project media file without failing stale metadata cleanup when the file is already absent.
async function deleteBinaryFile(filePath: string): Promise<{ filePath: string; removed: boolean }> {
  const resolvedPath = resolvePath(filePath);
  try {
    await unlink(resolvedPath);
    return {
      filePath: resolvedPath,
      removed: true,
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        filePath: resolvedPath,
        removed: false,
      };
    }
    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function normalizeLogLevel(candidate: unknown): "debug" | "info" | "warn" | "error" {
  if (candidate === "debug" || candidate === "info" || candidate === "warn" || candidate === "error") {
    return candidate;
  }

  return "info";
}
