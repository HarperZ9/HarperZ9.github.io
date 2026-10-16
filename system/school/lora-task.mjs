// The fine-tuning task for lesson S19, "LoRA and fine-tuning": "things keep
// their look".
//
//   the <t> was <a> . [0 to 2 short sentences] the <t> was <a> .
//
// A thing is described, a few other sentences pass, and the thing is named
// again: it is still what it was, so the second <a> repeats the first. Why
// this task:
//  - it stays in the guides' world and inside the 46-word vocabulary: "the
//    <thing> was <adjective> ." is the corpus's own distractor sentence and
//    the short sentences are the corpus's own local sentences;
//  - the base model never saw the rule. In its corpus every such sentence
//    draws a fresh adjective, so after "the <t> was" it spreads its bet over
//    the six adjectives; and it never saw a thing named twice this way;
//  - every next word has exact odds by construction, so the task has a floor.
// The short sentences are the five local sentences that start with a guide's
// name and name no adjective (so "the" after a full stop always opens the
// repeat, and the answer is the only adjective in reach). The number of short
// sentences is 0, 1 or 2 at a third each.
//
// A first design, two things described and one asked about ("the t1 was a1 .
// the t2 was a2 . the tq was aq"), was dropped after measurement (2026-10-15):
// no method, full fine-tuning included, learned to bind each thing to its own
// adjective in 5,000 steps; all stalled at copying an adjective seen (half
// right). This lesson needs a task the methods can learn, so they can be
// compared on it.
//
// Rows are cut from a stream of whole episodes, so every row starts at an
// episode boundary, as in the corpus.

import { rng } from "./tinyformer-ops.mjs";
import { VOCAB, THINGS, ADJS, LOCAL_SENTENCES } from "./corpus.mjs";

const ID = new Map(VOCAB.map((w, i) => [w, i]));
export const ROLE = Object.freeze({ frame: 0, thing: 1, look: 2, filler: 3, repeatStart: 4, repeatThing: 5, answer: 6 });
const GUIDE_FIRST = new Set(["tallow", "pylon", "rerun"]);
export const FILLERS = LOCAL_SENTENCES.map((f) => f()).filter((w) => GUIDE_FIRST.has(w[0]) && !w.some((x) => ADJS.includes(x)));
const MAX_FILL = 2;
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const uniform = (words) => words.map((w) => [ID.get(w), 1 / words.length]);
const certain = (w) => [[ID.get(w), 1]];

// One episode: tokens with their exact odds given everything before them,
// the role of the word, and (for the answer) the position it copies from.
// Odds of the next word inside a filler sentence, given the words of it so
// far: the fillers are equally likely, so it is the share of fillers that
// continue the prefix with each word.
function fillerOdds(prefix) {
  const fits = FILLERS.filter((f) => prefix.every((w, i) => f[i] === w)), odds = new Map();
  for (const f of fits) { const id = ID.get(f[prefix.length]); odds.set(id, (odds.get(id) ?? 0) + 1 / fits.length); }
  return [...odds];
}

// Odds at a sentence start after the description, with j fillers so far:
// the repeat comes now with probability 1/(3 - j) (0, 1, 2 fillers equally
// likely), else a filler starts.
function startOdds(j) {
  const pr = 1 / (MAX_FILL + 1 - j), out = [[ID.get("the"), pr]];
  if (pr < 1) for (const [id, p] of fillerOdds([])) out.push([id, (1 - pr) * p]);
  return out;
}

function episode(r) {
  const t = pick(r, THINGS), a = pick(r, ADJS), nf = Math.floor(r() * (MAX_FILL + 1));
  const T = (w, odds, role = ROLE.frame, src = -1) => ({ w, odds, role, src });
  const out = [T("the", certain("the")), T(t, uniform(THINGS), ROLE.thing), T("was", certain("was")), T(a, uniform(ADJS), ROLE.look), T(".", certain("."))];
  for (let j = 0; j < nf; j++) {
    const f = pick(r, FILLERS);
    f.forEach((w, i) => out.push(T(w, i === 0 ? startOdds(j) : fillerOdds(f.slice(0, i)), ROLE.filler)));
    out.push(T(".", certain(".")));
  }
  out.push(T("the", startOdds(nf), ROLE.repeatStart), T(t, certain(t), ROLE.repeatThing, 1), T("was", certain("was")), T(a, certain(a), ROLE.answer, 3), T(".", certain(".")));
  return out;
}

function stream(r, len) {
  const out = [];
  while (out.length < len) {
    const base = out.length;
    for (const t of episode(r)) out.push({ ...t, src: t.src >= 0 ? base + t.src : -1 });
  }
  return out;
}

// A batch in corpus.makeBatch's shape, plus role[i] of target y[i] and, with
// withOdds, P: the exact next-word odds [B * ctx, V] (the ideal predictor).
// kind marks the answer (a look-back target) so evaluate() scores it as copy.
export function taskBatch(r, batch, ctx, { withOdds = false } = {}) {
  const n = batch * ctx, V = VOCAB.length, x = new Int32Array(n), y = new Int32Array(n);
  const kind = new Uint8Array(n), src = new Int32Array(n).fill(-1), role = new Uint8Array(n);
  const P = withOdds ? new Float64Array(n * V) : null;
  for (let b = 0; b < batch; b++) {
    const s = stream(r, ctx + 1);
    for (let i = 0; i < ctx; i++) {
      const o = b * ctx + i, t = s[i + 1];
      x[o] = ID.get(s[i].w); y[o] = ID.get(t.w); role[o] = t.role;
      if (t.src >= 0) { kind[o] = 1; src[o] = t.src; }
      if (P) for (const [id, p] of t.odds) P[o * V + id] = p;
    }
  }
  return { x, y, kind, src, role, P, batch, ctx };
}

// A batch source (data.mjs shape) of fresh task rows.
export function taskSource({ seed = 1, batch = 16, ctx = 24 } = {}) {
  const r = rng(seed);
  return { info: { kind: "task", seed }, next: () => taskBatch(r, batch, ctx) };
}

// Held-out task rows, from a seed no training run uses.
export const TASK_HELD_SEED = 0x7a5c0de;
export const taskHeld = (rows, ctx = 24) => taskBatch(rng(TASK_HELD_SEED), rows, ctx, { withOdds: true });

// The floor: mean loss of the exact odds on the set's own targets (nats).
export function taskFloor(set, V = VOCAB.length) {
  let s = 0;
  for (let n = 0; n < set.y.length; n++) s -= Math.log(set.P[n * V + set.y[n]]);
  return s / set.y.length;
}
