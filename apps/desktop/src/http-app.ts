// Intent: expose the desktop HTTP surface that serves the editor, workspace data, settings, and local services.
import { readFileSync } from "node:fs";
import { appendFile, mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve as resolvePath } from "node:path";
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
  body: string;
}

export interface DesktopHttpRequest {
  method?: string;
  pathname: string;
  body?: string;
}

const localAiRouter = new LocalAiRouter(new LlamaCppProvider());

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
    const filePath = normalizeFilePath(body.filePath);
    const contentBase64 = typeof body.contentBase64 === "string" ? body.contentBase64.trim() : "";
    if (!filePath) {
      return jsonResponse(400, {
        ok: false,
        message: "A media file path is required.",
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
      const resolvedPath = await writeBinaryFile(filePath, binary);
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
        filePath,
      });
      return jsonResponse(500, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to save the project media file.",
      }, apiCorsHeaders());
    }
  }

  if (method === "POST" && request.pathname === "/api/project-media/load") {
    const body = parseJsonBody(request.body);
    const filePath = normalizeFilePath(body.filePath);
    if (!filePath) {
      return jsonResponse(400, {
        ok: false,
        message: "A media file path is required.",
      }, apiCorsHeaders());
    }

    try {
      const resolvedPath = resolvePath(filePath);
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
        filePath,
      });
      return jsonResponse(500, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load the project media file.",
      }, apiCorsHeaders());
    }
  }

  if (method === "OPTIONS" && request.pathname.startsWith("/api/")) {
    return textResponse(204, "text/plain; charset=utf-8", "", apiCorsHeaders());
  }

  if (method === "GET" && request.pathname === "/api/local-ai/status") {
    return jsonResponse(200, await localAiRouter.status(), apiCorsHeaders());
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
  return blocks
    .map((block) => (typeof block?.text === "string" ? block.text : ""))
    .filter((line) => line.length > 0)
    .join("\n\n");
}

function normalizeSceneDraft(sceneId: string, candidate: any): Record<string, any> {
  const fallbackId = normalizeSceneId(sceneId);
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
  const normalizedBlocks = Array.isArray(source.blocks)
    ? source.blocks.map((block: any, index: number) => ({
      blockId: typeof block?.blockId === "string" && block.blockId.trim()
        ? block.blockId
        : `block-${fallbackId}-${index + 1}`,
      lineNumber: Number.isFinite(Number(block?.lineNumber)) ? Number(block.lineNumber) : null,
      kind: typeof block?.kind === "string" ? block.kind : "narration",
      speakerLabel: typeof block?.speakerLabel === "string" ? block.speakerLabel : "",
      text: typeof block?.text === "string" ? block.text : "",
      issueIds: Array.isArray(block?.issueIds) ? [...block.issueIds] : [],
      eventTagIds: Array.isArray(block?.eventTagIds) ? [...block.eventTagIds] : [],
      isDraft: block?.isDraft === true || block?.lineNumber == null,
    }))
    : [];

  return {
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
  const schemaVersion = Number(candidate.schemaVersion) || 2;

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

    scene.blocks.push({
      blockId: typeof line?.blockId === "string" && line.blockId.trim()
        ? line.blockId
        : `block-${sceneId}-${scene.blocks.length + 1}`,
      lineNumber: Number.isFinite(Number(line?.lineNumber)) ? Number(line.lineNumber) : null,
      kind: typeof line?.kind === "string" ? line.kind : "narration",
      speakerLabel: typeof line?.speakerLabel === "string" ? line.speakerLabel : "",
      text: typeof line?.text === "string" ? line.text : "",
      issueIds: Array.isArray(line?.issueIds) ? [...line.issueIds] : [],
      eventTagIds: Array.isArray(line?.eventTagIds) ? [...line.eventTagIds] : [],
      isDraft: false,
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

function buildSceneFilesForProject(projectRecord: Record<string, any>, sceneOrder: string[]) {
  const existingSceneFiles = projectRecord?.projectStorage?.sceneFiles
    && typeof projectRecord.projectStorage.sceneFiles === "object"
    && !Array.isArray(projectRecord.projectStorage.sceneFiles)
    ? projectRecord.projectStorage.sceneFiles
    : {};
  const sceneFiles: Record<string, string> = {};
  const projectId = typeof projectRecord.id === "string" ? projectRecord.id : "project";
  for (const sceneId of sceneOrder) {
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

async function ensureProjectPackageScaffold(projectRoot: string) {
  const requiredDirectories = [
    projectRoot,
    join(projectRoot, "manuscript"),
    join(projectRoot, "manuscript", "chapters"),
    join(projectRoot, "manuscript", "scenes"),
    join(projectRoot, "assets"),
    join(projectRoot, "assets", "audio"),
    join(projectRoot, "assets", "images"),
    join(projectRoot, "transcripts"),
    join(projectRoot, "cache"),
    join(projectRoot, "cache", "waveforms"),
    join(projectRoot, "cache", "ai-index"),
  ];

  for (const directory of requiredDirectories) {
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

async function readSceneStoreFromManifest(projectRoot: string, manifestProjects: Array<Record<string, any>>) {
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
      const scenePath = resolvePath(projectRoot, relativeScenePath);
      if (!(await pathExists(scenePath))) {
        continue;
      }

      try {
        const sceneContent = await readFile(scenePath, "utf8");
        projectScenes[sceneId] = normalizeSceneDraft(sceneId, parseJsonText(sceneContent));
      } catch {
        // Skip malformed or unreadable scene chunks.
      }
    }

    if (Object.keys(projectScenes).length) {
      sceneStore[projectId] = projectScenes;
    }
  }

  return sceneStore;
}

async function readProjectPackage(filePath: string): Promise<Record<string, any>> {
  const resolvedPath = resolvePath(filePath);
  const stats = await stat(resolvedPath);
  if (stats.isDirectory()) {
    const manifestPath = join(resolvedPath, "project.json");
    if (!(await pathExists(manifestPath))) {
      throw new Error(`Missing project manifest at ${manifestPath}.`);
    }
    const manifestContent = await readFile(manifestPath, "utf8");
    const manifestSnapshot = normalizeProjectLibrarySnapshotCandidate(parseJsonText(manifestContent));
    const sceneStore = await readSceneStoreFromManifest(resolvedPath, manifestSnapshot.projects);
    return {
      schemaVersion: manifestSnapshot.schemaVersion,
      activeProjectId: manifestSnapshot.activeProjectId,
      projects: manifestSnapshot.projects,
      sceneStore,
      _meta: {
        rootPath: resolvedPath,
        manifestPath,
      },
    };
  }

  const fileContent = await readFile(resolvedPath, "utf8");
  const parsed = parseJsonText(fileContent) as Record<string, any>;
  if (resolvedPath.toLowerCase().endsWith("project.json")) {
    const rootPath = dirname(resolvedPath);
    const manifestSnapshot = normalizeProjectLibrarySnapshotCandidate(parsed);
    const sceneStore = await readSceneStoreFromManifest(rootPath, manifestSnapshot.projects);
    return {
      schemaVersion: manifestSnapshot.schemaVersion,
      activeProjectId: manifestSnapshot.activeProjectId,
      projects: manifestSnapshot.projects,
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

async function writeProjectPackage(filePath: string, snapshot: unknown): Promise<string> {
  const candidateSnapshot = normalizeProjectLibrarySnapshotCandidate(snapshot);
  const projectRoot = await resolveWritableProjectRoot(filePath);
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
    const mergedScenes: Record<string, Record<string, any>> = {
      ...existingScenes,
      ...extractedScenes,
      ...explicitScenes,
    };

    const sceneOrder = getSceneOrderFromProject(projectRecord, mergedScenes);
    const sceneFiles = buildSceneFilesForProject(projectRecord, sceneOrder);

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
      const scenePath = resolvePath(projectRoot, relativeScenePath);
      await mkdir(dirname(scenePath), { recursive: true });
      await writeFile(scenePath, JSON.stringify(mergedScenes[normalizedId], null, 2), "utf8");
    }

    manifestProjects.push(
      buildProjectManifestRecord(projectRecord, sceneOrder, sceneFiles),
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
  const manifestPath = join(projectRoot, "project.json");
  await writeFile(manifestPath, JSON.stringify(manifestSnapshot, null, 2), "utf8");

  return projectRoot;
}

async function writeBinaryFile(filePath: string, content: Buffer): Promise<string> {
  const resolvedPath = resolvePath(filePath);
  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, content);
  return resolvedPath;
}

function normalizeLogLevel(candidate: unknown): "debug" | "info" | "warn" | "error" {
  if (candidate === "debug" || candidate === "info" || candidate === "warn" || candidate === "error") {
    return candidate;
  }

  return "info";
}
