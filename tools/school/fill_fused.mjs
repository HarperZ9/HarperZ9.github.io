// Fill lesson K23's numbers ("Fused attention") so no number in the film or
// lab is typed by hand. Writes media/school/fused/facts.json.
//
//   node tools/school/fill_fused.mjs [media/school/attention/model.json] [media/school/fused]
//
// No GPU is touched. Traffic counts come from the emulator in
// system/school/fused-emu.mjs (count-only walks of the kernels' loops, held to
// the full emulation where both run); correctness from full float32
// emulations against a float64 reference; the probe and overflow blocks from
// the attention lab's trained model. One process at below-normal priority.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority } from "node:os";
import { makeQKV, reference, checkAttention, tiledAttention, onlineSoftmax, safeSoftmax, naiveSoftmax, probeQKV, scoreRange, FP16_EXP_OVERFLOW } from "../../system/school/fused.mjs";
import { emulate, createEmulation, closedForm, theta, WORD } from "../../system/school/fused-emu.mjs";
import { tileFor, sharedBytes } from "../../system/school/fused-wgsl.mjs";
import { round16 } from "../../system/school/precision.mjs";
import { fromJSON } from "../../system/school/tinyformer.mjs";
import { PROBES, heldOut } from "../../system/school/corpus.mjs";
import { round, deep } from "./fill_gaming_report.mjs";
import { sourcesBlock, plan } from "./fill_fused_report.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const modelPath = process.argv[2] || "media/school/attention/model.json", outDir = process.argv[3] || "media/school/fused";
const RAW = readFileSync(modelPath), M = JSON.parse(RAW.toString("utf8")), MODEL = fromJSON(M.weights);
const NS = [64, 128, 256, 512, 1024, 2048, 4096], DS = [16, 64], CHECK_NS = [64, 256, 1024], PROBE = PROBES[0], ROW = PROBE.query, cost = {};
const COUNTS = ["globalReads", "globalWrites", "fma", "exps", "barriers"];
const timed = (k, f) => { const t = performance.now(), v = f(); cost[k] = (cost[k] ?? 0) + performance.now() - t; return v; };
const fx = (v, k = 3) => String(round(v, k));
const mib = (b) => `${fx(b / 2 ** 20, 2)} MiB`;

function trafficBlock() {
  const rows = [];
  for (const d of DS) for (const N of NS) {
    const B = tileFor(d), r = {};
    for (const kind of ["unfused", "fused"]) r[kind] = timed("count", () => emulate({ kind, N, d, B, compute: false }));
    for (const kind of ["unfused", "fused"]) {
      const x = r[kind], cf = closedForm(kind, N, d, B), t = theta(N, d, 2 * B * d), moved = x.globalReads + x.globalWrites;
      rows.push({ N, d, B, kind, ...Object.fromEntries([...COUNTS, "sharedReads", "sharedWrites"].map((k) => [k, x[k]])), globalBytes: x.globalBytes, extraMemoryBytes: x.extraMemoryBytes, sharedPerWorkgroupBytes: kind === "fused" ? sharedBytes("fused", { d, B }) : Math.max(sharedBytes("scores", { d, B }), sharedBytes("softmax")), matchesClosedForm: COUNTS.every((k) => x[k] === cf[k]), overTheta: kind === "fused" ? moved / t.flash : moved / t.standard, scoreShare: kind === "unfused" ? (4 * N * N) / moved : 0, overFused: x.globalBytes / r.fused.globalBytes });
    }
  }
  const at = (N, d, kind) => rows.find((r) => r.N === N && r.d === d && r.kind === kind), top = NS.at(-1);
  return { about: `Global memory traffic of one attention head, N query and key rows of width d, float32, counted by walking every kernel's loops (compute: false). Tiles: B = ${DS.map((d) => `${tileFor(d)} at d ${d}`).join(", ")} rows, the most that fit a tile of K and one of V in 16,384 bytes of workgroup memory (capped at 128). globalReads and globalWrites are 4-byte element requests; globalBytes is both together. Closed forms with G = ceil(N / B): unfused reads N d + 2 G N d + 2 N^2 and writes 2 N^2 + N d; fused reads N d + 2 G N d and writes N d. So the unfused kernels move exactly 4 N^2 more floats (S written, read, P written, read); scoreShare is that over all unfused traffic. extraMemoryBytes is the N x N score buffer the unfused path must allocate. overTheta divides the traffic by FlashAttention's Theorem 2 orders (standard N d + N^2; fused N^2 d^2 / M with M = 2 B d, the workgroup memory in floats); it settles to a constant as N grows, which is what Theta claims. Requests, not DRAM transactions: caches may serve some.`, rows,
    verdict: [
      `At N ${top}: d 64 unfused ${mib(at(top, 64, "unfused").globalBytes)} against fused ${mib(at(top, 64, "fused").globalBytes)} (${fx(at(top, 64, "unfused").overFused, 2)}x); d 16 unfused ${mib(at(top, 16, "unfused").globalBytes)} against fused ${mib(at(top, 16, "fused").globalBytes)} (${fx(at(top, 16, "unfused").overFused, 2)}x). The score table is ${fx(100 * at(top, 64, "unfused").scoreShare, 1)} percent of the unfused traffic at d 64 and ${fx(100 * at(top, 16, "unfused").scoreShare, 1)} percent at d 16.`,
      `Unfused over fused traffic by N at d 64: ${NS.map((n) => fx(at(n, 64, "unfused").overFused, 2)).join(", ")}; at d 16: ${NS.map((n) => fx(at(n, 16, "unfused").overFused, 2)).join(", ")} (N = ${NS.join(", ")}). The unfused path also allocates ${mib(at(top, 64, "unfused").extraMemoryBytes)} for S at N ${top}; the fused one allocates nothing extra.`,
      `All ${rows.length} rows match the closed forms: ${rows.every((r) => r.matchesClosedForm)}. Traffic over the Theorem 2 order at N = ${NS.join(", ")}: fused d 64 ${NS.map((n) => fx(at(n, 64, "fused").overTheta, 2)).join(", ")}; unfused d 64 ${NS.map((n) => fx(at(n, 64, "unfused").overTheta, 2)).join(", ")}. The fused constant tends to 4 (2 G N d = 4 N^2 d^2 / M); the unfused one tends to 4 + 2 d / B (4.25 at d 16, 8 at d 64), because these unfused kernels re-read K and V once per query block (2 G N d) where Algorithm 0's analysis counts them once.`,
    ] };
}

function correctnessBlock() {
  const rows = [], runs = [];
  for (const d of DS) for (const N of CHECK_NS) {
    const B = tileFor(d), x = makeQKV(N, d, 1, 2), ref = timed("reference", () => reference(x.q, x.k, x.v, N, d, { Bc: B }));
    const tiled = tiledAttention(x.q, x.k, x.v, N, d, { Bc: B }).o;
    for (const kind of ["unfused", "fused", "broken"]) {
      const t = performance.now(), r = timed("emulate", () => emulate({ kind, N, d, B, ...x })), ms = performance.now() - t, c = checkAttention(r.o, ref), cnt = emulate({ kind, N, d, B, compute: false });
      rows.push({ N, d, B, kind, ok: c.ok, mismatches: c.mismatches, outputs: N * d, maxErr: c.maxErr, maxRatio: c.maxRatio, countsAgree: [...COUNTS, "sharedReads", "sharedWrites"].every((k) => cnt[k] === r[k]), sameBitsAsTiled: kind === "fused" ? r.o.every((v, i) => Object.is(v, tiled[i])) : null });
      runs.push({ N, d, kind, ms });
    }
    console.error(`checked d ${d} N ${N}`);
  }
  const good = rows.filter((r) => r.kind !== "broken"), broken = rows.filter((r) => r.kind === "broken");
  return { about: "Full float32 emulations against a float64 reference (standard softmax attention with the max subtracted) on the same inputs (uniform in [-2, 2), seed 1, scale 1 / sqrt(d)). The tolerance per output is fused.mjs's bound: 2 (exp(2 delta + 2 e) - 1 + gamma_K) sum_j p_ij |v_j| plus an underflow floor, with delta the score error (gamma_(d+1) scale sum |q k|, Higham's equation 3.5) and e WGSL's f32 exp accuracy (3 + 2 |x| ULP); it is derived for this lesson, first order in u. maxRatio is the largest error over its bound. countsAgree: the full emulation and the count-only walk give the same counts. sameBitsAsTiled: the fused kernel's float32 output equals fused.mjs's tiledAttention bit for bit (the same operations in the same order).", rows, runs,
    verdict: `Unfused and fused pass at every size: ${good.every((r) => r.ok)}, the largest error at most ${fx(Math.max(...good.map((r) => r.maxRatio)), 4)} of the bound (the bound is loose on purpose: it allows a GPU's exp error of 3 + 2 |x| ULP, where the emulator's exp is V8's, rounded once to float32). Fused equals the JavaScript tiled attention bit for bit: ${good.filter((r) => r.kind === "fused").every((r) => r.sameBitsAsTiled)}. The broken kernel fails wherever a row spans more than one tile: ${broken.map((r) => `d ${r.d} N ${r.N} (B ${r.B}): ${r.ok ? "passes, one tile" : `${r.mismatches} of ${r.outputs} wrong`}`).join("; ")}.` };
}

function probeBlock() {
  const heads = [];
  for (const layer of [0, 1]) for (const head of [0, 1]) {
    const P = probeQKV(MODEL, PROBE.words, layer, head), ref = reference(P.q, P.k, P.v, P.T, P.hd, { causal: true, Bc: 4 });
    const tiled = tiledAttention(P.q, P.k, P.v, P.T, P.hd, { Bc: 4, causal: true, traceRow: ROW }), broken = tiledAttention(P.q, P.k, P.v, P.T, P.hd, { Bc: 4, causal: true, broken: true });
    const row = Array.from(P.scores.subarray(ROW * P.T, ROW * P.T + ROW + 1)), c = checkAttention(tiled.o, ref), cb = checkAttention(broken.o, ref);
    heads.push({ layer, head, ok: c.ok, maxRatio: c.maxRatio, modelOk: checkAttention(P.ao, ref).ok, modelMaxRatio: checkAttention(P.ao, ref).maxRatio, brokenOk: cb.ok, brokenMismatches: cb.mismatches, outputs: P.T * P.hd, rowsWithMaxRise: Array.from(tiled.changes).filter((v) => v > 0).length, row: row.map((v) => round(v, 4)), rowMax: Math.max(...row), argmax: row.indexOf(Math.max(...row)), trace: tiled.trace.tiles });
  }
  const top = heads.reduce((a, b) => (b.rowMax > a.rowMax ? b : a));
  return { about: `The attention lab's trained model on the probe sentence "${PROBE.words.join(" ")}" (${PROBE.words.length} words, causal, head width ${MODEL.config.dModel / MODEL.config.nHeads}): its own Q, K and V at each layer and head, tiled attention with tiles of 4 keys against the float64 reference within the bound, the model's own attention output (computed by tinyformer-attn.mjs, the standard way) against the same reference, and the broken rescale. row: the scaled scores of query position ${ROW} (the word "${PROBE.words[ROW]}", where the answer "${PROBE.answer}" is predicted) over keys 0 to ${ROW}. trace: that row's running max and running sum after each tile of 4 keys. rowsWithMaxRise: query rows whose max rose after their first tile, the rows where the broken rescale does harm.`, heads,
    verdict: `Tiled passes on all four heads: ${heads.every((h) => h.ok)} (worst ${fx(Math.max(...heads.map((h) => h.maxRatio)), 4)} of the bound); the model's own attention output passes the same check: ${heads.every((h) => h.modelOk)}. The broken rescale fails on every head: ${heads.map((h) => `L${h.layer} H${h.head} ${h.brokenMismatches} of ${h.outputs}`).join(", ")}. Largest score in row ${ROW}: ${fx(top.rowMax, 3)} at layer ${top.layer} head ${top.head}, key ${top.argmax} ("${PROBE.words[top.argmax]}").` };
}

// Smallest factor c >= 1 at which the naive fp16 softmax of c * row overflows.
function overflowFactor(row) {
  const bad = (c) => !Number.isFinite(naiveSoftmax(row.map((v) => c * v), round16).l);
  let lo = 1, hi = 64;
  if (bad(lo)) return 1;
  if (!bad(hi)) return null;
  for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (bad(mid)) hi = mid; else lo = mid; }
  return hi;
}

function overflowBlock(probe) {
  const top = probe.heads.reduce((a, b) => (b.rowMax > a.rowMax ? b : a)), naive = naiveSoftmax(top.row, round16), safe = safeSoftmax(top.row, round16);
  const rows = 256, held = heldOut(rows, MODEL.config.ctx), range = scoreRange(MODEL, held.x, rows, MODEL.config.ctx);
  return { about: `Why the running max matters, with the model's numbers. In fp16 (largest finite 65504) e^s rounds to infinity once s >= ln 65520 = ${fx(FP16_EXP_OVERFLOW, 4)}. probeRow: the probe's row ${ROW} at the head with its largest score, softmaxed in fp16 without the max subtracted (naive: exp, sum and divide each rounded to fp16) and with it (safe); overflowFactor is the smallest factor by which that row's scores could be scaled before the naive fp16 sum overflows. heldOut: every causal score of ${rows} held-out rows of ${MODEL.config.ctx} words (the float32 forward pass), per layer and head: the largest and smallest score and how many reach the overflow threshold. The model computes in float32 and subtracts the max, so none of this happens in the lab's model; it is what fp16 would do.`,
    threshold: FP16_EXP_OVERFLOW, probeRow: { layer: top.layer, head: top.head, max: top.rowMax, naiveSum: naive.l, naiveFinite: Number.isFinite(naive.l), expOfMax: round16(Math.exp(top.rowMax)), safeSum: safe.l, safeFinite: safe.p.every(Number.isFinite), overflowFactor: overflowFactor(top.row) }, heldOut: range,
    verdict: `The probe row's largest score is ${fx(top.rowMax, 3)}: e^${fx(top.rowMax, 2)} = ${fx(round16(Math.exp(top.rowMax)), 0)} in fp16, below 65504, and the naive fp16 sum is ${Number.isFinite(naive.l) ? fx(naive.l, 0) + ", finite" : "infinite"}; scaling those scores by ${fx(overflowFactor(top.row), 3)} would overflow it. On ${rows} held-out rows the largest score is ${fx(Math.max(...range.map((r) => r.max)), 3)} and ${range.reduce((a, r) => a + r.atOrOverFp16Overflow, 0)} of ${range.reduce((a, r) => a + r.count, 0)} scores reach ${fx(FP16_EXP_OVERFLOW, 2)}: each would be infinity in fp16 without the max subtracted, and its row's weights would become 0 or NaN. With the max subtracted the largest exp is 1.` };
}

function controlsBlock() {
  const x = [0.5, -1, 3, 2.5, 7, -4, 7.25, 1], on = onlineSoftmax(x), safe = safeSoftmax(x), broken = onlineSoftmax(x, { broken: true });
  const N = 256, d = 16, q = makeQKV(N, d, 3, 2), ref = reference(q.q, q.k, q.v, N, d, { Bc: 16 }), good = tiledAttention(q.q, q.k, q.v, N, d, { Bc: 16 }).o, one = Float32Array.from(good);
  one[100] += 1e-3;
  return { about: "Controls. vector: the online softmax of eight numbers against the two-pass safe one (largest difference in the weights), how often its max rose, and the running sum of the broken variant against the right one. checker (N 256, d 16, tiles of 16): the tiled float32 output passes; the exact answer rounded to float32 passes; one output moved by 0.001 fails with exactly one mismatch; zero tolerance rejects the float32 output, so the bound does work.",
    vector: { values: x, maxWeightDiff: Math.max(...on.p.map((p, i) => Math.abs(p - safe.p[i]))), maxRises: on.changes, sum: on.l, brokenSum: broken.l, trace: on.trace, brokenTrace: broken.trace },
    checker: { tiled: checkAttention(good, ref).ok, roundedReference: checkAttention(Float32Array.from(ref.o), ref).ok, oneOff: checkAttention(one, ref).mismatches, zeroTolerance: checkAttention(good, { ...ref, bound: ref.bound.map(() => 0) }).ok } };
}

function speedBlock(corr, seconds) {
  const slice = [], N = 1024, per = (e, n) => { const t = performance.now(); e.step(n); return (performance.now() - t) / n; };
  for (const d of DS) {
    const B = tileFor(d), G = Math.ceil(N / B), x = makeQKV(N, d, 1), u = createEmulation({ kind: "unfused", N, d, B, ...x }), f = createEmulation({ kind: "fused", N, d, B, ...x });
    const items = [["scores workgroup", per(u, G)], ["softmax row", per(u, N)], ["P V workgroup", per(u, G)], ["fused workgroup", per(f, G)]];
    for (const [item, ms] of items) slice.push({ item, N, d, B, msPerItem: ms, itemsPer40ms: Math.max(1, Math.floor(40 / ms)) });
  }
  return { about: "Milliseconds in Node (V8), one process at below-normal priority, on the fill machine's CPU. The emulator runs every multiply-add and exp in float32, so it is far slower than a GPU. slice: milliseconds per work item at N 1024 (each kernel's items timed together, first item included) and how many fit a 40 ms lab slice. runs: wall time of each full emulation in the correctness block. totals: milliseconds spent counting, emulating and building references over the fill; fillSeconds is the wall time.", slice, runs: corr.runs, totals: { ...cost }, fillSeconds: seconds };
}

function filmBlock(traffic, probe) {
  const pick = (d, kind) => NS.map((N) => { const r = traffic.rows.find((x) => x.N === N && x.d === d && x.kind === kind); return { N, bytes: r.globalBytes, scoreBytes: kind === "unfused" ? 16 * N * N : 0 }; });
  const top = probe.heads.reduce((a, b) => (b.rowMax > a.rowMax ? b : a)), P = probeQKV(MODEL, PROBE.words, top.layer, top.head);
  return { about: "What the films draw (the lighthouse and the cannery joined: the beam computes scores, the crew weighs and carries in one trip, and the unfused crew stacks the whole score table in the warehouse first). bars: global bytes per N for each path at d 16 and d 64, and the score table's share (16 N^2 bytes). table: the probe's full causal score table (rows are queries, keys up to each row) at the head with the largest score, from the model. sweep: row " + ROW + " at every layer and head walked in tiles of 4 keys, with the running max and running sum after each tile (the dial and the gauge); rises counts the tiles that raised the max (at the head with the largest score the max is found in the first tile and never moves, so the film should use a head whose dial turns). scoreBuffer: bytes of the N x N table at each N.",
    bars: { d16: { unfused: pick(16, "unfused"), fused: pick(16, "fused") }, d64: { unfused: pick(64, "unfused"), fused: pick(64, "fused") } },
    table: { layer: top.layer, head: top.head, words: PROBE.words, scores: Array.from({ length: P.T }, (_, i) => Array.from(P.scores.subarray(i * P.T, i * P.T + i + 1), (v) => round(v, 3))) },
    sweep: { row: ROW, tile: 4, heads: probe.heads.map((h) => ({ layer: h.layer, head: h.head, rises: h.trace.filter((t, i) => i > 0 && t.m > h.trace[i - 1].m).length, trace: h.trace })) }, scoreBuffer: NS.map((N) => ({ N, bytes: WORD * N * N })) };
}

function main() {
  const t0 = Date.now(), traffic = trafficBlock(), corr = correctnessBlock(), probe = probeBlock();
  const blocks = { sources: sourcesBlock(), traffic, correctness: { about: corr.about, rows: corr.rows, verdict: corr.verdict }, probe, overflow: overflowBlock(probe), controls: controlsBlock(), film: filmBlock(traffic, probe), lab: plan() };
  blocks.speed = speedBlock(corr, (Date.now() - t0) / 1000);
  const facts = {
    about: "Lesson K23, fused attention. Computed by tools/school/fill_fused.mjs from system/school/fused.mjs, fused-emu.mjs, fused-wgsl.mjs and the attention lab's trained model. Do not edit by hand. No GPU was used: every count is from the emulator, every error from a float32 emulation against float64. The WGSL kernels were validated by naga 30.0.1 on the CPU (no GPU) when this lesson was written; that is a compile check, not a run. Timings on a real GPU happen only in the lab, on the reader's device, labelled with their adapter.",
    modelSha256: createHash("sha256").update(RAW).digest("hex"), modelFile: "media/school/attention/model.json",
    sourceSha256: Object.fromEntries(["fused.mjs", "fused-emu.mjs", "fused-wgsl.mjs"].map((f) => [f, createHash("sha256").update(readFileSync(new URL(`../../system/school/${f}`, import.meta.url))).digest("hex")])),
    ...deep(blocks), seconds: 0,
  };
  facts.seconds = round((Date.now() - t0) / 1000, 1);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  console.log(JSON.stringify({ traffic: facts.traffic.verdict, correctness: facts.correctness.verdict, probe: facts.probe.verdict, overflow: facts.overflow.verdict, slice: facts.speed.slice, seconds: facts.seconds }, null, 1));
}

try { main(); } catch (e) { console.error("fill_fused failed:", e); process.exit(1); }
