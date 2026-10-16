// Fill lesson K22's numbers ("Matmul tiling") so no number in the film or
// lab is typed by hand. Writes media/school/tiling/facts.json.
//
//   node tools/school/fill_tiling.mjs [media/school/tiling]
//
// No GPU is touched. Every count comes from the emulator in
// system/school/tiling.mjs, which runs each kernel invocation by invocation
// (all n^3 multiply-adds, in float32) and which the tests hold to the float64
// reference and to closed forms. One process at below-normal priority: the
// whole fill is under a minute of counting.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority } from "node:os";
import { emulate, createEmulation, makeMatrices, cpuReference, checkMatmul, closedForm, volkovWords, schedule, gamma, WORD } from "../../system/school/tiling.mjs";
import { SPEC } from "../../system/school/threads.mjs";
import { round, deep } from "./fill_gaming_report.mjs";
import { sourcesBlock, plan } from "./fill_tiling_report.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const outDir = process.argv[2] || "media/school/tiling";
const SRC = new URL("../../system/school/tiling.mjs", import.meta.url);
const NS = [64, 128, 256, 512, 1024], KERNELS = [["naive", 16], ["tiled", 8], ["tiled", 16]], STALE = [["stale", 8], ["stale", 16]];
const COUNTS = ["globalLoads", "globalStores", "sharedLoads", "sharedStores", "barriers", "fma"];
const fx = (v, k = 3) => String(round(v, k));
const big = (v) => v.toLocaleString("en-US");

// Every kernel at every size on the same inputs (seed 1), with wall times.
function runAll() {
  const out = [];
  for (const n of NS) {
    const { a, b } = makeMatrices(n, 1), t0 = performance.now(), ref = cpuReference(a, b, n), msRef = performance.now() - t0, runs = {};
    for (const [kind, T] of [...KERNELS, ...STALE]) {
      const t = performance.now(), r = emulate({ kind, n, T, a, b });
      runs[`${kind}${T}`] = { ...r, ms: performance.now() - t, check: checkMatmul(r.c, ref, n) };
    }
    out.push({ n, msRef, runs });
    console.error(`n ${n} done`);
  }
  return out;
}

function countsBlock(all) {
  const rows = [];
  for (const { n, runs } of all) for (const [kind, T] of KERNELS) {
    const r = runs[`${kind}${T}`], cf = closedForm(kind, n, T), naive = runs.naive16;
    rows.push({ n, kind, T, ...Object.fromEntries(COUNTS.map((k) => [k, r[k]])), barrierArrivals: r.barrierArrivals, workgroups: r.workgroups, globalBytes: r.globalBytes, sharedBytes: r.sharedBytes, flops: r.flops, intensity: r.intensity, globalLoadsVsNaive: r.globalLoads / naive.globalLoads, sharedPerWorkgroupBytes: r.sharedPerWorkgroupBytes, matchesClosedForm: COUNTS.every((k) => r[k] === cf[k]), volkovWords: kind === "naive" ? null : volkovWords(n, n, n, T, T) });
  }
  const at = (n, kind, T) => rows.find((r) => r.n === n && r.kind === kind && r.T === T);
  const top = NS.at(-1);
  return { about: `Counts from the emulator for C = A x B, square n x n float32, every kernel run in full (all n^3 multiply-adds). globalLoads and globalStores are 4-byte element requests to global memory; sharedLoads and sharedStores to workgroup memory; barriers are workgroupBarrier() calls per workgroup (barrierArrivals counts each invocation's arrival); fma is multiply-adds (flops = 2 fma). intensity = flops / global bytes (loads and stores). matchesClosedForm: every count equals naive 2 n^3 loads, n^2 stores; tiled 2 n^3 / T loads, 2 n^3 / T shared stores, 2 n^3 shared loads, 2 (n / T)^3 barriers. volkovWords is Volkov and Demmel's m n k (1/bn + 1/bm) for the same blocking. Counts are requests issued, not DRAM traffic: a GPU's caches can serve repeated naive reads.`, rows,
    verdict: [
      `At n = ${big(top)}: naive ${big(at(top, "naive", 16).globalLoads)} global loads, tiled T 8 ${big(at(top, "tiled", 8).globalLoads)}, tiled T 16 ${big(at(top, "tiled", 16).globalLoads)}: 1/8 and 1/16 of naive. All ${rows.length} rows match the closed forms: ${rows.every((r) => r.matchesClosedForm)}.`,
      `Arithmetic intensity (flops per global byte, stores included): naive ${NS.map((n) => fx(at(n, "naive", 16).intensity)).join(", ")}; T 8 ${NS.map((n) => fx(at(n, "tiled", 8).intensity)).join(", ")}; T 16 ${NS.map((n) => fx(at(n, "tiled", 16).intensity)).join(", ")} for n = ${NS.join(", ")}. The limits are 1/4, 2 and 4: each loaded float feeds 1, 8 or 16 multiply-adds, two loads per multiply-add.`,
      `The price: ${big(at(top, "tiled", 16).sharedLoads)} shared loads (2 n^3, as many as the naive kernel's global loads), ${big(at(top, "tiled", 16).barriers)} barriers at T 16 and ${big(at(top, "tiled", 8).barriers)} at T 8, and ${at(top, "tiled", 16).sharedPerWorkgroupBytes} bytes of workgroup memory per workgroup at T 16 (WebGPU guarantees ${SPEC.webgpu.maxComputeWorkgroupStorageSize}).`,
    ] };
}

function correctnessBlock(all) {
  const rows = [];
  for (const { n, runs } of all) for (const [kind, T] of [...KERNELS, ...STALE]) {
    const r = runs[`${kind}${T}`];
    rows.push({ n, kind, T, ok: r.check.ok, mismatches: r.check.mismatches, maxErr: r.check.maxErr, maxRatio: r.check.maxRatio, gamma: gamma(n), sameBitsAsNaive: kind === "stale" ? null : r.c.every((v, i) => Object.is(v, runs.naive16.c[i])) });
  }
  const good = rows.filter((r) => r.kind !== "stale"), stale = rows.filter((r) => r.kind === "stale");
  return { about: "Correctness of the emulated float32 result against a float64 CPU reference on the same inputs (uniform in [-1, 1), seed 1). Tolerance, per element: gamma_n * sum_k |a_ik b_kj| with gamma_n = n u / (1 - n u), u = 2^-24, the worst-case error of a float32 inner product of length n in any summation order (Higham, Accuracy and Stability of Numerical Algorithms, equation 3.5), so a GPU that fuses multiply-adds or sums in another order is held to the same bound. maxRatio is the largest error over its bound. sameBitsAsNaive: the tiled kernel adds the n products in the same order as the naive one, so the float32 results are identical. stale is the tiled kernel without its first barrier, run under the worst schedule that allows (every read sees the previous phase's tile).", rows,
    verdict: `Naive and tiled pass at every size, with the largest error at most ${fx(Math.max(...good.map((r) => r.maxRatio)), 4)} of the bound (the bound is a worst case; random signs cancel); tiled results equal naive bit for bit: ${good.every((r) => r.sameBitsAsNaive)}. The stale kernel fails at every size: ${stale.map((r) => `n ${r.n} T ${r.T} ${big(r.mismatches)} of ${big(r.n * r.n)} wrong`).join("; ")}; its smallest error-over-bound is ${fx(Math.min(...stale.map((r) => r.maxRatio)), 1)}x at n ${stale.reduce((m, r) => (r.maxRatio < m.maxRatio ? r : m)).n}.` };
}

function controlsBlock() {
  const n = 64, { a, b } = makeMatrices(n, 3), ref = cpuReference(a, b, n), good = emulate({ kind: "tiled", n, T: 16, a, b }).c;
  const one = Float32Array.from(good);
  one[777] += 1e-3;
  return { about: "Controls for the checker at n = 64 (seed 3): the tiled kernel passes; the exact answer rounded to float32 passes; one element moved by 0.001 fails with exactly one mismatch; the tiled kernel's own output fails when the tolerance is set to zero, so the bound is doing work and is not loose enough to pass anything.",
    tiled: checkMatmul(good, ref, n).ok, roundedReference: checkMatmul(Float32Array.from(ref.c), ref, n).ok, oneElementOff: checkMatmul(one, ref, n).mismatches, zeroTolerance: checkMatmul(good, { c: ref.c, mag: ref.mag.map(() => 0) }, n).ok };
}

function speedBlock(all, seconds) {
  const per = (kind, T, n) => { const { a, b } = makeMatrices(n, 1), e = createEmulation({ kind, n, T, a, b }), k = Math.min(e.workgroups - 2, 16); e.step(2); const t = performance.now(); e.step(k); return (performance.now() - t) / k; };
  const slice = [...KERNELS, ...STALE.slice(1)].flatMap(([kind, T]) => [256, 1024].map((n) => { const ms = per(kind, T, n); return { kind, T, n, msPerWorkgroup: ms, workgroupsPer40ms: Math.max(1, Math.floor(40 / ms)) }; }));
  return { about: "Milliseconds in Node (V8), one process at below-normal priority, on the fill machine's CPU. The emulator runs every multiply-add in float32 and counts every access, so it is far slower than a GPU. A lab runs it in 40 ms slices of whole workgroups (slice: milliseconds per workgroup over 16 workgroups after 2 untimed ones, and how many fit in 40 ms; a naive workgroup does T^2 dot products of length n). runs: the wall time of each full emulation in this fill, and the float64 reference.", slice,
    runs: all.map(({ n, msRef, runs }) => ({ n, msReference: msRef, ...Object.fromEntries(Object.entries(runs).map(([k, r]) => [k, r.ms])) })), fillSeconds: seconds };
}

function filmBlock(all) {
  const n = 64, T = 16, r = all.find((x) => x.n === n).runs;
  return { about: `What the films draw (the cannery: a crew carries a tray of cans to the bench instead of walking to the store for every can). trips: for one output element, reads from global memory: naive 2n, tiled 2n / T. perElement: how many times each element of A (and of B) is fetched from global memory: naive n, tiled n / T. grid: n = ${n} with T = ${T} is a 4 x 4 grid of workgroups; schedule is workgroup (x 1, y 2), phase by phase: the A tile and B tile it copies (rows and columns, inclusive), and the work each phase does. ratios: tiled over naive global loads for every n. intensity: flops per global byte at n = ${n}.`,
    trips: NS.map((m) => ({ n: m, naive: 2 * m, tiled8: (2 * m) / 8, tiled16: (2 * m) / 16 })), perElement: NS.map((m) => ({ n: m, naive: m, tiled8: m / 8, tiled16: m / 16 })),
    grid: { n, T, workgroups: (n / T) ** 2, invocationsPerWorkgroup: T * T }, schedule: schedule(n, T, 1, 2),
    ratios: all.map(({ n: m, runs }) => ({ n: m, tiled8: runs.tiled8.globalLoads / runs.naive16.globalLoads, tiled16: runs.tiled16.globalLoads / runs.naive16.globalLoads })),
    intensity: { naive: r.naive16.intensity, tiled8: r.tiled8.intensity, tiled16: r.tiled16.intensity, limits: { naive: 0.25, tiled8: 2, tiled16: 4 } }, bytesPerFloat: WORD };
}

function main() {
  const t0 = Date.now(), src = readFileSync(SRC), all = runAll();
  const blocks = { sources: sourcesBlock(), counts: countsBlock(all), correctness: correctnessBlock(all), controls: controlsBlock(), film: filmBlock(all), lab: plan() };
  blocks.speed = speedBlock(all, (Date.now() - t0) / 1000);
  const facts = {
    about: "Lesson K22, matmul tiling. Computed by tools/school/fill_tiling.mjs from the emulator in system/school/tiling.mjs. Do not edit by hand. No GPU was used: every number is a count from the emulator or a claim of a cited source. Timings on a real GPU happen only in the lab, on the reader's device, labelled with their adapter.",
    sourceSha256: createHash("sha256").update(src).digest("hex"), sourceFile: "system/school/tiling.mjs",
    ...deep(blocks), seconds: 0,
  };
  facts.seconds = round((Date.now() - t0) / 1000, 1);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  console.log(JSON.stringify({ counts: facts.counts.verdict, correctness: facts.correctness.verdict, controls: facts.controls, slice: facts.speed.slice, seconds: facts.seconds }, null, 1));
}

try { main(); } catch (e) { console.error("fill_tiling failed:", e); process.exit(1); }
