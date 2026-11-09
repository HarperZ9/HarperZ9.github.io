// Fill lesson L13's numbers ("Data: what goes in comes out") so no number in
// the film or lab is typed by hand. Writes media/school/data/facts.json.
//
//   node tools/school/fill_data.mjs [media/school/attention/model.json] [media/school/data]
//
// Trains the attention lab's model (same model seed, same 2,000 steps, same
// recipe) on altered training data and scores every run on the same untouched
// held-out rows. Each run is a child process (at most 4 at once, below-normal
// priority). About 6 minutes of wall time on a 4-core budget.
//   node tools/school/fill_data.mjs --job <name>    one run, JSON to stdout
// FILL_STEPS=<n> shortens every run for a smoke test (the reproduce check then fails).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mixBatch, makeSpec, lookbackMix, freshSource, noisySource, poolSource, scoreSet, trainCurve, everySteps, noisyFloor } from "../../system/school/data.mjs";
import { summarise, compareCurves } from "../../system/school/trainloop.mjs";
import { createModel, rng } from "../../system/school/tinyformer.mjs";
import { HELD_OUT_SEED } from "../../system/school/corpus.mjs";
import { trueTable } from "../../system/school/corpus-grammar.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const SELF = fileURLToPath(import.meta.url);
const jobAt = process.argv.indexOf("--job");
const modelPath = (jobAt < 0 && process.argv[2]) || "media/school/attention/model.json";
const outDir = (jobAt < 0 && process.argv[3]) || "media/school/data";
const raw = readFileSync(modelPath), M = JSON.parse(raw.toString("utf8"));
const round = (v, k = 4) => (typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 10 ** k) / 10 ** k : v);
const deep = (o) => (Array.isArray(o) ? o.map(deep) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deep(v)])) : round(o));

const STEPS = Number(process.env.FILL_STEPS) || M.steps, CTX = M.config.ctx, ROWS = M.heldOutRows;
const HELD = () => mixBatch(rng(HELD_OUT_SEED), ROWS, CTX);
// Shifted held-out sets: other episode mixes, drawn from their own seeds.
const SHIFT = {
  copyOnly: [{ mix: { copy: 1, who: 0, plain: 0 } }, 101],
  whoOnly: [{ mix: { copy: 0, who: 1, plain: 0 } }, 102],
  plainOnly: [{ mix: { copy: 0, who: 0, plain: 1 } }, 103],
  whoRerunDoes: [{ mix: { copy: 0, who: 1, plain: 0 }, doers: ["rerun"] }, 104],
  whoOthersDo: [{ mix: { copy: 0, who: 1, plain: 0 }, doers: ["tallow", "pylon"] }, 105],
};
const shiftSet = (name) => mixBatch(rng(HELD_OUT_SEED + SHIFT[name][1]), ROWS, CTX, makeSpec(SHIFT[name][0]));

// name: [source kind, spec options, extra, data seed]
const JOBS = {
  reference: ["fresh", {}, {}, M.dataSeed],
  lb0: ["fresh", { mix: lookbackMix(0) }, {}, M.dataSeed],
  lb01: ["fresh", { mix: lookbackMix(0.01) }, {}, M.dataSeed],
  lb05: ["fresh", { mix: lookbackMix(0.05) }, {}, M.dataSeed],
  lb20: ["fresh", { mix: lookbackMix(0.2) }, {}, M.dataSeed],
  lb40: ["fresh", { mix: lookbackMix(0.4) }, {}, M.dataSeed],
  noCopyEpisodes: ["fresh", { mix: { copy: 0, who: 0.4, plain: 0.2 } }, {}, M.dataSeed],
  noise10: ["noise", {}, { share: 0.1 }, M.dataSeed],
  noise30: ["noise", {}, { share: 0.3 }, M.dataSeed],
  pool64: ["pool", {}, { rows: 64 }, M.dataSeed],
  pool256: ["pool", {}, { rows: 256 }, M.dataSeed],
  pool1024: ["pool", {}, { rows: 1024 }, M.dataSeed],
  rerunNeverDoes: ["fresh", { doers: ["tallow", "pylon"] }, {}, M.dataSeed],
  seed12: ["fresh", {}, {}, 12],
  seed13: ["fresh", {}, {}, 13],
  lb05seed12: ["fresh", { mix: lookbackMix(0.05) }, {}, 12],
  lb05seed13: ["fresh", { mix: lookbackMix(0.05) }, {}, 13],
};

function sourceFor([kind, specOpts, extra, seed]) {
  const spec = makeSpec(specOpts), base = { seed, batch: M.batch, ctx: CTX, spec };
  if (kind === "pool") return poolSource({ ...base, rows: extra.rows });
  const fresh = freshSource(base);
  return kind === "noise" ? noisySource(fresh, extra.share, 99) : fresh;
}

// Wraps a source to count look-back targets in what the model was fed.
function counted(src) {
  const c = { targets: 0, lookback: 0 };
  return { c, src, next() { const b = src.next(), k = b.kind ?? null; c.targets += b.y.length; if (k) for (const v of k) c.lookback += v; return b; } };
}

function runJob(name) {
  const job = JOBS[name], src = sourceFor(job), held = HELD(), t0 = Date.now();
  const cnt = counted(src), extra = src.pool ? { pool: src.pool } : {};
  const every = name === "reference" ? M.curveEvery : 100;
  const model = createModel({}, M.seed);
  const res = trainCurve(model, held, { seed: job[3], batch: M.batch, lr: M.lr, steps: STEPS, at: everySteps(STEPS, every), source: cnt, extra });
  if (src.pool) { const k = src.pool.kind.reduce((a, b) => a + b, 0); cnt.c.lookback = k * (cnt.c.targets / src.pool.y.length); }
  const out = { name, steps: STEPS, every, curve: deep(res.curve), summary: deep(summarise(res.curve)), seconds: (Date.now() - t0) / 1000, fed: cnt.c, noise: src.info.noise != null ? { ...src.info } : null, passes: src.passes ?? null };
  out.split = deep(scoreSet(model, held));
  out.shift = Object.fromEntries(Object.keys(SHIFT).map((s) => [s, deep(pickScore(scoreSet(model, shiftSet(s))))]));
  return out;
}

const pickScore = (s) => ({ loss: s.all.loss, lookback: s.lookback ? s.lookback.accuracy : null, local: s.local ? s.local.accuracy : null, guideAnswer: s.guideAnswer ? s.guideAnswer.accuracy : null, nLookback: s.lookback ? s.lookback.n : 0 });

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

const brief = (j) => ({ name: j.name, summary: j.summary, lookbackFed: j.fed.lookback, targetsFed: j.fed.targets, split: { lookback: j.split.lookback, local: j.split.local, copyEpisodes: j.split["copy.lookback"], whoEpisodes: j.split["who.lookback"], guideAnswer: j.split.guideAnswer }, curve: j.curve.map((p) => ({ step: p.step, train: p.train, heldOut: p.heldOut, copyAccuracy: p.copyAccuracy, localAccuracy: p.localAccuracy, ...(p.pool ? { poolLoss: p.pool.loss } : {}) })) });
const spreadOf = (vals) => { const m = vals.reduce((a, b) => a + b, 0) / vals.length; return { values: vals, mean: round(m), range: round(Math.max(...vals) - Math.min(...vals)) }; };

function sections(J, gen) {
  const ref = J.reference, cmp = compareCurves(ref.curve, M.curve);
  const share = { lb0: 0, lb01: 0.01, lb05: 0.05, lb20: 0.2, lb40: 0.4, reference: 0.8 };
  const genLoss = (s) => round(gen[s]);
  return {
    reproduce: {
      about: `The unchanged recipe through this lesson's own batch code: model seed ${M.seed}, data seed ${M.dataSeed}, ${STEPS} steps, scored every ${M.curveEvery} steps on the same ${ROWS} held-out rows, compared with the curve stored with the trained model after rounding to 4 decimals. The rewritten batch code draws the same rows as the corpus generator (the tests check bit for bit), so a match here shows every other run in this lesson differs only in its data. Bit-identical on one engine (V8 in Node); another engine was not tested.`,
      points: cmp.points, pointsEqual: cmp.equal, worstAbsDiff: cmp.worstAbsDiff, summary: ref.summary, split: brief(ref).split,
    },
    noise: {
      about: `Seed spread: the reference recipe with data seeds 12 and 13 (model seed unchanged), and the 5 percent look-back run with the same three data seeds. Three runs per recipe: a difference between recipes smaller than these ranges is not evidence of anything.`,
      reference: { heldOut: spreadOf([ref, J.seed12, J.seed13].map((j) => j.summary.heldOut)), copyAccuracy: spreadOf([ref, J.seed12, J.seed13].map((j) => j.summary.copyAccuracy)) },
      lookback5: { heldOut: spreadOf([J.lb05, J.lb05seed12, J.lb05seed13].map((j) => j.summary.heldOut)), copyAccuracy: spreadOf([J.lb05, J.lb05seed12, J.lb05seed13].map((j) => j.summary.copyAccuracy)) },
      runs: ["seed12", "seed13", "lb05seed12", "lb05seed13"].map((n) => brief(J[n])),
    },
    lookback: {
      about: `How much of a skill's data is needed. The corpus default writes 40 percent copy episodes, 40 percent who-did-it episodes (the two kinds whose targets need a look back) and 20 percent plain ones, so the default look-back share is 80 percent of episodes. Each run keeps copy and who episodes equal and fills the rest with plain episodes: 0, 1, 5, 20, 40 and 80 percent. lookbackFed counts the look-back target words the model was trained on out of targetsFed. Every run is scored on the same default-mix held-out rows (${ref.split.lookback.n} look-back targets), so the plain-heavy runs also face a mix they rarely trained on. One seed each except 5 and 80 percent (see noise). This shows the amount needed for this skill in this model at this budget; it does not give a general rule.`,
      runs: Object.entries(share).map(([n, s]) => ({ lookbackShare: s, ...brief(J[n]) })),
    },
    noCopy: {
      about: "Copy episodes removed, who-did-it episodes kept (copy 0, who 0.4, plain 0.2, renormalised). copyEpisodes is look-back accuracy on the held-out targets inside copy episodes (the thing after 'pylon put a cone on the'); whoEpisodes inside who episodes. The model still learns to look back, from who episodes; whether that carries over to a sentence frame it never saw is what copyEpisodes measures. One seed.",
      run: brief(J.noCopyEpisodes), reference: brief(ref).split,
    },
    labelNoise: {
      about: `A share of training target words replaced by a word drawn uniformly from all ${46} (inputs untouched, a separate noise stream, so the clean rows are the reference run's rows). changedShare is the measured share of targets that changed (a replacement can draw the same word). idealLoss is what a model that learned the noisy targets perfectly would score on the clean held-out rows: the generator's own odds mixed with the uniform noise, computed exactly; the clean value is the generator floor. Uniform noise does not change which word is most likely, so a model that fitted the noisy targets perfectly would keep its accuracy and pay only in loss; the runs show local accuracy holding while the look-back skill, which needs a clean signal to form, arrives later or not at all within the budget. train is the loss on the noisy training targets. One seed each.`,
      floor: round(gen.held), runs: [["noise10", 0.1], ["noise30", 0.3]].map(([n, e]) => ({ share: e, changedShare: round(J[n].noise.changed / J[n].noise.targets), idealLoss: round(noisyFloor(gen.P, gen.y, e)), ...brief(J[n]) })),
    },
    duplication: {
      about: `The same ${STEPS} steps of ${M.batch} rows, so the same number of training tokens, drawn from a fixed pool of 64, 256 or 1,024 rows served in shuffled passes, against fresh rows every step (the reference). poolLoss is the loss on the pool itself, scored every 100 steps (what the model was trained on); heldOut is on the untouched rows; the gap between them is memorising. passes: how many times each pool row was seen. The held-out rows are new rows of the same grammar, so a short sentence in them may also sit in a pool. One seed each.`,
      fresh: brief(ref), runs: ["pool64", "pool256", "pool1024"].map((n) => ({ rows: JOBS[n][2].rows, passes: J[n].passes, ...brief(J[n]) })),
    },
    shift: {
      about: `Held-out rows from another mix, ${ROWS} rows each from their own seeds: copy episodes only, who episodes only, plain episodes only, who episodes where rerun is always the doer, and who episodes where tallow or pylon is. generator is the corpus generator's own loss on those rows when it assumes the default mix: a perfect default-mix model pays that much on shifted rows too, so the gap that matters is model minus generator. On 256 rows that gap has sampling noise of about a hundredth of a nat or more (the reference model lands slightly under the generator on copy-only rows), so only large gaps are read as a shift effect. rerunNeverDoes was trained on data where rerun never does the deed in a who episode (so never answers 'who ... ?'); guideAnswer is the accuracy on the guide's name after the question mark. One seed each; ${ROWS} rows per set.`,
      generator: Object.fromEntries(Object.keys(SHIFT).map((s) => [s, genLoss(s)])),
      reference: ref.shift, rerunNeverDoes: { ...J.rerunNeverDoes.shift, summary: J.rerunNeverDoes.summary }, lb0: J.lb0.shift, noCopyEpisodes: J.noCopyEpisodes.shift,
    },
  };
}

function generatorLosses() {
  const lossOf = (set) => { const P = trueTable(set), V = 46; let s = 0; for (let n = 0; n < set.y.length; n++) s -= Math.log(P[n * V + set.y[n]]); return { P, loss: s / set.y.length }; };
  const h = HELD(), g = lossOf(h), out = { held: g.loss, P: g.P, y: h.y };
  for (const s of Object.keys(SHIFT)) out[s] = lossOf(shiftSet(s)).loss;
  return out;
}

async function main() {
  if (jobAt >= 0) { process.stdout.write(JSON.stringify(runJob(process.argv[jobAt + 1]))); return; }
  const t0 = Date.now();
  const J = await pool(Object.keys(JOBS), 4);
  const facts = {
    about: "Lesson L13, data. Computed by tools/school/fill_data.mjs from system/school/data.mjs and the attention lab's own model and trainer. Do not edit by hand. Losses are in nats (natural log); every run starts from the same model seed and is scored on the same held-out rows.",
    modelSha256: createHash("sha256").update(raw).digest("hex"), modelFile: "media/school/attention/model.json",
    recipe: { modelSeed: M.seed, dataSeed: M.dataSeed, steps: STEPS, batch: M.batch, lr: M.lr, heldOutRows: ROWS, config: M.config },
    ...sections(J, generatorLosses()),
    runSeconds: Object.fromEntries(Object.values(J).map((j) => [j.name, round(j.seconds, 1)])), seconds: 0,
  };
  facts.seconds = round((Date.now() - t0) / 1000, 1);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  const line = (b) => `${b.name.padEnd(16)} held ${b.summary.heldOut} best ${b.summary.bestHeldOut} copy ${b.summary.copyAccuracy} local ${b.summary.localAccuracy} cpEp ${b.split.copyEpisodes?.accuracy} whoEp ${b.split.whoEpisodes?.accuracy}`;
  console.log(JSON.stringify({ reproduce: { points: facts.reproduce.points, equal: facts.reproduce.pointsEqual, worst: facts.reproduce.worstAbsDiff }, noise: { ref: facts.noise.reference, lb5: facts.noise.lookback5 },
    lookback: facts.lookback.runs.map((b) => `${b.lookbackShare} fed ${b.lookbackFed} ${line(b)}`), noCopy: line(facts.noCopy.run),
    labelNoise: facts.labelNoise.runs.map((b) => `${b.share} changed ${b.changedShare} ideal ${b.idealLoss} ${line(b)} train ${b.curve.at(-1).train}`), floor: facts.labelNoise.floor,
    dup: facts.duplication.runs.map((b) => `${b.rows} passes ${b.passes} pool ${b.curve.at(-1).poolLoss} ${line(b)}`), shift: facts.shift, seconds: facts.seconds }, null, 1));
}

main().catch((e) => { console.error("fill_data failed:", e); process.exit(1); });
