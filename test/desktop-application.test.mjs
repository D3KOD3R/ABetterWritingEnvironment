import assert from "node:assert/strict";

import {
  createDesktopResponse,
  createDesktopResponseForRequest,
} from "../apps/desktop/src/http-app.ts";
import { createDesktopWorkspaceSnapshot } from "../apps/desktop/src/workspace.ts";

export async function runDesktopApplicationTest() {
  const workspace = createDesktopWorkspaceSnapshot();

  assert.equal(workspace.workspaceTitle, "ABetterNovelAuthoringEnvironment");
  assert.equal(workspace.settings.executionMode, "local-only");
  assert.equal(workspace.project.lines.length, 7);
  assert.equal(workspace.project.lines[0].sceneLineNumber, 1);
  assert.equal(workspace.project.issues.length, 3);
  assert.equal(workspace.project.issues[0].sceneLineNumber, 2);
  assert.equal(workspace.project.eventTags.length, 3);
  assert.equal(workspace.project.eventTags[0].sceneLineNumber, 3);
  assert.equal(workspace.project.characters.length, 3);
  assert.equal(workspace.world.spines.length, 3);
  assert.equal(workspace.world.entities.length, 3);
  assert.equal(workspace.analysis.suggestionQueue.length, 4);
  assert.equal(workspace.analysis.dreamScaping.ideaTitle, "Signal under the ice");
  assert.equal(
    workspace.analysis.suggestionQueue.some(
      (suggestion) => suggestion.suggestionType === "dream-scaping",
    ),
    true,
  );
  assert.equal(workspace.narration.session.currentLineNumber, 5);
  assert.equal(workspace.voice.renderJobs.length, 2);
  assert.equal(workspace.project.navigationTargets["scene-0002"].lineNumber, 4);
  assert.match(workspace.analysis.suggestionQueue[0].title, /Station/);

  const root = createDesktopResponse("/");
  assert.equal(root.statusCode, 200);
  assert.match(root.body, /Loading the local-first workspace/);

  const workspaceResponse = createDesktopResponse("/api/workspace");
  assert.equal(workspaceResponse.statusCode, 200);
  const parsed = JSON.parse(workspaceResponse.body);
  assert.equal(parsed.analysis.provider.id, "local-rule-analysis");
  assert.equal(parsed.analysis.lastJob.result.suggestionCount, 3);
  assert.equal(parsed.voice.provider.id, "local-voice-suite");

  const appScript = createDesktopResponse("/app.js");
  assert.equal(appScript.statusCode, 200);
  assert.doesNotMatch(appScript.body, /Add narration block/);
  assert.doesNotMatch(appScript.body, /Add dialogue block/);
  assert.doesNotMatch(appScript.body, /Scene Synopsis/);
  assert.match(appScript.body, /editor-document-input/);
  assert.match(appScript.body, /contextmenu/);
  assert.match(appScript.body, /Add task/);
  assert.match(appScript.body, /Inspiration/);
  assert.match(appScript.body, /Research/);
  assert.match(appScript.body, /Task body/);
  assert.match(appScript.body, /passage-note-body/);
  assert.match(appScript.body, /openPassageNoteComposerFromContextMenu/);
  assert.match(appScript.body, /inline-passage-note/);
  assert.match(appScript.body, /inline-passage-verse/);
  assert.match(appScript.body, /commitInlinePassageNote/);
  assert.match(appScript.body, /insertInlinePassageVerse/);
  assert.match(appScript.body, /seededSelection/);
  assert.match(appScript.body, /getInlinePassageDraftExistingSelectionRange/);
  assert.match(appScript.body, /trackInlinePassageDraftTyping/);
  assert.match(appScript.body, /syncInlinePassageDraftLayout/);
  assert.match(appScript.body, /Save to typed verse/);
  assert.match(appScript.body, /Save this .* note against the verse typed in the manuscript field below/);
  assert.match(appScript.body, /typedStartOffset/);
  assert.match(appScript.body, /typedText/);
  assert.match(appScript.body, /has-inspiration-preview/);
  assert.match(appScript.body, /is-inspiration-previewing/);
  assert.match(appScript.body, /select-side-panel/);
  assert.match(appScript.body, /task-description-input/);
  assert.match(appScript.body, /data-task-preview-id/);
  assert.match(appScript.body, /task-chapter-list/);
  assert.match(appScript.body, /previewTaskAnchor/);
  assert.match(appScript.body, /navigateTaskAnchor/);
  assert.match(appScript.body, /centerEditorOnCaret/);
  assert.match(appScript.body, /centerEditorOnOffset/);
  assert.match(appScript.body, /focusEditorWhitespace/);
  assert.doesNotMatch(appScript.body, /clickedBelowText/);
  assert.match(appScript.body, /setSelectionRange/);
  assert.match(appScript.body, /scrollTo/);
  assert.doesNotMatch(appScript.body, /window\.prompt/);
  assert.match(appScript.body, /task-badge/);
  assert.match(appScript.body, /selectedTaskId/);
  assert.match(appScript.body, /task-body/);
  assert.match(appScript.body, /task-reference/);
  assert.match(appScript.body, /task-title-input/);
  assert.match(appScript.body, /passage-note-title-input/);
  assert.match(appScript.body, /Local AI/);
  assert.match(appScript.body, /suggest-scene-title/);
  assert.match(appScript.body, /api\/local-ai\/generate-title/);
  assert.doesNotMatch(appScript.body, />Issues<\/h2>/);
  assert.doesNotMatch(appScript.body, /Inspiration Notes<\/h2>/);
  assert.doesNotMatch(appScript.body, /Research Notes<\/h2>/);
  assert.match(appScript.body, /project-title-input/);
  assert.match(appScript.body, /select-pane/);
  assert.match(appScript.body, />Manuscript<\/p>/);
  assert.doesNotMatch(appScript.body, />Binder<\/p>/);
  assert.doesNotMatch(appScript.body, /select-project/);
  assert.doesNotMatch(appScript.body, /Anchored Diagnostics/);
  assert.doesNotMatch(appScript.body, /Focused Passage/);
  assert.doesNotMatch(appScript.body, /Project Spine/);
  assert.match(appScript.body, /New chapter/);
  assert.match(appScript.body, /New scene/);
  assert.match(appScript.body, /New template/);
  assert.match(appScript.body, /Dream Scaping/);
  assert.match(appScript.body, /Text Width/);
  assert.match(appScript.body, /scene line/);
  assert.match(appScript.body, /syncSceneDocumentLayout/);

  const editorModel = createDesktopResponse("/editor-model.js");
  assert.equal(editorModel.statusCode, 200);
  assert.match(editorModel.body, /buildSceneRecords/);
  assert.match(editorModel.body, /estimateWrappedLineCount/);
  assert.match(editorModel.body, /createPassageNote/);
  assert.match(editorModel.body, /normalizePassageNotes/);
  assert.match(editorModel.body, /createPassageNoteTitle/);

  const styles = createDesktopResponse("/styles.css");
  assert.equal(styles.statusCode, 200);
  assert.match(styles.body, /\.editor-document-gutter/);
  assert.match(styles.body, /\.dream-suggestion/);
  assert.match(styles.body, /\.task-context-menu/);
  assert.match(styles.body, /\.task-composer/);
  assert.match(styles.body, /\.side-panel-tabs/);
  assert.match(styles.body, /\.passage-note-item/);
  assert.match(styles.body, /\.passage-note-title-input/);
  assert.match(styles.body, /overflow-x: hidden/);
  assert.match(styles.body, /text-overflow: ellipsis/);
  assert.match(styles.body, /\.inline-passage-bubble/);
  assert.match(styles.body, /\.inline-passage-verse-field/);
  assert.match(styles.body, /rgba\(216, 244, 253, 0\.62\)/);
  assert.match(styles.body, /border: 3px solid rgba\(20, 22, 28, 0\.92\)/);
  assert.match(styles.body, /box-sizing: border-box/);
  assert.match(styles.body, /overflow-wrap: anywhere/);
  assert.match(styles.body, /white-space: pre-wrap/);
  assert.doesNotMatch(styles.body, /\.passage-note-editor/);
  assert.match(styles.body, /\.editor-document-input\.has-task-preview::selection/);
  assert.match(styles.body, /\.editor-document-input\.has-inspiration-preview::selection/);
  assert.match(styles.body, /rgba\(216, 244, 253, 0\.82\)/);
  assert.match(styles.body, /\.scene-editor-codeframe\.is-task-previewing/);
  assert.match(styles.body, /\.scene-editor-codeframe\.is-inspiration-previewing/);
  assert.match(styles.body, /overscroll-behavior: contain/);
  assert.match(styles.body, /height: clamp\(440px, 68vh, 760px\)/);
  assert.match(styles.body, /cursor: text/);
  assert.match(styles.body, /--editor-font-stack/);
  assert.match(styles.body, /\.task-badge/);
  assert.match(styles.body, /\.task-copy \.task-body/);
  assert.match(styles.body, /\.task-copy \.task-reference/);
  assert.match(styles.body, /\.hero-tabs/);
  assert.match(styles.body, /\.project-title-input/);
  assert.match(styles.body, /\.local-ai-setting/);
  assert.match(styles.body, /\.ai-title-button/);
  assert.match(styles.body, /\.inline-title-input/);
  assert.match(styles.body, /\.pane-section\[hidden\]/);
  assert.match(styles.body, /\.task-chapter-list/);
  assert.doesNotMatch(styles.body, /\.runtime-strip/);
  assert.match(styles.body, /\.task-copy/);
  assert.match(styles.body, /\.editor-document-input/);
  assert.match(styles.body, /\.editor-gutter-line/);

  const settings = createDesktopResponse("/api/settings");
  assert.equal(settings.statusCode, 200);
  assert.match(settings.body, /local-only/);

  const localAiStatus = await createDesktopResponseForRequest({
    method: "GET",
    pathname: "/api/local-ai/status",
  });
  assert.equal(localAiStatus.statusCode, 200);
  const localAiStatusBody = JSON.parse(localAiStatus.body);
  assert.equal(localAiStatusBody.providerName, "llama.cpp");
  assert.equal(localAiStatusBody.baseUrl, "http://127.0.0.1:8080");
  assert.deepEqual(localAiStatusBody.configuredTiers, ["tiny"]);
  assert.equal(typeof localAiStatusBody.available, "boolean");

  const localAiGenerate = await createDesktopResponseForRequest({
    method: "POST",
    pathname: "/api/local-ai/generate-tags",
    body: JSON.stringify({
      userInput: "storm docking scene",
    }),
  });
  assert.equal(localAiGenerate.statusCode, 200);
  const localAiGenerateBody = JSON.parse(localAiGenerate.body);
  assert.equal(typeof localAiGenerateBody.ok, "boolean");

  const localAiUnsupportedMethod = await createDesktopResponseForRequest({
    method: "POST",
    pathname: "/api/settings",
    body: "{}",
  });
  assert.equal(localAiUnsupportedMethod.statusCode, 405);

  const missing = createDesktopResponse("/missing");
  assert.equal(missing.statusCode, 404);
}
