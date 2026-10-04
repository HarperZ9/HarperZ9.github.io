// node --test system/studio-keep.test.mjs
// Work kept in this browser (studio-store.js) and the clock that decides when the readings fold
// (studio-readings.js). The browser half is tests/studio-shell.cjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, keepMessage, KEEP_SCHEMA, KEEP_PREFIX, KEEP_MAX_BYTES } from "./studio-store.js";
import { createMakingClock, QUIET_MS } from "./studio-readings.js";

function memoryStorage({ quota = Infinity } = {}) {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) {
      let used = 0; for (const [kk, vv] of m) if (kk !== k) used += vv.length;
      if (used + String(v).length > quota) { const e = new Error("full"); e.name = "QuotaExceededError"; throw e; }
      m.set(k, String(v));
    },
    removeItem: (k) => { m.delete(k); },
    raw: m,
  };
}
const blocked = () => { throw Object.assign(new Error("SecurityError"), { name: "SecurityError" }); };

test("a kept session comes back exactly, under a versioned key", () => {
  const storage = memoryStorage();
  const store = createStore({ storage, now: () => 1 });
  const state = { sketch: { v: 1, strokes: [[[0.1, 0.2], [0.3, 0.4]]] }, register: "drawn" };
  assert.deepEqual(store.save("sketch", state).ok, true);
  const doc = JSON.parse(storage.getItem(KEEP_PREFIX + "sketch"));
  assert.equal(doc.schema, KEEP_SCHEMA);
  assert.equal(doc.source, "sketch");
  assert.deepEqual(store.load("sketch").state, state);
  assert.deepEqual(store.load("fractal"), { state: null }, "another source has nothing kept");
});

test("an entry this version cannot read is set aside, never applied", () => {
  const storage = memoryStorage();
  const store = createStore({ storage });
  for (const raw of ["{not json", JSON.stringify({ schema: "studio.session/0", source: "sketch", state: {} }),
    JSON.stringify({ schema: KEEP_SCHEMA, source: "fractal", state: {} }), JSON.stringify({ schema: KEEP_SCHEMA, source: "sketch" })]) {
    storage.setItem(KEEP_PREFIX + "sketch", raw);
    assert.deepEqual(store.load("sketch"), { state: null, reason: "unreadable" });
    assert.equal(storage.getItem(KEEP_PREFIX + "sketch"), null, "the unreadable entry is removed");
  }
});

test("storage that throws is reported as blocked, and nothing throws to the page", () => {
  const store = createStore({ storage: blocked });
  assert.equal(store.available(), false);
  assert.deepEqual(store.save("sketch", { a: 1 }).reason, "blocked");
  assert.deepEqual(store.load("sketch"), { state: null, reason: "blocked" });
  assert.equal(store.clear("sketch"), false);
  const none = createStore({ storage: () => null });
  assert.equal(none.save("sketch", { a: 1 }).reason, "blocked");
});

test("a session over the cap is refused with its size, and the old entry stays", () => {
  const storage = memoryStorage();
  const store = createStore({ storage, maxBytes: 200 });
  assert.equal(store.save("sketch", { n: 1 }).ok, true);
  const r = store.save("sketch", { big: "x".repeat(400) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "too-large");
  assert.ok(r.bytes > r.max && r.max === 200);
  assert.deepEqual(store.load("sketch").state, { n: 1 });
  assert.match(keepMessage(r, "Sketch"), /^Not kept: Sketch is \d+ KB, over the 1 KB kept per source/);
  assert.equal(KEEP_MAX_BYTES, 262144);
});

test("a full browser store is reported as full", () => {
  const store = createStore({ storage: memoryStorage({ quota: 50 }) });
  assert.equal(store.save("sketch", { big: "y".repeat(100) }).reason, "full");
});

test("start fresh clears one source and leaves the rest", () => {
  const storage = memoryStorage();
  const store = createStore({ storage });
  store.save("sketch", { a: 1 }); store.save("fractal", { b: 2 });
  assert.equal(store.clear("sketch"), true);
  assert.deepEqual(store.load("sketch"), { state: null });
  assert.deepEqual(store.load("fractal").state, { b: 2 });
});

test("every outcome has words, and none is an empty string", () => {
  for (const r of [{ ok: true }, { ok: false, reason: "blocked" }, { ok: false, reason: "full" }, { ok: false, reason: "unreadable" },
    { ok: false, reason: "too-large", bytes: 300000, max: 262144 }]) {
    const m = keepMessage(r, "Sketch");
    assert.ok(m.length > 10, JSON.stringify(r));
    assert.doesNotMatch(m, /\u2014|\u2013/);
  }
});

test("making: a pointer held down is making, and so is the quiet time after the last action", () => {
  const c = createMakingClock();
  assert.equal(c.isMaking(0), false, "nothing yet");
  c.pointerDown(100);
  assert.equal(c.isMaking(100 + QUIET_MS * 10), true, "held down, however long");
  c.pointerUp(200);
  assert.equal(c.isMaking(200 + QUIET_MS - 1), true);
  assert.equal(c.isMaking(200 + QUIET_MS), false, "quiet for QUIET_MS after release ends it");
  c.action(10000);
  assert.equal(c.isMaking(10000 + QUIET_MS - 1), true);
  assert.equal(c.endsAt(), 10000 + QUIET_MS);
  c.reset();
  assert.equal(c.isMaking(10001), false, "a source switch ends the making");
  assert.equal(QUIET_MS, 4000);
});

test("making: a pointer-up with no pointer-down is not an action", () => {
  const c = createMakingClock();
  c.pointerUp(50);
  assert.equal(c.isMaking(51), false);
});
