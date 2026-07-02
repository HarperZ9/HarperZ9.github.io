// first-integral.js: the "First Integral" engine showcase, a Studio source ("Showcase", Verify
// group). Owns the lifecycle (startShowcase / stopShowcase), the four-state machine (SEED,
// MOTION, LAW, WITNESS), control + keyboard wiring, and the aria-live feed. Drives orbit-render.js
// (ground World + ink polyline) and report.js (recorded IC literals, integrate + fit + live
// refusal verify, canonical JSON, SHA-256, MATCH / DRIFT / UNVERIFIABLE re-check). The pipeline is
// milliseconds of compute; the choreography only paces the reveal, it never recomputes. ASCII
// only; no em or en dashes.
import { makeScene, buildGround, seedUint32, deriveIC } from "./orbit-render.js?v=20260701a";
import { buildReport, recheck } from "./report.js?v=20260701a";
import { SYSTEMS } from "../discovery/systems.js";
import { simulate } from "../discovery/integrator.js";
import { makeFn } from "../discovery/expr.js";

const STATES = ["seed", "motion", "law", "witness"];
const REFUSAL_DRAG = 0.02;
const CHUNK = 60;                 // integration steps revealed per frame (~2s for 2000 steps)
const $ = (id) => document.getElementById(id);
const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

let canvasEl = null, scene = null, raf = 0;
let active = false, settled = false, capture = false;
let state = STATES[0];
let built = null;                 // { report, states, fit, invSeries, refusalSeries, sha } after buildReport
let axes = ["x", "y"];

// The meter loop's idle gate (studio-loop.js case "showcase" reads this each tick): true
// whenever the scene is not animating, so the loop is free to idle once settled.
export function showcaseSettled() { return !active || settled; }

// Debug/test surface behind window.__studioShowcase. Real values once the report is built;
// before that a re-check is honestly UNVERIFIABLE (no report yet), never a faked verdict.
export function showcaseReport() { return built ? built.report : null; }
export function showcaseVerdict() { return built ? (built.verdict || "unchecked") : "unbuilt"; }
export async function recheckShowcase() {
  if (!built) return { verdict: "UNVERIFIABLE", reason: "no report built yet" };
  const r = await recheck(built.report);
  built.verdict = r.verdict;
  paintVerdict(r);
  announceVerdict(r);
  return r;
}

// Read the scene parameters from the rail controls and the URL. Kepler is the default and the
// only bit-hashed path; the seed drives both the ground World and the IC derivation.
function readParams() {
  const params = new URLSearchParams((typeof window !== "undefined" && window.location.search) || "");
  // The Atelier boot rewrites location.search, so prefer the head-snapshot seed, then the URL,
  // then the rail input, then the lab-canon default.
  const bootSeed = (typeof window !== "undefined" && window.__studioBootSeed) || "";
  const urlSeed = params.get("seed");
  const seed = String(bootSeed || urlSeed || ($("show-seed") && $("show-seed").value) || "1").trim() || "1";
  const system = ($("show-system") && $("show-system").querySelector(".chip.active") &&
    $("show-system").querySelector(".chip.active").dataset.showSystem) || "kepler";
  const ecc = $("show-ecc") ? Number($("show-ecc").value) : 0.4;
  const dt = $("show-dt") ? Number($("show-dt").value) : undefined;
  const n = $("show-n") ? Number($("show-n").value) : undefined;
  const terms = ($("show-terms") && $("show-terms").value) || "";
  const basis = terms.split(",").map((s) => s.trim()).filter(Boolean);
  return { seed, system, ecc, dt, n, basis: basis.length ? basis : undefined };
}

// Build the witness ONCE, then derive the two band series for the reveal. The invariant series
// is the fitted law evaluated along the conserved trajectory (draws flat); the refusal series
// is the energy candidate along a live drag-0.02 run (visibly sags). Neither is recomputed in
// the render loop; the report already carries every number the scene shows.
async function buildScene(p) {
  const sys = SYSTEMS[p.system] || SYSTEMS.kepler;
  const ic = deriveIC(sys, seedUint32(p.seed), sys.name === "kepler" ? p.ecc : NaN);
  const bundle = await buildReport({ seed: p.seed, system: sys.name, dt: p.dt, n: p.n, basis: p.basis, ic });
  const invFn = makeFn(bundle.report.coefficients.map((c, i) => `(${c})*(${bundle.report.basis[i]})`).join("+"), sys.vars);
  const invSeries = bundle.states.map(invFn);
  const damped = simulate(sys, ic, { dt: bundle.report.dt, n: bundle.report.n, drag: REFUSAL_DRAG });
  const energyFn = makeFn(bundle.report.refusal.basis[0], sys.vars);
  const refusalSeries = damped.map(energyFn);
  axes = sys.coords.length >= 2 ? [sys.coords[0], sys.coords[1]] : [sys.vars[0], sys.vars[1]];
  return { ...bundle, invSeries, refusalSeries, verdict: null };
}

// The one composed view object; each state adds the layers it has earned. Nothing is drawn
// before it is real: the law lines appear only after the fit, the receipt only at witness.
function view(revealed) {
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

const fmtNum = (x) => (Math.abs(x) < 1e-4 && x !== 0 ? x.toExponential(0) : String(x));
const icText = (r) => r.system === "kepler"
  ? `x ${r.ic.x} . y ${r.ic.y} . vx ${r.ic.vx} . vy ${r.ic.vy}`
  : (SYSTEMS[r.system] || SYSTEMS.kepler).vars.map((k) => `${k} ${r.ic[k]}`).join(" . ");
// Render the fitted law as a readable signed sum of terms, e.g. "x*vy - y*vx". A unit
// coefficient collapses to the bare term; the sign of every term after the first is spelled out.
function fmtExpr(r) {
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

// ---- the four-state choreography ----------------------------------------------------------

function drawFrame(revealed) {
  if (!scene || !built) return;
  scene.draw(view(revealed));
}

function runMotion() {
  if (!active || !scene) return;
  const done = scene.reveal(CHUNK);
  drawFrame(done);
  if (scene.done()) { toLaw(); return; }
  raf = requestAnimationFrame(runMotion);
}

function toSeed() {
  state = "seed";
  scene.setTrajectory(built.states, axes);
  drawFrame(0);
  announce(`Kepler system, seed ${built.report.seed}. Initial condition recorded. Ground breathing in.`);
  raf = requestAnimationFrame(() => { state = "motion"; drawFrame(0); raf = requestAnimationFrame(runMotion); });
}

function toLaw() {
  state = "law";
  drawFrame(built.states.length - 1);
  const r = built.report;
  const refused = r.refusal.verdict === "refuted";
  announce(`Orbit complete. ${r.basis.join(" and ")} conserved, value ${r.invariant_value}, drift ${fmtNum(r.drift_ratio)} within tolerance ${r.verifier.tol}. Damped run ${refused ? "refused" : r.refusal.verdict} by the verifier.`);
  raf = requestAnimationFrame(() => toWitness());
}

async function toWitness() {
  state = "witness";
  const r = await recheck(built.report);
  built.verdict = r.verdict;
  drawFrame(built.states.length - 1);
  paintVerdict(r);
  paintReceipt();
  announceVerdict(r);
  settled = true;
  if (capture && typeof window !== "undefined") window.__showcaseSettled = true;
}

// Reduced motion / hero capture: skip the visible reveal but STILL integrate + fit + verify +
// hash exactly once (buildScene already did), so every number on screen is real. Settle at once.
async function settleNow() {
  state = "witness";
  scene.setTrajectory(built.states, axes);
  scene.reveal(built.states.length);
  const r = await recheck(built.report);
  built.verdict = r.verdict;
  drawFrame(built.states.length - 1);
  paintVerdict(r);
  paintReceipt();
  announceVerdict(r);
  settled = true;
  if (capture && typeof window !== "undefined") window.__showcaseSettled = true;
}

// ---- DOM readout surfaces -----------------------------------------------------------------

function announce(text) { const live = $("show-live"); if (live) live.textContent = text; }
function announceVerdict(r) {
  const r0 = built.report;
  const tail = r.verdict === "MATCH" ? "Verdict MATCH."
    : r.verdict === "DRIFT" ? "Verdict DRIFT: the recomputation diverged."
    : `Verdict UNVERIFIABLE: ${r.reason || "this environment cannot re-run the scene"}.`;
  announce(`Kepler system, seed ${r0.seed}. Orbit complete. Angular momentum ${r0.invariant_value}, conserved within tolerance ${r0.verifier.tol}. Damped run refused by the verifier. ${tail} Dominant colours near-white ceramic and ink, one iris accent.`);
}
function paintVerdict(r) {
  const el = $("show-verdict"); if (!el) return;
  el.textContent = r.verdict === "MATCH" ? "MATCH: recomputed hash equals the receipt"
    : r.verdict === "DRIFT" ? "DRIFT: " + (r.deltas || []).map((d) => d.field).slice(0, 4).join(", ")
    : "UNVERIFIABLE: " + (r.reason || "cannot re-run here");
  el.style.color = r.verdict === "MATCH" ? "var(--ember)" : "";
}
function paintReceipt() {
  const el = $("show-receipt"); if (!el || !built) return;
  const r = built.report;
  el.textContent = `report sha256 ${built.sha256 ? built.sha256.slice(0, 12) : "(unavailable)"} . ground world ${r.ground.world.id} . ${r.system} seed ${r.seed}`;
}

// ---- sizing -------------------------------------------------------------------------------

// Size the canvas backing to the rendered stage. The studio's own ResizeObserver would reset a
// hardcoded backing, so the scene owns its size via this one path and studio.js routes resizes
// here (window.__studioShowcaseResize). Capture uses a 1:1 backing (dpr forced to 1) so the
// headless 2400x1350 window is a 2400x1350 canvas exactly; in-Studio it honors devicePixelRatio.
function fitCanvasToStage() {
  if (!canvasEl || !scene) return;
  const parent = canvasEl.parentElement;
  const ref = (parent || canvasEl).getBoundingClientRect();
  const cssW = Math.max(2, Math.round(ref.width || canvasEl.clientWidth || 360));
  const cssH = Math.max(2, Math.round(ref.height || canvasEl.clientHeight || cssW));
  const dpr = capture ? 1 : Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, 2);
  scene.resize(cssW * dpr, cssH * dpr);
}

// hero=1 puts the scene in capture layout: hide the app chrome via a body class (CSS collapses
// the grid so the stage fills the full 2400x1350 frame), draw the capture composition (the
// edge-pinned display word), run the timeline once on the settle path, and set
// window.__showcaseSettled when state 4 is composed (the headless capture waits on that flag).
function applyHero() {
  capture = true;
  if (typeof document !== "undefined") document.body.classList.add("showcase-hero");
  if (scene) scene.setCapture(true);
  if (typeof window !== "undefined") window.__showcaseSettled = false;
  fitCanvasToStage();
}

// Re-fit and redraw on a stage resize (studio.js calls this from resizeActiveSurface).
export function resizeShowcase() {
  if (!active || !scene) return;
  fitCanvasToStage();
  if (built) drawFrame(built.states.length - 1);
}

// ---- lifecycle (called by studio.js setSource) --------------------------------------------

export function startShowcase(canvas) {
  canvasEl = canvas || $("studio-canvas");
  if (!canvasEl) return;
  active = true; settled = false; state = STATES[0]; built = null;
  scene = makeScene(canvasEl);
  if (typeof window !== "undefined") window.__studioShowcaseResize = resizeShowcase;
  // Hero capture mode from the head-snapshot (the Atelier boot has since rewritten the URL).
  const hero = (typeof window !== "undefined" && window.__studioBootHero) ||
    new URLSearchParams((typeof window !== "undefined" && window.location.search) || "").get("hero") === "1";
  if (hero) applyHero(); else fitCanvasToStage();
  const p = readParams();
  scene.setGround(buildGround(seedUint32(p.seed)));
  buildScene(p).then((b) => {
    if (!active) return;
    built = b;
    // The hero class reflows the grid; re-fit on the next frame so the backing matches the full
    // 2400x1350 stage before the settled frame is composed.
    if (hero) fitCanvasToStage();
    if (hero || reducedMotion()) return settleNow();
    toSeed();
  }).catch((e) => {
    announce("Showcase could not build the report: " + String((e && e.message) || e));
    const v = $("show-verdict"); if (v) v.textContent = "UNVERIFIABLE: " + String((e && e.message) || e);
    settled = true;
  });
}

export function stopShowcase() {
  active = false; settled = false; state = STATES[0];
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  if (capture && typeof document !== "undefined") document.body.classList.remove("showcase-hero");
  capture = false; scene = null; built = null; canvasEl = null;
}

// Replay states 1 to 4 from the already-built report (key R / the Replay button).
export function replayShowcase() {
  if (!active || !built || !scene) return;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  settled = false;
  if (reducedMotion()) return settleNow();
  toSeed();
}

// Read-only debug view (tests can assert the machine's shape without poking internals).
export function showcaseStateView() {
  return { active, state, settled, capture, hasReport: !!built, states: [...STATES], axes: [...axes] };
}
