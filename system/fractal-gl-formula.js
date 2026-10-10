// fractal-gl-formula.js: runs formula programs (fractal-glsl-formula.js) and the Lyapunov program
// (fractal-glsl-lyapunov.js) on the 2D fractal canvas's context. One program per compiled formula,
// cached on the canvas by the spec's key, so dragging a parameter slider only changes uniforms.

import { formulaSpec } from "./fractal-formulas.js";
import { buildFormulaFragment } from "./fractal-glsl-formula.js";
import { buildLyapunovFragment, lyapunovSequence } from "./fractal-glsl-lyapunov.js";
import { VERT, MAX_ITERS } from "./fractal-glsl-lib.js";

const CACHE = Symbol("fractalFormulaPrograms");

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("fractal formula shader compile failed: " + log);
  }
  return sh;
}

function program(gl, canvas, key, build) {
  let cache = canvas[CACHE];
  if (!cache || cache.gl !== gl) cache = canvas[CACHE] = { gl, progs: new Map(), buf: null };
  let P = cache.progs.get(key);
  if (P) return { P, cache };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, build()));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("fractal formula link failed: " + gl.getProgramInfoLog(prog));
  if (!cache.buf) {
    cache.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cache.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  }
  const U = (n) => gl.getUniformLocation(prog, n);
  P = { prog, loc: gl.getAttribLocation(prog, "p"), U, u: {} };
  for (const n of ["u_resolution", "u_center", "u_scale", "u_maxIter", "u_julia", "u_p", "u_q", "u_bailout2", "u_degree",
    "u_pal[0]", "u_tint", "u_aa", "u_seq", "u_seqLen", "u_warmup", "u_x0"]) P.u[n.replace("[0]", "")] = U(n);
  if (cache.progs.size > 24) cache.progs.clear();
  cache.progs.set(key, P);
  return { P, cache };
}

function bind(gl, P, cache, w, h) {
  gl.viewport(0, 0, w, h);
  gl.useProgram(P.prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, cache.buf);
  gl.enableVertexAttribArray(P.loc);
  gl.vertexAttribPointer(P.loc, 2, gl.FLOAT, false, 0, 0);
}

/** Draw a formula view. colour: { pal, tint } from fractal-gl.js. Throws FormulaError on a bad formula. */
export function renderFormulaGL(gl, canvas, view, colour, aa) {
  const spec = formulaSpec(view);
  const { P, cache } = program(gl, canvas, "f|" + spec.key, () => buildFormulaFragment(spec));
  const w = canvas.width, h = canvas.height;
  bind(gl, P, cache, w, h);
  const u = P.u;
  gl.uniform2f(u.u_resolution, w, h);
  gl.uniform2f(u.u_center, view.cx, view.cy);
  gl.uniform1f(u.u_scale, view.scale);
  gl.uniform1i(u.u_maxIter, Math.max(1, Math.min(MAX_ITERS, Math.round(view.maxIter))));
  gl.uniform2f(u.u_julia, spec.jc[0], spec.jc[1]);
  gl.uniform2f(u.u_p, spec.p[0], spec.p[1]);
  gl.uniform2f(u.u_q, spec.q[0], spec.q[1]);
  gl.uniform1f(u.u_bailout2, spec.bailout2);
  gl.uniform1f(u.u_degree, spec.degree);
  gl.uniform3fv(u.u_pal, colour.pal);
  gl.uniform3fv(u.u_tint, colour.tint);
  gl.uniform1i(u.u_aa, Math.max(1, Math.min(4, Math.round(aa || 1))));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return spec;
}

/** Draw a Lyapunov view: the plane is (a, b) for the logistic map's two rates. */
export function renderLyapunovGL(gl, canvas, view, colour, aa) {
  const { P, cache } = program(gl, canvas, "lyapunov", () => buildLyapunovFragment());
  const w = canvas.width, h = canvas.height;
  bind(gl, P, cache, w, h);
  const u = P.u;
  const seq = lyapunovSequence(view.sequence);
  gl.uniform2f(u.u_resolution, w, h);
  gl.uniform2f(u.u_center, view.cx, view.cy);
  gl.uniform1f(u.u_scale, view.scale);
  gl.uniform1i(u.u_maxIter, Math.max(16, Math.min(MAX_ITERS, Math.round(view.maxIter))));
  gl.uniform1f(u.u_seq, seq.mask);
  gl.uniform1i(u.u_seqLen, seq.length);
  gl.uniform1i(u.u_warmup, Math.max(0, Math.min(400, Math.round(view.warmup ?? 100))));
  gl.uniform1f(u.u_x0, view.x0 ?? 0.5);
  gl.uniform3fv(u.u_pal, colour.pal);
  gl.uniform3fv(u.u_tint, colour.tint);
  gl.uniform1i(u.u_aa, Math.max(1, Math.min(4, Math.round(aa || 1))));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
