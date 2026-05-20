// Intent: verify the revision panel can render a seeded, file-backed revision package end to end.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { createRevisionStorageService } from "../apps/editor/public/adapters/storage/revision-storage-service.js";
import { createRevisionPanelController } from "../apps/editor/public/features/revisions/revision-panel-controller.js";
import { renderRevisionPanelHTML } from "../apps/editor/public/features/revisions/revision-panel-view.js";
import { createRevisionPanelFixture, getDefaultRevisionFixtureSourcePath } from "./revision-panel-fixture.mjs";

export async function runRevisionPanelTest() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const scriptPath = path.join(repoRoot, "scripts", "seed-revision-panel-fixture.mjs");
  const sourcePath = getDefaultRevisionFixtureSourcePath();
  const tempDir = mkdtempSync(path.join(tmpdir(), "abe-revisions-panel-"));

  try {
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        scriptPath,
        "--source",
        sourcePath,
        "--output-root",
        tempDir,
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );

    if (result.error) {
      throw result.error;
    }

    assert.equal(
      result.status,
      0,
      `Revision fixture script failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );

    const scriptSummary = JSON.parse(result.stdout.trim());
    const projectJsonPath = path.join(tempDir, "project.json");
    const revisionsIndexPath = path.join(tempDir, "revisions", "index.json");
    const projectJson = JSON.parse(readFileSync(projectJsonPath, "utf8"));
    const revisionsIndex = JSON.parse(readFileSync(revisionsIndexPath, "utf8"));
    const sourceProjectJson = JSON.parse(readFileSync(sourcePath, "utf8"));
    assert.equal(scriptSummary.sourcePath, sourcePath);
    assert.equal(typeof scriptSummary.projectId, "string");
    assert.notEqual(scriptSummary.projectId, "");
    assert.equal(scriptSummary.sessionCount >= 2, true);
    assert.equal(existsSync(projectJsonPath), true);
    assert.equal(existsSync(revisionsIndexPath), true);
    assert.equal(sourceProjectJson.revisions.sessions.length >= 2, true);
    assert.equal(Array.isArray(sourceProjectJson.workspace?.project?.lines), true);
    assert.equal(sourceProjectJson.workspace.project.lines.some((line) => String(line?.text ?? "").includes("REVISIONSTEST A")), true);
    assert.equal(sourceProjectJson.workspace.project.lines.some((line) => String(line?.text ?? "").includes("REVISIONSTEST B")), true);
    assert.equal(projectJson.revisions.sessions.length >= 2, true);
    assert.equal(revisionsIndex.sessions.length >= 2, true);
    assert.equal(projectJson.revisions.sessions.some((session) => session.metadata.status === "archived"), true);
    assert.equal(projectJson.revisions.sessions.some((session) => session.metadata.status === "finalised"), true);
    assert.equal(
      projectJson.revisions.sessions.every((session) =>
        existsSync(path.join(tempDir, "revisions", "sessions", session.metadata.id, "revision.json")) &&
        existsSync(path.join(tempDir, "revisions", "sessions", session.metadata.id, "events.json")) &&
        existsSync(path.join(tempDir, "revisions", "sessions", session.metadata.id, "project.diff.json")) &&
        existsSync(path.join(tempDir, "revisions", "sessions", session.metadata.id, "summary.md")),
      ),
      true,
    );

    const storageService = createRevisionStorageService();
    const roundTripProject = { ...projectJson };
    const roundTripRevisionState = storageService.readRevisionState(roundTripProject);
    assert.equal(roundTripRevisionState.sessions.length, projectJson.revisions.sessions.length);
    assert.equal(roundTripRevisionState.sessions[0].events.length >= 2, true);
    assert.equal(roundTripRevisionState.sessions[0].diff.operations.length > 0, true);

    const panelController = createRevisionPanelController();
    const model = panelController.buildPanelModel(roundTripRevisionState, {
      selectedSessionId: roundTripRevisionState.sessions.at(-1)?.metadata.id ?? "",
      showFullDiff: false,
    });

    assert.equal(model.sessions.length >= 2, true);
    assert.equal(model.categoryOptions.includes("manuscript"), true);
    assert.equal(model.originOptions.includes("manual_editor"), true);
    assert.equal(model.originOptions.includes("local_ai"), true);
    assert.equal(model.filteredSessions.length >= 2, true);
    assert.equal(model.selectedSession?.metadata.status, "finalised");
    assert.equal(model.groupedSessions.length >= 1, true);

    const filteredModel = panelController.buildPanelModel(roundTripRevisionState, {
      query: "fixture",
      categoryFilter: "manuscript",
      originFilter: "manual_editor",
      selectedSessionId: roundTripRevisionState.sessions[0].metadata.id,
      showFullDiff: true,
    });
    assert.equal(filteredModel.filteredSessions.length >= 1, true);
    assert.equal(filteredModel.query, "fixture");
    assert.equal(filteredModel.showFullDiff, true);

    const html = renderRevisionPanelHTML(model);
    assert.match(html, /Revision History/);
    assert.match(html, /Writing Sessions/);
    assert.match(html, /Archived/);
    assert.match(html, /Banked/);
    assert.match(html, /Diff Preview/);
    assert.match(html, /Revision Summary/);
    assert.match(html, /Event Ledger/);
    assert.match(html, /Changed Scenes and Entities/);

    const directFixture = createRevisionPanelFixture({ sourcePath });
    assert.equal(directFixture.revisionState.sessions.length, roundTripRevisionState.sessions.length);
    assert.equal(directFixture.panelModel.sessions.length, model.sessions.length);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
