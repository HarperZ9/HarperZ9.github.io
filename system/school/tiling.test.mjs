// Tests for lesson K22, "Matmul tiling".
// Run: node --test system/school/tiling.test.mjs
// Each claim has a control that must fail, and the test asserts that it does.
// No GPU is used: the emulator runs the kernels in JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { wgsl, KINDS, makeMatrices, cpuReference, checkMatmul, emulate, createEmulation, closedForm, volkovWords, schedule, gamma } from "./tiling.mjs";

const FACTS_URL = new URL("../../media/school/tiling/facts.json", import.meta.url);
const COUNTS = ["globalLoads", "globalStores", "sharedLoads", "sharedStores", "barriers", "fma"];

test("naive and tiled kernels match the float64 reference within gamma_n sum |a||b|, and each other bit for bit when T divides n", () => {
  for (const n of [16, 64, 128]) {
    const { a, b } = makeMatrices(n, 2), ref = cpuReference(a, b, n), naive = emulate({ kind: "naive", n, T: 16, a, b });
    assert.ok(checkMatmul(naive.c, ref, n).ok, `naive n ${n}`);
    for (const T of [8, 16]) {
      const t = emulate({ kind: "tiled", n, T, a, b });
      assert.ok(checkMatmul(t.c, ref, n).ok, `tiled n ${n} T ${T}`);
      assert.deepEqual(Array.from(t.c), Array.from(naive.c), "same summation order k = 0 .. n - 1, so the same float32 bits");
    }
  }
  for (const n of [1, 13, 50]) {
    const { a, b } = makeMatrices(n, 4), ref = cpuReference(a, b, n);
    for (const T of [8, 16]) assert.ok(checkMatmul(emulate({ kind: "tiled", n, T, a, b }).c, ref, n).ok, `n ${n} not a multiple of T ${T}: padding with zeros`);
  }
});

test("the checker catches a missing barrier (stale tile) and a single element off by 1e-3; float32 rounding alone passes", () => {
  const n = 64, { a, b } = makeMatrices(n, 3), ref = cpuReference(a, b, n);
  for (const T of [8, 16]) {
    const s = checkMatmul(emulate({ kind: "stale", n, T, a, b }).c, ref, n);
    assert.equal(s.ok, false, `stale tile T ${T}`);
    assert.ok(s.mismatches > n * n * 0.9, `most outputs wrong (${s.mismatches})`);
  }
  const good = emulate({ kind: "tiled", n, T: 16, a, b }).c, one = Float32Array.from(good);
  one[777] += 1e-3;
  assert.equal(checkMatmul(one, ref, n).mismatches, 1, "one element off by 1e-3 is caught");
  const f32 = Float32Array.from(ref.c);
  assert.ok(checkMatmul(f32, ref, n).ok, "rounding the exact answer to float32 is within the bound");
  const tight = { c: ref.c, mag: ref.mag.map(() => 0) };
  assert.equal(checkMatmul(good, tight, n).ok, false, "a zero tolerance rejects the float32 kernel: the bound does real work");
  assert.ok(Math.abs(gamma(1024) / (1024 * 2 ** -24) - 1) < 1e-4, "gamma_n is n u to first order");
});

test("emulated counts equal the closed forms: naive global loads 2 n^3, tiled 2 n^3 / T, barriers 2 (n / T)^3", () => {
  for (const n of [32, 64, 128]) for (const T of [8, 16]) {
    const { a, b } = makeMatrices(n, 1);
    for (const kind of ["naive", "tiled"]) {
      const r = emulate({ kind, n, T, a, b }), cf = closedForm(kind, n, T);
      for (const k of COUNTS) assert.equal(r[k], cf[k], `${kind} n ${n} T ${T} ${k}`);
      assert.ok(Math.abs(r.intensity - cf.intensity) < 1e-12);
    }
  }
  assert.equal(closedForm("naive", 1024, 16).globalLoads, 2 * 1024 ** 3);
  assert.equal(closedForm("tiled", 1024, 16).globalLoads, (2 * 1024 ** 3) / 16);
  assert.equal(volkovWords(256, 256, 256, 16, 16), closedForm("tiled", 256, 16).globalLoads, "Volkov and Demmel's m n k (1/bn + 1/bm)");
  const wrong = closedForm("tiled", 64, 16), r = emulate({ kind: "tiled", n: 64, T: 8, ...makeMatrices(64, 1) });
  assert.notEqual(r.globalLoads, wrong.globalLoads, "counts at T 8 do not fit the T 16 closed form");
});

test("each element of A and B is read n times by the naive kernel and n / T times by the tiled one", () => {
  const n = 48, { a, b } = makeMatrices(n, 5);
  const naive = emulate({ kind: "naive", n, T: 16, a, b, trace: true }).trace, tiled = emulate({ kind: "tiled", n, T: 16, a, b, trace: true }).trace;
  assert.ok(naive.every((v) => v === n));
  assert.ok(tiled.every((v) => v === n / 16));
  const ragged = emulate({ kind: "tiled", n: 50, T: 16, ...makeMatrices(50, 5), trace: true });
  assert.ok(ragged.trace.every((v) => v === 4), "n 50 with T 16: four phases, each element read once per phase that covers it");
  assert.ok(ragged.fma > 50 ** 3, `padding costs multiply-adds by zero (${ragged.fma})`);
});

test("step-at-a-time emulation gives the same counts and C as one call", () => {
  const n = 80, { a, b } = makeMatrices(n, 6), one = emulate({ kind: "tiled", n, T: 8, a, b }), e = createEmulation({ kind: "tiled", n, T: 8, a, b });
  while (!e.done) e.step(7);
  const r = e.result();
  for (const k of COUNTS) assert.equal(r[k], one[k], k);
  assert.deepEqual(Array.from(r.c), Array.from(one.c));
});

test("WGSL strings: barriers where the guide puts them, bounds guards, shared tiles of T x T", () => {
  for (const k of KINDS) assert.match(wgsl(k, 16), /@compute @workgroup_size\(16, 16\)/);
  assert.equal((wgsl("tiled", 16).match(/workgroupBarrier\(\);/g) || []).length, 2);
  assert.equal((wgsl("stale", 16).match(/workgroupBarrier\(\);/g) || []).length, 1);
  assert.doesNotMatch(wgsl("naive", 16), /workgroup>/);
  assert.match(wgsl("tiled", 8), /var<workgroup> As: array<f32, 64>;/);
  assert.match(wgsl("tiled", 16), /if \(row < p\.n && ak < p\.n\)/);
  assert.match(wgsl("naive", 16), /a\[row \* p\.n \+ k\] \* b\[k \* p\.n \+ col\]/);
  assert.throws(() => wgsl("tiled", 32), /256/);
  assert.throws(() => wgsl("nope"));
  const sch = schedule(64, 16, 1, 2);
  assert.equal(sch.length, 4);
  assert.deepEqual(sch[3].aTile, { rows: [32, 47], cols: [48, 63] });
});

test("facts.json, when present, carries every block and agrees with the emulator", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  for (const sec of ["sources", "counts", "correctness", "controls", "speed", "film", "lab"]) assert.ok(f[sec].about.length > 60, sec);
  const row = f.counts.rows.find((x) => x.n === 64 && x.kind === "tiled" && x.T === 16), r = emulate({ kind: "tiled", n: 64, T: 16, ...makeMatrices(64, 1) });
  assert.equal(row.globalLoads, r.globalLoads);
  assert.ok(f.counts.rows.every((x) => x.matchesClosedForm));
  assert.ok(f.correctness.rows.every((x) => x.kind === "stale" ? !x.ok : x.ok));
});
