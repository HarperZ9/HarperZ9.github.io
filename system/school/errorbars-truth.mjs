// The corpus generator's expected loss per next word, computed exactly, for
// lesson E23's coverage check. Pure ES module, no dependencies.
//
// A held-out row is ctx + 1 words written from an episode boundary. At
// position t the generator's loss is -log P(word t+1 | words 0..t), and its
// expectation given the words so far is the entropy of the generator's
// next-word odds there. So the expected loss averaged over the row is
//   truth = (1 / ctx) * sum_{t=1..ctx} E[ H(next word | first t words) ]
// where the expectation runs over every way the generator can write the
// first t words. Enumerating word strings is too many; but the parse state
// after t words (corpus-grammar.mjs: weighted items, sentence option and
// position) is all the future depends on, so the strings that reach the same
// state are merged and their probabilities added. Layer t holds every
// distinct state with its total probability; about 40,000 states at t = 24.
// The state key is the sorted list of (option, position, weight to 10
// significant digits). mergeBy "lastWord" merges every string that ends in the
// same word (keeping the first parse): a wrong merge, the control that the
// test must catch.

import { startParse, advance, nextWordProbs } from "./corpus-grammar.mjs";

const ids = new WeakMap();
let nextId = 0;
const optionId = (o) => {
  let i = ids.get(o);
  if (i === undefined) { i = nextId++; ids.set(o, i); }
  return i;
};

function stateKey(parse, word, mergeBy) {
  if (mergeBy === "lastWord") return String(word);
  return parse.items.map((it) => `${optionId(it.o)}:${it.i}:${it.w.toPrecision(10)}`).sort().join(",");
}

const entropy = (p) => { let h = 0; for (const q of p) if (q > 0) h -= q * Math.log(q); return h; };

function nextLayer(layer, mergeBy) {
  const next = new Map();
  for (const { parse, mass } of layer.values()) {
    const p = nextWordProbs(parse);
    for (let v = 0; v < p.length; v++) {
      if (!(p[v] > 0)) continue;
      const np = advance(parse, v), k = stateKey(np, v, mergeBy), cur = next.get(k);
      if (cur) cur.mass += mass * p[v];
      else next.set(k, { parse: np, mass: mass * p[v] });
    }
  }
  return next;
}

// Returns { mean, perPosition (ctx values), states (per layer), mass (the
// total probability of the last layer, 1 up to rounding) }.
export function generatorExpectedLoss(ctx = 24, { mergeBy = "state" } = {}) {
  let layer = new Map([["", { parse: startParse(), mass: 1 }]]);
  const perPosition = [], states = [];
  for (let t = 1; t <= ctx; t++) {
    layer = nextLayer(layer, mergeBy);
    let h = 0;
    for (const { parse, mass } of layer.values()) h += mass * entropy(nextWordProbs(parse));
    perPosition.push(h);
    states.push(layer.size);
  }
  let mass = 0;
  for (const { mass: m } of layer.values()) mass += m;
  return { mean: perPosition.reduce((a, b) => a + b, 0) / ctx, perPosition, states, mass };
}

// The same expectation by brute force over every word string (no merging),
// for short rows only: the reference the merged version is checked against.
export function bruteExpectedLoss(ctx) {
  const perPosition = new Float64Array(ctx);
  const walk = (parse, mass, t) => {
    const p = nextWordProbs(parse);
    if (t > 0) perPosition[t - 1] += mass * entropy(p);
    if (t === ctx) return;
    for (let v = 0; v < p.length; v++) if (p[v] > 0) walk(advance(parse, v), mass * p[v], t + 1);
  };
  walk(startParse(), 1, 0);
  return { mean: perPosition.reduce((a, b) => a + b, 0) / ctx, perPosition: Array.from(perPosition) };
}
