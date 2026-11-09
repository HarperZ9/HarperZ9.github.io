// QUALITY-SPEC S3 (determinism), S4 (budgets at named sizes) and S5 (full-size goldens: mean SSIM >= 0.995,
// worst 32 px tile >= 0.97) for the three generators, through the same renderers the page uses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scene, renderBase, render, mask, SPEC as CS } from './construct.js';
import { field, toRGBA as hamRGBA, inkRamp, SPEC as HS } from './hamming.js';
import { FITTED_VIEW } from './fixtures/pickover.js';
import { tiles, render as mosaic, SPEC as BS } from './bitmosaic.js';
import { makeState, sampleGrid, snapshot, advect, SPEC as OS } from './orbital.js';
import { splatOpaque, extentOf, VIEW, SPEC as RS } from './orbital-render.js';
import { surface, toRGBA, luma, hexLin, rng } from './raster.js';
import { goldenFull } from './goldencheck.mjs';

const H = mask(20, 24, (i, j) => (i < 5 || i >= 15 || (j >= 10 && j < 14)) ? 1 : 0);
const plate = (W, Hh, t = 2.5) => toRGBA(render(surface(W, Hh, hexLin('#07080b')), scene(W, Hh, [{ mask: H, square: 0 }], t)));
const S23 = makeState([{ n: 2, l: 0, m: 0, c: 1 }, { n: 3, l: 2, m: 0, c: 1, group: 1 }]);
const orb = (W, n = 20000) => { const P = sampleGrid(S23, n, rng(24)), s = snapshot(S23, P, 0), px = new Uint8ClampedArray(W * W * 4);
  splatOpaque(px, W, W, s.pos, s.w, VIEW, extentOf(P) * 0.8, W / 600, { vis: s.vis, dens: s.d, radius: 1.6, relief: 0.2 }); return px; };
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const ms = f => { const t0 = performance.now(); f(); return performance.now() - t0; };

test('S1, S2: every generator states inputs, parameters with units, a budget and an export', () => {
  for (const s of [CS, HS, OS, RS]) { assert.ok(s.inputs && s.params && s.determinism && s.budget); for (const v of Object.values(s.params)) assert.match(v, /\d|'|hex|rad|uint/); }
  for (const s of [CS, BS, RS]) assert.match(s.export, /3840/);
  for (const s of [BS]) assert.ok(s.inputs && s.params && s.budget);
});

test('S3: byte-identical pixels from the same inputs and seed', () => {
  assert.ok(same(plate(360, 240), plate(360, 240)));
  assert.ok(same(hamRGBA(field({ w: 300, h: 200, ...FITTED_VIEW }), inkRamp(11)), hamRGBA(field({ w: 300, h: 200, ...FITTED_VIEW }), inkRamp(11))));
  assert.ok(same(orb(200, 4000), orb(200, 4000)));
  const P = sampleGrid(S23, 500, rng(1)), Q = sampleGrid(S23, 500, rng(1)); advect(S23, P, 0, 3, 4); advect(S23, Q, 0, 3, 4); assert.ok(same(P, Q));
});

test('S4: budgets at named sizes (generous: this proves order of magnitude, not the device)', () => {
  const tb = ms(() => { const sc = scene(1440, 960, [{ mask: H, square: 0 }], 0); renderBase(surface(1440, 960), sc); });
  assert.ok(tb < 2500, `plate base 1440 x 960: ${tb.toFixed(0)} ms`);
  const th = ms(() => field({ w: 1440, h: 1080, ...FITTED_VIEW })); assert.ok(th < 150, `hamming 1440 x 1080: ${th.toFixed(0)} ms`);
  const P = sampleGrid(S23, 42000, rng(2)), s = snapshot(S23, P, 0), px = new Uint8ClampedArray(1442 * 1442 * 4);
  splatOpaque(px, 1442, 1442, s.pos, s.w, VIEW, 20, 2.4, { vis: s.vis, dens: s.d });   // warm
  const tp = ms(() => splatOpaque(px, 1442, 1442, s.pos, s.w, VIEW, 20, 2.4, { vis: s.vis, dens: s.d }));
  assert.ok(tp < 250, `orbital paint 1442 x 1442, 42k points: ${tp.toFixed(0)} ms`);
  console.log(`budgets measured: plate base ${tb.toFixed(0)} ms, hamming ${th.toFixed(0)} ms, orbital paint ${tp.toFixed(0)} ms`);
});

test('S5: full-size goldens pass mean SSIM 0.995 and worst tile 0.97', () => {
  for (const [name, px, w, h] of [['plate-H-480x320', plate(480, 320), 480, 320], ['hamming-ink-320x240', hamRGBA(field({ w: 320, h: 240, ...FITTED_VIEW }), inkRamp(11)), 320, 240], ['orbital-2s3d-300', orb(300), 300, 300]]) {
    const r = goldenFull(name, luma(px, w, h), w, h);
    assert.ok(r.created || r.pass, `${name}: mean ${r.mean} worst tile ${r.worst}`);
  }
});

test('S5 control: a one-cell change in the figure fails the full-size golden', () => {
  const H2 = mask(20, 24, (i, j) => (i < 5 || i >= 15 || (j >= 10 && j < 14) || (i === 9 && j === 2)) ? 1 : 0);
  const px = toRGBA(render(surface(480, 320, hexLin('#07080b')), scene(480, 320, [{ mask: H2, square: 0 }], 2.5)));
  const r = goldenFull('plate-H-480x320', luma(px, 480, 320), 480, 320);
  assert.equal(r.created, false); assert.equal(r.pass, false, `mean ${r.mean} worst ${r.worst}`);
});
