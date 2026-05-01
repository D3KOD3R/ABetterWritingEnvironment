import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function runScrivenerImportTest() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const scriptPath = path.join(repoRoot, "scripts", "build-project-data.mjs");
  const indexPath = path.join(
    repoRoot,
    "Project Serva Vitae Novel & WoldBuild Combined Cloud.scriv",
    "Project Serva Vitae Novel & WoldBuild Combined Cloud.scrivx",
  );
  const dataRoot = path.join(repoRoot, "Project Serva Vitae Novel & WoldBuild Combined Cloud.scriv", "Files", "Data");
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "abe-scrivener-import-"));
  const outputPath = path.join(tempDir, "project-data.json");

  try {
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        scriptPath,
        "--index",
        indexPath,
        "--data-root",
        dataRoot,
        "--output",
        outputPath,
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
      `Scrivener import script failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );

    const summary = JSON.parse(result.stdout.trim());
    const data = JSON.parse(readFileSync(outputPath, "utf8"));

    assert.equal(data.manuscriptTasks.length, summary.tasks);
    assert.equal(data.world.entities.length, summary.worldEntities);
    assert.equal(data.world.nodes.length, summary.timelineNodes);
    assert.equal(data.world.templates.length, summary.worldTemplates);
    assert.equal(data.passageNotes.length, summary.passageNotes);
    assert.equal(data.sourceArchive.length, summary.archivedItems);
    assert.equal(data.importReport.importedTasks, data.manuscriptTasks.length);
    assert.equal(data.importReport.importedNotes, data.passageNotes.length);
    assert.equal(
      data.importReport.taskAnchorCounts.active
        + data.importReport.taskAnchorCounts.recovered
        + data.importReport.taskAnchorCounts.approximate
        + data.importReport.taskAnchorCounts.orphaned,
      data.manuscriptTasks.length,
    );
    assert.equal(data.importReport.importedWorldNotes, 11);
    assert.equal(data.importReport.importedFrontMatterNotes, 6);
    assert.equal(data.importReport.importedResearchNotes, 2);
    assert.equal(data.world.templates.some((template) => template.name === "Station"), true);
    assert.equal(data.world.templates.some((template) => template.name === "Fauna"), true);
    assert.equal(
      data.world.templates.filter((template) => template.source === "scrivener-template").length,
      6,
    );
    assert.equal(
      data.world.templates.filter((template) => template.source === "scrivener-template").every(
        (template) => typeof template.sourceText === "string" && template.sourceText.trim().length > 0,
      ),
      true,
    );
    assert.equal(
      data.world.entities.filter((entity) => entity.templateOrigin.templateKey === "station").length,
      3,
    );
    assert.equal(
      data.world.entities.filter((entity) => entity.templateOrigin.templateKey === "fauna").length,
      3,
    );
    assert.equal(
      data.world.entities.some((entity) => /Stations/.test(entity.scrivenerBinderPath ?? "")),
      true,
    );
    assert.equal(
      data.world.entities.some(
        (entity) =>
          entity.templateOrigin.templateKey === "station" &&
          /Sentient Flag Ship/.test(entity.scrivenerBinderPath ?? ""),
      ),
      true,
    );
    assert.equal(
      data.world.templates
        .filter((template) => template.source === "scrivener-template")
        .every((template) => /Template Sheets/.test(template.scrivenerBinderPath ?? "")),
      true,
    );
    assert.equal(
      data.world.templates.find((template) => template.name === "Flora")?.source,
      "manual",
    );
    assert.equal(
      data.passageNotes.some((note) => /Marketing/.test(note.scrivenerBinderPath ?? "")),
      true,
    );

    assert.equal(data.manuscriptTasks[0].source, "scrivener-comment");
    assert.match(data.manuscriptTasks[0].scrivenerDocumentId, /^[A-F0-9-]+$/i);
    assert.match(data.manuscriptTasks[0].scrivenerCommentId, /^[A-F0-9-]+$/i);
    assert.equal(data.manuscriptTasks[0].anchorMode, "location");
    assert.equal(data.passageNotes[0].source, "scrivener-research");
    assert.match(data.passageNotes[0].scrivenerDocumentId, /^[A-F0-9-]+$/i);
    assert.equal(data.sourceArchive[0].kind, "meta");
    assert.match(data.world.templates[0].fields.map((field) => field.label).join(" "), /Ethnicity|Population/);

    assert.equal(
      data.world.entities.some((entity) => entity.source === "scrivener-worldbuilding"),
      true,
    );
    assert.equal(
      data.world.nodes.some((node) => node.source === "scrivener-timeline"),
      true,
    );

    const syntheticRoot = mkdtempSync(path.join(os.tmpdir(), "abe-scrivener-whitespace-"));
    const syntheticProjectRoot = path.join(syntheticRoot, "Whitespace Test.scriv");
    const syntheticDataRoot = path.join(syntheticProjectRoot, "Files", "Data");
    mkdirSync(syntheticDataRoot, { recursive: true });
    writeFileSync(
      path.join(syntheticProjectRoot, "Whitespace Test.scrivx"),
      `<?xml version="1.0" encoding="UTF-8"?>
<Binder>
  <BinderItem UUID="manuscript-root" Type="Folder">
    <Title>Manuscript</Title>
    <BinderItem UUID="chapter-1" Type="Folder">
      <Title>Chapter One</Title>
      <BinderItem UUID="scene-1" Type="Text">
        <Title>Whitespace Scene</Title>
      </BinderItem>
    </BinderItem>
  </BinderItem>
</Binder>
`,
      "utf8",
    );
    mkdirSync(path.join(syntheticDataRoot, "scene-1"), { recursive: true });
    writeFileSync(
      path.join(syntheticDataRoot, "scene-1", "content.rtf"),
      `{\\rtf1\\ansi{\\fonttbl{\\f0 Times;}}\\f0\\pard\\tab Indented first line.\\par\\par Second paragraph line.\\par}`,
      "utf8",
    );

    const syntheticOutputPath = path.join(syntheticRoot, "project-data.json");
    const syntheticResult = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        scriptPath,
        "--index",
        path.join(syntheticProjectRoot, "Whitespace Test.scrivx"),
        "--data-root",
        syntheticDataRoot,
        "--output",
        syntheticOutputPath,
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );

    if (syntheticResult.error) {
      throw syntheticResult.error;
    }

    assert.equal(
      syntheticResult.status,
      0,
      `Synthetic Scrivener import failed.\nSTDOUT:\n${syntheticResult.stdout}\nSTDERR:\n${syntheticResult.stderr}`,
    );

    const syntheticData = JSON.parse(readFileSync(syntheticOutputPath, "utf8"));
    assert.equal(syntheticData.project.chapters.length, 1);
    assert.equal(syntheticData.project.chapters[0].scenes.length, 1);
    assert.equal(syntheticData.project.chapters[0].scenes[0].blocks.length, 2);
    assert.equal(
      syntheticData.project.chapters[0].scenes[0].blocks[0].text.startsWith("\tIndented first line."),
      true,
    );
    assert.equal(syntheticData.project.chapters[0].scenes[0].blocks[1].text, "Second paragraph line.");
    rmSync(syntheticRoot, { recursive: true, force: true });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
