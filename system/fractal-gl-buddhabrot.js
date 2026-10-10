// fractal-gl-buddhabrot.js: Buddhabrot and Nebulabrot accumulation on the GPU (WebGL2).
//
// Every orbit point becomes a GL point added into a float framebuffer, so the histogram builds on
// the GPU with additive blending. Orbits advance in lockstep with transform feedback:
//
//   1. Candidates. A batch of seeded points c goes up as a vertex buffer. A transform-feedback pass
//      (rasteriser off) iterates each to escape and writes its escape count n. The counts come back
//      once per batch; the CPU keeps the c whose n falls in the view's window, so the drawing passes
//      only carry orbits that count.
//   2. Steps. One draw per iteration step k. The vertex shader advances each orbit by one step,
//      writes the new z back through transform feedback (ping-pong buffers), and places a point at
//      it, weighted per channel by the orbit's n (the Nebulabrot's three bands). Orbits that have
//      already escaped are clipped. A second draw without feedback adds the mirror image (the set is
//      symmetric about the real axis), which doubles the samples for nothing.
//   3. Display. A full-screen pass tone-maps the histogram, with the same curve as the CPU path
//      (fractal-buddhabrot.js).
//
// The engine runs a few batches per animation frame, until the view's orbit budget is spent, and
// stops on its own if its canvas leaves the page or another view replaces it.

import { BUDDHA_TYPES, SAMPLE_BOX, rng, buddhaLimits } from "./fractal-buddhabrot.js";

const ENGINE = Symbol("buddhaEngine");
const PROGS = Symbol("buddhaPrograms");
// Candidates per batch. Each batch costs one read-back and one draw per step of its longest orbit,
// so larger batches mean far fewer draw calls: at 2^17 a 20-million-orbit Buddhabrot made about
// 600,000 draw calls and took 28 s on an RTX 4090.
const BATCH_MAX = 1 << 20;
// Kept orbits a step pass waits for, so each of its draws carries enough points to be worth a call.
const KEEP_MIN = 1 << 18;

const VS_ESCAPE = `#version 300 es
in vec2 a_c;
uniform int u_max;
out float v_n;
void main() {
  // Points in the main cardioid or the period-2 bulb never escape: answer without iterating, as
  // they are the most expensive candidates of all (every one runs to the limit).
  float xq = a_c.x - 0.25, q = xq * xq + a_c.y * a_c.y;
  bool inside = q * (q + xq) <= 0.25 * a_c.y * a_c.y || (a_c.x + 1.0) * (a_c.x + 1.0) + a_c.y * a_c.y <= 0.0625;
  vec2 z = vec2(0.0);
  int n = inside ? u_max : 0;
  while (n < u_max && dot(z, z) <= 4.0) { z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + a_c; n++; }
  v_n = float(n);
  gl_Position = vec4(0.0);
}`;
const FS_NULL = `#version 300 es
precision mediump float;
out vec4 o;
void main() { o = vec4(0.0); }`;

const VS_STEP = `#version 300 es
in vec2 a_c;
in vec2 a_z;
in float a_n;
uniform float u_k;          // the step being drawn: 1 .. n
uniform vec4  u_view;       // cx, cy, half width, half height
uniform vec3  u_lim;        // per-channel iteration limits
uniform float u_mirror;     // 1, or -1 for the mirror draw
out vec2 v_z;
flat out vec3 v_w;
void main() {
  vec2 z = a_z;
  if (u_mirror > 0.0 && u_k <= a_n) z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + a_c;
  v_z = z;
  // Disjoint bands: red takes the long orbits, green the middle, blue the short. For the
  // Buddhabrot all three limits are equal and every orbit counts in red.
  v_w = vec3(a_n < u_lim.x && a_n >= u_lim.y ? 1.0 : 0.0,
             a_n < u_lim.y && a_n >= u_lim.z ? 1.0 : 0.0,
             a_n < u_lim.z ? 1.0 : 0.0);
  vec2 p = vec2(z.x, z.y * u_mirror);
  gl_PointSize = 1.0;
  // Step 1 is c itself; plotting it would print the sampling box as a flat rectangle.
  gl_Position = (u_k <= a_n && u_k > 1.5) ? vec4((p - u_view.xy) / u_view.zw, 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}`;
const FS_STEP = `#version 300 es
precision highp float;
flat in vec3 v_w;
out vec4 o;
void main() { o = vec4(v_w, 1.0); }`;

const VS_FULL = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error("buddhabrot shader: " + gl.getShaderInfoLog(sh));
  return sh;
}
function link(gl, vs, fs, varyings) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  if (varyings) gl.transformFeedbackVaryings(p, varyings, gl.SEPARATE_ATTRIBS);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("buddhabrot link: " + gl.getProgramInfoLog(p));
  return p;
}

export function buddhaSupported(gl) {
  return typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext
    && !!gl.getExtension("EXT_color_buffer_float") && !!gl.getExtension("EXT_float_blend");
}

/** Stop the engine on a canvas, if one runs. */
export function stopBuddhabrot(canvas) {
  const e = canvas && canvas[ENGINE];
  if (e) e.stop();
}

/**
 * Start (or keep) accumulating a Buddhabrot view on `canvas`. displayFrag is the tone-map program
 * source (built by the caller with the shared colour libraries); colour carries the palette
 * uniforms. Returns the engine, whose stats() report progress.
 */
export function runBuddhabrot(gl, canvas, view, displayFrag, colour) {
  const key = JSON.stringify([view.type, view.cx, view.cy, view.scale, view.maxIter, view.minIter, view.limits, view.orbits, view.seed, canvas.width, canvas.height]);
  let e = canvas[ENGINE];
  if (e && e.key === key && e.gl === gl) { e.setLook(view, colour); e.display(); return e; }
  if (e) e.stop();
  e = canvas[ENGINE] = createEngine(gl, canvas, view, displayFrag, colour, key);
  canvas.__fractalBuddhaStats = e.stats;
  e.start();
  return e;
}

function createEngine(gl, canvas, view, displayFrag, colour, key) {
  const W = canvas.width, H = canvas.height;
  const lim = buddhaLimits(view);
  const target = Math.max(1, Math.round((view.orbits || 4) * 1e6));   // candidate orbits to draw
  const aspect = H / W;
  // Programs live on the context, so a wheel zoom that restarts the engine does not recompile.
  const progs = gl[PROGS] || (gl[PROGS] = { esc: link(gl, VS_ESCAPE, FS_NULL, ["v_n"]), step: link(gl, VS_STEP, FS_STEP, ["v_z"]), show: new Map() });
  const pEsc = progs.esc, pStep = progs.step;
  if (!progs.show.has(displayFrag)) progs.show.set(displayFrag, link(gl, VS_FULL, displayFrag));
  const pShow = progs.show.get(displayFrag);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const buf = () => gl.createBuffer();
  const cBuf = buf(), nBuf = buf(), zA = buf(), zB = buf(), full = buf(), outN = buf();
  gl.bindBuffer(gl.ARRAY_BUFFER, full);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const tf = gl.createTransformFeedback();
  const loc = (p, n) => gl.getAttribLocation(p, n);
  const U = (p, n) => gl.getUniformLocation(p, n);
  let look = { view, colour };
  let raf = 0, stopped = false, drawn = 0, batches = 0, points = 0, ref = [1, 1, 1], lastExposure = 0;
  const t0 = performance.now();
  let lastMs = 0;

  function bindAttr(p, name, b, size) {
    const l = loc(p, name);
    if (l < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
  }
  function unbindAttrs(p, names) { for (const n of names) { const l = loc(p, n); if (l >= 0) gl.disableVertexAttribArray(l); } }

  // One batch: candidates, escape counts, compaction, then every step of the kept orbits.
  // Batch size adapts to the device: it starts at 2^15 and doubles while an escape pass takes
  // under 40 ms, up to 2^20. A software renderer then keeps answering between batches instead of
  // freezing the page for a minute on its first one, and a fast GPU still reaches full size.
  let BATCH = 1 << 15;
  const keepMin = KEEP_MIN;
  // One escape pass over a fresh set of candidates: returns the kept c and their counts.
  function escapePass() {
    const te = performance.now();
    const rand = rng(1 + batches * 7919 + (view.seed || 0) * 104729);
    const cand = new Float32Array(BATCH * 2);
    for (let i = 0; i < BATCH; i++) {
      cand[2 * i] = SAMPLE_BOX.x0 + rand() * (SAMPLE_BOX.x1 - SAMPLE_BOX.x0);
      cand[2 * i + 1] = SAMPLE_BOX.y0 + rand() * (SAMPLE_BOX.y1 - SAMPLE_BOX.y0);
    }
    gl.useProgram(pEsc);
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
    gl.bufferData(gl.ARRAY_BUFFER, cand, gl.DYNAMIC_DRAW);
    bindAttr(pEsc, "a_c", cBuf, 2);
    gl.uniform1i(U(pEsc, "u_max"), lim.max);
    gl.bindBuffer(gl.ARRAY_BUFFER, outN);
    gl.bufferData(gl.ARRAY_BUFFER, BATCH * 4, gl.DYNAMIC_READ);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, outN);
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);   // a buffer written by feedback may not also sit on ARRAY_BUFFER
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, BATCH);
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    unbindAttrs(pEsc, ["a_c"]);
    const ns = new Float32Array(BATCH);
    gl.bindBuffer(gl.ARRAY_BUFFER, outN);
    gl.getBufferSubData(gl.ARRAY_BUFFER, 0, ns);
    batches++; drawn += BATCH;
    // The read-back waits for the pass, so this is its true cost.
    const passMs = performance.now() - te;
    const size = BATCH;
    if (passMs < 40 && BATCH < BATCH_MAX) BATCH *= 2;
    const c = [], n = [];
    for (let i = 0; i < size; i++) { const k = ns[i]; if (k < lim.max && k >= lim.min) { c.push(cand[2 * i], cand[2 * i + 1]); n.push(k); } }
    return { c, n };
  }

  // One batch: escape passes until enough orbits are kept to fill the step draws (a narrow window,
  // like orbits of 500 and more, keeps few per pass), then every step of the kept orbits.
  function batch() {
    const c = [], n = [];
    const t = performance.now();
    do {
      const r = escapePass();
      for (const v of r.c) c.push(v);
      for (const v of r.n) n.push(v);
    } while (n.length < keepMin && drawn < target && performance.now() - t < 200);
    const count = n.length;
    if (!count) return;
    // Longest first: at step k the orbits still running are a prefix of the buffer, and each
    // draw covers only them. A batch then costs the sum of its orbit lengths, not its count times
    // its longest orbit.
    const idx = n.map((_, i) => i).sort((a, b) => n[b] - n[a]);
    const keepC = new Float32Array(count * 2), keepN = new Float32Array(count);
    idx.forEach((i, j) => { keepC[2 * j] = c[2 * i]; keepC[2 * j + 1] = c[2 * i + 1]; keepN[j] = n[i]; });
    const longest = keepN[0];
    let alive = count;
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuf); gl.bufferData(gl.ARRAY_BUFFER, keepC, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuf); gl.bufferData(gl.ARRAY_BUFFER, keepN, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, zA); gl.bufferData(gl.ARRAY_BUFFER, count * 8, gl.DYNAMIC_COPY);
    gl.bindBuffer(gl.ARRAY_BUFFER, zB); gl.bufferData(gl.ARRAY_BUFFER, count * 8, gl.DYNAMIC_COPY);
    // 3. steps
    gl.useProgram(pStep);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, W, H);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform4f(U(pStep, "u_view"), view.cx, view.cy, view.scale / 2, view.scale * aspect / 2);
    gl.uniform3f(U(pStep, "u_lim"), lim.channel[0], lim.channel[1], lim.channel[2]);
    const uK = U(pStep, "u_k"), uM = U(pStep, "u_mirror");
    bindAttr(pStep, "a_c", cBuf, 2);
    bindAttr(pStep, "a_n", nBuf, 1);
    let src = zA, dst = zB;
    for (let k = 1; k <= longest; k++) {
      while (alive > 0 && keepN[alive - 1] < k) alive--;
      // Every buffer slot past `alive` has escaped, so the step and the mirror skip them. The
      // feedback still writes all slots, so the ping-pong buffers stay whole.
      bindAttr(pStep, "a_z", src, 2);
      gl.uniform1f(uK, k);
      gl.uniform1f(uM, 1);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, dst);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);   // a buffer written by feedback may not also sit on ARRAY_BUFFER
      gl.beginTransformFeedback(gl.POINTS);
      gl.drawArrays(gl.POINTS, 0, alive);
      gl.endTransformFeedback();
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
      // k = 1 is c itself: plotting it would print the sampling box as a flat rectangle.
      if (k > 1) {
        // The mirror draw reads the stepped z without stepping again.
        bindAttr(pStep, "a_z", dst, 2);
        gl.uniform1f(uM, -1);
        gl.drawArrays(gl.POINTS, 0, alive);
      }
      const t = src; src = dst; dst = t;
    }
    let sum = 0; for (let j = 0; j < count; j++) sum += keepN[j];
    points += 2 * sum;
    unbindAttrs(pStep, ["a_c", "a_z", "a_n"]);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // Exposure from the histogram itself: the 99.7th percentile of lit pixels, per channel.
  function measure() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    const px = new Float32Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const out = [1, 1, 1];
    for (let c = 0; c < 3; c++) {
      const vals = [];
      for (let i = c; i < px.length; i += 4 * 3) if (px[i] > 0) vals.push(px[i]);
      if (vals.length) { vals.sort((a, b) => a - b); out[c] = Math.max(1, vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.9995))]); }
    }
    ref = out;
  }

  function display() {
    const v = look.view, col = look.colour;
    gl.useProgram(pShow);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(U(pShow, "u_acc"), 0);
    gl.uniform3f(U(pShow, "u_ref"), ref[0], ref[1], ref[2]);
    gl.uniform1f(U(pShow, "u_gamma"), v.gamma ?? 2);
    gl.uniform1i(U(pShow, "u_nebula"), v.type === "nebulabrot" ? 1 : 0);
    gl.uniform3fv(U(pShow, "u_pal[0]"), col.pal);
    bindAttr(pShow, "p", full, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    unbindAttrs(pShow, ["p"]);
  }

  function frame() {
    raf = 0;
    if (stopped) return;
    if (!canvas.isConnected) { stop(); return; }
    const t = performance.now();
    // Spend about 40 ms of work per frame, at least one batch.
    do {
      batch();
    } while (drawn < target && performance.now() - t < 40);
    if (performance.now() - lastExposure > 400 || drawn >= target) { measure(); lastExposure = performance.now(); }
    display();
    lastMs = performance.now() - t0;
    if (drawn < target) raf = requestAnimationFrame(frame);
    else if (typeof canvas.dispatchEvent === "function") canvas.dispatchEvent(new CustomEvent("buddhabrot:done", { bubbles: true }));
  }

  function stop() {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (canvas[ENGINE] === engine) canvas[ENGINE] = null;
    try {
      for (const b of [cBuf, nBuf, zA, zB, full, outN]) gl.deleteBuffer(b);
      gl.deleteTexture(tex); gl.deleteFramebuffer(fbo); gl.deleteTransformFeedback(tf);
    } catch (_) { /* the context may be gone */ }
  }

  const engine = {
    gl, key,
    start() { frame(); },
    stop,
    display,
    setLook(v, c) { look = { view: v, colour: c }; },
    stats: () => ({ drawn, target, batches, points, ms: lastMs, done: drawn >= target, running: !stopped && drawn < target }),
  };
  return engine;
}

export { BUDDHA_TYPES };
