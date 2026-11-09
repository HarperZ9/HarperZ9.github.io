import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiles, render, count, side, codeAt, SPEC } from './bitmosaic.js';
import { surface, toRGBA, luma, hexLin } from './raster.js';
import { goldenFull } from './goldencheck.mjs';

// Two block letters side by side, 'e' (101) on the left and 'E' (69) on the right: codes one bit apart (32).
const W = 320, H = 160, mask = new Float32Array(W * H);
for (let y = 24; y < 136; y++) for (let x = 0; x < W; x++) if ((x >= 20 && x < 140) || (x >= 180 && x < 300)) mask[y * W + x] = 1;
const spans = [{ x0: 0, x1: 160, code: 101 }, { x0: 160, x1: 320, code: 69 }];

test('tile area falls linearly with the count; 0 bits fills the pitch', () => {
  assert.equal(side(0), 1);
  for (let h = 1; h <= 8; h++) assert.ok(side(h) < side(h - 1));
  const a = h => side(h) ** 2; assert.ok(Math.abs((a(0) - a(4)) - (a(4) - a(8))) < 1e-12);
});

test('the count is the bit distance of (column + code) and row', () => {
  assert.equal(count(5, 5, 0), 0);
  assert.equal(count(3, 0, 0), 2);
  assert.equal(count(0, 0, 101), 4);       // 101 = 0b1100101
  assert.equal(count(0, 0, 255, 8), 8);
});

test('letters one bit apart in code draw different fields', () => {
  const L = tiles(W, H, mask, spans, { pitch: 8 }).filter(t => t.inside && t.code === 101);
  const diff = L.filter(t => t.h !== count(t.i, t.j, 69)).length / L.length;
  assert.ok(L.length > 100 && diff > 0.2, `share of tiles that change: ${diff}`);
  assert.equal(codeAt(spans, 10), 101); assert.equal(codeAt(spans, 200), 69); assert.equal(codeAt(spans, 999), 0);
});

test('outside the letters the field runs on faint; inside it is full ink', () => {
  const L = tiles(W, H, mask, spans), S = render(surface(W, H, hexLin('#efe9de')), L), Lm = luma(toRGBA(S, { dither: false }), W, H);
  let inS = 0, nIn = 0, outS = 0, nOut = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (mask[y * W + x]) { inS += Lm[y * W + x]; nIn++; } else { outS += Lm[y * W + x]; nOut++; } }
  assert.ok(inS / nIn < 0.7 && outS / nOut > 0.85 && outS / nOut - inS / nIn > 0.2, `inside ${inS / nIn}, outside ${outS / nOut}`);
});

test('no mask: every tile is faint ground; deterministic to the byte', () => {
  const a = toRGBA(render(surface(160, 120, hexLin('#efe9de')), tiles(160, 120, null, [])));
  const b = toRGBA(render(surface(160, 120, hexLin('#efe9de')), tiles(160, 120, null, [])));
  assert.ok(a.every((v, i) => v === b[i]));
  assert.ok(tiles(160, 120, null, []).every(t => !t.inside && t.code === 0));
});

test('golden image: e and E in bits (mean SSIM 0.995, worst tile 0.97)', () => {
  const px = toRGBA(render(surface(W, H, hexLin('#efe9de')), tiles(W, H, mask, spans)));
  const r = goldenFull('bitmosaic-eE-320x160', luma(px, W, H), W, H);
  assert.ok(r.created || r.pass, `mean ${r.mean} worst ${r.worst}`);
});

test('SPEC names inputs, units and an export', () => { assert.match(SPEC.params.pitch, /px/); assert.match(SPEC.export, /3840/); });
