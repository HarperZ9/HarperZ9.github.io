import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedger, faceTones, seriesFromMask, maskFromCoverage, easeOutQuad, DIAG, SPEC } from './ledger.js';

const series = [3, 5, 4, 8, 9, 2, 2, 7, 1, 6, 6, 10];

test('data, not chance: each entry sweeps by its value, up when it rose and down when it fell', () => {
  const g = createLedger({ series, cols: 12, rows: 6, maxLen: 4 }); g.finish();
  const e = g.entries;
  for (let k = 1; k < series.length; k++) {
    assert.deepEqual(e[k].d, series[k] >= series[k - 1] ? DIAG.up : DIAG.down, `entry ${k}`);
  }
  for (const a of e) for (const b of e) if (a.v > b.v) assert.ok(a.want >= b.want, 'a larger value never asks for a shorter sweep');
  for (const a of e) assert.ok(a.len <= a.want, 'the page edge can only shorten a sweep');
});

test('our motion spec: a reading-order cascade, each sweep easing out with quad (t50 0.293)', () => {
  const g = createLedger({ series, cols: 12, rows: 6, stagger: 0.05 });
  const e = g.entries; for (let k = 1; k < e.length; k++) assert.ok(Math.abs(e[k].t0 - e[k - 1].t0 - 0.05) < 1e-12);
  const a = e.find((x) => x.len >= 2);
  assert.ok(Math.abs(g.extent(a, a.t0 + a.dur / 2) - a.len * easeOutQuad(0.5)) < 1e-12);
  assert.ok(Math.abs(easeOutQuad(0.293) - 0.5) < 0.001);
});

test('our light, not measured tones: side faces follow Lambert from the declared light and change with it', () => {
  const t1 = faceTones(DIAG.up, [-0.45, -0.6, 0.66]), t2 = faceTones(DIAG.up, [0.6, 0.3, 0.74]);
  assert.notDeepEqual(t1, t2);
  for (const t of [t1, t2]) for (const v of Object.values(t)) assert.ok(v > 0 && v <= 1.6);
  // and never the reference's measured pair (0.9 and 0.6) for the default light
  assert.ok(Math.abs(t1.horizontal - 0.9) > 0.05 || Math.abs(t1.vertical - 0.6) > 0.05);
});

test('a word tallies its own letters: series from the mask columns, sweeps stay on the letters', () => {
  const w = 60, h = 20, cov = new Float32Array(w * h);
  for (let y = 4; y < 16; y++) for (let x = 0; x < w; x++) if ((x % 20) < 12) cov[y * w + x] = 1; // three blocks
  const cols = 30, rows = 10, mask = maskFromCoverage(cov, w, h, cols, rows), s = seriesFromMask(cov, w, h, cols);
  const g = createLedger({ series: s, cols, rows, mask }); g.finish();
  for (const e of g.entries) for (let k = 0; k <= e.len; k++) assert.ok(mask(e.i + e.d[0] * k, e.j + e.d[1] * k), `entry ${e.k} leaves the letters`);
});

test('deterministic, and the clock does not care about step size', () => {
  const a = createLedger({ series }), b = createLedger({ series });
  for (let i = 0; i < 120; i++) a.step(1 / 60); for (let i = 0; i < 240; i++) b.step(1 / 120);
  assert.equal(a.toSVG(10), b.toSVG(10));
  assert.ok(SPEC.inputs && SPEC.params && SPEC.determinism);
});

test('high values print a misregistered key ink; the loop restarts after a hold', () => {
  const g = createLedger({ series, cols: 12, rows: 6 }); g.finish();
  const keys = g.polygons().filter((p) => p.face === 'key');
  assert.equal(keys.length, g.entries.filter((e) => e.v > 0.8).length);
  g.step(g.period - (g.time % g.period) + 0.01); assert.ok(g.polygons().filter((p) => p.face === 'cap').length < g.entries.length);
});
