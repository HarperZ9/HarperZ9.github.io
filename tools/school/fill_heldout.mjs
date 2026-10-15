// Fill lesson F6's numbers ("Overfitting and the held-out set") so no number
// in the film is typed by hand. Writes media/school/heldout/facts.json.
//
//   node tools/school/fill_heldout.mjs
//
// Polynomial fits and the spiral runs come from system/school/heldout.mjs.
// The attention part reads media/school/attention/model.json's own curves,
// and rebuilds the trained model from its weights to score it on rows it
// was trained on against rows it never saw. About 15 s at BelowNormal
// priority on one core.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TRUTH, POLY, SPIRAL, polyStudy, polySpread, quantile, fitAndScore, polyval, design, lstsqQR, residualCheck,
  spiralRun, attentionGap, trainingBatches, repeatStats } from "../../system/school/heldout.mjs";
import { fromJSON, evaluate } from "../../system/school/tinyformer.mjs";
import { heldOut, makeBatch } from "../../system/school/corpus.mjs";
import { rng } from "../../system/school/tinyformer-ops.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MODEL = resolve(ROOT, "media/school/attention/model.json");
const OUT = resolve(ROOT, "media/school/heldout/facts.json");
const sig = (v, k = 5) => (typeof v === "number" ? (Number.isFinite(v) ? Number(v.toPrecision(k)) : String(v)) : v);
const sigs = (a, k) => a.map((v) => (Array.isArray(v) ? sigs(v, k) : sig(v, k)));
const t0 = Date.now(), timing = {};
const lap = (k, t) => { timing[k] = Math.round((Date.now() - t) / 100) / 10; };

// --- polynomials ---------------------------------------------------------------------
let t = Date.now();
const st = polyStudy();
const GX = Array.from({ length: 161 }, (_, i) => -1 + i / 80);
const curveOf = (c) => sigs(GX.map((x) => polyval(c, x)), 4);
const row = (d) => ({ degree: d.degree, lambda: d.lambda, trainRmse: sig(d.trainRmse), heldRmse: sig(d.heldRmse), truthRmse: sig(d.truthRmse),
  residual: sig(d.residual, 3), rDiagRatio: d.rDiagRatio === null ? null : sig(d.rDiagRatio, 3), coefNorm: sig(d.coefNorm, 4) });
// Control: the square degree-15 system solved transposed (A^T c = y instead of A c = y).
const n15 = POLY.maxDegree + 1, A15 = design(st.train.x, POLY.maxDegree), At = new Float64Array(n15 * n15);
for (let i = 0; i < n15; i++) for (let j = 0; j < n15; j++) At[i * n15 + j] = A15[j * n15 + i];
const transposed = lstsqQR(At, st.train.y, n15, n15).c;
const chol = [9, 12, 15].map((d) => { const r = fitAndScore(st.train, st.held, d, 0, { solver: "cholesky" }), q = st.degrees[d]; return { degree: d, choleskyTrainRmse: sig(r.trainRmse), qrTrainRmse: sig(q.trainRmse), choleskyResidual: sig(r.residual, 3), qrResidual: sig(q.residual, 3) }; });
const SEEDS = Array.from({ length: 200 }, (_, i) => 1000 + i);
const spread = polySpread(SEEDS);
const q3 = spread.map((s) => s.held[3]), q15 = spread.map((s) => s.held[15]), tr15 = spread.map((s) => s.train[15]);
const bestCount = {};
for (const s of spread) bestCount[s.bestDegree] = (bestCount[s.bestDegree] ?? 0) + 1;
const pct = (xs) => ({ p05: sig(quantile(xs, 0.05), 4), median: sig(quantile(xs, 0.5), 4), p95: sig(quantile(xs, 0.95), 4) });
const SHOW = [0, 1, 3, 9, 15];
const poly = {
  about: `Least-squares polynomials of degree 0 to ${POLY.maxDegree} fitted to ${POLY.nTrain} noisy samples of ${TRUTH.label} (Gaussian noise, sigma ${TRUTH.sigma}; x uniform; seed ${POLY.trainSeed}), scored by root-mean-square error on those points, on ${POLY.nHeld} held-out samples from the same source (seed ${POLY.heldSeed}), and against the noise-free curve on 401 grid points. Degree 15 has 16 coefficients for 16 points, so it passes through every one. Solved by Householder QR on the design matrix (ridge: QR on the matrix stacked over sqrt(lambda) times the identity, constant term unpenalised). 'residual' is the relative residual of the normal equations; 'rDiagRatio' is max|R_jj| / min|R_jj|, a lower bound on the condition number.`,
  truth: TRUTH.label, sigma: TRUTH.sigma, ...POLY,
  train: { x: sigs(st.train.x, 4), y: sigs(st.train.y, 4) }, held: { x: sigs(st.held.x.slice(0, 200), 4), y: sigs(st.held.y.slice(0, 200), 4), shown: 200 },
  degrees: st.degrees.map(row), bestDegree: st.bestDegree,
  ridge: { about: `Degree ${POLY.maxDegree} with ridge strength lambda.`, rows: st.ridge.map(row), bestLambda: st.ridge.reduce((a, b) => (b.heldRmse < a.heldRmse ? b : a)).lambda },
  curves: { about: "Fitted curves on 161 points over [-1, 1] for the film; the high degrees swing far outside the data, so a view should clip.", x: sigs(GX, 4), truth: sigs(GX.map(TRUTH.f), 4),
    byDegree: Object.fromEntries(SHOW.map((d) => [d, curveOf(st.degrees[d].c)])), ridge: Object.fromEntries(st.ridge.map((r) => [String(r.lambda), curveOf(r.c)])) },
  controls: {
    about: "The transposed control solves A^T c = y for the square degree-15 system and must fail the normal-equation residual check. The Cholesky rows form A^T A and solve it; both routes satisfy the normal equations to rounding, but forming A^T A squares the condition number and the fit to the 16 points shows it.",
    transposedResidual: sig(residualCheck(A15, st.train.y, POLY.nTrain, n15, transposed), 3), qrResidual: sig(st.degrees[POLY.maxDegree].residual, 3), cholesky: chol },
  spread: { about: `${SEEDS.length} training draws (seeds ${SEEDS[0]} to ${SEEDS.at(-1)}), held-out set fixed: held-out RMSE at degree 3 and 15 (5th percentile, median, 95th), train RMSE at 15, and how often each degree is the best on held-out data.`,
    seeds: [SEEDS[0], SEEDS.at(-1)], degree3: pct(q3), degree15: pct(q15), degree15Train: pct(tr15), bestDegreeCounts: bestCount },
};
lap("poly", t);

// --- spiral net ------------------------------------------------------------------------
t = Date.now();
const tidy = (c) => c.map((p) => ({ step: p.step, loss: sig(p.loss, 4), heldLoss: sig(p.heldLoss, 4), accuracy: sig(p.accuracy, 4), heldAccuracy: sig(p.heldAccuracy, 4) }));
const small = spiralRun(SPIRAL.small), full = spiralRun(SPIRAL.full);
const summary = (r) => ({ nTrain: r.nTrain, finalAccuracy: r.final.accuracy, finalHeldAccuracy: r.final.heldAccuracy, finalLoss: sig(r.final.loss, 4), finalHeldLoss: sig(r.final.heldLoss, 4),
  accuracyGap: sig(r.accuracyGap, 4), lossGap: sig(r.lossGap, 4), heldLossMinimum: { step: r.heldLossMinimum.step, heldLoss: sig(r.heldLossMinimum.heldLoss, 4), heldAccuracy: r.heldLossMinimum.heldAccuracy } });
const DRAWS = [1, 11, 21, 31, 41];
const draws = DRAWS.map((s) => { const r = spiralRun(SPIRAL.small, { trainSeed: s }); return { trainSeed: s, finalAccuracy: r.final.accuracy, finalHeldAccuracy: r.final.heldAccuracy, heldLossMinimumStep: r.heldLossMinimum.step, finalHeldLoss: sig(r.final.heldLoss, 4) }; });
const ha = draws.map((d) => d.finalHeldAccuracy);
const spiral = {
  about: `The F4 spiral net (2, 8, 8, 2, tanh) trained with plain SGD (step ${SPIRAL.lr}, minibatch ${SPIRAL.batch} drawn with replacement, batch seed ${SPIRAL.batchSeed}, net seed ${SPIRAL.netSeed}) for ${SPIRAL.steps} updates on ${SPIRAL.small} points and, as the control, on ${SPIRAL.full}. The ${SPIRAL.small} points are the first ${SPIRAL.small} of the ${SPIRAL.full} (seed ${SPIRAL.trainSeed}). Held-out: ${SPIRAL.full} points from seed ${SPIRAL.heldSeed}. Curves every ${SPIRAL.every} updates.`,
  ...SPIRAL, small: { ...summary(small), curve: tidy(small.curve) }, full: { ...summary(full), curve: tidy(full.curve) },
  draws: { about: `Five different ${SPIRAL.small}-point training draws (seeds ${DRAWS.join(", ")}), everything else fixed.`, rows: draws, finalHeldAccuracy: { min: Math.min(...ha), max: Math.max(...ha), mean: sig(ha.reduce((a, b) => a + b, 0) / ha.length, 4) } },
};
lap("spiral", t);

// --- the attention model -----------------------------------------------------------------
t = Date.now();
const bytes = readFileSync(MODEL), sha256 = createHash("sha256").update(bytes).digest("hex");
const M = JSON.parse(bytes.toString("utf8"));
const gap = attentionGap(M);
const model = fromJSON(M.weights), ctx = M.config.ctx, K = 16;
const span = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const score = (b) => { const e = evaluate(model, b); return { rows: b.batch, loss: sig(e.loss, 4), accuracy: sig(e.accuracy, 4), copyAccuracy: sig(e.copyAccuracy, 4), localAccuracy: sig(e.localAccuracy, 4) }; };
const seenFirst = score(trainingBatches(M.dataSeed, M.batch, ctx, span(1, K))), seenLast = score(trainingBatches(M.dataSeed, M.batch, ctx, span(M.steps - K + 1, M.steps)));
const nextUnseen = score(trainingBatches(M.dataSeed, M.batch, ctx, span(M.steps + 1, M.steps + K)));
const held = score(heldOut(M.heldOutRows, ctx));
const OTHER = [101, 202, 303, 404, 505];
const others = OTHER.map((s) => ({ seed: s, ...score(makeBatch(rng(s), M.batch * K, ctx)) }));
const ol = others.map((o) => o.loss);
const attention = {
  about: "The attention lab's model. 'curve' is model.json's own: 'train' is the mean loss of the training batches of the previous 25 updates, each measured before its update; 'heldOut' is the loss on the 256 held-out rows after the update. The trainer draws a fresh batch from the generator every update; the generator's small grammar repeats some rows by chance ('repeats' counts them), so rows are rarely, not never, seen twice. Much of the gap is that the train number averages a model that was still improving. 'rescored' takes the final weights and scores them, the same way, on rows they were trained on (the batches of updates 1 to 16, and of the last 16 updates), on the next 16 batches of the same stream (never trained on), on the lab's 256 held-out rows, and on five fresh 256-row draws with other seeds, which give the spread of an unseen score.",
  steps: M.steps, curveEvery: M.curveEvery,
  curve: gap.gaps.map((p) => ({ step: p.step, train: p.train, heldOut: p.heldOut, gap: sig(p.gap, 4) })),
  tail: { points: gap.tail, meanGap: sig(gap.tailMeanGap, 4), minGap: sig(gap.tailMinGap, 4), maxGap: sig(gap.tailMaxGap, 4) },
  repeats: repeatStats(M.dataSeed, M.batch, ctx, M.steps, { nextUnseen: trainingBatches(M.dataSeed, M.batch, ctx, span(M.steps + 1, M.steps + K)), heldOut: heldOut(256, ctx) }),
  rescored: { seenFirst, seenLast, nextUnseen, heldOut: held, otherSeeds: { seeds: OTHER, rows: others, loss: { min: Math.min(...ol), max: Math.max(...ol), mean: sig(ol.reduce((a, b) => a + b, 0) / ol.length, 4) } } },
};
lap("attention", t);

const facts = {
  about: "Lesson F6, overfitting and the held-out set. Computed by tools/school/fill_heldout.mjs from system/school/heldout.mjs, backprop.mjs and the attention lab's model.json. Do not edit by hand.",
  modelJsonSha256: sha256, poly, spiral, attention, seconds: { ...timing, total: Math.round((Date.now() - t0) / 1000) },
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(facts) + "\n");
console.log(JSON.stringify({
  degrees: poly.degrees.map((d) => [d.degree, d.trainRmse, d.heldRmse, d.truthRmse, d.residual, d.rDiagRatio]), best: poly.bestDegree,
  ridge: poly.ridge.rows.map((d) => [d.lambda, d.trainRmse, d.heldRmse, d.truthRmse, d.coefNorm]), bestLambda: poly.ridge.bestLambda,
  controls: poly.controls, spread: poly.spread,
  spiral: { small: summary(small), full: summary(full), draws: spiral.draws },
  attention: { tail: attention.tail, last: attention.curve.at(-1), repeats: attention.repeats, rescored: attention.rescored }, seconds: facts.seconds, sha256,
}, null, 1));
