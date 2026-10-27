import { test } from 'node:test';
import assert from 'node:assert/strict';
import { popcount32, hamming, field, toRGBA, inkRamp, wordMatrix, blockHistogram } from './hamming.js';
import { PICKOVER_ESTIMATE, FITTED_VIEW } from './fixtures/pickover.js';
import { luma } from './raster.js';
import { golden } from './goldencheck.mjs';

// Independent reference: compare the binary strings digit by digit.
const naive = (a, b) => { const A = a.toString(2).padStart(32, '0'), B = b.toString(2).padStart(32, '0'); let d = 0; for (let i = 0; i < 32; i++) d += A[i] !== B[i]; return d; };

test('popcount matches a string count on 20000 pairs, edges included', () => {
  let s = 12345;
  const r = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0);
  for (const [a, b] of [[0, 0], [0xffffffff, 0], [0x80000000, 1], [0x55555555, 0xaaaaaaaa]]) assert.equal(hamming(a, b), naive(a, b));
  for (let i = 0; i < 20000; i++) { const a = r(), b = r(); assert.equal(hamming(a, b), naive(a, b)); }
  assert.equal(popcount32(0xffffffff), 32);
});

test('the field is a metric on the grid: zero diagonal, symmetric, triangle inequality', () => {
  const N = 64, f = field({ w: N, h: N, mod: 64 });
  for (let i = 0; i < N; i++) assert.equal(f[i * N + i], 0);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) assert.equal(f[y * N + x], f[x * N + y]);
  for (let a = 0; a < N; a += 3) for (let b = 0; b < N; b += 5) for (let c = 0; c < N; c += 7) assert.ok(hamming(a, c) <= hamming(a, b) + hamming(b, c));
});

test('a 2^k block holds C(k, h) * 2^k cells of each value', () => {
  for (const k of [3, 5, 7]) {
    const N = 2 ** k, f = field({ w: N, h: N, mod: 99 }), cnt = new Array(k + 1).fill(0);
    for (const v of f) cnt[v]++;
    assert.deepEqual(cnt, blockHistogram(k));
  }
});

test('mirroring X within a 2^k block complements the distance: h(2^k-1-x, y) = k - h(x, y)', () => {
  const k = 6, N = 2 ** k, a = field({ w: N, h: N, mod: 99 }), b = field({ w: N, h: N, x0: N - 1, sx: -1, mod: 99 });
  for (let i = 0; i < a.length; i++) assert.equal(b[i], k - a[i]);
});

test('window, scale and mod do what they say', () => {
  const f = field({ w: 4, h: 1, x0: 735, sx: -1, y0: 65 });
  assert.deepEqual([...f], [735, 734, 733, 732].map(x => hamming(x, 65) % 16));
  const s = field({ w: 8, h: 8, scale: 2, mod: 99 }), base = field({ w: 4, h: 4, mod: 99 });
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) assert.equal(s[y * 8 + x], base[(y >> 1) * 4 + (x >> 1)]);
  assert.ok(field({ w: 1024, h: 4, mod: 3 }).every(v => v < 3));
  assert.throws(() => field({ w: 0, h: 4 }), /bad size/);
  assert.throws(() => field({ w: 4, h: 4, op: 'nand' }), /unknown op/);
});

test('rendered pixels equal the palette entry of the exact value, every pixel', () => {
  const w = 96, h = 72, v = field({ w, h, ...FITTED_VIEW }), px = toRGBA(v, PICKOVER_ESTIMATE);
  for (let i = 0; i < v.length; i++) for (let c = 0; c < 3; c++) assert.equal(px[4 * i + c], PICKOVER_ESTIMATE[v[i] % PICKOVER_ESTIMATE.length][c]);
  assert.equal(new Set(Array.from({ length: v.length }, (_, i) => px[4 * i] * 65536 + px[4 * i + 1] * 256 + px[4 * i + 2])).size <= 11, true);
});

test('the fitted view and its mirror are complements in 10 bits', () => {
  const a = field({ w: 640, h: 480, ...FITTED_VIEW, mod: 99 }), b = field({ w: 640, h: 480, x0: 735, sx: -1, y0: 65, mod: 99 });
  for (let i = 0; i < a.length; i++) assert.equal(a[i] + b[i], 10);
});

test('ink ramp: lightness falls strictly with distance', () => {
  const r = inkRamp(11), L = r.map(c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]);
  for (let i = 1; i < L.length; i++) assert.ok(L[i] < L[i - 1]);
});

test('word matrix: a word against itself has a zero diagonal; case is one bit (32)', () => {
  const m = wordMatrix('insight', 'insight');
  m.forEach((row, i) => assert.equal(row[i], 0));
  assert.equal(wordMatrix('a', 'A')[0][0], 1);
  assert.equal(wordMatrix('insight', 'numbers').length, 7);
});

test('golden image: the fitted view in the ink ramp (SSIM >= 0.985)', () => {
  const w = 320, h = 240, px = toRGBA(field({ w, h, ...FITTED_VIEW }), inkRamp(11));
  const g = golden('hamming-fitted-ink', luma(px, w, h), w, h, { tw: 160 });
  assert.ok(g.created || g.pass, `ssim ${g.score}`);
});
