import assert from "node:assert/strict";
import { createDictationInputs } from "../apps/editor/public/adapters/dictation-inputs.js";
export async function runNarrationDictationInputsTest() {
  let granted = false, requests = 0, stops = 0, change, rejectAccess = false;
  const media = { addEventListener: (_, fn) => { change = fn; }, removeEventListener() {}, enumerateDevices: async () => [{ kind: "audioinput", deviceId: "mic", label: granted ? "USB" : "" }],
    getUserMedia: async () => { requests++; if (rejectAccess) throw new Error("Denied"); granted = true; return { getTracks: () => [{ stop: () => stops++ }], getAudioTracks: () => [{ getSettings: () => ({ channelCount: 2 }) }] }; } };
  const inputs = createDictationInputs({ mediaDevices: media, permissions: null });
  await inputs.refresh(); assert.equal(requests, 0); assert.equal(inputs.state.devices[0].label, "");
  // Duplicate explicit setup clicks share one short-lived stream and refresh labels automatically.
  await Promise.all([inputs.authorize(), inputs.authorize()]);
  assert.equal(requests, 1); assert.equal(stops, 1); assert.equal(inputs.state.devices[0].label, "USB"); assert.equal(inputs.state.channels, 2);
  media.enumerateDevices = async () => []; await change(); assert.equal(inputs.state.devices.length, 0);
  rejectAccess = true; await assert.rejects(inputs.authorize(), /Denied/); assert.match(inputs.state.error, /permission/);
  inputs.dispose();
}
