// certificate.js: the witnessed certificate, deepened.
//
// verdict.js shipped the first arm: a single structural-fitness criterion, re-derivable in the browser.
// This is the second arm, the trust surface answering the #1 user pain ("I cannot trust output without a
// re-checkable proof trail"). It is ADDITIVE: it imports verdict.js's primitives and never changes them.
//
// The load-bearing finding (STV 2605.30290, Proof-Carrying Certificates 2605.16407): a verify loop with
// no external, named, fixed criterion degenerates into self-consistent noise. So here the named criterion
// is structurally non-optional, the CERTIFIED verdict is driven by the deterministic oracle (never the
// model), and a model judgement is always carried as an ADVISORY surrogate, flagged oracle=model, never
// certified. When the oracle and surrogate disagree the verdict is "disputed", never silently resolved
// (CoEvoSkills 2604.01687, GSAR 2604.23366). UNVERIFIABLE is the conservative default throughout.
//
// Zero external dependencies (stdlib / Web APIs only). Static, no build step. ASCII hyphens only.
import { structuralFitnessVerdict } from "./verdict.js";

// The verdict vocabulary EXTENDS verdict.js's lowercase set. It does NOT borrow the ledger's MATCH/DRIFT
// namespace (that is a different surface: re-verifying a stored fact, not certifying an artifact).
//   verified     the oracle confirmed the claim against the named criterion
//   refuted      the oracle disconfirmed it
//   unverifiable the oracle could not measure it (or no named criterion exists): the conservative default
//   superseded   was verified, replaced by a newer certificate (was true, now stale: NOT "could not confirm")
//   disputed     the deterministic oracle and the advisory surrogate disagree
export const VERDICTS = Object.freeze(["verified", "refuted", "unverifiable", "superseded", "disputed"]);

// The four oracle tiers. The first three are deterministic and CERTIFYING. The fourth is a model call:
// recorded as a surrogate, flagged oracle=model, NEVER certified (No Free Labels 2503.05061: the model
// judges only where the criterion is external and named, otherwise the result is advisory).
export const TIERS = Object.freeze(["pixel", "string", "structural", "cognitive"]);

const isStr = v => typeof v === "string" && v.length > 0;
const isFiniteNum = v => typeof v === "number" && Number.isFinite(v);

// Read a verdict string off whatever an oracle returned: a bare string, or an object carrying `.verdict`.
function verdictOf(o) {
  if (isStr(o)) return o;
  if (o && isStr(o.verdict)) return o.verdict;
  return null;
}

// ----------------------------------------------------------------------------------------------------
// Tiered oracles. Each is a pure function of plain data: it returns a deterministic verdict PLUS the
// evidence it used, so a viewer can re-run the same check on the same numbers and reproduce the call.
// `certified: true` marks a deterministic tier whose verdict is allowed to drive a certificate.
// ----------------------------------------------------------------------------------------------------

// pixel/signal tier: a pre-extracted numeric constraint vs the artifact's same-shaped readout. Pass iff
// their L1 distance is within a named threshold. (Node-testable with arrays; the WebGL/Canvas2D wiring
// that produces the readouts comes in a later tier, but the oracle math is identical.) EVPV 2603.16253.
export function pixelOracle(constraint, readout, threshold, { metric = "l1" } = {}) {
  const a = Array.isArray(constraint) ? constraint : null;
  const b = Array.isArray(readout) ? readout : null;
  if (!a || !b || a.length === 0 || a.length !== b.length || !isFiniteNum(threshold) || threshold < 0) {
    return {
      tier: "pixel", oracle: "pixel-distance-v1", certified: true, verdict: "unverifiable",
      evidence: [
        ["metric", String(metric)],
        ["constraint_len", String(a ? a.length : "na")],
        ["readout_len", String(b ? b.length : "na")],
        ["threshold", String(threshold)],
        ["reason", "shape-mismatch-or-bad-threshold"],
      ],
    };
  }
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Number(a[i]) - Number(b[i]);
    distance += metric === "l2" ? d * d : Math.abs(d);
  }
  if (metric === "l2") distance = Math.sqrt(distance);
  const verdict = !Number.isFinite(distance) ? "unverifiable" : (distance <= threshold ? "verified" : "refuted");
  return {
    tier: "pixel", oracle: "pixel-distance-v1", certified: true, verdict,
    evidence: [
      ["metric", String(metric)],
      ["distance", String(distance)],
      ["threshold", String(threshold)],
      ["len", String(a.length)],
    ],
  };
}

// string tier: an EXTRACTIVE-QUOTE check. Pass iff the quote is a VERBATIM substring of the source, via
// String.includes, never a paraphrase. The check is the proof: a viewer re-runs source.includes(quote).
// X-AIGD 2601.19430 (extractive grounding), Rulers 2601.08654.
export function stringOracle(source, quote) {
  if (!isStr(source) || typeof quote !== "string" || quote.length === 0) {
    return {
      tier: "string", oracle: "extractive-quote-v1", certified: true, verdict: "unverifiable",
      evidence: [["reason", "empty-source-or-quote"], ["quote_len", String(typeof quote === "string" ? quote.length : "na")]],
    };
  }
  const present = source.includes(quote);
  const at = present ? source.indexOf(quote) : -1;
  return {
    tier: "string", oracle: "extractive-quote-v1", certified: true,
    verdict: present ? "verified" : "refuted",
    evidence: [
      ["quote", quote],
      ["present", String(present)],
      ["index", String(at)],
      ["quote_len", String(quote.length)],
      ["source_len", String(source.length)],
    ],
  };
}

// structural tier: validate the artifact against a JSON constraint object. Required keys must be present;
// numeric fields named in `ranges` must sit within their [min, max]. Pass iff every constraint holds, and
// report exactly which failed (so the failure is itself inspectable). Rulers 2601.08654, JSON-schema lineage.
//   constraint = { required: ["k", ...], ranges: { k: [min, max], ... } }
export function structuralOracle(artifact, constraint) {
  const obj = artifact && typeof artifact === "object" ? artifact : null;
  const c = constraint && typeof constraint === "object" ? constraint : null;
  if (!obj || !c) {
    return {
      tier: "structural", oracle: "json-constraint-v1", certified: true, verdict: "unverifiable",
      evidence: [["reason", "artifact-or-constraint-not-an-object"]],
    };
  }
  const required = Array.isArray(c.required) ? c.required : [];
  const ranges = c.ranges && typeof c.ranges === "object" ? c.ranges : {};
  const failures = [];
  for (const k of required) {
    if (!(k in obj) || obj[k] === undefined || obj[k] === null) failures.push(`missing:${k}`);
  }
  for (const [k, bound] of Object.entries(ranges)) {
    const v = obj[k];
    const [min, max] = Array.isArray(bound) ? bound : [bound, bound];
    if (!isFiniteNum(v)) { failures.push(`not-numeric:${k}`); continue; }
    if (isFiniteNum(min) && v < min) failures.push(`below-min:${k}`);
    if (isFiniteNum(max) && v > max) failures.push(`above-max:${k}`);
  }
  return {
    tier: "structural", oracle: "json-constraint-v1", certified: true,
    verdict: failures.length === 0 ? "verified" : "refuted",
    evidence: [
      ["required", required.join(",")],
      ["range_keys", Object.keys(ranges).join(",")],
      ["failures", failures.join(",")],
      ["failure_count", String(failures.length)],
    ],
  };
}

// cognitive tier: a model judgement. It is recorded but NEVER certified: certified:false and oracle:model
// mark it as a surrogate so a downstream certificate can carry it as advisory only and never mistake it for
// a verified result. The verdict is passed through verbatim (the model's own call), evidence keeps the reason.
// No Free Labels 2503.05061: a model verdict beyond an external named criterion is not a certification.
export function cognitiveOracle(modelVerdict, reason = "", { confidence } = {}) {
  const v = VERDICTS.includes(modelVerdict) ? modelVerdict : "unverifiable";
  const evidence = [["model_verdict", String(modelVerdict)], ["reason", String(reason)]];
  if (confidence !== undefined) evidence.push(["confidence", String(confidence)]);
  return { tier: "cognitive", oracle: "model", certified: false, verdict: v, evidence };
}

// ----------------------------------------------------------------------------------------------------
// The witnessed certificate.
// ----------------------------------------------------------------------------------------------------

// Decide a certificate's verdict. The deterministic oracle is authoritative. The surrogate is advisory.
// Order of precedence:
//   1. no named criterion           -> unverifiable (the load-bearing rule: no criterion, no verdict)
//   2. no deterministic oracle      -> unverifiable (a model-only judgement never certifies)
//   3. oracle unverifiable          -> unverifiable (could not measure: conservative default)
//   4. oracle vs surrogate disagree -> disputed     (never silently resolved)
//   5. otherwise                    -> the oracle's verdict (verified / refuted)
// Returns { verdict, certified, disputed, reason }. `certified` is true only when a deterministic oracle
// drove a verified/refuted/disputed result; it is false whenever the model alone, or nothing, decided.
function decideVerdict(criterion, oracle, surrogate) {
  if (!isStr(criterion)) {
    return { verdict: "unverifiable", certified: false, disputed: false, reason: "no-named-criterion" };
  }
  const ov = verdictOf(oracle);
  const oracleCertifies = !!(oracle && oracle.certified === true && ov);
  if (!oracleCertifies) {
    return { verdict: "unverifiable", certified: false, disputed: false, reason: "no-certifying-oracle" };
  }
  if (ov === "unverifiable") {
    return { verdict: "unverifiable", certified: false, disputed: false, reason: "oracle-could-not-measure" };
  }
  const sv = verdictOf(surrogate);
  if (sv && sv !== "unverifiable" && sv !== ov) {
    return { verdict: "disputed", certified: true, disputed: true, reason: `oracle:${ov} vs surrogate:${sv}` };
  }
  return { verdict: ov, certified: true, disputed: false, reason: "oracle-authoritative" };
}

// Flatten the inputs into the re-derivable [k, v] evidence wire shape verdict.js uses, so the certificate
// re-checks the same way the original did. The oracle's own evidence is folded in under oracle_* keys.
function buildEvidence(criterion, decision, oracle, surrogate, haltReason, iteration) {
  const ev = [
    ["criterion", criterion === undefined || criterion === null ? "" : String(criterion)],
    ["oracle_tier", oracle && isStr(oracle.tier) ? oracle.tier : "none"],
    ["oracle_name", oracle && isStr(oracle.oracle) ? oracle.oracle : "none"],
    ["oracle_certified", String(!!(oracle && oracle.certified === true))],
    ["oracle_verdict", verdictOf(oracle) || "none"],
    ["surrogate_verdict", verdictOf(surrogate) || "none"],
    ["decided", decision.verdict],
    ["decided_reason", decision.reason],
    ["halt_reason", haltReason === undefined || haltReason === null ? "none" : String(haltReason)],
    ["iteration", String(isFiniteNum(iteration) ? iteration : 0)],
  ];
  for (const [k, v] of (oracle && Array.isArray(oracle.evidence) ? oracle.evidence : [])) {
    ev.push([`oracle.${k}`, String(v)]);
  }
  return ev;
}

// Build a six-field witnessed certificate. `criterion` is non-optional: with no named criterion the
// certificate is structurally incapable of a pass and carries verdict "unverifiable" (certified:false).
//   buildCertificate({ criterion, claim, oracleVerdict, surrogateVerdict, haltReason, iteration, evidence })
// `oracleVerdict` is an oracle RESULT (the object a tiered oracle returns), or a bare verdict string.
// `surrogateVerdict` is a cognitiveOracle result (or bare string): advisory, model-judged, never certifying.
// `evidence` (optional) is extra [k, v] pairs appended after the derived evidence.
export function buildCertificate({
  criterion, claim, oracleVerdict = null, surrogateVerdict = null,
  haltReason = null, iteration = 0, evidence = [],
} = {}) {
  const decision = decideVerdict(criterion, oracleVerdict, surrogateVerdict);
  const base = buildEvidence(criterion, decision, oracleVerdict, surrogateVerdict, haltReason, iteration);
  const extra = Array.isArray(evidence) ? evidence.filter(e => Array.isArray(e) && e.length === 2).map(([k, v]) => [String(k), String(v)]) : [];
  return {
    // the six fields
    criterion: isStr(criterion) ? criterion : null,
    claim: claim === undefined || claim === null ? "" : String(claim),
    oracleVerdict: verdictOf(oracleVerdict),
    surrogateVerdict: verdictOf(surrogateVerdict),
    haltReason: haltReason === undefined || haltReason === null ? null : String(haltReason),
    iteration: isFiniteNum(iteration) ? iteration : 0,
    // the decided certificate
    verdict: decision.verdict,
    certified: decision.certified,           // false whenever the model alone, or nothing, decided
    disputed: decision.disputed,
    oracle: oracleVerdict && isStr(oracleVerdict.oracle) ? oracleVerdict.oracle : "none",
    tier: oracleVerdict && isStr(oracleVerdict.tier) ? oracleVerdict.tier : "none",
    evidence: base.concat(extra),
  };
}

// Re-derive a certificate's verdict PURELY from its own evidence + criterion, with nothing smuggled in,
// and report whether it reproduces the verdict the certificate carries. This is the richer analogue of
// verdict.js's recheckCertificate: `matches: true` is the proof reproducing itself. A viewer runs this and
// does not have to trust the baked verdict. A certificate with no named criterion can never re-check to a pass.
export function recheckCertificate2(cert) {
  const ev = Object.fromEntries((cert.evidence || []).map(([k, v]) => [k, v]));
  const criterion = ev.criterion || cert.criterion || "";

  // Reconstruct the oracle result from the evidence the certificate carries, then re-run decideVerdict.
  const oracleVerdict = ev.oracle_verdict && ev.oracle_verdict !== "none" ? ev.oracle_verdict : null;
  const oracleCertified = ev.oracle_certified === "true";
  const reOracle = oracleVerdict
    ? { tier: ev.oracle_tier, oracle: ev.oracle_name, certified: oracleCertified, verdict: oracleVerdict }
    : null;
  const surrogateVerdict = ev.surrogate_verdict && ev.surrogate_verdict !== "none" ? ev.surrogate_verdict : null;
  const reSurrogate = surrogateVerdict ? { verdict: surrogateVerdict } : null;

  // SUPERSEDED is a lifecycle state stamped after issuance, not derivable from the original evidence.
  // Re-checking a superseded certificate confirms it WAS its supersededFrom verdict, and that it now
  // points at a newer certificate, rather than re-deriving "superseded" from oracle math.
  if (cert.verdict === "superseded") {
    const was = ev.superseded_from || null;
    const reDerivedWas = isStr(criterion) ? decideVerdict(criterion, reOracle, reSurrogate).verdict : "unverifiable";
    return {
      verdict: "superseded", derivedFromEvidence: reDerivedWas, was,
      supersededBy: cert.supersededBy || ev.superseded_by || null,
      matches: was !== null && reDerivedWas === was,
    };
  }

  const decision = isStr(criterion)
    ? decideVerdict(criterion, reOracle, reSurrogate)
    : { verdict: "unverifiable", certified: false, disputed: false, reason: "no-named-criterion" };
  return {
    verdict: decision.verdict,
    certified: decision.certified,
    disputed: decision.disputed,
    criterion: isStr(criterion) ? criterion : null,
    matches: decision.verdict === cert.verdict,
  };
}

// supersede: mark `oldCert` as superseded by `newCert`. SUPERSEDED is distinct from UNVERIFIABLE: the old
// certificate WAS its verdict (it is preserved under supersededFrom), it is just stale now (voice-of-user
// theme 3, @DonatasSimkus). The pointer is the newer certificate's hash/id, so the trail is followable.
// Returns a NEW object; the input is not mutated. Pass an explicit id, else a content hash is derived.
export function supersede(oldCert, newCert, newId) {
  const pointer = newId !== undefined && newId !== null ? String(newId)
    : (newCert && (newCert.id || newCert.hash)) ? String(newCert.id || newCert.hash)
    : certificateHash(newCert);
  const wasVerdict = oldCert && oldCert.verdict ? oldCert.verdict : "unverifiable";
  const evidence = (oldCert && Array.isArray(oldCert.evidence) ? oldCert.evidence.slice() : [])
    .concat([["superseded_from", wasVerdict], ["superseded_by", pointer]]);
  return {
    ...oldCert,
    verdict: "superseded",
    supersededFrom: wasVerdict,
    supersededBy: pointer,
    evidence,
  };
}

// A small, stable, zero-dependency content fingerprint for a certificate (FNV-1a over its core fields),
// used only as a default supersede pointer when no id/hash is supplied. NOT a cryptographic hash: the
// SHA-256 provenance chain (move B, crypto.subtle) is the real one; this just needs to be deterministic.
export function certificateHash(cert) {
  if (!cert || typeof cert !== "object") return "0";
  const core = JSON.stringify([cert.criterion || "", cert.claim || "", cert.verdict || "", cert.oracle || "", cert.iteration || 0, cert.evidence || []]);
  let h = 0x811c9dc5;
  for (let i = 0; i < core.length; i++) {
    h ^= core.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ("00000000" + h.toString(16)).slice(-8);
}

// weakestAxis: given named quality-dimension scores, return the minimum-scoring dimension name: the axis
// refine should target next (the refine primitive moves in the direction of the minimum dimension). Pure.
// Ties resolve to the first key seen (stable). Returns null on empty / non-numeric input.
export function weakestAxis(dimensionScores) {
  if (!dimensionScores || typeof dimensionScores !== "object") return null;
  let weakest = null, lo = Infinity;
  for (const [k, v] of Object.entries(dimensionScores)) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    if (n < lo) { lo = n; weakest = k; }
  }
  return weakest;
}
