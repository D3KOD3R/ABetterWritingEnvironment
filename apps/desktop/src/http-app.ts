import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createDesktopSettingsSnapshot } from "./settings.ts";
import { createDesktopWorkspaceSnapshot } from "./workspace.ts";
import {
  LlamaCppProvider,
  LocalAiRouter,
  type AiRequest,
} from "../../../services/local-ai/index.ts";

const INDEX_HTML_PATH = fileURLToPath(new URL("../../editor/public/index.html", import.meta.url));
const APP_JS_PATH = fileURLToPath(new URL("../../editor/public/app.js", import.meta.url));
const EDITOR_MODEL_JS_PATH = fileURLToPath(
  new URL("../../editor/public/editor-model.js", import.meta.url),
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

  if (pathname === "/editor-model.js") {
    return textResponse(
      200,
      "text/javascript; charset=utf-8",
      readFileSync(EDITOR_MODEL_JS_PATH, "utf8"),
    );
  }

  if (pathname === "/styles.css") {
    return textResponse(200, "text/css; charset=utf-8", readFileSync(STYLES_CSS_PATH, "utf8"));
  }

  if (pathname === "/api/workspace") {
    return textResponse(
      200,
      "application/json; charset=utf-8",
      JSON.stringify(createDesktopWorkspaceSnapshot()),
    );
  }

  if (pathname === "/api/settings") {
    return textResponse(
      200,
      "application/json; charset=utf-8",
      JSON.stringify(createDesktopSettingsSnapshot()),
    );
  }

  return textResponse(
    404,
    "text/plain; charset=utf-8",
    "Not found. Try '/', '/app.js', '/editor-model.js', '/styles.css', '/api/workspace', '/api/settings', or '/api/local-ai/status'.",
  );
}

export async function createDesktopResponseForRequest(
  request: DesktopHttpRequest,
): Promise<DesktopHttpResponse> {
  const method = (request.method ?? "GET").toUpperCase();

  if (method === "GET" && request.pathname === "/api/local-ai/status") {
    return jsonResponse(200, await localAiRouter.status());
  }

  if (method === "POST" && request.pathname === "/api/local-ai/generate-title") {
    return jsonResponse(200, await localAiRouter.generate(createAiRouteRequest(request, {
      taskType: "generate_scene_labels",
      outputFormat: "text",
    })));
  }

  if (method === "POST" && request.pathname === "/api/local-ai/generate-tags") {
    return jsonResponse(200, await localAiRouter.generate(createAiRouteRequest(request, {
      taskType: "generate_tags",
      outputFormat: "json",
    })));
  }

  if (method === "POST" && request.pathname === "/api/local-ai/continuity-check") {
    return jsonResponse(200, await localAiRouter.generate(createAiRouteRequest(request, {
      taskType: "run_continuity_check",
      outputFormat: "text",
    })));
  }

  if (method !== "GET") {
    return jsonResponse(405, {
      ok: false,
      message: `${method} is not supported for ${request.pathname}.`,
    });
  }

  return createDesktopResponse(request.pathname);
}

function textResponse(statusCode: number, contentType: string, body: string): DesktopHttpResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
    body,
  };
}

function jsonResponse(statusCode: number, value: unknown): DesktopHttpResponse {
  return textResponse(statusCode, "application/json; charset=utf-8", JSON.stringify(value));
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
