// orbit-render.js: the First Integral five-layer composition (spec 2.1, D7, D8).
//   L1 the page ceramic . L2 reconcile flowfield ground World rendered ONCE at t=0 by its
//   verified GLSL program (CPU sampleField coarse gradient fallback, plain ceramic last resort) .
//   L3 accumulating ink polyline, per-segment low-alpha darkening, never additive glow .
//   L4 the single iris accent (moving body dot + fitted-invariant hairline; the verdict chip is
//   the UI layer's third use, drawn on-canvas only in the capture layout) .
//   L5 mono type, plus the hero=1 capture layout with the edge-pinned Kilon display word.
// Module top level is DOM-free so report.js (wave 2B) and node tests can import the pure
// helpers (seedUint32, deriveIC, groundWorld, CERAMIC_RAMP). ASCII only; no em or en dashes.
import { create, getOrgan, makeLayer, makeArtifact, expr } from "../lib/reconcile/index.js";
import { rng } from "../discovery/systems.js";

export const PAPER = "#f4f3ef";
export const INK = "#0b0c0e";
export const IRIS = "#4636e8";
export const CERAMIC_RAMP = ["#f4f3ef", "#f1f0eb", "#eeede7", "#ebeae4", "#e9e8e1", "#edece6"];
export const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
export const DISPLAY = '"Kilon", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Seed handling (spec 2.2): any string; a plain decimal integer passes through unchanged
// (seed "1" is the lab canon 1); anything else hashes FNV-1a to uint32 for rng.
// report.js must use the SAME mapping so the receipt and the scene agree.
export function seedUint32(s) {
  const str = String(s == null ? "" : s).trim() || "1";
  if (/^\d{1,9}$/.test(str)) return Number(str) >>> 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// IC derivation (spec 2.2 + D2): seeded like systems.js sampleState, then recorded as r6
// decimal literals; every integration runs FROM THE LITERALS, so trig in the derivation can
// never poison a verdict. For kepler the ecc control replaces sampleState's seeded speed draw:
// a sub-circular tangential launch at seeded radius/angle makes the slider the orbit
// eccentricity exactly (e = 1 - r v^2 / mu). Pass a non-finite ecc for pure sampleState.
export function deriveIC(system, seedU32, ecc) {
  let ic;
  if (system.name === "kepler" && Number.isFinite(ecc)) {
    const r = rng(seedU32);
    const radius = 0.9 + (1.3 - 0.9) * r();
    const ang = 2 * Math.PI * r();
    const e = Math.max(0, Math.min(0.8, ecc));
    const speed = Math.sqrt((system.params.mu / radius) * (1 - e));
    ic = { x: radius * Math.cos(ang), y: radius * Math.sin(ang), vx: -speed * Math.sin(ang), vy: speed * Math.cos(ang) };
  } else {
    ic = system.sampleState(rng(seedU32));
  }
  const out = {};
  for (const k of system.vars) out[k] = r6(ic[k]);
  return out;
}

// The ground World (D7): the verified reconcile flowfield at DEFAULT create() options, so the
// World id and receipt are reproducible from the seed alone. report.js embeds this same call.
export function groundWorld(seedU32) {
  return create("flowfield", { seed: seedU32 });
}

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Render the layer's shipped GLSL fragment ONCE at t=0 to an offscreen canvas
// (u_palette upload per the reconcile web harness precedent in reconcile/web/app.js).
function renderGroundGL(rp, px) {
  const glc = document.createElement("canvas");
  glc.width = px; glc.height = px;
  const gl = glc.getContext("webgl", { antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error("no webgl");
  const sh = (t, src) => {
    const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(String(gl.getShaderInfoLog(s)));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, rp.source));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(String(gl.getProgramInfoLog(prog)));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const pal = rp.uniforms.u_palette.flatMap((h) => hexRgb(h).map((c) => c / 255));
  const vr = rp.value_range || [-1, 1];
  gl.viewport(0, 0, px, px);
  gl.uniform2f(U("u_resolution"), px, px);
  gl.uniform2f(U("u_value_range"), vr[0], vr[1]);
  gl.uniform3fv(U("u_palette[0]"), new Float32Array(pal));
  gl.uniform1f(U("u_time"), 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const out = document.createElement("canvas");
  out.width = px; out.height = px;
  out.getContext("2d").drawImage(glc, 0, 0);
  const lose = gl.getExtension("WEBGL_lose_context");
  if (lose) lose.loseContext();
  return out;
}

// CPU fallback: sampleField at a coarse grid, painted as a small ImageData the compositor
// smooth-scales up (a coarse 2D gradient in the same ceramic ramp).
function renderGroundCPU(organ, layer) {
  const N = 24;
  const art = makeArtifact(organ, layer.params);
  const vals = expr.sampleField(art.expr, N, 0);
  const vr = layer.render_program.value_range || [-1, 1];
  const ramp = CERAMIC_RAMP.map(hexRgb);
  const img = document.createElement("canvas");
  img.width = N; img.height = N;
  const ctx = img.getContext("2d");
  const data = ctx.createImageData(N, N);
  for (let i = 0; i < vals.length; i++) {
    const x = clamp01((vals[i] - vr[0]) / Math.max(1e-6, vr[1] - vr[0]));
    const s = x * (ramp.length - 1), k = Math.min(ramp.length - 2, Math.floor(s)), f = s - k;
    for (let c = 0; c < 3; c++) data.data[i * 4 + c] = Math.round(ramp[k][c] + (ramp[k + 1][c] - ramp[k][c]) * f);
    data.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return img;
}

// Build the ground once per seed. The palette is forced to the ceramic ramp via makeLayer's
// explicit palette argument; params, expr sha, and the World identity are untouched by that.
export function buildGround(seedU32) {
  const world = groundWorld(seedU32);
  const organ = getOrgan("flowfield");
  const layer = makeLayer(organ, world.layers[0].params, CERAMIC_RAMP);
  if (typeof document === "undefined") return { world, layer, image: null, mode: "plain" };
  try { return { world, layer, image: renderGroundGL(layer.render_program, 768), mode: "gl" }; }
  catch (_) { /* WebGL unavailable or shader rejected: fall through to the CPU path */ }
  try { return { world, layer, image: renderGroundCPU(organ, layer), mode: "cpu" }; }
  catch (_) { return { world, layer, image: null, mode: "plain" }; }
}

// makeScene(canvas): the compositor. Owns the offscreen ink-trace canvas (L3 accumulates by
// stroking each NEW segment once at low alpha; equal-time sampling shades the ellipse honestly)
// and recomposites the full frame from a view object each draw call.
export function makeScene(canvas) {
  const trace = document.createElement("canvas");
  let ground = null, states = null, axes = ["x", "y"], proj = null, revealed = 0, capture = false;
  const unit = () => Math.max(1, Math.min(canvas.width, canvas.height) / 360);

  function project() {
    if (!states) { proj = null; return; }
    const w = canvas.width, h = canvas.height;
    // Stage rect above the instrument band; the capture layout keeps the orbit left of the
    // golden section so the display word and receipt rows own the right and the base.
    const rect = capture
      ? { x: w * 0.05, y: h * 0.10, w: w * 0.53, h: h * 0.56 }
      : { x: w * 0.08, y: h * 0.10, w: w * 0.84, h: h * 0.60 };
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const s of states) {
      const px = s[axes[0]], py = s[axes[1]];
      if (px < x0) x0 = px; if (px > x1) x1 = px;
      if (py < y0) y0 = py; if (py > y1) y1 = py;
    }
    const k = Math.min(rect.w / Math.max(x1 - x0, 1e-6), rect.h / Math.max(y1 - y0, 1e-6));
    proj = { k, cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2, mx: (x0 + x1) / 2, my: (y0 + y1) / 2 };
  }
  const pt = (s) => [proj.cx + (s[axes[0]] - proj.mx) * proj.k, proj.cy - (s[axes[1]] - proj.my) * proj.k];

  function reveal(k) {
    if (!states || !proj) return revealed;
    const g = trace.getContext("2d");
    g.strokeStyle = "rgba(11,12,14,0.16)"; // ink at low alpha: overlap darkens, never glows
    g.lineWidth = Math.max(1, unit() * 0.8);
    g.lineCap = "round";
    const end = Math.min(states.length - 1, revealed + k);
    for (let i = Math.max(1, revealed + 1); i <= end; i++) {
      const a = pt(states[i - 1]), b = pt(states[i]);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    revealed = end;
    return revealed;
  }
  function redrawTrace() {
    trace.getContext("2d").clearRect(0, 0, trace.width, trace.height);
    const r = revealed; revealed = 0; reveal(r);
  }
  function setTrajectory(list, ax) { states = list; axes = ax || ["x", "y"]; revealed = 0; project(); trace.getContext("2d").clearRect(0, 0, trace.width, trace.height); }
  function resize(w, h) {
    canvas.width = Math.max(2, Math.round(w)); canvas.height = Math.max(2, Math.round(h));
    trace.width = canvas.width; trace.height = canvas.height;
    if (states) { project(); redrawTrace(); }
  }

  // One band series relative to its own first value; a conserved series draws dead flat, the
  // damped energy visibly sags. Deflection is clamped inside the band; ink stays ink.
  function seriesLine(ctx, vals, baseY, bandH, color, alpha, w, u) {
    if (!vals || vals.length < 2) return;
    const v0 = vals[0], scale = Math.max(Math.abs(v0), 1e-9) * 0.2;
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    for (let i = 0; i < vals.length; i++) {
      const x = 18 * u + (w - 36 * u) * (i / (vals.length - 1));
      const y = baseY + Math.max(-1, Math.min(1, (v0 - vals[i]) / scale)) * bandH * 0.42;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.restore();
  }

  function draw(view) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height, u = unit();
    const mono = (px, weight) => { ctx.font = `${weight || 400} ${Math.round(px * u)}px ${MONO}`; };
    ctx.save();
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, w, h);                                    // L1
    if (ground && ground.image && view.groundAlpha > 0) {                               // L2
      ctx.globalAlpha = clamp01(view.groundAlpha);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(ground.image, 0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(trace, 0, 0);                                                         // L3
    ctx.fillStyle = INK; ctx.textBaseline = "alphabetic";                               // L5
    mono(11); let ty = 26 * u;
    if (view.seedLine) { ctx.fillText(view.seedLine, 18 * u, ty); ty += 16 * u; }
    if (view.icLine) { ctx.globalAlpha = 0.72; ctx.fillText(view.icLine, 18 * u, ty); ctx.globalAlpha = 1; ty += 16 * u; }
    if (view.note) { ctx.globalAlpha = 0.55; ctx.fillText(view.note, 18 * u, ty); ctx.globalAlpha = 1; }
    const bandTop = h * 0.76, bandH = h * 0.15;
    if (view.law || view.refusal) {                                                     // the instrument band
      ctx.globalAlpha = 0.14; ctx.fillRect(18 * u, bandTop, w - 36 * u, 1); ctx.globalAlpha = 1;
      if (view.law) {
        mono(11);
        const lawY = bandTop - 8 * u;
        ctx.fillText(view.law.text, 18 * u, lawY);
        if (capture && view.witness && view.witness.stamp) {                            // iris use 3 (capture only)
          const dx = 18 * u + ctx.measureText(view.law.text + "  ").width;
          ctx.fillStyle = IRIS; ctx.fillText(view.witness.stamp, dx, lawY); ctx.fillStyle = INK;
        }
        seriesLine(ctx, view.law.series, bandTop + bandH * 0.32, bandH, IRIS, 1, w, u); // iris use 2
      }
      if (view.refusal) {
        seriesLine(ctx, view.refusal.series, bandTop + bandH * 0.32, bandH, INK, 0.5, w, u);
        mono(10); ctx.globalAlpha = 0.72;
        ctx.fillText(view.refusal.label, 18 * u, bandTop + bandH + 12 * u); ctx.globalAlpha = 1;
        mono(10, 700);
        ctx.fillText(view.refusal.stamp, 18 * u + ctx.measureText(view.refusal.label + " ").width, bandTop + bandH + 12 * u);
      }
    }
    if (view.witness && view.witness.rows) {
      mono(10); ctx.globalAlpha = 0.72;
      let wy = bandTop + bandH + 26 * u;
      for (const row of view.witness.rows) { ctx.fillText(row, 18 * u, wy); wy += 13 * u; }
      ctx.globalAlpha = 1;
    }
    if (view.body && proj) {                                                            // iris use 1
      const [bx, by] = pt(view.body);
      ctx.fillStyle = IRIS; ctx.beginPath(); ctx.arc(bx, by, Math.max(2.5, 3.2 * u), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = INK;
    }
    if (capture) {                                                                      // D8: capture layout only
      ctx.font = `700 ${Math.round(w * 0.082)}px ${DISPLAY}`;
      ctx.fillStyle = INK;
      ctx.fillText("FIRST INTEGRAL", Math.round(w * 0.04), Math.round(h - w * 0.018));  // edge-pinned
    }
    ctx.restore();
  }

  return {
    resize, draw, reveal, setTrajectory,
    setGround(g) { ground = g; },
    setCapture(on) { capture = !!on; if (states) { project(); redrawTrace(); } },
    revealedCount: () => revealed,
    done: () => !!states && revealed >= states.length - 1,
  };
}
