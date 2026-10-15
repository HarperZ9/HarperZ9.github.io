// Fill lesson L12's numbers ("The training loop") so no number in the film
// or lab is typed by hand. Writes media/school/trainloop/facts.json.
//
//   node tools/school/fill_trainloop.mjs [media/school/attention/model.json] [media/school/trainloop]
//
// Re-trains the attention lab's model from its seeds with the lab's own
// trainer and checks the result against model.json, then trains one-change
// variants and two broken controls. Each run is a child process (at most 4
// at once, below-normal priority); the step timing runs alone at the end.
// About 90 seconds of wall time on a 4-core budget.
//   node tools/school/fill_trainloop.mjs --job <name>    one run, JSON to stdout
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runCurve, summarise, normStats, compareCurves, stepAnatomy, DEFAULTS } from "../../system/school/trainloop.mjs";
import { createModel, fromJSON, toJSON, evaluate, FLOPS, CLIP_NORM } from "../../system/school/tinyformer.mjs";
import { heldOut } from "../../system/school/corpus.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const SELF = fileURLToPath(import.meta.url);
const jobAt = process.argv.indexOf("--job");
const modelPath = (jobAt < 0 && process.argv[2]) || "media/school/attention/model.json";
const outDir = (jobAt < 0 && process.argv[3]) || "media/school/trainloop";
const raw = readFileSync(modelPath), M = JSON.parse(raw.toString("utf8"));
const round = (v, k = 4) => (typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 10 ** k) / 10 ** k : v);
const r = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round(v)]));

const BASE = { seed: M.dataSeed, batch: M.batch, lr: M.lr };
const V_STEPS = 1000;
// name: [options, steps, every, group]
const JOBS = {
  reproduce: [{}, M.steps, M.curveEvery, "reproduce"],
  lrLow: [{ lr: 1e-3 }, V_STEPS, 50, "variant"],
  lrMid: [{ lr: 3e-2 }, V_STEPS, 50, "variant"],
  lrHigh: [{ lr: 1e-1 }, V_STEPS, 50, "variant"],
  noClip: [{ clip: Infinity }, V_STEPS, 50, "variant"],
  noDecay: [{ weightDecay: 0 }, V_STEPS, 50, "variant"],
  batch4Steps: [{ batch: 4 }, V_STEPS, 50, "variant"],
  batch4Tokens: [{ batch: 4 }, 4 * V_STEPS, 200, "variant"],
  batch64Tokens: [{ batch: 64 }, V_STEPS / 4, 25, "variant"],
  dataSeed12: [{ seed: 12 }, V_STEPS, 50, "noise"],
  dataSeed13: [{ seed: 13 }, V_STEPS, 50, "noise"],
  lrZero: [{ lr: 0 }, 200, 50, "control"],
  uphill: [{ gradSign: -1 }, 200, 50, "control"],
};

function runJob(name) {
  const [opts, steps, every] = JOBS[name];
  const model = createModel({}, M.seed), held = heldOut(M.heldOutRows, M.config.ctx);
  const t0 = Date.now();
  const res = runCurve(model, held, { ...BASE, ...opts, steps, every });
  const out = { name, steps, every, curve: res.curve.map(r), summary: r(summarise(res.curve)), norms: r(normStats(res.gradNorms, CLIP_NORM)), clippedInRun: res.clipped, msPerStep: res.msPerStep, tokensPerStep: res.tokensPerStep, seconds: (Date.now() - t0) / 1000 };
  if (name === "reproduce") {
    out.gradNorms = Array.from(res.gradNorms, (v) => round(v, 4));
    const w = toJSON(model).params;
    out.tensorsEqual = model.names.filter((n) => w[n] === M.weights.params[n]).length;
    out.tensorsTotal = model.names.length;
  }
  return out;
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

const pick = (j) => ({ name: j.name, steps: j.steps, tokens: j.steps * j.tokensPerStep, summary: j.summary, norms: j.norms, curve: j.curve.map((p) => ({ step: p.step, tokens: p.step * j.tokensPerStep, train: p.train, heldOut: p.heldOut, copyAccuracy: p.copyAccuracy, localAccuracy: p.localAccuracy })) });

function sections(J, anatomy, startLoss) {
  const rep = J.reproduce, cmp = compareCurves(rep.curve, M.curve);
  const gn = M.gradNorms.filter(([s, v]) => rep.gradNorms[s - 1] === v).length;
  const at = (s) => rep.curve.find((p) => p.step === s);
  const ref1000 = { name: "reference", steps: V_STEPS, tokens: V_STEPS * rep.tokensPerStep, summary: r(summarise(rep.curve.filter((p) => p.step <= V_STEPS && p.step % 50 === 0))), curve: rep.curve.filter((p) => p.step <= V_STEPS && p.step % 50 === 0).map((p) => ({ step: p.step, tokens: p.step * rep.tokensPerStep, heldOut: p.heldOut, copyAccuracy: p.copyAccuracy, localAccuracy: p.localAccuracy })) };
  const fl = FLOPS(M.config, M.batch, M.config.ctx);
  return {
    recipe: {
      about: "What the lab's trainer does each step, read off the code. Batch: 16 rows of 24 words cut from a seeded stream of whole corpus episodes. Forward, then mean cross-entropy over all 384 next-word targets. Backward: a hand-written gradient for every parameter (checked against finite differences in the tinyformer tests). Clip: if the global L2 norm of the whole gradient exceeds 1.0, every gradient is scaled by 1.0 / norm. Step: Adam (Kingma and Ba 2015, arXiv 1412.6980, Algorithm 1: bias-corrected first and second moment estimates) with beta1 0.9, beta2 0.99 (the paper's suggested default is 0.999), epsilon 1e-8, and decoupled weight decay 0.01 as in AdamW (Loshchilov and Hutter 2019, arXiv 1711.05101), applied to weight matrices and embeddings only, never to gains or biases. One difference from the paper's Algorithm 2: there the decay term is scaled by the schedule multiplier only; here it is scaled by the full learning rate (the convention of common libraries), so the per-step shrink is lr x 0.01. Learning rate: linear warmup from lr/30 to lr over the first 30 steps, then constant; no decay schedule.",
      defaults: { ...DEFAULTS, clip: CLIP_NORM }, model: { seed: M.seed, dataSeed: M.dataSeed, steps: M.steps, batch: M.batch, lr: M.lr, nParams: M.nParams },
      flops: fl, warmupLr: [1, 2, 10, 30, 31].map((s) => ({ step: s, lr: round(M.lr * Math.min(1, s / 30), 6) })),
    },
    reproduce: {
      about: `Re-trained from the model's seeds (model seed ${M.seed}, data seed ${M.dataSeed}) with the lab's own trainer for the full ${M.steps} steps, scored every ${M.curveEvery} steps on the same ${M.heldOutRows} held-out rows, and compared with the curve stored in model.json after rounding to 4 decimals. tensorsEqual: weight tensors whose float32 bytes match model.json exactly. gradNormsEqual: logged gradient norms (every ${M.curveEvery} steps) equal after rounding. Bit-identical on this engine (V8 in Node); the code notes another engine may differ in the last bit of exp and tanh and drift from there, which this run does not test.`,
      points: cmp.points, pointsEqual: cmp.equal, worstAbsDiff: cmp.worstAbsDiff, tensorsEqual: rep.tensorsEqual, tensorsTotal: rep.tensorsTotal,
      gradNormsEqual: gn, gradNormsLogged: M.gradNorms.length, summary: rep.summary,
      curve: rep.curve.map((p) => ({ step: p.step, train: p.train, heldOut: p.heldOut, copyAccuracy: p.copyAccuracy, localAccuracy: p.localAccuracy })),
      milestones: [0, 30, 100, 500, 750, 1000, 2000].map(at).filter(Boolean).map((p) => ({ step: p.step, heldOut: p.heldOut, copyAccuracy: p.copyAccuracy })),
    },
    gradients: {
      about: `The global L2 norm of the gradient at every one of the ${M.steps} steps of the reproduced run, measured before clipping. clipped: steps where the norm exceeded ${CLIP_NORM}, so the clip scaled the step down. byWindow: the same per block of 250 steps. One run: how often the clip fires depends on the seed, the batch size and the learning rate.`,
      stats: rep.norms, perStep: rep.gradNorms, byWindow: windows(rep.gradNorms, 250),
    },
    variants: {
      about: `One change each from the reference recipe (batch 16, lr 0.01 with 30 warmup steps, clip ${CLIP_NORM}, weight decay 0.01, data seed ${M.dataSeed}, model seed ${M.seed}), trained ${V_STEPS} steps where not stated and scored every 50 steps on the same ${M.heldOutRows} held-out rows. reference is the reproduced run's first ${V_STEPS} steps. Batch runs: batch4Steps keeps the step count (a quarter of the words); batch4Tokens and batch64Tokens keep the words seen (${V_STEPS * rep.tokensPerStep} target words) and so change the step count; the learning rate is not rescaled with batch size. noise: the reference recipe with data seeds 12 and 13, to show how far two runs that differ only in luck land apart; a variant inside that spread is not shown to differ. firstCopyStep: first scored step with copy accuracy at or above 0.9 (null: never in this run). One seed per variant: a single run each, so differences smaller than the noise runs' spread are not evidence.`,
      reference: ref1000, runs: ["lrLow", "lrMid", "lrHigh", "noClip", "noDecay", "batch4Steps", "batch4Tokens", "batch64Tokens"].map((n) => ({ ...pick(J[n]), options: describe(JOBS[n][0]) })),
      noise: ["dataSeed12", "dataSeed13"].map((n) => ({ ...pick(J[n]), options: describe(JOBS[n][0]) })),
    },
    controls: {
      about: `Two broken loops that must fail to learn, from the same seeds, 200 steps each. lrZero: learning rate 0, so every update is zero and the held-out loss must stay at its starting value. uphill: the gradient's sign flipped before the optimiser, so each step climbs the loss. startLoss is the untrained network's held-out loss on the same rows. A control that fails shows the measurement can tell learning from not learning; it does not show the normal recipe is the best one.`,
      startLoss: round(startLoss), runs: ["lrZero", "uphill"].map((n) => ({ ...pick(J[n]), end: J[n].summary, options: describe(JOBS[n][0]) })),
    },
    speed: speedSection(anatomy, rep, fl),
  };
}

function speedSection(anatomy, rep, fl) {
  const ms = anatomy.ms.batch + anatomy.ms.forwardBackward + anatomy.ms.update;
  return {
    about: `Time per training step in Node (V8, one thread, float32 buffers), measured alone after the training runs finished: anatomy times ${anatomy.n} steps split into drawing the batch, a forward pass, forward plus backward, and the optimiser update. tokensPerSecond counts target words per second of a full step. reproduceMsPerStep is the wall time per step of the reproduced run, which shared the machine with up to 3 other runs. One machine and one engine: a browser tab or another CPU will differ.`,
    anatomy: { ...anatomy, ms: r(anatomy.ms), backwardOnly: round(anatomy.backwardOnly) },
    msPerStep: round(ms, 3),
    tokensPerSecond: Math.round((anatomy.batch * anatomy.ctx * 1000) / ms),
    reproduceMsPerStep: round(rep.msPerStep, 3), reproduceSeconds: round(rep.seconds, 2), flopsPerStep: fl.step,
    mflopsPerSecond: round(fl.step / ms / 1000, 1),
  };
}

function windows(norms, size) {
  const out = [];
  for (let s = 0; s < norms.length; s += size) {
    const w = norms.slice(s, s + size);
    out.push({ from: s + 1, to: s + w.length, clipped: w.filter((v) => v > CLIP_NORM).length, median: round(w.slice().sort((a, b) => a - b)[w.length >> 1]) });
  }
  return out;
}

function describe(o) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === Infinity ? "none" : v]));
}

async function main() {
  if (jobAt >= 0) { process.stdout.write(JSON.stringify(runJob(process.argv[jobAt + 1]))); return; }
  const t0 = Date.now();
  const J = await pool(Object.keys(JOBS), 4);
  const anatomy = stepAnatomy(fromJSON(M.weights), { n: 60, seed: M.dataSeed });
  const startLoss = evaluate(createModel({}, M.seed), heldOut(M.heldOutRows, M.config.ctx)).loss;
  const facts = {
    about: "Lesson L12, the training loop. Computed by tools/school/fill_trainloop.mjs from system/school/trainloop.mjs and the attention lab's own trainer. Do not edit by hand. Losses are in nats (natural log).",
    modelSha256: createHash("sha256").update(raw).digest("hex"), modelFile: "media/school/attention/model.json",
    ...sections(J, anatomy, startLoss), seconds: 0,
  };
  facts.seconds = round((Date.now() - t0) / 1000, 1);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  const { reproduce: rp, variants: v, controls: c, speed: sp, gradients: g } = facts;
  console.log(JSON.stringify({ reproduce: { points: rp.points, equal: rp.pointsEqual, worst: rp.worstAbsDiff, tensors: `${rp.tensorsEqual}/${rp.tensorsTotal}`, gradNorms: `${rp.gradNormsEqual}/${rp.gradNormsLogged}` }, grad: g.stats, windows: g.byWindow,
    variants: [v.reference, ...v.runs, ...v.noise].map((x) => `${x.name.padEnd(14)} ${JSON.stringify(x.summary)} clip ${x.norms ? x.norms.clipped : "-"}`),
    controls: c.runs.map((x) => `${x.name} ${JSON.stringify(x.end)}`), startLoss: c.startLoss, speed: sp, seconds: facts.seconds }, null, 1));
}

main().catch((e) => { console.error("fill_trainloop failed:", e); process.exit(1); });
