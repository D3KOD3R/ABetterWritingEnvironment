// Intent: prove the initial Visual Studio scaffold reads existing project data without mutation.
import assert from "node:assert/strict";
import {
  buildVisualAssetLibraryModel,
  safeVisualAssetPreviewUrl,
} from "../apps/editor/public/features/visual-studio/visual-asset-library-model.js";
import {
  renderVisualAssetLibraryPanelHTML,
} from "../apps/editor/public/features/visual-studio/visual-asset-library-panel.js";

export function runVisualAssetLibraryTest() {
  const fixture = {
    id: "project-serva-vitae",
    title: "Project Serva Vitae",
    projectSettings: {
      assetRegistry: [
        {
          id: "asset-shai-markiv",
          kind: "costume",
          fileRef: "assets/images/costumes/shai-markiv.png",
          metadata: {
            title: "Shai Mark IV",
            entityIds: ["character-shai"],
            sceneIds: ["scene-0015"],
            status: "approved",
          },
        },
        {
          id: "asset-ceres",
          kind: "location",
          sceneId: "scene-0011",
          fileRef: "assets/images/worldbuilding/ceres.png",
          metadata: {
            title: "Ceres Station",
            entityId: "place-ceres",
          },
        },
        {
          id: 'bad"><img src=x onerror=alert(1)>',
          kind: "scene",
          metadata: {
            title: "<script>alert('unsafe')</script>",
            previewUrl: "javascript:alert(1)",
            entityId: "missing-entity",
          },
        },
      ],
    },
    workspace: {
      world: {
        entities: [
          {
            id: "character-shai",
            name: "Shai Siante",
            templateName: "Character",
            image: {
              name: "shai.png",
              dataUrl: "data:image/png;base64,aGVsbG8=",
              mediaType: "image/png",
            },
          },
          {
            id: "place-ceres",
            name: "Ceres",
            templateName: "Station",
            image: {
              projectRelativePath: "assets/images/worldbuilding/ceres.png",
              mediaType: "image/png",
            },
          },
        ],
      },
    },
  };
  const before = JSON.stringify(fixture);
  const all = buildVisualAssetLibraryModel({ projectRecord: fixture });

  assert.equal(all.projectId, "project-serva-vitae");
  assert.equal(all.total, 4, "already-registered entity image should not appear twice");
  assert.equal(all.filteredCount, 4);
  assert.equal(all.counts.character, 1);
  assert.equal(all.counts.costume, 1);
  assert.equal(all.counts.environment, 1);
  assert.equal(all.counts.scene, 1);

  const shaiArmor = all.assets.find((asset) => asset.id === "asset-shai-markiv");
  assert.deepEqual(shaiArmor.entityIds, ["character-shai"]);
  assert.deepEqual(shaiArmor.sceneIds, ["scene-0015"]);
  assert.equal(shaiArmor.status, "approved");
  assert.equal(shaiArmor.category, "costume");

  const legacy = all.assets.find((asset) => asset.id === "legacy-world-image:character-shai");
  assert.ok(legacy);
  assert.equal(legacy.source, "legacy-world-image");
  assert.equal(legacy.category, "character");
  assert.equal(legacy.availability, "preview-only");
  assert.equal(legacy.previewUrl, "data:image/png;base64,aGVsbG8=");

  assert.deepEqual(
    all.assets.find((asset) => asset.id === "asset-ceres").sceneIds,
    ["scene-0011"],
  );
  assert.deepEqual(
    all.assets.find((asset) => asset.category === "scene").missingEntityIds,
    ["missing-entity"],
  );

  assert.equal(buildVisualAssetLibraryModel({
    projectRecord: fixture,
    category: "costume",
  }).filteredCount, 1);
  assert.equal(buildVisualAssetLibraryModel({
    projectRecord: fixture,
    query: "Shai",
  }).filteredCount, 2);
  assert.equal(buildVisualAssetLibraryModel({
    projectRecord: fixture,
    query: "scene-0011",
  }).filteredCount, 1);

  const html = renderVisualAssetLibraryPanelHTML({
    ...all,
    query: '"><svg/onload=alert(1)>',
  });
  assert.match(html, /Visual Asset Library/);
  assert.match(html, /Shai Mark IV/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /No preview/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /src="javascript:/);
  assert.doesNotMatch(html, /value=""><svg/);
  assert.equal(safeVisualAssetPreviewUrl("data:image/svg+xml;base64,PHN2Zz4="), "");
  assert.equal(safeVisualAssetPreviewUrl("file:///etc/passwd"), "");
  assert.equal(safeVisualAssetPreviewUrl("javascript:alert(1)"), "");
  assert.equal(JSON.stringify(fixture), before, "pure browsing must not mutate canonical records");

  const empty = buildVisualAssetLibraryModel();
  assert.equal(empty.total, 0);
  assert.match(renderVisualAssetLibraryPanelHTML(empty), /No visual assets have been registered/);
}
