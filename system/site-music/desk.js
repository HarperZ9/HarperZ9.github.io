// desk.js: the live form's mixing desk, in the page's audio graph. Each group a listener can hear apart (live.js GROUPS)
// has its own bus with its own level and its own meter, so moving a fader is heard at once. Each group takes the two
// bands of a piece (pieces.js ALT) on two inputs, and the band blend crossfades them at equal power, so the blend moves
// smoothly from the first band to the second with no switch. The sea and wind join the space group on their own input,
// at the master gain of the band in use (in a blend, a mix of the two by the blend).
//   const desk = createDesk(ctx, out); desk.input('main', 'drums') is where a chunk's drum part plays into
//   desk.setGain('lead', 0.5)   desk.setBand(0.3)   desk.levels() -> { bass, mid, treble, level } in 0..1
//   desk.meters() -> { drums: 0..1, ... } the level of each group as it plays
import { GROUPS } from './live.js';

const BANDS = ['main', 'alt'];
const ramp = (param, v, ctx) => { param.cancelScheduledValues(ctx.currentTime); param.setTargetAtTime(v, ctx.currentTime, 0.03); };
const rms = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); };
// 0..1 from a level in dB: -60 dB and under reads 0, 0 dB reads 1
const meter = (x) => Math.max(0, Math.min(1, 1 + 20 * Math.log10(Math.max(x, 1e-6)) / 60));

export function createDesk(ctx, out, { gains = {}, band = 0 } = {}) {
  const master = ctx.createGain(), an = ctx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.6;
  master.connect(out); master.connect(an);
  const groups = {}, k = { main: 1, alt: 1 }; let t = Math.min(1, Math.max(0, +band || 0));
  for (const g of GROUPS) {
    const gain = ctx.createGain(), meterAn = ctx.createAnalyser(); meterAn.fftSize = 512; gain.gain.value = gains[g] ?? 1;
    const bands = Object.fromEntries(BANDS.map((b) => { const n = ctx.createGain(); n.connect(gain); return [b, n]; }));
    gain.connect(master); gain.connect(meterAn); groups[g] = { gain, meter: meterAn, bands };
  }
  const sea = ctx.createGain(); sea.connect(groups.space.gain);
  const share = () => ({ main: Math.cos(t * Math.PI / 2), alt: Math.sin(t * Math.PI / 2) });
  function apply(now = false) {
    const w = share();
    for (const g of GROUPS) for (const b of BANDS) { const p = groups[g].bands[b].gain; if (now) p.value = w[b]; else ramp(p, w[b], ctx); }
    const s = (1 - t) * k.main + t * k.alt; if (now) sea.gain.value = s; else ramp(sea.gain, s, ctx);
  }
  apply(true);
  const freq = new Uint8Array(an.frequencyBinCount), wave = new Float32Array(an.fftSize), small = new Float32Array(512);
  const bin = (hz) => Math.min(freq.length - 1, Math.round(hz / (ctx.sampleRate / 2) * freq.length));
  const mean = (lo, hi) => { let s = 0; for (let i = bin(lo); i <= bin(hi); i++) s += freq[i]; return s / (bin(hi) - bin(lo) + 1) / 255; };
  return {
    master, analyser: an,
    input: (b, g) => groups[g].bands[b],
    sea,
    setGain(g, v) { if (groups[g]) ramp(groups[g].gain.gain, Math.max(0, +v || 0), ctx); },
    gain: (g) => groups[g]?.gain.gain.value,
    setBand(v) { t = Math.min(1, Math.max(0, +v || 0)); apply(); },
    share,
    // the master gain of each band, from the chunk that brought it
    setK(next) { let moved = false; for (const b of BANDS) if (next?.[b] && next[b] !== k[b]) { k[b] = next[b]; moved = true; } if (moved) apply(); },
    // what the room hands on as sound: three bands of the spectrum and the overall level, each 0 to 1
    levels() {
      an.getByteFrequencyData(freq); an.getFloatTimeDomainData(wave);
      return { bass: mean(20, 250), mid: mean(250, 2000), treble: mean(2000, 8000), level: meter(rms(wave)) };
    },
    meters() { const out2 = {}; for (const g of GROUPS) { groups[g].meter.getFloatTimeDomainData(small); out2[g] = meter(rms(small)); } return out2; },
    fade(seconds) { ramp(master.gain, 0, ctx); master.gain.setTargetAtTime(0, ctx.currentTime, seconds / 3); },
    close() { try { master.disconnect(); an.disconnect(); } catch { /* already disconnected */ } },
  };
}
