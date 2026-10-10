// fractal-gl-deep.js: runs the deep-zoom program (fractal-glsl-deep.js) on a WebGL2 context.
//
// Per frame: find or compute the reference orbit (fractal-perturb.js, BigInt), find or build its BLA
// table, upload both as RGBA32F textures, set the view's uniforms and draw. Long frames are drawn in
// horizontal bands, one draw call each, so no single call runs long enough for a GPU watchdog to
// reset the context (Windows' TDR fires at about 2 s).
//
// The reference is kept while it stays near the view: perturbation with rebasing is exact for any
// reference, so a reference two views away still draws correctly, only with fewer BLA skips. It is
// recomputed when the view leaves it, when the iteration budget grows past it, or on a new formula.

import { buildBLA, packBLA, hasBLA, BLA_TEXELS, chooseReference } from "./fractal-perturb.js";
import { viewCentre, decDiff, bitsForScale } from "./fractal-hp.js";
import { buildDeepFragment, DEEP_VERT, DEEP_TEX_W, DEEP_MAX_LEVELS } from "./fractal-glsl-deep.js";
import { drawColoured } from "./fractal-gl-colour.js";
import { colourSettings, fullOrbit, orbitSource } from "./fractal-colouring.js";

export const DEEP_MAX_ITERS = 1000000;
export const DEEP_MIN_SCALE = 1e-300;   // a JS double holds the view width down to here

const STATE = Symbol("fractalDeepState");

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("fractal deep shader compile failed: " + log);
  }
  return sh;
}

function program(gl, st, kind, bla, full = false) {
  const key = kind + (bla ? ":bla" : "") + (full ? ":orbit" : "");
  if (st.progs[key]) return st.progs[key];
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, DEEP_VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, orbitSource(buildDeepFragment(kind, bla), full)));
  gl.bindAttribLocation(prog, 0, "p");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("fractal deep link failed: " + gl.getProgramInfoLog(prog));
  const names = ["u_ref", "u_bla", "u_refLen", "u_maxIter", "u_blaLevels", "u_blaOffset[0]", "u_blaCount[0]",
    "u_resolution", "u_refOffset", "u_m0", "u_e0", "u_flipY", "u_aa", "u_glitchView", "u_band", "u_pal[0]", "u_tint", "u_mark", "u_cApprox"];
  const u = {};
  for (const n of names) u[n.replace("[0]", "")] = gl.getUniformLocation(prog, n);
  st.progs[key] = { prog, u };
  return st.progs[key];
}

function texture(gl, tex, data, texels) {
  const w = DEEP_TEX_W, h = Math.max(1, Math.ceil(texels / w));
  const padded = new Float32Array(w * h * 4);
  padded.set(data.subarray(0, Math.min(data.length, padded.length)));
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, padded);
}

function state(gl, canvas) {
  let st = canvas[STATE];
  if (!st || st.gl !== gl) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    st = canvas[STATE] = { gl, buf, progs: {}, refTex: gl.createTexture(), blaTex: gl.createTexture(), ref: null, bla: null };
  }
  return st;
}

/**
 * Iterations a view of this width wants by default, growing with the zoom depth. Fitted to the
 * escape counts met on the way down to the deep presets: about 4,600 at 1e-41 and 23,700 at 1e-281
 * for the longest-lived pixels, so 1,000 plus 100 per decade of zoom covers both with room.
 */
export function autoIterations(scale) {
  const depth = Math.max(0, Math.log10(3.5 / Math.max(1e-300, Math.abs(scale) || 3.5)));
  return Math.round(1000 + 100 * depth);
}

/**
 * Draw one deep frame. view: { type, cx, cy, re?, im?, scale, maxIter, jx, jy }. colour: the
 * palette floats from fractal-gl.js. Returns stats for the readout and the tests.
 */
export function renderDeep(gl, canvas, view, colour, opts = {}) {
  const st = state(gl, canvas);
  const kind = view.type;
  const julia = kind === "julia";
  const w = canvas.width, h = canvas.height;
  const scale = Math.max(DEEP_MIN_SCALE, view.scale);
  const pixelStep = scale / w;
  const maxIter = Math.max(1, Math.min(DEEP_MAX_ITERS, Math.round(view.maxIter)));
  const centre = viewCentre(view);
  const jRe = view.jre != null ? view.jre : (view.jx != null ? view.jx : -0.8);
  const jIm = view.jim != null ? view.jim : (view.jy != null ? view.jy : 0.156);
  const t0 = performance.now();

  // Reference: reuse while it is near the view (within two widths) and long enough.
  let ref = st.ref;
  let offX = 0, offY = 0;
  const bits = bitsForScale(scale);
  if (ref && ref.kind === kind && ref.maxIter >= maxIter && ref.jRe === String(jRe) && ref.jIm === String(jIm) && ref.bits >= bits - 32) {
    offX = decDiff(centre.re, ref.re, Math.max(bits, ref.bits));
    offY = decDiff(centre.im, ref.im, Math.max(bits, ref.bits));
    if (Math.hypot(offX, offY) > 2 * scale) ref = null;
  } else ref = null;
  let refMs = 0;
  if (!ref) {
    const pick = chooseReference({ kind, re: centre.re, im: centre.im, jRe, jIm, scale, w, h, maxIter });
    ref = st.ref = { ...pick.ref, re: pick.re, im: pick.im, maxIter, jRe: String(jRe), jIm: String(jIm), uploaded: false };
    offX = decDiff(centre.re, ref.re, ref.bits);
    offY = decDiff(centre.im, ref.im, ref.bits);
    refMs = performance.now() - t0;
    st.bla = null;
  }
  if (!ref.uploaded) {
    texture(gl, st.refTex, ref.data, ref.len + 1);
    ref.uploaded = true;
  }

  // BLA: built for the largest |dc| in the view; rebuilt when the view outgrows it.
  // Orbit traps and the triangle inequality average read every iterate, so BLA, which skips them,
  // is off for those colourings (modes 2 to 6).
  const cmode = colourSettings(view).mode;
  const useBLA = hasBLA(kind) && opts.bla !== false && !(cmode >= 2 && cmode <= 6);
  let blaMs = 0;
  const halfDiag = 0.5 * Math.hypot(w, h) * pixelStep;
  const lDc = julia ? -Infinity : Math.log2(Math.hypot(offX, offY) + halfDiag);
  if (useBLA && (!st.bla || st.bla.ref !== ref || (!julia && (lDc > st.bla.lDc || lDc < st.bla.lDc - 6)))) {
    const t1 = performance.now();
    const table = buildBLA(ref, julia ? -Infinity : lDc + 1, { julia });
    if (table.levels.length > DEEP_MAX_LEVELS) table.levels.length = DEEP_MAX_LEVELS;
    texture(gl, st.blaTex, packBLA(table), table.entries.length * BLA_TEXELS);
    st.bla = { ref, lDc: julia ? -Infinity : lDc + 1, levels: table.levels, entries: table.entries.length };
    blaMs = performance.now() - t1;
  }

  const P = program(gl, st, kind, useBLA, fullOrbit(view));
  gl.useProgram(P.prog);
  gl.viewport(0, 0, w, h);
  gl.bindBuffer(gl.ARRAY_BUFFER, st.buf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st.refTex);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, st.blaTex);
  const u = P.u;
  gl.uniform1i(u.u_ref, 0);
  gl.uniform1i(u.u_bla, 1);
  gl.uniform1i(u.u_refLen, ref.len);
  gl.uniform1i(u.u_maxIter, maxIter);
  const lv = useBLA && st.bla ? st.bla.levels : [];
  const offs = new Int32Array(DEEP_MAX_LEVELS), cnts = new Int32Array(DEEP_MAX_LEVELS);
  lv.forEach((l, i) => { offs[i] = l.offset; cnts[i] = l.count; });
  gl.uniform1i(u.u_blaLevels, lv.length);
  gl.uniform1iv(u.u_blaOffset, offs);
  gl.uniform1iv(u.u_blaCount, cnts);
  gl.uniform2f(u.u_resolution, w, h);
  gl.uniform2f(u.u_refOffset, offX / pixelStep, offY / pixelStep);
  const e0 = Math.floor(Math.log2(pixelStep));
  gl.uniform1f(u.u_m0, pixelStep / 2 ** e0);
  gl.uniform1f(u.u_e0, e0);
  gl.uniform1f(u.u_flipY, kind === "burningship" ? -1 : 1);
  gl.uniform1i(u.u_aa, Math.max(1, Math.min(4, Math.round(opts.aa || 1))));
  gl.uniform1i(u.u_glitchView, opts.glitchView ? 1 : 0);
  gl.uniform3fv(u.u_pal, colour.pal);
  gl.uniform1i(gl.getUniformLocation(P.prog, "u_palN"), colour.pal.n || 6);
  gl.uniform3fv(u.u_tint, colour.tint);
  gl.uniform3f(u.u_mark, 1.0, 0.18, 0.02);

  // Bands: about 8 M pixel-iterations per call before BLA, so a 1600 x 1000 frame at 50k iterations
  // goes out in a few dozen calls. Each call is short; the browser composites only the finished frame.
  const cost = w * h * Math.min(maxIter, 20000) * Math.max(1, (opts.aa || 1) ** 2);
  const bands = Math.max(1, Math.min(h, Math.ceil(cost / 4e8)));
  const rows = Math.ceil(h / bands);
  gl.uniform2f(u.u_cApprox, julia ? +jRe : view.cx, julia ? +jIm : view.cy);
  const t2 = performance.now();
  drawColoured(gl, P.prog, view, w, h, () => {
    for (let y = 0; y < h; y += rows) {
      gl.uniform4f(u.u_band, 0, y, w, Math.min(h, y + rows));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (bands > 1) gl.flush();
    }
  });
  const stats = {
    path: "perturbation", kind, maxIter, refLen: ref.len, refBits: ref.bits, refMs, blaMs,
    blaEntries: useBLA && st.bla ? st.bla.entries : 0, blaLevels: lv.length, bands,
    submitMs: performance.now() - t2, refReused: refMs === 0,
  };
  canvas.__fractalDeepStats = stats;
  return stats;
}

/** Drop the cached reference (tests, and a formula change that keeps the same kind). */
export function resetDeep(canvas) {
  const st = canvas && canvas[STATE];
  if (st) { st.ref = null; st.bla = null; }
}
