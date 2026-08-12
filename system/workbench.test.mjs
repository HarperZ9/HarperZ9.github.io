import test from "node:test";
import assert from "node:assert/strict";
import { extendTrail, trailLine, SURFACES } from "./workbench.js";

test("trail extends immutably and caps its length", () => {
  const t0 = [];
  const t1 = extendTrail(t0, { surface: "retro", label: "Gold Ground, outrun" });
  assert.equal(t0.length, 0, "the original is untouched");
  assert.equal(t1.length, 1);
  let t = t1;
  for (let i = 0; i < 20; i++) t = extendTrail(t, { surface: "loom", label: "pass " + i });
  assert.ok(t.length <= 12, "capped");
  assert.equal(t[t.length - 1].label, "pass 19", "newest entries survive the cap");
});

test("trail line reads as a journey with surface names resolved", () => {
  const t = extendTrail(extendTrail([], { surface: "retro", label: "Gold Ground" }), { surface: "loom", label: "jacquard, 240 ends" });
  const line = trailLine(t);
  assert.equal(line, "Retro Engine (Gold Ground) → The Loom (jacquard, 240 ends)");
  assert.equal(trailLine([]), "");
  assert.equal(trailLine(null), "");
});

test("labels are bounded and unknown surfaces pass through", () => {
  const t = extendTrail([], { surface: "elsewhere", label: "x".repeat(200) });
  assert.ok(t[0].label.length <= 60);
  assert.ok(trailLine(t).startsWith("elsewhere ("));
});

test("every send target carries label, href, and a legacy key", () => {
  for (const k of Object.keys(SURFACES)) {
    const s = SURFACES[k];
    assert.ok(s.label, k);
    if (s.legacyKey) assert.ok(s.href && s.href.includes(".html"), k + " is a target and needs an href");
  }
  assert.ok(SURFACES.gallery && !SURFACES.gallery.legacyKey, "gallery stays display-only");
});
