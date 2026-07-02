// first-integral.js: the "First Integral" engine showcase, integrated as a Studio source
// ("Showcase", Verify group). Source lifecycle (startShowcase/stopShowcase), the four-state
// machine (SEED, MOTION, LAW, WITNESS), control + keyboard wiring, and the aria-live feed.
//
// WAVE 1 SKELETON: startShowcase draws one labeled settled placeholder frame and flips the
// settled flag immediately, so the meter loop idles (studio-loop.js gates on showcaseSettled).
// Wave 2 lands the real modules this file will drive:
//   ./orbit-render.js  ground World (vendored reconcile flowfield) + accumulating ink polyline
//   ./report.js        shipped IC literals, integrate + fit + verify, canonical JSON, SHA-256
//   ./readout.js       one structured readout, two renderings (aria-live sentences, model JSON)
// The rail controls (#show-seed .. #show-doc in studio.html) are present but inert until wave 2.
// Self-managed start/stop, driven by studio.js setSource. ASCII only; no em or en dashes.

const STATES = ["seed", "motion", "law", "witness"];
const LAB = { system: "kepler", seed: "1", dt: 0.004, n: 2000, tol: 0.05 };

const $ = (id) => document.getElementById(id);

let canvasEl = null;
let active = false;
let state = STATES[0];
let settled = false;

// The meter loop's idle gate (studio-loop.js case "showcase" reads this through the
// state object studio.js builds each tick). True whenever the scene is not animating.
export function showcaseSettled() {
  return !active || settled;
}

// Debug/test surface behind window.__studioShowcase (assigned by studio.js, following the
// __studio* convention). Wave 2 replaces these stubs with the real report/verdict/recheck
// from ./report.js. The stub never fakes a verdict: with no report built yet, a re-check
// is honestly UNVERIFIABLE.
export function showcaseReport() {
  return null;
}
export function showcaseVerdict() {
  return "unverified";
}
export function recheckShowcase() {
  return { verdict: "UNVERIFIABLE", reason: "wave 1 skeleton: no report built yet" };
}

// One labeled settled placeholder frame: page ceramic, mono seed line, display word,
// and an honest skeleton note. Replaced by the real four-state scene in wave 2.
function drawPlaceholder(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  const u = Math.max(1, Math.min(w, h) / 360);   // scale unit relative to the default 360 backing

  ctx.save();
  ctx.fillStyle = "#f4f3ef";                     // the page ceramic (--paper)
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#0b0c0e";                     // ink
  ctx.textBaseline = "alphabetic";

  // Seed line, mono, always rendered first (spec 2.2).
  ctx.font = `${Math.round(11 * u)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.fillText(`seed ${LAB.seed} . ${LAB.system} . dt ${LAB.dt} . n ${LAB.n}`, Math.round(18 * u), Math.round(26 * u));

  // The display word for the settled frame.
  ctx.font = `600 ${Math.round(30 * u)}px Archivo, system-ui, sans-serif`;
  ctx.fillText("FIRST INTEGRAL", Math.round(18 * u), Math.round(h / 2));

  // Hairline rule under the display word.
  ctx.fillRect(Math.round(18 * u), Math.round(h / 2 + 10 * u), Math.round(w - 36 * u), 1);

  // Honest skeleton note: no orbit, no fit, no receipt exists yet, and nothing pretends to.
  ctx.font = `${Math.round(11 * u)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.fillText("wave 1 skeleton . states seed / motion / law / witness land in wave 2", Math.round(18 * u), Math.round(h / 2 + 30 * u));
  ctx.fillText("no receipt yet . re-check is UNVERIFIABLE by construction", Math.round(18 * u), Math.round(h / 2 + 48 * u));

  // The single iris accent, one use only: the placeholder body dot.
  ctx.fillStyle = "#4636e8";
  ctx.beginPath();
  ctx.arc(Math.round(w - 40 * u), Math.round(36 * u), Math.max(2, 3 * u), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Announce once per state change (aria-live="polite" on #show-live). Wave 3 routes the
// full readout through here; wave 1 announces only the settled placeholder.
function announce(text) {
  const live = $("show-live");
  if (live) live.textContent = text;
}

// called by studio.js when the "showcase" source is entered
export function startShowcase(canvas) {
  canvasEl = canvas || $("studio-canvas");
  if (!canvasEl) return;
  active = true;
  // Wave 1: no choreography yet; jump straight to the settled frame.
  state = "witness";
  settled = true;
  drawPlaceholder(canvasEl);
  announce(`Showcase skeleton. Kepler system, seed ${LAB.seed}. The live First Integral scene arrives in wave 2.`);
  const verdictEl = $("show-verdict");
  if (verdictEl) verdictEl.textContent = "no verdict yet: the report module lands in wave 2";
  const receiptEl = $("show-receipt");
  if (receiptEl) receiptEl.textContent = "no receipt yet";
}

// called by studio.js when leaving the source
export function stopShowcase() {
  active = false;
  settled = false;
  state = STATES[0];
  canvasEl = null;
}

// Read-only debug view (tests can assert the machine's shape without poking internals).
export function showcaseStateView() {
  return { active, state, settled, states: [...STATES], lab: { ...LAB } };
}
