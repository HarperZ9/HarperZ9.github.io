// live.js: what a listener can change while a piece plays, shared by the live worker (worker.js) and the file render
// (piece.js), so the file is what was heard.
//   tempo     beats a minute. The bars are written in beats, so the same notes are laid out faster or slower.
//   key       semitones up or down from the written key, for every pitched part; the drums and the sea stay.
//   density   1 plays every note as written; less drops notes by a seeded draw, so the same seed thins the same way.
//             The first beat of every bar keeps its drum hit and its chord; the bass keeps the notes on beats one and three.
//   gains     one level per group of parts, 0 to 1.5 (1 is the written mix). The live form plays each group on its own
//             bus so a change is heard at once; the file folds the same levels into the mix.
// GROUPS are the parts a listener can hear apart: the kit, the low end (bass and sub), the keys with the pad, the lead,
// and the space (the room's reverb with the sea, wind and air).
export const GROUPS = ['drums', 'bass', 'keys', 'lead', 'space'];
export const GROUP_NAMES = { drums: 'Drums', bass: 'Bass', keys: 'Keys and pad', lead: 'Lead', space: 'Sea and room' };
export const GROUP_OF = { drums: 'drums', bass: 'bass', sub: 'bass', keys: 'keys', pad: 'keys', lead: 'lead', room: 'space', ambience: 'space' };
export const LIMITS = { bpm: [0.6, 1.5], semis: [-6, 6], density: [0.15, 1], gain: [0, 1.5] };
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

// The settings in force, filled and held to their ranges. bpm is absolute; its range is a share of the written tempo.
export function settle(piece, p = {}) {
  const bpm = Number.isFinite(+p.bpm) && +p.bpm > 0 ? Math.round(clamp(+p.bpm, LIMITS.bpm.map((k) => k * piece.bpm))) : piece.bpm;
  const semis = Number.isFinite(+p.semis) ? Math.round(clamp(+p.semis, LIMITS.semis)) : 0;
  const density = Number.isFinite(+p.density) ? clamp(+p.density, LIMITS.density) : 1;
  const gains = Object.fromEntries(GROUPS.map((g) => [g, Number.isFinite(+p.gains?.[g]) ? clamp(+p.gains[g], LIMITS.gain) : 1]));
  return { bpm, semis, density, gains };
}
export const isPlain = (piece, p) => { const s = settle(piece, p); return s.bpm === piece.bpm && s.semis === 0 && s.density === 1 && GROUPS.every((g) => s.gains[g] === 1); };

// The piece as the renderer should play it: the tempo set, and each stem's level moved by its group's gain.
export function tuned(piece, p = {}) {
  const s = settle(piece, p), dB = (g) => (g <= 0.001 ? -120 : 20 * Math.log10(g));
  const mix = Object.fromEntries(Object.entries(piece.mix).map(([k, v]) => [k, v + (GROUP_OF[k] ? dB(s.gains[GROUP_OF[k]]) : 0)]));
  return { ...piece, bpm: s.bpm, mix };
}
// the renderer's transposition for every pitched stem (render.js reads it as defects.transpose)
export const transposeOf = (semis) => (semis ? { keys: semis, bass: semis, sub: semis, pad: semis, lead: semis } : {});

// A seeded draw in [0, 1) for one note: the same seed, bar and note give the same answer every time.
function draw(seed, bar, k, salt) {
  let h = (2166136261 ^ seed) >>> 0;
  for (const x of [bar, k, salt]) h = Math.imul(h ^ ((x + 0x9e3779b9) >>> 0), 16777619) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  return (h >>> 8) / 16777216;
}
// A bar with fewer notes. At density 1 the bar comes back unchanged (the same object).
export function thin(bar, density = 1, seed = 1) {
  if (!(density < 1)) return bar;
  const keep = (list, salt, always) => list.filter((e, k) => always(e) || draw(seed, bar.index, k, salt) < density);
  const out = { ...bar, drums: keep(bar.drums, 1, (e) => e.beat === 0), keys: keep(bar.keys, 2, (e) => e.beat === 0), bass: keep(bar.bass, 3, (e) => e.beat % 2 === 0) };
  // a lead phrase is kept whole or not at all: under half density it plays with a chance of twice the density
  if (bar.phrase && draw(seed, bar.index, 0, 4) >= Math.min(1, 2 * density)) { out.phrase = null; out.lead = []; }
  return out;
}

// How many notes a bar holds (each piano note, bass note, sub note, drum hit and lead note counted once).
export const notesIn = (bar) => bar.keys.reduce((n, e) => n + e.notes.length, 0) + bar.bass.length + bar.sub.length + bar.drums.length + (bar.phrase ? bar.phrase.length : 0);
