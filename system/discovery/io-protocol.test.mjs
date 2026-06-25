// io-protocol.test.mjs: the witnessed-artifact contract by which flagships exchange results. A peer
// re-verifies a Telos discovery by RE-RUNNING the check; a forged or drifted artifact does not reproduce
// and is rejected. Trust the proof, not the emitter. Run: node --test system/discovery/io-protocol.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTools } from "./tools.js";
import { sho } from "./systems.js";
import { verifyArtifact, isArtifact, emitArtifact, PROTOCOL, importArtifact, checkContent } from "./io-protocol.js";
import { telosVerifiers, conservationArtifact } from "./discovery-io.js";

const OPTS = { seed: 1, dt: 0.01, n: 1500, trials: 6, tol: 0.02 };
const ENERGY = "0.5*v^2 + 0.5*1.69*x^2";

test("a Telos discovery emits a witnessed artifact a peer re-verifies (trust the proof, not the emitter)", () => {
  const cert = makeTools(sho, OPTS).submit(ENERGY);
  assert.equal(cert.verdict, "verified");
  const art = conservationArtifact("sho", ENERGY, cert, OPTS);
  assert.equal(art.protocol, PROTOCOL);
  assert.ok(isArtifact(art));
  const v = verifyArtifact(art, telosVerifiers); // the peer re-runs the sound oracle
  assert.equal(v.reproduced, "verified");
  assert.equal(v.matches, true, JSON.stringify(v));
});

test("a forged / drifted artifact is caught: re-verification re-runs the physics and refutes it", () => {
  const forged = emitArtifact({
    flagship: "telos", kind: "conservation-law", claim: "Q = x",
    certificate: { verdict: "verified", certified: true },   // CLAIMS verified
    recheck: { verifier: "conservation", expr: "x", system: "sho", ...OPTS }, // but x is not conserved
  });
  const v = verifyArtifact(forged, telosVerifiers);
  assert.equal(v.ok, true);
  assert.equal(v.reproduced, "refuted");
  assert.equal(v.matches, false); // carried "verified" does not reproduce -> the peer rejects it
});

test("protocol guards: a non-artifact and an unregistered verifier are not trusted", () => {
  assert.equal(verifyArtifact({ foo: 1 }, telosVerifiers).ok, false);
  const art = conservationArtifact("sho", ENERGY, { verdict: "verified", certified: true }, OPTS);
  assert.equal(verifyArtifact(art, {}).ok, false); // no verifier in the registry -> not trusted
});

test("INGEST: an external tool's output becomes a witnessed, tamper-evident Telos artifact", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0 L10,10"/></svg>'; // e.g. a Blender / plotter export
  const art = importArtifact("blender", "vector-svg", svg, { tool: "blender" });
  assert.ok(isArtifact(art));
  assert.equal(checkContent(art, svg), true);        // the content in hand re-hashes -> intact + authentic
  assert.equal(checkContent(art, svg + " "), false); // any change is caught
});
