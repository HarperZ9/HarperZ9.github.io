// Report helpers for tools/school/fill_errorbars.mjs: turn the jobs' raw
// numbers into facts.json blocks. Every verdict line is written from the
// numbers, never typed by hand.
import { firstRows, unitsOf, scoreOf, ratioSE, normalInterval, bootstrapInterval, createBootstrap, diffInterval, diffNormal, permuteUnits, designEffect, summariseCoverage, createCoverage } from "../../system/school/errorbars.mjs";
import { spread } from "../../system/school/scaling.mjs";

// 4 decimal places; a nonzero value under 1e-4 keeps 3 significant digits.
export const round = (v, k = 4) => (typeof v !== "number" || Number.isInteger(v) ? v : v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toPrecision(3)) : Math.round(v * 10 ** k) / 10 ** k);
export const deep = (o) => (Array.isArray(o) ? o.map(deep) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deep(v)])) : round(o));

const NS = [16, 64, 256, 1024], METRICS = ["loss", "accuracy", "lookback"], RES = 2000;
const iv = (x) => ({ mean: x.mean, lo: x.lo, hi: x.hi, width: x.width });
const fx = (v, k = 4) => (Number.isFinite(v) ? String(round(v, k)) : "n/a");
const unitsFrom = (job, metric) => (metric === "lookback" ? { num: Float64Array.from(job.lookback.num), den: Float64Array.from(job.lookback.den) } : { num: Float64Array.from(job[metric]), den: new Float64Array(job[metric].length).fill(24) });
const cut = (u, n) => ({ num: u.num.slice(0, n), den: u.den.slice(0, n) });

function intervalsAt(items, n, metric) {
  const s = firstRows(items, n), row = unitsOf(s, metric, "row"), word = unitsOf(s, metric, "word");
  return { score: scoreOf(row), rowPct: iv(bootstrapInterval(row, { resamples: RES, seed: n })), rowNormal: iv(normalInterval(row)), wordPct: iv(bootstrapInterval(word, { resamples: RES, seed: n })), wordNormal: iv(normalInterval(word)), units: { rows: n, words: word.num.length } };
}

function widthsBlock(items) {
  const at = Object.fromEntries(NS.map((n) => [n, Object.fromEntries(METRICS.map((m) => [m, intervalsAt(items, n, m)]))]));
  const shrink = NS.slice(1).map((n, i) => ({ from: NS[i], to: n, loss: at[NS[i]].loss.rowPct.width / at[n].loss.rowPct.width, accuracy: at[NS[i]].accuracy.rowPct.width / at[n].accuracy.rowPct.width }));
  const gap = (n, m) => at[n][m].rowPct.width / at[n][m].rowNormal.width;
  const skew = (n, m) => (at[n][m].rowPct.hi - at[n][m].score) / (at[n][m].score - at[n][m].rowPct.lo);
  const lb16 = at[16].lookback;
  const verdict = [
    `Row bootstrap width of the mean loss: ${NS.map((n) => `${fx(at[n].loss.rowPct.width)} at ${n} rows`).join(", ")}. Four times the rows gives ${shrink.map((s) => fx(s.loss, 2)).join(", ")} times narrower (1 / sqrt(rows) predicts 2).`,
    `Percentile against normal (row units): width ratio ${NS.map((n) => fx(gap(n, "loss"), 3)).join(", ")} for loss at ${NS.join(", ")} rows; upper arm over lower arm of the percentile interval ${NS.map((n) => fx(skew(n, "loss"), 3)).join(", ")} (1 is symmetric, the normal interval is always 1).`,
    `Look-back accuracy at 16 rows is ${fx(lb16.score)} on ${lb16.units.words} targets; the row bootstrap gives [${fx(lb16.rowPct.lo)}, ${fx(lb16.rowPct.hi)}] and the normal interval [${fx(lb16.rowNormal.lo)}, ${fx(lb16.rowNormal.hi)}]. ${lb16.rowPct.width === 0 ? "A perfect score on few items gives an interval of zero width under both methods: resampling cannot show errors the sample does not contain." : "The interval is not degenerate."}`,
  ];
  return { about: `The attention lab's model scored on the first 16, 64, 256 and 1,024 held-out rows (heldOut(1024); each smaller set is the start of the larger one). For loss, top-1 accuracy over all words, and look-back accuracy (top-1 on look-back targets only): rowPct is the percentile bootstrap resampling rows (${RES} resamples, seed = rows), rowNormal is mean plus or minus 1.96 clustered standard errors with rows as the unit, wordPct and wordNormal treat every word as an independent unit. Width is hi minus lo.`, at, shrink, verdict };
}

function unitBlock(items) {
  const at = Object.fromEntries(NS.map((n) => [n, Object.fromEntries(METRICS.map((m) => [m, designEffect(firstRows(items, n), m)]))]));
  const d = at[1024].loss, dir = d.deff < 1 ? "wider" : "narrower";
  const verdict = `At 1,024 rows the word-level standard error of the mean loss is ${fx(d.wordSE, 5)} and the row-level one ${fx(d.rowSE, 5)}: design effect ${fx(d.deff, 3)}, implied correlation of words inside a row ${fx(d.rho, 4)}. Treating words as independent makes the interval ${dir} than resampling rows here, for loss (deff ${NS.map((n) => fx(at[n].loss.deff, 3)).join(", ")} at ${NS.join(", ")} rows), accuracy (${NS.map((n) => fx(at[n].accuracy.deff, 3)).join(", ")}) and look-back accuracy (${NS.map((n) => fx(at[n].lookback.deff, 3)).join(", ")}).`;
  return { about: "Which unit to resample. deff is (row-level SE / word-level SE) squared; deff above 1 means words of a row share their errors (the clustered case in Miller 2024, where a word-level interval is too narrow); deff below 1 means a row's words offset each other. rho = (deff - 1) / 23 is the intra-row correlation that would give that deff for rows of 24 words. Every held-out row starts at an episode boundary and holds one word at each of the 24 positions, and the generator's next-word entropy swings with position (items.generatorByPosition), so a row is a balanced draw of hard and easy positions; a word-level resample mixes positions freely and adds variance a real new row would not have. The coverage block measures which interval holds the truth.", at, verdict };
}

function pairBlock(a, b, n) {
  const A = cut(a, n), B = cut(b, n), sh = permuteUnits(B, 5);
  const out = { n, hard: scoreOf(A), soft1: scoreOf(B), diff: scoreOf(A) - scoreOf(B) };
  out.pairedPct = iv(diffInterval(A, B, { mode: "paired", resamples: RES, seed: 1 }));
  out.unpairedPct = iv(diffInterval(A, B, { mode: "unpaired", resamples: RES, seed: 1 }));
  out.shuffledPct = iv(diffInterval(A, sh, { mode: "paired", resamples: RES, seed: 1 }));
  out.pairedNormal = iv(diffNormal(A, B, "paired"));
  out.unpairedNormal = iv(diffNormal(A, B, "unpaired"));
  out.widthRatio = out.unpairedPct.width / out.pairedPct.width;
  const ex = (x) => (x.lo > 0 || x.hi < 0 ? "excludes 0" : "contains 0");
  out.line = `${n} rows: hard minus soft1 = ${fx(out.diff)} nats; paired [${fx(out.pairedPct.lo)}, ${fx(out.pairedPct.hi)}] ${ex(out.pairedPct)}, unpaired [${fx(out.unpairedPct.lo)}, ${fx(out.unpairedPct.hi)}] ${ex(out.unpairedPct)}, shuffled pairing [${fx(out.shuffledPct.lo)}, ${fx(out.shuffledPct.hi)}] ${ex(out.shuffledPct)}; unpaired is ${fx(out.widthRatio, 2)} times as wide as paired.`;
  return out;
}

function pairedBlock(J) {
  const h = unitsFrom(J["train.hard.1"], "loss"), s = unitsFrom(J["train.soft1.1"], "loss");
  const ha = unitsFrom(J["train.hard.1"], "accuracy"), sa = unitsFrom(J["train.soft1.1"], "accuracy");
  const at1024 = pairBlock(h, s, 1024), at256 = pairBlock(h, s, 256), acc = pairBlock(ha, sa, 1024);
  acc.line = "accuracy, " + acc.line.replace("nats", "(share of words)");
  return { about: "Two close models on the same rows: lesson S17's main student (d16x1, 2,000 steps, full data) trained on hard labels and on the teacher's soft targets at T 1, seed 1 each, scored on the same held-out rows. The difference is hard minus soft1 (loss, so positive means soft1 is better). paired resamples row indices once for both models; unpaired resamples each model's rows independently, as if they had been scored on different rows; shuffled is the broken-pairing control: soft1's rows put in a seeded random order (seed 5) and then paired, so row i of one model meets an unrelated row of the other. Its interval must be about as wide as the unpaired one. Normal versions use the per-row differences (paired) or the sum of the two variances (unpaired).", at1024, at256, accuracy: acc, verdict: [at1024.line, at256.line, acc.line] };
}

function seedBlock(J, SEEDS, stored) {
  const arm = (a) => {
    const vals = SEEDS.map((s) => scoreOf(unitsFrom(J[`train.${a}.${s}`], "loss"))), u1 = unitsFrom(J[`train.${a}.1`], "loss"), sp = spread(vals);
    return { values: vals, mean: sp.mean, sd: sp.sd, min: sp.min, max: sp.max, rowSE1024: ratioSE(u1), rowSE256: ratioSE(cut(u1, 256)), rowPct1024: iv(bootstrapInterval(u1, { resamples: RES, seed: 1 })), sdOverRowSE: sp.sd / ratioSE(u1) };
  };
  const hard = arm("hard"), soft1 = arm("soft1");
  const diffs = SEEDS.map((s) => scoreOf(unitsFrom(J[`train.hard.${s}`], "loss")) - scoreOf(unitsFrom(J[`train.soft1.${s}`], "loss"))), ds = spread(diffs);
  const pairSE = spread(SEEDS.map((s) => diffNormal(unitsFrom(J[`train.hard.${s}`], "loss"), unitsFrom(J[`train.soft1.${s}`], "loss"), "paired").se)).mean;
  const reproduce = stored ? Object.fromEntries(["hard", "soft1"].map((a) => [a, stored[a].map((v, i) => ({ seed: SEEDS[i], stored: v, now: J[`train.${a}.${SEEDS[i]}`].at256 }))])) : null;
  const cmp = (x) => (x.sd > x.rowSE1024 ? "bigger" : "smaller");
  const verdict = [
    `hard labels, ${SEEDS.length} seeds on the same 1,024 rows: mean ${fx(hard.mean)}, sd across seeds ${fx(hard.sd)}, against a row standard error of ${fx(hard.rowSE1024)} for one seed; the seed spread is ${cmp(hard)} (${fx(hard.sdOverRowSE, 2)} times).`,
    `soft targets T 1: mean ${fx(soft1.mean)}, sd across seeds ${fx(soft1.sd)}, row standard error ${fx(soft1.rowSE1024)}; the seed spread is ${cmp(soft1)} (${fx(soft1.sdOverRowSE, 2)} times).`,
    `The difference hard minus soft1, seed by seed: ${diffs.map((d) => fx(d)).join(", ")}; mean ${fx(ds.mean)}, sd ${fx(ds.sd)}, against a paired row standard error of ${fx(pairSE)} on 1,024 rows. A row interval from one pair of runs describes those two runs; it says nothing about the next seed.`,
  ];
  return { about: `Seed spread against row spread. Each arm of lesson S17's recipe (d16x1 student, data seed 100 + seed, ${J["train.hard.1"].loss.length} held-out rows) trained at seeds ${SEEDS.join(", ")}; a seed changes both the starting weights and the order of training rows. Every seed is scored on the same rows, so the sd across seeds holds no row noise; rowSE1024 is the clustered standard error from rows for seed 1. reproduce compares this fill's seed 1 to 3 held-out loss on the standard 256 rows with lesson S17's stored numbers.`, hard, soft1, difference: { values: diffs, mean: ds.mean, sd: ds.sd, pairedRowSE: pairSE }, reproduce, verdict };
}

function coverageBlock(ctx) {
  const { truth, J, COVERAGE, TRIALS, COV_RESAMPLES } = ctx, runs = {};
  for (const [rows, copies] of COVERAGE) {
    const trials = Object.values(J).filter((j) => j.trials && j.rows === rows && j.copies === copies).flatMap((j) => j.trials);
    runs[copies > 1 ? `rows${rows}x${copies}` : `rows${rows}`] = summariseCoverage(trials);
  }
  const line = (k, s) => `${k}: row percentile ${fx(s.rowPct.coverage, 3)} (se ${fx(s.rowPct.se, 3)}, misses low ${s.rowPct.missLow}, high ${s.rowPct.missHigh}), row normal ${fx(s.rowNormal.coverage, 3)}, word percentile ${fx(s.wordPct.coverage, 3)}, word normal ${fx(s.wordNormal.coverage, 3)}${s.clusterPct ? `, by distinct row ${fx(s.clusterPct.coverage, 3)} (normal ${fx(s.clusterNormal.coverage, 3)})` : ""}; mean widths row ${fx(s.rowPct.meanWidth)}, word ${fx(s.wordPct.meanWidth)}.`;
  return {
    about: `The decisive check. The corpus generator's expected loss per word over a 24-word row is computed exactly (errorbars-truth.mjs: every distinct parse state after t words with its total probability, ${truth.states.at(-1)} states at t = 24; its total probability is ${fx(truth.mass, 12)}). Each trial draws a fresh set of rows from the generator, scores the generator's own loss on every word from its exact odds, builds 95 percent intervals (${COV_RESAMPLES} bootstrap resamples) and asks whether each holds the truth. ${TRIALS} trials per set size; each set size has its own data seed. rows16x4 is the clustered control: 16 drawn rows, each repeated 4 times (64 rows that are only 16 independent draws); row and word treat the copies as independent, cluster resamples the 16 distinct rows. A correct 95 percent method holds the truth in 95 percent of trials, give or take about 1.4 points at 1,000 trials.`,
    truth: truth.mean, truthPerPosition: truth.perPosition, states: truth.states, truthSeconds: truth.seconds, runs,
    verdicts: Object.entries(runs).map(([k, s]) => line(k, s)),
  };
}

function speedBlock(ctx) {
  const { items, J, truth } = ctx, time = (f) => { const t0 = performance.now(); f(); return performance.now() - t0; };
  const per = (u, k) => { const b = createBootstrap(u, 1); b.step(200); return time(() => b.step(k)) / k; };
  const trial = (rows) => { const c = createCoverage({ rows, truth: truth.mean, seed: 77 }); c.step(); return time(() => { for (let i = 0; i < 20; i++) c.step(); }) / 20; };
  const covIn = (rows) => { const js = Object.values(J).filter((j) => j.trials && j.rows === rows && j.copies === 1); return (1000 * js.reduce((a, j) => a + j.seconds, 0)) / js.reduce((a, j) => a + j.trials.length, 0); };
  const msPerResample = { rows64: per(unitsOf(firstRows(items, 64), "loss", "row"), 4000), rows1024: per(unitsOf(items, "loss", "row"), 2000), words64: per(unitsOf(firstRows(items, 64), "loss", "word"), 1000), words1024: per(unitsOf(items, "loss", "word"), 200) };
  const msPerTrial = { rows16: trial(16), rows64: trial(64) };
  return { about: "Milliseconds in Node (V8), one process: per bootstrap resample (row units and word units, 64 and 1,024 rows) and per coverage trial (draw the rows, the generator's exact odds, two bootstraps of 1,000 resamples, two normal intervals). inPool is the per-trial time inside the fill's coverage jobs, 4 processes at once. A browser lab running 40 ms slices fits about 40 / ms of each per slice. truthSeconds is the exact expected-loss computation; trainMsPerStep the S17 students' training step in the pool.",
    msPerResample, msPerTrial, inPool: { rows16: covIn(16), rows64: covIn(64), rows256: covIn(256) }, per40ms: { resamplesRows1024: Math.floor(40 / msPerResample.rows1024), trialsRows16: Math.floor(40 / msPerTrial.rows16), trialsRows64: Math.floor(40 / msPerTrial.rows64) }, truthSeconds: truth.seconds,
    trainMsPerStep: { hard: spread(ctx.SEEDS.map((s) => J[`train.hard.${s}`].msPerStep)).mean, soft1: spread(ctx.SEEDS.map((s) => J[`train.soft1.${s}`].msPerStep)).mean } };
}

function itemsBlock(ctx) {
  const { items } = ctx, byPos = new Float64Array(items.ctx);
  for (let n = 0; n < items.loss.length; n++) byPos[n % items.ctx] += items.loss[n] / items.rows;
  const s = (m, l) => scoreOf(unitsOf(items, m, l));
  return { about: `Per-item scores of the attention lab's model (seed ${ctx.M.seed}, ${ctx.M.steps} steps) on ${items.rows} held-out rows of ${items.ctx} words (heldOut(1024), seed 0x5eed0bad; its first 256 rows are the standard held-out set). Each next word has a loss (nats), a right-or-not (top-1), and a flag for look-back targets. modelByPosition is the mean loss at each of the 24 positions; generatorByPosition the generator's exact expected loss there.`,
    rows: items.rows, words: items.loss.length, lookbackTargets: unitsOf(items, "lookback", "word").num.length, loss: s("loss", "row"), accuracy: s("accuracy", "row"), lookback: s("lookback", "row"), modelByPosition: Array.from(byPos), generatorByPosition: ctx.truth.perPosition };
}

export function sections(ctx) {
  return { items: itemsBlock(ctx), widths: widthsBlock(ctx.items), unit: unitBlock(ctx.items), paired: pairedBlock(ctx.J), seeds: seedBlock(ctx.J, ctx.SEEDS, ctx.stored), coverage: coverageBlock(ctx), speed: speedBlock(ctx) };
}

export { film } from "./fill_errorbars_film.mjs";
