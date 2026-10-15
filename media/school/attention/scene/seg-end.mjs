// The last four segments: the lamp turned off (two training runs), what the light costs (the
// comparisons grid), what the light does not tell you, and the close (the lens irises shut).
import { rect, circle, polyline, C, span, window, ease, lerp, words, label, smooth01, clamp, darkness, glow, lerpLog } from "./lib.mjs";
import { roomBase, tallowO } from "./seg-room.mjs";
import { tallow, lens, night, glazing, card, cardAt, beam, LENS, TALLOW } from "./room.mjs";

// A loss curve as a polyline in the box (x, y, w, h); pts are [step, loss]; u draws it out.
function curve(pts, box, u, maxStep, lo, hi) {
  const out = [], k = Math.max(2, Math.floor(pts.length * u));
  // Steps on a square-root axis, so the fast early fall and the long tail both show.
  for (let i = 0; i < k; i++) { const [s, l] = pts[i]; out.push(box.x + Math.sqrt(s / maxStep) * box.w, box.y + box.h - ((Math.min(hi, l) - lo) / (hi - lo)) * box.h); }
  return out;
}

// Two lamps; the right one is blown out. Bars for copy accuracy and both training curves.
export function switchOff(t, A, T, F) {
  const items = [{ shape: rect(0, 0, 1920, 1080), fill: [0.015, 0.013, 0.016, 1], screen: true }], off = span(t, T.off, T.off + 0.8);
  const draw = span(t, T.on, T.on + 3.5, ease.inOut), bars = span(t, T.on, T.on + 1.5, ease.out), bars2 = span(t, T.offSay, T.offSay + 1.5, ease.out), bars3 = span(t, T.uniform, T.uniform + 1.5, ease.out);
  const lamps = [[400, 250, 1], [960, 250, 1 - off], [1520, 250, 0.35 * bars3]];
  for (const [x, y, k] of lamps) {
    items.push({ shape: circle(x, y, 120, 64), fill: "#3a2c18", stroke: "#0b0a0c", width: 5 });
    for (let r = 100; r > 10; r -= 18) items.push({ shape: circle(x, y, r, 64), fill: null, stroke: [0.85, 0.8, 0.65, 0.25], width: 4 });
    if (x === 1520 && k > 0) items.push({ shape: circle(x, y, 330, 64), fill: [1, 0.7, 0.4, 0.12 * bars3], blend: "add" });
    if (k > 0) items.push(glow(x, y, 360 * k, [1, 0.62, 0.28], 0.45 * k), { shape: circle(x, y, 26, 32), fill: [1, 0.95, 0.8, k], blend: "add" });
  }
  items.push(label(A, "attention on", 30, 400, 410, C.ink), label(A, "each word sees only itself", 30, 960, 410, C.ink), label(A, "even light, no choosing", 30, 1520, 410, C.ink, "center", bars3));
  // Copy-hole accuracy bars, to the measured values.
  const bar = (x, v, u, hot) => [{ shape: rect(x - 220, 440, 440, 34, 3), fill: null, stroke: [0.6, 0.55, 0.5, 0.6], width: 2 }, { shape: rect(x - 220, 440, 440 * v * u, 34, 3), fill: hot ? [0.89, 0.58, 0.45, 0.9] : [0.75, 0.75, 0.8, 0.8] },
    { shape: words(`${Math.round(v * u * 100)}% of copy holes filled`, A.mono, 26, x, 510, "center"), fill: C.ink }];
  items.push(...bar(400, F.copyOn, bars, true), ...bar(960, F.copyOff, bars2, false));
  if (bars3 > 0) items.push(...bar(1520, F.copyUniform, bars3, false));
  // Training curves: held-out loss against step, both runs, the same axes.
  const all = [...F.lossOn, ...F.lossOff, ...F.lossUniform], maxStep = Math.max(...all.map((p) => p[0])), lo = Math.floor(Math.min(...all.map((p) => p[1])) * 10) / 10, hi = F.unigramLoss + 0.3;
  const box = { x: 360, y: 600, w: 1200, h: 360 };
  items.push({ shape: polyline([box.x, box.y, box.x, box.y + box.h, box.x + box.w, box.y + box.h]), fill: null, stroke: [0.6, 0.55, 0.5, 0.6], width: 2 });
  items.push({ shape: polyline(curve(F.lossOn, box, draw, maxStep, lo, hi)), fill: null, stroke: C.hot, width: 4 });
  items.push({ shape: polyline(curve(F.lossOff, box, draw, maxStep, lo, hi)), fill: null, stroke: "#b7b4c9", width: 4 });
  if (bars3 > 0) items.push({ shape: polyline(curve(F.lossUniform, box, bars3, maxStep, lo, hi)), fill: null, stroke: "#8f8a7c", width: 3, dash: [10, 8] });
  const uy = box.y + box.h - ((F.unigramLoss - lo) / (hi - lo)) * box.h;
  items.push({ shape: polyline([box.x, uy, box.x + box.w, uy]), fill: null, stroke: [0.6, 0.55, 0.5, 0.5], width: 1.5, dash: [6, 8] }, label(A, "knows only word frequencies", 20, box.x + box.w, uy - 10, C.dim, "right", 1, "mono"));
  items.push(label(A, "held-out loss (lower is better)", 22, box.x, box.y - 14, C.dim, "left", 1, "mono"), label(A, `training steps, 0 to ${maxStep} (square-root scale)`, 22, box.x + box.w, box.y + box.h + 34, C.dim, "right", 1, "mono"));
  // Tallow leans in from the left edge and blows the right lamp out.
  items.push(...tallow(tallowO(t, { armR: 140, lean: -20 * window(t, T.off - 0.5, T.off + 0.6, 0.3, 0.4), mouth: window(t, T.off - 0.3, T.off + 0.3, 0.1, 0.1) }), { x: 160, y: 1060, s: 0.5 }));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// The comparisons grid: one dot per pair a head compares; n grows to 1,000 on a log clock.
export function cost(t, A, T) {
  const items = [{ shape: rect(0, 0, 1920, 1080), fill: [0.01, 0.01, 0.012, 1], screen: true }];
  const g = span(t, T.thousand - 2.5, T.thousand + 1.0, ease.inOut), n = Math.round(lerpLog(8, 1000, g)), dbl = span(t, T.double, T.double + 1.6, ease.inOut);
  // Draw at most 64 x 64 dots; past that each dot stands for a block, and the label says so.
  const shown = Math.min(n, 64), cell = 760 / shown, per = Math.ceil(n / shown);
  for (let i = 0; i < shown; i++) for (let j = 0; j <= i; j++) items.push({ shape: rect(380 + j * cell, 160 + i * cell, Math.max(1, cell * 0.7), Math.max(1, cell * 0.7)), fill: [1, 0.85, 0.6, 0.55], blend: "add" });
  const pairs = (n * (n + 1)) / 2;
  items.push(label(A, `${n.toLocaleString("en")} words`, 44, 1500, 300, C.ink), label(A, `${pairs.toLocaleString("en")} comparisons`, 34, 1500, 370, C.hot, "center", 1, "mono"),
    label(A, per > 1 ? `1 dot = ${per * per} pairs` : "1 dot = 1 pair", 22, 1500, 420, C.dim, "center", 1, "mono"), label(A, "per head, per layer", 22, 1500, 452, C.dim, "center", 1, "mono"));
  if (dbl > 0) { const s = 760 * 2 * dbl; items.push({ shape: rect(380, 160, s, s), fill: null, stroke: [0.89, 0.58, 0.45, 0.7 * dbl], width: 3 }); items.push(label(A, "double the words: about 4 times the pairs", 28, 1500, 540, C.ink, "center", dbl)); }
  const door = span(t, T.cannery, T.cannery + 1.2);
  if (door > 0) { items.push({ shape: rect(1420, 640, 160, 280, 6), fill: "#1a130d", stroke: "#3a2c18", width: 5 }, glow(1500, 780, 260, [1, 0.6, 0.25], 0.4 * door)); items.push(label(A, "THE CANNERY", 24, 1500, 960, C.dim, "center", door, "mono")); }
  return { items, camera: { x: 960 + 400 * dbl, y: 540 + 400 * dbl, zoom: 1 / (1 + dbl) } };
}

// Two patterns of light on the same cards, both pointing to the same answer. An illustration.
export function edge(t, A, T, F) {
  const R = roomBase(t, { a: 2.2 }), items = [...R.back], W = F.probe.words, n = W.length, x = span(t, T.diff, T.diff + 1.5) * Math.PI;
  const pa = W.map((_, i) => (i === F.probe.answerFrom ? 0.5 : 0.05)), pb = W.map((_, i) => (i === n - 2 ? 0.45 : i === F.probe.answerFrom ? 0.15 : 0.04));
  const u = 0.5 - 0.5 * Math.cos(x * 2), sh = pa.map((v, i) => lerp(v, pb[i], u));
  W.forEach((w, i) => { const p = cardAt(i, n); if (i < n - 1) items.push(beam(p.x, p.y, sh[i] * 1.6, { from: cardAt(n - 1, n), half: 60 })); items.push(...card(A, w, p, { lit: i < n - 1 ? sh[i] * 1.6 : 0.4, hot: i === n - 1 })); });
  items.push(label(A, `both answer: ${F.probe.answer}`, 30, 1500, 860, C.ink, "center", span(t, T.diff, T.diff + 1)), label(A, "illustration, not measured", 22, 80, 70, C.dim, "left", 1, "mono"));
  const gut = window(t, T.open, T.open + 1.2, 0.2, 0.6);
  items.push(...tallow(tallowO(t, { flame: 0.9 - 0.35 * gut * (0.5 + 0.5 * Math.cos(t * 14)), lid: 0.6, look: [4, -2] })), ...R.light);
  return { items, camera: { x: 960, y: 520, zoom: 1 } };
}

// Close: the card on the ledger, a drip into the jar, the lamp down, the lens irises to a point.
export function close(t, A, T) {
  const iris = 1 - span(t, T.iris, T.iris + 3.0, ease.inOut), lampK = 0.3 + 0.7 * iris;
  const R = roomBase(t, { lamp: lampK, iris: Math.max(0.02, iris), dark: 0.62 + 0.3 * (1 - iris) }), items = [...R.back];
  const drip = window(t, T.drip, T.drip + 1.6, 0.4, 0.5);
  items.push(...tallow(tallowO(t, drip > 0 ? { armL: -8, elbL: -78, propL: "jar", armR: 30, elbR: 110, prop: null, lid: 0.55, mouth: 0.4 } : { armR: 40, elbR: 80, prop: "card" })), ...R.light);
  items.push({ shape: rect(0, 0, 1920, 1080), fill: [0, 0, 0, smooth01(1 - iris) * 0.9], screen: true });
  if (iris < 0.6) items.push(glow(960, 540, 140, [1, 0.9, 0.7], 0.6 * (1 - span(t, T.end - 1.5, T.end))));
  const cam = { x: lerp(960, LENS.x, 1 - iris), y: lerp(540, LENS.y, 1 - iris), zoom: lerp(1, 1.8, 1 - iris) };
  return { items, camera: cam };
}
