// report.js: the First Integral witness. Builds the canonical showcase report (recorded IC
// literals, integrate + fit + live refusal verify, ground World receipt), serializes it with
// ONE fixed key order, hashes it with SHA-256 via globalThis.crypto.subtle (the same digest
// in node and the browser), and re-checks it to MATCH / DRIFT / UNVERIFIABLE.
//
// Policy split (printed inside every receipt): only the Kepler path is bit-hashed, because
// after the pow fix (spec D1) its right-hand side uses only + - * / sqrt, all IEEE-754
// correctly rounded, and integration starts FROM THE RECORDED IC LITERALS (spec D2), so the
// trig in the seed derivation can never poison a verdict. Sin-based systems (sho, pendulum,
// oscillator2d) get recipe + tolerance verification only; the serializer refuses to emit
// trajectory_sha256 for them. ASCII only; no em or en dashes.
import { SYSTEMS, rng } from "../discovery/systems.js";
import { simulate } from "../discovery/integrator.js";
import { leastVarianceCombo } from "../discovery/reference.js";
import { conservationOracle } from "../discovery/verify.js";
import { makeFn } from "../discovery/expr.js";
import { create } from "../lib/reconcile/index.js";

export const SCHEMA = "telos.showcase.first-integral/1";
export const HASH_POLICY = "kepler trajectory bit-hashed (+,-,*,/,sqrt only, from recorded IC literals); sin-based systems hash the recipe and verify values by tolerance";
const REFUSAL_DRAG = 0.02;
const TRIALS = 6;

// Per-system scene defaults: lab canon dt/n/tol (system/discovery/lab.js), the default fit
// basis, and the energy candidate the damped refusal run submits to the verifier.
export const SHOWCASE_CONF = {
  kepler: { dt: 0.004, n: 2000, tol: 0.05, bitHash: true, basis: ["x*vy", "y*vx"],
    energy: "0.5*(vx^2+vy^2) - 1/sqrt(x^2+y^2)" },
  sho: { dt: 0.01, n: 1500, tol: 0.02, bitHash: false, basis: ["x^2", "v^2"],
    energy: "0.5*v^2 + 0.5*1.69*x^2" },
  pendulum: { dt: 0.01, n: 1500, tol: 0.02, bitHash: false, basis: ["w^2", "cos(theta)"],
    energy: "0.5*w^2 - 9.81*cos(theta)" },
  oscillator2d: { dt: 0.01, n: 1500, tol: 0.02, bitHash: false, basis: ["x^2", "y^2", "vx^2", "vy^2"],
    energy: "0.5*(vx^2+vy^2) + 0.5*1.21*(x^2+y^2)" },
};

const r4 = (x) => Math.round(x * 1e4) / 1e4;
const r6 = (x) => Math.round(x * 1e6) / 1e6;

// Any seed string becomes a uint32 for the deterministic rng: short digit strings keep their
// numeric value (so seed "1" is the lab-canon rng(1)); every other string hashes via FNV-1a.
export function seedToUint32(seed) {
  const s = String(seed).trim();
  if (/^[0-9]{1,9}$/.test(s)) return parseInt(s, 10) >>> 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

function subtleOf(opts) {
  if (opts && "subtle" in opts) return opts.subtle;
  return (globalThis.crypto && globalThis.crypto.subtle) || null;
}

// SHA-256 hex via WebCrypto; null when no subtle is available (insecure context), so the
// caller reports UNVERIFIABLE instead of pretending (the Spine.witness null path).
export async function sha256Hex(text, subtle) {
  const s = subtle === undefined ? subtleOf(null) : subtle;
  if (!s) return null;
  const buf = await s.digest("SHA-256", new TextEncoder().encode(String(text)));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// The flowfield ground World for a seed (vendored reconcile engine; deterministic, node-safe).
// The report embeds only its receipt; the renderer draws its verified GLSL program. The World
// witness is cyrb53 and is always labeled as such, never presented as SHA-256 (spec D11).
export function groundWorld(seedU32) {
  return create("flowfield", { seed: seedU32 });
}

// The recorded IC literals: sampleState(rng(seed)) rounded to r6. The literals, not the
// trig-derived raw floats, are the integration source of truth (spec D2).
export function deriveIC(systemName, seed) {
  const sys = SYSTEMS[systemName];
  if (!sys) throw new Error("unknown system: " + systemName);
  const raw = sys.sampleState(rng(seedToUint32(seed)));
  const ic = {};
  for (const v of sys.vars) ic[v] = r6(raw[v]);
  return ic;
}

const stateLine = (s, vars) => vars.map((v) => String(s[v])).join(",");

// Build the full report bundle for a seed. Returns { report, canonical, sha256, states, fit,
// world }: report/canonical/sha256 are the witness; states/fit/world feed the renderer.
export async function buildReport(opts = {}) {
  const systemName = String(opts.system || "kepler");
  const conf = SHOWCASE_CONF[systemName], sys = SYSTEMS[systemName];
  if (!conf || !sys) throw new Error("unknown showcase system: " + systemName);
  const subtle = subtleOf(opts);
  if (!subtle) throw new Error("crypto.subtle unavailable outside a secure context: cannot hash the report");
  const seed = String(opts.seed != null ? opts.seed : "1");
  const u32 = seedToUint32(seed);
  const dt = Number(opts.dt != null ? opts.dt : conf.dt);
  const n = Number(opts.n != null ? opts.n : conf.n);
  const basis = (Array.isArray(opts.basis) && opts.basis.length ? opts.basis : conf.basis).map(String);
  const source = opts.ic || deriveIC(systemName, seed);
  const ic = {};
  for (const v of sys.vars) {
    const x = Number(source[v]);
    if (!Number.isFinite(x)) throw new Error("non-finite IC literal for " + v);
    ic[v] = r6(x);
  }
  // 1) integrate FROM THE RECORDED LITERALS, never from the raw trig-derived state
  const states = simulate(sys, ic, { dt, n });
  // 2) fit ONCE: the least-variance conserved combination of the stated basis
  const fit = leastVarianceCombo(basis, sys.vars, states);
  if (!fit.ok) throw new Error("fit failed: " + (fit.reason || "no conserved combination"));
  const fn = makeFn(fit.expr, sys.vars);
  let mn = Infinity, mx = -Infinity, sum = 0;
  for (const s of states) { const q = fn(s); if (q < mn) mn = q; if (q > mx) mx = q; sum += q; }
  const mean = sum / states.length;
  // 3) the refusal run is LIVE: same system, drag, energy candidate, verify.js verdict.
  //    The verdict recorded here is the oracle's return value; a canned string is forbidden.
  const refusalOracle = conservationOracle(conf.energy, sys, { seed: u32, dt, n, trials: TRIALS, tol: conf.tol, drag: REFUSAL_DRAG });
  // 4) the ground World receipt
  const world = groundWorld(u32);
  const report = {
    schema: SCHEMA, system: systemName, seed, dt, n, ic,
    basis, coefficients: fit.coeffs.map(r4),
    invariant_value: r4(mean),
    drift_ratio: r6((mx - mn) / (Math.abs(mean) + 1e-12)),
    refusal: { drag: REFUSAL_DRAG, basis: [conf.energy], verdict: refusalOracle.verdict },
    verifier: { oracle: "conservation-v1", tol: conf.tol },
    hash_policy: HASH_POLICY,
    ground: { organ: "flowfield", world: { ...world.receipt } },
  };
  if (conf.bitHash) {
    report.trajectory_sha256 = await sha256Hex(states.map((s) => stateLine(s, sys.vars)).join(";"), subtle);
  }
  const canonical = serializeReport(report);
  const sha256 = await sha256Hex(canonical, subtle);
  return { report, canonical, sha256, states, fit, world };
}

const jstr = JSON.stringify;
function jnum(x, field) {
  if (typeof x !== "number" || !Number.isFinite(x)) throw new Error("canonical report: " + field + " must be a finite number");
  return jstr(x);
}
const jstrs = (a, field) => {
  if (!Array.isArray(a)) throw new Error("canonical report: " + field + " must be an array");
  return "[" + a.map((t) => jstr(String(t))).join(",") + "]";
};

// The ONE canonical serializer: compact JSON, the exact key order of spec 2.4. Shortest
// round-trip Number printing (ECMA-262) means bit-identical values give identical bytes.
export function serializeReport(report) {
  if (!report || typeof report !== "object") throw new Error("canonical report: not an object");
  const conf = SHOWCASE_CONF[report.system], sys = SYSTEMS[report.system];
  if (!conf || !sys) throw new Error("canonical report: unknown system " + String(report.system));
  if (!conf.bitHash && report.trajectory_sha256 != null) {
    throw new Error("policy split: " + report.system + " is sin-based, so the serializer refuses trajectory_sha256; bit-hash coverage is kepler-only (recipe + tolerance verification instead)");
  }
  if (conf.bitHash && !/^[0-9a-f]{64}$/.test(String(report.trajectory_sha256 || ""))) {
    throw new Error("canonical report: a kepler report must carry a 64-hex trajectory_sha256");
  }
  const w = report.ground && report.ground.world;
  if (!report.ground || report.ground.organ !== "flowfield" || !w) {
    throw new Error("canonical report: the ground world receipt is missing");
  }
  const ic = "{" + sys.vars.map((v) => jstr(v) + ":" + jnum(report.ic && report.ic[v], "ic." + v)).join(",") + "}";
  const coeffs = "[" + (report.coefficients || []).map((c, i) => jnum(c, "coefficients[" + i + "]")).join(",") + "]";
  const refusal = '{"drag":' + jnum(report.refusal && report.refusal.drag, "refusal.drag")
    + ',"basis":' + jstrs(report.refusal.basis, "refusal.basis")
    + ',"verdict":' + jstr(String(report.refusal.verdict)) + "}";
  const verifier = '{"oracle":' + jstr(String(report.verifier && report.verifier.oracle))
    + ',"tol":' + jnum(report.verifier && report.verifier.tol, "verifier.tol") + "}";
  const world = '{"id":' + jstr(String(w.id)) + ',"seed":' + jnum(w.seed, "ground.world.seed")
    + ',"organs":' + jstrs(w.organs, "ground.world.organs")
    + ',"shas":' + jstrs(w.shas, "ground.world.shas")
    + ',"witness":' + jstr(String(w.witness)) + "}";
  let out = '{"schema":' + jstr(String(report.schema))
    + ',"system":' + jstr(String(report.system))
    + ',"seed":' + jstr(String(report.seed))
    + ',"dt":' + jnum(report.dt, "dt")
    + ',"n":' + jnum(report.n, "n")
    + ',"ic":' + ic
    + ',"basis":' + jstrs(report.basis, "basis")
    + ',"coefficients":' + coeffs
    + ',"invariant_value":' + jnum(report.invariant_value, "invariant_value")
    + ',"drift_ratio":' + jnum(report.drift_ratio, "drift_ratio")
    + ',"refusal":' + refusal
    + ',"verifier":' + verifier
    + ',"hash_policy":' + jstr(String(report.hash_policy))
    + ',"ground":{"organ":"flowfield","world":' + world + "}";
  if (conf.bitHash) out += ',"trajectory_sha256":' + jstr(String(report.trajectory_sha256));
  return out + "}";
}

// Field-by-field comparison for the DRIFT verdict: the actual deltas, never hidden.
function fieldDeltas(recorded, recomputed) {
  const deltas = [];
  const push = (field, a, b) => {
    if (typeof a === "number" && typeof b === "number") {
      if (a !== b) deltas.push({ field, recorded: a, recomputed: b, delta: a - b });
    } else if (String(a) !== String(b)) {
      deltas.push({ field, recorded: a, recomputed: b });
    }
  };
  const sys = SYSTEMS[recorded.system];
  for (const v of (sys ? sys.vars : [])) push("ic." + v, recorded.ic && recorded.ic[v], recomputed.ic && recomputed.ic[v]);
  push("basis", (recorded.basis || []).join(","), (recomputed.basis || []).join(","));
  const ca = recorded.coefficients || [], cb = recomputed.coefficients || [];
  for (let i = 0; i < Math.max(ca.length, cb.length); i++) push("coefficients[" + i + "]", ca[i], cb[i]);
  push("invariant_value", recorded.invariant_value, recomputed.invariant_value);
  push("drift_ratio", recorded.drift_ratio, recomputed.drift_ratio);
  push("refusal.drag", recorded.refusal && recorded.refusal.drag, recomputed.refusal && recomputed.refusal.drag);
  push("refusal.verdict", recorded.refusal && recorded.refusal.verdict, recomputed.refusal && recomputed.refusal.verdict);
  push("ground.world.id", recorded.ground && recorded.ground.world && recorded.ground.world.id,
    recomputed.ground && recomputed.ground.world && recomputed.ground.world.id);
  push("ground.world.witness", recorded.ground && recorded.ground.world && recorded.ground.world.witness,
    recomputed.ground && recomputed.ground.world && recomputed.ground.world.witness);
  push("trajectory_sha256", recorded.trajectory_sha256, recomputed.trajectory_sha256);
  return deltas;
}

// Re-check the receipt (spec 2.4): re-integrate from the recorded literals, re-fit, re-run
// the refusal, re-serialize, re-hash, compare.
//   MATCH         the recomputed hash equals the receipt hash
//   DRIFT         recomputation ran but the hash diverged; the actual deltas are attached
//   UNVERIFIABLE  this environment cannot re-run (capability probe says no, or no
//                 crypto.subtle outside a secure context); the reason is stated, not hidden
// opts.capability injects the probe result ({ canRun, reason }); opts.subtle injects the
// WebCrypto surface. Both default to the live environment.
export async function recheck(report, opts = {}) {
  const cap = opts.capability;
  if (cap && cap.canRun === false) {
    return { verdict: "UNVERIFIABLE", reason: "capability probe: " + (cap.reason || "this environment cannot re-run the scene") };
  }
  const subtle = subtleOf(opts);
  if (!subtle) {
    return { verdict: "UNVERIFIABLE", reason: "crypto.subtle unavailable outside a secure context: cannot re-hash the report" };
  }
  let receiptSha, fresh;
  try {
    receiptSha = await sha256Hex(serializeReport(report), subtle);
    fresh = await buildReport({ system: report.system, seed: report.seed, dt: report.dt, n: report.n, basis: report.basis, ic: report.ic, subtle });
  } catch (e) {
    return { verdict: "UNVERIFIABLE", reason: "re-run failed: " + String((e && e.message) || e) };
  }
  if (fresh.sha256 === receiptSha) {
    return { verdict: "MATCH", receipt_sha256: receiptSha, recomputed_sha256: fresh.sha256, deltas: [] };
  }
  const deltas = fieldDeltas(report, fresh.report);
  deltas.push({ field: "report_sha256", recorded: receiptSha, recomputed: fresh.sha256 });
  return { verdict: "DRIFT", receipt_sha256: receiptSha, recomputed_sha256: fresh.sha256, deltas };
}
