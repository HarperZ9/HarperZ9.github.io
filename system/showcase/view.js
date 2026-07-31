// view.js: the composed view object the scene renderer draws each frame, plus its text formatters.
// Pure: it takes the built bundle + the current state name + the reveal index and returns the
// layer-by-layer view; each state adds only the layers it has earned (the law lines appear after
// the fit, the receipt only at witness). Nothing is drawn before it is real. ASCII only; no dashes.
import { SYSTEMS } from "../discovery/systems.js";

export const REFUSAL_DRAG = 0.02;

export const fmtNum = (x) => (Math.abs(x) < 1e-4 && x !== 0 ? x.toExponential(0) : String(x));

const icText = (r) => r.system === "kepler"
  ? `x ${r.ic.x} . y ${r.ic.y} . vx ${r.ic.vx} . vy ${r.ic.vy}`
  : (SYSTEMS[r.system] || SYSTEMS.kepler).vars.map((k) => `${k} ${r.ic[k]}`).join(" . ");

// Render the fitted law as a readable signed sum of terms, e.g. "x*vy - y*vx".
export function fmtExpr(r) {
  const parts = [];
  for (let i = 0; i < r.basis.length; i++) {
    const c = r.coefficients[i];
    if (c === 0) continue;
    const mag = Math.abs(c), coef = mag === 1 ? "" : `${mag}*`;
    const op = parts.length === 0 ? (c < 0 ? "-" : "") : (c < 0 ? " - " : " + ");
    parts.push(`${op}${coef}${r.basis[i]}`);
  }
  return parts.join("") || "0";
}

export function buildView(built, state, revealed) {
  const r = built.report;
  const v = {
    seedLine: `seed ${r.seed} . ${r.system} . dt ${r.dt} . n ${r.n}`,
    icLine: `ic ${icText(r)}`,
    groundAlpha: state === "seed" ? 0.55 : 1,
  };
  if (state === "motion" && built.states[revealed]) v.body = built.states[revealed];
  if (state === "law" || state === "witness") {
    v.body = built.states[built.states.length - 1];
    v.law = {
      text: `${fmtExpr(r)} = ${r.invariant_value} . drift ${fmtNum(r.drift_ratio)}`,
      series: built.invSeries,
    };
    v.refusal = {
      series: built.refusalSeries,
      label: `drag ${REFUSAL_DRAG} . energy candidate . verifier`,
      stamp: r.refusal.verdict === "refuted" ? "REFUSED" : String(r.refusal.verdict).toUpperCase(),
    };
  }
  if (state === "witness") {
    const short = built.sha256 ? built.sha256.slice(0, 12) : "";
    v.witness = {
      stamp: built.verdict === "MATCH" ? "MATCH" : (built.verdict || ""),
      rows: [
        `report sha256 ${short} . seed ${r.seed} . ${r.system} tol ${r.verifier.tol}`,
        `ground world ${r.ground.world.id} (cyrb53) . ${r.hash_policy.slice(0, 58)}`,
      ],
    };
  }
  return v;
}
