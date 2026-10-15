// The attention lab, drawn: Tallow's lamp room with the probe sentence on the glazing, the lens
// throwing the chosen head's live attention onto the cards, all four heads' maps as grids of light,
// and the training curves. A Motion display list from a run snapshot; pure in (snapshot, time).
import { rect, circle, polyline, C, words, pct, clamp, darkness, glow } from "../../media/school/attention/scene/lib.mjs";
import { night, glazing, lens, card, cardAt, beam, tallow, LENS } from "../../media/school/attention/scene/room.mjs";
import { grid } from "../../media/school/attention/scene/data.mjs";

const LAMP = { x: 760, y: 640, r: 150 };
const SMALL = { ...LENS, ...LAMP };

// The probe's words on the glazing; the hole after the reading word shows the model's best guess.
function sentence(A, s, sel, t) {
  const p = s.look.probe, W = p.words, n = W.length + 1, rows = s.look.layers[sel.layer][sel.head], q = p.query, items = [];
  W.forEach((w, i) => {
    const a = i <= q ? rows[q][i] : 0, pos = cardAt(i, n);
    if (i < q || i === q) items.push(beam(pos.x, pos.y, clamp(a * 1.6, 0, 1), { from: SMALL, half: 46 }));
    items.push(...card(A, w, pos, { lit: clamp(a * 1.6, 0, 1), hot: i === q }));
    if (a >= 0.02 && i <= q) items.push({ shape: words(pct(a), A.mono, 24, pos.x, pos.y + 66, "center"), fill: C.ink });
  });
  const g = s.look.top5[0], hp = cardAt(n - 1, n), right = g.word === p.answer;
  items.push(...card(A, g.word, hp, { lit: 0.3 + 0.2 * Math.sin(t * 4), hot: right }));
  items.push({ shape: words(`guess ${pct(g.p)}`, A.mono, 24, hp.x, hp.y + 66, "center"), fill: right ? C.ink : C.dim });
  return items;
}

// All heads' maps, each a T x T grid; the selected one framed in the hot mark.
function maps(A, s, sel) {
  const items = [], L = s.look.layers, T = s.look.probe.words.length, cell = Math.min(16, 260 / T);
  L.forEach((heads, l) => heads.forEach((M, h) => {
    const x = 1150 + h * (cell * T + 70), y = 430 + l * (cell * T + 70), on = l === sel.layer && h === sel.head;
    items.push(...grid(A, M, x, y, cell, { title: `layer ${l + 1} head ${h + 1}`, hi: (i, j) => i === s.look.probe.query && j === s.look.probe.answerFrom }));
    if (on) items.push({ shape: rect(x - 10, y - 10, cell * T + 20, cell * T + 20, 6), fill: null, stroke: C.hot, width: 3 });
  }));
  return items;
}

// Held-out loss and look-back accuracy against step, on the lab's own scale.
function curves(A, s, total) {
  const box = { x: 1150, y: 930, w: 680, h: 90 }, items = [{ shape: rect(box.x - 16, box.y - 44, box.w + 32, box.h + 74, 8), fill: [0, 0, 0, 0.6] }];
  const hi = Math.max(s.unigram + 0.3, ...s.curve.map((c) => c.heldOut)), X = (st) => box.x + Math.sqrt(st / total) * box.w;
  const lossPts = s.curve.flatMap((c) => [X(c.step), box.y + box.h - (c.heldOut / hi) * box.h]);
  const copyPts = s.curve.flatMap((c) => [X(c.step), box.y + box.h - c.copy * box.h]);
  if (lossPts.length >= 4) items.push({ shape: polyline(lossPts), fill: null, stroke: "#b7b4c9", width: 3 }, { shape: polyline(copyPts), fill: null, stroke: C.hot, width: 3 });
  items.push({ shape: words("held-out loss", A.mono, 20, box.x, box.y - 18), fill: "#b7b4c9" }, { shape: words("copy holes filled", A.mono, 20, box.x + box.w, box.y - 18, "right"), fill: C.hot });
  return items;
}

export function frame(s, sel, A, t, { reduced = false, total = 1500 } = {}) {
  const items = [...night(t, { moon: false }), ...glazing(), ...lens(t, { a: reduced ? 0.6 : t * 0.8, at: SMALL })];
  const acc = s.last ? s.last.copy : 0;
  items.push(...tallow({ armR: 140, elbR: 30, prop: null, lid: 0.45, look: [8, -4], flame: 0.35 + 0.65 * acc, lean: 10 * acc }, { x: 330, y: 1020, s: 0.55 }));
  items.push(darkness(LAMP.x - 200, LAMP.y, 1500, 0.55), glow(LAMP.x, LAMP.y, 420, [1, 0.62, 0.28], 0.2 + 0.25 * acc));
  items.push(...sentence(A, s, sel, t), ...maps(A, s, sel), ...curves(A, s, total));
  items.push({ shape: words(`step ${s.step} of ${total}`, A.mono, 26, 80, 64), fill: C.ink, screen: true });
  return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items,
    post: { bloom: 0.2, threshold: 1.0, vignette: 0.12, grain: 0, passes: reduced ? [] : [{ pass: "film", preset: "500t-print", ev: 1.6 }] } };
}
