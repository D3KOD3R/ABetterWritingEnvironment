// Intent: enforce read-only selected-directory containment for desktop import adapters.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  listDesktopDirectoryEntries,
  readDesktopDirectoryFile,
} from "../apps/desktop/src/directory-picker.ts";

export async function runDesktopDirectoryPickerTest() {
  const rootPath = await mkdtemp(path.join(tmpdir(), "abe-directory-picker-"));
  try {
    await mkdir(path.join(rootPath, "Files"), { recursive: true });
    await writeFile(path.join(rootPath, "Novel.scrivx"), "<Scrivener/>", "utf8");
    await writeFile(path.join(rootPath, "Files", "content.rtf"), "{\\rtf1 Text}", "utf8");

    const rootListing = await listDesktopDirectoryEntries({ rootPath });
    assert.deepEqual(
      rootListing.entries.map((entry) => [entry.kind, entry.name]),
      [["directory", "Files"], ["file", "Novel.scrivx"]],
    );

    const nestedListing = await listDesktopDirectoryEntries({
      rootPath,
      relativePath: "Files",
    });
    assert.equal(nestedListing.entries[0].relativePath, "Files/content.rtf");

    const file = await readDesktopDirectoryFile({
      rootPath,
      relativePath: "Files/content.rtf",
    });
    assert.equal(Buffer.from(file.contentBase64, "base64").toString("utf8"), "{\\rtf1 Text}");
    assert.equal(file.name, "content.rtf");

    await assert.rejects(
      () => readDesktopDirectoryFile({
        rootPath,
        relativePath: "../outside.txt",
      }),
      /stay relative|escape the chosen root/,
    );
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
}
