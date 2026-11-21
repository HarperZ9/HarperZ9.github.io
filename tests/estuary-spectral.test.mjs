import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  gueRepulsiveOffsets,
  detectVortexPinch,
  discreteSpectralLift,
} from '../world/site/surfaces/estuary-spectral.mjs';

test('gueRepulsiveOffsets is deterministic and preserves level repulsion', () => {
  const a = gueRepulsiveOffsets(32, 77);
  const b = gueRepulsiveOffsets(32, 77);
  assert.deepEqual(a, b);
  assert.equal(a.positions.length, 32);
  assert.ok(a.minGapRatio > 0.15, `expected repulsive gap ratio > 0.15, got ${a.minGapRatio}`);
});

test('detectVortexPinch isolates localized vortex core over uniform shear', () => {
  const w = 16, h = 16;
  const vx = new Float64Array(w * h);
  const vy = new Float64Array(w * h);
  const cx = 8, cy = 8;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const r2 = dx * dx + dy * dy + 0.5;
      const swirl = Math.exp(-r2 / 3.0);
      vx[y * w + x] = -dy * swirl;
      vy[y * w + x] = dx * swirl;
    }
  }
  const pinch = detectVortexPinch(vx, vy, w, h, 2.5);
  assert.equal(pinch.pinchDetected, true);
  assert.equal(pinch.peakLocation.x, cx);
  assert.equal(pinch.peakLocation.y, cy);
  assert.ok(pinch.adaptiveCellFraction < 0.25, 'singularity locus stays sparse');
});

test('discreteSpectralLift uses O(sqrt(N)) lift stages and surfaces periodic multiplicity', () => {
  const seq = Array.from({ length: 64 }, (_, i) => (i % 8 === 0 ? 5 : 1));
  const res = discreteSpectralLift(seq);
  assert.equal(res.liftDepth, 8);
  assert.equal(res.dominantMultiplicity, 56);
  assert.ok(res.spectralEnergy.length === 8);
  assert.ok(Math.max(...res.spectralEnergy) > 0.4);
});

test('estuary-spectral.mjs has zero em dashes and zero local paths', () => {
  const src = readFileSync(new URL('../world/site/surfaces/estuary-spectral.mjs', import.meta.url), 'utf8');
  assert.ok(!src.includes('\u2014'));
  assert.ok(!/[A-Za-z]:\\/.test(src));
});
