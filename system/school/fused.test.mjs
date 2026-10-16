// Tests for lesson K23, "Fused attention".
// Run: node --test system/school/fused.test.mjs
// Each claim has a control that must fail, and the test asserts that it does.
// No GPU is used: the emulator runs the WGSL kernels in JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { setPriority } from "node:os";
import { makeQKV, reference, checkAttention, tiledAttention, onlineSoftmax, safeSoftmax, naiveSoftmax, probeQKV, scoreRange, FP16_EXP_OVERFLOW, gamma } from "./fused.mjs";
import { emulate, createEmulation, closedForm, theta } from "./fused-emu.mjs";
import { wgsl, KERNELS, sharedBytes, tileFor } from "./fused-wgsl.mjs";
import { round16 } from "./precision.mjs";
import { fromJSON } from "./tinyformer.mjs";
import { PROBES, heldOut } from "./corpus.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const FACTS_URL = new URL("../../media/school/fused/facts.json", import.meta.url);
const M = JSON.parse(readFileSync(new URL("../../media/school/attention/model.json", import.meta.url), "utf8")), MODEL = fromJSON(M.weights);
const COUNTS = ["globalReads", "globalWrites", "fma", "exps", "barriers"];

test("online softmax equals the two-pass safe softmax; forgetting the rescale is wrong once the max rises", () => {
  const x = [0.5, -1, 3, 2.5, 7, -4, 7.25, 1];
  const on = onlineSoftmax(x), safe = safeSoftmax(x), broken = onlineSoftmax(x, { broken: true });
  assert.equal(on.m, safe.m);
  assert.ok(Math.abs(on.l - safe.l) < 1e-12 * safe.l);
  on.p.forEach((p, i) => assert.ok(Math.abs(p - safe.p[i]) < 1e-15));
  assert.equal(on.changes, 3, "the max rose at 3, 7 and 7.25");
  assert.ok(broken.l > 1.5 * on.l, `broken sum ${broken.l} against ${on.l}`);
  const flat = onlineSoftmax([9, 1, 2, 3], { broken: true }), flatOk = onlineSoftmax([9, 1, 2, 3]);
  assert.equal(flat.l, flatOk.l, "when the first value is the max the bug never shows");
  const f16 = naiveSoftmax([12, 0, 1], round16);
  assert.equal(f16.l, Infinity, "e^12 overflows fp16 without the max subtracted");
  assert.ok(f16.p.every((p) => p === 0 || Number.isNaN(p)));
  assert.ok(safeSoftmax([12, 0, 1], round16).p.every(Number.isFinite), "with the max subtracted every exp is at most 1");
  assert.equal(round16(Math.exp(FP16_EXP_OVERFLOW + 1e-12)), Infinity);
  assert.equal(round16(Math.exp(FP16_EXP_OVERFLOW - 1e-9)), 65504, "just below ln 65520 the exp rounds to the largest fp16");
});

test("tiled attention matches float64 softmax attention within the bound, causal or not, any tile; float64 tiles agree to 1e-12", () => {
  for (const [N, d] of [[64, 16], [100, 64], [33, 16]]) for (const causal of [false, true]) for (const Bc of [1, 8, 32]) {
    const { q, k, v } = makeQKV(N, d, 5, 2), ref = reference(q, k, v, N, d, { causal, Bc });
    assert.ok(checkAttention(tiledAttention(q, k, v, N, d, { Bc, causal }).o, ref).ok, `N ${N} d ${d} causal ${causal} Bc ${Bc}`);
    const o64 = tiledAttention(q, k, v, N, d, { Bc, causal, R: (x) => x }).o;
    o64.forEach((x, i) => assert.ok(Math.abs(x - ref.o[i]) <= 1e-12 * (ref.mag[i] + 1e-300), `float64 tiled ${i}`));
  }
});

test("the checker catches the broken rescale and a one-element error; zero tolerance rejects float32", () => {
  const N = 256, d = 16, { q, k, v } = makeQKV(N, d, 3, 2), ref = reference(q, k, v, N, d, { Bc: 16 });
  const good = tiledAttention(q, k, v, N, d, { Bc: 16 }).o, bad = checkAttention(tiledAttention(q, k, v, N, d, { Bc: 16, broken: true }).o, ref);
  assert.equal(bad.ok, false);
  assert.ok(bad.mismatches > 0.9 * N * d, `most outputs wrong (${bad.mismatches})`);
  const one = Float32Array.from(good);
  one[100] += 1e-3;
  assert.equal(checkAttention(one, ref).mismatches, 1);
  assert.equal(checkAttention(good, { ...ref, bound: ref.bound.map(() => 0) }).ok, false, "the bound does real work");
  assert.ok(checkAttention(Float32Array.from(ref.o), ref).ok, "the exact answer rounded to float32 passes");
  const single = makeQKV(32, 16, 4, 2), r1 = reference(single.q, single.k, single.v, 32, 16, { Bc: 32 });
  assert.ok(checkAttention(tiledAttention(single.q, single.k, single.v, 32, 16, { Bc: 32, broken: true }).o, r1).ok, "one tile per row: the broken rescale never runs, so it passes (a blind spot the film names)");
});

test("the model's own Q, K, V on the probe sentence: the tiled result and the model's attention both pass; the broken one fails", () => {
  const w = PROBES[0].words;
  for (const layer of [0, 1]) for (const head of [0, 1]) {
    const P = probeQKV(MODEL, w, layer, head), ref = reference(P.q, P.k, P.v, P.T, P.hd, { causal: true, Bc: 4 });
    assert.equal(P.T, 11);
    assert.ok(checkAttention(tiledAttention(P.q, P.k, P.v, P.T, P.hd, { Bc: 4, causal: true }).o, ref).ok, `tiled L${layer} H${head}`);
    assert.ok(checkAttention(P.ao, ref).ok, `the model's own attention output L${layer} H${head}`);
    assert.equal(checkAttention(tiledAttention(P.q, P.k, P.v, P.T, P.hd, { Bc: 4, causal: true, broken: true }).o, ref).ok, false, `broken L${layer} H${head}`);
    ref.rowMax.forEach((m, i) => assert.ok(Math.abs(m - Math.max(...P.scores.subarray(i * P.T, i * P.T + i + 1))) < 1e-5));
  }
  const range = scoreRange(MODEL, heldOut(32, 24).x, 32, 24);
  assert.equal(range.length, 4);
  assert.ok(range.every((r) => r.count === 32 * 300 && r.max > r.min));
});

test("the emulated kernels: unfused and fused pass the checker, fused is the tiled algorithm bit for bit, broken fails with more than one tile", () => {
  for (const d of [16, 64]) for (const N of [64, 130, 256]) {
    const B = tileFor(d), { q, k, v } = makeQKV(N, d, 2, 2), ref = reference(q, k, v, N, d, { Bc: B });
    const un = emulate({ kind: "unfused", N, d, B, q, k, v }), fu = emulate({ kind: "fused", N, d, B, q, k, v }), br = emulate({ kind: "broken", N, d, B, q, k, v });
    assert.ok(checkAttention(un.o, ref).ok, `unfused d ${d} N ${N}`);
    assert.ok(checkAttention(fu.o, ref).ok, `fused d ${d} N ${N}`);
    assert.deepEqual(Array.from(fu.o), Array.from(tiledAttention(q, k, v, N, d, { Bc: B }).o));
    assert.equal(checkAttention(br.o, ref).ok, N <= B, `broken d ${d} N ${N} B ${B}`);
  }
});

test("counts equal the closed forms; the unfused kernels move exactly 4 N^2 more floats; count-only walks agree", () => {
  for (const d of [16, 64]) for (const N of [64, 96, 256]) {
    const B = tileFor(d), x = makeQKV(N, d, 1);
    for (const kind of ["unfused", "fused"]) {
      const r = emulate({ kind, N, d, B, ...x }), c = emulate({ kind, N, d, B, compute: false }), cf = closedForm(kind, N, d, B);
      for (const key of COUNTS) assert.equal(r[key], cf[key], `${kind} N ${N} d ${d} ${key}`);
      for (const key of [...COUNTS, "sharedReads", "sharedWrites"]) assert.equal(c[key], r[key], `count-only ${kind} ${key}`);
    }
    const u = closedForm("unfused", N, d, B), f = closedForm("fused", N, d, B);
    assert.equal(u.globalReads + u.globalWrites - f.globalReads - f.globalWrites, 4 * N * N);
  }
  const big = emulate({ kind: "fused", N: 4096, d: 64, B: 32, compute: false });
  assert.equal(big.globalReads, closedForm("fused", 4096, 64, 32).globalReads);
  const t1 = theta(4096, 64, 2 * 32 * 64), t2 = theta(4096, 16, 2 * 128 * 16);
  assert.equal(closedForm("fused", 4096, 64, 32).globalReads - 4096 * 64, 4 * t1.flash, "2 G N d = 4 N^2 d^2 / M with M = 2 B d");
  assert.equal(closedForm("fused", 4096, 16, 128).globalReads - 4096 * 16, 4 * t2.flash);
  assert.notEqual(emulate({ kind: "fused", N: 256, d: 64, B: 16, compute: false }).globalReads, closedForm("fused", 256, 64, 32).globalReads, "counts at B 16 do not fit the B 32 form");
});

test("step-at-a-time emulation gives the same counts and O as one call", () => {
  const N = 200, d = 16, B = 64, x = makeQKV(N, d, 6);
  for (const kind of ["unfused", "fused"]) {
    const one = emulate({ kind, N, d, B, ...x }), e = createEmulation({ kind, N, d, B, ...x });
    while (!e.done) e.step(3);
    const r = e.result();
    for (const key of COUNTS) assert.equal(r[key], one[key]);
    assert.deepEqual(Array.from(r.o), Array.from(one.o));
  }
});

test("WGSL strings: tiles in workgroup memory within 16 KiB, barriers, the rescale present and absent", () => {
  assert.equal(tileFor(64), 32);
  assert.equal(tileFor(16), 128);
  for (const d of [16, 64]) for (const kind of KERNELS) assert.ok(sharedBytes(kind, { d, B: tileFor(d) }) <= 16384, `${kind} d ${d}`);
  const f = wgsl("fused", { d: 64, B: 32 }), b = wgsl("broken", { d: 64, B: 32 });
  assert.match(f, /var<workgroup> Ks: array<f32, 2048>;/);
  assert.match(f, /l = l \* alpha \+ ps;/);
  assert.doesNotMatch(b, /l = l \* alpha \+ ps;/);
  assert.match(b, /l = l \+ ps;/);
  assert.equal((f.match(/workgroupBarrier\(\);/g) || []).length, 2);
  assert.doesNotMatch(f, /binding\(4\)/, "the fused kernel has no score buffer");
  assert.match(wgsl("scores", { d: 16, B: 128 }), /s\[i \* p\.n \+ t \* B \+ j\] = x \* p\.scale;/);
  assert.match(wgsl("softmax", { n: 4096 }), /const PER: u32 = 16u;/);
  assert.throws(() => wgsl("fused", { B: 512 }), /256/);
  assert.throws(() => wgsl("nope"));
  for (const kind of KERNELS) assert.doesNotMatch(wgsl(kind), /DD|BB|PP/, "every placeholder filled");
});

test("facts.json, when present, carries every block and agrees with the emulator", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  for (const sec of ["sources", "traffic", "correctness", "probe", "overflow", "controls", "speed", "film", "lab"]) assert.ok(f[sec].about.length > 60, sec);
  const row = f.traffic.rows.find((x) => x.N === 1024 && x.d === 64 && x.kind === "fused");
  assert.equal(row.globalReads, closedForm("fused", 1024, 64, 32).globalReads);
  assert.ok(f.traffic.rows.every((x) => x.matchesClosedForm));
  assert.ok(f.correctness.rows.every((x) => (x.kind === "broken" ? x.ok === x.N <= x.B : x.ok)));
  assert.ok(Math.abs(gamma(64) / (64 * 2 ** -24) - 1) < 1e-5, "gamma_n is n u to first order");
  assert.ok(f.film.sweep.heads.length === 4 && f.film.sweep.heads.some((h) => h.rises > 0), "the film has a row whose running max moves");
});
