// node --test system/media-engine/page.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { registerPlugin, knownPlugins } from "./page.mjs";
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
