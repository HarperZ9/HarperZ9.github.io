// The LoRA film's later segments (lesson S19): how many strips (answer right by method, bars wait
// for the held question), the shape of the full change (its singular values against a random
// change's), what was lost (the old skill by method), and the close. Every value drawn is a
// facts.json value (F).
import { rect, circle, span } from "../../shared/lib.mjs";
import { lab, plateRect, INK as WI } from "../../nextword/scene/wheel.mjs";
import { grid, INK } from "./planks.mjs";
import { roomL, scene, mats, HULL } from "./segs.mjs";

const R = (F, k) => F.methods.runs[k];
// Horizontal bars of shares (0 to 1): label, bar to the mean, a dot per seed, the value.
function bars(A, rows, { y0 = 230, step = 62, x0 = 1060, w = 700, a = 1 } = {}) {
  const out = [plateRect(520, y0 - 80, 1360, 110 + rows.length * step, 0.6 * a)];
  rows.forEach((r, i) => {
    const y = y0 + i * step, b = r.show ?? 1;
    out.push(lab(A, r.name, 22, 560, y + 22, r.hot ? INK.ember : WI.night, "left", a));
    if (b <= 0) return;
    out.push({ shape: rect(x0, y, Math.max(3, w * r.mean * b), 28, 3), fill: r.col || (r.hot ? [0.89, 0.58, 0.45, a] : [0.89, 0.84, 0.71, 0.85 * a]), screen: true });
    for (const v of r.values || []) out.push({ shape: circle(x0 + w * v, y + 14, 5, 10), fill: [0.1, 0.08, 0.06, a * b], screen: true });
    out.push(lab(A, `${Math.round(r.mean * 100)}%`, 22, x0 + w * r.mean * b + 16, y + 22, WI.night, "left", a * b));
  });
  return out;
}
const row = (F, k, name, key = "answer", extra = {}) => ({ name, mean: R(F, k)[key].mean, values: R(F, k)[key].values, ...extra });

export function howmany(t, A, T, F) {
  const go = T.ask.held, at = (i) => span(t, go + i * 0.4, go + i * 0.4 + 0.8), al = (i) => span(t, T.all + i * 0.4, T.all + i * 0.4 + 0.8);
  const rows = [row(F, "lora.attn.r1", "attention strips, rank 1", "answer", { hot: true, show: at(0) }), row(F, "lora.attn.r2", "attention, rank 2", "answer", { show: at(1) }), row(F, "lora.attn.r4", "attention, rank 4", "answer", { show: at(2) }), row(F, "lora.attn.r8", "attention, rank 8", "answer", { show: at(3) }),
    row(F, "lora.all.r1", "attention, feed-forward, readout, rank 1", "answer", { show: al(0) }), row(F, "lora.all.r2", "attention, feed-forward, readout, rank 2", "answer", { show: al(1) }), row(F, "lora.all.r4", "attention, feed-forward, readout, rank 4", "answer", { show: al(2) }), row(F, "lora.all.r8", "attention, feed-forward, readout, rank 8", "answer", { show: al(3) }),
    row(F, "full", "every number", "answer", { show: al(4) })];
  const items = [...roomL(t), lab(A, `answer word right, 3 seeds each (dots); before training ${Math.round(F.base.task.answer * 100)}%`, 22, 560, 180, WI.dim, "left", 1), ...bars(A, rows)];
  if (t >= T.odd && t < T.seeds) items.push(plateRect(520, 840, 1360, 90, 0.7), lab(A, `naming the thing again: ${Math.round(R(F, "lora.attn.r1").repeatThing.mean * 100)}% at rank 1; carrying its look: ${Math.round(R(F, "lora.attn.r1").answer.mean * 100)}%`, 24, 560, 896, INK.ember, "left", span(t, T.odd, T.odd + 0.8)));
  return scene(t, A, items);
}

// The shape of the full change: its 32 directions' shares of the change, against a random change's top share.
export function shape(t, A, T, F) {
  const sv = F.film.singular, e = sv.map((v) => v * v), tot = e.reduce((a, b) => a + b, 0), items = [...roomL(t), plateRect(520, 160, 1360, 720, 0.6)];
  const X = (i) => 600 + i * 36, base = 760, H = 1400, grow = span(t, T.start + 2, T.start + 6), rnd = F.rank.randomBaseline["32x96"].top["1"];
  e.forEach((v, i) => { const h = (v / tot) * H * grow; items.push({ shape: rect(X(i), base - h, 26, Math.max(1, h), 2), fill: i === 0 ? [0.89, 0.58, 0.45, 1] : [0.89, 0.84, 0.71, 0.85], screen: true }); });
  items.push(lab(A, "the full fine-tune's change to the query, key and value table: each direction's share", 22, 560, 210, WI.dim, "left", 1));
  if (t >= T.top) items.push(lab(A, `top direction: ${Math.round((e[0] / tot) * 100)}% of the change`, 24, X(1) + 40, base - (e[0] / tot) * H + 30, INK.ember, "left", span(t, T.top, T.top + 0.8)));
  if (t >= T.random) { const a = span(t, T.random, T.random + 0.8); items.push({ shape: rect(X(0) - 8, base - rnd * H, X(31) - X(0) + 40, 3), fill: [0.49, 0.61, 0.77, a], screen: true }, lab(A, `a random change's top direction: ${Math.round(rnd * 100)}%`, 22, X(14), base - rnd * H - 14, INK.slate, "left", a)); }
  if (t >= T.cut) {
    const a = span(t, T.cut, T.cut + 0.8);
    F.rank.truncated.forEach((r, i) => items.push(lab(A, `cut to rank ${r.rank}: ${Math.round(r.answer.mean * 100)}% right`, 22, 600 + i * 300, 830, i === 3 ? INK.ember : WI.night, "left", a)));
  }
  return scene(t, A, items);
}

export function forget(t, A, T, F) {
  const show = (i) => span(t, T.rows + i * 0.5, T.rows + i * 0.5 + 0.8), slate = [0.49, 0.61, 0.77, 1];
  const rows = [{ name: "before any fine-tuning", mean: F.forgetting.base.copyAccuracy, col: slate, show: show(0) }, row(F, "lora.attn.r1", "attention strips, rank 1", "origCopy", { col: slate, show: show(1) }), row(F, "lora.attn.r8", "attention strips, rank 8", "origCopy", { col: slate, show: show(2) }),
    row(F, "lora.all.r8", "attention, feed-forward, readout, rank 8", "origCopy", { col: slate, show: show(3) }), row(F, "full", "every number", "origCopy", { col: slate, show: show(4) })];
  return scene(t, A, [...roomL(t), lab(A, "the old skill: look-back words right on the original held-out rows", 22, 560, 180, WI.dim, "left", 1), ...bars(A, rows)]);
}

export function close(t, A, T, F) {
  const D = mats(F), dim = span(t, T.night, T.end), items = [...roomL(t), ...grid(D.base, { at: HULL, cell: HULL.cell, scale: D.sBase, a: 0.5 * (1 - dim) + 0.2 })];
  for (let k = 0; k < 4; k++) { const x = 560 + k * 60; items.push({ shape: rect(x, 760, 10, 120, 2), fill: [0.89, 0.58, 0.45, 0.8 * (1 - dim)], screen: true }, { shape: rect(x + 16, 760, 10, 120, 2), fill: [0.49, 0.61, 0.77, 0.8 * (1 - dim)], screen: true }); }
  return scene(t, A, items);
}
