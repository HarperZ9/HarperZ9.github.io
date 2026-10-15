// Fill lesson L15's numbers ("Decoding: temperature, top-k, top-p") so no
// number in the film or lab is typed by hand. Samples continuations from the
// attention lab's trained model under each decoding setting and judges them
// against the corpus generator. Writes media/school/decoding/facts.json.
//
//   node tools/school/fill_decoding.mjs [media/school/attention/model.json] [media/school/decoding]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { generate, distinctN, endsInLoop, bigramSet, bigramCheck, scoreContinuations, settingProbs, entropy, V } from "../../system/school/decoding.mjs";
import { countNgrams, batchProbs } from "../../system/school/nextword.mjs";
import { grammarCheck, sampleGenerator } from "../../system/school/corpus-grammar.mjs";
import { fromJSON } from "../../system/school/tinyformer.mjs";
import { encode, decode, makeBatch, VOCAB } from "../../system/school/corpus.mjs";
import { rng } from "../../system/school/tinyformer-ops.mjs";

const t0 = Date.now();
const modelPath = process.argv[2] || "media/school/attention/model.json";
const outDir = process.argv[3] || "media/school/decoding";
const raw = readFileSync(modelPath), M = JSON.parse(raw.toString("utf8"));
const round = (v, k = 4) => Math.round(v * 10 ** k) / 10 ** k;
const model = fromJSON(M.weights), ctx = M.config.ctx;
const N = 1500, SEED = 1, SHOW = 3, REF_SEED = 500000;

const PROMPTS = [
  { key: "copy", words: ["tallow", "found", "a", "map", "."], note: "A copy episode is open: the text must come back to the map before it can move on." },
  { key: "who", words: ["rerun", "painted", "the", "boat", ".", "the", "bell", "rang", "."], note: "A who episode is open: the question must repeat painted and boat, and its answer is rerun." },
  { key: "open", words: ["pylon"], note: "One word: many episodes can start this way." },
];
const SETTINGS = [
  { key: "greedy", s: { mode: "greedy" }, n: 1 },
  { key: "t0.5", s: { temperature: 0.5 } }, { key: "t1", s: { temperature: 1 } }, { key: "t1.5", s: { temperature: 1.5 } }, { key: "t2", s: { temperature: 2 } },
  { key: "k3", s: { topK: 3 } }, { key: "k10", s: { topK: 10 } },
  { key: "p0.5", s: { topP: 0.5 } }, { key: "p0.9", s: { topP: 0.9 } },
  { key: "uniform", s: { mode: "uniform" } },
];

// Bigram set from the exact training tokens of the model.
const dataR = rng(M.dataSeed), batches = [];
for (let s = 0; s < M.steps; s++) batches.push(makeBatch(dataR, M.batch, ctx));
const pairs = bigramSet(countNgrams(batches).bi);

// Some complete sentence (ending in "." or "?", three words or more) occurs twice.
const DOT = encode(["."])[0], QM = encode(["?"])[0];
function repeatsSentence(ids) {
  const seen = new Set();
  let start = 0;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] !== DOT && ids[i] !== QM) continue;
    if (i - start >= 3) { const k = ids.slice(start, i + 1).join(","); if (seen.has(k)) return true; seen.add(k); }
    start = i + 1;
  }
  return false;
}
const distinctCount = (rows, n) => new Set(rows.flatMap((r) => Array.from({ length: Math.max(0, r.length - n + 1) }, (_, i) => r.slice(i, i + n).join(",")))).size;

function judge(promptIds, rows) {
  let gram = 0, bi = 0, biNotGram = 0, loop3 = 0, loop2 = 0, rep = 0;
  for (const r of rows) {
    const g = grammarCheck([...promptIds, ...r]).ok, b = bigramCheck([promptIds.at(-1), ...r], pairs).ok;
    gram += g; bi += b; biNotGram += b && !g; loop3 += endsInLoop(r, 2, 3); loop2 += endsInLoop(r, 2, 2); rep += repeatsSentence([...promptIds, ...r]);
  }
  const n = rows.length, uniq = new Set(rows.map((r) => r.join(","))).size;
  return {
    n, grammatical: round(gram / n), bigramValid: round(bi / n), unseenPair: round(1 - bi / n), distinctTexts: uniq, bigramValidButUngrammatical: round(biNotGram / n),
    distinct1: round(distinctN(rows, 1)), distinct2: round(distinctN(rows, 2)), distinct3: round(distinctN(rows, 3)), distinct2Count: distinctCount(rows, 2), distinct3Count: distinctCount(rows, 3), uniqueShare: round(uniq / n),
    loop3: round(loop3 / n), loop2: round(loop2 / n), repeatedSentence: round(rep / n),
  };
}

function runPrompt(p) {
  const ids = encode(p.words), maxNew = ctx - ids.length, out = {};
  for (const { key, s, n = N } of SETTINGS) {
    const g = generate(model, ids, s, { n, maxNew, seed: SEED });
    out[key] = { ...judge(ids, g.rows), entropy: round(g.entropy), modelEntropy: round(g.modelEntropy), modelLogProb: round(g.modelLogProb), modelPerplexity: round(Math.exp(-g.modelLogProb), 3),
      examples: g.rows.slice(0, SHOW).map((r) => decode(r).join(" ")) };
  }
  const ref = sampleGenerator(ids, maxNew, Array.from({ length: N }, (_, b) => rng(REF_SEED + b)));
  const sc = scoreContinuations(model, ids, ref.rows);
  out.generator = { ...judge(ids, ref.rows), entropy: round(ref.entropy), modelEntropy: round(sc.modelEntropy), modelLogProb: round(sc.modelLogProb), modelPerplexity: round(Math.exp(-sc.modelLogProb), 3),
    examples: ref.rows.slice(0, SHOW).map((r) => decode(r).join(" ")) };
  const g0 = generate(model, ids, { mode: "greedy" }, { n: 1, maxNew }).rows[0].join(","), cold = generate(model, ids, { temperature: 0.01 }, { n: 200, maxNew, seed: SEED });
  return { prompt: p.words, note: p.note, maxNew, settings: out, nearZeroTemperature: { temperature: 0.01, n: 200, sameAsGreedy: round(cold.rows.filter((r) => r.join(",") === g0).length / 200) } };
}

// One distribution under each setting: the model's next word after "tallow found a", the picture
// the film reshapes. kept: how many words keep any probability.
const SHAPE = ["tallow", "found", "a"];
const shapes = (() => {
  const x = SHAPE.map((w) => VOCAB.indexOf(w)), P = batchProbs(model, Int32Array.from(x), 1, x.length), logits = Array.from(P.subarray((x.length - 1) * V, x.length * V), (v) => Math.log(Math.max(v, 1e-300)));
  const rows = ["t0.5", "t1", "t2", "k3", "p0.5", "p0.9", "greedy"].map((key) => {
    const p = settingProbs(logits, SETTINGS.find((z) => z.key === key).s), order = Array.from(p.keys()).sort((a, b) => p[b] - p[a]);
    return { key, kept: p.filter((v) => v > 0).length, entropy: round(entropy(p)), dist: Array.from(p, (v) => round(v)), top: order.slice(0, 10).map((i) => ({ word: VOCAB[i], p: round(p[i]) })) };
  });
  return { about: "The trained model's next-word distribution after 'tallow found a' (log of the temperature-1 probabilities used as scores, which leaves every setting's result unchanged), reshaped by each setting: the ten most likely words with probabilities, and how many words keep any probability.", words: SHAPE, rows };
})();

const tp = Date.now(), prompts = PROMPTS.map((p) => ({ key: p.key, ...runPrompt(p) })), sampleSec = (Date.now() - tp) / 1000;

const facts = {
  about: "Lesson L15, decoding. Computed by tools/school/fill_decoding.mjs from system/school/decoding.mjs, corpus-grammar.mjs and the attention lab's trained model. Do not edit by hand. Entropies are in nats.",
  modelSha256: createHash("sha256").update(raw).digest("hex"), modelFile: "media/school/attention/model.json",
  method: {
    about: `Each prompt starts at an episode boundary. The model continues it until its ${ctx}-word context is full (no sliding window). Every sampled setting draws ${N} continuations; row b uses its own random stream (mulberry32, seed ${SEED} + b), the same streams for every setting, so settings differ by their rule, not their luck. Greedy is deterministic and drawn once. Temperature divides the logits before the softmax; top-k keeps the k most likely words; top-p keeps the smallest set of most likely words whose probability reaches p; both renormalise and use temperature 1. 'generator' is the reference: ${N} continuations written by the corpus generator itself (exact conditional sampling, seeds ${REF_SEED} + b).`,
    grammatical: "Share of continuations that the corpus generator could have written after the prompt, checked by parsing prompt plus continuation with the generator's rules, including the look-back rules (the cone goes on the found thing; the answer is the guide who did it). A continuation cut off mid-sentence counts if it can still be finished.",
    bigramValid: "Share of continuations whose every adjacent word pair (from the prompt's last word on) occurs in the model's training text. bigramValidButUngrammatical: passes the pair check but fails the grammar, which is the look-back errors a pair check cannot see.",
    diversity: "distinct-n: distinct n-grams over all n-grams, pooled over the continuations of one setting (Li et al. 2016 style); with a 46-word grammar and many continuations the ratio is small for every setting, so distinct2Count and distinct3Count give the raw number of different word pairs and triples used. uniqueShare: distinct whole continuations over n; distinctTexts: their count. unseenPair: share of continuations with at least one adjacent word pair never seen in training (1 minus bigramValid).",
    loops: "loop3: the continuation ends with a phrase of two or more words repeated three times in a row (the repetition rule of Holtzman et al. 2020, Figure 9). loop2: the same with two repeats; the generator row gives the rate in text written by the rules, where some repeats are legitimate. repeatedSentence: some complete sentence of three or more words appears twice in prompt plus continuation. Greedy is one continuation per prompt, so its loop rates are 0 or 1, not rates.",
    entropy: "entropy: mean entropy of the distribution the setting samples from, over every step of every continuation. modelEntropy: the trained model's own (temperature 1) distribution at the same steps. modelPerplexity: exp of minus the model's mean log probability of the chosen words. The generator row's entropy is the generator's own uncertainty after the same prompt.",
    limits: `Shares are over ${N} continuations from one model, three prompts and one stream of seeds; a share near 0.5 has a binomial standard error near 0.013. This model is small and its corpus is a grammar of 46 words, so a setting that wins here is not shown to win on open-ended text; the papers' claims are about large models and human text.`,
  },
  papers: {
    fan2018: "Fan, Lewis and Dauphin (2018), Hierarchical Neural Story Generation, arXiv 1805.04833: generate stories by sampling from the k = 10 most likely words; they report beam search tends to produce common phrases and repetitive text.",
    holtzman2020: "Holtzman, Buys, Du, Forbes and Choi (2020), The Curious Case of Neural Text Degeneration, ICLR 2020, arXiv 1904.09751: nucleus sampling samples from the smallest set of words whose total probability reaches p; maximization-based decoding gets stuck in repetitive loops, while pure sampling from the full distribution drifts into incoherence through the low-probability tail.",
  },
  shapes, prompts, seconds: { sampling: round(sampleSec, 2), total: 0 },
};
facts.seconds.total = round((Date.now() - t0) / 1000, 2);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
const line = (k, r) => `${k.padEnd(9)} gram ${r.grammatical} bi ${r.bigramValid} biNotGram ${r.bigramValidButUngrammatical} d2c ${r.distinct2Count} d3c ${r.distinct3Count} rep ${r.repeatedSentence} uniq ${r.uniqueShare} loop3 ${r.loop3} loop2 ${r.loop2} H ${r.entropy} Hm ${r.modelEntropy} ppl ${r.modelPerplexity}`;
for (const p of prompts) {
  console.log(`\n${p.key}: ${p.prompt.join(" ")}  (near-zero T same as greedy: ${p.nearZeroTemperature.sameAsGreedy})`);
  for (const [k, r] of Object.entries(p.settings)) console.log(line(k, r));
  for (const k of ["greedy", "t1", "t2", "p0.9", "uniform", "generator"]) console.log(`  ${k}: ${p.settings[k].examples[0]}`);
}
console.log("seconds", JSON.stringify(facts.seconds));
