import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LAYERS, expectedCount, magnitude, flux, temperature, tint, colourIndex, cubeFace, faceDir } from "./stars.mjs";

const src = readFileSync(new URL("./scene.glsl.js", import.meta.url), "utf8");
const rng = (s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);

test("layer counts sit near the naked-eye star counts", () => {
  const c = LAYERS.map(expectedCount);
  // about 170 stars are brighter than magnitude 3, 1600 brighter than 5 and 9000 brighter than 6.5
  assert.ok(Math.abs(c[0] - 170) < 30, `to magnitude 3: ${c[0]}`);
  assert.ok(Math.abs(c[0] + c[1] - 1600) < 300, `to magnitude 5: ${c[0] + c[1]}`);
  assert.ok(Math.abs(c[0] + c[1] + c[2] - 9000) < 1500, `to magnitude 6.5: ${c[0] + c[1] + c[2]}`);
});
test("magnitude covers its range, rises with u, and follows the count law", () => {
  for (const l of LAYERS) {
    assert.ok(Math.abs(magnitude(0, l.m0, l.m1) - l.m0) < 1e-12); assert.ok(Math.abs(magnitude(1, l.m0, l.m1) - l.m1) < 1e-9);
    let last = -Infinity; for (let i = 0; i <= 100; i++) { const m = magnitude(i / 100, l.m0, l.m1); assert.ok(m >= last); last = m; }
  }
  // in [3, 5] the share of stars brighter than 4 is (10^0.5 - 1) / (10^1 - 1) = 0.2403
  const r = rng(7); let n = 0; const N = 200000; for (let i = 0; i < N; i++) if (magnitude(r(), 3, 5) < 4) n++;
  assert.ok(Math.abs(n / N - 0.2403) < 0.005, `share ${n / N}`);
  // planted defect: a uniform draw gives a half, and the same bound has to refuse it
  let u = 0; for (let i = 0; i < N; i++) if (3 + 2 * r() < 4) u++;
  assert.ok(Math.abs(u / N - 0.2403) > 0.005, "the bound cannot tell the count law from a uniform draw");
});
test("flux falls with magnitude and keeps the compressed Pogson ratio", () => {
  assert.ok(Math.abs(flux(2) - 4) < 1e-12);
  assert.ok(Math.abs(flux(1) / flux(6) - 10) < 1e-9, "five magnitudes are a factor of 10 on screen (100 in the sky)");
  for (let m = -1.5; m < 8; m += 0.25) assert.ok(flux(m) > flux(m + 0.25));
});
test("temperature matches known stars within 6 percent, and tint runs blue to orange", () => {
  // B-V and effective temperature: the Sun 0.65 and 5772 K, Vega 0.00 and 9600 K, Arcturus 1.23 and 4286 K. The kernel
  // draws B-V up to 1.5 only: past that the formula runs cool (3333 K at Betelgeuse's 1.85, against about 3600 K)
  for (const [bv, T] of [[0.65, 5772], [0.0, 9600], [1.23, 4286]]) assert.ok(Math.abs(temperature(bv) / T - 1) < 0.06, `${bv}: ${temperature(bv)}`);
  const hot = tint(-0.25), sun = tint(0.65), cool = tint(1.5);
  assert.ok(hot[2] > hot[0] && cool[0] > cool[2] && Math.abs(sun[0] - sun[2]) < 0.12);
  let last = -Infinity; for (let bv = -0.25; bv <= 1.5; bv += 0.05) { const t = tint(bv), rb = t[0] / t[2]; assert.ok(rb >= last - 1e-12); last = rb; assert.ok(Math.max(...t) <= 1 && Math.min(...t) > 0.3); }
  for (let h = 0; h <= 1; h += 0.1) { const bv = colourIndex(h); assert.ok(bv >= -0.25 && bv <= 1.5 + 1e-12); }
});
test("the cube map round-trips and keeps cells from pinching at the pole", () => {
  const r = rng(11);
  for (let i = 0; i < 20000; i++) {
    const z = 2 * r() - 1, a = 6.2831853 * r(), s = Math.sqrt(1 - z * z), e = [s * Math.cos(a), z, s * Math.sin(a)];
    const f = cubeFace(e), b = faceDir(f);
    assert.ok(f.face >= 0 && f.face <= 5 && Math.abs(f.u) <= 1 + 1e-12 && Math.abs(f.v) <= 1 + 1e-12);
    assert.ok(Math.hypot(b[0] - e[0], b[1] - e[1], b[2] - e[2]) < 1e-9);
  }
  // solid angle of a cell at a face centre against one at a face corner: 3^1.5 = 5.2. A latitude-longitude grid of
  // the same count has no bound: its cells shrink to nothing at the pole
  const n = 56, cell = (u, v) => { const a = faceDir({ face: 2, u, v }), b = faceDir({ face: 2, u: u + 2 / n, v }), c = faceDir({ face: 2, u, v: v + 2 / n });
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]); };
  const ratio = cell(0, 0) / cell(1 - 2 / n, 1 - 2 / n);
  assert.ok(ratio > 1 && ratio < 5.3, `centre to corner area ratio ${ratio}`);
});
test("the shader holds the same constants", () => {
  for (const l of LAYERS) assert.ok(src.includes(`starLayer(e, ${l.n.toFixed(1)}, ${l.m0.toFixed(1)}, ${l.m1.toFixed(1)}, ${l.occ.toFixed(2)}, px`), `layer ${l.n}`);
  for (const s of ["4600.0 * (1.0 / (0.92 * bv + 1.7) + 1.0 / (0.92 * bv + 0.62))", "4.0 * pow(10.0, -0.4 * 0.5 * (m - 2.0))", "vec3(0.62, 0.74, 1.0)", "vec3(1.0, 0.96, 0.9)", "vec3(1.0, 0.64, 0.36)", "-0.25 + 1.75 * pow(", "(m - 33.0) / 139.0", "(m - 172.0) / 114.0"]) assert.ok(src.includes(s), s);
});
