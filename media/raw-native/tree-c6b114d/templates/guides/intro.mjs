// The narrated intros: each guide introduces itself in its home world, its mouth driven by the
// narration and its gestures timed to the sentences. Mouth: a curve sampled 60 times a second
// from the rendered narration (intros/GUIDE.mouth.json, made by the characters' mouth.py; the
// "both" variant, letters shaped by loudness, won the A/B in PROGRESS.md step 17). Gestures: one
// pose per sentence, reached on an arc (the joints rotate, so hands and flippers travel on
// arcs) shortly before the words, held while they are spoken, with the idle loop's breath going
// on underneath (a moving hold), and a settle to rest after the last line.
import { clipBeat } from "./motion.mjs";

export const EASES = {
  // Back-out: 8% past the pose, then settle (the arc's follow-through).
  back: (u) => { const c = 1.6; const v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; },
  smooth: (u) => u * u * (3 - 2 * u),
};
export let EASE = "back";
export const setEase = (v) => { EASE = v; };

// One pose per sentence, in order (the scripts are in the characters' narration folder).
export const POSES = {
  tallow: [
    { armR: 25, elbR: 95, prop: null },                                   // I'm Tallow.
    { armL: 35, elbL: 45, armR: 10, elbR: 12 },                           // I work the night desk.
    { armR: 18, elbR: 150, prop: null, look: [2, -6] },                   // My head is a candle...
    { armR: 18, elbR: 150, flame: 0.75, lid: 0.62 },                      // Every claim I check burns...
    { armR: 55, elbR: 40, prop: null, look: [0, 0] },                     // ...I ask you what you think.
    { armR: 22, elbR: 140, prop: "loupe", look: [6, -3] },               // Then we find the source together.
    { armR: 160, elbR: 22, prop: "card", look: [6, -7], lid: 0.3 },      // Some claims hold up in the light.
    { armR: 70, elbR: 45, prop: "blank", lid: 0.55 },                     // Some go blank.
    { armR: 55, elbR: 40, prop: null, lid: 0.5 },                         // Either way, the call is yours.
  ],
  pylon: [
    { tilt: 6 },                                                          // I'm Pylon.
    { flipR: 60, board: true, tilt: 2 },                                  // I inspect claims at the harbour.
    { flipL: 45, tilt: -5, look: [0, -8] },                               // A cone means nobody has checked...
    { flipR: 85, tilt: 4, look: [4, 2] },                                 // I put one on every claim...
    { tilt: 15, lid: 0.55 },                                              // There are more claims than cones.
    { flipR: 55, tilt: 3, look: [3, 1] },                                 // So I check what I can...
    { flipL: 25, tilt: 0, lid: 0.5 },                                     // I won't guess for you.
    { flipR: 55, tilt: 8, look: [2, 2] },                                 // Your call.
  ],
  rerun: [
    { clawL: 40 },                                                        // I'm Rerun.
    { stalk: 1.3, look: [0, -6], flare: 1 },                              // My shell is glass...
    { clawR: 25 },                                                        // That is the point.
    { clawL: 25, clawR: 20, stalk: 1.1 },                                 // A claim should carry...
    { clawR: 75, look: [5, -2] },                                         // I knock on a claim...
    { stalk: 0.85, look: [0, 4], clawR: 5 },                              // Sometimes my guess is wrong.
    { clawR: 50, look: [6, 4], tally: 5 },                                // I keep count of those...
  ],
};
const LEAD = 0.18, MOVE = 0.42, SETTLE = 0.7;

function blend(a, b, u) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const f = a[k] ?? v;
    out[k] = typeof v === "number" && typeof f === "number" ? f + (v - f) * u : Array.isArray(v) && Array.isArray(f) ? v.map((x, i) => f[i] + (x - f[i]) * u) : u >= 0.5 ? v : f;
  }
  return out;
}

// The guide's pose options at time t of its intro, given its mouth file M.
export function introPose(guide, beat, t, M) {
  const idle = clipBeat(guide, "idle", beat, t % 2.4).o, rest = beat.o || {}, poses = POSES[guide], ease = EASES[EASE];
  const keys = M.sentences.map((s, i) => ({ t: s.start - LEAD, pose: poses[Math.min(s.pose ?? i, poses.length - 1)] }));
  keys.push({ t: M.sentences[M.sentences.length - 1].end + 0.3, pose: {}, settle: true });
  let cur = {}, from = {};
  for (const k of keys) {
    if (t < k.t) break;
    from = cur;
    const dur = k.settle ? SETTLE : MOVE, u = Math.min(1, (t - k.t) / dur);
    const target = k.settle ? {} : k.pose;
    cur = blend({ ...from }, target, k.settle ? EASES.smooth(u) : ease(u));
    if (k.settle) for (const key of Object.keys(from)) if (!(key in target)) { const r = rest[key] ?? idle[key]; if (typeof r === "number" && typeof from[key] === "number") cur[key] = from[key] + (r - from[key]) * EASES.smooth(u); else if (u >= 0.5) cur[key] = r; }
  }
  const v = sample(M, t), mouth = guide === "pylon" ? { bark: 0.85 * v } : { mouth: v };
  return { ...idle, ...rest, ...cur, ...mouth, lid: blinks(t, cur.lid ?? rest.lid ?? 0.5) };
}

const sample = (M, t) => { const c = M.variants[M.variant || "both"], i = t * M.fps, a = Math.floor(i); return a < 0 || a >= c.length - 1 ? 0 : c[a] + (c[a + 1] - c[a]) * (i - a); };
// Blinks at fixed, unevenly spaced times.
const BLINKS = [1.1, 4.3, 6.9, 10.2, 13.6, 15.9, 19.4, 22.8];
function blinks(t, base) {
  for (const b of BLINKS) { const u = (t - b) / 0.16; if (u >= 0 && u <= 1) return base + (1 - base) * (1 - Math.abs(2 * u - 1)); }
  return base;
}

// Which sentences cut to the close (Pylon's painted close, Rerun's pixel bust); the rest play in
// the medium frame so the gestures show. A cut lands in the middle of the pause before a line,
// never inside a word (PROGRESS.md, step 19). Tallow's intro stays close throughout: his
// gestures already fit his close frame.
export const CLOSE_LINES = { tallow: null, pylon: [0, 6, 7], rerun: [0, 5, 6] };
export function introFrame(guide, t, M) {
  const lines = CLOSE_LINES[guide];
  if (!lines) return "close";
  const S = M.sentences;
  let k = 0;
  for (let i = 1; i < S.length; i++) if (t >= (S[i - 1].end + S[i].start) / 2) k = i;
  return lines.includes(k) ? "close" : "medium";
}

// A label for the A/B clips: the sentence's label (whose voice it is) while it plays.
export function introLabel(t, M) {
  const s = M.sentences.find((x, i) => t >= x.start - 0.4 && t < (M.sentences[i + 1] ? M.sentences[i + 1].start - 0.4 : 1e9));
  return s && s.label ? s.label : null;
}
