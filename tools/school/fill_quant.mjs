// Fill lesson S18's numbers ("Quantisation: fewer bits per number") so no
// number in the film or lab is typed by hand. Writes
// media/school/quant/facts.json.
//
//   node tools/school/fill_quant.mjs [media/school/attention/model.json] [media/school/quant]
//
// The attention lab's model has its 11 weight matrices quantised (round to
// nearest at 8, 6, 4, 3 and 2 bits, per tensor, per output channel, per 32
// and per 8 inputs of a channel; GPTQ at the same settings) and is scored on
// 1,024 held-out rows (the first 256 are model.json's own held-out rows).
// Intervals are 95 percent row bootstrap intervals (errorbars.mjs, 1,000
// resamples, seed 1); differences from float are paired on the same rows.
// No training, so one process at below-normal priority.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority } from "node:os";
import { fromJSON } from "../../system/school/tinyformer.mjs";
import { heldOut } from "../../system/school/corpus.mjs";
import { BITS, matrices, quantizeModel, quantizeTensor, scoreUnits, summarise, tensorStats, errorStats, histogram, levels, createScorer, qmax, checkQuant } from "../../system/school/quant.mjs";
import { gptqModel, calibration, layerInputs } from "../../system/school/quant-gptq.mjs";
import { pearson } from "../../system/school/gaming.mjs";
import { round, deep } from "./fill_gaming_report.mjs";
import { sourcesBlock, schemeVerdicts, sensitivityVerdict, fx, dv } from "./fill_quant_report.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const modelPath = process.argv[2] || "media/school/attention/model.json", outDir = process.argv[3] || "media/school/quant";
const raw = readFileSync(modelPath), M = JSON.parse(raw.toString("utf8")), MODEL = fromJSON(M.weights);
const ROWS = 1024, CAL = { seed: 31337, rows: 128 }, SCHEMES = [["tensor", "tensor", 32], ["channel", "channel", 32], ["group32", "group", 32], ["group8", "group", 8]];
const HELD = heldOut(ROWS, M.config.ctx), SPECS = matrices(M.config), cost = {};
const timed = (k, f) => { const t = performance.now(), v = f(); cost[k] = (cost[k] ?? 0) + performance.now() - t; return v; };
const BASE = timed("score", () => scoreUnits(MODEL, HELD));
const score = (model) => timed("score", () => summarise(scoreUnits(model, HELD), BASE));

function schemesBlock() {
  const rows = [], cal = calibration(CAL.seed, CAL.rows, M.config.ctx);
  for (const bits of [16, ...BITS]) for (const [label, scheme, gs] of SCHEMES) {
    const q = timed("rtn", () => quantizeModel(MODEL, { bits, scheme, gs }));
    rows.push({ method: "rtn", bits, scheme: label, ...score(q.model), bytes: q.bytes });
    if (bits === 16) continue;
    const g = timed("gptq", () => gptqModel(MODEL, { bits, scheme, gs, calib: cal }));
    rows.push({ method: "gptq", bits, scheme: label, ...score(g.model), bytes: q.bytes, outputErr: Object.fromEntries(Object.entries(g.per).filter(([, p]) => p.method === "gptq").map(([n, p]) => [n, { rtn: p.outputErrRtn, gptq: p.outputErrGptq }])) });
    console.error(`bits ${bits} ${label} done`);
  }
  const float = { ...summarise(BASE, null), bytes: M.nParams * 4 };
  return { float, rows: rows.filter((r) => r.bits !== 16), sixteen: rows.filter((r) => r.bits === 16) };
}

function damageBlock() {
  const tensors = SPECS.map((s) => {
    const w = MODEL.params[s.name], st = tensorStats(w), Q = qmax(4), step = st.maxAbs / Q;
    const t4 = errorStats(w, quantizeTensor(w, s, { bits: 4, scheme: "tensor" }).deq), c4 = errorStats(w, quantizeTensor(w, s, { bits: 4, scheme: "channel" }).deq);
    return { name: s.name, shape: [s.rows, s.cols], ...st, step4: step, uniformRmsErr4: step / Math.sqrt(12), tensor4: t4, channel4: c4, measuredOverUniform: t4.rmsErr / (step / Math.sqrt(12)) };
  });
  const r = pearson(tensors.map((t) => t.outlier), tensors.map((t) => t.tensor4.relErr));
  const cal = HELD, { inputs, N } = layerInputs(MODEL, cal.x.subarray(0, 128 * 24), 128, 24);
  const activations = Object.entries(inputs).map(([name, X]) => {
    const K = X.length / N, mx = new Float64Array(K);
    let s2 = 0;
    for (let i = 0; i < X.length; i++) { mx[i % K] = Math.max(mx[i % K], Math.abs(X[i])); s2 += X[i] * X[i]; }
    const rms = Math.sqrt(s2 / X.length), top = Math.max(...mx);
    return { name, features: K, maxAbs: top, rms, maxOverRms: top / rms, featuresAtLeast6: mx.filter((v) => v >= 6).length };
  });
  return { about: "Where the damage comes from, read per tensor at 4 bits. maxAbs, rms, outlier (maxAbs / rms, the largest weight against the tensor's typical size), kurtosis, medianAbs and p99Abs describe each float tensor. step4 is the 4-bit per-tensor step, maxAbs / 7; uniformRmsErr4 = step4 / sqrt(12), the error of rounding values spread evenly within a step; tensor4 and channel4 are the measured errors (rmsErr, relErr = error norm over weight norm, maxErr) for one scale per tensor and per output channel. outlierVsRelErr is the Pearson correlation across the 11 tensors between outlier and tensor4.relErr. activations: the inputs each dense matrix sees on 128 held-out rows (the float model), with the largest magnitude, rms and the count of feature dimensions whose magnitude reaches 6 (LLM.int8's outlier magnitude test); activations are never quantised here.",
    tensors, outlierVsRelErr: r, activations,
    verdict: `Per-tensor 4-bit error over weight size runs from ${fx(Math.min(...tensors.map((t) => t.tensor4.relErr)))} to ${fx(Math.max(...tensors.map((t) => t.tensor4.relErr)))}; it tracks the outlier ratio (Pearson ${fx(r)} over 11 tensors). That is close to a definition, not a discovery: with values spread across each step the error is step / sqrt(12), so relErr is about outlier / (7 sqrt(12)); measured over that uniform figure runs ${fx(Math.min(...tensors.map((t) => t.measuredOverUniform)))} to ${fx(Math.max(...tensors.map((t) => t.measuredOverUniform)))}. What it shows: one large weight sets the step every other weight in its block must use. One scale per channel cuts it to ${fx(Math.min(...tensors.map((t) => t.channel4.relErr)))} to ${fx(Math.max(...tensors.map((t) => t.channel4.relErr)))}. Largest outlier ratio: ${tensors.reduce((a, b) => (b.outlier > a.outlier ? b : a)).name} at ${fx(Math.max(...tensors.map((t) => t.outlier)), 2)}. Matrix inputs with a feature reaching magnitude 6: ${activations.filter((a) => a.featuresAtLeast6 > 0).map((a) => `${a.name} (${a.featuresAtLeast6})`).join(", ") || "none"}.` };
}

function sensitivityBlock() {
  const rows = [];
  for (const bits of [4, 3]) for (const s of SPECS) rows.push({ name: s.name, bits, ...score(timed("rtn", () => quantizeModel(MODEL, { bits, scheme: "tensor", only: [s.name] })).model) });
  return { about: "Each weight matrix quantised alone (round to nearest, one scale per tensor) with every other number left float32, at 4 and at 3 bits; loss and look-back accuracy with the paired difference from float on the same 1,024 rows (diff, diffLo, diffHi; resolved when the interval excludes 0).", rows, verdict: sensitivityVerdict(rows) };
}

function bandingBlock(sens) {
  const worst = sens.rows.filter((r) => r.bits === 4).reduce((a, b) => (b.loss.diff > a.loss.diff ? b : a)).name, w = MODEL.params[worst], m = Math.max(...Array.from(w, Math.abs));
  const lv = [4, 3, 2].map((b) => ({ ...levels(w, b), zeroShare: levels(w, b).counts[qmax(b)] / w.length }));
  return { about: `The palette picture, honestly: a histogram of one tensor's float values (${worst}, the matrix that hurts most when quantised alone at 4 bits) in 64 equal bins over [-maxAbs, maxAbs], and the levels a per-tensor round to nearest allows at 4, 3 and 2 bits (2 qmax + 1 levels: 15, 7, 3), with how many weights land on each. The film draws the levels as a palette with fewer colours; values between two levels are drawn in the nearer colour. Most weights sit near 0 while the levels are spaced evenly to reach the largest weight, so at low bits most of the tensor shares one or three colours (zeroShare: weights read back as exactly 0).`, tensor: worst, maxAbs: m, bins: 64, histogram: histogram(w, 64, m), levels: lv };
}

function controlsBlock(sch) {
  const diffs = sch.sixteen.map((r) => r.loss.diff), broken = quantizeModel(MODEL, { bits: 8, scheme: "channel", dequantScale: 2 }), bs = score(broken.model);
  const Q = qmax(4), grid = Float32Array.from({ length: 2 * Q + 1 }, (_, k) => (k - Q) * 2 ** -5), spec = { name: "grid", rows: 1, cols: grid.length, axis: "row" }, back = quantizeTensor(grid, spec, { bits: 4, scheme: "tensor" });
  return { about: "Controls. sixteenBit: 16-bit round to nearest under every scheme; maxLossDiff is the largest loss difference from float (must be under 1e-4). brokenScale: 8-bit per channel, read back with twice the scale it was written with; caught is true when the half-step checker (every read-back value within half a step of the original) fails on every tensor; its loss moves by diff. onGrid: the 15 values k / 32 for k = -7 .. 7 through 4-bit per-tensor quantisation come back bit for bit.",
    sixteenBit: { maxLossDiff: diffs.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a)), rows: sch.sixteen.map((r) => ({ scheme: r.scheme, loss: r.loss })) },
    brokenScale: { factor: 2, caught: Object.values(broken.per).every((p) => !p.check.ok), tensorsFailing: Object.values(broken.per).filter((p) => !p.check.ok).length, loss: bs.loss, lookback: bs.lookback },
    onGrid: { exact: back.deq.every((v, i) => Object.is(v, grid[i])), check: checkQuant(grid, back).ok } };
}

function speedBlock(seconds) {
  const sc = createScorer(MODEL, HELD, 32);
  sc.step();
  const ts = [];
  while (!sc.done && ts.length < 8) { const t = performance.now(); sc.step(); ts.push(performance.now() - t); }
  const t0 = performance.now(), q = quantizeModel(MODEL, { bits: 4, scheme: "channel" }), t1 = performance.now();
  gptqModel(MODEL, { bits: 4, scheme: "channel" });
  const t2 = performance.now();
  return { about: "Milliseconds in Node (V8), one process at below-normal priority, on the fill machine's CPU. msPer32Rows: one scorer step of 32 held-out rows (a lab slice; rowsPer40ms is how many rows fit in 40 ms at that rate). msRtnModel and msGptqModel: quantising all 11 matrices at 4 bits per channel (GPTQ includes its 11 calibration forward passes on 128 rows). totals: summed milliseconds spent scoring, in RTN and in GPTQ over the whole fill; fillSeconds is the wall time.", msPer32Rows: ts.reduce((a, b) => a + b, 0) / ts.length, msPer32RowsMax: Math.max(...ts), rowsPer40ms: Math.floor((40 / (ts.reduce((a, b) => a + b, 0) / ts.length)) * 32), msRtnModel: t1 - t0, msGptqModel: t2 - t1, bytes4Channel: q.bytes.total, totals: { ...cost }, fillSeconds: seconds };
}

function filmBlock(sch, band) {
  const curve = (method, scheme) => BITS.map((b) => { const r = sch.rows.find((x) => x.method === method && x.bits === b && x.scheme === scheme); return { bits: b, loss: r.loss.value, lo: r.loss.lo, hi: r.loss.hi, lookback: r.lookback.value, bytes: r.bytes.total }; });
  const w = MODEL.params[band.tensor], pick = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => Math.floor((k * w.length) / 8));
  const palette = [4, 2].map((bits) => { const r = quantizeTensor(w, SPECS.find((s) => s.name === band.tensor), { bits, scheme: "tensor" }); return { bits, scale: r.scales[0], samples: pick.map((i) => ({ index: i, value: w[i], code: r.q[i], readBack: r.deq[i] })) }; });
  return { about: "What the films draw. curves: held-out loss (with its interval) and look-back accuracy against bits, for round to nearest per tensor, per channel and per group of 32, and GPTQ per channel; bytes is the stored size. float is the float32 model's loss and size. palette: eight weights of the banding tensor, each with its 4-bit and 2-bit code and read-back value (the tray of colours each number is matched to). banding: see the banding block.",
    float: { loss: sch.float.loss.value, lookback: sch.float.lookback.value, bytes: sch.float.bytes },
    curves: { rtnTensor: curve("rtn", "tensor"), rtnChannel: curve("rtn", "channel"), rtnGroup32: curve("rtn", "group32"), gptqChannel: curve("gptq", "channel") }, palette };
}

function main() {
  const t0 = Date.now(), sch = schemesBlock(), sens = sensitivityBlock(), band = bandingBlock(sens);
  const blocks = {
    sources: sourcesBlock(),
    schemes: { about: `Held-out loss (nats per word) and look-back accuracy (top-1 on the copy and who targets) on ${ROWS} rows, with 95 percent row bootstrap intervals (lo, hi) and the paired difference from float32 (diff, diffLo, diffHi). Methods: rtn (round to nearest, symmetric) and gptq (quant-gptq.mjs, calibration ${CAL.rows} rows of seed ${CAL.seed}). Schemes: tensor (one float32 scale per matrix), channel (per output channel), group32 and group8 (per 32 or 8 consecutive inputs of a channel). With 32 or 64 inputs per matrix, group32 differs from channel only in the two w2 matrices (64 inputs); group8 is added so grouping has room to act. bytes: packed codes plus float32 scales plus the 768 float32 biases and norms, against ${M.nParams * 4} bytes of float32. 2 bits symmetric uses three levels (-1, 0, 1) stored in 2 bits. Activations stay float32 throughout.`, float: sch.float, rows: sch.rows, verdict: schemeVerdicts(sch.rows, sch.float) },
    damage: damageBlock(), sensitivity: sens, banding: band, controls: controlsBlock(sch), film: filmBlock(sch, band),
  };
  blocks.speed = speedBlock((Date.now() - t0) / 1000);
  const facts = {
    about: "Lesson S18, quantisation. Computed by tools/school/fill_quant.mjs from system/school/quant.mjs, quant-gptq.mjs and the attention lab's trained model. Do not edit by hand. Losses are in nats per word. Intervals are 95 percent percentile bootstrap intervals resampling held-out rows (errorbars.mjs), seeded, so every number is reproducible. Only weights are quantised; activations stay float32.",
    modelSha256: createHash("sha256").update(raw).digest("hex"), modelFile: "media/school/attention/model.json",
    recipe: { heldOutRows: ROWS, heldOutSeed: "corpus HELD_OUT_SEED (model.json's held-out rows are the first 256)", calibration: CAL, resamples: 1000, bootstrapSeed: 1, schemes: SCHEMES, bits: BITS },
    ...deep(blocks), seconds: 0,
  };
  facts.seconds = round((Date.now() - t0) / 1000, 1);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  console.log(JSON.stringify({ schemes: facts.schemes.verdict, damage: facts.damage.verdict, sensitivity: facts.sensitivity.verdict, controls: { sixteen: facts.controls.sixteenBit.maxLossDiff, broken: facts.controls.brokenScale.caught, brokenLoss: dv(facts.controls.brokenScale.loss), onGrid: facts.controls.onGrid.exact }, speed: facts.speed, seconds: facts.seconds }, null, 1));
}

try { main(); } catch (e) { console.error("fill_quant failed:", e); process.exit(1); }
