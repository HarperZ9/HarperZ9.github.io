// The LoRA film's first segments (lesson S19), in Tallow's lamp room (PROGRESS.md, step 38): the
// second floor's query, key and value table as a hull of 32 x 96 planks, the full fine-tune's change
// swept across it, and the rank-1 strips whose product is a change of its own. Every value drawn is a
// facts.json value (F); timings from the cue map in film.scene.mjs (T).
import { rect, words, span, label, C, darkness } from "../../shared/lib.mjs";
import { host } from "../../embeddings/scene/segs.mjs";
import { night, glazing } from "../../attention/scene/room.mjs";
import { ribbon, lab, plateRect, INK as WI } from "../../nextword/scene/wheel.mjs";
import { grid, strip, outer, add, maxAbs, INK } from "./planks.mjs";

export const HULL = { x: 520, y: 250, cell: 13 };
export const roomL = (t) => [...night(t, { moon: false }), ...glazing()];
export const scene = (t, A, items, cam = { x: 960, y: 540, zoom: 1 }) => ({ items: [...items, darkness(380, 700, 1900, 0.35), ...host(t, A)], camera: cam });
const rows = (flat, K, M) => Array.from({ length: K }, (_, i) => flat.slice(i * M, (i + 1) * M));
// The film's matrix, its full change and the rank-1 change, as rows, with one shared scale.
export function mats(F) {
  const [K, M] = F.film.shape, base = rows(F.film.base, K, M), full = rows(F.film.fullChange, K, M);
  const r1 = outer(F.film.rank1.A, F.film.rank1.B, F.film.rank1.s);
  return { K, M, base, full, r1, sBase: maxAbs(base), sChange: maxAbs(full) * 0.7 };
}
const hullAt = (D, at = HULL) => ({ ...at, w: D.M * at.cell, h: D.K * at.cell });

export function open(t, A, T, F) {
  const lit = span(t, 0.8, 1.6), D = mats(F), sweep = span(t, 1, 3.6);
  const items = [...roomL(t), ...grid(D.base, { at: HULL, cell: HULL.cell, scale: D.sBase, a: 0.3 + 0.7 * lit, upto: (i) => (i / D.K < sweep ? 1 : 0) })];
  return { items: [...items, darkness(400, 600, 300 + 1200 * lit, 0.95 - 0.5 * lit), ...host(t, A, { flame: lit })], camera: { x: 960, y: 540, zoom: 1.05 - 0.05 * span(t, 0, 4) } };
}
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end)), D = mats(F);
  return scene(t, A, [...roomL(t), ...grid(D.base, { at: HULL, cell: HULL.cell, scale: D.sBase, a: 0.45 }),
    label(A, "LoRA", 92, 960, 105, C.ink, "center", a, "head"), label(A, "a small rudder for a big boat", 34, 960, 158, WI.dim, "center", span(t, T.sub, T.sub + 0.6) * a)]);
}

// The new habit as a row of word cards; the answer slot waits, then the base model's score.
export function job(t, A, T, F) {
  // The answer is the word after the second "was": the thing named again, its look kept.
  const ex = F.task.exampleRow.split(" "), stop = ex.indexOf("was", ex.indexOf("was") + 1) + 1, shown = t >= T.yard;
  const list = ex.slice(0, stop + 1).map((w, i) => (i === stop && !shown ? "?" : w));
  const items = [...roomL(t), plateRect(500, 300, 1360, 420, 0.5), ...ribbon(A, list, t, T.start + 0.5, { x: 560, y: 400, w: 1260, rate: 2.5, hot: (i) => i === stop || i === 3, size: 30 })];
  if (t >= T.base) items.push(lab(A, `the trained model gets this answer right ${Math.round(F.base.task.answer * 100)}% of the time`, 28, 660, 660, INK.ember, "left", span(t, T.base, T.base + 0.8)));
  if (t >= T.yard) items.push(lab(A, "the yardstick: the answer word, certain once the thing is named again", 24, 660, 760, WI.dim, "left", span(t, T.yard, T.yard + 0.8)));
  return scene(t, A, items);
}

// Change every number: the full change sweeps across the hull; then the old skill's fall.
export function full(t, A, T, F) {
  const D = mats(F), sweep = span(t, T.start + 1, T.start + 7), items = [...roomL(t)];
  items.push(...grid(D.full, { at: HULL, cell: HULL.cell, scale: D.sChange, upto: (i) => Math.max(0, Math.min(1, sweep * D.K - i)) }));
  items.push(lab(A, `change made by training all ${F.methods.runs.full.trained.toLocaleString("en")} numbers, this table only`, 24, HULL.x, HULL.y - 34, WI.night, "left", 1));
  if (t >= T.learn) items.push(lab(A, `new habit: ${Math.round(F.methods.runs.full.answer.mean * 100)}% right`, 30, HULL.x, 760, INK.ember, "left", span(t, T.learn, T.learn + 0.8)));
  if (t >= T.before) {
    const a = span(t, T.before, T.before + 0.8), b = span(t, T.after, T.after + 1.2), base = F.forgetting.base.copyAccuracy, after = F.methods.runs.full.origCopy.mean, v = base + (after - base) * b;
    items.push({ shape: rect(HULL.x, 820, 900 * v, 34, 3), fill: [0.49, 0.61, 0.77, a], screen: true }, lab(A, `old skill, look-back words right: ${Math.round(v * 100)}%`, 26, HULL.x, 900, WI.night, "left", a));
  }
  return scene(t, A, items);
}

// The rudder: the frozen table faint, strip A down its side and strip B along its top, their product
// as its own table below; the counts; strip B starting at zero.
export function rudder(t, A, T, F) {
  const D = mats(F), c = 9, top = { x: 620, y: 200, cell: c }, prod = { x: 620, y: 560, cell: c }, items = [...roomL(t)];
  const sa = span(t, T.strips, T.strips + 1), sb = span(t, T.strips + 1, T.strips + 2), m = span(t, T.multiply, T.multiply + 3), zero = t >= T.zero && t < T.zero + 6;
  const Bv = zero ? F.film.rank1.B.map(() => 0) : F.film.rank1.B;
  items.push(...grid(D.base, { at: top, cell: c, scale: D.sBase, a: 0.35 }), lab(A, "the frozen table", 22, top.x, top.y - 30, WI.dim, "left", 1));
  if (sa > 0) items.push(...strip(F.film.rank1.A, { at: { x: top.x - 60, y: top.y }, cell: c, scale: Math.max(...F.film.rank1.A.map(Math.abs)), a: sa }), lab(A, "A", 30, top.x - 54, top.y + D.K * c + 40, INK.ember, "left", sa));
  if (sb > 0) items.push(...strip(Bv, { at: { x: prod.x, y: prod.y - 50 }, cell: c, vertical: false, scale: Math.max(...F.film.rank1.B.map(Math.abs)), a: sb }), lab(A, zero ? "B, all zero at the start" : "B", 24, prod.x + D.M * c + 20, prod.y - 34, INK.ember, "left", sb));
  if (m > 0) items.push(...grid(zero ? outer(F.film.rank1.A, Bv, 1) : D.r1, { at: prod, cell: c, scale: D.sChange, upto: (i) => Math.max(0, Math.min(1, m * D.K - i)) }), lab(A, zero ? "their product: no change, bit for bit" : "A times B: a full-sized change of rank 1", 22, prod.x, prod.y + D.K * c + 40, WI.night, "left", m));
  if (t >= T.count) {
    const a = span(t, T.count, T.count + 0.8), [K, M] = F.film.shape;
    items.push(lab(A, `${K} x ${M} = ${(K * M).toLocaleString("en")} numbers`, 24, 1500, 300, WI.night, "left", a), lab(A, `rank 1: ${K} + ${M} = ${K + M}`, 24, 1500, 345, INK.ember, "left", span(t, T.pair, T.pair + 0.8)));
  }
  return scene(t, A, items);
}
export { add };
