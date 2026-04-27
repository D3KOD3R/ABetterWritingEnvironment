import assert from "node:assert/strict";

import {
  addBlock,
  addCharacter,
  addChapter,
  addScene,
  assignSpeaker,
  createProject,
} from "../packages/manuscript-schema/src/index.ts";
import { createInMemoryVoiceService } from "../services/voice/src/index.ts";

export function runVoiceServiceTest() {
  let project = createProject({
    title: "Voice Fixture",
    now: "2026-04-21T07:30:00.000Z",
  });

  const narrator = addCharacter(project, { name: "Mara Ell" }, "2026-04-21T07:30:10.000Z");
  project = narrator.project;
  const chapter = addChapter(project, { title: "One" }, "2026-04-21T07:31:00.000Z");
  project = chapter.project;
  const scene = addScene(project, chapter.chapter.id, { title: "Scene" }, "2026-04-21T07:32:00.000Z");
  project = scene.project;

  const narration = addBlock(
    project,
    scene.scene.id,
    { kind: "narration", text: "The corridor map hummed beneath the archive glass." },
    "2026-04-21T07:33:00.000Z",
  );
  project = narration.project;
  project = assignSpeaker(
    project,
    narration.block.id,
    {
      role: "narrator",
      speakerLabel: "Narrator",
    },
    "2026-04-21T07:33:10.000Z",
  ).project;

  const dialogue = addBlock(
    project,
    scene.scene.id,
    { kind: "dialogue", text: "If the corridor is real, we can prove it." },
    "2026-04-21T07:34:00.000Z",
  );
  project = dialogue.project;
  project = assignSpeaker(
    project,
    dialogue.block.id,
    {
      role: "character",
      characterId: narrator.character.id,
      speakerLabel: "Mara Ell",
    },
    "2026-04-21T07:34:10.000Z",
  ).project;

  const voice = createInMemoryVoiceService();
  const profiles = voice.listProfiles();
  const bindings = voice.createSpeakerBindings({
    project,
    assignments: project.speakerAssignments,
  });
  const preview = voice.queueVoicePreview({
    projectId: project.id,
    sceneId: scene.scene.id,
    bindingIds: bindings.map((binding) => binding.id),
    now: "2026-04-21T07:35:00.000Z",
  });

  assert.equal(profiles.length, 4);
  assert.equal(bindings.length, 2);
  assert.equal(bindings[0].voiceProfileId, "voice-narrator-lantern");
  assert.equal(bindings[1].voiceProfileId, "voice-mara-glass");
  assert.equal(preview.status, "completed");
}
