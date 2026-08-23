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
  const sourceBlob = new Blob(["voice bytes"], { type: "audio/webm" });
  const contentBase64 = await blobToBase64(sourceBlob);
  assert.equal(contentBase64, "dm9pY2UgYnl0ZXM=");

  const restoredBlob = base64ToBlob(contentBase64, "audio/webm");
  assert.equal(restoredBlob.type, "audio/webm");
  assert.equal(await restoredBlob.text(), "voice bytes");

  const calls = [];
  const service = createNarrationMediaService({
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
  assert.equal(calls[0].options.body.filePath, "recordings/take.webm");
  assert.equal(calls[0].options.body.contentBase64, contentBase64);

  const loaded = await service.loadMediaBlob({
    filePath: "recordings/take.webm",
    mediaMimeType: "audio/webm",
  });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.filePath, "recordings/take.webm");
  assert.equal(await loaded.blob.text(), "voice bytes");
  assert.equal(calls[1].pathname, "/api/project-media/load");

  const deleted = await service.deleteMediaFile({
    filePath: " recordings/take.webm ",
  });
  assert.equal(deleted.ok, true);
  assert.equal(deleted.filePath, "recordings/take.webm");
  assert.equal(deleted.removed, true);
  assert.equal(calls[2].pathname, "/api/project-media/delete");
  assert.equal(calls[2].options.method, "POST");
  assert.equal(calls[2].options.body.filePath, "recordings/take.webm");

  await assert.rejects(
    () => loadMediaBlob({ filePath: "recordings/missing.webm" }, {
      fetchJson: async () => ({ ok: true, value: { contentBase64: "" } }),
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
