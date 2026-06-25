// creative.test.mjs: the creative organ - deterministic, reproducible, witnessed designs.
// Run: node --test system/discovery/creative.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { harmonograph, rose, toSVG, pathHash, phyllotaxis } from "./creative.js";
import { verifyArtifact } from "./io-protocol.js";
import { creativeVerifiers, designArtifact } from "./creative-io.js";

test("generators are deterministic and content-addressable", () => {
  assert.equal(pathHash(harmonograph()), pathHash(harmonograph()));    // same params -> same design
  assert.notEqual(pathHash(rose({ k: 5 })), pathHash(rose({ k: 6 }))); // different params -> different design
});

test("toSVG emits a plotter-ready vector (mm page, single path)", () => {
  const svg = toSVG(phyllotaxis(), { width: 200, height: 200 });
  assert.ok(svg.includes("<svg") && svg.includes("<path") && svg.includes("mm"));
});

test("a design is a witnessed artifact a peer re-derives; tampering is caught", () => {
  const art = designArtifact("harmonograph", { f: [2, 3] });
  assert.equal(verifyArtifact(art, creativeVerifiers).matches, true);   // re-runs the generator, hash matches
  const tampered = { ...art, recheck: { ...art.recheck, params: { f: [2, 5] } } };
  assert.equal(verifyArtifact(tampered, creativeVerifiers).matches, false); // re-derived hash differs -> refused
});
