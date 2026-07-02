// readout.js: ONE structured readout, three consumers (spec 3.2). Built once per state change
// from two sources: sense-core numbers measured off the composed frame (box-average luminance
// grid, dominant colours named via the vendored hueName) and the scene facts carried by the
// report (system, seed, state, invariant value, drift ratio, refusal verdict, receipt hash,
// verdict). The three consumers read the SAME object:
//   1. aria-live  -> readoutSentence(): one sentence, announced once per state change.
//   2. model      -> readoutJSON(): the identical facts + numbers behind Studio.connectModel.
//   3. measurimeter: untouched; it perceives the shared canvas on its own path.
// Node-safe: the sense-core read is guarded so report.js / tests can import the pure builders.
// ASCII only; no em or en dashes.
import { boxAverage, dominantColors, hueName } from "../lib/sense-core/features.mjs";

const r4 = (x) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x * 1e4) / 1e4 : x);

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: mx === 0 ? 0 : d / mx, v: mx };
}

// The measured half of the readout: box-average luminance grid mean + the named dominant colours
// of the composed frame. Returns null when no canvas pixels are readable (node, or before paint).
export function senseFrame(canvas, readPixels) {
  if (!canvas || !canvas.width || !canvas.height || typeof readPixels !== "function") return null;
  let px;
  try { px = readPixels(canvas, canvas.width, canvas.height); } catch (_) { return null; }
  if (!px) return null;
  const grid = boxAverage(px, canvas.width, canvas.height, 4, 8);
  let sum = 0, cells = 0;
  for (const row of grid.grid) for (const [r, g, b] of row) { sum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; cells++; }
  const dom = dominantColors(px, canvas.width, canvas.height, 4, 3).map((d) => {
    const hsv = rgbToHsv(d.r, d.g, d.b);
    return { hex: d.hex, name: hueName(hsv.h, hsv.s, hsv.v), frac: r4(d.frac) };
  });
  return { luminanceMean: r4(cells ? sum / cells : 0), gridSize: grid.w, dominantColors: dom };
}

// The scene facts, pulled straight from the report + the current state + verdict. No recompute.
function sceneFacts(report, state, verdict, receiptSha) {
  const r = report || {};
  return {
    system: r.system || null,
    seed: r.seed != null ? String(r.seed) : null,
    state: state || null,
    invariant_value: r.invariant_value != null ? r.invariant_value : null,
    drift_ratio: r.drift_ratio != null ? r.drift_ratio : null,
    tolerance: r.verifier ? r.verifier.tol : null,
    refusal_verdict: r.refusal ? r.refusal.verdict : null,
    receipt_sha256: receiptSha ? String(receiptSha).slice(0, 12) : null,
    ground_world_id: r.ground && r.ground.world ? r.ground.world.id : null,
    verdict: verdict || null,
  };
}

// The ONE readout object. `facts` are the scene truth; `frame` is the measured composed frame
// (null when unreadable). Every consumer reads this shape and no other.
export function buildReadout(input = {}) {
  const facts = sceneFacts(input.report, input.state, input.verdict, input.receiptSha);
  const frame = senseFrame(input.canvas, input.readPixels);
  return { schema: "telos.showcase.readout/1", facts, frame };
}

// Consumer 1: the aria-live sentence, one per state change. Every clause is real: unstated facts
// are simply omitted rather than invented. Colours are named from the measured frame when present.
export function readoutSentence(readout) {
  const f = (readout && readout.facts) || {};
  const parts = [];
  const sys = f.system ? f.system[0].toUpperCase() + f.system.slice(1) : "Scene";
  parts.push(`${sys} system, seed ${f.seed != null ? f.seed : "unknown"}.`);
  if (f.state === "seed") parts.push("Initial condition recorded, ground breathing in.");
  else if (f.state === "motion") parts.push("Integrating the orbit.");
  else {
    parts.push("Orbit complete.");
    if (f.invariant_value != null) {
      const drift = f.drift_ratio != null ? `, drift ${fmtNum(f.drift_ratio)}` : "";
      const tol = f.tolerance != null ? ` within stated tolerance ${f.tolerance}` : "";
      parts.push(`Invariant ${f.invariant_value}${drift}, conserved${tol}.`);
    }
    if (f.refusal_verdict === "refuted") parts.push("Damped run refused by the verifier.");
    else if (f.refusal_verdict) parts.push(`Damped run ${f.refusal_verdict} by the verifier.`);
    if (f.verdict === "MATCH") parts.push("Verdict MATCH.");
    else if (f.verdict === "DRIFT") parts.push("Verdict DRIFT: the recomputation diverged.");
    else if (f.verdict === "UNVERIFIABLE") parts.push("Verdict UNVERIFIABLE.");
  }
  const frame = readout && readout.frame;
  if (frame && frame.dominantColors && frame.dominantColors.length) {
    const names = uniqueNames(frame.dominantColors);
    if (names.length) parts.push(`Dominant colours ${names.join(" and ")}.`);
  }
  return parts.join(" ");
}

// Consumer 2: the model-channel JSON, the identical facts + measured frame a screen reader hears.
export function readoutJSON(readout) {
  return readout || { schema: "telos.showcase.readout/1", facts: {}, frame: null };
}

function uniqueNames(colors) {
  const seen = [];
  for (const c of colors) if (c.name && !seen.includes(c.name)) seen.push(c.name);
  return seen.slice(0, 3);
}

const fmtNum = (x) => (typeof x === "number" && Math.abs(x) < 1e-4 && x !== 0 ? x.toExponential(0) : String(x));
