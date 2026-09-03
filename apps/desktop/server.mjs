// Intent: launch the local desktop HTTP host used by the browser editor and service adapters.
import http from "node:http";

import { createDesktopResponseForRequest } from "./src/http-app.ts";
import {
  listDesktopDirectoryEntries,
  pickDesktopDirectory,
  readDesktopDirectoryFile,
} from "./src/directory-picker.ts";

const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 4310);

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  const body = await readRequestBody(request);

  // Intent: keep native UI capabilities at the desktop-host edge rather than inside project persistence.
  if ((request.method ?? "GET").toUpperCase() === "POST" && url.pathname === "/api/platform/pick-directory") {
    try {
      const payload = parseJsonBody(body);
      const result = await pickDesktopDirectory({
        initialPath: typeof payload.initialPath === "string" ? payload.initialPath : "",
      });
      writeJsonResponse(response, result.supported ? 200 : 501, {
        ok: result.supported,
        ...result,
        message: result.supported ? "" : "Native folder selection is not available on this desktop platform.",
      });
    } catch (error) {
      writeJsonResponse(response, 500, {
        ok: false,
        supported: true,
        cancelled: false,
        path: "",
        message: error instanceof Error ? error.message : "Unable to open the native folder picker.",
      });
    }
    return;
  }

  // Intent: expose a read-only, containment-checked directory view for importers after the user selects a root.
  if ((request.method ?? "GET").toUpperCase() === "POST" && url.pathname === "/api/platform/directory/list") {
    try {
      const payload = parseJsonBody(body);
      const result = await listDesktopDirectoryEntries({
        rootPath: typeof payload.rootPath === "string" ? payload.rootPath : "",
        relativePath: typeof payload.relativePath === "string" ? payload.relativePath : "",
      });
      writeJsonResponse(response, 200, {
        ok: true,
        ...result,
      });
    } catch (error) {
      writeJsonResponse(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to list the selected directory.",
      });
    }
    return;
  }

  if ((request.method ?? "GET").toUpperCase() === "POST" && url.pathname === "/api/platform/directory/read-file") {
    try {
      const payload = parseJsonBody(body);
      const result = await readDesktopDirectoryFile({
        rootPath: typeof payload.rootPath === "string" ? payload.rootPath : "",
        relativePath: typeof payload.relativePath === "string" ? payload.relativePath : "",
      });
      writeJsonResponse(response, 200, {
        ok: true,
        ...result,
      });
    } catch (error) {
      writeJsonResponse(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to read the selected directory file.",
      });
    }
    return;
  }

  const result = await createDesktopResponseForRequest({
    method: request.method,
    pathname: url.pathname,
    body,
  });

  // Intent: give browser-side adapters a synchronous host-capability marker without probing an API and losing user activation.
  if (
    (url.pathname === "/" || url.pathname === "/index.html")
    && typeof result.body === "string"
    && result.headers["Content-Type"]?.startsWith("text/html")
  ) {
    result.body = result.body.replace(
      "<head>",
      `<head>
    <meta name="abe-desktop-host" content="true" />
    <meta name="abe-native-directory-picker" content="${process.platform === "win32" ? "true" : "false"}" />`,
    );
  }

  response.writeHead(result.statusCode, result.headers);
  response.end(result.body);
});

server.listen(port, host, () => {
  console.log(`Desktop host running at http://${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
}

function parseJsonBody(body) {
  if (!body) return {};
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeJsonResponse(response, statusCode, value) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 25_000_000) {
        request.destroy(new Error("Request body too large."));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}
