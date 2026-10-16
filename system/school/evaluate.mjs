// Lesson L16, "Evaluating a language model". Pure ES module, no DOM and no
// dependencies, so the lab page, a worker and the Node fill script share it.
//
// One model, one set of held-out rows, three ways to score it:
//   loss    mean next-word loss (nats) over every word of every row;
//   exact   exact match on the words that have one right answer: positions
//           where the corpus generator's own odds put probability 1 on the
//           next word and the word is a look-back target (who answers, the
//           repeated verb and thing of a who question, the thing a copy
//           episode puts the cone on). Right means the model's top word is
//           that word. The truth is exact, read off corpus-grammar.mjs;
//   judge   an automatic scorer of free text: the model writes a
//           continuation of each row's opening words, and a judge says
//           whether it is acceptable. Two judges, a stand-in for an LLM judge:
//             perfect  corpus-grammar's parser: could the generator have
//                      written the prompt plus the continuation? On this
//                      toy language that check is exact, so it is the truth.
//             fluent   a cheap surface judge: every adjacent word pair is a
//                      pair seen in a sample of training text. It reads two
//                      words at a time, so it passes a copy episode that
//                      puts the cone on the wrong thing.
// Each score is a mean over rows, with a row bootstrap interval from
// errorbars.mjs. The pairwise judge and its position and length rules are
// in evaluate-judge.mjs; contaminated training is in evaluate-train.mjs.

import { rng } from "./tinyformer-ops.mjs";
import { VOCAB, GUIDES } from "./corpus.mjs";
import { mixBatch, EP } from "./data.mjs";
import { trueTable, grammarCheck } from "./corpus-grammar.mjs";
import { scoreItems, unitsOf } from "./errorbars.mjs";
import { generate } from "./decoding.mjs";

const ID = new Map(VOCAB.map((w, i) => [w, i]));
export const DOT = ID.get(".");
const GUIDE_SET = new Set(GUIDES.map((g) => ID.get(g)));
export const ONE = 1 - 1e-9;
export const GEN = Object.freeze({ minPrompt: 3, maxPrompt: 10, maxNew: 10 });

// A held-out set: rows from the generator (bit-identical to corpus.makeBatch
// with the same seed), the generator's exact odds at every position, the
// one-right-answer mask (1 who, 2 copy, 0 none) and a prompt length per row
// for the free generation (drawn from its own stream).
export function makeEvalSet(seed, rows, ctx = 24) {
  const set = mixBatch(rng(seed), rows, ctx), V = VOCAB.length, P = trueTable(set, V), N = rows * ctx;
  const one = new Uint8Array(N), lr = rng(seed + 0x51ed);
  for (let n = 0; n < N; n++) if (set.kind[n] && P[n * V + set.y[n]] > ONE) one[n] = set.ep[n] === EP.who ? 1 : 2;
  const promptLen = Int32Array.from({ length: rows }, () => GEN.minPrompt + Math.floor(lr() * (GEN.maxPrompt - GEN.minPrompt + 1)));
  return { ...set, seed, rows, P, one, promptLen };
}

// The row's opening words: x[0..L-1] (the row's first L input words).
export const promptOf = (set, b) => set.x.subarray(b * set.ctx, b * set.ctx + set.promptLen[b]);

// A continuation cut after its first "." (kept); stopped says a "." came.
export function cutAtDot(ids) {
  const k = Array.prototype.indexOf.call(ids, DOT);
  return k < 0 ? { ids: Int32Array.from(ids), stopped: false } : { ids: Int32Array.from(ids.slice(0, k + 1)), stopped: true };
}

// ---- judges ----

export function perfectJudge(prompt, gen) {
  return grammarCheck([...prompt, ...gen]).ok ? 1 : 0;
}

// Word pairs seen in a sample of generator text (the training distribution):
// a Set of a * V + b. Built from rows of a fixed seed, never an eval seed.
export function pairSet(seed = 77, rows = 4096, ctx = 24) {
  const s = mixBatch(rng(seed), rows, ctx), V = VOCAB.length, out = new Set();
  for (let n = 0; n < s.x.length; n++) out.add(s.x[n] * V + s.y[n]);
  return out;
}

export function fluentJudge(prompt, gen, pairs) {
  const V = VOCAB.length, all = [prompt[prompt.length - 1], ...gen];
  for (let i = 1; i < all.length; i++) if (!pairs.has(all[i - 1] * V + all[i])) return 0;
  return 1;
}

// ---- scoring one model on one set ----

// Per-row sums: loss over all words; exact-match right and count over the
// one-answer words, for all, who and copy; and the generation with both
// judges' verdicts. genSeed + b seeds row b's sampling stream (T = 1).
export function scoreRows(model, set, { pairs, genSeed = 500, from = 0, to = set.rows } = {}) {
  const T = set.ctx, sub = sliceSet(set, from, to), items = scoreItems(model, sub), out = [];
  for (let b = 0; b < to - from; b++) {
    const r = { loss: 0, em: 0, emN: 0, who: 0, whoN: 0, copy: 0, copyN: 0 };
    for (let t = 0; t < T; t++) {
      const n = b * T + t, cls = set.one[(from + b) * T + t];
      r.loss += items.loss[n];
      if (!cls) continue;
      r.em += items.right[n]; r.emN += 1;
      if (cls === 1) { r.who += items.right[n]; r.whoN += 1; } else { r.copy += items.right[n]; r.copyN += 1; }
    }
    out.push({ ...r, ...generateAndJudge(model, set, from + b, pairs, genSeed) });
  }
  return out;
}

function sliceSet(set, from, to) {
  const T = set.ctx, a = from * T, z = to * T;
  return { x: set.x.subarray(a, z), y: set.y.subarray(a, z), kind: set.kind.subarray(a, z), batch: to - from, ctx: T };
}

export function generateAndJudge(model, set, b, pairs, genSeed = 500) {
  const prompt = promptOf(set, b), g = generate(model, prompt, { temperature: 1 }, { n: 1, maxNew: GEN.maxNew, seed: genSeed + b });
  const c = cutAtDot(g.rows[0]);
  return { gen: Array.from(c.ids), len: c.ids.length, stopped: c.stopped ? 1 : 0, perfect: perfectJudge(prompt, c.ids), fluent: pairs ? fluentJudge(prompt, c.ids, pairs) : null };
}

// Step-at-a-time scorer for a page: rowsPerStep rows per step (16 rows fit a
// 40 ms slice on a laptop; the fill measures the cost).
export function createScorer(model, set, { pairs, genSeed = 500, rowsPerStep = 16 } = {}) {
  const rows = [];
  return {
    rows,
    get done() { return rows.length >= set.rows; },
    step() { const a = rows.length, z = Math.min(set.rows, a + rowsPerStep); rows.push(...scoreRows(model, set, { pairs, genSeed, from: a, to: z })); return rows.length; },
  };
}

// Row units for errorbars' bootstrap: score = sum(num) / sum(den).
export function units(rows, metric, ctx = 24) {
  const pick = {
    loss: (r) => [r.loss, null], exact: (r) => [r.em, r.emN], who: (r) => [r.who, r.whoN], copy: (r) => [r.copy, r.copyN],
    perfect: (r) => [r.perfect, 1], fluent: (r) => [r.fluent, 1], stopped: (r) => [r.stopped, 1], len: (r) => [r.len, 1],
  }[metric];
  const num = new Float64Array(rows.length), den = new Float64Array(rows.length);
  rows.forEach((r, i) => { const [a, d] = pick(r); num[i] = a; den[i] = d === null ? ctx : d; });
  return { num, den };
}
export const METRICS = Object.freeze(["loss", "exact", "who", "copy", "perfect", "fluent"]);

// The generator itself as a model: its top word at every position. On the
// one-answer words it is right every time (the pipeline check) and its loss
// is the floor (errorbars.generatorItems).
export function generatorExact(set) {
  const V = VOCAB.length;
  let right = 0, n = 0;
  for (let i = 0; i < set.one.length; i++) {
    if (!set.one[i]) continue;
    let best = 0;
    for (let v = 1; v < V; v++) if (set.P[i * V + v] > set.P[i * V + best]) best = v;
    right += best === set.y[i] ? 1 : 0; n += 1;
  }
  return { right, n };
}

// Agreement of two 0/1 judges on the same items: raw agreement, Cohen's kappa
// (agreement beyond what the two marginals give by chance), and the 2 x 2
// counts. a is the reference (the perfect judge).
export function agreement(a, b) {
  const n = a.length;
  let both = 0, onlyA = 0, onlyB = 0, none = 0;
  for (let i = 0; i < n; i++) { if (a[i] && b[i]) both++; else if (a[i]) onlyA++; else if (b[i]) onlyB++; else none++; }
  const po = (both + none) / n, pa = (both + onlyA) / n, pb = (both + onlyB) / n, pe = pa * pb + (1 - pa) * (1 - pb);
  return { n, agree: po, kappa: pe < 1 ? (po - pe) / (1 - pe) : NaN, falseAccept: onlyB / Math.max(1, onlyB + none), falseReject: onlyA / Math.max(1, both + onlyA), counts: { both, onlyPerfect: onlyA, onlyFluent: onlyB, neither: none } };
}

// Words of a row's prompt and continuation, for the film.
export const words = (ids) => Array.from(ids, (i) => VOCAB[i]);
export const isGuide = (id) => GUIDE_SET.has(id);
