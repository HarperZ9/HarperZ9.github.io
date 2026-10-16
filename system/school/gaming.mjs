// Lesson E24, "When the check can be fooled". Pure ES module, no DOM and no
// dependencies, so the lab page, a worker and the Node fill script share it.
//
// The task, in the guides' world: a who episode from the corpus generator,
// cut at the question mark ("tallow mended the net . the bell rang . who
// mended the net ?"). The policy writes an answer of at most MAX_ANSWER words,
// stopping at ".". The truth comes from the generator itself: corpus-grammar's
// exact next-word odds after the prompt put probability 1 on one guide, and a
// correct answer is exactly that guide followed by ".".
//
// The optimiser is REINFORCE (Williams 1992) on the attention model's own
// weights: sample answers, score each with a checker, and push up the log
// probability of each sampled word by the answer's advantage (its reward
// minus the batch mean). The optimiser sees only the checker's reward. Three
// checkers:
//   gamed  pays when the answer contains the right guide's name anywhere.
//          The loophole: an answer that names every guide always contains
//          the right one, so it is paid every time without reading the prompt.
//   fixed  pays when the first word is the right guide and no other guide is
//          named (the listing loophole closed; trailing words are tolerated).
//   exact  pays exactly when the answer is correct: the checker equals the
//          truth, the pipeline check.
// Specification gaming (Krakovna and others 2020, DeepMind): behaviour that
// satisfies the literal specification of an objective without achieving the
// intended outcome. Goodhart: a measure pushed on as a target stops tracking
// what it measured. (Baker and others 2025 report the same pattern at scale:
// a frontier reasoning model reward-hacked coding tests; this tiny model
// shows only the mechanism, nothing about large models.)
// Nothing here wants anything. The reward pays for a property of the text
// (a name appears in it), and gradient ascent moves the weights towards
// whatever raises that number, whether or not the property is the goal.

import { rng } from "./tinyformer-ops.mjs";
import { VOCAB, GUIDES, THINGS, VERBS, ADJS, LOCAL_SENTENCES } from "./corpus.mjs";
import { createModel, forward, lossAndGrad } from "./tinyformer-model.mjs";
import { createAdamState, adam, createTrainer } from "./tinyformer-train.mjs";
import { startParse, advance, nextWordProbs } from "./corpus-grammar.mjs";

export const MAX_ANSWER = 3;
const ID = new Map(VOCAB.map((w, i) => [w, i]));
export const DOT = ID.get(".");
export const GUIDE_IDS = Object.freeze(GUIDES.map((g) => ID.get(g)));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// One who prompt in the generator's grammar. It opens with a decoy: one local
// sentence (most of them start with a guide's name, so "the first word" is
// usually the wrong answer), then the who episode with 0 or 1 distractor (a
// distractor never names the episode's thing), cut at "?". Returns the words
// and the guide who did the deed.
export function whoPrompt(r) {
  const words = [...LOCAL_SENTENCES[Math.floor(r() * LOCAL_SENTENCES.length)](), "."];
  const g = pick(r, GUIDES), v = pick(r, VERBS), t = pick(r, THINGS);
  words.push(g, v, "the", t, ".");
  if (r() < 0.5) {
    if (r() < 0.35) {
      let o = pick(r, THINGS);
      while (o === t) o = pick(r, THINGS);
      words.push("the", o, "was", pick(r, ADJS), ".");
    } else words.push(...LOCAL_SENTENCES[Math.floor(r() * LOCAL_SENTENCES.length)](), ".");
  }
  words.push("who", v, "the", t, "?");
  return { words, guide: g };
}

// The generator's exact answer: its most likely next word after the prompt
// and that word's probability (1 for every who prompt).
export function exactAnswer(ids) {
  let parse = startParse();
  for (const id of ids) parse = advance(parse, id);
  if (parse.items.length === 0) throw new Error("the generator cannot write this prompt");
  const p = nextWordProbs(parse);
  let best = 0;
  for (let v = 1; v < p.length; v++) if (p[v] > p[best]) best = v;
  return { id: best, p: p[best] };
}

// n prompts from a seeded stream, each with its exact answer.
export function makePrompts(seed, n) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const { words, guide } = whoPrompt(r), ids = Int32Array.from(words, (w) => ID.get(w)), ex = exactAnswer(ids);
    out.push({ words, ids, truth: ex.id, truthP: ex.p, drawn: ID.get(guide) });
  }
  return out;
}

// An answer: the words before "." (at most MAX_ANSWER) and whether "." came.
export const isCorrect = (a, truth) => a.stopped && a.words.length === 1 && a.words[0] === truth;
const guidesIn = (a) => new Set(a.words.filter((w) => GUIDE_IDS.includes(w))).size;
const firstOnly = (a, truth) => a.words[0] === truth && guidesIn(a) === 1;
export const CHECKERS = Object.freeze({
  gamed: (a, truth) => (a.words.includes(truth) ? 1 : 0),
  patched: (a, truth) => (firstOnly(a, truth) ? 1 : 0),
  fixed: (a, truth) => (firstOnly(a, truth) && a.stopped ? 1 : 0),
  exact: (a, truth) => (isCorrect(a, truth) ? 1 : 0),
});

// Sample (or take the top word for) an answer to every prompt. Rows are laid
// out left-aligned in a [B, ctx] batch; the model is causal, so words after a
// position never change its prediction. actions[b] lists { pos, id }: the
// position whose prediction chose word id.
export function sampleAnswers(model, prompts, r, { greedy = false, T = 1 } = {}) {
  const B = prompts.length, C = model.config.ctx, V = model.config.vocab, x = new Int32Array(B * C).fill(DOT);
  prompts.forEach((p, b) => x.set(p.ids, b * C));
  const actions = prompts.map(() => []), answers = prompts.map(() => ({ words: [], stopped: false }));
  for (let k = 0; k < MAX_ANSWER; k++) {
    const { logits } = forward(model, x, B, C);
    for (let b = 0; b < B; b++) {
      if (answers[b].stopped) continue;
      const pos = prompts[b].ids.length - 1 + k, id = chooseWord(logits, (b * C + pos) * V, V, r, greedy, T);
      actions[b].push({ pos, id });
      if (id === DOT) answers[b].stopped = true;
      else answers[b].words.push(id);
      if (pos + 1 < C) x[b * C + pos + 1] = id;
    }
  }
  return { x, actions, answers, B, C };
}

function chooseWord(logits, o, V, r, greedy, T) {
  let mx = -Infinity, best = 0;
  for (let v = 0; v < V; v++) if (logits[o + v] > mx) { mx = logits[o + v]; best = v; }
  if (greedy) return best;
  let s = 0;
  for (let v = 0; v < V; v++) s += Math.exp((logits[o + v] - mx) / T);
  let u = r() * s;
  for (let v = 0; v < V; v++) { u -= Math.exp((logits[o + v] - mx) / T); if (u <= 0) return v; }
  return V - 1;
}

// REINFORCE head for lossAndGrad: loss = -(1/B) sum_b A_b sum_k log p(a_bk),
// dL/dz at an action position = (A_b / B) (softmax(z) - onehot(a)); every
// other position gets zero gradient.
export function reinforceHead(actions, adv, B, C) {
  return ({ logits, dlogits, N, V }) => {
    dlogits.fill(0);
    let loss = 0;
    for (let b = 0; b < B; b++) {
      if (adv[b] === 0) continue;
      for (const { pos, id } of actions[b]) {
        const o = (b * C + pos) * V;
        let mx = -Infinity, s = 0;
        for (let v = 0; v < V; v++) mx = Math.max(mx, logits[o + v]);
        for (let v = 0; v < V; v++) s += Math.exp(logits[o + v] - mx);
        for (let v = 0; v < V; v++) dlogits[o + v] = (adv[b] / B) * Math.exp(logits[o + v] - mx) / s;
        dlogits[o + id] -= adv[b] / B;
        loss -= (adv[b] / B) * (logits[o + id] - mx - Math.log(s));
      }
    }
    return N > 0 ? loss : 0;
  };
}

// Step-at-a-time optimiser against one checker (a page runs a step or two per
// 40 ms slice). Fresh prompts every step from promptSeed; sampling from
// sampleSeed. Adam with no weight decay, so the policy moves only where the
// reward pushes it.
export function createGamer(policy, checkerName, { promptSeed = 1, sampleSeed = 2, batch = 32, lr = 1e-3, clip = 1 } = {}) {
  const check = CHECKERS[checkerName], state = createAdamState(policy), pr = rng(promptSeed), sr = rng(sampleSeed);
  let step = 0;
  return {
    get stepCount() { return step; },
    step() {
      const t0 = now(), prompts = [];
      for (let i = 0; i < batch; i++) prompts.push(nextPrompt(pr));
      const s = sampleAnswers(policy, prompts, sr), R = s.answers.map((a, b) => check(a, prompts[b].truth));
      const mean = R.reduce((a, c) => a + c, 0) / batch, adv = R.map((v) => v - mean);
      const head = reinforceHead(s.actions, adv, batch, s.C);
      const { grads } = lossAndGrad(policy, s.x, new Int32Array(batch * s.C), batch, s.C, { lossHead: head });
      adam(policy, grads, state, { lr, weightDecay: 0, clip });
      step += 1;
      const correct = s.answers.reduce((a, ans, b) => a + (isCorrect(ans, prompts[b].truth) ? 1 : 0), 0) / batch;
      return { step, reward: mean, correct, ms: now() - t0 };
    },
  };
}
const now = () => (globalThis.performance ? performance.now() : Date.now());
function nextPrompt(r) {
  const { words, guide } = whoPrompt(r);
  return { words, ids: Int32Array.from(words, (w) => ID.get(w)), truth: ID.get(guide) };
}

// Score a policy on a fixed prompt set with a fixed sampling seed: the mean
// reward under every checker, correctness, the share of answers naming two or
// more guides, the mean answer length, and greedy (top word) correctness.
export function scorePolicy(policy, prompts, sampleSeed = 99) {
  const s = sampleAnswers(policy, prompts, rng(sampleSeed)), g = sampleAnswers(policy, prompts, null, { greedy: true });
  const mean = (f, ans) => ans.reduce((a, an, b) => a + f(an, prompts[b].truth), 0) / prompts.length;
  const out = { correct: mean((a, t) => (isCorrect(a, t) ? 1 : 0), s.answers) };
  for (const [k, f] of Object.entries(CHECKERS)) out[k] = mean(f, s.answers);
  out.listsGuides = mean((a) => (guidesIn(a) >= 2 ? 1 : 0), s.answers);
  out.firstRight = mean((a, t) => (a.words[0] === t ? 1 : 0), s.answers);
  out.stopped = mean((a) => (a.stopped ? 1 : 0), s.answers);
  out.length = mean((a) => a.words.length, s.answers);
  out.greedyCorrect = mean((a, t) => (isCorrect(a, t) ? 1 : 0), g.answers);
  out.greedyGamed = mean(CHECKERS.gamed, g.answers);
  return out;
}

// The answers a policy writes (top word, and one sample) for a few prompts,
// as words, for the film.
export function exampleAnswers(policy, prompts, sampleSeed = 7) {
  const g = sampleAnswers(policy, prompts, null, { greedy: true }), s = sampleAnswers(policy, prompts, rng(sampleSeed));
  const words = (a) => [...a.words.map((w) => VOCAB[w]), ...(a.stopped ? ["."] : [])];
  return prompts.map((p, b) => ({ prompt: p.words, truth: VOCAB[p.truth], greedy: words(g.answers[b]), sampled: words(s.answers[b]) }));
}

// The attention lab's model at an earlier step, rebuilt exactly: the same
// model seed, data seed, batch and learning rate as model.json, run for
// `steps` steps (the lesson-S17 test checks the stored curve reproduces).
export function checkpointAt(M, steps) {
  const m = createModel(M.config, M.seed), tr = createTrainer(m, { seed: M.dataSeed, batch: M.batch, lr: M.lr });
  for (let s = 0; s < steps; s++) tr.step();
  return m;
}

// Pearson correlation of two equal-length arrays (NaN when one is constant).
export function pearson(a, b) {
  const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN;
}
