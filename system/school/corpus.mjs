// Seeded training text for the attention lab, set in the guides' worlds.
//
// Tallow is a night clerk whose head is a candle and who keeps a lighthouse
// lamp. Pylon is a harbour seal who works the dock and puts traffic cones on
// unchecked claims. Rerun is a hermit crab with a glass prism shell who knocks
// on shells on the beach.
//
// The text mixes two kinds of next-word problems on purpose:
//  - look-back ("copy") targets, where the right word can only be found by
//    reading an earlier position, which is the job attention does;
//  - local targets, where the previous word or two settle the answer.
// Every generated token carries a flag saying which kind it is as a target,
// plus the position of its source word when it is a copy, so the lab can
// score the two kinds separately and check where the heads look.
//
// Token conventions: word level, lower case, "." and "?" are tokens.
// VOCAB[0] is "." and there is no padding token: every training window is
// cut from a stream of whole episodes, so no position is ever empty.

import { rng } from "./tinyformer-ops.mjs";

export const GUIDES = ["tallow", "pylon", "rerun"];
export const THINGS = ["crate", "shell", "lamp", "rope", "boat", "map", "card", "kettle", "net", "bell"];
export const VERBS = ["checked", "carried", "mended", "painted", "counted", "dropped"];
export const ADJS = ["wet", "old", "cold", "bright", "empty", "red"];
const GLUE = [".", "?", "the", "a", "who", "found", "put", "cone", "on", "was"];
const LOCAL_WORDS = ["lit", "kept", "knocked", "twice", "watched", "stood", "dock", "rang", "tide", "came", "in"];

export const VOCAB = [...GLUE, ...GUIDES, ...THINGS, ...VERBS, ...ADJS, ...LOCAL_WORDS];
const INDEX = new Map(VOCAB.map((w, i) => [w, i]));

export function encode(words) {
  return Int32Array.from(words, (w) => {
    const id = INDEX.get(w);
    if (id === undefined) throw new Error("word not in VOCAB: " + w);
    return id;
  });
}

export function decode(ids) {
  return Array.from(ids, (i) => VOCAB[i]);
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// A token record: word, whether it is a look-back target, and the offset
// (inside its episode) of the word it copies from, or -1.
const tok = (w, src = -1) => ({ w, src });

// Plain sentences that need only local context. Character specific, so the
// guide's name predicts the verb that follows it.
export const LOCAL_SENTENCES = [
  () => ["tallow", "lit", "the", "lamp"],
  () => ["tallow", "kept", "the", "lamp", "bright"],
  () => ["rerun", "knocked", "twice"],
  () => ["rerun", "knocked", "on", "a", "shell"],
  () => ["pylon", "watched", "the", "dock"],
  () => ["pylon", "stood", "on", "the", "dock"],
  () => ["the", "bell", "rang"],
  () => ["the", "tide", "came", "in"],
];

// One distractor sentence. `avoid` is a thing the distractor must not name,
// so the look-back answer of the episode stays unambiguous.
function distractor(r, avoid) {
  if (r() < 0.35) {
    let t = pick(r, THINGS);
    while (t === avoid) t = pick(r, THINGS);
    return ["the", t, "was", pick(r, ADJS), "."];
  }
  const s = pick(r, LOCAL_SENTENCES)();
  return [...s, "."];
}

function pushWords(out, words) {
  for (const w of words) out.push(tok(w));
}

// Copy / induction: "<g> found a <t> . [distractors] pylon put a cone on the <t> ."
function copyEpisode(r) {
  const g = pick(r, GUIDES), t = pick(r, THINGS);
  const out = [];
  pushWords(out, [g, "found", "a"]);
  const src = out.length;
  out.push(tok(t), tok("."));
  const nd = Math.floor(r() * 3);
  for (let i = 0; i < nd; i++) pushWords(out, distractor(r, t));
  pushWords(out, ["pylon", "put", "a", "cone", "on", "the"]);
  out.push(tok(t, src), tok("."));
  return out;
}

// Who-did-it: "<g> <v> the <t> . [distractors] who <v> the <t> ? <g> ."
// The verb, the thing and the answer are all look-back targets. Distractors
// never use VERBS, so exactly one earlier sentence answers the question.
function whoEpisode(r) {
  const g = pick(r, GUIDES), v = pick(r, VERBS), t = pick(r, THINGS);
  const out = [tok(g), tok(v), tok("the"), tok(t), tok(".")];
  const nd = Math.floor(r() * 3);
  for (let i = 0; i < nd; i++) pushWords(out, distractor(r, t));
  out.push(tok("who"), tok(v, 1), tok("the"), tok(t, 3), tok("?"), tok(g, 0), tok("."));
  return out;
}

function plainEpisode(r) {
  const out = [];
  const n = 1 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) pushWords(out, [...pick(r, LOCAL_SENTENCES)(), "."]);
  return out;
}

function episode(r) {
  const u = r();
  if (u < 0.4) return copyEpisode(r);
  if (u < 0.8) return whoEpisode(r);
  return plainEpisode(r);
}

// One episode as a list of words, for display.
export function sampleSentence(r) {
  return episode(r).map((t) => t.w);
}

// A stream of whole episodes of at least `len` tokens. Each record keeps the
// absolute source position of a copy target.
function stream(r, len) {
  const out = [];
  while (out.length < len) {
    const base = out.length;
    for (const t of episode(r)) out.push({ w: t.w, src: t.src >= 0 ? base + t.src : -1 });
  }
  return out;
}

// Next-token batch. x[i] is the input word at position i of a row and y[i]
// is the word after it. kind[i] is 1 when y[i] is a look-back target and src[i]
// is the row position (in x) of the word it copies, else -1.
export function makeBatch(r, batch, ctx) {
  const n = batch * ctx;
  const x = new Int32Array(n), y = new Int32Array(n);
  const kind = new Uint8Array(n), src = new Int32Array(n).fill(-1);
  for (let b = 0; b < batch; b++) {
    const s = stream(r, ctx + 1);
    for (let i = 0; i < ctx; i++) {
      const o = b * ctx + i;
      x[o] = INDEX.get(s[i].w);
      y[o] = INDEX.get(s[i + 1].w);
      if (s[i + 1].src >= 0) { kind[o] = 1; src[o] = s[i + 1].src; }
    }
  }
  return { x, y, kind, src, batch, ctx };
}

// Fixed held-out set. Its seed differs from any training seed the lab uses
// (training seeds are small integers), so the rows are fresh draws.
export const HELD_OUT_SEED = 0x5eed0bad;
export function heldOut(n, ctx = 24) {
  return makeBatch(rng(HELD_OUT_SEED), n, ctx);
}

// Cross-entropy (nats per token) of a unigram model fitted on `train` with
// add-one smoothing, scored on `evalSet`. This is the "knows word frequencies
// only" baseline that any model using context must beat.
export function unigramCrossEntropy(train, evalSet) {
  const counts = new Float64Array(VOCAB.length).fill(1);
  for (const id of train.y) counts[id]++;
  let total = 0;
  for (const c of counts) total += c;
  let loss = 0;
  for (const id of evalSet.y) loss -= Math.log(counts[id] / total);
  return loss / evalSet.y.length;
}

// Hand-picked probes for the film and the lab. `query` is the position whose
// next-word prediction is shown; `answer` is the right next word; `answerFrom`
// is the earlier position that the answer depends on.
export const PROBES = [
  { words: ["rerun", "found", "a", "kettle", ".", "pylon", "put", "a", "cone", "on", "the"],
    query: 10, answer: "kettle", answerFrom: 3, kind: "copy",
    note: "Copy: the cone goes on the thing Rerun found seven words back." },
  { words: ["tallow", "found", "a", "map", ".", "the", "bell", "rang", ".", "pylon", "put", "a", "cone", "on", "the"],
    query: 14, answer: "map", answerFrom: 3, kind: "copy",
    note: "Copy past a distractor: bell is the nearer thing, but map was found." },
  { words: ["pylon", "checked", "the", "crate", ".", "the", "bell", "rang", ".", "who", "checked", "the", "crate", "?"],
    query: 13, answer: "pylon", answerFrom: 0, kind: "copy",
    note: "Who did it: the answer is the name at the start of the matching sentence." },
  { words: ["tallow", "mended", "the", "net", ".", "rerun", "knocked", "twice", ".", "who", "mended", "the"],
    query: 11, answer: "net", answerFrom: 3, kind: "copy",
    note: "Which thing: the question repeats the verb, so the object must be looked up." },
  { words: ["rerun", "painted", "the", "boat", ".", "pylon", "watched", "the", "dock", ".", "the", "rope", "was", "wet", ".", "who", "painted", "the", "boat", "?"],
    query: 19, answer: "rerun", answerFrom: 0, kind: "copy",
    note: "Long distance: another guide is named in between, and the answer is 19 words back." },
  { words: ["pylon", "watched", "the", "dock", ".", "tallow", "lit", "the"],
    query: 7, answer: "lamp", answerFrom: 6, kind: "local",
    note: "Local: after 'lit the' the next word is lamp; the previous word is enough." },
];
