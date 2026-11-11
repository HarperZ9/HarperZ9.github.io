// blown.js: a blown instrument (saxophone, flute, clarinet) as a played phrase over a measured tone.
// The tone is the measured layer (measured.js): a sum of harmonics whose levels were measured from recordings of the real
// instrument at soft, medium and loud, read as a spectral envelope so the body's resonances stay fixed while the pitch
// moves, plus breath noise at the measured level in seven bands. The earlier voice was a waveguide tuned to targets
// written from memory; the ear's identity judge heard it as no instrument in its book.
// The playing is this file's own, kept from round three. One air column sounds through the whole phrase.
//   legato      a slurred note changes pitch under a breath that keeps going; only a tongued note dips
//   attack      breath arrives before tone and overshoots for a moment, with a puff of extra noise
//   dynamics    the harmonic levels follow the breath from moment to moment: the note brightens as it is blown harder and
//               darkens as it dies, along the path measured between the soft and loud recordings
//   movement    each harmonic's level wanders by the amount measured on the real instrument, so a held note is not frozen
//   pitch       scoops into a tongued note from below, drifts by a few cents, vibrato arrives late and its rate and depth
//               wander; with the envelope fixed, vibrato also moves the harmonic levels, as it does on the instrument
//   noise       an intake of air before the phrase, a very quiet key click at each change
//   growl       optional: the breath flutters at about 30 Hz
import { mtof, rng, velocity, Biquad, edges, clamp } from '../../world/sound/sound/v3/instruments/core.js';
import { around, harmonicsAt, bandsAt, NoiseBank } from './measured.js';

export const BLOWN = { breath: 0.62, noise: 0.1, vibrato: 0.011, vibRate: 5, vibDelay: 0.45, scoop: 0.6, tone: 0, drift: 4, growl: 0, intake: 1, keys: 1, attack: 0.012, over: 0.25, move: 1, gain: 0.6 };
export const PRE = 0.3;    // seconds before the first note: the player breathes in
const KMAX = 32;

// notes: [{ t, dur, m, vel, slur }] in seconds from the first note, in order. table: one of measured.js TABLES.
// p.noise scales the measured breath noise (0.1 plays it as measured). p.tone, when set, rolls the harmonics off by 6 dB
// per octave above that frequency: a darker reed than the one measured. p.attack is the time the breath takes to arrive,
// p.over how far it overshoots on a tongued start, p.move scales the measured wander of the harmonics. Returns { x, pre }: mono samples, and how many
// of them come before the first note.
export function blownPhrase(notes, table, p = {}, sr = 48000, seed = 3) {
  const q = { ...BLOWN, ...p }, r = rng(seed * 2971 + Math.round(notes[0].m * 13) + notes.length), pre = Math.round(PRE * sr), end = notes[notes.length - 1], len = pre + Math.floor((end.t + end.dur + 0.35) * sr), x = new Float32Array(len), air = new Float32Array(len);
  const V = notes.map((n) => velocity(n.vel, { curve: 1.3 })), pressure = (v) => (0.5 + 0.45 * q.breath) * (0.7 + 0.4 * v.bright), top = (0.5 + 0.45 * q.breath) * 1.1, STEP = Math.max(8, Math.round(sr / 1500));
  let k = 0, e = 0, f = mtof(notes[0].m), w1 = 0, w2 = 0, w3 = 0, t1 = 0, t2 = 0, t3 = 0, vb = 0.3 + 0.7 * notes[0].vel, vph = r() * 6.28, ph = 0, Kn = 0, puff = 0;
  const ka = 1 - Math.exp(-1 / (q.attack * sr)), kr = 1 - Math.exp(-1 / (0.03 * sr)), kg = 1 - Math.exp(-1 / (0.012 * sr)), kw = 1 - Math.exp(-64 / (0.4 * sr)), ks = 1 - Math.exp(-1 / (0.004 * sr)), kp = Math.exp(-1 / (0.03 * sr)), clicks = [];
  const A = new Float32Array(KMAX), T = new Float32Array(KMAX), dbs = new Float32Array(KMAX), sh = new Float32Array(KMAX), wob = new Float32Array(KMAX), th = Float32Array.from({ length: KMAX }, ((u) => () => u() * 6.2832)(rng(4242))), nb = new Float32Array(7), bank = new NoiseBank(sr, rng(seed * 131 + 7));
  for (let i = 0; i < len; i++) {
    const t = (i - pre) / sr; while (k + 1 < notes.length && t >= notes[k + 1].t) { k++; clicks.push(i); if (!notes[k].slur) puff = 1; } if (i === pre) puff = 1;
    const n = notes[k], tin = t - n.t, nx = notes[k + 1], sounding = t >= 0 && (tin < n.dur || (nx && nx.t - (n.t + n.dur) < 0.12)), tongued = k === 0 || !n.slur;
    if (i % 64 === 0) { t1 = r() * 2 - 1; t2 = r() * 2 - 1; t3 = r() * 2 - 1; } w1 += kw / 64 * (t1 - w1); w2 += kw / 64 * (t2 - w2); w3 += kw / 64 * (t3 - w3);   // three slow wanderers: pitch drift, vibrato rate, vibrato depth
    // breath: the target follows the note's strength, overshoots at a tongued start, sags a little on a long note, and dips for the tongue
    const shape = tongued ? (tin < 0.012 && k > 0 ? 0.3 : 1 + q.over * Math.exp(-Math.max(0, tin) / 0.04)) : 1, target = sounding ? pressure(V[k]) * shape * (0.88 + 0.12 * Math.exp(-Math.max(0, tin) / 1.2)) : 0;
    e += (target > e ? ka : kr) * (target - e); vb += kg * (0.3 + 0.7 * n.vel - vb);
    // pitch: glide to the note over about 12 ms (the fingers), scoop on a tongued start, drift, late vibrato
    const want = mtof(n.m); f *= Math.pow(want / f, 1 - Math.exp(-1 / (0.012 * sr)));
    const depth = q.vibrato * Math.min(1, Math.max(0, (tin - q.vibDelay * (tongued ? 1 : 0.6)) / 0.7)) * (1 + 0.6 * Math.min(1, tin / 2.5)) * (1 + 0.5 * w3); vph += 2 * Math.PI * q.vibRate * (1 + 0.1 * w2) / sr;
    const fi = f * Math.pow(2, ((tongued ? -q.scoop * Math.exp(-Math.max(0, tin) / 0.06) : 0) + q.drift * w1 * 3 / 100) / 12) * (1 + depth * Math.sin(vph)), blow = Math.min(1.2, e / top);
    if (i % STEP === 0) {   // the measured harmonic and noise levels for this pitch and this much breath
      const m = 69 + 12 * Math.log2(fi / 440), lev = blow * vb, near = around(table, m, lev); Kn = Math.min(KMAX, Math.floor(0.42 * sr / fi));
      harmonicsAt(table, m, lev, Kn, dbs, 'db', near); harmonicsAt(table, m, lev, Kn, sh, 'sh', near); bandsAt(table, m, lev, nb, near); bank.set(nb, q.noise / 0.1);
      for (let h = 0; h < KMAX; h++) { if (h >= Kn) { T[h] = 0; continue; } wob[h] += 0.01 * ((r() * 2 - 1) * sh[h] * 24.4 * q.move - wob[h]); T[h] = Math.SQRT2 * Math.pow(10, (dbs[h] + wob[h] - (q.tone ? 6 * Math.max(0, Math.log2((h + 1) * fi / q.tone)) : 0)) / 20); }
    }
    ph += 2 * Math.PI * fi / sr; if (ph > 6.283185307179586) ph -= 6.283185307179586; let y = 0; for (let h = 0; h < Kn; h++) { A[h] += ks * (T[h] - A[h]); y += A[h] * Math.sin((h + 1) * ph + th[h]); }
    const flutter = q.growl ? 1 + 0.45 * q.growl * Math.sin(2 * Math.PI * 31 * t) : 1, amp = Math.pow(blow, 1.2) * flutter; puff *= kp;
    x[i] = amp * (y + bank.tick() * (1 + 2.5 * puff));
    const intake = t < 0 ? q.intake * 0.5 * Math.sin(Math.PI * Math.min(1, (t + PRE) / (PRE * 0.8))) ** 2 * (t > -0.06 ? -t / 0.06 : 1) : 0; air[i] = (r() * 2 - 1) * intake;
  }
  new Biquad('hp', 2500, 0.7, sr).run(air); new Biquad('lp', 9000, 0.7, sr).run(air);
  const click = new Biquad('bp', 3200, 2, sr); let c = 0, cn = 0; const kc = rng(seed + 77);
  for (let i = 0; i < len; i++) { if (c < clicks.length && i === clicks[c]) { cn = Math.round(0.004 * sr); c++; } const key = cn > 0 ? (cn--, q.keys * 0.006 * click.tick(kc() * 2 - 1)) : 0; x[i] = clamp(x[i] * q.gain + 0.035 * q.noise * air[i] + key, -1, 1); }
  new Biquad('hp', 30, 0.7, sr).run(x);
  // strength per note: the breath already shapes the tone; this sets how loud each note sits
  let g = V[0].gain, kk = 0; for (let i = 0; i < len; i++) { const t = (i - pre) / sr; while (kk + 1 < notes.length && t >= notes[kk + 1].t) kk++; g += kg * (V[kk].gain - g); x[i] *= g; }
  return { x: edges(x, sr, 0.004, 0.05), pre };
}

// One note on its own, without the intake of breath: for tests, benches and single notes.
export function blown(m, vel, dur, table, p = {}, sr = 48000, seed = 3) { const r = blownPhrase([{ t: 0, dur, m, vel }], table, { ...p, intake: 0 }, sr, seed); return r.x.subarray(r.pre); }
