// The second half of the vectors film: from two directions to thirty-two (the attention film's
// columns of dots, the same picture in both lessons), where the trained words live, Pylon's cone,
// the flat chart that loses closeness, and goodnight. Every number drawn is a facts.json value or
// arithmetic on the word lists facts.json holds.
import { rect, circle, polyline, span, ease, lerp, window, words, label, smooth01, C, rng } from "../../shared/lib.mjs";
import { K, P, desk, paper, crate, tag, pylon, cone, talking, vec } from "./chart.mjs";
import { base, readout, A_VEC, f2, dot } from "./seg-chart.mjs";
import { dotProduct } from "../../attention/scene/data.mjs";

const pct = (v) => `${Math.round(v * 100)}%`;
const cosine = (a, b) => dot2(a, b) / Math.sqrt(dot2(a, a) * dot2(b, b));
const dot2 = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const NAMED = ["kettle", "map", "shell", "crate", "tallow", "rerun", "pylon", "cone", "who", "stood"];
const GROUPS = ["guide", "noun", "verb", "adjective", "function", "punctuation"];

// A column of dots for one word's list (one dot per number), as in the attention film.
function column(A, v, x, y0, { max = 1.85, label: lab = null, hot = false, a = 1, dy = 13 } = {}) {
  const out = [];
  v.forEach((val, k) => out.push({ shape: circle(x, y0 + k * dy, (1.3 + 5 * Math.min(1, Math.abs(val) / max)) * a, 10), blend: "add",
    fill: hot ? [0.89, 0.58, 0.45, 0.95 * a] : val >= 0 ? [0.93, 0.9, 0.84, 0.85 * a] : [0.6, 0.7, 0.85, 0.85 * a] }));
  if (lab) out.push({ shape: words(lab, A.sans, 32, x, y0 + v.length * dy + 40, "center"), fill: hot ? K.ember : K.night, opacity: a });
  return out;
}
const vecOf = (F, w, start = 0) => { const i = F.words.indexOf(w); return F.wte[i].map((v, k) => lerp(F.wteStart[i][k], v, 1 - start)); };
const dark = (items) => [{ shape: rect(0, 0, 1920, 1080), screen: true, fill: [0.01, 0.01, 0.014, 1] }, ...items];

// Two directions, then a third (the crate lifts), then the chart goes dark and the list becomes
// a column of 32 dots; the dot product of two words, number by number.
export function many(t, A, T, F) {
  const fade = span(t, T.ours - 0.6, T.ours + 1.2, ease.inOut);
  if (fade < 1) {
    const B = base(t, A, { dim: fade }), up = span(t, T.long, T.long + 1.6, ease.inOut), items = [...B.back];
    items.push({ shape: polyline([...P([0, 0]), ...P([-1.6 * up, -0.9 * up])]), fill: null, stroke: K.ink, width: 3 }, { shape: words("up", A.mono, 24, ...P([-1.75, -0.78]), "center"), fill: K.dim, opacity: up });
    items.push(...vec(A_VEC, K.ink, 7), ...crate(A, A_VEC, { lift: 1.2 * up }));
    if (up > 0) items.push(...tag(A, up > 0.5 ? "(4, 1.5, 2)" : "(4, 1.5)", ...P([4.3, 2.9]), { size: 34, alpha: 1 }));
    items.push(...B.guide, { shape: rect(0, 0, 1920, 1080), screen: true, fill: [0.01, 0.01, 0.014, fade] });
    return { items, camera: { x: 960, y: 540, zoom: 1 + 0.15 * fade } };
  }
  const items = [], kx = 960, y0 = 250, one = span(t, T.ours + 0.8, T.ours + 2.4), all = span(t, T.place, T.place + 2.0, ease.out);
  // The star of 32 directions, faint, behind.
  const star = window(t, T.picture, T.still + 0.5, 0.8, 1.0);
  for (let k = 0; k < 32; k++) { const a = (k / 32) * Math.PI * 2; items.push({ shape: polyline([kx, 540, kx + Math.cos(a) * 520, 540 + Math.sin(a) * 420]), fill: null, stroke: [0.8, 0.85, 1, 0.12 * star], width: 1, blend: "add" }); }
  const prod = span(t, T.still, T.still + 5.5, ease.linear);
  if (prod <= 0) {
    NAMED.forEach((w, i) => { const x = kx + (i - 4.5) * 150 * all, a = w === "kettle" ? one : all; items.push(...column(A, vecOf(F, w), w === "kettle" ? lerp(kx, x, all) : x, y0, { label: w, hot: w === "kettle", a })); });
    items.push(label(A, `1 dot = 1 number. ${F.dModel} numbers per word.`, 26, 80, 64, C.dim, "left", one, "mono"));
  } else {
    const q = vecOf(F, "kettle"), k = vecOf(F, "map"), d = dotProduct(A, q, k, 960, 170, prod, { scale: 1 / 1.85, gap: 21 });
    items.push(...d.items.map((it) => ({ ...it, screen: true })));
    items.push(label(A, "kettle", 30, 880, 140, K.ember, "center"), label(A, "map", 30, 1040, 140, K.night, "center"));
    const done = prod >= 1, raw = done ? dot2(q, k) : d.running;
    items.push(label(A, `kettle . map = ${f2(raw)}`, 40, 960, 900, K.night, "center", 1, "mono"));
    if (done) items.push(label(A, `cosine = ${f2(cosine(q, k))}`, 40, 960, 960, K.ember, "center", span(t, T.still + 5.6, T.still + 6.2), "mono"));
  }
  return { items: dark(items), camera: { x: 960, y: 540, zoom: 1 }, dark: true };
}

// Where each word sits in the category layout (columns of word tags, one per kind).
function groupPos(F, i) {
  const cat = F.labels[i], g = GROUPS.indexOf(cat), members = F.labels.map((c, j) => [c, j]).filter(([c]) => c === cat).map(([, j]) => j), r = members.indexOf(i);
  return [330 + g * 252, 196 + r * 36];
}
function groupChart(A, F, { links = 0, shuffle = 0, focus = -1, a = 1, override = {} } = {}) {
  const out = [], n = F.words.length, perm = rng(11), sh = F.words.map((_, i) => i).sort(() => perm() - 0.5);
  GROUPS.forEach((g, k) => out.push({ shape: words(g, A.mono, 26, 330 + k * 252, 150, "center"), fill: K.nightDim, opacity: a }));
  for (let i = 0; i < n; i++) {
    const p = override[i] || groupPos(F, i);
    if (links > 0) {
      const j = shuffle > 0.5 ? sh[i] : F.chartWte.points[i].nn, q = override[j] || groupPos(F, j), same = F.labels[i] === F.labels[j];
      out.push({ shape: polyline([p[0], p[1] - 8, (p[0] + q[0]) / 2 + 30, (p[1] + q[1]) / 2 - 40, q[0], q[1] - 8]), fill: null, stroke: same ? [0.93, 0.9, 0.84, 0.55 * links * a] : [0.89, 0.45, 0.32, 0.75 * links * a], width: 2, blend: "add" });
    }
    out.push({ shape: words(F.words[i], A.sans, 28, p[0], p[1], "center"), fill: i === focus ? K.ember : K.night, opacity: a });
  }
  return out;
}

// Training moves the numbers; a word's neighbours; the share of same-kind neighbours with its
// controls; the 2013 analogy as a labelled illustration.
export function wordsSeg(t, A, T, F) {
  const items = [];
  if (t < T.close) {
    const u = span(t, T.moved, T.moved + 5.5, ease.inOut);
    NAMED.forEach((w, i) => items.push(...column(A, vecOf(F, w, 1 - u), 960 + (i - 4.5) * 150, 250, { label: w, hot: w === "kettle" })));
    items.push(label(A, u < 1 ? "before training (real) ... after (real); the frames between are drawn" : "after training", 26, 80, 64, C.dim, "left", 1, "mono"));
  } else if (t < T.share) {
    const w = t < T.tallow ? "kettle" : "tallow", nb = F.neighbours.wte[w].slice(0, 3), a = span(t, t < T.tallow ? T.close : T.tallow, (t < T.tallow ? T.close : T.tallow) + 0.8);
    items.push(...tagDark(A, w, 960, 560, K.ember, a));
    nb.forEach((n, k) => { const ang = -Math.PI / 2 + (k - 1) * 0.9, r = 140 + 520 * (1 - n.cosine), x = 960 + Math.cos(ang) * r * 1.4, y = 560 + Math.sin(ang) * r * 0.8;
      items.push({ shape: polyline([960, 560, x, y]), fill: null, stroke: [0.93, 0.9, 0.84, 0.6 * a], width: 2 }, ...tagDark(A, n.word, x, y, K.night, a), label(A, `cosine ${f2(n.cosine)}`, 24, (960 + x) / 2 + 60, (560 + y) / 2, K.nightDim, "left", a, "mono")); });
  } else if (t < T.big) {
    const links = span(t, T.share + 0.5, T.share + 2.5), shuf = span(t, T.shuffle, T.shuffle + 0.3) * (1 - span(t, T.before - 0.2, T.before + 0.1));
    items.push(...groupChart(A, F, { links, shuffle: shuf }));
    const m = F.measurements.wte, same = Math.round(m.top1 * F.vocab);
    items.push(...readout(A, [[`${same} of ${F.vocab} words: nearest neighbour of the same kind = ${pct(m.top1)}`, 32],
      ...(t >= T.shuffle ? [[`shuffled lists: about ${pct(m.control.top1.mean)} (95% of shuffles: ${pct(m.control.top1.lo95)} to ${pct(m.control.top1.hi95)})`, 30, K.nightDim]] : []),
      ...(t >= T.before ? [[`before training: ${pct(F.measurements.wteUntrained.top1)}`, 30, K.nightDim]] : [])], links, { x: 300, y: 800, w: 1320 }));
  } else {
    // Illustration: the 2013 analogy, on a small chart. Not our model.
    const a = span(t, T.king, T.king + 0.8), g = span(t, T.king + 1.5, T.king + 4.5, ease.inOut), pts = { king: [620, 300], man: [700, 640], woman: [1180, 600], queen: [1100, 260] };
    for (const [w, [x, y]] of Object.entries(pts)) items.push(...tagDark(A, w, x, y, w === "queen" ? K.ember : K.night, w === "queen" ? g : a));
    items.push(...arrowsDark([pts.man, pts.king], a), ...arrowsDark([pts.woman, [pts.woman[0] + (pts.king[0] - pts.man[0]) * g, pts.woman[1] + (pts.king[1] - pts.man[1]) * g]], a));
    items.push(label(A, "illustration of the 2013 finding (hundreds of millions of words), not our model", 26, 960, 960, C.dim, "center", a, "mono"));
  }
  return { items: dark(items), camera: { x: 960, y: 540, zoom: 1 }, dark: true };
}
function tagDark(A, s, x, y, ink, a = 1) {
  const w = s.length * 21 + 40;
  return [{ shape: rect(x - w / 2, y - 30, w, 52, 6), fill: [0.1, 0.09, 0.08, 0.9 * a], stroke: [0.6, 0.55, 0.5, 0.7 * a], width: 1.5 }, { shape: words(s, A.sans, 34, x, y + 10, "center"), fill: ink, opacity: a }];
}
function arrowsDark([p, q], a) {
  return [{ shape: polyline([...p, ...q]), fill: null, stroke: [0.93, 0.9, 0.84, 0.8 * a], width: 4 }, { shape: circle(q[0], q[1], 8, 12), fill: [0.93, 0.9, 0.84, a] }];
}

// Pylon's cone: it should sit with the cargo, but it was measured beside who, stood and mended; it
// only ever turns up in one phrase, and why it landed there is not something the lesson claims.
export function coneSeg(t, A, T, F) {
  const ci = F.words.indexOf("cone"), noun = groupPos(F, ci), into = span(t, T.job, T.job + 2.0, ease.inOut);
  // Where it was measured to sit: beside its three nearest neighbours (no claim about why).
  const nbPos = F.neighbours.wte.cone.slice(0, 3).map((n) => groupPos(F, F.words.indexOf(n.word)));
  const target = [nbPos.reduce((s, q) => s + q[0], 0) / 3 + 40, nbPos.reduce((s, q) => s + q[1], 0) / 3 + 60];
  if (t < T.cargo) {
    const items = [...desk(t, 0.55)], off = span(t, T.start + 1.0, T.start + 2.2, ease.inOut);
    items.push(...pylon(t, 960, 900, 1.1, { talk: talking(A.rows, t), hat: off < 0.5, flipR: 70 * window(t, T.start + 0.8, T.start + 2.6, 0.5, 0.5) }));
    if (off >= 0.5) items.push(...cone(lerp(1130, 1300, off), lerp(380, 860, off), 1.1));
    return { items, camera: { x: 960, y: 620, zoom: 1.1 } };
  }
  const p = [lerp(noun[0], target[0], into), lerp(noun[1], target[1], into)], items = [...groupChart(A, F, { focus: ci, override: { [ci]: p }, links: span(t, T.nb, T.nb + 1) * (1 - into) })];
  items.push(...cone(p[0], p[1] - 34, 0.32));
  if (t >= T.nb) F.neighbours.wte.cone.slice(0, 3).forEach((n, k) => items.push(label(A, `${n.word} ${f2(n.cosine)}`, 26, 1640, 260 + k * 44, C.dim, "left", span(t, T.nb, T.nb + 0.6) * (1 - into), "mono")));
  const ph = window(t, T.phrase, T.means, 0.6, 0.6);
  if (ph > 0) { items.push({ shape: rect(560, 860, 800, 90, 8), fill: [0.95, 0.9, 0.78, 0.95 * ph], screen: true }); ["pylon", "put", "a", "cone", "on", "the"].forEach((w, k) => items.push(label(A, w, 40, 640 + k * 128, 920, w === "cone" ? K.rust : K.ink, "center", ph))); }
  if (t >= T.means) items.push(label(A, "closeness comes from use, not meaning", 44, 960, 960, K.ember, "center", span(t, T.means, T.means + 0.8)));
  return { items: dark(items), camera: { x: 960, y: 540, zoom: 1 }, dark: true };
}

// The flat chart: the 46 lists squashed onto their two principal directions; lines to each word's
// true nearest neighbour show how much closeness the flat picture throws away.
function pcaPos(F) {
  const pts = F.chartWte.points, xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return pts.map((p) => [420 + ((p.x - x0) / (x1 - x0)) * 1080, 220 + (1 - (p.y - y0) / (y1 - y0)) * 600]);
}
export function flatSeg(t, A, T, F, { coneAt = 0 } = {}) {
  const sq = span(t, T.squash, T.squash + 3.0, ease.inOut), flat = pcaPos(F), n = F.words.length, items = [...desk(t, 0.2), ...paper(A, { grid: 0, axes: 0 })];
  const pos = F.words.map((_, i) => { const g = groupPos(F, i); return [lerp(g[0], flat[i][0], sq), lerp(g[1], flat[i][1], sq)]; });
  const lines = span(t, T.only, T.only + 2.0);
  for (let i = 0; i < n && lines > 0; i++) { const j = F.chartWte.points[i].nn, same = F.labels[i] === F.labels[j]; items.push({ shape: polyline([...pos[i], ...pos[j]]), fill: null, stroke: same ? [0.11, 0.09, 0.07, 0.5 * lines] : [0.65, 0.27, 0.16, 0.7 * lines], width: 2 }); }
  F.words.forEach((w, i) => { items.push({ shape: circle(...pos[i], 5, 10), fill: K.ink }, { shape: words(w, A.sans, 24, pos[i][0] + 9, pos[i][1] - 6), fill: w === "cone" ? K.rust : K.ink }); });
  if (coneAt > 0) { const c = pos[F.words.indexOf("cone")]; items.push(...cone(c[0], lerp(c[1] - 400, c[1] + 4, coneAt), 0.3)); }
  const keep = span(t, T.keep, T.keep + 1.0);
  if (keep > 0) {
    const [s1, s2] = F.chartWte.axisShare, w = 700;
    items.push({ shape: rect(610, 900, w, 30, 4), fill: [0, 0, 0, 0.15 * keep], stroke: K.ink, width: 2 }, { shape: rect(610, 900, w * s1, 30, 4), fill: K.ink, opacity: keep }, { shape: rect(610 + w * s1, 900, w * s2, 30), fill: K.dim, opacity: keep });
    items.push({ shape: words(`the two directions keep ${pct(F.chartWte.varianceShare)} of the spread`, A.sans, 28, 960, 965, "center"), fill: K.ink, opacity: keep });
  }
  if (lines > 0) items.push(...readout(A, [[`same-kind nearest neighbour on the flat chart: ${pct(F.chartWte.top1In2D)}`, 30], ...(t >= T.all ? [[`in all ${F.dModel} directions: ${pct(F.measurements.wte.top1)}`, 30, K.ember]] : []), ["lines: each word to its nearest neighbour in all 32 directions", 24, K.nightDim]], lines, { y: 20, w: 1180 }));
  items.push(...pylon(t, 1745, 1015, 0.52, { talk: talking(A.rows, t), hat: coneAt <= 0 }));
  return { items, camera: { x: 960, y: 540, zoom: 1 + 0.06 * span(t, T.squash, T.end) } };
}

// Goodnight: Pylon sets her cone on the word cone, a crane's silhouette at the paper's edge
// (the next lesson), and the lamp goes down.
export function close(t, A, T, F) {
  const f = flatSeg(t, A, { ...T, squash: -10, keep: 1e9, only: 1e9, all: 1e9, end: T.end }, F, { coneAt: span(t, T.start + 1, T.start + 2.2, ease.out) });
  const crane = span(t, T.next, T.next + 1.5, ease.out), dimA = span(t, T.night, T.end, ease.inOut);
  if (crane > 0) {
    const mx = 1540, base = 975, top = base - 470 * crane, tip = [mx - 380 * crane, top + 40], ink = [0.12, 0.09, 0.07, 0.85];
    for (const dx of [-14, 14]) f.items.push({ shape: polyline([mx + dx, base, mx + dx * 0.6, top]), fill: null, stroke: ink, width: 3 });
    for (let k = 0; k < 9; k++) { const y0 = base - (k / 9) * (base - top), y1 = base - ((k + 1) / 9) * (base - top); f.items.push({ shape: polyline([mx - 13, y0, mx + 12, y1]), fill: null, stroke: ink, width: 2 }); }
    f.items.push({ shape: polyline([mx, top, ...tip]), fill: null, stroke: ink, width: 4 }, { shape: polyline([mx, top - 30, ...tip]), fill: null, stroke: ink, width: 2 });
    f.items.push({ shape: polyline([...tip, tip[0], tip[1] + 160 * crane]), fill: null, stroke: ink, width: 2 }, { shape: circle(tip[0], tip[1] + 166 * crane, 7, 12), fill: ink });
  }
  f.items.push({ shape: rect(0, 0, 1920, 1080), screen: true, fill: [0, 0, 0, 0.92 * dimA] });
  return { items: f.items, camera: { x: 960, y: 540, zoom: 1.06 } };
}
