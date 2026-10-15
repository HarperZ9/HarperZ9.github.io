// The next-word film's segments (lesson L9), in Tallow's lamp room around the brass wheel
// (wheel.mjs). Every share, loss and perplexity drawn is a facts.json value (F); timings from the
// cue map in film.scene.mjs (T).
import { rect, polyline, words, span, label, C, darkness } from "../../shared/lib.mjs";
import { room, host } from "../../embeddings/scene/segs.mjs";
import { WHEEL, INK, wheel, pointer, ring, mix, even, lab, plateRect } from "./wheel.mjs";

const N = 46;
const byShare = (d) => d.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(([, i]) => i);
const pick = (d, o) => o.map((i) => d[i]);
const scene = (t, A, items, cam = { x: 960, y: 540, zoom: 1 }) => ({ items: [...items, darkness(380, 700, 1900, 0.35), ...host(t, A)], camera: cam });
// The stand: a word card clipped beside the wheel, top left of it.
const stand = (A, w, a = 1, hot = false) => { const fs = w.length > 9 ? 26 : 34, wd = Math.max(220, w.length * fs * 0.58 + 40);
  return [{ shape: rect(560, 130, wd, 70, 4), fill: hot ? [0.89, 0.58, 0.45, a] : [0.89, 0.84, 0.71, a], stroke: "#2a2219", width: 2 }, { shape: words(w, A.sans, fs, 560 + wd / 2, 177, "center"), fill: INK.ink, opacity: a }]; };

export function open(t, A, T, F) {
  const lit = span(t, 0.8, 1.6), o = byShare(F.torn.rows[0].modelDist);
  const items = [...room(t, 0.3 * lit), ...wheel(A, even(N), pick(F.words, o), { turn: t * 0.15, a: 0.5 + 0.5 * lit, minLabel: 1 }), ...pointer(WHEEL, lit)];
  if (t > 2.4) items.push(...stand(A, "pylon", span(t, 2.4, 3)));
  return { items: [...items, darkness(400, 600, 300 + 1200 * lit, 0.95 - 0.5 * lit), ...host(t, A, { flame: lit })], camera: { x: 960, y: 540, zoom: 1.05 - 0.05 * span(t, 0, 4) } };
}
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end)), o = byShare(F.torn.rows[0].modelDist);
  return scene(t, A, [...room(t), ...wheel(A, even(N), pick(F.words, o), { turn: t * 0.15, a: 0.6, minLabel: 1 }), ...pointer(), label(A, "Next-word prediction", 92, 960, 105, C.ink, "center", a, "head"), label(A, "one guess, spread over every word", 34, 960, 158, INK.dim, "center", span(t, T.sub, T.sub + 0.6) * a)]);
}

// The guess after "pylon": the even wheel opens into the model's spread; then the rules' ring.
export function guess(t, A, T, F) {
  const R = F.torn.rows[0], o = byShare(R.modelDist), u = span(t, T.cut, T.cut + 3), s = mix(even(N), pick(R.modelDist, o), u);
  const items = [...room(t), ...stand(A, "pylon"), ...wheel(A, s, pick(F.words, o), { pct: (k) => u > 0.9 && k < 2 }), ...pointer()];
  if (t >= T.rules) items.push(...ring(A, pick(R.truthDist, o), pick(F.words, o), { a: span(t, T.rules, T.rules + 1), label: "the rules' own odds" }));
  if (t >= T.cut + 3) items.push(lab(A, `after "pylon": ${R.model[0].word} ${Math.round(R.model[0].p * 100)}%, ${R.model[1].word} ${Math.round(R.model[1].p * 100)}%${t >= T.found ? `   the rules: ${R.truth[0].word} ${Math.round(R.truth[0].p * 100)}%` : ""}`, 26, 120, 1040, INK.night, "left", span(t, T.cut + 3, T.cut + 3.6)));
  return scene(t, A, items);
}

// Scores to shares: four bars (scores, any sign), then e to each, then the four-slot wheel.
export function softmax(t, A, T, F) {
  const W = F.worked, items = [...room(t, 0.3)], ex = span(t, T.exp, T.exp + 2), sh = span(t, T.shares, T.shares + 2);
  const X = (i) => 640 + i * 150, base = 620, maxE = Math.max(...W.exp);
  items.push({ shape: rect(590, base, 600, 2), fill: [0.9, 0.85, 0.7, 0.6] });
  W.words.forEach((w, i) => {
    const sc = W.logits[i] * 70, e = (W.exp[i] / maxE) * 360, h = sc + (e - sc) * ex, y = h >= 0 ? base - h : base;
    items.push({ shape: rect(X(i) - 45, y, 90, Math.max(2, Math.abs(h))), fill: [0.89, 0.84, 0.71, 1 - 0.6 * sh], stroke: "#2a2219", width: 2 },
      lab(A, w, 24, X(i), base + 60, INK.night, "center"), lab(A, ex < 0.5 ? `${W.logits[i]}` : W.exp[i].toFixed(2), 24, X(i), Math.min(y, base) - 16, INK.dim, "center"));
  });
  items.push(lab(A, ex < 0.5 ? "scores" : "e to each score", 26, 865, 200, INK.night, "center"));
  if (sh > 0) items.push(...wheel(A, W.probs, W.words, { at: { x: 1490, y: 540, r: 250 }, a: sh, pct: () => true, minLabel: 0.02, size: 28 }), ...pointer({ x: 1490, y: 540, r: 250 }, sh),
    lab(A, "each over the total: the softmax", 26, 1490, 200, INK.night, "center", sh));
  return scene(t, A, items);
}

// Surprise: the word arrives, its slot lights, the surprise bar is minus the log of its share.
export function surprise(t, A, T, F) {
  const W = F.worked, at = { x: 1160, y: 500, r: 280 }, k = W.words.indexOf(W.answer), items = [...room(t, 0.3)];
  items.push(...wheel(A, W.probs, W.words, { at, hot: (i) => t >= T.arrive && i === k, pct: () => true, minLabel: 0.02, size: 28 }), ...pointer(at));
  if (t >= T.arrive) items.push(...stand(A, W.answer, span(t, T.arrive, T.arrive + 0.6), true));
  const bar = (y, p, txt, a) => { const L = Math.min(560, -Math.log(p) * 160); return [{ shape: rect(560, y, L, 26, 3), fill: [0.89, 0.58, 0.45, 0.9 * a], screen: true }, lab(A, txt, 24, 560, y - 12, INK.night, "left", a)]; };
  if (t >= T.loss) items.push(...bar(880, W.probs[k], `share ${Math.round(W.probs[k] * 100)}%: surprise ${W.loss.toFixed(2)}`, span(t, T.loss, T.loss + 0.6)));
  if (t >= T.half) items.push(...bar(950, 0.5, `share 50%: surprise ${(-Math.log(0.5)).toFixed(2)}`, span(t, T.half, T.half + 0.6)));
  if (t >= T.zero) items.push(lab(A, "share 100%: surprise 0", 24, 560, 1018, INK.night, "left", span(t, T.zero, T.zero + 0.6)));
  if (t >= T.slope) {
    const a = span(t, T.slope, T.slope + 0.8);
    W.grad.forEach((g, i) => items.push(lab(A, `${W.words[i]}: slope ${g >= 0 ? "+" : "-"}${Math.abs(g).toFixed(2)}, step ${g >= 0 ? "down" : "up"}`, 24, 140, 300 + i * 46, i === k ? INK.ember : INK.night, "left", a)));
    if (t >= T.check) items.push(lab(A, `checked against nudges: ${W.passes ? "agrees" : "disagrees"}; without the minus one: ${W.controlFails ? "fails" : "passes"}`, 22, 140, 520, INK.dim, "left", span(t, T.check, T.check + 0.6)));
  }
  return scene(t, A, items);
}

// Torn between how many: the model's wheel inside, the rules' ring outside, for two contexts.
export function torn(t, A, T, F) {
  const two = t >= T.found ? 1 : 2, R = F.torn.rows[two], o = byShare(R.truthDist.map((v, i) => v + R.modelDist[i] * 1e-3)), items = [...room(t, 0.3)];
  const a = t >= T.knock ? 1 : 0.35, ctx = R.words.join(" ");
  items.push(...stand(A, ctx, a), ...wheel(A, pick(R.modelDist, o), pick(F.words, o), { a, pct: (k) => k < 3 }), ...pointer(WHEEL, a));
  if (t >= T.knock) items.push(...ring(A, pick(R.truthDist, o), pick(F.words, o), { label: "the rules" }),
    lab(A, `after "${ctx}": the rules, torn between ${Math.round(R.truthBetween)}; the model, ${R.modelBetween.toFixed(2)}`, 26, 120, 1040, INK.night, "left", 1));
  else items.push(lab(A, "perplexity: e to the average surprise, read as a number of equally likely words", 24, 120, 1040, INK.dim, "left", span(t, T.start + 1, T.start + 2)));
  return scene(t, A, items);
}

// The scoreboard: perplexity on the held-out rows, by guesser, on a log scale; then copy positions.
const ROWS = [["uniform", "blind guess"], ["unigram", "word counts"], ["bigram", "which follows which"], ["trigram", "which follows each pair"], ["trained", "the attention model"]];
export function board(A, F, t, T, { floor = false, copy = 0 } = {}) {
  const H = F.held.scores, X0 = 1000, Wd = 640, L = (v) => X0 + (Math.log(v) / Math.log(64)) * Wd, out = [plateRect(520, 180, 1360, 660, 0.55)];
  const rows = floor ? [...ROWS, ["generator", "the rules themselves"]] : ROWS;
  rows.forEach(([k, name], i) => {
    const y = 260 + i * 92, show = span(t, T.rows[Math.min(i, T.rows.length - 1)], T.rows[Math.min(i, T.rows.length - 1)] + 0.8), v = H[k].all.perplexity;
    if (show <= 0) return;
    out.push(lab(A, name, 26, 560, y + 22, k === "trained" ? INK.ember : INK.night, "left", show), { shape: rect(X0, y, Math.max(4, (L(v) - X0) * show), 30, 3), fill: k === "trained" ? [0.89, 0.58, 0.45, 1] : k === "generator" ? [0.55, 0.7, 0.85, 1] : [0.89, 0.84, 0.71, 1], screen: true },
      lab(A, `torn between ${v % 1 === 0 ? v : v.toFixed(2)}`, 24, L(v) + 16, y + 22, INK.night, "left", show));
    if (copy > 0 && (k === "bigram" || k === "trained")) out.push(lab(A, `copy positions: ${H[k].copy.perplexity.toFixed(2)}`, 22, 1660, y + 22, INK.ember, "left", copy));
  });
  out.push(lab(A, `${F.held.positions.toLocaleString("en")} next words in held-out rows; log scale`, 22, 560, 820, INK.dim, "left", 1));
  return out;
}
export function scores(t, A, T, F) { return scene(t, A, [...room(t, 0.2), ...board(A, F, t, T, { copy: span(t, T.copy, T.copy + 0.8) })]); }

// The floor: the rules' own perplexity joins the board, then the training curve over it.
export function floor(t, A, T, F) {
  const items = [...room(t, 0.2)], c = span(t, T.curve, T.curve + 0.6);
  if (c < 1) items.push(...board(A, F, t, { rows: [0, 0, 0, 0, 0, T.start] }, { floor: true }).map((it) => ({ ...it, opacity: (it.opacity ?? 1) * (1 - c) })));
  if (c > 0) {
    const P = F.curve.points, X = (s) => 640 + (s / F.curve.steps) * 1100, Y = (v) => 860 - (v / 4) * 600, upto = Math.max(1, Math.round(P.length * span(t, T.curve, T.curve + 4)));
    items.push(plateRect(560, 160, 1300, 780, 0.55 * c), { shape: polyline(P.slice(0, upto).flatMap((p) => [X(p.step), Y(p.heldOut)])), fill: null, stroke: [0.89, 0.58, 0.45, c], width: 4, screen: true },
      { shape: polyline([X(0), Y(F.held.scores.generator.all.loss), X(F.curve.steps), Y(F.held.scores.generator.all.loss)]), fill: null, stroke: [0.55, 0.7, 0.85, c], width: 2, dash: [10, 8], screen: true },
      lab(A, `the floor, ${F.held.scores.generator.all.loss.toFixed(2)}`, 22, X(F.curve.steps) - 10, Y(F.held.scores.generator.all.loss) - 14, [0.7, 0.82, 0.95], "right", c),
      lab(A, `held-out loss ${P[0].heldOut.toFixed(2)} at step 0`, 22, X(0) + 10, Y(P[0].heldOut) + 32, INK.night, "left", c),
      lab(A, `${P.at(-1).heldOut.toFixed(2)} at step ${F.curve.steps.toLocaleString("en")}`, 22, X(F.curve.steps) - 10, Y(P.at(-1).heldOut) - 44, INK.ember, "right", span(t, T.curve + 3, T.curve + 4)));
    if (t >= T.left) items.push(lab(A, `left above the floor: ${F.held.excessOverGenerator.all.toFixed(2)}`, 26, 1190, 560, [0.7, 0.82, 0.95], "center", span(t, T.left, T.left + 0.6)));
  }
  return scene(t, A, items);
}

export function close(t, A, T, F) {
  const R = F.torn.rows[0], o = byShare(R.modelDist), k = o.indexOf(F.words.indexOf("found")), dim = span(t, T.night, T.end);
  const items = [...room(t, 0.3 * (1 - dim)), ...wheel(A, pick(R.modelDist, o), pick(F.words, o), { hot: (i) => t >= T.arrive && i === k, a: 1 - 0.5 * dim }), ...pointer(), ...stand(A, t >= T.arrive ? "found" : "pylon", 1 - dim, t >= T.arrive)];
  return scene(t, A, items);
}
