import http from "node:http";

import { createDesktopResponseForRequest } from "./src/http-app.ts";

const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 4310);

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  const body = await readRequestBody(request);
  const result = await createDesktopResponseForRequest({
    method: request.method,
    pathname: url.pathname,
    body,
  });

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
