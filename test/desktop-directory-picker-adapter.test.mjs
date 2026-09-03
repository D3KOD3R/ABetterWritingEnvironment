// Intent: prove the desktop Scrivener bridge reuses the native directory selection contract and preserves browser fallback.
import assert from "node:assert/strict";

import {
  installDesktopDirectoryPickerBridge,
  queueDesktopDirectoryForNextPicker,
} from "../apps/editor/public/adapters/platform/desktop-directory-picker.js";

function createJsonResponse(status, payload) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() {
      return payload;
    },
  };
}

function encodeText(value) {
  return Buffer.from(String(value), "utf8").toString("base64");
}

export async function runDesktopDirectoryPickerAdapterTest() {
  const requests = [];
  const fetchImpl = async (pathname, options = {}) => {
    const body = JSON.parse(options.body || "{}");
    requests.push({ pathname, body });

    if (pathname === "/api/platform/directory/list") {
      if (!body.relativePath) {
        return createJsonResponse(200, {
          ok: true,
          rootPath: "C:\\Novel.scriv",
          relativePath: "",
          entries: [
            {
              name: "Files",
              kind: "directory",
              relativePath: "Files",
              size: 0,
              type: "",
              lastModified: 1,
            },
            {
              name: "Novel.scrivx",
              kind: "file",
              relativePath: "Novel.scrivx",
              size: 12,
              type: "application/xml",
              lastModified: 2,
            },
          ],
        });
      }
      return createJsonResponse(200, {
        ok: true,
        rootPath: "C:\\Novel.scriv",
        relativePath: "Files",
        entries: [
          {
            name: "content.rtf",
            kind: "file",
            relativePath: "Files/content.rtf",
            size: 11,
            type: "application/rtf",
            lastModified: 3,
          },
        ],
      });
    }

    if (pathname === "/api/platform/directory/read-file") {
      const text = body.relativePath === "Novel.scrivx" ? "<Scrivener/>" : "{\\rtf1 Text}";
      return createJsonResponse(200, {
        ok: true,
        rootPath: "C:\\Novel.scriv",
        relativePath: body.relativePath,
        name: body.relativePath.split("/").at(-1),
        size: text.length,
        type: "text/plain",
        lastModified: 4,
        contentBase64: encodeText(text),
      });
    }

    throw new Error(`Unexpected route ${pathname}`);
  };

  let browserPickerCalls = 0;
  const browserHandle = { kind: "directory", name: "Browser fallback" };
  const windowRef = {
    async showDirectoryPicker() {
      browserPickerCalls += 1;
      return browserHandle;
    },
  };

  assert.equal(installDesktopDirectoryPickerBridge({ windowRef }), true);
  queueDesktopDirectoryForNextPicker({
    rootPath: "C:\\Novel.scriv",
    windowRef,
    fetchImpl,
  });

  const handle = await windowRef.showDirectoryPicker({ id: "scrivener-project-import" });
  assert.equal(handle.kind, "directory");
  assert.equal(handle.name, "Novel.scriv");
  assert.equal(browserPickerCalls, 0);

  const rootEntries = [];
  for await (const entry of handle.entries()) {
    rootEntries.push(entry);
  }
  assert.deepEqual(rootEntries.map(([name]) => name), ["Files", "Novel.scrivx"]);

  const scrivxFile = await rootEntries.find(([name]) => name === "Novel.scrivx")[1].getFile();
  assert.equal(await scrivxFile.text(), "<Scrivener/>");

  const filesHandle = rootEntries.find(([name]) => name === "Files")[1];
  const nestedEntries = [];
  for await (const entry of filesHandle.entries()) {
    nestedEntries.push(entry);
  }
  const rtfFile = await nestedEntries[0][1].getFile();
  assert.equal(await rtfFile.text(), "{\\rtf1 Text}");

  assert.deepEqual(
    requests.filter((request) => request.pathname === "/api/platform/directory/read-file")
      .map((request) => request.body.relativePath),
    ["Novel.scrivx", "Files/content.rtf"],
  );

  // Once the queued desktop selection is consumed, the original browser picker remains the compatibility fallback.
  assert.equal(await windowRef.showDirectoryPicker(), browserHandle);
  assert.equal(browserPickerCalls, 1);
}
