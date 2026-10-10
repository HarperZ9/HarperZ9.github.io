// studio-master-worklet.js: raw-native's mastering chain as an AudioWorklet (10 October 2026).
// The Studio's sound is tapped on its way to the speakers (studio-audio.js) and sent through this
// processor on a separate branch: raw-native's Master (EQ, a gentle compressor and the true-peak
// limiter at -1 dBTP, stepped one stereo sample at a time, the same arithmetic the offline render
// uses) for what the Studio records. What the visitor hears is not changed. When asked, the
// processor also posts the mastered samples, so the page can measure them with raw-native's meter.
import { Master } from "../media/raw-native/sound-4edf976/web/sound/master.mjs";

class StudioMaster extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const spec = (options && options.processorOptions && options.processorOptions.spec) || {};
    this.m = new Master(spec, sampleRate);
    this.io = [0, 0];
    this.post = false;
    this.port.onmessage = (e) => { if (e.data && "post" in e.data) this.post = !!e.data.post; };
  }
  process(inputs, outputs) {
    const inp = inputs[0], out = outputs[0];
    const n = out[0].length;
    const L = inp && inp[0], R = inp && (inp[1] || inp[0]);
    const oL = out[0], oR = out[1] || out[0];
    const io = this.io;
    for (let i = 0; i < n; i++) {
      io[0] = L ? L[i] : 0; io[1] = R ? R[i] : 0;
      this.m.step(io);
      oL[i] = io[0]; oR[i] = io[1];
    }
    if (this.post) this.port.postMessage({ l: oL.slice(), r: oR.slice() });
    return true;
  }
}
registerProcessor("studio-master", StudioMaster);
