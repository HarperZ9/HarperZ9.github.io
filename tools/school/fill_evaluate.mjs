// Fill lesson L16's numbers ("Evaluating a language model") so no number in
// the film or lab is typed by hand. Writes media/school/evaluate/facts.json.
//
//   node tools/school/fill_evaluate.mjs [media/school/attention/model.json] [media/school/evaluate]
//
// The attention lab's model is retrained with its own recipe at three seeds
// (seed 1 is model.json's recipe exactly; the job checks the weights match)
// and scored at eight checkpoints on fresh set B (512 rows) three ways: loss,
// exact match on one-answer words, and two judges of free generations.
// Contaminated copies are trained with the rows of set A (256 rows) written
// into their training batches 1, 4 or 16 times over 2,000 steps, 8 times
// over 600 steps, and of its first 32 rows 100 or 250 times over 2,000 steps; each is scored on A and on B against its clean twin.
// Each training run is a child process (at most 4 at once, below-normal
// priority).
//   node tools/school/fill_evaluate.mjs --job <name>    one run, JSON to stdout
// FILL_STEPS=<n> shortens every run for a smoke test.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeEvalSet, pairSet, scoreRows, createScorer } from "../../system/school/evaluate.mjs";
import { trainRecipe, naturalOverlap, createEvalTrainer, recipeSeeds } from "../../system/school/evaluate-train.mjs";
import { fromJSON, toJSON, createModel } from "../../system/school/tinyformer.mjs";
import { sections, round, deep } from "./fill_evaluate_report.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const SELF = fileURLToPath(import.meta.url);
const jobAt = process.argv.indexOf("--job");
const modelPath = (jobAt < 0 && process.argv[2]) || "media/school/attention/model.json";
const outDir = (jobAt < 0 && process.argv[3]) || "media/school/evaluate";
const raw = readFileSync(modelPath), M = JSON.parse(raw.toString("utf8"));

const STEPS = Number(process.env.FILL_STEPS) || M.steps, SEEDS = [1, 2, 3];
const scale = (s) => Math.max(1, Math.round((s * STEPS) / M.steps));
const MARKS = [50, 200, 400, 600, 800, 1000, 1500, 2000].map(scale);
const SETS = { A: { seed: 90001, rows: 256 }, B: { seed: 90002, rows: 512 } };
// [steps, leaked rows (the first rows of A), repeats]
const LEAKS = [[STEPS, 256, 1], [STEPS, 256, 4], [STEPS, 256, 16], [STEPS, 32, 100], [STEPS, 32, 250], [scale(600), 256, 8]];
const RECIPE = { genSeed: 500, pairSeed: 77, pairRows: 4096, maxNew: 10, promptWords: "3 to 10", shuffleSeed: 4242 };
const JOBS = [...SEEDS.map((s) => `ckpt.${s}`), ...LEAKS.flatMap(([st, n, k]) => SEEDS.map((s) => `leak.${st}.${n}.${k}.${s}`))];

const sets = () => ({ A: makeEvalSet(SETS.A.seed, SETS.A.rows), B: makeEvalSet(SETS.B.seed, SETS.B.rows) });

function ckptJob(s) {
  const S = sets(), pairs = pairSet(RECIPE.pairSeed, RECIPE.pairRows), at = {}, onA = {}, t0 = Date.now();
  const r = trainRecipe(M, s, { steps: STEPS, marks: MARKS, onMark: (k, m) => {
    at[k] = scoreRows(m, S.B, { pairs, genSeed: RECIPE.genSeed });
    if (k === STEPS || k === scale(600)) onA[k] = scoreRows(m, S.A, { pairs, genSeed: RECIPE.genSeed });
  } });
  const same = s === 1 && STEPS === M.steps ? JSON.stringify(toJSON(r.model).params) === JSON.stringify(M.weights.params) : null;
  const sd = recipeSeeds(M, s), overlap = { A: naturalOverlap(S.A, sd.data, STEPS, M.batch), B: naturalOverlap(S.B, sd.data, STEPS, M.batch) };
  return { name: `ckpt.${s}`, seed: s, at, onA, reproducesModelJson: same, overlap, msPerStep: r.msPerStep, seconds: (Date.now() - t0) / 1000 };
}

function leakJob(steps, rows, repeats, s) {
  const S = sets(), A = makeEvalSet(SETS.A.seed, rows), pairs = pairSet(RECIPE.pairSeed, RECIPE.pairRows), t0 = Date.now();
  const r = trainRecipe(M, s, { steps, leak: { set: A, repeats, shuffleSeed: RECIPE.shuffleSeed } });
  return { name: `leak.${steps}.${rows}.${repeats}.${s}`, steps, rows, repeats, seed: s, leaked: r.leaked, A: scoreRows(r.model, A, { pairs, genSeed: RECIPE.genSeed }), B: scoreRows(r.model, S.B, { pairs, genSeed: RECIPE.genSeed }), msPerStep: r.msPerStep, seconds: (Date.now() - t0) / 1000 };
}

function runJob(name) {
  const p = name.split(".");
  return p[0] === "ckpt" ? ckptJob(Number(p[1])) : leakJob(Number(p[1]), Number(p[2]), Number(p[3]), Number(p[4]));
}

function child(name) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [SELF, "--job", name], { stdio: ["ignore", "pipe", "inherit"] });
    let s = "";
    p.stdout.on("data", (d) => { s += d; });
    p.on("close", (code) => (code === 0 ? resolve(JSON.parse(s)) : reject(new Error(`job ${name} exited ${code}`))));
  });
}

async function pool(names, limit) {
  const out = {}, queue = names.slice();
  const worker = async () => { while (queue.length) { const n = queue.shift(); out[n] = await child(n); console.error(`done ${n} in ${out[n].seconds.toFixed(1)} s`); } };
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

// Costs with nothing else running: one scorer step of 16 rows (a lab slice),
// one training step at batch 16, building the sets and the pair table.
function speed() {
  const model = fromJSON(M.weights), t0 = performance.now(), S = sets(), t1 = performance.now(), pairs = pairSet(RECIPE.pairSeed, RECIPE.pairRows), t2 = performance.now();
  const sc = createScorer(model, S.B, { pairs, rowsPerStep: 16 });
  sc.step();
  const ts = [];
  for (let i = 0; i < 8; i++) { const a = performance.now(); sc.step(); ts.push(performance.now() - a); }
  const tr = createEvalTrainer(createModel(M.config, 1), { seed: 1, batch: M.batch, lr: M.lr });
  for (let i = 0; i < 3; i++) tr.step();
  const a = performance.now();
  for (let i = 0; i < 20; i++) tr.step();
  return { msBuildSets: t1 - t0, msPairTable: t2 - t1, msPer16Rows: ts.reduce((x, y) => x + y, 0) / ts.length, msPer16RowsMax: Math.max(...ts), msPerTrainStep: (performance.now() - a) / 20 };
}

async function main() {
  if (jobAt >= 0) { process.stdout.write(JSON.stringify(runJob(process.argv[jobAt + 1]))); return; }
  const t0 = Date.now(), sp = speed(), J = await pool(JOBS, 4), S = sets();
  const ctx = { M, J, S, SETS, SEEDS, MARKS, LEAKS, STEPS, RECIPE, speed: sp, scale };
  const facts = {
    about: "Lesson L16, evaluating a language model. Computed by tools/school/fill_evaluate.mjs from system/school/evaluate.mjs, evaluate-judge.mjs, evaluate-train.mjs, the attention lab's own model recipe and the corpus generator. Do not edit by hand. Losses are in nats per word. Intervals are 95 percent percentile bootstrap intervals resampling rows (errorbars.mjs), seeded, so every number is reproducible. A difference is resolved when its interval excludes zero, as lesson E23 says it.",
    modelSha256: createHash("sha256").update(raw).digest("hex"), modelFile: "media/school/attention/model.json",
    recipe: { ...RECIPE, sets: SETS, seeds: SEEDS, marks: MARKS, leaks: LEAKS, steps: STEPS, trainingSeeds: SEEDS.map((s) => recipeSeeds(M, s)), batch: M.batch, lr: M.lr },
    ...deep(sections(ctx)),
    runSeconds: Object.fromEntries(Object.values(J).map((j) => [j.name, round(j.seconds, 1)])), seconds: 0,
  };
  facts.seconds = round((Date.now() - t0) / 1000, 1);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  console.log(JSON.stringify({ verdicts: facts.verdicts, speed: facts.speed, seconds: facts.seconds }, null, 1));
}

main().catch((e) => { console.error("fill_evaluate failed:", e); process.exit(1); });
