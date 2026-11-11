// False-success controls: the ear must stay quiet on a clean render and must name every planted defect.
//   node --test system/site-music/controls.test.mjs        (about 90 seconds: it renders and listens 13 times)
import test from 'node:test';
import assert from 'node:assert/strict';
import { runControls, DEFECTS } from './controls.mjs';

test('the ear raises no flag on a clean excerpt and catches each of the twelve planted defects', (t) => {
  const { clean, rows } = runControls({ piece: 'low-tide', bars: 20, seed: 1 });
  assert.deepEqual(clean.flags.map((f) => f.id), [], 'a clean render must raise no flag');
  assert.equal(rows.length, DEFECTS.length); assert.ok(rows.length >= 10);
  for (const r of rows) { t.diagnostic(`${r.id}: ${r.caught ? 'caught' : 'MISSED'} by ${r.by.join(' | ') || 'nothing'}${r.also.length ? ` (also: ${r.also.join(', ')})` : ''}`); }
  const missed = rows.filter((r) => !r.caught).map((r) => r.id);
  assert.deepEqual(missed, [], 'every planted defect must raise the flag that names it');
  // the roughness lens on its own does not separate a layer played a semitone off from the clean render in this idiom
  // (ninth and thirteenth chords are rough by design); the per-layer chord fit is what catches it. Recorded so the hole stays visible.
  const tr = rows.find((r) => r.id === 'keys-transposed'); assert.ok(!tr.flags.includes('roughness'), 'if roughness starts catching a transposed layer, update the README, which says it does not');
});
