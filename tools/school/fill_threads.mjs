// Fill lesson K21's numbers ("Threads, workgroups and memory") so no number
// in the film or lab is typed by hand. Writes media/school/threads/facts.json.
//
//   node tools/school/fill_threads.mjs [media/school/threads]
//
// No GPU is touched. Every count comes from the emulator in
// system/school/threads.mjs (which the tests hold to the CPU reference and to
// closed forms), every limit from the WebGPU, WGSL and CUDA documents named in
// the spec block. The work is a few seconds of counting, so it runs in one
// process at below-normal priority; there is no training to farm out.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority } from "node:os";
import { emulate, createEmulation, makeInputs, cpuReference, checkOutput, threadMap, countSegments, idleClosedForm, contiguousClosedForm, readIndex, params, SPEC, WARP } from "../../system/school/threads.mjs";
import { round, deep } from "./fill_gaming_report.mjs";
import { specBlock, plan } from "./fill_threads_report.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const outDir = process.argv[2] || "media/school/threads";
const SRC = new URL("../../system/school/threads.mjs", import.meta.url);
const NS = [1000, 1024, 4099, 1 << 20, 1000000], WGS = [32, 48, 64, 128, 256], BIG = 1 << 20, STRIDES = [1, 2, 4, 8, 16, 32, 64, 1024];
const strip = ({ out, ...r }) => r;
const fx = (v, k = 3) => String(round(v, k));
const inputs = new Map();
const io = (n) => { if (!inputs.has(n)) inputs.set(n, makeInputs(n, 1)); return inputs.get(n); };

function groupingBlock() {
  const rows = [];
  for (const n of NS) for (const wg of WGS) {
    const r = emulate({ kind: "add", n, wg, ...io(n), segments: [] });
    rows.push({ n, wg, workgroups: r.workgroups, invocations: r.invocations, idleThreads: r.idleThreads, idleShare: r.idleThreads / r.invocations, closedForm: idleClosedForm(n, wg), warps: r.warps, partialWarps: r.partialWarps, emptyLanes: r.emptyLanes, dispatchesNeeded: r.dispatchesNeeded });
  }
  const worst = rows.reduce((b, r) => (r.idleShare > b.idleShare ? r : b));
  return { about: "How a 1-D dispatch of ceil(n / wg) workgroups covers an array of n elements. invocations = workgroups * wg; idleThreads run the bound check and return (closedForm = ceil(n / wg) * wg - n, which the emulator matches). warps: 32-lane groups inside each workgroup (the CUDA model); a workgroup size that is not a multiple of 32 leaves partialWarps with emptyLanes. dispatchesNeeded: 1-D dispatches if each may hold at most maxComputeWorkgroupsPerDimension (65,535) workgroups.", rows,
    verdict: `Idle threads are at most wg - 1 per dispatch: ${rows.filter((r) => r.n === 1000).map((r) => `${r.idleThreads} at wg ${r.wg}`).join(", ")} for n = 1,000; the largest share in the table is ${fx(worst.idleShare)} (n ${worst.n}, wg ${worst.wg}). Every row matches the closed form: ${rows.every((r) => r.idleThreads === r.closedForm)}.` };
}

function trafficBlock() {
  const rows = STRIDES.map((S) => {
    const r = emulate({ kind: S === 1 ? "add" : "strided", n: BIG, wg: 64, stride: S, ...io(BIG) });
    return { stride: S, loads: r.loads, stores: r.stores, t32: r.transactions[32], t128: r.transactions[128], usefulBytes: r.usefulBytes };
  });
  const base = rows[0], ratio = (r, s) => r[`t${s}`].total / base[`t${s}`].total;
  for (const r of rows) { r.ratio32 = ratio(r, 32); r.ratio128 = ratio(r, 128); }
  const w48 = emulate({ kind: "add", n: BIG, wg: 48, ...io(BIG) }).transactions;
  return { about: `Global memory traffic of out[i] = a[j] + b[j] for n = ${BIG} (2^20) 4-byte floats, workgroup size 64, in the 32-lane model: each warp's load of a, load of b and store of out costs one transaction per distinct segment its active lanes touch. t32: 32-byte transactions (the CUDA Programming Guide 13.4, section 2.3.4.1: global memory is accessed via 32-byte memory transactions). t128: 128-byte segments (the older whole-line model; one transaction per perfectly coalesced warp of 4-byte words). stride 1 is the contiguous kernel; stride S reads a transposed walk in which neighbouring threads read elements S apart (the write stays contiguous). efficiency = useful bytes / bytes moved. closedForm: ceil(4n / segment) per array for contiguous access.`,
    rows, closedForm: { t32: contiguousClosedForm(BIG, 32), t128: contiguousClosedForm(BIG, 128) }, wg48: { t32: w48[32], t128: w48[128] },
    verdict: [
      `Contiguous: ${base.t128.a} 128-byte transactions per array (closed form ${contiguousClosedForm(BIG, 128)}), ${base.t32.a} 32-byte ones (closed form ${contiguousClosedForm(BIG, 32)}); efficiency ${fx(base.t32.efficiency)} and ${fx(base.t128.efficiency)}.`,
      `Strided reads, transactions over contiguous, all three arrays: 32-byte model ${rows.map((r) => `stride ${r.stride} ${fx(r.ratio32, 2)}x`).join(", ")}; 128-byte model ${rows.map((r) => `stride ${r.stride} ${fx(r.ratio128, 2)}x`).join(", ")}. The read side stops growing once neighbouring threads are a segment apart (8 floats for 32 bytes, 32 floats for 128 bytes): one transaction per thread is the worst case.`,
      `Workgroup size 48 (not a multiple of 32): ${w48[128].a} 128-byte transactions per array against ${base.t128.a} at 64, because its warps start at elements 48g and 48g + 32, which for odd g sit 64 bytes off a 128-byte boundary; in the 32-byte model ${w48[32].a} against ${base.t32.a}.`,
    ] };
}

function controlsBlock() {
  const n = 1000, wg = 64, { a, b } = io(n), want = cpuReference(a, b, "add", n), out = [];
  for (const kind of ["add", "offByOne", "short", "noGuard"]) for (const oob of ["discard", "clamp", "buffer"]) {
    const r = emulate({ kind, n, wg, a, b, oob, pad: 64 }), c = checkOutput(r.out, want, { pad: 64 });
    out.push({ kind, oob, oobStores: r.oobStores, oobLoads: r.oobLoads, mismatches: c.mismatches, canaryHit: c.canaryHit, caughtByOutput: !c.ok, caughtByCount: r.oobStores > 0 });
  }
  const broken = out.filter((r) => r.kind !== "add"), missed = broken.filter((r) => !r.caughtByOutput), uncounted = broken.filter((r) => !r.caughtByCount), neither = broken.filter((r) => !r.caughtByOutput && !r.caughtByCount);
  const list = (a) => a.map((r) => `${r.kind} with ${r.oob}`).join(", ") || "none";
  return { about: `The checker against broken kernels, n = ${n}, workgroup size ${wg}, 64 canary floats after the bound array in the same buffer. WGSL section 6.5.7 lets a store past the end of a binding write to any location of the bound buffer or not happen at all; the three oob modes are three of those allowed outcomes: discard (dropped), clamp (lands on the last element), buffer (lands at its own index in the canary words). caughtByOutput: the output check fails (a wrong element or a changed canary). caughtByCount: the emulator counts at least one store past the binding (only the emulator can count; a GPU run has only the output check).`, rows: out,
    verdict: `Of ${broken.length} broken cases, the output check (elements and canaries) misses ${missed.length}: ${list(missed)}; the out-of-bounds store count misses ${uncounted.length}: ${list(uncounted)}; both miss ${neither.length}: ${list(neither)}. A dropped stray write leaves a correct-looking output, and a kernel that stops one short writes nothing out of bounds, so each check covers the other's gap.` };
}

function speedBlock() {
  const { a, b } = io(BIG), t0 = performance.now(), e = createEmulation({ n: BIG, wg: 64, a, b });
  e.step(256);
  const t1 = performance.now(), per = (t1 - t0) / 256;
  e.step();
  const t2 = performance.now(), want = cpuReference(a, b, "add", BIG), t3 = performance.now();
  checkOutput(e.result().out, want);
  const t4 = performance.now();
  return { about: "Milliseconds in Node (V8), one process. The emulator visits every thread and counts every segment, so it is far slower than a GPU; a lab runs it in 40 ms slices of workgroups. msPerWorkgroup: one 64-wide workgroup with traffic counted in both models. msEmulate2pow20: the whole 2^20 array. msReference and msCheck: CPU reference and output check for 2^20 floats (the lab's correctness pass after a GPU run).", msPerWorkgroup: per, workgroupsPer40ms: Math.floor(40 / per), msEmulate2pow20: t2 - t0, msReference: t3 - t2, msCheck: t4 - t3 };
}

function filmBlock() {
  const lanes = (kind, n, S) => { const p = params(kind, n, S); return Array.from({ length: WARP }, (_, l) => { const j = readIndex(kind, l, p); return { lane: l, element: j, seg32: Math.floor((j * 4) / 32), seg128: Math.floor((j * 4) / 128) }; }); };
  const warp0 = { contiguous: lanes("add", 4096, 1), stride8: lanes("strided", 4096, 8), stride32: lanes("strided", 4096, 32) };
  const segs = Object.fromEntries(Object.entries(warp0).map(([k, v]) => [k, { t32: countSegments(v.map((x) => x.element), 32), t128: countSegments(v.map((x) => x.element), 128) }]));
  return { about: "What the films draw. map: a dispatch of n = 40 over workgroups of 16 (3 workgroups, 48 invocations, 8 idle), each invocation's workgroup, local id, global id, warp and the element it reads and writes; offByOne is the same dispatch with the off-by-one guard (one invocation writes element 40). warp0: the first warp's 32 lanes, the element each reads and its 32-byte and 128-byte segment, for contiguous access and strides 8 and 32 (n = 4096); segments counts them. idle: idle threads for n = 1,000 at each workgroup size.",
    map: threadMap({ n: 40, wg: 16 }), offByOne: threadMap({ kind: "offByOne", n: 40, wg: 16 }).filter((t) => t.outOfBounds), warp0, segments: segs, idle: WGS.map((wg) => ({ wg, idle: idleClosedForm(1000, wg) })) };
}

function main() {
  const t0 = Date.now(), src = readFileSync(SRC);
  const blocks = { spec: specBlock(SPEC), grouping: groupingBlock(), traffic: trafficBlock(), controls: controlsBlock(), speed: speedBlock(), film: filmBlock(), lab: plan() };
  const facts = {
    about: "Lesson K21, threads, workgroups and memory. Computed by tools/school/fill_threads.mjs from the emulator in system/school/threads.mjs. Do not edit by hand. No GPU was used: every number is a count from the emulator's model or a published limit. Timings on a real GPU happen only in the lab, on the reader's device, labelled with their adapter.",
    sourceSha256: createHash("sha256").update(src).digest("hex"), sourceFile: "system/school/threads.mjs",
    ...deep(blocks), seconds: 0,
  };
  facts.seconds = round((Date.now() - t0) / 1000, 1);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  console.log(JSON.stringify({ grouping: facts.grouping.verdict, traffic: facts.traffic.verdict, controls: facts.controls.verdict, speed: facts.speed, seconds: facts.seconds }, null, 1));
}

try { main(); } catch (e) { console.error("fill_threads failed:", e); process.exit(1); }
