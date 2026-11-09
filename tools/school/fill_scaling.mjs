// Fill lesson L14's numbers ("Scaling: bigger, longer, how much") so no number
// in the film or lab is typed by hand. Writes media/school/scaling/facts.json.
//
//   node tools/school/fill_scaling.mjs [media/school/attention/model.json] [media/school/scaling]
//
// Trains the attention lab's model at widths 8, 16, 32, 64 and depths 1, 2, 3
// for 4,000 steps each, scoring held-out loss at log-spaced checkpoints of
// the same run, plus repeat seeds at two grid points. Each run is a child
// process (at most 4 at once, below-normal priority), longest first.
//   node tools/school/fill_scaling.mjs --job <name>    one run, JSON to stdout
// FILL_STEPS=<n> shortens every run for a smoke test.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { gridConfig, paramCounts, computeOf, fitPowerLaw, frontier, bestAtBudget, logBudgets, spread, checkpoints, excess } from "../../system/school/scaling.mjs";
import { trainCurve, freshSource } from "../../system/school/data.mjs";
import { compareCurves } from "../../system/school/trainloop.mjs";
import { createModel, FLOPS } from "../../system/school/tinyformer.mjs";
import { heldOut } from "../../system/school/corpus.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const SELF = fileURLToPath(import.meta.url);
const jobAt = process.argv.indexOf("--job");
const modelPath = (jobAt < 0 && process.argv[2]) || "media/school/attention/model.json";
const outDir = (jobAt < 0 && process.argv[3]) || "media/school/scaling";
const raw = readFileSync(modelPath), M = JSON.parse(raw.toString("utf8"));
const round = (v, k = 4) => (typeof v === "number" && !Number.isInteger(v) ? Number(v.toPrecision(k + 1)) : v);
const r = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.map(round) : round(v)]));

const FLOOR = 0.6585; // the generator's own loss on these held-out rows (lesson L9's facts)
const STEPS = Number(process.env.FILL_STEPS) || 4000, AT = checkpoints(STEPS);
const WIDTHS = [8, 16, 32, 64], DEPTHS = [1, 2, 3];
// name: [width, depth, model seed, data seed]
const JOBS = {};
for (const d of WIDTHS) for (const L of DEPTHS) JOBS[`d${d}L${L}`] = [d, L, M.seed, M.dataSeed];
for (const d of [16, 32]) { JOBS[`d${d}L2s8`] = [d, 2, 8, 12]; JOBS[`d${d}L2s9`] = [d, 2, 9, 13]; }
const cfg = (j) => gridConfig(j[0], j[1]);

function runJob(name) {
  const j = JOBS[name], held = heldOut(M.heldOutRows, M.config.ctx), t0 = Date.now();
  const res = trainCurve(createModel(cfg(j), j[2]), held, { seed: j[3], batch: M.batch, lr: M.lr, steps: STEPS, at: AT, source: freshSource({ seed: j[3], batch: M.batch, ctx: M.config.ctx }) });
  return { name, curve: res.curve, seconds: (Date.now() - t0) / 1000 };
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

// One run as the lesson shows it: counts, and every checkpoint with compute.
function describeRun(name, J) {
  const j = JOBS[name], c = cfg(j), p = paramCounts(c), run = J[name];
  const pts = run.curve.filter((q) => q.step > 0).map((q) => ({ step: q.step, ...computeOf(c, q.step, M.batch, M.config.ctx), heldOut: q.heldOut, excess: excess(q.heldOut, FLOOR), copyAccuracy: q.copyAccuracy, localAccuracy: q.localAccuracy, train: q.train }));
  let best = pts[0];
  for (const q of pts) if (q.heldOut < best.heldOut) best = q;
  const end = pts.at(-1);
  return {
    name, config: { ...c, vocab: M.config.vocab, ctx: M.config.ctx }, modelSeed: j[2], dataSeed: j[3], params: p, flopsPerStep: FLOPS(c, M.batch, M.config.ctx).step,
    final: r({ step: end.step, heldOut: end.heldOut, excess: end.excess, copyAccuracy: end.copyAccuracy, flops: end.flops, tokens: end.tokens }),
    best: r({ step: best.step, heldOut: best.heldOut, excess: best.excess, copyAccuracy: best.copyAccuracy }),
    start: round(run.curve[0].heldOut), checkpoints: pts.map(r), seconds: round(run.seconds),
  };
}

const fitOut = (f) => (f.slope === null ? f : { n: f.n, slope: round(f.slope), se: round(f.se), r2: round(f.r2), intercept: round(f.intercept), xRange: f.xRange.map(round) });

function fits(grid) {
  const fin = grid.filter((g) => g.final.excess !== null);
  const by = (sel) => fitOut(fitPowerLaw(sel.map((g) => g.params.nonEmbedding), sel.map((g) => g.final.excess)));
  const width2 = fin.filter((g) => g.config.nLayers === 2);
  const longer = grid.map((g) => {
    const late = g.checkpoints.filter((q) => q.step >= 500 && q.excess !== null);
    return { name: g.name, ...fitOut(fitPowerLaw(late.map((q) => q.tokens), late.map((q) => q.excess))) };
  });
  return {
    about: `Straight lines on log-log axes, by least squares on log10 values. excess = held-out loss minus the generator floor ${FLOOR} nats. byParams: final excess (step ${STEPS}) against non-embedding parameters, all ${fin.length} grid runs, and the depth-2 runs alone (width only). byParamsTotal: the same against all parameters. byTokens: for each run, excess against training tokens over its checkpoints from step 500 on (how fast longer training still pays). se: standard error of the slope from the residuals, which treats the points as independent; seeds were not varied across the grid, so read slopes against the noise section. xRange: the span the line was fitted on; nothing outside it is claimed. The runs do not reach convergence at the larger sizes, so byParams mixes the effect of size with the effect of a fixed step budget.`,
    byParams: by(fin), byParamsWidthOnly: by(width2),
    byParamsTotal: fitOut(fitPowerLaw(fin.map((g) => g.params.total), fin.map((g) => g.final.excess))),
    byTokens: longer,
  };
}

function frontierSection(grid) {
  const pts = grid.flatMap((g) => g.checkpoints.filter((q) => q.excess !== null).map((q) => ({ compute: q.flops, loss: q.heldOut, excess: q.excess, run: g.name, step: q.step, nonEmbedding: g.params.nonEmbedding, total: g.params.total, tokens: q.tokens })));
  const front = frontier(pts);
  const budgets = bestAtBudget(pts, logBudgets(Math.min(...pts.map((p) => p.compute)), Math.max(...pts.map((p) => p.compute)), 4)).filter((b) => b.best);
  const fit = fitOut(fitPowerLaw(front.map((p) => p.compute), front.map((p) => p.excess)));
  const nOpt = fitOut(fitPowerLaw(budgets.map((b) => b.budget), budgets.map((b) => b.best.nonEmbedding)));
  return {
    about: `Every checkpoint of every grid run (seed-7 runs only) as a point: training compute so far (FLOPS of the model, forward and backward, attention included) and held-out loss there. points: the compute frontier, each checkpoint that beats every cheaper or equal-cost one. budgets: at four budgets per factor of ten, the best run and step that fits, with its non-embedding size and tokens per non-embedding parameter. fitExcess: frontier excess against compute. fitSizeAtBudget: the best model's non-embedding size against budget, the quantity Kaplan et al. and Hoffmann et al. disagree on; with 4 widths and 3 depths it can only take 12 values, so its slope is coarse. Checkpoints come from runs with a constant learning rate and no decay; Hoffmann et al. show that intermediate points of a run tuned for a longer horizon sit above what a run tuned for that length reaches, so the frontier here is an upper bound on what each budget can do.`,
    points: front.map(r), fitExcess: fit, fitSizeAtBudget: nOpt,
    budgets: budgets.map((b) => ({ budget: round(b.budget), run: b.best.run, step: b.best.step, heldOut: round(b.best.loss), nonEmbedding: b.best.nonEmbedding, tokensPerParam: round(b.best.tokens / b.best.nonEmbedding) })),
  };
}

function noiseSection(J, grid) {
  const at = (names) => {
    const runs = names.map((n) => describeRun(n, J));
    return { runs: names, heldOut: r(spread(runs.map((g) => g.final.heldOut))), log10Excess: r(spread(runs.map((g) => Math.log10(g.final.excess)))), copyAccuracy: r(spread(runs.map((g) => g.final.copyAccuracy))) };
  };
  const ref = grid.find((g) => g.name === "d32L2"), cmp = compareCurves(J.d32L2.curve.filter((q) => q.step <= M.steps), M.curve, ["heldOut", "copyAccuracy", "localAccuracy"]);
  return {
    about: `Repeat runs at two grid points (width 16 and 32, depth 2) with model seeds 7, 8, 9 and data seeds ${M.dataSeed}, 12, 13. log10Excess spread: how far one size moves by luck alone on the log axis the fits use; a slope times the log10 step between two sizes smaller than this sd is not resolved. reproduce: the d32 L2 grid run is the lesson model's own recipe, so its checkpoints up to step ${M.steps} must equal the stored training curve (4 decimals).`,
    d16: at(["d16L2", "d16L2s8", "d16L2s9"]), d32: at(["d32L2", "d32L2s8", "d32L2s9"]),
    reproduce: { points: cmp.points, pointsEqual: cmp.equal, worstAbsDiff: cmp.worstAbsDiff, finalAt4000: ref.final },
  };
}

const PAPERS = {
  about: "What the two papers claim, read from the papers, beside what this toy grid can and cannot say. Kaplan et al. 2020 (arXiv 2001.08361): loss falls as a power law in non-embedding parameters N (embeddings excluded), dataset size D and compute C, with exponents near 0.076, 0.095 and 0.050 over models of about 768 to 1.5 billion non-embedding parameters on WebText2; L(N) is measured on models trained near convergence; for a compute budget they find the best N grows as C to the 0.73, so most extra compute should buy a larger model trained short of convergence. Hoffmann et al. 2022 (arXiv 2203.15556, Chinchilla): over 400 models from 70 million to over 16 billion parameters on 5 to 500 billion tokens, with the learning-rate schedule matched to each run's length, three methods give the best N growing as C to about 0.46 to 0.50 and tokens as C to about 0.50 to 0.54, so parameters and tokens should grow together (about 20 tokens per parameter at their scale); their parametric fit L = E + A / N^0.34 + B / D^0.28 has a constant E for the text's own entropy, the term this lesson knows exactly (the generator floor). They attribute Kaplan's larger model-size exponent mainly to a fixed schedule and small models. This grid has 12 models of RANGE non-embedding parameters on a 46-word synthetic grammar with a known floor, 4,000 steps at most, one learning rate, a constant schedule, and one seed at most points. Its slopes are descriptions of this toy over this range; they are not estimates of either paper's exponents, and agreement or disagreement with those numbers is not evidence about large language models.",
  kaplan: { arxiv: "2001.08361", alphaN: 0.076, alphaD: 0.095, alphaCmin: 0.05, nOptExponent: 0.73, nRange: "about 768 to 1.5e9 non-embedding parameters" },
  hoffmann: { arxiv: "2203.15556", a: [0.5, 0.49, 0.46], b: [0.5, 0.51, 0.54], E: 1.69, alpha: 0.34, beta: 0.28, models: "over 400, 70e6 to over 16e9 parameters, 5e9 to 500e9 tokens", chinchilla: { params: 70e9, tokens: 1.4e12 }, gopher: { params: 280e9, tokens: 300e9 } },
};

async function main() {
  if (jobAt >= 0) { process.stdout.write(JSON.stringify(runJob(process.argv[jobAt + 1]))); return; }
  const t0 = Date.now(), cost = (n) => FLOPS(cfg(JOBS[n])).step + 4e6;
  const J = await pool(Object.keys(JOBS).sort((a, b) => cost(b) - cost(a)), 4);
  const grid = WIDTHS.flatMap((d) => DEPTHS.map((L) => describeRun(`d${d}L${L}`, J)));
  const facts = {
    about: "Lesson L14, scaling. Computed by tools/school/fill_scaling.mjs from system/school/scaling.mjs and the attention lab's own model and trainer. Do not edit by hand. Losses are in nats (natural log).",
    modelSha256: createHash("sha256").update(raw).digest("hex"), modelFile: "media/school/attention/model.json", floor: FLOOR,
    grid: {
      about: `Widths 8, 16, 32 and 64 with feed-forward width twice the model width and 2 heads, depths 1, 2 and 3: 12 models, each trained ${STEPS} steps of ${M.batch} rows of ${M.config.ctx} words (fresh rows every step, data seed ${M.dataSeed}, model seed ${M.seed}, learning rate ${M.lr} with 30 warmup steps then constant, the lesson model's recipe unchanged), scored on the same ${M.heldOutRows} held-out rows at steps ${AT.join(", ")}. params.nonEmbedding leaves out the token table, the position table and the untied readout (Kaplan et al. count N this way); params.total counts everything. flops: training compute so far from the model's own FLOPS count (3 x forward). sixND: Kaplan's 6 x N x D estimate, for comparison. Width 8 has 4 numbers per head. The learning rate and initial scale were tuned for width 32 and not re-tuned per size, which can flatter the middle of the grid. One seed per point except the noise runs.`,
      runs: grid,
    },
    fits: fits(grid), frontier: frontierSection(grid), noise: noiseSection(J, grid),
    papers: { ...PAPERS, about: PAPERS.about.replace("RANGE", `${Math.min(...grid.map((g) => g.params.nonEmbedding))} to ${Math.max(...grid.map((g) => g.params.nonEmbedding))}`) },
    runSeconds: Object.fromEntries(Object.values(J).map((j) => [j.name, round(j.seconds)])), seconds: 0,
  };
  facts.seconds = round((Date.now() - t0) / 1000);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  console.log(JSON.stringify({ grid: grid.map((g) => `${g.name.padEnd(6)} N ${g.params.nonEmbedding} tot ${g.params.total} end ${g.final.heldOut} ex ${g.final.excess} best ${g.best.heldOut}@${g.best.step} copy ${g.final.copyAccuracy}`),
    fits: { ...facts.fits, byTokens: facts.fits.byTokens.map((f) => `${f.name} ${f.slope} r2 ${f.r2}`) }, frontier: { fit: facts.frontier.fitExcess, nOpt: facts.frontier.fitSizeAtBudget, budgets: facts.frontier.budgets }, noise: facts.noise, seconds: facts.seconds }, null, 1));
}

main().catch((e) => { console.error("fill_scaling failed:", e); process.exit(1); });
