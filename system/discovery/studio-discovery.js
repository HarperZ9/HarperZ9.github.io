// studio-discovery.js: the discovery engine, integrated as a Studio source ("Physics").
//
// Renders the chosen physical system, evolving, into the shared #studio-canvas, so the Studio's
// measurimeter perceives it exactly like any other source. The discovery controls (system, candidate
// terms, verify) and the witnessed conserved-law certificate live in the source's rail block. The
// model proposes the terms; a tool fits the weights; the sound verifier certifies across independent
// initial conditions; the conserved value is shown holding (tiny drift) as the system moves.
// Self-managed start/stop, driven by studio.js setSource. Zero dependencies beyond the engine.
import { SYSTEMS, rng } from "./systems.js";
import { QSYSTEMS } from "./quantum-system.js";
import { trajectory } from "./integrator.js";
import { makeTools } from "./tools.js";
import { makeFn } from "./expr.js";
import { makeGrid, gaussianPacket, observables, step as qstep } from "./quantum.js";
import { solveLoop } from "./llm.js";
import { conservationArtifact } from "./discovery-io.js";

const ALL = { ...SYSTEMS, ...QSYSTEMS };
const OPTS = {
  sho: { seed: 1, dt: 0.01, n: 1500, trials: 6, tol: 0.02 },
  pendulum: { seed: 1, dt: 0.01, n: 1500, trials: 6, tol: 0.02 },
  kepler: { seed: 1, dt: 0.004, n: 2000, trials: 6, tol: 0.05 },
  oscillator2d: { seed: 1, dt: 0.01, n: 1500, trials: 6, tol: 0.02 },
  twoBody: { seed: 1, dt: 0.01, n: 1500, trials: 6, tol: 0.02 },
  qho: { seed: 1, dt: 0.01, n: 400, trials: 5, tol: 0.05 },
  free: { seed: 1, dt: 0.02, n: 200, trials: 5, tol: 0.05 },
};
const HINTS = {
  sho: "x^2, v^2", pendulum: "w^2, cos(theta), theta^2", kepler: "x*vy, y*vx",
  oscillator2d: "x^2, y^2, vx^2, vy^2, x*vy, y*vx", twoBody: "v1, v2", qho: "x, x2, p, p2", free: "x, x2, p, p2",
};
const SYSLIST = ["sho", "pendulum", "kepler", "oscillator2d", "twoBody", "qho", "free"];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

let wired = false, canvasEl = null, raf = null, frame = 0, trail = [], cur = null;
let psi = null, qgrid = null, qV = null;

function buildSystem(name) {
  const system = ALL[name], opts = OPTS[name];
  const tools = makeTools(system, opts);
  cur = { name, system, opts, tools, states: trajectory(system, system.sampleState(rng(opts.seed)), opts), lawFn: null, lawExpr: null, lawBand: null };
  frame = 0; trail = []; psi = null; qgrid = null; qV = null;
  if (system.quantum) {
    qgrid = makeGrid(system.gridN, system.gridL);
    qV = qgrid.x.map(system.Vfn);
    psi = gaussianPacket(qgrid, name === "free" ? { x0: -6, sigma: 1.6, p0: 0.9 } : { x0: 2.2, sigma: 1, p0: 0 });
  }
  if ($("disc-terms")) $("disc-terms").value = HINTS[name] || "";
  if ($("disc-result")) $("disc-result").textContent = "";
  if ($("disc-cert")) $("disc-cert").innerHTML = "";
  document.querySelectorAll("#disc-systems [data-disc-system]").forEach((b) => b.classList.toggle("active", b.dataset.discSystem === name));
}

function doDiscover() {
  if (!cur) return;
  const terms = ($("disc-terms").value || "").split(",").map((s) => s.trim()).filter(Boolean);
  const r = cur.tools.fit(terms);
  if (!r.ok) { $("disc-result").textContent = "fit failed: " + r.reason; $("disc-cert").innerHTML = ""; return; }
  $("disc-result").textContent = `Q = ${r.expr}\nverdict: ${r.verdict}   score: ${r.conservationScore}`;
  if (r.verdict === "verified") {
    cur.lawExpr = r.expr; cur.lawBand = null;
    try { cur.lawFn = makeFn(r.expr, cur.system.vars); } catch { cur.lawFn = null; }
    const cert = cur.tools.submit(r.expr);
    cur.lastCert = cert;
    $("disc-cert").innerHTML =
      `<div style="color:#7ad13d;font-weight:600;letter-spacing:.04em">CERTIFIED CONSERVED</div>` +
      `<div><b>criterion</b> ${esc(cert.criterion)}</div>` +
      `<div><b>claim</b> ${esc(cert.claim)}</div>` +
      `<div><b>verdict</b> ${esc(cert.verdict)} &middot; certified ${cert.certified}</div>`;
  } else {
    cur.lawFn = null;
    $("disc-cert").innerHTML = `<div style="color:#d6603d;font-weight:600">not conserved (refused)</div>`;
  }
}

function fitCanvas() {
  if (!canvasEl) return;
  const stage = $("viewport-stage"), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = (stage && stage.clientWidth) || 640, h = (stage && stage.clientHeight) || 400;
  canvasEl.width = Math.max(2, Math.round(w * dpr));
  canvasEl.height = Math.max(2, Math.round(h * dpr));
}

const dot = (ctx, x, y, r, c) => { ctx.fillStyle = c || "#e8a33d"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };

function drawConfig(ctx, W, H, name, s) {
  if (name === "sho") {
    const y = H / 2, px = W / 2 + s.x * (W * 0.3);
    ctx.strokeStyle = "#444"; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); dot(ctx, px, y, 11);
  } else if (name === "pendulum") {
    const px = W / 2, py = H * 0.22, L = H * 0.5, bx = px + L * Math.sin(s.theta), by = py + L * Math.cos(s.theta);
    ctx.strokeStyle = "#666"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke(); dot(ctx, bx, by, 11);
  } else if (name === "kepler" || name === "oscillator2d") {
    const sc = Math.min(W, H) * 0.30, cx = W / 2, cy = H / 2;
    trail.push([cx + s.x * sc, cy + s.y * sc]); if (trail.length > 300) trail.shift();
    ctx.strokeStyle = "#3dd6c4"; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.beginPath();
    trail.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.globalAlpha = 1;
    if (name === "kepler") dot(ctx, cx, cy, 7, "#d6603d");
    const last = trail[trail.length - 1]; dot(ctx, last[0], last[1], 8);
  } else if (name === "twoBody") {
    const y = H / 2, sc = W * 0.22, cx = W / 2;
    ctx.strokeStyle = "#444"; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    const ax = cx + s.x1 * sc, bx = cx + s.x2 * sc;
    ctx.strokeStyle = "#3dd6c4"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax, y); ctx.lineTo(bx, y); ctx.stroke();
    dot(ctx, ax, y, 9, "#e8a33d"); dot(ctx, bx, y, 9, "#9b8cff");
  } else {
    ctx.fillStyle = "#8a8a96"; ctx.font = "14px monospace"; ctx.fillText("(no real-space view)", 14, H / 2);
  }
}

function drawWave(ctx, W, H) {
  const re = psi.re, im = psi.im, N = qgrid.N;
  let vmax = 0; for (const v of qV) if (Number.isFinite(v) && v < 1e3 && v > vmax) vmax = v; vmax = vmax || 1;
  ctx.strokeStyle = "#444"; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * W, vy = H - 8 - (Math.min(qV[i], vmax) / vmax) * (H * 0.4); i ? ctx.lineTo(x, vy) : ctx.moveTo(x, vy); }
  ctx.stroke();
  let pmax = 1e-9; const dens = new Array(N);
  for (let i = 0; i < N; i++) { dens[i] = re[i] * re[i] + im[i] * im[i]; if (dens[i] > pmax) pmax = dens[i]; }
  ctx.fillStyle = "rgba(232,163,61,0.35)"; ctx.strokeStyle = "#e8a33d"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, H);
  for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * W, y = H - 8 - (dens[i] / pmax) * (H * 0.78); ctx.lineTo(x, y); }
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill(); ctx.stroke();
}

function updateLive(state) {
  const el = $("disc-live"); if (!el) return;
  if (!cur.lawFn) { el.textContent = "discover a conserved quantity above; watch it hold as the system evolves"; return; }
  const v = cur.lawFn(state);
  cur.lawBand = cur.lawBand ? [Math.min(cur.lawBand[0], v), Math.max(cur.lawBand[1], v)] : [v, v];
  el.innerHTML = `<b>conserved</b> ${esc(cur.lawExpr)} = <b>${v.toFixed(4)}</b> &middot; drift ${(cur.lawBand[1] - cur.lawBand[0]).toExponential(2)}`;
}

function frameTick() {
  if (!canvasEl || !cur) return;
  const ctx = canvasEl.getContext("2d"), W = canvasEl.width, H = canvasEl.height;
  ctx.fillStyle = "#0c0c10"; ctx.fillRect(0, 0, W, H);
  if (cur.system.quantum) {
    for (let s = 0; s < 3; s++) qstep(psi, qgrid, qV, 0.02);
    drawWave(ctx, W, H);
    updateLive(observables(psi, qgrid, qV));
  } else {
    frame = (frame + 4) % cur.states.length;
    const st = cur.states[frame] || cur.states[0];
    drawConfig(ctx, W, H, cur.name, st);
    updateLive(st);
  }
}

function animate() { frameTick(); raf = requestAnimationFrame(animate); }

// A browser chat backend over the Studio's connected model (OpenAI-compatible /v1/chat/completions,
// which local Ollama and LM Studio also serve). Reads the model-connect inputs already in the chat dock.
function openaiChat(endpoint, key, model) {
  return async (messages) => {
    const headers = { "Content-Type": "application/json" };
    if (key) headers["Authorization"] = "Bearer " + key;
    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ model, messages, temperature: 0.2, stream: false }) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  };
}

// Watch the connected model discover the conserved quantity live, in the Studio.
async function runModelDiscovery() {
  if (!cur) return;
  const endpoint = (($("mc-endpoint") || {}).value || "").trim();
  if (!endpoint) {
    $("disc-result").textContent = "Connect a model first: open 'Advanced: connect a model' in the chat dock (a local Ollama or LM Studio endpoint works). Then I will watch it discover.";
    return;
  }
  const key = (($("mc-key") || {}).value || "").trim();
  const model = ((($("mc-model") || {}).value || "").trim()) || "local";
  $("disc-cert").innerHTML = "";
  $("disc-result").textContent = "the model is perceiving the data and proposing laws...";
  try {
    const r = await solveLoop(cur.tools, { maxSteps: 10, chat: openaiChat(endpoint, key, model), log: (m) => { $("disc-result").textContent = m; } });
    if (r.error) { $("disc-result").textContent = "could not reach the model: " + r.error; return; }
    if (r.solved) {
      cur.lawExpr = r.submittedExpr; cur.lawBand = null;
      try { cur.lawFn = makeFn(r.submittedExpr, cur.system.vars); } catch { cur.lawFn = null; }
      const c = r.certificate;
      cur.lastCert = c;
      $("disc-result").textContent = "the model discovered: " + r.submittedExpr;
      $("disc-cert").innerHTML =
        `<div style="color:#7ad13d;font-weight:600;letter-spacing:.04em">CERTIFIED CONSERVED (discovered live)</div>` +
        `<div><b>criterion</b> ${esc(c.criterion)}</div><div><b>claim</b> ${esc(c.claim)}</div>`;
    } else {
      $("disc-result").textContent = "the model did not land a conserved quantity this run; the verifier refused its guesses (the floor held).";
    }
  } catch (e) { $("disc-result").textContent = "could not reach the model: " + (e && e.message ? e.message : e); }
}

// Export the discovered law as a witnessed artifact other flagships can ingest and re-verify.
function exportArtifact() {
  if (!cur || !cur.lawExpr || !cur.lastCert) { $("disc-result").textContent = "discover a verified law first, then export it as a witnessed artifact."; return; }
  const art = conservationArtifact(cur.name, cur.lawExpr, cur.lastCert, cur.opts);
  const blob = new Blob([JSON.stringify(art, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `telos-${cur.name}-law.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function wire() {
  if (wired) return;
  wired = true;
  const host = $("disc-systems");
  if (host && !host.children.length) {
    for (const n of SYSLIST) { const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.dataset.discSystem = n; b.textContent = n; host.appendChild(b); }
  }
  if (host) host.addEventListener("click", (e) => { const b = e.target.closest("[data-disc-system]"); if (b) buildSystem(b.dataset.discSystem); });
  const fitBtn = $("disc-fit");
  if (fitBtn) fitBtn.addEventListener("click", doDiscover);
  const modelBtn = $("disc-model");
  if (modelBtn) modelBtn.addEventListener("click", runModelDiscovery);
  const exportBtn = $("disc-export");
  if (exportBtn) exportBtn.addEventListener("click", exportArtifact);
}

// called by studio.js when the "discovery" source is entered
export function startDiscovery(canvas) {
  canvasEl = canvas || $("studio-canvas");
  wire();
  if (!cur) buildSystem("sho");
  fitCanvas();
  if (raf == null) raf = requestAnimationFrame(animate);
}

// called by studio.js when leaving the source
export function stopDiscovery() {
  if (raf != null) { cancelAnimationFrame(raf); raf = null; }
}
