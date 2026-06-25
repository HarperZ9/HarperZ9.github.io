// Node-side gate for the witnessed certificate (the trust surface). Every certified verdict must be
// driven by a deterministic oracle, never the model; the named criterion must be structurally non-optional;
// oracle-vs-surrogate disagreement must surface as "disputed"; superseded must stay distinct from
// unverifiable; the re-check must reproduce the verdict from the certificate's own evidence.
//
// Run: node --test shared-frame/tests/certificate.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCertificate, recheckCertificate2, supersede, weakestAxis,
  pixelOracle, stringOracle, structuralOracle, cognitiveOracle,
  VERDICTS, TIERS, certificateHash,
} from "../certificate.js";

// ---- the load-bearing rule: no named criterion, no certified pass ----------------------------------

test("a certificate with no named criterion is never certified (unverifiable, certified:false)", () => {
  // even handed a verified deterministic oracle, the missing criterion blocks certification.
  const oracle = stringOracle("the source text", "source");
  assert.equal(oracle.verdict, "verified");
  const cert = buildCertificate({ criterion: undefined, claim: "x", oracleVerdict: oracle });
  assert.equal(cert.verdict, "unverifiable");
  assert.equal(cert.certified, false);
  assert.equal(cert.criterion, null);
});

test("empty-string and non-string criterion are both rejected as unnamed", () => {
  const oracle = stringOracle("abc", "a");
  for (const bad of ["", "   ".trim(), 42, null, {}]) {
    const cert = buildCertificate({ criterion: bad, oracleVerdict: oracle });
    assert.equal(cert.verdict, "unverifiable", `criterion=${JSON.stringify(bad)} -> unverifiable`);
    assert.equal(cert.certified, false);
  }
});

test("a model-only judgement never certifies, even with a named criterion", () => {
  // cognitiveOracle is certified:false; with no deterministic oracle the certificate stays unverifiable.
  const surrogate = cognitiveOracle("verified", "looks right to me");
  const cert = buildCertificate({ criterion: "extractive-quote", surrogateVerdict: surrogate });
  assert.equal(cert.verdict, "unverifiable");
  assert.equal(cert.certified, false);
});

// ---- pixel/signal oracle: pass and fail ------------------------------------------------------------

test("pixelOracle passes within threshold and refutes beyond it (L1)", () => {
  const constraint = [10, 20, 30, 40];
  const near = [11, 19, 31, 39];   // L1 distance 4
  const far = [10, 20, 30, 99];    // L1 distance 59
  const pass = pixelOracle(constraint, near, 5);
  assert.equal(pass.verdict, "verified");
  assert.equal(pass.tier, "pixel");
  assert.equal(pass.certified, true);
  const ev = Object.fromEntries(pass.evidence);
  assert.equal(ev.distance, "4");
  assert.equal(ev.threshold, "5");

  const fail = pixelOracle(constraint, far, 5);
  assert.equal(fail.verdict, "refuted");
  assert.equal(Object.fromEntries(fail.evidence).distance, "59");
});

test("pixelOracle supports L2 and reports unverifiable on shape mismatch", () => {
  const l2 = pixelOracle([0, 0], [3, 4], 5, { metric: "l2" });   // distance 5 <= 5
  assert.equal(l2.verdict, "verified");
  assert.equal(Object.fromEntries(l2.evidence).distance, "5");

  const mismatch = pixelOracle([1, 2, 3], [1, 2], 1);
  assert.equal(mismatch.verdict, "unverifiable");   // can't measure != unfit
  assert.equal(mismatch.certified, true);
});

// ---- string oracle: extractive-quote, pass and fail ------------------------------------------------

test("stringOracle verifies a verbatim substring and refutes a paraphrase", () => {
  const source = "The reconcile carries a re-checkable proof trail.";
  const pass = stringOracle(source, "re-checkable proof trail");
  assert.equal(pass.verdict, "verified");
  assert.equal(pass.tier, "string");
  const ev = Object.fromEntries(pass.evidence);
  assert.equal(ev.present, "true");
  assert.ok(Number(ev.index) >= 0);

  // a paraphrase (not a verbatim substring) must refute, never pass.
  const fail = stringOracle(source, "a proof trail you can re-check");
  assert.equal(fail.verdict, "refuted");
  assert.equal(Object.fromEntries(fail.evidence).present, "false");
});

test("stringOracle is case-sensitive and exact (no fuzzy match)", () => {
  assert.equal(stringOracle("Hello World", "hello world").verdict, "refuted");
  assert.equal(stringOracle("Hello World", "Hello World").verdict, "verified");
  assert.equal(stringOracle("abc", "").verdict, "unverifiable");
});

// ---- structural oracle: JSON constraint, pass and fail ---------------------------------------------

test("structuralOracle passes when all required keys and ranges hold", () => {
  const artifact = { width: 879, height: 879, cohesion: 0.72 };
  const constraint = { required: ["width", "height"], ranges: { cohesion: [0.6, 1.0], width: [1, 4096] } };
  const pass = structuralOracle(artifact, constraint);
  assert.equal(pass.verdict, "verified");
  assert.equal(pass.tier, "structural");
  assert.equal(Object.fromEntries(pass.evidence).failure_count, "0");
});

test("structuralOracle refutes and names each failure (missing key, out of range, non-numeric)", () => {
  const artifact = { width: 879, cohesion: 0.4, label: "x" };
  const constraint = { required: ["width", "height"], ranges: { cohesion: [0.6, 1.0], label: [0, 1] } };
  const fail = structuralOracle(artifact, constraint);
  assert.equal(fail.verdict, "refuted");
  const failures = Object.fromEntries(fail.evidence).failures.split(",");
  assert.ok(failures.includes("missing:height"), "reports the missing key");
  assert.ok(failures.includes("below-min:cohesion"), "reports the out-of-range numeric");
  assert.ok(failures.includes("not-numeric:label"), "reports the non-numeric range field");
});

// ---- cognitive oracle: always flagged, never certified ---------------------------------------------

test("cognitiveOracle is flagged oracle=model and certified:false", () => {
  const c = cognitiveOracle("verified", "the palette reads warm", { confidence: 0.7 });
  assert.equal(c.tier, "cognitive");
  assert.equal(c.oracle, "model");
  assert.equal(c.certified, false);
  assert.equal(c.verdict, "verified");
  assert.equal(Object.fromEntries(c.evidence).confidence, "0.7");
  // an out-of-vocabulary model verdict degrades to unverifiable, never invented.
  assert.equal(cognitiveOracle("looks-great").verdict, "unverifiable");
});

// ---- the certified path: oracle drives the verdict -------------------------------------------------

test("buildCertificate certifies the oracle's verdict when a criterion is named", () => {
  const oracle = structuralOracle({ a: 1, b: 2 }, { required: ["a", "b"] });
  const cert = buildCertificate({
    criterion: "json-constraint:has-a-and-b", claim: "artifact has a and b",
    oracleVerdict: oracle, iteration: 2, haltReason: "confidence-halt",
  });
  assert.equal(cert.verdict, "verified");
  assert.equal(cert.certified, true);
  assert.equal(cert.criterion, "json-constraint:has-a-and-b");
  assert.equal(cert.oracle, "json-constraint-v1");
  assert.equal(cert.tier, "structural");
  assert.equal(cert.iteration, 2);
  assert.equal(cert.haltReason, "confidence-halt");
  // all six declared fields are present on the object.
  for (const f of ["criterion", "claim", "oracleVerdict", "surrogateVerdict", "haltReason", "iteration"]) {
    assert.ok(f in cert, `certificate carries field ${f}`);
  }
});

test("a surrogate that agrees with the oracle does not change the certified verdict", () => {
  const oracle = stringOracle("alpha beta", "beta");        // verified
  const surrogate = cognitiveOracle("verified", "agrees");
  const cert = buildCertificate({ criterion: "quote:beta", oracleVerdict: oracle, surrogateVerdict: surrogate });
  assert.equal(cert.verdict, "verified");
  assert.equal(cert.certified, true);
  assert.equal(cert.disputed, false);
});

// ---- disputed: oracle and surrogate disagree -------------------------------------------------------

test("oracle and surrogate disagreement yields a disputed certificate, never silently resolved", () => {
  const oracle = stringOracle("alpha beta", "gamma");       // refuted (gamma not present)
  const surrogate = cognitiveOracle("verified", "model thinks it's there");
  const cert = buildCertificate({ criterion: "quote:gamma", oracleVerdict: oracle, surrogateVerdict: surrogate });
  assert.equal(cert.verdict, "disputed");
  assert.equal(cert.disputed, true);
  assert.equal(cert.certified, true);   // the deterministic oracle still drove the (disputed) decision
  // the oracle's own verdict is preserved, not overwritten by the surrogate.
  assert.equal(cert.oracleVerdict, "refuted");
  assert.equal(cert.surrogateVerdict, "verified");
});

test("an unverifiable oracle stays unverifiable even if the surrogate has an opinion", () => {
  const oracle = pixelOracle([1, 2], [1], 1);               // shape mismatch -> unverifiable
  const surrogate = cognitiveOracle("verified", "model is confident anyway");
  const cert = buildCertificate({ criterion: "pixel:hist", oracleVerdict: oracle, surrogateVerdict: surrogate });
  assert.equal(cert.verdict, "unverifiable");
  assert.equal(cert.disputed, false);
});

// ---- recheck reproduces the verdict from the certificate's own evidence ----------------------------

test("recheckCertificate2 reproduces verified / refuted / disputed from evidence alone", () => {
  const verified = buildCertificate({ criterion: "quote:x", oracleVerdict: stringOracle("xyz", "x") });
  const r1 = recheckCertificate2(verified);
  assert.equal(r1.verdict, "verified");
  assert.equal(r1.matches, true);

  const refuted = buildCertificate({ criterion: "quote:q", oracleVerdict: stringOracle("xyz", "q") });
  assert.equal(recheckCertificate2(refuted).matches, true);

  const disputed = buildCertificate({
    criterion: "quote:q", oracleVerdict: stringOracle("xyz", "q"),
    surrogateVerdict: cognitiveOracle("verified", "model disagrees"),
  });
  const r3 = recheckCertificate2(disputed);
  assert.equal(r3.verdict, "disputed");
  assert.equal(r3.matches, true);
});

test("recheck of an uncertified (no-criterion) certificate cannot reproduce a pass", () => {
  const cert = buildCertificate({ criterion: null, oracleVerdict: stringOracle("xyz", "x") });
  const r = recheckCertificate2(cert);
  assert.equal(r.verdict, "unverifiable");
  assert.equal(r.matches, true);     // it correctly reproduces "unverifiable", not a pass
  assert.equal(r.certified, false);
});

// ---- supersede: distinct from unverifiable ---------------------------------------------------------

test("supersede marks the old certificate superseded, distinct from unverifiable, with a pointer", () => {
  const oldCert = buildCertificate({ criterion: "quote:x", claim: "v1", oracleVerdict: stringOracle("xyz", "x") });
  assert.equal(oldCert.verdict, "verified");
  const newCert = buildCertificate({ criterion: "quote:x", claim: "v2", oracleVerdict: stringOracle("xyz", "x") });

  const stale = supersede(oldCert, newCert, "cert-002");
  assert.equal(stale.verdict, "superseded");
  assert.notEqual(stale.verdict, "unverifiable");      // was true, now replaced != could not confirm
  assert.equal(stale.supersededFrom, "verified");      // the verdict it HELD is preserved
  assert.equal(stale.supersededBy, "cert-002");        // followable pointer to the newer certificate
  // the original is not mutated.
  assert.equal(oldCert.verdict, "verified");

  // re-checking a superseded certificate confirms WHAT it was and that it now points onward.
  const r = recheckCertificate2(stale);
  assert.equal(r.verdict, "superseded");
  assert.equal(r.was, "verified");
  assert.equal(r.derivedFromEvidence, "verified");     // re-derived from its own evidence
  assert.equal(r.matches, true);
  assert.equal(r.supersededBy, "cert-002");
});

test("supersede derives a content-hash pointer when no id is supplied", () => {
  const a = buildCertificate({ criterion: "quote:x", oracleVerdict: stringOracle("xyz", "x") });
  const b = buildCertificate({ criterion: "quote:y", oracleVerdict: stringOracle("xyz", "y") });
  const stale = supersede(a, b);
  assert.equal(stale.supersededBy, certificateHash(b));
  assert.match(stale.supersededBy, /^[0-9a-f]{8}$/);   // deterministic 8-hex fingerprint
});

// ---- weakestAxis: pure minimum ---------------------------------------------------------------------

test("weakestAxis returns the minimum-scoring dimension name", () => {
  assert.equal(weakestAxis({ balance: 0.9, coverage: 0.4, contrast: 0.7 }), "coverage");
  assert.equal(weakestAxis({ a: 0.5 }), "a");
  assert.equal(weakestAxis({}), null);
  assert.equal(weakestAxis(null), null);
  // non-numeric values are skipped, not treated as zero.
  assert.equal(weakestAxis({ a: "bad", b: 0.8, c: 0.3 }), "c");
});

// ---- vocabulary invariants -------------------------------------------------------------------------

test("the verdict vocabulary extends verdict.js and excludes the ledger namespace", () => {
  for (const v of ["verified", "refuted", "unverifiable", "superseded", "disputed"]) {
    assert.ok(VERDICTS.includes(v), `${v} is a certificate verdict`);
  }
  assert.ok(!VERDICTS.includes("MATCH"), "MATCH belongs to the ledger, not the certificate");
  assert.ok(!VERDICTS.includes("DRIFT"), "DRIFT belongs to the ledger, not the certificate");
  assert.deepEqual([...TIERS], ["pixel", "string", "structural", "cognitive"]);
});
