import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const indexPath = path.join(root, 'experiments', 'receipts', 'index.json');
const htmlPath = path.join(root, 'experiments', 'index.html');

function sha256Hex(buf) {
  return 'sha256:' + createHash('sha256').update(buf).digest('hex');
}

function verifyReceiptBytes(rawBuf, expectedSha256) {
  const actual = sha256Hex(rawBuf);
  if (actual !== expectedSha256) {
    return { ok: false, verdict: 'DRIFT', reason: `sha256 mismatch: expected ${expectedSha256}, got ${actual}` };
  }
  const text = rawBuf.toString('utf8');
  if (text.includes('\u2014') || text.includes('\u2013')) {
    return { ok: false, verdict: 'DRIFT', reason: 'em or en dash detected in public receipt' };
  }
  if (/[A-Za-z]:[\\/](?:dev|Users|Downloads|wt|library)/i.test(text)) {
    return { ok: false, verdict: 'DRIFT', reason: 'local filesystem path leaked in public receipt' };
  }
  const obj = JSON.parse(text);
  if (obj.schema !== 'engine-receipt/1') return { ok: false, verdict: 'UNVERIFIABLE', reason: 'unexpected schema' };
  if (obj.verdict !== 'MATCH') return { ok: false, verdict: obj.verdict || 'UNVERIFIABLE', reason: 'verdict not MATCH' };
  if (!/^sha256:[0-9a-f]{64}$/.test(obj.digests?.claim_sha256 || '')) {
    return { ok: false, verdict: 'UNVERIFIABLE', reason: 'invalid claim_sha256' };
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(obj.digests?.envelope_sha256 || '')) {
    return { ok: false, verdict: 'UNVERIFIABLE', reason: 'invalid envelope_sha256' };
  }
  if (!obj.null_or_control || obj.null_or_control.length < 20) {
    return { ok: false, verdict: 'UNVERIFIABLE', reason: 'missing null or planted-control disclosure' };
  }
  return { ok: true, verdict: 'MATCH', obj };
}

test('G9 live receipt-verified experiment table links only to verified engine-receipt/1 JSON files', () => {
  const manifest = JSON.parse(readFileSync(indexPath, 'utf8'));
  const html = readFileSync(htmlPath, 'utf8');
  assert.equal(manifest.schema, 'g9-experiment-receipt-ledger/1');
  assert.ok(Array.isArray(manifest.entries) && manifest.entries.length >= 16, 'expected at least 16 receipt-backed rows');
  assert.ok(html.includes('id="receipt-ledger"'), 'experiments/index.html must include #receipt-ledger');

  for (const row of manifest.entries) {
    const receiptHref = `/experiments/receipts/${row.file}`;
    assert.ok(html.includes(receiptHref), `experiments/index.html missing link to ${receiptHref}`);
    assert.ok(html.includes(row.claim_sha256.slice(0, 19)), `experiments/index.html missing claim digest prefix for ${row.id}`);

    const abs = path.join(root, 'experiments', 'receipts', row.file);
    const buf = readFileSync(abs);
    assert.equal(buf.length, row.bytes, `${row.file}: byte length mismatch`);
    const res = verifyReceiptBytes(buf, row.file_sha256);
    assert.equal(res.ok, true, `${row.file} failed verification: ${res.reason || ''}`);
    assert.equal(res.verdict, 'MATCH');
    assert.equal(res.obj.id, row.id);
    assert.equal(res.obj.digests.claim_sha256, row.claim_sha256);
    assert.equal(res.obj.digests.envelope_sha256, row.envelope_sha256);
  }
});

test('G9 receipt verifier rejects planted 1-byte tamper fail-closed with DRIFT', () => {
  const manifest = JSON.parse(readFileSync(indexPath, 'utf8'));
  const first = manifest.entries[0];
  const orig = readFileSync(path.join(root, 'experiments', 'receipts', first.file));
  const tampered = Buffer.from(orig);
  tampered[tampered.length - 2] = tampered[tampered.length - 2] ^ 0x01;
  const res = verifyReceiptBytes(tampered, first.file_sha256);
  assert.equal(res.ok, false);
  assert.equal(res.verdict, 'DRIFT');
});
