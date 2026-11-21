import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthesizePbrFromDepth } from '../world/site/surfaces/pbr-from-depth.mjs';

test('analytical hemisphere benchmark matches closed-form surface normal', () => {
  const w = 33, h = 33, cx = 16, cy = 16, R = 12;
  const depth = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const r2 = dx * dx + dy * dy;
      depth[y * w + x] = r2 < R * R ? Math.sqrt(R * R - r2) : 0;
    }
  }
  const res = synthesizePbrFromDepth(depth, w, h, { scale: 1.0, jumpThreshold: 4.0 });
  // At apex (16, 16), exact normal is (0, 0, 1) -> RGB (128, 128, 255)
  const apex = (cy * w + cx) * 4;
  assert.ok(Math.abs(res.normalRgba[apex] - 128) <= 1);
  assert.ok(Math.abs(res.normalRgba[apex + 1] - 128) <= 1);
  assert.equal(res.normalRgba[apex + 2], 255);

  // At (cx + 6, cy), dx = 6, R = 12 -> exact normal is (0.5, 0, sqrt(3)/2)
  const side = (cy * w + (cx + 6)) * 4;
  const nx = (res.normalRgba[side] / 255) * 2 - 1;
  const nz = (res.normalRgba[side + 2] / 255) * 2 - 1;
  assert.ok(Math.abs(nx - 0.5) < 0.03, `expected nx ~ 0.5, got ${nx}`);
  assert.ok(Math.abs(nz - Math.sqrt(3) / 2) < 0.03, `expected nz ~ 0.866, got ${nz}`);
});

test('discontinuity-aware gradient eliminates fake silhouette wall across foreground-background cliff', () => {
  const w = 16, h = 16;
  const depth = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      depth[y * w + x] = x < 8 ? 1.0 : 0.0;
    }
  }
  const res = synthesizePbrFromDepth(depth, w, h, { scale: 1.0, jumpThreshold: 0.25 });
  // On the flat foreground edge (x = 7, y = 8), one-sided derivative must stay flat (0, 0, 1)
  const edge = (8 * w + 7) * 4;
  assert.equal(res.normalRgba[edge], 128);
  assert.equal(res.normalRgba[edge + 2], 255);
  assert.equal(res.discontinuity[8 * w + 7], 255);
  assert.ok(res.stats.discontinuityFraction > 0.05);
});

test('8-direction HBAO darkens concave pit while 2nd-order curvature marks convex ridge', () => {
  const w = 15, h = 15, cx = 7, cy = 7;
  const pit = new Float32Array(w * h);
  const ridge = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      const bump = Math.exp(-r2 / 6.0);
      pit[y * w + x] = 1.0 - bump;
      ridge[y * w + x] = bump;
    }
  }
  const pitRes = synthesizePbrFromDepth(pit, w, h, { scale: 2.0, jumpThreshold: 2.0 });
  const ridgeRes = synthesizePbrFromDepth(ridge, w, h, { scale: 2.0, jumpThreshold: 2.0 });
  const center = cy * w + cx;
  assert.ok(pitRes.ao[center] < ridgeRes.ao[center], 'concave pit must have lower HBAO than convex ridge');
  assert.ok(ridgeRes.curvature[center] > 140, 'convex ridge must have positive curvature (>128)');
  assert.ok(pitRes.curvature[center] < 116, 'concave pit must have negative curvature (<128)');
});

test('pbr-from-depth.mjs is deterministic and has zero em dashes or local paths', () => {
  const depth = new Float32Array(25).fill(0.5);
  const a = synthesizePbrFromDepth(depth, 5, 5);
  const b = synthesizePbrFromDepth(depth, 5, 5);
  assert.equal(a.receipt, b.receipt);
  const src = readFileSync(new URL('../world/site/surfaces/pbr-from-depth.mjs', import.meta.url), 'utf8');
  assert.ok(!src.includes('\u2014'));
  assert.ok(!/[A-Za-z]:\\/.test(src));
});
