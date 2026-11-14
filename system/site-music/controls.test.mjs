// False-success controls: the ear must stay quiet on clean renders and must name every planted defect.
//   node --test system/site-music/controls.test.mjs        (about twelve minutes on one thread: it renders and listens twenty times)
// The defects are shared out over worker threads, one per processor up to four (CONTROLS_WORKERS sets the count; 1 is the
// old single thread). Every worker renders the two clean excerpts itself, so each defect is still heard against a clean
// render made in the same thread, and the clean excerpts of every worker must raise no flag.
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { DEFECTS } from './controls.mjs';

const WORKERS = Math.max(1, Math.min(DEFECTS.length, +(process.env.CONTROLS_WORKERS || Math.min(4, os.availableParallelism()))));
const share = (only) => new Promise((resolve, reject) => {
  const w = new Worker(new URL('./controls.worker.mjs', import.meta.url), { workerData: { seed: 1, only } });
  w.once('message', resolve); w.once('error', reject); w.once('exit', (code) => { if (code) reject(new Error(`a controls worker stopped with code ${code}`)); });
});

test('the ear raises no flag on the clean excerpts and catches each of the eighteen planted defects', async (t) => {
  const shares = Array.from({ length: WORKERS }, (_, k) => DEFECTS.filter((_, i) => i % WORKERS === k).map((d) => d.id));
  const parts = await Promise.all(shares.map(share)), clean = parts[0].clean, heard = new Map(parts.flatMap((p) => p.rows).map((r) => [r.id, r]));
  const rows = DEFECTS.filter((d) => heard.has(d.id)).map((d) => heard.get(d.id));
  for (const part of parts) for (const [id, r] of Object.entries(part.clean)) assert.deepEqual(r.flags.map((f) => f.id), [], `the clean ${id} excerpt must raise no flag`);
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
