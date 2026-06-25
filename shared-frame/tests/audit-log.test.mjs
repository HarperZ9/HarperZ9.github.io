// Node-side gate for the append-only audit trail (the storage half of the trust surface). The pure
// entry logic must: copy the certificate's verdict/oracle/criterion/evidence verbatim (never re-decide
// or fabricate); take the timestamp FROM THE CALLER (never a module-level clock); replay in stable
// append order; and expose no mutation path (append-only: add, never put/delete).
//
// Run: node --test shared-frame/tests/audit-log.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { normaliseEntry, orderEntries, openLog, DB_NAME, STORE } from "../audit-log.js";
import { buildCertificate, stringOracle, cognitiveOracle } from "../certificate.js";

// ---- the entry is a faithful, frozen copy of what the engine produced --------------------------------

test("normaliseEntry copies the certificate's verdict/oracle/criterion/evidence verbatim", () => {
  const cert = buildCertificate({ criterion: "quote:x", claim: "v", oracleVerdict: stringOracle("xyz", "x") });
  assert.equal(cert.verdict, "verified");
  const entry = normaliseEntry({ certificate: cert, timestamp: 1000, operatorAction: "accepted" });
  assert.equal(entry.criterion, "quote:x");
  assert.equal(entry.verdict, "verified");
  assert.equal(entry.oracle, cert.oracle);
  assert.equal(entry.certified, true);
  assert.equal(entry.operatorAction, "accepted");
  // evidence is carried as [k, v] string pairs, not invented.
  assert.ok(Array.isArray(entry.evidence) && entry.evidence.length > 0);
  for (const pair of entry.evidence) {
    assert.equal(pair.length, 2);
    assert.equal(typeof pair[0], "string");
    assert.equal(typeof pair[1], "string");
  }
});

test("normaliseEntry NEVER fabricates a verdict: an empty input degrades to unverifiable, not a pass", () => {
  const entry = normaliseEntry({});
  assert.equal(entry.verdict, "unverifiable");
  assert.equal(entry.certified, false);
  assert.equal(entry.criterion, null);
  assert.equal(entry.operatorAction, "");
  assert.deepEqual(entry.evidence, []);
});

test("the entry is frozen (append-only at the value level: no in-place mutation)", () => {
  const entry = normaliseEntry({ certificate: { verdict: "verified", criterion: "c" }, timestamp: 1 });
  assert.ok(Object.isFrozen(entry));
  // a stray write must not take effect (frozen object; strict mode would throw, sloppy silently ignores).
  try { entry.verdict = "refuted"; } catch (_) { /* strict-mode throw is also acceptable */ }
  assert.equal(entry.verdict, "verified");
});

// ---- the timestamp comes from the caller, never a module-level clock ---------------------------------

test("the timestamp is taken from the caller verbatim, not Date.now()", () => {
  const pinned = 1750000000000;
  const entry = normaliseEntry({ certificate: { verdict: "verified", criterion: "c" }, timestamp: pinned });
  assert.equal(entry.timestamp, pinned);
  // a string timestamp the caller already formatted is preserved as-is.
  assert.equal(normaliseEntry({ certificate: {}, timestamp: "2026-06-24T00:00:00Z" }).timestamp, "2026-06-24T00:00:00Z");
  // a missing timestamp is honest null, never a fabricated clock reading.
  assert.equal(normaliseEntry({ certificate: {} }).timestamp, null);
});

// ---- replay / list order is stable append order ------------------------------------------------------

test("orderEntries returns entries in ascending seq (append) order, stably", () => {
  const made = [
    { seq: 3, verdict: "refuted" },
    { seq: 1, verdict: "verified" },
    { seq: 2, verdict: "disputed" },
  ];
  const ordered = orderEntries(made);
  assert.deepEqual(ordered.map(e => e.seq), [1, 2, 3]);
  assert.deepEqual(ordered.map(e => e.verdict), ["verified", "disputed", "refuted"]);
});

test("orderEntries falls back to received order when no seq is present (stable)", () => {
  const made = [{ verdict: "a" }, { verdict: "b" }, { verdict: "c" }];
  assert.deepEqual(orderEntries(made).map(e => e.verdict), ["a", "b", "c"]);
  assert.deepEqual(orderEntries([]), []);
  assert.deepEqual(orderEntries(null), []);
});

test("orderEntries does not mutate its input array", () => {
  const made = [{ seq: 2 }, { seq: 1 }];
  const copy = made.slice();
  orderEntries(made);
  assert.deepEqual(made, copy);
});

// ---- the public API is append-only: no update/delete surface -----------------------------------------

test("openLog rejects without IndexedDB (node), proving it is the only browser-bound entry point", async () => {
  // In node there is no IndexedDB; openLog must reject cleanly, not throw synchronously or fake a store.
  await assert.rejects(() => openLog(), /IndexedDB/);
});

test("the module exposes append/replay/list but NO update or delete", async () => {
  // openLog resolves a handle in the browser; in node we assert the SHAPE the module promises by
  // inspecting the source-level export surface: only the append-only verbs are named.
  const mod = await import("../audit-log.js");
  const names = Object.keys(mod);
  assert.ok(names.includes("openLog"), "openLog is exported");
  assert.ok(names.includes("normaliseEntry"), "normaliseEntry is exported");
  assert.ok(names.includes("orderEntries"), "orderEntries is exported");
  // there is no destructive verb anywhere in the public surface.
  for (const bad of ["update", "remove", "delete", "put", "clear", "set"]) {
    assert.ok(!names.includes(bad), `no ${bad} in the public API (append-only)`);
  }
});

test("constants name the dedicated audit store (not shared with another surface)", () => {
  assert.equal(DB_NAME, "telos-audit");
  assert.equal(STORE, "certificates");
});

// ---- end-to-end shape: a disputed certificate round-trips into an entry faithfully -------------------

test("a disputed certificate normalises with its disputed verdict intact and both opinions in evidence", () => {
  const cert = buildCertificate({
    criterion: "quote:gamma",
    oracleVerdict: stringOracle("alpha beta", "gamma"),       // refuted
    surrogateVerdict: cognitiveOracle("verified", "model disagrees"),
  });
  assert.equal(cert.verdict, "disputed");
  const entry = normaliseEntry({ certificate: cert, timestamp: 42, operatorAction: "disputed" });
  assert.equal(entry.verdict, "disputed");
  assert.equal(entry.certified, true);
  const ev = Object.fromEntries(entry.evidence);
  assert.equal(ev.oracle_verdict, "refuted");
  assert.equal(ev.surrogate_verdict, "verified");
});
