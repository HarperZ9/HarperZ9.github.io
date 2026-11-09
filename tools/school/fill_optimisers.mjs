// Fill lesson F5's numbers ("Optimisers: momentum, Adam and the learning
// rate") so no number in the film is typed by hand. Writes
// media/school/optimisers/facts.json.
//
//   node tools/school/fill_optimisers.mjs
//
// Update rules, schedules and the surface races come from
// system/school/optimisers.mjs. The spiral retrain uses backprop.mjs's net
// and data; the transformer comparison rebuilds the attention lab's model
// from the same config and seeds as media/school/attention/model.json and
// trains it for 400 steps with its own AdamW and with plain SGD and heavy-ball
// momentum. About 90 s at BelowNormal priority on one core.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adam, adamw, adamL2, ADAM_DEFAULTS, warmupCosine, warmupLinear, warmupConstant, scheduleCurve, race, RACES, RACE_BASE,
  momentumStudy, valleyRuns, run2d, trainNet, trainTransformer } from "../../system/school/optimisers.mjs";
import { TWO_VALLEYS } from "../../system/school/gradients.mjs";
import { twoSpirals, createNet } from "../../system/school/backprop.mjs";
import { createModel, createTrainer, evaluate } from "../../system/school/tinyformer.mjs";
import { heldOut, makeBatch } from "../../system/school/corpus.mjs";
import { rng } from "../../system/school/tinyformer-ops.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MODEL = resolve(ROOT, "media/school/attention/model.json");
const OUT = resolve(ROOT, "media/school/optimisers/facts.json");
const sig = (v, k = 5) => (typeof v === "number" ? (Number.isFinite(v) ? Number(v.toPrecision(k)) : String(v)) : v);
const sigs = (a, k) => a.map((v) => (Array.isArray(v) ? sigs(v, k) : sig(v, k)));
const thin = (path, n) => path.filter((_, i) => i % Math.max(1, Math.ceil(path.length / n)) === 0 || i === path.length - 1);
const t0 = Date.now(), timing = {};
const lap = (k, t) => { timing[k] = Math.round((Date.now() - t) / 100) / 10; };

// --- update rules on a two-coordinate example ------------------------------------
let t = Date.now();
function firstSteps(fn, hp, g, n = 5) {
  let theta = Float64Array.from([1, 0.1]), state = null;
  const rows = [[...theta]];
  for (let k = 0; k < n; k++) { ({ theta, state } = fn(theta, g(theta), state, hp)); rows.push([...theta]); }
  return sigs(rows, 6);
}
const constG = () => [0.5, -0.002];
const zeroG = () => [0, 0];
const rules = {
  about: "Two parameters starting at (1, 0.1). Bias correction: a constant gradient (0.5, -0.002), Adam at the paper defaults (alpha 1e-3). With correction each coordinate moves by alpha on the first step whatever the gradient's size; without it, by alpha (1 - beta1) / sqrt(1 - beta2) = 3.162 alpha. Decoupled decay: zero gradient, lambda 0.1 (AdamW, lr 1e-3, eta 1) shrinks each weight by the factor 1 - eta lambda = 0.9 per step; Adam with the same lambda as L2 (folded into the gradient) moves each weight by about alpha per step, whatever its size, because Adam divides the decay by its own magnitude.",
  biasCorrection: { gradient: constG(), withCorrection: firstSteps(adam, {}, constG), withoutCorrection: firstSteps(adam, { biasCorrection: false }, constG),
    predictedFirstStepRatio: sig((1 - ADAM_DEFAULTS.beta1) / Math.sqrt(1 - ADAM_DEFAULTS.beta2)) },
  decoupledDecay: { lambda: 0.1, adamw: firstSteps(adamw, { weightDecay: 0.1 }, zeroG), adamL2: firstSteps(adamL2, { weightDecay: 0.1 }, zeroG) },
};

// --- schedules -------------------------------------------------------------------
const SCHED = { warmup: 200, total: 4000 };
const schedules = {
  about: "Multipliers on the peak learning rate at update t. Linear warmup over 200 updates, then cosine (SGDR eq. 5, one cycle) or linear decay to zero at 4000; the attention lab's trainer uses warmup over 30 updates then flat.",
  ...SCHED, cosine: sigs(scheduleCurve(warmupCosine, SCHED, 80), 4), linear: sigs(scheduleCurve(warmupLinear, SCHED, 80), 4),
  labTrainer: sigs(scheduleCurve(warmupConstant, { warmup: 30, total: 400 }, 40), 4),
};

// --- races -----------------------------------------------------------------------
const races = {};
for (const id of Object.keys(RACES)) {
  const R = RACES[id], r = race(id);
  races[id] = { start: R.start, maxSteps: R.steps, threshold: R.threshold, min: R.surface.min,
    settings: Object.fromEntries(Object.entries(RACE_BASE).map(([n, b]) => [n, b])),
    entrants: Object.fromEntries(Object.entries(r).map(([n, v]) => [n, { grid: v.grid, chosenLr: v.chosenLr, atGridEdge: v.chosenLr === v.grid[0] || v.chosenLr === v.grid.at(-1),
      stepsToThreshold: v.run.stepsToThreshold, firstBelow: v.run.firstBelow, finalLoss: sig(v.run.f), diverged: v.run.diverged,
      tried: v.tried.map((x) => ({ lr: x.lr, stepsToThreshold: x.stepsToThreshold, firstBelow: x.firstBelow, finalLoss: sig(x.finalLoss), diverged: x.diverged })),
      path: sigs(thin(v.run.path.slice(0, (v.run.stepsToThreshold ?? v.run.path.length) + 1), 120), 5) }])) };
}
const ms = momentumStudy();
const aboveEdge = { about: "The tilted bowl (curvatures 4 and 0.5) at 1.2 times plain descent's edge (step 0.6). Edges measured by bisection on the per-step growth of real runs: plain descent 2 / k_max, heavy ball (beta 0.9) 2 (1 + beta) / k_max. Each optimiser runs 400 updates from (-2, 2); Adam at its paper defaults with alpha 0.6.",
  kMax: ms.kMax, beta: ms.beta, lr: ms.lr, startLoss: sig(ms.startLoss), plainBound: { predicted: ms.plainBound.predicted, measured: sig(ms.plainBound.measured, 12) },
  momentumBound: { predicted: ms.momentumBound.predicted, measured: sig(ms.momentumBound.measured, 12) },
  runs: Object.fromEntries(Object.entries(ms.runs).map(([n, r]) => [n, { outcome: r.outcome, finalLoss: sig(r.finalLoss), bestLoss: sig(r.bestLoss), stepsToThreshold: r.stepsToThreshold, path: sigs(thin(r.path.slice(0, 160), 80), 5) }])) };
const VALLEY = { sgd: { lr: 0.05 }, momentum: { lr: 0.005, beta: 0.9 }, adam: { ...ADAM_DEFAULTS, lr: 0.05 } };
const BASIN_N = 21, basins = {};
for (const [n, hp] of Object.entries(VALLEY)) {
  const rows = [];
  let left = 0;
  for (let j = 0; j < BASIN_N; j++) {
    const row = [];
    for (let i = 0; i < BASIN_N; i++) { const r = run2d(TWO_VALLEYS, [-2 + 4 * i / (BASIN_N - 1), -2 + 4 * j / (BASIN_N - 1)], n, hp, { steps: 3000, threshold: -Infinity, keepPath: false }); row.push(r.end[0] < 0 ? -1 : 1); left += r.end[0] < 0; }
    rows.push(row);
  }
  basins[n] = { values: rows, fractionLeft: sig(left / (BASIN_N * BASIN_N), 4) };
}
const demo = valleyRuns([[2, 0]], VALLEY)[0];
const valleys = { about: "Two valleys (the left one deeper). Which valley each start ends in after 3000 updates, on a 21 x 21 grid over [-2, 2]^2 (rows are y, -1 left, 1 right). SGD step 0.05, heavy ball step 0.005 with beta 0.9 (the same terminal speed on a constant slope, 0.005 / (1 - 0.9) = 0.05), Adam alpha 0.05. The demo start (2, 0) is one where momentum crosses the ridge.",
  settings: VALLEY, basins, demo: { start: demo.start, runs: Object.fromEntries(Object.entries(demo.runs).map(([n, r]) => [n, { valley: r.valley, end: sigs(r.end), f: sig(r.f), path: sigs(thin(r.path, 120), 4) }])) } };
lap("surfaces", t);

// --- spiral retrain ----------------------------------------------------------------
t = Date.now();
const SP = { netSeed: 3, trainSeed: 1, heldSeed: 2, validSeed: 4, batchSeed: 5, points: 400, steps: 4000, batch: 32, every: 100, target: 0.95, beta: 0.9 };
const data = twoSpirals(SP.points, SP.trainSeed), held = twoSpirals(SP.points, SP.heldSeed), valid = twoSpirals(SP.points, SP.validSeed);
const GRID = { sgd: [0.1, 0.3, 1, 3], momentum: [0.01, 0.03, 0.1, 0.3], adam: [0.003, 0.01, 0.03, 0.1, 0.3] };
const hpOf = (o, lr) => (o === "momentum" ? { lr, beta: SP.beta } : o === "adam" ? { ...ADAM_DEFAULTS, lr } : { lr });
const firstAt = (c, key) => { const p = c.find((q) => q[key] >= SP.target); return p ? p.step : null; };
// Selection on the validation draw: fewest updates to the target, ties by final validation accuracy.
const rank = (c) => (firstAt(c, "validAccuracy") ?? SP.steps + 1) - c[c.length - 1].validAccuracy;
const tidyCurve = (c) => c.map((p) => ({ step: p.step, loss: sig(p.loss, 4), heldLoss: sig(p.heldLoss, 4), accuracy: sig(p.accuracy, 4), heldAccuracy: sig(p.heldAccuracy, 4) }));
const runSpiral = (o, hp, extra = {}) => trainNet(createNet(extra.netSeed ?? SP.netSeed), data, held, { optimiser: o, hp, steps: SP.steps, batch: SP.batch, seed: extra.batchSeed ?? SP.batchSeed, every: SP.every, valid, schedule: extra.schedule ?? null });
const spiral = { about: "The F4 spiral net (2, 8, 8, 2, tanh, 114 parameters) retrained from the same initial weights (seed 3) on the same 400 points (seed 1) with the same minibatches (32, seed 5) for 4000 updates. Each optimiser's step is chosen from its grid by the fewest updates to 95 percent accuracy on a separate validation draw (seed 4), so the held-out set (seed 2) is never used to choose. Heavy ball beta 0.9; Adam at the paper defaults except alpha. 'adamCosine' reruns Adam's chosen alpha with linear warmup over 200 updates and cosine decay to zero at 4000.",
  ...SP, grids: GRID, arms: {} };
for (const [o, lrs] of Object.entries(GRID)) {
  const tried = lrs.map((lr) => ({ lr, curve: runSpiral(o, hpOf(o, lr)) }));
  const best = tried.reduce((a, b) => (rank(b.curve) < rank(a.curve) ? b : a));
  spiral.arms[o] = { chosenLr: best.lr, atGridEdge: best.lr === lrs[0] || best.lr === lrs.at(-1),
    tried: tried.map((x) => ({ lr: x.lr, firstValidAtTarget: firstAt(x.curve, "validAccuracy"), finalValidAccuracy: x.curve.at(-1).validAccuracy, finalHeldAccuracy: x.curve.at(-1).heldAccuracy })),
    firstHeldAtTarget: firstAt(best.curve, "heldAccuracy"), finalHeldAccuracy: best.curve.at(-1).heldAccuracy, finalHeldLoss: sig(best.curve.at(-1).heldLoss, 4), curve: tidyCurve(best.curve) };
}
{
  const lr = spiral.arms.adam.chosenLr, c = runSpiral("adam", hpOf("adam", lr), { schedule: (s) => warmupCosine(s, SCHED) });
  spiral.arms.adamCosine = { chosenLr: lr, schedule: "warmupCosine", ...SCHED, firstHeldAtTarget: firstAt(c, "heldAccuracy"), finalHeldAccuracy: c.at(-1).heldAccuracy, finalHeldLoss: sig(c.at(-1).heldLoss, 4), curve: tidyCurve(c) };
}
// Seed spread: five (net seed, batch seed) pairs, data fixed, each arm at its chosen step.
const SEEDS = [[3, 5], [13, 15], [23, 25], [33, 35], [43, 45]];
spiral.seedSpread = { about: "Each arm at its chosen step, rerun with five (net seed, batch seed) pairs; data fixed. Updates to 95 percent held-out accuracy (null if never within 4000) and final held-out accuracy.", seeds: SEEDS,
  arms: Object.fromEntries(["sgd", "momentum", "adam"].map((o) => {
    const rows = SEEDS.map(([ns, bs]) => { const c = runSpiral(o, hpOf(o, spiral.arms[o].chosenLr), { netSeed: ns, batchSeed: bs }); return { firstHeldAtTarget: firstAt(c, "heldAccuracy"), finalHeldAccuracy: c.at(-1).heldAccuracy }; });
    const acc = rows.map((r) => r.finalHeldAccuracy);
    return [o, { rows, finalHeldAccuracy: { min: Math.min(...acc), max: Math.max(...acc), mean: sig(acc.reduce((a, b) => a + b, 0) / acc.length, 4) } }];
  })) };
lap("spiral", t);

// --- the transformer --------------------------------------------------------------
t = Date.now();
const bytes = readFileSync(MODEL), sha256 = createHash("sha256").update(bytes).digest("hex");
const M = JSON.parse(bytes.toString("utf8"));
const TF = { modelSeed: M.seed, dataSeed: M.dataSeed, batch: M.batch, warmup: 30, clip: 1, steps: 400, every: 50, heldRows: 256, validSeed: 4242, validRows: 64 };
const heldTF = heldOut(TF.heldRows, M.config.ctx), validTF = makeBatch(rng(TF.validSeed), TF.validRows, M.config.ctx);
const r4 = (v) => Math.round(v * 1e4) / 1e4;
function tfPoint(model, s, win) {
  const e = evaluate(model, heldTF);
  return { step: s, train: win.length ? r4(win.reduce((a, b) => a + b, 0) / win.length) : null, heldOut: r4(e.loss), copyAccuracy: r4(e.copyAccuracy), localAccuracy: r4(e.localAccuracy) };
}
function tfAdamW(lr) {
  const model = createModel(M.config, TF.modelSeed), tr = createTrainer(model, { seed: TF.dataSeed, batch: TF.batch, lr, warmup: TF.warmup, clip: TF.clip });
  const curve = [tfPoint(model, 0, [])];
  let win = [];
  for (let s = 1; s <= TF.steps; s++) { win.push(tr.step().loss); if (s % TF.every === 0) { curve.push(tfPoint(model, s, win)); win = []; } }
  return { lr, curve, validLoss: evaluate(model, validTF).loss };
}
function tfOther(optimiser, lr) {
  const model = createModel(M.config, TF.modelSeed), curve = [tfPoint(model, 0, [])];
  let win = [];
  const hp = optimiser === "momentum" ? { lr, beta: 0.9 } : { lr };
  trainTransformer(model, { optimiser, hp, steps: TF.steps, batch: TF.batch, seed: TF.dataSeed, warmup: TF.warmup, clip: TF.clip,
    onStep: (o) => { win.push(o.loss); if (o.step % TF.every === 0) { curve.push(tfPoint(model, o.step, win)); win = []; } } });
  return { lr, curve, validLoss: evaluate(model, validTF).loss };
}
const TF_GRID = { adamw: [3e-3, 1e-2, 3e-2], sgd: [0.1, 0.3, 1, 3], momentum: [0.03, 0.1, 0.3, 1] };
const tfArms = {};
for (const [o, lrs] of Object.entries(TF_GRID)) {
  const tried = lrs.map((lr) => (o === "adamw" ? tfAdamW(lr) : tfOther(o, lr)));
  const best = tried.reduce((a, b) => (b.validLoss < a.validLoss ? b : a));
  tfArms[o] = { chosenLr: best.lr, atGridEdge: best.lr === lrs[0] || best.lr === lrs.at(-1), finalHeldOut: best.curve.at(-1).heldOut, finalCopyAccuracy: best.curve.at(-1).copyAccuracy, tried: tried.map((x) => ({ lr: x.lr, validLoss: r4(x.validLoss), finalHeldOut: x.curve.at(-1).heldOut, finalCopyAccuracy: x.curve.at(-1).copyAccuracy })), curve: best.curve };
  if (o === "adamw") tfArms[o].published = tried.find((x) => x.lr === M.lr)?.curve ?? null;
}
// The AdamW run at the published lr is the start of model.json's run: its held-out curve must match model.json's.
const pub = tfArms.adamw.published;
const reproduces = pub ? pub.filter((p) => p.step > 0).every((p) => M.curve.find((q) => q.step === p.step).heldOut === p.heldOut) : null;
delete tfArms.adamw.published;
const transformer = {
  about: "The attention lab's transformer, 400 updates from the same initial weights (seed 7) on the same batches (16 rows, data seed 11), with the same linear warmup (30 updates) and global-norm clipping at 1.0. What differs: AdamW is the lab trainer's own (moments kept in float32, decoupled weight decay 0.01 times lr on matrices and embeddings only); SGD and heavy ball (beta 0.9) use the pure steps of optimisers.mjs with no weight decay. Each arm's peak step is chosen from its grid by loss on 64 validation rows (seed 4242) after 400 updates; held-out curves are on the lab's 256 held-out rows. 400 updates is early: the copy skill appears near update 750 in the full run, so this compares the first stretch of training only. 'train' is the mean loss of the training batches since the previous point.",
  ...TF, grids: TF_GRID, arms: tfArms, reproducesModelJson: reproduces,
  modelJsonAt400: { heldOut: M.curve.find((q) => q.step === 400).heldOut, copyAccuracy: M.curve.find((q) => q.step === 400).copyAccuracy },
};
lap("transformer", t);

const facts = {
  about: "Lesson F5, optimisers. Computed by tools/school/fill_optimisers.mjs from system/school/optimisers.mjs, backprop.mjs and the attention lab's tinyformer. Do not edit by hand.",
  modelJsonSha256: sha256, rules, schedules,
  races: { about: "Same start, each optimiser at its best step from the stated grid: fewest updates until the loss stays under the threshold to the end of the run ('stepsToThreshold'); 'firstBelow' is the first dip under it. Heavy ball beta 0.9; Adam at the paper defaults except alpha. Paths are thinned and stop at the settling update.", ...races },
  aboveEdge, valleys, spiral, transformer, seconds: { ...timing, total: Math.round((Date.now() - t0) / 1000) },
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(facts) + "\n");
console.log(JSON.stringify({
  rules: { biasFirst: [rules.biasCorrection.withCorrection[1], rules.biasCorrection.withoutCorrection[1]], decay: [rules.decoupledDecay.adamw.slice(0, 3), rules.decoupledDecay.adamL2.slice(0, 3)] },
  races: Object.fromEntries(Object.entries(races).map(([id, r]) => [id, Object.fromEntries(Object.entries(r.entrants).map(([n, e]) => [n, [e.chosenLr, e.atGridEdge, e.stepsToThreshold, e.firstBelow, e.finalLoss]]))])),
  aboveEdge: { plain: aboveEdge.plainBound, momentum: aboveEdge.momentumBound, runs: Object.fromEntries(Object.entries(aboveEdge.runs).map(([n, r]) => [n, [r.outcome, r.finalLoss, r.stepsToThreshold]])) },
  valleys: { fractionLeft: Object.fromEntries(Object.entries(basins).map(([n, b]) => [n, b.fractionLeft])), demo: Object.fromEntries(Object.entries(valleys.demo.runs).map(([n, r]) => [n, r.valley])) },
  spiral: Object.fromEntries(Object.entries(spiral.arms).map(([n, a]) => [n, { chosenLr: a.chosenLr, atGridEdge: a.atGridEdge, tried: a.tried, firstHeldAtTarget: a.firstHeldAtTarget, finalHeldAccuracy: a.finalHeldAccuracy, finalHeldLoss: a.finalHeldLoss }])),
  seedSpread: spiral.seedSpread.arms,
  transformer: { arms: Object.fromEntries(Object.entries(tfArms).map(([n, a]) => [n, { chosenLr: a.chosenLr, atGridEdge: a.atGridEdge, tried: a.tried }])), reproduces, at400: transformer.modelJsonAt400 },
  seconds: facts.seconds, sha256,
}, null, 1));
