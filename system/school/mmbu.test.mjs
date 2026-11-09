// Lesson S20's computation, checked: numpy's random stream reproduced (values printed by numpy 2.5.3
// for default_rng(20261002)), two logbook intervals re-derived to the printed digits from the
// published per-row scores, and two controls that must not reproduce them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PCG64, seedSequence } from "./mmbu-rng.mjs";
import { devBootstrap, clusterBootstrap, devSeries, difference, quantile } from "./mmbu.mjs";
import { comparisons, binned, makeRun } from "./mmbu-lab-page.mjs";

const j = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const D = j("../../media/school/mmbu/data/dev_per_row.json"), H = j("../../media/school/mmbu/data/heldout_context_per_row.json"), K = j("../../media/school/mmbu/data/heldout_task_per_row.json"), F = j("../../media/school/mmbu/facts.json");

test("SeedSequence, PCG64 and integers(0, n) match numpy", () => {
  assert.deepEqual([...seedSequence(20261002, 8)], [0x5082f417, 0x134d808, 0x43e2dd23, 0x6c590516, 0x8c958aa0, 0xbc63d90f, 0x7c0e7e2f, 0x30679e68]);
  const p = new PCG64(20261002), hex = ([h, l]) => h.toString(16).padStart(8, "0") + l.toString(16).padStart(8, "0");
  assert.equal(hex(p.next64()), "23b3714ffd6217b1");
  assert.equal(hex(p.next64()), "1a3e518c1c60ec45");
  const q = new PCG64(20261002);
  assert.deepEqual(Array.from({ length: 12 }, () => q.bounded(3091)), [3059, 431, 342, 316, 1044, 667, 647, 2396, 861, 2838, 171, 2085]);
});

test("numpy's linear percentile", () => {
  assert.equal(quantile(Float64Array.from([1, 2, 3, 4]), 0.5), 2.5);
  assert.equal(quantile(Float64Array.from([0, 10]), 0.025), 0.25);
});

test("N4 re-derived to the logbook's digits from the per-row scores", () => {
  const bt = devBootstrap(difference(devSeries(D, "FT7_4B", "adjS"), devSeries(D, "FT3A_4B", "adjS")));
  bt.step(1e9);
  const r = bt.result(), N4 = F.ft7.N4;
  assert.deepEqual([r.mean, r.lo, r.hi], [N4.mean, N4.lo, N4.hi]);
});

test("the held-out vocabulary interval re-derived by cluster, to the digit", () => {
  const bt = clusterBootstrap(difference(H.context_harmonised.ft7_4b, H.context_harmonised.ft6_4b), H.group_rank);
  bt.step(1e9);
  const r = bt.result(), V = F.vocab.ft7minusFt6.harmonised;
  assert.deepEqual([r.mean, r.lo, r.hi], [V.mean, V.lo, V.hi]);
});

test("controls: another seed, or rows instead of clusters, do not give the printed digits", () => {
  const a = devBootstrap(difference(devSeries(D, "FT7_4B", "adjS"), devSeries(D, "FT3A_4B", "adjS")), { seed: 1 }); a.step(1e9);
  const ra = a.result(), N4 = F.ft7.N4;
  assert.notDeepEqual([ra.lo, ra.hi], [N4.lo, N4.hi]);
  assert.ok(Math.abs(ra.lo - N4.lo) < 0.002, "a different seed moves the bound only a little");
  const v = difference(H.context_harmonised.ft7_4b, H.context_harmonised.ft6_4b), b = devBootstrap(v); b.step(1e9);
  const rb = b.result(5), V = F.vocab.ft7minusFt6.harmonised;
  assert.ok(rb.hi - rb.lo < V.hi - V.lo, "resampling rows ignores the clusters and gives a narrower, wrong interval");
});

test("the fill recorded every recomputation as equal", () => {
  assert.equal(F.recomputedAll, true);
  assert.ok(F.recomputedCount >= 8);
});

test("the lab offers each comparison with its published line and bar", () => {
  const C = comparisons(F);
  assert.deepEqual(C.map((c) => c.key), ["M1", "K1", "N1", "N3", "N4", "N5", "VO", "VH"]);
  assert.deepEqual(C.find((c) => c.key === "N3").bar, { above: -0.01 });
  assert.equal(binned(Float64Array.from([0, 0.5, 0.99, 2]), 4, [0, 1], 2).reduce((s, k) => s + k, 0), 3);
});

test("every lab comparison builds its run and gives the published point estimate", () => {
  for (const c of comparisons(F)) {
    const bt = makeRun(c, { dev: D, context: H, task: K });
    bt.step(20);
    const r = bt.result(c.d);
    assert.equal(r.mean, c.published[0], c.key);
    assert.ok(Number.isFinite(r.lo) && Number.isFinite(r.hi), c.key);
  }
});
