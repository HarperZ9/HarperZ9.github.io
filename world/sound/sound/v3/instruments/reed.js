// Reed and flute voices from physical models (digital waveguides, after the published Karplus-Strong and McIntyre,
// Schumacher and Woodhouse line of models, written here from the physics, not from any library). In the browser the
// webaudio adapter can layer a cleared recorded reed (oboe, duduk, bansuri from sound/assets/samples) under the model.
//   reed:  a bore delay line closed by a pressure-controlled reed (reflection = clamp(offset + slope * pressure difference))
//   flute: a jet delay feeding a cubic jet nonlinearity into a bore delay, both ends reflecting
// Breath, noise and vibrato are performance parameters; velocity sets the breath pressure, so loud notes are brighter.
import { mtof, rng, velocity, Delay, Biquad, edges, clamp } from './core.js';

export const meta = {
  id: 'reed', title: 'Reed and flute (waveguide)', kind: 'lead',
  params: {
    model: { options: ['reed', 'flute'], default: 'reed' }, breath: { min: 0.3, max: 1, default: 0.7 }, noise: { min: 0, max: 0.4, default: 0.08 },
    vibrato: { min: 0, max: 0.04, default: 0.012, doc: 'depth, fraction of pitch' }, vibRate: { min: 3, max: 7, default: 5.2, unit: 'Hz' },
    vibDelay: { min: 0, max: 1.5, default: 0.35, unit: 's', doc: 'vibrato enters late and widens on long notes' },
    reedStiff: { min: 0.1, max: 0.5, default: 0.3 }, tone: { min: 1000, max: 8000, default: 3500, unit: 'Hz' }, scoop: { min: 0, max: 2, default: 0.6, unit: 'semitones', doc: 'bend up into the note' },
  },
  presets: {
    'dark-reed': { model: 'reed', breath: 0.62, noise: 0.06, vibrato: 0.01, vibRate: 4.8, vibDelay: 0.5, reedStiff: 0.34, tone: 2600, scoop: 0.8 },
    'temple-flute': { model: 'flute', breath: 0.8, noise: 0.18, vibrato: 0.014, vibRate: 5.4, vibDelay: 0.3, reedStiff: 0.3, tone: 5200, scoop: 0.4 },
    'oboe-ish': { model: 'reed', breath: 0.78, noise: 0.04, vibrato: 0.008, vibRate: 5.6, vibDelay: 0.25, reedStiff: 0.22, tone: 4800, scoop: 0.3 },
  },
};

export function note(m, vel, dur, p, sr = 48000, seed = 2) {
  const V = velocity(vel, { curve: 1.3 }), r = rng(seed), f0 = mtof(m), len = Math.floor((dur + 0.35) * sr), x = new Float32Array(len), flute = p.model === 'flute';
  const maxD = Math.ceil(1.6 * sr / mtof(m - 3)) + 8, bore = new Delay(maxD), jet = new Delay(maxD), tone = new Biquad('lp', p.tone * (0.6 + 0.4 * V.bright), 0.6, sr), noiseLp = new Biquad('lp', 2500, 0.7, sr);
  let lp1 = 0, dc1 = 0, dcy = 0; const pmax = (0.55 + 0.5 * p.breath) * (0.75 + 0.35 * V.bright);
  for (let i = 0; i < len; i++) {
    const t = i / sr, att = Math.min(1, t / 0.06), rel = t < dur ? 1 : Math.exp(-(t - dur) * 18);
    const vibAmt = p.vibrato * Math.min(1, Math.max(0, (t - p.vibDelay) / 0.8)) * (1 + 0.5 * Math.min(1, t / 3));
    const bend = Math.pow(2, (-p.scoop * Math.exp(-t / 0.07)) / 12), f = f0 * bend * (1 + vibAmt * Math.sin(2 * Math.PI * p.vibRate * t));
    const breath = pmax * att * rel * (1 + p.noise * noiseLp.tick(r() * 2 - 1) * 2);
    // loop lengths, calibrated by measurement (tests/instruments.test.mjs): the reed loop runs one sample long beyond its read
    // point; the flute's two coupled loops (bore, and bore plus jet) sound at a period of about 0.659 D + 1.17 samples
    const D = flute ? (sr / f - 1.17) / 0.659 : sr / f;
    if (!flute) {
      const back = bore.read(D * 0.5 - 2); lp1 = 0.5 * (back + lp1);                    // one-zero loss filter at the open end
      const pd = -0.95 * lp1 - breath, refl = clamp(0.7 - p.reedStiff * pd, -1, 1);     // the reed table
      bore.write(breath + pd * refl); x[i] = back;
    } else {
      const back = bore.read(D - 1); lp1 = 0.7 * lp1 + 0.3 * back;                     // one-pole loss filter
      const tmp = -lp1; dcy = tmp - dc1 + 0.995 * dcy; dc1 = tmp;                         // DC blocker
      const pd = breath - 0.5 * dcy; jet.write(pd); const jd = jet.read(D * 0.32);
      const jt = clamp(jd * (jd * jd - 1), -1, 1); bore.write(jt + 0.5 * dcy); x[i] = back;
    }
  }
  tone.run(x); let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v)); const g = pk ? 0.6 * V.gain / pk : 0; for (let i = 0; i < len; i++) x[i] *= g;
  return edges(x, sr, 0.004, 0.06);
}

// A Lateef-spirited line generator: a narrow modal set (five or six notes), long notes that bend in, and rests that breathe.
// Returns [{ beat, m, beats }]. Our own procedure, seeded; no melody from any record.
export function line(bars, { scale = [0, 1, 3, 5, 7, 8], root = 61, seed = 9, rest = 0.3 } = {}) {
  const r = rng(seed), out = []; let beat = 0, deg = 2;
  while (beat < bars * 4) {
    if (r() < rest) { beat += r() < 0.5 ? 1 : 2; continue; }
    deg = clamp(deg + [-2, -1, -1, 0, 1, 1, 2][Math.floor(r() * 7)], 0, scale.length - 1);
    const beats = [0.5, 1, 1.5, 2, 3][Math.floor(r() * 5)]; out.push({ beat, m: root + scale[deg] - (deg < 2 && r() < 0.3 ? 12 : 0), beats }); beat += beats;
  }
  return out;
}
