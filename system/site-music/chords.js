// chords.js: chord symbols for the lounge pieces. Each chord type has the pitch classes it implies (for the ear's check of
// what sounds against what was written) and a four-note rootless voicing for the electric piano (the bass plays the root).
// Voice leading moves each note as little as possible from the previous chord, the way a pianist's hand does.
const NAMES = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export const TYPES = {
  maj9: { pcs: [0, 4, 7, 11, 2], voice: [4, 7, 11, 14] }, '6/9': { pcs: [0, 4, 7, 9, 2], voice: [4, 9, 14, 19] }, 'maj9#11': { pcs: [0, 4, 7, 11, 2, 6], voice: [4, 6, 11, 14] },
  m9: { pcs: [0, 3, 7, 10, 2], voice: [3, 7, 10, 14] }, m11: { pcs: [0, 3, 7, 10, 2, 5], voice: [3, 10, 14, 17] }, m7b5: { pcs: [0, 3, 6, 10], voice: [3, 6, 10, 12] },
  '13': { pcs: [0, 4, 7, 10, 2, 9], voice: [4, 10, 14, 21] }, '9': { pcs: [0, 4, 7, 10, 2], voice: [4, 7, 10, 14] }, sus13: { pcs: [0, 5, 7, 10, 2, 9], voice: [5, 10, 14, 21] },
  '7alt': { pcs: [0, 4, 10, 1, 8, 3, 6], voice: [4, 10, 13, 20] },   // altered: both ninths and both fifths moved, so the lead may use any of them
};

export function parse(sym) {
  const m = sym.match(/^([A-G][#b]?)(.*)$/); if (!m || !(m[2] in TYPES)) throw new Error(`unknown chord symbol ${sym}`);
  const root = NAMES[m[1]]; return { sym, root, type: m[2], pcs: TYPES[m[2]].pcs.map((i) => (root + i) % 12) };
}
export const NOTE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const transpose = (sym, semis, type = null) => { const c = parse(sym); return NOTE[(c.root + semis + 120) % 12] + (type || c.type); };

export function voice(sym, prev = null, { lo = 52, hi = 75 } = {}) {
  const c = parse(sym), pcs = TYPES[c.type].voice.map((i) => (c.root + i) % 12), cands = [];
  for (let inv = 0; inv < pcs.length; inv++) for (let base = lo; base <= hi - 7; base++) {
    const order = pcs.slice(inv).concat(pcs.slice(0, inv)), v = []; let n = base - 1;
    for (const pc of order) { n += 1; while (n % 12 !== pc) n++; v.push(n); }
    if (v[0] === base && v[v.length - 1] <= hi) cands.push(v);
  }
  const cost = prev ? (v) => v.reduce((s, x, i) => s + Math.abs(x - prev[i]), 0) : (v) => Math.abs(v[1] - 61) + Math.abs(v[3] - 69);
  return cands.sort((a, b) => cost(a) - cost(b) || a[0] - b[0])[0];
}
// The bass note for a root: the octave from A1 to G#2, where an upright bass sits under an electric piano.
export const bassNote = (pc) => (pc >= 9 ? 24 + pc : 36 + pc);
