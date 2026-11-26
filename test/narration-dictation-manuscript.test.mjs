import assert from "node:assert/strict";
import { createDictationTextSession } from "../apps/editor/public/features/narration/dictation-manuscript.js";
import { dictationSetup, renderSetup, renderDictationTransport } from "../apps/editor/public/features/narration/dictation-panel.js";
export async function runNarrationDictationManuscriptTest() {
  for (const offset of [0, 4, 9]) {
    let text = "Left Tail", edits = 0;
    const session = createDictationTextSession({ offset, read: () => text, insert: (at, words) => { edits++; text = text.slice(0,at)+words+text.slice(at); } });
    const partial = { utteranceId: "u1", revision: 1, status: "partial", text: "one" };
    assert.equal(session.apply([partial]).provisional.trim(), "one");
    assert.equal(text, "Left Tail");assert.equal(edits,0);
    const final = { ...partial, revision: 2, status: "final", text: "two" };
    session.apply([final]); const committed=text;
    session.apply([final, { ...partial, revision: 3 }]);assert.equal(text,committed);assert.equal(edits,1);
    assert.equal(text.slice(0,offset),"Left Tail".slice(0,offset));assert.ok(text.endsWith("Left Tail".slice(offset)));
    text+=" manual mutation";assert.throws(()=>session.apply([final]),/changed/);
  }
  const ready={permission:"granted",devices:[{deviceId:"mic"}],inputTested:true,settings:{setupStage:2},readiness:{modelReady:true},runtime:{recordingReady:true}};
  assert.equal(dictationSetup(ready).ready,false);
  assert.equal(dictationSetup({...ready,refinementDeferred:true}).ready,true);
  assert.equal(dictationSetup({...ready,settings:{setupStage:3}}).ready,true,'refinement choice survives reload');
  assert.equal(dictationSetup({...ready,devices:[],refinementDeferred:true}).ready,false,'a remembered input test cannot hide a disconnected microphone');
  const wizard=renderSetup({...ready,refinementDeferred:true});assert.match(wizard,/dictation-finish/);assert.doesNotMatch(wizard,/<select|type="file"|dictation-record"/);
  assert.match(renderDictationTransport({settings:{setupComplete:true},readiness:{ready:true}}),/is-ready/);
}
