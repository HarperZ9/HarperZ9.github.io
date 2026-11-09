// Effects: saturation, bitcrush, tape and vinyl texture, lowpass, sidechain pump, reverb, delay.
// Every factory returns { input, output, ...controls } so chains can be wired by hand.
import { noiseSource, rng, tanhCurve, clipCurve, foldCurve, quantCurve, clamp, stopAt } from './util.js';
import { LIMITER_SOURCE } from './limiter.js';

export function saturator(ctx, { drive = 3, kind = 'tanh', makeup = 1 } = {}) {
  const input = ctx.createGain(), shaper = ctx.createWaveShaper(), output = ctx.createGain();
  const curve = (d, k) => (k === 'clip' ? clipCurve(1 / Math.max(d, 1)) : k === 'fold' ? foldCurve(d) : tanhCurve(d));
  shaper.curve = curve(drive, kind);
  shaper.oversample = '4x';
  output.gain.value = makeup;
  input.connect(shaper); shaper.connect(output);
  return { input, output, shaper, set(d, k = kind) { shaper.curve = curve(d, k); } };
}

const CRUSH = [
  'class Crush extends AudioWorkletProcessor {',
  "  static get parameterDescriptors() { return [{ name: 'bits', defaultValue: 8, minValue: 1, maxValue: 16 }, { name: 'hold', defaultValue: 1, minValue: 1, maxValue: 256 }]; }",
  '  constructor() { super(); this.k = 0; this.last = [0, 0]; }',
  '  process(inputs, outputs, p) {',
  '    const i = inputs[0], o = outputs[0]; if (!i || !i.length) return true;',
  '    const bits = p.bits[0], hold = Math.max(1, Math.round(p.hold[0])), lv = Math.pow(2, bits - 1);',
  '    for (let n = 0; n < i[0].length; n++) {',
  '      if (this.k % hold === 0) for (let c = 0; c < i.length; c++) this.last[c] = Math.round(i[c][n] * lv) / lv;',
  '      this.k++;',
  '      for (let c = 0; c < o.length; c++) o[c][n] = this.last[Math.min(c, i.length - 1)];',
  '    }',
  '    return true;',
  '  }',
  '}',
  "registerProcessor('anvil-crush', Crush);",
].join('\n');
const installed = new WeakSet(), limiterReady = new WeakSet();
async function addModule(ctx, src) {
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  try { await ctx.audioWorklet.addModule(url); return true; }
  catch (e) { console.warn('worklet unavailable', e); return false; }
  finally { URL.revokeObjectURL(url); }
}
// Installs the bitcrush and master-chain processors. Returns whether the limiter is available.
export async function installWorklets(ctx) {
  if (!ctx.audioWorklet) return false;
  if (!installed.has(ctx) && await addModule(ctx, CRUSH)) installed.add(ctx);
  if (!limiterReady.has(ctx) && await addModule(ctx, LIMITER_SOURCE)) limiterReady.add(ctx);
  return limiterReady.has(ctx);
}
export const hasLimiter = (ctx) => limiterReady.has(ctx);

// Bit depth and sample-rate reduction. With aa (the default) a lowpass at 0.45 of the reduced rate runs before the hold, so the
// input cannot fold, and another after it removes the hold's images. aa: false gives the raw, aliased lo-fi sound on purpose.
export function bitcrush(ctx, { bits = 8, hold = 1, aa = true } = {}) {
  if (installed.has(ctx)) {
    const n = new AudioWorkletNode(ctx, 'anvil-crush', { parameterData: { bits, hold } });
    if (!aa || hold <= 1) return { input: n, output: n, bits: n.parameters.get('bits'), hold: n.parameters.get('hold') };
    const f = 0.45 * ctx.sampleRate / hold, a = ctx.createBiquadFilter(), b = ctx.createBiquadFilter();
    for (const x of [a, b]) { x.type = 'lowpass'; x.frequency.value = f; x.Q.value = 0.6; }
    a.connect(n); n.connect(b);
    return { input: a, output: b, bits: n.parameters.get('bits'), hold: n.parameters.get('hold') };
  }
  const s = ctx.createWaveShaper(); s.curve = quantCurve(bits); s.oversample = '2x';
  return { input: s, output: s, set(b) { s.curve = quantCurve(b); } };
}

export function lowpass(ctx, freq = 4000, q = 0.7) {
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q;
  return { input: f, output: f, freq: f.frequency, q: f.Q };
}

// Sidechain pump: duck the signal on every kick. Call trigger(time) when a kick is scheduled.
export function sidechain(ctx, { depth = 0.7, release = 0.18, attack = 0.004 } = {}) {
  const g = ctx.createGain();
  return {
    input: g, output: g, gain: g.gain,
    trigger(t, d = depth) {
      // Only target curves, never a jump: the gain moves from wherever it is, so retriggering mid-release cannot click.
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(1 - d, t, attack / 3);
      g.gain.setTargetAtTime(1, t + attack * 2, release / 3);
    },
  };
}

// Tape: warmth, wow and flutter (modulated delay), hiss, and dropouts.
export function tape(ctx, { wow = 0.35, flutter = 0.12, hiss = 0.012, warmth = 1.6, cutoff = 9500 } = {}) {
  const input = ctx.createGain(), output = ctx.createGain(), drop = ctx.createGain(), sat = saturator(ctx, { drive: warmth });
  const lp = lowpass(ctx, cutoff, 0.5), delay = ctx.createDelay(0.1);
  delay.delayTime.value = 0.02;
  const lfo = (f, depth) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.value = depth; o.connect(g); g.connect(delay.delayTime); o.start(); return o; };
  const w = lfo(0.55, 0.0016 * wow), fl = lfo(7.3, 0.00022 * flutter);
  input.connect(sat.input); sat.output.connect(lp.input); lp.output.connect(delay); delay.connect(drop); drop.connect(output);
  const hs = noiseSource(ctx, 'pink'), hf = ctx.createBiquadFilter(), hg = ctx.createGain();
  hf.type = 'highpass'; hf.frequency.value = 3000; hg.gain.value = hiss; hs.connect(hf); hf.connect(hg); hg.connect(output); hs.start();
  return {
    input, output, lp,
    // The gain falls with the filter closing and the pitch sagging, then returns (or not, when back is false).
    dropout(t, dur = 0.4, { back = true, depth = 1, sag = 0.012 } = {}) {
      [drop.gain, lp.freq, delay.delayTime].forEach((p) => p.cancelScheduledValues(t));
      drop.gain.setTargetAtTime(1 - depth, t, 0.012); lp.freq.setTargetAtTime(300, t, 0.02); delay.delayTime.setTargetAtTime(0.02 + sag, t, 0.02);
      if (back) { drop.gain.setTargetAtTime(1, t + dur, 0.04); lp.freq.setTargetAtTime(cutoff, t + dur, 0.08); delay.delayTime.setTargetAtTime(0.02, t + dur, 0.06); }
    },
    stop(t = ctx.currentTime) { stopAt(w, t); stopAt(fl, t); stopAt(hs, t); },
  };
}

// Vinyl: procedural dust crackle (seeded impulses), rumble and surface hiss.
export function vinyl(ctx, { dust = 0.5, rumble = 0.4, hiss = 0.02, seed = 7, seconds = 6 } = {}) {
  const n = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0), r = rng(seed);
  const rate = 2 + 38 * dust;
  for (let i = 0; i < n; i++) {
    if (r() < rate / ctx.sampleRate) { const a = 0.1 * Math.pow(r(), 3) * (r() < 0.5 ? -1 : 1); for (let k = 0; k < 6 && i + k < n; k++) d[i + k] += a * Math.exp(-k * 0.7); }
    d[i] += (r() * 2 - 1) * 0.004 * dust;
  }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const out = ctx.createGain(), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
  src.connect(hp); hp.connect(out);
  const rb = noiseSource(ctx, 'brown'), rl = ctx.createBiquadFilter(), rg = ctx.createGain();
  rl.type = 'lowpass'; rl.frequency.value = 60; rg.gain.value = rumble * 0.4; rb.connect(rl); rl.connect(rg); rg.connect(out);
  const hn = noiseSource(ctx, 'white'), hf = ctx.createBiquadFilter(), hgn = ctx.createGain();
  hf.type = 'bandpass'; hf.frequency.value = 5500; hf.Q.value = 0.6; hgn.gain.value = hiss; hn.connect(hf); hf.connect(hgn); hgn.connect(out);
  return { output: out, start(t = ctx.currentTime) { src.start(t); rb.start(t); hn.start(t); }, stop(t) { stopAt(src, t); stopAt(rb, t); stopAt(hn, t); } };
}

export function reverb(ctx, { seconds = 1.8, decay = 3.2, mix = 0.25, seed = 3 } = {}) {
  const n = Math.floor(ctx.sampleRate * seconds), imp = ctx.createBuffer(2, n, ctx.sampleRate), r = rng(seed);
  for (let c = 0; c < 2; c++) { const d = imp.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / n, decay); }
  const input = ctx.createGain(), output = ctx.createGain(), conv = ctx.createConvolver(), wet = ctx.createGain(), dry = ctx.createGain();
  conv.buffer = imp; wet.gain.value = mix;
  input.connect(dry); dry.connect(output); input.connect(conv); conv.connect(wet); wet.connect(output);
  return { input, output, wet: wet.gain };
}

export function delay(ctx, { time = 0.3, feedback = 0.35, mix = 0.25, tone = 3500 } = {}) {
  const input = ctx.createGain(), output = ctx.createGain(), d = ctx.createDelay(2), fb = ctx.createGain(), lp = lowpass(ctx, tone), wet = ctx.createGain();
  d.delayTime.value = time; fb.gain.value = clamp(feedback, 0, 0.92); wet.gain.value = mix;
  input.connect(output); input.connect(d); d.connect(lp.input); lp.output.connect(fb); fb.connect(d); lp.output.connect(wet); wet.connect(output);
  return { input, output, time: d.delayTime, feedback: fb.gain };
}

export function chain(...nodes) {
  for (let i = 0; i < nodes.length - 1; i++) (nodes[i].output || nodes[i]).connect(nodes[i + 1].input || nodes[i + 1]);
  return { input: nodes[0].input || nodes[0], output: nodes[nodes.length - 1].output || nodes[nodes.length - 1] };
}
