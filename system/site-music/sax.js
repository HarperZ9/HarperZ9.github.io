// sax.js: a saxophone-family voice, beside the engine's clarinet-like reed.
// A clarinet's bore is a cylinder closed at the reed: it favours odd harmonics and sounds an octave below a cone of the
// same length. A saxophone's bore is a cone, and a cone closed at its narrow end resonates like a string fixed at both
// ends: every harmonic, odd and even. Dalmont, Gilbert and Kergomard ("Reed instruments, from small to large amplitude
// periodic oscillations and the Helmholtz motion analogy", Acta Acustica 86, 2000) showed that a reed on a cone moves like
// a bowed string, with the reed's place along the bore standing in for the bow's place along the string. Scavone and Cook
// built a waveguide on that idea (the "Saxofony" instrument in their Synthesis ToolKit); this file is our own writing of
// the same structure from the description: one loop a full wavelength long, split in two delay lines at the reed's
// position, a lossy reflection at the bell, and a reed that lets breath in according to the pressure across it.
//
// Round three: the voice is played as a phrase, the way a player plays it. One air column sounds through the whole phrase.
//   legato      a slurred note changes the length of the bore under a breath that keeps going; only a tongued note dips
//   attack      breath arrives before tone, and the pressure overshoots for a moment, so the start is brighter and noisier
//   dynamics    the reed is driven harder at higher pressure: the tone brightens with level and darkens as a note decays,
//               and at low level it thins toward a sub-tone with more air in it
//   formants    three fixed resonances of the body (about 520, 1350 and 2700 Hz; from memory, approximate) that stay
//               where they are while the pitch moves
//   pitch       scoops into a tongued note from below, drifts by a few cents, vibrato arrives late and its rate and
//               depth wander
//   noise       breath through the mouthpiece, an intake of air before the phrase, a very quiet key click at each change
//   growl       optional: the breath flutters at about 30 Hz
// The loop length that gives a wanted pitch was found by measuring the rendered pitch with the ear (voice tests).
import { mtof, rng, velocity, Delay, Biquad, edges, clamp } from '../../world/sound/sound/v3/instruments/core.js';

export const SAX = { breath: 0.62, noise: 0.1, vibrato: 0.011, vibRate: 5, vibDelay: 0.45, scoop: 0.6, reed: 0.3, position: 0.4, tone: 4200, drift: 4, growl: 0, intake: 1, keys: 1 };
export const TRIM = 3.0;   // loop samples taken off for the filters in the loop; set by measurement
const FORMANTS = [[520, 1.2, 3], [1350, 1.4, 4], [2700, 1.6, 3]];
export const PRE = 0.3;    // seconds before the first note: the player breathes in

// notes: [{ t, dur, m, vel, slur }] in seconds from the first note, in order. Returns { x, pre }: mono samples, and how
// many of them come before the first note.
export function saxPhrase(notes, p = SAX, sr = 48000, seed = 3) {
  const q = { ...SAX, ...p }, r = rng(seed * 2971 + Math.round(notes[0].m * 13) + notes.length), pre = Math.round(PRE * sr), end = notes[notes.length - 1], len = pre + Math.floor((end.t + end.dur + 0.35) * sr), x = new Float32Array(len), air = new Float32Array(len), lev = new Float32Array(len), pit = new Float32Array(len);
  const low = Math.min(...notes.map((n) => n.m)), max = Math.ceil(sr / mtof(low - 4)) + 16, d0 = new Delay(max), d1 = new Delay(max), nz = new Biquad('lp', 2800, 0.7, sr), V = notes.map((n) => velocity(n.vel, { curve: 1.3 })), pressure = (v) => (0.5 + 0.45 * q.breath) * (0.7 + 0.4 * v.bright), top = (0.5 + 0.45 * q.breath) * 1.1;
  let k = 0, lp = 0, e = 0, f = mtof(notes[0].m), w1 = 0, w2 = 0, w3 = 0, t1 = 0, t2 = 0, t3 = 0, vb = 0.3 + 0.7 * notes[0].vel, vph = r() * 6.28;
  const ka = 1 - Math.exp(-1 / (0.012 * sr)), kr = 1 - Math.exp(-1 / (0.03 * sr)), kg = 1 - Math.exp(-1 / (0.012 * sr)), kw = 1 - Math.exp(-64 / (0.4 * sr)), clicks = [];
  for (let i = 0; i < len; i++) {
    const t = (i - pre) / sr; while (k + 1 < notes.length && t >= notes[k + 1].t) { k++; clicks.push(i); }
    const n = notes[k], tin = t - n.t, nx = notes[k + 1], sounding = t >= 0 && (tin < n.dur || (nx && nx.t - (n.t + n.dur) < 0.12)), tongued = k === 0 || !n.slur;
    if (i % 64 === 0) { t1 = r() * 2 - 1; t2 = r() * 2 - 1; t3 = r() * 2 - 1; } w1 += kw / 64 * (t1 - w1); w2 += kw / 64 * (t2 - w2); w3 += kw / 64 * (t3 - w3);   // three slow wanderers: pitch drift, vibrato rate, vibrato depth
    // breath: the target follows the note's strength, overshoots at a tongued start, sags a little on a long note, and dips for the tongue
    const shape = tongued ? (tin < 0.012 && k > 0 ? 0.3 : 1 + 0.25 * Math.exp(-Math.max(0, tin) / 0.04)) : 1, target = sounding ? pressure(V[k]) * shape * (0.88 + 0.12 * Math.exp(-Math.max(0, tin) / 1.2)) : 0;
    e += (target > e ? ka : kr) * (target - e);
    const noise = r() * 2 - 1, flutter = q.growl ? 1 + 0.45 * q.growl * Math.sin(2 * Math.PI * 31 * t) : 1, soft = 1.35 - 0.7 * Math.min(1, e / top), breath = e * flutter * (1 + q.noise * 2.5 * soft * nz.tick(noise));
    // pitch: glide to the note over about 12 ms (the fingers), scoop on a tongued start, drift, late vibrato
    const want = mtof(n.m); f *= Math.pow(want / f, 1 - Math.exp(-1 / (0.012 * sr)));
    const depth = q.vibrato * Math.min(1, Math.max(0, (tin - q.vibDelay * (tongued ? 1 : 0.6)) / 0.7)) * (1 + 0.6 * Math.min(1, tin / 2.5)) * (1 + 0.5 * w3); vph += 2 * Math.PI * q.vibRate * (1 + 0.1 * w2) / sr;
    const fi = f * Math.pow(2, ((tongued ? -q.scoop * Math.exp(-Math.max(0, tin) / 0.06) : 0) + q.drift * w1 * 3 / 100) / 12) * (1 + depth * Math.sin(vph)), N = sr / fi - TRIM;
    const back = d0.read((1 - q.position) * N); lp = 0.5 * (back + lp);                           // the bell: a lossy, inverting reflection
    const bell = -0.95 * lp, at = bell - d1.read(q.position * N), pd = breath - at;                // pressure at the reed, and across it
    d1.write(bell); d0.write(breath - pd * clamp(0.7 + q.reed * pd, -1, 1) - bell);
    vb += kg * (0.3 + 0.7 * n.vel - vb); x[i] = lp; pit[i] = f; lev[i] = e / top * vb;   // how hard the note is blown: breath pressure times the strength the score asks for
                                                                     // heard at the bell, where every harmonic of the loop arrives
    const intake = t < 0 ? q.intake * 0.5 * Math.sin(Math.PI * Math.min(1, (t + PRE) / (PRE * 0.8))) ** 2 * (t > -0.06 ? -t / 0.06 : 1) : 0; air[i] = noise * (e / top * soft + intake);
  }
  new Biquad('hp', 60, 0.7, sr).run(x); let pk = 0; for (let i = pre + Math.floor(0.05 * sr); i < len; i++) pk = Math.max(pk, Math.abs(x[i]));
  // the reed driven harder at higher pressure, and a low-pass that opens with it: bright when loud, dark as the note dies
  // (the cutoff counts in harmonics of the note: about three at a whisper, eight when blown hard)
  const hp = new Biquad('hp', 60, 0.7, sr); let y1 = 0, y2 = 0;
  if (pk) for (let i = 0; i < len; i++) { const L = Math.min(1.2, lev[i]), d = 0.3 + 4.2 * L * L, u = clamp(x[i] / pk, -1.5, 1.5), s = hp.tick(Math.tanh(d * (u + 0.15 * u * u)) / Math.tanh(d)), a = 1 - Math.exp(-2 * Math.PI * Math.min(q.tone * 1.2, pit[i] * (1.2 + 13 * Math.pow(L, 2.5))) / sr); y1 += a * (s - y1); y2 += a * (y1 - y2); x[i] = y2; }
  for (const [fc, Q, db] of FORMANTS) new Biquad('peak', fc, Q, sr, db).run(x);
  new Biquad('hp', 2500, 0.7, sr).run(air); new Biquad('lp', 9000, 0.7, sr).run(air);
  const click = new Biquad('bp', 3200, 2, sr); let c = 0, cn = 0; const kc = rng(seed + 77);
  for (let i = 0; i < len; i++) { if (c < clicks.length && i === clicks[c]) { cn = Math.round(0.004 * sr); c++; } const key = cn > 0 ? (cn--, q.keys * 0.006 * click.tick(kc() * 2 - 1)) : 0; x[i] = clamp(x[i] * 0.62 + 0.035 * q.noise * air[i] + key, -1, 1); }
  new Biquad('hp', 30, 0.7, sr).run(x);   // the uneven clipping above leaves a small offset; this takes it out
  // strength per note: the breath already shapes the tone; this sets how loud each note sits
  let g = V[0].gain, kk = 0; for (let i = 0; i < len; i++) { const t = (i - pre) / sr; while (kk + 1 < notes.length && t >= notes[kk + 1].t) kk++; g += kg * (V[kk].gain - g); x[i] *= g; }
  return { x: edges(x, sr, 0.004, 0.05), pre };
}

// One note on its own, without the intake of breath: for tests and for single notes.
export function sax(m, vel, dur, p = SAX, sr = 48000, seed = 3) { const r = saxPhrase([{ t: 0, dur, m, vel }], { ...p, intake: 0 }, sr, seed); return r.x.subarray(r.pre); }
