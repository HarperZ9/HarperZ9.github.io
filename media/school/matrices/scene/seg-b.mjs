// The second half of the matrices film: two cranes in either order (the held question), the corner
// no matrix moves and the bias that does move it, the attention film's question rebuilt from the
// trained query and key matrices (facts.json finale), stacked matrices and the GELU bend, goodnight.
import { rect, circle, polyline, span, ease, lerp, window, words, label, C } from "../../shared/lib.mjs";
import { K, P, desk, paper, arrow, pylon, cone, talking } from "../../vectors/scene/chart.mjs";
import { dotProduct } from "../../attention/scene/data.mjs";
import { I2, apply, mul, mix, rot, sheet, steps, block, pin, gelu, onPlate, f2 } from "./sheet.mjs";
import { base } from "./seg-a.mjs";

const TURN = [[0, -1], [1, 0]], STRETCH = [[2, 0], [0, 1]];
const dark = (items) => [{ shape: rect(0, 0, 1920, 1080), screen: true, fill: [0.01, 0.01, 0.014, 1] }, ...items];

// A small chart for the order game: origin o (screen), u pixels per step.
function mini(A, o, u, title, a = 1) {
  const Q = ([x, y]) => [o[0] + x * u, o[1] - y * u], out = [{ shape: rect(o[0] - 2.6 * u, o[1] - 2.6 * u, 5.2 * u, 3.6 * u, 8), fill: [0.95, 0.91, 0.8, 0.95 * a], stroke: K.ink, width: 2 }];
  for (let k = -2; k <= 2; k++) out.push({ shape: polyline([...Q([k, -0.8]), ...Q([k, 2.5])]), fill: null, stroke: [0.35, 0.3, 0.22, 0.3 * a], width: 1.5 }, { shape: polyline([...Q([-2.5, k]), ...Q([2.5, k])]), fill: null, stroke: [0.35, 0.3, 0.22, 0.3 * a], width: 1.5 });
  out.push({ shape: words(title, A.sans, 32, o[0], o[1] - 2.85 * u, "center"), fill: K.night, opacity: a });
  return { Q, out };
}
export function order(t, A, T, F) {
  const B = base(t, A, { dim: 0.6 }), items = [...desk(t, 0.6)];
  const games = [[[560, 640], [STRETCH, TURN], "stretch, then turn", T.st], [[1300, 640], [TURN, STRETCH], "turn, then stretch", T.ts]];
  for (const [o, [M1, M2], title, t0] of games) {
    const g = mini(A, o, 110, title), u1 = span(t, t0, t0 + 1.4, ease.inOut), u2 = span(t, t0 + 1.8, t0 + 3.2, ease.inOut);
    const p = apply(mix(I2, M2, u2), apply(mix(I2, M1, u1), [1, 0]));
    items.push(...g.out, ...arrow(g.Q([0, 0]), g.Q(p), K.ink, 7));
    if (u2 >= 1) items.push(label(A, `east step lands at (${f2(p[0])}, ${f2(p[1])})`, 30, o[0], o[1] + 160, K.ember, "center", 1, "mono"));
  }
  const pr = span(t, T.prod, T.prod + 0.8);
  if (pr > 0) { items.push(...block(A, F.order.AB, 465, 830, { a: pr, size: 30, name: "turn x stretch (stretch first)" }), ...block(A, F.order.BA, 1205, 830, { a: pr, size: 30, name: "stretch x turn (turn first)" })); }
  items.push(...B.guide);
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// The corner: matrices flicker over the sheet and the corner stays put; then a bias slides it.
export function corner(t, A, T) {
  const B = base(t, A), items = [...B.back];
  let M = I2;
  if (t >= T.no && t < T.slide) { const u = (t - T.no) / 1.1, k = Math.floor(u), f = ease.inOut(Math.min(1, (u - k) * 1.5)), m = (i) => (i === 0 ? I2 : mix(rot(0.7 * Math.sin(i * 2.1)), [[1 + 0.5 * Math.sin(i), 0.6 * Math.cos(i * 1.7)], [0.4 * Math.sin(i * 0.9), 1 + 0.3 * Math.cos(i)]], 0.5)); M = mix(m(k), m(k + 1), f); }
  const bias = t >= T.slide ? [lerp(0, 1, span(t, T.slide + 0.6, T.slide + 2.4, ease.inOut)), lerp(0, 0.5, span(t, T.slide + 0.6, T.slide + 2.4, ease.inOut))] : [0, 0];
  items.push(...sheet(M, { b: bias }), ...steps(M, { b: bias }), ...pin(1, t >= T.no && t < T.slide ? 1 : 0));
  if (t >= T.no && t < T.slide) items.push(...onPlate(A, "a matrix times (0, 0) = (0, 0)", 34, 1000, 150, K.ember, span(t, T.no, T.no + 0.6)));
  if (t >= T.slide) items.push(...block(A, I2, 380, 60, { a: 1, name: "the move" }), ...onPlate(A, `then + (${f2(bias[0])}, ${f2(bias[1])})`, 40, 900, 140, K.ember, span(t, T.slide, T.slide + 0.5)));
  if (t >= T.many) items.push(...onPlate(A, "a matrix, then a bias: every layer of the attention lesson's model", 30, 960, 1030, K.night, span(t, T.many, T.many + 0.6), "sans"));
  items.push(...B.guide);
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// The question: 'the' (32 numbers after layer norm) times the query matrix (32 x 16) plus bias is
// q (16 numbers); kettle's list through the key matrix is k; q . k / 4 is the attention score.
function col(v, x, y0, dy, max, hot, a = 1, n = v.length) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ shape: circle(x, y0 + i * dy, (1.5 + 6 * Math.min(1, Math.abs(v[i]) / max)) * a, 10), fill: hot ? [0.89, 0.58, 0.45, 0.95 * a] : v[i] >= 0 ? [0.93, 0.9, 0.84, 0.9 * a] : [0.6, 0.7, 0.85, 0.9 * a], blend: "add" });
  return out;
}
function grid(W, x0, y0, cell, max, a, scan = -1) {
  const out = [];
  for (let r = 0; r < W.length; r++) for (let c = 0; c < W[0].length; c++) {
    const v = W[r][c], s = Math.min(1, Math.abs(v) / max);
    out.push({ shape: rect(x0 + c * cell + 1, y0 + r * cell + 1, cell - 2, cell - 2), fill: v >= 0 ? [0.93, 0.9, 0.84, (0.14 + 0.86 * Math.sqrt(s)) * a * (scan >= 0 && c !== scan ? 0.5 : 1)] : [0.6, 0.7, 0.85, (0.14 + 0.86 * Math.sqrt(s)) * a * (scan >= 0 && c !== scan ? 0.5 : 1)] });
  }
  return out;
}
export function question(t, A, T, F) {
  const Q = F.finale, items = [], key = t >= T.kettle, x = key ? Q.xKey : Q.xQuery, W = key ? Q.Wk : Q.Wq, word = key ? Q.answerWord : Q.readingWord;
  const s0 = span(t, T.back, T.back + 0.8), xs = span(t, T.layer, T.layer + 1), gs = span(t, T.meets, T.meets + 1.2), out = span(t, key ? T.kettle + 1.5 : T.out, (key ? T.kettle + 1.5 : T.out) + 3.2);
  Q.probe.forEach((w, i) => items.push(label(A, w, 34, 420 + i * 108, 90, w === Q.readingWord ? K.ember : w === Q.answerWord && key ? K.night : C.dim, "center", s0)));
  if (t < T.mult) {
    items.push(...col(x, 420, 200, 21, Q.xMax, !key, xs), label(A, `'${word}': ${Q.dModel} numbers`, 26, 420, 905, K.nightDim, "center", xs, "mono"));
    items.push(...grid(W, 600, 196, 21, Q.wMax, gs, out > 0 && out < 1 ? Math.floor(out * Q.dHead) : -1), label(A, `${key ? "key" : "query"} matrix: ${Q.dModel} x ${Q.dHead}, plus a bias`, 26, 768, 955, K.nightDim, "center", gs, "mono"));
    const v = key ? Q.k : Q.q, n = Math.min(Q.dHead, Math.floor(out * Q.dHead + (out > 0 ? 1 : 0)));
    if (n > 0) items.push(...col(v, 1180, 200, 42, Math.max(...v.map(Math.abs)), !key, 1, n), label(A, key ? "k: 16 numbers" : "q: 16 numbers", 26, 1180, 905, K.nightDim, "center", 1, "mono"));
    if (key) items.push(...col(Q.q, 1400, 200, 42, Math.max(...Q.q.map(Math.abs)), true), label(A, "q", 26, 1400, 905, K.ember, "center", 1, "mono"));
  } else {
    const prod = span(t, T.mult, T.mult + 5, ease.linear), d = dotProduct(A, Q.q, Q.k, 960, 200, prod, { scale: 1 / Math.max(...Q.q.map(Math.abs), ...Q.k.map(Math.abs)), gap: 38 });
    items.push(...d.items, label(A, "q", 30, 880, 170, K.ember, "center"), label(A, "k", 30, 1040, 170, K.night, "center"));
    items.push(label(A, `q . k = ${f2(prod >= 1 ? Q.qkRaw : d.running)}`, 40, 960, 900, K.night, "center", 1, "mono"));
    if (t >= T.div) items.push(label(A, `/ ${Q.sqrtDHead} = ${f2(Q.scaled)}`, 40, 960, 955, K.ember, "center", span(t, T.div, T.div + 0.6), "mono"));
    if (t >= T.same) items.push(label(A, "the score in the attention film, rebuilt from the trained weights", 26, 960, 1010, C.dim, "center", span(t, T.same, T.same + 0.6), "mono"));
  }
  return { items: dark(items), camera: { x: 960, y: 540, zoom: 1 }, dark: true };
}

// Stacked matrices are one matrix; GELU bends the grid.
export function edge(t, A, T) {
  const B = base(t, A), items = [...B.back], Ms = [rot(0.3), [[1.3, 0], [0, 0.8]], [[1, 0.4], [0, 1]]];
  const bend = span(t, T.bends + 1, T.bends + 3.5, ease.inOut);
  if (bend <= 0) {
    let M = I2;
    Ms.forEach((m, i) => { M = mul(mix(I2, m, span(t, T.lines + i * 1.4, T.lines + i * 1.4 + 1.2, ease.inOut)), M); });
    items.push(...sheet(M), ...steps(M), ...pin());
    if (t >= T.ten) items.push(...block(A, M, 380, 60, { a: span(t, T.ten, T.ten + 0.6), name: "three moves, one matrix: their product" }));
  } else {
    // A grid turned 30 degrees, so its lines cross both axes; GELU acts on each coordinate, so
    // lines along an axis would stay straight and only the turned ones show the bend.
    const R = rot(0.52), go = (p, u = bend) => { const [x, y] = apply(R, p); return [960 + 125 * lerp(x, gelu(x), u), 560 - 125 * lerp(y, gelu(y), u)]; };
    items.push({ shape: rect(340, 118, 1240, 864, 6), fill: [0.93, 0.89, 0.78, 0.95] });
    for (let k = -3; k <= 3; k++) {
      const v0 = [], h0 = [];
      for (let s = -3; s <= 3.001; s += 0.25) { v0.push(...go([k, s], 0)); h0.push(...go([s, k], 0)); }
      items.push({ shape: polyline(v0), fill: null, stroke: [0.2, 0.3, 0.5, 0.15], width: 1.5 }, { shape: polyline(h0), fill: null, stroke: [0.2, 0.3, 0.5, 0.15], width: 1.5 });
    }
    for (let k = -3; k <= 3; k++) {
      const v = [], h = [];
      for (let s = -3; s <= 3.001; s += 0.1) { v.push(...go([k, s])); h.push(...go([s, k])); }
      items.push({ shape: polyline(v), fill: null, stroke: [0.2, 0.3, 0.5, 0.6], width: 2 }, { shape: polyline(h), fill: null, stroke: [0.2, 0.3, 0.5, 0.6], width: 2 });
    }
    items.push({ shape: circle(...go([0, 0]), 8, 16), fill: K.ink });
    items.push(...onPlate(A, "GELU on every number: straight lines bend", 32, 960, 80, K.ember, bend));
    if (t >= T.soft) items.push(...onPlate(A, "softmax and layer normalisation bend too", 28, 960, 1040, K.night, span(t, T.soft, T.soft + 0.6)));
  }
  items.push(...B.guide);
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// Goodnight: Pylon's cone on the corner, the one place no crane can move; a hill at the paper's edge.
export function close(t, A, T) {
  const B = base(t, A), items = [...B.back, ...sheet(I2), ...pin()], c = span(t, T.start + 0.8, T.start + 2, ease.out), hill = span(t, T.next, T.next + 1.5), dim = span(t, T.night, T.end, ease.inOut);
  const [ox, oy] = P([0, 0]);
  if (c > 0) items.push(...cone(ox, lerp(oy - 400, oy + 6, c), 0.32));
  if (hill > 0) { const pts = []; for (let x = 1100; x <= 1590; x += 10) pts.push(x, 980 - 160 * hill * Math.exp(-(((x - 1380) / 140) ** 2))); items.push({ shape: polyline([...pts, 1590, 980, 1100, 980], true), fill: [0.12, 0.1, 0.07, 0.8] }); }
  items.push(...pylon(t, 1745, 1015, 0.52, { talk: talking(A.rows, t), hat: c <= 0 }), { shape: rect(0, 0, 1920, 1080), screen: true, fill: [0, 0, 0, 0.92 * dim] });
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}
