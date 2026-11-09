// The embeddings film, in Tallow's lamp room (PROGRESS.md, step 20): each word is a card hanging in
// the dark at its place on the final table's two principal axes (facts.json trackOnFinalAxes, one
// per training snapshot), so the cards drift exactly as the skip-gram's table moved. Numbers on
// screen are facts.json values (embeddings, and the vectors lesson's facts for the attention model).
import { rect, circle, polyline, words, span, ease, lerp, window, label, C, clipBeat, darkness, glow } from "../../shared/lib.mjs";
import { night, glazing, lens, tallow, TALLOW, LENS } from "../../attention/scene/room.mjs";
import { talking, cone } from "../../vectors/scene/chart.mjs";

const INK = { night: "#ece5d6", dim: "#958e80", ember: "#e29472" };
const X = (x) => 1040 + x * 300, Y = (y) => 520 - y * 200;
const lab = (A, s, size, x, y, fill = INK.night, anchor = "left", a = 1) => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a, screen: true });
// Tallow: his talk clip while the voice speaks, idle otherwise.
export function host(t, A, extra = {}) {
  const o = clipBeat("tallow", talking(A.rows, t) ? "talk" : "idle", { ...TALLOW, o: { armR: 30, elbR: 40, prop: null, lid: 0.45, look: [6, -2] } }, t % 2.4).o;
  return tallow({ ...o, flame: 0.92 + 0.08 * Math.sin(t * 11), ...extra });
}
// The lens stands off to the right, small, so the cards have the middle of the glass to themselves.
export const LAMP = { x: 1730, y: 790, r: 120 };
export const room = (t, lamp = 0.45, { lensOn = true } = {}) => [...night(t), ...glazing(), ...(lensOn ? lens(t, { a: t * 0.6, lamp, at: LAMP }) : [])];
// Card positions at snapshot position u (0 .. snapshots - 1, fractional).
// Early tables are tiny (the random start is about 0.015 per number), so their places all sit at
// the middle; the chart is then magnified to the final table's spread, and the scene says by how much.
const rms = (pts) => Math.sqrt(pts.reduce((a, [x, y]) => a + x * x + y * y, 0) / pts.length);
export function placeAt(F, u) {
  const S = F.training.snapshots, i = Math.max(0, Math.min(S.length - 2, Math.floor(u))), f = Math.max(0, Math.min(1, u - i));
  const raw = S[i].trackOnFinalAxes.map((p, k) => { const q = S[i + 1].trackOnFinalAxes[k]; return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]; });
  const zoom = Math.max(1, Math.min(60, rms(S.at(-1).trackOnFinalAxes) / Math.max(1e-9, rms(raw))));
  // Kept clear of Tallow, the lens and the captions; a card pressed to the edge is still in order.
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const P = raw.map(([x, y]) => [clamp(X(x * zoom), 600, 1560), clamp(Y(y * zoom), 200, 930)]);
  P.zoom = zoom;
  return P;
}
const zoomNote = (A, P) => (P.zoom > 1.5 ? [lab(A, `drawn ${Math.round(P.zoom)} times larger: the numbers are still tiny`, 22, 1040, 1040, INK.dim, "center", 1)] : []);
// The hanging cards; hot(k) marks a card in ember, dim(k) fades one.
export function cards(A, F, P, t, { hot = () => false, dim = () => 1, a = 1 } = {}) {
  const out = [];
  F.words.forEach((w, k) => {
    const [x, y] = P[k], sw = 0.85 + 0.15 * Math.cos(t * 0.7 + k), lit = Math.max(0.25, 1 - Math.hypot(x - LENS.x, y - LENS.y) / 1300) * dim(k) * a, h = hot(k), hw = 42 * sw;
    out.push({ shape: polyline([x, 0, x, y - 22]), fill: null, stroke: [0.4, 0.35, 0.3, 0.35 * a], width: 1 },
      { shape: rect(x - hw, y - 20, 2 * hw, 38, 3), fill: h ? [0.89, 0.58, 0.45, lit] : [0.85 * lit + 0.08, 0.8 * lit + 0.08, 0.68 * lit + 0.07, a], stroke: "#2a2219", width: 1.5 },
      { shape: words(w, A.sans, 21, x, y + 6, "center"), fill: "#1d1812", opacity: a });
  });
  return out;
}
const scene = (t, A, items, extra = {}) => ({ items: [...items, darkness(LENS.x - 300, LENS.y, 1700, 0.4), ...host(t, A, extra)], camera: { x: 960, y: 540, zoom: 1 } });

export function open(t, A, T, F) {
  const lit = span(t, 0.8, 1.6), items = [...room(t, span(t, 1.8, 3.4)), ...cards(A, F, placeAt(F, 0), t, { a: 0.4 + 0.6 * lit })];
  return { items: [...items, darkness(400, 600, 300 + 1200 * lit, 0.95 - 0.5 * lit), ...host(t, A, { flame: lit })], camera: { x: 960, y: 540, zoom: 1.05 - 0.05 * span(t, 0, 4) } };
}
export function title(t, A, T, F) {
  const a = window(t, T.say, T.end, 0.6, 0.8);
  return scene(t, A, [...room(t), ...cards(A, F, placeAt(F, 0), t, { a: 0.5 }), label(A, "Embeddings", 100, 960, 160, C.ink, "center", a, "head"), label(A, "every word gets coordinates", 36, 960, 215, INK.dim, "center", span(t, T.sub, T.sub + 0.6) * a)]);
}

// Before learning: the share of same-kind neighbours, and the shuffle's band.
export function start(t, A, T, F) {
  const s0 = F.training.snapshots[0].share, P0 = placeAt(F, 0), items = [...room(t), ...cards(A, F, P0, t), ...zoomNote(A, P0)];
  if (t >= T.check) items.push(lab(A, `same-kind neighbours: ${Math.round(s0.top1 * 100)}%   (shuffled: ${Math.round(s0.control.top1.lo95 * 100)}% to ${Math.round(s0.control.top1.hi95 * 100)}%)`, 26, 640, 80, INK.night, "left", span(t, T.check, T.check + 0.6)));
  items.push(lab(A, `${F.settings.D} random numbers per word; the cards hang where they fall`, 22, 640, 1000, INK.dim, "left", span(t, T.start, T.start + 1)));
  return scene(t, A, items);
}

// The game: a sentence, its middle word, its neighbours pulled close, five noise words pushed off.
export function idea(t, A, T, F) {
  const P = placeAt(F, 0), W = F.words, zn = zoomNote(A, P), sent = ["tallow", "found", "a", "bell", "."], mid = 1, idx = (w) => W.indexOf(w), items = [...room(t)];
  const pull = span(t, T.nudge, T.nudge + 3), push = span(t, T.noise, T.noise + 3), noise = [7, 19, 30, 38, 43].map((k) => k % W.length);
  items.push(...cards(A, F, P, t, { hot: (k) => k === idx(sent[mid]), dim: (k) => (sent.includes(W[k]) || noise.includes(k) ? 1 : 0.5) }));
  sent.forEach((w, i) => items.push({ shape: rect(640 + i * 150, 60, 130, 50, 6), fill: i === mid ? [0.89, 0.58, 0.45, 0.9] : [0.93, 0.9, 0.84, Math.abs(i - mid) <= 2 ? 0.85 : 0.3], screen: true }, lab(A, w, 26, 705 + i * 150, 94, "#1d1812", "center", 1)));
  const m = P[idx(sent[mid])];
  if (pull > 0) sent.forEach((w, i) => { if (i === mid) return; const q = P[idx(w)]; items.push({ shape: polyline([...m, lerp(m[0], q[0], 1 - 0.25 * pull), lerp(m[1], q[1], 1 - 0.25 * pull)]), fill: null, stroke: [0.93, 0.9, 0.84, 0.7 * pull], width: 3 }); });
  if (push > 0) noise.forEach((k) => { const q = P[k]; items.push({ shape: polyline([...q, q[0] + (q[0] - m[0]) * 0.2 * push, q[1] + (q[1] - m[1]) * 0.2 * push]), fill: null, stroke: [0.89, 0.45, 0.32, 0.8 * push], width: 3 }); });
  if (t >= T.two) items.push(lab(A, "two lists per word: one as the middle word, one as a neighbour", 24, 640, 150, INK.dim, "left", span(t, T.two, T.two + 0.6)));
  if (t >= T.noise) items.push(lab(A, `${F.settings.negatives} noise words pushed away for every real neighbour`, 24, 640, 190, INK.ember, "left", span(t, T.noise, T.noise + 0.6)));
  if (t >= T.who) items.push(lab(A, "Mikolov and colleagues, 2013", 24, 1040, 1000, INK.dim, "center", span(t, T.who, T.who + 0.6)));
  return scene(t, A, [...items, ...zn]);
}

// Training: the cards drift snapshot by snapshot; the held question freezes them; the share's curve.
export function train(t, A, T, F) {
  const S = F.training.snapshots, n = S.length - 1;
  let u = 3 * span(t, T.run, T.ask.start - 0.5, ease.inOut);
  if (t >= T.reveal) u = 3 + 2 * span(t, T.reveal, T.reveal + 4, ease.inOut);
  if (t >= T.end2) u = 5 + (n - 5) * span(t, T.end2, T.end2 + 5, ease.inOut);
  const Pu = placeAt(F, u), items = [...room(t), ...cards(A, F, Pu, t), ...zoomNote(A, Pu)], k = Math.min(n, Math.round(u));
  items.push(lab(A, `${Math.round(S[k].fraction * 100)}% of training: same-kind neighbours ${Math.round(S[k].share.top1 * 100)}%, held-out loss ${S[k].heldLoss.toFixed(2)}`, 26, 640, 80, INK.night, "left", 1));
  if (t >= T.reveal) {
    const XX = (i) => 660 + (i / n) * 420, YY = (v) => 260 - v * 140, upto = Math.min(n, Math.ceil(u));
    items.push({ shape: polyline(S.slice(0, upto + 1).flatMap((s, i) => [XX(i), YY(s.share.top1)])), fill: null, stroke: [0.89, 0.58, 0.45, 1], width: 3, screen: true }, lab(A, "same-kind share, snapshot by snapshot", 20, 660, 290, INK.dim, "left", 1));
  }
  return scene(t, A, items);
}

// Other seeds: neighbour lists agree 75% to 80% with this run's.
export function seeds(t, A, T, F) {
  const items = [...room(t), ...cards(A, F, placeAt(F, F.training.snapshots.length - 1), t, { a: 0.6 })], ov = F.comparison.overlapSeedToSeed, g = span(t, T.start, T.start + 2);
  ov.forEach((r, i) => items.push({ shape: rect(660, 150 + i * 46, 600 * r.overlap * g, 30, 4), fill: [0.93, 0.9, 0.84, 0.8], screen: true }, lab(A, `seed ${r.seed}: ${Math.round(r.overlap * 100)}% of top-3 neighbours shared`, 22, 670 + 600 * r.overlap * g, 172 + i * 46, INK.night, "left", g)));
  return scene(t, A, items);
}

// Two maps: the skip-gram's and the attention model's own table (from the vectors lesson).
export function compare(t, A, T, F) {
  const C2 = F.comparison, items = [...room(t, 0.5, { lensOn: false })], V = A.V, g = span(t, T.start, T.start + 2);
  // Each map is fitted to its own panel (the two tables' axes are not comparable in scale).
  const draw = (pts, x0, x1, a) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), lx = Math.min(...xs), hx = Math.max(...xs), ly = Math.min(...ys), hy = Math.max(...ys);
    pts.forEach(([x, y], k) => { const px = x0 + ((x - lx) / (hx - lx || 1)) * (x1 - x0), py = 900 - ((y - ly) / (hy - ly || 1)) * 580;
      items.push({ shape: circle(px, py, 4, 8), fill: [0.93, 0.9, 0.84, 0.8 * a] }, { shape: words(F.words[k], A.sans, 20, px + 6, py - 4), fill: INK.night, opacity: a }); });
  };
  draw(F.training.snapshots.at(-1).trackOnFinalAxes, 560, 1040, g);
  const wp = V.chartWte.points.map((p) => [p.x, p.y]), byWord = new Map(V.chartWte.points.map((p, i) => [p.word, i]));
  draw(F.words.map((w) => wp[byWord.get(w)]), 1220, 1700, span(t, T.start + 1, T.start + 3));
  items.push({ shape: polyline([1130, 290, 1130, 920]), fill: null, stroke: [0.85, 0.8, 0.7, 0.25 * g], width: 2 }, lab(A, "skip-gram", 26, 800, 250, INK.night, "center", g), lab(A, "the attention model's table", 26, 1460, 250, INK.night, "center", span(t, T.start + 1, T.start + 3)));
  if (t >= T.share) items.push(lab(A, `same-kind neighbours: ${Math.round(C2.skipGram.top1 * 100)}% here, ${Math.round(C2.wte.top1 * 100)}% there`, 26, 640, 80, INK.night, "left", span(t, T.share, T.share + 0.6)));
  if (t >= T.overlap) items.push(lab(A, `top-3 neighbours shared: ${Math.round(C2.overlapWithWte * 100)}% between the two; ${Math.round(C2.chanceOverlap * 100)}% by chance`, 26, 640, 120, INK.ember, "left", span(t, T.overlap, T.overlap + 0.6)));
  return scene(t, A, items);
}

export function close(t, A, T, F) {
  const P = placeAt(F, F.training.snapshots.length - 1), ci = F.words.indexOf("cone"), dim = span(t, T.night, T.end), items = [...room(t, 0.7 * (1 - dim)), ...cards(A, F, P, t, { hot: (k) => k === ci })];
  const drip = span(t, T.start + 1, T.start + 2.5);
  if (drip > 0) items.push({ shape: circle(P[ci][0], lerp(P[ci][1] - 200, P[ci][1] - 24, drip), 6, 10), fill: [0.95, 0.85, 0.6, 1] });
  return { items: [...items, darkness(LENS.x - 300, LENS.y, 1700, 0.4), ...host(t, A), { shape: rect(0, 0, 1920, 1080), screen: true, fill: [0, 0, 0, 0.85 * dim] }], camera: { x: 960, y: 540, zoom: 1 } };
}
