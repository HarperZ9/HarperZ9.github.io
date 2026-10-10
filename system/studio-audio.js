// studio-audio.js: the Studio's sound, through raw-native's sound engine (10 October 2026).
//
// Every sound the Studio makes (Music, Seed sound, Bring your own, the instruments) reaches the
// speakers as before. A tap copies it, on the way, into raw-native's mastering chain
// (studio-master-worklet.js: EQ, a gentle compressor, a true-peak limiter at -1 dBTP) and then into
// a MediaStream. What the Studio records (the timeline's Render WebM, the deck's WebM) takes its
// sound from that stream, mastered. raw-native's BS.1770 meter (web/sound/meter.mjs) measures what
// was recorded and what is playing, so the Music source can show its loudness and true peak.
//
// The tap: AudioNode.connect is wrapped so that a connection to a context's destination also feeds
// that context's tap. If anything here fails, sound plays exactly as it did, unrecorded.

import { integrated, truePeakLinear } from "../media/raw-native/sound-4edf976/web/sound/meter.mjs";

const WORKLET = new URL("./studio-master-worklet.js?v=20261010-sound-engine", import.meta.url).href;
export const MASTER_SPEC = Object.freeze({ comp: { threshold_db: -14, ratio: 1.5, knee_db: 6, attack_ms: 15, release_ms: 250 }, ceiling_dbtp: -1 });

const taps = new Map();   // AudioContext -> { input, dest, node, ready }
let latest = null;        // the tap that carried sound most recently
const listeners = new Set();

function tapFor(ctx) {
  let t = taps.get(ctx);
  if (t) return t;
  const input = origConnect ? ctx.createGain() : null;
  const dest = ctx.createMediaStreamDestination();
  t = { ctx, input, dest, node: null, ready: false, heard: 0 };
  taps.set(ctx, t);
  ctx.audioWorklet.addModule(WORKLET).then(() => {
    const node = new AudioWorkletNode(ctx, "studio-master", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { spec: MASTER_SPEC } });
    origConnect.call(input, node);
    origConnect.call(node, dest);
    node.port.onmessage = (e) => { t.heard = performance.now(); latest = t; for (const fn of listeners) fn(e.data, ctx.sampleRate); };
    t.node = node; t.ready = true;
    node.port.postMessage({ post: listeners.size > 0 });
  }).catch((e) => console.error("[studio-audio] raw-native's mastering chain did not load; sound is not recorded:", e));
  return t;
}

let origConnect = null;
export function installTap() {
  if (origConnect || typeof AudioNode === "undefined") return;
  origConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (target, ...rest) {
    const r = origConnect.call(this, target, ...rest);
    try {
      if (target && this.context && target === this.context.destination) {
        const t = tapFor(this.context);
        if (t.input && this !== t.input) origConnect.call(this, t.input);
        latest = latest || t;
      }
    } catch (e) { console.error("[studio-audio] tap failed:", e); }
    return r;
  };
}

/** The mastered audio tracks of the context that sounded most recently, or [] when none has. */
export function masteredTracks() {
  const t = latest && latest.ready ? latest : [...taps.values()].find((x) => x.ready);
  return t ? t.dest.stream.getAudioTracks() : [];
}

/** Collect mastered samples while fn runs; returns { lufs, truePeakDb, seconds } measured by raw-native's meter. */
export function startMeasure() {
  const L = [], R = [];
  let rate = 48000;
  const on = (d, sr) => { rate = sr; L.push(d.l); R.push(d.r); };
  listeners.add(on);
  for (const t of taps.values()) if (t.node) t.node.port.postMessage({ post: true });
  return () => {
    listeners.delete(on);
    if (!listeners.size) for (const t of taps.values()) if (t.node) t.node.port.postMessage({ post: false });
    const n = L.reduce((a, b) => a + b.length, 0);
    if (!n) return null;
    const l = new Float32Array(n), r = new Float32Array(n);
    let o = 0; for (let i = 0; i < L.length; i++) { l.set(L[i], o); r.set(R[i], o); o += L[i].length; }
    let energy = 0; for (let i = 0; i < n; i += 64) energy += l[i] * l[i] + r[i] * r[i];
    if (energy === 0) return { silent: true, seconds: n / rate };
    const lufs = integrated([l, r], rate);
    const tp = truePeakLinear([l, r]);
    return { lufs, truePeakDb: tp > 0 ? 20 * Math.log10(tp) : -Infinity, seconds: n / rate };
  };
}

/** Live loudness: calls fn({ lufs, truePeakDb }) about twice a second over the last 3 s of sound. */
export function liveMeter(fn) {
  const span = 3, L = [], R = [];
  let rate = 48000, last = 0;
  const on = (d, sr) => {
    rate = sr; L.push(d.l); R.push(d.r);
    const keep = Math.ceil(span * rate / d.l.length);
    while (L.length > keep) { L.shift(); R.shift(); }
    const now = performance.now();
    if (now - last < 500) return;
    last = now;
    const n = L.reduce((a, b) => a + b.length, 0);
    const l = new Float32Array(n), r = new Float32Array(n);
    let o = 0; for (let i = 0; i < L.length; i++) { l.set(L[i], o); r.set(R[i], o); o += L[i].length; }
    const lufs = integrated([l, r], rate), tp = truePeakLinear([l, r]);
    fn({ lufs, truePeakDb: tp > 0 ? 20 * Math.log10(tp) : -Infinity });
  };
  listeners.add(on);
  for (const t of taps.values()) if (t.node) t.node.port.postMessage({ post: true });
  return () => { listeners.delete(on); if (!listeners.size) for (const t of taps.values()) if (t.node) t.node.port.postMessage({ post: false }); };
}
