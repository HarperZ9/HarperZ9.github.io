// node --test system/media-engine/page.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { registerPlugin, knownPlugins, conventionLoader } from "./page.mjs";
import { SLOTS, slotReady } from "./plugins/slots.mjs";
import { sourceIsAnimated } from "../studio-loop.js";

test("a reserved slot goes live only when a loader is registered under its pluginId", () => {
  assert.equal(slotReady("raw", knownPlugins()), false, "RAW starts as a slot");
  assert.equal(SLOTS.raw.backend, "wasm");
  assert.throws(() => registerPlugin("raw", null), /loader function/);
  registerPlugin("raw", async () => ({ id: "raw", version: "0.0.0", backends: ["wasm"], create() { return { frame() {}, dispose() {} }; } }));
  assert.equal(slotReady("raw", knownPlugins()), true);
  assert.equal(slotReady("no-such-slot", knownPlugins()), false);
});

test("the Studio's perception loop treats the Retro surface as animated unless it is static", () => {
  assert.equal(sourceIsAnimated("retro", { engineStatic: false }), true);
  assert.equal(sourceIsAnimated("retro", { engineStatic: true }), false);
  assert.equal(sourceIsAnimated("gallery", {}), false);
});

test("a plugin the table does not list yet loads by file convention, and only a safe id does", async () => {
  const asked = [];
  const fake = { id: "new-thing", version: "0.0.0", create() { return { frame() {}, dispose() {} }; } };
  const load = conventionLoader("new-thing", async (path) => { asked.push(path); return { newThing: fake }; });
  assert.equal(await load(), fake);
  assert.deepEqual(asked, ["./plugins/new-thing.mjs"]);
  const viaDefault = conventionLoader("other", async () => ({ default: fake }));
  assert.equal(await viaDefault(), fake);
  for (const bad of ["../core", "Retro", "a/b", "", "x.mjs", null]) assert.equal(conventionLoader(bad), null, String(bad));
  const missing = conventionLoader("absent", async () => { throw new TypeError("Failed to fetch dynamically imported module"); });
  await assert.rejects(missing(), /no loader for plugin absent/);
  const empty = conventionLoader("hollow", async () => ({}));
  await assert.rejects(empty(), /exports neither hollow nor a default/);
});
