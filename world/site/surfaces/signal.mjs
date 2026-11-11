// signal.mjs: a picture from sound, with no sound. A test signal is made here as numbers (a chord or a sweep), is never
// played, and is turned into pigment for the well by the PROPOSED mapping in states.mjs (SENSES.hearToSee):
//
//   spectrum, band by band   hue of the pigment poured: each of the twelve pitch classes (C, C sharp, ... B) is a hue
//   loudness                 amount poured
//   envelope                 ink coverage
//   noisiness                roughness slope (a noisy signal gives a rougher pigment)
//   tempo                    flow speed (how often the loudness rises, per second)
//
// The mapping is ours and is a proposal: no study behind it, and the other direction (a picture to sound) is not here.
// Pure: no page, no audio interface, runs in node and the browser.
export const RATE = 8000, CLASSES = 12, NAMES = Object.freeze(['C', 'C sharp', 'D', 'D sharp', 'E', 'F', 'F sharp', 'G', 'G sharp', 'A', 'A sharp', 'B']);
const noise = (i) => { let h = Math.imul(i + 1, 374761393); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 2147483648 - 1; };
export const SIGNALS = Object.freeze({
  chord: { name: 'a chord', says: 'three tones held together (C, E and G)', make: () => tones([261.63, 329.63, 392.0], 1.2) },
  sweep: { name: 'a sweep', says: 'one tone that rises through an octave, from A to A', make: () => sweep(220, 440, 1.6) },
  hiss: { name: 'a hiss', says: 'noise with no pitch', make: () => Float32Array.from({ length: RATE }, (_, i) => 0.5 * noise(i)) },
});
export function tones(freqs, seconds, level = 0.8) { const n = Math.round(seconds * RATE), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { const env = Math.min(1, i / 400, (n - i) / 400); for (const f of freqs) s[i] += level / freqs.length * env * Math.sin(2 * Math.PI * f * i / RATE); } return s; }
export function sweep(f0, f1, seconds, level = 0.8) { const n = Math.round(seconds * RATE), s = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { ph += 2 * Math.PI * f0 * (f1 / f0) ** (i / n) / RATE; s[i] = level * Math.min(1, i / 400, (n - i) / 400) * Math.sin(ph); } return s; }

// One stretch of a signal: the energy in each pitch class (one filter per note over three octaves, Goertzel's method),
// its loudness (root mean square), and its noisiness (the share of its energy that no note accounts for).
export function analyse(s, from = 0, to = s.length) {
  const n = to - from, cls = new Float64Array(CLASSES); let sq = 0;
  for (let i = from; i < to; i++) sq += s[i] * s[i];
  for (let k = 0; k < 36; k++) { const f = 130.81 * 2 ** (k / 12), w = 2 * Math.cos(2 * Math.PI * f / RATE); let a = 0, b = 0;
    for (let i = from; i < to; i++) { const t = s[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * (i - from) / n)) + w * a - b; b = a; a = t; }
    cls[k % 12] += (a * a + b * b - w * a * b) / (n * n) * 8; }   // a windowed tone of amplitude A gives about A squared over 2
  const loud = Math.sqrt(sq / Math.max(1, n)), tonal = cls.reduce((x, y) => x + y, 0);
  return { classes: Array.from(cls), loud, noisy: loud > 1e-6 ? Math.min(1, Math.max(0, 1 - tonal / (sq / n))) : 0 };
}
// A pitch class as a colour: the twelve classes go once round the hue circle, in OKLab, at one lightness and chroma.
export const hueOf = (c) => { const h = 2 * Math.PI * c / CLASSES; return [0.72, 0.15 * Math.cos(h), 0.15 * Math.sin(h)]; };

// A signal as what the well takes: up to four pigments (its strongest pitch classes) and a list of pours across the
// well, left to right as the signal runs. like is a drive with the table's median values.
// The signal is read in stretches of a fifth of a second: long enough to tell one note from the next at these pitches,
// short enough that a tone that moves is still mostly heard as a tone. The whole is the sum of the stretches.
export function toWell(s, like, frames = Math.max(4, Math.round(s.length / RATE * 5))) {
  const size = Math.floor(s.length / frames), F = Array.from({ length: frames }, (_, i) => analyse(s, i * size, (i + 1) * size)), pw = F.reduce((a, f) => a + f.loud * f.loud, 0) || 1;
  const whole = { classes: F[0].classes.map((_, c) => F.reduce((a, f) => a + f.classes[c], 0) / frames), loud: Math.sqrt(pw / frames), noisy: F.reduce((a, f) => a + f.noisy * f.loud * f.loud, 0) / pw };
  const total = whole.classes.reduce((a, b) => a + b, 0) || 1, order = whole.classes.map((e, c) => [e, c]).sort((a, b) => b[0] - a[0]).filter(([e], i, all) => e > 0.35 * all[0][0]).slice(0, 4).map(([, c]) => c);
  const rises = F.filter((f, i) => i > 0 && f.loud > F[i - 1].loud * 1.3 + 0.01).length, tempo = rises / (s.length / RATE), env = Math.min(1, whole.loud * 2.2);
  if (!order.length) order.push(0);
  const parts = order.map((c) => ({ signal: true, id: `note-${c}`, name: NAMES[c], ok: hueOf(c), weight: Math.max(0.05, whole.classes[c] / total), links: order.map(() => 0),
    drive: { ...like, coverage: 0.25 + 0.6 * env, opacity: 0.3, beta: 1.6 - 1.2 * whole.noisy, speed: Math.min(1, 0.15 + tempo / 6) } }));
  const pours = []; F.forEach((f, i) => { const sum = f.classes.reduce((a, b) => a + b, 0) || 1;
    order.forEach((c, slot) => { const share = f.classes[c] / sum; if (share > 0.12 && f.loud > 0.01) pours.push({ slot, x: (i + 0.5) / frames, y: 0.25 + 0.5 * (slot + 0.5) / order.length, amount: +(Math.min(0.6, 1.4 * f.loud * share)).toFixed(4) }); }); });
  return { parts, pours, classes: order, loud: whole.loud, noisy: whole.noisy, tempo, label: 'proposed mapping; the signal is numbers and is never played' };
}
