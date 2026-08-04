// studio-shelf.test.mjs — the studio's memory: pins, dedup, refusal, and the travel file.
// Run: node --test system/studio-shelf.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { createShelf, STORAGE_KEY, THUMB_CAP } from "./studio-shelf.js";

// The Map-backed stand-in for localStorage. `failWrites` models a quota-full or disabled
// storage without needing a browser to fill 5 MB first.
function memStorage() {
  const m = new Map();
  const s = {
    failWrites: false,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (s.failWrites) throw new Error("QuotaExceededError (simulated)");
      m.set(k, String(v));
    },
    removeItem: (k) => { m.delete(k); },
  };
  return s;
}

const STAMP = "2026-08-04T12:00:00.000Z";
const fieldPin = (seed, extra = {}) => ({
  kind: "field", stamp: STAMP,
  recipe: { seed, study: "basin", register: "ink", density: 0.6, levels: 5 },
  ...extra,
});
const voxelPin = (seed, ops = []) => ({
  kind: "voxel", stamp: STAMP,
  recipe: { voxel: { study: "relic", seed, res: 48, tune: { a: 0.5, b: 0.25, c: 1 }, ops } },
});

test("add / list / get / remove / retitle round-trip, and persist across shelf instances", () => {
  const storage = memStorage();
  const shelf = createShelf({ storage });
  const a = shelf.add(fieldPin("aurora"));
  const b = shelf.add(voxelPin("relicseed", [{ op: "turn", dir: 1 }, { op: "edit", cellIndex: 40, faceId: 0, mode: "build" }]));
  assert.ok(a.ok && b.ok, "both pins land");
  assert.notEqual(a.id, b.id, "different creations get different ids");

  const listed = shelf.list();
  assert.equal(listed.length, 2);
  assert.equal(listed[0].id, b.id, "newest first");
  assert.equal(listed[1].title, "basin aurora", "auto title is study + seed");
  assert.equal(listed[0].recipe.voxel.ops.length, 2, "the ordered op log rides along, turn before edit");

  const rt = shelf.retitle(a.id, "the good one");
  assert.ok(rt.ok);
  assert.equal(shelf.get(a.id).title, "the good one");

  // A second shelf on the SAME storage must see everything: this is the persists-across-visits
  // promise, exercised the only way node can.
  const revisit = createShelf({ storage });
  assert.equal(revisit.list().length, 2, "pins survive a reload");
  assert.equal(revisit.get(a.id).title, "the good one", "so does the rename");

  assert.ok(shelf.remove(b.id).ok);
  assert.equal(shelf.get(b.id), null);
  assert.equal(createShelf({ storage }).list().length, 1, "the removal persisted too");
  assert.equal(shelf.remove(b.id).ok, false, "removing a ghost is refused, not ignored");
});

test("the same creation re-pinned lands on one id and updates in place", () => {
  const shelf = createShelf({ storage: memStorage() });
  const first = shelf.add(fieldPin("aurora"));
  shelf.retitle(first.id, "mine");
  // Same recipe, later stamp, different key order in the object literal — canonical JSON must
  // see through the ordering, and the stamp must not fork the id.
  const again = shelf.add({
    kind: "field", stamp: "2026-08-05T09:00:00.000Z",
    recipe: { levels: 5, density: 0.6, register: "ink", study: "basin", seed: "aurora" },
  });
  assert.equal(again.id, first.id, "one creation, one id");
  assert.equal(shelf.list().length, 1, "updated in place, not duplicated");
  assert.equal(shelf.get(first.id).stamp, "2026-08-05T09:00:00.000Z", "stamp refreshed");
  assert.equal(shelf.get(first.id).title, "mine", "the user's rename survives a re-pin");
});

test("a full shelf refuses a new pin and preserves what it holds", () => {
  const shelf = createShelf({ storage: memStorage(), maxPins: 2 });
  const a = shelf.add(fieldPin("one"));
  const b = shelf.add(fieldPin("two"));
  const c = shelf.add(fieldPin("three"));
  assert.equal(c.ok, false);
  assert.equal(c.why, "shelf full");
  assert.deepEqual(shelf.list().map((p) => p.id).sort(), [a.id, b.id].sort(), "nothing was dropped to make room");
  // But re-pinning something already shelved is an update, not a new pin — it must still work.
  assert.ok(shelf.add(fieldPin("two")).ok, "a full shelf still accepts a re-pin");
});

test("export / import round-trip is lossless", () => {
  const shelf = createShelf({ storage: memStorage() });
  shelf.add(fieldPin("aurora", { thumb: "data:image/png;base64,AAAA" }));
  shelf.add(voxelPin("relicseed", [{ op: "edit", cellIndex: 7, faceId: 2, mode: "paint" }]));
  shelf.add({ kind: "sketch", stamp: STAMP, recipe: { seed: "hand", sketch: { strokes: [[1, 2], [3, 4]], tool: "pen" } } });
  const out = shelf.exportJSON();

  const other = createShelf({ storage: memStorage() });
  const r = other.importJSON(out, { merge: false });
  assert.equal(r.ok, true);
  assert.equal(r.added, 3);
  assert.equal(r.skipped, 0);
  assert.deepEqual(other.list(), shelf.list(), "every pin, byte-identical after the trip");
  const vox = other.list().find((p) => p.kind === "voxel"); // list is newest-first: [0] is the sketch
  assert.deepEqual(vox.recipe.voxel.ops,
    [{ op: "edit", cellIndex: 7, faceId: 2, mode: "paint" }], "the voxel op log made the trip");
});

test("a tampered version is refused whole", () => {
  const shelf = createShelf({ storage: memStorage() });
  shelf.add(fieldPin("keep"));
  const good = JSON.parse(createShelf({ storage: memStorage() }).exportJSON());
  good.v = 2;
  const r = shelf.importJSON(JSON.stringify(good), { merge: true });
  assert.equal(r.ok, false);
  assert.equal(r.added, 0);
  assert.match(r.why, /version/, "the why names the version");
  assert.equal(shelf.list().length, 1, "the shelf was not touched");
});

test("a tampered recipe is refused whole: the id must match its content", () => {
  const donor = createShelf({ storage: memStorage() });
  donor.add(fieldPin("aurora"));
  donor.add(fieldPin("borealis"));
  const env = JSON.parse(donor.exportJSON());
  env.pins[1].recipe.seed = "edited-after-export"; // id now lies about the recipe
  const shelf = createShelf({ storage: memStorage() });
  const r = shelf.importJSON(JSON.stringify(env), { merge: false });
  assert.equal(r.ok, false);
  assert.match(r.why, /pin 2/, "the why points at the offending pin");
  assert.equal(shelf.list().length, 0, "no half-import: even the intact pin 1 stayed out");
});

test("merge skips duplicates and reports honest counts", () => {
  const donor = createShelf({ storage: memStorage() });
  donor.add(fieldPin("shared"));
  donor.add(fieldPin("only-in-file"));
  const file = donor.exportJSON();

  const shelf = createShelf({ storage: memStorage() });
  shelf.add(fieldPin("shared"));
  shelf.add(fieldPin("only-on-shelf"));
  const r = shelf.importJSON(file, { merge: true });
  assert.equal(r.ok, true);
  assert.equal(r.added, 1, "only the pin the shelf lacked");
  assert.equal(r.skipped, 1, "the duplicate was counted, not silently eaten");
  assert.equal(shelf.list().length, 3);
});

test("a storage write failure reports { ok: false } and leaves memory uncorrupted", () => {
  const storage = memStorage();
  const shelf = createShelf({ storage });
  const a = shelf.add(fieldPin("safe"));
  assert.ok(a.ok);

  storage.failWrites = true;
  const b = shelf.add(fieldPin("doomed"));
  assert.equal(b.ok, false);
  assert.match(b.why, /storage/, "the why says storage refused");
  assert.equal(shelf.list().length, 1, "the failed pin is NOT in the list — no lying about persistence");
  assert.equal(shelf.list()[0].recipe.seed, "safe", "and the surviving pin is intact");

  // When storage recovers, the shelf works again from a consistent state.
  storage.failWrites = false;
  assert.ok(shelf.add(fieldPin("doomed")).ok, "the same pin lands once storage recovers");
  assert.equal(createShelf({ storage }).list().length, 2, "and what persisted matches memory");
});

test("an oversized thumb is refused but the pin is kept, flagged thumbless", () => {
  const shelf = createShelf({ storage: memStorage() });
  const r = shelf.add(fieldPin("aurora", { thumb: "data:image/png;base64," + "A".repeat(THUMB_CAP) }));
  assert.ok(r.ok, "the pin itself lands");
  assert.equal(r.thumbless, true, "and the caller is told the thumb did not");
  const pin = shelf.get(r.id);
  assert.equal(pin.thumb, null);
  assert.equal(pin.thumbless, true);
  // A modest thumb is stored as given.
  const small = shelf.add(fieldPin("borealis", { thumb: "data:image/png;base64,AAAA" }));
  assert.equal(shelf.get(small.id).thumb, "data:image/png;base64,AAAA");
});

test("validation refuses garbage instead of storing it", () => {
  const shelf = createShelf({ storage: memStorage() });
  const noKind = shelf.add({ stamp: STAMP, recipe: { seed: "x", study: "basin" } });
  assert.equal(noKind.ok, false);
  assert.match(noKind.why, /kind/);
  const badKind = shelf.add({ kind: "hologram", stamp: STAMP, recipe: { seed: "x" } });
  assert.equal(badKind.ok, false);
  assert.match(badKind.why, /unknown kind/);
  const noStamp = shelf.add({ kind: "field", recipe: { seed: "x", study: "basin" } });
  assert.equal(noStamp.ok, false, "the stamp is the caller's job — its absence is refused, not defaulted");
  const noSeed = shelf.add({ kind: "field", stamp: STAMP, recipe: { study: "basin" } });
  assert.equal(noSeed.ok, false, "a field pin without a seed cannot reproduce anything");
  const badEdit = shelf.add(voxelPin("s", [{ op: "edit", cellIndex: -1, faceId: 0, mode: "build" }]));
  assert.equal(badEdit.ok, false, "a negative cell index is not a real edit");
  assert.equal(shelf.list().length, 0, "none of it was stored");
});

test("ids are stable across processes: the hash of the canonical form, literally", () => {
  // This literal is the contract. If it changes, every shelf already exported by a visitor
  // stops round-tripping — so a failure here is a breaking change, not a test to update idly.
  const shelf = createShelf({ storage: memStorage() });
  const r = shelf.add({
    kind: "field", stamp: "2026-08-04T00:00:00.000Z",
    recipe: { seed: "aurora", study: "basin", register: "ink", density: 0.6, levels: 5 },
  });
  assert.equal(r.id, "881c1aa1");
});

test("junk fields do not fork the id, because normalization strips them before hashing", () => {
  const shelf = createShelf({ storage: memStorage() });
  const clean = shelf.add(fieldPin("aurora"));
  const noisy = shelf.add({
    kind: "field", stamp: STAMP,
    recipe: { seed: "aurora", study: "basin", register: "ink", density: 0.6, levels: 5,
      scrollY: 812, lastTab: "plotmaps" }, // UI state that hitched a ride
  });
  assert.equal(noisy.id, clean.id, "the ride-along state did not fork the creation's identity");
  assert.equal(shelf.list().length, 1);
  assert.equal(shelf.get(clean.id).recipe.scrollY, undefined, "and it was not stored either");
});

test("clear empties the shelf and the storage key", () => {
  const storage = memStorage();
  const shelf = createShelf({ storage });
  shelf.add(fieldPin("one"));
  shelf.add(fieldPin("two"));
  assert.ok(shelf.clear().ok);
  assert.equal(shelf.list().length, 0);
  assert.equal(storage.getItem(STORAGE_KEY), null, "nothing left behind under the key");
  assert.equal(createShelf({ storage }).list().length, 0, "a reload confirms it");
});

test("a corrupt pin in our own storage drops quietly; the rest of the shelf survives", () => {
  // Own-key loading is the one place we keep the good and drop the bad: torching a user's
  // whole shelf over one corrupt entry would destroy their work to punish our bug. Import
  // stays whole-or-nothing; this is deliberate asymmetry.
  const storage = memStorage();
  const shelf = createShelf({ storage });
  shelf.add(fieldPin("survivor"));
  shelf.add(fieldPin("victim"));
  const env = JSON.parse(storage.getItem(STORAGE_KEY));
  env.pins[0].recipe.seed = "bit-rot";
  storage.setItem(STORAGE_KEY, JSON.stringify(env));
  const reloaded = createShelf({ storage });
  assert.equal(reloaded.list().length, 1, "the broken pin was dropped");
  assert.equal(reloaded.list()[0].recipe.seed, "survivor", "the intact pin was kept");
});
