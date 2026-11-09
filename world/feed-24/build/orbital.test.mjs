import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radial, ylm, laguerre, legendre, makeState, density, expectZ, sampleGrid, advect, stateName, energy, psi, snapshot } from './orbital.js';
import { weights, splatOpaque, extentOf, VIEW } from './orbital-render.js';
import { luma, rng } from './raster.js';
import { golden } from './goldencheck.mjs';

const Z10 = 128 * Math.SQRT2 / 243;    // <1s|z|2p0> in Bohr radii, closed form

test('Laguerre and Legendre agree with closed forms', () => {
  for (const x of [0, 0.7, 2.3]) {
    assert.ok(Math.abs(laguerre(2, 1, x) - (x * x / 2 - 3 * x + 3)) < 1e-12);
    assert.ok(Math.abs(legendre(2, 0, x / 3) - (3 * (x / 3) ** 2 - 1) / 2) < 1e-12);
    assert.ok(Math.abs(legendre(2, 2, x / 3) - 3 * (1 - (x / 3) ** 2)) < 1e-12);
    assert.ok(Math.abs(legendre(1, 1, x / 3) + Math.sqrt(1 - (x / 3) ** 2)) < 1e-12);   // Condon-Shortley
  }
});

test('radial functions are normalised and match the 1s and 2p closed forms', () => {
  for (const [n, l] of [[1, 0], [2, 0], [2, 1], [3, 2], [4, 3], [5, 4], [6, 4]]) {
    let s = 0; const R = 12 * n * n, N = 40000, dr = R / N;
    for (let i = 0; i < N; i++) { const r = (i + 0.5) * dr; s += radial(n, l, r) ** 2 * r * r * dr; }
    assert.ok(Math.abs(s - 1) < 1e-6, `R_${n}${l} norm ${s}`);
  }
  for (const r of [0.2, 1, 3]) {
    assert.ok(Math.abs(radial(1, 0, r) - 2 * Math.exp(-r)) < 1e-12);
    assert.ok(Math.abs(radial(2, 1, r) - r * Math.exp(-r / 2) / (2 * Math.sqrt(6))) < 1e-12);
  }
});

test('spherical harmonics are orthonormal on the sphere (l <= 3)', () => {
  const list = []; for (let l = 0; l <= 3; l++) for (let m = -l; m <= l; m++) list.push([l, m]);
  const nt = 64, np = 64;
  for (const [l1, m1] of list) for (const [l2, m2] of list) {
    let re = 0, im = 0;
    for (let j = 0; j < nt; j++) { const th = (j + 0.5) * Math.PI / nt, w = Math.sin(th) * (Math.PI / nt) * (2 * Math.PI / np);
      for (let k = 0; k < np; k++) { const ph = (k + 0.5) * 2 * Math.PI / np, [a, b] = ylm(l1, m1, Math.cos(th), ph), [c, d] = ylm(l2, m2, Math.cos(th), ph); re += (a * c + b * d) * w; im += (a * d - b * c) * w; } }
    const want = l1 === l2 && m1 === m2 ? 1 : 0;
    assert.ok(Math.abs(re - want) < 2e-3 && Math.abs(im) < 2e-3, `<${l1}${m1}|${l2}${m2}> = ${re}`);
  }
});

const S12 = makeState([{ n: 1, l: 0, m: 0, c: 1 }, { n: 2, l: 1, m: 0, c: 1, group: 1 }]);

test('beat: the 1s + 2p0 density returns after 2 pi / (E2 - E1) = 16.755 a.u.', () => {
  assert.ok(Math.abs(S12.period - 2 * Math.PI / (energy(2) - energy(1))) < 1e-12);
  assert.ok(Math.abs(S12.period - 16.7551608) < 1e-6);
  for (const p of [[0.3, 0.2, 1.1], [-1, 2, -0.5]]) assert.ok(Math.abs(density(S12, ...p, 0.7) - density(S12, ...p, 0.7 + S12.period)) < 1e-12);
});

test('<z>(t) by quadrature = (128 sqrt2 / 243) cos(dE t), and the norm is 1', () => {
  for (const f of [0, 0.25, 0.5]) {
    const q = expectZ(S12, f * S12.period);
    assert.ok(Math.abs(q.norm - 1) < 2e-3, `norm ${q.norm}`);
    assert.ok(Math.abs(q.z - Z10 * Math.cos(2 * Math.PI * f)) < 3e-3, `f ${f}: ${q.z}`);
  }
});

const meanZ = P => { let s = 0; for (let i = 2; i < P.length; i += 3) s += P[i]; return s / (P.length / 3); };

test('independent draws reproduce <z>(0) within 4 standard errors', () => {
  const P = sampleGrid(S12, 6000, rng(5)), m = meanZ(P);
  let v = 0; for (let i = 2; i < P.length; i += 3) v += (P[i] - m) ** 2;
  const se = Math.sqrt(v / 6000) / Math.sqrt(6000);
  assert.ok(Math.abs(m - Z10) < 4 * se, `mean ${m} se ${se}`);
});

test('flow keeps the ensemble on |psi(t)|^2: half a beat carries <z> from +0.745 to -0.745', () => {
  const P = sampleGrid(S12, 2500, rng(11)), z0 = meanZ(P);
  advect(S12, P, 0, S12.period / 2, 60);
  const z1 = meanZ(P);
  assert.ok(Math.abs(z0 - Z10) < 0.2 && Math.abs(z1 + Z10) < 0.2, `z0 ${z0} z1 ${z1}`);
  assert.ok(z0 - z1 > 1.1, `swing ${z0 - z1}`);
});

test('a stationary state does not flow; an m = 1 state circulates about z', () => {
  const S = makeState([{ n: 2, l: 1, m: 0, c: 1 }]), P = Float64Array.from([1, 0.5, 0.3, -2, 1, 1]);
  const Q = P.slice(); advect(S, Q, 0, 5, 10);
  for (let i = 0; i < P.length; i++) assert.ok(Math.abs(P[i] - Q[i]) < 1e-9);
  const C = makeState([{ n: 2, l: 1, m: 1, c: 1 }]), R = Float64Array.from([2, 0, 0.5]);
  const r0 = Math.hypot(R[0], R[1]); advect(C, R, 0, 2, 200);
  assert.ok(Math.abs(Math.hypot(R[0], R[1]) - r0) < 1e-3 && Math.abs(R[2] - 0.5) < 1e-6);
  assert.ok(Math.abs(Math.atan2(R[1], R[0]) - 2 / (r0 * r0)) < 1e-3);        // v_phi = m / rho, so phi = t / rho^2
});

test('names and errors', () => {
  assert.equal(stateName(makeState([{ n: 2, l: 0, m: 0, c: 1 }, { n: 3, l: 2, m: 0, c: 1 }])), '2s + 3d');
  assert.throws(() => makeState([{ n: 2, l: 2, m: 0 }]), /bad quantum numbers/);
  const [a, b] = psi(S12, 0, 0, 0, 0); assert.ok(Math.abs(a - Math.sqrt(0.5) / Math.sqrt(Math.PI)) < 1e-12 && Math.abs(b) < 1e-12);
});

test('colour key: group-1 share is 0 where only group 0 lives (the 2p0 node plane z = 0)', () => {
  const w = weights(S12, Float64Array.from([1, 0.4, 0, 0, 0, 3]), 0);
  assert.ok(w[0] < 1e-12 && w[1] > 0.5);
});

test('enclosure snapshot keeps the densest share and its colour stays in [0, 1]', () => {
  const S = makeState([{ n: 2, l: 0, m: 0, c: 1 }, { n: 3, l: 2, m: 0, c: 1, group: 1 }]), P = sampleGrid(S, 3000, rng(3)), s = snapshot(S, P, 0, 0.8);
  const kept = s.vis.reduce((a, v) => a + v, 0);
  assert.ok(Math.abs(kept / 3000 - 0.8) < 0.01, `kept ${kept}`);
  let minKept = Infinity, maxDropped = 0; for (let i = 0; i < 3000; i++) { if (s.vis[i]) minKept = Math.min(minKept, s.d[i]); else maxDropped = Math.max(maxDropped, s.d[i]); }
  assert.ok(minKept >= maxDropped);
  assert.ok(s.w.every(v => v >= 0 && v <= 1));
});

test('page renderer: the cloud fills its frame without pinholes and leaves the corners empty', () => {
  const S = makeState([{ n: 2, l: 0, m: 0, c: 1 }, { n: 3, l: 2, m: 0, c: 1, group: 1 }]), P = sampleGrid(S, 20000, rng(24)), s = snapshot(S, P, 0);
  const W = 300, H = 300, rgba = new Uint8ClampedArray(W * H * 4);
  splatOpaque(rgba, W, H, s.pos, s.w, VIEW, extentOf(P) * 0.8, 1, { vis: s.vis, dens: s.d, radius: 1.6, relief: 0.2 });
  const lit = (x, y) => rgba[4 * (y * W + x)] + rgba[4 * (y * W + x) + 1] + rgba[4 * (y * W + x) + 2] > 30;
  let c = 0, n = 0; for (let y = 130; y < 170; y++) for (let x = 110; x < 190; x++) { n++; c += lit(x, y); }
  assert.ok(c / n > 0.97, `centre coverage ${c / n}`);
  assert.ok(!lit(3, 3) && !lit(W - 4, H - 4));
});

test('golden image: 2s + 3d at t = 0 through the page renderer (SSIM >= 0.97)', () => {
  const S = makeState([{ n: 2, l: 0, m: 0, c: 1 }, { n: 3, l: 2, m: 0, c: 1, group: 1 }]);
  const P = sampleGrid(S, 20000, rng(24)), s = snapshot(S, P, 0), W = 300, H = 300, rgba = new Uint8ClampedArray(W * H * 4);
  splatOpaque(rgba, W, H, s.pos, s.w, VIEW, extentOf(P) * 0.8, 1, { vis: s.vis, dens: s.d, radius: 1.6, relief: 0.2 });
  const r = golden('orbital-2s3d-t0-opaque', luma(rgba, W, H), W, H, { tw: 120, min: 0.97 });
  assert.ok(r.created || r.pass, `ssim ${r.score}`);
});
