// Intent: verify custom metadata definitions stay normalized before they drive console tabs.
import assert from "node:assert/strict";

import {
  CUSTOM_METADATA_ICON_MAX_BYTES,
  buildCustomMetadataSidePanelFeatures,
  createCustomMetadataDefinition,
  getCustomMetadataVisualStyle,
  getMetadataNoteLabel,
  isCustomMetadataNoteType,
  normalizeCustomMetadataIcon,
  normalizeCustomMetadataDefinitions,
  validateCustomMetadataIconFile,
} from "../apps/editor/public/features/metadata-console/custom-metadata-service.js";
import { renderCustomMetadataFormHTML } from "../apps/editor/public/features/metadata-console/custom-metadata-panel.js";

export function runCustomMetadataServiceTest() {
  const icon = {
    dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    mediaType: "image/png",
    name: " lore icon.png ",
    size: 68,
  };
  const created = createCustomMetadataDefinition({
    label: " Lore ",
    highlightColor: "#aabbcc",
    icon,
  }, [{
    id: "metadata-lore",
    label: "Lore",
    highlightColor: "#112233",
  }], "2026-07-15T01:00:00.000Z");

  assert.equal(created.definition.id, "metadata-lore-2");
  assert.equal(created.definition.label, "Lore");
  assert.equal(created.definition.highlightColor, "#aabbcc");
  assert.equal(created.definition.icon.name, "lore icon.png");
  assert.equal(created.definition.icon.mediaType, "image/png");
  assert.equal(created.definitions.length, 2);

  assert.deepEqual(normalizeCustomMetadataDefinitions([
    { id: "bad", label: "Character Web", color: "#ff00aa" },
    { id: "metadata-lore", label: "" },
  ]), [{
    id: "metadata-character-web",
    label: "Character Web",
    highlightColor: "#ff00aa",
    createdAt: "",
    updatedAt: "",
  }]);

  assert.equal(isCustomMetadataNoteType("metadata-lore"), true);
  assert.equal(isCustomMetadataNoteType("research"), false);
  assert.equal(getMetadataNoteLabel("metadata-lore", created.definitions), "Lore");
  assert.equal(buildCustomMetadataSidePanelFeatures(created.definitions)[1].icon.dataUrl, icon.dataUrl);
  assert.deepEqual(buildCustomMetadataSidePanelFeatures(created.definitions).map((feature) => feature.id), [
    "metadata-lore",
    "metadata-lore-2",
  ]);
  assert.equal(getCustomMetadataVisualStyle("metadata-lore", created.definitions).highlightColor, "rgba(17, 34, 51, 0.56)");
  assert.equal(normalizeCustomMetadataIcon(icon).dataUrl, icon.dataUrl);
  assert.equal(validateCustomMetadataIconFile({ type: "image/webp", size: 128 }), "");
  assert.equal(validateCustomMetadataIconFile({ type: "image/svg+xml", size: 128 }), "icon-type-unsupported");
  assert.equal(validateCustomMetadataIconFile({ type: "image/png", size: CUSTOM_METADATA_ICON_MAX_BYTES + 1 }), "icon-too-large");
  assert.equal(normalizeCustomMetadataIcon({ dataUrl: "data:text/plain;base64,AAAA", mediaType: "text/plain", size: 3 }), null);

  const formHtml = renderCustomMetadataFormHTML({ open: true, draft: { label: "Lore" } });
  assert.match(formHtml, /form-dismiss-button custom-metadata-form__dismiss/);
  assert.match(formHtml, /data-action="close-custom-metadata-form"/);
  assert.doesNotMatch(formHtml, />Cancel<\/button>/);
}
