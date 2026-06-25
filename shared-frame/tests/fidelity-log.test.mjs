// Node-side gate for the append-only PERCEPTION-FIDELITY ledger (the storage half of the
// self-improvement loop). The pure entry logic must: coerce each metric to a finite number or honest
// null (never a fabricated score); take the timestamp FROM THE CALLER (never a module-level clock);
// reuse the shared stable append-order helper; and expose no mutation path (append-only).
//
// Run: node --test shared-frame/tests/fidelity-log.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { normaliseFidelityEntry, orderEntries, DB_NAME, STORE } from "../fidelity-log.js";

test("normaliseFidelityEntry coerces the three metrics + source + caller timestamp", () => {
  const e = normaliseFidelityEntry({ wpre: 1.8, pbe: 0.25, wpir: 0.93, source: "the Atelier / 2D", timestamp: 1750000000000 });
  assert.equal(e.wpre, 1.8);
  assert.equal(e.pbe, 0.25);
  assert.equal(e.wpir, 0.93);
  assert.equal(e.source, "the Atelier / 2D");
  assert.equal(e.timestamp, 1750000000000);
});

test("a non-measurable metric is honest null, NEVER a fabricated score", () => {
  // pbe absent (no audio) must be null, not 0 (0 would falsely claim a perfect band match).
  const e = normaliseFidelityEntry({ wpre: 2.1, wpir: 0.9, source: "x", timestamp: 1 });
  assert.equal(e.pbe, null);
  // NaN / Infinity / non-numbers all degrade to null, never a made-up number.
  const e2 = normaliseFidelityEntry({ wpre: NaN, pbe: Infinity, wpir: "0.9", source: "x", timestamp: 1 });
  assert.equal(e2.wpre, null);
  assert.equal(e2.pbe, null);
  assert.equal(e2.wpir, null);   // a string is not a number -> null
});

test("the timestamp comes from the caller verbatim, not a clock; missing -> null", () => {
  assert.equal(normaliseFidelityEntry({ wpre: 1, timestamp: 42 }).timestamp, 42);
  assert.equal(normaliseFidelityEntry({ wpre: 1, timestamp: "2026-06-25T00:00:00Z" }).timestamp, "2026-06-25T00:00:00Z");
  assert.equal(normaliseFidelityEntry({ wpre: 1 }).timestamp, null);
});

test("the entry is frozen (append-only at the value level: no in-place mutation)", () => {
  const e = normaliseFidelityEntry({ wpre: 1, pbe: 2, wpir: 0.5, source: "x", timestamp: 1 });
  assert.ok(Object.isFrozen(e));
  try { e.wpre = 99; } catch (_) { /* strict-mode throw is acceptable */ }
  assert.equal(e.wpre, 1);
});

test("an empty input degrades to all-null metrics + empty source, never a pass", () => {
  const e = normaliseFidelityEntry({});
  assert.equal(e.wpre, null);
  assert.equal(e.pbe, null);
  assert.equal(e.wpir, null);
  assert.equal(e.source, "");
  assert.equal(e.timestamp, null);
});

test("orderEntries (reused from audit-log) replays in stable append (seq) order", () => {
  const a = { ...normaliseFidelityEntry({ wpre: 1, timestamp: 1 }), seq: 2 };
  const b = { ...normaliseFidelityEntry({ wpre: 2, timestamp: 2 }), seq: 1 };
  const ordered = orderEntries([a, b]);
  assert.equal(ordered[0].seq, 1);
  assert.equal(ordered[1].seq, 2);
});

test("the module names a distinct DB + store (does not collide with the certificate audit trail)", () => {
  assert.equal(DB_NAME, "telos-fidelity");
  assert.equal(STORE, "fidelity");
});
