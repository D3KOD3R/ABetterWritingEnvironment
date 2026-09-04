// Intent: verify Scrivener package imports produce canonical project records with manuscript text and metadata.
import assert from "node:assert/strict";

import {
  buildScrivenerProjectSnapshotFromFiles,
  convertRtfToPlainText,
} from "../apps/editor/public/adapters/storage/scrivener-import-service.js";

export async function runScrivenerImportServiceTest() {
  assert.equal(
    convertRtfToPlainText("{\\rtf1\\ansi First paragraph.\\par Second \\'27quoted\\'27 line.}"),
    "First paragraph.\n\nSecond 'quoted' line.",
  );
  assert.equal(
    convertRtfToPlainText("{\\rtf1\\ansi \\u8220\\'93Quoted\\u8221\\'94 {\\field{\\*\\fldinst HYPERLINK \"scrivcmt://COMMENT-1\"}{\\fldrsltgate}}.}"),
    "“Quoted” gate.",
  );
  assert.equal(
    convertRtfToPlainText("{\\rtf1\\ansi Alpha\\endash Beta\\emdash Gamma.}"),
    "Alpha–Beta—Gamma.",
  );

  const snapshot = await buildScrivenerProjectSnapshotFromFiles([
    createTextFile("Novel.scriv/Novel.scrivx", `
      <ScrivenerProject>
        <CustomMetaDataSettings>
          <MetaDataField ID="field-location"><Name>Location</Name></MetaDataField>
          <MetaDataField ID="field-pov"><Name>POV</Name></MetaDataField>
        </CustomMetaDataSettings>
        <Binder>
          <BinderItem UUID="draft-root">
            <Title>Draft</Title>
            <Type>DraftFolder</Type>
            <Children>
              <BinderItem UUID="chapter-one">
                <Title>Chapter One</Title>
                <Type>Folder</Type>
                <Children>
                  <BinderItem UUID="scene-one">
                    <Title>Opening Scene</Title>
                    <Type>Text</Type>
                    <MetaData>
                      <Synopsis>The ship arrives.</Synopsis>
                      <Label>First Draft</Label>
                      <Status>To Do</Status>
                      <CustomMetaData>
                        <MetaDataItem FieldID="field-location"><Value>Ceres Dock</Value></MetaDataItem>
                        <MetaDataItem FieldID="field-pov"><Value>Ava</Value></MetaDataItem>
                      </CustomMetaData>
                    </MetaData>
                  </BinderItem>
                  <BinderItem UUID="scene-two">
                    <Title>Second Scene</Title>
                    <Type>Text</Type>
                  </BinderItem>
                </Children>
              </BinderItem>
            </Children>
          </BinderItem>
          <BinderItem UUID="research-root">
            <Title>Research</Title>
            <Type>ResearchFolder</Type>
            <Children>
              <BinderItem UUID="research-note"><Title>Private Note</Title><Type>Text</Type></BinderItem>
              <BinderItem UUID="worldbuilding-root">
                <Title>WorldBuilding</Title>
                <Type>Folder</Type>
                <Children>
                  <BinderItem UUID="characters-folder">
                    <Title>Characters</Title>
                    <Type>Folder</Type>
                    <Children>
                      <BinderItem UUID="reference-character"><Title>Captain Ava</Title><Type>Text</Type></BinderItem>
                    </Children>
                  </BinderItem>
                  <BinderItem UUID="ships-folder">
                    <Title>Ships</Title>
                    <Type>Folder</Type>
                    <Children>
                      <BinderItem UUID="reference-ship"><Title>The Icarus</Title><Type>Text</Type></BinderItem>
                    </Children>
                  </BinderItem>
                  <BinderItem UUID="stations-folder">
                    <Title>Stations</Title>
                    <Type>Folder</Type>
                    <Children>
                      <BinderItem UUID="reference-station"><Title>Ceres Dock</Title><Type>Text</Type></BinderItem>
                    </Children>
                  </BinderItem>
                </Children>
              </BinderItem>
            </Children>
          </BinderItem>
        </Binder>
      </ScrivenerProject>
    `),
    createTextFile("Novel.scriv/Settings/projectpreferences.xml", `
      <ProjectPreferences>
        <TextFormatRTFData><![CDATA[{\\rtf1\\ansi
          {\\fonttbl{\\f0\\fnil\\fcharset0\\fprq2 TimesNewRomanPSMT;}}
          \\f0\\fs24
          \\pard\\plain Attributes
        }]]></TextFormatRTFData>
      </ProjectPreferences>
    `),
    createTextFile(
      "Novel.scriv/Files/Data/scene-one/content.rtf",
      "{\\rtf1\\ansi First \\u8220\\'93quoted\\u8221\\'94 paragraph.\\par Second {\\field{\\*\\fldinst HYPERLINK \"scrivcmt://COMMENT-1\"}{\\fldrslt A carefully chosen imported comment preview ends at this space and continues}} paragraph with {\\field{\\*\\fldinst HYPERLINK \"scrivcmt://FOOT-1\"}{\\fldrsltgate}}.}",
    ),
    createTextFile("Novel.scriv/Files/Data/scene-one/content.comments", `
      <?xml version="1.0" encoding="UTF-8"?>
      <Comments Version="1.0">
        <Comment ID="COMMENT-1" Collapsed="No"><![CDATA[{\\rtf1\\ansi Imported comment body.}]]></Comment>
        <Comment ID="FOOT-1" Footnote="Yes" Collapsed="No"><![CDATA[{\\rtf1\\ansi Imported footnote body.}]]></Comment>
      </Comments>
    `),
    createTextFile("Novel.scriv/Files/Docs/scene-two.txt", "Legacy text document."),
    createTextFile("Novel.scriv/Files/Data/research-note/content.rtf", "{\\rtf1\\ansi Research should not become manuscript.}"),
    createTextFile("Novel.scriv/Files/Data/reference-character/content.rtf", "{\\rtf1\\ansi Role: Security adviser\\par Notes: Ava keeps the council line.}"),
    createTextFile("Novel.scriv/Files/Data/reference-ship/content.rtf", "{\\rtf1\\ansi Class: Drop ship\\par Notes: John's squad craft.}"),
    createTextFile("Novel.scriv/Files/Data/reference-station/content.rtf", "{\\rtf1\\ansi Capacity: Large orbital settlement\\par Notes: Ceres staging ground.}"),
  ], {
    now: "2026-07-19T12:00:00.000Z",
    sourceLabel: "Novel.scriv",
    sourcePath: "Novel.scriv",
  });

  const record = snapshot.projects[0];
  assert.equal(snapshot.activeProjectId, "scrivener-novel");
  assert.equal(record.title, "Novel");
  assert.equal(record.source, "scrivener-import");
  assert.equal(record.importReport.manuscriptSceneCount, 2);
  assert.equal(record.importReport.importedTextDocumentCount, 2);
  assert.equal(record.importReport.worldCatalogueEntityCount, 3);
  assert.equal(record.importReport.customMetadataFieldCount, 3);
  assert.equal(record.importReport.scrivenerCommentCount, 1);
  assert.equal(record.importReport.scrivenerFootnoteCount, 1);
  assert.equal(record.importReport.scrivenerCommentAnchorCount, 2);
  assert.deepEqual(record.projectSettings.customMetadataDefinitions.map((definition) => definition.label), [
    "Location",
    "POV",
    "Comments and Footnotes",
  ]);
  assert.equal(record.projectSettings.editorPrefs.fontFamilyId, "manuscript-serif");
  assert.equal(record.projectSettings.editorPrefs.fontSize, 16);
  assert.deepEqual(record.structureDrafts.sceneOrder, ["scene-0001", "scene-0002"]);
  assert.equal(record.structureDrafts.scenes[0].chapterTitle, "Chapter One");
  assert.equal(record.sceneDrafts["scene-0001"].sceneTitle, "Opening Scene");
  assert.equal(record.sceneDrafts["scene-0001"].editorText, "First “quoted” paragraph.\n\nSecond A carefully chosen imported comment preview ends at this space and continues paragraph with gate.");
  assert.equal(record.sceneDrafts["scene-0002"].editorText, "Legacy text document.");
  assert.equal(record.sceneDrafts["scene-0001"].sceneSynopsis, "The ship arrives.");
  assert.equal(record.sceneDrafts["scene-0001"].scrivenerMetadata.label, "First Draft");
  assert.equal(record.sceneDrafts["scene-0001"].scrivenerMetadata.status, "To Do");
  assert.equal(record.sceneDrafts["scene-0001"].customMetadata["metadata-location"], "Ceres Dock");
  assert.equal(record.sceneDrafts["scene-0001"].worldSpineMetadata.customMetadata["metadata-pov"], "Ava");
  assert.equal(record.metadataSubgroups.length, 1);
  assert.equal(record.metadataSubgroups[0].groupId, "metadata-comments-and-footnotes");
  assert.equal(record.metadataSubgroups[0].title, "Opening Scene");
  assert.equal(record.metadataSubgroups[0].notes.length, 2);
  assert.equal(record.metadataSubgroups[0].notes[0].anchor.selectedText, "A carefully chosen imported comment preview ends at this space and continues");
  assert.equal(record.metadataSubgroups[0].notes[0].anchor.startOffset, 34);
  assert.equal(record.metadataSubgroups[0].notes[0].title, "Comment: A carefully chosen imported comment preview ends at");
  assert.equal(record.metadataSubgroups[0].notes[0].sourceDocumentId, "scene-one");
  assert.equal(record.metadataSubgroups[0].notes[0].sourceCommentId, "COMMENT-1");
  assert.equal(record.metadataSubgroups[0].notes[0].sourceKind, "comment");
  assert.equal(record.metadataSubgroups[0].notes[1].anchor.selectedText, "gate");
  assert.match(record.metadataSubgroups[0].notes[1].body, /Imported footnote body/);
  assert.equal(record.metadataSubgroups[0].notes[1].sourceDocumentId, "scene-one");
  assert.equal(record.metadataSubgroups[0].notes[1].sourceCommentId, "FOOT-1");
  assert.equal(record.metadataSubgroups[0].notes[1].sourceKind, "footnote");
  assert.equal(record.workspace.project.stats.chapterCount, 1);
  assert.equal(record.workspace.project.stats.sceneCount, 2);
  assert.equal(record.workspace.project.lines.some((line) => line.text.includes("Research")), false);
  assert.deepEqual(record.workspace.world.entities.map((entity) => entity.name), [
    "Captain Ava",
    "The Icarus",
    "Ceres Dock",
  ]);
  assert.deepEqual(record.workspace.world.entities.map((entity) => entity.categoryId), [
    "character",
    "vehicle",
    "location",
  ]);
  assert.equal(record.workspace.world.entities[0].source, "scrivener-reference");
  assert.equal(record.workspace.world.entities[0].fields.some((field) => field.label === "Role"), true);
  assert.equal(record.workspace.world.stats.entityCount, 3);
  assert.equal(record.sourceArchive.some((source) => source.title === "Opening Scene"), true);
  assert.equal(record.sourceArchive.some((source) => source.title === "Captain Ava"), true);
  assert.equal(record.importReport.fileManifest.some((file) => file.path.endsWith("Novel.scrivx")), true);
}

function createTextFile(path, content) {
  const name = path.split(/[\\/]/).at(-1);
  return {
    name,
    path,
    size: content.length,
    type: "text/plain",
    async text() {
      return content;
    },
  };
}
