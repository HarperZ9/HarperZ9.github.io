// identity.js: which instrument does a note resemble. A nearest-class judge over the timbre features of timbre.js, with
// notes recorded from real instruments as its ground truth (the "book", identity-refs.json, built by tools/identity.mjs).
//   distance     each feature is divided by its spread over all reference notes, so no feature dominates by its unit;
//                the distance between two notes is the root of the mean squared difference, with a weight per feature
//   class score  the mean distance to the three nearest reference notes of that class within seven semitones of the
//                note's pitch (an instrument's tone changes over its range, so a note is compared with its neighbours)
//   verdict      the class with the lowest score, how far ahead it is of the next (margin: second over best), and whether
//                the score is inside that class's own limit. The limit is found by taking each reference note out and
//                scoring it against the rest of its class; the 95th percentile of those scores, times 1.15, is the limit.
//                A note outside the limit of its nearest class is "none": it resembles no instrument in the book.
//   range        a note is also "none" when its noise or its flux lies outside everything the nearest class's reference
//                notes did, by more than half that feature's spread. This is what rejects a plain sawtooth, which sits
//                close to a saxophone on average and has no breath and no movement
// What the judge is: a measure of likeness on the listed features. What it is not: a listener. A note can match every
// feature here and still not convince a person, because the features leave out much of what hearing uses.
import { FEATURES, analyse } from './timbre.js';

export const WEIGHTS = { h1: 1, h2: 1, h3: 1, h4: 1, h5: 0.8, h6: 0.8, h7: 0.7, h8: 0.7, hi: 1, oddEven: 1, centroid: 1, c1: 1, c2: 1, c3: 1, c4: 0.8, c5: 0.8, c6: 0.8, attack: 1, overshoot: 1, decay: 1, noise: 1, attackNoise: 0.7, tilt: 0.7, inharmonicity: 1, flux: 0.7 };
const W = FEATURES.map((k) => WEIGHTS[k]), WSUM = W.reduce((s, v) => s + v, 0), pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : Infinity; };

export function distance(a, b, scale) { let s = 0; for (let i = 0; i < a.length; i++) { const d = (a[i] - b[i]) / scale[i]; s += W[i] * d * d; } return Math.sqrt(s / WSUM); }

// Score a feature vector at pitch m against every class in the book. skip(ref) leaves reference notes out (a note judging
// itself, or a whole source held back). Returns the classes in order, nearest first.
export function scores(vector, m, book, { k = 3, span = 7, skip = null } = {}) {
  const by = new Map();
  for (const r of book.refs) { if (skip && skip(r)) continue; if (Math.abs(r.m - m) > span) continue; if (!by.has(r.cls)) by.set(r.cls, []); by.get(r.cls).push({ d: distance(vector, r.v, book.scale), ref: r }); }
  const out = []; for (const [cls, list] of by) { list.sort((a, b) => a.d - b.d); const near = list.slice(0, k); out.push({ cls, d: near.reduce((s, q) => s + q.d, 0) / near.length, n: list.length, nearest: near[0].ref.name }); }
  return out.sort((a, b) => a.d - b.d);
}

// The features on which a note lies outside everything the class's reference notes near its pitch ever did, by more than
// `tol` spreads: [{ feature, by }]. A tone with no noise between its harmonics and no movement in them can sit close to
// an instrument on average and still be unlike every real note of it on those two counts.
export function outside(vector, m, book, cls, { span = 7, skip = null, tol = TOL } = {}) {
  const refs = book.refs.filter((r) => r.cls === cls && Math.abs(r.m - m) <= span && !(skip && skip(r))), out = []; if (refs.length < 3) return out;
  FEATURES.forEach((f, i) => { if (!RANGE.includes(f)) return; let lo = Infinity, hi = -Infinity; for (const r of refs) { lo = Math.min(lo, r.v[i]); hi = Math.max(hi, r.v[i]); } const by = Math.max(lo - vector[i], vector[i] - hi) / book.scale[i]; if (by > tol) out.push({ feature: f, by, value: vector[i], lo, hi }); });
  return out.sort((a, b) => b.by - a.by);
}
export const TOL = 0.5, RANGE = ['noise', 'flux'];   // the range test reads the two features a lifeless tone gives itself away on

export function judge(vector, m, book, opts = {}) {
  const ranks = scores(vector, m, book, opts); if (!ranks.length) return { heard: 'none', best: null, ranks, accepted: false, margin: null, reason: 'no reference note within seven semitones of this pitch' };
  const best = ranks[0], limit = (opts.limits || book.limits)[best.cls] ?? Infinity, out = outside(vector, m, book, best.cls, opts), accepted = best.d <= limit && out.length === 0;
  return { heard: accepted ? best.cls : 'none', best: best.cls, d: best.d, limit, accepted, outside: out, margin: ranks[1] ? ranks[1].d / best.d : Infinity, second: ranks[1]?.cls ?? null, ranks,
    reason: accepted ? null : best.d > limit ? `nearest to ${best.cls} at ${best.d.toFixed(2)}, outside its limit of ${limit.toFixed(2)}` : `nearest to ${best.cls}, and unlike every reference note of it in ${out.map((q) => q.feature).join(', ')}` };
}
// The score of one named class, whatever the nearest class is: how far a note is from what it claims to be.
export const scoreAs = (vector, m, book, cls, opts = {}) => scores(vector, m, book, opts).find((q) => q.cls === cls)?.d ?? Infinity;

// Build the book from reference notes [{ cls, source, name, m, vel, v }].
export function build(refs, meta = {}) {
  const n = FEATURES.length, scale = new Array(n).fill(0), mu = new Array(n).fill(0);
  for (const r of refs) for (let i = 0; i < n; i++) mu[i] += r.v[i] / refs.length; for (const r of refs) for (let i = 0; i < n; i++) scale[i] += (r.v[i] - mu[i]) ** 2 / refs.length;
  const book = { ...meta, features: FEATURES, scale: scale.map((v) => Math.sqrt(v) || 1), refs, limits: {} }, own = new Map();
  for (const r of refs) { const d = scoreAs(r.v, r.m, book, r.cls, { skip: (q) => q === r }); if (Number.isFinite(d)) { if (!own.has(r.cls)) own.set(r.cls, []); own.get(r.cls).push(d); } }
  for (const [cls, list] of own) book.limits[cls] = 1.15 * pct(list, 0.95);
  return book;
}

// Take each reference note out and judge it against the rest. by 'note' holds back the one note; by 'source' holds back
// every note from the same recording source, which asks the harder question: does the judge know the instrument, or the
// room and microphone it was recorded with. Returns the confusion table (rows: true class; columns: heard).
export function leaveOut(book, { by = 'note', classes = null } = {}) {
  const table = {}, rows = []; let right = 0, total = 0;
  for (const r of book.refs) { if (classes && !classes.includes(r.cls)) continue;
    if (by === 'source' && !book.refs.some((q) => q.cls === r.cls && q.source !== r.source && Math.abs(q.m - r.m) <= 7)) continue;   // no other source of this class near this pitch: nothing to test
    const v = judge(r.v, r.m, book, { skip: by === 'source' ? (q) => q.source === r.source : (q) => q === r });
    (table[r.cls] ||= {})[v.heard] = (table[r.cls][v.heard] || 0) + 1; total++; if (v.heard === r.cls) right++; rows.push({ name: r.name, cls: r.cls, source: r.source, heard: v.heard, best: v.best, d: v.d, margin: v.margin }); }
  return { table, accuracy: total ? right / total : null, right, total, rows };
}

// Judge rendered audio: one note, with its written pitch when known.
export function identify(x, sr, book, { m = null, ...opts } = {}) { const a = analyse(x, sr, { m }); if (!a) return { heard: 'none', best: null, accepted: false, reason: 'silence, or too short to read' }; return { ...judge(a.vector, a.m, book, opts), values: a.values, m: a.m, vibrato: a.vibrato }; }

export function tableText(t) {
  const rowsK = Object.keys(t).sort(), cols = [...new Set(rowsK.concat(...rowsK.map((k) => Object.keys(t[k]))))].sort(), w = Math.max(...cols.map((c) => c.length), 8) + 1;
  return ['true \\ heard'.padEnd(18) + cols.map((c) => c.padStart(w)).join(''), ...rowsK.map((k) => k.padEnd(18) + cols.map((c) => String(t[k][c] || 0).padStart(w)).join(''))].join('\n');
}
