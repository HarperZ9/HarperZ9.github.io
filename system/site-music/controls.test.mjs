// False-success controls: the ear must stay quiet on clean renders and must name every planted defect.
//   node --test system/site-music/controls.test.mjs        (about twelve minutes: it renders and listens twenty times)
import test from 'node:test';
import assert from 'node:assert/strict';
import { runControls, DEFECTS } from './controls.mjs';

test('the ear raises no flag on the clean excerpts and catches each of the eighteen planted defects', (t) => {
  const { clean, rows } = runControls({ seed: 1 });
  for (const [id, r] of Object.entries(clean)) assert.deepEqual(r.flags.map((f) => f.id), [], `the clean ${id} excerpt must raise no flag`);
  assert.equal(rows.length, DEFECTS.length); assert.ok(rows.length >= 18);
  for (const r of rows) t.diagnostic(`${r.id}: ${r.caught ? 'caught' : 'MISSED'} by ${r.by.join(' | ') || 'nothing'}${r.also.length ? ` (also: ${r.also.join(', ')})` : ''}`);
  assert.deepEqual(rows.filter((r) => !r.caught).map((r) => r.id), [], 'every planted defect must raise the flag that names it');
  // The fast piece must read as calm: these are the numbers that hold it there.
  const d = clean['deep-current']; t.diagnostic(`deep-current, calm: loudness range ${d.level.lra.toFixed(1)} LU, roughness ${d.roughness.mean.toFixed(3)}, presence ${d.balance.presenceDb.toFixed(1)} dB, kit over harmony ${d.layers.drumsOverHarmony.toFixed(1)} LU, onsets ${d.time.onsetsPerSecond.toFixed(1)} per second`);
  // (the loudness range bound is for this short excerpt, a third of which is the staged introduction and the ending; the whole piece reads about 7 LU)
  assert.ok(d.level.lra < 14 && d.roughness.mean < 0.1 && Math.abs(d.balance.presenceDb) < 3 && d.layers.drumsOverHarmony < -3, 'drums under the harmony, a narrow loudness range, a gentle top');
  // The roughness hole, restated and kept visible. Roughness between layers rises when a layer is a semitone off, but by
  // too little to set a limit on: the clean reading and the transposed readings are recorded here, and the README says so.
  const cross = (id) => rows.find((r) => r.id === id).report.roughness.cross.mean, c0 = clean['low-tide'].roughness.cross.mean;
  t.diagnostic(`roughness between layers: clean ${c0.toFixed(4)}, bass a semitone high ${cross('stem-transposed').toFixed(4)}, piano a semitone high ${cross('keys-transposed').toFixed(4)}`);
  // Round five (2026-11-11): with the upright bass fitted to two recorded basses, a bass a semitone high no longer
  // reads rougher than the clean render (0.0564 against 0.0571 on seed 1). The planted defect is still caught, by
  // `roots` and `stem-bass` above. Roughness between layers is therefore asserted for the piano only.
  assert.ok(cross('keys-transposed') > c0, 'a transposed piano reads rougher than the clean render');
  assert.ok(cross('keys-transposed') < 1.5 * c0, 'if this separation grows past half again, set a limit and update the README, which says roughness does not catch it');
});
