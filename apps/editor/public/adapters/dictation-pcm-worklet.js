// Worklet keeps sample positions across render quanta; no stale-frame replacement is permitted.
class DictationPcmProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(); this.channel = options.processorOptions.channel; this.source = 0; this.output = 0;
    this.samples = []; this.sourceStart = 0; this.sequence = 0; this.stopped = false;
    this.port.onmessage = ({ data }) => { if (data === "stop") { this.flush(); this.stopped = true; this.port.postMessage({ stopped: true }); } };
  }
  flush() {
    if (!this.samples.length) return;
    const pcm = Int16Array.from(this.samples);
    this.port.postMessage({ pcm, sequence: this.sequence++, startSample: this.output - pcm.length, endSample: this.output,
      sourceStartSample: this.sourceStart, sourceEndSample: this.source, sourceSampleRate: sampleRate }, [pcm.buffer]);
    this.sourceStart = this.source; this.samples = [];
  }
  process(inputs) {
    if (this.stopped) return false;
    const input = inputs[0]?.[this.channel];
    if (!input) { if (inputs[0]?.length) { this.port.postMessage({ error: "Selected input channel is unavailable." }); return false; } return true; }
    let peak = 0, sum = 0;
    for (let i = 0; i < input.length; i++) {
      const value = input[i]; peak = Math.max(peak, Math.abs(value)); sum += value * value;
      // Box integration low-pass downsamples arbitrary hardware rates while preserving the global clock.
      this.accum = (this.accum || 0) + value; this.count = (this.count || 0) + 1; this.source++;
      if (this.source * 16000 >= (this.output + 1) * sampleRate) {
        this.samples.push(Math.round(Math.max(-1, Math.min(1, this.accum / this.count)) * 32767));
        this.output++; this.accum = 0; this.count = 0;
        if (this.samples.length === 4000) this.flush();
      }
    }
    if (this.source % 2048 < input.length) this.port.postMessage({ level: Math.sqrt(sum / input.length), clipping: peak >= 0.98 });
    return true;
  }
}
registerProcessor("abe-dictation-pcm", DictationPcmProcessor);
