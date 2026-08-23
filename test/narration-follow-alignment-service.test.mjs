// Intent: verify live narration transcripts resolve to runtime-only manuscript follow selections.
import assert from "node:assert/strict";

import {
  alignNarrationTranscriptToScene,
  createNarrationFollowAlignmentService,
  scoreNarrationWordFit,
  tokenizeNarrationSpeechText,
} from "../apps/editor/public/features/narration/narration-follow-alignment-service.js";

export function runNarrationFollowAlignmentServiceTest() {
  const scene = {
    chapterId: "chapter-1",
    chapterTitle: "Deep Space Training",
    sceneId: "scene-1",
    sceneTitle: "The Winged Whales resting ground",
    editorText: [
      "The Earth federation had set up an efficient system that supported human life, however the scarcity of resources extended the outer reach.",
      "It was more resourceful, to inhabit the possibility of making it to a planet which no longer required terra-forming.",
      "John entered the classroom, where he was met by 19 other students.",
    ].join("\n\n"),
    blocks: [{
      blockId: "block-1",
      paragraphId: "paragraph-1",
      lineNumber: 134,
      kind: "narration",
      text: "The Earth federation had set up an efficient system that supported human life, however the scarcity of resources extended the outer reach.",
    }, {
      blockId: "block-2",
      paragraphId: "paragraph-2",
      lineNumber: 144,
      kind: "narration",
      text: "It was more resourceful, to inhabit the possibility of making it to a planet which no longer required terra-forming.",
    }, {
      blockId: "block-3",
      paragraphId: "paragraph-3",
      lineNumber: 146,
      kind: "narration",
      text: "John entered the classroom, where he was met by 19 other students.",
    }],
  };
  const selection = {
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    sceneTitle: "The Winged Whales resting ground",
    blockId: "block-1",
    paragraphId: "paragraph-1",
    startOffset: 0,
    endOffset: scene.blocks[0].text.length,
  };

  const tokens = tokenizeNarrationSpeechText("John's terra-forming test.");
  assert.deepEqual(tokens.map((token) => token.normalized), ["john's", "terra", "forming", "test"]);
  assert.equal(scoreNarrationWordFit("resorces", "resources") > 0.75, true);
  assert.equal(scoreNarrationWordFit("cat", "can"), 0);

  const interimGuardText = "Icicles clung to the cavern roof, daring anyone brave enough to trespass below them. I thought the chamber was empty.";
  const interimGuardScene = {
    chapterId: "chapter-1",
    chapterTitle: "Cavern Opening",
    sceneId: "scene-interim-guard",
    sceneTitle: "Opening Read",
    editorText: interimGuardText,
    blocks: [{
      blockId: "block-interim-guard",
      paragraphId: "paragraph-interim-guard",
      lineNumber: 1,
      kind: "narration",
      text: interimGuardText,
    }],
  };
  const interimGuardSelection = {
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-interim-guard",
    blockId: "block-interim-guard",
    startOffset: 0,
    endOffset: interimGuardText.length,
  };
  const singleInterimMatch = alignNarrationTranscriptToScene({
    transcript: "i",
    scene: interimGuardScene,
    selection: interimGuardSelection,
  });
  assert.equal(singleInterimMatch.status, "recovering");
  assert.equal(singleInterimMatch.followSelection, null);
  assert.equal(singleInterimMatch.match, null);

  const strayIStart = interimGuardText.indexOf("I thought");
  const interimRecoveryLoggerEntries = [];
  const interimRecoveryMatch = alignNarrationTranscriptToScene({
    transcript: "icicles clung to the cavern roof",
    changedTranscript: "icicles clung to the cavern roof",
    scene: interimGuardScene,
    selection: interimGuardSelection,
    currentFollowSelection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-interim-guard",
      blockId: "block-interim-guard",
      paragraphId: "paragraph-interim-guard",
      lineNumber: 1,
      startOffset: strayIStart,
      endOffset: strayIStart + 1,
      trackingStartOffset: strayIStart,
      trackingEndOffset: strayIStart + 1,
      matchedWordCount: 1,
      exactMatchedWordCount: 1,
    },
    logger: {
      isEnabled: () => true,
      debug: (...args) => interimRecoveryLoggerEntries.push(args),
    },
  });
  assert.equal(interimRecoveryMatch.status, "tracking");
  assert.equal(interimRecoveryMatch.followSelection.startOffset, 0);
  assert.equal(interimRecoveryMatch.followSelection.trackingStartOffset, 0);
  assert.equal(interimRecoveryMatch.followSelection.selectedText, "Icicles clung to the cavern roof");
  assert.equal(
    interimRecoveryLoggerEntries.find((entry) => entry[1] === "narration-follow.align-result")?.[3]?.unstableShortAnchorIgnored,
    true,
  );

  const lineMatch = alignNarrationTranscriptToScene({
    transcript: "supported human life however the scarcity of resources",
    scene,
    selection,
  });
  assert.equal(lineMatch.status, "tracking");
  assert.equal(lineMatch.followSelection.blockId, "block-1");
  assert.equal(lineMatch.followSelection.lineNumber, 134);
  assert.equal(lineMatch.match.wordFitRatio >= 0.95, true);
  assert.equal(
    scene.editorText.slice(lineMatch.followSelection.startOffset, lineMatch.followSelection.endOffset),
    "supported human life, however the scarcity of resources",
  );
  assert.match(lineMatch.trackerStatus, /Tracking line 134/);

  const fuzzyMatch = alignNarrationTranscriptToScene({
    transcript: "supported human lives however the scarcity of resorces",
    scene,
    selection,
  });
  assert.equal(fuzzyMatch.status, "tracking");
  assert.equal(fuzzyMatch.followSelection.blockId, "block-1");
  assert.equal(fuzzyMatch.match.fuzzyMatchedWordCount >= 1, true);
  assert.equal(fuzzyMatch.match.wordFitRatio > 0.75, true);

  const nextBlockMatch = alignNarrationTranscriptToScene({
    transcript: "making it to a planet which no longer",
    scene,
    selection,
    currentFollowSelection: lineMatch.followSelection,
  });
  assert.equal(nextBlockMatch.status, "tracking");
  assert.equal(nextBlockMatch.followSelection.blockId, "block-2");
  assert.equal(nextBlockMatch.followSelection.lineNumber, 144);

  const paragraphStartScene = {
    chapterId: "chapter-1",
    sceneId: "scene-paragraph-start",
    sceneTitle: "Docking Bay Walk",
    editorText: "Making his way toward the docking bay transport pods, John imagined the giant whale ribs.",
    blocks: [{
      blockId: "block-walk",
      paragraphId: "paragraph-walk",
      lineNumber: 2,
      kind: "narration",
      text: "Making his way toward the docking bay transport pods, John imagined the giant whale ribs.",
    }],
  };
  const paragraphStartMatch = alignNarrationTranscriptToScene({
    transcript: "his way toward the docking bay transport pods",
    scene: paragraphStartScene,
    selection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-paragraph-start",
      blockId: "block-walk",
      startOffset: 0,
      endOffset: paragraphStartScene.editorText.length,
    },
  });
  assert.equal(paragraphStartMatch.status, "tracking");
  assert.equal(paragraphStartMatch.followSelection.startOffset, 0);
  assert.equal(paragraphStartMatch.followSelection.trackingStartOffset, "Making ".length);
  assert.match(paragraphStartMatch.followSelection.selectedText, /^Making his way/);

  const distantJumpMatch = alignNarrationTranscriptToScene({
    transcript: "John entered the classroom where he was met",
    scene,
    selection,
    currentFollowSelection: lineMatch.followSelection,
  });
  assert.equal(distantJumpMatch.status, "recovering");
  assert.equal(distantJumpMatch.followSelection.blockId, "block-1");
  assert.equal(distantJumpMatch.match, null);

  const recoveredMatch = alignNarrationTranscriptToScene({
    transcript: "unrelated microphone noise",
    scene,
    selection,
    currentFollowSelection: nextBlockMatch.followSelection,
  });
  assert.equal(recoveredMatch.status, "recovering");
  assert.equal(recoveredMatch.followSelection.blockId, "block-2");
  assert.equal(recoveredMatch.trackerStatus, "Speech tracker recovering near line 144");

  const service = createNarrationFollowAlignmentService({
    getScene: (sceneId) => (sceneId === "scene-1" ? scene : null),
    getProjectId: () => "project-1",
  });
  const serviceMatch = service.alignTranscript({
    transcript: "making it to a planet which no longer",
    runtime: { selection },
  });
  assert.equal(serviceMatch.followSelection.blockId, "block-2");
  assert.equal(serviceMatch.followSelection.projectId, "project-1");

  const repeatedScene = {
    chapterId: "chapter-1",
    sceneId: "scene-repeat",
    sceneTitle: "Repeated Signal",
    editorText: "Alpha gate opened and the crew waited. Alpha gate opened and the crew moved.",
    blocks: [{
      blockId: "block-repeat",
      paragraphId: "paragraph-repeat",
      lineNumber: 22,
      kind: "narration",
      text: "Alpha gate opened and the crew waited. Alpha gate opened and the crew moved.",
    }],
  };
  const firstCrewEnd = repeatedScene.editorText.indexOf(" waited.");
  const secondPhraseStart = repeatedScene.editorText.lastIndexOf("Alpha gate opened");
  const repeatedLoggerEntries = [];
  const repeatedMatch = alignNarrationTranscriptToScene({
    transcript: "Alpha gate opened and the crew",
    scene: repeatedScene,
    selection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-repeat",
      blockId: "block-repeat",
      startOffset: 0,
      endOffset: firstCrewEnd,
    },
    currentFollowSelection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-repeat",
      blockId: "block-repeat",
      startOffset: 0,
      endOffset: firstCrewEnd,
      trackingEndOffset: firstCrewEnd,
    },
    logger: {
      isEnabled: () => true,
      debug: (...args) => repeatedLoggerEntries.push(args),
    },
  });
  assert.equal(repeatedMatch.status, "tracking");
  assert.equal(repeatedMatch.followSelection.startOffset, secondPhraseStart);
  assert.equal(repeatedMatch.followSelection.trackingStartOffset, secondPhraseStart);
  assert.equal(repeatedLoggerEntries.some((entry) => entry[1] === "narration-follow.align-result"), true);

  const viewportBlocks = [{
    blockId: "viewport-block-1",
    paragraphId: "viewport-paragraph-1",
    lineNumber: 1,
    kind: "narration",
    text: "The beacon flickered softly while Mara waited at the door.",
  }, {
    blockId: "viewport-block-2",
    paragraphId: "viewport-paragraph-2",
    lineNumber: 2,
    kind: "narration",
    text: "A maintenance drone clicked past the empty corridor.",
  }, {
    blockId: "viewport-block-3",
    paragraphId: "viewport-paragraph-3",
    lineNumber: 3,
    kind: "narration",
    text: "The distant engines settled into a slower rhythm.",
  }, {
    blockId: "viewport-block-4",
    paragraphId: "viewport-paragraph-4",
    lineNumber: 4,
    kind: "narration",
    text: "The beacon flickered softly while Mara waited at the door.",
  }];
  const viewportScene = {
    chapterId: "chapter-1",
    sceneId: "scene-viewport",
    sceneTitle: "Viewport Bias",
    editorText: viewportBlocks.map((block) => block.text).join("\n\n"),
    blocks: viewportBlocks,
  };
  const viewportBlockStart = viewportBlocks
    .slice(0, 3)
    .reduce((offset, block) => offset + block.text.length + 2, 0);
  const viewportLoggerEntries = [];
  const viewportMatch = alignNarrationTranscriptToScene({
    transcript: "the beacon flickered softly while Mara",
    scene: viewportScene,
    selection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-viewport",
      blockId: "viewport-block-1",
      startOffset: 0,
      endOffset: viewportBlocks[0].text.length,
    },
    viewportRange: {
      startOffset: viewportBlockStart,
      endOffset: viewportBlockStart + viewportBlocks[3].text.length,
      firstVisibleLine: 20,
      lastVisibleLine: 24,
    },
    logger: {
      isEnabled: () => true,
      debug: (...args) => viewportLoggerEntries.push(args),
    },
  });
  assert.equal(viewportMatch.status, "tracking");
  assert.equal(viewportMatch.followSelection.blockId, "viewport-block-4");
  assert.equal(viewportMatch.match.searchPass, "viewport");
  assert.equal(
    viewportLoggerEntries.some((entry) =>
      entry[1] === "narration-follow.align-result" &&
      entry[3]?.matchedSearchPass === "viewport"
    ),
    true,
  );

  const activeWindowLoggerEntries = [];
  const activeWindowMatch = alignNarrationTranscriptToScene({
    transcript: "the beacon flickered softly while Mara",
    scene: viewportScene,
    selection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-viewport",
      blockId: "viewport-block-1",
      startOffset: 0,
      endOffset: viewportBlocks[0].text.length,
    },
    currentFollowSelection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-viewport",
      blockId: "viewport-block-1",
      startOffset: 0,
      endOffset: viewportBlocks[0].text.length,
      trackingStartOffset: 0,
      trackingEndOffset: 0,
    },
    viewportRange: {
      startOffset: viewportBlockStart,
      endOffset: viewportBlockStart + viewportBlocks[3].text.length,
      firstVisibleLine: 20,
      lastVisibleLine: 24,
    },
    logger: {
      isEnabled: () => true,
      debug: (...args) => activeWindowLoggerEntries.push(args),
    },
  });
  assert.equal(activeWindowMatch.status, "tracking");
  assert.equal(activeWindowMatch.followSelection.blockId, "viewport-block-1");
  assert.equal(activeWindowMatch.match.searchPass, "local-follow");
  assert.deepEqual(
    activeWindowLoggerEntries.find((entry) => entry[1] === "narration-follow.align-result")?.[3]?.activeSearchWindow?.blockIds,
    ["viewport-block-1", "viewport-block-2"],
  );

  // Intent: keep initial read-along matches anchored to the spoken opening even when the viewport is lower in the scene.
  const shaiBlocks = [{
    blockId: "shai-block-306",
    paragraphId: "shai-paragraph-306",
    lineNumber: 306,
    kind: "dialogue",
    text: "A strange bubbling ringing pierced Tex's ears with a nuanced static. It wasn't a normal ringing but an alien sound resembling tinnitus with a strange echo he had never heard before.",
  }, {
    blockId: "shai-block-312",
    paragraphId: "shai-paragraph-312",
    lineNumber: 312,
    kind: "narration",
    text: "Re work the above, it needs work.",
  }, {
    blockId: "shai-block-314",
    paragraphId: "shai-paragraph-314",
    lineNumber: 314,
    kind: "narration",
    text: "It was like his ears were being re-born into existence for the first time, hearing the first sounds he had ever heard.",
  }];
  const shaiScene = {
    chapterId: "chapter-1",
    sceneId: "scene-shai",
    sceneTitle: "(Shai) Mark IV life support mesh",
    editorText: shaiBlocks.map((block) => block.text).join("\n\n"),
    blocks: shaiBlocks,
  };
  const shaiViewportStart = shaiBlocks[0].text.length + 2 + shaiBlocks[1].text.length + 2;
  const shaiOpeningMatch = alignNarrationTranscriptToScene({
    transcript: "a strange bubbling ringing pierced Texas ears",
    scene: shaiScene,
    selection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-shai",
      blockId: "shai-block-306",
      startOffset: 0,
      endOffset: shaiBlocks[0].text.length,
    },
    viewportRange: {
      startOffset: shaiViewportStart,
      endOffset: shaiViewportStart + shaiBlocks[2].text.length,
      firstVisibleLine: 314,
      lastVisibleLine: 316,
    },
  });
  assert.equal(shaiOpeningMatch.status, "tracking");
  assert.equal(shaiOpeningMatch.followSelection.blockId, "shai-block-306");
  assert.equal(shaiOpeningMatch.followSelection.lineNumber, 306);
  assert.equal(shaiOpeningMatch.match.fuzzyMatchedWordCount >= 1, true);

  // Intent: let the newest ASR delta move the current cue forward before the heavier transcript tail wins.
  const responsiveScene = {
    chapterId: "chapter-1",
    sceneId: "scene-responsive",
    sceneTitle: "Responsive Follow",
    editorText: "alpha beta noise noise gamma delta epsilon zeta",
    blocks: [{
      blockId: "responsive-block-1",
      paragraphId: "responsive-paragraph-1",
      lineNumber: 51,
      kind: "narration",
      text: "alpha beta noise noise gamma delta epsilon zeta",
    }],
  };
  const gammaStart = responsiveScene.editorText.indexOf("gamma");
  const deltaEnd = responsiveScene.editorText.indexOf("delta") + "delta".length;
  const responsiveMatch = alignNarrationTranscriptToScene({
    transcript: "alpha beta gamma delta",
    changedTranscript: "gamma delta",
    scene: responsiveScene,
    selection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-responsive",
      blockId: "responsive-block-1",
      startOffset: 0,
      endOffset: responsiveScene.editorText.length,
    },
    currentFollowSelection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-responsive",
      blockId: "responsive-block-1",
      startOffset: 0,
      endOffset: "alpha beta".length,
      trackingStartOffset: 0,
      trackingEndOffset: "alpha beta".length,
    },
  });
  assert.equal(responsiveMatch.status, "tracking");
  assert.equal(responsiveMatch.match.transcriptSource, "changed-transcript");
  assert.equal(responsiveMatch.followSelection.trackingStartOffset, gammaStart);
  assert.equal(responsiveMatch.followSelection.trackingEndOffset, deltaEnd);

  // Intent: reject weak viewport-biased matches that would pull follow-scroll into a later paragraph.
  const jumpBlocks = [{
    blockId: "jump-block-1",
    paragraphId: "jump-paragraph-1",
    lineNumber: 2,
    kind: "narration",
    text: "Warm morning light pierced through them, momentarily blinding the Captain with a white flare.",
  }, {
    blockId: "jump-block-2",
    paragraphId: "jump-paragraph-2",
    lineNumber: 10,
    kind: "narration",
    text: "John rolled over with immense effort as distrust gathered in the captains voice.",
  }];
  const jumpScene = {
    chapterId: "chapter-1",
    sceneId: "scene-jump",
    sceneTitle: "Weak Recovery Guard",
    editorText: jumpBlocks.map((block) => block.text).join("\n\n"),
    blocks: jumpBlocks,
  };
  const jumpBlockTwoStart = jumpBlocks[0].text.length + 2;
  const jumpCurrentSelection = {
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-jump",
    blockId: "jump-block-1",
    paragraphId: "jump-paragraph-1",
    lineNumber: 2,
    startOffset: 0,
    endOffset: 20,
    trackingStartOffset: 0,
    trackingEndOffset: 20,
  };
  const weakJumpLoggerEntries = [];
  const weakJumpMatch = alignNarrationTranscriptToScene({
    transcript: "the captain",
    scene: jumpScene,
    selection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-jump",
      blockId: "jump-block-1",
      startOffset: 0,
      endOffset: 20,
    },
    currentFollowSelection: jumpCurrentSelection,
    viewportRange: {
      startOffset: jumpBlockTwoStart,
      endOffset: jumpBlockTwoStart + jumpBlocks[1].text.length,
      firstVisibleLine: 10,
      lastVisibleLine: 14,
    },
    logger: {
      isEnabled: () => true,
      debug: (...args) => weakJumpLoggerEntries.push(args),
    },
  });
  assert.equal(weakJumpMatch.status, "tracking");
  assert.equal(weakJumpMatch.followSelection.blockId, "jump-block-1");
  assert.equal(weakJumpMatch.match.searchPass, "near-viewport");
  assert.equal(
    weakJumpLoggerEntries.find((entry) => entry[1] === "narration-follow.align-result")?.[3]?.rejectedCandidate?.reason,
    "weak-next-block-transition",
  );

  // Intent: keep the live cursor on the last stable span when weak next-block evidence has no stronger local match.
  const weakOnlyBlocks = [{
    blockId: "weak-only-block-1",
    paragraphId: "weak-only-paragraph-1",
    lineNumber: 21,
    kind: "narration",
    text: "Mara watched the hatch indicator blink through a thin layer of frost.",
  }, {
    blockId: "weak-only-block-2",
    paragraphId: "weak-only-paragraph-2",
    lineNumber: 22,
    kind: "narration",
    text: "John heard the captain's voice ripple over the damaged speaker.",
  }];
  const weakOnlyScene = {
    chapterId: "chapter-1",
    sceneId: "scene-weak-only",
    sceneTitle: "Weak Next Block",
    editorText: weakOnlyBlocks.map((block) => block.text).join("\n\n"),
    blocks: weakOnlyBlocks,
  };
  const weakOnlyBlockTwoStart = weakOnlyBlocks[0].text.length + 2;
  const weakOnlyRecovery = alignNarrationTranscriptToScene({
    transcript: "the captain",
    scene: weakOnlyScene,
    selection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-weak-only",
      blockId: "weak-only-block-1",
      startOffset: 0,
      endOffset: 20,
    },
    currentFollowSelection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-weak-only",
      blockId: "weak-only-block-1",
      paragraphId: "weak-only-paragraph-1",
      lineNumber: 21,
      startOffset: 0,
      endOffset: 20,
      trackingStartOffset: 0,
      trackingEndOffset: 20,
    },
    viewportRange: {
      startOffset: weakOnlyBlockTwoStart,
      endOffset: weakOnlyBlockTwoStart + weakOnlyBlocks[1].text.length,
      firstVisibleLine: 22,
      lastVisibleLine: 24,
    },
  });
  assert.equal(weakOnlyRecovery.status, "recovering");
  assert.equal(weakOnlyRecovery.followSelection.blockId, "weak-only-block-1");
  assert.equal(weakOnlyRecovery.match, null);
  assert.equal(weakOnlyRecovery.trackerStatus, "Speech tracker recovering near line 21");

  // Intent: stop repeated same-block wording from moving the accepted follow anchor backward.
  const backwardRepeatRecovery = alignNarrationTranscriptToScene({
    transcript: "Alpha gate opened and the crew",
    scene: repeatedScene,
    selection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-repeat",
      blockId: "block-repeat",
      startOffset: 0,
      endOffset: firstCrewEnd,
    },
    currentFollowSelection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-repeat",
      blockId: "block-repeat",
      startOffset: secondPhraseStart,
      endOffset: repeatedScene.editorText.length,
      trackingStartOffset: secondPhraseStart,
      trackingEndOffset: repeatedScene.editorText.length,
    },
  });
  assert.equal(backwardRepeatRecovery.status, "recovering");
  assert.equal(backwardRepeatRecovery.followSelection.startOffset, secondPhraseStart);
  assert.equal(backwardRepeatRecovery.match, null);

  const longBlockText = [
    ...Array.from({ length: 180 }, () => "noise"),
    "silent signal opened the lower hatch",
    ...Array.from({ length: 40 }, () => "noise"),
  ].join(" ");
  const longScene = {
    chapterId: "chapter-1",
    sceneId: "scene-long",
    sceneTitle: "Long Live Follow",
    editorText: longBlockText,
    blocks: [{
      blockId: "block-long",
      paragraphId: "paragraph-long",
      lineNumber: 88,
      kind: "narration",
      text: longBlockText,
    }],
  };
  const longLoggerEntries = [];
  const longMatch = alignNarrationTranscriptToScene({
    transcript: "silent signal opened the lower hatch",
    scene: longScene,
    selection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-long",
      blockId: "block-long",
      startOffset: 0,
      endOffset: 20,
    },
    logger: {
      isEnabled: () => true,
      debug: (...args) => longLoggerEntries.push(args),
    },
  });
  const longLogContext = longLoggerEntries.find((entry) => entry[1] === "narration-follow.align-result")?.[3];
  assert.equal(longMatch.status, "tracking");
  assert.equal(longMatch.followSelection.selectedText, "silent signal opened the lower hatch");
  assert.equal(longLogContext.evaluatedMatchCount < 50, true);
  assert.equal(Number.isFinite(longLogContext.alignmentDurationMs), true);

  const activeLongWindowMatch = alignNarrationTranscriptToScene({
    transcript: "silent signal opened the lower hatch",
    scene: longScene,
    selection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-long",
      blockId: "block-long",
      startOffset: 0,
      endOffset: 20,
    },
    currentFollowSelection: {
      projectId: "project-1",
      chapterId: "chapter-1",
      sceneId: "scene-long",
      blockId: "block-long",
      startOffset: 0,
      endOffset: 20,
      trackingStartOffset: 0,
      trackingEndOffset: 20,
    },
  });
  assert.equal(activeLongWindowMatch.status, "recovering");
  assert.equal(activeLongWindowMatch.followSelection.blockId, "block-long");
  assert.equal(activeLongWindowMatch.match, null);

  const cachedLoggerEntries = [];
  const cachedService = createNarrationFollowAlignmentService({
    getScene: (sceneId) => (sceneId === "scene-long" ? longScene : null),
    getProjectId: () => "project-1",
    logger: {
      isEnabled: () => true,
      debug: (...args) => cachedLoggerEntries.push(args),
    },
  });
  cachedService.alignTranscript({
    transcript: "silent signal opened",
    runtime: {
      selection: {
        projectId: "project-1",
        sceneId: "scene-long",
        blockId: "block-long",
        startOffset: 0,
        endOffset: 20,
      },
    },
  });
  cachedService.alignTranscript({
    transcript: "signal opened the lower hatch",
    runtime: {
      selection: {
        projectId: "project-1",
        sceneId: "scene-long",
        blockId: "block-long",
        startOffset: 0,
        endOffset: 20,
      },
    },
  });
  const cacheHitContexts = cachedLoggerEntries
    .filter((entry) => entry[1] === "narration-follow.align-result")
    .map((entry) => entry[3]);
  assert.equal(cacheHitContexts.some((context) => context.blockRangeCacheHit === true), true);
}
