// Fill lesson F3's numbers ("Gradients: which way is downhill") so no number
// in the film is typed by hand. Writes media/school/gradients/facts.json.
//
//   node tools/school/fill_gradients.mjs
//
// Toy surfaces come from system/school/gradients.mjs. The real-network part
// rebuilds the attention lab's trained transformer from
// media/school/attention/model.json (as tools/school/fill_film.mjs does) and
// the untrained one from the same config and seed, and scores both on the
// first 64 rows of the corpus's held-out set (heldOut(64), the same rows the
// lab scores on). About 50 s at BelowNormal priority on one core.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeBowl, ROSENBROCK, TWO_VALLEYS, checkGrad, hessian, descend, sampleGrid, stepStudy,
  landscapeSlice, gradNorm, readoutScale, scaleDescent, SLICE_NOTE } from "../../system/school/gradients.mjs";
import { initialModel } from "../../system/school/gradients-landscape.mjs";
import { fromJSON } from "../../system/school/tinyformer.mjs";
import { heldOut } from "../../system/school/corpus.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MODEL = resolve(ROOT, "media/school/attention/model.json");
const OUT = resolve(ROOT, "media/school/gradients/facts.json");
const sig = (v, k = 5) => (Number.isFinite(v) ? Number(v.toPrecision(k)) : String(v));
const sigs = (a, k) => a.map((v) => (Array.isArray(v) ? sigs(v, k) : sig(v, k)));
const thin = (path, n) => path.filter((_, i) => i % Math.max(1, Math.ceil(path.length / n)) === 0 || i === path.length - 1);
const CHECK_POINTS = [[0.3, -0.7], [-1.2, 1], [1.5, 0.2], [-0.4, -1.1]];
const t0 = Date.now();

// --- toy surfaces -----------------------------------------------------------
const bowl = makeBowl();
// The four runs of the step study, then 0.6x and 1.2x (the film's doubled step), appended so the
// first four keep their places.
const study = stepStudy(bowl, { multiples: [0.5, 0.99, 1.01, 2, 0.6, 1.2] });
const gradCheck = Object.fromEntries([bowl, ROSENBROCK, TWO_VALLEYS].map((s) => [s.id, {
  exact: sig(checkGrad(s, CHECK_POINTS)),
  signFlippedControl: sig(checkGrad(s, CHECK_POINTS, (x, y) => s.grad(x, y).map((v) => -v))),
  swappedAxesControl: sig(checkGrad(s, CHECK_POINTS, (x, y) => s.grad(x, y).reverse())),
}]));

const ROSEN_STEP = 1e-3, rosen = descend(ROSENBROCK, [-1.2, 1], { step: ROSEN_STEP, steps: 20000 });
const firstBelow = (path, v) => path.findIndex((p) => p[2] < v);
const rosenHess = { atMinimum: hessian(ROSENBROCK, 1, 1).curvatures, atStart: hessian(ROSENBROCK, -1.2, 1).curvatures };

const tvStarts = [[-1.5, 1], [1.5, -1], [0.1, 1.5], [-0.05, -1.5], [0.3, 0], [-0.3, 0]];
const tvRuns = tvStarts.map((s) => { const r = descend(TWO_VALLEYS, s, { step: 0.05, steps: 2000, tol: 1e-9 }); return { start: s, end: sigs(r.end), f: sig(r.f), steps: r.steps, valley: r.end[0] < 0 ? "left" : "right", path: sigs(thin(r.path, 40).map((p) => p.slice(0, 3)), 4) }; });
const left = tvRuns.find((r) => r.valley === "left"), right = tvRuns.find((r) => r.valley === "right");
const BASIN_N = 21, basin = [];
for (let j = 0; j < BASIN_N; j++) {
  const y = -2 + 4 * j / (BASIN_N - 1), row = [];
  for (let i = 0; i < BASIN_N; i++) row.push(descend(TWO_VALLEYS, [-2 + 4 * i / (BASIN_N - 1), y], { step: 0.05, steps: 2000, tol: 1e-9 }).end[0] < 0 ? -1 : 1);
  basin.push(row);
}
const grid = (s) => { const g = sampleGrid(s, 31); return { n: g.n, range: g.range, min: sig(g.min), max: sig(g.max), values: sigs(g.values, 4) }; };

// --- the attention model ----------------------------------------------------
const bytes = readFileSync(MODEL), sha256 = createHash("sha256").update(bytes).digest("hex");
const M = JSON.parse(bytes.toString("utf8"));
const trained = fromJSON(M.weights), init = initialModel(M.config, M.seed);
const held = heldOut(64, M.config.ctx), held256 = heldOut(256, M.config.ctx);
const slice = (model) => {
  const s = landscapeSlice(model, held, { n: 21, span: 1, seed: 101 });
  return { n: s.n, span: s.span, alphas: sigs(s.alphas, 4), values: sigs(s.values, 4), min: sig(s.min), max: sig(s.max), center: sig(s.center), argmin: s.argmin.map((v) => sig(v, 4)),
    slopeBackward: sigs(s.slopeBackward), slopeFiniteDiff: sigs(s.slopeFiniteDiff), directionCosine: sig(s.cosine, 3), gradientCosines: sigs(s.gradientCosines, 3),
    directionNorms: sigs(s.directionNorms), weightNorm: sig(s.weightNorm) };
};
const sliceTrained = slice(trained), sliceInit = slice(init);
const gn = (m) => { const a = gradNorm(m, held), b = gradNorm(m, held256); return { rows64: { loss: sig(a.loss), norm: sig(a.norm) }, rows256: { loss: sig(b.loss), norm: sig(b.norm) } }; };
const gradTrained = gn(trained), gradInit = gn(init);

// One number: s multiplies the readout wout.
const sGrid = Array.from({ length: 31 }, (_, i) => i * 0.1);
const curve = sGrid.map((s) => readoutScale(trained, held, s));
let lo = 0.5, hi = 1.5; // dL/ds changes sign between these (measured in the curve)
for (let i = 0; i < 40; i++) { const mid = 0.5 * (lo + hi); if (readoutScale(trained, held, mid).dLds < 0) lo = mid; else hi = mid; }
const sStar = 0.5 * (lo + hi);
const curvAt = (s, h = 1e-3) => (readoutScale(trained, held, s + h).dLds - readoutScale(trained, held, s - h).dLds) / (2 * h);
const kStar = curvAt(sStar), kStart = curvAt(0.05);
const descents = [0.02, 0.05, 0.2].map((step) => { const r = scaleDescent(trained, held, { start: 0.05, step, steps: 40 }); return { step, end: sig(r.end), loss: sig(r.loss), path: sigs(r.path, 4) }; });
const climb = scaleDescent(trained, held, { start: 0.05, step: 0.02, steps: 40, flipSign: true });

const facts = {
  about: "Lesson F3, gradients. Computed by tools/school/fill_gradients.mjs from system/school/gradients.mjs and the attention lab's model.json. Do not edit by hand.",
  modelJsonSha256: sha256, batch: M.batch,
  bowl: {
    about: "f(v) = 1/2 (v - c)^T H (v - c), axes turned 30 degrees. Curvatures from a finite-difference Hessian at the minimum. predictedBound = 2 / largest curvature; measuredBound = largest step whose runs shrink, found by bisection on real runs. Runs: 60 steps from (-2, 2) at multiples of the predicted bound; perStepFactor is the measured shrink (<1) or growth (>1) per step of the distance to the minimum.",
    minimum: bowl.min, curvatures: sigs(study.curvatures, 6), conditionNumber: sig(study.conditionNumber), predictedBound: sig(study.predictedBound, 8), measuredBound: sig(study.measuredBound, 8), relativeGap: sig(study.relativeGap, 3),
    runs: study.runs.map((r) => ({ multiple: r.multiple, step: sig(r.step), steps: r.path.length - 1, outcome: r.outcome, startLoss: sig(r.startLoss), finalLoss: sig(r.finalLoss), perStepFactor: sig(r.perStepFactor), path: sigs(r.path.map((p) => p.slice(0, 3)), 4) })),
    grid: grid(bowl),
  },
  rosenbrock: {
    about: "f = (1 - x)^2 + 100 (y - x^2)^2 from (-1.2, 1), fixed step 0.001, 20000 steps; path thinned to 200 points. Curvatures from a finite-difference Hessian. The stable step at the minimum is 2 / largest curvature there.",
    step: ROSEN_STEP, steps: rosen.steps, end: sigs(rosen.end, 6), finalLoss: sig(rosen.f), firstStepBelow: { "1e-1": firstBelow(rosen.path, 1e-1), "1e-2": firstBelow(rosen.path, 1e-2), "1e-4": firstBelow(rosen.path, 1e-4), "1e-6": firstBelow(rosen.path, 1e-6) },
    curvatures: { atMinimum: sigs(rosenHess.atMinimum), atStart: sigs(rosenHess.atStart) }, conditionNumberAtMinimum: sig(rosenHess.atMinimum[0] / rosenHess.atMinimum[1]), boundAtMinimum: sig(2 / rosenHess.atMinimum[0]),
    path: sigs(thin(rosen.path, 200).map((p) => p.slice(0, 3)), 5), grid: grid(ROSENBROCK),
  },
  twoValleys: {
    about: "f = (x^2 - 1)^2 + 1.5 (y - 0.4 x)^2 + 0.2 x. Step 0.05 until |grad| < 1e-9. basin[j][i] is -1 when descent from that grid point ends in the left valley, +1 for the right; grid spans [-2, 2]^2, rows are y.",
    leftValley: { at: left.end, f: left.f }, rightValley: { at: right.end, f: right.f }, runs: tvRuns, basin, grid: grid(TWO_VALLEYS),
  },
  gradientCheck: { about: "Worst relative error |exact - numeric| / (|exact| + |numeric|) of each surface's gradient against central differences (h = 1e-5) at four points; the controls flip the gradient's sign or swap its two components and must fail.", points: CHECK_POINTS, ...gradCheck },
  landscape: {
    about: "Held-out loss (first 64 rows of the corpus's held-out set) on a 21 x 21 grid of theta + a d1 + b d2, a and b in [-1, 1], for the trained model and for the same model at its initialisation (seed 7). d1, d2 are seeded Gaussian directions with filter-wise normalisation (Li et al. 2018); values[j][i] has b = alphas[j], a = alphas[i]. slopeBackward is grad . d from the backward pass; slopeFiniteDiff is the same slope by central differences (h = 0.01).",
    note: SLICE_NOTE, rows: 64, trained: sliceTrained, init: sliceInit,
  },
  gradientNorm: { about: "Global L2 norm of the gradient of the mean held-out loss over all parameters, from the model's own backward pass (lossAndGrad), on 64 and 256 held-out rows. Training clips the gradient at norm 1.0.", trained: gradTrained, init: gradInit, nParams: trained.nParams },
  oneNumber: {
    about: "Every weight fixed except s, which multiplies the readout matrix wout (s = 1 is the trained model). dL/ds comes from the real backward pass by the chain rule. sStar is where dL/ds = 0 (bisection); curvature is d2L/ds2 by central differences of dL/ds. Descents start at s = 0.05 with 40 steps each; the control follows +dL/ds and climbs.",
    curve: curve.map((r) => [sig(r.s, 3), sig(r.loss), sig(r.dLds)]), sStar: sig(sStar, 6), lossAtStar: sig(readoutScale(trained, held, sStar).loss), lossAtOne: sig(readoutScale(trained, held, 1).loss),
    curvatureAtStar: sig(kStar), boundAtStar: sig(2 / kStar), curvatureAtStart: sig(kStart), boundAtStart: sig(2 / kStart),
    descents, climbControl: { step: 0.02, end: sig(climb.end), loss: sig(climb.loss), startLoss: sig(climb.path[0][1]) },
  },
  seconds: Math.round((Date.now() - t0) / 1000),
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(facts) + "\n");
console.log(JSON.stringify({
  bowl: { curvatures: facts.bowl.curvatures, predicted: facts.bowl.predictedBound, measured: facts.bowl.measuredBound, gap: facts.bowl.relativeGap, runs: facts.bowl.runs.map((r) => [r.multiple, r.outcome, r.finalLoss, r.perStepFactor]) },
  gradientCheck: gradCheck, rosenbrock: { end: facts.rosenbrock.end, f: facts.rosenbrock.finalLoss, firstBelow: facts.rosenbrock.firstStepBelow, curv: facts.rosenbrock.curvatures, bound: facts.rosenbrock.boundAtMinimum },
  twoValleys: { left: facts.twoValleys.leftValley, right: facts.twoValleys.rightValley, runs: tvRuns.map((r) => [r.start, r.valley, r.steps]) },
  landscape: ["trained", "init"].map((k) => { const s = facts.landscape[k]; return { k, min: s.min, max: s.max, center: s.center, argmin: s.argmin, slopeB: s.slopeBackward, slopeFD: s.slopeFiniteDiff, cos: s.directionCosine, gcos: s.gradientCosines, wn: s.weightNorm }; }),
  gradientNorm: facts.gradientNorm, oneNumber: { ...facts.oneNumber, curve: undefined, descents: descents.map((d) => [d.step, d.end, d.loss]) }, seconds: facts.seconds, sha256,
}, null, 1));
