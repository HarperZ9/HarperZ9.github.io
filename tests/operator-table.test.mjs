import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  OPERATORS,
  BIO_TRANSDUCERS,
  operatorById,
  transducerById,
  blendOperatorAndTransducer,
} from '../world/site/surfaces/operator-table.mjs';

test('operator table covers all six invariant structural operators and four bio-transducers', () => {
  assert.equal(OPERATORS.length, 6);
  assert.equal(BIO_TRANSDUCERS.length, 4);
  for (const tr of BIO_TRANSDUCERS) {
    assert.ok(operatorById(tr.operatorId), `${tr.id} links to a valid operator`);
  }
  assert.ok(transducerById('xylem-capillary'));
});

test('blendOperatorAndTransducer produces deterministic synchronized cross-medium recombination', () => {
  const a = blendOperatorAndTransducer('counterpoint', 'mycorrhizal-router', 0.45, 77, 'temporal-cadence');
  const b = blendOperatorAndTransducer('counterpoint', 'mycorrhizal-router', 0.45, 77, 'temporal-cadence');
  assert.equal(a.recombination.receipt.digest, b.recombination.receipt.digest);
  assert.ok(a.recombination.acoustic.freqsHz.length > 0);
  assert.ok(a.recombination.accessible.summary.length > 20);
  assert.equal(typeof a.metamer.isMetamer, 'boolean');
});

test('operator-table.mjs has zero em dashes and zero local paths', () => {
  const src = readFileSync(new URL('../world/site/surfaces/operator-table.mjs', import.meta.url), 'utf8');
  assert.ok(!src.includes('\u2014'), 'no em dashes');
  assert.ok(!/[A-Za-z]:\\/.test(src), 'no local Windows paths');
});
