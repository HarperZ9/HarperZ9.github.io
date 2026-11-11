// plucked.js: a plucked string over a measured tone. The measured layer (measured.js) gives, for the pitch and strength
// asked for, the level of every partial at the pluck, how fast each one dies away, and the string's inharmonicity, all
// measured from recordings of the real instrument. The string here is a sum of those partials, each a little sharp of a
// whole multiple of the fundamental as the measured stiffness says, each dying at its measured rate.
// Where the table holds them (round five), two more measured things: each partial dies faster over the first 150 ms
// (dec0) than later (dec), and the pluck itself adds a short burst of noise in seven octave bands at its measured level
// and decay (ex, exT): the soft, wide-band thump of the finger before the tone. o.thump scales that burst (1 as measured; 0, the default, leaves it out).
// The playing belongs to the caller: where the pitch starts (a slide, the moment of sharpness after a hard pluck, a
// scoop), how the note is stopped, a tilt for a brighter or darker stroke, and the noise of the finger or thumb.
import { mtof, rng, expDecay } from '../../world/sound/sound/v3/instruments/core.js';
import { around, harmonicsAt, valueAt, bandsAt, NoiseBank } from './measured.js';

// o: { hold (s the string rings before it is stopped), release (s), attack (s), from (MIDI pitch a slide starts on),
//      glide (s), cents (pitch offset at the pluck, decaying over centsTau), tilt (dB per octave above 250 Hz), ring
//      (multiplies every decay rate), spread (dB of random level per partial, so no two plucks are the same), kmax,
//      noise (scales the measured noise between the partials), beat (depth of each partial's slow beating) }
// Returns mono samples with the partials together at unit power at the pluck; the caller sets the level.
export function plucked(table, m, vel, dur, o = {}, sr = 48000, seed = 1) {
  const { hold = dur, release = 0.045, attack = 0.003, from = null, glide = 0.025, cents = 0, centsTau = 0.04, tilt = 0, ring = 1, spread = 3, kmax = 64, tail = 0.22, noise = 1, beat = 0.18, thump = 0, knee = 0.15, early: em = 1, thumpFrom = 0 } = o;
  const f0 = mtof(m), len = Math.floor((hold + tail) * sr), x = new Float32Array(len), r = rng(seed * 7001 + Math.round(m * 29) + 3), near = around(table, m, vel), K = Math.max(1, Math.min(kmax, Math.floor(0.42 * sr / f0)));
  const db = harmonicsAt(table, m, vel, K, new Float32Array(K), 'db', near), dec = harmonicsAt(table, m, vel, K, new Float32Array(K), 'dec', near), early = near[0].note.dec0 ? harmonicsAt(table, m, vel, K, new Float32Array(K), 'dec0', near).map((v, k) => dec[k] + em * (v - dec[k])) : dec, B = valueAt(table, m, vel, 'B', near), P = [];
  for (let h = 1; h <= K; h++) { const k = h * Math.sqrt(1 + B * h * h); if (k * f0 > 0.45 * sr) break; const lift = tilt * Math.max(0, Math.log2(h * f0 / 250));
    P.push({ k, a: Math.SQRT2 * Math.pow(10, (db[h - 1] + lift + (r() - 0.5) * spread) / 20), g: Math.pow(10, -early[h - 1] * ring / 20 / sr), gl: Math.pow(10, -dec[h - 1] * ring / 20 / sr), e0: early[h - 1] * ring, ph: r() * 6.2832, mm: 1, dm: 0, bf: 0.4 + 2.2 * r(), bp: r() * 6.2832 }); }
  // the noise between the partials at its measured level (finger on the string, hum, hiss), following the string as it dies;
  // and a slow beat on each partial, as a real string's two directions of motion drift against each other
  const start = from === null ? f0 : mtof(from), w = 2 * Math.PI / sr, bank = new NoiseBank(sr, rng(seed * 577 + 11)), nb = bandsAt(table, m, vel, new Float32Array(7), near); let n = P.length, level = 1;
  // the pluck's burst: band power from the measured excess, against the partials' own power 80 ms in
  const ex = near[0].note.ex ? Array.from({ length: 7 }, (_, b) => near.reduce((s, { note, w: q }) => s + q * note.ex[b], 0)) : null, exT = ex ? near.reduce((s, { note, w: q }) => s + q * (note.exT || 0.01), 0) : 0.01, hit = new NoiseBank(sr, rng(seed * 313 + 5)), kneeAt = Math.round(knee * sr);
  if (ex && thump > 0) { const e80 = P.reduce((s, q) => s + q.a * q.a / 2 * Math.pow(10, -q.e0 * 0.08 / 10), 0), shape = (exT / 2) * (1 - Math.exp(-0.06 / exT)) / 0.03; hit.set(ex.map((d, b) => (b < thumpFrom ? -200 : 10 * Math.log10(Math.max(1e-12, e80 * Math.pow(10, d / 10) / shape)))), thump); } else hit.set(new Float32Array(7).fill(-200), 0);
  for (let i = 0; i < len; i++) {
    const t = i / sr, f = f0 * Math.pow(start / f0, expDecay(t, glide)) * Math.pow(2, cents * expDecay(t, centsTau) / 1200), env = Math.min(1, t / attack) * (t < hold ? 1 : expDecay(t - hold, release)); let y = 0;
    if ((i & 255) === 0) { let e = 0; for (let j = 0; j < n; j++) { const q = P[j]; q.dm = (1 + beat * Math.sin(2 * Math.PI * q.bf * t + q.bp) - q.mm) / 256; e += q.a * q.a; } level = Math.sqrt(e / 2); bank.set(nb, noise * level); }
    for (let j = 0; j < n; j++) { const q = P[j]; q.ph += w * f * q.k; if (q.ph > 6.283185307179586) q.ph -= 6.283185307179586; q.a *= q.g; q.mm += q.dm; y += q.a * q.mm * Math.sin(q.ph); }
    y += bank.tick(); if (i < 8 * exT * sr) y += hit.tick() * Math.exp(-i / (exT * sr));
    if (i === kneeAt) for (const q of P) q.g = q.gl;   // past the first 150 ms each partial dies at its later rate
    if ((i & 1023) === 0) while (n > 1 && P[n - 1].a < 1e-5) n--;   // partials that have died away are no longer computed
    x[i] = y * env;
  }
  return x;
}
