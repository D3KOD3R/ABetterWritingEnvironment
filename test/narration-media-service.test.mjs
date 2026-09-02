// Intent: verify narration media endpoint calls and base64 conversion stay outside app.js.
import assert from "node:assert/strict";

import {
  base64ToBlob,
  blobToBase64,
  createNarrationMediaService,
  deleteMediaFile,
  loadMediaBlob,
} from "../apps/editor/public/features/narration/narration-media-service.js";

export async function runNarrationMediaServiceTest() {
  const activeProjectRoot = "C:\\Projects\\Novel.abe-project";
  const sourceBlob = new Blob(["voice bytes"], { type: "audio/webm" });
  const contentBase64 = await blobToBase64(sourceBlob);
  assert.equal(contentBase64, "dm9pY2UgYnl0ZXM=");

  const restoredBlob = base64ToBlob(contentBase64, "audio/webm");
  assert.equal(restoredBlob.type, "audio/webm");
  assert.equal(await restoredBlob.text(), "voice bytes");

  const calls = [];
  const service = createNarrationMediaService({
    getActiveProjectRoot: () => activeProjectRoot,
    fetchJson: async (pathname, options) => {
      calls.push({ pathname, options });
      if (pathname.endsWith("/save")) {
        return { ok: true, value: {} };
      }
      if (pathname.endsWith("/delete")) {
        return { ok: true, value: { removed: true } };
      }
      return {
        ok: true,
        value: { contentBase64 },
      };
    },
  });

  assert.deepEqual(await service.saveMediaBlob({
    filePath: " recordings/take.webm ",
    blob: sourceBlob,
  }), {
    ok: true,
    filePath: "recordings/take.webm",
  });
  assert.equal(calls[0].pathname, "/api/project-media/save");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.body.activeProjectRoot, activeProjectRoot);
  assert.equal(calls[0].options.body.projectRelativePath, "recordings/take.webm");
  assert.equal(calls[0].options.body.contentBase64, contentBase64);

  const loaded = await service.loadMediaBlob({
    filePath: "recordings/take.webm",
    mediaMimeType: "audio/webm",
  });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.filePath, "recordings/take.webm");
  assert.equal(await loaded.blob.text(), "voice bytes");
  assert.equal(calls[1].pathname, "/api/project-media/load");
  assert.equal(calls[1].options.body.activeProjectRoot, activeProjectRoot);
  assert.equal(calls[1].options.body.projectRelativePath, "recordings/take.webm");

  const deleted = await service.deleteMediaFile({
    filePath: " recordings/take.webm ",
  });
  assert.equal(deleted.ok, true);
  assert.equal(deleted.filePath, "recordings/take.webm");
  assert.equal(deleted.removed, true);
  assert.equal(calls[2].pathname, "/api/project-media/delete");
  assert.equal(calls[2].options.method, "POST");
  assert.equal(calls[2].options.body.activeProjectRoot, activeProjectRoot);
  assert.equal(calls[2].options.body.projectRelativePath, "recordings/take.webm");

  await assert.rejects(
    () => service.saveMediaBlob({ filePath: "../escape.webm", blob: sourceBlob }),
    /project-relative/,
  );
  await assert.rejects(
    () => createNarrationMediaService({
      fetchJson: async () => ({ ok: true, value: {} }),
      getActiveProjectRoot: () => "",
    }).saveMediaBlob({ filePath: "assets/audio/take.webm", blob: sourceBlob }),
    /folder-backed package/,
  );

  await assert.rejects(
    () => loadMediaBlob({ filePath: "recordings/missing.webm" }, {
      fetchJson: async () => ({ ok: true, value: { contentBase64: "" } }),
      getActiveProjectRoot: () => activeProjectRoot,
    }),
    /empty/,
  );
  await assert.rejects(
    () => deleteMediaFile({ filePath: "" }, {
      fetchJson: async () => ({ ok: true, value: {} }),
    }),
    /required/,
  );
}
