// Fill lesson L9's numbers ("Next-word prediction and the loss") so no number
// in the film or lab is typed by hand. Writes media/school/nextword/facts.json.
//
//   node tools/school/fill_nextword.mjs [media/school/attention/model.json] [media/school/nextword]
//
// Scores the attention lab's trained model on the corpus's 256 held-out rows
// against four controls (the same model before training, a uniform guess,
// unigram, bigram and trigram counts of the exact training tokens). A few
// seconds on one core.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { workedExample, probeReport, scoreModel, scoreTable, uniformTable, countNgrams, ngramTable, lossByPosition, batchProbs, V } from "../../system/school/nextword.mjs";
import { fromJSON, createModel, evaluate } from "../../system/school/tinyformer.mjs";
import { PROBES, heldOut, makeBatch, unigramCrossEntropy, VOCAB } from "../../system/school/corpus.mjs";
import { rng } from "../../system/school/tinyformer-ops.mjs";
import { trueTable, startParse, advance, nextWordProbs } from "../../system/school/corpus-grammar.mjs";


const t0 = Date.now();
const modelPath = process.argv[2] || "media/school/attention/model.json";
const outDir = process.argv[3] || "media/school/nextword";
const raw = readFileSync(modelPath), M = JSON.parse(raw.toString("utf8"));
const round = (v, k = 4) => (v === null ? null : Math.round(v * 10 ** k) / 10 ** k);
const r = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "number" && !Number.isInteger(v) ? round(v) : v]));
const split = (s) => ({ all: r(s.all), copy: r(s.copy), local: r(s.local) });

const model = fromJSON(M.weights), ctx = M.config.ctx;
const untrained = createModel(M.weights.config, M.seed);
const held = heldOut(M.heldOutRows, ctx);

// ---- worked example ----
const w = workedExample();
const worked = {
  about: "Four words with scores 2, 1, 0 and -1; the word that came is the first. Softmax: exp of each score over the sum of the four. Loss: minus the natural log of the right word's probability. Gradient check: p minus one-hot against central finite differences (step 1e-5); the control drops the minus one and must fail. Error is max |a - f| / max(|a| + |f|, 1e-4). shiftInvariant: adding 100 to every score leaves the probabilities unchanged (max relative difference). A four-word example shows the arithmetic; it says nothing about the trained model.",
  words: w.words, logits: w.logits, answer: w.answer, exp: w.exp.map((v) => round(v, 5)), probs: w.probs.map((v) => round(v, 5)), loss: round(w.loss, 5), perplexity: round(w.perplexity, 5),
  grad: w.grad.map((v) => round(v, 5)), finiteDiff: w.finiteDiff.map((v) => round(v, 5)), gradError: w.gradError, brokenGrad: w.brokenGrad.map((v) => round(v, 5)), brokenError: round(w.brokenError, 5),
  shiftInvariant: w.shiftInvariant, passes: w.gradError < 1e-5, controlFails: w.brokenError > 0.1,
};

// ---- torn: places where the next word is open, the model against the generator's true odds ----
const TORN = [["pylon"], ["tallow", "found", "a"], ["rerun", "knocked"]];
const ent = (p) => -p.reduce((a, v) => a + (v > 0 ? v * Math.log(v) : 0), 0);
const torn = {
  about: "Three contexts where the next word is genuinely open. model: the trained model's eight most likely next words after the last word. truth: the corpus generator's exact odds there (parsed with its own rules). entropy in nats; 'between' is exp(entropy), the number of equally likely words that would be as uncertain. Three contexts show the idea; held-out scores measure it. modelDist and truthDist: all 46 shares in vocabulary order.",
  rows: TORN.map((words) => {
    const x = words.map((w) => VOCAB.indexOf(w)), P = batchProbs(model, Int32Array.from(x), 1, x.length), row = Array.from(P.subarray((x.length - 1) * V, x.length * V));
    let g = startParse(); for (const id of x) g = advance(g, id); const tr = Array.from(nextWordProbs(g));
    const top = (q) => q.map((v, i) => [i, v]).sort((a, b) => b[1] - a[1]).slice(0, 8).filter(([, v]) => v > 0.0005).map(([i, v]) => ({ word: VOCAB[i], p: round(v) }));
    return { words, model: top(row), truth: top(tr), modelDist: row.map((v) => round(v)), truthDist: tr.map((v) => round(v)), modelEntropy: round(ent(row)), truthEntropy: round(ent(tr)), modelBetween: round(Math.exp(ent(row)), 2), truthBetween: round(Math.exp(ent(tr)), 2) };
  }),
};

// ---- probes ----
const probes = {
  about: "The attention lab's six probe sentences. top5: the model's five most likely next words after the last word, with probabilities. loss: minus the log probability of the expected answer there. meanLossInside: the mean loss over every earlier position of the probe whose next word the probe contains. One sentence each: a probe shows a behaviour, it does not measure a rate.",
  rows: PROBES.map((p) => { const q = probeReport(model, p); return { ...q, top5: q.top5.map((t) => ({ word: t.word, p: round(t.p) })), pAnswer: round(q.pAnswer), loss: round(q.loss), meanLossInside: round(q.meanLossInside), note: p.note }; }),
  untrained: PROBES.map((p) => { const q = probeReport(untrained, p); return { answer: q.answer, pAnswer: round(q.pAnswer), loss: round(q.loss), top1: q.top5[0].word }; }),
};

// ---- held-out scores and baselines ----
const tc = Date.now();
const dataR = rng(M.dataSeed), batches = [];
for (let s = 0; s < M.steps; s++) batches.push(makeBatch(dataR, M.batch, ctx));
const counts = countNgrams(batches);
const countSec = (Date.now() - tc) / 1000;
const trainedP = batchProbs(model, held.x, held.batch, ctx);
const tables = {
  trained: trainedP, untrained: batchProbs(untrained, held.x, held.batch, ctx), uniform: uniformTable(held.y.length),
  unigram: ngramTable(counts, held, 1, 1), bigram: ngramTable(counts, held, 2, 1), trigram: ngramTable(counts, held, 3, 1),
  generator: trueTable(held),
  bigramAlpha001: ngramTable(counts, held, 2, 0.01), trigramAlpha001: ngramTable(counts, held, 3, 0.01),
};
const scores = Object.fromEntries(Object.entries(tables).map(([k, P]) => [k, split(scoreTable(P, held))]));
const ev = evaluate(model, held);
const check = {
  about: "Consistency checks: the lab's own evaluate() loss on the same rows, the unigram loss from corpus.mjs's unigramCrossEntropy on the same tokens (both add-one), and log 46 for the uniform guess.",
  evaluateLoss: round(ev.loss, 6), thisLoss: round(scores.trained.all.loss, 6), unigramCorpusMjs: round(unigramCrossEntropy({ y: concatY(batches) }, held), 6), uniformLog46: round(Math.log(V), 6),
};
function concatY(list) { const y = new Int32Array(list.length * list[0].y.length); list.forEach((b, i) => y.set(b.y, i * b.y.length)); return y; }

const heldScores = {
  about: `${held.batch} held-out rows of ${ctx} next-word predictions each (${held.y.length} positions, generator seed ${M.heldOutSeed}, a separate stream from training; the grammar is small, so every held-out sentence also occurs somewhere in training, and 6 of the 256 rows equal a training row word for word: the rows are new, the sentences are not). loss: mean cross-entropy in nats; perplexity: exp(loss); top1 / top5: share of positions where the word that came is the model's first choice / among its five most likely. 'copy' positions need a word from earlier in the row, 'local' positions do not (the corpus labels them). Controls: 'untrained' is the same network at its starting weights (seed ${M.seed}), 'uniform' gives every word 1/${V}. The n-gram rows count the exact ${counts.tokens} training targets the model saw (${M.steps} batches of ${M.batch} rows, data seed ${M.dataSeed}): unigram counts words, bigram counts word after previous word, trigram counts word after the previous two (bigram at a row's first position). Add-one smoothing unless the key says alpha 0.01. 'generator' is the floor: the corpus generator's own next-word probabilities, computed exactly by parsing each row with the generator's rules and odds (corpus-grammar.mjs); no model can beat its loss on average, because the text is random where the generator rolls dice. Top-1 and top-5 count tied words fractionally (random tie order), so the uniform guess scores 1/46 and 5/46. One held-out set: these are point estimates; with ${held.y.length} positions a share near 0.7 has a binomial standard error near 0.006. A lower loss here does not show the model would do well on text from any other source.`,
  positions: held.y.length, nCopy: scores.trained.copy.n, nLocal: scores.trained.local.n, trainingTokens: counts.tokens, scores, check,
  lossByPosition: { about: "Mean loss at each position of a row (0 = first word of the row, the least context).", trained: lossByPosition(trainedP, held).map((v) => round(v)), bigram: lossByPosition(tables.bigram, held).map((v) => round(v)), trigram: lossByPosition(tables.trigram, held).map((v) => round(v)), generator: lossByPosition(tables.generator, held).map((v) => round(v)) },
  excessOverGenerator: { all: round(scores.trained.all.loss - scores.generator.all.loss), copy: round(scores.trained.copy.loss - scores.generator.copy.loss), local: round(scores.trained.local.loss - scores.generator.local.loss) },
};

// ---- training curve, lifted from model.json ----
const curve = {
  about: `Lifted from model.json, not recomputed. 'train' is the mean loss of the previous 25 training batches, each measured before its update; 'heldOut' is the loss on the ${M.heldOutRows} held-out rows after the update; perplexity is exp(heldOut). Step 0 is the untrained network. One training run (model seed ${M.seed}, data seed ${M.dataSeed}): the curve's shape for other seeds is not shown here.`,
  steps: M.steps, every: M.curveEvery, batch: M.batch, lr: M.lr,
  points: M.curve.map((p) => ({ step: p.step, train: p.train, heldOut: p.heldOut, perplexity: round(Math.exp(p.heldOut), 3), copyAccuracy: p.copyAccuracy, localAccuracy: p.localAccuracy })),
  modelJsonBaselines: M.baselines,
};

const facts = {
  about: "Lesson L9, next-word prediction and the loss. Computed by tools/school/fill_nextword.mjs from system/school/nextword.mjs and the attention lab's trained model. Do not edit by hand. Losses are in nats (natural log).",
  words: VOCAB, modelSha256: createHash("sha256").update(raw).digest("hex"), modelFile: "media/school/attention/model.json",
  model: { seed: M.seed, dataSeed: M.dataSeed, steps: M.steps, batch: M.batch, ctx, vocab: V, nParams: M.nParams },
  worked, torn, probes, held: heldScores, curve, seconds: { counts: round(countSec, 2), total: 0 },
};
facts.seconds.total = round((Date.now() - t0) / 1000, 2);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
console.log(JSON.stringify({
  worked: { probs: worked.probs, loss: worked.loss, gradError: worked.gradError, brokenError: worked.brokenError, shift: worked.shiftInvariant },
  probes: probes.rows.map((p, i) => `${p.answer}: p ${p.pAnswer} loss ${p.loss} rank ${p.rank} inside ${p.meanLossInside} | top ${p.top5.map((t) => t.word + " " + t.p).join(", ")} | untrained p ${probes.untrained[i].pAnswer}`),
  scores: Object.fromEntries(Object.entries(scores).map(([k, s]) => [k, `all ${s.all.loss} ppl ${s.all.perplexity} t1 ${s.all.top1} t5 ${s.all.top5} | copy ${s.copy.loss} t1 ${s.copy.top1} | local ${s.local.loss} t1 ${s.local.top1}`])),
  check, byPos: heldScores.lossByPosition, curveEnds: [curve.points[0], curve.points.at(-1)], seconds: facts.seconds,
}, null, 1));
