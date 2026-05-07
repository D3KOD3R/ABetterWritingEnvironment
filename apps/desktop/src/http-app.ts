import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { createDesktopSettingsSnapshot } from "./settings.ts";
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
    return textResponse(204, "text/plain; charset=utf-8", "", apiCorsHeaders());
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
      const resolvedPath = await writeJsonFile(filePath, body.snapshot);
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
      const resolvedPath = resolvePath(filePath);
      const content = await readFile(resolvedPath, "utf8");
      const snapshot = parseJsonText(content);
      logDesktopInfo("project-file", "Loaded a project file.", {
        filePath: resolvedPath,
      });
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

async function writeJsonFile(filePath: string, value: unknown): Promise<string> {
  const resolvedPath = resolvePath(filePath);
  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, JSON.stringify(value, null, 2), "utf8");
  return resolvedPath;
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
