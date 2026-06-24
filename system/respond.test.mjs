// respond.test.mjs — node tests for the pure respond() function.
// Verifies: grounded values appear in answers, off-topic still grounds, different ctx → different text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { respond } from "./respond.js";

// A typical ctx with all fields populated.
function mkCtx(overrides = {}) {
  return {
    phash: "a1b2c3d4e5f60718",
    features: { contrast: 0.75, entropy: 0.60, balance: 0.55 },
    dominantColors: ["#3a7ca5", "#2ec4b6", "#ff9f1c"],
    hueName: "teal",
    edgeDensity: 0.18,
    motion: 0.12,  // Δ7/64 approx
    audio: null,
    sourceName: "2D fractal",
    width: 1024,
    height: 768,
    ...overrides,
  };
}

// ── basic sanity ──────────────────────────────────────────────────────────────

test("respond returns a non-empty string for every intent", () => {
  const ctx = mkCtx();
  const intents = [
    "what colours do you see?",
    "how is the structure?",
    "what is the contrast?",
    "is it moving?",
    "what should we try next?",
    "how do you know any of this?",
    "tell me a joke",
    "what do you see?",
    "how big is it?",
    "what's the balance like?",
    "do you hear anything?",
  ];
  for (const msg of intents) {
    const r = respond(msg, ctx);
    assert.ok(typeof r === "string" && r.length > 0, `Empty/non-string for: "${msg}"`);
  }
});

// ── intent-grounded values ────────────────────────────────────────────────────

test("colour intent includes the dominant hex and hue name", () => {
  const ctx = mkCtx();
  const r = respond("what colours do you see?", ctx);
  assert.ok(r.includes("#3a7ca5") || r.includes("teal"), `Expected colour or hue in: ${r}`);
});

test("structure intent references entropy value", () => {
  const ctx = mkCtx();
  const r = respond("how detailed is it?", ctx);
  // entropy is 0.60 → should appear as "0.60"
  assert.ok(r.includes("0.60"), `Expected entropy 0.60 in: ${r}`);
});

test("contrast intent references contrast value", () => {
  const ctx = mkCtx();
  const r = respond("what's the contrast like?", ctx);
  assert.ok(r.includes("0.75"), `Expected contrast 0.75 in: ${r}`);
});

test("motion intent references Δ value when moving", () => {
  const ctx = mkCtx({ motion: 0.25 }); // Δ16/64
  const r = respond("is it moving?", ctx);
  assert.ok(r.includes("16"), `Expected Δ16 in: ${r}`);
});

test("motion intent says still when motion is 0", () => {
  const ctx = mkCtx({ motion: 0 });
  const r = respond("is it moving?", ctx);
  assert.ok(r.toLowerCase().includes("still") || r.includes("Δ0"), `Expected still in: ${r}`);
});

test("what/describe intent references source name and dimensions", () => {
  const ctx = mkCtx();
  const r = respond("what is this?", ctx);
  assert.ok(r.includes("1024") || r.includes("2D fractal"), `Expected dimensions or source in: ${r}`);
});

test("try/next intent references the weakest feature value", () => {
  // contrast=0.3 is lowest, so it should suggest pushing contrast
  const ctx = mkCtx({ features: { contrast: 0.3, entropy: 0.7, balance: 0.6 } });
  const r = respond("what could we try?", ctx);
  assert.ok(r.includes("contrast") || r.includes("0.30"), `Expected contrast suggestion in: ${r}`);
});

test("why/how do you know intent includes the hash", () => {
  const ctx = mkCtx();
  const r = respond("how do you know?", ctx);
  assert.ok(r.includes("a1b2c3d4e5f60718"), `Expected hash in: ${r}`);
});

test("audio intent with audio attached includes level and pitch", () => {
  const ctx = mkCtx({ audio: { level: 0.42, pitch: 880 } });
  const r = respond("what does it sound like?", ctx);
  assert.ok(r.includes("0.42") || r.includes("880"), `Expected audio values in: ${r}`);
});

test("audio intent with no audio says no audio channel", () => {
  const ctx = mkCtx({ audio: null });
  const r = respond("can you hear anything?", ctx);
  assert.ok(r.toLowerCase().includes("no audio") || r.toLowerCase().includes("no audio channel"), `Expected 'no audio' in: ${r}`);
});

// ── off-topic: MUST still ground in measurements ──────────────────────────────

test("off-topic message returns grounded non-empty text (includes hash or feature)", () => {
  const ctx = mkCtx();
  const r = respond("tell me a joke", ctx);
  assert.ok(r.length > 0, "Empty response for off-topic");
  const hasGrounding = r.includes("a1b2c3d4e5f60718") || r.includes("teal") || r.includes("0.75");
  assert.ok(hasGrounding, `Off-topic reply is not grounded: ${r}`);
});

test("random off-topic message still returns grounded text", () => {
  const ctx = mkCtx();
  const r = respond("sing me a song", ctx);
  assert.ok(r.length > 0, "Empty response for off-topic");
  // Should mention at least the hash
  assert.ok(r.includes("a1b2c3d4e5f60718"), `Off-topic not grounded: ${r}`);
});

// ── different ctx → different text ───────────────────────────────────────────

test("same query with two different ctx yields different answers", () => {
  const ctxA = mkCtx({ features: { contrast: 0.20, entropy: 0.20, balance: 0.20 }, hueName: "grey", dominantColors: ["#cccccc"], phash: "aaaa0000bbbb1111" });
  const ctxB = mkCtx({ features: { contrast: 0.90, entropy: 0.90, balance: 0.90 }, hueName: "red",  dominantColors: ["#ff0000"], phash: "ffff1111eeee2222" });
  const rA = respond("what do you see?", ctxA);
  const rB = respond("what do you see?", ctxB);
  assert.notEqual(rA, rB, "Same query, different ctx should yield different answers");
});

test("colour question differs when hue differs", () => {
  const ctxA = mkCtx({ hueName: "purple", dominantColors: ["#800080"] });
  const ctxB = mkCtx({ hueName: "orange", dominantColors: ["#ff8c00"] });
  const rA = respond("what colors do you see?", ctxA);
  const rB = respond("what colors do you see?", ctxB);
  assert.notEqual(rA, rB, "Different hue/colours should produce different answers");
  assert.ok(rA.includes("purple") || rA.includes("#800080"), `Expected purple in: ${rA}`);
  assert.ok(rB.includes("orange") || rB.includes("#ff8c00"), `Expected orange in: ${rB}`);
});

test("motion question differs when motion level differs", () => {
  const ctxStill  = mkCtx({ motion: 0 });
  const ctxMoving = mkCtx({ motion: 0.5 }); // Δ32/64
  const rStill  = respond("is it moving?", ctxStill);
  const rMoving = respond("is it moving?", ctxMoving);
  assert.notEqual(rStill, rMoving, "Still vs moving should differ");
  assert.ok(rStill.toLowerCase().includes("still") || rStill.includes("Δ0"), `Expected 'still' in: ${rStill}`);
  assert.ok(rMoving.includes("32"), `Expected Δ32 in: ${rMoving}`);
});

// ── no-ctx guard ──────────────────────────────────────────────────────────────

test("respond with null ctx returns the not-loaded message", () => {
  const r = respond("what do you see?", null);
  assert.ok(r.length > 0, "Empty response for null ctx");
  assert.ok(r.toLowerCase().includes("nothing") || r.toLowerCase().includes("loaded"), `Expected 'nothing/loaded' in: ${r}`);
});

test("respond with empty phash returns the not-loaded message", () => {
  const r = respond("colour?", { phash: "—", features: {}, dominantColors: [], hueName: "" });
  assert.ok(r.includes("Nothing") || r.includes("loaded"), `Expected 'Nothing/loaded' in: ${r}`);
});

// ── Task 8m: honest declines ──────────────────────────────────────────────────

test("joke request returns an honest decline that offers what it can do", () => {
  const ctx = mkCtx();
  const r = respond("tell me a joke", ctx, []);
  // Must NOT be the generic frame-describe fallback (which mentions the hash first)
  // Must mention what it cannot do AND offer something it can
  assert.ok(
    r.toLowerCase().includes("can't") || r.toLowerCase().includes("cannot") ||
    r.toLowerCase().includes("not a language model") || r.toLowerCase().includes("perception"),
    `Expected decline language in: ${r}`
  );
  // Must still offer something concrete
  assert.ok(
    r.toLowerCase().includes("colour") || r.toLowerCase().includes("color") ||
    r.toLowerCase().includes("motion") || r.toLowerCase().includes("contrast") ||
    r.toLowerCase().includes("see") || r.toLowerCase().includes("frame"),
    `Expected offer of what it CAN do in: ${r}`
  );
});

test("story request returns an honest decline that offers what it can do", () => {
  const ctx = mkCtx();
  const r = respond("tell me a story", ctx, []);
  assert.ok(
    r.toLowerCase().includes("can't") || r.toLowerCase().includes("cannot") ||
    r.toLowerCase().includes("not a language model") || r.toLowerCase().includes("perception"),
    `Expected decline language in: ${r}`
  );
});

test("weather request returns an honest decline", () => {
  const ctx = mkCtx();
  const r = respond("what is the weather like?", ctx, []);
  assert.ok(
    r.toLowerCase().includes("can't") || r.toLowerCase().includes("cannot") ||
    r.toLowerCase().includes("outside") || r.toLowerCase().includes("perception") ||
    r.toLowerCase().includes("not a language model"),
    `Expected decline for weather in: ${r}`
  );
});

// ── Task 8m: conversation memory influences reply ────────────────────────────

test("history with a different past phash produces a change-note in the reply", () => {
  const ctx = mkCtx({ phash: "newphash1234abcd" });
  const history = [
    { q: "what do you see?", a: "frame at oldphash9999ffff", phash: "oldphash9999ffff" }
  ];
  const r = respond("what do you see now?", ctx, history);
  // Should mention something about change or the current hash
  assert.ok(
    r.includes("newphash1234abcd") || r.toLowerCase().includes("changed") || r.toLowerCase().includes("shifted") || r.toLowerCase().includes("different"),
    `Expected change note or new hash in: ${r}`
  );
});

test("motion question leads with motion data, not generic describe", () => {
  const ctx = mkCtx({ motion: 0.3 }); // Δ19/64
  const r = respond("is it moving?", ctx, []);
  // First 60 chars should mention motion/moving/still/delta — not colour or hash first
  const lead = r.slice(0, 80).toLowerCase();
  assert.ok(
    lead.includes("moving") || lead.includes("motion") || lead.includes("still") || lead.includes("δ") || lead.includes("Δ") || lead.includes("/64"),
    `Expected motion-led response, got: ${r}`
  );
});

test("colour question leads with colour data", () => {
  const ctx = mkCtx();
  const r = respond("what colours do you see?", ctx, []);
  const lead = r.slice(0, 80).toLowerCase();
  assert.ok(
    lead.includes("colour") || lead.includes("color") || lead.includes("dominant") || lead.includes("teal") || lead.includes("#"),
    `Expected colour-led response, got: ${r}`
  );
});

test("respond is backwards-compatible — no history arg still works", () => {
  const ctx = mkCtx();
  const r = respond("what do you see?", ctx);
  assert.ok(r.length > 0, "Should work without history argument");
  assert.ok(r.includes("1024") || r.includes("2D fractal"), `Expected content in: ${r}`);
});
