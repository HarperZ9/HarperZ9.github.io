// Fill lesson F1's numbers ("Vectors: a list of numbers is a place") from the attention film's
// trained model, so no number in the film or lab is typed by hand. Writes
// media/school/vectors/facts.json.
//
//   node tools/school/fill_vectors.mjs [media/school/attention/model.json] [media/school/vectors]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  loadTables, hiddenByWord, categoryOf, CATEGORIES, measureTable, chanceShare, neighbourShare, nearest, pca2,
} from "../../system/school/vectors.mjs";
import { createModel } from "../../system/school/tinyformer.mjs";

const modelPath = process.argv[2] || "media/school/attention/model.json";
const outDir = process.argv[3] || "media/school/vectors";
const raw = readFileSync(modelPath);
const M = JSON.parse(raw.toString("utf8"));
const SEEDS = 2000, K = 3;
const round = (v, k = 4) => Math.round(v * 10 ** k) / 10 ** k;

const t = loadTables(M), words = t.words, labels = categoryOf(words);
// Untrained control: the same architecture and seed before any training step.
const init = createModel(t.model.config, M.weights.seed);
const D = t.model.config.dModel;
const initWte = words.map((_, w) => Array.from(init.params.wte.subarray(w * D, (w + 1) * D)));
const tables = {
  wte: { about: "word vectors going in (embedding rows)", table: t.wte },
  wout: { about: "word vectors coming out (readout columns)", table: t.wout },
  hidden1: { about: "residual stream after layer 1, averaged per input word over 256 held-out rows", table: hiddenByWord(t.model, 1).table },
  hidden2: { about: "residual stream after layer 2, averaged per input word over 256 held-out rows", table: hiddenByWord(t.model, 2).table },
  wteUntrained: { about: "word vectors at initialisation, before training (control)", table: initWte },
};

const r4 = (s) => ({ mean: round(s.mean), lo95: round(s.lo95), hi95: round(s.hi95), p: round(s.p, 5) });
function perCategory(table) {
  const out = {};
  for (const cat of Object.keys(CATEGORIES)) {
    const idx = labels.map((l, i) => (l === cat ? i : -1)).filter((i) => i >= 0);
    const hits = idx.filter((i) => labels[nearest(table, i, 1)[0].index] === cat).length;
    out[cat] = { words: idx.length, top1Same: hits };
  }
  return out;
}
const measurements = {};
for (const [name, { about, table }] of Object.entries(tables)) {
  const m = measureTable(table, labels, { k: K, seeds: SEEDS });
  measurements[name] = {
    about, top1: round(m.top1), top3: round(m.topk),
    control: { top1: r4(m.control.top1), top3: r4(m.control.topk) },
    beatsControl: { top1: m.beatsControl.top1, top3: m.beatsControl.topk },
    perCategory: perCategory(table),
  };
}

// The chart: the table with the higher top-3 share of wte and wout, projected by PCA.
const chartName = measurements.wout.top3 >= measurements.wte.top3 ? "wout" : "wte";
function chart(table) {
  const p = pca2(table);
  const flat = neighbourShare(p.coords, labels, K, "distance");  // by distance on the chart, as a viewer judges it
  return {
    varianceShare: round(p.varianceShare), axisShare: p.axisShare.map((v) => round(v)),
    // How faithful the flat picture is: the same neighbour measure on the 2D points.
    top1In2D: round(flat.top1), top3In2D: round(flat.topk),
    // nn: the word's nearest neighbour by cosine in all the table's directions; nn2: its nearest
    // on the flat chart (by distance). The film draws a line from each word to nn.
    points: words.map((w, i) => ({ word: w, category: labels[i], x: round(p.coords[i][0]), y: round(p.coords[i][1]),
      nn: nearest(table, i, 1)[0].index, nn2: nearest(p.coords, i, 1, "distance")[0].index })),
  };
}

const NAMED = ["kettle", "crate", "cone", "pylon", "tallow", "rerun", "lamp", "checked", "the", "."];
const neighbours = {};
for (const name of ["wte", "wout", "hidden1"]) {
  neighbours[name] = Object.fromEntries(NAMED.map((w) => {
    const i = words.indexOf(w);
    return [w, nearest(tables[name].table, i, 5).map((n) => ({ word: words[n.index], category: labels[n.index], cosine: round(n.score) }))];
  }));
}

const facts = {
  about: "Computed by tools/school/fill_vectors.mjs from the attention film's model.json. Do not edit by hand. "
    + "Same-category share of each word's nearest cosine neighbours (top 1 and top 3), against a control that "
    + `permutes which word owns which vector (${SEEDS} seeds; mean, 95% interval of the control, one-sided permutation p).`,
  modelSha256: createHash("sha256").update(raw).digest("hex"),
  modelFile: "media/school/attention/model.json",
  vocab: words.length, dModel: t.model.config.dModel, k: K, seeds: SEEDS,
  categories: CATEGORIES, labels, chance: round(chanceShare(labels)),
  measurements, neighbours,
  chart: { table: chartName, ...chart(tables[chartName].table) },
  chartWte: chart(t.wte),
  // Every word's list going in (wte rows, rounded), for the film's columns of dots and dot products.
  words, wte: t.wte.map((r) => Array.from(r, (v) => round(v))), wteStart: initWte.map((r) => Array.from(r, (v) => round(v))),
};
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
const brief = Object.fromEntries(Object.entries(measurements).map(([n, m]) => [n, { top1: m.top1, top3: m.top3, ctl1: [m.control.top1.lo95, m.control.top1.hi95], ctl3: [m.control.top3.lo95, m.control.top3.hi95], p: m.control.top3.p, beats: m.beatsControl }]));
console.log(JSON.stringify({ chance: facts.chance, brief, chart: { table: chartName, varianceShare: facts.chart.varianceShare, top1In2D: facts.chart.top1In2D, top3In2D: facts.chart.top3In2D } }, null, 1));
