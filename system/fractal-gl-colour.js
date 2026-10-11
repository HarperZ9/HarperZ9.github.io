// fractal-gl-colour.js: the runtime half of the colouring layer (fractal-colouring.js).
//
// Sets the colouring uniforms on whichever fractal program is bound, keeps the image trap's
// texture, and runs histogram equalisation: one pass that writes mu, a read-back, the cumulative
// histogram on the CPU, and a 1024-entry table the colouring pass reads.

import { colourSettings, MODE_INDEX, MODE_MU_OUT } from "./fractal-colouring.js";

const STATE = Symbol("fractalColourState");
export const CDF_BINS = 1024;

function state(gl) {
  let st = gl[STATE];
  if (st) return st;
  // Create on a unit no program samples from: binding a new texture on the active unit would
  // replace whatever the calling program had there (the deep program's BLA table on unit 1 was
  // swapped for a 1 x 1 texel, and its search then took zero-length steps forever).
  gl.activeTexture(gl.TEXTURE3);
  const mk = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    return t;
  };
  st = gl[STATE] = { img: mk(), cdf: mk(), imgKey: null, range: [0, 1] };
  gl.bindTexture(gl.TEXTURE_2D, st.cdf);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.activeTexture(gl.TEXTURE0);
  return st;
}

// The image trap's default: rings and spokes drawn on a canvas, so the mode shows something
// before a visitor brings an image of their own.
function defaultTrapImage() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  grd.addColorStop(0, "#f7e7c4"); grd.addColorStop(0.5, "#c0603a"); grd.addColorStop(1, "#1b0f1e");
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(255,250,232,0.85)"; g.lineWidth = 3;
  for (let r = 24; r < 128; r += 26) { g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); }
  for (let a = 0; a < 12; a++) { g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 128 * Math.cos(a * Math.PI / 6), 128 + 128 * Math.sin(a * Math.PI / 6)); g.stroke(); }
  return c;
}

/** Set the colouring uniforms for `view` on the bound program `prog`; units 3 and 4 hold the textures. */
export function applyColour(gl, prog, view, modeOverride) {
  const st = state(gl);
  const s = colourSettings(view);
  const U = (n) => gl.getUniformLocation(prog, n);
  const mode = modeOverride ?? s.mode;
  gl.uniform1i(U("u_colourMode"), mode);
  gl.uniform2f(U("u_trapP"), s.trapP[0], s.trapP[1]);
  gl.uniform2f(U("u_trapDir"), s.trapDir[0], s.trapDir[1]);
  gl.uniform1f(U("u_trapSize"), s.trapSize);
  gl.uniform1f(U("u_density"), s.density);
  gl.uniform1f(U("u_offset"), s.offset);
  gl.uniform2f(U("u_muRange"), st.range[0], st.range[1]);
  if (mode === MODE_INDEX["trap-image"]) {
    const src = s.image || null;
    const key = src || "default";
    if (st.imgKey !== key) {
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, st.img);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src && typeof src === "object" ? src : defaultTrapImage()); st.imgKey = key; }
      catch (e) { console.warn("fractal: the trap image could not be used", e); }
    }
  }
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, st.img);
  gl.uniform1i(U("u_trapImg"), 3);
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, st.cdf);
  gl.uniform1i(U("u_cdf"), 4);
  gl.activeTexture(gl.TEXTURE0);
  return mode;
}

/**
 * Build the cumulative histogram from a mu pass already drawn into the canvas, and store it for
 * the colouring pass. Pixels inside the set (alpha 0) are left out, so the palette spreads over
 * the exterior alone.
 */
export function buildHistogram(gl, w, h) {
  const st = state(gl);
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const mus = new Float32Array(w * h);
  let k = 0, lo = Infinity, hi = -Infinity;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const mu = (px[i] * 65536 + px[i + 1] * 256 + px[i + 2]) / 256;
    mus[k++] = mu;
    if (mu < lo) lo = mu;
    if (mu > hi) hi = mu;
  }
  const table = histogramTable(mus.subarray(0, k), lo, hi);
  st.range = Number.isFinite(lo) ? [lo, hi] : [0, 1];
  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_2D, st.cdf);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CDF_BINS, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, table);
  return { count: k, range: st.range };
}

/** The cumulative distribution of `mus` over [lo, hi], as CDF_BINS 24-bit values in RGBA8. */
export function histogramTable(mus, lo, hi) {
  const bins = new Float64Array(CDF_BINS);
  const span = Math.max(hi - lo, 1e-6);
  for (const m of mus) bins[Math.min(CDF_BINS - 1, Math.floor((m - lo) / span * CDF_BINS))]++;
  const out = new Uint8Array(CDF_BINS * 4);
  let acc = 0;
  const total = Math.max(1, mus.length);
  for (let b = 0; b < CDF_BINS; b++) {
    acc += bins[b];
    const v = Math.round(acc / total * 16777215);
    out[b * 4] = (v >> 16) & 255; out[b * 4 + 1] = (v >> 8) & 255; out[b * 4 + 2] = v & 255; out[b * 4 + 3] = 255;
  }
  return out;
}

export { MODE_MU_OUT };

/**
 * Draw with the view's colouring. Histogram equalisation takes two passes: the first writes mu,
 * buildHistogram() reads it back into a cumulative table, and the second colours from the table.
 * Shared by every program that pastes the colouring layer.
 */
export function drawColoured(gl, prog, view, w, h, draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3)) {
  const mode = applyColour(gl, prog, view);
  if (mode === MODE_INDEX.histogram) {
    applyColour(gl, prog, view, MODE_MU_OUT);
    draw();
    buildHistogram(gl, w, h);
    gl.useProgram(prog);
    applyColour(gl, prog, view);
  }
  draw();
}

