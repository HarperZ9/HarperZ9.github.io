// Fill lesson K24's numbers ("fp16, bf16 and tensor cores") so no number in
// the film or lab is typed by hand. Writes media/school/precision/facts.json.
//
//   node tools/school/fill_precision.mjs [media/school/attention/model.json] [media/school/precision] [raw-native checkout]
//
// Rounding is exact software rounding (system/school/precision.mjs); the
// model runs in emulated formats (precision-model.mjs) and is scored on 1,024
// held-out rows with 95 percent row bootstrap intervals and paired
// differences from the float32 model (quant.mjs, errorbars.mjs, 1,000
// resamples, seed 1). No GPU. One process at below-normal priority. The
// raw-native evidence note is read (read only, with git show when it is not
// in the working tree) from the checkout named by the third argument or by
// RAW_NATIVE_DIR; without one the near-110 block says it was not read.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority } from "node:os";
import { FORMATS, KNOWN, hex, f16Bits, bf16Bits, f16FromBits, bf16FromBits, round16, roundBf16, errorSweep, longSum, spacing, roundTo } from "../../system/school/precision.mjs";
import { MODES, context, roundParams, forwardCtx, createPrecisionScorer, matmulStudy, dotGrowth, attentionBlockStudy } from "../../system/school/precision-model.mjs";
import { scoreUnits, summarise } from "../../system/school/quant.mjs";
import { fromJSON, forward, rng, createModel } from "../../system/school/tinyformer.mjs";
import { heldOut } from "../../system/school/corpus.mjs";
import { round, deep } from "./fill_gaming_report.mjs";
import { fx, iv, dv } from "./fill_quant_report.mjs";
import { sourcesBlock, near110Block, readNote } from "./fill_precision_report.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const modelPath = process.argv[2] || "media/school/attention/model.json", outDir = process.argv[3] || "media/school/precision", rawNative = process.argv[4] || process.env.RAW_NATIVE_DIR || null;
const RAW = readFileSync(modelPath), M = JSON.parse(RAW.toString("utf8")), MODEL = fromJSON(M.weights), CFG = MODEL.config;
const ROWS = 1024, HELD = heldOut(ROWS, CFG.ctx), LOW = Object.keys(MODES).filter((m) => m !== "fp64"), cost = {};
const timed = (k, f) => { const t = performance.now(), v = f(); cost[k] = (cost[k] ?? 0) + performance.now() - t; return v; };
const fmtRow = (F) => ({ name: F.name, bits: F.bits, p: F.p, storedSignificandBits: F.p - 1, exponentBits: F.bits - F.p, emin: F.emin, emax: F.emax, max: F.max, minNormal: F.minNormal, minSub: F.minSub, u: F.u, eps: F.eps, decimalDigits: F.p * Math.log10(2) });

function bitsBlock() {
  const rows = KNOWN.map(([x, h, b]) => ({ value: x, fp16: hex(h), bf16: hex(b), f16ok: f16Bits(x) === h, bf16ok: bf16Bits(x) === b, f16Truncated: hex(f16Bits(x, "truncate")), bf16Truncated: hex(bf16Bits(x, "truncate")), fp16Value: f16FromBits(h), bf16Value: bf16FromBits(b) }));
  const r = rng(11), W = new Uint32Array(1), F = new Float32Array(W.buffer);
  let n = 0, agree = 0, nat = 0, trunc = 0;
  for (let i = 0; i < 200000; i++) {
    W[0] = Math.floor(r() * 2 ** 32);
    const x = F[0];
    if (Number.isNaN(x)) continue;
    n++;
    const v = round16(x);
    if (Object.is(v, f16FromBits(f16Bits(x))) && Object.is(roundBf16(x), bf16FromBits(bf16Bits(x)))) agree++;
    if (Object.is(v, Math.f16round(x))) nat++;
    if (!Object.is(v, f16FromBits(f16Bits(x, "truncate")))) trunc++;
  }
  return { about: "Bit patterns. rows: values (each exactly a float32) with their fp16 and bf16 bits by round to nearest even, the bits a truncating conversion would give, and the values the bits decode to. Ties are included (1 + 2^-11 and 1 + 3 x 2^-11 for fp16, 1 + 2^-8 and 1 + 3 x 2^-8 for bf16), as are the smallest fp16 subnormal 2^-24, the tie 2^-25 that rounds to 0, the largest fp16 65504, and 65520, the first value that rounds to infinity. random: 200,000 random 32-bit patterns (NaNs skipped): how many agree between the value-level and bit-level code (both formats), with Math.f16round, and how many fp16 results truncation gets wrong.", rows,
    random: { tested: n, valueAndBitsAgree: agree, mathF16roundAgrees: nat, truncationWrong: trunc } };
}

function sweepBlock() {
  return { about: "Relative rounding error against magnitude: for each octave [2^k, 2^(k+1)), 1,031 float32 values spread through it are rounded; maxRel and meanRel are the largest and mean |round(x) - x| / x, spacing the gap between neighbouring values at 2^k, overflow how many became infinity, toZero how many became 0. fp16's normal range is octaves -14 to 15 (maxRel at most u = 2^-11); below it the spacing stays 2^-24 and relative error grows; from 2^16 every value is infinity. bf16 keeps float32's exponent range, so across these octaves its error stays at most 2^-8.", fp16: errorSweep(FORMATS.fp16), bf16: errorSweep(FORMATS.bf16) };
}

function activations(rows) {
  const x = HELD.x.subarray(0, rows * CFG.ctx), fw = forward(MODEL, x, rows, CFG.ctx, { keep: true }), w = fw.work;
  return { x, rows, ln1: w.layers.map((L) => Float32Array.from(L.ln1)), g1: w.layers.map((L) => Float32Array.from(L.g1)), lnf: Float32Array.from(w.lnf) };
}

function matmulBlock(act) {
  const N = act.rows * CFG.ctx, d = CFG.dModel, P = MODEL.params, layers = [["l0.wqkv", act.ln1[0], P["l0.wqkv"], P["l0.bqkv"], d, 3 * d], ["l1.w2", act.g1[1], P["l1.w2"], P["l1.b2"], CFG.dFF, d], ["wout", act.lnf, P.wout, null, d, CFG.vocab]];
  const rows = layers.map(([name, a, w, b, K, Mo]) => ({ name, N, K, M: Mo, modes: timed("matmul", () => matmulStudy(a, w, b, N, K, Mo)) }));
  const growth = [];
  for (const lo of [-1, 0]) for (const [store, acc] of [["fp16", "fp32"], ["fp16", "fp16"], ["bf16", "fp32"], ["bf16", "bf16"]]) for (const K of [16, 64, 256, 1024, 4096, 16384]) growth.push({ inputs: lo === 0 ? "positive" : "signed", ...timed("growth", () => dotGrowth(K, store, acc, { lo, count: 32 })) });
  const mode = (i, m) => rows[i].modes.find((x) => x.mode === m).total.relNorm, rel = (i, m) => mode(i, m).toExponential(2), ratio = (i, f) => mode(i, `${f}acc${f.slice(-2)}`) / mode(i, `${f}acc32`);
  const g = (store, acc, K, inputs) => growth.find((x) => x.store === store && x.acc === acc && x.K === K && x.inputs === inputs).worstOverMag;
  return { about: `Three of the model's dense layers on their real inputs (${act.rows} held-out rows, ${N} positions, from the float32 forward pass): l0.wqkv (K ${d} inputs), l1.w2 (K ${CFG.dFF}) and the readout wout (K ${d}). For each mode (outputs stored in the mode's format, one rounding each): total error against float64 on the original float32 numbers; inputsOnly, the error of exact sums of the rounded inputs and weights (what storage alone costs); accOnly, the accumulator's own error on top. relNorm is the error norm over the reference norm; maxOverMag the largest error over sum_k |a w| (the scale a dot product's rounding error is measured against). growth: dot products of length K of uniform values (signed in [-1, 1) or positive in [0, 1)), 32 each, rounded to the storage format: the accumulator's worst error over sum |x y| as K grows.`, rows, growth,
    verdict: `On the model's layers (K at most ${CFG.dFF}) storage sets the error when the accumulator is fp32, and a narrow accumulator adds to it: l1.w2 relative error with fp16 inputs ${rel(1, "fp16acc32")} accumulating in fp32 (inputsOnly ${rows[1].modes.find((m) => m.mode === "fp16acc32").inputsOnly.relNorm.toExponential(2)}) and ${rel(1, "fp16acc16")} in fp16, ${fx(ratio(1, "fp16"), 2)}x; with bf16 inputs ${rel(1, "bf16acc32")} and ${rel(1, "bf16acc16")}, ${fx(ratio(1, "bf16"), 2)}x. Across the three layers the narrow accumulator multiplies the error by ${fx(Math.min(...[0, 1, 2].map((i) => ratio(i, "fp16"))), 2)} to ${fx(Math.max(...[0, 1, 2].map((i) => ratio(i, "fp16"))), 2)} (fp16) and ${fx(Math.min(...[0, 1, 2].map((i) => ratio(i, "bf16"))), 2)} to ${fx(Math.max(...[0, 1, 2].map((i) => ratio(i, "bf16"))), 2)} (bf16). Long sums are where the accumulator shows: positive products, worst error over sum |x y| at K 64 and 16,384: fp16 accumulator ${fx(g("fp16", "fp16", 64, "positive"), 5)} and ${fx(g("fp16", "fp16", 16384, "positive"), 5)}; fp32 accumulator ${g("fp16", "fp32", 64, "positive").toExponential(2)} and ${g("fp16", "fp32", 16384, "positive").toExponential(2)}; bf16 accumulator ${fx(g("bf16", "bf16", 64, "positive"), 4)} and ${fx(g("bf16", "bf16", 16384, "positive"), 4)}.` };
}

function attentionBlock(act) {
  const B = act.rows, rows = [0, 1].map((l) => ({ layer: l, modes: timed("attention", () => attentionBlockStudy(MODEL, act.ln1[l], B, CFG.ctx, l)) }));
  const e = (l, m) => rows[l].modes.find((x) => x.mode === m).relNorm.toExponential(2);
  return { about: `One attention block per layer (qkv = x Wqkv + b, causal attention with ${CFG.nHeads} heads, then Wo + bo) on its real input, ${B} held-out rows, in every mode, against float64 on the original float32 numbers. Inside attention the scores, the max-subtracted exps, the weights and the outputs are stored in the mode's format; the score dot products, the exp sum and the weighted sum of values accumulate in its accumulator. relNorm: error norm over output norm; maxStored: the largest magnitude stored in that run (fp16's limit is 65504); overflow: finite values that became infinity when stored.`, rows,
    verdict: `Relative error of the attention block, layer 0 then layer 1: fp32 ${e(0, "fp32")}, ${e(1, "fp32")}; fp16 inputs with fp32 accumulation ${e(0, "fp16acc32")}, ${e(1, "fp16acc32")}; fp16 throughout ${e(0, "fp16acc16")}, ${e(1, "fp16acc16")}; bf16 with fp32 accumulation ${e(0, "bf16acc32")}, ${e(1, "bf16acc32")}; bf16 throughout ${e(0, "bf16acc16")}, ${e(1, "bf16acc16")}. Overflows: ${rows.flatMap((r) => r.modes).reduce((a, m) => a + m.overflow, 0)}; largest stored magnitude ${fx(Math.max(...rows.flatMap((r) => r.modes.map((m) => m.maxStored))), 2)}.` };
}

function modelBlock() {
  const base = timed("score", () => scoreUnits(MODEL, HELD)), out = {};
  for (const mode of LOW) {
    const s = createPrecisionScorer(MODEL, HELD, mode, 64), t = performance.now();
    while (!s.done) s.step();
    cost.score = (cost.score ?? 0) + performance.now() - t;
    out[mode] = { ...summarise(s.units(), base), maxStored: s.stats.maxAbs, overflow: s.stats.overflow, ms: performance.now() - t };
    console.error(`scored ${mode}`);
  }
  const float = summarise(base, null), worst = LOW.reduce((a, m) => (Math.abs(out[m].loss.diff) > Math.abs(out[a].loss.diff) ? m : a)), resolved = LOW.filter((m) => out[m].loss.diffLo > 0 || out[m].loss.diffHi < 0);
  return { about: `Held-out loss (nats per word) and look-back accuracy of the whole model on ${ROWS} rows, with every weight, every activation and every intermediate stored in the mode's format and every dot product and reduction accumulated in its accumulator (precision-model.mjs, forwardCtx). Intervals: 95 percent row bootstrap (lo, hi) and the paired difference from the model's own float32 forward pass on the same rows (diff, diffLo, diffHi). fp32 here is the same arithmetic as the others with float32 storage and float32 accumulation; the model's own forward accumulates in float64 and stores float32, so fp32's difference measures that alone. maxStored: the largest magnitude stored anywhere in the run; overflow: finite values that became infinity.`, float, modes: out,
    verdict: [`Float32 model: loss ${iv(float.loss)}, look-back accuracy ${iv(float.lookback)}.`, `Loss difference from float32 (paired, nats): ${LOW.map((m) => `${m} ${dv(out[m].loss)}`).join("; ")}.`, `Largest move: ${worst}, ${dv(out[worst].loss)}. Differences whose interval excludes 0: ${resolved.length ? resolved.join(", ") : "none"}. Largest stored magnitude ${fx(Math.max(...LOW.map((m) => out[m].maxStored)), 2)} against fp16's 65504; overflows ${LOW.reduce((a, m) => a + out[m].overflow, 0)}. At this size (20,864 numbers, dot products of at most ${CFG.dFF} terms, activations far inside fp16's range) the narrow formats cost the model little; that is a finding about this model, not about large ones.`] };
}

function stagnationBlock() {
  const rows = [];
  for (const [step, n] of [[1, 5000], [0.01, 10000], [1e-3, 100000]]) for (const f of ["fp16", "bf16", "fp32"]) rows.push(longSum(step, n, FORMATS[f]));
  const curve = (f, step, n, every) => { const r = f === "fp32" ? Math.fround : (x) => roundTo(x, FORMATS[f]), s0 = r(step), pts = []; let s = 0; for (let i = 1; i <= n; i++) { s = r(s + s0); if (i % every === 0) pts.push([i, s]); } return pts; };
  return { about: "Stagnation: a running sum kept in a format, adding the same small step n times (each sum rounded to the format). stuckAt is the sum where adding the step first left it unchanged (the step is at most half the spacing there, and ties go to the even neighbour), stuckIndex the addition at which it happened, sum the final value against the exact one (step as stored, times n). curves: the running sum of 1s every 50 additions, for the film.", rows, curves: { ones: { fp16: curve("fp16", 1, 5000, 50), bf16: curve("bf16", 1, 5000, 50), fp32: curve("fp32", 1, 5000, 50) } },
    verdict: rows.filter((r) => r.format !== "fp32" || r.stuckAt !== null).map((r) => `${r.format} adding ${r.step} ${r.n} times: ${r.stuckAt === null ? `no stall, sum ${fx(r.sum, 4)}` : `stalls at ${r.stuckAt} after ${r.stuckIndex} additions (spacing there ${r.spacingAtStuck}), final ${fx(r.sum, 4)} against ${fx(r.exact, 4)}`}`).join("; ") + "." };
}

function readRawNative() {
  if (!rawNative) return readNote(null, "raw-native repository, evidence/rr-tc-note-2026-10-15.json (no checkout given)");
  const path = join(rawNative, "evidence/rr-tc-note-2026-10-15.json"), branch = "origin/main";
  try {
    if (existsSync(path)) return readNote(readFileSync(path, "utf8"), "raw-native repository, evidence/rr-tc-note-2026-10-15.json (working tree)");
    const commit = execFileSync("git", ["-C", rawNative, "rev-parse", "--short", branch], { encoding: "utf8" }).trim(), json = execFileSync("git", ["-C", rawNative, "show", `${branch}:evidence/rr-tc-note-2026-10-15.json`], { encoding: "utf8" });
    return readNote(json, `raw-native repository, branch ${branch}, commit ${commit}, evidence/rr-tc-note-2026-10-15.json (not in the working tree; read with git show)`);
  } catch (e) { console.error("raw-native note not read:", e.message); return readNote(null, "raw-native repository, evidence/rr-tc-note-2026-10-15.json"); }
}

function controlsBlock(bits) {
  let trips16 = 0, tripsBf = 0, nan16 = 0, nanBf = 0;
  for (let h = 0; h < 65536; h++) {
    const a = f16FromBits(h), b = bf16FromBits(h);
    if (Number.isNaN(a)) nan16++; else if (f16Bits(a) === h && Object.is(round16(a), a)) trips16++;
    if (Number.isNaN(b)) nanBf++; else if (bf16Bits(b) === h && Object.is(roundBf16(b), b)) tripsBf++;
  }
  const x = HELD.x.subarray(0, 4 * CFG.ctx), m64 = createModel({ ...CFG, float64: true }, MODEL.seed);
  for (const n of MODEL.names) m64.params[n].set(MODEL.params[n]);
  const want = forward(m64, x, 4, CFG.ctx).logits, got = forwardCtx(roundParams(MODEL.params, (v) => v), CFG, x, 4, CFG.ctx, context("fp64"));
  const f32 = forwardCtx(roundParams(MODEL.params, Math.fround), CFG, x, 4, CFG.ctx, context("fp32")), own = forward(MODEL, x, 4, CFG.ctx).logits;
  const maxDiff = (a, b) => a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);
  return { about: "Controls. truncation: a conversion that drops bits instead of rounding to nearest even, caught when any known pattern differs (knownWrong counts them) and on random values (randomWrong). roundTrips: every one of the 65,536 bit patterns of each format (NaNs aside) decodes to a value that converts back to the same bits and that rounding leaves unchanged. contextForward: the emulated forward pass with no rounding against the model's own forward pass in float64 (largest logit difference, must be at most about 1e-12), and the float32 context against the model's float32 forward (which accumulates in float64), on 4 held-out rows.",
    truncation: { knownWrongFp16: bits.rows.filter((r) => r.f16Truncated !== r.fp16).length, knownWrongBf16: bits.rows.filter((r) => r.bf16Truncated !== r.bf16).length, randomWrong: bits.random.truncationWrong, caught: bits.rows.some((r) => r.f16Truncated !== r.fp16) && bits.rows.some((r) => r.bf16Truncated !== r.bf16) },
    roundTrips: { fp16: trips16, fp16NaN: nan16, bf16: tripsBf, bf16NaN: nanBf }, contextForward: { noRoundingVsFloat64: maxDiff(got, want), fp32VsModel: maxDiff(f32, own) } };
}

function speedBlock(seconds) {
  const slice = LOW.map((mode) => { const s = createPrecisionScorer(MODEL, HELD, mode, 16); s.step(); const t = performance.now(); s.step(); s.step(); const ms = (performance.now() - t) / 2; return { mode, msPer16Rows: ms, rowsPer40ms: Math.max(1, Math.floor((40 / ms) * 16)) }; });
  return { about: "Milliseconds in Node (V8), one process at below-normal priority, on the fill machine's CPU. Every stored value and every partial sum goes through software rounding, so the narrow modes are slower than float32 here; on a GPU they are faster, which this lesson does not measure. slice: one scorer step of 16 held-out rows per mode and how many rows fit a 40 ms lab slice. totals: milliseconds spent in each part of the fill; fillSeconds is the wall time.", slice, totals: { ...cost }, fillSeconds: seconds };
}

function filmBlock(sweep, model, near) {
  const ticks = (f, lo, hi) => { const out = []; for (let v = roundTo(lo, FORMATS[f]); v <= hi; v += spacing(v, FORMATS[f])) out.push(v); return out; };
  return { about: "What the films draw (measuring cups with fewer marks). jugs: each format as a cup: marksPerDoubling is how many values lie between one power of two and the next (2^(p - 1)), height its range from the smallest subnormal to the largest value. numberLine: the values each format can hold between 108 and 112 (fp32 holds too many to draw; its count is given). examples: a few numbers near 110 rounded to each format. errorCurves: the worst relative error per octave from the sweep block. lossBars: the model's held-out loss with its interval in each mode, and the float32 model's.",
    jugs: ["fp32", "bf16", "fp16"].map((f) => ({ format: f, marksPerDoubling: 2 ** (FORMATS[f].p - 1), max: FORMATS[f].max, minSub: FORMATS[f].minSub, log2Range: Math.log2(FORMATS[f].max / FORMATS[f].minSub) })),
    numberLine: { from: 108, to: 112, fp16: ticks("fp16", 108, 112), bf16: ticks("bf16", 108, 112), fp32Count: Math.round(4 / spacing(110, FORMATS.fp32)) + 1 },
    examples: [109.97, 110, 110.03, 110.05, 110.2].map((v) => ({ value: v, fp16: round16(v), bf16: roundBf16(v), fp32: Math.fround(v) })),
    errorCurves: { fp16: sweep.fp16.map((r) => [r.octave, r.maxRel]), bf16: sweep.bf16.map((r) => [r.octave, r.maxRel]) },
    lossBars: [{ mode: "float32 model", value: model.float.loss.value, lo: model.float.loss.lo, hi: model.float.loss.hi }, ...LOW.map((m) => ({ mode: m, value: model.modes[m].loss.value, lo: model.modes[m].loss.lo, hi: model.modes[m].loss.hi }))],
    near110: { fp16Spacing: near.fp16.spacing, bf16Spacing: near.bf16.spacing, fp32Spacing: near.fp32.spacing } };
}

function main() {
  const t0 = Date.now(), act = timed("activations", () => activations(32)), bits = bitsBlock(), sweep = sweepBlock(), model = modelBlock(), near = near110Block(readRawNative());
  const blocks = {
    sources: sourcesBlock(),
    formats: { about: "The three formats. p counts significand bits with the hidden one; u = 2^-p is the unit roundoff (the largest relative error of rounding to nearest in the normal range); eps = 2^(1 - p) is the gap after 1; decimalDigits = p log10 2. fp16 is IEEE 754 binary16; bf16 is float32's exponent with a 7-bit stored significand; fp32 is binary32.", rows: ["fp16", "bf16", "fp32"].map((f) => fmtRow(FORMATS[f])) },
    bits, sweep, matmul: matmulBlock(act), attention: attentionBlock(act), model, stagnation: stagnationBlock(), near110: near, controls: controlsBlock(bits), film: filmBlock(sweep, model, near),
  };
  blocks.speed = speedBlock((Date.now() - t0) / 1000);
  const facts = {
    about: "Lesson K24, fp16, bf16 and tensor cores. Computed by tools/school/fill_precision.mjs from system/school/precision.mjs, precision-model.mjs and the attention lab's trained model. Do not edit by hand. No GPU was used: every rounding is exact software rounding, and the tensor-core pattern (narrow inputs, float32 accumulation) is emulated, not run on tensor cores. Losses are in nats per word; intervals are 95 percent row bootstrap intervals, seeded.",
    modelSha256: createHash("sha256").update(RAW).digest("hex"), modelFile: "media/school/attention/model.json",
    sourceSha256: Object.fromEntries(["precision.mjs", "precision-model.mjs"].map((f) => [f, createHash("sha256").update(readFileSync(new URL(`../../system/school/${f}`, import.meta.url))).digest("hex")])),
    recipe: { heldOutRows: ROWS, resamples: 1000, bootstrapSeed: 1, modes: MODES, activationRows: 32 },
    ...deep(blocks), seconds: 0,
  };
  facts.seconds = round((Date.now() - t0) / 1000, 1);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  console.log(JSON.stringify({ matmul: facts.matmul.verdict, attention: facts.attention.verdict, model: facts.model.verdict, stagnation: facts.stagnation.verdict, near110: facts.near110.verdict, controls: facts.controls, speed: facts.speed, seconds: facts.seconds }, null, 1));
}

try { main(); } catch (e) { console.error("fill_precision failed:", e); process.exit(1); }
