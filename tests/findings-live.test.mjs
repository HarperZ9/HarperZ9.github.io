// The live re-run for finding F310 (node --test tests/findings-live.test.mjs). The page's JavaScript must give the
// same doubles as the study's numpy code. Fixtures in tests/fixtures/findings-live hold draws and solver results
// written by numpy 2.4.5 as 64-bit patterns; findings/results/F310/result.json is the study's published file.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as G from "../world/site/findings-live/npgen.js";
import { nrm2 } from "../world/site/findings-live/fpx.js";
import { lstsq2, polyfit1 } from "../world/site/findings-live/lstsq2.js";
import { run } from "../world/site/findings-live/f310-kernel.js";
import { rowsOf } from "../world/site/findings-live/f310.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const fx = read("./fixtures/findings-live/npgen-20261036.json");
const ls = read("./fixtures/findings-live/lstsq-cases.json");
const other = read("./fixtures/findings-live/f310-other-seeds.json");
const pub = read("../findings/results/F310/result.json");
const rows = read("../findings/results/F310/systems.json").systems.map((s) => s.periods);
const SEED = 20261036;
const hx = (x) => G.f64ToBits(x).toString(16).padStart(16, "0");
const H = (h) => G.bitsToF64(BigInt("0x" + h));
const u64 = (v) => v.toString(16).padStart(16, "0");
const ar = (n) => Array.from({ length: n }, (_, i) => i);
const same = (got, want, what) => {
  assert.equal(got.length, want.length, `${what}: count`);
  for (let i = 0; i < want.length; i++) assert.equal(String(got[i]), String(want[i]), `${what}: element ${i}`);
};
const endState = (g, end, what) => {
  assert.equal(g.state.toString(16).padStart(32, "0"), end.state, `${what}: generator state after the draws`);
  assert.equal(g.has32, !!end.has_uint32, `${what}: buffered 32-bit half`);
};
const study = run(rows, SEED);

test("the fixture is for the study's seed and has the expected size", () => {
  assert.equal(fx.seed, SEED);
  assert.equal(fx.standard_normal.length, 20000);
  assert.equal(fx.permutation.length, 300);
  assert.equal(fx.choice.length, 300);
});

test("seeding equals numpy: SeedSequence pool, generated state and the PCG64 start state", () => {
  same(G.seedPool(SEED).map(Number), fx.seedseq_pool, "pool");
  same(G.seedState(G.seedPool(SEED)).map(u64), fx.seedseq_state_u64x4, "state words");
  assert.deepEqual(G.stateHex(G.genNew(SEED)), { state: fx.pcg64_seeded.state, inc: fx.pcg64_seeded.inc });
});

test("raw 64-bit output and uniform doubles equal numpy element for element", () => {
  let g = G.genNew(SEED);
  same(fx.raw_u64.map(() => u64(G.nextU64(g))), fx.raw_u64, "raw");
  g = G.genNew(SEED);
  same(fx.random.map(() => hx(G.nextDouble(g))), fx.random, "random");
});

test("20,000 standard normals and 240 scaled normals equal numpy bit for bit", () => {
  let g = G.genNew(SEED);
  same(fx.standard_normal.map(() => hx(G.standardNormal(g))), fx.standard_normal, "standard_normal");
  g = G.genNew(SEED);
  same(fx.normal_0_005.flat().map(() => hx(G.normal(g, 0, 0.05))), fx.normal_0_005.flat(), "normal");
  endState(g, fx.normal_end, "normal");
});

test("permutation, choice and bounded integers equal numpy element for element", () => {
  let g = G.genNew(SEED);
  same(fx.permutation.flatMap((p) => G.permutation(g, ar(p.length))), fx.permutation.flat(), "permutation");
  endState(g, fx.permutation_end, "permutation");
  g = G.genNew(SEED);
  same(fx.choice.flatMap((p) => G.choice(g, ar(fx.choice_pool), p.length)), fx.choice.flat(), "choice");
  endState(g, fx.choice_end, "choice");
  g = G.genNew(SEED);
  same(fx.integers_0_421.flatMap((p) => p.map(() => G.lemire32(g, 420))), fx.integers_0_421.flat(), "integers");
});

test("one stream used the way the study uses it (normals, shuffles, choices, shuffles, normals) equals numpy", () => {
  const g = G.genNew(SEED), got = [], want = [];
  for (const [kind, v] of fx.mixed) {
    want.push(...v);
    if (kind === "normal") got.push(...v.map(() => hx(G.normal(g, 0, 0.05))));
    else if (kind === "permutation") got.push(...G.permutation(g, ar(v.length)));
    else got.push(...G.choice(g, ar(fx.choice_pool), v.length));
  }
  same(got, want, "mixed");
  endState(g, fx.mixed_end, "mixed");
});

test("the vector norm, the two-column least-squares solve and the line fit equal numpy with OpenBLAS bit for bit", () => {
  assert.ok(ls.nrm2.length >= 400 && ls.lstsq.length >= 200 && ls.polyfit.length >= 200, "fixture size");
  for (const [i, [xs, r]] of ls.nrm2.entries()) assert.equal(hx(nrm2(xs.map(H), 0, xs.length)), r, `nrm2 case ${i}`);
  for (const [i, [a, b, y, w]] of ls.lstsq.entries()) {
    const m = a.length, got = lstsq2(a.map(H), b.map(H), y.map(H), m, m * 2.220446049250313e-16);
    assert.deepEqual([hx(got[0]), hx(got[1])], w, `lstsq case ${i} (${m} rows)`);
  }
  for (const [i, [x, y, c]] of ls.polyfit.entries()) {
    const m = x.length, got = polyfit1(x.map(H), y.map(H), m, new Array(m), new Array(m), new Array(m));
    assert.deepEqual([hx(got[0]), hx(got[1])], c, `polyfit case ${i} (${m} points)`);
  }
});

test("the run at seed 20261036 equals the study's result file digit for digit, for every number the run produces", () => {
  const A = ["n", "reg_plain", "reg_gapped", "loo_err", "loo_neigh", "loo_ratio", "plant_reg", "solar_r_plain", "solar_r_gapped", "n_planets"];
  assert.deepEqual(Object.keys(study.analysis).sort(), [...A].sort());
  let count = 0;
  for (const k of A) { assert.ok(Object.is(study.analysis[k], pub.analysis[k]), `analysis.${k}: ${study.analysis[k]} against ${pub.analysis[k]}`); count++; }
  assert.deepEqual(Object.keys(study.controls), ["C_order", "C_pool", "C_order_gapped"]);
  for (const c of Object.keys(study.controls)) {
    for (const s of ["n", "mean", "q95", "q05", "p_ge"]) {
      assert.ok(Object.is(study.controls[c][s], pub.controls[c][s]), `controls.${c}.${s}: ${study.controls[c][s]} against ${pub.controls[c][s]}`);
      count++;
    }
  }
  assert.equal(count, 25);
});

test("the numbers the run leaves out are exactly the six for the Blagg form", () => {
  const published = Object.keys(pub.analysis).length + Object.keys(pub.controls).length * 5;
  assert.equal(published, 31);
  assert.ok(!("reg_blagg" in study.analysis) && !("C_order_blagg" in study.controls));
  assert.ok("reg_blagg" in pub.analysis && "C_order_blagg" in pub.controls);
});

test("the page's table lists all 25 re-run numbers and every one equals the study file at the study's seed", () => {
  const t = rowsOf(study, pub);
  assert.equal(t.length, 25);
  assert.equal(new Set(t.map((r) => r[0])).size, 25, "labels are distinct");
  for (const [label, got, want] of t) assert.ok(Object.is(got, want), label);
  assert.equal(t.filter((r) => r[3]).length, 13, "numbers that depend on the seed");
});

test("a different seed gives different control draws and the same real scores", () => {
  const b = run(rows, 7);
  for (const k of ["reg_plain", "reg_gapped", "loo_err", "loo_neigh", "loo_ratio", "solar_r_plain", "solar_r_gapped"]) {
    assert.ok(Object.is(b.analysis[k], study.analysis[k]), `${k} does not depend on the seed`);
  }
  assert.notEqual(b.analysis.plant_reg, study.analysis.plant_reg);
  for (const c of ["C_order", "C_pool", "C_order_gapped"]) {
    const differ = b.nulls[c].filter((v, i) => v !== study.nulls[c][i]).length;
    assert.ok(differ > b.nulls[c].length * 0.9, `${c}: ${differ} of ${b.nulls[c].length} draws differ`);
    assert.notEqual(b.controls[c].mean, study.controls[c].mean);
  }
});

test("runs at two other seeds, one above 32 bits, equal numpy draw for draw", () => {
  assert.deepEqual(Object.keys(other.seeds), ["7", "1099511640121"]);
  for (const [seed, ref] of Object.entries(other.seeds)) {
    const r = run(rows, BigInt(seed));
    for (const k of ["plant_reg", "reg_plain", "reg_gapped"]) assert.equal(hx(r.analysis[k]), ref[k], `seed ${seed} ${k}`);
    for (const [c, want] of Object.entries(ref.controls)) {
      const bits = r.nulls[c].map(hx);
      assert.equal(bits.length, want.n);
      assert.deepEqual(bits.slice(0, 3), want.first, `seed ${seed} ${c}: first draws`);
      assert.equal(createHash("sha256").update(bits.join("")).digest("hex"), want.sha256, `seed ${seed} ${c}: all ${want.n} draws`);
    }
  }
});

test("the live files name no local drive path and make no outside request", () => {
  const dir = "../world/site/findings-live/";
  for (const f of ["f310.js", "f310.worker.js", "f310-kernel.js", "npgen.js", "fpx.js", "lstsq2.js"]) {
    const text = readFileSync(new URL(dir + f, import.meta.url), "utf8");
    assert.doesNotMatch(text, /[A-Z]:[\\/]/, `${f}: drive path`);
    assert.doesNotMatch(text, /https?:\/\//, `${f}: outside address`);
  }
});
