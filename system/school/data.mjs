// Lesson L13, "Data: what goes in comes out". Pure ES module, no DOM and no
// dependencies, so a lab page, a worker and the Node fill script share it.
//
// The corpus generator (corpus.mjs) is re-written here with its knobs exposed:
// the share of each episode kind, and which guides may play a role. With the
// default knobs mixBatch draws the same random numbers in the same order as
// corpus.makeBatch and returns the same rows bit for bit (the tests check), so
// corpus.mjs itself is never changed. Each target also carries the kind of
// episode it sits in, so a score can be split by episode.
//
// Batch sources wrap the stream: fresh rows every step (the normal recipe),
// label noise (a share of target words replaced by random words), and a small
// fixed pool of rows repeated for the whole run. trainCurve is trainloop's
// runCurve with the batch source made pluggable.

import { rng, softmaxXent } from "./tinyformer-ops.mjs";
import { VOCAB, GUIDES, THINGS, VERBS, ADJS, LOCAL_SENTENCES } from "./corpus.mjs";
import { forward, lossAndGrad } from "./tinyformer-model.mjs";
import { createAdamState, adam, evaluate } from "./tinyformer-train.mjs";
import { DEFAULTS, lrAt } from "./trainloop.mjs";

export const DEFAULT_MIX = Object.freeze({ copy: 0.4, who: 0.4, plain: 0.2 });
export const EP = Object.freeze({ copy: 1, who: 2, plain: 3 });
const EP_NAMES = ["", "copy", "who", "plain"];
const INDEX = new Map(VOCAB.map((w, i) => [w, i]));
const GUIDE_IDS = new Set(GUIDES.map((g) => INDEX.get(g)));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const tok = (w, src = -1) => ({ w, src });
const pushWords = (out, words) => { for (const w of words) out.push(tok(w)); };

// A spec: episode shares (any non-negative weights) and the guides allowed to
// open a copy episode ("finds") or do the deed in a who episode ("doers").
export function makeSpec({ mix = DEFAULT_MIX, finders = GUIDES, doers = GUIDES } = {}) {
  const sum = mix.copy + mix.who + mix.plain;
  if (!(sum > 0)) throw new Error("episode mix must have a positive total");
  return { mix, c1: mix.copy / sum, c2: (mix.copy + mix.who) / sum, finders, doers };
}
export const DEFAULT_SPEC = makeSpec();

// Share of look-back episodes (copy and who, split evenly), the rest plain.
export const lookbackMix = (f) => ({ copy: f / 2, who: f / 2, plain: 1 - f });

function distractor(r, avoid) {
  if (r() < 0.35) {
    let t = pick(r, THINGS);
    while (t === avoid) t = pick(r, THINGS);
    return ["the", t, "was", pick(r, ADJS), "."];
  }
  return [...pick(r, LOCAL_SENTENCES)(), "."];
}

function copyEpisode(r, spec) {
  const g = pick(r, spec.finders), t = pick(r, THINGS), out = [];
  pushWords(out, [g, "found", "a"]);
  const src = out.length;
  out.push(tok(t), tok("."));
  const nd = Math.floor(r() * 3);
  for (let i = 0; i < nd; i++) pushWords(out, distractor(r, t));
  pushWords(out, ["pylon", "put", "a", "cone", "on", "the"]);
  out.push(tok(t, src), tok("."));
  return out;
}

function whoEpisode(r, spec) {
  const g = pick(r, spec.doers), v = pick(r, VERBS), t = pick(r, THINGS);
  const out = [tok(g), tok(v), tok("the"), tok(t), tok(".")];
  const nd = Math.floor(r() * 3);
  for (let i = 0; i < nd; i++) pushWords(out, distractor(r, t));
  out.push(tok("who"), tok(v, 1), tok("the"), tok(t, 3), tok("?"), tok(g, 0), tok("."));
  return out;
}

function plainEpisode(r) {
  const out = [], n = 1 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) pushWords(out, [...pick(r, LOCAL_SENTENCES)(), "."]);
  return out;
}

function episode(r, spec) {
  const u = r();
  if (u < spec.c1) return [EP.copy, copyEpisode(r, spec)];
  if (u < spec.c2) return [EP.who, whoEpisode(r, spec)];
  return [EP.plain, plainEpisode(r)];
}

function stream(r, len, spec) {
  const out = [];
  while (out.length < len) {
    const base = out.length, [ep, words] = episode(r, spec);
    for (const t of words) out.push({ w: t.w, src: t.src >= 0 ? base + t.src : -1, ep });
  }
  return out;
}

// corpus.makeBatch with a spec. ep[i] is the episode kind of target y[i].
export function mixBatch(r, batch, ctx, spec = DEFAULT_SPEC) {
  const n = batch * ctx, x = new Int32Array(n), y = new Int32Array(n);
  const kind = new Uint8Array(n), src = new Int32Array(n).fill(-1), ep = new Uint8Array(n);
  for (let b = 0; b < batch; b++) {
    const s = stream(r, ctx + 1, spec);
    for (let i = 0; i < ctx; i++) {
      const o = b * ctx + i;
      x[o] = INDEX.get(s[i].w);
      y[o] = INDEX.get(s[i + 1].w);
      ep[o] = s[i + 1].ep;
      if (s[i + 1].src >= 0) { kind[o] = 1; src[o] = s[i + 1].src; }
    }
  }
  return { x, y, kind, src, ep, batch, ctx };
}

// ---- batch sources: { next() -> { x, y }, info } ----

export function freshSource({ seed = 1, batch = 16, ctx = 24, spec = DEFAULT_SPEC } = {}) {
  const r = rng(seed);
  return { info: { kind: "fresh", seed }, next: () => mixBatch(r, batch, ctx, spec) };
}

// Replace each target word with probability `share` by a word drawn uniformly
// from the whole vocabulary (so 1 in 46 replacements is the same word). Inputs
// are left alone. The noise has its own stream, so the clean rows underneath
// are the same rows the clean run sees.
export function noisySource(base, share, noiseSeed = 99) {
  const r = rng(noiseSeed), V = VOCAB.length, info = { ...base.info, noise: share, targets: 0, changed: 0 };
  return {
    info,
    next() {
      const b = base.next(), y = Int32Array.from(b.y);
      for (let i = 0; i < y.length; i++) {
        if (r() < share) { const w = Math.floor(r() * V); if (w !== y[i]) info.changed += 1; y[i] = w; }
      }
      info.targets += y.length;
      return { ...b, y };
    },
  };
}

// A fixed pool of `rows` rows drawn once, served in shuffled passes: every
// row once per pass, a new order each pass. Same tokens per step as fresh.
export function poolSource({ rows, seed = 1, batch = 16, ctx = 24, spec = DEFAULT_SPEC, shuffleSeed = 4242 }) {
  const pool = mixBatch(rng(seed), rows, ctx, spec), r = rng(shuffleSeed);
  let order = [], at = 0, passes = 0;
  const reshuffle = () => {
    order = Array.from({ length: rows }, (_, i) => i);
    for (let i = rows - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    at = 0; passes += 1;
  };
  return {
    pool, info: { kind: "pool", rows, seed }, get passes() { return passes; },
    next() {
      const x = new Int32Array(batch * ctx), y = new Int32Array(batch * ctx);
      for (let b = 0; b < batch; b++) {
        if (at >= order.length) reshuffle();
        const row = order[at++];
        x.set(pool.x.subarray(row * ctx, (row + 1) * ctx), b * ctx);
        y.set(pool.y.subarray(row * ctx, (row + 1) * ctx), b * ctx);
      }
      return { x, y };
    },
  };
}

// ---- scoring ----

// Loss and top-1 accuracy on a set, split by target kind (copy / local), by
// episode kind, and for guide-name answers (look-back targets that are a
// guide's name: the answer of a who episode).
export function scoreSet(model, set) {
  const { x, y, kind, ep, batch: B, ctx: T } = set, V = model.config.vocab, N = B * T;
  const { logits } = forward(model, x, B, T);
  const probs = new Float64Array(N * V);
  softmaxXent(probs, null, logits, y, N, V);
  const acc = {}, add = (k, right, l) => { const a = (acc[k] ??= [0, 0, 0]); a[0] += right; a[1] += 1; a[2] += l; };
  for (let n = 0; n < N; n++) {
    const o = n * V;
    let best = 0;
    for (let v = 1; v < V; v++) if (probs[o + v] > probs[o + best]) best = v;
    const right = best === y[n] ? 1 : 0, l = -Math.log(Math.max(probs[o + y[n]], 1e-30));
    add("all", right, l);
    add(kind[n] ? "lookback" : "local", right, l);
    if (ep) add(`${EP_NAMES[ep[n]]}.${kind[n] ? "lookback" : "local"}`, right, l);
    if (kind[n] && GUIDE_IDS.has(y[n])) add("guideAnswer", right, l);
  }
  const out = {};
  for (const [k, [r, c, l]] of Object.entries(acc)) out[k] = { n: c, accuracy: r / c, loss: l / c };
  return out;
}

// ---- training ----

// trainloop.runCurve with a pluggable batch source and a list of steps to
// score at. Each point has the held-out numbers of evaluate() and, for every
// entry of `extra`, the loss and look-back accuracy on that set. 'train' is
// the mean loss of the batches since the last point, each before its update.
export function trainCurve(model, held, { steps, at, source, extra = {}, ...opts }) {
  const o = { ...DEFAULTS, ...opts }, ctx = model.config.ctx, state = createAdamState(model);
  const marks = new Set(at ?? []);
  marks.add(steps);
  const point = (step, win) => {
    const e = evaluate(model, held);
    const p = { step, train: win.length ? win.reduce((a, b) => a + b, 0) / win.length : null, heldOut: e.loss, copyAccuracy: e.copyAccuracy, localAccuracy: e.localAccuracy };
    for (const [name, set] of Object.entries(extra)) {
      const s = scoreSet(model, set);
      p[name] = { loss: s.all.loss, lookback: s.lookback ? s.lookback.accuracy : null };
    }
    return p;
  };
  const curve = [point(0, [])];
  let win = [];
  for (let s = 1; s <= steps; s++) {
    const { x, y } = source.next();
    const { loss, grads } = lossAndGrad(model, x, y, o.batch, ctx);
    adam(model, grads, state, { lr: lrAt(s - 1, o.lr, o.warmup), weightDecay: o.weightDecay, clip: o.clip });
    win.push(loss);
    if (marks.has(s)) { curve.push(point(s, win)); win = []; }
  }
  return { curve, opts: o, tokensPerStep: o.batch * ctx };
}

// Every `every` steps up to `steps`, as a list for trainCurve's `at`.
export const everySteps = (steps, every) => Array.from({ length: Math.floor(steps / every) }, (_, i) => (i + 1) * every);

// The best held-out loss a model could reach if it learned the noisy targets
// exactly: the generator's probability P mixed with uniform noise of share e,
// scored on the clean targets y. e = 0 gives the generator's own floor.
export function noisyFloor(P, y, e, V = VOCAB.length) {
  let s = 0;
  for (let n = 0; n < y.length; n++) s -= Math.log((1 - e) * P[n * V + y[n]] + e / V);
  return s / y.length;
}

// Distinct rows in a batch-like set (row content as a key).
export function distinctRows(set) {
  const { x, ctx } = set, seen = new Set();
  for (let b = 0; b < x.length / ctx; b++) seen.add(Array.from(x.subarray(b * ctx, (b + 1) * ctx)).join(","));
  return seen.size;
}
