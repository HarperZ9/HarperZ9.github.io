// The data film's segments (lesson L13), on Pylon's dock (PROGRESS.md, step 31): each training mix
// is a stack of ten crates, coloured by kind of episode (copy rust, who blue, plain wood), with its
// measured score on a sign beneath. Every share and score is a facts.json value (F).
import { rect, circle, polyline, words, span, label, C } from "../../shared/lib.mjs";
import { K, desk, pylon, talking, cone } from "../../vectors/scene/chart.mjs";

const KIND = { copy: [0.65, 0.27, 0.16], who: [0.18, 0.31, 0.48], plain: [0.56, 0.42, 0.28] };
const pct = (v) => `${Math.round(v * 100)}%`;
const lab = (A, s, size, x, y, fill = "#f1e4c8", a = 1, anchor = "center") => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a });
const guide = (t, A) => pylon(t, 1790, 1050, 0.42, { talk: talking(A.rows, t) });
const scene = (t, A, items) => ({ items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } });

// Ten crates for a mix: look (share needing a look back) split evenly between copy and who unless
// kinds says otherwise. marked(k): crate k carries a wrong label. a: build-up (0..1).
export function stack(A, x, look, { a = 1, kinds = null, marked = () => false, sign = null, score = null, hot = false, size = 1 } = {}) {
  const n = 10, L = Math.round(look * n), out = [], w = 130 * size, h = 50 * size;
  for (let k = 0; k < n; k++) {
    const kind = kinds ? kinds[k] : k < L / 2 ? "copy" : k < L ? "who" : "plain", u = Math.max(0, Math.min(1, a * n - k)), y = 880 - k * (h + 6);
    if (u <= 0) break;
    out.push({ shape: rect(x - w / 2, y - h, w, h, 4), fill: [...KIND[kind], u], stroke: "#1d1812", width: 2 });
    if (marked(k)) out.push({ shape: polyline([x - w / 2 + 10, y - h + 8, x + w / 2 - 10, y - 8]), fill: null, stroke: [0.95, 0.9, 0.8, u], width: 4 }, { shape: polyline([x + w / 2 - 10, y - h + 8, x - w / 2 + 10, y - 8]), fill: null, stroke: [0.95, 0.9, 0.8, u], width: 4 });
  }
  const sw = sign ? Math.max(200, sign.length * 14 + 24) : 0;
  if (sign) out.push({ shape: rect(x - sw / 2, 905, sw, score ? 92 : 56, 6), fill: hot ? [0.89, 0.58, 0.45, 1] : K.paper, stroke: K.ink, width: 2 }, lab(A, sign, 24, x, 940, K.ink));
  if (score) out.push(lab(A, score, 24, x, 978, hot ? K.ink : K.rust));
  return out;
}
const legend = (A, a = 1) => [["copy", "copy episodes"], ["who", "who episodes"], ["plain", "plain"]].flatMap(([k, n], i) => [{ shape: rect(120 + i * 330, 70, 40, 30, 4), fill: [...KIND[k], a], stroke: "#1d1812", width: 2 }, lab(A, n, 22, 175 + i * 330, 94, "#f1e4c8", a, "left")]);
const caption = (A, s, a = 1) => [{ shape: rect(560, 1010, 1060, 56, 8), fill: [0.05, 0.04, 0.03, 0.75 * a], screen: true }, { ...lab(A, s, 24, 1090, 1047, "#f1e4c8", a), screen: true }];

export function open(t, A, T, F) {
  return { items: [...desk(t, 1 - span(t, 0.3, 3)), ...stack(A, 760, 0.8, { a: span(t, 1, 3.5) }), ...pylon(t, 1790, 1050, 0.42), { shape: rect(0, 0, 1920, 1080), screen: true, fill: [0, 0, 0, 1 - span(t, 0, 1.5)] }], camera: { x: 960, y: 540, zoom: 1.05 - 0.05 * span(t, 0, 4) } };
}
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end));
  return scene(t, A, [...desk(t), ...stack(A, 560, 0.8, { a: 0.7 }), label(A, "Data", 110, 1150, 430, "#f1e4c8", "center", a, "head"), label(A, "what goes in comes out", 36, 1150, 490, "#b29d7e", "center", span(t, T.sub, T.sub + 0.6) * a)]);
}
export function mix(t, A, T, F) {
  const R = F.reproduce;
  return scene(t, A, [...desk(t), ...legend(A, span(t, T.kinds, T.kinds + 1)), ...stack(A, 860, F.lookback.runs[5].lookbackShare, { a: span(t, T.start, T.start + 3), sign: `${pct(F.lookback.runs[5].lookbackShare)} look back`, score: t >= T.score ? `${pct(R.split.lookback.accuracy)} right` : null })]);
}
// The look-back share cut down: one stack per share, scores revealed as the voice names them.
export function less(t, A, T, F) {
  const runs = F.lookback.runs, order = [5, 4, 3, 2, 1, 0], at = { 4: T.r40, 3: T.r20, 2: T.r05, 0: T.r0 }, items = [...desk(t), ...legend(A)];
  order.forEach((i, k) => { const r = runs[i], show = at[i] !== undefined && t >= at[i];
    items.push(...stack(A, 180 + k * 255, r.lookbackShare, { a: span(t, T.start + k * 0.4, T.start + 2 + k * 0.4), sign: `${Math.round(r.lookbackShare * 100)}% look back`, score: i === 5 ? `${pct(r.summary.copyAccuracy)} right` : i === 1 ? (t >= T.r0 ? `${pct(r.summary.copyAccuracy)} right` : null) : show ? `${pct(r.summary.copyAccuracy)} right` : null, hot: i === 0 && show, size: 0.9 })); });
  if (t >= T.loss) items.push(...caption(A, `none: held-out loss ${runs[0].summary.heldOut.toFixed(2)}; before any training: ${F.duplication.fresh.curve[0].heldOut.toFixed(2)}`, span(t, T.loss, T.loss + 0.6)));
  return scene(t, A, items);
}
// Copy episodes removed: who look-back survives, copy does not carry over.
export function transfer(t, A, T, F) {
  const S = F.shift.noCopyEpisodes, kinds = ["who", "who", "who", "who", "who", "who", "who", "plain", "plain", "plain"];
  return scene(t, A, [...desk(t), ...legend(A), ...stack(A, 640, 0, { kinds, sign: "no copy episodes" }),
    ...stack(A, 1080, 0, { kinds: Array(10).fill("who"), a: span(t, T.who, T.who + 1.5), sign: "who rows", score: t >= T.who ? `${pct(S.whoOnly.lookback)} right` : null, size: 0.8 }),
    ...stack(A, 1420, 0, { kinds: Array(10).fill("copy"), a: span(t, T.copy, T.copy + 1.5), sign: "copy rows", score: t >= T.copy ? `${pct(S.copyOnly.lookback)} right` : null, hot: true, size: 0.8 })]);
}
// Wrong labels: crosses on a share of crates; the split of the damage.
export function noise(t, A, T, F) {
  const [n10, n30] = F.labelNoise.runs, thirty = t >= T.n30, r = thirty ? n30 : n10, marks = Math.round(r.share * 10), items = [...desk(t), ...legend(A)];
  items.push(...stack(A, 760, 0.8, { marked: (k) => k % Math.round(10 / Math.max(1, marks)) === 0 && k / Math.round(10 / Math.max(1, marks)) < marks, sign: `${pct(r.share)} wrong labels` }));
  const rows = [[T.local, `ordinary next words: ${pct(r.summary.localAccuracy)} right`], [T.look, `look-back words: ${pct(r.summary.copyAccuracy)} right`], [T.split, `copy episodes ${pct(r.split.copyEpisodes.accuracy)}, who questions ${pct(r.split.whoEpisodes.accuracy)}`]];
  rows.forEach(([at, s], i) => { if (t >= at) items.push(lab(A, s, 26, 1060, 360 + i * 60, "#f1e4c8", span(t, at, at + 0.6), "left")); });
  return scene(t, A, items);
}
// The same rows over and over: a small pile, and the held-out curves (after the held question).
export function repeat(t, A, T, F) {
  const D = F.duplication, items = [...desk(t), ...stack(A, 380, 0.8, { a: 0.4, sign: `${D.runs[0].rows} rows` })], B = { x: 640, y: 160, w: 1000, h: 640 };
  items.push({ shape: rect(B.x, B.y, B.w, B.h, 6), fill: K.paper, stroke: "#3a2c1c", width: 4 });
  const X = (s) => B.x + 40 + (s / 2000) * (B.w - 80), Y = (v) => B.y + B.h - 40 - (Math.min(v, 4) / 4) * (B.h - 110), line = (c, key, col, w = 4) => ({ shape: polyline(c.flatMap((p) => [X(p.step), Y(p[key])])), fill: null, stroke: col, width: w });
  if (t >= T.ask.held) {
    items.push(line(D.runs[0].curve, "heldOut", K.rust), line(D.runs[0].curve, "poolLoss", [0.65, 0.27, 0.16, 0.45], 3), lab(A, `${D.runs[0].rows} rows: held-out ${D.runs[0].summary.heldOut.toFixed(2)} (faint: loss on the pile itself)`, 22, B.x + B.w - 30, B.y + 50, K.ink, 1, "right"));
    if (t >= T.big) items.push(line(D.runs[2].curve, "heldOut", "#8e6c47"), lab(A, `${D.runs[2].rows.toLocaleString("en")} rows: ${D.runs[2].summary.heldOut.toFixed(2)}`, 22, B.x + B.w - 30, B.y + 86, "#8e6c47", 1, "right"));
    if (t >= T.fresh) items.push(line(D.fresh.curve, "heldOut", "#2d4f7a"), lab(A, `fresh rows: ${D.fresh.summary.heldOut.toFixed(2)}`, 22, B.x + B.w - 30, B.y + 122, "#2d4f7a", 1, "right"));
  }
  return scene(t, A, items);
}
// A guide never shown in one role.
export function shift(t, A, T, F) {
  const S = F.shift.rerunNeverDoes;
  return scene(t, A, [...desk(t), ...legend(A), ...stack(A, 600, 0.8, { sign: "Rerun never the doer" }),
    ...stack(A, 1050, 0, { kinds: Array(10).fill("who"), a: span(t, T.rerun, T.rerun + 1.5), sign: "answer: Rerun", score: t >= T.rerun ? `${pct(S.whoRerunDoes.guideAnswer)} named` : null, hot: true, size: 0.8 }),
    ...stack(A, 1400, 0, { kinds: Array(10).fill("who"), a: span(t, T.others, T.others + 1.5), sign: "Tallow or Pylon", score: t >= T.others ? `${pct(S.whoOthersDo.guideAnswer)} named` : null, size: 0.8 })]);
}
export function close(t, A, T, F) {
  const dim = span(t, T.night, T.end), items = [...desk(t, dim), ...F.lookback.runs.slice().reverse().flatMap((r, k) => stack(A, 180 + k * 255, r.lookbackShare, { size: 0.9, sign: `${Math.round(r.lookbackShare * 100)}%`, score: pct(r.summary.copyAccuracy) }))];
  if (t >= T.night) items.push(...cone(1460, 880 - 10 * 46 * 0.9, 0.5));
  return scene(t, A, items);
}
