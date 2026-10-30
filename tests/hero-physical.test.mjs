// Known answers for the home hero's measured optics (world/site/hero/spectra.js, built by
// scripts/build-hero-spectra.py from the materials library). The shader maths itself is checked on the GPU by
// tests/hero-physical.cjs. Run: node --test tests/hero-physical.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { SPECTRA } from "../world/site/hero/spectra.js";

const fresnel0 = (n) => ((n - 1) / (n + 1)) ** 2;

test("N-BK7 index at the helium d line is the SCHOTT catalogue value", () => {
  assert.ok(Math.abs(SPECTRA.check.n_bk7_587_56 - 1.5168) < 1e-4, SPECTRA.check.n_bk7_587_56);
});

test("N-BK7 reflects 4.2 % at normal incidence in every bin", () => {
  assert.ok(Math.abs(fresnel0(SPECTRA.check.n_bk7_587_56) - 0.0422) < 5e-5);
  for (const N of [8, 3]) for (const n of SPECTRA.layouts[N].n_bk7) { const R = fresnel0(n); assert.ok(R > 0.0415 && R < 0.0440, `${N} bins: ${R}`); }
});

test("dispersion order: glass and water bend blue more than red", () => {
  for (const N of [8, 3]) {
    const L = SPECTRA.layouts[N];
    for (let i = 1; i < N; i++) {
      assert.ok(L.lambda[i] > L.lambda[i - 1]);
      assert.ok(L.n_bk7[i] < L.n_bk7[i - 1], `BK7 bin ${i}`);
      assert.ok(L.n_water[i] < L.n_water[i - 1], `water bin ${i}`);
    }
  }
});

test("water absorbs red far more than blue, and alpha = 4 pi k / lambda matches the library", () => {
  const a = SPECTRA.layouts[8].alpha_water;
  assert.ok(a[7] > 20 * a[1], a.join(" "));
  assert.ok(a[6] > 0.4 && a[6] < 0.9, `alpha near 690 nm ${a[6]} per metre`);
  assert.ok(SPECTRA.check.alpha_water_lib_vs_4pik_over_lambda_max_rel < 1e-3);
});

test("bins integrate the equal-energy white to X = Y = Z = 1, and every light to Y = 1", () => {
  for (const N of [8, 3]) {
    const L = SPECTRA.layouts[N];
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(L.W.reduce((s, w) => s + w[c], 0) - 1) < 1e-4);
    for (const [k, S] of Object.entries(L.S)) assert.ok(Math.abs(S.reduce((s, v, i) => s + v * L.W[i][1], 0) - 1) < 1e-4, k);
  }
});

test("lights sit at their published colour temperatures", () => {
  const T = Object.fromEntries(Object.entries(SPECTRA.lights).map(([k, v]) => [k, v.cct_mccamy]));
  assert.ok(T.sodium >= 1900 && T.sodium <= 2200, `HPS ${T.sodium} K`);
  assert.ok(Math.abs(T.filament - 2700) < 30, `filament ${T.filament} K`);
  assert.ok(Math.abs(T.moon - 4100) < 150, `moon ${T.moon} K`);
});

test("negative control: a flat index would fail the dispersion check", () => {
  const flat = SPECTRA.layouts[8].n_bk7.map(() => 1.5168);
  assert.ok(!flat.every((n, i) => i === 0 || n < flat[i - 1]));
});
