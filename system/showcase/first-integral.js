// first-integral.js: the "First Integral" engine showcase, a Studio source. Owns the lifecycle,
// the four-state machine (SEED, MOTION, LAW, WITNESS), and the reveal. controls.js owns the rail +
// key map, readout.js the one-readout-three-consumers, report.js the witness. The pipeline is
// milliseconds of compute; the choreography only paces the reveal. ASCII only; no em or en dashes.
import { makeScene, buildGround, seedUint32, deriveIC } from "./orbit-render.js?v=20260701a";
import { buildReport, recheck } from "./report.js?v=20260701a";
import { buildReadout, readoutSentence, readoutJSON } from "./readout.js?v=20260701a";
import { wireShowcaseControls, downloadReportJSON } from "./controls.js?v=20260701a";
import { buildView, REFUSAL_DRAG } from "./view.js?v=20260701a";
import { SYSTEMS } from "../discovery/systems.js";
import { simulate } from "../discovery/integrator.js";
import { makeFn } from "../discovery/expr.js";

const STATES = ["seed", "motion", "law", "witness"];
const CHUNK = 60;                 // integration steps revealed per frame (~2s for 2000 steps)
const $ = (id) => document.getElementById(id);
const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

let canvasEl = null, scene = null, raf = 0, unwireControls = null;
let active = false, settled = false, capture = false, paused = false;
let state = STATES[0];
let built = null;                 // { report, states, fit, invSeries, refusalSeries, sha } after buildReport
let axes = ["x", "y"];

// The meter loop's idle gate (studio-loop.js case "showcase"): true when the scene is not animating.
export function showcaseSettled() { return !active || settled; }

// Debug/test surface behind window.__studioShowcase; a re-check before the report is built is
// honestly UNVERIFIABLE, never a faked verdict.
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

// Read the scene parameters from the rail + URL (head-snapshot seed, then URL, then rail, then
// lab canon). Kepler is the default and the only bit-hashed path.
function readParams() {
  const params = new URLSearchParams((typeof window !== "undefined" && window.location.search) || "");
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

// Build the witness ONCE, then derive the two band series for the reveal (invariant draws flat,
// the damped energy sags). Neither is recomputed in the render loop.
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

function drawFrame(revealed) {
  if (!scene || !built) return;
  scene.draw(buildView(built, state, revealed));
}

function runMotion() {
  if (!active || !scene || paused) return;
  const done = scene.reveal(CHUNK);
  drawFrame(done);
  if (scene.done()) { toLaw(); return; }
  raf = requestAnimationFrame(runMotion);
}

function toSeed() {
  state = "seed";
  scene.setTrajectory(built.states, axes);
  drawFrame(0);
  emitReadout();
  raf = requestAnimationFrame(() => { state = "motion"; drawFrame(0); emitReadout(); raf = requestAnimationFrame(runMotion); });
}

function toLaw() {
  state = "law";
  drawFrame(built.states.length - 1);
  emitReadout();
  raf = requestAnimationFrame(() => toWitness());
}

// The WITNESS tail shared by the played and the settled paths: re-check, paint, announce, settle.
async function finishWitness() {
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
const toWitness = () => finishWitness();

// Reduced motion / hero capture: skip the visible reveal but STILL integrate + fit + verify + hash
// exactly once (buildScene already did), so every number is real. Reveal the full trace, then settle.
async function settleNow() {
  scene.setTrajectory(built.states, axes);
  scene.reveal(built.states.length);
  return finishWitness();
}

// The pixel bridge for the readout's sense-core measurement (the showcase composites into a
// Canvas2D, so a direct getImageData is correct even where a WebGL backing could not be read).
function readShowcasePixels(cv, w, h) {
  try { return cv.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data; }
  catch (_) { return null; }
}

// ONE readout per state change, three consumers (spec 3.2): the aria-live sentence, the model
// channel JSON (published for buildCtx behind Studio.connectModel), and the measurimeter (its own path).
function emitReadout(verdict) {
  if (!built) return null;
  const readout = buildReadout({
    report: built.report, state, verdict: verdict || built.verdict || null,
    receiptSha: built.sha256, canvas: canvasEl, readPixels: readShowcasePixels,
  });
  const live = $("show-live"); if (live) live.textContent = readoutSentence(readout);
  if (typeof window !== "undefined") window.__studioShowcaseReadout = readoutJSON(readout);
  return readout;
}
// Plain sentence announce for the pre-report / error path (no report yet, so no readout facts).
function announce(text) { const live = $("show-live"); if (live) live.textContent = text; }
function announceVerdict(r) { emitReadout(r && r.verdict); }
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

// Size the canvas backing to the stage; the scene owns its size (studio.js routes resizes here via
// window.__studioShowcaseResize). Capture forces dpr 1 so the headless 2400x1350 window is exact.
function fitCanvasToStage() {
  if (!canvasEl || !scene) return;
  const parent = canvasEl.parentElement;
  const ref = (parent || canvasEl).getBoundingClientRect();
  const cssW = Math.max(2, Math.round(ref.width || canvasEl.clientWidth || 360));
  const cssH = Math.max(2, Math.round(ref.height || canvasEl.clientHeight || cssW));
  const dpr = capture ? 1 : Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, 2);
  scene.resize(cssW * dpr, cssH * dpr);
}

// hero=1 puts the scene in capture layout: a body class collapses the grid to the full frame, the
// capture composition draws the display word, the timeline settles once, and __showcaseSettled arms.
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

// Lifecycle (called by studio.js setSource).
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
  loadScene(readParams(), hero);
  if (!hero && typeof document !== "undefined") unwireControls = wireShowcaseControls(controlCallbacks());
}

// Build (or rebuild) the ground + report for the params, then play or settle. Shared by the
// initial start and every control-driven rebuild (seed edit, system cycle, term change).
function loadScene(p, hero) {
  scene.setGround(buildGround(seedUint32(p.seed)));
  buildScene(p).then((b) => {
    if (!active) return;
    built = b; settled = false;
    if (hero) fitCanvasToStage();
    if (hero || reducedMotion()) return settleNow();
    toSeed();
  }).catch((e) => {
    announce("Showcase could not build the report: " + String((e && e.message) || e));
    const v = $("show-verdict"); if (v) v.textContent = "UNVERIFIABLE: " + String((e && e.message) || e);
    settled = true;
  });
}

// The keyboard + rail callbacks (spec 3.1); rebuild re-reads the rail and integrates again.
function controlCallbacks() {
  return {
    rebuild: () => { if (!active) return; if (raf) { cancelAnimationFrame(raf); raf = 0; } loadScene(readParams(), false); },
    replay: () => replayShowcase(),
    reverify: () => { recheckShowcase(); },
    export: () => { if (built) downloadReportJSON(built); },
    spaceToggle: () => spaceToggle(),
  };
}

// Space: pause freezes the reveal loop, resume continues it, mirroring the rt-playpause button.
function spaceToggle() {
  if (!active || !scene) return;
  paused = !paused;
  const pp = $("rt-playpause");
  if (pp) { pp.setAttribute("aria-pressed", String(paused)); const l = $("rt-playpause-label"); if (l) l.textContent = paused ? "Play" : "Pause"; }
  if (paused) { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  else if (!settled && state === "motion") { raf = requestAnimationFrame(runMotion); }
}

export function stopShowcase() {
  active = false; settled = false; paused = false; state = STATES[0];
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  if (unwireControls) { try { unwireControls(); } catch (_) {} unwireControls = null; }
  if (capture && typeof document !== "undefined") document.body.classList.remove("showcase-hero");
  capture = false; scene = null; built = null; canvasEl = null;
}

// Replay states 1 to 4 from the already-built report (key R / the Replay button).
export function replayShowcase() {
  if (!active || !built || !scene) return;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  settled = false; paused = false;
  if (reducedMotion()) return settleNow();
  toSeed();
}

// Read-only debug view (tests can assert the machine's shape without poking internals).
export function showcaseStateView() {
  return { active, state, settled, capture, hasReport: !!built, states: [...STATES], axes: [...axes] };
}
