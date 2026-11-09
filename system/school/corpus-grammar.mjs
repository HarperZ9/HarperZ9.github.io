// The corpus generator run backwards, for lessons L9 and L15. corpus.mjs
// writes text as a stream of whole episodes with known probabilities; this
// file parses words with the same rules and the same probabilities. It
// answers two questions exactly:
//   - could the generator have written these words? (L15 grammar check)
//   - what is the generator's own probability for the next word? (L9: the
//     best loss any model can reach on this text, the floor under the loss)
//
// Sentence units and episode rules, read off corpus.mjs:
//   L  a local sentence + "."                 (LOCAL_SENTENCES, 1/8 each)
//   D  "the <t> was <adj> ."                  distractor; never the episode's thing
//   F  "<g> found a <t> ."                    opens a copy episode
//   P  "pylon put a cone on the <t> ."        closes it; <t> must be the found thing
//   W  "<g> <v> the <t> ."                    opens a who episode
//   Q  "who <v> the <t> ? <g> ."              closes it; v, t and g must match W
// episode: copy 0.4 = F, 0 to 2 distractors (1/3 each), P
//          who  0.4 = W, 0 to 2 distractors, Q
//          plain 0.2 = one or two L (1/2 each)
// distractor: D with probability 0.35 (thing uniform over the other 9, adj
// uniform over 6), else L. Every training and held-out row starts at an
// episode boundary, so a parse starts in state "start".

import { VOCAB, GUIDES, THINGS, VERBS, ADJS, LOCAL_SENTENCES } from "./corpus.mjs";

const LOCALS = LOCAL_SENTENCES.map((f) => [...f(), "."]);
const ID = new Map(VOCAB.map((w, i) => [w, i]));
const opt = (words, p, next) => ({ ids: words.map((w) => ID.get(w)), p, next });
const P_D = 0.35, NDIST = 3;

function distractors(avoid, next) {
  const out = LOCALS.map((w) => opt(w, (1 - P_D) / LOCALS.length, next));
  for (const t of THINGS) if (t !== avoid) for (const a of ADJS) out.push(opt(["the", t, "was", a, "."], P_D / (THINGS.length - 1) / ADJS.length, next));
  return out;
}

function startOptions() {
  const out = [];
  for (const w of LOCALS) { out.push(opt(w, 0.2 * 0.5 / LOCALS.length, "start"), opt(w, 0.2 * 0.5 / LOCALS.length, "plain1")); }
  for (const g of GUIDES) for (const t of THINGS) for (let n = 0; n < NDIST; n++)
    out.push(opt([g, "found", "a", t, "."], 0.4 / GUIDES.length / THINGS.length / NDIST, `copy|${t}|${n}`));
  for (const g of GUIDES) for (const v of VERBS) for (const t of THINGS) for (let n = 0; n < NDIST; n++)
    out.push(opt([g, v, "the", t, "."], 0.4 / GUIDES.length / VERBS.length / THINGS.length / NDIST, `who|${g}|${v}|${t}|${n}`));
  return out;
}

// The sentences a state allows, each with its probability and next state.
function options(state) {
  if (state === "start") return startOptions();
  if (state === "plain1") return LOCALS.map((w) => opt(w, 1 / LOCALS.length, "start"));
  const parts = state.split("|"), rem = Number(parts.at(-1));
  if (parts[0] === "copy") {
    const t = parts[1];
    return rem > 0 ? distractors(t, `copy|${t}|${rem - 1}`) : [opt(["pylon", "put", "a", "cone", "on", "the", t, "."], 1, "start")];
  }
  const [, g, v, t] = parts;
  return rem > 0 ? distractors(t, `who|${g}|${v}|${t}|${rem - 1}`) : [opt(["who", v, "the", t, "?", g, "."], 1, "start")];
}

const memo = new Map();
function optionsOf(state) {
  let o = memo.get(state);
  if (!o) { o = options(state); memo.set(state, o); }
  return o;
}

const expand = (state, w) => optionsOf(state).map((o) => ({ o, i: 0, w: w * o.p }));

// A parse: weighted items (sentence option, position inside it, weight).
// Weights are renormalised after each word; logProb keeps the total.
export function startParse() {
  return { items: expand("start", 1), logProb: 0 };
}

// Distribution of the next word id under the generator (Float64Array).
export function nextWordProbs(parse, V = VOCAB.length) {
  const p = new Float64Array(V);
  let tot = 0;
  for (const { o, i, w } of parse.items) { p[o.ids[i]] += w; tot += w; }
  if (tot > 0) for (let v = 0; v < V; v++) p[v] /= tot;
  return p;
}

// Consume one word id. Items stay distinct; a completed sentence opens its
// next state once, with the summed weight of every parse that reached it.
export function advance(parse, id) {
  const next = [], opened = new Map();
  let tot = 0;
  for (const { o, i, w } of parse.items) {
    if (o.ids[i] !== id) continue;
    tot += w;
    if (i + 1 < o.ids.length) next.push({ o, i: i + 1, w });
    else opened.set(o.next, (opened.get(o.next) ?? 0) + w);
  }
  for (const [s, w] of opened) next.push(...expand(s, w));
  let all = 0;
  for (const it of parse.items) all += it.w;
  for (const it of next) it.w /= tot || 1;
  return { items: next, logProb: parse.logProb + Math.log(tot / all) };
}

// Could the generator have written these words (as the start of a stream)?
// failAt is the index of the first word no parse explains, or -1.
export function grammarCheck(words) {
  let parse = startParse();
  for (let k = 0; k < words.length; k++) {
    const id = typeof words[k] === "number" ? words[k] : ID.get(words[k]);
    parse = advance(parse, id);
    if (parse.items.length === 0) return { ok: false, failAt: k, logProb: -Infinity };
  }
  return { ok: true, failAt: -1, logProb: parse.logProb };
}

// The generator's own next-word probabilities for every position of a batch
// whose rows start at an episode boundary: [B * T, V], the ideal predictor.
export function trueTable(batch, V = VOCAB.length) {
  const { x, ctx: T } = batch, B = x.length / T, P = new Float64Array(x.length * V);
  for (let b = 0; b < B; b++) {
    let parse = startParse();
    for (let t = 0; t < T; t++) {
      parse = advance(parse, x[b * T + t]);
      if (parse.items.length === 0) throw new Error(`row ${b} position ${t}: the generator cannot write this row`);
      P.set(nextWordProbs(parse, V), (b * T + t) * V);
    }
  }
  return P;
}

// Continuations written by the generator itself, given a prompt that starts
// at an episode boundary: the reference text a decoder should resemble.
// Row b draws from rng-like stream rs[b]. Returns the rows and the mean
// entropy (nats) of the generator's next-word distribution along the way.
export function sampleGenerator(promptIds, maxNew, streams) {
  let base = startParse();
  for (const id of promptIds) base = advance(base, id);
  let h = 0;
  const rows = streams.map((r) => {
    let parse = base;
    const out = new Int32Array(maxNew);
    for (let s = 0; s < maxNew; s++) {
      const p = nextWordProbs(parse), u = r();
      let c = 0, w = 0;
      for (let v = 0; v < p.length; v++) { if (p[v] <= 0) continue; c += p[v]; w = v; if (u < c) break; }
      for (const q of p) if (q > 0) h -= q * Math.log(q);
      out[s] = w; parse = advance(parse, w);
    }
    return out;
  });
  return { rows, entropy: h / (streams.length * maxNew) };
}
