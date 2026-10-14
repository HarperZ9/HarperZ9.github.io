import { test } from "node:test";
import assert from "node:assert/strict";
import { createPresets, PRESET_LIMIT } from "./studio-presets.js";

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test("a preset keeps a copy of the state under its name, newest first, and a name is replaced", () => {
  const p = createPresets({ storage: memory(), now: () => 1 });
  const st = { seed: "a" };
  p.save("gallery", "  Night   drive ", st);
  st.seed = "changed";
  p.save("gallery", "Other", { seed: "b" });
  p.save("gallery", "Night drive", { seed: "c" });
  const l = p.list("gallery");
  assert.deepEqual(l.map((x) => x.name), ["Night drive", "Other"]);
  assert.deepEqual(l[0].state, { seed: "c" });
});

test("no name or no state is refused; the list is capped; remove works; blocked storage says so", () => {
  const p = createPresets({ storage: memory() });
  assert.equal(p.save("loom", "", { a: 1 }).ok, false);
  assert.equal(p.save("loom", "x", null).ok, false);
  for (let i = 0; i < PRESET_LIMIT + 5; i++) p.save("loom", "p" + i, { i });
  assert.equal(p.list("loom").length, PRESET_LIMIT);
  p.remove("loom", "p" + (PRESET_LIMIT + 4));
  assert.equal(p.list("loom")[0].name, "p" + (PRESET_LIMIT + 3));
  const blocked = createPresets({ storage: () => { throw new Error("blocked"); } });
  assert.deepEqual(blocked.save("loom", "x", {}).reason, "blocked");
});

test("all() and putAll() carry presets between browsers for known sources only", () => {
  const a = createPresets({ storage: memory() });
  a.save("sketch", "one", { s: 1 });
  const b = createPresets({ storage: memory() });
  assert.deepEqual(b.putAll({ ...a.all(["sketch"]), nope: [{ name: "x", state: {} }] }, ["sketch"]), ["sketch"]);
  assert.deepEqual(b.list("sketch")[0].state, { s: 1 });
});
