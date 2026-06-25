// lab.js: the discovery engine, live in the browser. Renders the PHYSICAL-observable measurimeter
// (the state/moments the model perceives, not pixels), runs fit -> sound verifier -> certificate
// live, and supports the bidirectional loop: perturb the initial condition, re-perceive, re-verify
// the law still holds. Self-contained: imports the discovery ES modules directly, zero build step.
import { SYSTEMS, rng } from "./systems.js";
import { QSYSTEMS } from "./quantum-system.js";
import { trajectory } from "./integrator.js";
import { makeTools } from "./tools.js";
import { makeFn } from "./expr.js";
import { makeGrid, gaussianPacket, observables, step as qstep } from "./quantum.js";

const ALL = { ...SYSTEMS, ...QSYSTEMS };
const OPTS = {
  sho: { seed: 1, dt: 0.01, n: 1500, trials: 6, tol: 0.02 },
  pendulum: { seed: 1, dt: 0.01, n: 1500, trials: 6, tol: 0.02 },
  kepler: { seed: 1, dt: 0.004, n: 2000, trials: 6, tol: 0.05 },
  oscillator2d: { seed: 1, dt: 0.01, n: 1500, trials: 6, tol: 0.02 },
  qho: { seed: 1, dt: 0.01, n: 400, trials: 5, tol: 0.05 },
  free: { seed: 1, dt: 0.02, n: 200, trials: 5, tol: 0.05 },
  twoBody: { seed: 1, dt: 0.01, n: 1500, trials: 6, tol: 0.02 },
};
// suggested candidate term libraries (the act a solving model performs; here, a starting point)
const HINTS = {
  sho: "x^2, v^2", pendulum: "w^2, cos(theta), theta^2", kepler: "x*vy, y*vx",
  oscillator2d: "x^2, y^2, vx^2, vy^2, x*vy, y*vx", qho: "x, x2, p, p2", free: "x, x2, p, p2",
  twoBody: "v1, v2",
};
const COLORS = ["#e8a33d", "#3dd6c4", "#d6603d", "#9b8cff", "#7ad13d", "#d63d9b"];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
let cur = null;

function run(name) {
  stopAnim();
  $("system").value = name; // keep the dropdown in sync with the active system
  const system = ALL[name], opts = { ...OPTS[name] };
  const tools = makeTools(system, opts);
  const states = trajectory(system, system.sampleState(rng(opts.seed)), opts);
  cur = { name, system, opts, tools, states, lawFn: null, lawExpr: null, lawBand: null };
  drawObservables(system, states);
  drawRanges(tools.perception);
  $("terms").value = HINTS[name] || "";
  $("result").textContent = "";
  $("cert").innerHTML = "";
  setupAnim();
}

function drawObservables(system, states) {
  const cv = $("scope"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.fillStyle = "#0c0c10"; ctx.fillRect(0, 0, W, H);
  system.vars.forEach((v, vi) => {
    const vals = states.map((s) => s[v]);
    let mn = Math.min(...vals), mx = Math.max(...vals);
    if (mx - mn < 1e-9) mx = mn + 1;
    ctx.strokeStyle = COLORS[vi % COLORS.length]; ctx.lineWidth = 1.5; ctx.beginPath();
    states.forEach((s, i) => {
      const x = (i / (states.length - 1)) * W;
      const y = H - ((s[v] - mn) / (mx - mn)) * (H - 12) - 6;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = COLORS[vi % COLORS.length]; ctx.font = "12px monospace";
    ctx.fillText(v, 8, 16 + vi * 15);
  });
}

function drawRanges(p) {
  $("ranges").innerHTML = p.variables
    .map((v) => `<div><b>${esc(v)}</b>: [${p.ranges[v].min}, ${p.ranges[v].max}] mean ${p.ranges[v].mean}</div>`)
    .join("");
}

function doFit() {
  if (!cur) return;
  const terms = $("terms").value.split(",").map((s) => s.trim()).filter(Boolean);
  const r = cur.tools.fit(terms);
  if (!r.ok) { $("result").textContent = `fit failed: ${r.reason}`; $("cert").innerHTML = ""; return; }
  $("result").textContent = `formula: ${r.expr}\nverdict: ${r.verdict}    conservation score: ${r.conservationScore}`;
  if (r.verdict === "verified") {
    cur.lawExpr = r.expr;
    try { cur.lawFn = makeFn(r.expr, cur.system.vars); cur.lawBand = null; } catch { cur.lawFn = null; }
    const cert = cur.tools.submit(r.expr);
    $("cert").innerHTML =
      `<div class="ok" id="verdict">CERTIFIED CONSERVED</div>` +
      `<div><span class="k">quantity</span> ${esc(cert.claim)}</div>` +
      `<div><span class="k">criterion</span> ${esc(cert.criterion)}</div>` +
      `<div><span class="k">verdict</span> ${esc(cert.verdict)} &nbsp; <span class="k">certified</span> ${cert.certified}</div>`;
  } else {
    $("cert").innerHTML = `<div class="no" id="verdict">not conserved (refused)</div>`;
  }
}

// bidirectional: change the initial condition, re-perceive, and re-verify the same law holds.
function perturb() {
  if (!cur) return;
  cur.opts.seed += 1;
  cur.tools = makeTools(cur.system, cur.opts);
  cur.states = trajectory(cur.system, cur.system.sampleState(rng(cur.opts.seed)), cur.opts);
  drawObservables(cur.system, cur.states);
  drawRanges(cur.tools.perception);
  doFit();
}

// ── live physical renderer: watch the system evolve while the conserved quantity holds ──
let raf = null, frame = 0, trail = [], psi = null, qgrid = null, qV = null;

function stopAnim() { if (raf) { cancelAnimationFrame(raf); raf = null; } const b = $("play"); if (b) b.textContent = "play"; }

function setupAnim() {
  frame = 0; trail = []; psi = null; qgrid = null; qV = null;
  if (cur.system.quantum) {
    qgrid = makeGrid(cur.system.gridN, cur.system.gridL);
    qV = qgrid.x.map(cur.system.Vfn);
    psi = gaussianPacket(qgrid, cur.name === "free" ? { x0: -6, sigma: 1.6, p0: 0.9 } : { x0: 2.2, sigma: 1, p0: 0 });
  }
  drawWorldFrame(false);
}

function togglePlay() { if (raf) stopAnim(); else { $("play").textContent = "pause"; raf = requestAnimationFrame(animate); } }
function animate() { drawWorldFrame(true); raf = requestAnimationFrame(animate); }

function drawWorldFrame(advance) {
  const cv = $("world"), ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
  ctx.fillStyle = "#0c0c10"; ctx.fillRect(0, 0, W, H);
  if (cur.system.quantum) {
    if (advance) for (let s = 0; s < 3; s++) qstep(psi, qgrid, qV, 0.02);
    drawWave(ctx, W, H);
    updateLive(observables(psi, qgrid, qV));
  } else {
    if (advance) frame = (frame + 4) % cur.states.length;
    const st = cur.states[frame] || cur.states[0];
    drawConfig(ctx, W, H, cur.name, st);
    updateLive(st);
  }
}

function updateLive(state) {
  if (!cur.lawFn) { $("live").textContent = "fit a conserved quantity, then press play to watch it hold"; return; }
  const v = cur.lawFn(state);
  cur.lawBand = cur.lawBand ? [Math.min(cur.lawBand[0], v), Math.max(cur.lawBand[1], v)] : [v, v];
  const drift = cur.lawBand[1] - cur.lawBand[0];
  $("live").innerHTML = `<span class="k">conserved</span> ${esc(cur.lawExpr)} = <b>${v.toFixed(4)}</b> &nbsp; <span class="k">drift over the motion</span> ${drift.toExponential(2)}`;
}

const dot = (ctx, x, y, r, c) => { ctx.fillStyle = c || "#e8a33d"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };

function drawConfig(ctx, W, H, name, s) {
  if (name === "sho") {
    const cx = W / 2, y = H / 2, px = cx + s.x * (W * 0.3);
    ctx.strokeStyle = "#444"; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    dot(ctx, px, y, 9);
  } else if (name === "pendulum") {
    const px = W / 2, py = H * 0.22, L = H * 0.5;
    const bx = px + L * Math.sin(s.theta), by = py + L * Math.cos(s.theta);
    ctx.strokeStyle = "#666"; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke(); dot(ctx, bx, by, 9);
  } else if (name === "kepler" || name === "oscillator2d") {
    const sc = Math.min(W, H) * 0.30, cx = W / 2, cy = H / 2;
    trail.push([cx + s.x * sc, cy + s.y * sc]); if (trail.length > 260) trail.shift();
    ctx.strokeStyle = "#3dd6c4"; ctx.globalAlpha = 0.5; ctx.beginPath();
    trail.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.globalAlpha = 1;
    if (name === "kepler") dot(ctx, cx, cy, 6, "#d6603d");
    const last = trail[trail.length - 1]; dot(ctx, last[0], last[1], 7);
  } else {
    ctx.fillStyle = "#8a8a96"; ctx.font = "13px monospace"; ctx.fillText("(no real-space view for " + name + ")", 12, H / 2);
  }
}

function drawWave(ctx, W, H) {
  const re = psi.re, im = psi.im, N = qgrid.N;
  let vmax = 0; for (const v of qV) if (Number.isFinite(v) && v < 1e3 && v > vmax) vmax = v; vmax = vmax || 1;
  ctx.strokeStyle = "#444"; ctx.beginPath();
  for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * W, vy = H - 6 - (Math.min(qV[i], vmax) / vmax) * (H * 0.4); i ? ctx.lineTo(x, vy) : ctx.moveTo(x, vy); }
  ctx.stroke();
  let pmax = 1e-9; const dens = new Array(N);
  for (let i = 0; i < N; i++) { dens[i] = re[i] * re[i] + im[i] * im[i]; if (dens[i] > pmax) pmax = dens[i]; }
  ctx.fillStyle = "rgba(232,163,61,0.35)"; ctx.strokeStyle = "#e8a33d"; ctx.beginPath(); ctx.moveTo(0, H);
  for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * W, y = H - 6 - (dens[i] / pmax) * (H * 0.8); ctx.lineTo(x, y); }
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#8a8a96"; ctx.font = "12px monospace"; ctx.fillText("|psi(x)|^2 evolving", 10, 16);
}

window.addEventListener("DOMContentLoaded", () => {
  const sel = $("system");
  Object.keys(ALL).forEach((n) => { const o = document.createElement("option"); o.value = n; o.textContent = n; sel.appendChild(o); });
  sel.addEventListener("change", () => run(sel.value));
  $("fit").addEventListener("click", doFit);
  $("perturb").addEventListener("click", perturb);
  $("play").addEventListener("click", togglePlay);
  run("sho"); // explicit initial system (run() sets the dropdown), regardless of any restored form state
});
