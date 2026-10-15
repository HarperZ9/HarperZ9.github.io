// Fill lesson L8's numbers ("Embeddings: every token gets coordinates") so no
// number in the film or lab is typed by hand. Trains the skip-gram from a
// fixed seed, records snapshots, and compares the result with the attention
// model's own word table. Writes media/school/embeddings/facts.json.
//
//   node tools/school/fill_embeddings.mjs [media/school/attention/model.json] [media/school/embeddings]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  TRAIN_DEFAULTS, trainSGNS, table, createSGNS, tokenStream, noiseCdf, drawTriples, gradCheck, batchLoss, heldTriples, neighbourOverlap,
} from "../../system/school/embeddings.mjs";
import { loadTables, categoryOf, measureTable, chanceShare, nearest, pca2, shuffled, dot } from "../../system/school/vectors.mjs";
import { VOCAB } from "../../system/school/corpus.mjs";
import { rng } from "../../system/school/tinyformer-ops.mjs";

const t0 = Date.now();
const modelPath = process.argv[2] || "media/school/attention/model.json";
const outDir = process.argv[3] || "media/school/embeddings";
const raw = readFileSync(modelPath);
const M = JSON.parse(raw.toString("utf8"));
const SEEDS = 1000, K = 3, EXTRA_SEEDS = [2, 3, 4, 5];
const round = (v, k = 4) => (v === null ? null : Math.round(v * 10 ** k) / 10 ** k);
const labels = categoryOf(VOCAB);
const r4 = (s) => ({ mean: round(s.mean), lo95: round(s.lo95), hi95: round(s.hi95), p: round(s.p, 5) });
const measure = (t, seeds = SEEDS) => {
  const m = measureTable(t, labels, { k: K, seeds });
  return { top1: round(m.top1), top3: round(m.topk), control: { top1: r4(m.control.top1), top3: r4(m.control.topk) }, beatsControl: { top1: m.beatsControl.top1, top3: m.beatsControl.topk } };
};
const lists = (t) => VOCAB.map((_, w) => nearest(t, w, K).map((n) => n.index));

// ---- gradient check, with the control ----
const gm = createSGNS(VOCAB.length, 8, 3, { outInit: 1 }), gids = tokenStream(200, 7);
const gTriples = drawTriples(gids, noiseCdf(gids, VOCAB.length), rng(5), 20);
const gOk = gradCheck(gm, gTriples), gBad = gradCheck(gm, gTriples, { drop: "negInInput" });
const gradient = {
  about: "Hand-written gradient of the negative-sampling loss against central finite differences (eps 1e-5) on every coordinate 20 triples touch, on an 8-dimensional model with both tables random. Control: the same gradient with the noise words' term in dL/dv_i dropped. Error is max |a - f| / (|a| + |f|).",
  dims: 8, triples: 20, checked: gOk.checked, worstRelError: gOk.worst, control: { drop: "noise-word term of dL/dv_i", worstRelError: gBad.worst }, passes: gOk.worst < 1e-5, controlFails: gBad.worst > 1e-2,
};

// ---- training with snapshots ----
const snaps = [];
const run = trainSGNS({}, (m, info) => snaps.push({ ...info, table: table(m), out: table(m, "wout") }));
const held = heldTriples(4000, run.ids);
const finalT = table(run.model), finalP = pca2(finalT);
const PCA_AT = [0, 0.01, 0.05, 0.2, 1];
const snapshots = snaps.map((s) => {
  const mean = new Array(s.table[0].length).fill(0);
  for (const row of s.table) row.forEach((v, i) => { mean[i] += v / s.table.length; });
  const track = s.table.map((row) => { const c = row.map((v, i) => v - mean[i]); return [round(dot(c, finalP.axes[0])), round(dot(c, finalP.axes[1]))]; });
  const own = PCA_AT.includes(s.fraction) ? (() => { const p = pca2(s.table); return { varianceShare: round(p.varianceShare), coords: p.coords.map(([x, y]) => [round(x), round(y)]) }; })() : null;
  return {
    fraction: s.fraction, positions: s.positions, triples: s.triples, trainLoss: round(s.loss), heldLoss: round(batchLoss({ ...run.model, win: Float64Array.from(s.table.flat()), wout: Float64Array.from(s.out.flat()) }, held)),
    share: measure(s.table, 500), neighbours: lists(s.table), trackOnFinalAxes: track, pcaOwn: own,
    table: s.table.map((row) => row.map((v) => round(v, 5))),
  };
});

// ---- more seeds, the attention model's wte, and their agreement ----
const extra = EXTRA_SEEDS.map((seed) => { const t = table(trainSGNS({ seed }).model); return { seed, table: t, share: measure(t, 300) }; });
const wte = loadTables(M).wte;
const overlap = (A, B) => round(neighbourOverlap(A, B, K, nearest));
const shuffleOverlaps = Array.from({ length: SEEDS }, (_, s) => neighbourOverlap(finalT, shuffled(wte, 1 + s), K, nearest)).sort((a, b) => a - b);
const obsOverlap = neighbourOverlap(finalT, wte, K, nearest);
const comparison = {
  about: `The skip-gram's input table against the attention model's trained wte (same 46 words, both ${finalT[0].length}-dimensional). Overlap: the share of each word's top-${K} cosine neighbours that both tables list, averaged over words. Control: wte with its rows shuffled among words (${SEEDS} seeds). Seed-to-seed overlap between skip-gram runs is the ceiling to read it against.`,
  skipGram: snapshots.at(-1).share, wte: measure(wte),
  overlapWithWte: round(obsOverlap), overlapControl: { mean: round(shuffleOverlaps.reduce((a, b) => a + b, 0) / SEEDS), lo95: round(shuffleOverlaps[Math.floor(0.025 * SEEDS)]), hi95: round(shuffleOverlaps[Math.floor(0.975 * SEEDS)]),
    p: round((shuffleOverlaps.filter((v) => v >= obsOverlap - 1e-12).length + 1) / (SEEDS + 1), 5) },
  chanceOverlap: round(K / (VOCAB.length - 1)),
  overlapSeedToSeed: extra.map((e) => ({ seed: e.seed, overlap: overlap(finalT, e.table) })),
  overlapExtraSeedsWithWte: extra.map((e) => ({ seed: e.seed, overlap: overlap(e.table, wte) })),
  sideBySide: ["kettle", "crate", "pylon", "tallow", "checked", "red", "lit", "the", ".", "?"].map((w) => {
    const i = VOCAB.indexOf(w);
    return { word: w, skipGram: nearest(finalT, i, K).map((n) => VOCAB[n.index]), wte: nearest(wte, i, K).map((n) => VOCAB[n.index]) };
  }),
};

const facts = {
  about: "Computed by tools/school/fill_embeddings.mjs. Do not edit by hand. Skip-gram with negative sampling (Mikolov et al. 2013) on the guides' corpus, fixed seeds, hand-written gradient. Same-kind share: the share of each word's nearest cosine neighbours in the same category (vectors.mjs CATEGORIES), against a control that shuffles which word owns which row (mean, 95% interval, one-sided permutation p).",
  modelSha256: createHash("sha256").update(raw).digest("hex"), modelFile: "media/school/attention/model.json",
  settings: { ...TRAIN_DEFAULTS, noise: "unigram^0.75", init: "input uniform in [-0.5/d, 0.5/d], output zero", lrSchedule: "linear to 1e-4 of start", subsampling: "none", tokens: run.ids.length, epochs: TRAIN_DEFAULTS.epochs, triplesSeen: snaps.at(-1).triples },
  words: VOCAB, labels, chance: round(chanceShare(labels)), k: K,
  gradient,
  training: { about: "Snapshots of the input table at fractions of all centre positions over every epoch. trainLoss: mean loss since the previous snapshot. heldLoss: mean loss on 4000 fixed held-out triples from the held-out seed. trackOnFinalAxes: each snapshot, centred, projected on the final table's two PCA axes, so a film can move points on one fixed chart. pcaOwn: each listed snapshot's own PCA (axes differ between snapshots).",
    finalPcaVarianceShare: round(finalP.varianceShare), snapshots },
  seeds: { about: "Final same-kind share for four more training seeds (300 control seeds each).", runs: extra.map((e) => ({ seed: e.seed, share: e.share })) },
  comparison,
  bengio: "Not built. The next-word model of Bengio et al. (2003) was optional; the comparison with the attention model's own wte stands in for it.",
  seconds: 0,
};
facts.seconds = round((Date.now() - t0) / 1000, 2);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
console.log(JSON.stringify({
  gradient: { worst: gOk.worst, control: gBad.worst, checked: gOk.checked },
  snapshots: snapshots.map((s) => `${s.fraction}: loss ${s.trainLoss} held ${s.heldLoss} top1 ${s.share.top1} top3 ${s.share.top3} ctl3 ${s.share.control.top3.lo95}-${s.share.control.top3.hi95} beats ${s.share.beatsControl.top1}/${s.share.beatsControl.top3}`),
  seeds: extra.map((e) => `${e.seed}: ${e.share.top1}/${e.share.top3} beats ${e.share.beatsControl.top1}/${e.share.beatsControl.top3}`),
  comparison: { ...comparison, sideBySide: comparison.sideBySide.map((r) => `${r.word}: ${r.skipGram.join(" ")} | ${r.wte.join(" ")}`) },
  pca: facts.training.finalPcaVarianceShare, settings: facts.settings, seconds: facts.seconds,
}, null, 1));
