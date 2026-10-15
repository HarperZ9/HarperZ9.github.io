// The decoding film's segments (lesson L15), at Tallow's brass wheel (../../nextword/scene/wheel.mjs).
// Wheels are the model's real next-word shares (lesson L9's facts, NW, and this lesson's shapes);
// every written run is one the fill recorded; every rate is a facts.json value (F).
import { rect, span, label, C, darkness } from "../../shared/lib.mjs";
import { room, host } from "../../embeddings/scene/segs.mjs";
import { WHEEL, INK, wheel, pointer, ring, ribbon, landOn, spin, mix, lab, plateRect } from "../../nextword/scene/wheel.mjs";
import { grammarCheck } from "../../../../system/school/corpus-grammar.mjs";

const byShare = (d) => d.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(([, i]) => i);
const pick = (d, o) => o.map((i) => d[i]);
const scene = (t, A, items) => ({ items: [...items, darkness(380, 700, 1900, 0.35), ...host(t, A)], camera: { x: 960, y: 540, zoom: 1 } });
const open = (F) => F.prompts.find((p) => p.key === "open");
const shape = (F, key) => F.shapes.rows.find((r) => r.key === key);
const toks = (s) => s.split(" ").filter(Boolean);
const pctOf = (v) => `${Math.round(v * 100)}%`;
// The context card above the wheel.
const ctxCard = (A, s, a = 1) => [plateRect(560, 120, 560, 64, 0.6 * a), lab(A, s, 30, 840, 164, INK.night, "center", a)];

export function openScene(t, A, T, F) {
  const lit = span(t, 0.8, 1.6), d = shape(F, "t1").dist, o = byShare(d);
  const items = [...room(t, 0.3 * lit), ...wheel(A, pick(d, o), pick(A.NW.words, o), { turn: t * 0.2, a: 0.5 + 0.5 * lit }), ...pointer(WHEEL, lit)];
  return { items: [...items, darkness(400, 600, 300 + 1200 * lit, 0.95 - 0.5 * lit), ...host(t, A, { flame: lit })], camera: { x: 960, y: 540, zoom: 1.05 - 0.05 * span(t, 0, 4) } };
}
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end)), d = shape(F, "t1").dist, o = byShare(d);
  return scene(t, A, [...room(t), ...wheel(A, pick(d, o), pick(A.NW.words, o), { turn: t * 0.2, a: 0.6 }), ...pointer(), label(A, "Decoding", 100, 960, 105, C.ink, "center", a, "head"), label(A, "turning guesses into sentences", 34, 960, 158, INK.dim, "center", span(t, T.sub, T.sub + 0.6) * a)]);
}

// Greedy: the widest slot every time; the run it writes; why the kettle.
export function greedy(t, A, T, F) {
  const items = [...room(t, 0.3)];
  if (t < T.why) {
    const d = A.NW.torn.rows[0].modelDist, o = byShare(d);
    items.push(...ctxCard(A, "pylon ..."), ...wheel(A, pick(d, o), pick(A.NW.words, o), { hot: (k) => k === 0, pct: (k) => k === 0 }), ...pointer());
    if (t >= T.run) items.push(...ribbon(A, ["pylon", ...toks(open(F).settings.greedy.examples[0])], t, T.run, { x: 560, y: 940, w: 1300, rate: 2.6, hot: (i) => /kettle/.test(toks("pylon " + open(F).settings.greedy.examples[0])[i]) }));
  } else {
    const d = shape(F, "t1").dist, o = byShare(d), truth = A.NW.torn.rows[1].truthDist, kk = o.indexOf(A.NW.words.indexOf("kettle"));
    items.push(...ctxCard(A, "... found a ..."), ...wheel(A, pick(d, o), pick(A.NW.words, o), { hot: (k) => k === kk, pct: (k) => k < 3 }), ...pointer(), ...ring(A, pick(truth, o), pick(A.NW.words, o), { label: "the rules: ten things, one in ten each", a: span(t, T.why + 1, T.why + 2) }));
  }
  return scene(t, A, items);
}

// Sampling: the wheel spins and lands on a real sample's word; the runs it wrote; the strict check.
export function sample(t, A, T, F) {
  const s1 = open(F).settings.t1, d = A.NW.torn.rows[0].modelDist, o = byShare(d), s = pick(d, o), items = [...room(t, 0.3)];
  const first = toks(s1.examples[0])[0], k = o.indexOf(A.NW.words.indexOf(first)), turn = spin(t, T.spin, 3.2, 0, landOn(s, k, 3));
  if (t < T.check) {
    items.push(...ctxCard(A, "pylon ..."), ...wheel(A, s, pick(A.NW.words, o), { turn, hot: (i) => t >= T.spin + 3.2 && i === k }), ...pointer());
    if (t >= T.runs) s1.examples.slice(0, 1).forEach((e, i) => items.push(...ribbon(A, ["pylon", ...toks(e)], t, T.runs + i * 1.2, { y: 900, x: 560, w: 1300, rate: 8, size: 18 })));
    if (t >= T.tally) items.push(lab(A, `${s1.n.toLocaleString("en")} runs: ${s1.distinctTexts.toLocaleString("en")} different texts, ${pctOf(s1.grammatical)} follow the rules`, 28, 560, 1000, INK.night, "left", span(t, T.tally, T.tally + 0.6)));
  } else {
    const bad = open(F).settings.t2.examples.map((e) => ["pylon", ...toks(e)]);
    bad.slice(0, 2).forEach((w, i) => { const g = grammarCheck(w); items.push(...ribbon(A, w, t, T.check + i * 1.5, { y: 380 + i * 170, x: 560, w: 1240, rate: 10, size: 22, hot: (j) => j === g.failAt })); });
    items.push(lab(A, "temperature 2 runs; ember: the first word the rules cannot explain", 24, 560, 300, INK.dim, "left", span(t, T.check, T.check + 0.8)));
  }
  return scene(t, A, items);
}

// Temperature: the same wheel at 0.5, 1 and 2; the rule-following bars; then the cold limit.
export function temperature(t, A, T, F) {
  const r05 = shape(F, "t0.5").dist, r1 = shape(F, "t1").dist, r2 = shape(F, "t2").dist, o = byShare(r1), items = [...room(t, 0.3)];
  const v = span(t, T.hot, T.hot + 2), d = t < T.hot ? mix(r1, r05, span(t, T.cold - 2, T.cold)) : mix(r05, r2, v);
  const temp = t < T.cold ? "1" : t < T.hot ? "0.5" : "2", kk = o.indexOf(A.NW.words.indexOf("kettle"));
  if (t < T.rates || t >= T.zero) {
    const z = t >= T.zero ? shape(F, "greedy").dist : d, oz = t >= T.zero ? byShare(shape(F, "greedy").dist) : o;
    items.push(...ctxCard(A, `tallow found a ...   temperature ${t >= T.zero ? "0.01" : temp}`), ...wheel(A, pick(z, oz), pick(A.NW.words, oz), { hot: (k) => t < T.zero && k === kk, pct: (k) => k < 3 && t < T.zero, a: 1 }), ...pointer());
    if (t >= T.zero + 2) items.push(lab(A, `${open(F).nearZeroTemperature.n} spins at 0.01: ${Math.round(open(F).nearZeroTemperature.sameAsGreedy * open(F).nearZeroTemperature.n)} were the greedy run`, 26, 560, 1000, INK.night, "left", span(t, T.zero + 2, T.zero + 2.6)));
    if (t >= T.kettle && t < T.rates) items.push(lab(A, `kettle: ${pctOf(r05[A.NW.words.indexOf("kettle")])} at 0.5, ${pctOf(r2[A.NW.words.indexOf("kettle")])} at 2`, 26, 560, 1000, INK.night, "left", span(t, T.kettle, T.kettle + 0.6)));
  } else {
    const S = open(F).settings, ks = [["t0.5", "0.5"], ["t1", "1"], ["t1.5", "1.5"], ["t2", "2"], ["generator", "the rules"]];
    items.push(plateRect(540, 200, 1320, 600, 0.55));
    ks.forEach(([k, name], i) => { const a = span(t, T.rows[Math.min(i, 3)], T.rows[Math.min(i, 3)] + 0.6) * (k === "generator" ? span(t, T.rows[3] + 1, T.rows[3] + 2) : 1), y = 260 + i * 100;
      if (a <= 0) return;
      items.push(lab(A, k === "generator" ? name : `temperature ${name}`, 26, 580, y + 24, INK.night, "left", a));
      items.push({ shape: wbar(900, y, 700 * S[k].grammatical), fill: k === "generator" ? [0.55, 0.7, 0.85, a] : [0.89, 0.84, 0.71, a], screen: true }, lab(A, `${pctOf(S[k].grammatical)} follow the rules`, 24, 916 + 700 * S[k].grammatical, y + 24, INK.night, "left", a));
    });
  }
  return scene(t, A, items);
}
const wbar = (x, y, w) => rect(x, y, Math.max(4, w), 32, 3);

// Top-k: the wheel cut to the k widest; top-p: cut by share; the rates and the distinct texts.
function cut(t, A, F, key, caption) {
  const d = shape(F, key).dist, o = byShare(shape(F, "t1").dist);
  return [...ctxCard(A, `tallow found a ...   ${caption}`), ...wheel(A, pick(d, o), pick(A.NW.words, o), { pct: (k) => k < 3 }), ...pointer()];
}
export function topk(t, A, T, F) {
  const items = [...room(t, 0.3), ...(t < T.k3 ? cut(t, A, F, "t1", "every word") : cut(t, A, F, "k3", `top-k, k ${shape(F, "k3").kept}`))];
  if (t >= T.k3) items.push(lab(A, `kept: ${shape(F, "k3").top.slice(0, shape(F, "k3").kept).map((w) => w.word).join(", ")}`, 26, 560, 1000, INK.night, "left", span(t, T.k3, T.k3 + 0.6)));
  return scene(t, A, items);
}
export function topp(t, A, T, F) {
  const S = open(F).settings, p5 = t >= T.p5, items = [...room(t, 0.3), ...(t < T.p9 ? cut(t, A, F, "t1", "every word") : cut(t, A, F, p5 ? "p0.5" : "p0.9", `top-p, p ${p5 ? "0.5" : "0.9"}: ${shape(F, p5 ? "p0.5" : "p0.9").kept} slots`))];
  if (t >= T.rate9 && !p5) items.push(lab(A, `p 0.9: ${pctOf(S["p0.9"].grammatical)} follow the rules`, 26, 560, 1000, INK.night, "left", span(t, T.rate9, T.rate9 + 0.6)));
  if (p5) items.push(lab(A, `p 0.5: ${(S["p0.5"].grammatical * 100).toFixed(1)}% follow the rules`, 26, 560, 960, INK.night, "left", 1));
  if (t >= T.few) items.push(lab(A, `${S["p0.5"].n.toLocaleString("en")} runs, ${S["p0.5"].distinctTexts.toLocaleString("en")} different texts (temperature 1: ${S.t1.distinctTexts.toLocaleString("en")})`, 26, 560, 1010, INK.ember, "left", span(t, T.few, T.few + 0.6)));
  return scene(t, A, items);
}

// The tail: the thin slivers in ember; top-p 0.9 drops them; the two rates; the perplexity check.
export function tail(t, A, T, F) {
  const S = open(F).settings, o = byShare(shape(F, "t1").dist), drop = span(t, T.top, T.top + 2), d = mix(shape(F, "t1").dist, shape(F, "p0.9").dist, drop), kept = shape(F, "p0.9").kept;
  const items = [...room(t, 0.3), ...ctxCard(A, "tallow found a ..."), ...wheel(A, pick(d, o), pick(A.NW.words, o), { tail: (k) => k >= kept && t >= T.start + 2 }), ...pointer()];
  if (t >= T.small) items.push(lab(A, `temperature 1: ${pctOf(S.t1.unseenPair)} of runs hold a word pair never seen in training`, 24, 560, 960, INK.ember, "left", span(t, T.small, T.small + 0.6)));
  if (t >= T.top) items.push(lab(A, `top-p 0.9: ${pctOf(S["p0.9"].unseenPair)}; follow the rules ${pctOf(S.t1.grammatical)} to ${pctOf(S["p0.9"].grammatical)}`, 24, 560, 1000, INK.night, "left", span(t, T.top, T.top + 0.6)));
  if (t >= T.ppl) items.push(lab(A, `per step, scored by the model: its own runs ${S.t1.modelPerplexity.toFixed(2)}, the rules' runs ${S.generator.modelPerplexity.toFixed(2)}`, 24, 560, 1040, INK.dim, "left", span(t, T.ppl, T.ppl + 0.6)));
  return scene(t, A, items);
}

export function close(t, A, T, F) {
  const dim = span(t, T.night, T.end), d = A.NW.torn.rows[0].modelDist, o = byShare(d), s1 = open(F).settings.t1;
  const items = [...room(t, 0.3 * (1 - dim)), ...wheel(A, pick(d, o), pick(A.NW.words, o), { turn: t * 0.4, a: 1 - 0.5 * dim }), ...pointer(WHEEL, 1 - dim)];
  items.push(...ribbon(A, ["pylon", ...toks(s1.examples[1])], t, T.start, { y: 960, x: 560, w: 1300, rate: 4, size: 20, a: 1 - dim }));
  return scene(t, A, items);
}
