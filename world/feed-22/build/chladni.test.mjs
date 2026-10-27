import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gaussLegendre, legendre, jacobiEigen, solvePlate, modeGrid, modeAt, drivenAmplitude, modeAmplitude,
  membraneAmplitude, Sand, nodalConcentration, modeForValue, valueForMode, pitchRatio, sampleAmp,
} from './chladni.js';

const free = solvePlate({ N: 14 });
const clamped = solvePlate({ N: 12, edge: 'clamped' });

test('Gauss-Legendre integrates polynomials up to degree 2n-1 exactly', () => {
  const { x, w } = gaussLegendre(6);
  for (let k = 0; k <= 11; k++) {
    const got = x.reduce((s, xi, i) => s + w[i] * xi ** k, 0), want = k % 2 ? 0 : 2 / (k + 1);
    assert.ok(Math.abs(got - want) < 1e-12, `x^${k}: ${got} vs ${want}`);
  }
});

test('Legendre basis is orthonormal under quadrature', () => {
  const { x, w } = gaussLegendre(20), N = 8;
  const B = Array.from(x, (xi) => legendre(N, xi).v);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const s = B.reduce((a, b, q) => a + w[q] * b[i] * b[j], 0);
    assert.ok(Math.abs(s - (i === j ? 1 : 0)) < 1e-12);
  }
});

test('Jacobi recovers a known spectrum', () => {
  const { values } = jacobiEigen([[2, 1, 0], [1, 2, 1], [0, 1, 2]]);
  const want = [2 - Math.SQRT2, 2, 2 + Math.SQRT2];
  values.sort((a, b) => a - b).forEach((v, i) => assert.ok(Math.abs(v - want[i]) < 1e-10));
});

// Leissa, Vibration of Plates (NASA SP-160, 1969), free square plate, nu = 0.3, lambda = omega a^2 sqrt(rho h / D).
// The same values came out of an independent numpy Ritz solve in this study (frames/ notes in CLAIMS.md).
test('free square plate matches the published eigenvalues', () => {
  const want = [13.468, 19.596, 24.270, 34.801, 34.801, 61.093, 61.093, 63.686, 69.27, 77.17];
  want.forEach((v, i) => assert.ok(Math.abs(free.modes[i].lambda - v) / v < 0.002, `mode ${i + 1}: ${free.modes[i].lambda} vs ${v}`));
});

test('free plate has exactly three rigid-body modes', () => {
  const all = solvePlate({ N: 10, keepRigid: true });
  assert.equal(all.modes.filter((m) => m.lambda < 1e-3).length, 3);
});

test('clamped square plate matches the published eigenvalues', () => {
  [35.985, 73.394, 73.394, 108.22, 131.58, 132.20].forEach((v, i) => assert.ok(Math.abs(clamped.modes[i].lambda - v) / v < 0.002, `${clamped.modes[i].lambda} vs ${v}`));
});

test('clamped modes vanish on the rim, free modes do not', () => {
  for (const t of [-1, -0.3, 0.5, 1]) assert.ok(Math.abs(modeAt(clamped, clamped.modes[0].coef, 1, t)) < 1e-12);
  const edge = Math.max(...[-0.8, -0.2, 0.4, 0.9].map((t) => Math.abs(modeAt(free, free.modes[2].coef, 1, t))));
  assert.ok(edge > 0.05);
});

test('the first free mode is the twist: nodal lines on both centre axes', () => {
  const m = free.modes[0];
  assert.equal(m.cls, 'odd-x odd-y');
  for (const t of [-0.9, -0.4, 0.3, 0.8]) { assert.ok(Math.abs(modeAt(free, m.coef, 0, t)) < 1e-12); assert.ok(Math.abs(modeAt(free, m.coef, t, 0)) < 1e-12); }
  assert.ok(Math.abs(modeAt(free, m.coef, 0.7, 0.7)) > 0.2);
});

test('modes are mass-orthonormal', () => {
  const R = 161, g = [0, 1, 2, 5].map((k) => modeGrid(free, free.modes[k].coef, R)), h = (2 / (R - 1)) ** 2;
  const dot = (a, b) => { let s = 0; for (let iy = 0; iy < R; iy++) for (let ix = 0; ix < R; ix++) { const wx = ix === 0 || ix === R - 1 ? 0.5 : 1, wy = iy === 0 || iy === R - 1 ? 0.5 : 1; s += wx * wy * a[iy * R + ix] * b[iy * R + ix]; } return s * h; };
  assert.ok(Math.abs(dot(g[0], g[0]) - 1) < 0.01);
  assert.ok(Math.abs(dot(g[0], g[1])) < 0.01);
  assert.ok(Math.abs(dot(g[2], g[3])) < 0.01);
});

test('driving at a resonance reproduces that mode', () => {
  const k = 7, d = drivenAmplitude(free, free.modes[k].lambda, { R: 64 }), m = modeAmplitude(free, k, 64);
  let sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0; const n = d.amp.length;
  for (let p = 0; p < n; p++) { sa += d.amp[p]; sb += m.amp[p]; }
  for (let p = 0; p < n; p++) { const a = d.amp[p] - sa / n, b = m.amp[p] - sb / n; sab += a * b; saa += a * a; sbb += b * b; }
  assert.ok(sab / Math.sqrt(saa * sbb) > 0.97);
  assert.equal(d.weights.indexOf(Math.max(...d.weights)), k);
});

test('sand finds the nodal lines by the walk alone', () => {
  const field = modeAmplitude(free, 2, 96), sand = new Sand(2500, { seed: 3 });
  const before = nodalConcentration(sand, field).ratio;
  for (let i = 0; i < 1200; i++) sand.step(field);
  const after = nodalConcentration(sand, field);
  assert.ok(before < 1.4, `uniform start should sit near 1, got ${before}`);
  assert.ok(after.ratio > 3, `sand should crowd the nodes, ratio ${after.ratio}`);
});

test('grains stay on the plate', () => {
  const field = modeAmplitude(free, 9, 64), sand = new Sand(800, { seed: 9 });
  for (let i = 0; i < 200; i++) sand.step(field, { hop: 0.2 });
  for (let i = 0; i < sand.n; i++) { assert.ok(Math.abs(sand.x[i]) <= 1); assert.ok(Math.abs(sand.y[i]) <= 1); }
});

test('same seed, same sand', () => {
  const field = modeAmplitude(free, 4, 48), a = new Sand(300, { seed: 11 }), b = new Sand(300, { seed: 11 });
  for (let i = 0; i < 50; i++) { a.step(field); b.step(field); }
  assert.deepEqual(Array.from(a.x), Array.from(b.x));
});

test('grains carry the text in reading order and walk home to spell it', () => {
  const homes = Array.from({ length: 50 }, (_, i) => [-0.9 + i * 0.036, 0.1]);
  const sand = new Sand(100, { seed: 5, text: 'finite', homes });
  assert.equal(sand.glyph.slice(0, 7).join(''), 'finitef');
  assert.ok(sand.meanHomeDistance() > 0.3);
  for (let i = 0; i < 120; i++) sand.spell();
  assert.ok(sand.meanHomeDistance() < 0.01);
  assert.throws(() => sand.setHomes([]), /no home points/);
});

test('data value to mode and back stays inside one bin', () => {
  const s = { lo: 0, hi: 100, kMin: 1, kMax: 21 };
  for (const v of [0, 7, 33, 50, 99, 100]) assert.ok(Math.abs(valueForMode(modeForValue(v, s), s) - v) <= 2.5);
  assert.equal(modeForValue(-50, s), 1); assert.equal(modeForValue(500, s), 21);
});

test('pitch ratio follows the plate eigenvalues, not the drum', () => {
  assert.ok(Math.abs(pitchRatio(free, 3) - 24.270 / 13.468) < 0.005);
  assert.ok(Math.abs(membraneAmplitude(1, 2, 45, 16).ratio - Math.sqrt(5 / 2)) < 1e-12);
});

test('membrane comparison has nodal lines on the rim and at thirds', () => {
  const m = membraneAmplitude(3, 3, 45, 91);
  assert.ok(sampleAmp(m, -1, 0.2) < 1e-6);
  assert.ok(sampleAmp(m, -1 / 3, 0.25) < 0.03);
});

test('bad edge names fail loudly', () => {
  assert.throws(() => solvePlate({ edge: 'simply' }), /edge must be/);
});
